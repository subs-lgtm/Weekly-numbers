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
    PostgrestVersion: "14.5"
  }
  public: {
    Tables: {
      ai_messages: {
        Row: {
          content: string
          created_at: string
          id: string
          role: string
          user_id: string
        }
        Insert: {
          content: string
          created_at?: string
          id?: string
          role: string
          user_id: string
        }
        Update: {
          content?: string
          created_at?: string
          id?: string
          role?: string
          user_id?: string
        }
        Relationships: []
      }
      allowed_domains: {
        Row: {
          created_at: string
          domain: string
          id: string
        }
        Insert: {
          created_at?: string
          domain: string
          id?: string
        }
        Update: {
          created_at?: string
          domain?: string
          id?: string
        }
        Relationships: []
      }
      email_campaigns: {
        Row: {
          clicks: number | null
          created_at: string
          created_by: string | null
          id: string
          name: string
          notes: string | null
          opens: number | null
          sends: number | null
          sent_at: string | null
        }
        Insert: {
          clicks?: number | null
          created_at?: string
          created_by?: string | null
          id?: string
          name: string
          notes?: string | null
          opens?: number | null
          sends?: number | null
          sent_at?: string | null
        }
        Update: {
          clicks?: number | null
          created_at?: string
          created_by?: string | null
          id?: string
          name?: string
          notes?: string | null
          opens?: number | null
          sends?: number | null
          sent_at?: string | null
        }
        Relationships: []
      }
      events: {
        Row: {
          created_at: string
          created_by: string | null
          event_date: string | null
          id: string
          name: string
          notes: string | null
          owner: string | null
          quarter: string | null
          status: string | null
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          event_date?: string | null
          id?: string
          name: string
          notes?: string | null
          owner?: string | null
          quarter?: string | null
          status?: string | null
        }
        Update: {
          created_at?: string
          created_by?: string | null
          event_date?: string | null
          id?: string
          name?: string
          notes?: string | null
          owner?: string | null
          quarter?: string | null
          status?: string | null
        }
        Relationships: []
      }
      goals: {
        Row: {
          created_at: string
          id: string
          metric_id: string
          owner_id: string | null
          period_start: string
          period_type: string
          target_value: number
        }
        Insert: {
          created_at?: string
          id?: string
          metric_id: string
          owner_id?: string | null
          period_start: string
          period_type: string
          target_value: number
        }
        Update: {
          created_at?: string
          id?: string
          metric_id?: string
          owner_id?: string | null
          period_start?: string
          period_type?: string
          target_value?: number
        }
        Relationships: [
          {
            foreignKeyName: "goals_metric_id_fkey"
            columns: ["metric_id"]
            isOneToOne: false
            referencedRelation: "metrics"
            referencedColumns: ["id"]
          },
        ]
      }
      leads: {
        Row: {
          captured_at: string
          country: string | null
          created_at: string
          created_by: string | null
          email: string | null
          id: string
          name: string | null
          raw: Json | null
          score: number | null
          source: string
        }
        Insert: {
          captured_at?: string
          country?: string | null
          created_at?: string
          created_by?: string | null
          email?: string | null
          id?: string
          name?: string | null
          raw?: Json | null
          score?: number | null
          source: string
        }
        Update: {
          captured_at?: string
          country?: string | null
          created_at?: string
          created_by?: string | null
          email?: string | null
          id?: string
          name?: string | null
          raw?: Json | null
          score?: number | null
          source?: string
        }
        Relationships: []
      }
      metrics: {
        Row: {
          created_at: string
          id: string
          key: string
          label: string
          section: string
          unit: string | null
        }
        Insert: {
          created_at?: string
          id?: string
          key: string
          label: string
          section: string
          unit?: string | null
        }
        Update: {
          created_at?: string
          id?: string
          key?: string
          label?: string
          section?: string
          unit?: string | null
        }
        Relationships: []
      }
      pages: {
        Row: {
          created_at: string
          created_by: string | null
          id: string
          published_at: string
          title: string
          url: string | null
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          id?: string
          published_at?: string
          title: string
          url?: string | null
        }
        Update: {
          created_at?: string
          created_by?: string | null
          id?: string
          published_at?: string
          title?: string
          url?: string | null
        }
        Relationships: []
      }
      profiles: {
        Row: {
          created_at: string
          display_name: string | null
          email: string
          id: string
        }
        Insert: {
          created_at?: string
          display_name?: string | null
          email: string
          id: string
        }
        Update: {
          created_at?: string
          display_name?: string | null
          email?: string
          id?: string
        }
        Relationships: []
      }
      rag_flags: {
        Row: {
          created_at: string
          created_by: string | null
          id: string
          note: string | null
          section: string | null
          status: string
          title: string
          week_start: string
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          id?: string
          note?: string | null
          section?: string | null
          status: string
          title: string
          week_start: string
        }
        Update: {
          created_at?: string
          created_by?: string | null
          id?: string
          note?: string | null
          section?: string | null
          status?: string
          title?: string
          week_start?: string
        }
        Relationships: []
      }
      seo_keywords: {
        Row: {
          created_at: string
          created_by: string | null
          id: string
          keyword: string
          rank: number | null
          recorded_at: string
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          id?: string
          keyword: string
          rank?: number | null
          recorded_at?: string
        }
        Update: {
          created_at?: string
          created_by?: string | null
          id?: string
          keyword?: string
          rank?: number | null
          recorded_at?: string
        }
        Relationships: []
      }
      user_roles: {
        Row: {
          created_at: string
          id: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id?: string
        }
        Relationships: []
      }
      weekly_entries: {
        Row: {
          created_at: string
          created_by: string | null
          id: string
          metric_id: string | null
          notes: string | null
          section: string
          updated_at: string
          value: number | null
          week_start: string
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          id?: string
          metric_id?: string | null
          notes?: string | null
          section: string
          updated_at?: string
          value?: number | null
          week_start: string
        }
        Update: {
          created_at?: string
          created_by?: string | null
          id?: string
          metric_id?: string | null
          notes?: string | null
          section?: string
          updated_at?: string
          value?: number | null
          week_start?: string
        }
        Relationships: [
          {
            foreignKeyName: "weekly_entries_metric_id_fkey"
            columns: ["metric_id"]
            isOneToOne: false
            referencedRelation: "metrics"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
    }
    Enums: {
      app_role: "admin" | "user"
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
      app_role: ["admin", "user"],
    },
  },
} as const
