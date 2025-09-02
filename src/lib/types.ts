export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

// Kullanıcı rolleri - mevcut ve yeni roller
export type UserRole = 
  | 'engineer' 
  | 'site_supervisor' 
  | 'procurement_specialist' 
  | 'finance_manager' 
  | 'project_manager' 
  | 'general_manager'
  | 'chief'
  | 'approver'
  | 'muhendis'
  | 'proje_sorumlusu'
  | 'satin_alma_sorumlusu'
  | 'admin'

export interface Database {
  public: {
    Tables: {
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
      }
    }
  }
}


