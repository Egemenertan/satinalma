import { Redirect } from 'expo-router'
import { useAuth } from '../src/providers/AuthProvider'

export default function NotFoundScreen() {
  const { session } = useAuth()

  if (session) {
    return <Redirect href="/(app)/requests" />
  }
  return <Redirect href="/login" />
}
