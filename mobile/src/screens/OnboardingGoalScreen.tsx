import React, { useState, useEffect } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, StyleSheet,
  KeyboardAvoidingView, Platform, ScrollView,
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import api from '../api/client';
import { useOnboardingStore } from '../store/useOnboardingStore';
import { colors } from '../theme/colors';
import Toast from '../components/Toast';
import { useToast } from '../hooks/useToast';

type GoalMode = 'diet' | 'maintain' | 'bulk';

const GOAL_OPTIONS: { value: GoalMode; label: string; sub: string; desc: string; accent: string }[] = [
  { value: 'diet',     label: '減量',    sub: 'CUT',      desc: '体重・体脂肪を減らす', accent: '#FF8033' },
  { value: 'maintain', label: '体型維持', sub: 'MAINTAIN', desc: '今の体型をキープ',     accent: '#2FC8FF' },
  { value: 'bulk',     label: '増量',    sub: 'BULK',     desc: '筋肉・体重を増やす',   accent: '#4ADE80' },
];

export default function OnboardingGoalScreen() {
  const navigation = useNavigation<any>();
  const { heightCm, currentWeightKg } = useOnboardingStore();
  const [targetWeight, setTargetWeight] = useState('');
  const [targetBodyFatPct, setTargetBodyFatPct] = useState('');
  const [mode, setMode] = useState<GoalMode>('maintain');
  const [loading, setLoading] = useState(false);
  const { toastVisible, toastMessage, showToast, hideToast } = useToast();

  const stdWeight    = heightCm ? Math.round(heightCm * heightCm * 22 / 10000 * 10) / 10 : null;
  const athleteWeight = heightCm ? Math.round(heightCm * heightCm * 24 / 10000 * 10) / 10 : null;

  useEffect(() => {
    const tw = parseFloat(targetWeight);
    if (!currentWeightKg || isNaN(tw) || tw <= 0) return;
    if (tw > currentWeightKg + 0.5) setMode('bulk');
    else if (Math.abs(tw - currentWeightKg) <= 0.5) setMode('maintain');
    else setMode('diet');
  }, [targetWeight, currentWeightKg]);

  const next = async () => {
    const tw = parseFloat(targetWeight);
    if (!targetWeight || isNaN(tw) || tw <= 0) {
      showToast('目標体重を入力してください');
      return;
    }
    const targetBF = targetBodyFatPct ? parseFloat(targetBodyFatPct) : undefined;
    setLoading(true);
    try {
      await api.post('/users/me/goal', { targetWeight: tw, targetBodyFatPct: targetBF, mode });
      navigation.navigate('OnboardingAvatar');
    } catch {
      showToast('設定に失敗しました');
    } finally {
      setLoading(false);
    }
  };

  const skip = () => navigation.navigate('OnboardingAvatar');

  return (
    <View style={{ flex: 1 }}>
    <KeyboardAvoidingView style={{ flex: 1, backgroundColor: colors.bg.primary }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <ScrollView contentContainerStyle={styles.container} keyboardShouldPersistTaps="handled">
        <View style={styles.stepIndicator}>
          <View style={styles.dot} />
          <View style={[styles.dot, styles.dotActive]} />
          <View style={styles.dot} />
        </View>

        <Text style={styles.title}>目標設定</Text>

        {(stdWeight || athleteWeight) && (
          <View style={styles.hintBox}>
            <Text style={styles.hintTitle}>📊 あなたの身長の目安体重</Text>
            <View style={styles.hintRow}>
              {stdWeight && (
                <View style={styles.hintItem}>
                  <Text style={styles.hintLabel}>標準 (BMI 22)</Text>
                  <Text style={styles.hintValue}>{stdWeight} kg</Text>
                </View>
              )}
              {athleteWeight && (
                <View style={styles.hintItem}>
                  <Text style={styles.hintLabel}>アスリート (BMI 24)</Text>
                  <Text style={styles.hintValue}>{athleteWeight} kg</Text>
                </View>
              )}
              {currentWeightKg && (
                <View style={styles.hintItem}>
                  <Text style={styles.hintLabel}>現在</Text>
                  <Text style={[styles.hintValue, styles.hintCurrent]}>{currentWeightKg} kg</Text>
                </View>
              )}
            </View>
          </View>
        )}

        <Text style={styles.label}>目標体重 <Text style={styles.required}>*</Text></Text>
        <View style={styles.inputWrapper}>
          <TextInput
            style={styles.inputInner}
            placeholder="例: 60.0"
            placeholderTextColor={colors.text.muted}
            value={targetWeight}
            onChangeText={setTargetWeight}
            keyboardType="decimal-pad"
            autoFocus
          />
          <Text style={styles.unit}>kg</Text>
        </View>

        <Text style={styles.label}>目標体脂肪率 <Text style={styles.optional}>（任意）</Text></Text>
        <View style={styles.inputWrapper}>
          <TextInput
            style={styles.inputInner}
            placeholder="例: 20.0"
            placeholderTextColor={colors.text.muted}
            value={targetBodyFatPct}
            onChangeText={setTargetBodyFatPct}
            keyboardType="decimal-pad"
          />
          <Text style={styles.unit}>%</Text>
        </View>

        <Text style={styles.label}>目標タイプ</Text>
        <View style={styles.goalRow}>
          {GOAL_OPTIONS.map(o => (
            <TouchableOpacity
              key={o.value}
              style={[styles.goalBtn, mode === o.value && { borderColor: o.accent, backgroundColor: `${o.accent}18` }]}
              onPress={() => setMode(o.value)}
            >
              <View style={[styles.goalAccentBar, { backgroundColor: o.accent }]} />
              <Text style={[styles.goalSub, { color: o.accent }]}>{o.sub}</Text>
              <Text style={[styles.goalLabel, mode === o.value && { color: o.accent }]}>{o.label}</Text>
              <Text style={styles.goalDesc}>{o.desc}</Text>
            </TouchableOpacity>
          ))}
        </View>

        <TouchableOpacity style={styles.nextBtn} onPress={next} disabled={loading}>
          <Text style={styles.nextBtnText}>{loading ? '設定中...' : '次へ →'}</Text>
        </TouchableOpacity>

        <TouchableOpacity style={styles.skipBtn} onPress={skip}>
          <Text style={styles.skipText}>スキップ（後で設定）</Text>
        </TouchableOpacity>
      </ScrollView>
    </KeyboardAvoidingView>
    <Toast visible={toastVisible} message={toastMessage} onHide={hideToast} type={toastMessage.includes('失敗') || toastMessage.includes('入力') ? 'error' : 'success'} />
    </View>
  );
}

const styles = StyleSheet.create({
  container:      { flexGrow: 1, padding: 24, backgroundColor: colors.bg.primary },
  stepIndicator:  { flexDirection: 'row', justifyContent: 'center', gap: 8, marginBottom: 24, marginTop: 8 },
  dot:            { width: 8, height: 8, borderRadius: 4, backgroundColor: colors.bg.cardAlt },
  dotActive:      { backgroundColor: colors.neon.blue },
  title:          { fontSize: 24, fontWeight: 'bold', marginBottom: 16, color: colors.text.primary },
  hintBox:        { backgroundColor: colors.bg.card, borderRadius: 12, padding: 14, marginBottom: 16, borderWidth: 1, borderColor: colors.border.blue },
  hintTitle:      { fontSize: 12, color: colors.neon.blue, fontWeight: '600', marginBottom: 8 },
  hintRow:        { flexDirection: 'row', gap: 12 },
  hintItem:       { flex: 1, alignItems: 'center' },
  hintLabel:      { fontSize: 11, color: colors.text.muted, marginBottom: 2 },
  hintValue:      { fontSize: 16, fontWeight: 'bold', color: colors.text.primary },
  hintCurrent:    { color: colors.neon.blue },
  label:          { fontSize: 14, fontWeight: '600', color: colors.text.secondary, marginTop: 12, marginBottom: 8 },
  required:       { color: colors.danger },
  optional:       { fontWeight: '400', color: colors.text.muted, fontSize: 12 },
  inputWrapper:   { flexDirection: 'row', alignItems: 'center', borderWidth: 1, borderColor: colors.border.subtle, borderRadius: 10, backgroundColor: colors.bg.card, paddingHorizontal: 16, height: 56 },
  inputInner:     { flex: 1, fontSize: 22, fontWeight: '600', textAlign: 'center', color: colors.text.primary },
  unit:           { fontSize: 14, color: colors.text.secondary, marginLeft: 4 },
  goalRow:        { flexDirection: 'row', gap: 8, marginBottom: 8 },
  goalBtn:        { flex: 1, alignItems: 'center', paddingVertical: 16, paddingHorizontal: 6, borderRadius: 12, backgroundColor: colors.bg.card, borderWidth: 1, borderColor: colors.border.subtle, overflow: 'hidden' },
  goalAccentBar:  { width: 24, height: 3, borderRadius: 2, marginBottom: 8 },
  goalSub:        { fontSize: 9, fontWeight: '700', letterSpacing: 1, marginBottom: 4 },
  goalLabel:      { fontSize: 13, fontWeight: '700', color: colors.text.primary, marginBottom: 4 },
  goalDesc:       { fontSize: 9, color: colors.text.muted, textAlign: 'center', lineHeight: 13 },
  nextBtn:        { backgroundColor: colors.neon.blue, borderRadius: 12, padding: 16, alignItems: 'center', marginTop: 24 },
  nextBtnText:    { color: colors.bg.primary, fontSize: 16, fontWeight: 'bold' },
  skipBtn:        { alignItems: 'center', marginTop: 16, padding: 12 },
  skipText:       { color: colors.text.muted, fontSize: 14 },
});
