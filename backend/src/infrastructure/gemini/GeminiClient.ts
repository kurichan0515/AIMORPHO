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

export const MUSCLE_GROUPS = ['胸', '背中', '肩', '腕', '腹', '脚', '臀部', '全身'] as const;

const SAFETY_SUFFIX = `
# 出力制約（必須）
- 疾病の治療・予防・診断には一切言及しない
- 「〇〇病に効果的」「病気を防ぐ」等の表現を使わない
- 医師への相談が必要な内容は「医師へご相談ください」を含める
- あくまで一般的な健康管理の参考情報として提供する`;

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
  const prompt = `# ユーザー情報\n- 年齢: ${ctx.age}歳 / 身長: ${ctx.heightCm}cm\n- 目標: ${goalLabel}\n- 現在体重: ${ctx.currentWeight}kg / 目標体重: ${ctx.targetWeight}kg（${diffLabel}）\n- 7日間体重推移: ${ctx.recentWeights.join('→')}kg（${Number(trend) > 0 ? '+' : ''}${trend}kg）\n- 活動レベル: ${ctx.lifestyle}\n- ${gymLabel}\n- ストリーク: ${ctx.currentDays}日\n- 体型変化進捗: ${ctx.bodyState}/4\n- 直近3日カロリー: ${ctx.recentKcal.map(k => k + 'kcal').join(' / ')}\n- 直近3日運動: ${ctx.recentExercise.length ? ctx.recentExercise.join(', ') : 'なし'}\n\n# 指示\n${toneInstruction}\nユーザーの目標（${goalLabel}）に沿ったアドバイスを**JSONのみ**で返してください。ジム通いの有無に応じた運動提案をしてください。\n\n{"greeting":"今日の挨拶（1文）","meal_advice":"食事アドバイス（2文以内）","exercise_advice":"運動アドバイス（2文以内）"}\n${SAFETY_SUFFIX}`;

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
  error?: string;
};

const MEAL_GOAL_GUIDE: Record<string, string> = {
  diet:     'たんぱく質を体重×1.6g以上確保しつつ、脂質を抑えた低カロリー食を優先する。糖質は極端に制限せず適度に摂取。',
  bulk:     'たんぱく質を体重×2.0g以上確保しつつ、筋合成に必要な糖質もしっかり摂る。カロリー不足にならないよう注意。',
  maintain: 'たんぱく質・脂質・糖質をバランスよく摂り、目標カロリーを大きく超えない食事を選ぶ。',
};

export const generateMealSuggestion = async (ctx: {
  age: number; heightCm: number; currentWeight: number; targetWeight: number;
  goalMode: string; lifestyle: string; aiTone: AiTone;
  todayKcal: number; todayProtein: number; todayFat: number; todayCarb: number;
  targetKcal: number;
}): Promise<MealSuggestionResult> => {
  const toneInstruction = AI_TONE_INSTRUCTION[ctx.aiTone] ?? AI_TONE_INSTRUCTION.friendly;
  const goalLabel = GOAL_MODE_LABEL[ctx.goalMode] ?? ctx.goalMode;
  const goalGuide = MEAL_GOAL_GUIDE[ctx.goalMode] ?? MEAL_GOAL_GUIDE.maintain;
  const weightDiff = Math.abs(ctx.currentWeight - ctx.targetWeight).toFixed(1);
  const remaining = Math.max(0, ctx.targetKcal - ctx.todayKcal);
  const targetProtein = Math.round(ctx.currentWeight * (ctx.goalMode === 'bulk' ? 2.0 : 1.6));

  const situationBlock = remaining > 0
    ? `- 残り摂取可能: ${remaining}kcal\n- たんぱく質 残り目安: ${Math.max(0, targetProtein - ctx.todayProtein)}g`
    : `- 目標kcalを${ctx.todayKcal - ctx.targetKcal}kcal超過済み`;

  const instruction = remaining > 0
    ? `${toneInstruction}\n残り摂取カロリーと目標（${goalLabel}）に合わせた食事を提案してください。${goalGuide}`
    : `${toneInstruction}\n既に目標カロリー超過のため、低カロリーな軽食か水分補給を提案するか、食事を控えるアドバイスをしてください。`;

  const prompt = `# ユーザー情報
- 年齢:${ctx.age}歳 / 身長:${ctx.heightCm}cm / 現在体重:${ctx.currentWeight}kg / 目標体重:${ctx.targetWeight}kg（差:${weightDiff}kg）
- 目標:${goalLabel}
- 活動レベル:${ctx.lifestyle}
- 目標摂取kcal:${ctx.targetKcal}kcal / 1日たんぱく質目標:${targetProtein}g
- 今日の摂取状況: ${ctx.todayKcal}kcal（たんぱく質:${ctx.todayProtein}g / 脂質:${ctx.todayFat}g / 糖質:${ctx.todayCarb}g）
${situationBlock}

# 栄養方針
${goalGuide}

# 指示
${instruction}
**JSONのみ**で返してください。

{"suggestion":"全体コメント（1〜2文）","meals":[{"name":"料理名","kcal":数値,"protein_g":数値,"fat_g":数値,"carb_g":数値,"reason":"選んだ理由（1文）"}]}`;

  const raw = await generateContent([{ role: 'user', parts: [{ text: prompt }] }]);
  const text = extractText(raw);
  try {
    return parseJson(text) as MealSuggestionResult;
  } catch {
    return { suggestion: 'バランスよく食べましょう。', meals: [], error: 'parse_failed' };
  }
};

export type ExerciseSuggestionItem = {
  name: string; sets: string; kcal_estimate: number; muscle_groups: string[]; reason: string;
};
export type ExerciseSuggestionResult = {
  summary: string;
  exercises: ExerciseSuggestionItem[];
  error?: string;
};

const EXERCISE_GOAL_GUIDE: Record<string, string> = {
  diet:     '有酸素運動（20分以上）を1〜2種目含め、筋肉量維持のため軽〜中強度の筋トレも加える。高回数（15〜20回×3セット）で脂肪燃焼を促す。',
  bulk:     'コンパウンド種目（スクワット・デッドリフト・ベンチプレス等）を中心に、中〜高重量（6〜10回×4〜5セット）で筋肥大を狙う。有酸素は最小限にとどめる。',
  maintain: '筋トレと有酸素をバランスよく組み合わせ、中強度（10〜12回×3セット）で体型維持を図る。',
};

export const generateExerciseSuggestion = async (ctx: {
  age: number; heightCm: number; currentWeight: number; targetWeight: number;
  goalMode: string; lifestyle: string; aiTone: AiTone; hasGym: boolean;
  goToGym: boolean;
  recentMuscleGroups: string[];
}): Promise<ExerciseSuggestionResult> => {
  const toneInstruction = AI_TONE_INSTRUCTION[ctx.aiTone] ?? AI_TONE_INSTRUCTION.friendly;
  const goalLabel = GOAL_MODE_LABEL[ctx.goalMode] ?? ctx.goalMode;
  const goalGuide = EXERCISE_GOAL_GUIDE[ctx.goalMode] ?? EXERCISE_GOAL_GUIDE.maintain;
  const weightDiff = Math.abs(ctx.currentWeight - ctx.targetWeight).toFixed(1);
  const location = ctx.goToGym ? 'ジム（マシン・フリーウェイト利用可）' : '自宅・屋外（器具なし）';

  const recentUniq = [...new Set(ctx.recentMuscleGroups)];
  const avoidBlock = recentUniq.length
    ? `- 直近1週間で鍛えた部位: ${recentUniq.join(', ')}\n  → 連続トレーニングを避け、これらを除いた部位を優先すること`
    : '- 直近1週間の記録なし → バランスよく全身を提案すること';

  const prompt = `# ユーザー情報
- 年齢:${ctx.age}歳 / 身長:${ctx.heightCm}cm / 現在体重:${ctx.currentWeight}kg / 目標体重:${ctx.targetWeight}kg（差:${weightDiff}kg）
- 目標:${goalLabel}
- 活動レベル:${ctx.lifestyle}
- トレーニング場所:${location}
${avoidBlock}

# トレーニング方針（${goalLabel}）
${goalGuide}

# 指示
${toneInstruction}
上記の方針と部位ローテーションを守り、今日のトレーニングメニューを**JSONのみ**で返してください。
- 3〜5種目を提案すること
- 連続して同じ部位を鍛えないこと
- 目標（${goalLabel}）に合ったセット数・回数を設定すること
- muscle_groupsは次のリストの中からのみ選択すること: ${MUSCLE_GROUPS.join(', ')}

{"summary":"今日のメニュー概要（1〜2文）","exercises":[{"name":"種目名","sets":"例: 3×10回","kcal_estimate":消費kcal推定値(整数),"muscle_groups":["部位1","部位2"],"reason":"選んだ理由（1文）"}]}`;

  const raw = await generateContent([{ role: 'user', parts: [{ text: prompt }] }]);
  const text = extractText(raw);
  try {
    return parseJson(text) as ExerciseSuggestionResult;
  } catch {
    return { summary: '今日も頑張ろう！', exercises: [], error: 'parse_failed' };
  }
};

export const classifyMuscleGroups = async (exerciseName: string): Promise<string[]> => {
  const prompt = `以下のトレーニング種目が主に鍛える筋肉部位を返してください。
種目名: ${exerciseName}
選択肢: ${MUSCLE_GROUPS.join(', ')}
上記の選択肢の中から該当するものを1〜3つ選び、JSONのみで返してください。
{"muscle_groups":["部位1","部位2"]}`;
  try {
    const raw = await generateContent([{ role: 'user', parts: [{ text: prompt }] }]);
    const text = extractText(raw);
    const parsed = parseJson(text) as { muscle_groups: string[] };
    const valid = parsed.muscle_groups.filter(g => (MUSCLE_GROUPS as readonly string[]).includes(g));
    return valid.length ? valid : [];
  } catch {
    return [];
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
