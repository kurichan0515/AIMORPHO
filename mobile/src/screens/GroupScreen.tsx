import React, { useState, useCallback } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, StyleSheet,
  Alert, ScrollView, Share, ActivityIndicator, RefreshControl,
} from 'react-native';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { createGroup, joinGroup, getGroup, getGroupFeed, leaveGroup } from '../api/social';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { colors } from '../theme/colors';
import PremiumGateModal from '../components/PremiumGateModal';
import Toast from '../components/Toast';
import { useToast } from '../hooks/useToast';

const RANK_COLORS = ['#FFD700', '#C0C0C0', '#CD7F32'];

export default function GroupScreen() {
  const [tab, setTab] = useState<'my' | 'create' | 'join'>('my');
  const [groupName, setGroupName] = useState('');
  const [inviteCode, setInviteCode] = useState('');
  const [premiumVisible, setPremiumVisible] = useState(false);
  const qc = useQueryClient();
  const { toastVisible, toastMessage, showToast, hideToast } = useToast();

  const [myGroupId, setMyGroupId] = useState<string | null>(null);
  React.useEffect(() => {
    AsyncStorage.getItem('myGroupId').then(id => { if (id) setMyGroupId(id); });
  }, []);

  const { data: group, isLoading: groupLoading, refetch: refetchGroup } = useQuery({
    queryKey: ['group', myGroupId],
    queryFn: () => getGroup(myGroupId!),
    enabled: !!myGroupId,
  });

  const { data: feed, isLoading: feedLoading, refetch: refetchFeed } = useQuery({
    queryKey: ['groupFeed', myGroupId],
    queryFn: () => getGroupFeed(myGroupId!),
    enabled: !!myGroupId,
  });

  const [refreshing, setRefreshing] = useState(false);
  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await Promise.all([refetchGroup(), refetchFeed()]);
    setRefreshing(false);
  }, [refetchGroup, refetchFeed]);

  const createMutation = useMutation({
    mutationFn: () => createGroup(groupName),
    onSuccess: async (data) => {
      await AsyncStorage.setItem('myGroupId', data.groupId);
      setMyGroupId(data.groupId);
      setGroupName('');
      setTab('my');
      qc.invalidateQueries({ queryKey: ['group'] });
      showToast(`グループ作成完了！招待コード: ${data.inviteCode}`);
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
      showToast('グループに参加しました！');
    },
    onError: (err: any) => {
      if (err?.response?.status === 403) { setPremiumVisible(true); return; }
      Alert.alert('エラー', '招待コードが正しくありません');
    },
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
    Share.share({
      message: `一緒に体型変化ジャーニーを歩もう！\nAIMORPHOグループ「${group.name}」\n招待コード: ${group.inviteCode}`,
    });
  };

  return (
    <View style={styles.container}>
      <PremiumGateModal
        visible={premiumVisible}
        onClose={() => setPremiumVisible(false)}
        title="グループ参加の上限に達しました"
        description="無料プランでは1つのグループにのみ参加できます。プレミアムプランで複数グループに参加できます。"
      />

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
          <TextInput
            style={styles.input}
            placeholder="グループ名"
            placeholderTextColor={colors.text.muted}
            value={groupName}
            onChangeText={setGroupName}
          />
          <TouchableOpacity
            style={[styles.submitBtn, (!groupName || createMutation.isPending) && styles.submitBtnDisabled]}
            onPress={() => createMutation.mutate()}
            disabled={!groupName || createMutation.isPending}
          >
            {createMutation.isPending
              ? <ActivityIndicator color={colors.bg.primary} size="small" />
              : <Text style={styles.submitBtnText}>作成する</Text>
            }
          </TouchableOpacity>
        </View>
      )}

      {tab === 'join' && (
        <View style={styles.form}>
          <Text style={styles.formTitle}>招待コードで参加</Text>
          <TextInput
            style={styles.input}
            placeholder="招待コード (6文字)"
            placeholderTextColor={colors.text.muted}
            value={inviteCode}
            onChangeText={setInviteCode}
            autoCapitalize="characters"
            maxLength={6}
          />
          <TouchableOpacity
            style={[styles.submitBtn, (inviteCode.length !== 6 || joinMutation.isPending) && styles.submitBtnDisabled]}
            onPress={() => joinMutation.mutate()}
            disabled={inviteCode.length !== 6 || joinMutation.isPending}
          >
            {joinMutation.isPending
              ? <ActivityIndicator color={colors.bg.primary} size="small" />
              : <Text style={styles.submitBtnText}>参加する</Text>
            }
          </TouchableOpacity>
        </View>
      )}

      {tab === 'my' && (
        <ScrollView
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.neon.blue} />}
        >
          {!myGroupId ? (
            <View style={styles.emptyState}>
              <Text style={styles.emptyIcon}>👥</Text>
              <Text style={styles.emptyTitle}>グループ未参加</Text>
              <Text style={styles.emptyDesc}>仲間と一緒に記録するとモチベーションが続く</Text>
              <TouchableOpacity style={styles.submitBtn} onPress={() => setTab('create')}>
                <Text style={styles.submitBtnText}>グループを作る</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.outlineBtn} onPress={() => setTab('join')}>
                <Text style={styles.outlineBtnText}>招待コードで参加</Text>
              </TouchableOpacity>
            </View>
          ) : groupLoading ? (
            <ActivityIndicator style={{ marginTop: 40 }} color={colors.neon.blue} />
          ) : (
            <>
              <View style={styles.groupCard}>
                <Text style={styles.groupName}>{group?.name}</Text>
                <Text style={styles.memberCount}>
                  {feed?.length ?? 0}人のメンバー
                </Text>
                <TouchableOpacity onPress={shareInvite} style={styles.inviteBtn}>
                  <Text style={styles.inviteBtnText}>📤  招待コード: {group?.inviteCode}</Text>
                </TouchableOpacity>
              </View>

              <Text style={styles.sectionTitle}>ランキング</Text>
              {feedLoading ? (
                <ActivityIndicator color={colors.neon.blue} style={{ marginTop: 16 }} />
              ) : (
                (feed || []).map((member: any, i: number) => {
                  const rankColor = RANK_COLORS[i] ?? colors.text.muted;
                  const isTop3 = i < 3;
                  return (
                    <View key={member.userId} style={[styles.memberRow, isTop3 && styles.memberRowTop]}>
                      <View style={[styles.rankBadge, { borderColor: rankColor }]}>
                        <Text style={[styles.rankText, { color: rankColor }]}>{i + 1}</Text>
                      </View>
                      <View style={styles.memberInfo}>
                        <Text style={styles.memberName}>{member.displayName || 'ユーザー'}</Text>
                        <Text style={styles.memberMeta}>
                          🔥 {member.currentDays}日連続  ·  🏅 バッジ {member.badgeCount}個
                        </Text>
                      </View>
                      {i === 0 && <Text style={styles.crownIcon}>👑</Text>}
                    </View>
                  );
                })
              )}

              <TouchableOpacity
                style={[styles.leaveBtn, leaveMutation.isPending && styles.leaveBtnDisabled]}
                onPress={() =>
                  Alert.alert('退出確認', 'グループから退出しますか？', [
                    { text: 'キャンセル', style: 'cancel' },
                    { text: '退出', style: 'destructive', onPress: () => leaveMutation.mutate() },
                  ])
                }
                disabled={leaveMutation.isPending}
              >
                {leaveMutation.isPending
                  ? <ActivityIndicator color={colors.danger} size="small" />
                  : <Text style={styles.leaveBtnText}>グループを退出</Text>
                }
              </TouchableOpacity>
            </>
          )}
        </ScrollView>
      )}

      <Toast visible={toastVisible} message={toastMessage} onHide={hideToast} />
    </View>
  );
}

const styles = StyleSheet.create({
  container:        { flex: 1, backgroundColor: colors.bg.primary },
  tabs:             { flexDirection: 'row', backgroundColor: colors.bg.navBar, borderBottomWidth: 1, borderBottomColor: colors.border.subtle },
  tab:              { flex: 1, padding: 14, alignItems: 'center', borderBottomWidth: 2, borderBottomColor: 'transparent' },
  tabActive:        { borderBottomColor: colors.neon.blue },
  tabText:          { fontSize: 14, color: colors.text.muted },
  tabTextActive:    { color: colors.neon.blue, fontWeight: 'bold' },

  form:             { padding: 20 },
  formTitle:        { fontSize: 18, fontWeight: 'bold', marginBottom: 16, color: colors.text.primary },
  input:            { backgroundColor: colors.bg.card, borderRadius: 10, padding: 14, fontSize: 15, marginBottom: 12, borderWidth: 1, borderColor: colors.border.subtle, color: colors.text.primary },
  submitBtn:        { backgroundColor: colors.neon.blue, borderRadius: 10, padding: 14, alignItems: 'center', minHeight: 50, justifyContent: 'center' },
  submitBtnDisabled:{ opacity: 0.5 },
  submitBtnText:    { color: colors.bg.primary, fontWeight: 'bold', fontSize: 15 },
  outlineBtn:       { borderWidth: 1, borderColor: colors.neon.blue, borderRadius: 10, padding: 14, alignItems: 'center', marginTop: 10, minHeight: 50, justifyContent: 'center' },
  outlineBtnText:   { color: colors.neon.blue, fontWeight: '600', fontSize: 15 },

  emptyState:       { alignItems: 'center', padding: 40, gap: 12 },
  emptyIcon:        { fontSize: 48 },
  emptyTitle:       { fontSize: 18, fontWeight: '700', color: colors.text.primary },
  emptyDesc:        { fontSize: 13, color: colors.text.muted, textAlign: 'center', lineHeight: 20 },

  groupCard:        { backgroundColor: colors.bg.card, margin: 16, borderRadius: 16, padding: 20, borderWidth: 1, borderColor: colors.neon.blue },
  groupName:        { fontSize: 22, fontWeight: 'bold', color: colors.text.primary, marginBottom: 4 },
  memberCount:      { fontSize: 13, color: colors.text.muted, marginBottom: 12 },
  inviteBtn:        { backgroundColor: 'rgba(47,200,255,0.15)', borderRadius: 8, padding: 12 },
  inviteBtnText:    { color: colors.neon.blue, fontSize: 14, textAlign: 'center', fontWeight: '600' },

  sectionTitle:     { fontSize: 16, fontWeight: 'bold', marginHorizontal: 16, marginBottom: 8, color: colors.text.primary },
  memberRow:        { flexDirection: 'row', alignItems: 'center', backgroundColor: colors.bg.card, marginHorizontal: 16, marginBottom: 6, padding: 14, borderRadius: 10, borderWidth: 1, borderColor: colors.border.subtle, gap: 12 },
  memberRowTop:     { borderColor: 'rgba(255,215,0,0.3)', backgroundColor: 'rgba(255,215,0,0.04)' },
  rankBadge:        { width: 32, height: 32, borderRadius: 16, borderWidth: 1.5, alignItems: 'center', justifyContent: 'center' },
  rankText:         { fontSize: 14, fontWeight: '800' },
  memberInfo:       { flex: 1 },
  memberName:       { fontSize: 15, fontWeight: '600', color: colors.text.primary },
  memberMeta:       { fontSize: 12, color: colors.text.secondary, marginTop: 2 },
  crownIcon:        { fontSize: 20 },

  leaveBtn:         { margin: 16, marginTop: 24, padding: 14, borderRadius: 10, alignItems: 'center', borderWidth: 1, borderColor: colors.danger, minHeight: 50, justifyContent: 'center' },
  leaveBtnDisabled: { opacity: 0.5 },
  leaveBtnText:     { color: colors.danger, fontWeight: 'bold' },
});
