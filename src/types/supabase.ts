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
        Relationships: []
      }
      // Diğer tablolar için buraya eklenebilir
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