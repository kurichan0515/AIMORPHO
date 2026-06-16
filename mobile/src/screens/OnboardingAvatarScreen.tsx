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

type GenderOption = { value: Gender; label: string; emoji: string };
const GENDER_OPTIONS: GenderOption[] = [
  { value: 'male',   label: '男性', emoji: '👨' },
  { value: 'female', label: '女性', emoji: '👩' },
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
      <View style={styles.stepIndicator}>
        <View style={styles.dot} />
        <View style={styles.dot} />
        <View style={[styles.dot, styles.dotActive]} />
      </View>

      <Text style={styles.title}>アバター設定</Text>

      {/* 性別選択（任意） */}
      {needGender && (
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>性別 <Text style={{ fontWeight: '400', fontSize: 12, color: '#999' }}>（任意）</Text></Text>
          <View style={styles.genderRow}>
            {GENDER_OPTIONS.map(o => (
              <TouchableOpacity
                key={o.value}
                style={[styles.genderBtn, localGender === o.value && styles.genderBtnActive]}
                onPress={() => setLocalGender(o.value)}
              >
                <Text style={styles.genderEmoji}>{o.emoji}</Text>
                <Text style={[styles.genderText, localGender === o.value && styles.genderTextActive]}>
                  {o.label}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>
      )}

      {/* 性別変更ボタン（設定済みの場合） */}
      {!needGender && (
        <View style={styles.genderBadgeRow}>
          {GENDER_OPTIONS.map(o => (
            <TouchableOpacity
              key={o.value}
              style={[styles.genderSmallBtn, localGender === o.value && styles.genderSmallBtnActive]}
              onPress={() => setLocalGender(o.value)}
            >
              <Text style={[styles.genderSmallText, localGender === o.value && styles.genderSmallTextActive]}>
                {o.emoji} {o.label}
              </Text>
            </TouchableOpacity>
          ))}
        </View>
      )}

      {/* デフォルトアバタープレビュー */}
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

      {/* 2択 */}
      {!generated ? (
        <>
          <Text style={styles.choiceTitle}>アバターを選んでください</Text>

          {/* AI生成 */}
          <TouchableOpacity
            style={[styles.aiBtn, mutation.isPending && styles.btnDisabled]}
            onPress={pickAndGenerate}
            disabled={mutation.isPending}
          >
            {mutation.isPending ? (
              <View style={styles.loadingRow}>
                <ActivityIndicator color="#FFF" size="small" />
                <Text style={styles.aiBtnText}>  AI生成中... (最大90秒)</Text>
              </View>
            ) : (
              <>
                <Text style={styles.aiBtnIcon}>📸</Text>
                <View>
                  <Text style={styles.aiBtnText}>顔写真でAIアバター生成</Text>
                  <Text style={styles.aiBtnSub}>写真はGemini AIで処理・生成後に削除されます</Text>
                </View>
              </>
            )}
          </TouchableOpacity>

          {/* デフォルト */}
          <TouchableOpacity
            style={[styles.defaultBtn, mutation.isPending && styles.btnDisabled]}
            onPress={startWithDefault}
            disabled={mutation.isPending}
          >
            <Text style={styles.defaultBtnIcon}>🎨</Text>
            <View>
              <Text style={styles.defaultBtnText}>デフォルトアバターで始める</Text>
              <Text style={styles.defaultBtnSub}>いつでもAI生成に変更可能</Text>
            </View>
          </TouchableOpacity>
        </>
      ) : (
        <View>
          <View style={styles.successBox}>
            <Text style={styles.successText}>✅ アバター生成完了！</Text>
            <Text style={styles.successSub}>5体のアバターを作成しました</Text>
          </View>
          <TouchableOpacity style={styles.startBtn} onPress={startWithGenerated}>
            <Text style={styles.startBtnText}>AIMORPHOをはじめる 🚀</Text>
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
  container:          { flexGrow: 1, padding: 24, backgroundColor: '#FFF' },
  stepIndicator:      { flexDirection: 'row', justifyContent: 'center', gap: 8, marginBottom: 24, marginTop: 8 },
  dot:                { width: 8, height: 8, borderRadius: 4, backgroundColor: '#DDD' },
  dotActive:          { backgroundColor: '#007AFF' },
  title:              { fontSize: 24, fontWeight: 'bold', marginBottom: 20 },
  section:            { marginBottom: 16 },
  sectionTitle:       { fontSize: 15, fontWeight: '600', color: '#333', marginBottom: 12 },
  genderRow:          { flexDirection: 'row', gap: 12 },
  genderBtn:          { flex: 1, alignItems: 'center', padding: 16, borderRadius: 12, backgroundColor: '#F5F5F5', borderWidth: 2, borderColor: 'transparent' },
  genderBtnActive:    { borderColor: '#007AFF', backgroundColor: '#E8F4FF' },
  genderEmoji:        { fontSize: 32, marginBottom: 4 },
  genderText:         { fontSize: 15, fontWeight: 'bold', color: '#333' },
  genderTextActive:   { color: '#007AFF' },
  genderBadgeRow:     { flexDirection: 'row', gap: 8, marginBottom: 12 },
  genderSmallBtn:     { paddingHorizontal: 14, paddingVertical: 6, borderRadius: 20, backgroundColor: '#EEE', borderWidth: 1, borderColor: 'transparent' },
  genderSmallBtnActive: { backgroundColor: '#E8F4FF', borderColor: '#007AFF' },
  genderSmallText:    { fontSize: 13, color: '#555' },
  genderSmallTextActive: { color: '#007AFF', fontWeight: '600' },
  previewRow:         { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 16 },
  previewCell:        { alignItems: 'center', width: '18%' },
  previewCircle:      { width: 52, height: 52, borderRadius: 26, justifyContent: 'center', alignItems: 'center', marginBottom: 4 },
  previewEmoji:       { fontSize: 22 },
  previewLabel:       { fontSize: 9, color: '#666', textAlign: 'center' },
  divider:            { height: 1, backgroundColor: '#EEE', marginVertical: 20 },
  choiceTitle:        { fontSize: 15, fontWeight: '600', color: '#333', marginBottom: 14, textAlign: 'center' },
  aiBtn:              { flexDirection: 'row', alignItems: 'center', gap: 14, backgroundColor: '#007AFF', borderRadius: 14, padding: 18, marginBottom: 12 },
  aiBtnIcon:          { fontSize: 28 },
  aiBtnText:          { color: '#FFF', fontSize: 15, fontWeight: 'bold' },
  aiBtnSub:           { color: 'rgba(255,255,255,0.8)', fontSize: 12, marginTop: 2 },
  defaultBtn:         { flexDirection: 'row', alignItems: 'center', gap: 14, backgroundColor: '#F5F5F5', borderRadius: 14, padding: 18, marginBottom: 12, borderWidth: 1, borderColor: '#DDD' },
  defaultBtnIcon:     { fontSize: 28 },
  defaultBtnText:     { color: '#333', fontSize: 15, fontWeight: 'bold' },
  defaultBtnSub:      { color: '#888', fontSize: 12, marginTop: 2 },
  loadingRow:         { flexDirection: 'row', alignItems: 'center' },
  btnDisabled:        { opacity: 0.5 },
  successBox:         { backgroundColor: '#E8F8E8', borderRadius: 14, padding: 20, alignItems: 'center', marginBottom: 20 },
  successText:        { color: '#2E7D32', fontSize: 18, fontWeight: 'bold', marginBottom: 4 },
  successSub:         { color: '#4CAF50', fontSize: 13 },
  startBtn:           { backgroundColor: '#007AFF', borderRadius: 14, padding: 18, alignItems: 'center' },
  startBtnText:       { color: '#FFF', fontSize: 17, fontWeight: 'bold' },
});
