'use client'

import { useMemo } from 'react'
import {
  formatContractMoney,
  formatContractQty,
  type ContractOverview,
} from '@/lib/contracts'
import { convertBrickQuantity, formatConvertedQty } from '@/lib/brick-quantity'
import {
  matchHistoryToContractItem,
  type SupplierPurchaseHistory,
} from '@/lib/supplier-purchase-history'

export function ContractPurchaseHistory({
  contract,
  history,
  isLoading = false,
}: {
  contract: ContractOverview
  history?: SupplierPurchaseHistory | null
  isLoading?: boolean
}) {
  const itemMatches = useMemo(() => {
    if (!history) return []
    return contract.items.map((item) => ({
      item,
      match: matchHistoryToContractItem(item.material_item, history.products),
    }))
  }, [contract.items, history])

  if (isLoading) {
    return (
      <div className="rounded-2xl border border-elegant-gray-200 bg-white p-6 text-sm text-elegant-gray-500 shadow-sm">
        Geçmiş alımlar yükleniyor…
      </div>
    )
  }

  if (!history || history.orderCount === 0) {
    return (
      <div className="rounded-2xl border border-elegant-gray-200 bg-white p-6 shadow-sm">
        <h2 className="text-xl font-semibold text-elegant-black">Geçmiş alımlar</h2>
        <p className="mt-1 text-sm text-elegant-gray-500">
          Bu tedarikçiden henüz faturalı alım bulunamadı.
        </p>
      </div>
    )
  }

  return (
    <div className="rounded-2xl border border-elegant-gray-200 bg-white p-6 shadow-sm">
      <h2 className="text-xl font-semibold text-elegant-black">Geçmiş alımlar</h2>
      <p className="mt-1 text-sm text-elegant-gray-600">
        Sözleşme kalemleriyle eşleşen ürünler, alınan miktar ve kesilen tutar.
      </p>
      <div className="mt-5 space-y-3">
        {itemMatches.map(({ item, match }) => (
          <div key={item.id} className="rounded-2xl border border-elegant-gray-100 bg-elegant-gray-50 px-4 py-4">
            <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
              <div>
                <p className="font-semibold text-elegant-black">{item.material_item}</p>
                <p className="text-xs text-elegant-gray-500">
                  Sözleşmeli {formatContractQty(item.contracted_quantity, item.unit)}
                </p>
              </div>
              {match.products.length === 0 ? (
                <p className="text-sm text-elegant-gray-500">Eşleşen geçmiş alım yok</p>
              ) : (
                <div className="text-sm text-elegant-black sm:text-right">
                  <p className="text-base font-semibold">{formatContractMoney(match.amount, match.currency)}</p>
                  <p className="text-xs text-elegant-gray-500">
                    {match.products.reduce((sum, row) => sum + row.orderCount, 0)} sipariş
                  </p>
                </div>
              )}
            </div>
            {match.products.length > 0 && (
              <div className="mt-3 overflow-x-auto">
                <table className="w-full min-w-[420px] text-left text-sm">
                  <thead>
                    <tr className="text-[10px] font-bold text-elegant-gray-500">
                      <th className="pb-2 font-bold">Ürün</th>
                      <th className="pb-2 font-bold">Miktar</th>
                      <th className="pb-2 text-right font-bold">Tutar</th>
                    </tr>
                  </thead>
                  <tbody>
                    {match.products.map((product) => (
                      <tr key={product.key} className="border-t border-white/80">
                        <td className="py-2 pr-3">
                          <span className="text-elegant-black">{product.name}</span>
                          <span className="ml-1 text-xs text-elegant-gray-500">· {product.orderCount} sipariş</span>
                        </td>
                        <td className="py-2 text-elegant-gray-700">
                          {formatConvertedQty(
                            formatContractQty,
                            convertBrickQuantity(product.name, product.quantity, product.unit)
                          )}
                        </td>
                        <td className="py-2 text-right font-medium text-elegant-black">
                          {formatContractMoney(product.amount, product.currency)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  )
}
