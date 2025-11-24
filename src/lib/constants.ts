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

// Validation
if (!SUPABASE_URL) {
  console.error('❌ NEXT_PUBLIC_SUPABASE_URL is not defined in environment variables')
}

if (!SUPABASE_ANON_KEY) {
  console.error('❌ NEXT_PUBLIC_SUPABASE_ANON_KEY is not defined in environment variables')
}

