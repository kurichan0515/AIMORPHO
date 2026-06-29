import React, { useState, useEffect } from 'react';
import { View, Text, TextInput, TouchableOpacity, StyleSheet, ScrollView, Alert } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import api from '../api/client';
import { colors } from '../theme/colors';

const GOAL_MODES = [
  { value: 'diet',     label: '減量',    sub: 'CUT',      color: colors.neon.orange },
  { value: 'maintain', label: '体型維持', sub: 'MAINTAIN', color: colors.neon.blue   },
  { value: 'bulk',     label: '増量',    sub: 'BULK',     color: colors.neon.green  },
] as const;

export default function GoalEditScreen() {
  const navigation = useNavigation<any>();
  const qc = useQueryClient();

  const { data: goal } = useQuery({
    queryKey: ['goal'],
    queryFn: () => api.get('/users/me/goal').then(r => r.data).catch(() => null),
  });

  const [targetWeight, setTargetWeight] = useState('');
  const [mode, setMode] = useState<'diet' | 'maintain' | 'bulk'>('maintain');

  useEffect(() => {
    if (goal) {
      setTargetWeight(String(goal.targetWeight || ''));
      setMode(goal.mode || 'maintain');
    }
  }, [goal]);

  const mutation = useMutation({
    mutationFn: () => api.post('/users/me/goal', { targetWeight: parseFloat(targetWeight), mode }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['goal'] }); navigation.goBack(); },
    onError:   () => Alert.alert('エラー', '設定に失敗しました'),
  });

  return (
    <ScrollView style={s.root} contentContainerStyle={s.container} keyboardShouldPersistTaps="handled" keyboardDismissMode="on-drag">
      <View style={s.card}>
        <Text style={s.cardSub}>目標体重</Text>
        <View style={s.weightInput}>
          <TextInput
            style={s.weightValue}
            value={targetWeight}
            onChangeText={setTargetWeight}
            placeholder="60.0"
            placeholderTextColor={colors.text.muted}
            keyboardType="decimal-pad"
          />
          <Text style={s.weightUnit}>kg</Text>
        </View>
        <Text style={[s.cardSub, { marginTop: 16 }]}>モード</Text>
        <View style={s.modeRow}>
          {GOAL_MODES.map(m => (
            <TouchableOpacity
              key={m.value}
              style={[s.modeBtn, mode === m.value && { borderColor: m.color, backgroundColor: `${m.color}14` }]}
              onPress={() => setMode(m.value)}
            >
              <View style={[s.modeBar, { backgroundColor: m.color }]} />
              <Text style={[s.modeSub, { color: m.color }]}>{m.sub}</Text>
              <Text style={[s.modeLabel, mode === m.value && { color: m.color }]}>{m.label}</Text>
            </TouchableOpacity>
          ))}
        </View>
      </View>

      <TouchableOpacity
        style={[s.primaryBtn, { marginTop: 24 }, mutation.isPending && s.primaryBtnDisabled]}
        onPress={() => mutation.mutate()}
        disabled={mutation.isPending}
        accessibilityLabel="目標を保存"
        accessibilityRole="button"
      >
        <Text style={s.primaryBtnText}>{mutation.isPending ? '設定中...' : '保存'}</Text>
      </TouchableOpacity>
    </ScrollView>
  );
}

const s = StyleSheet.create({
  root:      { flex: 1, backgroundColor: colors.bg.primary },
  container: { padding: 16 },
  card:      { backgroundColor: colors.bg.card, borderRadius: 14, borderWidth: 1, borderColor: colors.border.subtle, overflow: 'hidden', paddingBottom: 14 },
  cardSub:   { fontSize: 11, color: colors.text.muted, fontWeight: '600', letterSpacing: 0.5, paddingHorizontal: 16, paddingTop: 14, paddingBottom: 6 },

  weightInput: { flexDirection: 'row', alignItems: 'baseline', paddingHorizontal: 16, paddingVertical: 8 },
  weightValue: { fontSize: 36, fontWeight: '700', color: colors.text.primary, minWidth: 80 },
  weightUnit:  { fontSize: 18, color: colors.text.secondary, marginLeft: 6 },

  modeRow:  { flexDirection: 'row', gap: 8, padding: 14, paddingTop: 6 },
  modeBtn:  { flex: 1, alignItems: 'center', paddingVertical: 14, borderRadius: 10, backgroundColor: colors.bg.cardAlt, borderWidth: 1, borderColor: colors.border.subtle, overflow: 'hidden' },
  modeBar:  { width: 20, height: 3, borderRadius: 2, marginBottom: 6 },
  modeSub:  { fontSize: 9, fontWeight: '700', letterSpacing: 1, marginBottom: 2 },
  modeLabel:{ fontSize: 12, fontWeight: '700', color: colors.text.secondary },

  primaryBtn:         { backgroundColor: colors.neon.blue, borderRadius: 12, paddingVertical: 15, alignItems: 'center', minHeight: 50, justifyContent: 'center' },
  primaryBtnDisabled: { opacity: 0.6 },
  primaryBtnText:     { color: colors.bg.primary, fontSize: 15, fontWeight: 'bold' },
});
