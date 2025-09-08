export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

// Kullanıcı rolleri - güncel sistem
export type UserRole = 
  | 'user'
  | 'manager'
  | 'admin'
  | 'site_personnel' // Şantiye personeli - sadece requests sayfasına erişim
  | 'site_manager' // Şantiye yöneticisi - dashboard ve requests sayfalarına erişim
  | 'warehouse_manager' // Depo yöneticisi - site_manager ile aynı yetkiler
  | 'purchasing_officer' // Satın alma sorumlusu - site_manager ile aynı yetkiler

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


