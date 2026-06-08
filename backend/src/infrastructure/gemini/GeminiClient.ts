import { SecretsManagerClient, GetSecretValueCommand } from '@aws-sdk/client-secrets-manager';
import { AiTone } from '../../domain/shared/types';

const sm = new SecretsManagerClient({ region: process.env.AWS_REGION ?? 'ap-northeast-1' });
let _apiKey: string | null = null;

const getApiKey = async (): Promise<string | null> => {
  if (_apiKey) return _apiKey;
  if (process.env.GEMINI_API_KEY) { _apiKey = process.env.GEMINI_API_KEY; return _apiKey; }
  try {
    const r = await sm.send(new GetSecretValueCommand({ SecretId: 'yasrun/gemini-api-key' }));
    _apiKey = JSON.parse(r.SecretString!).GEMINI_API_KEY;
    return _apiKey;
  } catch { return null; }
};

const GEMINI_MODEL = 'gemini-2.0-flash';

type GeminiContent = { role: string; parts: Array<{ text?: string; inline_data?: { mime_type: string; data: string } }> };

const generateContent = async (contents: GeminiContent[], model = GEMINI_MODEL): Promise<unknown> => {
  const apiKey = await getApiKey();
  if (!apiKey) {
    return { candidates: [{ content: { parts: [{ text: '{"menu_name":"テスト料理","kcal":500,"protein_g":20,"fat_g":15,"carb_g":60,"confidence":"low"}' }] } }] };
  }
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`;
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ contents, generationConfig: { temperature: 0.4, topP: 0.95, maxOutputTokens: 1024 } }),
  });
  if (!res.ok) throw new Error(`Gemini API error: ${res.status} ${await res.text()}`);
  return res.json();
};

const extractText = (raw: unknown): string =>
  (raw as { candidates: Array<{ content: { parts: Array<{ text?: string }> } }> })
    .candidates?.[0]?.content?.parts?.[0]?.text ?? '';

const parseJson = (text: string): unknown => {
  const cleaned = text.replace(/```json\n?|\n?```/g, '').replace(/^[^{]*/, '').replace(/[^}]*$/, '').trim();
  return JSON.parse(cleaned);
};

export type MealAnalysis = {
  menu_name: string;
  kcal: number;
  protein_g: number;
  fat_g: number;
  carb_g: number;
  confidence: 'high' | 'medium' | 'low';
  geminiRaw: string;
  error?: string;
};

export const analyzeMeal = async (base64Image: string): Promise<MealAnalysis> => {
  const contents: GeminiContent[] = [{
    role: 'user',
    parts: [
      { inline_data: { mime_type: 'image/jpeg', data: base64Image } },
      { text: `# 指示\nこの食事画像の栄養成分を推定し、**JSONのみ**を返してください。\n\n# 出力形式\n{"menu_name":"料理名","kcal":数値,"protein_g":数値,"fat_g":数値,"carb_g":数値,"confidence":"high|medium|low"}\n\n# ルール\n- menu_name: 日本語で最も具体的な料理名\n- kcal/protein_g/fat_g/carb_g: 整数\n- confidence: 画像明瞭=high, 大まか=medium, 不明瞭=low` },
    ],
  }];
  const raw = await generateContent(contents, GEMINI_MODEL);
  const text = extractText(raw);
  try {
    const parsed = parseJson(text) as Record<string, unknown>;
    return {
      menu_name: parsed.menu_name as string,
      kcal: Math.max(0, Math.round(Number(parsed.kcal) || 0)),
      protein_g: Math.max(0, Math.round(Number(parsed.protein_g) || 0)),
      fat_g: Math.max(0, Math.round(Number(parsed.fat_g) || 0)),
      carb_g: Math.max(0, Math.round(Number(parsed.carb_g) || 0)),
      confidence: parsed.confidence as MealAnalysis['confidence'],
      geminiRaw: text,
    };
  } catch {
    return { menu_name: '', kcal: 0, protein_g: 0, fat_g: 0, carb_g: 0, confidence: 'low', geminiRaw: text, error: 'analysis_failed' };
  }
};

const AI_TONE_INSTRUCTION: Record<AiTone, string> = {
  friendly: '友達のように親しみやすく、励ましながら話してください。',
  strict:   'コーチのように厳しく、妥協なく現実を伝えてください。',
  gentle:   '優しく穏やかに、相手を傷つけないよう配慮して話してください。',
  cool:     '感情を抑えてクールに、事実と数字を中心に話してください。',
};

export type DailyAdviceContext = {
  age: number; heightCm: number; currentWeight: number; targetWeight: number;
  lifestyle: string; aiTone: AiTone; currentDays: number; bodyState: number;
  recentWeights: number[]; recentKcal: number[]; recentExercise: string[];
};

export type DailyAdviceResult = {
  greeting: string; meal_advice: string; exercise_advice: string; error?: string;
};

export const generateDailyAdvice = async (ctx: DailyAdviceContext): Promise<DailyAdviceResult> => {
  const toneInstruction = AI_TONE_INSTRUCTION[ctx.aiTone] ?? AI_TONE_INSTRUCTION.friendly;
  const diff = (ctx.currentWeight - ctx.targetWeight).toFixed(1);
  const trend = ctx.recentWeights.length >= 2
    ? (ctx.recentWeights[0] - ctx.recentWeights[ctx.recentWeights.length - 1]).toFixed(1) : '0';

  const prompt = `# ユーザー情報\n- 年齢: ${ctx.age}歳 / 身長: ${ctx.heightCm}cm\n- 現在体重: ${ctx.currentWeight}kg / 目標体重: ${ctx.targetWeight}kg（あと${diff}kg）\n- 7日間体重推移: ${ctx.recentWeights.join('→')}kg（${Number(trend) > 0 ? '+' : ''}${trend}kg）\n- 活動レベル: ${ctx.lifestyle}\n- ストリーク: ${ctx.currentDays}日\n- 体型ペナルティ: ${ctx.bodyState}/4\n- 直近3日カロリー: ${ctx.recentKcal.map(k => k + 'kcal').join(' / ')}\n- 直近3日運動: ${ctx.recentExercise.length ? ctx.recentExercise.join(', ') : 'なし'}\n\n# 指示\n${toneInstruction}\n上記データをもとに今日のアドバイスを**JSONのみ**で返してください。\n\n{"greeting":"今日の挨拶（1文）","meal_advice":"食事アドバイス（2文以内）","exercise_advice":"運動アドバイス（2文以内）"}`;

  const raw = await generateContent([{ role: 'user', parts: [{ text: prompt }] }]);
  const text = extractText(raw);
  try {
    return parseJson(text) as DailyAdviceResult;
  } catch {
    return { greeting: '今日も頑張ろう！', meal_advice: 'バランスよく食べましょう。', exercise_advice: '少し体を動かしましょう。', error: 'parse_failed' };
  }
};

export const generateInterrogationMessage = async ({ missedDays, aiTone }: { missedDays: number; aiTone: AiTone }): Promise<string> => {
  const prompt = `ユーザーは${missedDays}日間ログインしていませんでした。\n口調設定: ${aiTone}\n「この${missedDays}日間、運動はしましたか？」という内容を1〜2文で問いかけてください。プレーンテキストのみ返してください。`;
  const raw = await generateContent([{ role: 'user', parts: [{ text: prompt }] }]);
  return extractText(raw).trim() || `この${missedDays}日間、運動はしましたか？`;
};

export const generateAvatarImage = async (base64Face: string, bodyDescription: string): Promise<{ image_base64: string; mime_type: string }> => {
  const contents: GeminiContent[] = [{
    role: 'user',
    parts: [
      { inline_data: { mime_type: 'image/jpeg', data: base64Face } },
      { text: `この顔写真の人物をベースにした、アニメ・漫画風のフルボディキャラクターを生成してください。\n体型: ${bodyDescription}\nスタイル: 親しみやすいアニメ風、明るい色彩、白背景\nサイズ: 縦長 (3:4比率)\nJSONのみで返答: { "image_base64": "...", "mime_type": "image/png" }` },
    ],
  }];
  const raw = await generateContent(contents, GEMINI_MODEL);
  const text = extractText(raw);
  return parseJson(text) as { image_base64: string; mime_type: string };
};
