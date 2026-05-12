export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "13.0.4"
  }
  public: {
    Tables: {
      all_materials: {
        Row: {
          class: string | null
          class_code: string | null
          created_at: string
          group: string | null
          group_code: string | null
          id: number
          item_code: string | null
          item_name: string | null
        }
        Insert: {
          class?: string | null
          class_code?: string | null
          created_at?: string
          group?: string | null
          group_code?: string | null
          id?: number
          item_code?: string | null
          item_name?: string | null
        }
        Update: {
          class?: string | null
          class_code?: string | null
          created_at?: string
          group?: string | null
          group_code?: string | null
          id?: number
          item_code?: string | null
          item_name?: string | null
        }
        Relationships: []
      }
      approval_history: {
        Row: {
          action: string
          comments: string | null
          created_at: string | null
          id: string
          performed_by: string
          purchase_request_id: string
        }
        Insert: {
          action: string
          comments?: string | null
          created_at?: string | null
          id?: string
          performed_by: string
          purchase_request_id: string
        }
        Update: {
          action?: string
          comments?: string | null
          created_at?: string | null
          id?: string
          performed_by?: string
          purchase_request_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "approval_history_performed_by_fkey"
            columns: ["performed_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "approval_history_purchase_request_id_fkey"
            columns: ["purchase_request_id"]
            isOneToOne: false
            referencedRelation: "purchase_requests"
            referencedColumns: ["id"]
          },
        ]
      }
      audit_log: {
        Row: {
          action_type: string
          comments: string | null
          created_at: string | null
          description: string
          id: string
          ip_address: unknown
          is_automatic: boolean | null
          metadata: Json | null
          new_status: string | null
          performed_at: string | null
          performed_by: string | null
          previous_status: string | null
          purchase_request_id: string
          related_item_id: string | null
          related_item_type: string | null
          session_id: string | null
          trigger_source: string | null
          user_agent: string | null
          user_name: string | null
          user_role: string
        }
        Insert: {
          action_type: string
          comments?: string | null
          created_at?: string | null
          description: string
          id?: string
          ip_address?: unknown
          is_automatic?: boolean | null
          metadata?: Json | null
          new_status?: string | null
          performed_at?: string | null
          performed_by?: string | null
          previous_status?: string | null
          purchase_request_id: string
          related_item_id?: string | null
          related_item_type?: string | null
          session_id?: string | null
          trigger_source?: string | null
          user_agent?: string | null
          user_name?: string | null
          user_role: string
        }
        Update: {
          action_type?: string
          comments?: string | null
          created_at?: string | null
          description?: string
          id?: string
          ip_address?: unknown
          is_automatic?: boolean | null
          metadata?: Json | null
          new_status?: string | null
          performed_at?: string | null
          performed_by?: string | null
          previous_status?: string | null
          purchase_request_id?: string
          related_item_id?: string | null
          related_item_type?: string | null
          session_id?: string | null
          trigger_source?: string | null
          user_agent?: string | null
          user_name?: string | null
          user_role?: string
        }
        Relationships: [
          {
            foreignKeyName: "audit_log_purchase_request_id_fkey"
            columns: ["purchase_request_id"]
            isOneToOne: false
            referencedRelation: "purchase_requests"
            referencedColumns: ["id"]
          },
        ]
      }
      bilgisayar: {
        Row: {
          created_at: string
          id: number
          item_name: string | null
          quntity: string | null
          sahip: string | null
          serie_no: string | null
          user: string | null
        }
        Insert: {
          created_at?: string
          id?: number
          item_name?: string | null
          quntity?: string | null
          sahip?: string | null
          serie_no?: string | null
          user?: string | null
        }
        Update: {
          created_at?: string
          id?: number
          item_name?: string | null
          quntity?: string | null
          sahip?: string | null
          serie_no?: string | null
          user?: string | null
        }
        Relationships: []
      }
      brands: {
        Row: {
          created_at: string | null
          description: string | null
          id: string
          is_active: boolean | null
          logo_url: string | null
          name: string | null
          updated_at: string | null
          website: string | null
        }
        Insert: {
          created_at?: string | null
          description?: string | null
          id?: string
          is_active?: boolean | null
          logo_url?: string | null
          name?: string | null
          updated_at?: string | null
          website?: string | null
        }
        Update: {
          created_at?: string | null
          description?: string | null
          id?: string
          is_active?: boolean | null
          logo_url?: string | null
          name?: string | null
          updated_at?: string | null
          website?: string | null
        }
        Relationships: []
      }
      employees: {
        Row: {
          access_type: string | null
          birth_date: string | null
          contract_end_date: string | null
          contract_type: string | null
          created_at: string | null
          department: string | null
          department_id: string | null
          disability_degree: string | null
          education_institution: string | null
          education_level: string | null
          education_status: string | null
          employee_number: string | null
          employment_status: string | null
          first_name: string | null
          gender: string | null
          id: string
          manager_id: string | null
          military_status: string | null
          national_id: string | null
          nationality: string | null
          personal_email: string | null
          personal_phone: string | null
          position: string | null
          salary: string | null
          start_date: string | null
          updated_at: string | null
          work_email: string | null
          work_phone: string | null
          work_schedule: string | null
        }
        Insert: {
          access_type?: string | null
          birth_date?: string | null
          contract_end_date?: string | null
          contract_type?: string | null
          created_at?: string | null
          department?: string | null
          department_id?: string | null
          disability_degree?: string | null
          education_institution?: string | null
          education_level?: string | null
          education_status?: string | null
          employee_number?: string | null
          employment_status?: string | null
          first_name?: string | null
          gender?: string | null
          id?: string
          manager_id?: string | null
          military_status?: string | null
          national_id?: string | null
          nationality?: string | null
          personal_email?: string | null
          personal_phone?: string | null
          position?: string | null
          salary?: string | null
          start_date?: string | null
          updated_at?: string | null
          work_email?: string | null
          work_phone?: string | null
          work_schedule?: string | null
        }
        Update: {
          access_type?: string | null
          birth_date?: string | null
          contract_end_date?: string | null
          contract_type?: string | null
          created_at?: string | null
          department?: string | null
          department_id?: string | null
          disability_degree?: string | null
          education_institution?: string | null
          education_level?: string | null
          education_status?: string | null
          employee_number?: string | null
          employment_status?: string | null
          first_name?: string | null
          gender?: string | null
          id?: string
          manager_id?: string | null
          military_status?: string | null
          national_id?: string | null
          nationality?: string | null
          personal_email?: string | null
          personal_phone?: string | null
          position?: string | null
          salary?: string | null
          start_date?: string | null
          updated_at?: string | null
          work_email?: string | null
          work_phone?: string | null
          work_schedule?: string | null
        }
        Relationships: []
      }
      envanter: {
        Row: {
          birim: string | null
          created_at: string
          id: number
          miktar: string | null
          name: string | null
          plasiyer: string | null
          serie: string | null
          stok_kodu: string | null
        }
        Insert: {
          birim?: string | null
          created_at?: string
          id?: number
          miktar?: string | null
          name?: string | null
          plasiyer?: string | null
          serie?: string | null
          stok_kodu?: string | null
        }
        Update: {
          birim?: string | null
          created_at?: string
          id?: number
          miktar?: string | null
          name?: string | null
          plasiyer?: string | null
          serie?: string | null
          stok_kodu?: string | null
        }
        Relationships: []
      }
      invoice_groups: {
        Row: {
          created_at: string
          created_by: string | null
          currency: string
          discount: number | null
          grand_total: number
          group_name: string | null
          id: string
          invoice_photos: string[] | null
          notes: string | null
          subtotal: number
          tax: number | null
          updated_at: string | null
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          currency?: string
          discount?: number | null
          grand_total: number
          group_name?: string | null
          id?: string
          invoice_photos?: string[] | null
          notes?: string | null
          subtotal: number
          tax?: number | null
          updated_at?: string | null
        }
        Update: {
          created_at?: string
          created_by?: string | null
          currency?: string
          discount?: number | null
          grand_total?: number
          group_name?: string | null
          id?: string
          invoice_photos?: string[] | null
          notes?: string | null
          subtotal?: number
          tax?: number | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "invoice_groups_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      invoices: {
        Row: {
          amount: number
          created_at: string | null
          currency: string | null
          discount: number | null
          grand_total: number | null
          id: string
          invoice_group_id: string | null
          invoice_photos: string[] | null
          is_master: boolean | null
          notes: string | null
          order_id: string
          parent_invoice_id: string | null
          subtotal: number | null
          tax: number | null
          updated_at: string | null
        }
        Insert: {
          amount: number
          created_at?: string | null
          currency?: string | null
          discount?: number | null
          grand_total?: number | null
          id?: string
          invoice_group_id?: string | null
          invoice_photos?: string[] | null
          is_master?: boolean | null
          notes?: string | null
          order_id: string
          parent_invoice_id?: string | null
          subtotal?: number | null
          tax?: number | null
          updated_at?: string | null
        }
        Update: {
          amount?: number
          created_at?: string | null
          currency?: string | null
          discount?: number | null
          grand_total?: number | null
          id?: string
          invoice_group_id?: string | null
          invoice_photos?: string[] | null
          is_master?: boolean | null
          notes?: string | null
          order_id?: string
          parent_invoice_id?: string | null
          subtotal?: number | null
          tax?: number | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "invoices_invoice_group_id_fkey"
            columns: ["invoice_group_id"]
            isOneToOne: false
            referencedRelation: "invoice_groups"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "invoices_invoice_group_id_fkey"
            columns: ["invoice_group_id"]
            isOneToOne: false
            referencedRelation: "invoice_groups_with_orders"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "invoices_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "material_delivery_status"
            referencedColumns: ["order_id"]
          },
          {
            foreignKeyName: "invoices_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "order_delivery_summary"
            referencedColumns: ["order_id"]
          },
          {
            foreignKeyName: "invoices_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "orders"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "invoices_parent_invoice_id_fkey"
            columns: ["parent_invoice_id"]
            isOneToOne: false
            referencedRelation: "invoices"
            referencedColumns: ["id"]
          },
        ]
      }
      material_categories: {
        Row: {
          category_type: string
          color: string | null
          created_at: string | null
          description: string | null
          display_name: string
          display_order: number | null
          icon: string | null
          id: number
          is_active: boolean | null
          name: string
          updated_at: string | null
        }
        Insert: {
          category_type: string
          color?: string | null
          created_at?: string | null
          description?: string | null
          display_name: string
          display_order?: number | null
          icon?: string | null
          id?: number
          is_active?: boolean | null
          name: string
          updated_at?: string | null
        }
        Update: {
          category_type?: string
          color?: string | null
          created_at?: string | null
          description?: string | null
          display_name?: string
          display_order?: number | null
          icon?: string | null
          id?: number
          is_active?: boolean | null
          name?: string
          updated_at?: string | null
        }
        Relationships: []
      }
      material_movements: {
        Row: {
          audit_log_id: string | null
          created_at: string | null
          document_urls: string[] | null
          from_location: string | null
          id: string
          material_item_id: string | null
          movement_type: string
          notes: string | null
          performed_at: string | null
          performed_by: string
          purchase_request_id: string
          quantity: number
          site_id: string | null
          to_location: string | null
          unit: string | null
        }
        Insert: {
          audit_log_id?: string | null
          created_at?: string | null
          document_urls?: string[] | null
          from_location?: string | null
          id?: string
          material_item_id?: string | null
          movement_type: string
          notes?: string | null
          performed_at?: string | null
          performed_by: string
          purchase_request_id: string
          quantity: number
          site_id?: string | null
          to_location?: string | null
          unit?: string | null
        }
        Update: {
          audit_log_id?: string | null
          created_at?: string | null
          document_urls?: string[] | null
          from_location?: string | null
          id?: string
          material_item_id?: string | null
          movement_type?: string
          notes?: string | null
          performed_at?: string | null
          performed_by?: string
          purchase_request_id?: string
          quantity?: number
          site_id?: string | null
          to_location?: string | null
          unit?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "material_movements_audit_log_id_fkey"
            columns: ["audit_log_id"]
            isOneToOne: false
            referencedRelation: "audit_log"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "material_movements_audit_log_id_fkey"
            columns: ["audit_log_id"]
            isOneToOne: false
            referencedRelation: "audit_log_view"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "material_movements_material_item_id_fkey"
            columns: ["material_item_id"]
            isOneToOne: false
            referencedRelation: "purchase_request_items"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "material_movements_purchase_request_id_fkey"
            columns: ["purchase_request_id"]
            isOneToOne: false
            referencedRelation: "purchase_requests"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "material_movements_site_id_fkey"
            columns: ["site_id"]
            isOneToOne: false
            referencedRelation: "sites"
            referencedColumns: ["id"]
          },
        ]
      }
      offers: {
        Row: {
          created_at: string | null
          currency: string | null
          delivery_date: string | null
          delivery_days: number | null
          document_urls: string[] | null
          id: string
          is_selected: boolean | null
          notes: string | null
          offer_date: string | null
          purchase_request_id: string
          site_id: string | null
          site_name: string | null
          supplier_id: string | null
          supplier_name: string
          total_price: number
          unit_price: number
          updated_at: string | null
        }
        Insert: {
          created_at?: string | null
          currency?: string | null
          delivery_date?: string | null
          delivery_days?: number | null
          document_urls?: string[] | null
          id?: string
          is_selected?: boolean | null
          notes?: string | null
          offer_date?: string | null
          purchase_request_id: string
          site_id?: string | null
          site_name?: string | null
          supplier_id?: string | null
          supplier_name: string
          total_price: number
          unit_price: number
          updated_at?: string | null
        }
        Update: {
          created_at?: string | null
          currency?: string | null
          delivery_date?: string | null
          delivery_days?: number | null
          document_urls?: string[] | null
          id?: string
          is_selected?: boolean | null
          notes?: string | null
          offer_date?: string | null
          purchase_request_id?: string
          site_id?: string | null
          site_name?: string | null
          supplier_id?: string | null
          supplier_name?: string
          total_price?: number
          unit_price?: number
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "fk_offers_site_id"
            columns: ["site_id"]
            isOneToOne: false
            referencedRelation: "sites"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "offers_purchase_request_id_fkey"
            columns: ["purchase_request_id"]
            isOneToOne: false
            referencedRelation: "purchase_requests"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "offers_supplier_id_fkey"
            columns: ["supplier_id"]
            isOneToOne: false
            referencedRelation: "suppliers"
            referencedColumns: ["id"]
          },
        ]
      }
      order_deliveries: {
        Row: {
          created_at: string | null
          damage_notes: string | null
          delivered_at: string
          delivered_quantity: number
          delivery_notes: string | null
          delivery_photos: string[] | null
          id: string
          order_id: string
          quality_check: boolean | null
          received_by: string
          updated_at: string | null
        }
        Insert: {
          created_at?: string | null
          damage_notes?: string | null
          delivered_at?: string
          delivered_quantity: number
          delivery_notes?: string | null
          delivery_photos?: string[] | null
          id?: string
          order_id: string
          quality_check?: boolean | null
          received_by: string
          updated_at?: string | null
        }
        Update: {
          created_at?: string | null
          damage_notes?: string | null
          delivered_at?: string
          delivered_quantity?: number
          delivery_notes?: string | null
          delivery_photos?: string[] | null
          id?: string
          order_id?: string
          quality_check?: boolean | null
          received_by?: string
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "order_deliveries_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "material_delivery_status"
            referencedColumns: ["order_id"]
          },
          {
            foreignKeyName: "order_deliveries_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "order_delivery_summary"
            referencedColumns: ["order_id"]
          },
          {
            foreignKeyName: "order_deliveries_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "orders"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "order_deliveries_received_by_fkey"
            columns: ["received_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      orders: {
        Row: {
          amount: number
          created_at: string
          currency: string
          delivered_at: string | null
          delivered_quantity: number | null
          delivery_confirmed_at: string | null
          delivery_confirmed_by: string | null
          delivery_date: string
          delivery_image_urls: string[] | null
          delivery_notes: string | null
          delivery_receipt_photos: string[] | null
          document_urls: string[] | null
          id: string
          is_delivered: boolean | null
          is_return_reorder: boolean | null
          material_item_id: string | null
          purchase_request_id: string
          quantity: number | null
          received_by: string | null
          reorder_requested: boolean | null
          return_notes: string | null
          returned_quantity: number | null
          status: string | null
          supplier_id: string
          updated_at: string
          user_id: string | null
        }
        Insert: {
          amount: number
          created_at?: string
          currency: string
          delivered_at?: string | null
          delivered_quantity?: number | null
          delivery_confirmed_at?: string | null
          delivery_confirmed_by?: string | null
          delivery_date: string
          delivery_image_urls?: string[] | null
          delivery_notes?: string | null
          delivery_receipt_photos?: string[] | null
          document_urls?: string[] | null
          id?: string
          is_delivered?: boolean | null
          is_return_reorder?: boolean | null
          material_item_id?: string | null
          purchase_request_id: string
          quantity?: number | null
          received_by?: string | null
          reorder_requested?: boolean | null
          return_notes?: string | null
          returned_quantity?: number | null
          status?: string | null
          supplier_id: string
          updated_at?: string
          user_id?: string | null
        }
        Update: {
          amount?: number
          created_at?: string
          currency?: string
          delivered_at?: string | null
          delivered_quantity?: number | null
          delivery_confirmed_at?: string | null
          delivery_confirmed_by?: string | null
          delivery_date?: string
          delivery_image_urls?: string[] | null
          delivery_notes?: string | null
          delivery_receipt_photos?: string[] | null
          document_urls?: string[] | null
          id?: string
          is_delivered?: boolean | null
          is_return_reorder?: boolean | null
          material_item_id?: string | null
          purchase_request_id?: string
          quantity?: number | null
          received_by?: string | null
          reorder_requested?: boolean | null
          return_notes?: string | null
          returned_quantity?: number | null
          status?: string | null
          supplier_id?: string
          updated_at?: string
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "fk_orders_material_item_id"
            columns: ["material_item_id"]
            isOneToOne: false
            referencedRelation: "purchase_request_items"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "orders_delivery_confirmed_by_fkey"
            columns: ["delivery_confirmed_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "orders_purchase_request_id_fkey"
            columns: ["purchase_request_id"]
            isOneToOne: false
            referencedRelation: "purchase_requests"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "orders_received_by_fkey"
            columns: ["received_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "orders_supplier_id_fkey"
            columns: ["supplier_id"]
            isOneToOne: false
            referencedRelation: "suppliers"
            referencedColumns: ["id"]
          },
        ]
      }
      pending_user_inventory: {
        Row: {
          created_at: string | null
          id: string
          item_name: string
          notes: string | null
          owner_email: string
          owner_name: string
          product_id: string | null
          quantity: number | null
          serial_number: string | null
          unit: string | null
          user_email: string | null
          user_name: string | null
        }
        Insert: {
          created_at?: string | null
          id?: string
          item_name: string
          notes?: string | null
          owner_email: string
          owner_name: string
          product_id?: string | null
          quantity?: number | null
          serial_number?: string | null
          unit?: string | null
          user_email?: string | null
          user_name?: string | null
        }
        Update: {
          created_at?: string | null
          id?: string
          item_name?: string
          notes?: string | null
          owner_email?: string
          owner_name?: string
          product_id?: string | null
          quantity?: number | null
          serial_number?: string | null
          unit?: string | null
          user_email?: string | null
          user_name?: string | null
        }
        Relationships: []
      }
      product: {
        Row: {
          category_id: string | null
          created_at: string
          id: string | null
        }
        Insert: {
          category_id?: string | null
          created_at?: string
          id?: string | null
        }
        Update: {
          category_id?: string | null
          created_at?: string
          id?: string | null
        }
        Relationships: []
      }
      product_categories: {
        Row: {
          created_at: string | null
          description: string | null
          id: string
          is_active: boolean | null
          name: string
          parent_id: string | null
          updated_at: string | null
        }
        Insert: {
          created_at?: string | null
          description?: string | null
          id: string
          is_active?: boolean | null
          name: string
          parent_id?: string | null
          updated_at?: string | null
        }
        Update: {
          created_at?: string | null
          description?: string | null
          id?: string
          is_active?: boolean | null
          name?: string
          parent_id?: string | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "product_categories_parent_id_fkey"
            columns: ["parent_id"]
            isOneToOne: false
            referencedRelation: "product_categories"
            referencedColumns: ["id"]
          },
        ]
      }
      products: {
        Row: {
          brand_id: string | null
          category: string | null
          category_id: string | null
          created_at: string | null
          currency: string | null
          deleted_at: string | null
          deleted_by: string | null
          description: string | null
          has_serial: boolean | null
          id: string
          images: Json | null
          is_active: boolean | null
          name: string | null
          product_type: string | null
          sku: string | null
          unit: string | null
          unit_price: string | null
          updated_at: string | null
        }
        Insert: {
          brand_id?: string | null
          category?: string | null
          category_id?: string | null
          created_at?: string | null
          currency?: string | null
          deleted_at?: string | null
          deleted_by?: string | null
          description?: string | null
          has_serial?: boolean | null
          id?: string
          images?: Json | null
          is_active?: boolean | null
          name?: string | null
          product_type?: string | null
          sku?: string | null
          unit?: string | null
          unit_price?: string | null
          updated_at?: string | null
        }
        Update: {
          brand_id?: string | null
          category?: string | null
          category_id?: string | null
          created_at?: string | null
          currency?: string | null
          deleted_at?: string | null
          deleted_by?: string | null
          description?: string | null
          has_serial?: boolean | null
          id?: string
          images?: Json | null
          is_active?: boolean | null
          name?: string | null
          product_type?: string | null
          sku?: string | null
          unit?: string | null
          unit_price?: string | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "fk_products_brand_id"
            columns: ["brand_id"]
            isOneToOne: false
            referencedRelation: "brands"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "products_category_id_fkey"
            columns: ["category_id"]
            isOneToOne: false
            referencedRelation: "product_categories"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          construction_site_id: string | null
          created_at: string | null
          deleted_at: string | null
          department: string | null
          email: string
          full_name: string | null
          id: string
          is_active: boolean | null
          original_role: Database["public"]["Enums"]["user_role_enum"] | null
          role: Database["public"]["Enums"]["user_role_enum"] | null
          role_old: string | null
          site_id: string[] | null
          temporary_role_assigned_by: string | null
          temporary_role_end_date: string | null
          temporary_role_start_date: string | null
          updated_at: string | null
        }
        Insert: {
          construction_site_id?: string | null
          created_at?: string | null
          deleted_at?: string | null
          department?: string | null
          email: string
          full_name?: string | null
          id: string
          is_active?: boolean | null
          original_role?: Database["public"]["Enums"]["user_role_enum"] | null
          role?: Database["public"]["Enums"]["user_role_enum"] | null
          role_old?: string | null
          site_id?: string[] | null
          temporary_role_assigned_by?: string | null
          temporary_role_end_date?: string | null
          temporary_role_start_date?: string | null
          updated_at?: string | null
        }
        Update: {
          construction_site_id?: string | null
          created_at?: string | null
          deleted_at?: string | null
          department?: string | null
          email?: string
          full_name?: string | null
          id?: string
          is_active?: boolean | null
          original_role?: Database["public"]["Enums"]["user_role_enum"] | null
          role?: Database["public"]["Enums"]["user_role_enum"] | null
          role_old?: string | null
          site_id?: string[] | null
          temporary_role_assigned_by?: string | null
          temporary_role_end_date?: string | null
          temporary_role_start_date?: string | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "profiles_construction_site_id_fkey"
            columns: ["construction_site_id"]
            isOneToOne: false
            referencedRelation: "sites"
            referencedColumns: ["id"]
          },
        ]
      }
      purchase_request_items: {
        Row: {
          brand: string | null
          created_at: string | null
          delivery_date: string | null
          description: string | null
          id: string
          image_urls: string[] | null
          item_name: string
          material_class: string | null
          material_class_code: string | null
          material_group: string | null
          material_group_code: string | null
          material_item_code: string | null
          material_item_id: string | null
          material_item_name: string | null
          original_quantity: number | null
          product_id: string | null
          purchase_request_id: string
          purpose: string
          quantity: number
          sent_quantity: number | null
          specifications: string | null
          total_price: number | null
          unit: string
          unit_price: number
          updated_at: string | null
        }
        Insert: {
          brand?: string | null
          created_at?: string | null
          delivery_date?: string | null
          description?: string | null
          id?: string
          image_urls?: string[] | null
          item_name: string
          material_class?: string | null
          material_class_code?: string | null
          material_group?: string | null
          material_group_code?: string | null
          material_item_code?: string | null
          material_item_id?: string | null
          material_item_name?: string | null
          original_quantity?: number | null
          product_id?: string | null
          purchase_request_id: string
          purpose: string
          quantity: number
          sent_quantity?: number | null
          specifications?: string | null
          total_price?: number | null
          unit: string
          unit_price: number
          updated_at?: string | null
        }
        Update: {
          brand?: string | null
          created_at?: string | null
          delivery_date?: string | null
          description?: string | null
          id?: string
          image_urls?: string[] | null
          item_name?: string
          material_class?: string | null
          material_class_code?: string | null
          material_group?: string | null
          material_group_code?: string | null
          material_item_code?: string | null
          material_item_id?: string | null
          material_item_name?: string | null
          original_quantity?: number | null
          product_id?: string | null
          purchase_request_id?: string
          purpose?: string
          quantity?: number
          sent_quantity?: number | null
          specifications?: string | null
          total_price?: number | null
          unit?: string
          unit_price?: number
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "purchase_request_items_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "purchase_request_items_purchase_request_id_fkey"
            columns: ["purchase_request_id"]
            isOneToOne: false
            referencedRelation: "purchase_requests"
            referencedColumns: ["id"]
          },
        ]
      }
      purchase_requests: {
        Row: {
          approved_at: string | null
          approved_by: string | null
          approved_by_site_manager: string | null
          assigned_to_purchasing: string | null
          category_id: string | null
          category_name: string | null
          created_at: string | null
          currency: string | null
          delivery_date: string | null
          department: string
          description: string | null
          id: string
          image_urls: string[] | null
          material_class: string | null
          material_group: string | null
          material_item_name: string | null
          notes: string | null
          notifications:
            | Database["public"]["Enums"]["notification_type"][]
            | null
          original_request_id: string | null
          purchasing_assignment_date: string | null
          rejection_reason: string | null
          request_number: string
          requested_by: string
          return_order_id: string | null
          sent_quantity: number | null
          site_id: string | null
          site_manager_approval_date: string | null
          site_manager_approval_notes: string | null
          site_name: string | null
          specifications: string | null
          status: string | null
          subcategory_id: string | null
          subcategory_name: string | null
          supplier_id: string | null
          title: string
          total_amount: number
          updated_at: string | null
          urgency_level: string | null
          visibility_level: string | null
          workflow_status: string | null
          it_workflow_applies: boolean
        }
        Insert: {
          approved_at?: string | null
          approved_by?: string | null
          approved_by_site_manager?: string | null
          assigned_to_purchasing?: string | null
          category_id?: string | null
          category_name?: string | null
          created_at?: string | null
          currency?: string | null
          delivery_date?: string | null
          department: string
          description?: string | null
          id?: string
          image_urls?: string[] | null
          material_class?: string | null
          material_group?: string | null
          material_item_name?: string | null
          notes?: string | null
          notifications?:
            | Database["public"]["Enums"]["notification_type"][]
            | null
          original_request_id?: string | null
          purchasing_assignment_date?: string | null
          rejection_reason?: string | null
          request_number: string
          requested_by: string
          return_order_id?: string | null
          sent_quantity?: number | null
          site_id?: string | null
          site_manager_approval_date?: string | null
          site_manager_approval_notes?: string | null
          site_name?: string | null
          specifications?: string | null
          status?: string | null
          subcategory_id?: string | null
          subcategory_name?: string | null
          supplier_id?: string | null
          title: string
          total_amount: number
          updated_at?: string | null
          urgency_level?: string | null
          visibility_level?: string | null
          workflow_status?: string | null
          it_workflow_applies?: boolean
        }
        Update: {
          approved_at?: string | null
          approved_by?: string | null
          approved_by_site_manager?: string | null
          assigned_to_purchasing?: string | null
          category_id?: string | null
          category_name?: string | null
          created_at?: string | null
          currency?: string | null
          delivery_date?: string | null
          department?: string
          description?: string | null
          id?: string
          image_urls?: string[] | null
          material_class?: string | null
          material_group?: string | null
          material_item_name?: string | null
          notes?: string | null
          notifications?:
            | Database["public"]["Enums"]["notification_type"][]
            | null
          original_request_id?: string | null
          purchasing_assignment_date?: string | null
          rejection_reason?: string | null
          request_number?: string
          requested_by?: string
          return_order_id?: string | null
          sent_quantity?: number | null
          site_id?: string | null
          site_manager_approval_date?: string | null
          site_manager_approval_notes?: string | null
          site_name?: string | null
          specifications?: string | null
          status?: string | null
          subcategory_id?: string | null
          subcategory_name?: string | null
          supplier_id?: string | null
          title?: string
          total_amount?: number
          updated_at?: string | null
          urgency_level?: string | null
          visibility_level?: string | null
          workflow_status?: string | null
          it_workflow_applies?: boolean
        }
        Relationships: [
          {
            foreignKeyName: "purchase_requests_approved_by_fkey"
            columns: ["approved_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "purchase_requests_original_request_id_fkey"
            columns: ["original_request_id"]
            isOneToOne: false
            referencedRelation: "purchase_requests"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "purchase_requests_requested_by_fkey"
            columns: ["requested_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "purchase_requests_return_order_id_fkey"
            columns: ["return_order_id"]
            isOneToOne: false
            referencedRelation: "material_delivery_status"
            referencedColumns: ["order_id"]
          },
          {
            foreignKeyName: "purchase_requests_return_order_id_fkey"
            columns: ["return_order_id"]
            isOneToOne: false
            referencedRelation: "order_delivery_summary"
            referencedColumns: ["order_id"]
          },
          {
            foreignKeyName: "purchase_requests_return_order_id_fkey"
            columns: ["return_order_id"]
            isOneToOne: false
            referencedRelation: "orders"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "purchase_requests_site_id_fkey"
            columns: ["site_id"]
            isOneToOne: false
            referencedRelation: "sites"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "purchase_requests_supplier_id_fkey"
            columns: ["supplier_id"]
            isOneToOne: false
            referencedRelation: "suppliers"
            referencedColumns: ["id"]
          },
        ]
      }
      security_audit_log: {
        Row: {
          attempted_action: string | null
          created_at: string
          error_message: string | null
          event_type: string
          id: string
          ip_address: unknown
          success: boolean | null
          target_user_id: string | null
          user_agent: string | null
          user_id: string | null
        }
        Insert: {
          attempted_action?: string | null
          created_at?: string
          error_message?: string | null
          event_type: string
          id?: string
          ip_address?: unknown
          success?: boolean | null
          target_user_id?: string | null
          user_agent?: string | null
          user_id?: string | null
        }
        Update: {
          attempted_action?: string | null
          created_at?: string
          error_message?: string | null
          event_type?: string
          id?: string
          ip_address?: unknown
          success?: boolean | null
          target_user_id?: string | null
          user_agent?: string | null
          user_id?: string | null
        }
        Relationships: []
      }
      shipments: {
        Row: {
          created_at: string | null
          delivery_receipt_photos: string[] | null
          id: string
          notes: string | null
          order_quantity: number | null
          purchase_request_id: string
          purchase_request_item_id: string
          shipped_at: string | null
          shipped_by: string
          shipped_quantity: number
          status: string | null
          updated_at: string | null
        }
        Insert: {
          created_at?: string | null
          delivery_receipt_photos?: string[] | null
          id?: string
          notes?: string | null
          order_quantity?: number | null
          purchase_request_id: string
          purchase_request_item_id: string
          shipped_at?: string | null
          shipped_by: string
          shipped_quantity: number
          status?: string | null
          updated_at?: string | null
        }
        Update: {
          created_at?: string | null
          delivery_receipt_photos?: string[] | null
          id?: string
          notes?: string | null
          order_quantity?: number | null
          purchase_request_id?: string
          purchase_request_item_id?: string
          shipped_at?: string | null
          shipped_by?: string
          shipped_quantity?: number
          status?: string | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "shipments_purchase_request_id_fkey"
            columns: ["purchase_request_id"]
            isOneToOne: false
            referencedRelation: "purchase_requests"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "shipments_purchase_request_item_id_fkey"
            columns: ["purchase_request_item_id"]
            isOneToOne: false
            referencedRelation: "purchase_request_items"
            referencedColumns: ["id"]
          },
        ]
      }
      sites: {
        Row: {
          approved_expenses: number | null
          created_at: string | null
          id: string
          image_url: string | null
          name: string
          total_budget: number | null
          updated_at: string | null
        }
        Insert: {
          approved_expenses?: number | null
          created_at?: string | null
          id?: string
          image_url?: string | null
          name: string
          total_budget?: number | null
          updated_at?: string | null
        }
        Update: {
          approved_expenses?: number | null
          created_at?: string | null
          id?: string
          image_url?: string | null
          name?: string
          total_budget?: number | null
          updated_at?: string | null
        }
        Relationships: []
      }
      status_transitions: {
        Row: {
          audit_log_id: string | null
          changed_at: string | null
          changed_by: string | null
          comments: string | null
          created_at: string | null
          from_status: string | null
          id: string
          is_automatic: boolean | null
          purchase_request_id: string
          reason: string | null
          to_status: string
          trigger_source: string | null
        }
        Insert: {
          audit_log_id?: string | null
          changed_at?: string | null
          changed_by?: string | null
          comments?: string | null
          created_at?: string | null
          from_status?: string | null
          id?: string
          is_automatic?: boolean | null
          purchase_request_id: string
          reason?: string | null
          to_status: string
          trigger_source?: string | null
        }
        Update: {
          audit_log_id?: string | null
          changed_at?: string | null
          changed_by?: string | null
          comments?: string | null
          created_at?: string | null
          from_status?: string | null
          id?: string
          is_automatic?: boolean | null
          purchase_request_id?: string
          reason?: string | null
          to_status?: string
          trigger_source?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "status_transitions_audit_log_id_fkey"
            columns: ["audit_log_id"]
            isOneToOne: false
            referencedRelation: "audit_log"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "status_transitions_audit_log_id_fkey"
            columns: ["audit_log_id"]
            isOneToOne: false
            referencedRelation: "audit_log_view"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "status_transitions_purchase_request_id_fkey"
            columns: ["purchase_request_id"]
            isOneToOne: false
            referencedRelation: "purchase_requests"
            referencedColumns: ["id"]
          },
        ]
      }
      stock_movements: {
        Row: {
          assigned_to: string | null
          created_at: string
          created_by: string | null
          currency: string | null
          id: string
          invoice_images: string[] | null
          movement_type: string
          new_quantity: number | null
          previous_quantity: number | null
          product_condition: string | null
          product_id: string
          quantity: number
          reason: string | null
          reference_id: string | null
          reference_type: string | null
          supplier_id: string | null
          supplier_name: string | null
          unit_price: number | null
          warehouse_id: string | null
        }
        Insert: {
          assigned_to?: string | null
          created_at?: string
          created_by?: string | null
          currency?: string | null
          id?: string
          invoice_images?: string[] | null
          movement_type: string
          new_quantity?: number | null
          previous_quantity?: number | null
          product_condition?: string | null
          product_id: string
          quantity: number
          reason?: string | null
          reference_id?: string | null
          reference_type?: string | null
          supplier_id?: string | null
          supplier_name?: string | null
          unit_price?: number | null
          warehouse_id?: string | null
        }
        Update: {
          assigned_to?: string | null
          created_at?: string
          created_by?: string | null
          currency?: string | null
          id?: string
          invoice_images?: string[] | null
          movement_type?: string
          new_quantity?: number | null
          previous_quantity?: number | null
          product_condition?: string | null
          product_id?: string
          quantity?: number
          reason?: string | null
          reference_id?: string | null
          reference_type?: string | null
          supplier_id?: string | null
          supplier_name?: string | null
          unit_price?: number | null
          warehouse_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "fk_stock_movements_product_id"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "stock_movements_assigned_to_fkey"
            columns: ["assigned_to"]
            isOneToOne: false
            referencedRelation: "employees"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "stock_movements_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "stock_movements_supplier_id_fkey"
            columns: ["supplier_id"]
            isOneToOne: false
            referencedRelation: "suppliers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "stock_movements_warehouse_id_fkey"
            columns: ["warehouse_id"]
            isOneToOne: false
            referencedRelation: "sites"
            referencedColumns: ["id"]
          },
        ]
      }
      supplier_materials: {
        Row: {
          created_at: string | null
          currency: string | null
          delivery_time_days: number | null
          id: string
          is_preferred: boolean | null
          material_class: string | null
          material_group: string | null
          material_item: string
          minimum_order_quantity: number | null
          notes: string | null
          price_range_max: number | null
          price_range_min: number | null
          supplier_id: string
          updated_at: string | null
        }
        Insert: {
          created_at?: string | null
          currency?: string | null
          delivery_time_days?: number | null
          id?: string
          is_preferred?: boolean | null
          material_class?: string | null
          material_group?: string | null
          material_item: string
          minimum_order_quantity?: number | null
          notes?: string | null
          price_range_max?: number | null
          price_range_min?: number | null
          supplier_id: string
          updated_at?: string | null
        }
        Update: {
          created_at?: string | null
          currency?: string | null
          delivery_time_days?: number | null
          id?: string
          is_preferred?: boolean | null
          material_class?: string | null
          material_group?: string | null
          material_item?: string
          minimum_order_quantity?: number | null
          notes?: string | null
          price_range_max?: number | null
          price_range_min?: number | null
          supplier_id?: string
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "supplier_materials_supplier_id_fkey"
            columns: ["supplier_id"]
            isOneToOne: false
            referencedRelation: "suppliers"
            referencedColumns: ["id"]
          },
        ]
      }
      suppliers: {
        Row: {
          address: string | null
          code: string | null
          contact_person: string | null
          created_at: string | null
          email: string | null
          id: string
          is_approved: boolean | null
          last_order_date: string | null
          name: string
          payment_terms: number | null
          phone: string | null
          rating: number | null
          tax_number: string | null
          total_orders: number | null
          updated_at: string | null
        }
        Insert: {
          address?: string | null
          code?: string | null
          contact_person?: string | null
          created_at?: string | null
          email?: string | null
          id?: string
          is_approved?: boolean | null
          last_order_date?: string | null
          name: string
          payment_terms?: number | null
          phone?: string | null
          rating?: number | null
          tax_number?: string | null
          total_orders?: number | null
          updated_at?: string | null
        }
        Update: {
          address?: string | null
          code?: string | null
          contact_person?: string | null
          created_at?: string | null
          email?: string | null
          id?: string
          is_approved?: boolean | null
          last_order_date?: string | null
          name?: string
          payment_terms?: number | null
          phone?: string | null
          rating?: number | null
          tax_number?: string | null
          total_orders?: number | null
          updated_at?: string | null
        }
        Relationships: []
      }
      user_inventory: {
        Row: {
          assigned_by: string | null
          assigned_date: string | null
          category: string | null
          consumed_quantity: number | null
          created_at: string | null
          id: string
          item_name: string
          notes: string | null
          owner_email: string | null
          owner_name: string | null
          pending_user_email: string | null
          pending_user_name: string | null
          product_id: string | null
          purchase_request_id: string | null
          quantity: number
          return_date: string | null
          returned_quantity: number | null
          serial_number: string | null
          shipment_id: string | null
          source_warehouse_id: string | null
          status: string | null
          unit: string
          updated_at: string | null
          user_id: string | null
        }
        Insert: {
          assigned_by?: string | null
          assigned_date?: string | null
          category?: string | null
          consumed_quantity?: number | null
          created_at?: string | null
          id?: string
          item_name: string
          notes?: string | null
          owner_email?: string | null
          owner_name?: string | null
          pending_user_email?: string | null
          pending_user_name?: string | null
          product_id?: string | null
          purchase_request_id?: string | null
          quantity?: number
          return_date?: string | null
          returned_quantity?: number | null
          serial_number?: string | null
          shipment_id?: string | null
          source_warehouse_id?: string | null
          status?: string | null
          unit?: string
          updated_at?: string | null
          user_id?: string | null
        }
        Update: {
          assigned_by?: string | null
          assigned_date?: string | null
          category?: string | null
          consumed_quantity?: number | null
          created_at?: string | null
          id?: string
          item_name?: string
          notes?: string | null
          owner_email?: string | null
          owner_name?: string | null
          pending_user_email?: string | null
          pending_user_name?: string | null
          product_id?: string | null
          purchase_request_id?: string | null
          quantity?: number
          return_date?: string | null
          returned_quantity?: number | null
          serial_number?: string | null
          shipment_id?: string | null
          source_warehouse_id?: string | null
          status?: string | null
          unit?: string
          updated_at?: string | null
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "user_inventory_assigned_by_fkey"
            columns: ["assigned_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "user_inventory_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "user_inventory_purchase_request_id_fkey"
            columns: ["purchase_request_id"]
            isOneToOne: false
            referencedRelation: "purchase_requests"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "user_inventory_shipment_id_fkey"
            columns: ["shipment_id"]
            isOneToOne: false
            referencedRelation: "shipments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "user_inventory_source_warehouse_id_fkey"
            columns: ["source_warehouse_id"]
            isOneToOne: false
            referencedRelation: "sites"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "user_inventory_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      warehouse_stock: {
        Row: {
          assigned_breakdown: Json | null
          condition_breakdown: Json | null
          created_at: string
          id: string
          is_consumable: boolean | null
          last_updated: string | null
          max_stock_level: number | null
          min_stock_level: number | null
          product_id: string
          quantity: number
          updated_by: string | null
          user_id: string | null
          warehouse_id: string | null
        }
        Insert: {
          assigned_breakdown?: Json | null
          condition_breakdown?: Json | null
          created_at?: string
          id?: string
          is_consumable?: boolean | null
          last_updated?: string | null
          max_stock_level?: number | null
          min_stock_level?: number | null
          product_id: string
          quantity?: number
          updated_by?: string | null
          user_id?: string | null
          warehouse_id?: string | null
        }
        Update: {
          assigned_breakdown?: Json | null
          condition_breakdown?: Json | null
          created_at?: string
          id?: string
          is_consumable?: boolean | null
          last_updated?: string | null
          max_stock_level?: number | null
          min_stock_level?: number | null
          product_id?: string
          quantity?: number
          updated_by?: string | null
          user_id?: string | null
          warehouse_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "fk_warehouse_stock_product_id"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "warehouse_stock_updated_by_fkey"
            columns: ["updated_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "warehouse_stock_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "warehouse_stock_warehouse_id_fkey"
            columns: ["warehouse_id"]
            isOneToOne: false
            referencedRelation: "sites"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      audit_log_view: {
        Row: {
          action: string | null
          changed_at: string | null
          changed_by: string | null
          changed_by_email: string | null
          id: string | null
          ip_address: unknown
          new_values: Json | null
          old_values: Json | null
          record_id: string | null
          table_name: string | null
          user_agent: string | null
        }
        Relationships: [
          {
            foreignKeyName: "audit_log_purchase_request_id_fkey"
            columns: ["table_name"]
            isOneToOne: false
            referencedRelation: "purchase_requests"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "audit_log_purchase_request_id_fkey"
            columns: ["record_id"]
            isOneToOne: false
            referencedRelation: "purchase_requests"
            referencedColumns: ["id"]
          },
        ]
      }
      invoice_groups_with_orders: {
        Row: {
          created_at: string | null
          created_by: string | null
          currency: string | null
          discount: number | null
          grand_total: number | null
          group_name: string | null
          id: string | null
          invoice_count: number | null
          invoice_photos: string[] | null
          invoices: Json | null
          notes: string | null
          subtotal: number | null
          tax: number | null
          updated_at: string | null
        }
        Relationships: [
          {
            foreignKeyName: "invoice_groups_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      item_sent_summary: {
        Row: {
          last_shipment_date: string | null
          purchase_request_item_id: string | null
          shipment_count: number | null
          total_sent_quantity: number | null
        }
        Relationships: [
          {
            foreignKeyName: "shipments_purchase_request_item_id_fkey"
            columns: ["purchase_request_item_id"]
            isOneToOne: false
            referencedRelation: "purchase_request_items"
            referencedColumns: ["id"]
          },
        ]
      }
      material_delivery_status: {
        Row: {
          delivered_quantity: number | null
          delivery_status: string | null
          last_delivery_date: string | null
          material_id: string | null
          material_name: string | null
          order_created_at: string | null
          order_id: string | null
          order_status: string | null
          ordered_quantity: number | null
          purchase_request_id: string | null
          remaining_quantity: number | null
          request_title: string | null
          supplier_id: string | null
          supplier_name: string | null
        }
        Relationships: [
          {
            foreignKeyName: "fk_orders_material_item_id"
            columns: ["material_id"]
            isOneToOne: false
            referencedRelation: "purchase_request_items"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "orders_purchase_request_id_fkey"
            columns: ["purchase_request_id"]
            isOneToOne: false
            referencedRelation: "purchase_requests"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "orders_supplier_id_fkey"
            columns: ["supplier_id"]
            isOneToOne: false
            referencedRelation: "suppliers"
            referencedColumns: ["id"]
          },
        ]
      }
      material_movements_summary: {
        Row: {
          created_at: string | null
          created_by: string | null
          created_by_email: string | null
          from_location: string | null
          id: string | null
          material_item_id: string | null
          material_name: string | null
          movement_type: string | null
          quantity: number | null
          reason: string | null
          to_location: string | null
        }
        Relationships: [
          {
            foreignKeyName: "material_movements_material_item_id_fkey"
            columns: ["material_item_id"]
            isOneToOne: false
            referencedRelation: "purchase_request_items"
            referencedColumns: ["id"]
          },
        ]
      }
      order_delivery_summary: {
        Row: {
          delivery_status: string | null
          order_created_at: string | null
          order_id: string | null
          order_status: string | null
          purchase_request_id: string | null
          remaining_quantity: number | null
          supplier_id: string | null
          total_delivered_quantity: number | null
          total_ordered_quantity: number | null
        }
        Relationships: [
          {
            foreignKeyName: "orders_purchase_request_id_fkey"
            columns: ["purchase_request_id"]
            isOneToOne: false
            referencedRelation: "purchase_requests"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "orders_supplier_id_fkey"
            columns: ["supplier_id"]
            isOneToOne: false
            referencedRelation: "suppliers"
            referencedColumns: ["id"]
          },
        ]
      }
      shipment_totals: {
        Row: {
          last_shipment_date: string | null
          purchase_request_item_id: string | null
          shipment_count: number | null
          total_shipped_quantity: number | null
        }
        Relationships: [
          {
            foreignKeyName: "shipments_purchase_request_item_id_fkey"
            columns: ["purchase_request_item_id"]
            isOneToOne: false
            referencedRelation: "purchase_request_items"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Functions: {
      add_site_to_user: {
        Args: { site_uuid: string; user_uuid: string }
        Returns: undefined
      }
      calculate_purchase_request_status: {
        Args: { request_id_param: string }
        Returns: string
      }
      check_and_update_return_status: {
        Args: { request_id: string }
        Returns: boolean
      }
      check_main_warehouse_stock: {
        Args: { request_id_param: string }
        Returns: {
          available_quantity: number
          has_stock: boolean
          item_id: string
          item_name: string
          product_id: string
          requested_quantity: number
        }[]
      }
      check_security_status: {
        Args: never
        Returns: {
          check_name: string
          details: string
          status: string
        }[]
      }
      check_storage_security_status: {
        Args: never
        Returns: {
          bucket_name: string
          details: string
          operation: string
          status: string
        }[]
      }
      check_temporary_roles: {
        Args: never
        Returns: {
          assigned_by_email: string
          email: string
          end_date: string
          is_expired: boolean
          orig_role: Database["public"]["Enums"]["user_role_enum"]
          start_date: string
          user_id: string
          user_role: Database["public"]["Enums"]["user_role_enum"]
        }[]
      }
      check_user_role_restrictions: {
        Args: never
        Returns: {
          details: string
          operation: string
          status: string
          table_name: string
        }[]
      }
      cleanup_old_audit_logs: {
        Args: { days_to_keep?: number }
        Returns: number
      }
      confirm_order_delivery:
        | {
            Args: { p_notes?: string; p_order_id: string; p_user_id: string }
            Returns: {
              message: string
              order_id: string
              request_status: string
              success: boolean
            }[]
          }
        | {
            Args: {
              p_notes?: string
              p_order_id: string
              p_photo_urls?: string[]
              p_user_id: string
            }
            Returns: {
              message: string
              order_id: string
              request_status: string
              success: boolean
            }[]
          }
      create_order_delivery: {
        Args: {
          p_damage_notes?: string
          p_delivered_quantity: number
          p_delivery_notes?: string
          p_delivery_photos?: string[]
          p_order_id: string
          p_quality_check?: boolean
          p_received_by: string
        }
        Returns: Json
      }
      custom_access_token_hook: { Args: { event: Json }; Returns: Json }
      fix_all_order_statuses: {
        Args: never
        Returns: {
          new_status: string
          old_status: string
          order_id: string
          updated: boolean
        }[]
      }
      get_audit_statistics: {
        Args: { end_date?: string; start_date?: string }
        Returns: {
          action_count: number
          action_type: string
          unique_requests: number
          unique_users: number
        }[]
      }
      get_order_delivery_status: {
        Args: { order_id_param: string }
        Returns: string
      }
      get_order_remaining_quantity: {
        Args: { order_id_param: string }
        Returns: number
      }
      get_order_total_delivered: {
        Args: { order_id_param: string }
        Returns: number
      }
      get_overdue_deliveries_count: {
        Args: { user_site_ids?: string[] }
        Returns: {
          max_days_late: number
          overdue_orders_count: number
          request_id: string
        }[]
      }
      get_request_total_delivered: {
        Args: { request_id_param: string }
        Returns: number
      }
      get_request_total_ordered: {
        Args: { request_id_param: string }
        Returns: number
      }
      get_request_total_original: {
        Args: { request_id_param: string }
        Returns: number
      }
      get_total_sent_quantity: { Args: { item_id: string }; Returns: number }
      get_unordered_materials_count: {
        Args: { request_ids: string[] }
        Returns: {
          request_id: string
          unordered_count: number
        }[]
      }
      log_audit_event: {
        Args: {
          p_action_type: string
          p_comments?: string
          p_description: string
          p_metadata?: Json
          p_new_status?: string
          p_previous_status?: string
          p_related_item_id?: string
          p_related_item_type?: string
          p_request_id: string
        }
        Returns: string
      }
      manual_update_all_request_statuses: { Args: never; Returns: number }
      manual_update_purchase_request_status: {
        Args: { request_id: string }
        Returns: Json
      }
      remove_site_from_user: {
        Args: { site_uuid: string; user_uuid: string }
        Returns: undefined
      }
      restore_expired_temporary_roles: { Args: never; Returns: number }
      search_orders: {
        Args: { search_term: string }
        Returns: {
          order_id: string
        }[]
      }
      test_and_update_reorder_completion: {
        Args: never
        Returns: {
          current_status: string
          request_id: string
          should_update: boolean
          total_not_requested: number
          total_reordered: number
          total_returned: number
          updated: boolean
        }[]
      }
      test_return_reorder_trigger: {
        Args: { p_purchase_request_id: string }
        Returns: string
      }
      update_delivery_status_by_site_personnel: {
        Args: { delivery_notes?: string; request_id: string }
        Returns: boolean
      }
      update_order_status_from_deliveries: {
        Args: { order_id_param: string }
        Returns: boolean
      }
      update_purchase_request_item_quantity: {
        Args: { item_id: string; new_quantity: number }
        Returns: boolean
      }
      update_purchase_request_status: {
        Args: { new_status: string; request_id: string }
        Returns: boolean
      }
      update_purchase_request_status_from_orders: {
        Args: { request_id_param: string }
        Returns: boolean
      }
      update_request_status_by_site_manager: {
        Args: { new_status: string; request_id: string }
        Returns: boolean
      }
      update_simple_request_status: {
        Args: { request_id_param: string }
        Returns: boolean
      }
      user_has_site_access: {
        Args: { site_uuid: string; user_uuid: string }
        Returns: boolean
      }
      user_has_storage_write_access: { Args: never; Returns: boolean }
      user_role_cannot_write: { Args: never; Returns: boolean }
    }
    Enums: {
      notification_type:
        | "iade var"
        | "yeniden sipariş oluşturuldu"
        | "acil"
        | "gecikme var"
      user_role:
        | "user"
        | "manager"
        | "admin"
        | "site_personnel"
        | "site_manager"
        | "warehouse_manager"
        | "purchasing_officer"
      user_role_enum:
        | "user"
        | "manager"
        | "admin"
        | "site_personnel"
        | "site_manager"
        | "warehouse_manager"
        | "purchasing_officer"
        | "santiye_depo"
        | "santiye_depo_yonetici"
        | "depomanager"
        | "department_head"
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] &
        DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] &
        DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R
      }
      ? R
      : never
    : never

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I
      }
      ? I
      : never
    : never

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U
      }
      ? U
      : never
    : never

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  public: {
    Enums: {
      notification_type: [
        "iade var",
        "yeniden sipariş oluşturuldu",
        "acil",
        "gecikme var",
      ],
      user_role: [
        "user",
        "manager",
        "admin",
        "site_personnel",
        "site_manager",
        "warehouse_manager",
        "purchasing_officer",
      ],
      user_role_enum: [
        "user",
        "manager",
        "admin",
        "site_personnel",
        "site_manager",
        "warehouse_manager",
        "purchasing_officer",
        "santiye_depo",
        "santiye_depo_yonetici",
        "depomanager",
        "department_head",
      ],
    },
  },
} as const

