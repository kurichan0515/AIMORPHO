import { SecretsManagerClient, GetSecretValueCommand } from '@aws-sdk/client-secrets-manager';
import { AiTone } from '../../domain/shared/types';

const sm = new SecretsManagerClient({ region: process.env.AWS_REGION ?? 'ap-northeast-1' });
let _apiKey: string | null = null;

const getApiKey = async (): Promise<string | null> => {
  if (_apiKey) return _apiKey;
  if (process.env.GEMINI_API_KEY) { _apiKey = process.env.GEMINI_API_KEY; return _apiKey; }
  try {
    const r = await sm.send(new GetSecretValueCommand({ SecretId: 'aimorpho/gemini-api-key' }));
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
  goalMode?: string;
  lifestyle: string; aiTone: AiTone; hasGym?: boolean; currentDays: number; bodyState: number;
  recentWeights: number[]; recentKcal: number[]; recentExercise: string[];
};

export type DailyAdviceResult = {
  greeting: string; meal_advice: string; exercise_advice: string; error?: string;
};

const GOAL_MODE_LABEL: Record<string, string> = {
  diet:     '体重を減らす（減量）',
  bulk:     '体重・筋肉を増やす（増量）',
  maintain: '体型を維持する（維持）',
};

export const generateDailyAdvice = async (ctx: DailyAdviceContext): Promise<DailyAdviceResult> => {
  const toneInstruction = AI_TONE_INSTRUCTION[ctx.aiTone] ?? AI_TONE_INSTRUCTION.friendly;
  const rawDiff = ctx.currentWeight - ctx.targetWeight;
  const mode = ctx.goalMode ?? 'diet';
  const goalLabel = GOAL_MODE_LABEL[mode] ?? GOAL_MODE_LABEL.diet;
  const diffLabel = mode === 'bulk'
    ? `あと${Math.abs(rawDiff).toFixed(1)}kg増加`
    : mode === 'maintain'
    ? `目標体重との差: ±${Math.abs(rawDiff).toFixed(1)}kg`
    : `あと${Math.abs(rawDiff).toFixed(1)}kg`;
  const trend = ctx.recentWeights.length >= 2
    ? (ctx.recentWeights[0] - ctx.recentWeights[ctx.recentWeights.length - 1]).toFixed(1) : '0';

  const gymLabel = ctx.hasGym === true ? 'ジム通い: あり（ジムのウェイトトレーニングメニューを提案可）' : ctx.hasGym === false ? 'ジム通い: なし（自宅・屋外メニューのみ提案）' : 'ジム通い: 不明';
  const prompt = `# ユーザー情報\n- 年齢: ${ctx.age}歳 / 身長: ${ctx.heightCm}cm\n- 目標: ${goalLabel}\n- 現在体重: ${ctx.currentWeight}kg / 目標体重: ${ctx.targetWeight}kg（${diffLabel}）\n- 7日間体重推移: ${ctx.recentWeights.join('→')}kg（${Number(trend) > 0 ? '+' : ''}${trend}kg）\n- 活動レベル: ${ctx.lifestyle}\n- ${gymLabel}\n- ストリーク: ${ctx.currentDays}日\n- 体型変化進捗: ${ctx.bodyState}/4\n- 直近3日カロリー: ${ctx.recentKcal.map(k => k + 'kcal').join(' / ')}\n- 直近3日運動: ${ctx.recentExercise.length ? ctx.recentExercise.join(', ') : 'なし'}\n\n# 指示\n${toneInstruction}\nユーザーの目標（${goalLabel}）に沿ったアドバイスを**JSONのみ**で返してください。ジム通いの有無に応じた運動提案をしてください。\n\n{"greeting":"今日の挨拶（1文）","meal_advice":"食事アドバイス（2文以内）","exercise_advice":"運動アドバイス（2文以内）"}`;

  const raw = await generateContent([{ role: 'user', parts: [{ text: prompt }] }]);
  const text = extractText(raw);
  try {
    return parseJson(text) as DailyAdviceResult;
  } catch {
    return { greeting: '今日も頑張ろう！', meal_advice: 'バランスよく食べましょう。', exercise_advice: '少し体を動かしましょう。', error: 'parse_failed' };
  }
};

export type MealSuggestionResult = {
  suggestion: string;
  meals: Array<{ name: string; kcal: number; protein_g: number; fat_g: number; carb_g: number; reason: string }>;
};

export const generateMealSuggestion = async (ctx: {
  age: number; heightCm: number; currentWeight: number; targetWeight: number;
  goalMode: string; lifestyle: string; aiTone: AiTone;
  todayKcal: number; todayProtein: number; todayFat: number; todayCarb: number;
  targetKcal: number;
}): Promise<MealSuggestionResult> => {
  const toneInstruction = AI_TONE_INSTRUCTION[ctx.aiTone] ?? AI_TONE_INSTRUCTION.friendly;
  const remaining = Math.max(0, ctx.targetKcal - ctx.todayKcal);
  const prompt = `# ユーザー情報\n- 年齢:${ctx.age}歳 / 身長:${ctx.heightCm}cm / 体重:${ctx.currentWeight}kg\n- 目標:${GOAL_MODE_LABEL[ctx.goalMode] ?? ctx.goalMode} / 目標体重:${ctx.targetWeight}kg\n- 活動レベル:${ctx.lifestyle}\n- 目標摂取kcal:${ctx.targetKcal}kcal\n- 今日の摂取状況: ${ctx.todayKcal}kcal（たんぱく質:${ctx.todayProtein}g / 脂質:${ctx.todayFat}g / 糖質:${ctx.todayCarb}g）\n- 残り摂取可能:${remaining}kcal\n\n# 指示\n${toneInstruction}\n残り摂取カロリーに合わせた食事提案を**JSONのみ**で返してください。\n\n{"suggestion":"全体コメント（1〜2文）","meals":[{"name":"料理名","kcal":数値,"protein_g":数値,"fat_g":数値,"carb_g":数値,"reason":"選んだ理由（1文）"}]}`;
  const raw = await generateContent([{ role: 'user', parts: [{ text: prompt }] }]);
  const text = extractText(raw);
  try {
    return parseJson(text) as MealSuggestionResult;
  } catch {
    return { suggestion: 'バランスよく食べましょう。', meals: [] };
  }
};

export type ExerciseSuggestionItem = {
  name: string; sets: string; kcal_estimate: number; muscle_groups: string[]; reason: string;
};
export type ExerciseSuggestionResult = {
  summary: string;
  exercises: ExerciseSuggestionItem[];
};

export const generateExerciseSuggestion = async (ctx: {
  age: number; heightCm: number; currentWeight: number; targetWeight: number;
  goalMode: string; lifestyle: string; aiTone: AiTone; hasGym: boolean;
  goToGym: boolean;
  recentMuscleGroups: string[];
}): Promise<ExerciseSuggestionResult> => {
  const toneInstruction = AI_TONE_INSTRUCTION[ctx.aiTone] ?? AI_TONE_INSTRUCTION.friendly;
  const location = ctx.goToGym ? 'ジム（マシン・フリーウェイト利用可）' : '自宅・屋外（器具なし）';
  const avoidGroups = ctx.recentMuscleGroups.length
    ? `直近1週間で鍛えた部位: ${[...new Set(ctx.recentMuscleGroups)].join(', ')} → これらを避けてバランスよく提案すること`
    : '直近1週間の記録なし → バランスよく提案すること';
  const prompt = `# ユーザー情報\n- 年齢:${ctx.age}歳 / 身長:${ctx.heightCm}cm / 体重:${ctx.currentWeight}kg\n- 目標:${GOAL_MODE_LABEL[ctx.goalMode] ?? ctx.goalMode} / 目標体重:${ctx.targetWeight}kg\n- 活動レベル:${ctx.lifestyle}\n- トレーニング場所:${location}\n- ${avoidGroups}\n\n# 指示\n${toneInstruction}\n今日のトレーニングメニューを**JSONのみ**で返してください。3〜5種目を提案すること。\n\n{"summary":"今日のメニュー概要（1〜2文）","exercises":[{"name":"種目名","sets":"例: 3×10回","kcal_estimate":消費kcal推定値(整数),"muscle_groups":["部位1","部位2"],"reason":"選んだ理由（1文）"}]}`;
  const raw = await generateContent([{ role: 'user', parts: [{ text: prompt }] }]);
  const text = extractText(raw);
  try {
    return parseJson(text) as ExerciseSuggestionResult;
  } catch {
    return { summary: '今日も頑張ろう！', exercises: [] };
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
