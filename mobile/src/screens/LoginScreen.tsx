import React, { useState } from 'react';
import { Text, TextInput, TouchableOpacity, StyleSheet, Alert, KeyboardAvoidingView, Platform } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { useQueryClient } from '@tanstack/react-query';
import { useAuthStore } from '../store/useAuthStore';
import { colors } from '../theme/colors';

export default function LoginScreen() {
  const navigation = useNavigation<any>();
  const qc = useQueryClient();
  const { loginAndRestore } = useAuthStore();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);

  const submit = async () => {
    if (!email || !password) { Alert.alert('エラー', 'メールとパスワードを入力してください'); return; }
    setLoading(true);
    try {
      await loginAndRestore(email, password);
      qc.clear();
      navigation.navigate('Main');
    } catch {
      Alert.alert('ログイン失敗', 'メールまたはパスワードが正しくありません');
    } finally {
      setLoading(false);
    }
  };

  return (
    <KeyboardAvoidingView style={styles.container} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <Text style={styles.title}>既存アカウントで引き継ぎ</Text>
      <Text style={styles.subtitle}>登録済みのメールアドレスとパスワードを入力してください</Text>
      <TextInput style={styles.input} placeholder="メールアドレス" placeholderTextColor={colors.text.muted} value={email} onChangeText={setEmail} autoCapitalize="none" keyboardType="email-address" />
      <TextInput style={styles.input} placeholder="パスワード" placeholderTextColor={colors.text.muted} value={password} onChangeText={setPassword} secureTextEntry />
      <TouchableOpacity style={styles.btn} onPress={submit} disabled={loading}>
        <Text style={styles.btnText}>{loading ? 'ログイン中...' : 'ログインしてデータを引き継ぐ'}</Text>
      </TouchableOpacity>
      <TouchableOpacity onPress={() => navigation.goBack()}>
        <Text style={styles.link}>戻る</Text>
      </TouchableOpacity>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container:  { flex: 1, justifyContent: 'center', padding: 24, backgroundColor: colors.bg.primary },
  title:      { fontSize: 22, fontWeight: 'bold', marginBottom: 8, color: colors.text.primary },
  subtitle:   { fontSize: 13, color: colors.text.secondary, marginBottom: 24, lineHeight: 20 },
  input:      { borderWidth: 1, borderColor: colors.border.subtle, borderRadius: 10, padding: 14, fontSize: 16, marginBottom: 12, backgroundColor: colors.bg.card, color: colors.text.primary },
  btn:        { backgroundColor: colors.neon.blue, borderRadius: 10, padding: 16, alignItems: 'center', marginTop: 8 },
  btnText:    { color: colors.bg.primary, fontSize: 16, fontWeight: 'bold' },
  link:       { textAlign: 'center', marginTop: 16, color: colors.neon.blue },
});
