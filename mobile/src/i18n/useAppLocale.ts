import { useTranslation } from 'react-i18next'
import type { AppLocale } from './persistLocale'
import { persistLocale } from './persistLocale'

export function useAppLocale(): {
  locale: AppLocale
  setLocale: (lng: AppLocale) => Promise<void>
} {
  const { i18n } = useTranslation()
  const locale: AppLocale = i18n.language?.toLowerCase().startsWith('en') ? 'en' : 'tr'
  return {
    locale,
    setLocale: persistLocale,
  }
}
