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
      foods: {
        Row: {
          brand: string | null
          calories_per_100g: number
          carbs_g: number
          created_at: string
          created_by: string | null
          default_serving_g: number
          fat_g: number
          id: string
          is_custom: boolean
          name: string
          protein_g: number
        }
        Insert: {
          brand?: string | null
          calories_per_100g: number
          carbs_g?: number
          created_at?: string
          created_by?: string | null
          default_serving_g?: number
          fat_g?: number
          id?: string
          is_custom?: boolean
          name: string
          protein_g?: number
        }
        Update: {
          brand?: string | null
          calories_per_100g?: number
          carbs_g?: number
          created_at?: string
          created_by?: string | null
          default_serving_g?: number
          fat_g?: number
          id?: string
          is_custom?: boolean
          name?: string
          protein_g?: number
        }
        Relationships: []
      }
      meal_entries: {
        Row: {
          calories: number
          carbs_g: number
          created_at: string
          eaten_on: string
          fat_g: number
          food_id: string | null
          food_name: string
          grams: number
          id: string
          meal_type: string
          protein_g: number
          user_id: string
        }
        Insert: {
          calories: number
          carbs_g?: number
          created_at?: string
          eaten_on?: string
          fat_g?: number
          food_id?: string | null
          food_name: string
          grams: number
          id?: string
          meal_type: string
          protein_g?: number
          user_id: string
        }
        Update: {
          calories?: number
          carbs_g?: number
          created_at?: string
          eaten_on?: string
          fat_g?: number
          food_id?: string | null
          food_name?: string
          grams?: number
          id?: string
          meal_type?: string
          protein_g?: number
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "meal_entries_food_id_fkey"
            columns: ["food_id"]
            isOneToOne: false
            referencedRelation: "foods"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          activity_level: string | null
          age: number | null
          created_at: string
          daily_calorie_target: number | null
          display_name: string | null
          goal_pace_kg_per_week: number | null
          height_cm: number | null
          id: string
          onboarded: boolean
          sex: string | null
          target_weight_kg: number | null
          updated_at: string
          weight_kg: number | null
        }
        Insert: {
          activity_level?: string | null
          age?: number | null
          created_at?: string
          daily_calorie_target?: number | null
          display_name?: string | null
          goal_pace_kg_per_week?: number | null
          height_cm?: number | null
          id: string
          onboarded?: boolean
          sex?: string | null
          target_weight_kg?: number | null
          updated_at?: string
          weight_kg?: number | null
        }
        Update: {
          activity_level?: string | null
          age?: number | null
          created_at?: string
          daily_calorie_target?: number | null
          display_name?: string | null
          goal_pace_kg_per_week?: number | null
          height_cm?: number | null
          id?: string
          onboarded?: boolean
          sex?: string | null
          target_weight_kg?: number | null
          updated_at?: string
          weight_kg?: number | null
        }
        Relationships: []
      }
      water_entries: {
        Row: {
          created_at: string
          eaten_on: string
          id: string
          ml: number
          user_id: string
        }
        Insert: {
          created_at?: string
          eaten_on?: string
          id?: string
          ml: number
          user_id: string
        }
        Update: {
          created_at?: string
          eaten_on?: string
          id?: string
          ml?: number
          user_id?: string
        }
        Relationships: []
      }
      weight_entries: {
        Row: {
          created_at: string
          id: string
          measured_on: string
          user_id: string
          weight_kg: number
        }
        Insert: {
          created_at?: string
          id?: string
          measured_on?: string
          user_id: string
          weight_kg: number
        }
        Update: {
          created_at?: string
          id?: string
          measured_on?: string
          user_id?: string
          weight_kg?: number
        }
        Relationships: []
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
    Enums: {},
  },
} as const
