/**
 * Application Constants
 * Merkezi yapılandırma değerleri
 */

// Supabase Configuration
export const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL
export const SUPABASE_ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY

// Supabase Storage URLs
const STORAGE_BASE_URL = process.env.NEXT_PUBLIC_SUPABASE_STORAGE_URL || 
  `${SUPABASE_URL}/storage/v1/object/public/satinalma`

export const STORAGE_URLS = {
  LOGO: `${STORAGE_BASE_URL}/dovecbb.png`,
  ICON: `${STORAGE_BASE_URL}/dove.png`,
  AVATAR: `${STORAGE_BASE_URL}/dunya.png`,
} as const

// Special Site Configuration
export const SPECIAL_SITE_ID = '18e8e316-1291-429d-a591-5cec97d235b7' // Genel Merkez Ofisi
export const SPECIAL_SITE_PRODUCT_CATEGORIES = [
  '2fc60d65-ff59-4872-85c4-888097d5a966', // Bilgisayar ve Bileşenleri
  '790f8c1d-c567-4e28-811f-985951fc3df1', // REKLAM
  '01a80c11-54c0-41e5-abc8-f6920af85da4'  // Ofis Malzemeleri
] as const

// Validation
if (!SUPABASE_URL) {
  console.error('❌ NEXT_PUBLIC_SUPABASE_URL is not defined in environment variables')
}

if (!SUPABASE_ANON_KEY) {
  console.error('❌ NEXT_PUBLIC_SUPABASE_ANON_KEY is not defined in environment variables')
}

