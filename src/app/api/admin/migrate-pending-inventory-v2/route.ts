import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'
import { buildDovecGroupWorkEmailFromDisplayName } from '@/lib/dovec-work-email'

interface MigrationResult {
  success: boolean
  summary: {
    totalProcessed: number
    successfullyMigrated: number
    partiallyMigrated: number
    skipped: number
    errors: string[]
  }
  details: {
    productId: string
    productName: string
    pendingQuantity: number
    migratedQuantity: number
    status: 'full' | 'partial' | 'skipped'
    message: string
  }[]
}

export async function POST(request: Request) {
  try {
    const supabase = await createClient()
    
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { data: profile } = await supabase
      .from('profiles')
      .select('role')
      .eq('id', user.id)
      .single()
    
    if (!profile || !['admin', 'super_admin'].includes(profile.role)) {
      return NextResponse.json({ error: 'Admin yetkisi gerekli' }, { status: 403 })
    }

    const body = await request.json().catch(() => ({}))
    const dryRun = body.dryRun !== false

    const { data: pendingData, error: pendingError } = await supabase
      .from('pending_user_inventory')
      .select(`
        id,
        product_id,
        item_name,
        owner_name,
        owner_email,
        quantity,
        unit,
        serial_number,
        notes,
        created_at
      `)
      .not('product_id', 'is', null)
      .order('product_id')

    if (pendingError) throw pendingError

    const groupedByProduct: Record<string, typeof pendingData> = {}
    for (const item of pendingData || []) {
      if (!groupedByProduct[item.product_id!]) {
        groupedByProduct[item.product_id!] = []
      }
      groupedByProduct[item.product_id!].push(item)
    }

    const result: MigrationResult = {
      success: true,
      summary: {
        totalProcessed: 0,
        successfullyMigrated: 0,
        partiallyMigrated: 0,
        skipped: 0,
        errors: []
      },
      details: []
    }

    for (const [productId, pendingItems] of Object.entries(groupedByProduct)) {
      result.summary.totalProcessed++

      const totalPendingQty = pendingItems.reduce(
        (sum, item) => sum + parseFloat(item.quantity?.toString() || '0'), 0
      )
      const productName = pendingItems[0].item_name

      const { data: warehouseStocks, error: stockError } = await supabase
        .from('warehouse_stock')
        .select(`
          id,
          warehouse_id,
          quantity,
          condition_breakdown,
          warehouse:sites!warehouse_stock_warehouse_id_fkey(name)
        `)
        .eq('product_id', productId)
        .is('user_id', null)
        .gt('quantity', 0)
        .order('quantity', { ascending: false })

      if (stockError) {
        result.summary.skipped++
        result.summary.errors.push(`${productName}: Stok sorgusu hatası`)
        result.details.push({
          productId,
          productName,
          pendingQuantity: totalPendingQty,
          migratedQuantity: 0,
          status: 'skipped',
          message: 'Stok sorgusu hatası'
        })
        continue
      }

      const totalAvailableStock = (warehouseStocks || []).reduce(
        (sum, ws) => sum + parseFloat(ws.quantity?.toString() || '0'), 0
      )

      if (totalAvailableStock <= 0) {
        result.summary.skipped++
        result.details.push({
          productId,
          productName,
          pendingQuantity: totalPendingQty,
          migratedQuantity: 0,
          status: 'skipped',
          message: 'Depoda stok yok'
        })
        continue
      }

      let remainingToMigrate = Math.min(totalPendingQty, totalAvailableStock)
      let totalMigrated = 0
      const stockUpdates: { stockId: string; newQuantity: number; newBreakdown: any }[] = []
      const inventoryInserts: any[] = []
      const pendingDeletes: string[] = []

      const sortedStocks = [...(warehouseStocks || [])].sort(
        (a, b) => parseFloat(b.quantity?.toString() || '0') - parseFloat(a.quantity?.toString() || '0')
      )

      for (const pending of pendingItems) {
        if (remainingToMigrate <= 0) break

        const pendingQty = parseFloat(pending.quantity?.toString() || '0')
        const qtyToMigrate = Math.min(pendingQty, remainingToMigrate)

        if (qtyToMigrate <= 0) continue

        let qtyLeftToDeduct = qtyToMigrate
        let sourceWarehouseId: string | null = null

        for (const stock of sortedStocks) {
          if (qtyLeftToDeduct <= 0) break

          const stockQty = parseFloat(stock.quantity?.toString() || '0')
          const existingUpdate = stockUpdates.find(u => u.stockId === stock.id)
          const currentQty = existingUpdate ? existingUpdate.newQuantity : stockQty

          if (currentQty <= 0) continue

          const deductAmount = Math.min(qtyLeftToDeduct, currentQty)
          
          if (!sourceWarehouseId) {
            sourceWarehouseId = stock.warehouse_id
          }

          if (existingUpdate) {
            existingUpdate.newQuantity -= deductAmount
          } else {
            const breakdown = (stock.condition_breakdown as Record<string, number>) || {}
            let remaining = deductAmount
            const conditionOrder = ['yeni', 'kullanılmış', 'hek', 'arızalı']
            
            for (const condition of conditionOrder) {
              if (remaining <= 0) break
              const conditionQty = breakdown[condition] || 0
              if (conditionQty > 0) {
                const toDeduct = Math.min(conditionQty, remaining)
                breakdown[condition] = conditionQty - toDeduct
                remaining -= toDeduct
              }
            }

            stockUpdates.push({
              stockId: stock.id,
              newQuantity: stockQty - deductAmount,
              newBreakdown: breakdown
            })
          }

          qtyLeftToDeduct -= deductAmount
        }

        if (qtyToMigrate - qtyLeftToDeduct > 0) {
          inventoryInserts.push({
            product_id: productId,
            item_name: pending.item_name,
            quantity: qtyToMigrate - qtyLeftToDeduct,
            unit: pending.unit || 'adet',
            assigned_date: pending.created_at || new Date().toISOString(),
            assigned_by: user.id,
            status: 'active',
            notes: `Migrated from pending_user_inventory - ${pending.notes || ''}`.trim(),
            category: null,
            consumed_quantity: 0,
            owner_name: pending.owner_name,
            owner_email:
              buildDovecGroupWorkEmailFromDisplayName(pending.owner_name || '') ||
              pending.owner_email ||
              null,
            serial_number: pending.serial_number,
            source_warehouse_id: sourceWarehouseId
          })

          totalMigrated += qtyToMigrate - qtyLeftToDeduct
          remainingToMigrate -= (qtyToMigrate - qtyLeftToDeduct)
          pendingDeletes.push(pending.id)
        }
      }

      if (!dryRun && totalMigrated > 0) {
        for (const update of stockUpdates) {
          const { error: updateError } = await supabase
            .from('warehouse_stock')
            .update({
              quantity: update.newQuantity,
              condition_breakdown: update.newBreakdown,
              last_updated: new Date().toISOString(),
              updated_by: user.id
            })
            .eq('id', update.stockId)

          if (updateError) {
            result.summary.errors.push(`${productName}: Stok güncelleme hatası - ${updateError.message}`)
          }
        }

        if (inventoryInserts.length > 0) {
          const { error: insertError } = await supabase
            .from('user_inventory')
            .insert(inventoryInserts)

          if (insertError) {
            result.summary.errors.push(`${productName}: Zimmet ekleme hatası - ${insertError.message}`)
          }
        }

        if (pendingDeletes.length > 0) {
          const { error: deleteError } = await supabase
            .from('pending_user_inventory')
            .delete()
            .in('id', pendingDeletes)

          if (deleteError) {
            result.summary.errors.push(`${productName}: Pending silme hatası - ${deleteError.message}`)
          }
        }
      }

      const status = totalMigrated >= totalPendingQty ? 'full' : 
                     totalMigrated > 0 ? 'partial' : 'skipped'

      if (status === 'full') {
        result.summary.successfullyMigrated++
      } else if (status === 'partial') {
        result.summary.partiallyMigrated++
      } else {
        result.summary.skipped++
      }

      result.details.push({
        productId,
        productName,
        pendingQuantity: totalPendingQty,
        migratedQuantity: totalMigrated,
        status,
        message: status === 'full' 
          ? 'Tamamı taşındı' 
          : status === 'partial' 
          ? `${totalMigrated}/${totalPendingQty} taşındı (stok yetersiz)`
          : 'Taşınamadı'
      })
    }

    return NextResponse.json({
      ...result,
      mode: dryRun ? 'DRY_RUN (değişiklik yapılmadı)' : 'EXECUTED',
      message: dryRun 
        ? 'Bu bir simülasyondur. Gerçek migration için dryRun: false gönderin.'
        : 'Migration tamamlandı.'
    })

  } catch (error: any) {
    console.error('Migration hatası:', error)
    return NextResponse.json({ 
      error: error.message || 'Migration başarısız' 
    }, { status: 500 })
  }
}

export async function GET() {
  try {
    const supabase = await createClient()
    
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { data, error } = await supabase.rpc('get_pending_migration_stats')

    if (error) {
      const { data: manualStats } = await supabase
        .from('pending_user_inventory')
        .select('product_id, quantity')
        .not('product_id', 'is', null)

      const productCount = new Set((manualStats || []).map(m => m.product_id)).size
      const totalPending = (manualStats || []).reduce(
        (sum, m) => sum + parseFloat(m.quantity?.toString() || '0'), 0
      )

      return NextResponse.json({
        summary: {
          uniqueProducts: productCount,
          totalPendingQuantity: totalPending,
          message: 'pending_user_inventory tablosunda taşınmayı bekleyen kayıtlar'
        },
        instructions: {
          dryRun: 'POST isteği gönderin (varsayılan olarak dry-run modunda çalışır)',
          execute: 'POST isteği body\'de { "dryRun": false } gönderin'
        }
      })
    }

    return NextResponse.json(data)
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}
