import React, { useState } from 'react';
import { View, Text, TextInput, TouchableOpacity, StyleSheet, Alert, ScrollView } from 'react-native';
import Svg, { Polyline, Circle } from 'react-native-svg';
import { useMutation, useQuery } from '@tanstack/react-query';
import { recordWeight, getWeightHistory } from '../api/logs';

const CHART_WIDTH = 320;
const CHART_HEIGHT = 160;
const CHART_PADDING = 24;

function WeightChart({ data }: { data: { recordedAt: string; weightKg: number }[] }) {
  if (data.length < 2) return null;

  const weights = data.map(d => d.weightKg);
  const min = Math.min(...weights);
  const max = Math.max(...weights);
  const range = max - min || 1;

  const points = data.map((d, i) => {
    const x = CHART_PADDING + (i / (data.length - 1)) * (CHART_WIDTH - CHART_PADDING * 2);
    const y = CHART_HEIGHT - CHART_PADDING - ((d.weightKg - min) / range) * (CHART_HEIGHT - CHART_PADDING * 2);
    return { x, y };
  });

  return (
    <View style={styles.chartCard}>
      <View style={styles.chartHeaderRow}>
        <Text style={styles.chartMax}>{max} kg</Text>
        <Text style={styles.chartMin}>{min} kg</Text>
      </View>
      <Svg width={CHART_WIDTH} height={CHART_HEIGHT}>
        <Polyline
          points={points.map(p => `${p.x},${p.y}`).join(' ')}
          fill="none"
          stroke="#007AFF"
          strokeWidth={2}
        />
        {points.map((p, i) => (
          <Circle key={i} cx={p.x} cy={p.y} r={3} fill="#007AFF" />
        ))}
      </Svg>
      <View style={styles.chartFooterRow}>
        <Text style={styles.chartDateText}>{data[0].recordedAt?.slice(5, 10)}</Text>
        <Text style={styles.chartDateText}>{data[data.length - 1].recordedAt?.slice(5, 10)}</Text>
      </View>
    </View>
  );
}

export default function WeightLogScreen() {
  const [input, setInput] = useState('');
  const [bodyFatInput, setBodyFatInput] = useState('');

  const { data: history, refetch } = useQuery({
    queryKey: ['weightHistory'],
    queryFn: () => getWeightHistory({ limit: 14 }),
  });

  const mutation = useMutation({
    mutationFn: ({ kg, bodyFatPct }: { kg: number; bodyFatPct?: number }) => recordWeight(kg, bodyFatPct),
    onSuccess: (data) => {
      setInput('');
      setBodyFatInput('');
      refetch();
      if (data.newBadges?.length) {
        Alert.alert('バッジ獲得！', data.newBadges.map((b: any) => b.name).join('、'));
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

  return (
    <ScrollView style={styles.container}>
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
            placeholderTextColor="#AAA"
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
            placeholderTextColor="#AAA"
          />
        </View>
        <TouchableOpacity style={styles.submitBtn} onPress={submit} disabled={mutation.isPending}>
          <Text style={styles.submitBtnText}>記録</Text>
        </TouchableOpacity>
      </View>

      <Text style={styles.sectionTitle}>推移</Text>
      <WeightChart data={chartData} />

      <Text style={styles.sectionTitle}>履歴</Text>
      {(history || []).map((item: any) => (
        <View key={item.SK} style={styles.historyItem}>
          <Text style={styles.historyDate}>{item.recordedAt?.slice(0, 10)}</Text>
          <View style={styles.historyValues}>
            <Text style={styles.historyWeight}>{item.weightKg} kg</Text>
            {item.bodyFatPct != null && (
              <Text style={styles.historyBodyFat}>体脂肪率 {item.bodyFatPct}%</Text>
            )}
          </View>
        </View>
      ))}
      <View style={{ height: 24 }} />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container:      { flex: 1, backgroundColor: '#F8F9FA', padding: 16 },
  latestCard:     { backgroundColor: '#FFF', borderRadius: 12, padding: 20, alignItems: 'center', marginBottom: 16, elevation: 2 },
  latestLabel:    { fontSize: 12, color: '#666' },
  latestValue:    { fontSize: 36, fontWeight: 'bold', color: '#007AFF', marginTop: 4 },
  latestBodyFat:  { fontSize: 13, color: '#FF9500', marginTop: 4 },
  formCard:       { backgroundColor: '#FFF', borderRadius: 12, padding: 16, marginBottom: 24, elevation: 1 },
  fieldRow:       { marginBottom: 12 },
  fieldLabel:     { fontSize: 12, color: '#666', marginBottom: 6 },
  input:          { backgroundColor: '#F8F9FA', borderRadius: 10, paddingHorizontal: 16, fontSize: 18, height: 52 },
  submitBtn:      { backgroundColor: '#007AFF', borderRadius: 10, paddingVertical: 14, alignItems: 'center', marginTop: 4 },
  submitBtnText:  { color: '#FFF', fontWeight: 'bold', fontSize: 16 },
  sectionTitle:   { fontSize: 16, fontWeight: 'bold', marginBottom: 8 },
  chartCard:      { backgroundColor: '#FFF', borderRadius: 12, padding: 12, marginBottom: 20, alignItems: 'center', elevation: 2 },
  chartHeaderRow: { flexDirection: 'row', justifyContent: 'space-between', width: CHART_WIDTH, marginBottom: 4 },
  chartMax:       { fontSize: 11, color: '#888' },
  chartMin:       { fontSize: 11, color: '#888' },
  chartFooterRow: { flexDirection: 'row', justifyContent: 'space-between', width: CHART_WIDTH, marginTop: 4 },
  chartDateText:  { fontSize: 11, color: '#AAA' },
  historyItem:    { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', backgroundColor: '#FFF', padding: 12, borderRadius: 8, marginBottom: 6 },
  historyDate:    { fontSize: 14, color: '#666' },
  historyValues:  { alignItems: 'flex-end' },
  historyWeight:  { fontSize: 14, fontWeight: 'bold' },
  historyBodyFat: { fontSize: 11, color: '#FF9500', marginTop: 2 },
});
