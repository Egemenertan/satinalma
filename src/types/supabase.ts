export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export interface Database {
  public: {
    Tables: {
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
      orders: {
        Row: {
          amount: number
          created_at: string
          currency: string
          delivery_date: string
          document_urls: string[] | null
          id: string
          purchase_request_id: string
          status: string | null
          supplier_id: string
          updated_at: string
          user_id: string | null
        }
        Insert: {
          amount: number
          created_at?: string
          currency: string
          delivery_date: string
          document_urls?: string[] | null
          id?: string
          purchase_request_id: string
          status?: string | null
          supplier_id: string
          updated_at?: string
          user_id?: string | null
        }
        Update: {
          amount?: number
          created_at?: string
          currency?: string
          delivery_date?: string
          document_urls?: string[] | null
          id?: string
          purchase_request_id?: string
          status?: string | null
          supplier_id?: string
          updated_at?: string
          user_id?: string | null
        }
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
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      [_ in never]: never
    }
    Enums: {
      [_ in never]: never
    }
  }
}