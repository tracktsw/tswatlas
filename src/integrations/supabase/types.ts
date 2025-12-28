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
    PostgrestVersion: "13.0.5"
  }
  public: {
    Tables: {
      treatment_suggestions: {
        Row: {
          category: string
          created_at: string
          description: string | null
          id: string
          name: string
          status: string
          suggested_by: string | null
        }
        Insert: {
          category?: string
          created_at?: string
          description?: string | null
          id?: string
          name: string
          status?: string
          suggested_by?: string | null
        }
        Update: {
          category?: string
          created_at?: string
          description?: string | null
          id?: string
          name?: string
          status?: string
          suggested_by?: string | null
        }
        Relationships: []
      }
      treatment_votes: {
        Row: {
          created_at: string
          id: string
          treatment_id: string
          vote_type: string
          voter_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          treatment_id: string
          vote_type: string
          voter_id: string
        }
        Update: {
          created_at?: string
          id?: string
          treatment_id?: string
          vote_type?: string
          voter_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "treatment_votes_treatment_id_fkey"
            columns: ["treatment_id"]
            isOneToOne: false
            referencedRelation: "treatments"
            referencedColumns: ["id"]
          },
        ]
      }
      treatments: {
        Row: {
          category: string
          created_at: string
          description: string | null
          id: string
          is_approved: boolean
          name: string
          suggested_by: string | null
        }
        Insert: {
          category?: string
          created_at?: string
          description?: string | null
          id?: string
          is_approved?: boolean
          name: string
          suggested_by?: string | null
        }
        Update: {
          category?: string
          created_at?: string
          description?: string | null
          id?: string
          is_approved?: boolean
          name?: string
          suggested_by?: string | null
        }
        Relationships: []
      }
      user_check_ins: {
        Row: {
          created_at: string
          id: string
          mood: number
          notes: string | null
          skin_feeling: number
          time_of_day: string
          treatments: string[]
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          mood: number
          notes?: string | null
          skin_feeling: number
          time_of_day: string
          treatments?: string[]
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          mood?: number
          notes?: string | null
          skin_feeling?: number
          time_of_day?: string
          treatments?: string[]
          user_id?: string
        }
        Relationships: []
      }
      user_journal_entries: {
        Row: {
          content: string
          created_at: string
          id: string
          mood: number | null
          photo_ids: string[] | null
          user_id: string
        }
        Insert: {
          content: string
          created_at?: string
          id?: string
          mood?: number | null
          photo_ids?: string[] | null
          user_id: string
        }
        Update: {
          content?: string
          created_at?: string
          id?: string
          mood?: number | null
          photo_ids?: string[] | null
          user_id?: string
        }
        Relationships: []
      }
      user_photos: {
        Row: {
          body_part: string
          created_at: string
          id: string
          medium_url: string | null
          notes: string | null
          original_url: string | null
          photo_url: string
          taken_at: string | null
          thumb_url: string | null
          uploaded_at: string
          user_id: string
        }
        Insert: {
          body_part: string
          created_at?: string
          id?: string
          medium_url?: string | null
          notes?: string | null
          original_url?: string | null
          photo_url: string
          taken_at?: string | null
          thumb_url?: string | null
          uploaded_at?: string
          user_id: string
        }
        Update: {
          body_part?: string
          created_at?: string
          id?: string
          medium_url?: string | null
          notes?: string | null
          original_url?: string | null
          photo_url?: string
          taken_at?: string | null
          thumb_url?: string | null
          uploaded_at?: string
          user_id?: string
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
          role: Database["public"]["Enums"]["app_role"]
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
      user_settings: {
        Row: {
          created_at: string
          custom_treatments: string[]
          evening_time: string
          id: string
          last_reminded_at: string | null
          morning_time: string
          reminders_enabled: boolean
          snoozed_until: string | null
          timezone: string | null
          tsw_start_date: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          custom_treatments?: string[]
          evening_time?: string
          id?: string
          last_reminded_at?: string | null
          morning_time?: string
          reminders_enabled?: boolean
          snoozed_until?: string | null
          timezone?: string | null
          tsw_start_date?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          custom_treatments?: string[]
          evening_time?: string
          id?: string
          last_reminded_at?: string | null
          morning_time?: string
          reminders_enabled?: boolean
          snoozed_until?: string | null
          timezone?: string | null
          tsw_start_date?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      user_subscriptions: {
        Row: {
          cancel_at_period_end: boolean | null
          created_at: string
          current_period_end: string | null
          current_period_start: string | null
          id: string
          price_id: string | null
          status: string
          stripe_customer_id: string | null
          stripe_subscription_id: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          cancel_at_period_end?: boolean | null
          created_at?: string
          current_period_end?: string | null
          current_period_start?: string | null
          id?: string
          price_id?: string | null
          status?: string
          stripe_customer_id?: string | null
          stripe_subscription_id?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          cancel_at_period_end?: boolean | null
          created_at?: string
          current_period_end?: string | null
          current_period_start?: string | null
          id?: string
          price_id?: string | null
          status?: string
          stripe_customer_id?: string | null
          stripe_subscription_id?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
    }
    Views: {
      treatment_vote_counts: {
        Row: {
          harmful_votes: number | null
          helpful_votes: number | null
          neutral_votes: number | null
          total_votes: number | null
          treatment_id: string | null
        }
        Relationships: [
          {
            foreignKeyName: "treatment_votes_treatment_id_fkey"
            columns: ["treatment_id"]
            isOneToOne: false
            referencedRelation: "treatments"
            referencedColumns: ["id"]
          },
        ]
      }
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
      app_role: "admin" | "moderator" | "user"
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
      app_role: ["admin", "moderator", "user"],
    },
  },
} as const
