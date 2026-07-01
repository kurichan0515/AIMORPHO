import React, { useState } from 'react';
import {
  View, Text, TextInput, TouchableOpacity,
  StyleSheet, ScrollView, Alert, KeyboardAvoidingView, Platform,
} from 'react-native';
import { useNavigation, useRoute } from '@react-navigation/native';
import { useMutation, useQuery } from '@tanstack/react-query';
import { colors } from '../theme/colors';
import { submitInquiry, InquiryCategory } from '../api/inquiry';
import api from '../api/client';

const CATEGORIES: { value: InquiryCategory; label: string }[] = [
  { value: 'bug',     label: 'バグ・不具合報告' },
  { value: 'feature', label: '機能・改善要望' },
  { value: 'other',   label: 'その他' },
];

export default function InquiryScreen() {
  const navigation = useNavigation<any>();
  const route = useRoute<any>();
  const prefillErrorCode: string | undefined = route.params?.errorCode;

  const { data: profile } = useQuery({
    queryKey: ['profile'],
    queryFn: () => api.get('/users/me').then(r => r.data),
  });

  const [category, setCategory] = useState<InquiryCategory>('bug');
  const [email, setEmail] = useState(profile?.email ?? '');
  const [subject, setSubject] = useState('');
  const [body, setBody] = useState('');
  const [errorCode, setErrorCode] = useState(prefillErrorCode ?? '');

  const mutation = useMutation({
    mutationFn: () => submitInquiry({ email, category, subject, body, errorCode: errorCode || undefined }),
    onSuccess: () => {
      Alert.alert(
        '送信完了',
        'お問い合わせを受け付けました。確認後、ご登録メールアドレス宛にご連絡します。',
        [{ text: 'OK', onPress: () => navigation.goBack() }],
      );
    },
    onError: () => Alert.alert('エラー', '送信に失敗しました。しばらく経ってから再度お試しください。'),
  });

  const submit = () => {
    if (!email.trim()) { Alert.alert('エラー', 'メールアドレスを入力してください'); return; }
    if (!subject.trim()) { Alert.alert('エラー', '件名を入力してください'); return; }
    if (!body.trim()) { Alert.alert('エラー', 'お問い合わせ内容を入力してください'); return; }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      Alert.alert('エラー', 'メールアドレスの形式が正しくありません'); return;
    }
    mutation.mutate();
  };

  return (
    <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <ScrollView style={styles.container} contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
        <Text style={styles.sectionTitle}>カテゴリ</Text>
        <View style={styles.categoryRow}>
          {CATEGORIES.map(c => (
            <TouchableOpacity
              key={c.value}
              style={[styles.categoryBtn, category === c.value && styles.categoryBtnActive]}
              onPress={() => setCategory(c.value)}
            >
              <Text style={[styles.categoryText, category === c.value && styles.categoryTextActive]}>
                {c.label}
              </Text>
            </TouchableOpacity>
          ))}
        </View>

        <Text style={styles.sectionTitle}>返信先メールアドレス <Text style={styles.required}>*</Text></Text>
        <TextInput
          style={styles.input}
          value={email}
          onChangeText={setEmail}
          placeholder="example@email.com"
          placeholderTextColor={colors.text.muted}
          keyboardType="email-address"
          autoCapitalize="none"
        />

        <Text style={styles.sectionTitle}>件名 <Text style={styles.required}>*</Text></Text>
        <TextInput
          style={styles.input}
          value={subject}
          onChangeText={setSubject}
          placeholder="お問い合わせの件名"
          placeholderTextColor={colors.text.muted}
        />

        <Text style={styles.sectionTitle}>内容 <Text style={styles.required}>*</Text></Text>
        <TextInput
          style={[styles.input, styles.bodyInput]}
          value={body}
          onChangeText={setBody}
          placeholder="お問い合わせ内容をできるだけ詳しく記載してください"
          placeholderTextColor={colors.text.muted}
          multiline
          textAlignVertical="top"
        />

        <Text style={styles.sectionTitle}>エラーコード <Text style={styles.optional}>（任意）</Text></Text>
        <TextInput
          style={styles.input}
          value={errorCode}
          onChangeText={setErrorCode}
          placeholder="例: E-A1B2C3"
          placeholderTextColor={colors.text.muted}
          autoCapitalize="characters"
        />
        <Text style={styles.hint}>エラー発生時に表示されたコードを入力すると、調査がスムーズになります。</Text>

        <TouchableOpacity
          style={[styles.submitBtn, mutation.isPending && styles.btnDisabled]}
          onPress={submit}
          disabled={mutation.isPending}
        >
          <Text style={styles.submitBtnText}>{mutation.isPending ? '送信中...' : '送信する'}</Text>
        </TouchableOpacity>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container:       { flex: 1, backgroundColor: colors.bg.primary },
  content:         { padding: 16, paddingBottom: 40 },
  sectionTitle:    { fontSize: 13, fontWeight: '600', color: colors.text.secondary, marginTop: 18, marginBottom: 8 },
  required:        { color: colors.danger ?? '#ff4444', fontWeight: '400' },
  optional:        { color: colors.text.muted, fontWeight: '400' },
  categoryRow:     { gap: 8 },
  categoryBtn:     { paddingVertical: 12, paddingHorizontal: 14, borderRadius: 10, borderWidth: 1, borderColor: colors.border.subtle, backgroundColor: colors.bg.card },
  categoryBtnActive: { borderColor: colors.neon.blue, backgroundColor: 'rgba(47,200,255,0.1)' },
  categoryText:    { fontSize: 14, color: colors.text.secondary },
  categoryTextActive: { color: colors.neon.blue, fontWeight: '600' },
  input:           { borderWidth: 1, borderColor: colors.border.subtle, borderRadius: 10, padding: 14, fontSize: 15, color: colors.text.primary, backgroundColor: colors.bg.card },
  bodyInput:       { minHeight: 160 },
  hint:            { fontSize: 11, color: colors.text.muted, marginTop: 6, lineHeight: 16 },
  submitBtn:       { backgroundColor: colors.neon.blue, borderRadius: 12, padding: 16, alignItems: 'center', marginTop: 28 },
  submitBtnText:   { color: colors.bg.primary, fontSize: 16, fontWeight: 'bold' },
  btnDisabled:     { opacity: 0.6 },
});
