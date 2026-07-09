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
      cases: {
        Row: {
          acceptance_date: string | null
          approving_officer: string | null
          assigned_department: string | null
          attachment_name: string | null
          attachment_url: string | null
          case_number: string
          closed_date: string | null
          created_at: string
          defendant_address: string | null
          defendant_name: string | null
          description: string | null
          file_reference: string | null
          id: string
          letter_date: string | null
          letter_reference_number: string | null
          letter_type: Database["public"]["Enums"]["letter_type"]
          notes: string | null
          opened_date: string
          plaintiff_address: string | null
          plaintiff_name: string | null
          received_date: string | null
          recipient_name: string | null
          recipient_office: string | null
          registration_date: string
          remarks: string | null
          responsible_person: string | null
          sender_name: string | null
          sender_office: string | null
          sender_organization: string | null
          serial_number: string | null
          signature_file_url: string | null
          signature_text: string | null
          status: Database["public"]["Enums"]["case_status"]
          subject: string | null
          updated_at: string
          user_id: string | null
        }
        Insert: {
          acceptance_date?: string | null
          approving_officer?: string | null
          assigned_department?: string | null
          attachment_name?: string | null
          attachment_url?: string | null
          case_number: string
          closed_date?: string | null
          created_at?: string
          defendant_address?: string | null
          defendant_name?: string | null
          description?: string | null
          file_reference?: string | null
          id?: string
          letter_date?: string | null
          letter_reference_number?: string | null
          letter_type?: Database["public"]["Enums"]["letter_type"]
          notes?: string | null
          opened_date?: string
          plaintiff_address?: string | null
          plaintiff_name?: string | null
          received_date?: string | null
          recipient_name?: string | null
          recipient_office?: string | null
          registration_date?: string
          remarks?: string | null
          responsible_person?: string | null
          sender_name?: string | null
          sender_office?: string | null
          sender_organization?: string | null
          serial_number?: string | null
          signature_file_url?: string | null
          signature_text?: string | null
          status?: Database["public"]["Enums"]["case_status"]
          subject?: string | null
          updated_at?: string
          user_id?: string | null
        }
        Update: {
          acceptance_date?: string | null
          approving_officer?: string | null
          assigned_department?: string | null
          attachment_name?: string | null
          attachment_url?: string | null
          case_number?: string
          closed_date?: string | null
          created_at?: string
          defendant_address?: string | null
          defendant_name?: string | null
          description?: string | null
          file_reference?: string | null
          id?: string
          letter_date?: string | null
          letter_reference_number?: string | null
          letter_type?: Database["public"]["Enums"]["letter_type"]
          notes?: string | null
          opened_date?: string
          plaintiff_address?: string | null
          plaintiff_name?: string | null
          received_date?: string | null
          recipient_name?: string | null
          recipient_office?: string | null
          registration_date?: string
          remarks?: string | null
          responsible_person?: string | null
          sender_name?: string | null
          sender_office?: string | null
          sender_organization?: string | null
          serial_number?: string | null
          signature_file_url?: string | null
          signature_text?: string | null
          status?: Database["public"]["Enums"]["case_status"]
          subject?: string | null
          updated_at?: string
          user_id?: string | null
        }
        Relationships: []
      }
      profiles: {
        Row: {
          created_at: string
          department: string | null
          full_name: string | null
          id: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          department?: string | null
          full_name?: string | null
          id: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          department?: string | null
          full_name?: string | null
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
      [_ in never]: never
    }
    Enums: {
      case_status:
        | "open"
        | "closed"
        | "under_review"
        | "assigned"
        | "in_progress"
        | "waiting_approval"
        | "approved"
      letter_type: "incoming" | "outgoing"
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
      case_status: [
        "open",
        "closed",
        "under_review",
        "assigned",
        "in_progress",
        "waiting_approval",
        "approved",
      ],
      letter_type: ["incoming", "outgoing"],
    },
  },
} as const
