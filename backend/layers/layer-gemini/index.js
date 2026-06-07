const { SecretsManagerClient, GetSecretValueCommand } = require('@aws-sdk/client-secrets-manager');

const sm = new SecretsManagerClient({ region: process.env.AWS_REGION || 'ap-northeast-1' });

let _apiKey = null;

const getApiKey = async () => {
  if (_apiKey) return _apiKey;
  if (process.env.GEMINI_API_KEY) {
    _apiKey = process.env.GEMINI_API_KEY;
    return _apiKey;
  }
  const r = await sm.send(new GetSecretValueCommand({ SecretId: 'yasrun/gemini-api-key' }));
  _apiKey = JSON.parse(r.SecretString).GEMINI_API_KEY;
  return _apiKey;
};

const GEMINI_MODEL       = 'gemini-2.0-flash';
const GEMINI_VISION_MODEL = 'gemini-2.0-flash';

const generateContent = async (contents, model = GEMINI_MODEL) => {
  const apiKey = await getApiKey().catch(() => null);
  // APIキー未設定 → モックレスポンス返す（ローカル開発用）
  if (!apiKey) {
    return {
      candidates: [{
        content: {
          parts: [{ text: '{"menu_name":"テスト料理","kcal":500,"protein_g":20,"fat_g":15,"carb_g":60,"confidence":"low"}' }],
        },
      }],
    };
  }
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`;
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      contents,
      generationConfig: { temperature: 0.4, topP: 0.95, maxOutputTokens: 1024 },
    }),
  });
  if (!res.ok) {
    const body = await res.text();
    throw new Error(`Gemini API error: ${res.status} ${body}`);
  }
  return res.json();
};

// 食事解析プロンプト（精度向上: システム指示 + 例示）
const analyzeMeal = async (base64Image, mimeType = 'image/jpeg') => {
  const contents = [{
    role: 'user',
    parts: [
      { inline_data: { mime_type: mimeType, data: base64Image } },
      {
        text: `# 指示
この食事画像の栄養成分を推定し、**JSONのみ**を返してください。前後の説明文は一切不要。

# 出力形式（必ずこの形式のみ）
{"menu_name":"料理名","kcal":数値,"protein_g":数値,"fat_g":数値,"carb_g":数値,"confidence":"high|medium|low"}

# ルール
- menu_name: 日本語で最も具体的な料理名
- kcal/protein_g/fat_g/carb_g: 整数または小数（単位なし）
- confidence: 画像が明瞭で料理が特定できる=high, 大まかに特定できる=medium, 不明瞭または複数の可能性=low
- 1皿単位で推定
- 食材が見えない・画像が不鮮明な場合もlow confidenceで推定を出す`,
      },
    ],
  }];

  const raw = await generateContent(contents, GEMINI_VISION_MODEL);
  const text = raw.candidates?.[0]?.content?.parts?.[0]?.text || '';
  try {
    const cleaned = text.replace(/```json\n?|\n?```/g, '').replace(/^[^{]*/, '').replace(/[^}]*$/, '').trim();
    const parsed = JSON.parse(cleaned);
    // 数値バリデーション
    parsed.kcal      = Math.max(0, Math.round(Number(parsed.kcal) || 0));
    parsed.protein_g = Math.max(0, Math.round(Number(parsed.protein_g) || 0));
    parsed.fat_g     = Math.max(0, Math.round(Number(parsed.fat_g) || 0));
    parsed.carb_g    = Math.max(0, Math.round(Number(parsed.carb_g) || 0));
    return { ...parsed, geminiRaw: text };
  } catch {
    return { error: 'analysis_failed', geminiRaw: text };
  }
};

// AIアドバイス生成プロンプト（口調別システム指示）
const AI_TONE_INSTRUCTION = {
  friendly: '友達のように親しみやすく、励ましながら話してください。',
  strict:   'コーチのように厳しく、妥協なく現実を伝えてください。',
  gentle:   '優しく穏やかに、相手を傷つけないよう配慮して話してください。',
  cool:     '感情を抑えてクールに、事実と数字を中心に話してください。',
};

const generateDailyAdvice = async (ctx) => {
  const toneInstruction = AI_TONE_INSTRUCTION[ctx.aiTone] || AI_TONE_INSTRUCTION.friendly;
  const diff = ctx.currentWeight && ctx.targetWeight ? (ctx.currentWeight - ctx.targetWeight).toFixed(1) : '?';
  const trend = ctx.recentWeights.length >= 2
    ? (ctx.recentWeights[0] - ctx.recentWeights[ctx.recentWeights.length - 1]).toFixed(1)
    : '0';

  const prompt = `# ユーザー情報
- 年齢: ${ctx.age}歳 / 身長: ${ctx.heightCm}cm
- 現在体重: ${ctx.currentWeight}kg / 目標体重: ${ctx.targetWeight}kg（あと${diff}kg）
- 7日間の体重推移: ${ctx.recentWeights.join('→')}kg（${Number(trend) > 0 ? '+' : ''}${trend}kg）
- 活動レベル: ${ctx.lifestyle}
- ストリーク: ${ctx.currentDays}日継続
- 体型ペナルティ: ${ctx.bodyState}/4${ctx.bodyState >= 2 ? '（ペナルティ中）' : ''}
- 直近3日カロリー: ${ctx.recentKcal.map(k => k + 'kcal').join(' / ')}
- 直近3日運動: ${ctx.recentExercise.length ? ctx.recentExercise.join(', ') : 'なし'}

# 指示
${toneInstruction}
上記データをもとに今日のアドバイスを**JSONのみ**で返してください。

{"greeting":"今日の挨拶（1文、ユーザーの状況を踏まえた内容）","meal_advice":"食事アドバイス（2文以内、具体的に）","exercise_advice":"運動アドバイス（2文以内、具体的に）"}`;

  const raw = await generateContent([{ role: 'user', parts: [{ text: prompt }] }]);
  const text = raw.candidates?.[0]?.content?.parts?.[0]?.text || '';
  try {
    const cleaned = text.replace(/```json\n?|\n?```/g, '').replace(/^[^{]*/, '').replace(/[^}]*$/, '').trim();
    return JSON.parse(cleaned);
  } catch {
    return { greeting: '今日も頑張ろう！', meal_advice: 'バランスよく食べましょう。', exercise_advice: '少しでも体を動かしましょう。', error: 'parse_failed' };
  }
};

// ペナルティ尋問メッセージ生成
const generateInterrogationMessage = async (ctx) => {
  const prompt = `ユーザーは${ctx.missedDays}日間ログインしていませんでした。
口調設定: ${ctx.aiTone}
「この${ctx.missedDays}日間、運動はしましたか？」という内容を1〜2文で問いかけてください。プレーンテキストのみ返してください。`;

  const raw = await generateContent([{ role: 'user', parts: [{ text: prompt }] }]);
  return raw.candidates?.[0]?.content?.parts?.[0]?.text?.trim() || `この${ctx.missedDays}日間、運動はしましたか？`;
};

module.exports = {
  generateContent,
  analyzeMeal,
  generateDailyAdvice,
  generateInterrogationMessage,
  GEMINI_MODEL,
  GEMINI_VISION_MODEL,
};
