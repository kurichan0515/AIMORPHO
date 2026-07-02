import React, { useEffect, useState, useCallback } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, StyleSheet,
  Alert, FlatList, ScrollView, Vibration,
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import Svg, { Polyline, Circle } from 'react-native-svg';
import { useMutation, useInfiniteQuery, useQueryClient } from '@tanstack/react-query';
import { recordExercise, getExerciseHistory, deleteExerciseLog } from '../api/logs';
import { colors } from '../theme/colors';
import { useStreakCelebration } from '../hooks/useStreakCelebration';
import { useToast } from '../hooks/useToast';
import Toast from '../components/Toast';
import StreakCelebrationModal from '../components/StreakCelebrationModal';
import AdBanner from '../components/AdBanner';

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

function KcalChart({ data, isMock }: { data: { recordedAt: string; kcalBurned: number }[]; isMock: boolean }) {
  const chartData = data.length >= 2 ? data : MOCK_EXERCISE_DATA;
  const usedMock = isMock || data.length < 2;

  const kcals = chartData.map(d => d.kcalBurned);
  const min = Math.min(...kcals);
  const max = Math.max(...kcals);
  const range = max - min || 1;

  const points = chartData.map((d, i) => ({
    x: CHART_PADDING + (i / (chartData.length - 1)) * (CHART_WIDTH - CHART_PADDING * 2),
    y: CHART_HEIGHT - CHART_PADDING - ((d.kcalBurned - min) / range) * (CHART_HEIGHT - CHART_PADDING * 2),
  }));

  return (
    <View style={styles.chartCard}>
      {usedMock && (
        <View style={styles.mockBanner}>
          <Text style={styles.mockBannerText}>運動を記録するとここにグラフが表示されます</Text>
        </View>
      )}
      <View style={styles.chartHeaderRow}>
        <Text style={styles.chartStat}>{max} kcal</Text>
        <Text style={styles.chartStat}>{min} kcal</Text>
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

  const { toastVisible, toastMessage, showToast, hideToast } = useToast();
  const streak = useStreakCelebration();
  const qc = useQueryClient();
  const [searchQuery, setSearchQuery] = useState('');

  useEffect(() => {
    AsyncStorage.getItem(CUSTOM_EXERCISES_KEY).then(raw => {
      if (raw) setCustomExercises(JSON.parse(raw));
    });
  }, []);

  const {
    data: historyPages,
    refetch,
    fetchNextPage,
    hasNextPage,
    isFetchingNextPage,
  } = useInfiniteQuery({
    queryKey: ['exerciseHistory'],
    queryFn: ({ pageParam }) => getExerciseHistory({ limit: 20, cursor: pageParam as string | undefined }),
    getNextPageParam: (lastPage) => lastPage.nextCursor ?? undefined,
    initialPageParam: undefined as string | undefined,
  });

  const history = historyPages?.pages.flatMap(p => p.items) ?? [];

  const isMock = !history?.length;
  const kcalChartData = [...(history || [])]
    .filter(item => item.kcalBurned != null && item.kcalBurned > 0)
    .map(item => ({ recordedAt: item.recordedAt, kcalBurned: item.kcalBurned as number }))
    .reverse();

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
      qc.invalidateQueries({ queryKey: ['streak'] });
      qc.invalidateQueries({ queryKey: ['exerciseHistoryWeekly'] });
      Vibration.vibrate(40);
      streak.trigger(data);

      const nonStreakBadges = data.newBadges?.filter((b: any) => !b.badgeId?.startsWith('streak_')) ?? [];
      if (nonStreakBadges.length) {
        Alert.alert('トロフィー獲得！', nonStreakBadges.map((b: any) => b.name).join('、'));
      }
      if (data.recovered) {
        Alert.alert('体型回復！', 'アバターの体型が改善しました');
      }
      if (!nonStreakBadges.length && !data.recovered && !data.streakInfo?.streakMilestone) {
        showToast('運動を記録しました');
      }
    },
    onError: () => Alert.alert('エラー', '記録に失敗しました'),
  });

  const submit = useCallback(() => {
    if (!name) { Alert.alert('エラー', '種目を入力してください'); return; }
    mutation.mutate();
  }, [name, mutation]);

  const allExercises = [...PRESETS, ...customExercises];

  const renderHistoryItem = useCallback(({ item }: { item: any }) => (
    <TouchableOpacity
      style={styles.historyItem}
      onLongPress={() => {
        Alert.alert('運動記録を削除', `「${item.exerciseName}」を削除しますか？`, [
          { text: 'キャンセル', style: 'cancel' },
          { text: '削除', style: 'destructive', onPress: async () => {
            try {
              await deleteExerciseLog(item.recordedAt);
              qc.resetQueries({ queryKey: ['exerciseHistory'] });
              qc.invalidateQueries({ queryKey: ['exerciseHistoryWeekly'] });
            }
            catch { Alert.alert('エラー', '削除に失敗しました'); }
          }},
        ]);
      }}
      delayLongPress={500}
    >
      <View style={styles.historyDate}>
        <Text style={styles.historyDateText}>{item.recordedAt?.slice(5, 10)}</Text>
      </View>
      <View style={styles.historyMain}>
        <Text style={styles.historyName}>{item.exerciseName}</Text>
        <Text style={styles.historyMeta}>
          {[item.durationMin && `${item.durationMin}分`, item.kcalBurned && `${item.kcalBurned}kcal`].filter(Boolean).join(' / ')}
        </Text>
      </View>
      <View style={[styles.completedBadge, item.completed ? styles.completedBadgeDone : styles.completedBadgeSkip]}>
        <Text style={[styles.completedBadgeText, item.completed ? styles.completedBadgeTextDone : styles.completedBadgeTextSkip]}>
          {item.completed ? '完了' : '未完'}
        </Text>
      </View>
    </TouchableOpacity>
  ), [refetch]);

  return (
    <View style={{ flex: 1, backgroundColor: colors.bg.primary }}>
      <FlatList
        data={(history || []).filter((item: any) =>
          !searchQuery || (item.exerciseName ?? '').toLowerCase().includes(searchQuery.toLowerCase())
        )}
        keyExtractor={(item: any) => item.SK}
        keyboardShouldPersistTaps="handled"
        renderItem={renderHistoryItem}
        ListHeaderComponent={
          <View>
            {/* プリセット選択 */}
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

            <TextInput
              style={styles.input}
              placeholder="または直接入力"
              placeholderTextColor={colors.text.muted}
              value={name}
              onChangeText={setName}
            />

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

            {/* 完了トグル */}
            <View style={styles.completedRow}>
              <Text style={styles.label}>完了した？</Text>
              <View style={styles.toggleGroup}>
                <TouchableOpacity
                  style={[styles.toggleBtn, completed && styles.toggleBtnActive]}
                  onPress={() => setCompleted(true)}
                >
                  <Text style={[styles.toggleBtnText, completed && styles.toggleBtnTextActive]}>完了</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.toggleBtn, !completed && styles.toggleBtnSkip]}
                  onPress={() => setCompleted(false)}
                >
                  <Text style={[styles.toggleBtnText, !completed && styles.toggleBtnTextSkip]}>未完</Text>
                </TouchableOpacity>
              </View>
            </View>

            <TouchableOpacity
              style={[styles.submitBtn, mutation.isPending && styles.submitBtnDisabled]}
              onPress={submit}
              disabled={mutation.isPending}
            >
              <Text style={styles.submitBtnText}>{mutation.isPending ? '記録中...' : '記録する'}</Text>
            </TouchableOpacity>

            <Text style={styles.sectionTitle}>消費カロリー推移</Text>
            <KcalChart data={kcalChartData} isMock={isMock} />

            <AdBanner />

            <Text style={styles.sectionTitle}>履歴</Text>
            <TextInput
              style={styles.searchInput}
              placeholder="種目名で検索..."
              placeholderTextColor={colors.text.muted}
              value={searchQuery}
              onChangeText={setSearchQuery}
              returnKeyType="search"
            />
            {isMock && (
              <Text style={styles.emptyHint}>運動を記録すると履歴が表示されます</Text>
            )}
          </View>
        }
        contentContainerStyle={styles.container}
        ListFooterComponent={
          hasNextPage ? (
            <TouchableOpacity
              style={styles.loadMoreBtn}
              onPress={() => fetchNextPage()}
              disabled={isFetchingNextPage}
            >
              <Text style={styles.loadMoreText}>{isFetchingNextPage ? '読み込み中...' : 'もっと見る'}</Text>
            </TouchableOpacity>
          ) : null
        }
      />

      <Toast visible={toastVisible} message={toastMessage} onHide={hideToast} />
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
  container:               { padding: 16, paddingBottom: 32 },
  label:                   { fontSize: 13, color: colors.text.secondary, marginBottom: 6, marginTop: 12 },
  presetRow:               { flexDirection: 'row', marginBottom: 8 },
  presetChip:              { paddingHorizontal: 14, paddingVertical: 8, borderRadius: 20, backgroundColor: colors.bg.cardAlt, marginRight: 8, borderWidth: 1, borderColor: colors.border.subtle },
  presetChipActive:        { backgroundColor: 'rgba(47,200,255,0.2)', borderColor: colors.neon.blue },
  presetChipText:          { fontSize: 14, color: colors.text.secondary },
  presetChipTextActive:    { color: colors.neon.blue, fontWeight: '600' },
  input:                   { backgroundColor: colors.bg.card, borderRadius: 10, padding: 14, fontSize: 15, marginBottom: 4, borderWidth: 1, borderColor: colors.border.subtle, color: colors.text.primary },
  row:                     { flexDirection: 'row', gap: 8 },
  halfInput:               { flex: 1 },
  completedRow:            { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: 8 },
  toggleGroup:             { flexDirection: 'row', gap: 8 },
  toggleBtn:               { paddingHorizontal: 18, paddingVertical: 8, borderRadius: 20, borderWidth: 1, borderColor: colors.border.subtle, backgroundColor: colors.bg.cardAlt },
  toggleBtnActive:         { backgroundColor: 'rgba(61,202,110,0.2)', borderColor: colors.neon.green },
  toggleBtnSkip:           { backgroundColor: 'rgba(255,122,32,0.15)', borderColor: colors.neon.orange },
  toggleBtnText:           { fontSize: 13, color: colors.text.muted, fontWeight: '600' },
  toggleBtnTextActive:     { color: colors.neon.green },
  toggleBtnTextSkip:       { color: colors.neon.orange },
  submitBtn:               { backgroundColor: colors.neon.green, borderRadius: 10, padding: 14, alignItems: 'center', marginTop: 16, minHeight: 50, justifyContent: 'center' },
  submitBtnDisabled:       { opacity: 0.6 },
  submitBtnText:           { color: colors.bg.primary, fontSize: 16, fontWeight: 'bold' },
  sectionTitle:            { fontSize: 16, fontWeight: 'bold', marginTop: 24, marginBottom: 8, color: colors.text.primary },
  searchInput:             { backgroundColor: colors.bg.card, borderRadius: 10, paddingHorizontal: 14, paddingVertical: 10, fontSize: 14, color: colors.text.primary, borderWidth: 1, borderColor: colors.border.subtle, marginBottom: 8 },
  emptyHint:               { fontSize: 13, color: colors.text.muted, textAlign: 'center', paddingVertical: 12 },
  chartCard:               { backgroundColor: colors.bg.card, borderRadius: 12, padding: 12, marginBottom: 8, alignItems: 'center', borderWidth: 1, borderColor: colors.border.subtle },
  mockBanner:              { backgroundColor: 'rgba(106,122,150,0.15)', borderRadius: 8, padding: 10, marginBottom: 8, alignSelf: 'stretch' },
  mockBannerText:          { fontSize: 12, color: colors.text.muted, textAlign: 'center' },
  chartHeaderRow:          { flexDirection: 'row', justifyContent: 'space-between', width: CHART_WIDTH, marginBottom: 4 },
  chartStat:               { fontSize: 11, color: colors.text.secondary },
  chartFooterRow:          { flexDirection: 'row', justifyContent: 'space-between', width: CHART_WIDTH, marginTop: 4 },
  chartDateText:           { fontSize: 11, color: colors.text.muted },
  historyItem:             { flexDirection: 'row', alignItems: 'center', backgroundColor: colors.bg.card, padding: 14, borderRadius: 10, marginBottom: 8, borderWidth: 1, borderColor: colors.border.subtle, gap: 12 },
  historyDate:             { alignItems: 'center', minWidth: 36 },
  historyDateText:         { fontSize: 11, color: colors.text.muted },
  historyMain:             { flex: 1 },
  historyName:             { fontSize: 15, fontWeight: '500', color: colors.text.primary },
  historyMeta:             { fontSize: 12, color: colors.text.secondary, marginTop: 2 },
  completedBadge:          { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 12 },
  completedBadgeDone:      { backgroundColor: 'rgba(61,202,110,0.2)' },
  completedBadgeSkip:      { backgroundColor: 'rgba(255,122,32,0.2)' },
  completedBadgeText:      { fontSize: 12, fontWeight: 'bold' },
  completedBadgeTextDone:  { color: colors.neon.green },
  completedBadgeTextSkip:  { color: colors.neon.orange },
  loadMoreBtn:             { marginTop: 8, padding: 14, borderRadius: 10, borderWidth: 1, borderColor: colors.border.subtle, alignItems: 'center' },
  loadMoreText:            { fontSize: 14, color: colors.neon.blue, fontWeight: '600' },
});
