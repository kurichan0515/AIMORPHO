import React, { useState, useEffect } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, StyleSheet,
  ScrollView, Alert, Switch,
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
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
  const { logout, isAnonymous, resetGuestData } = useAuthStore();
  const navigation = useNavigation<any>();
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
    lifestyle: 'moderate', aiTone: 'friendly', hasGym: false,
  });
  const [goalForm, setGoalForm] = useState({ targetWeight: '', mode: 'maintain' as 'diet' | 'maintain' | 'bulk' });

  useEffect(() => {
    if (profile) setForm({
      displayName: profile.displayName || '',
      age: String(profile.age || ''),
      heightCm: String(profile.heightCm || ''),
      weightKg: String(profile.weightKg || ''),
      lifestyle: profile.lifestyle || 'moderate',
      aiTone: profile.aiTone || 'friendly',
      hasGym: profile.hasGym ?? false,
    });
  }, [profile]);

  useEffect(() => {
    if (goal) setGoalForm({ targetWeight: String(goal.targetWeight || ''), mode: goal.mode || 'maintain' });
  }, [goal]);

  const profileMutation = useMutation({
    mutationFn: () => api.put('/users/me', {
      displayName: form.displayName,
      age: parseInt(form.age, 10) || undefined,
      heightCm: parseFloat(form.heightCm) || undefined,
      weightKg: parseFloat(form.weightKg) || undefined,
      lifestyle: form.lifestyle,
      aiTone: form.aiTone,
      hasGym: form.hasGym,
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

  const f = (key: keyof typeof form, val: string | boolean) => setForm(prev => ({ ...prev, [key]: val }));

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

      <View style={styles.switchRow}>
        <View>
          <Text style={styles.label}>ジム通い</Text>
          <Text style={styles.switchDesc}>ONにするとジムメニューを運動提案に含めます</Text>
        </View>
        <Switch value={form.hasGym} onValueChange={v => f('hasGym', v)} trackColor={{ true: '#007AFF' }} />
      </View>

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
        {([
          { value: 'diet',     label: '🔥 減量' },
          { value: 'maintain', label: '⚖️ 維持' },
          { value: 'bulk',     label: '💪 増量' },
        ] as const).map(m => (
          <TouchableOpacity key={m.value} style={[styles.modeBtn, goalForm.mode === m.value && styles.modeBtnActive]} onPress={() => setGoalForm(g => ({ ...g, mode: m.value }))}>
            <Text style={[styles.modeBtnText, goalForm.mode === m.value && styles.modeBtnTextActive]}>{m.label}</Text>
          </TouchableOpacity>
        ))}
      </View>
      <TouchableOpacity style={styles.saveBtn} onPress={() => goalMutation.mutate()} disabled={goalMutation.isPending}>
        <Text style={styles.saveBtnText}>目標を設定</Text>
      </TouchableOpacity>

      {/* アカウント */}
      <Text style={styles.sectionTitle}>アカウント</Text>
      {isAnonymous ? (
        <View style={styles.accountBox}>
          <Text style={styles.accountAnonymousLabel}>ゲストモードで利用中</Text>
          <Text style={styles.accountAnonymousDesc}>
            メールアドレスを登録すると、機種変更・再インストール時にデータを復元できます。
          </Text>
          <TouchableOpacity style={styles.accountBtn} onPress={() => navigation.navigate('Register')}>
            <Text style={styles.accountBtnText}>アカウント登録（データを保護する）</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.accountBtnSecondary} onPress={() => navigation.navigate('Login')}>
            <Text style={styles.accountBtnSecondaryText}>既存アカウントでログインして引き継ぐ</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.resetBtn}
            onPress={() => Alert.alert(
              'データをリセット',
              'すべての記録・アバター・目標が削除されます。この操作は取り消せません。',
              [
                { text: 'キャンセル', style: 'cancel' },
                { text: 'リセット', style: 'destructive', onPress: () => { qc.clear(); resetGuestData(); } },
              ]
            )}
          >
            <Text style={styles.resetBtnText}>データをリセット（最初からやり直す）</Text>
          </TouchableOpacity>
        </View>
      ) : (
        <View style={styles.accountBox}>
          <Text style={styles.accountRegisteredLabel}>登録済みアカウント</Text>
          <Text style={styles.accountEmail}>{profile?.email ?? ''}</Text>
          <TouchableOpacity
            style={styles.logoutBtn}
            onPress={() => Alert.alert('ログアウト', 'ログアウトすると、次回起動時はゲストとして再スタートします。', [
              { text: 'キャンセル', style: 'cancel' },
              { text: 'ログアウト', style: 'destructive', onPress: () => { qc.clear(); logout(); } },
            ])}
          >
            <Text style={styles.logoutBtnText}>ログアウト</Text>
          </TouchableOpacity>
        </View>
      )}
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
  accountBox:                { backgroundColor: '#FFF', borderRadius: 12, padding: 16, marginBottom: 8, elevation: 1 },
  accountAnonymousLabel:     { fontSize: 14, fontWeight: '600', color: '#FF9500', marginBottom: 6 },
  accountAnonymousDesc:      { fontSize: 13, color: '#666', marginBottom: 12, lineHeight: 20 },
  accountBtn:                { backgroundColor: '#007AFF', borderRadius: 10, padding: 13, alignItems: 'center', marginBottom: 8 },
  accountBtnText:            { color: '#FFF', fontWeight: 'bold', fontSize: 14 },
  accountBtnSecondary:       { borderWidth: 1, borderColor: '#007AFF', borderRadius: 10, padding: 13, alignItems: 'center' },
  accountBtnSecondaryText:   { color: '#007AFF', fontWeight: '600', fontSize: 14 },
  switchRow:                 { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', backgroundColor: '#FFF', borderRadius: 10, padding: 14, marginBottom: 8, elevation: 1 },
  switchDesc:                { fontSize: 11, color: '#888', marginTop: 2 },
  resetBtn:                  { marginTop: 12, padding: 12, alignItems: 'center' },
  resetBtnText:              { color: '#FF3B30', fontSize: 13 },
  accountRegisteredLabel:    { fontSize: 13, color: '#34C759', fontWeight: '600', marginBottom: 4 },
  accountEmail:              { fontSize: 14, color: '#333', marginBottom: 12 },
  logoutBtn:                 { padding: 13, borderRadius: 10, alignItems: 'center', borderWidth: 1, borderColor: '#FF3B30' },
  logoutBtnText:             { color: '#FF3B30', fontWeight: 'bold', fontSize: 14 },
});
