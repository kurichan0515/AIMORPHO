const { SecretsManagerClient, GetSecretValueCommand } = require('@aws-sdk/client-secrets-manager');

const sm = new SecretsManagerClient({ region: process.env.AWS_REGION || 'ap-northeast-1' });

let _apiKey = null;

const getApiKey = async () => {
  if (_apiKey) return _apiKey;
  const r = await sm.send(new GetSecretValueCommand({ SecretId: 'yasrun/gemini-api-key' }));
  _apiKey = JSON.parse(r.SecretString).GEMINI_API_KEY;
  return _apiKey;
};

const GEMINI_MODEL = 'gemini-2.0-flash';
const GEMINI_VISION_MODEL = 'gemini-2.0-flash';

const generateContent = async (contents, model = GEMINI_MODEL) => {
  const apiKey = await getApiKey();
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`;
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ contents }),
  });
  if (!res.ok) throw new Error(`Gemini API error: ${res.status}`);
  return res.json();
};

// 食事解析プロンプト
const analyzeMeal = async (base64Image, mimeType = 'image/jpeg') => {
  const contents = [{
    parts: [
      {
        inline_data: { mime_type: mimeType, data: base64Image },
      },
      {
        text: `この食事画像を解析し、以下のJSONのみを返してください（説明不要）:
{
  "menu_name": "料理名（日本語）",
  "kcal": 数値,
  "protein_g": 数値,
  "fat_g": 数値,
  "carb_g": 数値,
  "confidence": "high|medium|low"
}`,
      },
    ],
    role: 'user',
  }];
  const raw = await generateContent(contents, GEMINI_VISION_MODEL);
  const text = raw.candidates?.[0]?.content?.parts?.[0]?.text || '';
  try {
    const cleaned = text.replace(/```json\n?|\n?```/g, '').trim();
    return { ...JSON.parse(cleaned), geminiRaw: text };
  } catch {
    return { error: 'analysis_failed', geminiRaw: text };
  }
};

// AIアドバイス生成プロンプト
const generateDailyAdvice = async (ctx) => {
  const prompt = `ユーザー情報:
- 年齢: ${ctx.age}歳 / 身長: ${ctx.heightCm}cm
- 現在体重: ${ctx.currentWeight}kg / 目標体重: ${ctx.targetWeight}kg
- 活動レベル: ${ctx.lifestyle} / 口調設定: ${ctx.aiTone}
- ストリーク: ${ctx.currentDays}日継続 / 体型状態: ${ctx.bodyState}/4
- 直近7日体重(kg): ${ctx.recentWeights.join(', ')}
- 直近3日摂取kcal: ${ctx.recentKcal.join(', ')}
- 直近3日運動: ${ctx.recentExercise.join(', ')}

以下のJSONのみ返してください（${ctx.aiTone}口調で）:
{
  "greeting": "今日の挨拶（1文）",
  "meal_advice": "食事アドバイス（2文以内）",
  "exercise_advice": "運動アドバイス（2文以内）"
}`;

  const raw = await generateContent([{ parts: [{ text: prompt }], role: 'user' }]);
  const text = raw.candidates?.[0]?.content?.parts?.[0]?.text || '';
  try {
    const cleaned = text.replace(/```json\n?|\n?```/g, '').trim();
    return JSON.parse(cleaned);
  } catch {
    return { greeting: '今日も頑張ろう！', meal_advice: '', exercise_advice: '', error: 'parse_failed' };
  }
};

module.exports = { generateContent, analyzeMeal, generateDailyAdvice, GEMINI_MODEL, GEMINI_VISION_MODEL };
