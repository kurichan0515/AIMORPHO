import React, { useState } from 'react';
import { View, Text, TextInput, TouchableOpacity, StyleSheet, KeyboardAvoidingView, Platform, ScrollView, Linking } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { useAuthStore } from '../store/useAuthStore';
import { BASE_URL as API_BASE } from '../api/client';
import { colors } from '../theme/colors';
import Toast from '../components/Toast';
import { useToast } from '../hooks/useToast';

export default function RegisterScreen() {
  const navigation = useNavigation<any>();
  const { upgradeAccount } = useAuthStore();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const { toastVisible, toastMessage, showToast, hideToast } = useToast();

  const submit = async () => {
    setError('');
    if (!email.trim()) { setError('メールアドレスを入力してください'); return; }
    if (!password) { setError('パスワードを入力してください'); return; }
    if (password.length < 8) { setError('パスワードは8文字以上で入力してください'); return; }
    setLoading(true);
    try {
      await upgradeAccount(email.trim(), password);
      showToast('アカウントを登録しました');
      setTimeout(() => navigation.goBack(), 1500);
    } catch (e: any) {
      if (e.response?.status === 409) {
        setError('このメールアドレスはすでに登録されています。ログインをお試しください。');
      } else {
        setError('登録に失敗しました。しばらく経ってから再度お試しください。');
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <View style={{ flex: 1 }}>
    <KeyboardAvoidingView style={{ flex: 1, backgroundColor: colors.bg.primary }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <ScrollView contentContainerStyle={styles.container}>
        <Text style={styles.title}>アカウント登録</Text>
        <Text style={styles.subtitle}>
          メールアドレスを登録すると、機種変更や再インストール後でもデータを復元できます。
          現在のデータはそのまま引き継がれます。
        </Text>

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
            placeholder="パスワード（8文字以上）"
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

        <Text style={styles.terms}>
          登録すると
          <Text style={styles.termsLink} onPress={() => Linking.openURL(`${API_BASE}/legal/terms`)}>利用規約</Text>
          および
          <Text style={styles.termsLink} onPress={() => Linking.openURL(`${API_BASE}/legal/privacy`)}>プライバシーポリシー</Text>
          に同意したものとみなされます。
        </Text>

        <TouchableOpacity
          style={[styles.btn, loading && styles.btnDisabled]}
          onPress={submit}
          disabled={loading}
          accessibilityLabel="アカウントを登録"
          accessibilityRole="button"
        >
          <Text style={styles.btnText}>{loading ? '登録中...' : 'アカウントを登録する'}</Text>
        </TouchableOpacity>
        <TouchableOpacity onPress={() => navigation.goBack()}>
          <Text style={styles.link}>戻る</Text>
        </TouchableOpacity>
      </ScrollView>
    </KeyboardAvoidingView>
    <Toast visible={toastVisible} message={toastMessage} onHide={hideToast} type="success" />
    </View>
  );
}

const styles = StyleSheet.create({
  container:    { flexGrow: 1, justifyContent: 'center', padding: 24, backgroundColor: colors.bg.primary },
  title:        { fontSize: 22, fontWeight: 'bold', marginBottom: 8, color: colors.text.primary },
  subtitle:     { fontSize: 13, color: colors.text.secondary, marginBottom: 24, lineHeight: 20 },
  input:        { borderWidth: 1, borderColor: colors.border.subtle, borderRadius: 10, padding: 14, fontSize: 16, marginBottom: 12, backgroundColor: colors.bg.card, color: colors.text.primary },
  passwordRow:  { position: 'relative', marginBottom: 12 },
  passwordInput:{ marginBottom: 0, paddingRight: 52 },
  eyeBtn:       { position: 'absolute', right: 14, top: 14, padding: 2 },
  eyeIcon:      { fontSize: 18 },
  errorText:    { fontSize: 13, color: colors.danger, marginBottom: 8, marginTop: -4 },
  terms:        { fontSize: 12, color: colors.text.secondary, lineHeight: 18, marginBottom: 8 },
  termsLink:    { color: colors.neon.blue, textDecorationLine: 'underline' },
  btn:          { backgroundColor: colors.neon.blue, borderRadius: 10, padding: 16, alignItems: 'center', marginTop: 8, minHeight: 50, justifyContent: 'center' },
  btnDisabled:  { opacity: 0.6 },
  btnText:      { color: colors.bg.primary, fontSize: 16, fontWeight: 'bold' },
  link:         { textAlign: 'center', marginTop: 16, color: colors.neon.blue },
});
