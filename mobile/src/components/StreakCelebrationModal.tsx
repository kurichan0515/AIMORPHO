import React, { useEffect, useRef } from 'react';
import { Modal, View, Text, TouchableOpacity, StyleSheet, Animated } from 'react-native';
import { colors } from '../theme/colors';

const MILESTONE_MESSAGES: Record<number, string> = {
  3:   'まず3日！習慣の始まり。',
  7:   '1週間達成！いい調子だ。',
  14:  '2週間継続！本物の習慣になってきた。',
  30:  '1ヶ月達成！すごい意志力だ。',
  60:  '2ヶ月！もう止められないね。',
  100: '100日！あなたは本物だ。',
};

type Props = {
  visible: boolean;
  streakDays: number;
  badgeName?: string;
  isComeback?: boolean;
  onDismiss: () => void;
};

export default function StreakCelebrationModal({ visible, streakDays, badgeName, isComeback, onDismiss }: Props) {
  const scaleAnim = useRef(new Animated.Value(0.6)).current;
  const opacityAnim = useRef(new Animated.Value(0)).current;
  const onDismissRef = useRef(onDismiss);
  onDismissRef.current = onDismiss;

  useEffect(() => {
    if (!visible) return;
    scaleAnim.setValue(0.6);
    opacityAnim.setValue(0);
    Animated.parallel([
      Animated.spring(scaleAnim, { toValue: 1, useNativeDriver: true, damping: 12, stiffness: 180 }),
      Animated.timing(opacityAnim, { toValue: 1, duration: 200, useNativeDriver: true }),
    ]).start();
    const timer = setTimeout(() => onDismissRef.current(), 3500);
    return () => clearTimeout(timer);
  }, [visible]);

  if (isComeback) {
    return (
      <Modal transparent animationType="none" visible={visible} onRequestClose={onDismiss}>
        <TouchableOpacity style={s.overlay} activeOpacity={1} onPress={onDismiss}>
          <Animated.View style={[s.card, s.comebackCard, { transform: [{ scale: scaleAnim }], opacity: opacityAnim }]}>
            <Text style={s.comebackIcon}>🔄</Text>
            <Text style={s.comebackTitle}>おかえり！</Text>
            <Text style={s.comebackSub}>また一緒に記録していこう</Text>
            <Text style={s.comebackDesc}>
              1日くらい休んでも大丈夫。{'\n'}再開した今日が一番大事。
            </Text>
            <TouchableOpacity style={s.okBtn} onPress={onDismiss}>
              <Text style={s.okBtnText}>よし、やるぞ！</Text>
            </TouchableOpacity>
          </Animated.View>
        </TouchableOpacity>
      </Modal>
    );
  }

  const message = MILESTONE_MESSAGES[streakDays] ?? `${streakDays}日連続達成！`;

  return (
    <Modal transparent animationType="none" visible={visible} onRequestClose={onDismiss}>
      <TouchableOpacity style={s.overlay} activeOpacity={1} onPress={onDismiss}>
        <Animated.View style={[s.card, { transform: [{ scale: scaleAnim }], opacity: opacityAnim }]}>
          <Text style={s.fire}>🔥</Text>
          <Text style={s.days}>{streakDays}</Text>
          <Text style={s.daysLabel}>日連続！</Text>
          {badgeName && (
            <View style={s.badgePill}>
              <Text style={s.badgePillText}>🏅 {badgeName} 獲得</Text>
            </View>
          )}
          <Text style={s.message}>{message}</Text>
          <TouchableOpacity style={s.okBtn} onPress={onDismiss}>
            <Text style={s.okBtnText}>OK！</Text>
          </TouchableOpacity>
        </Animated.View>
      </TouchableOpacity>
    </Modal>
  );
}

const s = StyleSheet.create({
  overlay:      { flex: 1, backgroundColor: 'rgba(0,0,0,0.75)', justifyContent: 'center', alignItems: 'center', padding: 32 },
  card:         { backgroundColor: colors.bg.card, borderRadius: 24, padding: 32, width: '100%', alignItems: 'center', borderWidth: 1.5, borderColor: colors.neon.orange },
  fire:         { fontSize: 64, marginBottom: 8 },
  days:         { fontSize: 80, fontWeight: '900', color: colors.neon.orange, lineHeight: 88 },
  daysLabel:    { fontSize: 22, fontWeight: '700', color: colors.text.primary, marginBottom: 16 },
  badgePill:    { backgroundColor: 'rgba(255,122,32,0.15)', borderRadius: 20, paddingHorizontal: 16, paddingVertical: 6, borderWidth: 1, borderColor: colors.neon.orange, marginBottom: 12 },
  badgePillText:{ fontSize: 13, fontWeight: '700', color: colors.neon.orange },
  message:      { fontSize: 15, color: colors.text.secondary, textAlign: 'center', lineHeight: 22, marginBottom: 24 },
  okBtn:        { backgroundColor: colors.neon.orange, borderRadius: 12, paddingVertical: 14, paddingHorizontal: 40 },
  okBtnText:    { color: colors.bg.primary, fontWeight: '800', fontSize: 16 },

  comebackCard: { borderColor: colors.neon.blue },
  comebackIcon: { fontSize: 56, marginBottom: 8 },
  comebackTitle:{ fontSize: 32, fontWeight: '900', color: colors.neon.blue, marginBottom: 6 },
  comebackSub:  { fontSize: 16, fontWeight: '700', color: colors.text.primary, marginBottom: 12 },
  comebackDesc: { fontSize: 14, color: colors.text.secondary, textAlign: 'center', lineHeight: 22, marginBottom: 24 },
});
