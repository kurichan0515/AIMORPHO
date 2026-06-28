import React, { useEffect, useRef } from 'react';
import { Animated, Text, StyleSheet, View } from 'react-native';
import { colors } from '../theme/colors';

type ToastType = 'success' | 'info' | 'error';

type Props = {
  message: string;
  visible: boolean;
  onHide: () => void;
  type?: ToastType;
};

const TYPE_COLORS: Record<ToastType, string> = {
  success: colors.neon.green,
  info:    colors.neon.blue,
  error:   colors.danger,
};

export default function Toast({ message, visible, onHide, type = 'success' }: Props) {
  const translateY = useRef(new Animated.Value(80)).current;
  const opacity    = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (visible) {
      Animated.parallel([
        Animated.spring(translateY, { toValue: 0, useNativeDriver: true, damping: 14 }),
        Animated.timing(opacity, { toValue: 1, duration: 200, useNativeDriver: true }),
      ]).start();

      const timer = setTimeout(() => {
        Animated.parallel([
          Animated.timing(translateY, { toValue: 80, duration: 250, useNativeDriver: true }),
          Animated.timing(opacity, { toValue: 0, duration: 250, useNativeDriver: true }),
        ]).start(() => onHide());
      }, 2000);
      return () => clearTimeout(timer);
    } else {
      translateY.setValue(80);
      opacity.setValue(0);
    }
  }, [visible]);

  if (!visible) return null;

  const borderColor = TYPE_COLORS[type];

  return (
    <Animated.View style={[s.toast, { transform: [{ translateY }], opacity, borderLeftColor: borderColor }]}>
      <View style={[s.indicator, { backgroundColor: borderColor }]} />
      <Text style={s.text}>{message}</Text>
    </Animated.View>
  );
}

const s = StyleSheet.create({
  toast:     {
    position: 'absolute', bottom: 24, left: 16, right: 16,
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: colors.bg.card,
    borderRadius: 12, padding: 14,
    borderLeftWidth: 4,
    shadowColor: '#000', shadowOpacity: 0.4, shadowRadius: 12, shadowOffset: { width: 0, height: 4 },
    elevation: 8, zIndex: 999,
  },
  indicator: { width: 4, alignSelf: 'stretch', borderRadius: 2, marginRight: 12 },
  text:      { flex: 1, fontSize: 14, fontWeight: '600', color: colors.text.primary },
});
