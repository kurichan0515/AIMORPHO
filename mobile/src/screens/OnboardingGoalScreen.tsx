import React, { useState, useEffect } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, StyleSheet,
  KeyboardAvoidingView, Platform, Alert, ScrollView,
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import api from '../api/client';
import { useOnboardingStore } from '../store/useOnboardingStore';

type GoalMode = 'diet' | 'maintain' | 'bulk';

const GOAL_OPTIONS: { value: GoalMode; label: string; emoji: string; desc: string }[] = [
  { value: 'diet',     label: '減量',    emoji: '🔥', desc: '体重・体脂肪を減らす' },
  { value: 'maintain', label: '体型維持', emoji: '⚖️', desc: '今の体型をキープ' },
  { value: 'bulk',     label: '増量',    emoji: '💪', desc: '筋肉・体重を増やす' },
];

export default function OnboardingGoalScreen() {
  const navigation = useNavigation<any>();
  const { heightCm, currentWeightKg } = useOnboardingStore();
  const [targetWeight, setTargetWeight] = useState('');
  const [targetBodyFatPct, setTargetBodyFatPct] = useState('');
  const [mode, setMode] = useState<GoalMode>('diet');
  const [loading, setLoading] = useState(false);

  const stdWeight    = heightCm ? Math.round(heightCm * heightCm * 22 / 10000 * 10) / 10 : null;
  const beautyWeight = heightCm ? Math.round(heightCm * heightCm * 20 / 10000 * 10) / 10 : null;

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
      Alert.alert('入力必須', '目標体重を入力してください');
      return;
    }
    const targetBF = targetBodyFatPct ? parseFloat(targetBodyFatPct) : undefined;
    setLoading(true);
    try {
      await api.post('/users/me/goal', { targetWeight: tw, targetBodyFatPct: targetBF, mode });
      navigation.navigate('OnboardingAvatar');
    } catch {
      Alert.alert('エラー', '設定に失敗しました');
    } finally {
      setLoading(false);
    }
  };

  const skip = () => navigation.navigate('OnboardingAvatar');

  return (
    <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <ScrollView contentContainerStyle={styles.container} keyboardShouldPersistTaps="handled">
        <View style={styles.stepIndicator}>
          <View style={styles.dot} />
          <View style={[styles.dot, styles.dotActive]} />
          <View style={styles.dot} />
        </View>

        <Text style={styles.title}>目標設定</Text>

        {(stdWeight || beautyWeight) && (
          <View style={styles.hintBox}>
            <Text style={styles.hintTitle}>📊 あなたの身長の目安体重</Text>
            <View style={styles.hintRow}>
              {stdWeight && (
                <View style={styles.hintItem}>
                  <Text style={styles.hintLabel}>標準体重</Text>
                  <Text style={styles.hintValue}>{stdWeight} kg</Text>
                </View>
              )}
              {beautyWeight && (
                <View style={styles.hintItem}>
                  <Text style={styles.hintLabel}>美容体重</Text>
                  <Text style={styles.hintValue}>{beautyWeight} kg</Text>
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
              style={[styles.goalBtn, mode === o.value && styles.goalBtnActive]}
              onPress={() => setMode(o.value)}
            >
              <Text style={styles.goalEmoji}>{o.emoji}</Text>
              <Text style={[styles.goalLabel, mode === o.value && styles.goalLabelActive]}>{o.label}</Text>
              <Text style={[styles.goalDesc, mode === o.value && styles.goalDescActive]}>{o.desc}</Text>
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
  );
}

const styles = StyleSheet.create({
  container:      { flexGrow: 1, padding: 24, backgroundColor: '#FFF' },
  stepIndicator:  { flexDirection: 'row', justifyContent: 'center', gap: 8, marginBottom: 24, marginTop: 8 },
  dot:            { width: 8, height: 8, borderRadius: 4, backgroundColor: '#DDD' },
  dotActive:      { backgroundColor: '#007AFF' },
  title:          { fontSize: 24, fontWeight: 'bold', marginBottom: 16 },
  hintBox:        { backgroundColor: '#F0F8FF', borderRadius: 12, padding: 14, marginBottom: 16, borderWidth: 1, borderColor: '#C8E6FA' },
  hintTitle:      { fontSize: 12, color: '#007AFF', fontWeight: '600', marginBottom: 8 },
  hintRow:        { flexDirection: 'row', gap: 12 },
  hintItem:       { flex: 1, alignItems: 'center' },
  hintLabel:      { fontSize: 11, color: '#888', marginBottom: 2 },
  hintValue:      { fontSize: 16, fontWeight: 'bold', color: '#333' },
  hintCurrent:    { color: '#007AFF' },
  label:          { fontSize: 14, fontWeight: '600', color: '#333', marginTop: 12, marginBottom: 8 },
  required:       { color: '#FF3B30' },
  optional:       { fontWeight: '400', color: '#999', fontSize: 12 },
  inputWrapper:   { flexDirection: 'row', alignItems: 'center', borderWidth: 1, borderColor: '#DDD', borderRadius: 10, backgroundColor: '#FAFAFA', paddingHorizontal: 16, height: 56 },
  inputInner:     { flex: 1, fontSize: 22, fontWeight: '600', textAlign: 'center' },
  unit:           { fontSize: 14, color: '#888', marginLeft: 4 },
  goalRow:        { flexDirection: 'row', gap: 8, marginBottom: 8 },
  goalBtn:        { flex: 1, alignItems: 'center', padding: 14, borderRadius: 12, backgroundColor: '#F5F5F5', borderWidth: 2, borderColor: 'transparent' },
  goalBtnActive:  { borderColor: '#007AFF', backgroundColor: '#E8F4FF' },
  goalEmoji:      { fontSize: 26, marginBottom: 4 },
  goalLabel:      { fontSize: 13, fontWeight: 'bold', color: '#333', marginBottom: 2 },
  goalLabelActive:{ color: '#007AFF' },
  goalDesc:       { fontSize: 10, color: '#888', textAlign: 'center' },
  goalDescActive: { color: '#007AFF' },
  nextBtn:        { backgroundColor: '#007AFF', borderRadius: 12, padding: 16, alignItems: 'center', marginTop: 24 },
  nextBtnText:    { color: '#FFF', fontSize: 16, fontWeight: 'bold' },
  skipBtn:        { alignItems: 'center', marginTop: 16, padding: 12 },
  skipText:       { color: '#999', fontSize: 14 },
});
