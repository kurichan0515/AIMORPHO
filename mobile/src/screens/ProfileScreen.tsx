import React, { useState, useEffect } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, StyleSheet,
  ScrollView, Alert, Switch,
} from 'react-native';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import api from '../api/client';
import { useAuthStore } from '../store/useAuthStore';

const LIFESTYLE_OPTIONS = [
  { value: 'sedentary',   label: 'ほぼ運動しない (×1.2)' },
  { value: 'light',       label: '軽い運動 (×1.375)' },
  { value: 'moderate',    label: '週3〜5回 (×1.55)' },
  { value: 'active',      label: '毎日運動 (×1.725)' },
  { value: 'very_active', label: 'ハードトレーニング (×1.9)' },
];

const AI_TONE_OPTIONS = [
  { value: 'friendly', label: 'フレンドリー' },
  { value: 'strict',   label: '厳しめ' },
  { value: 'gentle',   label: 'やさしい' },
  { value: 'cool',     label: 'クール' },
];

export default function ProfileScreen() {
  const { logout } = useAuthStore();
  const qc = useQueryClient();

  const { data: profile } = useQuery({
    queryKey: ['profile'],
    queryFn: () => api.get('/users/me').then(r => r.data),
  });

  const { data: goal } = useQuery({
    queryKey: ['goal'],
    queryFn: () => api.get('/users/me/goal').then(r => r.data).catch(() => null),
  });

  const { data: streak } = useQuery({
    queryKey: ['streak'],
    queryFn: () => api.get('/users/me/streak').then(r => r.data),
  });

  const [form, setForm] = useState({
    displayName: '', age: '', heightCm: '', weightKg: '',
    lifestyle: 'moderate', aiTone: 'friendly',
  });
  const [goalForm, setGoalForm] = useState({ targetWeight: '', mode: 'diet' as 'diet' | 'maintain' });

  useEffect(() => {
    if (profile) setForm({
      displayName: profile.displayName || '',
      age: String(profile.age || ''),
      heightCm: String(profile.heightCm || ''),
      weightKg: String(profile.weightKg || ''),
      lifestyle: profile.lifestyle || 'moderate',
      aiTone: profile.aiTone || 'friendly',
    });
  }, [profile]);

  useEffect(() => {
    if (goal) setGoalForm({ targetWeight: String(goal.targetWeight || ''), mode: goal.mode || 'diet' });
  }, [goal]);

  const profileMutation = useMutation({
    mutationFn: () => api.put('/users/me', {
      displayName: form.displayName,
      age: parseInt(form.age, 10) || undefined,
      heightCm: parseFloat(form.heightCm) || undefined,
      weightKg: parseFloat(form.weightKg) || undefined,
      lifestyle: form.lifestyle,
      aiTone: form.aiTone,
    }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['profile'] }); Alert.alert('保存しました'); },
    onError: () => Alert.alert('エラー', '保存に失敗しました'),
  });

  const goalMutation = useMutation({
    mutationFn: () => api.post('/users/me/goal', {
      targetWeight: parseFloat(goalForm.targetWeight),
      mode: goalForm.mode,
    }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['goal'] }); Alert.alert('目標を設定しました'); },
    onError: () => Alert.alert('エラー', '設定に失敗しました'),
  });

  const f = (key: keyof typeof form, val: string) => setForm(prev => ({ ...prev, [key]: val }));

  return (
    <ScrollView style={styles.container} keyboardShouldPersistTaps="handled">
      {/* ストリーク */}
      <View style={styles.streakCard}>
        <Text style={styles.streakDays}>{streak?.currentDays || 0}日</Text>
        <Text style={styles.streakLabel}>連続ログイン中</Text>
        <Text style={styles.streakBest}>最高 {streak?.longestDays || 0}日</Text>
      </View>

      {/* プロフィール */}
      <Text style={styles.sectionTitle}>プロフィール</Text>
      <TextInput style={styles.input} placeholder="ニックネーム" value={form.displayName} onChangeText={v => f('displayName', v)} />
      <View style={styles.row}>
        <TextInput style={[styles.input, styles.half]} placeholder="年齢" value={form.age} onChangeText={v => f('age', v)} keyboardType="number-pad" />
        <TextInput style={[styles.input, styles.half]} placeholder="身長 (cm)" value={form.heightCm} onChangeText={v => f('heightCm', v)} keyboardType="decimal-pad" />
      </View>
      <TextInput style={styles.input} placeholder="現在の体重 (kg)" value={form.weightKg} onChangeText={v => f('weightKg', v)} keyboardType="decimal-pad" />

      <Text style={styles.label}>活動レベル</Text>
      {LIFESTYLE_OPTIONS.map(o => (
        <TouchableOpacity key={o.value} style={[styles.optionRow, form.lifestyle === o.value && styles.optionRowActive]} onPress={() => f('lifestyle', o.value)}>
          <Text style={[styles.optionText, form.lifestyle === o.value && styles.optionTextActive]}>{o.label}</Text>
        </TouchableOpacity>
      ))}

      <Text style={styles.label}>AIの口調</Text>
      <View style={styles.toneRow}>
        {AI_TONE_OPTIONS.map(o => (
          <TouchableOpacity key={o.value} style={[styles.toneChip, form.aiTone === o.value && styles.toneChipActive]} onPress={() => f('aiTone', o.value)}>
            <Text style={[styles.toneChipText, form.aiTone === o.value && styles.toneChipTextActive]}>{o.label}</Text>
          </TouchableOpacity>
        ))}
      </View>

      <TouchableOpacity style={styles.saveBtn} onPress={() => profileMutation.mutate()} disabled={profileMutation.isPending}>
        <Text style={styles.saveBtnText}>プロフィールを保存</Text>
      </TouchableOpacity>

      {/* 目標 */}
      <Text style={styles.sectionTitle}>目標設定</Text>
      <TextInput style={styles.input} placeholder="目標体重 (kg)" value={goalForm.targetWeight} onChangeText={v => setGoalForm(g => ({ ...g, targetWeight: v }))} keyboardType="decimal-pad" />
      <View style={styles.row}>
        {(['diet', 'maintain'] as const).map(m => (
          <TouchableOpacity key={m} style={[styles.modeBtn, goalForm.mode === m && styles.modeBtnActive]} onPress={() => setGoalForm(g => ({ ...g, mode: m }))}>
            <Text style={[styles.modeBtnText, goalForm.mode === m && styles.modeBtnTextActive]}>{m === 'diet' ? 'ダイエット' : '維持'}</Text>
          </TouchableOpacity>
        ))}
      </View>
      <TouchableOpacity style={styles.saveBtn} onPress={() => goalMutation.mutate()} disabled={goalMutation.isPending}>
        <Text style={styles.saveBtnText}>目標を設定</Text>
      </TouchableOpacity>

      {/* ログアウト */}
      <TouchableOpacity style={styles.logoutBtn} onPress={() => Alert.alert('ログアウト', '本当にログアウトしますか？', [
        { text: 'キャンセル', style: 'cancel' },
        { text: 'ログアウト', style: 'destructive', onPress: logout },
      ])}>
        <Text style={styles.logoutBtnText}>ログアウト</Text>
      </TouchableOpacity>
      <View style={{ height: 40 }} />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container:          { flex: 1, backgroundColor: '#F8F9FA', padding: 16 },
  streakCard:         { backgroundColor: '#007AFF', borderRadius: 16, padding: 20, alignItems: 'center', marginBottom: 20 },
  streakDays:         { fontSize: 48, fontWeight: 'bold', color: '#FFF' },
  streakLabel:        { fontSize: 14, color: 'rgba(255,255,255,0.8)', marginTop: 4 },
  streakBest:         { fontSize: 12, color: 'rgba(255,255,255,0.6)', marginTop: 4 },
  sectionTitle:       { fontSize: 17, fontWeight: 'bold', marginTop: 16, marginBottom: 10 },
  label:              { fontSize: 13, color: '#666', marginTop: 12, marginBottom: 6 },
  input:              { backgroundColor: '#FFF', borderRadius: 10, padding: 14, fontSize: 15, marginBottom: 8, elevation: 1 },
  row:                { flexDirection: 'row', gap: 8 },
  half:               { flex: 1 },
  optionRow:          { backgroundColor: '#FFF', borderRadius: 8, padding: 12, marginBottom: 4, borderWidth: 2, borderColor: 'transparent' },
  optionRowActive:    { borderColor: '#007AFF', backgroundColor: '#E8F4FF' },
  optionText:         { fontSize: 14, color: '#333' },
  optionTextActive:   { color: '#007AFF', fontWeight: '600' },
  toneRow:            { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 8 },
  toneChip:           { paddingHorizontal: 14, paddingVertical: 8, borderRadius: 20, backgroundColor: '#E8E8E8' },
  toneChipActive:     { backgroundColor: '#007AFF' },
  toneChipText:       { fontSize: 13, color: '#333' },
  toneChipTextActive: { color: '#FFF' },
  saveBtn:            { backgroundColor: '#007AFF', borderRadius: 10, padding: 14, alignItems: 'center', marginTop: 8, marginBottom: 4 },
  saveBtnText:        { color: '#FFF', fontWeight: 'bold', fontSize: 15 },
  modeBtn:            { flex: 1, padding: 12, borderRadius: 8, backgroundColor: '#EEE', alignItems: 'center' },
  modeBtnActive:      { backgroundColor: '#007AFF' },
  modeBtnText:        { fontWeight: 'bold', color: '#555' },
  modeBtnTextActive:  { color: '#FFF' },
  logoutBtn:          { marginTop: 24, padding: 14, borderRadius: 10, alignItems: 'center', borderWidth: 1, borderColor: '#FF3B30' },
  logoutBtnText:      { color: '#FF3B30', fontWeight: 'bold', fontSize: 15 },
});
