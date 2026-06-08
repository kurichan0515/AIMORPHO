import React, { useState } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, StyleSheet,
  ScrollView, KeyboardAvoidingView, Platform, Alert,
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import api from '../api/client';

const LIFESTYLE_OPTIONS = [
  { value: 'sedentary',   label: 'ほぼ運動しない' },
  { value: 'light',       label: '軽い運動（週1〜2）' },
  { value: 'moderate',    label: '週3〜5回' },
  { value: 'active',      label: '毎日運動' },
  { value: 'very_active', label: 'ハードトレーニング' },
];

const AI_TONE_OPTIONS = [
  { value: 'friendly', label: 'フレンドリー 😊' },
  { value: 'strict',   label: '厳しめ 💪' },
  { value: 'gentle',   label: 'やさしい 🌸' },
  { value: 'cool',     label: 'クール 😎' },
];

export default function OnboardingProfileScreen() {
  const navigation = useNavigation<any>();
  const [form, setForm] = useState({
    displayName: '',
    age: '',
    heightCm: '',
    weightKg: '',
    lifestyle: 'moderate',
    aiTone: 'friendly',
  });
  const [loading, setLoading] = useState(false);

  const f = (key: keyof typeof form, val: string) => setForm(p => ({ ...p, [key]: val }));

  const next = async () => {
    if (!form.age || !form.heightCm || !form.weightKg) {
      Alert.alert('入力必須', '年齢・身長・体重を入力してください');
      return;
    }
    setLoading(true);
    try {
      await api.put('/users/me', {
        displayName: form.displayName || undefined,
        age: parseInt(form.age, 10),
        heightCm: parseFloat(form.heightCm),
        weightKg: parseFloat(form.weightKg),
        lifestyle: form.lifestyle,
        aiTone: form.aiTone,
      });
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
        <Text style={styles.subtitle}>TDEE計算に使います。あとで変更可能です。</Text>

        <TextInput
          style={styles.input}
          placeholder="ニックネーム（任意）"
          value={form.displayName}
          onChangeText={v => f('displayName', v)}
        />
        <View style={styles.row}>
          <TextInput
            style={[styles.input, styles.half]}
            placeholder="年齢 *"
            value={form.age}
            onChangeText={v => f('age', v)}
            keyboardType="number-pad"
          />
          <TextInput
            style={[styles.input, styles.half]}
            placeholder="身長 cm *"
            value={form.heightCm}
            onChangeText={v => f('heightCm', v)}
            keyboardType="decimal-pad"
          />
        </View>
        <TextInput
          style={styles.input}
          placeholder="現在の体重 kg *"
          value={form.weightKg}
          onChangeText={v => f('weightKg', v)}
          keyboardType="decimal-pad"
        />

        <Text style={styles.label}>活動レベル</Text>
        {LIFESTYLE_OPTIONS.map(o => (
          <TouchableOpacity
            key={o.value}
            style={[styles.option, form.lifestyle === o.value && styles.optionActive]}
            onPress={() => f('lifestyle', o.value)}
          >
            <Text style={[styles.optionText, form.lifestyle === o.value && styles.optionTextActive]}>
              {o.label}
            </Text>
          </TouchableOpacity>
        ))}

        <Text style={styles.label}>AIコーチの口調</Text>
        <View style={styles.toneRow}>
          {AI_TONE_OPTIONS.map(o => (
            <TouchableOpacity
              key={o.value}
              style={[styles.toneChip, form.aiTone === o.value && styles.toneChipActive]}
              onPress={() => f('aiTone', o.value)}
            >
              <Text style={[styles.toneText, form.aiTone === o.value && styles.toneTextActive]}>
                {o.label}
              </Text>
            </TouchableOpacity>
          ))}
        </View>

        <TouchableOpacity style={styles.nextBtn} onPress={next} disabled={loading}>
          <Text style={styles.nextBtnText}>{loading ? '保存中...' : '次へ →'}</Text>
        </TouchableOpacity>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container:       { flexGrow: 1, padding: 24, backgroundColor: '#FFF' },
  stepIndicator:   { flexDirection: 'row', justifyContent: 'center', gap: 8, marginBottom: 24, marginTop: 8 },
  dot:             { width: 8, height: 8, borderRadius: 4, backgroundColor: '#DDD' },
  dotActive:       { backgroundColor: '#007AFF' },
  title:           { fontSize: 24, fontWeight: 'bold', marginBottom: 6 },
  subtitle:        { fontSize: 13, color: '#888', marginBottom: 20 },
  input:           { borderWidth: 1, borderColor: '#DDD', borderRadius: 10, padding: 14, fontSize: 15, marginBottom: 10, backgroundColor: '#FAFAFA' },
  row:             { flexDirection: 'row', gap: 8 },
  half:            { flex: 1 },
  label:           { fontSize: 14, fontWeight: '600', color: '#333', marginTop: 12, marginBottom: 8 },
  option:          { padding: 12, borderRadius: 8, borderWidth: 2, borderColor: '#EEE', marginBottom: 6 },
  optionActive:    { borderColor: '#007AFF', backgroundColor: '#E8F4FF' },
  optionText:      { fontSize: 14, color: '#555' },
  optionTextActive:{ color: '#007AFF', fontWeight: '600' },
  toneRow:         { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 8 },
  toneChip:        { paddingHorizontal: 14, paddingVertical: 10, borderRadius: 20, backgroundColor: '#EEE' },
  toneChipActive:  { backgroundColor: '#007AFF' },
  toneText:        { fontSize: 13, color: '#333' },
  toneTextActive:  { color: '#FFF' },
  nextBtn:         { backgroundColor: '#007AFF', borderRadius: 12, padding: 16, alignItems: 'center', marginTop: 24 },
  nextBtnText:     { color: '#FFF', fontSize: 16, fontWeight: 'bold' },
});
