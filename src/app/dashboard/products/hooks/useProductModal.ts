/**
 * useProductModal Hook
 * Modal state management ve selected product state
 */

import { useState, useCallback } from 'react'

export type ProductModalTab = 'info' | 'images' | 'stock' | 'movements' | 'history'

export function useProductModal() {
  const [isOpen, setIsOpen] = useState(false)
  const [selectedProductId, setSelectedProductId] = useState<string | null>(null)
  const [activeTab, setActiveTab] = useState<ProductModalTab>('info')

  const openModal = useCallback((productId: string, tab: ProductModalTab = 'info') => {
    setSelectedProductId(productId)
    setActiveTab(tab)
    setIsOpen(true)
  }, [])

  const closeModal = useCallback(() => {
    setIsOpen(false)
    setSelectedProductId(null)
    setActiveTab('info')
  }, [])

  const changeTab = useCallback((tab: ProductModalTab) => {
    setActiveTab(tab)
  }, [])

  return {
    isOpen,
    selectedProductId,
    activeTab,
    openModal,
    closeModal,
    changeTab,
  }
}


