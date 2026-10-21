import { StyleSheet, Text, View } from 'react-native'
import { STATUS_BADGE_MAP } from '../../lib/requestBadges'

type Props = {
  status: string | null | undefined
}

export function RequestStatusNoticeRn({ status }: Props) {
  if (status === 'beklemede') {
    return (
      <View style={[styles.banner, styles.yellow]}>
        <Text style={[styles.title, styles.yellowText]}>Ana depo kontrolü yapılıyor</Text>
      </View>
    )
  }

  if (status === 'gönderildi') {
    return (
      <View style={[styles.banner, styles.green]}>
        <Text style={[styles.title, styles.greenText]}>Ana depoda mevcut</Text>
        <Text style={[styles.sub, styles.greenSub]}>Teslim almak için depoya başvurun</Text>
      </View>
    )
  }

  return null
}

export function requestStatusLabel(status: string | null | undefined): string {
  if (!status) return '—'
  return STATUS_BADGE_MAP[status]?.label ?? status
}

const styles = StyleSheet.create({
  banner: {
    marginHorizontal: 20,
    marginTop: 16,
    borderRadius: 20,
    borderWidth: 1,
    paddingHorizontal: 20,
    paddingVertical: 18,
  },
  yellow: { backgroundColor: '#FACC15', borderColor: '#EAB308' },
  green: { backgroundColor: '#86EFAC', borderColor: '#4ADE80' },
  title: { fontSize: 22, fontWeight: '700' },
  sub: { marginTop: 6, fontSize: 16, fontWeight: '600' },
  yellowText: { color: '#422006' },
  greenText: { color: '#052E16' },
  greenSub: { color: '#14532D' },
})
