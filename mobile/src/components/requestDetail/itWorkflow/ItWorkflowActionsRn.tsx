import {
  ActivityIndicator,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native'
import MaterialIcons from '@expo/vector-icons/MaterialIcons'
import { SwipeDismissSheet } from '../../island/SwipeDismissSheet'
import { stats, statsCardSurface, statsFont, statsType } from '../../../theme/statsDesignTokens'
import { ItWorkflowEditItemsSheet } from './ItWorkflowEditItemsSheet'
import { ItWorkflowSendQuantitiesSheet } from './ItWorkflowSendQuantitiesSheet'
import type { PurchaseRequestItemRow } from '../../../lib/requestOfferBundle'
import {
  useItWorkflowActionsRn,
  type UseItWorkflowActionsRnArgs,
} from './useItWorkflowActionsRn'

export type ItWorkflowActionsRnController = ReturnType<typeof useItWorkflowActionsRn>

export { useItWorkflowActionsRn, type UseItWorkflowActionsRnArgs }

/** ScrollView içinde — yalnızca kartlar (Modal yok) */
export function ItWorkflowActionsCardRn({ wf }: { wf: ItWorkflowActionsRnController }) {
  const {
    isDeptHeadPazarlama,
    showStage1,
    showStage2,
    busyAny,
    busyApprove1,
    busyStage2,
    setRejectReason,
    setRejectOpen,
    setEditOpen,
    setSendOpen,
    onApproveStage1,
    onSendToPurchasing,
  } = wf

  if (!wf.showAny) return null

  return (
    <View style={styles.wrap}>
      {showStage1 ? (
        <View style={styles.card}>
          <View style={styles.cardHead}>
            <View style={[styles.iconCircle, styles.iconSky]}>
              <MaterialIcons name="inventory-2" size={22} color="#01E884" />
            </View>
            <View style={styles.cardHeadText}>
              <Text style={styles.title}>IT Yönetim Onayı</Text>
              <Text style={styles.body}>
                Kalemleri düzenleyebilir, şantiyeye gönderim miktarı girebilir, onaylayabilir veya reddedebilirsiniz.
              </Text>
            </View>
          </View>
          <View style={styles.ctaStack}>
            <Text style={styles.sectionLabel}>Sepet ve gönderim</Text>
            {isDeptHeadPazarlama ? (
              <View style={styles.ctaRow}>
                <Pressable
                  style={[styles.btnOutlineBlue, styles.btnPrepHalf, busyAny && styles.btnDisabled]}
                  onPress={() => setEditOpen(true)}
                  disabled={busyAny}
                >
                  <View style={styles.btnInline}>
                    <MaterialIcons name="edit" size={18} color="#047857" />
                    <Text style={styles.btnOutlineBlueText} numberOfLines={1}>
                      Düzenle
                    </Text>
                  </View>
                </Pressable>
                <Pressable
                  style={[styles.btnOutlineEmerald, styles.btnPrepHalf, busyAny && styles.btnDisabled]}
                  onPress={() => setSendOpen(true)}
                  disabled={busyAny}
                >
                  <View style={styles.btnInline}>
                    <MaterialIcons name="send" size={18} color="#047857" />
                    <Text style={styles.btnOutlineEmeraldText} numberOfLines={1}>
                      Gönder
                    </Text>
                  </View>
                </Pressable>
              </View>
            ) : (
              <Pressable
                style={[styles.btnOutlineBlue, styles.btnPrepFull, busyAny && styles.btnDisabled]}
                onPress={() => setEditOpen(true)}
                disabled={busyAny}
              >
                <View style={styles.btnInline}>
                  <MaterialIcons name="edit" size={18} color="#047857" />
                  <Text style={styles.btnOutlineBlueText} numberOfLines={1}>
                    Düzenle
                  </Text>
                </View>
              </Pressable>
            )}

            <View style={styles.sectionDivider} />

            <Text style={styles.sectionLabel}>Karar</Text>
            <View style={styles.ctaRow}>
              <Pressable
                style={[styles.btnRejectOutline, styles.btnDecisionReject, busyAny && styles.btnDisabled]}
                onPress={() => {
                  setRejectReason('')
                  setRejectOpen(true)
                }}
                disabled={busyAny}
              >
                <View style={styles.btnInline}>
                  <MaterialIcons name="close" size={18} color="#dc2626" />
                  <Text style={styles.btnRejectOutlineText} numberOfLines={1}>
                    Reddet
                  </Text>
                </View>
              </Pressable>
              <Pressable
                style={[styles.btnApproveBrand, styles.btnDecisionApprove, busyAny && styles.btnDisabled]}
                onPress={() => void onApproveStage1()}
                disabled={busyAny}
              >
                {busyApprove1 ? (
                  <ActivityIndicator color={stats.onPrimary} size="small" />
                ) : (
                  <Text style={styles.btnApproveBrandText}>Onayla</Text>
                )}
              </Pressable>
            </View>
          </View>
        </View>
      ) : null}

      {showStage2 ? (
        <View style={styles.card}>
          <View style={styles.cardHead}>
            <View style={[styles.iconCircle, styles.iconGreen]}>
              <MaterialIcons name="check-circle" size={22} color="#01E884" />
            </View>
            <View style={styles.cardHeadText}>
              <Text style={styles.title}>IT onayı tamamlandı</Text>
              <Text style={styles.body}>Talebi satın almaya iletebilirsiniz.</Text>
            </View>
          </View>
          <Text style={styles.stage2Hint}>Son adım — talebi satın alma sürecine iletin.</Text>
          <Pressable
            style={[styles.btnPrimaryGreen, busyAny && styles.btnDisabled]}
            onPress={() => void onSendToPurchasing()}
            disabled={busyAny}
          >
            {busyStage2 ? (
              <ActivityIndicator color="#fff" size="small" />
            ) : (
              <View style={styles.btnInline}>
                <MaterialIcons name="shopping-cart-checkout" size={20} color="#111827" />
                <Text style={styles.btnPrimaryGreenText} numberOfLines={2}>
                  Satın Almaya Gönder / Onayla
                </Text>
              </View>
            )}
          </Pressable>
        </View>
      ) : null}
    </View>
  )
}

/** ScrollView dışında — Modal / SwipeDismissSheet (üst katmanda, takılma önlenir) */
export function ItWorkflowActionsSheetsRn({
  wf,
  items,
}: {
  wf: ItWorkflowActionsRnController
  items: PurchaseRequestItemRow[]
}) {
  const {
    editOpen,
    sendOpen,
    rejectOpen,
    rejectReason,
    savingEdit,
    busySend,
    busyReject,
    setEditOpen,
    setSendOpen,
    setRejectOpen,
    setRejectReason,
    handleSaveEdits,
    handleSendQuantities,
    onRejectConfirm,
  } = wf

  if (!wf.showAny) return null

  return (
    <>
      <ItWorkflowEditItemsSheet
        visible={editOpen}
        items={items}
        saving={savingEdit}
        onClose={() => !savingEdit && setEditOpen(false)}
        onSave={handleSaveEdits}
      />

      <ItWorkflowSendQuantitiesSheet
        visible={sendOpen}
        items={items}
        busy={busySend}
        onClose={() => !busySend && setSendOpen(false)}
        onConfirm={handleSendQuantities}
      />

      <SwipeDismissSheet
        visible={rejectOpen}
        onRequestClose={() => {
          setRejectOpen(false)
          setRejectReason('')
        }}
        title="Talebi reddet"
        maxHeightRatio={0.72}
      >
        <View style={styles.sheetPad}>
          <Text style={styles.modalSub}>IT Yönetim red gerekçesi zorunlu.</Text>
          <TextInput
            style={styles.modalInput}
            placeholder="Gerekçe yazın…"
            placeholderTextColor={stats.outline}
            value={rejectReason}
            onChangeText={setRejectReason}
            multiline
            maxLength={500}
          />
          <Text style={styles.charCount}>{rejectReason.length}/500</Text>
          <View style={styles.modalRow}>
            <Pressable
              style={styles.modalCancel}
              onPress={() => {
                setRejectOpen(false)
                setRejectReason('')
              }}
            >
              <Text style={styles.modalCancelText}>İptal</Text>
            </Pressable>
            <Pressable
              style={[styles.modalOk, (!rejectReason.trim() || busyReject) && styles.btnDisabled]}
              onPress={() => void onRejectConfirm()}
              disabled={!rejectReason.trim() || busyReject}
            >
              {busyReject ? (
                <ActivityIndicator color="#fff" />
              ) : (
                <Text style={styles.modalOkText}>Reddet</Text>
              )}
            </Pressable>
          </View>
        </View>
      </SwipeDismissSheet>
    </>
  )
}

const styles = StyleSheet.create({
  wrap: { paddingHorizontal: stats.marginMobile, marginTop: 18, gap: 14 },
  sheetPad: { paddingHorizontal: stats.marginMobile },
  card: {
    backgroundColor: '#f9fafb',
    paddingVertical: 20,
    paddingHorizontal: 18,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: '#e5e7eb',
  },
  cardHead: { flexDirection: 'row', alignItems: 'flex-start', gap: 14, marginBottom: 20 },
  cardHeadText: { flex: 1, minWidth: 0 },
  iconCircle: {
    width: 48,
    height: 48,
    borderRadius: 24,
    alignItems: 'center',
    justifyContent: 'center',
  },
  iconSky: { backgroundColor: '#f0fdf4' },
  iconGreen: { backgroundColor: '#f0fdf4' },
  title: {
    fontWeight: '700',
    fontSize: 17,
    letterSpacing: -0.2,
    color: '#111827',
    marginBottom: 6,
  },
  body: {
    fontSize: 13,
    lineHeight: 18,
    color: '#6b7280',
  },
  ctaStack: { gap: 0 },
  sectionLabel: {
    fontSize: 11,
    letterSpacing: 0.8,
    textTransform: 'uppercase',
    color: '#9ca3af',
    marginBottom: 10,
    fontWeight: '600',
  },
  sectionDivider: {
    height: 1,
    backgroundColor: '#e5e7eb',
    marginVertical: 18,
    marginHorizontal: 2,
  },
  ctaRow: {
    flexDirection: 'row',
    alignItems: 'stretch',
    gap: 10,
  },
  btnPrepHalf: {
    flex: 1,
    minWidth: 0,
    paddingHorizontal: 8,
  },
  btnPrepFull: {
    alignSelf: 'stretch',
    paddingHorizontal: 12,
  },
  btnDecisionReject: {
    flex: 1,
    minWidth: 0,
    paddingHorizontal: 8,
  },
  btnDecisionApprove: {
    flex: 2,
    minWidth: 0,
    paddingHorizontal: 10,
  },
  stage2Hint: {
    fontSize: 13,
    lineHeight: 18,
    color: '#6b7280',
    marginBottom: 14,
  },
  btnInline: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  btnOutlineBlue: {
    minHeight: 48,
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 12,
    paddingHorizontal: 10,
    borderRadius: 9999,
    borderWidth: 1,
    borderColor: '#d1fae5',
    backgroundColor: '#ffffff',
  },
  btnOutlineBlueText: {
    fontWeight: '600',
    fontSize: 14,
    lineHeight: 18,
    color: '#047857',
    flexShrink: 1,
    textAlign: 'center',
    ...Platform.select({
      android: { includeFontPadding: false },
      default: {},
    }),
  },
  btnOutlineEmerald: {
    minHeight: 48,
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 12,
    paddingHorizontal: 10,
    borderRadius: 9999,
    borderWidth: 1,
    borderColor: '#d1fae5',
    backgroundColor: '#ffffff',
  },
  btnOutlineEmeraldText: {
    fontWeight: '600',
    fontSize: 14,
    lineHeight: 18,
    color: '#047857',
    flexShrink: 1,
    textAlign: 'center',
    ...Platform.select({
      android: { includeFontPadding: false },
      default: {},
    }),
  },
  btnRejectOutline: {
    minHeight: 48,
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 12,
    paddingHorizontal: 10,
    borderRadius: 9999,
    borderWidth: 1,
    borderColor: '#fecaca',
    backgroundColor: '#ffffff',
  },
  btnRejectOutlineText: {
    fontWeight: '600',
    fontSize: 14,
    lineHeight: 18,
    color: '#dc2626',
    flexShrink: 1,
    textAlign: 'center',
    ...Platform.select({
      android: { includeFontPadding: false },
      default: {},
    }),
  },
  btnApproveBrand: {
    minHeight: 52,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderRadius: 9999,
    backgroundColor: '#01E884',
  },
  btnApproveBrandText: {
    fontWeight: '700',
    fontSize: 16,
    lineHeight: 20,
    letterSpacing: -0.2,
    color: '#111827',
    textAlign: 'center',
    ...Platform.select({
      android: { includeFontPadding: false },
      default: {},
    }),
  },
  btnPrimaryGreen: {
    minHeight: 52,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderRadius: 9999,
    backgroundColor: '#01E884',
  },
  btnPrimaryGreenText: {
    fontWeight: '700',
    fontSize: 14,
    lineHeight: 18,
    letterSpacing: -0.2,
    color: '#111827',
    flexShrink: 1,
    textAlign: 'center',
    ...Platform.select({
      android: { includeFontPadding: false },
      default: {},
    }),
  },
  btnDisabled: { opacity: 0.6 },
  modalSub: { fontSize: 14, color: '#6b7280', marginBottom: 12 },
  modalInput: {
    borderWidth: 1,
    borderColor: '#e5e7eb',
    borderRadius: 16,
    minHeight: 100,
    padding: 14,
    fontSize: 15,
    color: '#111827',
    backgroundColor: '#ffffff',
    textAlignVertical: 'top',
  },
  charCount: { fontSize: 12, color: '#9ca3af', textAlign: 'right', marginTop: 4 },
  modalRow: { flexDirection: 'row', gap: 12, marginTop: 16 },
  modalCancel: {
    flex: 1,
    paddingVertical: 14,
    alignItems: 'center',
    borderRadius: 9999,
    borderWidth: 1,
    borderColor: '#e5e7eb',
    backgroundColor: '#ffffff',
  },
  modalCancelText: { fontWeight: '600', color: '#111827' },
  modalOk: {
    flex: 1,
    paddingVertical: 14,
    alignItems: 'center',
    borderRadius: 9999,
    backgroundColor: '#dc2626',
  },
  modalOkText: { fontWeight: '600', color: '#ffffff' },
})
