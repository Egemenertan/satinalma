/**
 * useMultiSelect Hook
 * Çoklu seçim state yönetimi
 */

import { useState } from 'react'
import type { OrderData } from '../types'

export function useMultiSelect() {
  const [selectedOrders, setSelectedOrders] = useState<Set<string>>(new Set())
  const [isMultiSelectMode, setIsMultiSelectMode] = useState(false)

  /**
   * Tek siparişi seç/kaldır
   */
  const toggleOrderSelection = (orderId: string) => {
    const newSelected = new Set(selectedOrders)
    if (newSelected.has(orderId)) {
      newSelected.delete(orderId)
    } else {
      newSelected.add(orderId)
    }
    setSelectedOrders(newSelected)
  }

  /**
   * Gruptaki tüm siparişleri seç/kaldır
   */
  const selectAllOrdersInGroup = (groupOrders: OrderData[]) => {
    const newSelected = new Set(selectedOrders)
    const groupOrderIds = groupOrders.map(order => order.id)
    
    // Eğer grup içindeki tüm siparişler seçiliyse, hepsini kaldır
    const allSelected = groupOrderIds.every(id => newSelected.has(id))
    
    if (allSelected) {
      groupOrderIds.forEach(id => newSelected.delete(id))
    } else {
      groupOrderIds.forEach(id => newSelected.add(id))
    }
    
    setSelectedOrders(newSelected)
  }

  /**
   * Seçimi temizle
   */
  const clearSelection = () => {
    setSelectedOrders(new Set())
    setIsMultiSelectMode(false)
  }

  /**
   * Seçili siparişlerin verilerini al
   */
  const getSelectedOrdersData = (allOrders: OrderData[]) => {
    return allOrders.filter(order => selectedOrders.has(order.id))
  }

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




