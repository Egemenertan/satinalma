import AsyncStorage from '@react-native-async-storage/async-storage'
import i18n from './i18n'

const STORAGE_KEY = '@satinalma_locale_v1'

export type AppLocale = 'tr' | 'en'

export async function persistLocale(lng: AppLocale): Promise<void> {
  await AsyncStorage.setItem(STORAGE_KEY, lng)
  await i18n.changeLanguage(lng)
}
