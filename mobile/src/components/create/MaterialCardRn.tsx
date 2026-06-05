import MaterialIcons from '@expo/vector-icons/MaterialIcons'
import { Pressable, StyleSheet, Text, View } from 'react-native'
import type { MaterialItemRn } from './MaterialDetailModalRn'

type MaterialCardRnProps = {
  item: MaterialItemRn
  cartQuantity: number
  onUpdateQuantity: (item: MaterialItemRn, delta: number) => void
  onOpenDetail: (item: MaterialItemRn) => void
}

export function MaterialCardRn({ 
  item, 
  cartQuantity, 
  onUpdateQuantity,
  onOpenDetail 
}: MaterialCardRnProps) {
  function handleAddToCart() {
    onOpenDetail(item)
  }

  function handleIncrement() {
    onUpdateQuantity(item, 1)
  }

  function handleDecrement() {
    onUpdateQuantity(item, -1)
  }

  return (
    <View style={[styles.card, cartQuantity > 0 && styles.cardInCart]}>
      {/* Ürün Görseli Alanı */}
      <Pressable style={styles.imageContainer} onPress={() => onOpenDetail(item)}>
        <View style={styles.imagePlaceholder}>
          <MaterialIcons name="inventory-2" size={28} color="#9ca3af" />
        </View>
        {cartQuantity > 0 && (
          <View style={styles.inCartBadge}>
            <MaterialIcons name="check-circle" size={14} color="#ffffff" />
            <Text style={styles.inCartBadgeText}>Sepette</Text>
          </View>
        )}
      </Pressable>

      {/* Ürün Bilgileri */}
      <Pressable style={styles.infoSection} onPress={() => onOpenDetail(item)}>
        <Text style={styles.groupText} numberOfLines={1}>
          {item.group || 'Genel'}
        </Text>
        <Text style={styles.nameText} numberOfLines={2}>
          {item.name}
        </Text>
      </Pressable>

      {/* Alt Aksiyonlar */}
      <View style={styles.actionsSection}>
        {cartQuantity > 0 ? (
          <View style={styles.quantityControlFull}>
            <Pressable
              style={styles.miniBtn}
              onPress={handleDecrement}
            >
              <MaterialIcons name="remove" size={18} color="#047857" />
            </Pressable>
            <Pressable style={styles.quantityDisplay} onPress={() => onOpenDetail(item)}>
              <Text style={styles.quantityDisplayText}>{cartQuantity}</Text>
            </Pressable>
            <Pressable style={styles.miniBtn} onPress={handleIncrement}>
              <MaterialIcons name="add" size={18} color="#047857" />
            </Pressable>
          </View>
        ) : (
          <Pressable
            style={styles.addBtn}
            onPress={handleAddToCart}
          >
            <MaterialIcons name="shopping-cart" size={16} color="#ffffff" />
            <Text style={styles.addBtnText}>Sepete Ekle</Text>
          </Pressable>
        )}
      </View>
    </View>
  )
}

const styles = StyleSheet.create({
  card: {
    width: '48%',
    backgroundColor: '#ffffff',
    borderRadius: 20,
    borderWidth: 1,
    borderColor: '#e5e7eb',
    marginBottom: 12,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 4,
    elevation: 2,
  },
  cardInCart: {
    borderColor: '#01E884',
    borderWidth: 2,
    shadowColor: '#01E884',
    shadowOpacity: 0.15,
  },
  imageContainer: {
    position: 'relative',
    width: '100%',
    aspectRatio: 1,
    backgroundColor: '#f9fafb',
    alignItems: 'center',
    justifyContent: 'center',
  },
  imagePlaceholder: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  inCartBadge: {
    position: 'absolute',
    top: 8,
    right: 8,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    backgroundColor: '#01E884',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 16,
    shadowColor: '#01E884',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 4,
    elevation: 3,
  },
  inCartBadgeText: {
    fontSize: 10,
    fontWeight: '700',
    color: '#ffffff',
  },
  infoSection: {
    padding: 10,
    paddingBottom: 6,
  },
  groupText: {
    fontSize: 11,
    color: '#6b7280',
    fontWeight: '500',
    marginBottom: 3,
  },
  nameText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#111827',
    lineHeight: 17,
  },
  actionsSection: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 10,
    paddingTop: 4,
    borderTopWidth: 1,
    borderTopColor: '#f3f4f6',
  },
  quantityControlFull: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#ecfdf5',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#10b981',
    paddingHorizontal: 4,
    paddingVertical: 4,
  },
  miniBtn: {
    width: 36,
    height: 36,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#ffffff',
    borderRadius: 10,
  },
  quantityDisplay: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 8,
  },
  quantityDisplayText: {
    fontSize: 16,
    fontWeight: '700',
    color: '#047857',
  },
  addBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    backgroundColor: '#01E884',
    paddingVertical: 10,
    borderRadius: 12,
    shadowColor: '#01E884',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 4,
    elevation: 2,
  },
  addBtnText: {
    fontSize: 13,
    fontWeight: '700',
    color: '#ffffff',
  },
})
