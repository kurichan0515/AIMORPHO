import React, { useState } from 'react';
import { View, Text, TouchableOpacity, Image, TextInput, StyleSheet, Alert, ScrollView, ActivityIndicator } from 'react-native';
import { launchImageLibrary } from 'react-native-image-picker';
import { useMutation, useQuery } from '@tanstack/react-query';
import { getMealUploadUrl, analyzeMeal, uploadImageToS3, getMealHistory } from '../api/logs';

interface MealResult {
  menu_name: string;
  kcal: number;
  protein_g: number;
  fat_g: number;
  carb_g: number;
  confidence: 'high' | 'medium' | 'low';
  error?: string;
}

export default function MealLogScreen() {
  const [imageUri, setImageUri] = useState<string | null>(null);
  const [result, setResult] = useState<MealResult | null>(null);
  const [manualMode, setManualMode] = useState(false);

  const { data: history, refetch } = useQuery({ queryKey: ['mealHistory'], queryFn: () => getMealHistory({ limit: 10 }) });

  const analyzeMutation = useMutation({
    mutationFn: async (uri: string) => {
      const { uploadUrl, s3Key } = await getMealUploadUrl();
      await uploadImageToS3(uploadUrl, uri);
      return analyzeMeal(s3Key);
    },
    onSuccess: (data) => {
      if (data.error === 'analysis_failed') {
        setManualMode(true);
        Alert.alert('解析失敗', '手動で入力してください');
      } else {
        setResult(data);
        if (data.confidence === 'low') {
          Alert.alert('確認', '解析結果の精度が低めです。内容を確認してください。');
        }
      }
      refetch();
    },
    onError: () => {
      setManualMode(true);
      Alert.alert('エラー', '再試行してください');
    },
  });

  const pickImage = async () => {
    const res = await launchImageLibrary({ mediaType: 'photo', quality: 0.8 });
    const uri = res.assets?.[0]?.uri;
    if (!uri) return;
    setImageUri(uri);
    analyzeMutation.mutate(uri);
  };

  return (
    <ScrollView style={styles.container}>
      <TouchableOpacity style={styles.cameraBtn} onPress={pickImage}>
        {imageUri ? (
          <Image source={{ uri: imageUri }} style={styles.preview} />
        ) : (
          <Text style={styles.cameraBtnText}>+ 食事を撮影/選択</Text>
        )}
      </TouchableOpacity>

      {analyzeMutation.isPending && <ActivityIndicator style={{ marginVertical: 16 }} />}

      {result && !result.error && (
        <View style={styles.resultCard}>
          <Text style={styles.resultTitle}>{result.menu_name}</Text>
          <View style={styles.macroRow}>
            <MacroItem label="カロリー" value={`${result.kcal}kcal`} />
            <MacroItem label="たんぱく質" value={`${result.protein_g}g`} />
            <MacroItem label="脂質" value={`${result.fat_g}g`} />
            <MacroItem label="糖質" value={`${result.carb_g}g`} />
          </View>
          {result.confidence !== 'high' && (
            <Text style={styles.confidenceWarning}>精度: {result.confidence} — 数値を確認してください</Text>
          )}
        </View>
      )}

      <Text style={styles.sectionTitle}>今日の食事記録</Text>
      {(history || []).map((item: any) => (
        <View key={item.SK} style={styles.historyItem}>
          <Text style={styles.historyName}>{item.menuName || '未解析'}</Text>
          <Text style={styles.historyKcal}>{item.kcal}kcal</Text>
        </View>
      ))}
    </ScrollView>
  );
}

const MacroItem = ({ label, value }: { label: string; value: string }) => (
  <View style={styles.macroItem}>
    <Text style={styles.macroLabel}>{label}</Text>
    <Text style={styles.macroValue}>{value}</Text>
  </View>
);

const styles = StyleSheet.create({
  container:         { flex: 1, backgroundColor: '#F8F9FA', padding: 16 },
  cameraBtn:         { height: 180, backgroundColor: '#E8F4FF', borderRadius: 12, justifyContent: 'center', alignItems: 'center', marginBottom: 16 },
  cameraBtnText:     { fontSize: 16, color: '#007AFF' },
  preview:           { width: '100%', height: '100%', borderRadius: 12 },
  resultCard:        { backgroundColor: '#FFF', borderRadius: 12, padding: 16, marginBottom: 16, elevation: 2 },
  resultTitle:       { fontSize: 18, fontWeight: 'bold', marginBottom: 12 },
  macroRow:          { flexDirection: 'row', justifyContent: 'space-around' },
  macroItem:         { alignItems: 'center' },
  macroLabel:        { fontSize: 11, color: '#666' },
  macroValue:        { fontSize: 15, fontWeight: 'bold', marginTop: 2 },
  confidenceWarning: { marginTop: 8, color: '#FF9500', fontSize: 12 },
  sectionTitle:      { fontSize: 16, fontWeight: 'bold', marginBottom: 8, marginTop: 8 },
  historyItem:       { flexDirection: 'row', justifyContent: 'space-between', backgroundColor: '#FFF', padding: 12, borderRadius: 8, marginBottom: 6 },
  historyName:       { fontSize: 14 },
  historyKcal:       { fontSize: 14, color: '#FF6B35', fontWeight: 'bold' },
});
