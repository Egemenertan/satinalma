import { useEffect, useState } from 'react'
import { ActivityIndicator, Image, type ImageStyle, type StyleProp, View } from 'react-native'
import { createSignedSatinalmaUrl, extractSatinalmaStoragePath } from '../../lib/satinalmaStorage'
import { supabase } from '../../lib/supabase'
import { stats } from '../../theme/statsDesignTokens'

type Props = {
  uri: string
  style: StyleProp<ImageStyle>
  resizeMode?: 'cover' | 'contain' | 'stretch' | 'center'
}

/**
 * `satinalma` bucket’ı RLS ile kısıtlıysa public URL görüntülenmez; imzalı URL kullanır.
 */
export function SignedSatinalmaImageRn({ uri, style, resizeMode = 'cover' }: Props) {
  const [src, setSrc] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let alive = true
    const path = extractSatinalmaStoragePath(uri)
    if (!path) {
      setSrc(uri)
      setLoading(false)
      return () => {
        alive = false
      }
    }
    setLoading(true)
    void createSignedSatinalmaUrl(supabase, uri)
      .then((signed) => {
        if (!alive) return
        setSrc(signed || uri)
      })
      .finally(() => {
        if (alive) setLoading(false)
      })
    return () => {
      alive = false
    }
  }, [uri])

  if (loading && !src) {
    return (
      <View style={[style, { justifyContent: 'center', alignItems: 'center', backgroundColor: stats.surfaceContainer }]}>
        <ActivityIndicator size="small" color={stats.onSurfaceVariant} />
      </View>
    )
  }

  return <Image source={{ uri: src || uri }} style={style} resizeMode={resizeMode} />
}
