import React, { useState } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, StyleSheet,
  Alert, ScrollView, Switch,
} from 'react-native';
import { useMutation, useQuery } from '@tanstack/react-query';
import { recordExercise, getExerciseHistory } from '../api/logs';

const PRESETS = ['ウォーキング', 'ジョギング', '筋トレ', 'サイクリング', 'ヨガ', '水泳', 'HIIT'];

export default function ExerciseLogScreen() {
  const [name, setName] = useState('');
  const [duration, setDuration] = useState('');
  const [kcal, setKcal] = useState('');
  const [completed, setCompleted] = useState(true);

  const { data: history, refetch } = useQuery({
    queryKey: ['exerciseHistory'],
    queryFn: () => getExerciseHistory({ limit: 20 }),
  });

  const mutation = useMutation({
    mutationFn: () => recordExercise({
      exerciseName: name,
      durationMin: duration ? parseInt(duration, 10) : undefined,
      kcalBurned: kcal ? parseInt(kcal, 10) : undefined,
      completed,
    }),
    onSuccess: (data) => {
      setName(''); setDuration(''); setKcal('');
      refetch();
      if (data.newBadges?.length) {
        Alert.alert('バッジ獲得！', data.newBadges.map((b: any) => b.name).join('、'));
      }
      if (data.recovered) {
        Alert.alert('体型回復！', 'アバターの体型が改善しました 🎉');
      }
    },
    onError: () => Alert.alert('エラー', '記録に失敗しました'),
  });

  const submit = () => {
    if (!name) { Alert.alert('エラー', '種目を入力してください'); return; }
    mutation.mutate();
  };

  return (
    <ScrollView style={styles.container} keyboardShouldPersistTaps="handled">
      {/* プリセット */}
      <Text style={styles.label}>種目を選ぶ</Text>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.presetRow}>
        {PRESETS.map(p => (
          <TouchableOpacity
            key={p}
            style={[styles.presetChip, name === p && styles.presetChipActive]}
            onPress={() => setName(p)}
          >
            <Text style={[styles.presetChipText, name === p && styles.presetChipTextActive]}>{p}</Text>
          </TouchableOpacity>
        ))}
      </ScrollView>

      <TextInput style={styles.input} placeholder="または直接入力" value={name} onChangeText={setName} />

      <View style={styles.row}>
        <View style={styles.halfInput}>
          <Text style={styles.label}>時間 (分)</Text>
          <TextInput style={styles.input} keyboardType="number-pad" value={duration} onChangeText={setDuration} placeholder="30" />
        </View>
        <View style={styles.halfInput}>
          <Text style={styles.label}>消費kcal</Text>
          <TextInput style={styles.input} keyboardType="number-pad" value={kcal} onChangeText={setKcal} placeholder="200" />
        </View>
      </View>

      <View style={styles.switchRow}>
        <Text style={styles.label}>完了した</Text>
        <Switch value={completed} onValueChange={setCompleted} trackColor={{ true: '#34C759' }} />
      </View>

      <TouchableOpacity style={styles.submitBtn} onPress={submit} disabled={mutation.isPending}>
        <Text style={styles.submitBtnText}>{mutation.isPending ? '記録中...' : '記録する'}</Text>
      </TouchableOpacity>

      <Text style={styles.sectionTitle}>履歴</Text>
      {(history || []).map((item: any) => (
        <View key={item.SK} style={styles.historyItem}>
          <View>
            <Text style={styles.historyName}>{item.exerciseName}</Text>
            <Text style={styles.historyMeta}>
              {item.durationMin ? `${item.durationMin}分` : ''}{item.kcalBurned ? ` / ${item.kcalBurned}kcal` : ''}
            </Text>
          </View>
          <View style={[styles.badge, item.completed ? styles.badgeDone : styles.badgeSkip]}>
            <Text style={styles.badgeText}>{item.completed ? '完了' : '未完'}</Text>
          </View>
        </View>
      ))}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container:           { flex: 1, backgroundColor: '#F8F9FA', padding: 16 },
  label:               { fontSize: 13, color: '#666', marginBottom: 6, marginTop: 12 },
  presetRow:           { flexDirection: 'row', marginBottom: 8 },
  presetChip:          { paddingHorizontal: 14, paddingVertical: 8, borderRadius: 20, backgroundColor: '#E8E8E8', marginRight: 8 },
  presetChipActive:    { backgroundColor: '#007AFF' },
  presetChipText:      { fontSize: 14, color: '#333' },
  presetChipTextActive: { color: '#FFF' },
  input:               { backgroundColor: '#FFF', borderRadius: 10, padding: 14, fontSize: 15, marginBottom: 4, elevation: 1 },
  row:                 { flexDirection: 'row', gap: 8 },
  halfInput:           { flex: 1 },
  switchRow:           { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: 8 },
  submitBtn:           { backgroundColor: '#34C759', borderRadius: 10, padding: 16, alignItems: 'center', marginTop: 16 },
  submitBtnText:       { color: '#FFF', fontSize: 16, fontWeight: 'bold' },
  sectionTitle:        { fontSize: 16, fontWeight: 'bold', marginTop: 24, marginBottom: 8 },
  historyItem:         { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', backgroundColor: '#FFF', padding: 14, borderRadius: 10, marginBottom: 8, elevation: 1 },
  historyName:         { fontSize: 15, fontWeight: '500' },
  historyMeta:         { fontSize: 12, color: '#888', marginTop: 2 },
  badge:               { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 12 },
  badgeDone:           { backgroundColor: '#D4EDDA' },
  badgeSkip:           { backgroundColor: '#F8D7DA' },
  badgeText:           { fontSize: 12, fontWeight: 'bold' },
});
