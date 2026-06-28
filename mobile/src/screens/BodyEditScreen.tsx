import React, { useState, useEffect } from 'react';
import { View, Text, TextInput, TouchableOpacity, StyleSheet, ScrollView, Alert } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import api from '../api/client';
import { colors } from '../theme/colors';

interface InputRowProps {
  label: string; value: string; onChange: (v: string) => void;
  placeholder?: string; keyboard?: any; unit?: string;
}
function InputRow({ label, value, onChange, placeholder, keyboard, unit }: InputRowProps) {
  return (
    <View style={ir.wrapper}>
      <Text style={ir.label}>{label}</Text>
      <View style={ir.inputRow}>
        <TextInput
          style={ir.input}
          value={value}
          onChangeText={onChange}
          placeholder={placeholder}
          placeholderTextColor={colors.text.muted}
          keyboardType={keyboard}
        />
        {unit && <Text style={ir.unit}>{unit}</Text>}
      </View>
    </View>
  );
}

export default function BodyEditScreen() {
  const navigation = useNavigation<any>();
  const qc = useQueryClient();

  const { data: profile } = useQuery({
    queryKey: ['profile'],
    queryFn: () => api.get('/users/me').then(r => r.data),
  });

  const [form, setForm] = useState({ displayName: '', age: '', heightCm: '', weightKg: '' });

  useEffect(() => {
    if (profile) setForm({
      displayName: profile.displayName || '',
      age:         String(profile.age      || ''),
      heightCm:    String(profile.heightCm || ''),
      weightKg:    String(profile.weightKg || ''),
    });
  }, [profile]);

  const f = (key: keyof typeof form, val: string) => setForm(p => ({ ...p, [key]: val }));

  const mutation = useMutation({
    mutationFn: () => api.put('/users/me', {
      displayName: form.displayName,
      age:      parseInt(form.age, 10)    || undefined,
      heightCm: parseFloat(form.heightCm) || undefined,
      weightKg: parseFloat(form.weightKg) || undefined,
    }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['profile'] }); navigation.goBack(); },
    onError:   () => Alert.alert('エラー', '保存に失敗しました'),
  });

  return (
    <ScrollView style={s.root} contentContainerStyle={s.container} keyboardShouldPersistTaps="handled">
      <View style={s.card}>
        <InputRow label="ニックネーム" value={form.displayName} onChange={v => f('displayName', v)} placeholder="例：たろう" />
        <View style={s.divider} />
        <InputRow label="年齢"  value={form.age}      onChange={v => f('age', v)}      placeholder="25"    keyboard="number-pad"  unit="歳" />
        <View style={s.divider} />
        <InputRow label="身長"  value={form.heightCm} onChange={v => f('heightCm', v)} placeholder="165.0" keyboard="decimal-pad" unit="cm" />
        <View style={s.divider} />
        <InputRow label="体重"  value={form.weightKg} onChange={v => f('weightKg', v)} placeholder="60.0"  keyboard="decimal-pad" unit="kg" />
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

const ir = StyleSheet.create({
  wrapper:  { paddingVertical: 12, paddingHorizontal: 16 },
  label:    { fontSize: 11, color: colors.text.muted, fontWeight: '600', letterSpacing: 0.5, marginBottom: 6 },
  inputRow: { flexDirection: 'row', alignItems: 'center' },
  input:    { flex: 1, fontSize: 16, color: colors.text.primary, fontWeight: '500' },
  unit:     { fontSize: 12, color: colors.text.secondary, marginLeft: 4 },
});

const s = StyleSheet.create({
  root:           { flex: 1, backgroundColor: colors.bg.primary },
  container:      { padding: 16 },
  card:           { backgroundColor: colors.bg.card, borderRadius: 14, borderWidth: 1, borderColor: colors.border.subtle, overflow: 'hidden' },
  divider:        { height: 1, backgroundColor: colors.border.subtle, marginHorizontal: 16 },
  primaryBtn:     { backgroundColor: colors.neon.blue, borderRadius: 12, paddingVertical: 15, alignItems: 'center' },
  primaryBtnText: { color: colors.bg.primary, fontSize: 15, fontWeight: 'bold' },
});
