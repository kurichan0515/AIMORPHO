import React, { useState } from 'react';
import { View, Text, Image, TouchableOpacity, StyleSheet, Alert, ActivityIndicator, ScrollView } from 'react-native';
import { launchImageLibrary } from 'react-native-image-picker';
import { useMutation } from '@tanstack/react-query';
import { generateAvatar } from '../api/avatar';
import { useAvatarStore } from '../store/useAvatarStore';

const STATE_LABELS = ['理想体型', 'やや改善', '標準', 'やや太り', 'ペナルティ'];

export default function AvatarSetupScreen() {
  const [imageUri, setImageUri] = useState<string | null>(null);
  const { avatarImages, bodyState, setAvatarImages } = useAvatarStore();

  const mutation = useMutation({
    mutationFn: (uri: string) => generateAvatar(uri),
    onSuccess: (data) => {
      setAvatarImages(data.avatarImages);
      Alert.alert('完成！', 'アバターを5体生成しました');
    },
    onError: () => Alert.alert('エラー', 'アバター生成に失敗しました'),
  });

  const pickAndGenerate = async () => {
    const res = await launchImageLibrary({ mediaType: 'photo', quality: 0.9 });
    const uri = res.assets?.[0]?.uri;
    if (!uri) return;
    setImageUri(uri);
    mutation.mutate(uri);
  };

  return (
    <ScrollView style={styles.container}>
      <Text style={styles.title}>アバター設定</Text>
      <Text style={styles.subtitle}>顔写真からアニメ風アバターを5体生成します</Text>

      <TouchableOpacity style={styles.photoBtn} onPress={pickAndGenerate} disabled={mutation.isPending}>
        {imageUri ? (
          <Image source={{ uri: imageUri }} style={styles.facePhoto} />
        ) : (
          <Text style={styles.photoBtnText}>+ 顔写真を選択</Text>
        )}
      </TouchableOpacity>

      {mutation.isPending && (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" />
          <Text style={styles.loadingText}>AI生成中... (最大90秒)</Text>
        </View>
      )}

      {Object.keys(avatarImages).length > 0 && (
        <View>
          <Text style={styles.sectionTitle}>生成済みアバター</Text>
          <View style={styles.avatarGrid}>
            {[0, 1, 2, 3, 4].map(i => (
              <View key={i} style={[styles.avatarCell, bodyState === i && styles.avatarCellActive]}>
                {avatarImages[i] ? (
                  <Image source={{ uri: avatarImages[i]! }} style={styles.avatarThumb} />
                ) : (
                  <View style={styles.avatarThumbPlaceholder} />
                )}
                <Text style={styles.avatarLabel}>{STATE_LABELS[i]}</Text>
                {bodyState === i && <Text style={styles.currentBadge}>現在</Text>}
              </View>
            ))}
          </View>
        </View>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container:              { flex: 1, backgroundColor: '#F8F9FA', padding: 16 },
  title:                  { fontSize: 22, fontWeight: 'bold', marginBottom: 8 },
  subtitle:               { fontSize: 14, color: '#666', marginBottom: 20 },
  photoBtn:               { height: 160, backgroundColor: '#E8F4FF', borderRadius: 12, justifyContent: 'center', alignItems: 'center', marginBottom: 16 },
  photoBtnText:           { fontSize: 16, color: '#007AFF' },
  facePhoto:              { width: '100%', height: '100%', borderRadius: 12 },
  loadingContainer:       { alignItems: 'center', padding: 24 },
  loadingText:            { marginTop: 8, color: '#666' },
  sectionTitle:           { fontSize: 16, fontWeight: 'bold', marginBottom: 12 },
  avatarGrid:             { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  avatarCell:             { width: '18%', alignItems: 'center', padding: 4, borderRadius: 8, borderWidth: 2, borderColor: 'transparent' },
  avatarCellActive:       { borderColor: '#007AFF', backgroundColor: '#E8F4FF' },
  avatarThumb:            { width: 56, height: 74, borderRadius: 6 },
  avatarThumbPlaceholder: { width: 56, height: 74, backgroundColor: '#DDD', borderRadius: 6 },
  avatarLabel:            { fontSize: 9, textAlign: 'center', marginTop: 4, color: '#555' },
  currentBadge:           { fontSize: 9, color: '#007AFF', fontWeight: 'bold' },
});
