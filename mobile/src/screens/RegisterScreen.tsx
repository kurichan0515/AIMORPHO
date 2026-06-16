import React, { useState } from 'react';
import { Text, TextInput, TouchableOpacity, StyleSheet, Alert, KeyboardAvoidingView, Platform, ScrollView, Linking } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { useAuthStore } from '../store/useAuthStore';
import { BASE_URL as API_BASE } from '../api/client';

export default function RegisterScreen() {
  const navigation = useNavigation<any>();
  const { upgradeAccount } = useAuthStore();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);

  const submit = async () => {
    if (!email || !password) { Alert.alert('エラー', 'メールとパスワードを入力してください'); return; }
    if (password.length < 8) { Alert.alert('エラー', 'パスワードは8文字以上'); return; }
    setLoading(true);
    try {
      await upgradeAccount(email, password);
      Alert.alert('登録完了', 'アカウントを登録しました。次回から同じメールアドレスでデータを引き継げます。', [
        { text: 'OK', onPress: () => navigation.goBack() },
      ]);
    } catch (e: any) {
      if (e.response?.status === 409) {
        Alert.alert('登録失敗', 'このメールアドレスはすでに別のアカウントに登録されています。\n「既存アカウントでログイン」をお試しください。');
      } else {
        Alert.alert('エラー', '登録に失敗しました');
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <ScrollView contentContainerStyle={styles.container}>
        <Text style={styles.title}>アカウント登録</Text>
        <Text style={styles.subtitle}>
          メールアドレスを登録すると、機種変更や再インストール後でもデータを復元できます。
          現在のデータはそのまま引き継がれます。
        </Text>
        <TextInput style={styles.input} placeholder="メールアドレス" value={email} onChangeText={setEmail} autoCapitalize="none" keyboardType="email-address" />
        <TextInput style={styles.input} placeholder="パスワード（8文字以上）" value={password} onChangeText={setPassword} secureTextEntry />
        <Text style={styles.terms}>
          登録すると
          <Text style={styles.termsLink} onPress={() => Linking.openURL(`${API_BASE}/legal/terms`)}>利用規約</Text>
          および
          <Text style={styles.termsLink} onPress={() => Linking.openURL(`${API_BASE}/legal/privacy`)}>プライバシーポリシー</Text>
          に同意したものとみなされます。
        </Text>
        <TouchableOpacity style={styles.btn} onPress={submit} disabled={loading}>
          <Text style={styles.btnText}>{loading ? '登録中...' : 'アカウントを登録する'}</Text>
        </TouchableOpacity>
        <TouchableOpacity onPress={() => navigation.goBack()}>
          <Text style={styles.link}>戻る</Text>
        </TouchableOpacity>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container:  { flexGrow: 1, justifyContent: 'center', padding: 24, backgroundColor: '#FFF' },
  title:      { fontSize: 22, fontWeight: 'bold', marginBottom: 8 },
  subtitle:   { fontSize: 13, color: '#666', marginBottom: 24, lineHeight: 20 },
  input:      { borderWidth: 1, borderColor: '#DDD', borderRadius: 10, padding: 14, fontSize: 16, marginBottom: 12 },
  terms:      { fontSize: 12, color: '#888', lineHeight: 18, marginBottom: 8 },
  termsLink:  { color: '#007AFF', textDecorationLine: 'underline' },
  btn:        { backgroundColor: '#007AFF', borderRadius: 10, padding: 16, alignItems: 'center', marginTop: 8 },
  btnText:    { color: '#FFF', fontSize: 16, fontWeight: 'bold' },
  link:       { textAlign: 'center', marginTop: 16, color: '#007AFF' },
});
