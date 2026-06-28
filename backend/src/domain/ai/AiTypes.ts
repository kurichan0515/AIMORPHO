import { AiTone } from '../shared/types';

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

export type DailyAdviceContext = {
  age: number;
  heightCm: number;
  currentWeight: number;
  targetWeight: number;
  goalMode?: string;
  lifestyle: string;
  aiTone: AiTone;
  hasGym?: boolean;
  currentDays: number;
  bodyState: number;
  recentWeights: number[];
  recentKcal: number[];
  recentExercise: string[];
};

export type DailyAdviceResult = {
  greeting: string;
  meal_advice: string;
  exercise_advice: string;
  error?: string;
};

export type MealSuggestionContext = {
  age: number;
  heightCm: number;
  currentWeight: number;
  targetWeight: number;
  goalMode: string;
  lifestyle: string;
  aiTone: AiTone;
  todayKcal: number;
  todayProtein: number;
  todayFat: number;
  todayCarb: number;
  targetKcal: number;
};

export type MealSuggestionResult = {
  suggestion: string;
  meals: Array<{ name: string; kcal: number; protein_g: number; fat_g: number; carb_g: number; reason: string }>;
  error?: string;
};

export type ExerciseSuggestionItem = {
  name: string;
  sets: string;
  kcal_estimate: number;
  muscle_groups: string[];
  reason: string;
};

export type ExerciseSuggestionContext = {
  age: number;
  heightCm: number;
  currentWeight: number;
  targetWeight: number;
  goalMode: string;
  lifestyle: string;
  aiTone: AiTone;
  hasGym: boolean;
  goToGym: boolean;
  recentMuscleGroups: string[];
};

export type ExerciseSuggestionResult = {
  summary: string;
  exercises: ExerciseSuggestionItem[];
  error?: string;
};

export type AvatarImageResult = {
  image_base64: string;
  mime_type: string;
};
