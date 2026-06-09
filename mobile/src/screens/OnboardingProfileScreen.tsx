import React, { useState } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, StyleSheet,
  ScrollView, KeyboardAvoidingView, Platform, Alert, Switch,
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import api from '../api/client';
import { useOnboardingStore } from '../store/useOnboardingStore';

type Gender = 'male' | 'female' | 'other';

const GENDER_OPTIONS: { value: Gender; label: string; emoji: string }[] = [
  { value: 'male',   label: '男性', emoji: '👨' },
  { value: 'female', label: '女性', emoji: '👩' },
  { value: 'other',  label: 'その他', emoji: '🧑' },
];

const LIFESTYLE_OPTIONS = [
  { value: 'sedentary',   label: 'ほぼ運動しない',        emoji: '🛋️' },
  { value: 'light',       label: '軽い運動（週1〜2）',     emoji: '🚶' },
  { value: 'moderate',    label: '週3〜5回',               emoji: '🏃' },
  { value: 'active',      label: '毎日運動',               emoji: '💪' },
  { value: 'very_active', label: 'ハードトレーニング',     emoji: '🏋️' },
];

const AI_TONE_OPTIONS = [
  { value: 'friendly', label: 'フレンドリー', emoji: '😊' },
  { value: 'strict',   label: '厳しめ',       emoji: '💪' },
  { value: 'gentle',   label: 'やさしい',     emoji: '🌸' },
  { value: 'cool',     label: 'クール',        emoji: '😎' },
];

export default function OnboardingProfileScreen() {
  const navigation = useNavigation<any>();
  const { setProfile } = useOnboardingStore();
  const [form, setForm] = useState({
    displayName: '',
    gender: '' as Gender | '',
    age: '',
    heightCm: '',
    weightKg: '',
    bodyFatPct: '',
    lifestyle: 'moderate',
    aiTone: 'friendly',
    hasGym: false,
  });
  const [loading, setLoading] = useState(false);

  const f = (key: keyof typeof form, val: string) => setForm(p => ({ ...p, [key]: val }));

  const next = async () => {
    if (!form.displayName.trim()) {
      Alert.alert('入力必須', 'ニックネームを入力してください');
      return;
    }
    if (!form.age || !form.heightCm || !form.weightKg) {
      Alert.alert('入力必須', '年齢・身長・体重を入力してください');
      return;
    }
    const age = parseInt(form.age, 10);
    const heightCm = parseFloat(form.heightCm);
    const weightKg = parseFloat(form.weightKg);
    const bodyFatPct = form.bodyFatPct ? parseFloat(form.bodyFatPct) : undefined;
    if (isNaN(age) || isNaN(heightCm) || isNaN(weightKg)) {
      Alert.alert('入力エラー', '数値を正しく入力してください');
      return;
    }
    setLoading(true);
    try {
      await api.put('/users/me', {
        displayName: form.displayName.trim(),
        gender: form.gender || undefined,
        age,
        heightCm,
        weightKg,
        bodyFatPct,
        lifestyle: form.lifestyle,
        aiTone: form.aiTone,
        hasGym: form.hasGym,
      });
      setProfile({ heightCm, currentWeightKg: weightKg, gender: form.gender || null });
      navigation.navigate('OnboardingGoal');
    } catch {
      Alert.alert('エラー', '保存に失敗しました');
    } finally {
      setLoading(false);
    }
  };

  return (
    <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <ScrollView contentContainerStyle={styles.container} keyboardShouldPersistTaps="handled">
        <View style={styles.stepIndicator}>
          <View style={[styles.dot, styles.dotActive]} />
          <View style={styles.dot} />
          <View style={styles.dot} />
        </View>

        <Text style={styles.title}>プロフィール設定</Text>

        <Text style={styles.label}>ニックネーム <Text style={styles.required}>*</Text></Text>
        <TextInput
          style={styles.input}
          placeholder="例：たろう"
          value={form.displayName}
          onChangeText={v => f('displayName', v)}
        />

        <Text style={styles.label}>性別 <Text style={styles.optional}>（任意）</Text></Text>
        <View style={styles.genderRow}>
          {GENDER_OPTIONS.map(o => (
            <TouchableOpacity
              key={o.value}
              style={[styles.genderBtn, form.gender === o.value && styles.genderBtnActive]}
              onPress={() => f('gender', form.gender === o.value ? '' : o.value)}
            >
              <Text style={styles.genderEmoji}>{o.emoji}</Text>
              <Text style={[styles.genderText, form.gender === o.value && styles.genderTextActive]}>
                {o.label}
              </Text>
            </TouchableOpacity>
          ))}
        </View>

        <View style={styles.row}>
          <View style={[styles.inputWrapper, styles.half]}>
            <TextInput
              style={styles.inputInner}
              placeholder="年齢"
              value={form.age}
              onChangeText={v => f('age', v)}
              keyboardType="number-pad"
            />
            <Text style={styles.unit}>歳</Text>
          </View>
          <View style={[styles.inputWrapper, styles.half]}>
            <TextInput
              style={styles.inputInner}
              placeholder="身長"
              value={form.heightCm}
              onChangeText={v => f('heightCm', v)}
              keyboardType="decimal-pad"
            />
            <Text style={styles.unit}>cm</Text>
          </View>
        </View>
        <View style={styles.row}>
          <View style={[styles.inputWrapper, styles.half]}>
            <TextInput
              style={styles.inputInner}
              placeholder="体重"
              value={form.weightKg}
              onChangeText={v => f('weightKg', v)}
              keyboardType="decimal-pad"
            />
            <Text style={styles.unit}>kg</Text>
          </View>
          <View style={[styles.inputWrapper, styles.half]}>
            <TextInput
              style={styles.inputInner}
              placeholder="体脂肪率（任意）"
              value={form.bodyFatPct}
              onChangeText={v => f('bodyFatPct', v)}
              keyboardType="decimal-pad"
            />
            <Text style={styles.unit}>%</Text>
          </View>
        </View>

        <Text style={styles.label}>活動レベル <Text style={styles.required}>*</Text></Text>
        {LIFESTYLE_OPTIONS.map(o => (
          <TouchableOpacity
            key={o.value}
            style={[styles.option, form.lifestyle === o.value && styles.optionActive]}
            onPress={() => f('lifestyle', o.value)}
          >
            <Text style={styles.optionEmoji}>{o.emoji}</Text>
            <Text style={[styles.optionText, form.lifestyle === o.value && styles.optionTextActive]}>
              {o.label}
            </Text>
          </TouchableOpacity>
        ))}

        <Text style={styles.label}>AIコーチの口調 <Text style={styles.required}>*</Text></Text>
        <View style={styles.toneRow}>
          {AI_TONE_OPTIONS.map(o => (
            <TouchableOpacity
              key={o.value}
              style={[styles.toneChip, form.aiTone === o.value && styles.toneChipActive]}
              onPress={() => f('aiTone', o.value)}
            >
              <Text style={styles.toneEmoji}>{o.emoji}</Text>
              <Text style={[styles.toneText, form.aiTone === o.value && styles.toneTextActive]}>
                {o.label}
              </Text>
            </TouchableOpacity>
          ))}
        </View>

        <View style={styles.gymRow}>
          <View>
            <Text style={styles.label}>ジムに通っている <Text style={styles.optional}>（任意）</Text></Text>
            <Text style={styles.gymDesc}>ONにするとジムのウェイトメニューを運動提案に含めます</Text>
          </View>
          <Switch
            value={form.hasGym}
            onValueChange={v => setForm(p => ({ ...p, hasGym: v }))}
            trackColor={{ true: '#007AFF' }}
          />
        </View>

        <TouchableOpacity style={styles.nextBtn} onPress={next} disabled={loading}>
          <Text style={styles.nextBtnText}>{loading ? '保存中...' : '次へ →'}</Text>
        </TouchableOpacity>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container:        { flexGrow: 1, padding: 24, backgroundColor: '#FFF' },
  stepIndicator:    { flexDirection: 'row', justifyContent: 'center', gap: 8, marginBottom: 24, marginTop: 8 },
  dot:              { width: 8, height: 8, borderRadius: 4, backgroundColor: '#DDD' },
  dotActive:        { backgroundColor: '#007AFF' },
  title:            { fontSize: 24, fontWeight: 'bold', marginBottom: 20 },
  label:            { fontSize: 14, fontWeight: '600', color: '#333', marginTop: 16, marginBottom: 8 },
  input:            { borderWidth: 1, borderColor: '#DDD', borderRadius: 10, padding: 14, fontSize: 15, marginBottom: 10, backgroundColor: '#FAFAFA' },
  required:         { color: '#FF3B30' },
  optional:         { fontWeight: '400', color: '#999', fontSize: 12 },
  genderRow:        { flexDirection: 'row', gap: 8, marginBottom: 4 },
  genderBtn:        { flex: 1, alignItems: 'center', padding: 12, borderRadius: 12, backgroundColor: '#F5F5F5', borderWidth: 2, borderColor: 'transparent' },
  genderBtnActive:  { borderColor: '#007AFF', backgroundColor: '#E8F4FF' },
  genderEmoji:      { fontSize: 24, marginBottom: 4 },
  genderText:       { fontSize: 13, fontWeight: '600', color: '#555' },
  genderTextActive: { color: '#007AFF' },
  row:              { flexDirection: 'row', gap: 8, marginBottom: 0 },
  half:             { flex: 1 },
  inputWrapper:     { flexDirection: 'row', alignItems: 'center', borderWidth: 1, borderColor: '#DDD', borderRadius: 10, backgroundColor: '#FAFAFA', paddingHorizontal: 12, marginBottom: 10, height: 52 },
  inputInner:       { flex: 1, fontSize: 16 },
  unit:             { fontSize: 13, color: '#888', marginLeft: 4 },
  option:           { flexDirection: 'row', alignItems: 'center', padding: 12, borderRadius: 8, borderWidth: 2, borderColor: '#EEE', marginBottom: 6 },
  optionActive:     { borderColor: '#007AFF', backgroundColor: '#E8F4FF' },
  optionEmoji:      { fontSize: 18, marginRight: 10 },
  optionText:       { fontSize: 14, color: '#555' },
  optionTextActive: { color: '#007AFF', fontWeight: '600' },
  toneRow:          { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 8 },
  toneChip:         { flex: 1, minWidth: '44%', alignItems: 'center', paddingVertical: 12, paddingHorizontal: 8, borderRadius: 12, backgroundColor: '#F0F0F0', borderWidth: 2, borderColor: 'transparent' },
  toneChipActive:   { backgroundColor: '#007AFF', borderColor: '#007AFF' },
  toneEmoji:        { fontSize: 20, marginBottom: 4 },
  toneText:         { fontSize: 13, color: '#333', fontWeight: '600' },
  toneTextActive:   { color: '#FFF' },
  gymRow:           { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', backgroundColor: '#F8F8F8', borderRadius: 10, padding: 14, marginTop: 16, marginBottom: 4 },
  gymDesc:          { fontSize: 11, color: '#888', marginTop: 2, maxWidth: 240 },
  nextBtn:          { backgroundColor: '#007AFF', borderRadius: 12, padding: 16, alignItems: 'center', marginTop: 24, marginBottom: 16 },
  nextBtnText:      { color: '#FFF', fontSize: 16, fontWeight: 'bold' },
});
