'use client'

import { useState, useEffect } from 'react'
import { createClientComponentClient } from '@supabase/auth-helpers-nextjs'
import { Database } from '@/lib/types'
import { PurchaseRequest, MaterialSupplier, OrderInfo, ShipmentInfo } from '../types'

export function useOfferData(requestId: string) {
  const [request, setRequest] = useState<PurchaseRequest | null>(null)
  const [existingOffers, setExistingOffers] = useState<any[]>([])
  const [userRole, setUserRole] = useState<string>('user')
  const [materialSuppliers, setMaterialSuppliers] = useState<{[itemId: string]: MaterialSupplier}>({})
  const [materialOrders, setMaterialOrders] = useState<any[]>([])
  const [shipmentData, setShipmentData] = useState<{[key: string]: ShipmentInfo}>({})
  const [currentOrder, setCurrentOrder] = useState<any>(null)
  const [loading, setLoading] = useState(true)

  const supabase = createClientComponentClient<Database>()

  const fetchUserRole = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser()
      if (user) {
        const { data: profile } = await supabase
          .from('profiles')
          .select('role')
          .eq('id', user.id)
          .single()
        
        if (profile?.role) {
          setUserRole(profile.role)
          console.log('👤 User role:', profile.role)
        }
      }
    } catch (error) {
      console.error('Error fetching user role:', error)
    }
  }

  const fetchRequestData = async () => {
    try {
      setLoading(true)
      console.log('🔍 Fetching request with ID:', requestId)
      
      const { data, error } = await supabase
        .from('purchase_requests')
        .select('*')
        .eq('id', requestId)
        .single()
      
      if (!error && data) {
        const { data: items, error: itemsError } = await supabase
          .from('purchase_request_items')
          .select('id, item_name, description, quantity, unit, specifications, brand, original_quantity, image_urls')
          .eq('purchase_request_id', requestId)
        
        // DEBUG: original_quantity değerlerini kontrol et
        console.log('🔍 Database\'den gelen purchase_request_items:', items?.map(item => ({
          id: item.id,
          item_name: item.item_name,
          quantity: item.quantity,
          original_quantity: item.original_quantity,
          original_quantity_type: typeof item.original_quantity,
          original_quantity_is_null: item.original_quantity === null,
          original_quantity_is_undefined: item.original_quantity === undefined
        })))
        
        if (!itemsError && items) {
          data.purchase_request_items = items
        } else {
          data.purchase_request_items = []
        }

        if (data.requested_by) {
          const { data: profileData, error: profileError } = await supabase
            .from('profiles')
            .select('full_name, email')
            .eq('id', data.requested_by)
            .single()

          if (!profileError && profileData) {
            data.profiles = profileData
          } else {
            data.profiles = { full_name: 'Bilinmiyor', email: '' }
          }
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
        console.error('❌ Supabase error:', error)
        throw error
      }
      
      console.log('✅ Request data loaded successfully:', data)
      setRequest(data)
    } catch (error) {
      console.error('💥 Error fetching request:', error)
    } finally {
      setLoading(false)
    }
  }

  const fetchExistingOffers = async () => {
    try {
      console.log('📥 Fetching existing offers for request:', requestId)
      const { data, error } = await supabase
        .from('offers')
        .select('*')
        .eq('purchase_request_id', requestId)
        .order('created_at', { ascending: false })

      if (error) throw error
      
      console.log('📋 Fetched offers:', data?.length || 0)
      setExistingOffers(data || [])
    } catch (error) {
      console.error('Error fetching offers:', error)
    }
  }

  const fetchMaterialSuppliers = async () => {
    try {
      console.log('🔍 Malzeme bazlı tedarikçi kontrolü başlatılıyor...')
      
      const { data: requestData, error: requestError } = await supabase
        .from('purchase_requests')
        .select('purchase_request_items(id, item_name)')
        .eq('id', requestId)
        .single()

      if (requestError) {
        console.error('❌ Purchase request data alınamadı:', requestError)
        throw requestError
      }

      if (requestData?.purchase_request_items && requestData.purchase_request_items.length > 0) {
        const materialSuppliersData: {[itemId: string]: MaterialSupplier} = {}

        for (const item of requestData.purchase_request_items) {
          console.log(`🔍 ${item.item_name} için tedarikçi kontrolü...`)
          
          try {
            const { data: supplierMaterialsNew, error: materialsErrorNew } = await supabase
              .from('supplier_materials')
              .select(`
                id,
                supplier_id,
                material_item
              `)
              .eq('material_item', item.item_name)

            if (!materialsErrorNew && supplierMaterialsNew && supplierMaterialsNew.length > 0) {
              console.log(`✅ ${item.item_name} için tedarikçi bulundu:`, supplierMaterialsNew.length)
              
              const supplierIds = supplierMaterialsNew.map(sm => sm.supplier_id)
              const { data: suppliers, error: suppliersError } = await supabase
                .from('suppliers')
                .select('id, name, contact_person, phone, email')
                .in('id', supplierIds)

              if (!suppliersError && suppliers) {
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
            } else {
              console.log(`ℹ️ ${item.item_name} için kayıtlı tedarikçi bulunamadı`)
              materialSuppliersData[item.id] = {
                isRegistered: false,
                suppliers: []
              }
            }
          } catch (itemError) {
            console.error(`❌ ${item.item_name} için tedarikçi kontrolü hatası:`, itemError)
            materialSuppliersData[item.id] = {
              isRegistered: false,
              suppliers: []
            }
          }
        }

        console.log('📊 Toplam malzeme tedarikçi verisi:', materialSuppliersData)
        setMaterialSuppliers(materialSuppliersData)
      }
    } catch (error: any) {
      console.error('❌ Malzeme tedarikçi kontrolü hatası:', error)
    }
  }

  const fetchMaterialOrders = async () => {
    try {
      console.log('🔍 Malzeme sipariş bilgileri alınıyor...')
      
      const { data: orders, error } = await supabase
        .from('orders')
        .select(`
          id,
          delivery_date,
          created_at,
          material_item_id,
          quantity,
          is_delivered,
          delivery_confirmed_at,
          delivery_confirmed_by,
          supplier_id,
          supplier:suppliers(
            id,
            name
          )
        `)
        .eq('purchase_request_id', requestId)
        .order('created_at', { ascending: true })
      

      if (error) {
        console.error('❌ Sipariş bilgileri alınamadı:', error)
        return
      }

      console.log('📦 Sipariş bilgileri:', orders)

      if (orders && orders.length > 0) {
        // Array olarak döndür, quantity field'ı dahil et
        const ordersArray = orders.map((order: any) => {
          return {
            id: order.id,
            delivery_date: order.delivery_date,
            created_at: order.created_at,
            material_item_id: order.material_item_id,
            quantity: order.quantity || 0,
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
            } : null
          }
        })

        setMaterialOrders(ordersArray)
        console.log('✅ Sipariş bilgileri state\'e kaydedildi (array):', ordersArray)
      } else {
        setMaterialOrders([])
        console.log('ℹ️ Bu talep için sipariş bulunamadı')
      }
    } catch (error) {
      console.error('❌ Sipariş bilgileri alınırken hata:', error)
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

      console.log('📦 Final grouped shipments:', groupedShipments)
      setShipmentData(groupedShipments)
      
    } catch (error) {
      console.error('Error fetching shipment data:', error)
      setShipmentData({})
    }
  }

  const fetchOrderDetails = async () => {
    try {
      setLoading(true)
      console.log('🔍 Sipariş detayları alınıyor...', requestId)

      const { data: order, error } = await supabase
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
        .maybeSingle()

      console.log('📦 Sorgu sonucu:', { order, error })

      if (error) {
        console.error('❌ Sipariş detayları alınamadı:', error)
        return
      }

      if (order) {
        console.log('✅ Sipariş bulundu:', {
          id: order.id,
          supplier: order.supplier,
          delivery_date: order.delivery_date
        })

        setCurrentOrder(order)
      } else {
        console.log('ℹ️ Bu talep için sipariş bulunamadı')
        setCurrentOrder(null)
      }
    } catch (error) {
      console.error('❌ Sipariş detayları alınırken hata:', error)
    }
  }

  const refreshData = async () => {
    await Promise.all([
      fetchRequestData(),
      fetchExistingOffers(),
      fetchMaterialSuppliers(),
      fetchMaterialOrders(),
      fetchShipmentData(),
      fetchOrderDetails()
    ])
  }

  useEffect(() => {
    if (requestId) {
      fetchUserRole()
      refreshData()
    }
  }, [requestId])

  return {
    request,
    existingOffers,
    userRole,
    materialSuppliers,
    materialOrders,
    shipmentData,
    currentOrder,
    loading,
    refreshData,
    supabase
  }
}
