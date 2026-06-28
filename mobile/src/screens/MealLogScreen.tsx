import React, { useRef, useState } from 'react';
import { View, Text, TouchableOpacity, Image, TextInput, StyleSheet, Alert, ScrollView, ActivityIndicator } from 'react-native';
import Svg, { Rect, Line, Text as SvgText } from 'react-native-svg';
import { launchImageLibrary } from 'react-native-image-picker';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { getMealUploadUrl, analyzeMeal, confirmMeal, uploadImageToS3, getMealHistory } from '../api/logs';
import { getAiUsage } from '../api/ai';
import api from '../api/client';
import { colors } from '../theme/colors';
import PremiumGateModal from '../components/PremiumGateModal';
import Toast from '../components/Toast';
import StreakCelebrationModal from '../components/StreakCelebrationModal';
import { useStreakCelebration } from '../hooks/useStreakCelebration';
import { useToast } from '../hooks/useToast';

interface MealResult {
  menu_name: string;
  kcal: number;
  protein_g: number;
  fat_g: number;
  carb_g: number;
  confidence: 'high' | 'medium' | 'low';
  geminiRaw?: string;
  s3Key?: string;
  error?: string;
}

interface ManualForm {
  menu_name: string;
  kcal: string;
  protein_g: string;
  fat_g: string;
  carb_g: string;
}

const isLimitError = (err: any) => err?.response?.status === 429;

const MOCK_MEAL_HISTORY = [
  { SK: 'mock-1', menuName: '鶏むね肉とブロッコリー', kcal: 380, proteinG: 45, fatG: 8,  carbG: 12, recordedAt: '2026-06-16T08:00:00' },
  { SK: 'mock-2', menuName: 'プロテインシェイク',       kcal: 160, proteinG: 25, fatG: 3,  carbG: 15, recordedAt: '2026-06-16T15:00:00' },
  { SK: 'mock-3', menuName: '白米・味噌汁・焼き魚',     kcal: 520, proteinG: 28, fatG: 10, carbG: 75, recordedAt: '2026-06-15T19:00:00' },
  { SK: 'mock-4', menuName: 'オートミール',             kcal: 290, proteinG: 10, fatG: 6,  carbG: 52, recordedAt: '2026-06-15T08:00:00' },
  { SK: 'mock-5', menuName: 'サラダチキン',             kcal: 150, proteinG: 28, fatG: 2,  carbG: 4,  recordedAt: '2026-06-14T12:00:00' },
  { SK: 'mock-6', menuName: '玄米・豆腐味噌汁',         kcal: 380, proteinG: 15, fatG: 8,  carbG: 65, recordedAt: '2026-06-14T19:00:00' },
  { SK: 'mock-7', menuName: 'ギリシャヨーグルト',       kcal: 130, proteinG: 12, fatG: 5,  carbG: 8,  recordedAt: '2026-06-13T08:00:00' },
  { SK: 'mock-8', menuName: 'ゆで卵・全粒粉トースト',   kcal: 310, proteinG: 20, fatG: 12, carbG: 34, recordedAt: '2026-06-13T19:00:00' },
  { SK: 'mock-9', menuName: 'サーモン丼',               kcal: 560, proteinG: 32, fatG: 14, carbG: 70, recordedAt: '2026-06-12T12:00:00' },
];

function buildDailyKcal(items: any[]): { date: string; kcal: number }[] {
  const map: Record<string, number> = {};
  items.forEach(item => {
    const date = (item.recordedAt ?? item.SK ?? '').slice(0, 10);
    if (!date) return;
    map[date] = (map[date] || 0) + (item.kcal || 0);
  });
  return Object.entries(map)
    .sort(([a], [b]) => a.localeCompare(b))
    .slice(-7)
    .map(([date, kcal]) => ({ date, kcal }));
}

const CHART_W = 320;
const CHART_H = 160;
const BAR_AREA_H = 120;
const BAR_BOTTOM = CHART_H - 26;

function DailyKcalChart({ items, isMock }: { items: any[]; isMock: boolean }) {
  const daily = buildDailyKcal(items);
  if (daily.length === 0) return null;

  const maxKcal = Math.max(...daily.map(d => d.kcal));
  const barW = Math.floor((CHART_W - 20) / daily.length) - 4;

  return (
    <View style={styles.chartCard}>
      {isMock && (
        <View style={styles.mockBanner}>
          <Text style={styles.mockBannerText}>食事を記録するとここにグラフが表示されます</Text>
        </View>
      )}
      <Svg width={CHART_W} height={CHART_H}>
        {daily.map((d, i) => {
          const barH = Math.max(4, (d.kcal / maxKcal) * BAR_AREA_H);
          const x = 10 + i * ((CHART_W - 20) / daily.length) + 2;
          const y = BAR_BOTTOM - barH;
          return (
            <React.Fragment key={d.date}>
              <Rect
                x={x} y={y}
                width={barW} height={barH}
                rx={3}
                fill={isMock ? colors.text.muted : colors.neon.orange}
                opacity={isMock ? 0.4 : 0.85}
              />
              <SvgText
                x={x + barW / 2} y={BAR_BOTTOM + 16}
                fontSize={9} fill={colors.text.muted}
                textAnchor="middle"
              >
                {d.date.slice(5)}
              </SvgText>
              <SvgText
                x={x + barW / 2} y={y - 4}
                fontSize={9} fill={isMock ? colors.text.muted : colors.neon.orange}
                textAnchor="middle"
              >
                {d.kcal}
              </SvgText>
            </React.Fragment>
          );
        })}
        <Line x1={8} y1={BAR_BOTTOM} x2={CHART_W - 8} y2={BAR_BOTTOM} stroke={colors.border.subtle} strokeWidth={1} />
      </Svg>
    </View>
  );
}

export default function MealLogScreen() {
  const scrollRef = useRef<ScrollView>(null);
  const [imageUri, setImageUri] = useState<string | null>(null);
  const [result, setResult] = useState<MealResult | null>(null);
  const [manualMode, setManualMode] = useState(false);
  const [manual, setManual] = useState<ManualForm>({ menu_name: '', kcal: '', protein_g: '', fat_g: '', carb_g: '' });
  const [editingKcal, setEditingKcal] = useState(false);
  const [editedKcal, setEditedKcal] = useState('');
  const [premiumModal, setPremiumModal] = useState<{ visible: boolean; title: string; desc: string }>({ visible: false, title: '', desc: '' });
  const { toastVisible, toastMessage, showToast, hideToast } = useToast();
  const streak = useStreakCelebration();
  const qc = useQueryClient();

  const showPremiumModal = (title: string, desc: string) => setPremiumModal({ visible: true, title, desc });

  const { data: history, refetch } = useQuery({ queryKey: ['mealHistory'], queryFn: () => getMealHistory({ limit: 30 }) });
  const { data: aiUsage, refetch: refetchUsage } = useQuery({ queryKey: ['aiUsage'], queryFn: getAiUsage, staleTime: 0 });

  const displayHistory: any[] = history?.length ? history : MOCK_MEAL_HISTORY;
  const isMock = !history?.length;

  const analyzeMutation = useMutation({
    mutationFn: async (uri: string) => {
      const { uploadUrl, s3Key } = await getMealUploadUrl();
      await uploadImageToS3(uploadUrl, uri);
      return analyzeMeal(s3Key);
    },
    onSuccess: (data) => {
      refetchUsage();
      if (data.error === 'analysis_failed') {
        setManualMode(true);
        Alert.alert('解析失敗', '手動で入力してください');
      } else {
        setResult(data);
        setEditingKcal(false);
        setEditedKcal(String(data.kcal));
        if (data.confidence === 'low') {
          Alert.alert('確認', '解析結果の精度が低めです。内容を確認してください。');
        }
      }
    },
    onError: (err) => {
      if (isLimitError(err)) {
        setImageUri(null);
        showPremiumModal('AI解析の上限に達しました', '本日のAI食事解析回数の上限です。プレミアムプランで無制限にご利用いただけます。');
        return;
      }
      setManualMode(true);
      Alert.alert('エラー', '解析に失敗しました。手動で入力してください。');
    },
  });

  const confirmMutation = useMutation({
    mutationFn: (input: { kcal: number }) => {
      if (!result?.s3Key) { throw new Error('s3Key missing'); }
      return confirmMeal({
        s3Key: result.s3Key,
        menuName: result.menu_name,
        kcal: input.kcal,
        proteinG: result.protein_g,
        fatG: result.fat_g,
        carbG: result.carb_g,
        confidence: result.confidence,
        geminiRaw: result.geminiRaw,
      });
    },
    onSuccess: (data) => {
      setResult(null);
      setImageUri(null);
      setEditingKcal(false);
      refetch();
      qc.invalidateQueries({ queryKey: ['streak'] });
      streak.trigger(data);
      showToast('食事を記録しました');
    },
    onError: (err: any) => {
      if (isLimitError(err)) {
        showPremiumModal('月次記録の上限に達しました', '今月の食事記録件数の上限です。プレミアムプランで無制限に記録できます。');
        return;
      }
      Alert.alert('エラー', '登録に失敗しました');
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
    onSuccess: (data) => {
      setManualMode(false);
      setManual({ menu_name: '', kcal: '', protein_g: '', fat_g: '', carb_g: '' });
      refetch();
      qc.invalidateQueries({ queryKey: ['streak'] });
      streak.trigger(data);
      showToast('食事を記録しました');
    },
    onError: (err: any) => {
      if (isLimitError(err)) {
        showPremiumModal('月次記録の上限に達しました', '今月の食事記録件数の上限です。プレミアムプランで無制限に記録できます。');
        return;
      }
      Alert.alert('エラー', '保存に失敗しました');
    },
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
    if (!uri) { return; }
    setImageUri(uri);
    setManualMode(false);
    setResult(null);
    analyzeMutation.mutate(uri);
  };

  const fillFromHistory = (item: any) => {
    setManual({
      menu_name: item.menuName || '',
      kcal:      String(item.kcal || ''),
      protein_g: String(item.proteinG || ''),
      fat_g:     String(item.fatG || ''),
      carb_g:    String(item.carbG || ''),
    });
    setManualMode(true);
    scrollRef.current?.scrollTo({ y: 0, animated: true });
  };

  const mf = (key: keyof ManualForm, val: string) => setManual(p => ({ ...p, [key]: val }));

  return (
    <View style={{ flex: 1, backgroundColor: colors.bg.primary }}>
      <ScrollView ref={scrollRef} style={styles.container}>
        {aiUsage && !aiUsage.premium && aiUsage.limits && (
          <Text style={styles.usageBadge}>
            AI解析 本日残り {Math.max(0, aiUsage.limits.mealAnalysis - aiUsage.usage.mealAnalysis)}/{aiUsage.limits.mealAnalysis} 回
          </Text>
        )}
        <TouchableOpacity style={styles.cameraBtn} onPress={pickImage}>
          {imageUri ? (
            <Image source={{ uri: imageUri }} style={styles.preview} />
          ) : (
            <View style={styles.cameraBtnContent}>
              <Text style={styles.cameraBtnIcon}>📷</Text>
              <Text style={styles.cameraBtnText}>食事を撮影 / 選択</Text>
              <Text style={styles.cameraBtnSub}>タップしてライブラリを開く</Text>
            </View>
          )}
        </TouchableOpacity>

        {analyzeMutation.isPending && <ActivityIndicator style={{ marginVertical: 16 }} color={colors.neon.blue} />}

        {result && !result.error && (
          <View style={styles.resultCard}>
            <Text style={styles.resultTitle}>{result.menu_name}</Text>
            <View style={styles.macroRow}>
              <MacroItem label="カロリー" value={editingKcal ? `${editedKcal || 0}kcal` : `${result.kcal}kcal`} />
              <MacroItem label="たんぱく質" value={`${result.protein_g}g`} />
              <MacroItem label="脂質" value={`${result.fat_g}g`} />
              <MacroItem label="糖質" value={`${result.carb_g}g`} />
            </View>
            {result.confidence !== 'high' && (
              <Text style={styles.confidenceWarning}>精度: {result.confidence} — 数値を確認してください</Text>
            )}

            {editingKcal ? (
              <View style={styles.kcalEditRow}>
                <View style={styles.manualInputWrapper}>
                  <TextInput
                    style={styles.manualInputInner}
                    keyboardType="number-pad"
                    value={editedKcal}
                    onChangeText={setEditedKcal}
                    placeholder="kcal"
                    placeholderTextColor={colors.text.muted}
                  />
                  <Text style={styles.manualUnit}>kcal</Text>
                </View>
                <TouchableOpacity
                  style={[styles.confirmBtn, confirmMutation.isPending && styles.btnDisabled]}
                  disabled={confirmMutation.isPending}
                  onPress={() => {
                    const kcal = parseInt(editedKcal, 10);
                    if (isNaN(kcal)) { Alert.alert('エラー', 'カロリーを入力してください'); return; }
                    confirmMutation.mutate({ kcal });
                  }}
                >
                  <Text style={styles.confirmBtnText}>{confirmMutation.isPending ? '登録中...' : 'この内容で登録'}</Text>
                </TouchableOpacity>
              </View>
            ) : (
              <View style={styles.resultActions}>
                <TouchableOpacity
                  style={[styles.confirmBtn, confirmMutation.isPending && styles.btnDisabled]}
                  disabled={confirmMutation.isPending}
                  onPress={() => confirmMutation.mutate({ kcal: result.kcal })}
                >
                  <Text style={styles.confirmBtnText}>{confirmMutation.isPending ? '登録中...' : '登録する'}</Text>
                </TouchableOpacity>
                <TouchableOpacity style={styles.editKcalBtn} onPress={() => setEditingKcal(true)}>
                  <Text style={styles.editKcalBtnText}>カロリーを編集して登録</Text>
                </TouchableOpacity>
              </View>
            )}

            <Text style={styles.mealDisclaimer}>
              ※ カロリー・栄養値はAI推定値です。正確な値は食品表示をご確認ください。
            </Text>
          </View>
        )}

        {/* 手動入力フォーム */}
        {manualMode && (
          <View style={styles.manualCard}>
            <Text style={styles.manualTitle}>手動で入力</Text>
            <TextInput style={styles.manualInput} placeholder="料理名（任意）" placeholderTextColor={colors.text.muted} value={manual.menu_name} onChangeText={v => mf('menu_name', v)} />
            <View style={styles.manualRow}>
              <View style={styles.manualHalf}>
                <Text style={styles.manualLabel}>カロリー *</Text>
                <View style={styles.manualInputWrapper}>
                  <TextInput style={styles.manualInputInner} keyboardType="number-pad" value={manual.kcal} onChangeText={v => mf('kcal', v)} placeholder="500" placeholderTextColor={colors.text.muted} />
                  <Text style={styles.manualUnit}>kcal</Text>
                </View>
              </View>
              <View style={styles.manualHalf}>
                <Text style={styles.manualLabel}>たんぱく質</Text>
                <View style={styles.manualInputWrapper}>
                  <TextInput style={styles.manualInputInner} keyboardType="decimal-pad" value={manual.protein_g} onChangeText={v => mf('protein_g', v)} placeholder="20" placeholderTextColor={colors.text.muted} />
                  <Text style={styles.manualUnit}>g</Text>
                </View>
              </View>
            </View>
            <View style={styles.manualRow}>
              <View style={styles.manualHalf}>
                <Text style={styles.manualLabel}>脂質</Text>
                <View style={styles.manualInputWrapper}>
                  <TextInput style={styles.manualInputInner} keyboardType="decimal-pad" value={manual.fat_g} onChangeText={v => mf('fat_g', v)} placeholder="15" placeholderTextColor={colors.text.muted} />
                  <Text style={styles.manualUnit}>g</Text>
                </View>
              </View>
              <View style={styles.manualHalf}>
                <Text style={styles.manualLabel}>糖質</Text>
                <View style={styles.manualInputWrapper}>
                  <TextInput style={styles.manualInputInner} keyboardType="decimal-pad" value={manual.carb_g} onChangeText={v => mf('carb_g', v)} placeholder="60" placeholderTextColor={colors.text.muted} />
                  <Text style={styles.manualUnit}>g</Text>
                </View>
              </View>
            </View>
            <TouchableOpacity style={[styles.manualSaveBtn, manualMutation.isPending && styles.btnDisabled]} onPress={submitManual} disabled={manualMutation.isPending}>
              <Text style={styles.manualSaveBtnText}>{manualMutation.isPending ? '保存中...' : '保存する'}</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.manualCancelBtn} onPress={() => setManualMode(false)}>
              <Text style={styles.manualCancelBtnText}>キャンセル</Text>
            </TouchableOpacity>
          </View>
        )}

        {!manualMode && !analyzeMutation.isPending && (
          <TouchableOpacity style={styles.manualToggleBtn} onPress={() => setManualMode(true)}>
            <Text style={styles.manualToggleBtnText}>✏️ 手動で入力する</Text>
          </TouchableOpacity>
        )}

        <Text style={styles.sectionTitle}>日別摂取カロリー</Text>
        <DailyKcalChart items={displayHistory} isMock={isMock} />

        <Text style={styles.sectionTitle}>最近の食事記録</Text>
        <Text style={styles.historyHint}>タップで手動入力欄にコピー</Text>
        {displayHistory.map((item: any) => (
          <TouchableOpacity key={item.SK} style={styles.historyItem} onPress={() => fillFromHistory(item)}>
            <View style={styles.historyLeft}>
              <Text style={styles.historyName}>{item.menuName || '未解析'}</Text>
              {item.recordedAt && (
                <Text style={styles.historyDate}>{item.recordedAt.slice(5, 10)}</Text>
              )}
            </View>
            <View style={styles.historyRight}>
              {isMock && <Text style={styles.mockTag}>サンプル</Text>}
              <Text style={styles.historyKcal}>{item.kcal}kcal</Text>
              {item.proteinG != null && (
                <Text style={styles.historyMacro}>P{item.proteinG}g</Text>
              )}
            </View>
          </TouchableOpacity>
        ))}
        <View style={{ height: 24 }} />

        <PremiumGateModal
          visible={premiumModal.visible}
          onClose={() => setPremiumModal(p => ({ ...p, visible: false }))}
          title={premiumModal.title}
          description={premiumModal.desc}
        />
      </ScrollView>

      <Toast visible={toastVisible} message={toastMessage} onHide={hideToast} />

      {streak.celebration && (
        <StreakCelebrationModal
          visible={streak.visible}
          streakDays={streak.celebration.days}
          badgeName={streak.celebration.badgeName}
          isComeback={streak.celebration.isComeback}
          onDismiss={streak.dismiss}
        />
      )}
    </View>
  );
}

const MacroItem = ({ label, value }: { label: string; value: string }) => (
  <View style={styles.macroItem}>
    <Text style={styles.macroLabel}>{label}</Text>
    <Text style={styles.macroValue}>{value}</Text>
  </View>
);

const styles = StyleSheet.create({
  container:            { flex: 1, backgroundColor: colors.bg.primary, padding: 16 },
  usageBadge:           { fontSize: 11, color: colors.text.muted, textAlign: 'right', marginBottom: 4 },

  cameraBtn:            { height: 180, backgroundColor: colors.bg.card, borderRadius: 12, justifyContent: 'center', alignItems: 'center', marginBottom: 16, borderWidth: 1, borderColor: colors.border.subtle, borderStyle: 'dashed' },
  cameraBtnContent:     { alignItems: 'center', gap: 6 },
  cameraBtnIcon:        { fontSize: 36 },
  cameraBtnText:        { fontSize: 16, color: colors.neon.blue, fontWeight: '600' },
  cameraBtnSub:         { fontSize: 12, color: colors.text.muted },
  preview:              { width: '100%', height: '100%', borderRadius: 12 },

  resultCard:           { backgroundColor: colors.bg.card, borderRadius: 12, padding: 16, marginBottom: 16, borderWidth: 1, borderColor: colors.border.subtle },
  resultTitle:          { fontSize: 18, fontWeight: 'bold', marginBottom: 12, color: colors.text.primary },
  macroRow:             { flexDirection: 'row', justifyContent: 'space-around' },
  macroItem:            { alignItems: 'center' },
  macroLabel:           { fontSize: 11, color: colors.text.secondary },
  macroValue:           { fontSize: 15, fontWeight: 'bold', marginTop: 2, color: colors.text.primary },
  confidenceWarning:    { marginTop: 8, color: colors.neon.orange, fontSize: 12 },
  mealDisclaimer:       { marginTop: 12, color: colors.text.muted, fontSize: 11, lineHeight: 16 },
  resultActions:        { marginTop: 14, gap: 8 },
  kcalEditRow:          { marginTop: 14, gap: 8 },
  confirmBtn:           { backgroundColor: colors.neon.blue, borderRadius: 10, padding: 14, alignItems: 'center', minHeight: 50, justifyContent: 'center' },
  confirmBtnText:       { color: colors.bg.primary, fontWeight: 'bold', fontSize: 15 },
  btnDisabled:          { opacity: 0.6 },
  editKcalBtn:          { padding: 10, alignItems: 'center' },
  editKcalBtnText:      { color: colors.neon.blue, fontSize: 14 },

  manualCard:           { backgroundColor: colors.bg.card, borderRadius: 12, padding: 16, marginBottom: 12, borderWidth: 1, borderColor: colors.border.subtle },
  manualTitle:          { fontSize: 16, fontWeight: 'bold', marginBottom: 12, color: colors.text.primary },
  manualInput:          { borderWidth: 1, borderColor: colors.border.subtle, borderRadius: 8, padding: 12, fontSize: 15, marginBottom: 10, backgroundColor: colors.bg.cardAlt, color: colors.text.primary },
  manualRow:            { flexDirection: 'row', gap: 8, marginBottom: 8 },
  manualHalf:           { flex: 1 },
  manualLabel:          { fontSize: 12, color: colors.text.secondary, marginBottom: 4 },
  manualInputWrapper:   { flexDirection: 'row', alignItems: 'center', borderWidth: 1, borderColor: colors.border.subtle, borderRadius: 8, paddingHorizontal: 10, height: 44, backgroundColor: colors.bg.cardAlt },
  manualInputInner:     { flex: 1, fontSize: 16, color: colors.text.primary },
  manualUnit:           { fontSize: 12, color: colors.text.secondary },
  manualSaveBtn:        { backgroundColor: colors.neon.blue, borderRadius: 10, padding: 14, alignItems: 'center', marginTop: 8, minHeight: 50, justifyContent: 'center' },
  manualSaveBtnText:    { color: colors.bg.primary, fontWeight: 'bold', fontSize: 15 },
  manualCancelBtn:      { padding: 10, alignItems: 'center' },
  manualCancelBtnText:  { color: colors.text.secondary, fontSize: 14 },
  manualToggleBtn:      { padding: 12, alignItems: 'center', marginBottom: 12 },
  manualToggleBtnText:  { color: colors.neon.blue, fontSize: 14 },

  sectionTitle:         { fontSize: 16, fontWeight: 'bold', marginBottom: 8, marginTop: 8, color: colors.text.primary },
  chartCard:            { backgroundColor: colors.bg.card, borderRadius: 12, padding: 12, marginBottom: 16, borderWidth: 1, borderColor: colors.border.subtle },
  mockBanner:           { backgroundColor: 'rgba(106,122,150,0.15)', borderRadius: 8, padding: 10, marginBottom: 8 },
  mockBannerText:       { fontSize: 12, color: colors.text.muted, textAlign: 'center' },
  historyHint:          { fontSize: 11, color: colors.text.muted, marginBottom: 8, marginTop: -4 },
  historyItem:          { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', backgroundColor: colors.bg.card, padding: 12, borderRadius: 8, marginBottom: 6, borderWidth: 1, borderColor: colors.border.subtle },
  historyLeft:          { flex: 1, gap: 2 },
  historyName:          { fontSize: 14, color: colors.text.primary },
  historyDate:          { fontSize: 11, color: colors.text.muted },
  historyRight:         { flexDirection: 'row', alignItems: 'center', gap: 8 },
  historyKcal:          { fontSize: 14, color: colors.neon.orange, fontWeight: 'bold' },
  historyMacro:         { fontSize: 11, color: colors.neon.blue },
  mockTag:              { fontSize: 9, color: colors.text.muted, borderWidth: 1, borderColor: colors.border.subtle, borderRadius: 4, paddingHorizontal: 4, paddingVertical: 1 },
});
