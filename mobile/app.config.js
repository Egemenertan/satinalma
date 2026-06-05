/** Metro bu dosyayı Node ortamında çalıştırır; .env burada okunur ve extra ile uygulamaya taşınır. */
const path = require('path')

// eslint-disable-next-line @typescript-eslint/no-var-requires
require('dotenv').config({ path: path.join(__dirname, '.env') })

const appJson = require('./app.json')

const supabaseUrl =
  process.env.EXPO_PUBLIC_SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL || ''

const supabaseAnonKey =
  process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || ''

module.exports = {
  expo: {
    ...appJson.expo,
    scheme: 'satinalma',
    plugins: [
      ...(appJson.expo.plugins || []),
      'expo-font',
      '@react-native-community/datetimepicker',
    ],
    extra: {
      supabaseUrl,
      supabaseAnonKey,
      eas: {
        projectId: 'a4cb05c2-07fa-4b4e-91e0-48bb1e2b3bc3',
      },
    },
  },
}
