import React, { useEffect, useState } from 'react';
import { View, Text, Image, TouchableOpacity, StyleSheet, Alert, ActivityIndicator, ScrollView, Modal } from 'react-native';
import { useQuery, useMutation } from '@tanstack/react-query';
import { useNavigation } from '@react-navigation/native';
import {
  getDailyAdvice, sendPenaltyAnswer,
  getMealSuggestion, getExerciseSuggestion,
  MealSuggestionResult, ExerciseSuggestionResult, ExerciseSuggestionItem,
} from '../api/ai';
import { recordExercise } from '../api/logs';
import api from '../api/client';
import { useAvatarStore } from '../store/useAvatarStore';
import { DEFAULT_AVATAR_LABELS } from '../utils/defaultAvatars';

export default function HomeScreen() {
  const navigation = useNavigation<any>();
  const { bodyState, avatarImages } = useAvatarStore();
  const [showInterrogation, setShowInterrogation] = useState(false);
  const [interrogationMsg, setInterrogationMsg] = useState('');
  const [mealSuggestion, setMealSuggestion] = useState<MealSuggestionResult | null>(null);
  const [exerciseSuggestion, setExerciseSuggestion] = useState<ExerciseSuggestionResult | null>(null);
  const [showMealModal, setShowMealModal] = useState(false);
  const [showExerciseModal, setShowExerciseModal] = useState(false);
  const [recordingExercise, setRecordingExercise] = useState<string | null>(null);

  const { data: advice, isLoading: adviceLoading } = useQuery({
    queryKey: ['dailyAdvice'],
    queryFn: getDailyAdvice,
    staleTime: 1000 * 60 * 30,
  });

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
    onSuccess: (data) => { setMealSuggestion(data); setShowMealModal(true); },
    onError: () => Alert.alert('エラー', '食事提案の取得に失敗しました'),
  });

  const exerciseSuggestionMutation = useMutation({
    mutationFn: (goToGym: boolean) => getExerciseSuggestion(goToGym),
    onSuccess: (data) => { setExerciseSuggestion(data); setShowExerciseModal(true); },
    onError: () => Alert.alert('エラー', 'トレーニング提案の取得に失敗しました'),
  });

  const recordExerciseMutation = useMutation({
    mutationFn: (item: ExerciseSuggestionItem) => recordExercise({
      exerciseName: item.name,
      kcalBurned: item.kcal_estimate,
      muscleGroups: item.muscle_groups,
      completed: true,
    }),
    onSuccess: (_, item) => {
      setRecordingExercise(null);
      Alert.alert('記録完了', `${item.name} を記録しました`);
    },
    onError: () => { setRecordingExercise(null); Alert.alert('エラー', '記録に失敗しました'); },
  });

  const handleExerciseSuggestion = () => {
    Alert.alert(
      'トレーニング提案',
      '今日はジムに行きますか？',
      [
        { text: 'ジムに行く', onPress: () => exerciseSuggestionMutation.mutate(true) },
        { text: '自宅・屋外でする', onPress: () => exerciseSuggestionMutation.mutate(false) },
        { text: 'キャンセル', style: 'cancel' },
      ]
    );
  };

  const currentAvatarUrl = avatarImages[bodyState];

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.contentContainer}>
      {/* アバター表示 */}
      <View style={styles.avatarContainer}>
        {currentAvatarUrl ? (
          <Image source={{ uri: currentAvatarUrl }} style={styles.avatar} resizeMode="contain" />
        ) : (
          <View style={styles.avatarPlaceholder}>
            <Text style={styles.avatarPlaceholderText}>アバター未設定</Text>
          </View>
        )}
        <Text style={styles.bodyStateText}>{DEFAULT_AVATAR_LABELS[bodyState]} ({bodyState === 0 ? 'ゴール' : `あと${bodyState}段階`})</Text>
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

      {/* AIアドバイス */}
      <View style={styles.adviceCard}>
        {adviceLoading ? (
          <ActivityIndicator />
        ) : (
          <>
            <Text style={styles.adviceGreeting}>{advice?.greeting}</Text>
            <Text style={styles.adviceLabel}>食事アドバイス</Text>
            <Text style={styles.adviceText}>{advice?.meal_advice}</Text>
            <Text style={styles.adviceLabel}>運動アドバイス</Text>
            <Text style={styles.adviceText}>{advice?.exercise_advice}</Text>
          </>
        )}
      </View>

      {/* AI提案ボタン */}
      <View style={styles.suggestionRow}>
        <TouchableOpacity
          style={[styles.suggestionBtn, styles.mealSuggestionBtn]}
          onPress={() => mealSuggestionMutation.mutate()}
          disabled={mealSuggestionMutation.isPending}
        >
          {mealSuggestionMutation.isPending
            ? <ActivityIndicator color="#FFF" size="small" />
            : <Text style={styles.suggestionBtnText}>🍽️ 食事提案をもらう</Text>
          }
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.suggestionBtn, styles.exerciseSuggestionBtn]}
          onPress={handleExerciseSuggestion}
          disabled={exerciseSuggestionMutation.isPending}
        >
          {exerciseSuggestionMutation.isPending
            ? <ActivityIndicator color="#FFF" size="small" />
            : <Text style={styles.suggestionBtnText}>💪 トレーニング提案</Text>
          }
        </TouchableOpacity>
      </View>

      {/* 食事提案モーダル */}
      <Modal visible={showMealModal} animationType="slide" presentationStyle="pageSheet">
        <View style={styles.modalContainer}>
          <View style={styles.modalHeader}>
            <Text style={styles.modalTitle}>🍽️ 食事提案</Text>
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
            <Text style={styles.modalTitle}>💪 トレーニング提案</Text>
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
                      style={[styles.recordBtn, recordingExercise === e.name && styles.recordBtnDone]}
                      onPress={() => {
                        setRecordingExercise(e.name);
                        recordExerciseMutation.mutate(e);
                      }}
                      disabled={recordExerciseMutation.isPending}
                    >
                      <Text style={styles.recordBtnText}>
                        {recordingExercise === e.name ? '記録中...' : '記録する'}
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
  container:              { flex: 1, backgroundColor: '#F8F9FA' },
  contentContainer:       { padding: 16, paddingBottom: 32 },
  avatarContainer:        { alignItems: 'center', marginVertical: 24 },
  avatar:                 { width: 180, height: 240 },
  avatarPlaceholder:      { width: 180, height: 240, backgroundColor: '#E0E0E0', justifyContent: 'center', alignItems: 'center', borderRadius: 12 },
  avatarPlaceholderText:  { color: '#888', fontSize: 14 },
  bodyStateText:          { marginTop: 8, fontSize: 12, color: '#666' },
  interrogation:          { backgroundColor: '#FFF3CD', borderRadius: 12, padding: 16, marginBottom: 16 },
  interrogationText:      { fontSize: 16, fontWeight: 'bold', marginBottom: 12, textAlign: 'center' },
  interrogationButtons:   { flexDirection: 'row', gap: 8 },
  btn:                    { flex: 1, padding: 12, borderRadius: 8, alignItems: 'center' },
  btnYes:                 { backgroundColor: '#28A745' },
  btnNo:                  { backgroundColor: '#DC3545' },
  btnText:                { color: '#FFF', fontWeight: 'bold' },
  adviceCard:             { backgroundColor: '#FFF', borderRadius: 12, padding: 16, shadowColor: '#000', shadowOpacity: 0.06, shadowRadius: 8, elevation: 2 },
  adviceGreeting:         { fontSize: 16, fontWeight: 'bold', marginBottom: 12 },
  adviceLabel:            { fontSize: 12, color: '#666', marginTop: 8 },
  adviceText:             { fontSize: 14, color: '#333', marginTop: 4 },
  suggestionRow:          { flexDirection: 'row', gap: 8, marginTop: 16 },
  suggestionBtn:          { flex: 1, borderRadius: 12, padding: 14, alignItems: 'center', justifyContent: 'center', minHeight: 52 },
  mealSuggestionBtn:      { backgroundColor: '#FF6B35' },
  exerciseSuggestionBtn:  { backgroundColor: '#34C759' },
  suggestionBtnText:      { color: '#FFF', fontWeight: 'bold', fontSize: 14 },
  modalContainer:         { flex: 1, backgroundColor: '#F8F9FA' },
  modalHeader:            { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: 16, backgroundColor: '#FFF', borderBottomWidth: 1, borderBottomColor: '#EEE' },
  modalTitle:             { fontSize: 18, fontWeight: 'bold' },
  modalClose:             { fontSize: 15, color: '#007AFF' },
  modalBody:              { padding: 16 },
  mealSuggestionComment:  { fontSize: 15, color: '#333', marginBottom: 16, lineHeight: 22 },
  mealItemCard:           { backgroundColor: '#FFF', borderRadius: 12, padding: 14, marginBottom: 10, elevation: 1 },
  mealItemHeader:         { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 },
  mealItemName:           { fontSize: 15, fontWeight: 'bold', flex: 1 },
  mealItemKcal:           { fontSize: 15, fontWeight: 'bold', color: '#FF6B35' },
  mealItemMacro:          { fontSize: 12, color: '#888', marginBottom: 4 },
  mealItemReason:         { fontSize: 12, color: '#555', fontStyle: 'italic' },
  exerciseItemCard:       { backgroundColor: '#FFF', borderRadius: 12, padding: 14, marginBottom: 10, elevation: 1 },
  exerciseItemHeader:     { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 },
  exerciseItemName:       { fontSize: 15, fontWeight: 'bold', marginBottom: 2 },
  exerciseItemSets:       { fontSize: 12, color: '#555', marginBottom: 2 },
  exerciseItemMuscle:     { fontSize: 11, color: '#007AFF' },
  exerciseItemReason:     { fontSize: 12, color: '#888', fontStyle: 'italic' },
  recordBtn:              { backgroundColor: '#34C759', borderRadius: 8, paddingHorizontal: 12, paddingVertical: 8 },
  recordBtnDone:          { backgroundColor: '#999' },
  recordBtnText:          { color: '#FFF', fontWeight: 'bold', fontSize: 13 },
});
