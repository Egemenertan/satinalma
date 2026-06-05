import { useEffect, useRef } from 'react'
import { Animated, Dimensions, Easing, StyleSheet, View } from 'react-native'
import { LinearGradient } from 'expo-linear-gradient'

const { width: SCREEN_WIDTH } = Dimensions.get('window')

type SkeletonProps = {
  width?: number | string
  height?: number
  borderRadius?: number
  marginBottom?: number
  marginTop?: number
  marginRight?: number
  style?: object
}

export function Skeleton({
  width = '100%',
  height = 20,
  borderRadius = 8,
  marginBottom = 0,
  marginTop = 0,
  marginRight = 0,
  style,
}: SkeletonProps) {
  const shimmerAnim = useRef(new Animated.Value(-1)).current

  useEffect(() => {
    const shimmer = Animated.loop(
      Animated.timing(shimmerAnim, {
        toValue: 1,
        duration: 1500,
        easing: Easing.inOut(Easing.ease),
        useNativeDriver: true,
      })
    )
    shimmer.start()
    return () => shimmer.stop()
  }, [shimmerAnim])

  const translateX = shimmerAnim.interpolate({
    inputRange: [-1, 1],
    outputRange: [-SCREEN_WIDTH, SCREEN_WIDTH],
  })

  return (
    <View
      style={[
        styles.skeleton,
        {
          width,
          height,
          borderRadius,
          marginBottom,
          marginTop,
          marginRight,
          overflow: 'hidden',
        },
        style,
      ]}
    >
      <Animated.View
        style={[
          StyleSheet.absoluteFill,
          { transform: [{ translateX }] },
        ]}
      >
        <LinearGradient
          colors={['transparent', 'rgba(255,255,255,0.4)', 'transparent']}
          start={{ x: 0, y: 0.5 }}
          end={{ x: 1, y: 0.5 }}
          style={StyleSheet.absoluteFill}
        />
      </Animated.View>
    </View>
  )
}

const styles = StyleSheet.create({
  skeleton: {
    backgroundColor: '#e8ecef',
  },
})

type AnimatedSkeletonCardProps = {
  index?: number
}

export function RequestCardSkeleton({ index = 0 }: AnimatedSkeletonCardProps) {
  const fadeAnim = useRef(new Animated.Value(0)).current
  const scaleAnim = useRef(new Animated.Value(0.95)).current

  useEffect(() => {
    const delay = index * 100
    Animated.parallel([
      Animated.timing(fadeAnim, {
        toValue: 1,
        duration: 400,
        delay,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: true,
      }),
      Animated.timing(scaleAnim, {
        toValue: 1,
        duration: 400,
        delay,
        easing: Easing.out(Easing.back(1.2)),
        useNativeDriver: true,
      }),
    ]).start()
  }, [fadeAnim, scaleAnim, index])

  return (
    <Animated.View
      style={[
        skeletonCardStyles.card,
        {
          opacity: fadeAnim,
          transform: [{ scale: scaleAnim }],
        },
      ]}
    >
      <View style={skeletonCardStyles.header}>
        <View style={skeletonCardStyles.badgeRow}>
          <Skeleton width={85} height={26} borderRadius={13} marginRight={8} />
          <Skeleton width={60} height={26} borderRadius={13} />
        </View>
        <Skeleton width={50} height={14} borderRadius={7} />
      </View>
      <Skeleton width="85%" height={22} marginTop={14} borderRadius={6} />
      <Skeleton width="55%" height={16} marginTop={10} borderRadius={6} />
      <View style={skeletonCardStyles.footer}>
        <Skeleton width={28} height={28} borderRadius={14} marginRight={10} />
        <Skeleton width="45%" height={14} borderRadius={6} />
      </View>
    </Animated.View>
  )
}

export function RequestsPageSkeleton() {
  const headerFade = useRef(new Animated.Value(0)).current

  useEffect(() => {
    Animated.timing(headerFade, {
      toValue: 1,
      duration: 300,
      useNativeDriver: true,
    }).start()
  }, [headerFade])

  return (
    <Animated.View style={[requestsPageSkeletonStyles.container, { opacity: headerFade }]}>
      {/* Welcome */}
      <View style={requestsPageSkeletonStyles.headerSection}>
        <Skeleton width={200} height={18} borderRadius={9} marginBottom={20} />
        
        {/* Page Title */}
        <Skeleton width={160} height={32} borderRadius={10} marginBottom={20} />
        
        {/* Monthly Chart Skeleton */}
        <View style={requestsPageSkeletonStyles.chartCard}>
          <View style={requestsPageSkeletonStyles.chartHeader}>
            <Skeleton width={140} height={16} borderRadius={8} />
            <Skeleton width={80} height={14} borderRadius={7} />
          </View>
          <View style={requestsPageSkeletonStyles.chartBars}>
            {[0.4, 0.7, 0.5, 0.9, 0.6, 0.3].map((h, i) => (
              <View key={i} style={requestsPageSkeletonStyles.chartBarCol}>
                <Skeleton 
                  width={24} 
                  height={Math.round(100 * h)} 
                  borderRadius={12} 
                />
                <Skeleton width={24} height={12} borderRadius={6} marginTop={8} />
              </View>
            ))}
          </View>
        </View>

        {/* Tabs Skeleton */}
        <View style={requestsPageSkeletonStyles.tabsRow}>
          <Skeleton width="48%" height={44} borderRadius={18} />
          <Skeleton width="48%" height={44} borderRadius={18} />
        </View>

        {/* Search Skeleton */}
        <Skeleton width="100%" height={56} borderRadius={28} marginBottom={16} />

        {/* Filter Pills */}
        <View style={requestsPageSkeletonStyles.filterRow}>
          <Skeleton width={110} height={38} borderRadius={19} marginRight={8} />
          <Skeleton width={130} height={38} borderRadius={19} marginRight={8} />
          <Skeleton width={90} height={38} borderRadius={19} />
        </View>

        {/* Results count */}
        <Skeleton width={120} height={14} borderRadius={7} marginBottom={8} />
      </View>

      {/* Cards */}
      <View style={requestsPageSkeletonStyles.cardsSection}>
        <RequestCardSkeleton index={0} />
        <RequestCardSkeleton index={1} />
        <RequestCardSkeleton index={2} />
        <RequestCardSkeleton index={3} />
      </View>
    </Animated.View>
  )
}

const requestsPageSkeletonStyles = StyleSheet.create({
  container: {
    flex: 1,
  },
  headerSection: {
    paddingHorizontal: 16,
    paddingTop: 4,
  },
  chartCard: {
    backgroundColor: '#1a1a1a',
    borderRadius: 24,
    padding: 16,
    marginBottom: 20,
  },
  chartHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  chartBars: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    alignItems: 'flex-end',
    height: 120,
  },
  chartBarCol: {
    alignItems: 'center',
    justifyContent: 'flex-end',
  },
  tabsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 16,
    backgroundColor: '#f9fafb',
    borderRadius: 24,
    padding: 4,
  },
  filterRow: {
    flexDirection: 'row',
    marginBottom: 16,
  },
  cardsSection: {
    marginTop: 8,
  },
})

const skeletonCardStyles = StyleSheet.create({
  card: {
    backgroundColor: '#ffffff',
    borderRadius: 24,
    borderWidth: 1,
    borderColor: '#e5e7eb',
    padding: 16,
    marginHorizontal: 16,
    marginBottom: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.04,
    shadowRadius: 8,
    elevation: 2,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  badgeRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  footer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 14,
  },
})

export function MaterialCardSkeleton() {
  return (
    <View style={materialSkeletonStyles.card}>
      <View style={materialSkeletonStyles.imageArea} />
      <View style={materialSkeletonStyles.content}>
        <Skeleton width="50%" height={12} marginBottom={6} />
        <Skeleton width="90%" height={14} />
      </View>
      <View style={materialSkeletonStyles.actions}>
        <Skeleton width={80} height={32} borderRadius={10} marginRight={4} />
        <View style={{ flex: 1 }}>
          <Skeleton width="100%" height={32} borderRadius={10} />
        </View>
      </View>
    </View>
  )
}

const materialSkeletonStyles = StyleSheet.create({
  card: {
    width: '48%',
    backgroundColor: '#ffffff',
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#e5e7eb',
    marginBottom: 12,
    overflow: 'hidden',
  },
  imageArea: {
    width: '100%',
    aspectRatio: 1,
    backgroundColor: '#f3f4f6',
  },
  content: {
    padding: 10,
    paddingBottom: 6,
  },
  actions: {
    flexDirection: 'row',
    padding: 10,
    paddingTop: 4,
    borderTopWidth: 1,
    borderTopColor: '#f3f4f6',
  },
})

export function CategoryTabSkeleton() {
  return (
    <View style={categorySkeletonStyles.container}>
      <View style={categorySkeletonStyles.row}>
        <Skeleton width={90} height={36} borderRadius={18} marginRight={8} />
        <Skeleton width={110} height={36} borderRadius={18} marginRight={8} />
        <Skeleton width={100} height={36} borderRadius={18} marginRight={8} />
        <Skeleton width={95} height={36} borderRadius={18} />
      </View>
      <View style={categorySkeletonStyles.row}>
        <Skeleton width={80} height={32} borderRadius={16} marginRight={8} />
        <Skeleton width={100} height={32} borderRadius={16} marginRight={8} />
        <Skeleton width={90} height={32} borderRadius={16} />
      </View>
    </View>
  )
}

const categorySkeletonStyles = StyleSheet.create({
  container: {
    marginBottom: 16,
  },
  row: {
    flexDirection: 'row',
    marginBottom: 12,
  },
})
