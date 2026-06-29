import React, { useEffect, useState } from 'react';
import { Animated, StyleSheet, Text } from 'react-native';
import { subscribeNetworkStatus, getIsOffline } from '../utils/networkStatus';
import { colors } from '../theme/colors';

export default function OfflineBanner() {
  const [isOffline, setIsOffline] = useState(getIsOffline());
  const translateY = React.useRef(new Animated.Value(-40)).current;

  useEffect(() => {
    const unsubscribe = subscribeNetworkStatus(setIsOffline);
    return () => { unsubscribe(); };
  }, []);

  useEffect(() => {
    Animated.timing(translateY, {
      toValue: isOffline ? 0 : -40,
      duration: 250,
      useNativeDriver: true,
    }).start();
  }, [isOffline]);

  return (
    <Animated.View style={[s.banner, { transform: [{ translateY }] }]}>
      <Text style={s.text}>⚠️  オフライン — インターネット接続を確認してください</Text>
    </Animated.View>
  );
}

const s = StyleSheet.create({
  banner: {
    position: 'absolute', top: 0, left: 0, right: 0,
    backgroundColor: colors.danger,
    paddingVertical: 8, paddingHorizontal: 16,
    zIndex: 9999,
  },
  text: { color: '#fff', fontSize: 12, fontWeight: '600', textAlign: 'center' },
});
