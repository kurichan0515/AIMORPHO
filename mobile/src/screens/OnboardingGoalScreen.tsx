import React, { useState } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, StyleSheet,
  KeyboardAvoidingView, Platform, Alert, ScrollView,
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import api from '../api/client';

export default function OnboardingGoalScreen() {
  const navigation = useNavigation<any>();
  const [targetWeight, setTargetWeight] = useState('');
  const [mode, setMode] = useState<'diet' | 'maintain'>('diet');
  const [loading, setLoading] = useState(false);

  const next = async () => {
    const tw = parseFloat(targetWeight);
    if (!targetWeight || isNaN(tw) || tw <= 0) {
      Alert.alert('入力必須', '目標体重を入力してください');
      return;
    }
    setLoading(true);
    try {
      await api.post('/users/me/goal', { targetWeight: tw, mode });
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
        <Text style={styles.subtitle}>後から変更できます。</Text>

        <Text style={styles.label}>目標体重</Text>
        <TextInput
          style={styles.input}
          placeholder="例: 60.0"
          value={targetWeight}
          onChangeText={setTargetWeight}
          keyboardType="decimal-pad"
          autoFocus
        />

        <Text style={styles.label}>目標タイプ</Text>
        <View style={styles.modeRow}>
          {(['diet', 'maintain'] as const).map(m => (
            <TouchableOpacity
              key={m}
              style={[styles.modeBtn, mode === m && styles.modeBtnActive]}
              onPress={() => setMode(m)}
            >
              <Text style={styles.modeEmoji}>{m === 'diet' ? '🔥' : '⚖️'}</Text>
              <Text style={[styles.modeBtnText, mode === m && styles.modeBtnTextActive]}>
                {m === 'diet' ? 'ダイエット' : '体重維持'}
              </Text>
              <Text style={[styles.modeDesc, mode === m && styles.modeDescActive]}>
                {m === 'diet' ? '体重を減らす' : '現状を維持する'}
              </Text>
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
  container:       { flexGrow: 1, padding: 24, backgroundColor: '#FFF' },
  stepIndicator:   { flexDirection: 'row', justifyContent: 'center', gap: 8, marginBottom: 24, marginTop: 8 },
  dot:             { width: 8, height: 8, borderRadius: 4, backgroundColor: '#DDD' },
  dotActive:       { backgroundColor: '#007AFF' },
  title:           { fontSize: 24, fontWeight: 'bold', marginBottom: 6 },
  subtitle:        { fontSize: 13, color: '#888', marginBottom: 20 },
  label:           { fontSize: 14, fontWeight: '600', color: '#333', marginTop: 12, marginBottom: 8 },
  input:           { borderWidth: 1, borderColor: '#DDD', borderRadius: 10, padding: 14, fontSize: 20, marginBottom: 10, backgroundColor: '#FAFAFA', textAlign: 'center' },
  modeRow:         { flexDirection: 'row', gap: 12, marginBottom: 8 },
  modeBtn:         { flex: 1, padding: 16, borderRadius: 12, backgroundColor: '#F5F5F5', alignItems: 'center', borderWidth: 2, borderColor: 'transparent' },
  modeBtnActive:   { borderColor: '#007AFF', backgroundColor: '#E8F4FF' },
  modeEmoji:       { fontSize: 28, marginBottom: 6 },
  modeBtnText:     { fontSize: 15, fontWeight: 'bold', color: '#333' },
  modeBtnTextActive:{ color: '#007AFF' },
  modeDesc:        { fontSize: 11, color: '#888', marginTop: 4 },
  modeDescActive:  { color: '#007AFF' },
  nextBtn:         { backgroundColor: '#007AFF', borderRadius: 12, padding: 16, alignItems: 'center', marginTop: 24 },
  nextBtnText:     { color: '#FFF', fontSize: 16, fontWeight: 'bold' },
  skipBtn:         { alignItems: 'center', marginTop: 16, padding: 12 },
  skipText:        { color: '#999', fontSize: 14 },
});
