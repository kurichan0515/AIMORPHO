import React, { useState } from 'react';
import {
  View, Text, TouchableOpacity, StyleSheet, Alert,
  ActivityIndicator, ScrollView,
} from 'react-native';
import { launchImageLibrary } from 'react-native-image-picker';
import { useMutation } from '@tanstack/react-query';
import { generateAvatar } from '../api/avatar';
import { useAuthStore } from '../store/useAuthStore';
import { useAvatarStore } from '../store/useAvatarStore';
import { useOnboardingStore } from '../store/useOnboardingStore';
import { Gender, getDefaultAvatars, DEFAULT_AVATAR_LABELS } from '../utils/defaultAvatars';
import AvatarConsentModal from '../components/AvatarConsentModal';
import { colors } from '../theme/colors';

type GenderOption = { value: Gender; label: string; sub: string };
const GENDER_OPTIONS: GenderOption[] = [
  { value: 'male',   label: '男性', sub: 'Male'   },
  { value: 'female', label: '女性', sub: 'Female' },
];

export default function OnboardingAvatarScreen() {
  const { completeOnboarding } = useAuthStore();
  const { setAvatarImages, setGender, setUseDefault, gender: storedGender } = useAvatarStore();
  const { gender: onboardingGender } = useOnboardingStore();

  const resolvedGender = storedGender ?? (onboardingGender === 'other' ? null : onboardingGender as Gender | null);
  const [localGender, setLocalGender] = useState<Gender | null>(resolvedGender);
  const [generated, setGenerated] = useState(false);
  const [consentVisible, setConsentVisible] = useState(false);

  const mutation = useMutation({
    mutationFn: (uri: string) => generateAvatar(uri),
    onSuccess: (data) => {
      setAvatarImages(data.avatarImages, 1);
      setGenerated(true);
    },
    onError: (e: any) => {
      if (e.response?.status === 403) {
        Alert.alert('上限に達しました', '追加生成はプレミアムプランへのアップグレードが必要です');
      } else {
        Alert.alert('エラー', 'アバター生成に失敗しました');
      }
    },
  });

  const pickAndGenerate = () => setConsentVisible(true);

  const handleConsentAgree = async () => {
    setConsentVisible(false);
    const res = await launchImageLibrary({ mediaType: 'photo', quality: 0.9 });
    const uri = res.assets?.[0]?.uri;
    if (!uri) return;
    mutation.mutate(uri);
  };

  const startWithDefault = async () => {
    if (localGender) setGender(localGender);
    setUseDefault(true);
    useOnboardingStore.getState().reset();
    await completeOnboarding();
  };

  const startWithGenerated = async () => {
    if (localGender) setGender(localGender);
    useOnboardingStore.getState().reset();
    await completeOnboarding();
  };

  const defaultAvatars = localGender ? getDefaultAvatars(localGender) : null;
  const needGender = !localGender;

  return (
    <ScrollView contentContainerStyle={styles.container}>
      <View style={styles.headerRow}>
        <View style={styles.stepIndicator}>
          <View style={styles.dot} />
          <View style={styles.dot} />
          <View style={[styles.dot, styles.dotActive]} />
        </View>
        <TouchableOpacity onPress={startWithDefault} style={styles.skipBtn}>
          <Text style={styles.skipText}>後でする</Text>
        </TouchableOpacity>
      </View>

      <Text style={styles.title}>アバター設定</Text>

      {needGender && (
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>性別 <Text style={{ fontWeight: '400', fontSize: 12, color: colors.text.muted }}>（任意）</Text></Text>
          <View style={styles.genderRow}>
            {GENDER_OPTIONS.map(o => (
              <TouchableOpacity
                key={o.value}
                style={[styles.genderBtn, localGender === o.value && styles.genderBtnActive]}
                onPress={() => setLocalGender(o.value)}
              >
                <Text style={[styles.genderText, localGender === o.value && styles.genderTextActive]}>{o.label}</Text>
                <Text style={[styles.genderSub,  localGender === o.value && styles.genderSubActive]}>{o.sub}</Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>
      )}

      {!needGender && (
        <View style={styles.genderBadgeRow}>
          {GENDER_OPTIONS.map(o => (
            <TouchableOpacity
              key={o.value}
              style={[styles.genderSmallBtn, localGender === o.value && styles.genderSmallBtnActive]}
              onPress={() => setLocalGender(o.value)}
            >
              <Text style={[styles.genderSmallText, localGender === o.value && styles.genderSmallTextActive]}>
                {o.label}
              </Text>
            </TouchableOpacity>
          ))}
        </View>
      )}

      {defaultAvatars && (
        <View style={styles.previewRow}>
          {[0, 1, 2, 3, 4].map(i => (
            <View key={i} style={styles.previewCell}>
              <View style={[styles.previewCircle, { backgroundColor: defaultAvatars[i].backgroundColor }]}>
                <Text style={styles.previewEmoji}>{defaultAvatars[i].emoji}</Text>
              </View>
              <Text style={styles.previewLabel}>{DEFAULT_AVATAR_LABELS[i]}</Text>
            </View>
          ))}
        </View>
      )}

      <View style={styles.divider} />

      {!generated ? (
        <>
          <Text style={styles.choiceTitle}>アバターを選んでください</Text>

          <TouchableOpacity
            style={[styles.aiBtn, mutation.isPending && styles.btnDisabled]}
            onPress={pickAndGenerate}
            disabled={mutation.isPending}
          >
            {mutation.isPending ? (
              <View style={styles.loadingRow}>
                <ActivityIndicator color={colors.bg.primary} size="small" />
                <Text style={styles.aiBtnText}>  AI生成中... (最大90秒)</Text>
              </View>
            ) : (
              <View style={styles.btnInner}>
                <Text style={styles.aiBtnLabel}>AI</Text>
                <View>
                  <Text style={styles.aiBtnText}>顔写真でAIアバター生成</Text>
                  <Text style={styles.aiBtnSub}>写真はGemini AIで処理・生成後に削除されます</Text>
                </View>
              </View>
            )}
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.defaultBtn, mutation.isPending && styles.btnDisabled]}
            onPress={startWithDefault}
            disabled={mutation.isPending}
          >
            <View style={styles.btnInner}>
              <Text style={styles.defaultBtnLabel}>—</Text>
              <View>
                <Text style={styles.defaultBtnText}>デフォルトアバターで始める</Text>
                <Text style={styles.defaultBtnSub}>いつでもAI生成に変更可能</Text>
              </View>
            </View>
          </TouchableOpacity>
        </>
      ) : (
        <View>
          <View style={styles.successBox}>
            <Text style={styles.successText}>アバター生成完了</Text>
            <Text style={styles.successSub}>5体のアバターを作成しました</Text>
          </View>
          <TouchableOpacity style={styles.startBtn} onPress={startWithGenerated}>
            <Text style={styles.startBtnText}>AIMORPHOをはじめる</Text>
          </TouchableOpacity>
        </View>
      )}

      <AvatarConsentModal
        visible={consentVisible}
        onAgree={handleConsentAgree}
        onCancel={() => setConsentVisible(false)}
      />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container:             { flexGrow: 1, padding: 24, backgroundColor: colors.bg.primary },
  headerRow:             { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 24, marginTop: 8 },
  stepIndicator:         { flexDirection: 'row', gap: 8 },
  skipBtn:               { paddingVertical: 4, paddingHorizontal: 8 },
  skipText:              { fontSize: 14, color: colors.text.muted },
  dot:                   { width: 8, height: 8, borderRadius: 4, backgroundColor: colors.bg.cardAlt },
  dotActive:             { backgroundColor: colors.neon.blue },
  title:                 { fontSize: 24, fontWeight: 'bold', marginBottom: 20, color: colors.text.primary },
  section:               { marginBottom: 16 },
  sectionTitle:          { fontSize: 15, fontWeight: '600', color: colors.text.primary, marginBottom: 12 },
  genderRow:             { flexDirection: 'row', gap: 12 },
  genderBtn:             { flex: 1, alignItems: 'center', paddingVertical: 18, paddingHorizontal: 8, borderRadius: 12, backgroundColor: colors.bg.card, borderWidth: 1, borderColor: colors.border.subtle },
  genderBtnActive:       { borderColor: colors.neon.blue, backgroundColor: 'rgba(47,200,255,0.1)' },
  genderText:            { fontSize: 15, fontWeight: '700', color: colors.text.secondary },
  genderTextActive:      { color: colors.neon.blue },
  genderSub:             { fontSize: 10, color: colors.text.muted, marginTop: 3, letterSpacing: 0.5 },
  genderSubActive:       { color: 'rgba(47,200,255,0.6)' },
  genderBadgeRow:        { flexDirection: 'row', gap: 8, marginBottom: 12 },
  genderSmallBtn:        { paddingHorizontal: 14, paddingVertical: 6, borderRadius: 20, backgroundColor: colors.bg.cardAlt, borderWidth: 1, borderColor: colors.border.subtle },
  genderSmallBtnActive:  { backgroundColor: 'rgba(47,200,255,0.1)', borderColor: colors.neon.blue },
  genderSmallText:       { fontSize: 13, color: colors.text.secondary },
  genderSmallTextActive: { color: colors.neon.blue, fontWeight: '600' },
  previewRow:            { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 16 },
  previewCell:           { alignItems: 'center', width: '18%' },
  previewCircle:         { width: 52, height: 52, borderRadius: 26, justifyContent: 'center', alignItems: 'center', marginBottom: 4 },
  previewEmoji:          { fontSize: 22 },
  previewLabel:          { fontSize: 9, color: colors.text.secondary, textAlign: 'center' },
  divider:               { height: 1, backgroundColor: colors.border.subtle, marginVertical: 20 },
  choiceTitle:           { fontSize: 15, fontWeight: '600', color: colors.text.primary, marginBottom: 14, textAlign: 'center' },
  aiBtn:                 { backgroundColor: colors.neon.blue, borderRadius: 14, padding: 18, marginBottom: 12 },
  btnInner:              { flexDirection: 'row', alignItems: 'center', gap: 14 },
  aiBtnLabel:            { fontSize: 11, fontWeight: '800', color: colors.bg.primary, letterSpacing: 1, width: 28, textAlign: 'center' },
  aiBtnText:             { color: colors.bg.primary, fontSize: 15, fontWeight: 'bold' },
  aiBtnSub:              { color: 'rgba(10,14,24,0.7)', fontSize: 12, marginTop: 2 },
  defaultBtn:            { backgroundColor: colors.bg.card, borderRadius: 14, padding: 18, marginBottom: 12, borderWidth: 1, borderColor: colors.border.subtle },
  defaultBtnLabel:       { fontSize: 18, fontWeight: '300', color: colors.text.muted, width: 28, textAlign: 'center' },
  defaultBtnText:        { color: colors.text.primary, fontSize: 15, fontWeight: 'bold' },
  defaultBtnSub:         { color: colors.text.secondary, fontSize: 12, marginTop: 2 },
  loadingRow:            { flexDirection: 'row', alignItems: 'center' },
  btnDisabled:           { opacity: 0.5 },
  successBox:            { backgroundColor: 'rgba(74,222,128,0.15)', borderRadius: 14, padding: 20, alignItems: 'center', marginBottom: 20, borderWidth: 1, borderColor: 'rgba(74,222,128,0.4)' },
  successText:           { color: colors.neon.green, fontSize: 18, fontWeight: 'bold', marginBottom: 4 },
  successSub:            { color: colors.neon.green, fontSize: 13, opacity: 0.8 },
  startBtn:              { backgroundColor: colors.neon.blue, borderRadius: 14, padding: 18, alignItems: 'center' },
  startBtnText:          { color: colors.bg.primary, fontSize: 17, fontWeight: 'bold' },
});
