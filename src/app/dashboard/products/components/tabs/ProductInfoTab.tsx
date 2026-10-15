/**
 * ProductInfoTab Component
 * Ürün bilgileri ve alım geçmişi gösterimi
 */

'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { useToast } from '@/components/ui/toast'
import { TrendingUp, Receipt, Hash, Plus, Pencil } from 'lucide-react'
import { useUpdateProduct } from '../../hooks'

const PRODUCT_UNITS = [
  { value: 'adet', label: 'Adet' },
  { value: 'kg', label: 'Kilogram' },
  { value: 'lt', label: 'Litre' },
  { value: 'm', label: 'Metre' },
  { value: 'm2', label: 'Metrekare' },
  { value: 'm3', label: 'Metreküp' },
  { value: 'paket', label: 'Paket' },
  { value: 'kutu', label: 'Kutu' },
] as const

const PRICE_CURRENCIES = ['TRY', 'USD', 'EUR', 'GBP'] as const

function formatUnitPrice(amount: number, currency: string) {
  return `${amount.toLocaleString('tr-TR', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })} ${currency || 'TRY'}`
}

function resolveUnitValue(unit: string | null | undefined) {
  if (!unit) return ''
  const normalized = unit.trim().toLocaleLowerCase('tr-TR')
  const match = PRODUCT_UNITS.find(
    (item) =>
      item.value.toLocaleLowerCase('tr-TR') === normalized ||
      item.label.toLocaleLowerCase('tr-TR') === normalized
  )
  return match?.value ?? unit.trim()
}

interface ProductInfoTabProps {
  product: any
  movementsData: any
  serialNumbers?: {
    active: Array<{ serial_number: string; user?: { full_name: string } }>
    pending: Array<{ serial_number: string; user?: { full_name: string } }>
  } | null
}

export function ProductInfoTab({ product, movementsData, serialNumbers }: ProductInfoTabProps) {
  const { showToast } = useToast()
  const updateMutation = useUpdateProduct()
  const [unit, setUnit] = useState(() => resolveUnitValue(product?.unit))
  const [editingPrice, setEditingPrice] = useState(false)
  const [savingPrice, setSavingPrice] = useState(false)
  const [priceInput, setPriceInput] = useState('')
  const [priceCurrency, setPriceCurrency] = useState('TRY')
  const syncedPurchaseKey = useRef<string | null>(null)

  useEffect(() => {
    setUnit(resolveUnitValue(product?.unit))
    setEditingPrice(false)
  }, [product?.id, product?.unit])

  const movementsLoaded = Array.isArray(movementsData?.movements)

  const latestPurchasePrice = useMemo(() => {
    const movements = movementsData?.movements
    if (!Array.isArray(movements)) return null
    const latest = movements.find(
      (movement) =>
        movement?.movement_type === 'giriş' && Number(movement?.unit_price) > 0
    )
    if (!latest) return null
    return {
      amount: Number(latest.unit_price),
      currency: latest.currency || 'TRY',
    }
  }, [movementsData])

  const storedUnitPrice = Number(String(product?.unit_price ?? '').trim())
  const hasStoredUnitPrice = Number.isFinite(storedUnitPrice) && storedUnitPrice > 0
  const shownUnitPrice = latestPurchasePrice?.amount ?? (hasStoredUnitPrice ? storedUnitPrice : null)
  const shownCurrency = latestPurchasePrice
    ? latestPurchasePrice.currency
    : product?.currency || 'TRY'
  const canEditPrice = movementsLoaded && !latestPurchasePrice

  useEffect(() => {
    if (!product?.id || !latestPurchasePrice) return
    const nextPrice = latestPurchasePrice.amount.toFixed(2)
    const nextCurrency = latestPurchasePrice.currency || 'TRY'
    const key = `${product.id}:${nextPrice}:${nextCurrency}`
    if (syncedPurchaseKey.current === key) return

    const currentAmount = Number(String(product.unit_price ?? '').trim())
    const sameAmount =
      Number.isFinite(currentAmount) && Math.abs(currentAmount - latestPurchasePrice.amount) < 0.005
    const sameCurrency = (product.currency || 'TRY') === nextCurrency
    if (sameAmount && sameCurrency) {
      syncedPurchaseKey.current = key
      return
    }

    syncedPurchaseKey.current = key
    updateMutation.mutate(
      {
        id: product.id,
        updates: { unit_price: nextPrice, currency: nextCurrency },
      },
      {
        onError: (error) => {
          console.error('Birim fiyat alım geçmişinden güncellenemedi:', error)
        },
      }
    )
  }, [
    product?.id,
    product?.unit_price,
    product?.currency,
    latestPurchasePrice,
    updateMutation,
  ])

  const startPriceEdit = () => {
    if (!canEditPrice || !product?.id) return
    setPriceInput(hasStoredUnitPrice ? String(storedUnitPrice) : '')
    setPriceCurrency(product.currency || 'TRY')
    setEditingPrice(true)
  }

  const savePrice = async () => {
    if (!product?.id) return
    const amount = Number(priceInput.replace(',', '.'))
    if (!Number.isFinite(amount) || amount <= 0) {
      showToast('Geçerli bir birim fiyat girin', 'error')
      return
    }
    setSavingPrice(true)
    try {
      await updateMutation.mutateAsync({
        id: product.id,
        updates: { unit_price: amount.toFixed(2), currency: priceCurrency },
      })
      setEditingPrice(false)
      showToast('Birim fiyat kaydedildi', 'success')
    } catch {
      showToast('Birim fiyat kaydedilemedi', 'error')
    } finally {
      setSavingPrice(false)
    }
  }

  const unitOptions = useMemo(() => {
    const options: Array<{ value: string; label: string }> = PRODUCT_UNITS.map((item) => ({
      value: item.value,
      label: item.label,
    }))
    if (unit && !options.some((item) => item.value === unit)) {
      options.unshift({ value: unit, label: unit })
    }
    return options
  }, [unit])

  const handleUnitChange = async (nextUnit: string) => {
    if (!product?.id || nextUnit === unit) return
    const previous = unit
    setUnit(nextUnit)
    try {
      await updateMutation.mutateAsync({
        id: product.id,
        updates: { unit: nextUnit },
      })
      showToast('Birim güncellendi', 'success')
    } catch {
      setUnit(previous)
      showToast('Birim güncellenemedi', 'error')
    }
  }

  return (
    <>
      {/* Ürün Bilgi Kartları */}
      <div className="grid grid-cols-2 gap-4">
        <div className="bg-white/80 backdrop-blur-xl rounded-2xl p-5 border border-gray-200/50 shadow-sm">
          <label className="text-xs font-medium text-gray-500 uppercase tracking-wide">Ürün Adı</label>
          <p className="text-lg font-semibold text-gray-900 mt-2">{product.name}</p>
        </div>
        <div className="bg-white/80 backdrop-blur-xl rounded-2xl p-5 border border-gray-200/50 shadow-sm">
          <label className="text-xs font-medium text-gray-500 uppercase tracking-wide">SKU</label>
          <p className="text-lg font-semibold text-gray-900 mt-2">{product.sku || '-'}</p>
        </div>
        <div className="bg-white/80 backdrop-blur-xl rounded-2xl p-5 border border-gray-200/50 shadow-sm">
          <label className="text-xs font-medium text-gray-500 uppercase tracking-wide">Kategori</label>
          <p className="text-lg font-semibold text-gray-900 mt-2">
            {product.category?.name || '-'}
          </p>
        </div>
        <div className="bg-white/80 backdrop-blur-xl rounded-2xl p-5 border border-gray-200/50 shadow-sm">
          <label className="text-xs font-medium text-gray-500 uppercase tracking-wide">Ürün Tipi</label>
          <p className="text-lg font-semibold text-gray-900 mt-2">
            {product.product_type || '-'}
          </p>
        </div>
        <div className="bg-white/80 backdrop-blur-xl rounded-2xl p-5 border border-gray-200/50 shadow-sm">
          <label className="text-xs font-medium text-gray-500 uppercase tracking-wide">Birim</label>
          <Select
            value={unit || undefined}
            onValueChange={handleUnitChange}
            disabled={updateMutation.isPending || !product?.id}
          >
            <SelectTrigger className="mt-2 h-11 w-full border-0 bg-gray-50/50 focus:bg-white transition-all rounded-xl text-base font-semibold text-gray-900">
              <SelectValue placeholder="Birim seçin" />
            </SelectTrigger>
            <SelectContent className="z-[80] rounded-2xl">
              {unitOptions.map((item) => (
                <SelectItem key={item.value} value={item.value}>
                  {item.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="bg-white/80 backdrop-blur-xl rounded-2xl p-5 border border-gray-200/50 shadow-sm">
          <label className="text-xs font-medium text-gray-500 uppercase tracking-wide">Birim Fiyat</label>
          {editingPrice ? (
            <div className="mt-3 space-y-2">
              <Input
                type="number"
                min="0"
                step="0.01"
                inputMode="decimal"
                autoFocus
                value={priceInput}
                onChange={(event) => setPriceInput(event.target.value)}
                onKeyDown={(event) => {
                  if (event.key === 'Enter') {
                    event.preventDefault()
                    void savePrice()
                  }
                  if (event.key === 'Escape') setEditingPrice(false)
                }}
                placeholder="Tutar"
                aria-label="Birim fiyat"
                className="h-11 border border-gray-200 bg-white rounded-xl text-base font-semibold shadow-none"
              />
              <div className="flex items-center gap-2">
                <Select value={priceCurrency} onValueChange={setPriceCurrency}>
                  <SelectTrigger className="h-10 w-[92px] rounded-xl border-gray-200 bg-white font-semibold">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent className="z-[80] rounded-2xl">
                    {PRICE_CURRENCIES.map((currency) => (
                      <SelectItem key={currency} value={currency}>
                        {currency}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Button
                  type="button"
                  variant="ghost"
                  onClick={() => setEditingPrice(false)}
                  className="h-10 rounded-xl text-gray-600"
                >
                  Vazgeç
                </Button>
                <Button
                  type="button"
                  onClick={() => void savePrice()}
                  disabled={savingPrice}
                  className="ml-auto h-10 rounded-xl bg-gray-900 text-white hover:bg-gray-800"
                >
                  {savingPrice ? 'Kaydediliyor' : 'Kaydet'}
                </Button>
              </div>
            </div>
          ) : shownUnitPrice == null && canEditPrice ? (
            <button
              type="button"
              onClick={startPriceEdit}
              className="mt-3 flex h-11 w-full items-center justify-center gap-2 rounded-xl border border-dashed border-gray-300 bg-gray-50 text-sm font-semibold text-gray-700 transition-colors hover:border-gray-900 hover:bg-white hover:text-gray-900"
            >
              <Plus className="h-4 w-4" />
              Birim fiyat ekle
            </button>
          ) : canEditPrice && shownUnitPrice != null ? (
            <button
              type="button"
              onClick={startPriceEdit}
              className="mt-2 flex h-11 w-full items-center justify-between rounded-xl bg-gray-50 px-3 text-left transition-colors hover:bg-gray-100"
            >
              <span className="text-lg font-semibold text-gray-900">
                {formatUnitPrice(shownUnitPrice, shownCurrency)}
              </span>
              <Pencil className="h-4 w-4 text-gray-400" />
            </button>
          ) : (
            <p className="text-lg font-semibold text-gray-900 mt-2">
              {shownUnitPrice != null ? formatUnitPrice(shownUnitPrice, shownCurrency) : '-'}
            </p>
          )}
        </div>
      </div>

      {/* Açıklama */}
      {product.description && (
        <div className="bg-white/80 backdrop-blur-xl rounded-2xl p-6 border border-gray-200/50 shadow-sm">
          <label className="text-xs font-medium text-gray-500 uppercase tracking-wide mb-3 block">
            Açıklama
          </label>
          <p className="text-gray-900 leading-relaxed">{product.description}</p>
        </div>
      )}

      {/* Seri Numaraları */}
      {serialNumbers && (serialNumbers.active.length > 0 || serialNumbers.pending.length > 0) && (
        <div className="bg-white/80 backdrop-blur-xl rounded-2xl p-6 border border-gray-200/50 shadow-sm">
          <label className="text-xs font-medium text-gray-500 uppercase tracking-wide mb-4 flex items-center gap-2">
            <Hash className="w-4 h-4" />
            Seri Numaraları
          </label>
          <div className="space-y-3">
            {/* Aktif Zimmetler */}
            {serialNumbers.active.length > 0 && (
              <div>
                <p className="text-xs font-medium text-gray-600 mb-2">Aktif Zimmetler</p>
                <div className="grid grid-cols-2 gap-2">
                  {serialNumbers.active.map((item, index) => (
                    <div
                      key={index}
                      className="flex items-center justify-between p-3 bg-green-50 rounded-xl border border-green-200"
                    >
                      <div className="flex items-center gap-2">
                        <Hash className="w-4 h-4 text-green-600" />
                        <span className="text-sm font-semibold text-gray-900">
                          {item.serial_number}
                        </span>
                      </div>
                      {item.user && (
                        <span className="text-xs text-gray-600">
                          👤 {item.user.full_name}
                        </span>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Bekleyen Zimmetler */}
            {serialNumbers.pending.length > 0 && (
              <div>
                <p className="text-xs font-medium text-gray-600 mb-2">Bekleyen Zimmetler</p>
                <div className="grid grid-cols-2 gap-2">
                  {serialNumbers.pending.map((item, index) => (
                    <div
                      key={index}
                      className="flex items-center justify-between p-3 bg-orange-50 rounded-xl border border-orange-200"
                    >
                      <div className="flex items-center gap-2">
                        <Hash className="w-4 h-4 text-orange-600" />
                        <span className="text-sm font-semibold text-gray-900">
                          {item.serial_number}
                        </span>
                      </div>
                      {item.user && (
                        <span className="text-xs text-gray-600">
                          👤 {item.user.full_name}
                        </span>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Alım Geçmişi */}
      {movementsData && movementsData.movements.length > 0 && (
        <div className="bg-white/80 backdrop-blur-xl rounded-2xl p-6 border border-gray-200/50 shadow-sm">
          <label className="text-xs font-medium text-gray-500 uppercase tracking-wide mb-4 flex items-center gap-2">
            <TrendingUp className="w-4 h-4" />
            Alım Geçmişi ve Fiyatlar
          </label>
          <div className="space-y-3">
            {movementsData.movements
              .filter((m: any) => m.movement_type === 'giriş' && m.unit_price)
              .map((movement: any) => (
                <div
                  key={movement.id}
                  className="flex items-center justify-between p-4 bg-gray-50 rounded-xl border border-gray-200 hover:shadow-sm transition-all"
                >
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-1">
                      <p className="text-sm font-semibold text-gray-900">
                        {parseFloat(movement.quantity).toLocaleString('tr-TR')} {product.unit}
                      </p>
                      {movement.product_condition && (
                        <Badge
                          className={`text-xs border-0 ${
                            movement.product_condition === 'yeni'
                              ? 'bg-primary-100 text-primary-800'
                              : movement.product_condition === 'kullanılmış'
                              ? 'bg-orange-100 text-orange-700'
                              : movement.product_condition === 'hek'
                              ? 'bg-purple-100 text-purple-700'
                              : 'bg-red-100 text-red-700'
                          }`}
                        >
                          {movement.product_condition === 'yeni'
                            ? 'Yeni'
                            : movement.product_condition === 'kullanılmış'
                            ? 'Kullanılmış'
                            : movement.product_condition === 'hek'
                            ? 'HEK'
                            : 'Arızalı'}
                        </Badge>
                      )}
                    </div>
                    {movement.supplier_name && (
                      <p className="text-xs text-gray-600 mb-1">
                        📦 {movement.supplier_name}
                      </p>
                    )}
                    <div className="flex items-center gap-2 mt-1">
                      <p className="text-xs text-gray-500">
                        📅 {new Date(movement.created_at).toLocaleDateString('tr-TR', {
                          year: 'numeric',
                          month: 'long',
                          day: 'numeric',
                          hour: '2-digit',
                          minute: '2-digit',
                        })}
                      </p>
                      {movement.invoice_images && movement.invoice_images.length > 0 && (
                        <button
                          onClick={() => {
                            movement.invoice_images?.forEach((url: string) => {
                              window.open(url, '_blank')
                            })
                          }}
                          className="flex items-center gap-1 px-2 py-1 bg-primary-50 hover:bg-primary-100 text-primary-700 rounded-md transition-all"
                          title="Faturaları Görüntüle"
                        >
                          <Receipt className="w-3 h-3" />
                          <span className="text-xs font-medium">{movement.invoice_images.length}</span>
                        </button>
                      )}
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="flex items-center gap-2 justify-end mb-1">
                      <span className="text-xs text-gray-500">Birim:</span>
                      <span className="text-lg font-bold text-gray-900">
                        {parseFloat(movement.unit_price).toLocaleString('tr-TR', {
                          minimumFractionDigits: 2,
                          maximumFractionDigits: 2,
                        })} {movement.currency || 'TRY'}
                      </span>
                    </div>
                    <div className="flex items-center gap-2 justify-end">
                      <span className="text-xs text-gray-500">Toplam:</span>
                      <span className="text-base font-bold text-gray-900">
                        {(parseFloat(movement.quantity) * parseFloat(movement.unit_price)).toLocaleString('tr-TR', {
                          minimumFractionDigits: 2,
                          maximumFractionDigits: 2,
                        })} {movement.currency || 'TRY'}
                      </span>
                    </div>
                  </div>
                </div>
              ))}
            {movementsData.movements.filter((m: any) => m.movement_type === 'giriş' && m.unit_price).length === 0 && (
              <div className="text-center py-8">
                <p className="text-sm text-gray-500">Henüz fiyat bilgisi olan alım kaydı yok</p>
              </div>
            )}
          </div>
        </div>
      )}
    </>
  )
}
