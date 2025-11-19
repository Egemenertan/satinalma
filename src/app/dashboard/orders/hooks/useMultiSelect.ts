/**
 * useMultiSelect Hook
 * Çoklu seçim state yönetimi
 * 
 * ÖNEMLİ: Seçili siparişlerin verilerini cache'ler,
 * böylece search/filter yapınca kaybolmazlar
 */

import { useState, useCallback } from 'react'
import type { OrderData } from '../types'

export function useMultiSelect() {
  const [selectedOrders, setSelectedOrders] = useState<Set<string>>(new Set())
  const [selectedOrdersCache, setSelectedOrdersCache] = useState<Map<string, OrderData>>(new Map())
  const [isMultiSelectMode, setIsMultiSelectMode] = useState(false)

  /**
   * Tek siparişi seç/kaldır
   * Seçildiğinde cache'e ekle, kaldırıldığında cache'den çıkar
   */
  const toggleOrderSelection = useCallback((orderId: string, orderData?: OrderData) => {
    const newSelected = new Set(selectedOrders)
    const newCache = new Map(selectedOrdersCache)
    
    if (newSelected.has(orderId)) {
      newSelected.delete(orderId)
      newCache.delete(orderId)
    } else {
      newSelected.add(orderId)
      if (orderData) {
        newCache.set(orderId, orderData)
      }
    }
    
    setSelectedOrders(newSelected)
    setSelectedOrdersCache(newCache)
  }, [selectedOrders, selectedOrdersCache])

  /**
   * Gruptaki tüm siparişleri seç/kaldır
   */
  const selectAllOrdersInGroup = useCallback((groupOrders: OrderData[]) => {
    const newSelected = new Set(selectedOrders)
    const newCache = new Map(selectedOrdersCache)
    const groupOrderIds = groupOrders.map(order => order.id)
    
    // Eğer grup içindeki tüm siparişler seçiliyse, hepsini kaldır
    const allSelected = groupOrderIds.every(id => newSelected.has(id))
    
    if (allSelected) {
      groupOrderIds.forEach(id => {
        newSelected.delete(id)
        newCache.delete(id)
      })
    } else {
      groupOrders.forEach(order => {
        newSelected.add(order.id)
        newCache.set(order.id, order)
      })
    }
    
    setSelectedOrders(newSelected)
    setSelectedOrdersCache(newCache)
  }, [selectedOrders, selectedOrdersCache])

  /**
   * Seçimi temizle
   */
  const clearSelection = useCallback(() => {
    setSelectedOrders(new Set())
    setSelectedOrdersCache(new Map())
    setIsMultiSelectMode(false)
  }, [])

  /**
   * Seçili siparişlerin verilerini al
   * Önce cache'den al, bulamazsa allOrders'dan ara
   */
  const getSelectedOrdersData = useCallback((allOrders: OrderData[]) => {
    const result: OrderData[] = []
    
    selectedOrders.forEach(orderId => {
      // Önce cache'e bak
      const cachedOrder = selectedOrdersCache.get(orderId)
      if (cachedOrder) {
        result.push(cachedOrder)
      } else {
        // Cache'de yoksa allOrders'dan ara
        const order = allOrders.find(o => o.id === orderId)
        if (order) {
          result.push(order)
          // Cache'e ekle
          selectedOrdersCache.set(orderId, order)
        }
      }
    })
    
    return result
  }, [selectedOrders, selectedOrdersCache])

  return {
    selectedOrders,
    isMultiSelectMode,
    setIsMultiSelectMode,
    toggleOrderSelection,
    selectAllOrdersInGroup,
    clearSelection,
    getSelectedOrdersData,
  }
}






