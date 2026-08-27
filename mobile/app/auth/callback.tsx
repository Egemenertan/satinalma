import * as WebBrowser from 'expo-web-browser'
import { Redirect } from 'expo-router'
import { useEffect } from 'react'
import { ActivityIndicator, View } from 'react-native'

WebBrowser.maybeCompleteAuthSession()

export default function AuthCallback() {
  useEffect(() => {
    WebBrowser.maybeCompleteAuthSession()
  }, [])

  return (
    <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#fff' }}>
      <ActivityIndicator size="large" color="#01E884" />
      <Redirect href="/login" />
    </View>
  )
}
