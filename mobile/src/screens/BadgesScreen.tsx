import React from 'react';
import { View, Text, FlatList, StyleSheet, ActivityIndicator } from 'react-native';
import { useQuery } from '@tanstack/react-query';
import api from '../api/client';

const BADGE_ICONS: Record<string, string> = {
  streak_3:     '🔥',
  streak_7:     '⚡',
  streak_30:    '💪',
  streak_100:   '👑',
  meal_10:      '🍽️',
  meal_50:      '🍱',
  exercise_10:  '🏃',
  exercise_50:  '🏅',
  weight_first: '⚖️',
  goal_achieve: '🎯',
  recovery:     '🌟',
};

const ALL_BADGES = [
  { id: 'streak_3',     name: '3日連続',       description: '3日連続ログイン' },
  { id: 'streak_7',     name: '1週間継続',      description: '7日連続ログイン' },
  { id: 'streak_30',    name: '1ヶ月継続',      description: '30日連続ログイン' },
  { id: 'streak_100',   name: '100日達人',      description: '100日連続ログイン' },
  { id: 'meal_10',      name: '食事記録10回',   description: '食事記録10回達成' },
  { id: 'meal_50',      name: '食事記録50回',   description: '食事記録50回達成' },
  { id: 'exercise_10',  name: '運動10回',       description: '運動記録10回達成' },
  { id: 'exercise_50',  name: '運動50回',       description: '運動記録50回達成' },
  { id: 'weight_first', name: '初計測',         description: '初めて体重を記録' },
  { id: 'goal_achieve', name: '目標達成！',     description: '目標体重を達成' },
  { id: 'recovery',     name: '立ち直り',       description: 'ペナルティから回復' },
];

export default function BadgesScreen() {
  const { data: earned, isLoading } = useQuery({
    queryKey: ['badges'],
    queryFn: () => api.get('/users/me/badges').then(r => r.data as any[]),
  });

  const earnedIds = new Set((earned || []).map((b: any) => b.badgeId));

  if (isLoading) return <ActivityIndicator style={{ flex: 1 }} />;

  return (
    <View style={styles.container}>
      <Text style={styles.header}>{earnedIds.size} / {ALL_BADGES.length} 取得済み</Text>
      <FlatList
        data={ALL_BADGES}
        keyExtractor={b => b.id}
        numColumns={3}
        renderItem={({ item }) => {
          const got = earnedIds.has(item.id);
          return (
            <View style={[styles.cell, !got && styles.cellLocked]}>
              <Text style={[styles.icon, !got && styles.iconLocked]}>{BADGE_ICONS[item.id] || '🏆'}</Text>
              <Text style={[styles.name, !got && styles.nameLocked]}>{item.name}</Text>
              <Text style={styles.desc}>{item.description}</Text>
            </View>
          );
        }}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container:  { flex: 1, backgroundColor: '#F8F9FA', padding: 16 },
  header:     { fontSize: 15, fontWeight: 'bold', textAlign: 'center', marginBottom: 16, color: '#555' },
  cell:       { flex: 1, margin: 5, backgroundColor: '#FFF', borderRadius: 12, padding: 12, alignItems: 'center', elevation: 2 },
  cellLocked: { backgroundColor: '#F0F0F0', elevation: 0 },
  icon:       { fontSize: 32, marginBottom: 6 },
  iconLocked: { opacity: 0.3 },
  name:       { fontSize: 11, fontWeight: 'bold', textAlign: 'center', color: '#333' },
  nameLocked: { color: '#AAA' },
  desc:       { fontSize: 9, textAlign: 'center', color: '#999', marginTop: 2 },
});
