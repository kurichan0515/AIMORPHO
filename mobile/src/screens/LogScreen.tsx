import React, { useRef, useState } from 'react';
import {
  View, Text, TouchableOpacity, StyleSheet, ScrollView, Dimensions,
  NativeSyntheticEvent, NativeScrollEvent,
} from 'react-native';
import WeightLogScreen from './WeightLogScreen';
import MealLogScreen from './MealLogScreen';
import ExerciseLogScreen from './ExerciseLogScreen';
import { colors } from '../theme/colors';

const { width: SCREEN_WIDTH } = Dimensions.get('window');

const TABS = [
  { key: 'weight',   label: '体重', component: WeightLogScreen },
  { key: 'meal',     label: '食事', component: MealLogScreen },
  { key: 'exercise', label: '運動', component: ExerciseLogScreen },
] as const;

export default function LogScreen() {
  const [tab, setTab] = useState(0);
  const scrollRef = useRef<ScrollView>(null);

  const goToTab = (index: number) => {
    setTab(index);
    scrollRef.current?.scrollTo({ x: index * SCREEN_WIDTH, animated: true });
  };

  const onMomentumScrollEnd = (e: NativeSyntheticEvent<NativeScrollEvent>) => {
    const index = Math.round(e.nativeEvent.contentOffset.x / SCREEN_WIDTH);
    setTab(index);
  };

  return (
    <View style={styles.container}>
      <View style={styles.tabRow}>
        {TABS.map((t, i) => (
          <TouchableOpacity
            key={t.key}
            style={[styles.tab, tab === i && styles.tabActive]}
            onPress={() => goToTab(i)}
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
      >
        {TABS.map((t) => {
          const ActiveComponent = t.component;
          return (
            <View key={t.key} style={{ width: SCREEN_WIDTH }}>
              <ActiveComponent />
            </View>
          );
        })}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container:     { flex: 1, backgroundColor: colors.bg.primary },
  tabRow:        { flexDirection: 'row', backgroundColor: colors.bg.navBar, paddingTop: 8, borderBottomWidth: 1, borderBottomColor: colors.border.subtle },
  tab:           { flex: 1, paddingVertical: 12, alignItems: 'center', borderBottomWidth: 2, borderBottomColor: 'transparent' },
  tabActive:     { borderBottomColor: colors.neon.blue },
  tabText:       { fontSize: 14, color: colors.text.muted, fontWeight: '600' },
  tabTextActive: { color: colors.neon.blue },
});
