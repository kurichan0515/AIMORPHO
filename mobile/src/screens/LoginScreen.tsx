import React, { useState } from 'react';
import { View, Text, TextInput, TouchableOpacity, StyleSheet, Alert, KeyboardAvoidingView, Platform } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { useAuthStore } from '../store/useAuthStore';

export default function LoginScreen() {
  const navigation = useNavigation<any>();
  const { login } = useAuthStore();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);

  const submit = async () => {
    if (!email || !password) { Alert.alert('エラー', 'メールとパスワードを入力してください'); return; }
    setLoading(true);
    try {
      await login(email, password);
    } catch {
      Alert.alert('ログイン失敗', 'メールまたはパスワードが正しくありません');
    } finally {
      setLoading(false);
    }
  };

  return (
    <KeyboardAvoidingView style={styles.container} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <Text style={styles.title}>YASERUN</Text>
      <Text style={styles.subtitle}>アバターと一緒にダイエット</Text>
      <TextInput style={styles.input} placeholder="メールアドレス" value={email} onChangeText={setEmail} autoCapitalize="none" keyboardType="email-address" />
      <TextInput style={styles.input} placeholder="パスワード" value={password} onChangeText={setPassword} secureTextEntry />
      <TouchableOpacity style={styles.btn} onPress={submit} disabled={loading}>
        <Text style={styles.btnText}>{loading ? 'ログイン中...' : 'ログイン'}</Text>
      </TouchableOpacity>
      <TouchableOpacity onPress={() => navigation.navigate('Register')}>
        <Text style={styles.link}>アカウント作成はこちら</Text>
      </TouchableOpacity>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container:  { flex: 1, justifyContent: 'center', padding: 24, backgroundColor: '#FFF' },
  title:      { fontSize: 36, fontWeight: 'bold', textAlign: 'center', color: '#007AFF' },
  subtitle:   { fontSize: 14, textAlign: 'center', color: '#666', marginBottom: 32 },
  input:      { borderWidth: 1, borderColor: '#DDD', borderRadius: 10, padding: 14, fontSize: 16, marginBottom: 12 },
  btn:        { backgroundColor: '#007AFF', borderRadius: 10, padding: 16, alignItems: 'center', marginTop: 8 },
  btnText:    { color: '#FFF', fontSize: 16, fontWeight: 'bold' },
  link:       { textAlign: 'center', marginTop: 16, color: '#007AFF' },
});
