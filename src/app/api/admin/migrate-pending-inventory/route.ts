import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'

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

    const { data: pendingInventories, error: fetchError } = await supabase
      .from('pending_user_inventory')
      .select('*')

    if (fetchError) throw fetchError

    if (!pendingInventories || pendingInventories.length === 0) {
      return NextResponse.json({ 
        success: true, 
        message: 'Taşınacak envanter kaydı bulunamadı',
        migrated: 0 
      })
    }

    const results = {
      migrated: 0,
      skipped: 0,
      errors: [] as string[]
    }

    for (const pending of pendingInventories) {
      try {
        if (!pending.product_id) {
          results.skipped++
          results.errors.push(`${pending.item_name}: product_id bulunamadı`)
          continue
        }

        const { data: warehouseStocks, error: stockError } = await supabase
          .from('warehouse_stock')
          .select('id, warehouse_id, quantity, condition_breakdown, warehouse:sites!warehouse_stock_warehouse_id_fkey(name)')
          .eq('product_id', pending.product_id)
          .is('user_id', null)
          .gt('quantity', 0)
          .order('quantity', { ascending: false })

        if (stockError) throw stockError

        if (!warehouseStocks || warehouseStocks.length === 0) {
          results.skipped++
          results.errors.push(`${pending.item_name}: Bu ürün için stok bulunamadı`)
          continue
        }

        const targetStock = warehouseStocks[0]
        const requestedQty = parseFloat(pending.quantity?.toString() || '1')
        const availableQty = parseFloat(targetStock.quantity.toString())

        if (availableQty < requestedQty) {
          results.skipped++
          results.errors.push(`${pending.item_name}: Yetersiz stok (Mevcut: ${availableQty}, İstenen: ${requestedQty})`)
          continue
        }

        const breakdown = (targetStock.condition_breakdown as Record<string, number>) || {}
        let remainingToDeduct = requestedQty
        const conditionOrder = ['yeni', 'kullanılmış', 'hek', 'arızalı']
        
        for (const condition of conditionOrder) {
          if (remainingToDeduct <= 0) break
          const conditionQty = breakdown[condition] || 0
          if (conditionQty > 0) {
            const deductAmount = Math.min(conditionQty, remainingToDeduct)
            breakdown[condition] = conditionQty - deductAmount
            remainingToDeduct -= deductAmount
          }
        }

        const newQuantity = availableQty - requestedQty

        const { error: updateStockError } = await supabase
          .from('warehouse_stock')
          .update({
            quantity: newQuantity,
            condition_breakdown: breakdown,
            last_updated: new Date().toISOString(),
            updated_by: user.id
          })
          .eq('id', targetStock.id)

        if (updateStockError) throw updateStockError

        const { error: insertError } = await supabase
          .from('user_inventory')
          .insert({
            product_id: pending.product_id,
            item_name: pending.item_name,
            quantity: requestedQty,
            unit: pending.unit || 'adet',
            assigned_date: pending.created_at || new Date().toISOString(),
            assigned_by: user.id,
            status: 'active',
            notes: `Envanter zimmetinden taşındı - ${pending.notes || ''}`.trim(),
            category: null,
            consumed_quantity: 0,
            owner_name: pending.owner_name,
            owner_email: pending.owner_email,
            serial_number: pending.serial_number,
            source_warehouse_id: targetStock.warehouse_id
          })

        if (insertError) throw insertError

        const { error: deleteError } = await supabase
          .from('pending_user_inventory')
          .delete()
          .eq('id', pending.id)

        if (deleteError) throw deleteError

        results.migrated++

      } catch (itemError: any) {
        results.errors.push(`${pending.item_name}: ${itemError.message}`)
        results.skipped++
      }
    }

    return NextResponse.json({
      success: true,
      message: `${results.migrated} kayıt başarıyla taşındı, ${results.skipped} kayıt atlandı`,
      ...results
    })

  } catch (error: any) {
    console.error('Migration hatası:', error)
    return NextResponse.json({ 
      error: error.message || 'Migration işlemi başarısız oldu' 
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

    const { data: pendingInventories, error } = await supabase
      .from('pending_user_inventory')
      .select(`
        *,
        product:products(name, unit)
      `)
      .order('owner_name')

    if (error) throw error

    const summary = {
      totalRecords: pendingInventories?.length || 0,
      records: pendingInventories || []
    }

    return NextResponse.json(summary)

  } catch (error: any) {
    console.error('Envanter listesi hatası:', error)
    return NextResponse.json({ 
      error: error.message || 'Envanter listesi alınamadı' 
    }, { status: 500 })
  }
}
