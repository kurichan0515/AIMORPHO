import React, { useState } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, StyleSheet,
  Alert, ScrollView, Share, ActivityIndicator,
} from 'react-native';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { createGroup, joinGroup, getGroup, getGroupFeed, leaveGroup } from '../api/social';
import AsyncStorage from '@react-native-async-storage/async-storage';

export default function GroupScreen() {
  const [tab, setTab] = useState<'my' | 'create' | 'join'>('my');
  const [groupName, setGroupName] = useState('');
  const [inviteCode, setInviteCode] = useState('');
  const qc = useQueryClient();

  // 参加グループIDをローカル保存
  const [myGroupId, setMyGroupId] = useState<string | null>(null);
  React.useEffect(() => {
    AsyncStorage.getItem('myGroupId').then(id => { if (id) setMyGroupId(id); });
  }, []);

  const { data: group, isLoading: groupLoading } = useQuery({
    queryKey: ['group', myGroupId],
    queryFn: () => getGroup(myGroupId!),
    enabled: !!myGroupId,
  });

  const { data: feed, isLoading: feedLoading } = useQuery({
    queryKey: ['groupFeed', myGroupId],
    queryFn: () => getGroupFeed(myGroupId!),
    enabled: !!myGroupId,
  });

  const createMutation = useMutation({
    mutationFn: () => createGroup(groupName),
    onSuccess: async (data) => {
      await AsyncStorage.setItem('myGroupId', data.groupId);
      setMyGroupId(data.groupId);
      setGroupName('');
      setTab('my');
      qc.invalidateQueries({ queryKey: ['group'] });
      Alert.alert('グループ作成！', `招待コード: ${data.inviteCode}`);
    },
  });

  const joinMutation = useMutation({
    mutationFn: () => joinGroup(inviteCode.toUpperCase()),
    onSuccess: async (data) => {
      await AsyncStorage.setItem('myGroupId', data.groupId);
      setMyGroupId(data.groupId);
      setInviteCode('');
      setTab('my');
      qc.invalidateQueries({ queryKey: ['group'] });
    },
    onError: () => Alert.alert('エラー', '招待コードが正しくありません'),
  });

  const leaveMutation = useMutation({
    mutationFn: () => leaveGroup(myGroupId!),
    onSuccess: async () => {
      await AsyncStorage.removeItem('myGroupId');
      setMyGroupId(null);
      qc.removeQueries({ queryKey: ['group'] });
    },
  });

  const shareInvite = () => {
    if (!group?.inviteCode) return;
    Share.share({ message: `一緒に体型変化ジャーニーを歩もう！AIMORPHOグループ「${group.name}」招待コード: ${group.inviteCode}` });
  };

  return (
    <View style={styles.container}>
      {/* タブ */}
      <View style={styles.tabs}>
        {(['my', 'create', 'join'] as const).map(t => (
          <TouchableOpacity key={t} style={[styles.tab, tab === t && styles.tabActive]} onPress={() => setTab(t)}>
            <Text style={[styles.tabText, tab === t && styles.tabTextActive]}>
              {t === 'my' ? 'グループ' : t === 'create' ? '作成' : '参加'}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      {tab === 'create' && (
        <View style={styles.form}>
          <Text style={styles.formTitle}>グループ作成</Text>
          <TextInput style={styles.input} placeholder="グループ名" value={groupName} onChangeText={setGroupName} />
          <TouchableOpacity style={styles.submitBtn} onPress={() => createMutation.mutate()} disabled={!groupName || createMutation.isPending}>
            <Text style={styles.submitBtnText}>作成する</Text>
          </TouchableOpacity>
        </View>
      )}

      {tab === 'join' && (
        <View style={styles.form}>
          <Text style={styles.formTitle}>招待コードで参加</Text>
          <TextInput style={styles.input} placeholder="招待コード (6文字)" value={inviteCode} onChangeText={setInviteCode} autoCapitalize="characters" maxLength={6} />
          <TouchableOpacity style={styles.submitBtn} onPress={() => joinMutation.mutate()} disabled={inviteCode.length !== 6 || joinMutation.isPending}>
            <Text style={styles.submitBtnText}>参加する</Text>
          </TouchableOpacity>
        </View>
      )}

      {tab === 'my' && (
        <ScrollView>
          {!myGroupId ? (
            <View style={styles.emptyState}>
              <Text style={styles.emptyText}>グループに参加していません</Text>
              <TouchableOpacity style={styles.submitBtn} onPress={() => setTab('create')}>
                <Text style={styles.submitBtnText}>グループを作る</Text>
              </TouchableOpacity>
            </View>
          ) : groupLoading ? (
            <ActivityIndicator style={{ marginTop: 40 }} />
          ) : (
            <>
              {/* グループ情報 */}
              <View style={styles.groupCard}>
                <Text style={styles.groupName}>{group?.name}</Text>
                <TouchableOpacity onPress={shareInvite} style={styles.inviteBtn}>
                  <Text style={styles.inviteBtnText}>招待コード: {group?.inviteCode} 　📤</Text>
                </TouchableOpacity>
              </View>

              {/* フィード */}
              <Text style={styles.sectionTitle}>メンバーランキング</Text>
              {feedLoading ? <ActivityIndicator /> : (feed || []).map((member: any, i: number) => (
                <View key={member.userId} style={styles.memberRow}>
                  <Text style={styles.rank}>{i + 1}</Text>
                  <View style={styles.memberInfo}>
                    <Text style={styles.memberName}>{member.displayName || 'ユーザー'}</Text>
                    <Text style={styles.memberMeta}>{member.currentDays}日連続 / バッジ {member.badgeCount}個</Text>
                  </View>
                </View>
              ))}

              <TouchableOpacity style={styles.leaveBtn} onPress={() =>
                Alert.alert('退出確認', 'グループから退出しますか？', [
                  { text: 'キャンセル', style: 'cancel' },
                  { text: '退出', style: 'destructive', onPress: () => leaveMutation.mutate() },
                ])
              }>
                <Text style={styles.leaveBtnText}>グループを退出</Text>
              </TouchableOpacity>
            </>
          )}
        </ScrollView>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container:      { flex: 1, backgroundColor: '#F8F9FA' },
  tabs:           { flexDirection: 'row', backgroundColor: '#FFF', borderBottomWidth: 1, borderBottomColor: '#E0E0E0' },
  tab:            { flex: 1, padding: 14, alignItems: 'center' },
  tabActive:      { borderBottomWidth: 2, borderBottomColor: '#007AFF' },
  tabText:        { fontSize: 14, color: '#888' },
  tabTextActive:  { color: '#007AFF', fontWeight: 'bold' },
  form:           { padding: 20 },
  formTitle:      { fontSize: 18, fontWeight: 'bold', marginBottom: 16 },
  input:          { backgroundColor: '#FFF', borderRadius: 10, padding: 14, fontSize: 15, marginBottom: 12, elevation: 1 },
  submitBtn:      { backgroundColor: '#007AFF', borderRadius: 10, padding: 14, alignItems: 'center' },
  submitBtnText:  { color: '#FFF', fontWeight: 'bold', fontSize: 15 },
  emptyState:     { alignItems: 'center', padding: 40, gap: 16 },
  emptyText:      { color: '#888', fontSize: 15 },
  groupCard:      { backgroundColor: '#007AFF', margin: 16, borderRadius: 16, padding: 20 },
  groupName:      { fontSize: 22, fontWeight: 'bold', color: '#FFF', marginBottom: 10 },
  inviteBtn:      { backgroundColor: 'rgba(255,255,255,0.2)', borderRadius: 8, padding: 10 },
  inviteBtnText:  { color: '#FFF', fontSize: 14, textAlign: 'center' },
  sectionTitle:   { fontSize: 16, fontWeight: 'bold', marginHorizontal: 16, marginBottom: 8 },
  memberRow:      { flexDirection: 'row', alignItems: 'center', backgroundColor: '#FFF', marginHorizontal: 16, marginBottom: 6, padding: 14, borderRadius: 10, elevation: 1 },
  rank:           { fontSize: 20, fontWeight: 'bold', color: '#007AFF', width: 32 },
  memberInfo:     { flex: 1 },
  memberName:     { fontSize: 15, fontWeight: '500' },
  memberMeta:     { fontSize: 12, color: '#888', marginTop: 2 },
  leaveBtn:       { margin: 16, marginTop: 24, padding: 14, borderRadius: 10, alignItems: 'center', borderWidth: 1, borderColor: '#FF3B30' },
  leaveBtnText:   { color: '#FF3B30', fontWeight: 'bold' },
});
