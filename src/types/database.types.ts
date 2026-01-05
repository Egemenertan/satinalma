export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  public: {
    Tables: {
      material_categories: {
        Row: {
          id: number
          name: string
          display_name: string
          description: string | null
          icon: string
          color: string
          category_type: 'insaat' | 'ofis' | 'both'
          is_active: boolean
          display_order: number
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: number
          name: string
          display_name: string
          description?: string | null
          icon?: string
          color?: string
          category_type: 'insaat' | 'ofis' | 'both'
          is_active?: boolean
          display_order?: number
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: number
          name?: string
          display_name?: string
          description?: string | null
          icon?: string
          color?: string
          category_type?: 'insaat' | 'ofis' | 'both'
          is_active?: boolean
          display_order?: number
          created_at?: string
          updated_at?: string
        }
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
          role: Database["public"]["Enums"]["user_role_enum"] | null
          role_old: string | null
          site_id: string[] | null
          updated_at: string | null
          original_role: Database["public"]["Enums"]["user_role_enum"] | null
          temporary_role_start_date: string | null
          temporary_role_end_date: string | null
          temporary_role_assigned_by: string | null
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
          role?: Database["public"]["Enums"]["user_role_enum"] | null
          role_old?: string | null
          site_id?: string[] | null
          updated_at?: string | null
          original_role?: Database["public"]["Enums"]["user_role_enum"] | null
          temporary_role_start_date?: string | null
          temporary_role_end_date?: string | null
          temporary_role_assigned_by?: string | null
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
          role?: Database["public"]["Enums"]["user_role_enum"] | null
          role_old?: string | null
          site_id?: string[] | null
          updated_at?: string | null
          original_role?: Database["public"]["Enums"]["user_role_enum"] | null
          temporary_role_start_date?: string | null
          temporary_role_end_date?: string | null
          temporary_role_assigned_by?: string | null
        }
        Relationships: []
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
      brands: {
        Row: {
          id: string
          name: string
          description: string | null
          logo_url: string | null
          website: string | null
          contact_info: Json
          is_active: boolean
          created_at: string
          updated_at: string | null
        }
        Insert: {
          id?: string
          name: string
          description?: string | null
          logo_url?: string | null
          website?: string | null
          contact_info?: Json
          is_active?: boolean
          created_at?: string
          updated_at?: string | null
        }
        Update: {
          id?: string
          name?: string
          description?: string | null
          logo_url?: string | null
          website?: string | null
          contact_info?: Json
          is_active?: boolean
          created_at?: string
          updated_at?: string | null
        }
        Relationships: []
      }
      products: {
        Row: {
          id: string
          name: string
          sku: string | null
          brand_id: string | null
          category_id: string | null
          product_type: string | null
          description: string | null
          specifications: Json
          images: string[]
          unit: string
          unit_price: number | null
          currency: string | null
          is_active: boolean
          created_at: string
          updated_at: string | null
        }
        Insert: {
          id?: string
          name: string
          sku?: string | null
          brand_id?: string | null
          category_id?: string | null
          product_type?: string | null
          description?: string | null
          specifications?: Json
          images?: string[]
          unit?: string
          unit_price?: number | null
          currency?: string | null
          is_active?: boolean
          created_at?: string
          updated_at?: string | null
        }
        Update: {
          id?: string
          name?: string
          sku?: string | null
          brand_id?: string | null
          category_id?: string | null
          product_type?: string | null
          description?: string | null
          specifications?: Json
          images?: string[]
          unit?: string
          unit_price?: number | null
          currency?: string | null
          is_active?: boolean
          created_at?: string
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "products_brand_id_fkey"
            columns: ["brand_id"]
            referencedRelation: "brands"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "products_category_id_fkey"
            columns: ["category_id"]
            referencedRelation: "pro_categories"
            referencedColumns: ["id"]
          }
        ]
      }
      product_categories: {
        Row: {
          id: string
          name: string
          description: string | null
          parent_id: string | null
          is_active: boolean
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          name: string
          description?: string | null
          parent_id?: string | null
          is_active?: boolean
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          name?: string
          description?: string | null
          parent_id?: string | null
          is_active?: boolean
          created_at?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "product_categories_parent_id_fkey"
            columns: ["parent_id"]
            referencedRelation: "product_categories"
            referencedColumns: ["id"]
          }
        ]
      }
      warehouse_stock: {
        Row: {
          id: string
          product_id: string
          warehouse_id: string | null
          quantity: number
          min_stock_level: number | null
          max_stock_level: number | null
          last_updated: string | null
          updated_by: string | null
          condition_breakdown: Json
          assigned_breakdown: Json
        }
        Insert: {
          id?: string
          product_id: string
          warehouse_id?: string | null
          quantity?: number
          min_stock_level?: number | null
          max_stock_level?: number | null
          last_updated?: string | null
          updated_by?: string | null
          condition_breakdown?: Json
          assigned_breakdown?: Json
        }
        Update: {
          id?: string
          product_id?: string
          warehouse_id?: string | null
          quantity?: number
          min_stock_level?: number | null
          max_stock_level?: number | null
          last_updated?: string | null
          updated_by?: string | null
          condition_breakdown?: Json
          assigned_breakdown?: Json
        }
        Relationships: [
          {
            foreignKeyName: "warehouse_stock_product_id_fkey"
            columns: ["product_id"]
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "warehouse_stock_warehouse_id_fkey"
            columns: ["warehouse_id"]
            referencedRelation: "sites"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "warehouse_stock_updated_by_fkey"
            columns: ["updated_by"]
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          }
        ]
      }
      stock_movements: {
        Row: {
          id: string
          product_id: string
          warehouse_id: string | null
          movement_type: 'giriş' | 'çıkış' | 'transfer' | 'düzeltme'
          quantity: number
          previous_quantity: number | null
          new_quantity: number | null
          reason: string | null
          reference_id: string | null
          reference_type: string | null
          created_by: string | null
          supplier_id: string | null
          supplier_name: string | null
          product_condition: 'yeni' | 'kullanılmış' | 'arızalı' | 'hek' | null
          assigned_to: string | null
          created_at: string
        }
        Insert: {
          id?: string
          product_id: string
          warehouse_id?: string | null
          movement_type: 'giriş' | 'çıkış' | 'transfer' | 'düzeltme'
          quantity: number
          previous_quantity?: number | null
          new_quantity?: number | null
          reason?: string | null
          reference_id?: string | null
          reference_type?: string | null
          created_by?: string | null
          supplier_id?: string | null
          supplier_name?: string | null
          product_condition?: 'yeni' | 'kullanılmış' | 'arızalı' | 'hek' | null
          assigned_to?: string | null
          created_at?: string
        }
        Update: {
          id?: string
          product_id?: string
          warehouse_id?: string | null
          movement_type?: 'giriş' | 'çıkış' | 'transfer' | 'düzeltme'
          quantity?: number
          previous_quantity?: number | null
          new_quantity?: number | null
          reason?: string | null
          reference_id?: string | null
          reference_type?: string | null
          created_by?: string | null
          supplier_id?: string | null
          supplier_name?: string | null
          product_condition?: 'yeni' | 'kullanılmış' | 'arızalı' | 'hek' | null
          assigned_to?: string | null
          created_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "stock_movements_product_id_fkey"
            columns: ["product_id"]
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "stock_movements_warehouse_id_fkey"
            columns: ["warehouse_id"]
            referencedRelation: "sites"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "stock_movements_created_by_fkey"
            columns: ["created_by"]
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          }
        ]
      }
    }
    Views: {}
    Functions: {
      user_has_site_access: {
        Args: { user_uuid: string; site_uuid: string }
        Returns: boolean
      }
      add_site_to_user: {
        Args: { user_uuid: string; site_uuid: string }
        Returns: undefined
      }
      remove_site_from_user: {
        Args: { user_uuid: string; site_uuid: string }
        Returns: undefined
      }
      brands: {
        Row: {
          id: string
          name: string
          description: string | null
          logo_url: string | null
          website: string | null
          is_active: boolean | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          name: string
          description?: string | null
          logo_url?: string | null
          website?: string | null
          is_active?: boolean | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          name?: string
          description?: string | null
          logo_url?: string | null
          website?: string | null
          is_active?: boolean | null
          created_at?: string
          updated_at?: string
        }
        Relationships: []
      }
      products: {
        Row: {
          id: string
          name: string
          description: string | null
          category_id: string | null
          brand_id: string | null
          unit_price: string | null
          currency: string | null
          has_serial: boolean | null
          sku: string | null
          unit: string | null
          images: string[] | null // JSONB array of image URLs
          product_type: string | null
          is_active: boolean | null
          deleted_at: string | null
          deleted_by: string | null
          created_at: string | null
          updated_at: string | null
        }
        Insert: {
          id?: string
          name: string
          description?: string | null
          category_id?: string | null
          brand_id?: string | null
          unit_price?: string | null
          currency?: string | null
          has_serial?: boolean | null
          sku?: string | null
          unit?: string | null
          images?: string[] | null
          product_type?: string | null
          is_active?: boolean | null
          deleted_at?: string | null
          deleted_by?: string | null
          created_at?: string | null
          updated_at?: string | null
        }
        Update: {
          id?: string
          name?: string
          description?: string | null
          category_id?: string | null
          brand_id?: string | null
          unit_price?: string | null
          currency?: string | null
          has_serial?: boolean | null
          sku?: string | null
          unit?: string | null
          images?: string[] | null
          product_type?: string | null
          is_active?: boolean | null
          deleted_at?: string | null
          deleted_by?: string | null
          created_at?: string | null
          updated_at?: string | null
        }
        Relationships: []
      }
      warehouse_stock: {
        Row: {
          id: string
          product_id: string
          warehouse_id: string | null
          quantity: number
          min_stock_level: number | null
          max_stock_level: number | null
          last_updated: string | null
          updated_by: string | null
          created_at: string
        }
        Insert: {
          id?: string
          product_id: string
          warehouse_id?: string | null
          quantity?: number
          min_stock_level?: number | null
          max_stock_level?: number | null
          last_updated?: string | null
          updated_by?: string | null
          created_at?: string
        }
        Update: {
          id?: string
          product_id?: string
          warehouse_id?: string | null
          quantity?: number
          min_stock_level?: number | null
          max_stock_level?: number | null
          last_updated?: string | null
          updated_by?: string | null
          created_at?: string
        }
        Relationships: []
      }
      stock_movements: {
        Row: {
          id: string
          product_id: string
          warehouse_id: string | null
          movement_type: 'giriş' | 'çıkış' | 'transfer' | 'düzeltme'
          quantity: number
          previous_quantity: number | null
          new_quantity: number | null
          reason: string | null
          reference_id: string | null
          reference_type: string | null
          created_by: string | null
          created_at: string
        }
        Insert: {
          id?: string
          product_id: string
          warehouse_id?: string | null
          movement_type: 'giriş' | 'çıkış' | 'transfer' | 'düzeltme'
          quantity: number
          previous_quantity?: number | null
          new_quantity?: number | null
          reason?: string | null
          reference_id?: string | null
          reference_type?: string | null
          created_by?: string | null
          created_at?: string
        }
        Update: {
          id?: string
          product_id?: string
          warehouse_id?: string | null
          movement_type?: 'giriş' | 'çıkış' | 'transfer' | 'düzeltme'
          quantity?: number
          previous_quantity?: number | null
          new_quantity?: number | null
          reason?: string | null
          reference_id?: string | null
          reference_type?: string | null
          created_by?: string | null
          created_at?: string
        }
        Relationships: []
      }
    }
    Enums: {
      user_role_enum:
        | "user"
        | "manager"
        | "admin"
        | "site_personnel"
        | "site_manager"
        | "warehouse_manager"
        | "purchasing_officer"
        | "santiye_depo"
    }
  }
}
