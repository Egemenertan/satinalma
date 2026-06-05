import type { ReactNode } from 'react'
import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react'
import {
  Animated,
  Easing,
  Keyboard,
  Modal,
  PanResponder,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  useWindowDimensions,
  View,
} from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { islandTokens } from './islandTokens'

const DISMISS_DISTANCE = 80
const DISMISS_VELOCITY = 0.7
const BACKDROP_PEAK = 0.5

export type SwipeDismissSheetProps = {
  visible: boolean
  onRequestClose: () => void
  children: ReactNode
  title?: string | null
  maxHeightRatio?: number
  tapBackdropToClose?: boolean
  /** Aynı Modal içinde, levha ve karartmanın üstünde tam ekran katman (ör. iç içe ikinci Modal’dan kaçınmak için). */
  topOverlay?: ReactNode | null
  /**
   * true olduğunda klavye kapanır (aynı levhada üst overlay / picker açıldığında).
   * Ana `visible` açılışında klavye zaten kapatılır.
   */
  dismissKeyboardForOverlay?: boolean
  /** true olduğunda içerik boyutuna göre otomatik yükseklik ayarlanır */
  fitContent?: boolean
}

/**
 * Alttan açılan levha: spring giriş, üst tutamaktan aşağı sürtükle kapat, arka plan dokunuşu.
 */
export function SwipeDismissSheet({
  visible,
  onRequestClose,
  children,
  title,
  maxHeightRatio = 0.92,
  tapBackdropToClose = true,
  topOverlay = null,
  dismissKeyboardForOverlay = false,
  fitContent = false,
}: SwipeDismissSheetProps) {
  const insets = useSafeAreaInsets()
  const { height: windowHeight } = useWindowDimensions()
  const translateY = useRef(new Animated.Value(windowHeight)).current
  const backdropOp = useRef(new Animated.Value(0)).current
  const [modalVisible, setModalVisible] = useState(false)
  const dragStartY = useRef(0)

  const openAnim = useCallback(() => {
    Animated.parallel([
      Animated.spring(translateY, {
        toValue: 0,
        useNativeDriver: false,
        friction: 9,
        tension: 68,
        restDisplacementThreshold: 1,
        restSpeedThreshold: 1,
      }),
      Animated.timing(backdropOp, {
        toValue: BACKDROP_PEAK,
        duration: 300,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: false,
      }),
    ]).start()
  }, [backdropOp, translateY])

  const runExit = useCallback(
    (onDone?: () => void) => {
      Animated.parallel([
        Animated.timing(translateY, {
          toValue: windowHeight,
          duration: 280,
          easing: Easing.in(Easing.cubic),
          useNativeDriver: false,
        }),
        Animated.timing(backdropOp, {
          toValue: 0,
          duration: 260,
          easing: Easing.in(Easing.quad),
          useNativeDriver: false,
        }),
      ]).start(({ finished }) => {
        if (finished) onDone?.()
      })
    },
    [backdropOp, translateY, windowHeight]
  )

  useEffect(() => {
    if (visible) {
      setModalVisible(true)
    }
  }, [visible])

  useEffect(() => {
    if (visible) {
      Keyboard.dismiss()
    }
  }, [visible])

  useEffect(() => {
    if (dismissKeyboardForOverlay) {
      Keyboard.dismiss()
    }
  }, [dismissKeyboardForOverlay])

  useLayoutEffect(() => {
    if (!visible) return
    translateY.setValue(windowHeight)
    backdropOp.setValue(0)
    const id = requestAnimationFrame(() => openAnim())
    return () => cancelAnimationFrame(id)
  }, [visible, backdropOp, openAnim, translateY, windowHeight])

  useEffect(() => {
    if (visible) return
    if (!modalVisible) return
    runExit(() => setModalVisible(false))
  }, [visible, modalVisible, runExit])

  const requestParentClose = useCallback(() => {
    onRequestClose()
  }, [onRequestClose])

  const panResponder = useMemo(
    () =>
      PanResponder.create({
        onStartShouldSetPanResponder: () => true,
        onMoveShouldSetPanResponder: (_, g) => g.dy > 4 && Math.abs(g.dy) > Math.abs(g.dx) * 0.8,
        onMoveShouldSetPanResponderCapture: (_, g) => g.dy > 12 && Math.abs(g.dy) > Math.abs(g.dx) * 1.2,
        onPanResponderGrant: () => {
          translateY.stopAnimation((v) => {
            dragStartY.current = typeof v === 'number' ? v : 0
          })
        },
        onPanResponderMove: (_, g) => {
          const y = Math.max(0, dragStartY.current + g.dy)
          translateY.setValue(y)
          const b = BACKDROP_PEAK * (1 - Math.min(1, y / (windowHeight * 0.75)))
          backdropOp.setValue(Math.max(0, b))
        },
        onPanResponderRelease: (_, g) => {
          const y = Math.max(0, dragStartY.current + g.dy)
          if (y > DISMISS_DISTANCE || g.vy > DISMISS_VELOCITY) {
            requestParentClose()
            return
          }
          Animated.parallel([
            Animated.spring(translateY, {
              toValue: 0,
              useNativeDriver: false,
              friction: 8,
              tension: 80,
            }),
            Animated.timing(backdropOp, {
              toValue: BACKDROP_PEAK,
              duration: 220,
              easing: Easing.out(Easing.quad),
              useNativeDriver: false,
            }),
          ]).start()
        },
      }),
    [backdropOp, requestParentClose, translateY, windowHeight]
  )

  const sheetMaxH = windowHeight * maxHeightRatio
  const modalShown = visible || modalVisible

  if (!modalShown) return null

  return (
    <Modal
      visible={modalShown}
      transparent
      animationType="none"
      onRequestClose={requestParentClose}
      statusBarTranslucent
    >
      <View style={styles.wrap} pointerEvents="box-none">
        <Animated.View
          pointerEvents="none"
          style={[
            StyleSheet.absoluteFill,
            { backgroundColor: 'rgba(15,23,42,0.94)', opacity: backdropOp },
          ]}
        />
        {tapBackdropToClose ? (
          <Pressable
            style={StyleSheet.absoluteFill}
            onPress={requestParentClose}
            accessibilityLabel="Kapat"
          />
        ) : null}
        <Animated.View
          style={[
            styles.sheet,
            fitContent
              ? {
                  maxHeight: sheetMaxH,
                  paddingBottom: Math.max(insets.bottom, 14),
                  transform: [{ translateY }],
                }
              : {
                  height: sheetMaxH,
                  maxHeight: sheetMaxH,
                  paddingBottom: Math.max(insets.bottom, 14),
                  transform: [{ translateY }],
                },
          ]}
          pointerEvents="auto"
        >
          <View style={fitContent ? styles.sheetInnerFit : styles.sheetInner} pointerEvents="box-none">
            <View style={styles.dragZone} {...panResponder.panHandlers}>
              <View style={styles.handleRow}>
                <View style={styles.handlePill} />
              </View>
              {title ? (
                <Text style={styles.title} numberOfLines={1}>
                  {title}
                </Text>
              ) : null}
            </View>
            <View style={fitContent ? styles.bodyFit : styles.body}>{children}</View>
          </View>
        </Animated.View>
        {topOverlay ? (
          <View style={styles.topOverlayHost} pointerEvents="box-none" collapsable={false}>
            {topOverlay}
          </View>
        ) : null}
      </View>
    </Modal>
  )
}

const styles = StyleSheet.create({
  wrap: {
    flex: 1,
    justifyContent: 'flex-end',
  },
  topOverlayHost: {
    ...StyleSheet.absoluteFillObject,
    zIndex: 2000,
    ...Platform.select({
      android: { elevation: 24 },
      default: {},
    }),
  },
  sheet: {
    alignSelf: 'stretch',
    overflow: 'hidden',
    backgroundColor: '#ffffff',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    borderWidth: StyleSheet.hairlineWidth,
    borderBottomWidth: 0,
    borderColor: islandTokens.border,
    ...Platform.select({
      ios: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: -6 },
        shadowOpacity: 0.1,
        shadowRadius: 16,
      },
      android: { elevation: 16 },
      default: { elevation: 16 },
    }),
  },
  sheetInner: {
    flex: 1,
    minHeight: 0,
  },
  sheetInnerFit: {
    minHeight: 0,
  },
  dragZone: {
    minHeight: 48,
  },
  handleRow: {
    alignItems: 'center',
    paddingTop: 14,
    paddingBottom: 8,
  },
  handlePill: {
    width: 48,
    height: 5,
    borderRadius: 3,
    backgroundColor: 'rgba(15, 23, 42, 0.25)',
  },
  title: {
    fontSize: 17,
    fontWeight: '700',
    color: islandTokens.text,
    letterSpacing: -0.3,
    paddingHorizontal: 20,
    paddingBottom: 12,
  },
  body: {
    flex: 1,
    minHeight: 0,
  },
  bodyFit: {
    minHeight: 0,
  },
})
