import React, { useEffect, useState } from 'react';
import { View, Text, Image, TouchableOpacity, StyleSheet, Alert, ActivityIndicator } from 'react-native';
import { useQuery, useMutation } from '@tanstack/react-query';
import { getDailyAdvice, sendPenaltyAnswer } from '../api/ai';
import { useAvatarStore } from '../store/useAvatarStore';

export default function HomeScreen() {
  const { bodyState, avatarImages } = useAvatarStore();
  const [showInterrogation, setShowInterrogation] = useState(false);
  const [interrogationMsg, setInterrogationMsg] = useState('');

  const { data: advice, isLoading: adviceLoading } = useQuery({
    queryKey: ['dailyAdvice'],
    queryFn: getDailyAdvice,
    staleTime: 1000 * 60 * 30,
  });

  useEffect(() => {
    checkPenalty();
  }, []);

  const checkPenalty = async () => {
    try {
      const { data } = await fetch('/ai/penalty-event', { method: 'POST', body: JSON.stringify({}) }).then(r => r.json());
      if (data?.event === 'interrogation') {
        setInterrogationMsg(data.question);
        setShowInterrogation(true);
      }
    } catch {}
  };

  const penaltyMutation = useMutation({
    mutationFn: (answer: 'YES' | 'NO') => sendPenaltyAnswer(answer),
    onSuccess: (data) => {
      setShowInterrogation(false);
      if (data.newBodyState !== undefined) {
        useAvatarStore.getState().setBodyState(data.newBodyState);
      }
    },
  });

  const currentAvatarUrl = avatarImages[bodyState];

  return (
    <View style={styles.container}>
      {/* アバター表示 */}
      <View style={styles.avatarContainer}>
        {currentAvatarUrl ? (
          <Image source={{ uri: currentAvatarUrl }} style={styles.avatar} resizeMode="contain" />
        ) : (
          <View style={styles.avatarPlaceholder}>
            <Text style={styles.avatarPlaceholderText}>アバター未設定</Text>
          </View>
        )}
        <Text style={styles.bodyStateText}>体型: {bodyState}/4</Text>
      </View>

      {/* ペナルティ尋問イベント */}
      {showInterrogation && (
        <View style={styles.interrogation}>
          <Text style={styles.interrogationText}>{interrogationMsg}</Text>
          <View style={styles.interrogationButtons}>
            <TouchableOpacity style={[styles.btn, styles.btnYes]} onPress={() => penaltyMutation.mutate('YES')}>
              <Text style={styles.btnText}>はい（運動した）</Text>
            </TouchableOpacity>
            <TouchableOpacity style={[styles.btn, styles.btnNo]} onPress={() => penaltyMutation.mutate('NO')}>
              <Text style={styles.btnText}>いいえ（サボった）</Text>
            </TouchableOpacity>
          </View>
        </View>
      )}

      {/* AIアドバイス */}
      <View style={styles.adviceCard}>
        {adviceLoading ? (
          <ActivityIndicator />
        ) : (
          <>
            <Text style={styles.adviceGreeting}>{advice?.greeting}</Text>
            <Text style={styles.adviceLabel}>食事アドバイス</Text>
            <Text style={styles.adviceText}>{advice?.meal_advice}</Text>
            <Text style={styles.adviceLabel}>運動アドバイス</Text>
            <Text style={styles.adviceText}>{advice?.exercise_advice}</Text>
          </>
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container:              { flex: 1, backgroundColor: '#F8F9FA', padding: 16 },
  avatarContainer:        { alignItems: 'center', marginVertical: 24 },
  avatar:                 { width: 180, height: 240 },
  avatarPlaceholder:      { width: 180, height: 240, backgroundColor: '#E0E0E0', justifyContent: 'center', alignItems: 'center', borderRadius: 12 },
  avatarPlaceholderText:  { color: '#888', fontSize: 14 },
  bodyStateText:          { marginTop: 8, fontSize: 12, color: '#666' },
  interrogation:          { backgroundColor: '#FFF3CD', borderRadius: 12, padding: 16, marginBottom: 16 },
  interrogationText:      { fontSize: 16, fontWeight: 'bold', marginBottom: 12, textAlign: 'center' },
  interrogationButtons:   { flexDirection: 'row', gap: 8 },
  btn:                    { flex: 1, padding: 12, borderRadius: 8, alignItems: 'center' },
  btnYes:                 { backgroundColor: '#28A745' },
  btnNo:                  { backgroundColor: '#DC3545' },
  btnText:                { color: '#FFF', fontWeight: 'bold' },
  adviceCard:             { backgroundColor: '#FFF', borderRadius: 12, padding: 16, shadowColor: '#000', shadowOpacity: 0.06, shadowRadius: 8, elevation: 2 },
  adviceGreeting:         { fontSize: 16, fontWeight: 'bold', marginBottom: 12 },
  adviceLabel:            { fontSize: 12, color: '#666', marginTop: 8 },
  adviceText:             { fontSize: 14, color: '#333', marginTop: 4 },
});
