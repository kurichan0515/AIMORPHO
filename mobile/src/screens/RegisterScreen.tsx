import React, { useState } from 'react';
import { View, Text, TextInput, TouchableOpacity, StyleSheet, Alert, KeyboardAvoidingView, Platform, ScrollView } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { useAuthStore } from '../store/useAuthStore';

export default function RegisterScreen() {
  const navigation = useNavigation<any>();
  const { register } = useAuthStore();
  const [displayName, setDisplayName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);

  const submit = async () => {
    if (!email || !password) { Alert.alert('エラー', 'メールとパスワードを入力してください'); return; }
    if (password.length < 8) { Alert.alert('エラー', 'パスワードは8文字以上'); return; }
    setLoading(true);
    try {
      await register(email, password, displayName);
    } catch (e: any) {
      const msg = e.response?.status === 409 ? 'このメールは登録済みです' : '登録に失敗しました';
      Alert.alert('エラー', msg);
    } finally {
      setLoading(false);
    }
  };

  return (
    <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <ScrollView contentContainerStyle={styles.container}>
        <Text style={styles.title}>アカウント作成</Text>
        <TextInput style={styles.input} placeholder="ニックネーム（任意）" value={displayName} onChangeText={setDisplayName} />
        <TextInput style={styles.input} placeholder="メールアドレス" value={email} onChangeText={setEmail} autoCapitalize="none" keyboardType="email-address" />
        <TextInput style={styles.input} placeholder="パスワード（8文字以上）" value={password} onChangeText={setPassword} secureTextEntry />
        <TouchableOpacity style={styles.btn} onPress={submit} disabled={loading}>
          <Text style={styles.btnText}>{loading ? '作成中...' : '登録する'}</Text>
        </TouchableOpacity>
        <TouchableOpacity onPress={() => navigation.goBack()}>
          <Text style={styles.link}>ログインに戻る</Text>
        </TouchableOpacity>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container:  { flexGrow: 1, justifyContent: 'center', padding: 24, backgroundColor: '#FFF' },
  title:      { fontSize: 24, fontWeight: 'bold', marginBottom: 24 },
  input:      { borderWidth: 1, borderColor: '#DDD', borderRadius: 10, padding: 14, fontSize: 16, marginBottom: 12 },
  btn:        { backgroundColor: '#007AFF', borderRadius: 10, padding: 16, alignItems: 'center', marginTop: 8 },
  btnText:    { color: '#FFF', fontSize: 16, fontWeight: 'bold' },
  link:       { textAlign: 'center', marginTop: 16, color: '#007AFF' },
});
