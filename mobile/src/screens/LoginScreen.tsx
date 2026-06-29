import React, { useState } from 'react';
import { View, Text, TextInput, TouchableOpacity, StyleSheet, Alert, KeyboardAvoidingView, Platform } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { useQueryClient } from '@tanstack/react-query';
import { useAuthStore } from '../store/useAuthStore';
import { colors } from '../theme/colors';

export default function LoginScreen() {
  const navigation = useNavigation<any>();
  const qc = useQueryClient();
  const { loginAndRestore, recoverAndRestore } = useAuthStore();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const submit = async () => {
    setError('');
    if (!email.trim()) { setError('メールアドレスを入力してください'); return; }
    if (!password) { setError('パスワードを入力してください'); return; }
    setLoading(true);
    try {
      await loginAndRestore(email.trim(), password);
      qc.clear();
      navigation.navigate('Main');
    } catch (e: any) {
      // 削除済みアカウントで復活期間内
      if (e?.response?.status === 409) {
        try {
          const body = JSON.parse(e.response?.data?.message ?? '{}');
          if (body.code === 'ACCOUNT_RECOVERABLE') {
            const expiresDate = new Date(body.expiresAt).toLocaleDateString('ja-JP');
            Alert.alert(
              'アカウントが削除済みです',
              `このアカウントは削除されましたが、${expiresDate}まで復活できます。\n\nデータを復活させますか？`,
              [
                { text: 'キャンセル', style: 'cancel' },
                {
                  text: '復活させる',
                  onPress: async () => {
                    setLoading(true);
                    try {
                      await recoverAndRestore(email.trim(), password);
                      qc.clear();
                      navigation.navigate('Main');
                    } catch {
                      setError('復活に失敗しました。もう一度お試しください。');
                    } finally {
                      setLoading(false);
                    }
                  },
                },
              ]
            );
            return;
          }
        } catch {}
      }
      setError('メールまたはパスワードが正しくありません');
    } finally {
      setLoading(false);
    }
  };

  return (
    <KeyboardAvoidingView style={styles.container} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <Text style={styles.title}>既存アカウントで引き継ぎ</Text>
      <Text style={styles.subtitle}>登録済みのメールアドレスとパスワードを入力してください</Text>

      <TextInput
        style={styles.input}
        placeholder="メールアドレス"
        placeholderTextColor={colors.text.muted}
        value={email}
        onChangeText={v => { setEmail(v); setError(''); }}
        autoCapitalize="none"
        keyboardType="email-address"
        accessibilityLabel="メールアドレス"
      />

      <View style={styles.passwordRow}>
        <TextInput
          style={[styles.input, styles.passwordInput]}
          placeholder="パスワード"
          placeholderTextColor={colors.text.muted}
          value={password}
          onChangeText={v => { setPassword(v); setError(''); }}
          secureTextEntry={!showPassword}
          accessibilityLabel="パスワード"
        />
        <TouchableOpacity
          style={styles.eyeBtn}
          onPress={() => setShowPassword(v => !v)}
          accessibilityLabel={showPassword ? 'パスワードを隠す' : 'パスワードを表示'}
        >
          <Text style={styles.eyeIcon}>{showPassword ? '🙈' : '👁'}</Text>
        </TouchableOpacity>
      </View>

      {error ? <Text style={styles.errorText}>{error}</Text> : null}

      <TouchableOpacity
        style={[styles.btn, loading && styles.btnDisabled]}
        onPress={submit}
        disabled={loading}
        accessibilityLabel="ログイン"
        accessibilityRole="button"
      >
        <Text style={styles.btnText}>{loading ? 'ログイン中...' : 'ログインしてデータを引き継ぐ'}</Text>
      </TouchableOpacity>
      <TouchableOpacity onPress={() => navigation.goBack()}>
        <Text style={styles.link}>戻る</Text>
      </TouchableOpacity>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container:    { flex: 1, justifyContent: 'center', padding: 24, backgroundColor: colors.bg.primary },
  title:        { fontSize: 22, fontWeight: 'bold', marginBottom: 8, color: colors.text.primary },
  subtitle:     { fontSize: 13, color: colors.text.secondary, marginBottom: 24, lineHeight: 20 },
  input:        { borderWidth: 1, borderColor: colors.border.subtle, borderRadius: 10, padding: 14, fontSize: 16, marginBottom: 12, backgroundColor: colors.bg.card, color: colors.text.primary },
  passwordRow:  { position: 'relative', marginBottom: 12 },
  passwordInput:{ marginBottom: 0, paddingRight: 52 },
  eyeBtn:       { position: 'absolute', right: 14, top: 14, padding: 2 },
  eyeIcon:      { fontSize: 18 },
  errorText:    { fontSize: 13, color: colors.danger, marginBottom: 8, marginTop: -4 },
  btn:          { backgroundColor: colors.neon.blue, borderRadius: 10, padding: 16, alignItems: 'center', marginTop: 8, minHeight: 50, justifyContent: 'center' },
  btnDisabled:  { opacity: 0.6 },
  btnText:      { color: colors.bg.primary, fontSize: 16, fontWeight: 'bold' },
  link:         { textAlign: 'center', marginTop: 16, color: colors.neon.blue },
});
