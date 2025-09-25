import { createClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://yxzmxfwpgsqabtamnfql.supabase.co'
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Inl4em14ZndwZ3NxYWJ0YW1uZnFsIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTU5NDcwMTYsImV4cCI6MjA3MTUyMzAxNn0.EJNLyurCnaA5HY8MgyoLs9RiZvzrGk7eclnYLq56rCE'

export const supabase = createClient(supabaseUrl, supabaseAnonKey)

export type Database = {
  public: {
    Tables: {
      profiles: {
        Row: {
          id: string
          email: string
          full_name?: string
          department?: string
          role?: 'user' | 'manager' | 'admin'
          created_at?: string
          updated_at?: string
        }
        Insert: {
          id: string
          email: string
          full_name?: string
          department?: string
          role?: 'user' | 'manager' | 'admin'
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          email?: string
          full_name?: string
          department?: string
          role?: 'user' | 'manager' | 'admin'
          created_at?: string
          updated_at?: string
        }
      }
      suppliers: {
        Row: {
          id: string
          name: string
          contact_person?: string
          email?: string
          phone?: string
          address?: string
          tax_number?: string
          created_at?: string
          updated_at?: string
        }
        Insert: {
          id?: string
          name: string
          contact_person?: string
          email?: string
          phone?: string
          address?: string
          tax_number?: string
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          name?: string
          contact_person?: string
          email?: string
          phone?: string
          address?: string
          tax_number?: string
          created_at?: string
          updated_at?: string
        }
      }
      purchase_requests: {
        Row: {
          id: string
          request_number: string
          title: string
          description?: string
          department: string
          total_amount: number
          currency?: string
          urgency_level?: 'low' | 'normal' | 'high' | 'critical'
          status?: 'draft' | 'pending' | 'awaiting_offers' | 'approved' | 'rejected' | 'cancelled' | 'delivered' | 'teslim alındı'
          requested_by: string
          approved_by?: string
          approved_at?: string
          rejection_reason?: string
          delivery_date?: string
          supplier_id?: string
          site_id?: string
          site_name?: string
          created_at?: string
          updated_at?: string
        }
        Insert: {
          id?: string
          request_number: string
          title: string
          description?: string
          department: string
          total_amount: number
          currency?: string
          urgency_level?: 'low' | 'normal' | 'high' | 'critical'
          status?: 'draft' | 'pending' | 'awaiting_offers' | 'approved' | 'rejected' | 'cancelled' | 'delivered' | 'teslim alındı'
          requested_by: string
          approved_by?: string
          approved_at?: string
          rejection_reason?: string
          delivery_date?: string
          supplier_id?: string
          site_id?: string
          site_name?: string
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          request_number?: string
          title?: string
          description?: string
          department?: string
          total_amount?: number
          currency?: string
          urgency_level?: 'low' | 'normal' | 'high' | 'critical'
          status?: 'draft' | 'pending' | 'awaiting_offers' | 'approved' | 'rejected' | 'cancelled' | 'delivered' | 'teslim alındı'
          requested_by?: string
          approved_by?: string
          approved_at?: string
          rejection_reason?: string
          delivery_date?: string
          supplier_id?: string
          site_id?: string
          site_name?: string
          created_at?: string
          updated_at?: string
        }
      }
      purchase_request_items: {
        Row: {
          id: string
          purchase_request_id: string
          item_name: string
          description?: string
          quantity: number
          unit: string
          unit_price: number
          total_price?: number
          specifications?: string
          created_at?: string
          updated_at?: string
        }
        Insert: {
          id?: string
          purchase_request_id: string
          item_name: string
          description?: string
          quantity: number
          unit: string
          unit_price: number
          total_price?: number
          specifications?: string
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          purchase_request_id?: string
          item_name?: string
          description?: string
          quantity?: number
          unit?: string
          unit_price?: number
          total_price?: number
          specifications?: string
          created_at?: string
          updated_at?: string
        }
      }
      approval_history: {
        Row: {
          id: string
          purchase_request_id: string
          action: 'submitted' | 'approved' | 'rejected' | 'cancelled'
          performed_by: string
          comments?: string
          created_at?: string
        }
        Insert: {
          id?: string
          purchase_request_id: string
          action: 'submitted' | 'approved' | 'rejected' | 'cancelled'
          performed_by: string
          comments?: string
          created_at?: string
        }
        Update: {
          id?: string
          purchase_request_id?: string
          action?: 'submitted' | 'approved' | 'rejected' | 'cancelled'
          performed_by?: string
          comments?: string
          created_at?: string
        }
      }
      orders: {
        Row: {
          id: string
          purchase_request_id: string
          supplier_id: string
          delivery_date: string
          amount: number
          currency: string
          document_urls: string[]
          status: 'pending' | 'approved' | 'rejected' | 'completed' | 'delivered'
          delivery_receipt_photos?: string[]
          delivery_image_urls?: string[]
          delivered_at?: string
          received_by?: string
          delivery_notes?: string
          user_id?: string
          material_item_id?: string
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          purchase_request_id: string
          supplier_id: string
          delivery_date: string
          amount: number
          currency: string
          document_urls?: string[]
          status?: 'pending' | 'approved' | 'rejected' | 'completed' | 'delivered'
          delivery_receipt_photos?: string[]
          delivery_image_urls?: string[]
          delivered_at?: string
          received_by?: string
          delivery_notes?: string
          user_id?: string
          material_item_id?: string
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          purchase_request_id?: string
          supplier_id?: string
          delivery_date?: string
          amount?: number
          currency?: string
          document_urls?: string[]
          status?: 'pending' | 'approved' | 'rejected' | 'completed' | 'delivered'
          delivery_receipt_photos?: string[]
          delivery_image_urls?: string[]
          delivered_at?: string
          received_by?: string
          delivery_notes?: string
          user_id?: string
          material_item_id?: string
          created_at?: string
          updated_at?: string
        }
      }
      offers: {
        Row: {
          id: string
          purchase_request_id: string
          supplier_id?: string
          supplier_name: string
          unit_price: number
          total_price: number
          currency?: string
          delivery_days?: number
          delivery_date?: string
          notes?: string
          offer_date?: string
          is_selected: boolean
          created_at?: string
          updated_at?: string
        }
        Insert: {
          id?: string
          purchase_request_id: string
          supplier_id?: string
          supplier_name: string
          unit_price: number
          total_price: number
          currency?: string
          delivery_days?: number
          delivery_date?: string
          notes?: string
          offer_date?: string
          is_selected?: boolean
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          purchase_request_id?: string
          supplier_id?: string
          supplier_name?: string
          unit_price?: number
          total_price?: number
          currency?: string
          delivery_days?: number
          delivery_date?: string
          notes?: string
          offer_date?: string
          is_selected?: boolean
          created_at?: string
          updated_at?: string
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
    CompositeTypes: {
      [_ in never]: never
    }
  }
}
