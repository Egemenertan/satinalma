import type { TFunction } from 'i18next'
import { SPECIAL_SITE_ID } from './constants'

export type StatusPresentation = {
  label: string
  bg: string
  color: string
  borderColor?: string
  extraBadges: { label: string; bg: string; color: string }[]
}

/** Renkler web ile uyumlu — metinler i18n ile */
export const STATUS_BADGE_MAP: Record<string, Omit<StatusPresentation, 'extraBadges'>> = {
  draft: { label: 'Taslak', bg: '#f3f4f6', color: '#374151' },
  pending: { label: 'Beklemede', bg: '#fef9c3', color: '#854d0e' },
  'onay bekliyor': { label: 'Onay Bekliyor', bg: '#dbeafe', color: '#1e40af' },
  onay_bekliyor: { label: 'Onay Bekliyor', bg: '#dbeafe', color: '#1e40af' },
  departman_onayı_bekliyor: {
    label: 'Departman Onayı Bekliyor',
    bg: '#fffbeb',
    color: '#b45309',
    borderColor: '#fcd34d',
  },
  it_incelemesinde: { label: 'IT — İncelemede', bg: '#e0f2fe', color: '#075985', borderColor: '#7dd3fc' },
  it_onaylandi: {
    label: 'IT — Onaylandı (Satın almaya hazır)',
    bg: '#d1fae5',
    color: '#065f46',
    borderColor: '#6ee7b7',
  },
  'teklif bekliyor': { label: 'Teklif Bekliyor', bg: '#f3e8ff', color: '#6b21a8' },
  onaylandı: { label: 'Onaylandı', bg: '#dcfce7', color: '#166534' },
  'satın almaya gönderildi': { label: 'Satın Almaya Gönderildi', bg: '#dbeafe', color: '#1e40af' },
  'sipariş verildi': { label: 'Sipariş Verildi', bg: '#dcfce7', color: '#166534' },
  ordered: { label: 'Sipariş Verildi', bg: '#dcfce7', color: '#166534' },
  gönderildi: { label: 'Gönderildi', bg: '#d1fae5', color: '#065f46' },
  'kısmen gönderildi': { label: 'Kısmen Gönderildi', bg: '#fee2e2', color: '#991b1b' },
  'kısmen teslim alındı': { label: 'Kısmen Teslim Alındı', bg: '#fee2e2', color: '#991b1b' },
  'depoda mevcut değil': { label: 'Depoda Mevcut Değil', bg: '#fee2e2', color: '#991b1b' },
  'ana depoda yok': { label: 'Ana Depoda Yok', bg: '#fee2e2', color: '#991b1b' },
  'teslim alındı': { label: 'Teslim Alındı', bg: '#dcfce7', color: '#166534' },
  'iade var': { label: 'İade Var', bg: '#fee2e2', color: '#991b1b' },
  'iade nedeniyle sipariş': { label: 'İade Nedeniyle Sipariş', bg: '#f3e8ff', color: '#6b21a8' },
  reddedildi: { label: 'Reddedildi', bg: '#fee2e2', color: '#991b1b' },
  rejected: { label: 'Reddedildi', bg: '#fee2e2', color: '#991b1b' },
  cancelled: { label: 'İptal Edildi', bg: '#f3f4f6', color: '#4b5563' },
  'şantiye şefi onayladı': { label: 'Onay Bekliyor', bg: '#dbeafe', color: '#1e40af' },
  awaiting_offers: { label: 'Teklif Bekliyor', bg: '#f3e8ff', color: '#6b21a8' },
  approved: { label: 'Onaylandı', bg: '#dcfce7', color: '#166534' },
  delivered: { label: 'Teslim Alındı', bg: '#dcfce7', color: '#166534' },
  'eksik onaylandı': { label: 'Onay Bekliyor', bg: '#dbeafe', color: '#1e40af' },
  'alternatif onaylandı': { label: 'Onaylandı', bg: '#dcfce7', color: '#166534' },
  'eksik malzemeler talep edildi': {
    label: 'Satın Almaya Gönderildi',
    bg: '#dbeafe',
    color: '#1e40af',
  },
}

/** STATUS_BADGE_MAP anahtarı → çeviri anahtarı (requestStatus.<slug>) */
export const STATUS_LABEL_KEYS: Record<string, string> = {
  draft: 'draft',
  pending: 'pending',
  'onay bekliyor': 'onay_bekliyor',
  onay_bekliyor: 'onay_bekliyor',
  departman_onayı_bekliyor: 'departman_onayi_bekliyor',
  it_incelemesinde: 'it_incelemesinde',
  it_onaylandi: 'it_onaylandi',
  'teklif bekliyor': 'teklif_bekliyor',
  onaylandı: 'onaylandi',
  'satın almaya gönderildi': 'satin_almaya_gonderildi',
  'sipariş verildi': 'siparis_verildi',
  ordered: 'siparis_verildi',
  gönderildi: 'gonderildi',
  'kısmen gönderildi': 'kismen_gonderildi',
  'kısmen teslim alındı': 'kismen_teslim_alindi',
  'depoda mevcut değil': 'depoda_mevcut_degil',
  'ana depoda yok': 'ana_depoda_yok',
  'teslim alındı': 'teslim_alindi',
  'iade var': 'iade_var',
  'iade nedeniyle sipariş': 'iade_nedeniyle_siparis',
  reddedildi: 'reddedildi',
  rejected: 'reddedildi',
  cancelled: 'cancelled',
  'şantiye şefi onayladı': 'santiye_sefi_onayladi',
  awaiting_offers: 'awaiting_offers',
  approved: 'approved',
  delivered: 'delivered',
  'eksik onaylandı': 'eksik_onaylandi',
  'alternatif onaylandı': 'alternatif_onaylandi',
  'eksik malzemeler talep edildi': 'eksik_malzemeler_talep_edildi',
}

export const REQUEST_STATUS_FILTER_OPTIONS: string[] = Object.keys(STATUS_BADGE_MAP)

export function getStatusPresentation(
  status: string,
  userRole: string,
  userSiteIds: string[],
  notifications: string[] | null | undefined,
  t: TFunction
): StatusPresentation {
  const extraBadges: StatusPresentation['extraBadges'] = []
  if (notifications?.includes('iade var')) {
    extraBadges.push({
      label: t('badges.return'),
      bg: '#fef2f2',
      color: '#b91c1c',
    })
  }

  const isSpecialSiteUser = userSiteIds.includes(SPECIAL_SITE_ID)
  if (isSpecialSiteUser && status === 'pending') {
    return {
      label: t('requestStatus.onaylandi'),
      bg: '#dcfce7',
      color: '#166534',
      extraBadges,
    }
  }

  if (userRole === 'purchasing_officer') {
    if (
      status === 'satın almaya gönderildi' ||
      status === 'eksik malzemeler talep edildi' ||
      status === 'kısmen gönderildi'
    ) {
      return {
        label: t('requestStatus.po_pending'),
        bg: '#fef9c3',
        color: '#854d0e',
        extraBadges,
      }
    }
  }

  const visual = STATUS_BADGE_MAP[status]
  const fallback = { label: status || t('common.dash'), bg: '#f3f4f6', color: '#374151' }
  const base = visual ?? fallback
  const slug = STATUS_LABEL_KEYS[status]
  const label = slug ? t(`requestStatus.${slug}`) : base.label
  return {
    label,
    bg: base.bg,
    color: base.color,
    borderColor: base.borderColor,
    extraBadges,
  }
}

export function getUrgencyPresentation(
  urgency: string,
  t: TFunction
): { label: string; bg: string; color: string } {
  const colors: Record<string, { bg: string; color: string }> = {
    critical: { bg: '#fee2e2', color: '#991b1b' },
    high: { bg: '#fee2e2', color: '#991b1b' },
    normal: { bg: '#dbeafe', color: '#1e40af' },
    low: { bg: '#dcfce7', color: '#166534' },
  }
  const slug =
    urgency === 'critical'
      ? 'critical'
      : urgency === 'high'
        ? 'high'
        : urgency === 'low'
          ? 'low'
          : 'normal'
  const preset = colors[slug] ?? colors.normal
  return { label: t(`urgency.${slug}`), bg: preset.bg, color: preset.color }
}
