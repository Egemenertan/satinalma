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
