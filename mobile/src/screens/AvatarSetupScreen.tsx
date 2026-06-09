import React from 'react';
import { View, Text, Image, TouchableOpacity, StyleSheet, Alert, ActivityIndicator, ScrollView } from 'react-native';
import { launchImageLibrary } from 'react-native-image-picker';
import { useMutation } from '@tanstack/react-query';
import { generateAvatar } from '../api/avatar';
import { useAvatarStore } from '../store/useAvatarStore';
import { getDefaultAvatars, DEFAULT_AVATAR_LABELS } from '../utils/defaultAvatars';

const MAX_GENERATES = 2;

export default function AvatarSetupScreen() {
  const { avatarImages, bodyState, regenerateCount, gender, useDefault, setAvatarImages } = useAvatarStore();

  const mutation = useMutation({
    mutationFn: (uri: string) => generateAvatar(uri),
    onSuccess: (data) => {
      setAvatarImages(data.avatarImages, regenerateCount + 1);
      Alert.alert('完成！', 'アバターを再生成しました 🎉');
    },
    onError: (e: any) => {
      if (e.response?.status === 403) {
        Alert.alert(
          '生成上限に達しました',
          `無料で使えるアバター生成は${MAX_GENERATES}回までです。\nプレミアムプランにアップグレードすると無制限で生成できます。`,
          [
            { text: 'キャンセル', style: 'cancel' },
            { text: 'アップグレード', onPress: () => Alert.alert('近日公開予定') },
          ]
        );
      } else {
        Alert.alert('エラー', 'アバター生成に失敗しました');
      }
    },
  });

  const pickAndGenerate = async () => {
    if (regenerateCount >= MAX_GENERATES) {
      Alert.alert(
        '生成上限に達しました',
        `無料で使えるアバター生成は${MAX_GENERATES}回までです。\nプレミアムプランにアップグレードすると無制限で生成できます。`,
        [
          { text: 'キャンセル', style: 'cancel' },
          { text: 'アップグレード', onPress: () => Alert.alert('近日公開予定') },
        ]
      );
      return;
    }
    const res = await launchImageLibrary({ mediaType: 'photo', quality: 0.9 });
    const uri = res.assets?.[0]?.uri;
    if (!uri) return;
    mutation.mutate(uri);
  };

  const remaining = Math.max(0, MAX_GENERATES - regenerateCount);
  const hasGenerated = Object.keys(avatarImages).length > 0;
  const defaultAvatars = !hasGenerated ? getDefaultAvatars(gender) : null;

  return (
    <ScrollView style={styles.container}>
      <Text style={styles.title}>アバター</Text>

      {/* 残回数バナー */}
      <View style={[styles.countBanner, remaining === 0 && styles.countBannerEmpty]}>
        {remaining > 0 ? (
          <Text style={styles.countText}>📸 あと <Text style={styles.countNum}>{remaining}</Text> 回生成できます</Text>
        ) : (
          <Text style={styles.countTextEmpty}>🔒 無料生成上限 ({MAX_GENERATES}/{MAX_GENERATES})</Text>
        )}
      </View>

      {/* 生成済みアバター or デフォルト */}
      {hasGenerated ? (
        <View>
          <Text style={styles.sectionTitle}>生成済みアバター（5体）</Text>
          <View style={styles.avatarGrid}>
            {[0, 1, 2, 3, 4].map(i => (
              <View key={i} style={[styles.avatarCell, bodyState === i && styles.avatarCellActive]}>
                {avatarImages[i] ? (
                  <Image source={{ uri: avatarImages[i]! }} style={styles.avatarThumb} />
                ) : (
                  <View style={styles.avatarThumbPlaceholder} />
                )}
                <Text style={styles.avatarLabel}>{DEFAULT_AVATAR_LABELS[i]}</Text>
                {bodyState === i && <Text style={styles.currentBadge}>現在</Text>}
              </View>
            ))}
          </View>
        </View>
      ) : defaultAvatars ? (
        <View>
          <Text style={styles.sectionTitle}>デフォルトアバター</Text>
          <View style={styles.avatarGrid}>
            {[0, 1, 2, 3, 4].map(i => (
              <View key={i} style={[styles.avatarCell, bodyState === i && styles.avatarCellActive]}>
                <View style={[styles.defaultCircle, { backgroundColor: defaultAvatars[i].backgroundColor }]}>
                  <Text style={styles.defaultEmoji}>{defaultAvatars[i].emoji}</Text>
                </View>
                <Text style={styles.avatarLabel}>{DEFAULT_AVATAR_LABELS[i]}</Text>
                {bodyState === i && <Text style={styles.currentBadge}>現在</Text>}
              </View>
            ))}
          </View>
        </View>
      ) : (
        <View style={styles.emptyBox}>
          <Text style={styles.emptyText}>顔写真からアバターを生成してみましょう</Text>
        </View>
      )}

      {/* 生成ボタン */}
      {remaining > 0 ? (
        <TouchableOpacity
          style={[styles.generateBtn, mutation.isPending && styles.btnDisabled]}
          onPress={pickAndGenerate}
          disabled={mutation.isPending}
        >
          {mutation.isPending ? (
            <View style={styles.loadingRow}>
              <ActivityIndicator size="small" color="#FFF" />
              <Text style={styles.generateBtnText}>  AI生成中... (最大90秒)</Text>
            </View>
          ) : (
            <Text style={styles.generateBtnText}>
              📸 顔写真で{hasGenerated ? '再' : ''}生成（残り{remaining}回）
            </Text>
          )}
        </TouchableOpacity>
      ) : (
        <TouchableOpacity
          style={styles.upgradeBtn}
          onPress={() => Alert.alert('プレミアムプラン', '追加生成はプレミアムプランへのアップグレードが必要です。\n近日公開予定！')}
        >
          <Text style={styles.upgradeBtnText}>✨ プレミアムで無制限生成</Text>
        </TouchableOpacity>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container:           { flex: 1, backgroundColor: '#F8F9FA', padding: 16 },
  title:               { fontSize: 22, fontWeight: 'bold', marginBottom: 12 },
  countBanner:         { backgroundColor: '#E8F4FF', borderRadius: 10, padding: 12, marginBottom: 16, alignItems: 'center' },
  countBannerEmpty:    { backgroundColor: '#FFF3E0' },
  countText:           { fontSize: 14, color: '#007AFF' },
  countNum:            { fontSize: 18, fontWeight: 'bold' },
  countTextEmpty:      { fontSize: 14, color: '#E65100' },
  sectionTitle:        { fontSize: 16, fontWeight: 'bold', marginBottom: 12 },
  avatarGrid:          { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 20 },
  avatarCell:          { width: '18%', alignItems: 'center', padding: 4, borderRadius: 8, borderWidth: 2, borderColor: 'transparent' },
  avatarCellActive:    { borderColor: '#007AFF', backgroundColor: '#E8F4FF' },
  avatarThumb:         { width: 56, height: 74, borderRadius: 6 },
  avatarThumbPlaceholder: { width: 56, height: 74, backgroundColor: '#DDD', borderRadius: 6 },
  defaultCircle:       { width: 56, height: 56, borderRadius: 28, justifyContent: 'center', alignItems: 'center' },
  defaultEmoji:        { fontSize: 24 },
  avatarLabel:         { fontSize: 9, textAlign: 'center', marginTop: 4, color: '#555' },
  currentBadge:        { fontSize: 9, color: '#007AFF', fontWeight: 'bold' },
  emptyBox:            { backgroundColor: '#F0F0F0', borderRadius: 12, padding: 32, alignItems: 'center', marginBottom: 20 },
  emptyText:           { color: '#888', fontSize: 14 },
  generateBtn:         { backgroundColor: '#007AFF', borderRadius: 12, padding: 16, alignItems: 'center', marginBottom: 12 },
  generateBtnText:     { color: '#FFF', fontSize: 15, fontWeight: 'bold' },
  loadingRow:          { flexDirection: 'row', alignItems: 'center' },
  btnDisabled:         { opacity: 0.6 },
  upgradeBtn:          { backgroundColor: '#FF9500', borderRadius: 12, padding: 16, alignItems: 'center', marginBottom: 12 },
  upgradeBtnText:      { color: '#FFF', fontSize: 15, fontWeight: 'bold' },
});
