import React, { useState } from 'react';
import {
  View, Text, TouchableOpacity, StyleSheet, Alert,
  ActivityIndicator, ScrollView, Image,
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { launchImageLibrary } from 'react-native-image-picker';
import { useMutation } from '@tanstack/react-query';
import { generateAvatar } from '../api/avatar';
import { useAuthStore } from '../store/useAuthStore';
import { useAvatarStore } from '../store/useAvatarStore';
import { Gender, getDefaultAvatars, DEFAULT_AVATAR_LABELS } from '../utils/defaultAvatars';

const MAX_GENERATES = 2;

export default function OnboardingAvatarScreen() {
  const navigation = useNavigation<any>();
  const { completeOnboarding } = useAuthStore();
  const { setAvatarImages, setGender, setUseDefault } = useAvatarStore();
  const [selectedGender, setSelectedGender] = useState<Gender | null>(null);
  const [generated, setGenerated] = useState(false);

  const mutation = useMutation({
    mutationFn: (uri: string) => generateAvatar(uri),
    onSuccess: (data) => {
      setAvatarImages(data.avatarImages, 1);
      setGenerated(true);
      Alert.alert('完成！', 'アバターを5体生成しました 🎉');
    },
    onError: (e: any) => {
      if (e.response?.status === 403) {
        Alert.alert('上限に達しました', '追加生成はプレミアムプランへのアップグレードが必要です');
      } else {
        Alert.alert('エラー', 'アバター生成に失敗しました');
      }
    },
  });

  const pickAndGenerate = async () => {
    const res = await launchImageLibrary({ mediaType: 'photo', quality: 0.9 });
    const uri = res.assets?.[0]?.uri;
    if (!uri) return;
    mutation.mutate(uri);
  };

  const useDefaultAvatar = async () => {
    if (!selectedGender) {
      Alert.alert('性別を選択してください');
      return;
    }
    setGender(selectedGender);
    setUseDefault(true);
    await completeOnboarding();
  };

  const finish = async () => {
    if (selectedGender) setGender(selectedGender);
    await completeOnboarding();
  };

  const defaultAvatars = selectedGender ? getDefaultAvatars(selectedGender) : null;

  return (
    <ScrollView contentContainerStyle={styles.container}>
      <View style={styles.stepIndicator}>
        <View style={styles.dot} />
        <View style={styles.dot} />
        <View style={[styles.dot, styles.dotActive]} />
      </View>

      <Text style={styles.title}>アバター設定</Text>
      <Text style={styles.subtitle}>あなたの顔写真からアニメ風アバターを生成します。{'\n'}生成は最大{MAX_GENERATES}回まで無料です。</Text>

      {/* 性別選択 */}
      <Text style={styles.label}>デフォルト性別を選択</Text>
      <View style={styles.genderRow}>
        {(['male', 'female'] as Gender[]).map(g => (
          <TouchableOpacity
            key={g}
            style={[styles.genderBtn, selectedGender === g && styles.genderBtnActive]}
            onPress={() => setSelectedGender(g)}
          >
            <Text style={styles.genderEmoji}>{g === 'male' ? '👨' : '👩'}</Text>
            <Text style={[styles.genderText, selectedGender === g && styles.genderTextActive]}>
              {g === 'male' ? '男性' : '女性'}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      {/* デフォルトプレビュー */}
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

      {/* 顔写真生成 */}
      <View style={styles.divider}><Text style={styles.dividerText}>または</Text></View>

      <TouchableOpacity
        style={[styles.generateBtn, mutation.isPending && styles.btnDisabled]}
        onPress={pickAndGenerate}
        disabled={mutation.isPending}
      >
        {mutation.isPending ? (
          <View style={styles.loadingRow}>
            <ActivityIndicator color="#007AFF" size="small" />
            <Text style={styles.generateBtnText}>  AI生成中... (最大90秒)</Text>
          </View>
        ) : (
          <Text style={styles.generateBtnText}>📸 顔写真からアバター生成（残り{MAX_GENERATES}回）</Text>
        )}
      </TouchableOpacity>

      {generated && (
        <View style={styles.successBox}>
          <Text style={styles.successText}>✅ アバター生成完了！ホームで確認できます</Text>
        </View>
      )}

      {/* 完了ボタン */}
      <TouchableOpacity
        style={[styles.finishBtn, !selectedGender && !generated && styles.btnDisabled]}
        onPress={generated ? finish : useDefaultAvatar}
        disabled={!selectedGender && !generated}
      >
        <Text style={styles.finishBtnText}>
          {generated ? 'YASERUNをはじめる 🚀' : 'デフォルトで始める'}
        </Text>
      </TouchableOpacity>

      {(selectedGender || generated) && (
        <TouchableOpacity style={styles.skipBtn} onPress={finish}>
          <Text style={styles.skipText}>スキップ（後でアバタータブから設定）</Text>
        </TouchableOpacity>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container:        { flexGrow: 1, padding: 24, backgroundColor: '#FFF' },
  stepIndicator:    { flexDirection: 'row', justifyContent: 'center', gap: 8, marginBottom: 24, marginTop: 8 },
  dot:              { width: 8, height: 8, borderRadius: 4, backgroundColor: '#DDD' },
  dotActive:        { backgroundColor: '#007AFF' },
  title:            { fontSize: 24, fontWeight: 'bold', marginBottom: 6 },
  subtitle:         { fontSize: 13, color: '#888', marginBottom: 20, lineHeight: 20 },
  label:            { fontSize: 14, fontWeight: '600', color: '#333', marginBottom: 10 },
  genderRow:        { flexDirection: 'row', gap: 12, marginBottom: 16 },
  genderBtn:        { flex: 1, padding: 16, borderRadius: 12, backgroundColor: '#F5F5F5', alignItems: 'center', borderWidth: 2, borderColor: 'transparent' },
  genderBtnActive:  { borderColor: '#007AFF', backgroundColor: '#E8F4FF' },
  genderEmoji:      { fontSize: 32, marginBottom: 4 },
  genderText:       { fontSize: 15, fontWeight: 'bold', color: '#333' },
  genderTextActive: { color: '#007AFF' },
  previewRow:       { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 16 },
  previewCell:      { alignItems: 'center', width: '18%' },
  previewCircle:    { width: 52, height: 52, borderRadius: 26, justifyContent: 'center', alignItems: 'center', marginBottom: 4 },
  previewEmoji:     { fontSize: 22 },
  previewLabel:     { fontSize: 9, color: '#666', textAlign: 'center' },
  divider:          { flexDirection: 'row', alignItems: 'center', marginVertical: 16 },
  dividerText:      { flex: 1, textAlign: 'center', color: '#AAA', fontSize: 13 },
  generateBtn:      { borderWidth: 2, borderColor: '#007AFF', borderRadius: 12, padding: 16, alignItems: 'center', marginBottom: 12 },
  generateBtnText:  { color: '#007AFF', fontSize: 15, fontWeight: '600' },
  loadingRow:       { flexDirection: 'row', alignItems: 'center' },
  btnDisabled:      { opacity: 0.5 },
  successBox:       { backgroundColor: '#E8F8E8', borderRadius: 10, padding: 12, marginBottom: 12 },
  successText:      { color: '#2E7D32', fontSize: 14, textAlign: 'center' },
  finishBtn:        { backgroundColor: '#007AFF', borderRadius: 12, padding: 16, alignItems: 'center', marginTop: 8 },
  finishBtnText:    { color: '#FFF', fontSize: 16, fontWeight: 'bold' },
  skipBtn:          { alignItems: 'center', marginTop: 16, padding: 12 },
  skipText:         { color: '#999', fontSize: 13 },
});
