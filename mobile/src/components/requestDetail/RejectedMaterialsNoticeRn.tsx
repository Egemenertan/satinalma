import { useState } from 'react'
import { ActivityIndicator, Modal, Pressable, StyleSheet, Text, TextInput, View } from 'react-native'
import {
  purchasingRejectionReason,
  resendRejectedPurchaseRequest,
  updateRejectedPurchaseItem,
} from '../../lib/purchasingItemRejection'
import { supabase } from '../../lib/supabase'

type Item = {
  id: string
  item_name: string
  quantity: number
  purpose?: string | null
  purchasing_rejection_reason?: string | null
}

type Props = {
  requestId: string
  requestedBy?: string | null
  currentUserId?: string | null
  items: Item[]
  onRefresh: () => void
  onToast: (message: string) => void
}

export function RejectedMaterialsNoticeRn({
  requestId,
  requestedBy,
  currentUserId,
  items,
  onRefresh,
  onToast,
}: Props) {
  const rejected = items.filter((item) => purchasingRejectionReason(item))
  const isOwner = Boolean(currentUserId && requestedBy && currentUserId === requestedBy)
  const [busy, setBusy] = useState(false)
  const [editing, setEditing] = useState<Item | null>(null)
  const [name, setName] = useState('')
  const [quantity, setQuantity] = useState('')
  const [purpose, setPurpose] = useState('')

  if (!isOwner || rejected.length === 0) return null

  const openEdit = (item: Item) => {
    setEditing(item)
    setName(item.item_name)
    setQuantity(String(item.quantity))
    setPurpose(item.purpose || '')
  }

  const saveEdit = async () => {
    if (!editing || busy) return
    setBusy(true)
    try {
      const result = await updateRejectedPurchaseItem(supabase, {
        itemId: editing.id,
        itemName: name,
        quantity: Number(quantity.replace(',', '.')),
        purpose,
      })
      if (!result.ok) {
        onToast(result.message)
        return
      }
      setEditing(null)
      onToast('Malzeme güncellendi.')
      onRefresh()
    } finally {
      setBusy(false)
    }
  }

  const resend = async () => {
    if (!currentUserId || busy) return
    setBusy(true)
    try {
      const result = await resendRejectedPurchaseRequest(supabase, {
        requestId,
        userId: currentUserId,
      })
      if (!result.ok) {
        onToast(result.message)
        return
      }
      onToast('Talep satın almaya yeniden gönderildi.')
      onRefresh()
    } finally {
      setBusy(false)
    }
  }

  return (
    <View style={styles.banner}>
      <Text style={styles.title}>Reddedilen malzemeler var</Text>
      <Text style={styles.sub}>Nedeni malzemenin yanında. Düzenleyip yeniden gönderebilirsiniz.</Text>
      {rejected.map((item) => (
        <View key={item.id} style={styles.row}>
          <Text style={styles.itemName}>{item.item_name}</Text>
          <Text style={styles.reason}>{purchasingRejectionReason(item)}</Text>
          <Pressable style={styles.editBtn} onPress={() => openEdit(item)}>
            <Text style={styles.editText}>Düzenle</Text>
          </Pressable>
        </View>
      ))}
      <Pressable style={styles.resend} disabled={busy} onPress={() => void resend()}>
        {busy ? <ActivityIndicator color="#fff" /> : <Text style={styles.resendText}>Yeniden Gönder</Text>}
      </Pressable>

      <Modal visible={Boolean(editing)} transparent animationType="fade" onRequestClose={() => setEditing(null)}>
        <View style={styles.modalBackdrop}>
          <View style={styles.modalCard}>
            <Text style={styles.modalTitle}>Malzemeyi düzenle</Text>
            <TextInput style={styles.input} value={name} onChangeText={setName} placeholder="Malzeme adı" />
            <TextInput style={styles.input} value={quantity} onChangeText={setQuantity} keyboardType="decimal-pad" placeholder="Miktar" />
            <TextInput style={styles.input} value={purpose} onChangeText={setPurpose} placeholder="Kullanım amacı" />
            <View style={styles.modalActions}>
              <Pressable onPress={() => setEditing(null)}>
                <Text style={styles.cancel}>Vazgeç</Text>
              </Pressable>
              <Pressable style={styles.save} onPress={() => void saveEdit()}>
                <Text style={styles.saveText}>Kaydet</Text>
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>
    </View>
  )
}

const styles = StyleSheet.create({
  banner: {
    marginHorizontal: 20,
    marginTop: 16,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: '#FCA5A5',
    backgroundColor: '#FECACA',
    padding: 16,
  },
  title: { fontSize: 22, fontWeight: '700', color: '#7F1D1D' },
  sub: { marginTop: 6, color: '#7F1D1D', fontSize: 14 },
  row: { marginTop: 12 },
  itemName: { fontWeight: '700', color: '#7F1D1D' },
  reason: { marginTop: 4, color: '#7F1D1D' },
  editBtn: { marginTop: 6, alignSelf: 'flex-start' },
  editText: { fontWeight: '700', color: '#7F1D1D', textDecorationLine: 'underline' },
  resend: {
    marginTop: 16,
    backgroundColor: '#7F1D1D',
    borderRadius: 999,
    alignItems: 'center',
    paddingVertical: 12,
  },
  resendText: { color: '#fff', fontWeight: '700' },
  modalBackdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.4)', justifyContent: 'center', padding: 24 },
  modalCard: { backgroundColor: '#fff', borderRadius: 20, padding: 16 },
  modalTitle: { fontSize: 18, fontWeight: '700', marginBottom: 12 },
  input: { borderWidth: 1, borderColor: '#E5E7EB', borderRadius: 12, padding: 10, marginBottom: 8 },
  modalActions: { flexDirection: 'row', justifyContent: 'flex-end', gap: 16, marginTop: 8 },
  cancel: { color: '#374151', fontWeight: '600' },
  save: { backgroundColor: '#111827', borderRadius: 999, paddingHorizontal: 14, paddingVertical: 8 },
  saveText: { color: '#fff', fontWeight: '700' },
})
