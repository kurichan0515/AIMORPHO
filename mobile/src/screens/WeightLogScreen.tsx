import React, { useState } from 'react';
import { View, Text, TextInput, TouchableOpacity, StyleSheet, Alert } from 'react-native';
import { useMutation, useQuery } from '@tanstack/react-query';
import { recordWeight, getWeightHistory } from '../api/logs';

export default function WeightLogScreen() {
  const [input, setInput] = useState('');

  const { data: history, refetch } = useQuery({
    queryKey: ['weightHistory'],
    queryFn: () => getWeightHistory({ limit: 14 }),
  });

  const mutation = useMutation({
    mutationFn: (kg: number) => recordWeight(kg),
    onSuccess: (data) => {
      setInput('');
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
    mutation.mutate(kg);
  };

  const latest = history?.[0]?.weightKg;

  return (
    <View style={styles.container}>
      {latest !== undefined && (
        <View style={styles.latestCard}>
          <Text style={styles.latestLabel}>直近の体重</Text>
          <Text style={styles.latestValue}>{latest} kg</Text>
        </View>
      )}

      <View style={styles.inputRow}>
        <TextInput
          style={styles.input}
          value={input}
          onChangeText={setInput}
          keyboardType="decimal-pad"
          placeholder="体重 (kg)"
          placeholderTextColor="#AAA"
        />
        <TouchableOpacity style={styles.submitBtn} onPress={submit} disabled={mutation.isPending}>
          <Text style={styles.submitBtnText}>記録</Text>
        </TouchableOpacity>
      </View>

      <Text style={styles.sectionTitle}>履歴</Text>
      {(history || []).map((item: any) => (
        <View key={item.SK} style={styles.historyItem}>
          <Text style={styles.historyDate}>{item.recordedAt?.slice(0, 10)}</Text>
          <Text style={styles.historyWeight}>{item.weightKg} kg</Text>
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  container:      { flex: 1, backgroundColor: '#F8F9FA', padding: 16 },
  latestCard:     { backgroundColor: '#FFF', borderRadius: 12, padding: 20, alignItems: 'center', marginBottom: 16, elevation: 2 },
  latestLabel:    { fontSize: 12, color: '#666' },
  latestValue:    { fontSize: 36, fontWeight: 'bold', color: '#007AFF', marginTop: 4 },
  inputRow:       { flexDirection: 'row', gap: 8, marginBottom: 24 },
  input:          { flex: 1, backgroundColor: '#FFF', borderRadius: 10, paddingHorizontal: 16, fontSize: 18, height: 52, elevation: 1 },
  submitBtn:      { backgroundColor: '#007AFF', borderRadius: 10, paddingHorizontal: 20, justifyContent: 'center' },
  submitBtnText:  { color: '#FFF', fontWeight: 'bold', fontSize: 16 },
  sectionTitle:   { fontSize: 16, fontWeight: 'bold', marginBottom: 8 },
  historyItem:    { flexDirection: 'row', justifyContent: 'space-between', backgroundColor: '#FFF', padding: 12, borderRadius: 8, marginBottom: 6 },
  historyDate:    { fontSize: 14, color: '#666' },
  historyWeight:  { fontSize: 14, fontWeight: 'bold' },
});
