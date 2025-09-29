// DEPRECATED: Bu dosya sadece Database type tanımları için kullanılıyor
// Client oluşturma işlemleri için @/lib/supabase/client veya @/lib/supabase/server kullanın

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
          site_id: string | null
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
          site_id?: string | null
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
          site_id?: string | null
          updated_at?: string | null
        }
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
          purchasing_assignment_date: string | null
          rejection_reason: string | null
          request_number: string
          requested_by: string
          sent_quantity: number | null
          site_id: string | null
          site_manager_approval_date: string | null
          site_manager_approval_notes: string | null
          site_name: string | null
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
          purchasing_assignment_date?: string | null
          rejection_reason?: string | null
          request_number: string
          requested_by: string
          sent_quantity?: number | null
          site_id?: string | null
          site_manager_approval_date?: string | null
          site_manager_approval_notes?: string | null
          site_name?: string | null
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
          purchasing_assignment_date?: string | null
          rejection_reason?: string | null
          request_number?: string
          requested_by?: string
          sent_quantity?: number | null
          site_id?: string | null
          site_manager_approval_date?: string | null
          site_manager_approval_notes?: string | null
          site_name?: string | null
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
        }
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
          original_quantity: number | null
          purchase_request_id: string
          purpose: string | null
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
          original_quantity?: number | null
          purchase_request_id: string
          purpose?: string | null
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
          original_quantity?: number | null
          purchase_request_id?: string
          purpose?: string | null
          quantity?: number
          sent_quantity?: number | null
          specifications?: string | null
          total_price?: number | null
          unit?: string
          unit_price?: number
          updated_at?: string | null
        }
      }
      sites: {
        Row: {
          approved_expenses: number | null
          created_at: string | null
          id: string
          name: string
          total_budget: number | null
          updated_at: string | null
        }
        Insert: {
          approved_expenses?: number | null
          created_at?: string | null
          id?: string
          name: string
          total_budget?: number | null
          updated_at?: string | null
        }
        Update: {
          approved_expenses?: number | null
          created_at?: string | null
          id?: string
          name?: string
          total_budget?: number | null
          updated_at?: string | null
        }
      }
      // Diğer tablolar için sadece gerekli olanları ekliyoruz
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
      }
      order_deliveries: {
        Row: {
          id: string
          order_id: string
          delivered_quantity: number
          delivered_at: string
          received_by: string
          delivery_notes: string | null
          delivery_photos: string[] | null
          quality_check: boolean | null
          damage_notes: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          order_id: string
          delivered_quantity: number
          delivered_at?: string
          received_by: string
          delivery_notes?: string | null
          delivery_photos?: string[] | null
          quality_check?: boolean | null
          damage_notes?: string | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          order_id?: string
          delivered_quantity?: number
          delivered_at?: string
          received_by?: string
          delivery_notes?: string | null
          delivery_photos?: string[] | null
          quality_check?: boolean | null
          damage_notes?: string | null
          created_at?: string
          updated_at?: string
        }
      }
      orders: {
        Row: {
          amount: number
          created_at: string
          currency: string
          delivered_at: string | null
          delivery_confirmed_at: string | null
          delivery_confirmed_by: string | null
          delivery_date: string
          delivery_image_urls: string[] | null
          delivery_notes: string | null
          delivery_receipt_photos: string[] | null
          document_urls: string[] | null
          id: string
          is_delivered: boolean | null
          material_item_id: string | null
          purchase_request_id: string
          quantity: number | null
          received_by: string | null
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
          delivery_confirmed_at?: string | null
          delivery_confirmed_by?: string | null
          delivery_date: string
          delivery_image_urls?: string[] | null
          delivery_notes?: string | null
          delivery_receipt_photos?: string[] | null
          document_urls?: string[] | null
          id?: string
          is_delivered?: boolean | null
          material_item_id?: string | null
          purchase_request_id: string
          quantity?: number | null
          received_by?: string | null
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
          delivery_confirmed_at?: string | null
          delivery_confirmed_by?: string | null
          delivery_date?: string
          delivery_image_urls?: string[] | null
          delivery_notes?: string | null
          delivery_receipt_photos?: string[] | null
          document_urls?: string[] | null
          id?: string
          is_delivered?: boolean | null
          material_item_id?: string | null
          purchase_request_id?: string
          quantity?: number | null
          received_by?: string | null
          status?: string | null
          supplier_id?: string
          updated_at?: string
          user_id?: string | null
        }
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
      }
      shipments: {
        Row: {
          created_at: string | null
          id: string
          notes: string | null
          purchase_request_id: string
          purchase_request_item_id: string
          shipped_at: string | null
          shipped_by: string
          shipped_quantity: number
          updated_at: string | null
        }
        Insert: {
          created_at?: string | null
          id?: string
          notes?: string | null
          purchase_request_id: string
          purchase_request_item_id: string
          shipped_at?: string | null
          shipped_by: string
          shipped_quantity: number
          updated_at?: string | null
        }
        Update: {
          created_at?: string | null
          id?: string
          notes?: string | null
          purchase_request_id?: string
          purchase_request_item_id?: string
          shipped_at?: string | null
          shipped_by?: string
          shipped_quantity?: number
          updated_at?: string | null
        }
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      [_ in never]: never
    }
    Enums: {
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

export const Constants = {
  public: {
    Enums: {
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
      ],
    },
  },
} as const