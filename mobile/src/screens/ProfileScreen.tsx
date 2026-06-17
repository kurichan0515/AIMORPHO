import React, { useState, useEffect } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, StyleSheet,
  ScrollView, Alert, Switch,
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import api from '../api/client';
import { useAuthStore } from '../store/useAuthStore';
import { colors } from '../theme/colors';

const LIFESTYLE_OPTIONS = [
  { value: 'sedentary',   label: 'ほぼ運動しない', sub: 'SEDENTARY', intensity: 1 },
  { value: 'light',       label: '軽い運動（週1〜2）', sub: 'LIGHT',     intensity: 2 },
  { value: 'moderate',    label: '週3〜5回',          sub: 'MODERATE',  intensity: 3 },
  { value: 'active',      label: '毎日運動',          sub: 'ACTIVE',    intensity: 4 },
  { value: 'very_active', label: 'ハードトレーニング', sub: 'INTENSE',  intensity: 5 },
];

const AI_TONE_OPTIONS = [
  { value: 'friendly', label: 'フレンドリー', sub: 'Friendly' },
  { value: 'strict',   label: '厳しめ',       sub: 'Strict'   },
  { value: 'gentle',   label: 'やさしい',     sub: 'Gentle'   },
  { value: 'cool',     label: 'クール',        sub: 'Cool'     },
];

const GOAL_MODES = [
  { value: 'diet',     label: '減量',    sub: 'CUT',      color: colors.neon.orange },
  { value: 'maintain', label: '体型維持', sub: 'MAINTAIN', color: colors.neon.blue   },
  { value: 'bulk',     label: '増量',    sub: 'BULK',     color: colors.neon.green  },
] as const;

// ─── セクション見出し ─────────────────────────────
function Section({ label, sub }: { label: string; sub: string }) {
  return (
    <View style={sec.row}>
      <View style={sec.bar} />
      <Text style={sec.sub}>{sub}</Text>
      <Text style={sec.label}>{label}</Text>
    </View>
  );
}
const sec = StyleSheet.create({
  row:   { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 28, marginBottom: 12 },
  bar:   { width: 3, height: 16, borderRadius: 2, backgroundColor: colors.neon.blue },
  sub:   { fontSize: 10, fontWeight: '700', letterSpacing: 1.5, color: colors.neon.blue },
  label: { fontSize: 15, fontWeight: '700', color: colors.text.primary },
});

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
  const [goalForm, setGoalForm] = useState({
    targetWeight: '', mode: 'maintain' as 'diet' | 'maintain' | 'bulk',
  });

  useEffect(() => {
    if (profile) setForm({
      displayName: profile.displayName || '',
      age:         String(profile.age     || ''),
      heightCm:    String(profile.heightCm || ''),
      weightKg:    String(profile.weightKg || ''),
      lifestyle:   profile.lifestyle || 'moderate',
      aiTone:      profile.aiTone    || 'friendly',
      hasGym:      profile.hasGym    ?? false,
    });
  }, [profile]);

  useEffect(() => {
    if (goal) setGoalForm({
      targetWeight: String(goal.targetWeight || ''),
      mode: goal.mode || 'maintain',
    });
  }, [goal]);

  const f = (key: keyof typeof form, val: string | boolean) =>
    setForm(p => ({ ...p, [key]: val }));

  const profileMutation = useMutation({
    mutationFn: () => api.put('/users/me', {
      displayName: form.displayName,
      age:         parseInt(form.age, 10)     || undefined,
      heightCm:    parseFloat(form.heightCm)  || undefined,
      weightKg:    parseFloat(form.weightKg)  || undefined,
      lifestyle:   form.lifestyle,
      aiTone:      form.aiTone,
      hasGym:      form.hasGym,
    }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['profile'] }); Alert.alert('保存しました'); },
    onError:   () => Alert.alert('エラー', '保存に失敗しました'),
  });

  const goalMutation = useMutation({
    mutationFn: () => api.post('/users/me/goal', {
      targetWeight: parseFloat(goalForm.targetWeight),
      mode: goalForm.mode,
    }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['goal'] }); Alert.alert('目標を設定しました'); },
    onError:   () => Alert.alert('エラー', '設定に失敗しました'),
  });

  const handleDeleteAccount = async () => {
    try {
      await api.delete('/users/me');
      qc.clear();
      logout();
    } catch {
      Alert.alert('エラー', '削除に失敗しました。しばらく経ってから再度お試しください。');
    }
  };

  const currentLifestyle = LIFESTYLE_OPTIONS.find(o => o.value === form.lifestyle);

  return (
    <ScrollView
      style={s.root}
      contentContainerStyle={s.container}
      keyboardShouldPersistTaps="handled"
      showsVerticalScrollIndicator={false}
    >
      {/* ─── ヘッダーカード ─────────────────── */}
      <View style={s.heroCard}>
        <View style={s.heroLeft}>
          <Text style={s.heroName}>{form.displayName || 'あなた'}</Text>
          <Text style={s.heroStats}>
            {form.heightCm ? `${form.heightCm} cm  ` : ''}
            {form.weightKg ? `${form.weightKg} kg` : ''}
          </Text>
        </View>
        <View style={s.streakBadge}>
          <Text style={s.streakNum}>{streak?.currentDays || 0}</Text>
          <Text style={s.streakUnit}>日</Text>
          <Text style={s.streakLabel}>継続</Text>
          {(streak?.longestDays ?? 0) > 0 && (
            <Text style={s.streakBest}>最高 {streak.longestDays}日</Text>
          )}
        </View>
      </View>

      {/* ─── 身体データ ─────────────────────── */}
      <Section label="身体データ" sub="BODY" />

      <View style={s.card}>
        <InputRow label="ニックネーム" value={form.displayName} onChange={v => f('displayName', v)} placeholder="例：たろう" />
        <View style={s.divider} />
        <View style={s.inlineRow}>
          <View style={{ flex: 1 }}>
            <InputRow label="年齢" value={form.age} onChange={v => f('age', v)} placeholder="25" keyboard="number-pad" unit="歳" compact />
          </View>
          <View style={s.inlineDivider} />
          <View style={{ flex: 1 }}>
            <InputRow label="身長" value={form.heightCm} onChange={v => f('heightCm', v)} placeholder="165.0" keyboard="decimal-pad" unit="cm" compact />
          </View>
          <View style={s.inlineDivider} />
          <View style={{ flex: 1 }}>
            <InputRow label="体重" value={form.weightKg} onChange={v => f('weightKg', v)} placeholder="60.0" keyboard="decimal-pad" unit="kg" compact />
          </View>
        </View>
      </View>

      {/* ─── トレーニング設定 ───────────────── */}
      <Section label="トレーニング" sub="TRAINING" />

      <View style={s.card}>
        {LIFESTYLE_OPTIONS.map((o, i) => (
          <React.Fragment key={o.value}>
            {i > 0 && <View style={s.divider} />}
            <TouchableOpacity
              style={s.listRow}
              onPress={() => f('lifestyle', o.value)}
            >
              <View style={s.intensityRow}>
                {[1,2,3,4,5].map(n => (
                  <View
                    key={n}
                    style={[
                      s.intensityDot,
                      n <= o.intensity && (form.lifestyle === o.value ? s.dotActive : s.dotFill),
                    ]}
                  />
                ))}
              </View>
              <Text style={[s.listLabel, form.lifestyle === o.value && s.listLabelActive]}>
                {o.label}
              </Text>
              {form.lifestyle === o.value && <View style={s.checkDot} />}
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
            value={form.hasGym}
            onValueChange={v => f('hasGym', v)}
            trackColor={{ false: colors.bg.cardAlt, true: colors.neon.blue }}
            thumbColor={colors.text.primary}
          />
        </View>
      </View>

      {/* ─── AIコーチ ───────────────────────── */}
      <Section label="AIコーチ" sub="AI COACH" />

      <View style={s.card}>
        <Text style={s.cardSub}>口調スタイル</Text>
        <View style={s.chipGrid}>
          {AI_TONE_OPTIONS.map(o => (
            <TouchableOpacity
              key={o.value}
              style={[s.chip, form.aiTone === o.value && s.chipActive]}
              onPress={() => f('aiTone', o.value)}
            >
              <Text style={[s.chipText, form.aiTone === o.value && s.chipTextActive]}>{o.label}</Text>
              <Text style={[s.chipSub,  form.aiTone === o.value && s.chipSubActive]}>{o.sub}</Text>
            </TouchableOpacity>
          ))}
        </View>
      </View>

      <TouchableOpacity
        style={[s.primaryBtn, s.cardMt]}
        onPress={() => profileMutation.mutate()}
        disabled={profileMutation.isPending}
      >
        <Text style={s.primaryBtnText}>{profileMutation.isPending ? '保存中...' : '設定を保存'}</Text>
      </TouchableOpacity>

      <TouchableOpacity style={[s.outlineBtn, { marginTop: 8 }]} onPress={() => navigation.navigate('AvatarSetup')}>
        <Text style={s.outlineBtnText}>アバター設定</Text>
      </TouchableOpacity>

      {/* ─── 目標 ───────────────────────────── */}
      <Section label="目標" sub="GOAL" />

      <View style={s.card}>
        <Text style={s.cardSub}>目標体重</Text>
        <View style={s.weightInput}>
          <TextInput
            style={s.weightValue}
            value={goalForm.targetWeight}
            onChangeText={v => setGoalForm(g => ({ ...g, targetWeight: v }))}
            placeholder="60.0"
            placeholderTextColor={colors.text.muted}
            keyboardType="decimal-pad"
          />
          <Text style={s.weightUnit}>kg</Text>
        </View>
        <Text style={[s.cardSub, { marginTop: 16 }]}>モード</Text>
        <View style={s.modeRow}>
          {GOAL_MODES.map(m => (
            <TouchableOpacity
              key={m.value}
              style={[s.modeBtn, goalForm.mode === m.value && { borderColor: m.color, backgroundColor: `${m.color}14` }]}
              onPress={() => setGoalForm(g => ({ ...g, mode: m.value }))}
            >
              <View style={[s.modeBar, { backgroundColor: m.color }]} />
              <Text style={[s.modeSub,   { color: m.color }]}>{m.sub}</Text>
              <Text style={[s.modeLabel, goalForm.mode === m.value && { color: m.color }]}>{m.label}</Text>
            </TouchableOpacity>
          ))}
        </View>
      </View>

      <TouchableOpacity
        style={[s.primaryBtn, s.cardMt]}
        onPress={() => goalMutation.mutate()}
        disabled={goalMutation.isPending}
      >
        <Text style={s.primaryBtnText}>{goalMutation.isPending ? '設定中...' : '目標を設定'}</Text>
      </TouchableOpacity>

      {/* ─── アカウント ─────────────────────── */}
      <Section label="アカウント" sub="ACCOUNT" />

      {isAnonymous ? (
        <View style={s.card}>
          <View style={s.accountTagRow}>
            <View style={[s.accountTag, { borderColor: colors.neon.orange }]}>
              <Text style={[s.accountTagText, { color: colors.neon.orange }]}>GUEST</Text>
            </View>
            <Text style={s.accountTagDesc}>ゲストモードで利用中</Text>
          </View>
          <Text style={s.accountDesc}>
            アカウント登録でデータをバックアップ。機種変更・再インストール時でも引き継げます。
          </Text>
          <TouchableOpacity style={[s.primaryBtn, { marginTop: 14 }]} onPress={() => navigation.navigate('Register')}>
            <Text style={s.primaryBtnText}>アカウント登録（無料）</Text>
          </TouchableOpacity>
          <TouchableOpacity style={[s.outlineBtn, { marginTop: 8 }]} onPress={() => navigation.navigate('Login')}>
            <Text style={s.outlineBtnText}>既存アカウントでログイン</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={s.dangerBtn}
            onPress={() => Alert.alert(
              'データをリセット',
              'すべての記録・アバター・目標が削除されます。この操作は取り消せません。',
              [
                { text: 'キャンセル', style: 'cancel' },
                { text: 'リセット',  style: 'destructive', onPress: () => { qc.clear(); resetGuestData(); } },
              ]
            )}
          >
            <Text style={s.dangerBtnText}>データをリセット</Text>
          </TouchableOpacity>
        </View>
      ) : (
        <View style={s.card}>
          <View style={s.accountTagRow}>
            <View style={[s.accountTag, { borderColor: colors.neon.green }]}>
              <Text style={[s.accountTagText, { color: colors.neon.green }]}>REGISTERED</Text>
            </View>
          </View>
          <Text style={s.accountEmail}>{profile?.email ?? ''}</Text>
          <TouchableOpacity
            style={[s.outlineBtn, { marginTop: 14, borderColor: colors.danger }]}
            onPress={() => Alert.alert(
              'ログアウト',
              'ログアウトすると次回起動時はゲストとして再スタートします。',
              [
                { text: 'キャンセル', style: 'cancel' },
                { text: 'ログアウト', style: 'destructive', onPress: () => { qc.clear(); logout(); } },
              ]
            )}
          >
            <Text style={[s.outlineBtnText, { color: colors.danger }]}>ログアウト</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={s.dangerBtn}
            onPress={() => Alert.alert(
              'アカウントを削除',
              'アカウントを削除すると、すべての記録・アバターが失われます。\nこの操作は取り消せません。',
              [
                { text: 'キャンセル', style: 'cancel' },
                { text: '削除する',  style: 'destructive', onPress: handleDeleteAccount },
              ]
            )}
          >
            <Text style={s.dangerBtnText}>アカウントを削除する</Text>
          </TouchableOpacity>
        </View>
      )}

      <View style={{ height: 48 }} />
    </ScrollView>
  );
}

// ─── インプット行コンポーネント ────────────────
interface InputRowProps {
  label: string; value: string; onChange: (v: string) => void;
  placeholder?: string; keyboard?: any; unit?: string; compact?: boolean;
}
function InputRow({ label, value, onChange, placeholder, keyboard, unit, compact }: InputRowProps) {
  return (
    <View style={ir.wrapper}>
      <Text style={ir.label}>{label}</Text>
      <View style={ir.inputRow}>
        <TextInput
          style={[ir.input, compact && ir.inputCompact]}
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
const ir = StyleSheet.create({
  wrapper:      { paddingVertical: 12, paddingHorizontal: 16 },
  label:        { fontSize: 11, color: colors.text.muted, fontWeight: '600', letterSpacing: 0.5, marginBottom: 6 },
  inputRow:     { flexDirection: 'row', alignItems: 'center' },
  input:        { flex: 1, fontSize: 16, color: colors.text.primary, fontWeight: '500' },
  inputCompact: { fontSize: 14 },
  unit:         { fontSize: 12, color: colors.text.secondary, marginLeft: 4 },
});

// ─── メインスタイル ────────────────────────────
const s = StyleSheet.create({
  root:           { flex: 1, backgroundColor: colors.bg.primary },
  container:      { padding: 16 },

  heroCard:       { flexDirection: 'row', alignItems: 'center', backgroundColor: colors.bg.card, borderRadius: 16, padding: 20, borderWidth: 1, borderColor: colors.border.subtle },
  heroLeft:       { flex: 1 },
  heroName:       { fontSize: 22, fontWeight: '800', color: colors.text.primary, marginBottom: 4 },
  heroStats:      { fontSize: 13, color: colors.text.muted },
  streakBadge:    { alignItems: 'center', backgroundColor: 'rgba(47,200,255,0.08)', borderRadius: 12, padding: 12, borderWidth: 1, borderColor: colors.border.blue, minWidth: 72 },
  streakNum:      { fontSize: 32, fontWeight: '800', color: colors.neon.blue, lineHeight: 38 },
  streakUnit:     { fontSize: 13, color: colors.neon.blue, fontWeight: '600' },
  streakLabel:    { fontSize: 10, color: colors.text.muted, letterSpacing: 0.5, marginTop: 2 },
  streakBest:     { fontSize: 10, color: colors.text.muted, marginTop: 2 },

  card:           { backgroundColor: colors.bg.card, borderRadius: 14, borderWidth: 1, borderColor: colors.border.subtle, overflow: 'hidden' },
  cardMt:         { marginTop: 12 },
  cardSub:        { fontSize: 11, color: colors.text.muted, fontWeight: '600', letterSpacing: 0.5, paddingHorizontal: 16, paddingTop: 14, paddingBottom: 6 },
  divider:        { height: 1, backgroundColor: colors.border.subtle, marginHorizontal: 16 },
  inlineRow:      { flexDirection: 'row' },
  inlineDivider:  { width: 1, backgroundColor: colors.border.subtle },

  listRow:        { flexDirection: 'row', alignItems: 'center', paddingVertical: 14, paddingHorizontal: 16, gap: 10 },
  intensityRow:   { flexDirection: 'row', gap: 3 },
  intensityDot:   { width: 5, height: 5, borderRadius: 3, backgroundColor: colors.bg.cardAlt },
  dotFill:        { backgroundColor: colors.text.muted },
  dotActive:      { backgroundColor: colors.neon.blue },
  listLabel:      { flex: 1, fontSize: 14, color: colors.text.secondary },
  listLabelActive:{ color: colors.text.primary, fontWeight: '600' },
  listSub:        { fontSize: 11, color: colors.text.muted, marginTop: 2 },
  checkDot:       { width: 8, height: 8, borderRadius: 4, backgroundColor: colors.neon.blue },

  chipGrid:       { flexDirection: 'row', flexWrap: 'wrap', gap: 8, padding: 14, paddingTop: 4 },
  chip:           { flex: 1, minWidth: '44%', alignItems: 'center', paddingVertical: 12, borderRadius: 10, backgroundColor: colors.bg.cardAlt, borderWidth: 1, borderColor: colors.border.subtle },
  chipActive:     { borderColor: colors.neon.blue, backgroundColor: 'rgba(47,200,255,0.1)' },
  chipText:       { fontSize: 13, fontWeight: '700', color: colors.text.secondary },
  chipTextActive: { color: colors.neon.blue },
  chipSub:        { fontSize: 10, color: colors.text.muted, marginTop: 2, letterSpacing: 0.5 },
  chipSubActive:  { color: 'rgba(47,200,255,0.6)' },

  weightInput:    { flexDirection: 'row', alignItems: 'baseline', paddingHorizontal: 16, paddingVertical: 8 },
  weightValue:    { fontSize: 36, fontWeight: '700', color: colors.text.primary, minWidth: 80 },
  weightUnit:     { fontSize: 18, color: colors.text.secondary, marginLeft: 6 },

  modeRow:        { flexDirection: 'row', gap: 8, padding: 14, paddingTop: 6 },
  modeBtn:        { flex: 1, alignItems: 'center', paddingVertical: 14, borderRadius: 10, backgroundColor: colors.bg.cardAlt, borderWidth: 1, borderColor: colors.border.subtle, overflow: 'hidden' },
  modeBar:        { width: 20, height: 3, borderRadius: 2, marginBottom: 6 },
  modeSub:        { fontSize: 9, fontWeight: '700', letterSpacing: 1, marginBottom: 2 },
  modeLabel:      { fontSize: 12, fontWeight: '700', color: colors.text.secondary },

  primaryBtn:     { backgroundColor: colors.neon.blue, borderRadius: 12, paddingVertical: 15, alignItems: 'center' },
  primaryBtnText: { color: colors.bg.primary, fontSize: 15, fontWeight: 'bold' },
  outlineBtn:     { borderWidth: 1, borderColor: colors.neon.blue, borderRadius: 12, paddingVertical: 14, alignItems: 'center' },
  outlineBtnText: { color: colors.neon.blue, fontSize: 14, fontWeight: '600' },
  dangerBtn:      { marginTop: 14, paddingVertical: 12, alignItems: 'center' },
  dangerBtnText:  { color: colors.danger, fontSize: 13 },

  accountTagRow:  { flexDirection: 'row', alignItems: 'center', gap: 10, padding: 16, paddingBottom: 8 },
  accountTag:     { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 4, borderWidth: 1 },
  accountTagText: { fontSize: 10, fontWeight: '800', letterSpacing: 1 },
  accountTagDesc: { fontSize: 13, color: colors.text.secondary },
  accountDesc:    { fontSize: 13, color: colors.text.muted, lineHeight: 20, paddingHorizontal: 16 },
  accountEmail:   { fontSize: 14, color: colors.text.secondary, paddingHorizontal: 16 },
});
