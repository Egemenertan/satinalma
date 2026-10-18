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
  pending: { label: 'Beklemede', bg: '#F8EEEE', color: '#53131E' },
  'onay bekliyor': { label: 'Onay Bekliyor', bg: '#E8F2F8', color: '#004777' },
  onay_bekliyor: { label: 'Onay Bekliyor', bg: '#E8F2F8', color: '#004777' },
  departman_onayı_bekliyor: {
    label: 'Departman Onayı Bekliyor',
    bg: '#F8EEEE',
    color: '#53131E',
    borderColor: '#E0B3B9',
  },
  it_incelemesinde: { label: 'IT — İncelemede', bg: '#E8F2F8', color: '#004777', borderColor: '#A6C9E2' },
  it_onaylandi: {
    label: 'IT — Onaylandı (Satın almaya hazır)',
    bg: '#F4F4F4',
    color: '#0A0A0A',
    borderColor: '#DEDEDE',
  },
  'teklif bekliyor': { label: 'Teklif Bekliyor', bg: '#F8EEEE', color: '#53131E' },
  onaylandı: { label: 'Onaylandı', bg: '#F4F4F4', color: '#0A0A0A' },
  'satın almaya gönderildi': { label: 'Satın Almaya Gönderildi', bg: '#E8F2F8', color: '#004777' },
  'sipariş verildi': { label: 'Sipariş Verildi', bg: '#F4F4F4', color: '#0A0A0A' },
  ordered: { label: 'Sipariş Verildi', bg: '#F4F4F4', color: '#0A0A0A' },
  gönderildi: { label: 'Gönderildi', bg: '#F4F4F4', color: '#0A0A0A' },
  'kısmen gönderildi': { label: 'Kısmen Gönderildi', bg: '#FFF1F0', color: '#C2322F' },
  'kısmen teslim alındı': { label: 'Kısmen Teslim Alındı', bg: '#FFF1F0', color: '#C2322F' },
  'depoda mevcut değil': { label: 'Depoda Mevcut Değil', bg: '#FFF1F0', color: '#C2322F' },
  'ana depoda yok': { label: 'Ana Depoda Yok', bg: '#FFF1F0', color: '#C2322F' },
  'teslim alındı': { label: 'Teslim Alındı', bg: '#F4F4F4', color: '#0A0A0A' },
  'iade var': { label: 'İade Var', bg: '#FFF1F0', color: '#C2322F' },
  'iade nedeniyle sipariş': { label: 'İade Nedeniyle Sipariş', bg: '#F8EEEE', color: '#53131E' },
  reddedildi: { label: 'Reddedildi', bg: '#FFF1F0', color: '#C2322F' },
  rejected: { label: 'Reddedildi', bg: '#FFF1F0', color: '#C2322F' },
  cancelled: { label: 'İptal Edildi', bg: '#f3f4f6', color: '#4b5563' },
  'şantiye şefi onayladı': { label: 'Onay Bekliyor', bg: '#E8F2F8', color: '#004777' },
  awaiting_offers: { label: 'Teklif Bekliyor', bg: '#F8EEEE', color: '#53131E' },
  approved: { label: 'Onaylandı', bg: '#F4F4F4', color: '#0A0A0A' },
  delivered: { label: 'Teslim Alındı', bg: '#F4F4F4', color: '#0A0A0A' },
  'eksik onaylandı': { label: 'Onay Bekliyor', bg: '#E8F2F8', color: '#004777' },
  'alternatif onaylandı': { label: 'Onaylandı', bg: '#F4F4F4', color: '#0A0A0A' },
  'eksik malzemeler talep edildi': {
    label: 'Satın Almaya Gönderildi',
    bg: '#E8F2F8',
    color: '#004777',
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
