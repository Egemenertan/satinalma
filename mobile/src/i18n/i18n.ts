import * as Localization from 'expo-localization'
import i18n from 'i18next'
import { initReactI18next } from 'react-i18next'
import { en } from './locales/en'
import { tr } from './locales/tr'

function deviceLng(): string {
  const code = Localization.getLocales()[0]?.languageCode?.toLowerCase()
  return code?.startsWith('tr') ? 'tr' : 'en'
}

void i18n.use(initReactI18next).init({
  resources: {
    tr: { translation: tr },
    en: { translation: en },
  },
  lng: deviceLng(),
  fallbackLng: 'tr',
  interpolation: { escapeValue: false },
  compatibilityJSON: 'v4',
})

export default i18n
