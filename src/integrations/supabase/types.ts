// Généré depuis le schéma Supabase (projet GMAO App). Ne pas éditer à la main :
// régénérer après chaque migration (Supabase MCP generate_typescript_types ou `supabase gen types`).
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
      audit_log: {
        Row: {
          action: string
          changes: Json | null
          created_at: string
          entity_id: string
          entity_type: string
          id: number
          organization_id: string
          user_id: string | null
        }
        Insert: {
          action: string
          changes?: Json | null
          created_at?: string
          entity_id: string
          entity_type: string
          id?: never
          organization_id: string
          user_id?: string | null
        }
        Update: {
          action?: string
          changes?: Json | null
          created_at?: string
          entity_id?: string
          entity_type?: string
          id?: never
          organization_id?: string
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "audit_log_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      document_categories: {
        Row: {
          created_at: string
          id: string
          name: string
          organization_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          name: string
          organization_id?: string
        }
        Update: {
          created_at?: string
          id?: string
          name?: string
          organization_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "document_categories_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      document_equipment: {
        Row: {
          created_at: string
          document_id: string
          equipment_id: string
          organization_id: string
        }
        Insert: {
          created_at?: string
          document_id: string
          equipment_id: string
          organization_id?: string
        }
        Update: {
          created_at?: string
          document_id?: string
          equipment_id?: string
          organization_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "document_equipment_organization_id_document_id_fkey"
            columns: ["organization_id", "document_id"]
            isOneToOne: false
            referencedRelation: "documents"
            referencedColumns: ["organization_id", "id"]
          },
          {
            foreignKeyName: "document_equipment_organization_id_equipment_id_fkey"
            columns: ["organization_id", "equipment_id"]
            isOneToOne: false
            referencedRelation: "equipment"
            referencedColumns: ["organization_id", "id"]
          },
        ]
      }
      document_interventions: {
        Row: {
          created_at: string
          document_id: string
          intervention_id: string
          organization_id: string
        }
        Insert: {
          created_at?: string
          document_id: string
          intervention_id: string
          organization_id?: string
        }
        Update: {
          created_at?: string
          document_id?: string
          intervention_id?: string
          organization_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "document_interventions_organization_id_document_id_fkey"
            columns: ["organization_id", "document_id"]
            isOneToOne: false
            referencedRelation: "documents"
            referencedColumns: ["organization_id", "id"]
          },
          {
            foreignKeyName: "document_interventions_organization_id_intervention_id_fkey"
            columns: ["organization_id", "intervention_id"]
            isOneToOne: false
            referencedRelation: "interventions"
            referencedColumns: ["organization_id", "id"]
          },
        ]
      }
      documents: {
        Row: {
          category_id: string
          created_at: string
          deleted_at: string | null
          expires_on: string | null
          id: string
          mime_type: string
          name: string
          organization_id: string
          size_bytes: number
          storage_path: string
          updated_at: string
          uploaded_by: string | null
        }
        Insert: {
          category_id: string
          created_at?: string
          deleted_at?: string | null
          expires_on?: string | null
          id?: string
          mime_type: string
          name: string
          organization_id?: string
          size_bytes: number
          storage_path: string
          updated_at?: string
          uploaded_by?: string | null
        }
        Update: {
          category_id?: string
          created_at?: string
          deleted_at?: string | null
          expires_on?: string | null
          id?: string
          mime_type?: string
          name?: string
          organization_id?: string
          size_bytes?: number
          storage_path?: string
          updated_at?: string
          uploaded_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "documents_category_fk"
            columns: ["organization_id", "category_id"]
            isOneToOne: false
            referencedRelation: "document_categories"
            referencedColumns: ["organization_id", "id"]
          },
          {
            foreignKeyName: "documents_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      equipment: {
        Row: {
          category: string | null
          code: string
          commissioned_on: string | null
          created_at: string
          created_by: string | null
          criticality: number
          deleted_at: string | null
          id: string
          location: string | null
          name: string
          organization_id: string
          status: Database["public"]["Enums"]["equipment_status"]
          updated_at: string
        }
        Insert: {
          category?: string | null
          code: string
          commissioned_on?: string | null
          created_at?: string
          created_by?: string | null
          criticality?: number
          deleted_at?: string | null
          id?: string
          location?: string | null
          name: string
          organization_id?: string
          status?: Database["public"]["Enums"]["equipment_status"]
          updated_at?: string
        }
        Update: {
          category?: string | null
          code?: string
          commissioned_on?: string | null
          created_at?: string
          created_by?: string | null
          criticality?: number
          deleted_at?: string | null
          id?: string
          location?: string | null
          name?: string
          organization_id?: string
          status?: Database["public"]["Enums"]["equipment_status"]
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "equipment_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      intervention_status_history: {
        Row: {
          changed_at: string
          changed_by: string | null
          from_status: Database["public"]["Enums"]["intervention_status"] | null
          id: number
          intervention_id: string
          organization_id: string
          reason: string | null
          to_status: Database["public"]["Enums"]["intervention_status"]
        }
        Insert: {
          changed_at?: string
          changed_by?: string | null
          from_status?:
            | Database["public"]["Enums"]["intervention_status"]
            | null
          id?: never
          intervention_id: string
          organization_id: string
          reason?: string | null
          to_status: Database["public"]["Enums"]["intervention_status"]
        }
        Update: {
          changed_at?: string
          changed_by?: string | null
          from_status?:
            | Database["public"]["Enums"]["intervention_status"]
            | null
          id?: never
          intervention_id?: string
          organization_id?: string
          reason?: string | null
          to_status?: Database["public"]["Enums"]["intervention_status"]
        }
        Relationships: [
          {
            foreignKeyName: "intervention_status_history_organization_id_intervention_i_fkey"
            columns: ["organization_id", "intervention_id"]
            isOneToOne: false
            referencedRelation: "interventions"
            referencedColumns: ["organization_id", "id"]
          },
        ]
      }
      intervention_steps: {
        Row: {
          completed_at: string | null
          completed_by: string | null
          id: string
          intervention_id: string
          organization_id: string
          position: number
          title: string
        }
        Insert: {
          completed_at?: string | null
          completed_by?: string | null
          id?: string
          intervention_id: string
          organization_id?: string
          position: number
          title: string
        }
        Update: {
          completed_at?: string | null
          completed_by?: string | null
          id?: string
          intervention_id?: string
          organization_id?: string
          position?: number
          title?: string
        }
        Relationships: [
          {
            foreignKeyName: "intervention_steps_organization_id_intervention_id_fkey"
            columns: ["organization_id", "intervention_id"]
            isOneToOne: false
            referencedRelation: "interventions"
            referencedColumns: ["organization_id", "id"]
          },
        ]
      }
      interventions: {
        Row: {
          assigned_to: string | null
          completed_at: string | null
          created_at: string
          created_by: string | null
          description: string | null
          due_date: string | null
          duration_minutes: number | null
          equipment_id: string
          id: string
          organization_id: string
          parts_used: string | null
          priority: Database["public"]["Enums"]["intervention_priority"]
          started_at: string | null
          status: Database["public"]["Enums"]["intervention_status"]
          submitted_at: string | null
          title: string
          type: Database["public"]["Enums"]["intervention_type"]
          updated_at: string
          work_performed: string | null
        }
        Insert: {
          assigned_to?: string | null
          completed_at?: string | null
          created_at?: string
          created_by?: string | null
          description?: string | null
          due_date?: string | null
          duration_minutes?: number | null
          equipment_id: string
          id?: string
          organization_id?: string
          parts_used?: string | null
          priority?: Database["public"]["Enums"]["intervention_priority"]
          started_at?: string | null
          status?: Database["public"]["Enums"]["intervention_status"]
          submitted_at?: string | null
          title: string
          type?: Database["public"]["Enums"]["intervention_type"]
          updated_at?: string
          work_performed?: string | null
        }
        Update: {
          assigned_to?: string | null
          completed_at?: string | null
          created_at?: string
          created_by?: string | null
          description?: string | null
          due_date?: string | null
          duration_minutes?: number | null
          equipment_id?: string
          id?: string
          organization_id?: string
          parts_used?: string | null
          priority?: Database["public"]["Enums"]["intervention_priority"]
          started_at?: string | null
          status?: Database["public"]["Enums"]["intervention_status"]
          submitted_at?: string | null
          title?: string
          type?: Database["public"]["Enums"]["intervention_type"]
          updated_at?: string
          work_performed?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "interventions_equipment_fk"
            columns: ["organization_id", "equipment_id"]
            isOneToOne: false
            referencedRelation: "equipment"
            referencedColumns: ["organization_id", "id"]
          },
          {
            foreignKeyName: "interventions_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      memberships: {
        Row: {
          created_at: string
          deleted_at: string | null
          organization_id: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Insert: {
          created_at?: string
          deleted_at?: string | null
          organization_id: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Update: {
          created_at?: string
          deleted_at?: string | null
          organization_id?: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "memberships_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      notifications: {
        Row: {
          created_at: string
          entity_id: string
          entity_type: string
          id: string
          message: string
          organization_id: string
          read_at: string | null
          type: Database["public"]["Enums"]["notification_type"]
          user_id: string
        }
        Insert: {
          created_at?: string
          entity_id: string
          entity_type: string
          id?: string
          message: string
          organization_id: string
          read_at?: string | null
          type: Database["public"]["Enums"]["notification_type"]
          user_id: string
        }
        Update: {
          created_at?: string
          entity_id?: string
          entity_type?: string
          id?: string
          message?: string
          organization_id?: string
          read_at?: string | null
          type?: Database["public"]["Enums"]["notification_type"]
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "notifications_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      organizations: {
        Row: {
          created_at: string
          id: string
          name: string
        }
        Insert: {
          created_at?: string
          id?: string
          name: string
        }
        Update: {
          created_at?: string
          id?: string
          name?: string
        }
        Relationships: []
      }
      profiles: {
        Row: {
          created_at: string
          full_name: string
          id: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          full_name?: string
          id: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          full_name?: string
          id?: string
          updated_at?: string
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      create_organization: { Args: { org_name: string }; Returns: string }
      change_intervention_status: {
        Args: {
          p_intervention_id: string
          p_reason?: string
          p_status: Database["public"]["Enums"]["intervention_status"]
        }
        Returns: undefined
      }
    }
    Enums: {
      app_role: "admin" | "technician"
      equipment_status: "in_service" | "broken_down" | "out_of_service"
      intervention_priority: "low" | "normal" | "high" | "urgent"
      intervention_status: "todo" | "in_progress" | "submitted" | "done" | "cancelled"
      intervention_type: "corrective" | "preventive"
      notification_type:
        | "intervention_assigned"
        | "intervention_overdue"
        | "document_expiring"
        | "intervention_submitted"
        | "intervention_returned"
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
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never) = never,
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
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
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
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
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
  EnumName extends (DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never) = never,
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
  CompositeTypeName extends (PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never) = never,
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
      app_role: ["admin", "technician"],
      equipment_status: ["in_service", "broken_down", "out_of_service"],
      intervention_priority: ["low", "normal", "high", "urgent"],
      intervention_status: ["todo", "in_progress", "submitted", "done", "cancelled"],
      intervention_type: ["corrective", "preventive"],
      notification_type: [
        "intervention_assigned",
        "intervention_overdue",
        "document_expiring",
        "intervention_submitted",
        "intervention_returned",
      ],
    },
  },
} as const
