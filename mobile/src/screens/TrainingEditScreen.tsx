import React, { useState, useEffect } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, ScrollView, Alert, Switch } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import api from '../api/client';
import { colors } from '../theme/colors';

const LIFESTYLE_OPTIONS = [
  { value: 'sedentary',   label: 'ほぼ運動しない',       sub: 'SEDENTARY', intensity: 1 },
  { value: 'light',       label: '軽い運動（週1〜2）',   sub: 'LIGHT',     intensity: 2 },
  { value: 'moderate',    label: '週3〜5回',              sub: 'MODERATE',  intensity: 3 },
  { value: 'active',      label: '毎日運動',              sub: 'ACTIVE',    intensity: 4 },
  { value: 'very_active', label: 'ハードトレーニング',    sub: 'INTENSE',   intensity: 5 },
];

export default function TrainingEditScreen() {
  const navigation = useNavigation<any>();
  const qc = useQueryClient();

  const { data: profile } = useQuery({
    queryKey: ['profile'],
    queryFn: () => api.get('/users/me').then(r => r.data),
  });

  const [lifestyle, setLifestyle] = useState('moderate');
  const [hasGym, setHasGym] = useState(false);

  useEffect(() => {
    if (profile) {
      setLifestyle(profile.lifestyle || 'moderate');
      setHasGym(profile.hasGym ?? false);
    }
  }, [profile]);

  const mutation = useMutation({
    mutationFn: () => api.put('/users/me', { lifestyle, hasGym }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['profile'] }); navigation.goBack(); },
    onError:   () => Alert.alert('エラー', '保存に失敗しました'),
  });

  return (
    <ScrollView style={s.root} contentContainerStyle={s.container}>
      <View style={s.card}>
        {LIFESTYLE_OPTIONS.map((o, i) => (
          <React.Fragment key={o.value}>
            {i > 0 && <View style={s.divider} />}
            <TouchableOpacity style={s.listRow} onPress={() => setLifestyle(o.value)}>
              <View style={s.intensityRow}>
                {[1,2,3,4,5].map(n => (
                  <View
                    key={n}
                    style={[
                      s.intensityDot,
                      n <= o.intensity && (lifestyle === o.value ? s.dotActive : s.dotFill),
                    ]}
                  />
                ))}
              </View>
              <Text style={[s.listLabel, lifestyle === o.value && s.listLabelActive]}>
                {o.label}
              </Text>
              {lifestyle === o.value && <View style={s.checkDot} />}
            </TouchableOpacity>
          </React.Fragment>
        ))}
        <View style={s.divider} />
        <View style={s.listRow}>
          <View style={{ flex: 1 }}>
            <Text style={s.listLabel}>ジムに通っている</Text>
            <Text style={s.listSub}>ウェイトメニューを運動提案に含めます</Text>
          </View>
          <Switch
            value={hasGym}
            onValueChange={setHasGym}
            trackColor={{ false: colors.bg.cardAlt, true: colors.neon.blue }}
            thumbColor={colors.text.primary}
          />
        </View>
      </View>

      <TouchableOpacity
        style={[s.primaryBtn, { marginTop: 24 }]}
        onPress={() => mutation.mutate()}
        disabled={mutation.isPending}
      >
        <Text style={s.primaryBtnText}>{mutation.isPending ? '保存中...' : '保存'}</Text>
      </TouchableOpacity>
    </ScrollView>
  );
}

const s = StyleSheet.create({
  root:      { flex: 1, backgroundColor: colors.bg.primary },
  container: { padding: 16 },
  card:      { backgroundColor: colors.bg.card, borderRadius: 14, borderWidth: 1, borderColor: colors.border.subtle, overflow: 'hidden' },
  divider:   { height: 1, backgroundColor: colors.border.subtle, marginHorizontal: 16 },

  listRow:         { flexDirection: 'row', alignItems: 'center', paddingVertical: 14, paddingHorizontal: 16, gap: 10 },
  intensityRow:    { flexDirection: 'row', gap: 3 },
  intensityDot:    { width: 5, height: 5, borderRadius: 3, backgroundColor: colors.bg.cardAlt },
  dotFill:         { backgroundColor: colors.text.muted },
  dotActive:       { backgroundColor: colors.neon.blue },
  listLabel:       { flex: 1, fontSize: 14, color: colors.text.secondary },
  listLabelActive: { color: colors.text.primary, fontWeight: '600' },
  listSub:         { fontSize: 11, color: colors.text.muted, marginTop: 2 },
  checkDot:        { width: 8, height: 8, borderRadius: 4, backgroundColor: colors.neon.blue },

  primaryBtn:     { backgroundColor: colors.neon.blue, borderRadius: 12, paddingVertical: 15, alignItems: 'center' },
  primaryBtnText: { color: colors.bg.primary, fontSize: 15, fontWeight: 'bold' },
});
