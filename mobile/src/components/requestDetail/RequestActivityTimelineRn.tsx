import { ActivityIndicator, StyleSheet, Text, View } from 'react-native'
import { useQuery } from '@tanstack/react-query'
import { useTranslation } from 'react-i18next'
import {
  formatActivityDateTime,
  mapApprovalHistoryToActivity,
  type RequestActivityRow,
} from '../../lib/requestActivity'
import { supabase } from '../../lib/supabase'
import { stats } from '../../theme/statsDesignTokens'

type Props = {
  requestId: string
  /** Talep güncellenince geçmişi yeniden çekmek için (ör. updated_at) */
  refreshKey?: string | number | null
}

export function RequestActivityTimelineRn({ requestId, refreshKey }: Props) {
  const { t, i18n } = useTranslation()

  const { data: items = [], isLoading, isError } = useQuery({
    queryKey: ['approval_history', requestId, refreshKey ?? null],
    enabled: Boolean(requestId),
    staleTime: 30_000,
    gcTime: 5 * 60_000,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('approval_history')
        .select(
          `
          id,
          action,
          comments,
          created_at,
          performed_by,
          profiles:performed_by (
            full_name,
            email,
            role
          )
        `
        )
        .eq('purchase_request_id', requestId)
        .order('created_at', { ascending: true })

      if (error) throw error
      return mapApprovalHistoryToActivity((data || []) as unknown as RequestActivityRow[])
    },
  })

  const locale = i18n.language?.startsWith('en') ? 'en-GB' : 'tr-TR'

  return (
    <View style={styles.card}>
      <Text style={styles.title}>{t('requestDetail.activityTitle')}</Text>
      <Text style={styles.subtitle}>{t('requestDetail.activitySubtitle')}</Text>

      {isLoading ? (
        <View style={styles.loadingRow}>
          <ActivityIndicator color={stats.primary} size="small" />
          <Text style={styles.muted}>{t('requestDetail.activityLoading')}</Text>
        </View>
      ) : isError ? (
        <Text style={styles.error}>{t('requestDetail.activityError')}</Text>
      ) : items.length === 0 ? (
        <Text style={styles.muted}>{t('requestDetail.activityEmpty')}</Text>
      ) : (
        <View style={styles.list}>
          {items.map((item, index) => {
            const isLast = index === items.length - 1
            const dotColor =
              item.action === 'rejected'
                ? '#ef4444'
                : item.action === 'submitted'
                  ? '#9ca3af'
                  : isLast
                    ? stats.primary
                    : '#34d399'

            return (
              <View key={item.id} style={styles.row}>
                <View style={styles.rail}>
                  <View style={[styles.dot, { backgroundColor: dotColor }]} />
                  {!isLast ? <View style={styles.line} /> : null}
                </View>
                <View style={[styles.body, !isLast && styles.bodyGap]}>
                  <Text style={styles.action}>{item.actionLabel}</Text>
                  <Text style={styles.actor}>
                    {item.actorName}
                    {item.actorRole ? ` · ${item.actorRole}` : ''}
                  </Text>
                  <Text style={styles.date}>{formatActivityDateTime(item.createdAt, locale)}</Text>
                  {item.comments ? <Text style={styles.comments}>{item.comments}</Text> : null}
                </View>
              </View>
            )
          })}
        </View>
      )}
    </View>
  )
}

const styles = StyleSheet.create({
  card: {
    marginHorizontal: 20,
    marginTop: 8,
    marginBottom: 8,
    padding: 16,
    backgroundColor: '#ffffff',
    borderRadius: 20,
    borderWidth: 1,
    borderColor: '#e5e7eb',
  },
  title: {
    fontSize: 17,
    fontWeight: '700',
    color: '#111827',
  },
  subtitle: {
    marginTop: 4,
    fontSize: 13,
    color: '#6b7280',
    lineHeight: 18,
  },
  loadingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginTop: 16,
  },
  muted: {
    marginTop: 14,
    fontSize: 14,
    color: '#6b7280',
  },
  error: {
    marginTop: 14,
    fontSize: 14,
    color: '#dc2626',
  },
  list: {
    marginTop: 16,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'stretch',
  },
  rail: {
    width: 16,
    alignItems: 'center',
  },
  dot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    marginTop: 4,
  },
  line: {
    flex: 1,
    width: 2,
    backgroundColor: '#e5e7eb',
    marginTop: 4,
  },
  body: {
    flex: 1,
    paddingLeft: 10,
  },
  bodyGap: {
    paddingBottom: 16,
  },
  action: {
    fontSize: 15,
    fontWeight: '600',
    color: '#111827',
  },
  actor: {
    marginTop: 3,
    fontSize: 13,
    color: '#374151',
  },
  date: {
    marginTop: 2,
    fontSize: 12,
    fontWeight: '600',
    color: '#1f2937',
  },
  comments: {
    marginTop: 8,
    fontSize: 13,
    color: '#4b5563',
    lineHeight: 18,
    backgroundColor: '#f9fafb',
    borderRadius: 12,
    padding: 10,
    overflow: 'hidden',
  },
})
