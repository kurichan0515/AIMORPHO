import React, { useEffect, useRef, useState, useCallback } from 'react';
import { View, Text, Image, TouchableOpacity, StyleSheet, Alert, ActivityIndicator, ScrollView, Modal, StatusBar, Animated, Share, Vibration, RefreshControl } from 'react-native';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  getDailyAdvice, sendPenaltyAnswer,
  getMealSuggestion, getExerciseSuggestion, getAiUsage,
  MealSuggestionResult, ExerciseSuggestionResult, ExerciseSuggestionItem,
} from '../api/ai';
import { recordExercise, getMealHistory } from '../api/logs';
import api from '../api/client';
import { useAvatarStore } from '../store/useAvatarStore';
import { DEFAULT_AVATAR_LABELS, getDefaultAvatars } from '../utils/defaultAvatars';
import { colors } from '../theme/colors';
import AvatarSilhouette from '../components/ui/AvatarSilhouette';
import { BellIcon, WorkoutsIcon, CheckCircleIcon, BulbIcon, MealIcon, SparkleIcon } from '../components/ui/icons';
import { useIAP } from '../hooks/useIAP';
import StreakCelebrationModal from '../components/StreakCelebrationModal';
import { useStreakCelebration } from '../hooks/useStreakCelebration';

// 今日の日付文字列（コンポーネント外で一度だけ計算）
const TODAY = new Date().toISOString().slice(0, 10);

// TDEE 簡易計算
const calcTDEE = (profile: any): number => {
  if (!profile?.weightKg || !profile?.heightCm || !profile?.age || !profile?.gender) return 2000;
  const bmr = profile.gender === 'male'
    ? 88.362 + 13.397 * profile.weightKg + 5.677 * profile.heightCm - 4.799 * profile.age
    : 447.593 + 9.247 * profile.weightKg + 3.098 * profile.heightCm - 4.330 * profile.age;
  const m: Record<string, number> = { sedentary: 1.2, light: 1.375, moderate: 1.55, active: 1.725, very_active: 1.9 };
  return Math.round(bmr * (m[profile.lifestyle] ?? 1.375));
};

const isLimitError = (err: any) => err?.response?.status === 429;
const LIMIT_MESSAGE = '本日のAI提案利用回数の上限に達しました。サブスクに登録すると無制限でご利用いただけます。';

export default function HomeScreen() {
  const { bodyState, avatarImages, gender } = useAvatarStore();
  const { purchase } = useIAP();
  const qc = useQueryClient();
  const [activeTab, setActiveTab] = useState<'nutrition' | 'workout'>('nutrition');
  const [hasPendingPenalty, setHasPendingPenalty] = useState(false);
  const [showInterrogation, setShowInterrogation] = useState(false);
  const [interrogationMsg, setInterrogationMsg] = useState('');
  const [refreshing, setRefreshing] = useState(false);
  const [mealSuggestion, setMealSuggestion] = useState<MealSuggestionResult | null>(null);
  const [exerciseSuggestion, setExerciseSuggestion] = useState<ExerciseSuggestionResult | null>(null);
  const [showMealModal, setShowMealModal] = useState(false);
  const [showExerciseModal, setShowExerciseModal] = useState(false);
  const [recordingExercise, setRecordingExercise] = useState<string | null>(null);
  const [recordedExercises, setRecordedExercises] = useState<string[]>([]);
  const [goToGym, setGoToGym] = useState(false);
  const streak = useStreakCelebration();

  const interrogationAnim = useRef(new Animated.Value(0)).current;

  const { data: advice, isLoading: adviceLoading } = useQuery({
    queryKey: ['dailyAdvice'],
    queryFn: getDailyAdvice,
    staleTime: 1000 * 60 * 30,
  });

  const { data: profile, isLoading: profileLoading } = useQuery({
    queryKey: ['profile'],
    queryFn: () => api.get('/users/me').then(r => r.data),
  });

  const { data: streakData } = useQuery({
    queryKey: ['streak'],
    queryFn: () => api.get('/users/me/streak').then(r => r.data),
    staleTime: 1000 * 60 * 5,
  });

  // ['mealHistory'] は useInfiniteQuery と競合するため専用 key を使用
  const { data: todayMealsPage } = useQuery({
    queryKey: ['todayMeals'],
    queryFn: () => getMealHistory({ limit: 50 }),
    staleTime: 1000 * 60 * 2,
  });
  const todayMeals = todayMealsPage?.items;

  const { data: aiUsage, refetch: refetchUsage } = useQuery({
    queryKey: ['aiUsage'],
    queryFn: getAiUsage,
    staleTime: 0,
  });

  useEffect(() => {
    if (profile) { setGoToGym(!!profile.hasGym); }
  }, [profile]);

  useEffect(() => {
    checkPenalty();
  }, []);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await Promise.all([
      qc.invalidateQueries({ queryKey: ['profile'] }),
      qc.invalidateQueries({ queryKey: ['streak'] }),
      qc.invalidateQueries({ queryKey: ['dailyAdvice'] }),
      qc.invalidateQueries({ queryKey: ['aiUsage'] }),
      qc.invalidateQueries({ queryKey: ['todayMeals'] }),
    ]);
    setRefreshing(false);
  }, [qc]);

  const shareAvatar = useCallback(() => {
    const url = avatarImages[bodyState];
    const streakDays = streakData?.currentDays ?? 0;
    const msg = `AIMORPHOで${streakDays}日間継続中！AIコーチと一緒に体型を変えていこう 💪 #AIMORPHO`;
    Share.share(url ? { url, message: msg } : { message: msg });
  }, [avatarImages, bodyState, streakData]);

  // カムバック検出（3日以上未記録 = 激励バナー）
  const daysSinceLast = streakData?.lastLoggedAt
    ? Math.floor((Date.now() - new Date(streakData.lastLoggedAt).getTime()) / 86400000)
    : 0;
  const showComebackBanner = daysSinceLast >= 3;

  const showInterrogationWithAnim = () => {
    setShowInterrogation(true);
    interrogationAnim.setValue(0);
    Animated.timing(interrogationAnim, { toValue: 1, duration: 300, useNativeDriver: true }).start();
  };

  const checkPenalty = async () => {
    try {
      const { data } = await api.post('/ai/penalty-event', {});
      if (data?.event === 'interrogation') {
        setInterrogationMsg(data.question);
        setHasPendingPenalty(true);
        showInterrogationWithAnim();
      }
    } catch {}
  };

  const penaltyMutation = useMutation({
    mutationFn: (answer: 'YES' | 'NO') => sendPenaltyAnswer(answer),
    onSuccess: (data) => {
      setShowInterrogation(false);
      setHasPendingPenalty(false);
      if (data.newBodyState !== undefined) {
        useAvatarStore.getState().setBodyState(data.newBodyState);
      }
    },
  });

  const mealSuggestionMutation = useMutation({
    mutationFn: getMealSuggestion,
    onSuccess: (data) => {
      refetchUsage();
      if (data.error === 'parse_failed') { Alert.alert('エラー', '食事提案の生成に失敗しました。もう一度お試しください。'); return; }
      setMealSuggestion(data); setShowMealModal(true);
    },
    onError: (err) => {
      if (isLimitError(err)) { Alert.alert('利用回数の上限', LIMIT_MESSAGE); return; }
      Alert.alert('エラー', '食事提案の取得に失敗しました');
    },
  });

  const exerciseSuggestionMutation = useMutation({
    mutationFn: (goGym: boolean) => getExerciseSuggestion(goGym),
    onSuccess: (data) => {
      refetchUsage();
      if (data.error === 'parse_failed') { Alert.alert('エラー', 'トレーニング提案の生成に失敗しました。もう一度お試しください。'); return; }
      setExerciseSuggestion(data); setShowExerciseModal(true); setRecordedExercises([]);
    },
    onError: (err) => {
      if (isLimitError(err)) { Alert.alert('利用回数の上限', LIMIT_MESSAGE); return; }
      Alert.alert('エラー', 'トレーニング提案の取得に失敗しました');
    },
  });

  const recordExerciseMutation = useMutation({
    mutationFn: (item: ExerciseSuggestionItem) => recordExercise({
      exerciseName: item.name,
      kcalBurned: item.kcal_estimate,
      muscleGroups: item.muscle_groups,
      completed: true,
    }),
    onSuccess: (data, item) => {
      setRecordingExercise(null);
      setRecordedExercises(prev => [...prev, item.name]);
      qc.invalidateQueries({ queryKey: ['streak'] });
      Vibration.vibrate(40);
      streak.trigger(data);
      const nonStreakBadges = data.newBadges?.filter((b: any) => !b.badgeId?.startsWith('streak_')) ?? [];
      if (nonStreakBadges.length) {
        Alert.alert('バッジ獲得！', nonStreakBadges.map((b: any) => b.name).join('、'));
      }
      if (data.recovered) {
        Alert.alert('体型回復！', 'アバターの体型が改善しました');
      }
      if (!nonStreakBadges.length && !data.recovered && !data.streakInfo?.streakMilestone) {
        Alert.alert('記録完了', `${item.name} を記録しました`);
      }
    },
    onError: () => { setRecordingExercise(null); Alert.alert('エラー', '記録に失敗しました'); },
  });

  const toggleGym = async () => {
    const newVal = !goToGym;
    setGoToGym(newVal);
    try { await api.patch('/users/me', { hasGym: newVal }); } catch {}
  };

  const currentAvatarUrl = avatarImages[bodyState];
  const defaultAvatar = getDefaultAvatars(gender)[bodyState];

  const bmi = profile?.heightCm && profile?.weightKg
    ? (profile.weightKg / Math.pow(profile.heightCm / 100, 2)).toFixed(1)
    : null;

  const streakDays = streakData?.currentDays ?? 0;

  const todayKcal = (todayMeals ?? [])
    .filter((m: any) => m.recordedAt?.slice(0, 10) === TODAY)
    .reduce((sum: number, m: any) => sum + (m.kcal ?? 0), 0);
  const tdee = calcTDEE(profile);
  const kcalPct = Math.min(todayKcal / tdee, 1);
  const showCalorieBar = profile?.weightKg && profile?.heightCm;

  return (
    <View style={{ flex: 1, backgroundColor: colors.bg.primary }}>
      <ScrollView
        style={styles.container}
        contentContainerStyle={styles.contentContainer}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.neon.blue} />}
      >
        <StatusBar barStyle="light-content" />

        {/* ヘッダー */}
        <View style={styles.header}>
          <View style={styles.headerLeft}>
            {currentAvatarUrl ? (
              <Image
              source={{ uri: currentAvatarUrl }}
              style={styles.profilePhoto}
              defaultSource={require('../assets/app-icon-source.png')}
            />
            ) : (
              <View style={styles.profilePhotoPlaceholder} />
            )}
            <View>
              {profile?.displayName ? (
                <Text style={styles.journeyName}>{profile.displayName}</Text>
              ) : null}
              <Text style={styles.journeyGoal}>状態: {DEFAULT_AVATAR_LABELS[bodyState]}</Text>
            </View>
          </View>
          <View style={styles.bellWrapper}>
            <View
            accessibilityLabel={hasPendingPenalty ? '未確認の通知があります' : '通知'}
            accessibilityRole="button"
          >
            <BellIcon color={hasPendingPenalty ? colors.neon.orange : colors.text.secondary} size={24} />
          </View>
            {hasPendingPenalty && <View style={styles.bellBadge} />}
          </View>
        </View>

        {/* ストリークバナー */}
        <View style={styles.streakRow}>
          {showComebackBanner ? (
            <View style={styles.streakBanner}>
              <Text style={styles.streakFire}>💪</Text>
              <Text style={styles.streakBannerText}>また記録しよう！最高記録: {streakData?.longestDays ?? 0}日</Text>
            </View>
          ) : (
            <View style={[styles.streakBanner, streakDays >= 3 && styles.streakBannerActive]}>
              <Text style={styles.streakFire}>🔥</Text>
              <Text style={[styles.streakDays, streakDays >= 3 && { color: colors.neon.orange }]}>{streakDays}</Text>
              <Text style={styles.streakLabel}>日連続</Text>
              {streakData?.longestDays > 0 && streakDays < streakData.longestDays && (
                <Text style={styles.streakBest}>最高 {streakData.longestDays}日</Text>
              )}
            </View>
          )}
        </View>

        {/* カロリー進捗バー */}
        {showCalorieBar && (
          <View style={styles.kcalCard}>
            <View style={styles.kcalRow}>
              <Text style={styles.kcalLabel}>今日の摂取カロリー</Text>
              <Text style={styles.kcalValue}>
                <Text style={{ color: kcalPct >= 1 ? colors.neon.orange : colors.neon.blue }}>{todayKcal}</Text>
                <Text style={styles.kcalTarget}> / {tdee} kcal</Text>
              </Text>
            </View>
            <View style={styles.kcalTrack}>
              <View style={[styles.kcalFill, { width: `${kcalPct * 100}%` as any, backgroundColor: kcalPct >= 1 ? colors.neon.orange : colors.neon.blue }]} />
            </View>
            <Text style={styles.kcalHint}>{kcalPct >= 1 ? '目標カロリー達成！' : `残り ${tdee - todayKcal} kcal`}</Text>
          </View>
        )}

        {/* アバタービジュアル */}
        <View style={styles.avatarSection}>
          <TouchableOpacity style={styles.shareBtn} onPress={shareAvatar} accessibilityLabel="アバターをシェア" accessibilityRole="button">
            <Text style={styles.shareBtnText}>📤</Text>
          </TouchableOpacity>
          {currentAvatarUrl ? (
            <>
              <AvatarSilhouette width={170} height={230} style={styles.avatarSilhouette} />
              <Image source={{ uri: currentAvatarUrl }} style={styles.avatarOverlayImage} resizeMode="contain" />
            </>
          ) : (
            <View style={[styles.defaultAvatarCircle, { backgroundColor: defaultAvatar.backgroundColor }]}>
              <Text style={styles.defaultAvatarEmoji}>{defaultAvatar.emoji}</Text>
            </View>
          )}
          {bmi && (
            <View style={[styles.dataLabel, styles.dataLabelBlue, styles.dataLabelTopRight]}>
              <Text style={[styles.dataLabelText, { color: colors.neon.blue }]}>BMI {bmi}</Text>
            </View>
          )}
          {profile?.bodyFatPct != null && (
            <View style={[styles.dataLabel, styles.dataLabelOrange, styles.dataLabelMidLeft]}>
              <Text style={[styles.dataLabelText, { color: colors.neon.orange }]}>体脂肪率 {profile.bodyFatPct}%</Text>
            </View>
          )}
          {profile?.weightKg != null && (
            <View style={[styles.dataLabel, styles.dataLabelBlue, styles.dataLabelBottomCenter]}>
              <Text style={[styles.dataLabelText, { color: colors.neon.blue }]}>体重 {profile.weightKg}kg</Text>
            </View>
          )}
        </View>

        {/* ジャーニーチェック */}
        {showInterrogation && (
          <Animated.View style={[styles.interrogation, { opacity: interrogationAnim }]}>
            <Text style={styles.interrogationText}>{interrogationMsg}</Text>
            <View style={styles.interrogationButtons}>
              <TouchableOpacity style={[styles.btn, styles.btnYes]} onPress={() => penaltyMutation.mutate('YES')}>
                <Text style={styles.btnText}>やってた！</Text>
              </TouchableOpacity>
              <TouchableOpacity style={[styles.btn, styles.btnNo]} onPress={() => penaltyMutation.mutate('NO')}>
                <Text style={styles.btnText}>サボってた…</Text>
              </TouchableOpacity>
            </View>
          </Animated.View>
        )}

        {/* プレミアム訴求バナー（フリーユーザーのみ） */}
        {aiUsage && !aiUsage.premium && (
          <TouchableOpacity style={styles.premiumBanner} onPress={purchase}>
            <View style={styles.premiumBannerInner}>
              <Text style={styles.premiumBannerIcon}>👑</Text>
              <View style={styles.premiumBannerText}>
                <Text style={styles.premiumBannerTitle}>プレミアムで制限なし</Text>
                <Text style={styles.premiumBannerSub}>AI提案・食事解析が無制限に</Text>
              </View>
              <Text style={styles.premiumBannerArrow}>›</Text>
            </View>
          </TouchableOpacity>
        )}

        {/* AI Advisor */}
        <View style={styles.advisorCard}>
          <View style={styles.geminiLabelRow}>
            <SparkleIcon color={colors.neon.blue} size={12} />
            <Text style={styles.geminiLabel}>AIアドバイザー</Text>
          </View>

          {adviceLoading ? (
            <View style={styles.skeletonBlock}>
              <View style={[styles.skeletonLine, { width: '90%' }]} />
              <View style={[styles.skeletonLine, { width: '70%', marginTop: 6 }]} />
            </View>
          ) : (
            <Text style={styles.adviceGreeting}>{advice?.greeting}</Text>
          )}

          <View style={styles.tabRow}>
            <TouchableOpacity
              style={[styles.tab, activeTab === 'nutrition' ? styles.tabActive : styles.tabInactive]}
              onPress={() => setActiveTab('nutrition')}
            >
              <Text style={[styles.tabText, activeTab === 'nutrition' ? styles.tabTextActive : styles.tabTextInactive]}>食事</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.tab, activeTab === 'workout' ? styles.tabActive : styles.tabInactive]}
              onPress={() => setActiveTab('workout')}
            >
              <Text style={[styles.tabText, activeTab === 'workout' ? styles.tabTextActive : styles.tabTextInactive]}>トレーニング</Text>
            </TouchableOpacity>
          </View>

          {activeTab === 'nutrition' ? (
            <>
              <View style={styles.infoRow}>
                <CheckCircleIcon color={colors.neon.green} size={18} />
                <Text style={styles.infoRowText}>食事分析: {advice?.meal_advice}</Text>
              </View>
              {aiUsage && !aiUsage.premium && aiUsage.limits && (
                <Text style={styles.usageBadge}>
                  本日残り {Math.max(0, aiUsage.limits.mealSuggestion - aiUsage.usage.mealSuggestion)}/{aiUsage.limits.mealSuggestion} 回
                </Text>
              )}
              <TouchableOpacity
                style={[styles.primaryBtn, styles.fullWidthBtn, mealSuggestionMutation.isPending && styles.primaryBtnDisabled]}
                onPress={() => mealSuggestionMutation.mutate()}
                disabled={mealSuggestionMutation.isPending}
                accessibilityLabel="食事提案をもらう"
                accessibilityRole="button"
              >
                {mealSuggestionMutation.isPending
                  ? <ActivityIndicator color={colors.bg.primary} size="small" />
                  : (
                    <View style={styles.btnContentRow}>
                      <MealIcon color={colors.bg.primary} size={16} />
                      <Text style={styles.primaryBtnText}>食事提案をもらう</Text>
                    </View>
                  )
                }
              </TouchableOpacity>
            </>
          ) : (
            <>
              <View style={styles.infoRow}>
                <BulbIcon color={colors.neon.yellow} size={18} />
                <Text style={styles.infoRowText}>今日のアドバイス: {advice?.exercise_advice}</Text>
              </View>
              <TouchableOpacity style={styles.gymCheckRow} onPress={toggleGym} accessibilityLabel={goToGym ? 'ジムに行く（ON）' : 'ジムに行く（OFF）'} accessibilityRole="checkbox">
                <View style={[styles.checkboxBox, goToGym && styles.checkboxBoxChecked]}>
                  {goToGym && <Text style={styles.checkboxMark}>✓</Text>}
                </View>
                <Text style={styles.checkboxLabel}>ジムに行く</Text>
              </TouchableOpacity>
              {aiUsage && !aiUsage.premium && aiUsage.limits && (
                <Text style={styles.usageBadge}>
                  本日残り {Math.max(0, aiUsage.limits.exerciseSuggestion - aiUsage.usage.exerciseSuggestion)}/{aiUsage.limits.exerciseSuggestion} 回
                </Text>
              )}
              <TouchableOpacity
                style={[styles.primaryBtn, styles.fullWidthBtn, (exerciseSuggestionMutation.isPending || profileLoading) && styles.primaryBtnDisabled]}
                onPress={() => exerciseSuggestionMutation.mutate(goToGym)}
                disabled={exerciseSuggestionMutation.isPending || profileLoading}
                accessibilityLabel="トレーニング提案をもらう"
                accessibilityRole="button"
              >
                {exerciseSuggestionMutation.isPending
                  ? <ActivityIndicator color={colors.bg.primary} size="small" />
                  : (
                    <View style={styles.btnContentRow}>
                      <WorkoutsIcon color={colors.bg.primary} size={16} />
                      <Text style={styles.primaryBtnText}>トレーニング提案</Text>
                    </View>
                  )
                }
              </TouchableOpacity>
            </>
          )}

          <Text style={styles.aiDisclaimer}>
            ※ 本アドバイスはAIによる参考情報です。医療・診断行為ではありません。
          </Text>
        </View>

        {/* 食事提案モーダル */}
        <Modal visible={showMealModal} animationType="slide" presentationStyle="pageSheet">
          <View style={styles.modalContainer}>
            <View style={styles.modalHeader}>
              <View style={styles.modalTitleRow}>
                <MealIcon color={colors.text.primary} size={20} />
                <Text style={styles.modalTitle}>食事提案</Text>
              </View>
              <TouchableOpacity style={styles.modalCloseBtn} onPress={() => setShowMealModal(false)}>
                <Text style={styles.modalCloseBtnText}>✕</Text>
              </TouchableOpacity>
            </View>
            {mealSuggestion && (
              <ScrollView style={styles.modalBody}>
                <Text style={styles.mealSuggestionComment}>{mealSuggestion.suggestion}</Text>
                {mealSuggestion.meals.map((m, i) => (
                  <View key={i} style={styles.mealItemCard}>
                    <View style={styles.mealItemHeader}>
                      <Text style={styles.mealItemName}>{m.name}</Text>
                      <Text style={styles.mealItemKcal}>{m.kcal}kcal</Text>
                    </View>
                    <Text style={styles.mealItemMacro}>P:{m.protein_g}g / F:{m.fat_g}g / C:{m.carb_g}g</Text>
                    <Text style={styles.mealItemReason}>{m.reason}</Text>
                  </View>
                ))}
              </ScrollView>
            )}
          </View>
        </Modal>

        {/* トレーニング提案モーダル */}
        <Modal visible={showExerciseModal} animationType="slide" presentationStyle="pageSheet">
          <View style={styles.modalContainer}>
            <View style={styles.modalHeader}>
              <View style={styles.modalTitleRow}>
                <WorkoutsIcon color={colors.text.primary} size={20} />
                <Text style={styles.modalTitle}>トレーニング提案</Text>
              </View>
              <TouchableOpacity style={styles.modalCloseBtn} onPress={() => setShowExerciseModal(false)}>
                <Text style={styles.modalCloseBtnText}>✕</Text>
              </TouchableOpacity>
            </View>
            {exerciseSuggestion && (
              <ScrollView style={styles.modalBody}>
                <Text style={styles.mealSuggestionComment}>{exerciseSuggestion.summary}</Text>
                {exerciseSuggestion.exercises.map((e, i) => (
                  <View key={i} style={styles.exerciseItemCard}>
                    <View style={styles.exerciseItemHeader}>
                      <View>
                        <Text style={styles.exerciseItemName}>{e.name}</Text>
                        <Text style={styles.exerciseItemSets}>{e.sets} / 推定{e.kcal_estimate}kcal</Text>
                        <Text style={styles.exerciseItemMuscle}>{e.muscle_groups.join(' / ')}</Text>
                      </View>
                      <TouchableOpacity
                        style={[styles.recordBtn, (recordingExercise === e.name || recordedExercises.includes(e.name)) && styles.recordBtnDone]}
                        onPress={() => {
                          setRecordingExercise(e.name);
                          recordExerciseMutation.mutate(e);
                        }}
                        disabled={recordExerciseMutation.isPending || recordedExercises.includes(e.name)}
                      >
                        <Text style={styles.recordBtnText}>
                          {recordedExercises.includes(e.name) ? '記録済み' : recordingExercise === e.name ? '記録中...' : '記録する'}
                        </Text>
                      </TouchableOpacity>
                    </View>
                    <Text style={styles.exerciseItemReason}>{e.reason}</Text>
                  </View>
                ))}
              </ScrollView>
            )}
          </View>
        </Modal>
      </ScrollView>

      {/* ストリーク祝福モーダル */}
      {streak.celebration && (
        <StreakCelebrationModal
          visible={streak.visible}
          streakDays={streak.celebration.days}
          badgeName={streak.celebration.badgeName}
          isComeback={streak.celebration.isComeback}
          onDismiss={streak.dismiss}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container:              { flex: 1, backgroundColor: colors.bg.primary },
  contentContainer:       { paddingBottom: 32 },

  header:                 { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 20, paddingTop: 24, paddingBottom: 12 },
  headerLeft:             { flexDirection: 'row', alignItems: 'center', gap: 12 },
  profilePhoto:           { width: 44, height: 44, borderRadius: 22, backgroundColor: colors.bg.card },
  profilePhotoPlaceholder:{ width: 44, height: 44, borderRadius: 22, backgroundColor: colors.neon.blue },
  journeyName:            { fontSize: 14, fontWeight: '700', color: colors.text.primary },
  journeyGoal:            { fontSize: 11, fontWeight: '600', color: colors.neon.orange, marginTop: 1 },
  bellWrapper:            { position: 'relative' },
  bellBadge:              { position: 'absolute', top: -2, right: -2, width: 8, height: 8, borderRadius: 4, backgroundColor: colors.danger },

  streakRow:              { paddingHorizontal: 20, marginBottom: 8 },
  streakBanner:           { flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: colors.bg.card, borderRadius: 10, paddingHorizontal: 14, paddingVertical: 8, borderWidth: 1, borderColor: colors.border.subtle },
  streakBannerActive:     { borderColor: colors.neon.orange },
  streakFire:             { fontSize: 18 },
  streakDays:             { fontSize: 22, fontWeight: '800', color: colors.text.secondary },
  streakLabel:            { fontSize: 13, color: colors.text.secondary, fontWeight: '600' },
  streakBest:             { fontSize: 11, color: colors.text.muted, marginLeft: 8 },
  streakBannerText:       { flex: 1, fontSize: 13, color: colors.text.secondary },

  kcalCard:               { marginHorizontal: 20, marginBottom: 8, backgroundColor: colors.bg.card, borderRadius: 12, padding: 14, borderWidth: 1, borderColor: colors.border.subtle },
  kcalRow:                { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 },
  kcalLabel:              { fontSize: 12, color: colors.text.secondary },
  kcalValue:              { fontSize: 14, fontWeight: '700' },
  kcalTarget:             { color: colors.text.muted, fontWeight: '400' },
  kcalTrack:              { height: 6, backgroundColor: colors.bg.cardAlt, borderRadius: 3, overflow: 'hidden', marginBottom: 4 },
  kcalFill:               { height: 6, borderRadius: 3 },
  kcalHint:               { fontSize: 11, color: colors.text.muted },

  shareBtn:               { position: 'absolute', top: 12, right: 12, zIndex: 10, backgroundColor: 'rgba(15,20,35,0.7)', borderRadius: 20, width: 36, height: 36, alignItems: 'center', justifyContent: 'center' },
  shareBtnText:           { fontSize: 16 },

  avatarSection:          { height: 260, backgroundColor: colors.bg.cardAlt, alignItems: 'center', justifyContent: 'center', overflow: 'hidden' },
  avatarSilhouette:       { marginTop: 20 },
  avatarOverlayImage:     { position: 'absolute', width: 160, height: 220, opacity: 0.9 },
  defaultAvatarCircle:    { width: 200, height: 200, borderRadius: 100, alignItems: 'center', justifyContent: 'center' },
  defaultAvatarEmoji:     { fontSize: 100 },
  dataLabel:              { position: 'absolute', flexDirection: 'row', paddingVertical: 6, paddingHorizontal: 12, borderRadius: 8, backgroundColor: 'rgba(15,20,35,0.9)', borderWidth: 1, shadowOpacity: 0.6, shadowRadius: 12, shadowOffset: { width: 0, height: 0 }, elevation: 4 },
  dataLabelBlue:          { borderColor: colors.neon.blue, shadowColor: colors.neon.blue },
  dataLabelOrange:        { borderColor: colors.neon.orange, shadowColor: colors.neon.orange },
  dataLabelText:          { fontSize: 12, fontWeight: '700' },
  dataLabelTopRight:      { top: 60, right: 20 },
  dataLabelMidLeft:       { top: 140, left: 20 },
  dataLabelBottomCenter:  { bottom: 20, alignSelf: 'center' },

  interrogation:          { backgroundColor: colors.bg.card, borderRadius: 12, padding: 16, margin: 20, borderWidth: 1, borderColor: colors.neon.yellow },
  interrogationText:      { fontSize: 16, fontWeight: 'bold', marginBottom: 12, textAlign: 'center', color: colors.text.primary },
  interrogationButtons:   { flexDirection: 'row', gap: 8 },
  btn:                    { flex: 1, padding: 12, borderRadius: 8, alignItems: 'center' },
  btnYes:                 { backgroundColor: colors.neon.green },
  btnNo:                  { backgroundColor: colors.neon.orange },
  btnText:                { color: colors.bg.primary, fontWeight: 'bold' },

  advisorCard:            { marginHorizontal: 20, marginTop: 8, marginBottom: 24, padding: 16, borderRadius: 16, backgroundColor: colors.bg.card, borderWidth: 1, borderColor: colors.neon.blue },
  geminiLabelRow:         { flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 14 },
  geminiLabel:            { fontSize: 11, fontWeight: '600', color: colors.neon.blue },
  adviceGreeting:         { fontSize: 15, fontWeight: '700', color: colors.text.primary, marginBottom: 14 },
  aiDisclaimer:           { fontSize: 10, color: colors.text.secondary, marginTop: 12, lineHeight: 14 },

  skeletonBlock:          { marginBottom: 14 },
  skeletonLine:           { height: 14, borderRadius: 7, backgroundColor: colors.bg.cardAlt },

  tabRow:                 { flexDirection: 'row', gap: 8, marginBottom: 14 },
  tab:                    { paddingVertical: 8, paddingHorizontal: 18, borderRadius: 20, borderWidth: 1 },
  tabActive:              { backgroundColor: 'rgba(47,200,255,0.18)', borderColor: colors.neon.blue },
  tabInactive:            { backgroundColor: 'transparent', borderColor: colors.text.muted },
  tabText:                { fontSize: 12, fontWeight: '700' },
  tabTextActive:          { color: colors.neon.blue },
  tabTextInactive:        { color: colors.text.muted },

  infoRow:                { flexDirection: 'row', alignItems: 'flex-start', gap: 10, marginBottom: 14 },
  infoRowText:            { flex: 1, fontSize: 12, color: colors.text.primary, lineHeight: 18 },

  primaryBtn:             { borderRadius: 12, paddingVertical: 14, alignItems: 'center', justifyContent: 'center', minHeight: 50, backgroundColor: colors.neon.blue, shadowColor: colors.neon.blue, shadowOpacity: 0.5, shadowRadius: 12, shadowOffset: { width: 0, height: 0 }, elevation: 4 },
  primaryBtnDisabled:     { opacity: 0.6 },
  fullWidthBtn:           { alignSelf: 'stretch' },
  primaryBtnText:         { color: colors.bg.primary, fontWeight: '700', fontSize: 14 },
  btnContentRow:          { flexDirection: 'row', alignItems: 'center', gap: 8 },

  usageBadge:             { fontSize: 11, color: colors.text.muted, textAlign: 'right', marginBottom: 4 },
  premiumBanner:          { marginHorizontal: 20, marginBottom: 12, borderRadius: 12, backgroundColor: 'rgba(255,209,102,0.1)', borderWidth: 1, borderColor: 'rgba(255,209,102,0.35)', overflow: 'hidden' },
  premiumBannerInner:     { flexDirection: 'row', alignItems: 'center', padding: 14, gap: 12 },
  premiumBannerIcon:      { fontSize: 22 },
  premiumBannerText:      { flex: 1 },
  premiumBannerTitle:     { fontSize: 14, fontWeight: '700', color: colors.neon.yellow },
  premiumBannerSub:       { fontSize: 12, color: colors.text.muted, marginTop: 2 },
  premiumBannerArrow:     { fontSize: 22, color: colors.neon.yellow, fontWeight: '300', lineHeight: 26 },
  gymCheckRow:            { flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 12 },
  checkboxBox:            { width: 18, height: 18, borderRadius: 4, borderWidth: 1.5, borderColor: colors.text.muted, alignItems: 'center', justifyContent: 'center' },
  checkboxBoxChecked:     { backgroundColor: colors.neon.green, borderColor: colors.neon.green },
  checkboxMark:           { color: colors.bg.primary, fontSize: 12, fontWeight: 'bold' },
  checkboxLabel:          { fontSize: 13, color: colors.text.secondary },

  modalContainer:         { flex: 1, backgroundColor: colors.bg.primary },
  modalHeader:            { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: 16, backgroundColor: colors.bg.card, borderBottomWidth: 1, borderBottomColor: colors.border.subtle },
  modalTitleRow:          { flexDirection: 'row', alignItems: 'center', gap: 8 },
  modalTitle:             { fontSize: 18, fontWeight: 'bold', color: colors.text.primary },
  modalCloseBtn:          { width: 32, height: 32, borderRadius: 16, backgroundColor: colors.bg.cardAlt, alignItems: 'center', justifyContent: 'center' },
  modalCloseBtnText:      { fontSize: 16, color: colors.text.secondary, lineHeight: 20 },
  modalBody:              { padding: 16 },
  mealSuggestionComment:  { fontSize: 15, color: colors.text.secondary, marginBottom: 16, lineHeight: 22 },
  mealItemCard:           { backgroundColor: colors.bg.card, borderRadius: 12, padding: 14, marginBottom: 10 },
  mealItemHeader:         { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 },
  mealItemName:           { fontSize: 15, fontWeight: 'bold', flex: 1, color: colors.text.primary },
  mealItemKcal:           { fontSize: 15, fontWeight: 'bold', color: colors.neon.orange },
  mealItemMacro:          { fontSize: 12, color: colors.text.secondary, marginBottom: 4 },
  mealItemReason:         { fontSize: 12, color: colors.text.muted, fontStyle: 'italic' },
  exerciseItemCard:       { backgroundColor: colors.bg.card, borderRadius: 12, padding: 14, marginBottom: 10 },
  exerciseItemHeader:     { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 },
  exerciseItemName:       { fontSize: 15, fontWeight: 'bold', marginBottom: 2, color: colors.text.primary },
  exerciseItemSets:       { fontSize: 12, color: colors.text.secondary, marginBottom: 2 },
  exerciseItemMuscle:     { fontSize: 11, color: colors.neon.blue },
  exerciseItemReason:     { fontSize: 12, color: colors.text.muted, fontStyle: 'italic' },
  recordBtn:              { backgroundColor: colors.neon.green, borderRadius: 8, paddingHorizontal: 12, paddingVertical: 8 },
  recordBtnDone:          { backgroundColor: colors.text.muted },
  recordBtnText:          { color: colors.bg.primary, fontWeight: 'bold', fontSize: 13 },
});
