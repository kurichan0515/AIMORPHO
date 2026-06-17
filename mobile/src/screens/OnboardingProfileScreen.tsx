import React, { useState } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, StyleSheet,
  ScrollView, KeyboardAvoidingView, Platform, Alert, Switch,
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import api from '../api/client';
import { useOnboardingStore } from '../store/useOnboardingStore';
import { colors } from '../theme/colors';
import DrumPicker from '../components/ui/DrumPicker';

const AGE_VALUES     = Array.from({ length: 71 },  (_, i) => i + 10);  // 10-80
const HEIGHT_VALUES  = Array.from({ length: 81 },  (_, i) => i + 140); // 140-220
const WEIGHT_VALUES  = Array.from({ length: 121 }, (_, i) => i + 30);  // 30-150
const DECIMAL_VALUES = Array.from({ length: 10 },  (_, i) => i);        // 0-9

type Gender = 'male' | 'female' | 'other';

const GENDER_OPTIONS: { value: Gender; label: string; sub: string }[] = [
  { value: 'male',   label: '男性',   sub: 'Male' },
  { value: 'female', label: '女性',   sub: 'Female' },
  { value: 'other',  label: 'その他', sub: 'Other' },
];

const LIFESTYLE_OPTIONS: { value: string; label: string; intensity: number }[] = [
  { value: 'sedentary',   label: 'ほぼ運動しない',    intensity: 1 },
  { value: 'light',       label: '軽い運動（週1〜2）', intensity: 2 },
  { value: 'moderate',    label: '週3〜5回',           intensity: 3 },
  { value: 'active',      label: '毎日運動',           intensity: 4 },
  { value: 'very_active', label: 'ハードトレーニング', intensity: 5 },
];

const AI_TONE_OPTIONS: { value: string; label: string; sub: string }[] = [
  { value: 'friendly', label: 'フレンドリー', sub: 'Friendly' },
  { value: 'strict',   label: '厳しめ',       sub: 'Strict'   },
  { value: 'gentle',   label: 'やさしい',     sub: 'Gentle'   },
  { value: 'cool',     label: 'クール',        sub: 'Cool'     },
];

export default function OnboardingProfileScreen() {
  const navigation = useNavigation<any>();
  const { setProfile } = useOnboardingStore();
  const [form, setForm] = useState({
    displayName: '',
    gender: '' as Gender | '',
    age: '25',
    heightCmInt: '165',
    heightCmDec: '0',
    weightKgInt: '60',
    weightKgDec: '0',
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
    if (!form.age || !form.heightCmInt || !form.weightKgInt) {
      Alert.alert('入力必須', '年齢・身長・体重を入力してください');
      return;
    }
    const age = parseInt(form.age, 10);
    const heightCm = parseFloat(`${form.heightCmInt}.${form.heightCmDec}`);
    const weightKg = parseFloat(`${form.weightKgInt}.${form.weightKgDec}`);
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
    <KeyboardAvoidingView style={{ flex: 1, backgroundColor: colors.bg.primary }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
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
          placeholderTextColor={colors.text.muted}
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
              <Text style={[styles.genderText, form.gender === o.value && styles.genderTextActive]}>{o.label}</Text>
              <Text style={[styles.genderSub,  form.gender === o.value && styles.genderSubActive]}>{o.sub}</Text>
            </TouchableOpacity>
          ))}
        </View>

        <View style={styles.drumRow}>
          {/* 年齢 */}
          <DrumPicker
            label="年齢"
            unit="歳"
            values={AGE_VALUES}
            selectedValue={parseInt(form.age, 10) || 25}
            onChange={val => f('age', String(val))}
            width={64}
          />

          <View style={styles.drumDivider} />

          {/* 身長（整数 + 小数） */}
          <View style={styles.compoundPicker}>
            <Text style={styles.compoundLabel}>身長</Text>
            <View style={styles.compoundDrums}>
              <DrumPicker
                label="" unit=""
                values={HEIGHT_VALUES}
                selectedValue={parseInt(form.heightCmInt, 10) || 165}
                onChange={val => f('heightCmInt', String(val))}
                width={64}
              />
              <Text style={styles.decimalDot}>.</Text>
              <DrumPicker
                label="" unit=""
                values={DECIMAL_VALUES}
                selectedValue={parseInt(form.heightCmDec, 10) || 0}
                onChange={val => f('heightCmDec', String(val))}
                width={44}
              />
            </View>
            <Text style={styles.compoundUnit}>cm</Text>
          </View>

          <View style={styles.drumDivider} />

          {/* 体重（整数 + 小数） */}
          <View style={styles.compoundPicker}>
            <Text style={styles.compoundLabel}>体重</Text>
            <View style={styles.compoundDrums}>
              <DrumPicker
                label="" unit=""
                values={WEIGHT_VALUES}
                selectedValue={parseInt(form.weightKgInt, 10) || 60}
                onChange={val => f('weightKgInt', String(val))}
                width={64}
              />
              <Text style={styles.decimalDot}>.</Text>
              <DrumPicker
                label="" unit=""
                values={DECIMAL_VALUES}
                selectedValue={parseInt(form.weightKgDec, 10) || 0}
                onChange={val => f('weightKgDec', String(val))}
                width={44}
              />
            </View>
            <Text style={styles.compoundUnit}>kg</Text>
          </View>
        </View>

        <Text style={styles.label}>体脂肪率 <Text style={styles.optional}>（任意）</Text></Text>
        <View style={styles.inputWrapper}>
          <TextInput
            style={styles.inputInner}
            placeholder="例: 20"
            placeholderTextColor={colors.text.muted}
            value={form.bodyFatPct}
            onChangeText={v => f('bodyFatPct', v)}
            keyboardType="decimal-pad"
          />
          <Text style={styles.unit}>%</Text>
        </View>

        <Text style={styles.label}>活動レベル <Text style={styles.required}>*</Text></Text>
        {LIFESTYLE_OPTIONS.map(o => (
          <TouchableOpacity
            key={o.value}
            style={[styles.option, form.lifestyle === o.value && styles.optionActive]}
            onPress={() => f('lifestyle', o.value)}
          >
            <View style={styles.intensityBar}>
              {[1,2,3,4,5].map(n => (
                <View
                  key={n}
                  style={[
                    styles.intensityDot,
                    n <= o.intensity && (form.lifestyle === o.value ? styles.intensityDotOnActive : styles.intensityDotOn),
                  ]}
                />
              ))}
            </View>
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
              <Text style={[styles.toneText, form.aiTone === o.value && styles.toneTextActive]}>{o.label}</Text>
              <Text style={[styles.toneSub,  form.aiTone === o.value && styles.toneSubActive]}>{o.sub}</Text>
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
            trackColor={{ false: colors.bg.cardAlt, true: colors.neon.blue }}
            thumbColor={colors.text.primary}
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
  container:        { flexGrow: 1, padding: 24, backgroundColor: colors.bg.primary },
  stepIndicator:    { flexDirection: 'row', justifyContent: 'center', gap: 8, marginBottom: 24, marginTop: 8 },
  dot:              { width: 8, height: 8, borderRadius: 4, backgroundColor: colors.bg.cardAlt },
  dotActive:        { backgroundColor: colors.neon.blue },
  title:            { fontSize: 24, fontWeight: 'bold', marginBottom: 20, color: colors.text.primary },
  label:            { fontSize: 14, fontWeight: '600', color: colors.text.secondary, marginTop: 16, marginBottom: 8 },
  input:            { borderWidth: 1, borderColor: colors.border.subtle, borderRadius: 10, padding: 14, fontSize: 15, marginBottom: 10, backgroundColor: colors.bg.card, color: colors.text.primary },
  required:         { color: colors.danger },
  optional:         { fontWeight: '400', color: colors.text.muted, fontSize: 12 },
  genderRow:        { flexDirection: 'row', gap: 8, marginBottom: 4 },
  genderBtn:        { flex: 1, alignItems: 'center', paddingVertical: 14, paddingHorizontal: 8, borderRadius: 12, backgroundColor: colors.bg.card, borderWidth: 2, borderColor: colors.border.subtle },
  genderBtnActive:  { borderColor: colors.neon.blue, backgroundColor: 'rgba(47,200,255,0.1)' },
  genderText:       { fontSize: 14, fontWeight: '700', color: colors.text.secondary },
  genderTextActive: { color: colors.neon.blue },
  genderSub:        { fontSize: 10, color: colors.text.muted, marginTop: 2, letterSpacing: 0.5 },
  genderSubActive:  { color: 'rgba(47,200,255,0.6)' },
  row:              { flexDirection: 'row', gap: 8, marginBottom: 0 },
  half:             { flex: 1 },
  inputWrapper:     { flexDirection: 'row', alignItems: 'center', borderWidth: 1, borderColor: colors.border.subtle, borderRadius: 10, backgroundColor: colors.bg.card, paddingHorizontal: 12, marginBottom: 10, height: 52 },
  inputInner:       { flex: 1, fontSize: 16, color: colors.text.primary },
  unit:             { fontSize: 13, color: colors.text.secondary, marginLeft: 4 },
  option:             { flexDirection: 'row', alignItems: 'center', paddingVertical: 14, paddingHorizontal: 12, borderRadius: 8, borderWidth: 1, borderColor: colors.border.subtle, marginBottom: 6, backgroundColor: colors.bg.card },
  optionActive:       { borderColor: colors.neon.blue, backgroundColor: 'rgba(47,200,255,0.08)' },
  optionText:         { fontSize: 14, color: colors.text.secondary, flex: 1 },
  optionTextActive:   { color: colors.neon.blue, fontWeight: '600' },
  intensityBar:       { flexDirection: 'row', gap: 3, marginRight: 12 },
  intensityDot:       { width: 6, height: 6, borderRadius: 3, backgroundColor: colors.bg.cardAlt },
  intensityDotOn:     { backgroundColor: colors.text.muted },
  intensityDotOnActive: { backgroundColor: colors.neon.blue },
  toneRow:          { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 8 },
  toneChip:         { flex: 1, minWidth: '44%', alignItems: 'center', paddingVertical: 14, paddingHorizontal: 8, borderRadius: 12, backgroundColor: colors.bg.card, borderWidth: 1, borderColor: colors.border.subtle },
  toneChipActive:   { backgroundColor: 'rgba(47,200,255,0.12)', borderColor: colors.neon.blue },
  toneText:         { fontSize: 13, color: colors.text.secondary, fontWeight: '700' },
  toneTextActive:   { color: colors.neon.blue },
  toneSub:          { fontSize: 10, color: colors.text.muted, marginTop: 3, letterSpacing: 0.5 },
  toneSubActive:    { color: 'rgba(47,200,255,0.6)' },
  drumRow:          { flexDirection: 'row', justifyContent: 'space-around', alignItems: 'center', marginTop: 8, marginBottom: 16, backgroundColor: colors.bg.card, borderRadius: 12, paddingVertical: 12, paddingHorizontal: 4, borderWidth: 1, borderColor: colors.border.subtle },
  drumDivider:      { width: 1, alignSelf: 'stretch', backgroundColor: colors.border.subtle, marginVertical: 8 },
  compoundPicker:   { alignItems: 'center', gap: 4 },
  compoundLabel:    { fontSize: 11, color: colors.text.muted, letterSpacing: 0.5, fontWeight: '600' },
  compoundDrums:    { flexDirection: 'row', alignItems: 'center', gap: 2 },
  compoundUnit:     { fontSize: 11, color: colors.text.secondary, letterSpacing: 0.3 },
  decimalDot:       { fontSize: 22, fontWeight: '700', color: colors.text.secondary, marginBottom: 4, lineHeight: 28 },
  gymRow:           { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', backgroundColor: colors.bg.card, borderRadius: 10, padding: 14, marginTop: 16, marginBottom: 4, borderWidth: 1, borderColor: colors.border.subtle },
  gymDesc:          { fontSize: 11, color: colors.text.muted, marginTop: 2, maxWidth: 240 },
  nextBtn:          { backgroundColor: colors.neon.blue, borderRadius: 12, padding: 16, alignItems: 'center', marginTop: 24, marginBottom: 16 },
  nextBtnText:      { color: colors.bg.primary, fontSize: 16, fontWeight: 'bold' },
});
