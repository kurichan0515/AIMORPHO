import React, { useState } from 'react';
import { View, Text, Image, TouchableOpacity, StyleSheet, Alert, ActivityIndicator, ScrollView } from 'react-native';
import { launchImageLibrary } from 'react-native-image-picker';
import { useMutation, useQuery } from '@tanstack/react-query';
import { generateAvatar } from '../api/avatar';
import { useAvatarStore } from '../store/useAvatarStore';
import { getDefaultAvatars, DEFAULT_AVATAR_LABELS } from '../utils/defaultAvatars';
import AvatarConsentModal from '../components/AvatarConsentModal';
import PremiumGateModal from '../components/PremiumGateModal';
import Toast from '../components/Toast';
import { useToast } from '../hooks/useToast';
import { colors } from '../theme/colors';
import api from '../api/client';

const MAX_GENERATES = 2;

export default function AvatarSetupScreen() {
  const { avatarImages, bodyState, regenerateCount, gender, setAvatarImages } = useAvatarStore();
  const [consentVisible, setConsentVisible] = React.useState(false);
  const [premiumVisible, setPremiumVisible] = React.useState(false);
  const { toastVisible, toastMessage, showToast, hideToast } = useToast();

  const { data: profile } = useQuery({
    queryKey: ['profile'],
    queryFn: () => api.get('/users/me').then(r => r.data),
  });
  const isPremium = profile?.subscriptionTier === 'premium';

  const mutation = useMutation({
    mutationFn: (uri: string) => generateAvatar(uri),
    onSuccess: (data) => {
      setAvatarImages(data.avatarImages, regenerateCount + 1);
      showToast('アバターを生成しました！');
    },
    onError: (e: any) => {
      if (e.response?.status === 403) { setPremiumVisible(true); return; }
      Alert.alert('エラー', 'アバター生成に失敗しました');
    },
  });

  const pickAndGenerate = () => {
    if (!isPremium && regenerateCount >= MAX_GENERATES) {
      setPremiumVisible(true);
      return;
    }
    setConsentVisible(true);
  };

  const handleConsentAgree = async () => {
    setConsentVisible(false);
    const res = await launchImageLibrary({ mediaType: 'photo', quality: 0.9 });
    const uri = res.assets?.[0]?.uri;
    if (!uri) return;
    mutation.mutate(uri);
  };

  const remaining = isPremium ? Infinity : Math.max(0, MAX_GENERATES - regenerateCount);
  const hasGenerated = Object.keys(avatarImages).length > 0;
  const defaultAvatars = !hasGenerated ? getDefaultAvatars(gender) : null;

  return (
    <View style={{ flex: 1 }}>
    <ScrollView style={styles.container}>
      <Text style={styles.title}>アバター</Text>

      <View style={[styles.countBanner, !isPremium && remaining === 0 && styles.countBannerEmpty, isPremium && styles.countBannerPremium]}>
        {isPremium ? (
          <Text style={styles.countTextPremium}>👑 プレミアム — アバター生成 無制限</Text>
        ) : remaining > 0 ? (
          <Text style={styles.countText}>📸 あと <Text style={styles.countNum}>{remaining}</Text> 回生成できます</Text>
        ) : (
          <Text style={styles.countTextEmpty}>🔒 無料生成上限 ({MAX_GENERATES}/{MAX_GENERATES})</Text>
        )}
      </View>

      {hasGenerated ? (
        <View>
          <Text style={styles.sectionTitle}>生成済みアバター（5体）</Text>
          <View style={styles.avatarGrid}>
            {[0, 1, 2, 3, 4].map(i => (
              <View key={i} style={[styles.avatarCell, bodyState === i && styles.avatarCellActive]}>
                {avatarImages[i] ? (
                  <Image
                    source={{ uri: avatarImages[i]! }}
                    style={styles.avatarThumb}
                    defaultSource={require('../assets/app-icon-source.png')}
                  />
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

      {(isPremium || remaining > 0) ? (
        <TouchableOpacity
          style={[styles.generateBtn, mutation.isPending && styles.btnDisabled]}
          onPress={pickAndGenerate}
          disabled={mutation.isPending}
        >
          {mutation.isPending ? (
            <View style={styles.loadingRow}>
              <ActivityIndicator size="small" color={colors.bg.primary} />
              <Text style={styles.generateBtnText}>  AI生成中... (最大90秒)</Text>
            </View>
          ) : (
            <View>
              <Text style={styles.generateBtnText}>
                📸 顔写真で{hasGenerated ? '再' : ''}生成{isPremium ? '' : `（残り${remaining}回）`}
              </Text>
              <Text style={styles.generateBtnSub}>写真はGemini AIで処理・生成後に削除されます</Text>
            </View>
          )}
        </TouchableOpacity>
      ) : (
        <TouchableOpacity style={styles.upgradeBtn} onPress={() => setPremiumVisible(true)}>
          <Text style={styles.upgradeBtnText}>✨ プレミアムで無制限生成</Text>
        </TouchableOpacity>
      )}

      <AvatarConsentModal
        visible={consentVisible}
        onAgree={handleConsentAgree}
        onCancel={() => setConsentVisible(false)}
      />

      <Toast visible={toastVisible} message={toastMessage} onHide={hideToast} />
      <PremiumGateModal
        visible={premiumVisible}
        onClose={() => setPremiumVisible(false)}
        title="アバター生成の上限に達しました"
        description={`無料プランでのアバター生成は${MAX_GENERATES}回までです。プレミアムプランで何度でも再生成できます。`}
      />
    </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container:              { flex: 1, backgroundColor: colors.bg.primary, padding: 16 },
  title:                  { fontSize: 22, fontWeight: 'bold', marginBottom: 12, color: colors.text.primary },
  countBanner:            { backgroundColor: 'rgba(47,200,255,0.1)', borderRadius: 10, padding: 12, marginBottom: 16, alignItems: 'center', borderWidth: 1, borderColor: colors.border.blue },
  countBannerEmpty:       { backgroundColor: 'rgba(255,128,51,0.1)', borderColor: 'rgba(255,128,51,0.4)' },
  countBannerPremium:     { backgroundColor: 'rgba(255,209,102,0.1)', borderColor: 'rgba(255,209,102,0.4)' },
  countText:              { fontSize: 14, color: colors.neon.blue },
  countNum:               { fontSize: 18, fontWeight: 'bold' },
  countTextEmpty:         { fontSize: 14, color: colors.neon.orange },
  countTextPremium:       { fontSize: 14, color: colors.neon.yellow, fontWeight: '600' },
  sectionTitle:           { fontSize: 16, fontWeight: 'bold', marginBottom: 12, color: colors.text.primary },
  avatarGrid:             { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 20 },
  avatarCell:             { width: '18%', alignItems: 'center', padding: 4, borderRadius: 8, borderWidth: 2, borderColor: 'transparent' },
  avatarCellActive:       { borderColor: colors.neon.blue, backgroundColor: 'rgba(47,200,255,0.1)' },
  avatarThumb:            { width: 56, height: 74, borderRadius: 6 },
  avatarThumbPlaceholder: { width: 56, height: 74, backgroundColor: colors.bg.cardAlt, borderRadius: 6 },
  defaultCircle:          { width: 56, height: 56, borderRadius: 28, justifyContent: 'center', alignItems: 'center' },
  defaultEmoji:           { fontSize: 24 },
  avatarLabel:            { fontSize: 9, textAlign: 'center', marginTop: 4, color: colors.text.secondary },
  currentBadge:           { fontSize: 9, color: colors.neon.blue, fontWeight: 'bold' },
  emptyBox:               { backgroundColor: colors.bg.card, borderRadius: 12, padding: 32, alignItems: 'center', marginBottom: 20, borderWidth: 1, borderColor: colors.border.subtle },
  emptyText:              { color: colors.text.secondary, fontSize: 14 },
  generateBtn:            { backgroundColor: colors.neon.blue, borderRadius: 12, padding: 16, alignItems: 'center', marginBottom: 12 },
  generateBtnText:        { color: colors.bg.primary, fontSize: 15, fontWeight: 'bold' },
  generateBtnSub:         { color: 'rgba(10,14,24,0.7)', fontSize: 11, marginTop: 2, textAlign: 'center' },
  loadingRow:             { flexDirection: 'row', alignItems: 'center' },
  btnDisabled:            { opacity: 0.6 },
  upgradeBtn:             { backgroundColor: colors.neon.orange, borderRadius: 12, padding: 16, alignItems: 'center', marginBottom: 12 },
  upgradeBtnText:         { color: colors.bg.primary, fontSize: 15, fontWeight: 'bold' },
});
