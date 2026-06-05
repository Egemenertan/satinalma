import { useCallback, useMemo, useState } from 'react'
import {
  ActivityIndicator,
  Alert,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native'
import MaterialIcons from '@expo/vector-icons/MaterialIcons'
import { useTranslation } from 'react-i18next'
import { SwipeDismissSheet } from '../../island/SwipeDismissSheet'
import {
  siteManagerApproveOrSendToPurchasing,
  siteManagerRejectRequest,
} from '../../../features/siteManager/siteManagerRequestActions'
import { supabase } from '../../../lib/supabase'
import { stats, statsCardSurface, statsFont, statsType } from '../../../theme/statsDesignTokens'

const APPROVAL_STATUSES = [
  'onay_bekliyor',
  'awaiting_offers',
  'kısmen gönderildi',
  'depoda mevcut değil',
  'ana depoda yok',
] as const

type Props = {
  requestId: string
  status: string | null
  siteId: string | null
  canEdit: boolean
  onEditPress: () => void
  onSuccess: () => void
}

function canShowSiteManagerEdit(status: string | null) {
  if (!status) return false
  return ['kısmen gönderildi', 'depoda mevcut değil', 'ana depoda yok'].includes(status)
}

export function SiteManagerActionsRn({ requestId, status, siteId, canEdit, onEditPress, onSuccess }: Props) {
  const { t } = useTranslation()
  const [busyApprove, setBusyApprove] = useState(false)
  const [busyReject, setBusyReject] = useState(false)
  const [rejectOpen, setRejectOpen] = useState(false)
  const [rejectReason, setRejectReason] = useState('')

  const showActions = useMemo(() => {
    if (!status) return false
    return (APPROVAL_STATUSES as readonly string[]).includes(status)
  }, [status])

  const primaryLabel =
    status === 'onay_bekliyor' || status === 'awaiting_offers' ? t('siteActions.approve') : t('siteActions.send')

  const description = useMemo(() => {
    if (status === 'onay_bekliyor' || status === 'awaiting_offers') {
      return t('siteManager.descApproveReject')
    }
    if (status === 'kısmen gönderildi') {
      return t('siteManager.descPartial')
    }
    if (status === 'ana depoda yok') {
      return t('siteManager.descAnaDepo')
    }
    if (status === 'depoda mevcut değil') {
      return t('siteManager.descDepoda')
    }
    return ''
  }, [status, t])

  const onApprove = useCallback(async () => {
    setBusyApprove(true)
    try {
      const { message } = await siteManagerApproveOrSendToPurchasing(supabase, requestId, status, siteId)
      Alert.alert(t('common.ok'), message)
      onSuccess()
    } catch (e) {
      const msg = e instanceof Error ? e.message : t('common.unknownError')
      Alert.alert(t('common.error'), msg)
    } finally {
      setBusyApprove(false)
    }
  }, [requestId, status, siteId, onSuccess, t])

  const onRejectConfirm = useCallback(async () => {
    const reason = rejectReason.trim()
    if (!reason) {
      Alert.alert(t('common.warning'), t('siteManager.rejectReasonMissing'))
      return
    }
    setBusyReject(true)
    try {
      await siteManagerRejectRequest(supabase, requestId, reason)
      setRejectOpen(false)
      setRejectReason('')
      Alert.alert(t('common.ok'), t('siteManager.rejectedOk'))
      onSuccess()
    } catch (e) {
      const msg = e instanceof Error ? e.message : t('common.unknownError')
      Alert.alert(t('common.error'), msg)
    } finally {
      setBusyReject(false)
    }
  }, [rejectReason, requestId, onSuccess, t])

  if (!showActions) {
    return null
  }

  const showEdit = canEdit && canShowSiteManagerEdit(status)

  return (
    <View style={styles.wrap}>
      <View style={styles.card}>
        <View style={styles.cardHead}>
          <View style={styles.iconCircle}>
            <MaterialIcons name="inventory-2" size={22} color={stats.primary} />
          </View>
          <View style={styles.cardHeadText}>
            <View style={styles.titleRow}>
              <Text style={styles.title}>{t('siteManager.cardTitle')}</Text>
              {showEdit ? (
                <Pressable style={styles.editLink} onPress={onEditPress} hitSlop={8}>
                  <MaterialIcons name="edit" size={18} color={stats.primary} />
                  <Text style={styles.editLinkText}>{t('common.edit')}</Text>
                </Pressable>
              ) : null}
            </View>
            {description ? (
              <Text style={styles.body} numberOfLines={2}>
                {description}
              </Text>
            ) : null}
          </View>
        </View>

        <View style={styles.ctaRow}>
          <Pressable
            style={[
              styles.btnRejectInline,
              (busyApprove || busyReject) && styles.btnDisabled,
            ]}
            onPress={() => {
              setRejectReason('')
              setRejectOpen(true)
            }}
            disabled={busyApprove || busyReject}
          >
            {busyReject ? (
              <ActivityIndicator color={stats.error} size="small" />
            ) : (
              <Text style={styles.btnRejectInlineText}>{t('siteManager.reject')}</Text>
            )}
          </Pressable>
          <Pressable
            style={[styles.btnPrimaryInline, (busyApprove || busyReject) && styles.btnDisabled]}
            onPress={() => void onApprove()}
            disabled={busyApprove || busyReject}
          >
            {busyApprove ? (
              <ActivityIndicator color={stats.onPrimary} size="small" />
            ) : (
              <Text style={styles.btnPrimaryInlineText}>{primaryLabel}</Text>
            )}
          </Pressable>
        </View>
      </View>

      <SwipeDismissSheet
        visible={rejectOpen}
        onRequestClose={() => {
          setRejectOpen(false)
          setRejectReason('')
        }}
        title={t('siteManager.sheetTitle')}
        maxHeightRatio={0.72}
      >
        <View style={styles.sheetPad}>
          <Text style={styles.modalSub}>{t('siteManager.sheetSub')}</Text>
          <TextInput
            style={styles.modalInput}
            placeholder={t('siteManager.placeholder')}
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
              <Text style={styles.modalCancelText}>{t('common.cancel')}</Text>
            </Pressable>
            <Pressable
              style={[styles.modalOk, (!rejectReason.trim() || busyReject) && styles.btnDisabled]}
              onPress={() => void onRejectConfirm()}
              disabled={!rejectReason.trim() || busyReject}
            >
              {busyReject ? (
                <ActivityIndicator color="#fff" />
              ) : (
                <Text style={styles.modalOkText}>{t('siteManager.reject')}</Text>
              )}
            </Pressable>
          </View>
        </View>
      </SwipeDismissSheet>
    </View>
  )
}

const styles = StyleSheet.create({
  sheetPad: { paddingHorizontal: stats.marginMobile },
  wrap: { paddingHorizontal: stats.marginMobile, marginTop: 18, marginBottom: 28 },
  card: {
    ...statsCardSurface.listItem,
    paddingVertical: 16,
    paddingHorizontal: 16,
    alignItems: 'stretch',
    borderRadius: 14,
  },
  cardHead: { flexDirection: 'row', alignItems: 'flex-start', gap: 12, marginBottom: 14 },
  cardHeadText: { flex: 1, minWidth: 0 },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
    marginBottom: 4,
  },
  iconCircle: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: 'rgba(0, 230, 118, 0.12)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  title: {
    fontFamily: statsFont.bold,
    fontSize: 17,
    letterSpacing: -0.2,
    color: stats.onSurface,
    flex: 1,
  },
  editLink: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingVertical: 4,
    paddingLeft: 8,
  },
  editLinkText: { ...statsType.labelMd, fontSize: 13, color: stats.primary },
  body: {
    ...statsType.labelSm,
    fontSize: 13,
    lineHeight: 18,
    color: stats.onSurfaceVariant,
  },
  ctaRow: { flexDirection: 'row', alignItems: 'stretch', gap: 10 },
  btnRejectInline: {
    flex: 1,
    minHeight: 48,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 12,
    borderRadius: stats.radiusXl,
    borderWidth: 1,
    borderColor: 'rgba(186, 26, 26, 0.32)',
    backgroundColor: stats.surfaceContainerLowest,
  },
  btnRejectInlineText: { fontFamily: statsFont.semibold, fontSize: 14, color: stats.error },
  btnPrimaryInline: {
    flex: 1.85,
    minHeight: 48,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 14,
    borderRadius: stats.radiusXl,
    backgroundColor: stats.primary,
    ...(stats.shadowSm ?? {}),
  },
  btnPrimaryInlineText: { fontFamily: statsFont.semibold, fontSize: 15, color: stats.onPrimary },
  btnDisabled: { opacity: 0.6 },
  modalSub: { ...statsType.bodyMd, color: stats.onSurfaceVariant, marginBottom: 12 },
  modalInput: {
    borderWidth: 1,
    borderColor: stats.outlineVariant,
    borderRadius: stats.radiusXl,
    minHeight: 100,
    padding: 12,
    ...statsType.bodyLg,
    color: stats.onSurface,
    textAlignVertical: 'top',
  },
  charCount: { ...statsType.labelSm, color: stats.outline, textAlign: 'right', marginTop: 4 },
  modalRow: { flexDirection: 'row', gap: 12, marginTop: 16 },
  modalCancel: {
    flex: 1,
    paddingVertical: 12,
    alignItems: 'center',
    borderRadius: stats.radiusXl,
    borderWidth: 1,
    borderColor: stats.outlineVariant,
    backgroundColor: stats.surfaceContainerLowest,
  },
  modalCancelText: { fontFamily: statsFont.semibold, color: stats.onSurface },
  modalOk: {
    flex: 1,
    paddingVertical: 12,
    alignItems: 'center',
    borderRadius: stats.radiusXl,
    backgroundColor: stats.onSurface,
  },
  modalOkText: { fontFamily: statsFont.semibold, color: stats.surfaceContainerLowest },
})
