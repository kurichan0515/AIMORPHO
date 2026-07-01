import React from 'react';
import { Modal, View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { colors } from '../theme/colors';

type Props = {
  visible: boolean;
  onClose: () => void;
  title: string;
  description: string;
  onUpgrade?: () => void;
};

export default function PremiumGateModal({ visible, onClose, title, description, onUpgrade }: Props) {
  return (
    <Modal transparent animationType="fade" visible={visible} onRequestClose={onClose}>
      <View style={s.overlay}>
        <View style={s.card}>
          <Text style={s.crown}>👑</Text>
          <Text style={s.badge}>PREMIUM</Text>
          <Text style={s.title}>{title}</Text>
          <Text style={s.desc}>{description}</Text>
          <View style={s.features}>
            <FeatureRow text="AI食事解析・提案 広告なしで使い放題" />
            <FeatureRow text="AIコーチ 全口調スタイル" />
            <FeatureRow text="アバター再生成 無制限" />
            <FeatureRow text="複数グループ参加" />
          </View>
          <TouchableOpacity
            style={s.upgradeBtn}
            onPress={() => { onUpgrade?.(); onClose(); }}
          >
            <Text style={s.upgradeBtnText}>👑 プレミアムにアップグレード</Text>
          </TouchableOpacity>
          <TouchableOpacity style={s.closeBtn} onPress={onClose}>
            <Text style={s.closeBtnText}>閉じる</Text>
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );
}

function FeatureRow({ text }: { text: string }) {
  return (
    <View style={s.featureRow}>
      <Text style={s.featureCheck}>✓</Text>
      <Text style={s.featureText}>{text}</Text>
    </View>
  );
}

const s = StyleSheet.create({
  overlay:       { flex: 1, backgroundColor: 'rgba(0,0,0,0.75)', justifyContent: 'center', alignItems: 'center', padding: 24 },
  card:          { backgroundColor: colors.bg.card, borderRadius: 20, padding: 28, width: '100%', alignItems: 'center', borderWidth: 1, borderColor: colors.neon.yellow },
  crown:         { fontSize: 40, marginBottom: 8 },
  badge:         { fontSize: 11, fontWeight: '800', letterSpacing: 2, color: colors.neon.yellow, borderWidth: 1, borderColor: colors.neon.yellow, borderRadius: 4, paddingHorizontal: 8, paddingVertical: 3, marginBottom: 16 },
  title:         { fontSize: 18, fontWeight: '800', color: colors.text.primary, textAlign: 'center', marginBottom: 8 },
  desc:          { fontSize: 13, color: colors.text.secondary, textAlign: 'center', lineHeight: 20, marginBottom: 20 },
  features:      { width: '100%', marginBottom: 24, gap: 8 },
  featureRow:    { flexDirection: 'row', alignItems: 'center', gap: 10 },
  featureCheck:  { color: colors.neon.yellow, fontWeight: '700', fontSize: 14 },
  featureText:   { fontSize: 13, color: colors.text.secondary },
  upgradeBtn:    { width: '100%', backgroundColor: colors.neon.yellow, borderRadius: 12, paddingVertical: 14, alignItems: 'center', marginBottom: 10 },
  upgradeBtnText:{ color: '#000', fontWeight: '800', fontSize: 15 },
  closeBtn:      { paddingVertical: 10 },
  closeBtnText:  { color: colors.text.muted, fontSize: 14 },
});
