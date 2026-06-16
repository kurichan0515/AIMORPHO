import React from 'react';
import { Modal, View, Text, TouchableOpacity, StyleSheet } from 'react-native';

interface Props {
  visible: boolean;
  onAgree: () => void;
  onCancel: () => void;
}

export default function AvatarConsentModal({ visible, onAgree, onCancel }: Props) {
  return (
    <Modal transparent visible={visible} animationType="slide">
      <View style={styles.overlay}>
        <View style={styles.sheet}>
          <Text style={styles.title}>📸 顔写真の利用について</Text>
          <View style={styles.items}>
            <Text style={styles.item}>• AIアバター生成のためGemini API（Google）に送信されます</Text>
            <Text style={styles.item}>• 送信のため一時的にサーバー（AWS S3）に保存されます</Text>
            <Text style={styles.item}>• アバター生成完了後、顔写真は削除されます</Text>
            <Text style={styles.item}>• 生成されたアバター画像は引き続きサーバーに保存されます</Text>
          </View>
          <TouchableOpacity style={styles.agreeBtn} onPress={onAgree}>
            <Text style={styles.agreeBtnText}>同意してカメラを起動</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.cancelBtn} onPress={onCancel}>
            <Text style={styles.cancelBtnText}>キャンセル</Text>
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay:      { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' },
  sheet:        { backgroundColor: '#FFF', borderTopLeftRadius: 20, borderTopRightRadius: 20, padding: 24 },
  title:        { fontSize: 17, fontWeight: 'bold', marginBottom: 16 },
  items:        { marginBottom: 20, gap: 10 },
  item:         { fontSize: 14, color: '#333', lineHeight: 20 },
  agreeBtn:     { backgroundColor: '#007AFF', borderRadius: 12, padding: 16, alignItems: 'center', marginBottom: 10 },
  agreeBtnText: { color: '#FFF', fontWeight: 'bold', fontSize: 15 },
  cancelBtn:    { padding: 12, alignItems: 'center' },
  cancelBtnText:{ color: '#666', fontSize: 14 },
});
