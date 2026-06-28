import React, { useEffect, useState } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, StyleSheet,
  Alert, ScrollView, Switch,
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import Svg, { Polyline, Circle } from 'react-native-svg';
import { useMutation, useQuery } from '@tanstack/react-query';
import { recordExercise, getExerciseHistory } from '../api/logs';
import { colors } from '../theme/colors';

const PRESETS = [
  'ウォーキング', 'ジョギング', '筋トレ', 'サイクリング', 'ヨガ', '水泳', 'HIIT',
  'ストレッチ', '階段昇降', '縄跳び', 'ダンス', '登山', 'バスケットボール', 'サッカー',
  'テニス', 'バドミントン', 'ゴルフ', '卓球', 'ボルダリング', '武道',
];

const CUSTOM_EXERCISES_KEY = 'customExerciseNames';

const CHART_WIDTH = 320;
const CHART_HEIGHT = 160;
const CHART_PADDING = 24;

const MOCK_EXERCISE_DATA = [
  { recordedAt: '2026-06-01', kcalBurned: 180 },
  { recordedAt: '2026-06-03', kcalBurned: 250 },
  { recordedAt: '2026-06-05', kcalBurned: 120 },
  { recordedAt: '2026-06-07', kcalBurned: 310 },
  { recordedAt: '2026-06-09', kcalBurned: 200 },
  { recordedAt: '2026-06-11', kcalBurned: 280 },
  { recordedAt: '2026-06-13', kcalBurned: 350 },
];

function KcalChart({ data }: { data: { recordedAt: string; kcalBurned: number }[] }) {
  const chartData = data.length >= 2 ? data : MOCK_EXERCISE_DATA;
  const usedMock = data.length < 2;

  const kcals = chartData.map(d => d.kcalBurned);
  const min = Math.min(...kcals);
  const max = Math.max(...kcals);
  const range = max - min || 1;

  const points = chartData.map((d, i) => {
    const x = CHART_PADDING + (i / (chartData.length - 1)) * (CHART_WIDTH - CHART_PADDING * 2);
    const y = CHART_HEIGHT - CHART_PADDING - ((d.kcalBurned - min) / range) * (CHART_HEIGHT - CHART_PADDING * 2);
    return { x, y };
  });

  return (
    <View style={styles.chartCard}>
      {usedMock && (
        <Text style={styles.mockLabel}>サンプルデータ</Text>
      )}
      <View style={styles.chartHeaderRow}>
        <Text style={styles.chartMax}>{max} kcal</Text>
        <Text style={styles.chartMin}>{min} kcal</Text>
      </View>
      <Svg width={CHART_WIDTH} height={CHART_HEIGHT}>
        <Polyline
          points={points.map(p => `${p.x},${p.y}`).join(' ')}
          fill="none"
          stroke={usedMock ? colors.text.muted : colors.neon.green}
          strokeWidth={2}
          strokeDasharray={usedMock ? '6,4' : undefined}
        />
        {points.map((p, i) => (
          <Circle key={i} cx={p.x} cy={p.y} r={3} fill={usedMock ? colors.text.muted : colors.neon.green} />
        ))}
      </Svg>
      <View style={styles.chartFooterRow}>
        <Text style={styles.chartDateText}>{chartData[0].recordedAt?.slice(5, 10)}</Text>
        <Text style={styles.chartDateText}>{chartData[chartData.length - 1].recordedAt?.slice(5, 10)}</Text>
      </View>
    </View>
  );
}

export default function ExerciseLogScreen() {
  const [name, setName] = useState('');
  const [duration, setDuration] = useState('');
  const [kcal, setKcal] = useState('');
  const [completed, setCompleted] = useState(true);
  const [customExercises, setCustomExercises] = useState<string[]>([]);

  useEffect(() => {
    AsyncStorage.getItem(CUSTOM_EXERCISES_KEY).then(raw => {
      if (raw) setCustomExercises(JSON.parse(raw));
    });
  }, []);

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
      if (!PRESETS.includes(name) && !customExercises.includes(name)) {
        const updated = [...customExercises, name];
        setCustomExercises(updated);
        AsyncStorage.setItem(CUSTOM_EXERCISES_KEY, JSON.stringify(updated));
      }
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

  const kcalChartData = [...(history || [])]
    .filter((item: any) => item.kcalBurned)
    .reverse();

  const allExercises = [...PRESETS, ...customExercises];

  return (
    <ScrollView style={styles.container} keyboardShouldPersistTaps="handled">
      <Text style={styles.label}>種目を選ぶ</Text>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.presetRow}>
        {allExercises.map(p => (
          <TouchableOpacity
            key={p}
            style={[styles.presetChip, name === p && styles.presetChipActive]}
            onPress={() => setName(p)}
          >
            <Text style={[styles.presetChipText, name === p && styles.presetChipTextActive]}>{p}</Text>
          </TouchableOpacity>
        ))}
      </ScrollView>

      <TextInput style={styles.input} placeholder="または直接入力" placeholderTextColor={colors.text.muted} value={name} onChangeText={setName} />

      <View style={styles.row}>
        <View style={styles.halfInput}>
          <Text style={styles.label}>時間 (分)</Text>
          <TextInput style={styles.input} keyboardType="number-pad" value={duration} onChangeText={setDuration} placeholder="30" placeholderTextColor={colors.text.muted} />
        </View>
        <View style={styles.halfInput}>
          <Text style={styles.label}>消費kcal</Text>
          <TextInput style={styles.input} keyboardType="number-pad" value={kcal} onChangeText={setKcal} placeholder="200" placeholderTextColor={colors.text.muted} />
        </View>
      </View>

      <View style={styles.switchRow}>
        <Text style={styles.label}>完了した</Text>
        <Switch value={completed} onValueChange={setCompleted} trackColor={{ false: colors.bg.cardAlt, true: colors.neon.green }} thumbColor={colors.text.primary} />
      </View>

      <TouchableOpacity style={styles.submitBtn} onPress={submit} disabled={mutation.isPending}>
        <Text style={styles.submitBtnText}>{mutation.isPending ? '記録中...' : '記録する'}</Text>
      </TouchableOpacity>

      <Text style={styles.sectionTitle}>消費カロリーの推移</Text>
      <KcalChart data={kcalChartData} />

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
            <Text style={[styles.badgeText, item.completed ? styles.badgeTextDone : styles.badgeTextSkip]}>{item.completed ? '完了' : '未完'}</Text>
          </View>
        </View>
      ))}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container:            { flex: 1, backgroundColor: colors.bg.primary, padding: 16 },
  label:                { fontSize: 13, color: colors.text.secondary, marginBottom: 6, marginTop: 12 },
  presetRow:            { flexDirection: 'row', marginBottom: 8 },
  presetChip:           { paddingHorizontal: 14, paddingVertical: 8, borderRadius: 20, backgroundColor: colors.bg.cardAlt, marginRight: 8, borderWidth: 1, borderColor: colors.border.subtle },
  presetChipActive:     { backgroundColor: 'rgba(47,200,255,0.2)', borderColor: colors.neon.blue },
  presetChipText:       { fontSize: 14, color: colors.text.secondary },
  presetChipTextActive: { color: colors.neon.blue, fontWeight: '600' },
  input:                { backgroundColor: colors.bg.card, borderRadius: 10, padding: 14, fontSize: 15, marginBottom: 4, borderWidth: 1, borderColor: colors.border.subtle, color: colors.text.primary },
  row:                  { flexDirection: 'row', gap: 8 },
  halfInput:            { flex: 1 },
  switchRow:            { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: 8 },
  submitBtn:            { backgroundColor: colors.neon.green, borderRadius: 10, padding: 16, alignItems: 'center', marginTop: 16 },
  submitBtnText:        { color: colors.bg.primary, fontSize: 16, fontWeight: 'bold' },
  sectionTitle:         { fontSize: 16, fontWeight: 'bold', marginTop: 24, marginBottom: 8, color: colors.text.primary },
  mockLabel:            { fontSize: 10, color: colors.text.muted, alignSelf: 'flex-end', marginBottom: 4 },
  chartCard:            { backgroundColor: colors.bg.card, borderRadius: 12, padding: 12, marginBottom: 8, alignItems: 'center', borderWidth: 1, borderColor: colors.border.subtle },
  chartHeaderRow:       { flexDirection: 'row', justifyContent: 'space-between', width: CHART_WIDTH, marginBottom: 4 },
  chartMax:             { fontSize: 11, color: colors.text.secondary },
  chartMin:             { fontSize: 11, color: colors.text.secondary },
  chartFooterRow:       { flexDirection: 'row', justifyContent: 'space-between', width: CHART_WIDTH, marginTop: 4 },
  chartDateText:        { fontSize: 11, color: colors.text.muted },
  historyItem:          { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', backgroundColor: colors.bg.card, padding: 14, borderRadius: 10, marginBottom: 8, borderWidth: 1, borderColor: colors.border.subtle },
  historyName:          { fontSize: 15, fontWeight: '500', color: colors.text.primary },
  historyMeta:          { fontSize: 12, color: colors.text.secondary, marginTop: 2 },
  badge:                { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 12 },
  badgeDone:            { backgroundColor: 'rgba(74,222,128,0.2)' },
  badgeSkip:            { backgroundColor: 'rgba(255,128,51,0.2)' },
  badgeText:            { fontSize: 12, fontWeight: 'bold' },
  badgeTextDone:        { color: colors.neon.green },
  badgeTextSkip:        { color: colors.neon.orange },
});
