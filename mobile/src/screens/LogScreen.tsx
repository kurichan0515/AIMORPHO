import React, { useRef, useState } from 'react';
import {
  View, Text, TouchableOpacity, StyleSheet, ScrollView, Dimensions,
  NativeSyntheticEvent, NativeScrollEvent,
} from 'react-native';
import { useQuery } from '@tanstack/react-query';
import WeightLogScreen from './WeightLogScreen';
import MealLogScreen from './MealLogScreen';
import ExerciseLogScreen from './ExerciseLogScreen';
import { getMealHistory, getExerciseHistory } from '../api/logs';
import api from '../api/client';
import { colors } from '../theme/colors';

const { width: SCREEN_WIDTH } = Dimensions.get('window');

const TABS = [
  { key: 'weight',   label: '体重', component: WeightLogScreen },
  { key: 'meal',     label: '食事', component: MealLogScreen },
  { key: 'exercise', label: '運動', component: ExerciseLogScreen },
] as const;

const MEAL_TAB_INDEX = TABS.findIndex(t => t.key === 'meal');

// 今週の月曜日（ISO）を返す
const thisWeekStart = (): string => {
  const d = new Date();
  const day = d.getDay();
  const diff = day === 0 ? -6 : 1 - day;
  d.setDate(d.getDate() + diff);
  return d.toISOString().slice(0, 10);
};

// SummaryItem を先に定義（WeeklySummary が使うため）
const SummaryItem = React.memo(function SummaryItem({ icon, label, value, unit, highlight }: { icon: string; label: string; value: number; unit: string; highlight?: boolean }) {
  return (
    <View style={s.summaryItem}>
      <Text style={s.summaryIcon}>{icon}</Text>
      <Text style={[s.summaryValue, highlight && { color: colors.neon.orange }]}>{value}</Text>
      <Text style={s.summaryUnit}>{unit}</Text>
      <Text style={s.summaryLabel}>{label}</Text>
    </View>
  );
});

const WeeklySummary = React.memo(function WeeklySummary() {
  const weekStart = thisWeekStart();

  // InfiniteQuery(['mealHistory']) と競合しないよう別 queryKey を使用
  const { data: meals = [] } = useQuery({
    queryKey: ['mealHistoryWeekly'],
    queryFn: async () => { const p = await getMealHistory({ limit: 50 }); return p.items; },
    staleTime: 1000 * 60 * 5,
    refetchOnMount: false,
  });
  const { data: exercises = [] } = useQuery({
    queryKey: ['exerciseHistoryWeekly'],
    queryFn: async () => { const p = await getExerciseHistory({ limit: 50 }); return p.items; },
    staleTime: 1000 * 60 * 5,
    refetchOnMount: false,
  });
  const { data: streak } = useQuery({
    queryKey: ['streak'],
    queryFn: () => api.get('/users/me/streak').then(r => r.data),
    staleTime: 1000 * 60 * 5,
    refetchOnMount: false,
  });

  const mealCount    = meals.filter((m: { recordedAt?: string }) => (m.recordedAt?.slice(0, 10) ?? '') >= weekStart).length;
  const exerciseCount = exercises.filter((e: { recordedAt?: string }) => (e.recordedAt?.slice(0, 10) ?? '') >= weekStart).length;
  const streakDays = streak?.currentDays ?? 0;

  return (
    <View style={s.summary} accessibilityLabel={`今週: 食事${mealCount}回、運動${exerciseCount}回、${streakDays}日連続`}>
      <Text style={s.summaryTitle}>今週の記録</Text>
      <View style={s.summaryRow}>
        <SummaryItem icon="🍽" label="食事" value={mealCount} unit="回" />
        <View style={s.divider} />
        <SummaryItem icon="💪" label="運動" value={exerciseCount} unit="回" />
        <View style={s.divider} />
        <SummaryItem icon="🔥" label="継続" value={streakDays} unit="日" highlight={streakDays >= 3} />
      </View>
    </View>
  );
});

export default function LogScreen() {
  const [tab, setTab] = useState(MEAL_TAB_INDEX);
  const [mounted, setMounted] = useState(() => new Set([MEAL_TAB_INDEX]));
  const scrollRef = useRef<ScrollView>(null);

  const goToTab = (index: number) => {
    setTab(index);
    setMounted(prev => new Set([...prev, index]));
    scrollRef.current?.scrollTo({ x: index * SCREEN_WIDTH, animated: true });
  };

  const onMomentumScrollEnd = (e: NativeSyntheticEvent<NativeScrollEvent>) => {
    const index = Math.round(e.nativeEvent.contentOffset.x / SCREEN_WIDTH);
    setTab(index);
    setMounted(prev => new Set([...prev, index]));
  };

  return (
    <View style={styles.container}>
      <WeeklySummary />
      <View style={styles.tabRow}>
        {TABS.map((t, i) => (
          <TouchableOpacity
            key={t.key}
            style={[styles.tab, tab === i && styles.tabActive]}
            onPress={() => goToTab(i)}
            accessibilityLabel={t.label}
            accessibilityRole="tab"
            accessibilityState={{ selected: tab === i }}
          >
            <Text style={[styles.tabText, tab === i && styles.tabTextActive]}>{t.label}</Text>
          </TouchableOpacity>
        ))}
      </View>
      <ScrollView
        ref={scrollRef}
        horizontal
        pagingEnabled
        showsHorizontalScrollIndicator={false}
        onMomentumScrollEnd={onMomentumScrollEnd}
        contentOffset={{ x: MEAL_TAB_INDEX * SCREEN_WIDTH, y: 0 }}
      >
        {TABS.map((t, i) => {
          const ActiveComponent = t.component;
          return (
            <View key={t.key} style={{ width: SCREEN_WIDTH }}>
              {mounted.has(i) ? <ActiveComponent /> : null}
            </View>
          );
        })}
      </ScrollView>
    </View>
  );
}

const s = StyleSheet.create({
  summary:      { backgroundColor: colors.bg.card, borderBottomWidth: 1, borderBottomColor: colors.border.subtle, paddingHorizontal: 20, paddingTop: 12, paddingBottom: 12 },
  summaryTitle: { fontSize: 11, fontWeight: '700', color: colors.text.muted, letterSpacing: 1, marginBottom: 10 },
  summaryRow:   { flexDirection: 'row', alignItems: 'center' },
  summaryItem:  { flex: 1, alignItems: 'center', gap: 2 },
  summaryIcon:  { fontSize: 18 },
  summaryValue: { fontSize: 20, fontWeight: '800', color: colors.neon.blue },
  summaryUnit:  { fontSize: 11, color: colors.text.muted },
  summaryLabel: { fontSize: 10, color: colors.text.muted },
  divider:      { width: 1, height: 40, backgroundColor: colors.border.subtle },
});

const styles = StyleSheet.create({
  container:     { flex: 1, backgroundColor: colors.bg.primary },
  tabRow:        { flexDirection: 'row', backgroundColor: colors.bg.navBar, paddingTop: 8, borderBottomWidth: 1, borderBottomColor: colors.border.subtle },
  tab:           { flex: 1, paddingVertical: 12, alignItems: 'center', borderBottomWidth: 2, borderBottomColor: 'transparent' },
  tabActive:     { borderBottomColor: colors.neon.blue },
  tabText:       { fontSize: 14, color: colors.text.muted, fontWeight: '600' },
  tabTextActive: { color: colors.neon.blue },
});
