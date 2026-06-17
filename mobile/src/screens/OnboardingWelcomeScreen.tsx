import React, { useRef, useState } from 'react';
import {
  View, Text, TouchableOpacity, StyleSheet,
  FlatList, Dimensions, Linking, Alert,
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { colors } from '../theme/colors';

const { width: SW } = Dimensions.get('window');

// ─── スライドデータ ─────────────────────────────
type SlideType = 'feature' | 'consent';

interface FeatureSlide {
  type: 'feature';
  icon: React.ReactNode;
  label: string;
  title: string;
  desc: string;
  notes?: string[];
}
interface ConsentSlide {
  type: 'consent';
}

type Slide = FeatureSlide | ConsentSlide;

// アイコン部品（ライブラリ不要・View組み合わせ）
function IconBrand() {
  return (
    <View style={iconS.brandOuter}>
      <View style={iconS.brandInner}>
        <Text style={iconS.brandA}>A</Text>
      </View>
    </View>
  );
}
function IconSuggest() {
  return (
    <View style={iconS.box}>
      {[0, 1, 2].map(i => (
        <View key={i} style={[iconS.bar, { width: 56 - i * 12, opacity: 1 - i * 0.25 }]} />
      ))}
      <View style={iconS.spark} />
    </View>
  );
}
function IconRecord() {
  return (
    <View style={iconS.box}>
      <View style={iconS.recordOuter}>
        <View style={iconS.recordInner} />
      </View>
      <View style={iconS.lens} />
    </View>
  );
}
function IconShare() {
  return (
    <View style={iconS.box}>
      <View style={iconS.arrowBox}>
        <Text style={iconS.arrowText}>↗</Text>
      </View>
      <View style={iconS.dotRow}>
        {[colors.neon.blue, colors.neon.orange, colors.neon.green].map((c, i) => (
          <View key={i} style={[iconS.dot, { backgroundColor: c }]} />
        ))}
      </View>
    </View>
  );
}

const SLIDES: Slide[] = [
  {
    type: 'feature',
    icon: <IconBrand />,
    label: 'AIMORPHO',
    title: '体を変える、\nAIと一緒に。',
    desc: 'AIコーチが食事・運動を分析し、あなた専用のアドバイスを提供します。記録が積み重なるほど、アバターも進化します。',
    notes: [],
  },
  {
    type: 'feature',
    icon: <IconSuggest />,
    label: 'AI COACHING',
    title: 'AIが提案する\n食事と運動。',
    desc: '体重・体脂肪・目標をもとに、今日食べるべきもの・取り組むべきトレーニングをAIがリアルタイムに提案します。',
    notes: [
      '食事の栄養バランス提案',
      '目標に合わせた運動メニュー提案',
      'ジム有無・活動レベルに最適化',
    ],
  },
  {
    type: 'feature',
    icon: <IconRecord />,
    label: 'AI LOGGING',
    title: 'AIが記録を\nラクにする。',
    desc: '食事の写真を撮るだけでカロリー・栄養素を自動解析。運動はセットごとに記録し、進捗をグラフで確認できます。',
    notes: [
      '写真・カメラへのアクセスを使用',
      '写真はAI解析後、サーバーに保存されません',
      'アバター生成用写真はGemini AIで処理後に削除',
    ],
  },
  {
    type: 'feature',
    icon: <IconShare />,
    label: 'SHARE & GROW',
    title: '成果をシェア、\nアバターで証明。',
    desc: '記録が積み重なるほどアバターが変化。獲得したバッジや体型の変化をSNSに投稿して仲間と共有できます。',
    notes: [
      'SNS投稿は任意（強制されません）',
      'グループ機能でフレンドと競い合える',
    ],
  },
  { type: 'consent' },
];

// ─── メインコンポーネント ──────────────────────
export default function OnboardingWelcomeScreen() {
  const navigation = useNavigation<any>();
  const listRef = useRef<FlatList>(null);
  const [pageIndex, setPageIndex] = useState(0);
  const [agreedTerms, setAgreedTerms] = useState(false);
  const [agreedPrivacy, setAgreedPrivacy] = useState(false);

  const total = SLIDES.length;
  const isLast = pageIndex === total - 1;

  const goTo = (idx: number) => {
    listRef.current?.scrollToIndex({ index: idx, animated: true });
    setPageIndex(idx);
  };

  const handleNext = () => {
    if (isLast) {
      if (!agreedTerms || !agreedPrivacy) {
        Alert.alert('同意が必要', '利用規約とプライバシーポリシーに同意してください');
        return;
      }
      navigation.navigate('OnboardingProfile');
    } else {
      goTo(pageIndex + 1);
    }
  };

  const openTerms = () =>
    Linking.openURL('https://aimorpho.app/terms').catch(() =>
      Alert.alert('エラー', 'ページを開けませんでした'));

  const openPrivacy = () =>
    Linking.openURL('https://aimorpho.app/privacy').catch(() =>
      Alert.alert('エラー', 'ページを開けませんでした'));

  return (
    <View style={styles.root}>
      <FlatList
        ref={listRef}
        data={SLIDES}
        keyExtractor={(_, i) => String(i)}
        horizontal
        pagingEnabled
        showsHorizontalScrollIndicator={false}
        scrollEnabled={false}
        getItemLayout={(_, index) => ({ length: SW, offset: SW * index, index })}
        renderItem={({ item }) => {
          if (item.type === 'consent') return <ConsentPage />;
          return <FeaturePage slide={item} />;
        }}
      />

      {/* ドットインジケーター */}
      <View style={styles.dotsRow}>
        {SLIDES.map((_, i) => (
          <View
            key={i}
            style={[styles.dot, i === pageIndex && styles.dotActive]}
          />
        ))}
      </View>

      {/* ナビゲーションボタン */}
      <View style={styles.navRow}>
        {pageIndex > 0 ? (
          <TouchableOpacity style={styles.backBtn} onPress={() => goTo(pageIndex - 1)}>
            <Text style={styles.backText}>← 戻る</Text>
          </TouchableOpacity>
        ) : (
          <View style={{ flex: 1 }} />
        )}

        <TouchableOpacity
          style={[
            styles.nextBtn,
            isLast && !(agreedTerms && agreedPrivacy) && styles.nextBtnDisabled,
          ]}
          onPress={handleNext}
        >
          <Text style={styles.nextText}>
            {isLast ? '同意して始める' : '次へ →'}
          </Text>
        </TouchableOpacity>
      </View>
    </View>
  );

  // ─── 同意ページ（内部コンポーネント） ───────────
  function ConsentPage() {
    return (
      <View style={[styles.page, styles.consentPage]}>
        <View style={styles.consentShield}>
          <Text style={styles.shieldChar}>◈</Text>
        </View>
        <Text style={styles.consentTitle}>はじめる前に</Text>
        <Text style={styles.consentDesc}>
          AIMORPHOをご利用いただくには、以下への同意が必要です。
        </Text>

        <View style={styles.consentCard}>
          {/* 利用規約 */}
          <TouchableOpacity
            style={styles.checkRow}
            onPress={() => setAgreedTerms(v => !v)}
            activeOpacity={0.8}
          >
            <View style={[styles.checkbox, agreedTerms && styles.checkboxOn]}>
              {agreedTerms && <Text style={styles.checkmark}>✓</Text>}
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.checkLabel}>利用規約に同意する</Text>
              <TouchableOpacity onPress={openTerms} hitSlop={{ top: 4, bottom: 4, left: 4, right: 4 }}>
                <Text style={styles.checkLink}>利用規約を確認する →</Text>
              </TouchableOpacity>
            </View>
          </TouchableOpacity>

          <View style={styles.divider} />

          {/* プライバシーポリシー */}
          <TouchableOpacity
            style={styles.checkRow}
            onPress={() => setAgreedPrivacy(v => !v)}
            activeOpacity={0.8}
          >
            <View style={[styles.checkbox, agreedPrivacy && styles.checkboxOn]}>
              {agreedPrivacy && <Text style={styles.checkmark}>✓</Text>}
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.checkLabel}>プライバシーポリシーに同意する</Text>
              <TouchableOpacity onPress={openPrivacy} hitSlop={{ top: 4, bottom: 4, left: 4, right: 4 }}>
                <Text style={styles.checkLink}>プライバシーポリシーを確認する →</Text>
              </TouchableOpacity>
            </View>
          </TouchableOpacity>
        </View>

        <View style={styles.noticeBox}>
          <Text style={styles.noticeText}>
            カメラ・写真ライブラリへのアクセス、プッシュ通知の許可は、機能利用時に個別に確認します。
          </Text>
        </View>
      </View>
    );
  }
}

// ─── フィーチャーページ ─────────────────────────
function FeaturePage({ slide }: { slide: FeatureSlide }) {
  return (
    <View style={[styles.page, styles.featurePage]}>
      <Text style={styles.featureLabel}>{slide.label}</Text>
      <View style={styles.iconArea}>{slide.icon}</View>
      <Text style={styles.featureTitle}>{slide.title}</Text>
      <Text style={styles.featureDesc}>{slide.desc}</Text>
      {slide.notes && slide.notes.length > 0 && (
        <View style={styles.noteList}>
          {slide.notes.map((n, i) => (
            <View key={i} style={styles.noteRow}>
              <View style={styles.noteDot} />
              <Text style={styles.noteText}>{n}</Text>
            </View>
          ))}
        </View>
      )}
    </View>
  );
}

// ─── アイコン スタイル ──────────────────────────
const iconS = StyleSheet.create({
  brandOuter: {
    width: 96, height: 96, borderRadius: 48,
    borderWidth: 2, borderColor: colors.neon.blue,
    justifyContent: 'center', alignItems: 'center',
    backgroundColor: 'rgba(47,200,255,0.08)',
  },
  brandInner: {
    width: 72, height: 72, borderRadius: 36,
    borderWidth: 1, borderColor: 'rgba(47,200,255,0.4)',
    justifyContent: 'center', alignItems: 'center',
  },
  brandA: { fontSize: 40, fontWeight: '900', color: colors.neon.blue, letterSpacing: -2 },
  box:    { width: 100, height: 100, justifyContent: 'center', alignItems: 'center', gap: 8 },
  bar:    { height: 5, borderRadius: 3, backgroundColor: colors.neon.blue },
  spark:  { width: 10, height: 10, borderRadius: 5, backgroundColor: colors.neon.orange, position: 'absolute', top: 8, right: 8 },
  recordOuter: { width: 72, height: 72, borderRadius: 36, borderWidth: 2, borderColor: colors.neon.orange, justifyContent: 'center', alignItems: 'center' },
  recordInner: { width: 48, height: 48, borderRadius: 24, borderWidth: 1, borderColor: 'rgba(255,128,51,0.5)', backgroundColor: 'rgba(255,128,51,0.1)' },
  lens:   { width: 14, height: 14, borderRadius: 7, backgroundColor: colors.neon.orange, position: 'absolute', top: 14, right: 14 },
  arrowBox: { width: 72, height: 72, borderRadius: 16, borderWidth: 2, borderColor: colors.neon.green, justifyContent: 'center', alignItems: 'center', backgroundColor: 'rgba(74,222,128,0.08)' },
  arrowText: { fontSize: 36, color: colors.neon.green, lineHeight: 42 },
  dotRow: { flexDirection: 'row', gap: 6, position: 'absolute', bottom: 4 },
  dot:    { width: 8, height: 8, borderRadius: 4 },
});

// ─── メインスタイル ─────────────────────────────
const styles = StyleSheet.create({
  root:             { flex: 1, backgroundColor: colors.bg.primary },
  page:             { width: SW },
  featurePage:      { flex: 1, paddingHorizontal: 32, paddingTop: 80, paddingBottom: 16 },
  featureLabel:     { fontSize: 11, fontWeight: '700', letterSpacing: 2, color: colors.text.muted, marginBottom: 32, textAlign: 'center' },
  iconArea:         { alignItems: 'center', marginBottom: 36 },
  featureTitle:     { fontSize: 28, fontWeight: '800', color: colors.text.primary, lineHeight: 38, textAlign: 'center', marginBottom: 16 },
  featureDesc:      { fontSize: 15, color: colors.text.secondary, lineHeight: 24, textAlign: 'center', marginBottom: 20 },
  noteList:         { alignSelf: 'stretch', gap: 8, marginTop: 4 },
  noteRow:          { flexDirection: 'row', alignItems: 'flex-start', gap: 10 },
  noteDot:          { width: 5, height: 5, borderRadius: 3, backgroundColor: colors.neon.blue, marginTop: 8 },
  noteText:         { flex: 1, fontSize: 13, color: colors.text.muted, lineHeight: 20 },

  consentPage:      { flex: 1, paddingHorizontal: 28, paddingTop: 64, paddingBottom: 16, alignItems: 'center' },
  consentShield:    { width: 80, height: 80, borderRadius: 20, backgroundColor: 'rgba(47,200,255,0.1)', borderWidth: 1, borderColor: colors.border.blue, justifyContent: 'center', alignItems: 'center', marginBottom: 24 },
  shieldChar:       { fontSize: 36, color: colors.neon.blue },
  consentTitle:     { fontSize: 24, fontWeight: '800', color: colors.text.primary, marginBottom: 10 },
  consentDesc:      { fontSize: 14, color: colors.text.secondary, textAlign: 'center', lineHeight: 22, marginBottom: 24 },
  consentCard:      { width: '100%', backgroundColor: colors.bg.card, borderRadius: 14, borderWidth: 1, borderColor: colors.border.subtle, overflow: 'hidden', marginBottom: 14 },
  checkRow:         { flexDirection: 'row', alignItems: 'flex-start', gap: 14, padding: 16 },
  checkbox:         { width: 24, height: 24, borderRadius: 6, borderWidth: 2, borderColor: colors.text.muted, justifyContent: 'center', alignItems: 'center', marginTop: 2 },
  checkboxOn:       { backgroundColor: colors.neon.blue, borderColor: colors.neon.blue },
  checkmark:        { color: colors.bg.primary, fontSize: 14, fontWeight: '700' },
  checkLabel:       { fontSize: 14, fontWeight: '600', color: colors.text.primary, marginBottom: 4 },
  checkLink:        { fontSize: 12, color: colors.neon.blue },
  divider:          { height: 1, backgroundColor: colors.border.subtle, marginHorizontal: 16 },
  noticeBox:        { width: '100%', backgroundColor: colors.bg.cardAlt, borderRadius: 10, padding: 14, borderWidth: 1, borderColor: colors.border.subtle },
  noticeText:       { fontSize: 12, color: colors.text.muted, lineHeight: 18, textAlign: 'center' },

  dotsRow:          { flexDirection: 'row', justifyContent: 'center', gap: 6, paddingBottom: 12 },
  dot:              { width: 6, height: 6, borderRadius: 3, backgroundColor: colors.bg.cardAlt },
  dotActive:        { backgroundColor: colors.neon.blue, width: 18, borderRadius: 3 },

  navRow:           { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 24, paddingBottom: 40, gap: 12 },
  backBtn:          { flex: 1, paddingVertical: 14, alignItems: 'center' },
  backText:         { color: colors.text.muted, fontSize: 15 },
  nextBtn:          { flex: 2, backgroundColor: colors.neon.blue, borderRadius: 12, paddingVertical: 16, alignItems: 'center' },
  nextBtnDisabled:  { backgroundColor: colors.bg.cardAlt },
  nextText:         { color: colors.bg.primary, fontSize: 16, fontWeight: 'bold' },
});
