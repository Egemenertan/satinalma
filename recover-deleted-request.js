// Silinen talebi bulmak için script
// Talep ID sonu: 8w-2853

const { createClient } = require('@supabase/supabase-js')
require('dotenv').config({ path: '.env' })

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY

if (!supabaseUrl || !supabaseKey) {
  console.error('❌ Supabase URL veya Key bulunamadı!')
  console.error('URL:', supabaseUrl)
  console.error('Key:', supabaseKey ? 'Mevcut' : 'Yok')
  process.exit(1)
}

const supabase = createClient(supabaseUrl, supabaseKey)

async function findDeletedRequest() {
  console.log('🔍 Silinen talebi arıyorum...')
  console.log('Talep ID sonu: 8w-2853\n')

  try {
    // 1. Orders tablosunda kalıntı kayıtları ara
    console.log('📦 Orders tablosunda aranıyor...')
    const { data: orders, error: ordersError } = await supabase
      .from('orders')
      .select(`
        id,
        purchase_request_id,
        material_item_id,
        supplier_id,
        delivery_date,
        amount,
        quantity,
        created_at,
        suppliers(name),
        purchase_requests(id, created_at)
      `)
      .order('created_at', { ascending: false })
      .limit(100)

    if (ordersError) {
      console.error('Orders sorgu hatası:', ordersError)
    } else if (orders) {
      // ID'nin sonunda 8w-2853 olanları bul
      const matchingOrders = orders.filter(order => {
        const prId = order.purchase_request_id
        if (!prId) return false
        // UUID'nin son karakterlerini kontrol et
        return prId.toLowerCase().includes('8w-2853') || 
               prId.slice(-10).toLowerCase().includes('2853')
      })

      if (matchingOrders.length > 0) {
        console.log(`✅ ${matchingOrders.length} eşleşen sipariş bulundu!\n`)
        matchingOrders.forEach(order => {
          console.log('─────────────────────────────────────')
          console.log('Sipariş ID:', order.id)
          console.log('Talep ID:', order.purchase_request_id)
          console.log('Tedarikçi:', order.suppliers?.name || 'Bilinmiyor')
          console.log('Miktar:', order.quantity)
          console.log('Tutar:', order.amount)
          console.log('Teslimat Tarihi:', order.delivery_date)
          console.log('Oluşturma Tarihi:', new Date(order.created_at).toLocaleString('tr-TR'))
        })
      } else {
        console.log('❌ Orders tablosunda eşleşme bulunamadı')
      }
    }

    // 2. Invoices tablosunda ara
    console.log('\n📄 Invoices tablosunda aranıyor...')
    const { data: invoices, error: invoicesError } = await supabase
      .from('invoices')
      .select(`
        id,
        order_id,
        invoice_number,
        total_amount,
        created_at,
        orders(purchase_request_id, suppliers(name))
      `)
      .order('created_at', { ascending: false })
      .limit(100)

    if (invoicesError) {
      console.error('Invoices sorgu hatası:', invoicesError)
    } else if (invoices) {
      const matchingInvoices = invoices.filter(invoice => {
        const prId = invoice.orders?.purchase_request_id
        if (!prId) return false
        return prId.toLowerCase().includes('8w-2853') || 
               prId.slice(-10).toLowerCase().includes('2853')
      })

      if (matchingInvoices.length > 0) {
        console.log(`✅ ${matchingInvoices.length} eşleşen fatura bulundu!\n`)
        matchingInvoices.forEach(invoice => {
          console.log('─────────────────────────────────────')
          console.log('Fatura No:', invoice.invoice_number)
          console.log('Sipariş ID:', invoice.order_id)
          console.log('Tutar:', invoice.total_amount)
          console.log('Oluşturma Tarihi:', new Date(invoice.created_at).toLocaleString('tr-TR'))
        })
      } else {
        console.log('❌ Invoices tablosunda eşleşme bulunamadı')
      }
    }

    // 3. Shipments tablosunda ara
    console.log('\n📮 Shipments tablosunda aranıyor...')
    const { data: shipments, error: shipmentsError } = await supabase
      .from('shipments')
      .select(`
        id,
        purchase_request_id,
        purchase_request_item_id,
        shipped_quantity,
        shipped_at,
        shipped_by,
        profiles(full_name, email)
      `)
      .order('shipped_at', { ascending: false })
      .limit(100)

    if (shipmentsError) {
      console.error('Shipments sorgu hatası:', shipmentsError)
    } else if (shipments) {
      const matchingShipments = shipments.filter(shipment => {
        const prId = shipment.purchase_request_id
        if (!prId) return false
        return prId.toLowerCase().includes('8w-2853') || 
               prId.slice(-10).toLowerCase().includes('2853')
      })

      if (matchingShipments.length > 0) {
        console.log(`✅ ${matchingShipments.length} eşleşen gönderi bulundu!\n`)
        matchingShipments.forEach(shipment => {
          console.log('─────────────────────────────────────')
          console.log('Gönderi ID:', shipment.id)
          console.log('Talep ID:', shipment.purchase_request_id)
          console.log('Miktar:', shipment.shipped_quantity)
          console.log('Gönderen:', shipment.profiles?.full_name || shipment.profiles?.email || 'Bilinmiyor')
          console.log('Tarih:', new Date(shipment.shipped_at).toLocaleString('tr-TR'))
        })
      } else {
        console.log('❌ Shipments tablosunda eşleşme bulunamadı')
      }
    }

    // 4. Tüm purchase_requests'leri kontrol et (belki hala var)
    console.log('\n📋 Purchase Requests tablosunda aranıyor...')
    const { data: requests, error: requestsError } = await supabase
      .from('purchase_requests')
      .select('id, created_at, status, sites(name)')
      .order('created_at', { ascending: false })
      .limit(200)

    if (requestsError) {
      console.error('Requests sorgu hatası:', requestsError)
    } else if (requests) {
      const matchingRequests = requests.filter(req => {
        const id = req.id
        return id.toLowerCase().includes('8w-2853') || 
               id.slice(-10).toLowerCase().includes('2853')
      })

      if (matchingRequests.length > 0) {
        console.log(`✅ TALEP HALA VAR! ${matchingRequests.length} eşleşen talep bulundu!\n`)
        matchingRequests.forEach(req => {
          console.log('─────────────────────────────────────')
          console.log('🎉 TALEP ID:', req.id)
          console.log('Durum:', req.status)
          console.log('Şantiye:', req.sites?.name || 'Bilinmiyor')
          console.log('Oluşturma Tarihi:', new Date(req.created_at).toLocaleString('tr-TR'))
          console.log('\n🔗 Talep Linki:', `http://localhost:3000/dashboard/requests/${req.id}/offers`)
        })
      } else {
        console.log('❌ Purchase Requests tablosunda eşleşme bulunamadı')
      }
    }

    console.log('\n════════════════════════════════════════')
    console.log('Arama tamamlandı!')
    console.log('════════════════════════════════════════\n')

  } catch (error) {
    console.error('❌ Hata:', error)
  }
}

findDeletedRequest()
