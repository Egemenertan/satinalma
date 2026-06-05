import AsyncStorage from '@react-native-async-storage/async-storage'
import type { CartItemRn } from '../components/create/MaterialDetailModalRn'

const KEY_V1 = 'create_request_draft_cart_v1'

export function createDraftCartStorageKey(userId: string): string {
  return `${KEY_V1}:${userId}`
}

export async function loadPersistedCreateDraftCart(userId: string): Promise<CartItemRn[] | null> {
  try {
    const raw = await AsyncStorage.getItem(createDraftCartStorageKey(userId))
    if (!raw) return null
    const data = JSON.parse(raw) as unknown
    if (!Array.isArray(data)) return null
    return data as CartItemRn[]
  } catch {
    return null
  }
}

/** Sepet boşsa anahtarı siler; böylece gereksiz depolama kalmaz. */
export async function savePersistedCreateDraftCart(userId: string, cart: CartItemRn[]): Promise<void> {
  try {
    const key = createDraftCartStorageKey(userId)
    if (cart.length === 0) {
      await AsyncStorage.removeItem(key)
      return
    }
    await AsyncStorage.setItem(key, JSON.stringify(cart))
  } catch {
    // sessiz; talep akışını bloklamayız
  }
}
