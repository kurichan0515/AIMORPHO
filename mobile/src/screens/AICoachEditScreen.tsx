import React, { useState, useEffect } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, ScrollView, Alert } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import api from '../api/client';
import { colors } from '../theme/colors';
import PremiumGateModal from '../components/PremiumGateModal';

const AI_TONE_OPTIONS = [
  { value: 'friendly', label: 'フレンドリー', sub: 'Friendly', free: true  },
  { value: 'strict',   label: '厳しめ',       sub: 'Strict',   free: false },
  { value: 'gentle',   label: 'やさしい',     sub: 'Gentle',   free: false },
  { value: 'cool',     label: 'クール',        sub: 'Cool',     free: false },
];

export default function AICoachEditScreen() {
  const navigation = useNavigation<any>();
  const qc = useQueryClient();
  const [premiumVisible, setPremiumVisible] = useState(false);

  const { data: profile } = useQuery({
    queryKey: ['profile'],
    queryFn: () => api.get('/users/me').then(r => r.data),
  });

  const isPremium = profile?.subscriptionTier === 'premium';
  const [aiTone, setAiTone] = useState('friendly');

  useEffect(() => {
    if (profile?.aiTone) setAiTone(profile.aiTone);
  }, [profile]);

  const mutation = useMutation({
    mutationFn: () => api.put('/users/me', { aiTone }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['profile'] }); navigation.goBack(); },
    onError: (err: any) => {
      if (err?.response?.status === 403) { setPremiumVisible(true); return; }
      Alert.alert('エラー', '保存に失敗しました');
    },
  });

  const handleSelect = (value: string, free: boolean) => {
    if (!free && !isPremium) { setPremiumVisible(true); return; }
    setAiTone(value);
  };

  return (
    <ScrollView style={s.root} contentContainerStyle={s.container} keyboardDismissMode="on-drag">
      <Text style={s.subtitle}>AIコーチの口調スタイルを選択</Text>
      <View style={s.chipGrid}>
        {AI_TONE_OPTIONS.map(o => {
          const locked = !o.free && !isPremium;
          return (
            <TouchableOpacity
              key={o.value}
              style={[s.chip, aiTone === o.value && s.chipActive, locked && s.chipLocked]}
              onPress={() => handleSelect(o.value, o.free)}
            >
              <Text style={[s.chipText, aiTone === o.value && s.chipTextActive, locked && s.chipTextLocked]}>{o.label}</Text>
              <Text style={[s.chipSub,  aiTone === o.value && s.chipSubActive,  locked && s.chipTextLocked]}>{o.sub}</Text>
              {locked && <Text style={s.lockIcon}>🔒</Text>}
            </TouchableOpacity>
          );
        })}
      </View>

      <TouchableOpacity
        style={[s.primaryBtn, mutation.isPending && s.primaryBtnDisabled]}
        onPress={() => mutation.mutate()}
        disabled={mutation.isPending}
        accessibilityLabel="AIコーチ設定を保存"
        accessibilityRole="button"
      >
        <Text style={s.primaryBtnText}>{mutation.isPending ? '保存中...' : '保存'}</Text>
      </TouchableOpacity>

      <PremiumGateModal
        visible={premiumVisible}
        onClose={() => setPremiumVisible(false)}
        title="プレミアム限定の口調スタイル"
        description="フレンドリー以外のAIコーチ口調は、プレミアムプランでご利用いただけます。"
      />
    </ScrollView>
  );
}

const s = StyleSheet.create({
  root:      { flex: 1, backgroundColor: colors.bg.primary },
  container: { padding: 16 },
  subtitle:  { fontSize: 13, color: colors.text.muted, marginBottom: 16 },

  chipGrid:      { flexDirection: 'row', flexWrap: 'wrap', gap: 10, marginBottom: 24 },
  chip:          { width: '47%', alignItems: 'center', paddingVertical: 20, borderRadius: 12, backgroundColor: colors.bg.card, borderWidth: 1, borderColor: colors.border.subtle },
  chipActive:    { borderColor: colors.neon.blue, backgroundColor: 'rgba(47,200,255,0.1)' },
  chipText:      { fontSize: 15, fontWeight: '700', color: colors.text.secondary },
  chipTextActive:{ color: colors.neon.blue },
  chipTextLocked:{ color: colors.text.muted },
  chipSub:       { fontSize: 11, color: colors.text.muted, marginTop: 4, letterSpacing: 0.5 },
  chipSubActive: { color: 'rgba(47,200,255,0.6)' },
  chipLocked:    { opacity: 0.5 },
  lockIcon:      { fontSize: 14, marginTop: 6 },

  primaryBtn:         { backgroundColor: colors.neon.blue, borderRadius: 12, paddingVertical: 15, alignItems: 'center', minHeight: 50, justifyContent: 'center' },
  primaryBtnDisabled: { opacity: 0.6 },
  primaryBtnText:     { color: colors.bg.primary, fontSize: 15, fontWeight: 'bold' },
});
