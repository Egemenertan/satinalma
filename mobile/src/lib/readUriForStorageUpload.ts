import { Platform } from 'react-native'
import { File as ExpoFile } from 'expo-file-system'
import { readAsStringAsync, EncodingType } from 'expo-file-system/legacy'

function guessContentType(uri: string): string {
  const ext = uri.split('.').pop()?.split('?')[0]?.toLowerCase() || 'jpg'
  if (ext === 'png') return 'image/png'
  if (ext === 'webp') return 'image/webp'
  if (ext === 'heic' || ext === 'heif') return 'image/heic'
  if (ext === 'jpeg' || ext === 'jpg') return 'image/jpeg'
  return 'image/jpeg'
}

async function readNativeLocalUriAsArrayBuffer(uri: string): Promise<ArrayBuffer> {
  try {
    const file = new ExpoFile(uri)
    const data = await file.arrayBuffer()
    if (data.byteLength > 0) return data
  } catch {
    /* `content://` / `ph://` vb. için yeni API yetmezse legacy dene */
  }
  const base64 = await readAsStringAsync(uri, { encoding: EncodingType.Base64 })
  if (!base64?.length) {
    throw new Error('Görsel okunamadı')
  }
  const binaryString = atob(base64)
  const len = binaryString.length
  if (len === 0) {
    throw new Error('Görsel verisi boş')
  }
  const bytes = new Uint8Array(len)
  for (let i = 0; i < len; i++) {
    bytes[i] = binaryString.charCodeAt(i)
  }
  return bytes.buffer
}

/**
 * RN'de `fetch(file://...)` çoğu zaman boş Blob verir; Storage'a 0 byte yüklenir.
 * Expo File API (+ gerekirse legacy base64) ile gerçek baytları okur.
 */
export async function readUriForStorageUpload(uri: string): Promise<{ data: ArrayBuffer; contentType: string }> {
  const fallbackType = guessContentType(uri)

  if (/^https?:\/\//i.test(uri)) {
    const res = await fetch(uri)
    if (!res.ok) throw new Error(`HTTP ${res.status}`)
    const blob = await res.blob()
    const buf = await blob.arrayBuffer()
    return { data: buf, contentType: blob.type || fallbackType }
  }

  if (Platform.OS === 'web') {
    const res = await fetch(uri)
    const blob = await res.blob()
    const buf = await blob.arrayBuffer()
    return { data: buf, contentType: blob.type || fallbackType }
  }

  const data = await readNativeLocalUriAsArrayBuffer(uri)
  return { data, contentType: fallbackType }
}
