import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { colors } from '../theme/colors';

interface State { hasError: boolean; error?: Error }

export default class ErrorBoundary extends React.Component<React.PropsWithChildren, State> {
  state: State = { hasError: false };

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, info: React.ErrorInfo) {
    console.error('[ErrorBoundary]', error, info.componentStack);
  }

  render() {
    if (!this.state.hasError) return this.props.children;
    return (
      <View style={s.container}>
        <Text style={s.icon}>⚠️</Text>
        <Text style={s.title}>エラーが発生しました</Text>
        <Text style={s.desc}>{this.state.error?.message ?? '不明なエラー'}</Text>
        <TouchableOpacity style={s.btn} onPress={() => this.setState({ hasError: false, error: undefined })}>
          <Text style={s.btnText}>再試行</Text>
        </TouchableOpacity>
      </View>
    );
  }
}

const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg.primary, justifyContent: 'center', alignItems: 'center', padding: 32 },
  icon:      { fontSize: 48, marginBottom: 16 },
  title:     { fontSize: 20, fontWeight: '800', color: colors.text.primary, marginBottom: 8 },
  desc:      { fontSize: 13, color: colors.text.muted, textAlign: 'center', lineHeight: 20, marginBottom: 24 },
  btn:       { backgroundColor: colors.neon.blue, borderRadius: 12, paddingVertical: 14, paddingHorizontal: 32 },
  btnText:   { color: colors.bg.primary, fontWeight: '700', fontSize: 15 },
});
