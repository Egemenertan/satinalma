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
  pending: { label: 'Beklemede', bg: '#FEF9C3', color: '#854D0E' },
  beklemede: { label: 'Ana depo kontrolü yapılıyor', bg: '#FACC15', color: '#422006' },
  'onay bekliyor': { label: 'Onay Bekliyor', bg: '#FEF9C3', color: '#854D0E' },
  onay_bekliyor: { label: 'Onay Bekliyor', bg: '#FEF9C3', color: '#854D0E' },
  departman_onayı_bekliyor: {
    label: 'Departman Onayı Bekliyor',
    bg: '#FEF9C3',
    color: '#854D0E',
  },
  it_incelemesinde: { label: 'IT — İncelemede', bg: '#FEF9C3', color: '#854D0E' },
  it_onaylandi: {
    label: 'IT — Onaylandı (Satın almaya hazır)',
    bg: '#DCFCE7',
    color: '#166534',
  },
  'teklif bekliyor': { label: 'Teklif Bekliyor', bg: '#FEF9C3', color: '#854D0E' },
  onaylandı: { label: 'Onaylandı', bg: '#DCFCE7', color: '#166534' },
  'satın almaya gönderildi': { label: 'Satın Almaya Gönderildi', bg: '#DCFCE7', color: '#166534' },
  'sipariş verildi': { label: 'Sipariş Verildi', bg: '#DCFCE7', color: '#166534' },
  ordered: { label: 'Sipariş Verildi', bg: '#DCFCE7', color: '#166534' },
  gönderildi: { label: 'Ana depoda mevcut', bg: '#DCFCE7', color: '#166534' },
  'kısmen gönderildi': { label: 'Kısmen Gönderildi', bg: '#FEF9C3', color: '#854D0E' },
  'kısmen teslim alındı': { label: 'Kısmen Teslim Alındı', bg: '#FEF9C3', color: '#854D0E' },
  'depoda mevcut değil': { label: 'Depoda Mevcut Değil', bg: '#FEE2E2', color: '#991B1B' },
  'ana depoda yok': { label: 'Ana Depoda Yok', bg: '#FEE2E2', color: '#991B1B' },
  'teslim alındı': { label: 'Teslim Alındı', bg: '#DCFCE7', color: '#166534' },
  'iade var': { label: 'İade Var', bg: '#FEE2E2', color: '#991B1B' },
  'iade nedeniyle sipariş': { label: 'İade Nedeniyle Sipariş', bg: '#FEE2E2', color: '#991B1B' },
  reddedildi: { label: 'Reddedildi', bg: '#FEE2E2', color: '#991B1B' },
  rejected: { label: 'Reddedildi', bg: '#FEE2E2', color: '#991B1B' },
  cancelled: { label: 'İptal Edildi', bg: '#f3f4f6', color: '#4b5563' },
  'şantiye şefi onayladı': { label: 'Onay Bekliyor', bg: '#FEF9C3', color: '#854D0E' },
  awaiting_offers: { label: 'Teklif Bekliyor', bg: '#FEF9C3', color: '#854D0E' },
  approved: { label: 'Onaylandı', bg: '#DCFCE7', color: '#166534' },
  delivered: { label: 'Teslim Alındı', bg: '#DCFCE7', color: '#166534' },
  'eksik onaylandı': { label: 'Onay Bekliyor', bg: '#FEF9C3', color: '#854D0E' },
  'alternatif onaylandı': { label: 'Onaylandı', bg: '#DCFCE7', color: '#166534' },
  'eksik malzemeler talep edildi': {
    label: 'Satın Almaya Gönderildi',
    bg: '#DCFCE7',
    color: '#166534',
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
      bg: '#FFF1F0',
      color: '#C2322F',
    })
  }

  const isSpecialSiteUser = userSiteIds.includes(SPECIAL_SITE_ID)
  if (isSpecialSiteUser && status === 'pending') {
    if (userRole === 'warehouse_manager') {
      return {
        label: t('requestStatus.onaylandi'),
        bg: '#F4F4F4',
        color: '#0A0A0A',
        extraBadges,
      }
    }
    return {
      label: t('requestStatus.pending'),
      bg: '#F8EEEE',
      color: '#53131E',
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
        bg: '#F8EEEE',
        color: '#53131E',
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
    critical: { bg: '#FFF1F0', color: '#C2322F' },
    high: { bg: '#FFF1F0', color: '#C2322F' },
    normal: { bg: '#E8F2F8', color: '#004777' },
    low: { bg: '#F4F4F4', color: '#0A0A0A' },
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
