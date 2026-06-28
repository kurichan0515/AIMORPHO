import React, { useEffect, useState } from 'react';
import { View, Text, Image, TouchableOpacity, StyleSheet, Alert, ActivityIndicator, ScrollView, Modal, StatusBar } from 'react-native';
import { useQuery, useMutation } from '@tanstack/react-query';
import {
  getDailyAdvice, sendPenaltyAnswer,
  getMealSuggestion, getExerciseSuggestion, getAiUsage,
  MealSuggestionResult, ExerciseSuggestionResult, ExerciseSuggestionItem,
} from '../api/ai';
import { recordExercise } from '../api/logs';
import api from '../api/client';
import { useAvatarStore } from '../store/useAvatarStore';
import { DEFAULT_AVATAR_LABELS, getDefaultAvatars } from '../utils/defaultAvatars';
import { colors } from '../theme/colors';
import AvatarSilhouette from '../components/ui/AvatarSilhouette';
import { BellIcon, WorkoutsIcon, CheckCircleIcon, BulbIcon, MealIcon, SparkleIcon } from '../components/ui/icons';
import { useIAP } from '../hooks/useIAP';

const isLimitError = (err: any) => err?.response?.status === 429;
const LIMIT_MESSAGE = '本日のAI提案利用回数の上限に達しました。サブスクに登録すると無制限でご利用いただけます。';

export default function HomeScreen() {
  const { bodyState, avatarImages, gender } = useAvatarStore();
  const { purchase } = useIAP();
  const [activeTab, setActiveTab] = useState<'nutrition' | 'workout'>('nutrition');
  const [showInterrogation, setShowInterrogation] = useState(false);
  const [interrogationMsg, setInterrogationMsg] = useState('');
  const [mealSuggestion, setMealSuggestion] = useState<MealSuggestionResult | null>(null);
  const [exerciseSuggestion, setExerciseSuggestion] = useState<ExerciseSuggestionResult | null>(null);
  const [showMealModal, setShowMealModal] = useState(false);
  const [showExerciseModal, setShowExerciseModal] = useState(false);
  const [recordingExercise, setRecordingExercise] = useState<string | null>(null);
  const [recordedExercises, setRecordedExercises] = useState<string[]>([]);
  const [goToGym, setGoToGym] = useState(false);

  const { data: advice, isLoading: adviceLoading } = useQuery({
    queryKey: ['dailyAdvice'],
    queryFn: getDailyAdvice,
    staleTime: 1000 * 60 * 30,
  });

  const { data: profile, isLoading: profileLoading } = useQuery({
    queryKey: ['profile'],
    queryFn: () => api.get('/users/me').then(r => r.data),
  });

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

  const checkPenalty = async () => {
    try {
      const { data } = await api.post('/ai/penalty-event', {});
      if (data?.event === 'interrogation') {
        setInterrogationMsg(data.question);
        setShowInterrogation(true);
      }
    } catch {}
  };

  const penaltyMutation = useMutation({
    mutationFn: (answer: 'YES' | 'NO') => sendPenaltyAnswer(answer),
    onSuccess: (data) => {
      setShowInterrogation(false);
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
      if (data.newBadges?.length) {
        Alert.alert('バッジ獲得！', data.newBadges.map((b: any) => b.name).join('、'));
      }
      if (data.recovered) {
        Alert.alert('体型回復！', 'アバターの体型が改善しました');
      }
      if (!data.newBadges?.length && !data.recovered) {
        Alert.alert('記録完了', `${item.name} を記録しました`);
      }
    },
    onError: () => { setRecordingExercise(null); Alert.alert('エラー', '記録に失敗しました'); },
  });

  const currentAvatarUrl = avatarImages[bodyState];
  const defaultAvatar = getDefaultAvatars(gender)[bodyState];

  const bmi = profile?.heightCm && profile?.weightKg
    ? (profile.weightKg / Math.pow(profile.heightCm / 100, 2)).toFixed(1)
    : null;

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.contentContainer}>
      <StatusBar barStyle="light-content" />

      {/* ヘッダー */}
      <View style={styles.header}>
        <View style={styles.headerLeft}>
          {currentAvatarUrl ? (
            <Image source={{ uri: currentAvatarUrl }} style={styles.profilePhoto} />
          ) : (
            <View style={styles.profilePhotoPlaceholder} />
          )}
          <View>
            <Text style={styles.journeyGoal}>状態: {DEFAULT_AVATAR_LABELS[bodyState]}</Text>
          </View>
        </View>
        <BellIcon color={colors.text.secondary} size={24} />
      </View>

      {/* アバタービジュアル */}
      <View style={styles.avatarSection}>
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
        <View style={styles.interrogation}>
          <Text style={styles.interrogationText}>{interrogationMsg}</Text>
          <View style={styles.interrogationButtons}>
            <TouchableOpacity style={[styles.btn, styles.btnYes]} onPress={() => penaltyMutation.mutate('YES')}>
              <Text style={styles.btnText}>やってた！</Text>
            </TouchableOpacity>
            <TouchableOpacity style={[styles.btn, styles.btnNo]} onPress={() => penaltyMutation.mutate('NO')}>
              <Text style={styles.btnText}>サボってた…</Text>
            </TouchableOpacity>
          </View>
        </View>
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
          <ActivityIndicator color={colors.neon.blue} />
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
              style={[styles.primaryBtn, styles.fullWidthBtn]}
              onPress={() => mealSuggestionMutation.mutate()}
              disabled={mealSuggestionMutation.isPending}
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
            <TouchableOpacity style={styles.gymCheckRow} onPress={() => setGoToGym(v => !v)}>
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
              style={[styles.primaryBtn, styles.fullWidthBtn]}
              onPress={() => exerciseSuggestionMutation.mutate(goToGym)}
              disabled={exerciseSuggestionMutation.isPending || profileLoading}
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
            <TouchableOpacity onPress={() => setShowMealModal(false)}>
              <Text style={styles.modalClose}>閉じる</Text>
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
            <TouchableOpacity onPress={() => setShowExerciseModal(false)}>
              <Text style={styles.modalClose}>閉じる</Text>
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
  );
}

const styles = StyleSheet.create({
  container:              { flex: 1, backgroundColor: colors.bg.primary },
  contentContainer:       { paddingBottom: 32 },

  header:                 { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 20, paddingTop: 24, paddingBottom: 16 },
  headerLeft:             { flexDirection: 'row', alignItems: 'center', gap: 12 },
  profilePhoto:           { width: 44, height: 44, borderRadius: 22, backgroundColor: colors.bg.card },
  profilePhotoPlaceholder:{ width: 44, height: 44, borderRadius: 22, backgroundColor: colors.neon.blue },
  journeyTitle:           { fontSize: 15, fontWeight: '700', color: colors.text.primary },
  journeyGoal:            { fontSize: 12, fontWeight: '600', color: colors.neon.orange, marginTop: 2 },

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

  tabRow:                 { flexDirection: 'row', gap: 8, marginBottom: 14 },
  tab:                    { paddingVertical: 8, paddingHorizontal: 18, borderRadius: 20, borderWidth: 1 },
  tabActive:              { backgroundColor: 'rgba(47,200,255,0.18)', borderColor: colors.neon.blue },
  tabInactive:            { backgroundColor: 'transparent', borderColor: colors.text.muted },
  tabText:                { fontSize: 12, fontWeight: '700' },
  tabTextActive:          { color: colors.neon.blue },
  tabTextInactive:        { color: colors.text.muted },

  mealPhoto:              { height: 110, borderRadius: 12, backgroundColor: colors.bg.cardAlt, marginBottom: 8 },
  mealPhotoLabel:         { fontSize: 11, fontWeight: '600', color: colors.text.secondary, marginBottom: 12 },

  infoRow:                { flexDirection: 'row', alignItems: 'flex-start', gap: 10, marginBottom: 14 },
  infoRowText:            { flex: 1, fontSize: 12, color: colors.text.primary, lineHeight: 18 },

  primaryBtn:             { borderRadius: 12, paddingVertical: 14, alignItems: 'center', justifyContent: 'center', minHeight: 48, backgroundColor: colors.neon.blue, shadowColor: colors.neon.blue, shadowOpacity: 0.5, shadowRadius: 12, shadowOffset: { width: 0, height: 0 }, elevation: 4 },
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
  modalClose:             { fontSize: 15, color: colors.neon.blue },
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
