import { Redirect } from 'expo-router'
import { ActivityIndicator, View } from 'react-native'
import { useAuth } from '../src/providers/AuthProvider'

export default function Index() {
  const { session, loading } = useAuth()

  if (loading) {
    return (
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
        <ActivityIndicator size="large" color="#01E884" />
      </View>
    )
  }

  if (session) {
    return <Redirect href="/(app)/requests" />
  }
  return <Redirect href="/login" />
}
