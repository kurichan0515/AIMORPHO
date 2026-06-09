import React, { useState } from 'react';
import { View, Text, TouchableOpacity, Image, TextInput, StyleSheet, Alert, ScrollView, ActivityIndicator } from 'react-native';
import { launchImageLibrary } from 'react-native-image-picker';
import { useMutation, useQuery } from '@tanstack/react-query';
import { getMealUploadUrl, analyzeMeal, uploadImageToS3, getMealHistory } from '../api/logs';
import api from '../api/client';

interface MealResult {
  menu_name: string;
  kcal: number;
  protein_g: number;
  fat_g: number;
  carb_g: number;
  confidence: 'high' | 'medium' | 'low';
  error?: string;
}

interface ManualForm {
  menu_name: string;
  kcal: string;
  protein_g: string;
  fat_g: string;
  carb_g: string;
}

export default function MealLogScreen() {
  const [imageUri, setImageUri] = useState<string | null>(null);
  const [result, setResult] = useState<MealResult | null>(null);
  const [manualMode, setManualMode] = useState(false);
  const [manual, setManual] = useState<ManualForm>({ menu_name: '', kcal: '', protein_g: '', fat_g: '', carb_g: '' });

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
      Alert.alert('エラー', '解析に失敗しました。手動で入力してください。');
    },
  });

  const manualMutation = useMutation({
    mutationFn: () => api.post('/logs/meal/manual', {
      menuName: manual.menu_name || '手動入力',
      kcal: parseInt(manual.kcal, 10) || 0,
      proteinG: parseFloat(manual.protein_g) || 0,
      fatG: parseFloat(manual.fat_g) || 0,
      carbG: parseFloat(manual.carb_g) || 0,
    }).then(r => r.data),
    onSuccess: () => {
      setManualMode(false);
      setManual({ menu_name: '', kcal: '', protein_g: '', fat_g: '', carb_g: '' });
      refetch();
      Alert.alert('保存しました');
    },
    onError: () => Alert.alert('エラー', '保存に失敗しました'),
  });

  const submitManual = () => {
    if (!manual.kcal || isNaN(parseInt(manual.kcal, 10))) {
      Alert.alert('エラー', 'カロリーを入力してください');
      return;
    }
    manualMutation.mutate();
  };

  const pickImage = async () => {
    const res = await launchImageLibrary({ mediaType: 'photo', quality: 0.8 });
    const uri = res.assets?.[0]?.uri;
    if (!uri) return;
    setImageUri(uri);
    setManualMode(false);
    setResult(null);
    analyzeMutation.mutate(uri);
  };

  const mf = (key: keyof ManualForm, val: string) => setManual(p => ({ ...p, [key]: val }));

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

      {/* 手動入力フォーム */}
      {manualMode && (
        <View style={styles.manualCard}>
          <Text style={styles.manualTitle}>手動で入力</Text>
          <TextInput style={styles.manualInput} placeholder="料理名（任意）" value={manual.menu_name} onChangeText={v => mf('menu_name', v)} />
          <View style={styles.manualRow}>
            <View style={styles.manualHalf}>
              <Text style={styles.manualLabel}>カロリー *</Text>
              <View style={styles.manualInputWrapper}>
                <TextInput style={styles.manualInputInner} keyboardType="number-pad" value={manual.kcal} onChangeText={v => mf('kcal', v)} placeholder="500" />
                <Text style={styles.manualUnit}>kcal</Text>
              </View>
            </View>
            <View style={styles.manualHalf}>
              <Text style={styles.manualLabel}>たんぱく質</Text>
              <View style={styles.manualInputWrapper}>
                <TextInput style={styles.manualInputInner} keyboardType="decimal-pad" value={manual.protein_g} onChangeText={v => mf('protein_g', v)} placeholder="20" />
                <Text style={styles.manualUnit}>g</Text>
              </View>
            </View>
          </View>
          <View style={styles.manualRow}>
            <View style={styles.manualHalf}>
              <Text style={styles.manualLabel}>脂質</Text>
              <View style={styles.manualInputWrapper}>
                <TextInput style={styles.manualInputInner} keyboardType="decimal-pad" value={manual.fat_g} onChangeText={v => mf('fat_g', v)} placeholder="15" />
                <Text style={styles.manualUnit}>g</Text>
              </View>
            </View>
            <View style={styles.manualHalf}>
              <Text style={styles.manualLabel}>糖質</Text>
              <View style={styles.manualInputWrapper}>
                <TextInput style={styles.manualInputInner} keyboardType="decimal-pad" value={manual.carb_g} onChangeText={v => mf('carb_g', v)} placeholder="60" />
                <Text style={styles.manualUnit}>g</Text>
              </View>
            </View>
          </View>
          <TouchableOpacity style={styles.manualSaveBtn} onPress={submitManual} disabled={manualMutation.isPending}>
            <Text style={styles.manualSaveBtnText}>{manualMutation.isPending ? '保存中...' : '保存する'}</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.manualCancelBtn} onPress={() => setManualMode(false)}>
            <Text style={styles.manualCancelBtnText}>キャンセル</Text>
          </TouchableOpacity>
        </View>
      )}

      {/* 手動入力ボタン（解析前/解析後共通） */}
      {!manualMode && !analyzeMutation.isPending && (
        <TouchableOpacity style={styles.manualToggleBtn} onPress={() => setManualMode(true)}>
          <Text style={styles.manualToggleBtnText}>✏️ 手動で入力する</Text>
        </TouchableOpacity>
      )}

      <Text style={styles.sectionTitle}>最近の食事記録</Text>
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
  container:            { flex: 1, backgroundColor: '#F8F9FA', padding: 16 },
  cameraBtn:            { height: 180, backgroundColor: '#E8F4FF', borderRadius: 12, justifyContent: 'center', alignItems: 'center', marginBottom: 16 },
  cameraBtnText:        { fontSize: 16, color: '#007AFF' },
  preview:              { width: '100%', height: '100%', borderRadius: 12 },
  resultCard:           { backgroundColor: '#FFF', borderRadius: 12, padding: 16, marginBottom: 16, elevation: 2 },
  resultTitle:          { fontSize: 18, fontWeight: 'bold', marginBottom: 12 },
  macroRow:             { flexDirection: 'row', justifyContent: 'space-around' },
  macroItem:            { alignItems: 'center' },
  macroLabel:           { fontSize: 11, color: '#666' },
  macroValue:           { fontSize: 15, fontWeight: 'bold', marginTop: 2 },
  confidenceWarning:    { marginTop: 8, color: '#FF9500', fontSize: 12 },
  manualCard:           { backgroundColor: '#FFF', borderRadius: 12, padding: 16, marginBottom: 12, elevation: 2 },
  manualTitle:          { fontSize: 16, fontWeight: 'bold', marginBottom: 12 },
  manualInput:          { borderWidth: 1, borderColor: '#DDD', borderRadius: 8, padding: 12, fontSize: 15, marginBottom: 10 },
  manualRow:            { flexDirection: 'row', gap: 8, marginBottom: 8 },
  manualHalf:           { flex: 1 },
  manualLabel:          { fontSize: 12, color: '#666', marginBottom: 4 },
  manualInputWrapper:   { flexDirection: 'row', alignItems: 'center', borderWidth: 1, borderColor: '#DDD', borderRadius: 8, paddingHorizontal: 10, height: 44 },
  manualInputInner:     { flex: 1, fontSize: 16 },
  manualUnit:           { fontSize: 12, color: '#888' },
  manualSaveBtn:        { backgroundColor: '#007AFF', borderRadius: 10, padding: 14, alignItems: 'center', marginTop: 8 },
  manualSaveBtnText:    { color: '#FFF', fontWeight: 'bold', fontSize: 15 },
  manualCancelBtn:      { padding: 10, alignItems: 'center' },
  manualCancelBtnText:  { color: '#888', fontSize: 14 },
  manualToggleBtn:      { padding: 12, alignItems: 'center', marginBottom: 12 },
  manualToggleBtnText:  { color: '#007AFF', fontSize: 14 },
  sectionTitle:         { fontSize: 16, fontWeight: 'bold', marginBottom: 8, marginTop: 8 },
  historyItem:          { flexDirection: 'row', justifyContent: 'space-between', backgroundColor: '#FFF', padding: 12, borderRadius: 8, marginBottom: 6 },
  historyName:          { fontSize: 14 },
  historyKcal:          { fontSize: 14, color: '#FF6B35', fontWeight: 'bold' },
});
