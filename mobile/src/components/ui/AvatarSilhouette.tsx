import React from 'react';
import { View, StyleSheet, ViewStyle } from 'react-native';
import Svg, { Defs, LinearGradient, Stop, Path, Circle } from 'react-native-svg';
import { colors } from '../../theme/colors';

interface AvatarSilhouetteProps {
  width?: number;
  height?: number;
  style?: ViewStyle;
}

export default function AvatarSilhouette({ width = 220, height = 320, style }: AvatarSilhouetteProps) {
  return (
    <View style={[styles.glow, style]}>
      <Svg width={width} height={height} viewBox="0 0 200 320">
        <Defs>
          <LinearGradient id="bodyGradient" x1="0%" y1="0%" x2="100%" y2="0%">
            <Stop offset="0" stopColor={colors.neon.blue} />
            <Stop offset="0.499" stopColor={colors.neon.blue} />
            <Stop offset="0.501" stopColor={colors.neon.orange} />
            <Stop offset="1" stopColor={colors.neon.orange} />
          </LinearGradient>
        </Defs>
        <Circle cx={100} cy={48} r={40} fill="url(#bodyGradient)" />
        <Path
          d="M40 320 V165 C40 105 65 76 100 76 C135 76 160 105 160 165 V320 Z"
          fill="url(#bodyGradient)"
        />
      </Svg>
    </View>
  );
}

const styles = StyleSheet.create({
  glow: {
    shadowColor: colors.neon.blue,
    shadowOpacity: 0.5,
    shadowRadius: 40,
    shadowOffset: { width: 0, height: 0 },
  },
});
