'use client'

import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Database } from '@/lib/supabase'
import { PurchaseRequest, MaterialSupplier, OrderInfo, ShipmentInfo, SupplierInfo } from '../types'
import {
  isProfileDepartmentIt,
  purchaseRequestHasItWarehouseVisibleItem
} from '@/lib/warehouse-it-material-filter'

export function useOfferData(requestId: string) {
  const [request, setRequest] = useState<PurchaseRequest | null>(null)
  const [existingOffers, setExistingOffers] = useState<any[]>([])
  const [userRole, setUserRole] = useState<string>('user')
  const [userDepartment, setUserDepartment] = useState<string | null>(null)
  const [materialSuppliers, setMaterialSuppliers] = useState<{[itemId: string]: MaterialSupplier}>({})
  const [materialOrders, setMaterialOrders] = useState<any[]>([])
  const [shipmentData, setShipmentData] = useState<{[key: string]: ShipmentInfo}>({})
  const [currentOrder, setCurrentOrder] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const supabase = createClient()

  const fetchUserRole = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser()
      if (user) {
        const { data: profile } = await supabase
          .from('profiles')
          .select('role, department')
          .eq('id', user.id)
          .single()
        
        if (profile?.role) {
          setUserRole(profile.role)
        }
        setUserDepartment(profile?.department ?? null)
      } else {
        setUserDepartment(null)
      }
    } catch (error) {
      console.error('Error fetching user role:', error)
    }
  }

  const fetchRequestData = async () => {
    try {
      // 🚀 OPTIMIZASYON: Tek sorguda hem request hem items'ı al
      const { data, error } = await supabase
        .from('purchase_requests')
        .select(`
          *, 
          delivery_date,
          purchase_request_items(
            id, item_name, description, quantity, unit, 
            specifications, brand, original_quantity, 
            image_urls, purpose, delivery_date, product_id,
            material_group, material_group_code,
            material_class, material_item_name
          )
        `)
        .eq('id', requestId)
        .single()
      
      if (!error && data) {
        // Items artık data içinde geliyor, ayrı sorguya gerek yok
        const items = data.purchase_request_items || []

        const { data: { user: viewer } } = await supabase.auth.getUser()
        if (viewer) {
          const { data: viewerProfile } = await supabase
            .from('profiles')
            .select('role, department')
            .eq('id', viewer.id)
            .single()

          const itWmRestricted =
            viewerProfile?.role === 'warehouse_manager' &&
            isProfileDepartmentIt(viewerProfile.department ?? undefined)

          if (itWmRestricted && !purchaseRequestHasItWarehouseVisibleItem(items)) {
            setError('Bu talebi görüntüleme yetkiniz bulunmuyor.')
            setRequest(null)
            return
          }
        }

        if (data.requested_by) {
          
          // Önce profiles tablosundan dene
          const { data: profileData, error: profileError } = await supabase
            .from('profiles')
            .select('full_name, email')
            .eq('id', data.requested_by)
            .single()

          if (!profileError && profileData) {
            // Eğer full_name boş ise email'den isim oluşturmaya çalış
            let displayName = profileData.full_name
            
            if (!displayName || displayName.trim() === '') {
              // Email'den isim oluştur (@ işaretinden öncesini al)
              if (profileData.email) {
                displayName = profileData.email.split('@')[0]
                  .replace(/[._-]/g, ' ') // . _ - karakterlerini boşlukla değiştir
                  .split(' ')
                  .map(word => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase()) // Her kelimenin ilk harfini büyüt
                  .join(' ')
              } else {
                displayName = 'İsimsiz Kullanıcı'
              }
            }
            
            data.profiles = {
              full_name: displayName,
              email: profileData.email
            }
          } else {
            // Profile bulunamadı, varsayılan değer kullan
            data.profiles = { full_name: 'Bilinmiyor', email: '' }
          }
        } else {
          data.profiles = { full_name: 'Bilinmiyor', email: '' }
        }

        if (data.site_id) {
          const { data: sitesData, error: sitesError } = await supabase
            .from('sites')
            .select('id, name, code, location')
            .eq('id', data.site_id)
            .single()
          
          if (!sitesError && sitesData) {
            data.sites = sitesData
          }
        }
        
        if (data.construction_site_id) {
          const { data: constructionSitesData, error: constructionSitesError } = await supabase
            .from('construction_sites')
            .select('id, name, code, location')
            .eq('id', data.construction_site_id)
            .single()
          
          if (!constructionSitesError && constructionSitesData) {
            data.construction_sites = constructionSitesData
          }
        }
      }
      
      if (error) {
        console.error('Error fetching request data:', error)
        throw error
      }
      
      setRequest(data)
    } catch (error) {
      console.error('Error fetching request:', error)
    }
  }

  const fetchExistingOffers = async () => {
    try {
      const { data, error } = await supabase
        .from('offers')
        .select('*')
        .eq('purchase_request_id', requestId)
        .order('created_at', { ascending: false })

      if (error) throw error
      
      setExistingOffers(data || [])
    } catch (error) {
      console.error('Error fetching offers:', error)
    }
  }

  const fetchMaterialSuppliers = async (requestItems?: any[]) => {
    try {
      // Eğer requestItems parametre olarak gelmediyse, request'ten al
      let items = requestItems
      if (!items) {
        const { data: requestData, error: requestError } = await supabase
          .from('purchase_requests')
          .select('purchase_request_items(id, item_name)')
          .eq('id', requestId)
          .single()

        if (requestError) {
          console.error('❌ Purchase request data alınamadı:', requestError)
          throw requestError
        }
        items = requestData?.purchase_request_items || []
      }

      if (items && items.length > 0) {
        const materialSuppliersData: {[itemId: string]: MaterialSupplier} = {}
        
        // 🚀 OPTIMIZASYON: Tüm material isimleri için tek sorguda supplier-materials al
        const materialNames = items.map(item => item.item_name)
        
        const { data: supplierMaterialsAll, error: materialsError } = await supabase
          .from('supplier_materials')
          .select(`
            id,
            supplier_id,
            material_item,
            supplier:suppliers(
              id, name, contact_person, phone, email
            )
          `)
          .in('material_item', materialNames)

        // Her malzeme için tedarikçi bilgilerini organize et
        for (const item of items) {
          const itemSuppliers = supplierMaterialsAll?.filter(sm => sm.material_item === item.item_name) || []
          
          if (itemSuppliers.length > 0) {
            const suppliers = itemSuppliers
              .map(sm => sm.supplier)
              .filter(supplier => supplier !== null) as unknown as SupplierInfo[]
            
            materialSuppliersData[item.id] = {
              isRegistered: true,
              suppliers: suppliers
            }
          } else {
            materialSuppliersData[item.id] = {
              isRegistered: false,
              suppliers: []
            }
          }
        }

        setMaterialSuppliers(materialSuppliersData)
      }
    } catch (error: any) {
      console.error('Error fetching material suppliers:', error)
    }
  }

  const fetchMaterialOrders = async () => {
    try {
      
      const { data: orders, error } = await supabase
        .from('orders')
        .select(`
          id,
          delivery_date,
          created_at,
          material_item_id,
          quantity,
          amount,
          currency,
          returned_quantity,
          return_notes,
          reorder_requested,
          is_delivered,
          delivery_confirmed_at,
          delivery_confirmed_by,
          supplier_id,
          is_return_reorder,
          status,
          supplier:suppliers(
            id,
            name
          ),
          order_deliveries(
            id,
            delivered_quantity,
            delivered_at,
            delivery_notes
          )
        `)
        .eq('purchase_request_id', requestId)
        .order('created_at', { ascending: true })

      if (error) {
        console.error('Error fetching orders:', error)
        return
      }

      if (orders && orders.length > 0) {
        // Array olarak döndür, quantity field'ı dahil et
        const ordersArray = orders.map((order: any) => {
          // Toplam teslim alınan miktarı hesapla
          const totalDelivered = order.order_deliveries && order.order_deliveries.length > 0 
            ? order.order_deliveries.reduce((sum: number, delivery: any) => sum + (delivery.delivered_quantity || 0), 0)
            : 0

          return {
            id: order.id,
            delivery_date: order.delivery_date,
            created_at: order.created_at,
            material_item_id: order.material_item_id,
            quantity: order.quantity || 0,
            amount: order.amount || 0,
            currency: order.currency || 'TRY',
            returned_quantity: order.returned_quantity || 0, // İade edilen miktar
            return_notes: order.return_notes || null, // İade nedeni
            reorder_requested: order.reorder_requested, // İade sırasında yeniden sipariş istenip istenmediği
            is_return_reorder: order.is_return_reorder || false, // İade yeniden siparişi mi?
            delivered_quantity: totalDelivered, // Kademeli teslim alma toplamı
            total_delivered: totalDelivered, // Alias for compatibility
            remaining_quantity: Math.max(0, (order.quantity || 0) - totalDelivered - (order.returned_quantity || 0)), // Kalan miktar
            is_delivered: order.is_delivered || false,
            delivery_confirmed_at: order.delivery_confirmed_at,
            delivery_confirmed_by: order.delivery_confirmed_by,
            supplier_id: order.supplier_id,
            supplier: order.supplier ? {
              id: order.supplier.id,
              name: order.supplier.name
            } : null,
            suppliers: order.supplier ? {
              id: order.supplier.id,
              name: order.supplier.name
            } : null,
            order_deliveries: order.order_deliveries || []
          }
        })

        setMaterialOrders(ordersArray)
      } else {
        setMaterialOrders([])
      }
    } catch (error) {
      console.error('Error fetching material orders:', error)
      setMaterialOrders([])
    }
  }

  const fetchShipmentData = async () => {
    try {
      const { data: shipments, error } = await supabase
        .from('shipments')
        .select('*')
        .eq('purchase_request_id', requestId)
        .order('shipped_at', { ascending: false })

      if (error) {
        console.error('Error fetching shipments:', error)
        setShipmentData({})
        return
      }

      let shipmentsWithProfiles = shipments || []
      
      if (shipments && shipments.length > 0) {
        const userIds = [...new Set(shipments.map(s => s.shipped_by))]
        
        const { data: profiles, error: profileError } = await supabase
          .from('profiles')
          .select('id, full_name')
          .in('id', userIds)

        if (!profileError && profiles) {
          shipmentsWithProfiles = shipments.map(shipment => ({
            ...shipment,
            profiles: profiles.find(p => p.id === shipment.shipped_by) || null
          }))
        }
      }

      const groupedShipments: {[key: string]: ShipmentInfo} = {}
      
      shipmentsWithProfiles.forEach((shipment) => {
        const itemId = shipment.purchase_request_item_id
        const quantity = parseFloat(shipment.shipped_quantity)
        
        if (!groupedShipments[itemId]) {
          groupedShipments[itemId] = {
            total_shipped: 0,
            shipments: []
          }
        }
        
        groupedShipments[itemId].total_shipped += quantity
        groupedShipments[itemId].shipments.push(shipment)
      })

      setShipmentData(groupedShipments)
      
    } catch (error) {
      console.error('Error fetching shipment data:', error)
      setShipmentData({})
    }
  }

  const fetchOrderDetails = async () => {
    try {
      const { data: orders, error } = await supabase
        .from('orders')
        .select(`
          *,
          supplier:suppliers(
            id,
            name,
            contact_person,
            phone,
            email
          )
        `)
        .eq('purchase_request_id', requestId)
        .order('created_at', { ascending: false })
        .limit(1)

      if (error) {
        console.error('Error fetching order details:', error)
        return
      }

      if (orders && orders.length > 0) {
        setCurrentOrder(orders[0])
      } else {
        setCurrentOrder(null)
      }
    } catch (error) {
      console.error('Error fetching order details:', error)
    }
  }

  const refreshData = async () => {
    try {
      setLoading(true)
      setError(null)
      
      // 🚀 OPTIMIZASYON: İlk request'i al ve items'ı dahil et
      const requestPromise = fetchRequestData()
      
      // Request'i bekle ki items bilgisini diğer fonksiyonlara aktarabiliriz  
      await requestPromise
      
      // Geriye kalan işlemleri paralel çalıştır
      await Promise.all([
        fetchExistingOffers(),
        fetchMaterialSuppliers(request?.purchase_request_items),
        fetchMaterialOrders(),
        fetchShipmentData(),
        fetchOrderDetails()
      ])
    } catch (err) {
      console.error('Data refresh error:', err)
      setError(err instanceof Error ? err.message : 'Veriler yüklenirken bir hata oluştu')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    if (requestId) {
      fetchUserRole()
      refreshData()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [requestId])

  return {
    request,
    existingOffers,
    userRole,
    userDepartment,
    materialSuppliers,
    materialOrders,
    shipmentData,
    currentOrder,
    loading,
    error,
    refreshData,
    supabase
  }
}
