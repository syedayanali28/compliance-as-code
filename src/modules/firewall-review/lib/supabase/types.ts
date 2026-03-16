// Supabase database types

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
      guidelines: {
        Row: {
          id: string
          caution_id: string
          title: string
          description: string
          category: string
          severity: 'HIGH' | 'MEDIUM' | 'LOW'
          required_action: 'REJECT' | 'REQUEST_INFO' | 'ALLOW_WITH_CONTROLS'
          context: string | null
          example_compliant: string | null
          example_violation: string | null
          check_logic: string | null
          enabled: boolean
          created_at: string
          updated_at: string
          created_by: string | null
          updated_by: string | null
          version: number
          embedding: string | null  // pgvector for semantic search
        }
        Insert: {
          id?: string
          caution_id: string
          title: string
          description: string
          category: string
          severity: 'HIGH' | 'MEDIUM' | 'LOW'
          required_action: 'REJECT' | 'REQUEST_INFO' | 'ALLOW_WITH_CONTROLS'
          context?: string | null
          example_compliant?: string | null
          example_violation?: string | null
          check_logic?: string | null
          enabled?: boolean
          created_at?: string
          updated_at?: string
          created_by?: string | null
          updated_by?: string | null
          version?: number
          embedding?: string | null
        }
        Update: {
          id?: string
          caution_id?: string
          title?: string
          description?: string
          category?: string
          severity?: 'HIGH' | 'MEDIUM' | 'LOW'
          required_action?: 'REJECT' | 'REQUEST_INFO' | 'ALLOW_WITH_CONTROLS'
          context?: string | null
          example_compliant?: string | null
          example_violation?: string | null
          check_logic?: string | null
          enabled?: boolean
          created_at?: string
          updated_at?: string
          created_by?: string | null
          updated_by?: string | null
          version?: number
          embedding?: string | null
        }
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      match_guidelines: {
        Args: {
          query_embedding: string
          match_threshold: number
          match_count: number
        }
        Returns: {
          id: string
          caution_id: string
          title: string
          description: string
          category: string
          similarity: number
        }[]
      }
    }
    Enums: {
      [_ in never]: never
    }
  }
}

export type Guideline = Database['public']['Tables']['guidelines']['Row'];
export type GuidelineInsert = Database['public']['Tables']['guidelines']['Insert'];
export type GuidelineUpdate = Database['public']['Tables']['guidelines']['Update'];

