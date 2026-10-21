/** Metro bu dosyayı Node ortamında çalıştırır; .env burada okunur ve extra ile uygulamaya taşınır. */
const path = require('path')

require('dotenv').config({ path: path.join(__dirname, '.env') })

const supabaseUrl =
  process.env.EXPO_PUBLIC_SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL || ''

const supabaseAnonKey =
  process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || ''

/** `config` Expo tarafından app.json ile doldurulur. */
module.exports = ({ config }) => ({
  ...config,
  android: {
    ...config.android,
    googleServicesFile: process.env.GOOGLE_SERVICES_JSON || './google-services.json',
  },
  plugins: [...(config.plugins || []), 'expo-font', '@react-native-community/datetimepicker'],
  extra: {
    ...config.extra,
    supabaseUrl,
    supabaseAnonKey,
    eas: {
      projectId: 'a4cb05c2-07fa-4b4e-91e0-48bb1e2b3bc3',
    },
  },
})
