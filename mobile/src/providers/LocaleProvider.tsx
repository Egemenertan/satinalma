import AsyncStorage from '@react-native-async-storage/async-storage'
import type { ReactNode } from 'react'
import { useEffect } from 'react'
import { I18nextProvider } from 'react-i18next'
import i18n from '../i18n/i18n'

const STORAGE_KEY = '@satinalma_locale_v1'

export function LocaleProvider({ children }: { children: ReactNode }) {
  useEffect(() => {
    void AsyncStorage.getItem(STORAGE_KEY).then((raw) => {
      if (raw === 'en' || raw === 'tr') void i18n.changeLanguage(raw)
    })
  }, [])
  return <I18nextProvider i18n={i18n}>{children}</I18nextProvider>
}
