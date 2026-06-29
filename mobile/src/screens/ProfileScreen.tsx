import React, { useState, useCallback } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, ScrollView, Alert, RefreshControl } from 'react-native';
// eslint-disable-next-line @typescript-eslint/no-var-requires
const APP_VERSION: string = require('../../package.json').version;
import { useNavigation } from '@react-navigation/native';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import api from '../api/client';
import { useAuthStore } from '../store/useAuthStore';
import { colors } from '../theme/colors';
import { useIAP } from '../hooks/useIAP';

const LIFESTYLE_LABELS: Record<string, string> = {
  sedentary:  'ほぼ運動しない',
  light:      '週1〜2回',
  moderate:   '週3〜5回',
  active:     '毎日運動',
  very_active:'ハードトレーニング',
};

const AI_TONE_LABELS: Record<string, string> = {
  friendly: 'フレンドリー',
  strict:   '厳しめ',
  gentle:   'やさしい',
  cool:     'クール',
};

const GOAL_MODE_LABELS: Record<string, string> = {
  diet:     '減量',
  maintain: '体型維持',
  bulk:     '増量',
};

function Section({ label, sub }: { label: string; sub: string }) {
  return (
    <View style={sec.row}>
      <View style={sec.bar} />
      <Text style={sec.sub}>{sub}</Text>
      <Text style={sec.label}>{label}</Text>
    </View>
  );
}

function MenuRow({ label, value, onPress }: { label: string; value?: string; onPress: () => void }) {
  return (
    <TouchableOpacity style={m.row} onPress={onPress}>
      <Text style={m.label}>{label}</Text>
      <View style={m.right}>
        {value ? <Text style={m.value}>{value}</Text> : null}
        <Text style={m.arrow}>›</Text>
      </View>
    </TouchableOpacity>
  );
}

export default function ProfileScreen() {
  const { logout, isAnonymous, resetGuestData } = useAuthStore();
  const navigation = useNavigation<any>();
  const qc = useQueryClient();
  const { purchase } = useIAP();
  const [refreshing, setRefreshing] = useState(false);

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
  const { data: badges } = useQuery({
    queryKey: ['badges'],
    queryFn: () => api.get('/users/me/badges').then(r => r.data as any[]),
  });

  const heightCm = profile?.heightCm;
  const weightKg = profile?.weightKg;
  const bodyValue = [heightCm && `${heightCm}cm`, weightKg && `${weightKg}kg`].filter(Boolean).join(' · ') || undefined;
  const lifestyleValue = profile?.lifestyle ? LIFESTYLE_LABELS[profile.lifestyle] : undefined;
  const aiToneValue = profile?.aiTone ? AI_TONE_LABELS[profile.aiTone] : undefined;
  const goalValue = goal?.mode ? GOAL_MODE_LABELS[goal.mode] : undefined;
  const earnedCount = badges?.length ?? 0;

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await Promise.all([
      qc.invalidateQueries({ queryKey: ['profile'] }),
      qc.invalidateQueries({ queryKey: ['streak'] }),
      qc.invalidateQueries({ queryKey: ['badges'] }),
    ]);
    setRefreshing(false);
  }, [qc]);

  const toggleNotifications = async (enabled: boolean) => {
    try {
      await api.put('/users/me', { notificationsEnabled: enabled });
      qc.invalidateQueries({ queryKey: ['profile'] });
    } catch {
      Alert.alert('エラー', '設定の保存に失敗しました');
    }
  };

  const handleDeleteAccount = async () => {
    try {
      await api.delete('/users/me');
      qc.clear();
      logout();
    } catch {
      Alert.alert('エラー', '削除に失敗しました。しばらく経ってから再度お試しください。');
    }
  };

  return (
    <ScrollView
      style={s.root}
      contentContainerStyle={s.container}
      showsVerticalScrollIndicator={false}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.neon.blue} />}
    >
      <View style={s.heroCard}>
        <View style={s.heroLeft}>
          <Text style={s.heroName}>{profile?.displayName || 'あなた'}</Text>
          <Text style={s.heroStats}>{bodyValue || '身体データ未設定'}</Text>
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

      <Section label="身体データ" sub="BODY" />
      <View style={s.card}>
        <MenuRow label="身体データ" value={bodyValue} onPress={() => navigation.navigate('BodyEdit')} />
      </View>

      <Section label="トレーニング" sub="TRAINING" />
      <View style={s.card}>
        <MenuRow label="トレーニング設定" value={lifestyleValue} onPress={() => navigation.navigate('TrainingEdit')} />
      </View>

      <Section label="AIコーチ" sub="AI COACH" />
      <View style={s.card}>
        <MenuRow label="口調スタイル" value={aiToneValue} onPress={() => navigation.navigate('AICoachEdit')} />
      </View>

      <Section label="目標" sub="GOAL" />
      <View style={s.card}>
        <MenuRow label="目標設定" value={goalValue} onPress={() => navigation.navigate('GoalEdit')} />
      </View>

      <Section label="その他" sub="OTHER" />
      <View style={s.card}>
        <MenuRow label="アバター設定" onPress={() => navigation.navigate('AvatarSetup')} />
        <View style={s.divider} />
        <MenuRow
          label="リワード"
          value={earnedCount > 0 ? `${earnedCount}件取得済み` : '未獲得'}
          onPress={() => navigation.navigate('Rewards')}
        />
      </View>

      <Section label="通知・アプリ" sub="SETTINGS" />
      <View style={s.card}>
        <View style={m.row}>
          <Text style={m.label}>リマインダー通知</Text>
          <View style={s.toggleGroup}>
            <TouchableOpacity
              style={[s.toggleBtn, profile?.notificationsEnabled !== false && s.toggleBtnOn]}
              onPress={() => toggleNotifications(true)}
            >
              <Text style={[s.toggleText, profile?.notificationsEnabled !== false && s.toggleTextOn]}>ON</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[s.toggleBtn, profile?.notificationsEnabled === false && s.toggleBtnOff]}
              onPress={() => toggleNotifications(false)}
            >
              <Text style={[s.toggleText, profile?.notificationsEnabled === false && s.toggleTextOff]}>OFF</Text>
            </TouchableOpacity>
          </View>
        </View>
        <View style={s.divider} />
        <View style={[m.row, { paddingVertical: 14 }]}>
          <Text style={m.label}>バージョン</Text>
          <Text style={m.value}>v{APP_VERSION}</Text>
        </View>
      </View>

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
          <TouchableOpacity style={[s.primaryBtn, { margin: 16, marginTop: 14 }]} onPress={() => navigation.navigate('Register')}>
            <Text style={s.primaryBtnText}>アカウント登録（無料）</Text>
          </TouchableOpacity>
          <TouchableOpacity style={[s.outlineBtn, { margin: 16, marginTop: 0 }]} onPress={() => navigation.navigate('Login')}>
            <Text style={s.outlineBtnText}>既存アカウントでログイン</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={s.dangerBtn}
            onPress={() => Alert.alert(
              'データをリセット',
              'すべての記録・アバター・目標が削除されます。この操作は取り消せません。',
              [
                { text: 'キャンセル', style: 'cancel' },
                { text: 'リセット', style: 'destructive', onPress: () => { qc.clear(); resetGuestData(); } },
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
            {profile?.subscriptionTier === 'premium' ? (
              <View style={[s.accountTag, { borderColor: colors.neon.yellow }]}>
                <Text style={[s.accountTagText, { color: colors.neon.yellow }]}>👑 PREMIUM</Text>
              </View>
            ) : (
              <View style={[s.accountTag, { borderColor: colors.text.muted }]}>
                <Text style={[s.accountTagText, { color: colors.text.muted }]}>FREE</Text>
              </View>
            )}
          </View>
          <Text style={s.accountEmail}>{profile?.email ?? ''}</Text>
          {profile?.subscriptionTier === 'premium' && profile?.subscriptionExpiresAt && (
            <Text style={s.expiryText}>
              プレミアム期限: {new Date(profile.subscriptionExpiresAt).toLocaleDateString('ja-JP')}
            </Text>
          )}
          {profile?.subscriptionTier !== 'premium' && (
            <TouchableOpacity
              style={[s.primaryBtn, { margin: 16, marginTop: 12, backgroundColor: colors.neon.yellow }]}
              onPress={purchase}
            >
              <Text style={[s.primaryBtnText, { color: '#000' }]}>👑 プレミアムにアップグレード</Text>
            </TouchableOpacity>
          )}
          <TouchableOpacity
            style={[s.outlineBtn, { margin: 16, marginTop: 14, borderColor: colors.danger }]}
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
                { text: '削除する', style: 'destructive', onPress: handleDeleteAccount },
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

const sec = StyleSheet.create({
  row:   { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 28, marginBottom: 12 },
  bar:   { width: 3, height: 16, borderRadius: 2, backgroundColor: colors.neon.blue },
  sub:   { fontSize: 10, fontWeight: '700', letterSpacing: 1.5, color: colors.neon.blue },
  label: { fontSize: 15, fontWeight: '700', color: colors.text.primary },
});

const m = StyleSheet.create({
  row:   { flexDirection: 'row', alignItems: 'center', paddingVertical: 16, paddingHorizontal: 16 },
  label: { flex: 1, fontSize: 15, color: colors.text.primary, fontWeight: '500' },
  right: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  value: { fontSize: 14, color: colors.text.muted },
  arrow: { fontSize: 20, color: colors.text.muted, fontWeight: '300', lineHeight: 24 },
});

const s = StyleSheet.create({
  root:      { flex: 1, backgroundColor: colors.bg.primary },
  container: { padding: 16 },

  heroCard:    { flexDirection: 'row', alignItems: 'center', backgroundColor: colors.bg.card, borderRadius: 16, padding: 20, borderWidth: 1, borderColor: colors.border.subtle },
  heroLeft:    { flex: 1 },
  heroName:    { fontSize: 22, fontWeight: '800', color: colors.text.primary, marginBottom: 4 },
  heroStats:   { fontSize: 13, color: colors.text.muted },
  streakBadge: { alignItems: 'center', backgroundColor: 'rgba(47,200,255,0.08)', borderRadius: 12, padding: 12, borderWidth: 1, borderColor: colors.border.blue, minWidth: 72 },
  streakNum:   { fontSize: 32, fontWeight: '800', color: colors.neon.blue, lineHeight: 38 },
  streakUnit:  { fontSize: 13, color: colors.neon.blue, fontWeight: '600' },
  streakLabel: { fontSize: 10, color: colors.text.muted, letterSpacing: 0.5, marginTop: 2 },
  streakBest:  { fontSize: 10, color: colors.text.muted, marginTop: 2 },

  card:    { backgroundColor: colors.bg.card, borderRadius: 14, borderWidth: 1, borderColor: colors.border.subtle, overflow: 'hidden' },
  divider: { height: 1, backgroundColor: colors.border.subtle, marginHorizontal: 16 },

  primaryBtn:     { backgroundColor: colors.neon.blue, borderRadius: 12, paddingVertical: 15, alignItems: 'center', minHeight: 50, justifyContent: 'center' },
  primaryBtnText: { color: colors.bg.primary, fontSize: 15, fontWeight: 'bold' },
  outlineBtn:     { borderWidth: 1, borderColor: colors.neon.blue, borderRadius: 12, paddingVertical: 14, alignItems: 'center' },
  outlineBtnText: { color: colors.neon.blue, fontSize: 14, fontWeight: '600' },
  dangerBtn:      { paddingVertical: 12, paddingHorizontal: 16, alignItems: 'center', marginBottom: 8 },
  dangerBtnText:  { color: colors.danger, fontSize: 13 },

  toggleGroup:    { flexDirection: 'row', gap: 6 },
  toggleBtn:      { paddingHorizontal: 14, paddingVertical: 7, borderRadius: 20, borderWidth: 1, borderColor: colors.border.subtle, backgroundColor: colors.bg.cardAlt },
  toggleBtnOn:    { backgroundColor: 'rgba(61,202,110,0.2)', borderColor: colors.neon.green },
  toggleBtnOff:   { backgroundColor: 'rgba(255,69,69,0.1)', borderColor: colors.danger },
  toggleText:     { fontSize: 13, fontWeight: '600', color: colors.text.muted },
  toggleTextOn:   { color: colors.neon.green },
  toggleTextOff:  { color: colors.danger },
  expiryText:     { fontSize: 12, color: colors.text.muted, paddingHorizontal: 16, marginBottom: 4 },
  accountTagRow:  { flexDirection: 'row', alignItems: 'center', gap: 10, padding: 16, paddingBottom: 8 },
  accountTag:     { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 4, borderWidth: 1 },
  accountTagText: { fontSize: 10, fontWeight: '800', letterSpacing: 1 },
  accountTagDesc: { fontSize: 13, color: colors.text.secondary },
  accountDesc:    { fontSize: 13, color: colors.text.muted, lineHeight: 20, paddingHorizontal: 16 },
  accountEmail:   { fontSize: 14, color: colors.text.secondary, paddingHorizontal: 16 },
});
