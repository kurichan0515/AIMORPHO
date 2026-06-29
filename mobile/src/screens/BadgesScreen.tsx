import React from 'react';
import { View, Text, FlatList, StyleSheet, ActivityIndicator } from 'react-native';
import { useQuery } from '@tanstack/react-query';
import api from '../api/client';
import { getUserProgress } from '../api/logs';
import { colors } from '../theme/colors';

type Category = 'streak' | 'log' | 'achieve';

interface RewardDef {
  id: string;
  name: string;
  desc: string;
  symbol: string;
  category: Category;
}

const CATEGORY_META: Record<Category, { label: string; sub: string; color: string }> = {
  streak:  { label: '継続',   sub: 'STREAK',  color: colors.neon.blue   },
  log:     { label: '記録',   sub: 'LOG',     color: colors.neon.orange },
  achieve: { label: '達成',   sub: 'ACHIEVE', color: colors.neon.green  },
};

const ALL_REWARDS: RewardDef[] = [
  // streak
  { id: 'streak_3',       name: '3日連続',       desc: '3日連続でログを記録',          symbol: '3',   category: 'streak'  },
  { id: 'streak_7',       name: '1週間継続',     desc: '7日連続でログを記録',          symbol: '7',   category: 'streak'  },
  { id: 'streak_14',      name: '2週間継続',     desc: '14日連続でログを記録',         symbol: '14',  category: 'streak'  },
  { id: 'streak_30',      name: '1ヶ月継続',     desc: '30日連続でログを記録',         symbol: '30',  category: 'streak'  },
  { id: 'streak_60',      name: '2ヶ月継続',     desc: '60日連続でログを記録',         symbol: '60',  category: 'streak'  },
  { id: 'streak_100',     name: '100日継続',     desc: '100日連続でログを記録',        symbol: '∞',   category: 'streak'  },
  // log
  { id: 'weight_first',   name: '初計測',        desc: '初めて体重を記録',             symbol: '◉',   category: 'log'     },
  { id: 'meal_first',     name: '初食事記録',    desc: '初めて食事を記録',             symbol: '🍽',  category: 'log'     },
  { id: 'exercise_first', name: '初トレーニング', desc: '初めてトレーニングを記録',    symbol: '⚡',  category: 'log'     },
  { id: 'meal_10',        name: '食事 × 10',     desc: '食事を10回記録',               symbol: '◆',   category: 'log'     },
  { id: 'meal_50',        name: '食事 × 50',     desc: '食事を50回記録',               symbol: '◈',   category: 'log'     },
  { id: 'exercise_10',    name: '運動 × 10',     desc: '運動を10回記録',               symbol: '▲',   category: 'log'     },
  { id: 'exercise_50',    name: '運動 × 50',     desc: '運動を50回記録',               symbol: '▲▲',  category: 'log'     },
  // achieve
  { id: 'goal_achieve',   name: '目標達成',      desc: '目標体重をクリア',             symbol: '★',   category: 'achieve' },
  { id: 'recovery',       name: '体型回復',      desc: 'アバターを回復させた',          symbol: '↑',   category: 'achieve' },
  { id: 'comeback',       name: 'カムバック',    desc: '中断後に記録を再開',            symbol: '↺',   category: 'achieve' },
];

const REWARD_MAP = new Map(ALL_REWARDS.map(r => [r.id, r]));
const CATEGORIES: Category[] = ['streak', 'log', 'achieve'];

export default function BadgesScreen() {
  const { data: earned, isLoading } = useQuery({
    queryKey: ['badges'],
    queryFn: () => api.get('/users/me/badges').then(r => r.data as any[]),
  });
  const { data: progress } = useQuery({
    queryKey: ['userProgress'],
    queryFn: getUserProgress,
    staleTime: 1000 * 60 * 5,
  });
  const { data: streak } = useQuery({
    queryKey: ['streak'],
    queryFn: () => api.get('/users/me/streak').then(r => r.data),
    staleTime: 1000 * 60 * 5,
  });

  if (isLoading) {
    return <ActivityIndicator style={{ flex: 1 }} color={colors.neon.blue} />;
  }

  const earnedSet = new Set((earned || []).map((b: any) => b.badgeId as string));

  // ロックバッジの進捗計算（型ごとに現在値を返す）
  const getProgress = (reward: RewardDef): { current: number; total: number } | null => {
    if (earnedSet.has(reward.id)) return null;
    const streakDays = streak?.currentDays ?? 0;
    if (reward.category === 'streak') {
      const thresholds: Record<string, number> = { streak_3: 3, streak_7: 7, streak_14: 14, streak_30: 30, streak_60: 60, streak_100: 100 };
      const total = thresholds[reward.id];
      return total ? { current: Math.min(streakDays, total), total } : null;
    }
    return null;
  };

  const total = ALL_REWARDS.length;
  const got   = earnedSet.size;
  const pct   = total > 0 ? Math.round((got / total) * 100) : 0;

  const sections = CATEGORIES.map(cat => ({
    cat,
    rewards: ALL_REWARDS.filter(r => r.category === cat),
  }));

  return (
    <View style={s.root}>
      <View style={s.header}>
        <Text style={s.headerSub}>REWARDS</Text>
        <Text style={s.headerTitle}>{got} <Text style={s.headerOf}>/ {total}</Text></Text>
        <View style={s.progressTrack}>
          <View style={[s.progressFill, { width: `${pct}%` as any }]} />
        </View>
        <Text style={s.headerPct}>{pct}% 達成</Text>
        {got === 0 && (
          <Text style={s.emptyHint}>体重・食事・運動を記録してリワードを獲得しよう</Text>
        )}
      </View>

      <FlatList
        data={sections}
        keyExtractor={({ cat }) => cat}
        contentContainerStyle={s.list}
        showsVerticalScrollIndicator={false}
        renderItem={({ item: { cat, rewards } }) => {
          const meta = CATEGORY_META[cat];
          const catEarned = rewards.filter(r => earnedSet.has(r.id)).length;
          return (
            <View style={s.section}>
              <View style={s.catHeader}>
                <View style={[s.catBar, { backgroundColor: meta.color }]} />
                <Text style={[s.catSub, { color: meta.color }]}>{meta.sub}</Text>
                <Text style={s.catLabel}>{meta.label}</Text>
                <Text style={s.catCount}>{catEarned}/{rewards.length}</Text>
              </View>
              <View style={s.grid}>
                {rewards.map(r => {
                  const isEarned = earnedSet.has(r.id);
                  return (
                    <View
                      key={r.id}
                      style={[
                        s.card,
                        isEarned
                          ? { borderColor: meta.color, backgroundColor: `${meta.color}12` }
                          : s.cardLocked,
                      ]}
                    >
                      <Text style={[s.symbol, { color: isEarned ? meta.color : colors.text.muted }]}>
                        {r.symbol}
                      </Text>
                      <Text style={[s.cardName, !isEarned && s.lockedText]}>{r.name}</Text>
                      <Text style={[s.cardDesc, !isEarned && s.lockedDesc]}>{r.desc}</Text>
                      {!isEarned && (() => {
                        const prog = getProgress(r);
                        return prog ? (
                          <View style={s.progressWrap}>
                            <View style={s.badgeProgressTrack}>
                              <View style={[s.badgeProgressFill, { width: `${Math.round(prog.current / prog.total * 100)}%` as any, backgroundColor: meta.color }]} />
                            </View>
                            <Text style={[s.progressText, { color: meta.color }]}>{prog.current}/{prog.total}</Text>
                          </View>
                        ) : null;
                      })()}
                      <View style={[s.statusBadge, isEarned ? { backgroundColor: meta.color } : s.lockedBadge]}>
                        <Text style={[s.statusBadgeText, !isEarned && s.lockedBadgeText]}>
                          {isEarned ? 'GET' : 'LOCK'}
                        </Text>
                      </View>
                    </View>
                  );
                })}
              </View>
            </View>
          );
        }}
      />
    </View>
  );
}

const s = StyleSheet.create({
  root:   { flex: 1, backgroundColor: colors.bg.primary },
  header: { alignItems: 'center', paddingTop: 20, paddingBottom: 20, paddingHorizontal: 24 },
  headerSub:   { fontSize: 11, letterSpacing: 2, color: colors.text.muted, fontWeight: '700', marginBottom: 4 },
  headerTitle: { fontSize: 48, fontWeight: '800', color: colors.neon.blue, lineHeight: 56 },
  headerOf:    { fontSize: 24, color: colors.text.muted, fontWeight: '400' },
  progressTrack: { width: '100%', height: 4, backgroundColor: colors.bg.cardAlt, borderRadius: 2, marginTop: 12, marginBottom: 6, overflow: 'hidden' },
  progressFill:  { height: 4, backgroundColor: colors.neon.blue, borderRadius: 2 },
  headerPct:     { fontSize: 12, color: colors.text.secondary },
  emptyHint:     { fontSize: 13, color: colors.text.muted, textAlign: 'center', marginTop: 8, lineHeight: 20 },

  list:      { paddingHorizontal: 16, paddingBottom: 32 },
  section:   { marginBottom: 24 },
  catHeader: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 12 },
  catBar:    { width: 3, height: 16, borderRadius: 2 },
  catSub:    { fontSize: 10, fontWeight: '700', letterSpacing: 1.5 },
  catLabel:  { fontSize: 14, fontWeight: '700', color: colors.text.primary, flex: 1 },
  catCount:  { fontSize: 12, color: colors.text.muted },

  grid:        { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  card:        { width: '47%', backgroundColor: colors.bg.card, borderRadius: 14, padding: 14, borderWidth: 1, minHeight: 108 },
  cardLocked:  { backgroundColor: colors.bg.cardAlt, borderColor: colors.border.subtle },
  symbol:      { fontSize: 26, fontWeight: '800', marginBottom: 8, lineHeight: 32 },
  cardName:    { fontSize: 12, fontWeight: '700', color: colors.text.primary, marginBottom: 2 },
  cardDesc:    { fontSize: 10, color: colors.text.muted, lineHeight: 15 },
  lockedText:  { color: colors.text.muted },
  lockedDesc:  { color: colors.bg.card },

  statusBadge:     { position: 'absolute', top: 10, right: 10, paddingHorizontal: 6, paddingVertical: 2, borderRadius: 4 },
  statusBadgeText: { fontSize: 9, fontWeight: '800', color: colors.bg.primary, letterSpacing: 0.5 },
  lockedBadge:     { backgroundColor: 'transparent', borderWidth: 1, borderColor: colors.border.subtle },
  lockedBadgeText: { color: colors.text.muted },
  progressWrap:        { marginTop: 6, gap: 2 },
  badgeProgressTrack:  { height: 3, backgroundColor: colors.bg.cardAlt, borderRadius: 2, overflow: 'hidden' },
  badgeProgressFill:   { height: 3, borderRadius: 2 },
  progressText:        { fontSize: 9, fontWeight: '700', marginTop: 1 },
});
