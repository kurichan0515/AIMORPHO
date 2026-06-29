import React, { useState, useCallback } from 'react';
import { View, Text, TextInput, TouchableOpacity, StyleSheet, Alert, FlatList, Vibration } from 'react-native';
import Svg, { Polyline, Circle, Line, Text as SvgText } from 'react-native-svg';
import { useMutation, useInfiniteQuery, useQueryClient } from '@tanstack/react-query';
import { recordWeight, getWeightHistory, deleteWeightLog } from '../api/logs';
import { colors } from '../theme/colors';
import StreakCelebrationModal from '../components/StreakCelebrationModal';
import Toast from '../components/Toast';
import { useStreakCelebration } from '../hooks/useStreakCelebration';
import { useToast } from '../hooks/useToast';

const CHART_WIDTH = 320;
const CHART_HEIGHT = 160;
const CHART_PADDING = 24;

type WeightRecord = { recordedAt: string; weightKg: number; bodyFatPct?: number | null };

const MOCK_WEIGHT_DATA: WeightRecord[] = [
  { recordedAt: '2026-06-01', weightKg: 72.4, bodyFatPct: 22.1 },
  { recordedAt: '2026-06-03', weightKg: 72.1, bodyFatPct: 21.8 },
  { recordedAt: '2026-06-05', weightKg: 71.8, bodyFatPct: 21.5 },
  { recordedAt: '2026-06-07', weightKg: 72.0, bodyFatPct: 21.6 },
  { recordedAt: '2026-06-09', weightKg: 71.5, bodyFatPct: 21.2 },
  { recordedAt: '2026-06-11', weightKg: 71.2, bodyFatPct: 20.9 },
  { recordedAt: '2026-06-13', weightKg: 70.9, bodyFatPct: 20.5 },
];

const INNER_W = CHART_WIDTH - CHART_PADDING * 2;
const INNER_H = CHART_HEIGHT - CHART_PADDING * 2;

function toPoints(values: number[], len: number): { x: number; y: number }[] {
  const min = Math.min(...values);
  const max = Math.max(...values);
  const range = max - min || 1;
  return values.map((v, i) => ({
    x: CHART_PADDING + (i / (len - 1)) * INNER_W,
    y: CHART_PADDING + INNER_H - ((v - min) / range) * INNER_H,
  }));
}

function WeightChart({ data }: { data: WeightRecord[] }) {
  const chartData = data.length >= 2 ? data : MOCK_WEIGHT_DATA;
  const usedMock = data.length < 2;

  const weights = chartData.map(d => d.weightKg);
  const fatData = chartData.filter(d => d.bodyFatPct != null);
  const hasFat = fatData.length >= 2;

  const wPoints = toPoints(weights, chartData.length);

  const fatPoints = hasFat
    ? toPoints(
        fatData.map(d => d.bodyFatPct!),
        fatData.length,
      ).map((p, i) => {
        const origIdx = chartData.indexOf(fatData[i]);
        return { ...p, x: CHART_PADDING + (origIdx / (chartData.length - 1)) * INNER_W };
      })
    : [];

  const wMin = Math.min(...weights);
  const wMax = Math.max(...weights);
  const fMin = hasFat ? Math.min(...fatData.map(d => d.bodyFatPct!)) : 0;
  const fMax = hasFat ? Math.max(...fatData.map(d => d.bodyFatPct!)) : 0;

  const lineColor = usedMock ? colors.text.muted : colors.neon.blue;
  const fatColor = usedMock ? colors.text.muted : colors.neon.orange;
  const dash = usedMock ? '6,4' : undefined;

  return (
    <View style={styles.chartCard}>
      {usedMock && <Text style={styles.mockLabel}>サンプルデータ</Text>}

      {/* 凡例 */}
      <View style={styles.chartLegend}>
        <View style={styles.legendItem}>
          <View style={[styles.legendDot, { backgroundColor: colors.neon.blue }]} />
          <Text style={styles.legendText}>体重</Text>
          <Text style={styles.legendRange}>{wMin}–{wMax} kg</Text>
        </View>
        {hasFat && (
          <View style={styles.legendItem}>
            <View style={[styles.legendDot, { backgroundColor: colors.neon.orange }]} />
            <Text style={styles.legendText}>体脂肪率</Text>
            <Text style={styles.legendRange}>{fMin}–{fMax} %</Text>
          </View>
        )}
      </View>

      <Svg width={CHART_WIDTH} height={CHART_HEIGHT}>
        {/* 体重ライン */}
        <Polyline
          points={wPoints.map(p => `${p.x},${p.y}`).join(' ')}
          fill="none"
          stroke={lineColor}
          strokeWidth={2}
          strokeDasharray={dash}
        />
        {wPoints.map((p, i) => (
          <Circle key={`w${i}`} cx={p.x} cy={p.y} r={3} fill={lineColor} />
        ))}

        {/* 体脂肪ライン */}
        {hasFat && (
          <>
            <Polyline
              points={fatPoints.map(p => `${p.x},${p.y}`).join(' ')}
              fill="none"
              stroke={fatColor}
              strokeWidth={2}
              strokeDasharray={dash}
            />
            {fatPoints.map((p, i) => (
              <Circle key={`f${i}`} cx={p.x} cy={p.y} r={3} fill={fatColor} />
            ))}
          </>
        )}
      </Svg>

      <View style={styles.chartFooterRow}>
        <Text style={styles.chartDateText}>{chartData[0].recordedAt?.slice(5, 10)}</Text>
        <Text style={styles.chartDateText}>{chartData[chartData.length - 1].recordedAt?.slice(5, 10)}</Text>
      </View>
    </View>
  );
}

export default function WeightLogScreen() {
  const [input, setInput] = useState('');
  const [bodyFatInput, setBodyFatInput] = useState('');
  const { toastVisible, toastMessage, showToast, hideToast } = useToast();
  const streak = useStreakCelebration();
  const qc = useQueryClient();

  const {
    data: historyPages,
    refetch,
    fetchNextPage,
    hasNextPage,
    isFetchingNextPage,
  } = useInfiniteQuery({
    queryKey: ['weightHistory'],
    queryFn: ({ pageParam }) => getWeightHistory({ limit: 20, cursor: pageParam as string | undefined }),
    getNextPageParam: (lastPage) => lastPage.nextCursor ?? undefined,
    initialPageParam: undefined as string | undefined,
  });

  const history = historyPages?.pages.flatMap(p => p.items) ?? [];

  const mutation = useMutation({
    mutationFn: ({ kg, bodyFatPct }: { kg: number; bodyFatPct?: number }) => recordWeight(kg, bodyFatPct),
    onSuccess: (data) => {
      setInput('');
      setBodyFatInput('');
      refetch();
      qc.invalidateQueries({ queryKey: ['streak'] });
      Vibration.vibrate(40);
      streak.trigger(data);

      const nonStreakBadges = data.newBadges?.filter((b: any) => !b.badgeId?.startsWith('streak_')) ?? [];
      if (nonStreakBadges.length) {
        Alert.alert('バッジ獲得！', nonStreakBadges.map((b: any) => b.name).join('、'));
      }
      if (!data.streakInfo?.streakMilestone && !data.streakInfo?.returnedAfterBreak) {
        showToast('体重を記録しました');
      }
    },
    onError: () => Alert.alert('エラー', '記録に失敗しました'),
  });

  const submit = () => {
    const kg = parseFloat(input);
    if (isNaN(kg) || kg < 20 || kg > 300) {
      Alert.alert('エラー', '正しい体重を入力してください');
      return;
    }

    let bodyFatPct: number | undefined;
    if (bodyFatInput.trim()) {
      bodyFatPct = parseFloat(bodyFatInput);
      if (isNaN(bodyFatPct) || bodyFatPct < 0 || bodyFatPct > 100) {
        Alert.alert('エラー', '正しい体脂肪率を入力してください');
        return;
      }
    }

    mutation.mutate({ kg, bodyFatPct });
  };

  const latest = history?.[0];
  const chartData = [...(history || [])].reverse();

  const handleDeleteWeight = useCallback((item: any) => {
    Alert.alert('体重記録を削除', `${item.recordedAt?.slice(0, 10)} の記録を削除しますか？`, [
      { text: 'キャンセル', style: 'cancel' },
      { text: '削除', style: 'destructive', onPress: async () => {
        try {
          await deleteWeightLog(item.recordedAt);
          refetch();
        } catch {
          Alert.alert('エラー', '削除に失敗しました');
        }
      }},
    ]);
  }, [refetch]);

  const renderHistoryItem = useCallback(({ item }: { item: any }) => (
    <TouchableOpacity
      style={styles.historyItem}
      onLongPress={() => handleDeleteWeight(item)}
      delayLongPress={500}
      accessibilityLabel={`${item.recordedAt?.slice(0, 10)} ${item.weightKg}kg 長押しで削除`}
    >
      <Text style={styles.historyDate}>{item.recordedAt?.slice(0, 10)}</Text>
      <View style={styles.historyValues}>
        <Text style={styles.historyWeight}>{item.weightKg} kg</Text>
        {item.bodyFatPct != null && (
          <Text style={styles.historyBodyFat}>体脂肪率 {item.bodyFatPct}%</Text>
        )}
      </View>
    </TouchableOpacity>
  ), [handleDeleteWeight]);

  return (
    <View style={{ flex: 1, backgroundColor: colors.bg.primary }}>
    <FlatList
      data={history || []}
      keyExtractor={(item: any) => item.SK}
      keyboardShouldPersistTaps="handled"
      renderItem={renderHistoryItem}
      contentContainerStyle={styles.container}
      ListHeaderComponent={
        <View>
          {latest && (
            <View style={styles.latestCard}>
              <Text style={styles.latestLabel}>直近の体重</Text>
              <Text style={styles.latestValue}>{latest.weightKg} kg</Text>
              {latest.bodyFatPct != null && (
                <Text style={styles.latestBodyFat}>体脂肪率 {latest.bodyFatPct}%</Text>
              )}
            </View>
          )}

          <View style={styles.formCard}>
            <View style={styles.fieldRow}>
              <Text style={styles.fieldLabel}>体重 (kg) *</Text>
              <TextInput
                style={styles.input}
                value={input}
                onChangeText={setInput}
                keyboardType="decimal-pad"
                placeholder="65.0"
                placeholderTextColor={colors.text.muted}
              />
            </View>
            <View style={styles.fieldRow}>
              <Text style={styles.fieldLabel}>体脂肪率 (%)</Text>
              <TextInput
                style={styles.input}
                value={bodyFatInput}
                onChangeText={setBodyFatInput}
                keyboardType="decimal-pad"
                placeholder="任意"
                placeholderTextColor={colors.text.muted}
              />
            </View>
            <TouchableOpacity
              style={[styles.submitBtn, mutation.isPending && { opacity: 0.6 }]}
              onPress={submit}
              disabled={mutation.isPending}
            >
              <Text style={styles.submitBtnText}>記録</Text>
            </TouchableOpacity>
          </View>

          <Text style={styles.sectionTitle}>推移</Text>
          <WeightChart data={chartData} />

          <Text style={styles.sectionTitle}>履歴</Text>
        </View>
      }
      ListFooterComponent={
        <View style={{ paddingBottom: 24 }}>
          {hasNextPage && (
            <TouchableOpacity
              style={styles.loadMoreBtn}
              onPress={() => fetchNextPage()}
              disabled={isFetchingNextPage}
            >
              <Text style={styles.loadMoreText}>{isFetchingNextPage ? '読み込み中...' : 'もっと見る'}</Text>
            </TouchableOpacity>
          )}
        </View>
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
  container:      { flex: 1, backgroundColor: colors.bg.primary, padding: 16 },
  latestCard:     { backgroundColor: colors.bg.card, borderRadius: 12, padding: 20, alignItems: 'center', marginBottom: 16, borderWidth: 1, borderColor: colors.border.subtle },
  latestLabel:    { fontSize: 12, color: colors.text.secondary },
  latestValue:    { fontSize: 36, fontWeight: 'bold', color: colors.neon.blue, marginTop: 4 },
  latestBodyFat:  { fontSize: 13, color: colors.neon.orange, marginTop: 4 },
  formCard:       { backgroundColor: colors.bg.card, borderRadius: 12, padding: 16, marginBottom: 24, borderWidth: 1, borderColor: colors.border.subtle },
  fieldRow:       { marginBottom: 12 },
  fieldLabel:     { fontSize: 12, color: colors.text.secondary, marginBottom: 6 },
  input:          { backgroundColor: colors.bg.cardAlt, borderRadius: 10, paddingHorizontal: 16, fontSize: 18, height: 52, color: colors.text.primary },
  submitBtn:      { backgroundColor: colors.neon.blue, borderRadius: 10, paddingVertical: 14, alignItems: 'center', marginTop: 4, minHeight: 50, justifyContent: 'center' },
  submitBtnText:  { color: colors.bg.primary, fontWeight: 'bold', fontSize: 16 },
  sectionTitle:   { fontSize: 16, fontWeight: 'bold', marginBottom: 8, color: colors.text.primary },
  mockLabel:      { fontSize: 10, color: colors.text.muted, alignSelf: 'flex-end', marginBottom: 2 },
  chartCard:      { backgroundColor: colors.bg.card, borderRadius: 12, padding: 12, marginBottom: 20, alignItems: 'center', borderWidth: 1, borderColor: colors.border.subtle },
  chartLegend:    { flexDirection: 'row', gap: 16, marginBottom: 6, alignSelf: 'flex-start' },
  legendItem:     { flexDirection: 'row', alignItems: 'center', gap: 4 },
  legendDot:      { width: 8, height: 8, borderRadius: 4 },
  legendText:     { fontSize: 10, color: colors.text.secondary },
  legendRange:    { fontSize: 10, color: colors.text.muted },
  chartHeaderRow: { flexDirection: 'row', justifyContent: 'space-between', width: CHART_WIDTH, marginBottom: 4 },
  chartMax:       { fontSize: 11, color: colors.text.secondary },
  chartMin:       { fontSize: 11, color: colors.text.secondary },
  chartFooterRow: { flexDirection: 'row', justifyContent: 'space-between', width: CHART_WIDTH, marginTop: 4 },
  chartDateText:  { fontSize: 11, color: colors.text.muted },
  historyItem:    { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', backgroundColor: colors.bg.card, padding: 12, borderRadius: 8, marginBottom: 6, borderWidth: 1, borderColor: colors.border.subtle },
  historyDate:    { fontSize: 14, color: colors.text.secondary },
  historyValues:  { alignItems: 'flex-end' },
  historyWeight:  { fontSize: 14, fontWeight: 'bold', color: colors.text.primary },
  historyBodyFat: { fontSize: 11, color: colors.neon.orange, marginTop: 2 },
  loadMoreBtn:    { marginHorizontal: 16, marginTop: 8, padding: 14, borderRadius: 10, borderWidth: 1, borderColor: colors.border.subtle, alignItems: 'center' },
  loadMoreText:   { fontSize: 14, color: colors.neon.blue, fontWeight: '600' },
});
