export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[];

type BusinessTable<Row, Insert> = {
  Row: Row;
  Insert: Insert;
  Update: Partial<Insert>;
  Relationships: [];
};

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "14.18";
  };
  public: {
    Tables: {
      business_customers: BusinessTable<
        {
          id: string;
          user_id: string;
          display_name: string;
          nickname: string | null;
          contact_info: string | null;
          notes: string | null;
          created_at: string;
          updated_at: string;
        },
        {
          id?: string;
          user_id: string;
          display_name: string;
          nickname?: string | null;
          contact_info?: string | null;
          notes?: string | null;
          created_at?: string;
          updated_at?: string;
        }
      >;
      business_accounts: BusinessTable<
        {
          id: string;
          user_id: string;
          name: string;
          account_type: string;
          currency: string;
          opening_balance: number;
          created_at: string;
          updated_at: string;
        },
        {
          id?: string;
          user_id: string;
          name: string;
          account_type: string;
          currency: string;
          opening_balance?: number;
          created_at?: string;
          updated_at?: string;
        }
      >;
      business_customer_transactions: BusinessTable<
        {
          id: string;
          user_id: string;
          customer_id: string;
          receipt_account_id: string;
          payout_account_id: string;
          transaction_date: string;
          due_date: string | null;
          htg_received: number;
          usd_sent: number;
          exchange_rate: number | null;
          service_fee_usd: number | null;
          crypto_cost_usd: number | null;
          transfer_fee_usd: number;
          other_expenses_usd: number | null;
          status: string;
          reference_code: string | null;
          idempotency_key: string;
          notes: string | null;
          created_at: string;
          updated_at: string;
        },
        {
          id?: string;
          user_id: string;
          customer_id: string;
          receipt_account_id: string;
          payout_account_id: string;
          transaction_date?: string;
          due_date?: string | null;
          htg_received?: number;
          usd_sent?: number;
          exchange_rate?: number | null;
          service_fee_usd?: number | null;
          crypto_cost_usd?: number | null;
          transfer_fee_usd?: number;
          other_expenses_usd?: number | null;
          status?: string;
          reference_code?: string | null;
          idempotency_key: string;
          notes?: string | null;
          created_at?: string;
          updated_at?: string;
        }
      >;
      business_customer_payments: BusinessTable<
        {
          id: string;
          user_id: string;
          customer_transaction_id: string;
          account_id: string;
          amount: number;
          currency: string;
          payment_method: string;
          payment_date: string;
          reference: string | null;
          notes: string | null;
          idempotency_key: string;
          created_at: string;
        },
        {
          id?: string;
          user_id: string;
          customer_transaction_id: string;
          account_id: string;
          amount: number;
          currency: string;
          payment_method: string;
          payment_date?: string;
          reference?: string | null;
          notes?: string | null;
          idempotency_key: string;
          created_at?: string;
        }
      >;
      business_loans: BusinessTable<
        {
          id: string;
          user_id: string;
          customer_id: string;
          account_id: string;
          principal_amount: number;
          currency: string;
          issued_date: string;
          due_date: string | null;
          interest_amount: number;
          fee_amount: number;
          status: string;
          notes: string | null;
          idempotency_key: string;
          created_at: string;
        },
        {
          id?: string;
          user_id: string;
          customer_id: string;
          account_id: string;
          principal_amount: number;
          currency: string;
          issued_date?: string;
          due_date?: string | null;
          interest_amount?: number;
          fee_amount?: number;
          status: string;
          notes?: string | null;
          idempotency_key: string;
          created_at?: string;
        }
      >;
      business_loan_repayments: BusinessTable<
        {
          id: string;
          user_id: string;
          loan_id: string;
          account_id: string;
          amount: number;
          principal_paid: number;
          interest_paid: number;
          fee_paid: number;
          currency: string;
          repayment_date: string;
          reference: string | null;
          notes: string | null;
          idempotency_key: string;
          created_at: string;
        },
        {
          id?: string;
          user_id: string;
          loan_id: string;
          account_id: string;
          amount: number;
          principal_paid: number;
          interest_paid: number;
          fee_paid: number;
          currency: string;
          repayment_date?: string;
          reference?: string | null;
          notes?: string | null;
          idempotency_key: string;
          created_at?: string;
        }
      >;
      business_fundings: BusinessTable<
        {
          id: string;
          user_id: string;
          funding_type: string;
          source_account_id: string | null;
          destination_account_id: string;
          source_amount: number | null;
          credited_amount: number;
          fee_amount: number;
          fee_usd: number | null;
          crypto_quantity: number | null;
          crypto_unit_price_usd: number | null;
          status: string;
          reference_code: string | null;
          idempotency_key: string;
          funding_date: string;
          notes: string | null;
          created_at: string;
          updated_at: string;
        },
        {
          id?: string;
          user_id: string;
          funding_type: string;
          source_account_id?: string | null;
          destination_account_id: string;
          source_amount?: number | null;
          credited_amount: number;
          fee_amount?: number;
          fee_usd?: number | null;
          crypto_quantity?: number | null;
          crypto_unit_price_usd?: number | null;
          status?: string;
          reference_code?: string | null;
          idempotency_key: string;
          funding_date?: string;
          notes?: string | null;
          created_at?: string;
          updated_at?: string;
        }
      >;
      business_expenses: BusinessTable<
        {
          id: string;
          user_id: string;
          paid_from_account_id: string;
          category: string;
          amount: number;
          currency: string;
          usd_exchange_rate: number | null;
          expense_date: string;
          status: string;
          idempotency_key: string;
          notes: string | null;
          created_at: string;
          updated_at: string;
        },
        {
          id?: string;
          user_id: string;
          paid_from_account_id: string;
          category: string;
          amount: number;
          currency: string;
          usd_exchange_rate?: number | null;
          expense_date?: string;
          status?: string;
          idempotency_key: string;
          notes?: string | null;
          created_at?: string;
          updated_at?: string;
        }
      >;
      business_exchange_rates: BusinessTable<
        {
          id: string;
          user_id: string;
          currency: string;
          usd_per_unit: number;
          effective_date: string;
          notes: string | null;
          created_at: string;
        },
        {
          id?: string;
          user_id: string;
          currency: string;
          usd_per_unit: number;
          effective_date?: string;
          notes?: string | null;
          created_at?: string;
        }
      >;
      business_account_ledger: BusinessTable<
        {
          id: string;
          user_id: string;
          account_id: string;
          event_type: string;
          source_type: string;
          source_id: string;
          amount: number;
          notes: string | null;
          created_at: string;
        },
        {
          id?: string;
          user_id: string;
          account_id: string;
          event_type: string;
          source_type: string;
          source_id: string;
          amount: number;
          notes?: string | null;
          created_at?: string;
        }
      >;
      business_adjustments: BusinessTable<
        {
          id: string;
          user_id: string;
          account_id: string;
          amount: number;
          reason: string;
          idempotency_key: string;
          created_at: string;
        },
        {
          id?: string;
          user_id: string;
          account_id: string;
          amount: number;
          reason: string;
          idempotency_key: string;
          created_at?: string;
        }
      >;
      business_audit_log: BusinessTable<
        {
          id: string;
          user_id: string;
          entity_type: string;
          entity_id: string;
          action: string;
          payload: Json | null;
          created_at: string;
        },
        {
          id?: string;
          user_id: string;
          entity_type: string;
          entity_id: string;
          action: string;
          payload?: Json | null;
          created_at?: string;
        }
      >;
      cards: {
        Row: {
          card_type: string;
          created_at: string;
          id: string;
          name: string;
          network: string | null;
          notes: string | null;
          priority: number;
          primary_use: string | null;
          provider: string;
          updated_at: string;
          user_id: string;
        };
        Insert: {
          card_type?: string;
          created_at?: string;
          id?: string;
          name: string;
          network?: string | null;
          notes?: string | null;
          priority: number;
          primary_use?: string | null;
          provider: string;
          updated_at?: string;
          user_id: string;
        };
        Update: {
          card_type?: string;
          created_at?: string;
          id?: string;
          name?: string;
          network?: string | null;
          notes?: string | null;
          priority?: number;
          primary_use?: string | null;
          provider?: string;
          updated_at?: string;
          user_id?: string;
        };
        Relationships: [];
      };
      card_purchases: {
        Row: {
          amount: number;
          card_id: string;
          created_at: string;
          currency: string;
          description: string | null;
          id: string;
          item_description: string;
          merchant: string;
          notes: string | null;
          purchase_date: string;
          purchase_type: string | null;
          updated_at: string;
          user_id: string;
        };
        Insert: {
          amount: number;
          card_id: string;
          created_at?: string;
          currency?: string;
          description?: string | null;
          id?: string;
          item_description: string;
          merchant: string;
          notes?: string | null;
          purchase_date?: string;
          purchase_type?: string | null;
          updated_at?: string;
          user_id: string;
        };
        Update: {
          amount?: number;
          card_id?: string;
          created_at?: string;
          currency?: string;
          description?: string | null;
          id?: string;
          item_description?: string;
          merchant?: string;
          notes?: string | null;
          purchase_date?: string;
          purchase_type?: string | null;
          updated_at?: string;
          user_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "card_purchases_card_owner_fkey";
            columns: ["card_id", "user_id"];
            isOneToOne: false;
            referencedRelation: "cards";
            referencedColumns: ["id", "user_id"];
          },
        ];
      };
      card_subscriptions: {
        Row: {
          amount: number;
          billing_frequency: string;
          card_id: string;
          created_at: string;
          currency: string;
          description: string | null;
          end_date: string | null;
          id: string;
          is_free_trial: boolean;
          next_billing_date: string | null;
          notes: string | null;
          service_name: string;
          start_date: string | null;
          status: string;
          trial_end_date: string | null;
          trial_start_date: string | null;
          updated_at: string;
          user_id: string;
        };
        Insert: {
          amount: number;
          billing_frequency: string;
          card_id: string;
          created_at?: string;
          currency?: string;
          description?: string | null;
          end_date?: string | null;
          id?: string;
          is_free_trial?: boolean;
          next_billing_date?: string | null;
          notes?: string | null;
          service_name: string;
          start_date?: string | null;
          status?: string;
          trial_end_date?: string | null;
          trial_start_date?: string | null;
          updated_at?: string;
          user_id: string;
        };
        Update: {
          amount?: number;
          billing_frequency?: string;
          card_id?: string;
          created_at?: string;
          currency?: string;
          description?: string | null;
          end_date?: string | null;
          id?: string;
          is_free_trial?: boolean;
          next_billing_date?: string | null;
          notes?: string | null;
          service_name?: string;
          start_date?: string | null;
          status?: string;
          trial_end_date?: string | null;
          trial_start_date?: string | null;
          updated_at?: string;
          user_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "card_subscriptions_card_owner_fkey";
            columns: ["card_id", "user_id"];
            isOneToOne: false;
            referencedRelation: "cards";
            referencedColumns: ["id", "user_id"];
          },
        ];
      };
      debts: {
        Row: {
          amount: number;
          created_at: string;
          creditor: string;
          debt_date: string;
          description: string | null;
          due_date: string | null;
          id: string;
          paid_date: string | null;
          status: "unpaid" | "paid";
          updated_at: string;
          user_id: string;
        };
        Insert: {
          amount: number;
          created_at?: string;
          creditor: string;
          debt_date?: string;
          description?: string | null;
          due_date?: string | null;
          id?: string;
          paid_date?: string | null;
          status?: "unpaid" | "paid";
          updated_at?: string;
          user_id: string;
        };
        Update: {
          amount?: number;
          created_at?: string;
          creditor?: string;
          debt_date?: string;
          description?: string | null;
          due_date?: string | null;
          id?: string;
          paid_date?: string | null;
          status?: "unpaid" | "paid";
          updated_at?: string;
          user_id?: string;
        };
        Relationships: [];
      };
      achievements: {
        Row: {
          achievement_date: string;
          category: string;
          created_at: string;
          description: string | null;
          goal_id: string | null;
          id: string;
          is_project_completion: boolean;
          learning_item_id: string | null;
          notes: string | null;
          project_id: string | null;
          task_id: string | null;
          title: string;
          updated_at: string;
          user_id: string;
        };
        Insert: {
          achievement_date: string;
          category: string;
          created_at?: string;
          description?: string | null;
          goal_id?: string | null;
          id?: string;
          is_project_completion?: boolean;
          learning_item_id?: string | null;
          notes?: string | null;
          project_id?: string | null;
          task_id?: string | null;
          title: string;
          updated_at?: string;
          user_id: string;
        };
        Update: {
          achievement_date?: string;
          category?: string;
          created_at?: string;
          description?: string | null;
          goal_id?: string | null;
          id?: string;
          is_project_completion?: boolean;
          learning_item_id?: string | null;
          notes?: string | null;
          project_id?: string | null;
          task_id?: string | null;
          title?: string;
          updated_at?: string;
          user_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "achievements_goal_id_fkey";
            columns: ["goal_id"];
            isOneToOne: false;
            referencedRelation: "goals";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "achievements_learning_item_id_fkey";
            columns: ["learning_item_id"];
            isOneToOne: false;
            referencedRelation: "learning_items";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "achievements_project_id_fkey";
            columns: ["project_id"];
            isOneToOne: false;
            referencedRelation: "projects";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "achievements_task_id_fkey";
            columns: ["task_id"];
            isOneToOne: false;
            referencedRelation: "tasks";
            referencedColumns: ["id"];
          },
        ];
      };
      daily_plans: {
        Row: {
          created_at: string;
          id: string;
          plan_date: string;
          priorities: string[];
          priority_1: string | null;
          priority_2: string | null;
          priority_3: string | null;
          updated_at: string;
          user_id: string;
        };
        Insert: {
          created_at?: string;
          id?: string;
          plan_date?: string;
          priorities?: string[];
          priority_1?: string | null;
          priority_2?: string | null;
          priority_3?: string | null;
          updated_at?: string;
          user_id: string;
        };
        Update: {
          created_at?: string;
          id?: string;
          plan_date?: string;
          priorities?: string[];
          priority_1?: string | null;
          priority_2?: string | null;
          priority_3?: string | null;
          updated_at?: string;
          user_id?: string;
        };
        Relationships: [];
      };
      goals: {
        Row: {
          created_at: string;
          description: string | null;
          id: string;
          project_id: string | null;
          subproject_id: string | null;
          progress: number;
          status: Database["public"]["Enums"]["goal_status"];
          target_date: string | null;
          title: string;
          updated_at: string;
          user_id: string;
        };
        Insert: {
          created_at?: string;
          description?: string | null;
          id?: string;
          project_id?: string | null;
          subproject_id?: string | null;
          progress?: number;
          status?: Database["public"]["Enums"]["goal_status"];
          target_date?: string | null;
          title: string;
          updated_at?: string;
          user_id: string;
        };
        Update: {
          created_at?: string;
          description?: string | null;
          id?: string;
          project_id?: string | null;
          subproject_id?: string | null;
          progress?: number;
          status?: Database["public"]["Enums"]["goal_status"];
          target_date?: string | null;
          title?: string;
          updated_at?: string;
          user_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "goals_project_id_fkey";
            columns: ["project_id"];
            isOneToOne: false;
            referencedRelation: "projects";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "goals_subproject_id_fkey";
            columns: ["subproject_id"];
            isOneToOne: false;
            referencedRelation: "project_subprojects";
            referencedColumns: ["id"];
          },
        ];
      };
      income_allocations: {
        Row: {
          allocation_type: "percentage" | "fixed";
          completed: boolean;
          created_at: string;
          id: string;
          income_id: string;
          planned_date: string | null;
          title: string;
          updated_at: string;
          user_id: string;
          value: number;
        };
        Insert: {
          allocation_type: "percentage" | "fixed";
          completed?: boolean;
          created_at?: string;
          id?: string;
          income_id: string;
          planned_date?: string | null;
          title: string;
          updated_at?: string;
          user_id: string;
          value: number;
        };
        Update: {
          allocation_type?: "percentage" | "fixed";
          completed?: boolean;
          created_at?: string;
          id?: string;
          income_id?: string;
          planned_date?: string | null;
          title?: string;
          updated_at?: string;
          user_id?: string;
          value?: number;
        };
        Relationships: [
          {
            foreignKeyName: "income_allocations_income_id_fkey";
            columns: ["income_id"];
            isOneToOne: false;
            referencedRelation: "transactions";
            referencedColumns: ["id"];
          },
        ];
      };
      future_expenses: {
        Row: {
          amount: number;
          created_at: string;
          description: string | null;
          id: string;
          paid_date: string | null;
          planned_date: string;
          resulting_expense_id: string | null;
          status: "planned" | "paid" | "cancelled";
          title: string;
          updated_at: string;
          user_id: string;
        };
        Insert: {
          amount: number;
          created_at?: string;
          description?: string | null;
          id?: string;
          paid_date?: string | null;
          planned_date: string;
          resulting_expense_id?: string | null;
          status?: "planned" | "paid" | "cancelled";
          title: string;
          updated_at?: string;
          user_id: string;
        };
        Update: {
          amount?: number;
          created_at?: string;
          description?: string | null;
          id?: string;
          paid_date?: string | null;
          planned_date?: string;
          resulting_expense_id?: string | null;
          status?: "planned" | "paid" | "cancelled";
          title?: string;
          updated_at?: string;
          user_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "future_expenses_resulting_expense_id_fkey";
            columns: ["resulting_expense_id"];
            isOneToOne: true;
            referencedRelation: "transactions";
            referencedColumns: ["id"];
          },
        ];
      };
      learning_items: {
        Row: {
          category: string | null;
          created_at: string;
          description: string | null;
          goal_id: string | null;
          id: string;
          progress: number;
          project_id: string | null;
          status: "not_started" | "in_progress" | "completed";
          target_date: string | null;
          task_id: string | null;
          title: string;
          updated_at: string;
          user_id: string;
        };
        Insert: {
          category?: string | null;
          created_at?: string;
          description?: string | null;
          goal_id?: string | null;
          id?: string;
          progress?: number;
          project_id?: string | null;
          status?: "not_started" | "in_progress" | "completed";
          target_date?: string | null;
          task_id?: string | null;
          title: string;
          updated_at?: string;
          user_id: string;
        };
        Update: {
          category?: string | null;
          created_at?: string;
          description?: string | null;
          goal_id?: string | null;
          id?: string;
          progress?: number;
          project_id?: string | null;
          status?: "not_started" | "in_progress" | "completed";
          target_date?: string | null;
          task_id?: string | null;
          title?: string;
          updated_at?: string;
          user_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "learning_items_goal_id_fkey";
            columns: ["goal_id"];
            isOneToOne: false;
            referencedRelation: "goals";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "learning_items_project_id_fkey";
            columns: ["project_id"];
            isOneToOne: false;
            referencedRelation: "projects";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "learning_items_task_id_fkey";
            columns: ["task_id"];
            isOneToOne: false;
            referencedRelation: "tasks";
            referencedColumns: ["id"];
          },
        ];
      };
      learning_sessions: {
        Row: {
          created_at: string;
          duration_minutes: number;
          id: string;
          learning_item_id: string | null;
          learning_item_title: string;
          notes: string | null;
          session_date: string;
          studied: string;
          user_id: string;
        };
        Insert: {
          created_at?: string;
          duration_minutes: number;
          id?: string;
          learning_item_id?: string | null;
          learning_item_title: string;
          notes?: string | null;
          session_date?: string;
          studied: string;
          user_id: string;
        };
        Update: {
          created_at?: string;
          duration_minutes?: number;
          id?: string;
          learning_item_id?: string | null;
          learning_item_title?: string;
          notes?: string | null;
          session_date?: string;
          studied?: string;
          user_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "learning_sessions_learning_item_id_fkey";
            columns: ["learning_item_id"];
            isOneToOne: false;
            referencedRelation: "learning_items";
            referencedColumns: ["id"];
          },
        ];
      };
      notes: {
        Row: {
          archived_at: string | null;
          category: string;
          content: string;
          created_at: string;
          goal_id: string | null;
          id: string;
          is_pinned: boolean;
          learning_item_id: string | null;
          project_id: string | null;
          tags: string[];
          task_id: string | null;
          title: string;
          updated_at: string;
          user_id: string;
        };
        Insert: {
          archived_at?: string | null;
          category?: string;
          content?: string;
          created_at?: string;
          goal_id?: string | null;
          id?: string;
          is_pinned?: boolean;
          learning_item_id?: string | null;
          project_id?: string | null;
          tags?: string[];
          task_id?: string | null;
          title: string;
          updated_at?: string;
          user_id: string;
        };
        Update: {
          archived_at?: string | null;
          category?: string;
          content?: string;
          created_at?: string;
          goal_id?: string | null;
          id?: string;
          is_pinned?: boolean;
          learning_item_id?: string | null;
          project_id?: string | null;
          tags?: string[];
          task_id?: string | null;
          title?: string;
          updated_at?: string;
          user_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "notes_goal_id_fkey";
            columns: ["goal_id"];
            isOneToOne: false;
            referencedRelation: "goals";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "notes_learning_item_id_fkey";
            columns: ["learning_item_id"];
            isOneToOne: false;
            referencedRelation: "learning_items";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "notes_project_id_fkey";
            columns: ["project_id"];
            isOneToOne: false;
            referencedRelation: "projects";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "notes_task_id_fkey";
            columns: ["task_id"];
            isOneToOne: false;
            referencedRelation: "tasks";
            referencedColumns: ["id"];
          },
        ];
      };
      notification_read_states: {
        Row: {
          read_at: string;
          source_key: string;
          user_id: string;
        };
        Insert: {
          read_at?: string;
          source_key: string;
          user_id: string;
        };
        Update: {
          read_at?: string;
          source_key?: string;
          user_id?: string;
        };
        Relationships: [];
      };
      profiles: {
        Row: {
          avatar_url: string | null;
          created_at: string;
          full_name: string | null;
          id: string;
          updated_at: string;
        };
        Insert: {
          avatar_url?: string | null;
          created_at?: string;
          full_name?: string | null;
          id: string;
          updated_at?: string;
        };
        Update: {
          avatar_url?: string | null;
          created_at?: string;
          full_name?: string | null;
          id?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      project_budget_items: {
        Row: {
          actual_amount: number;
          budget_id: string;
          category: string;
          created_at: string;
          id: string;
          notes: string | null;
          planned_amount: number;
          target_date: string | null;
          title: string;
          updated_at: string;
          user_id: string;
        };
        Insert: {
          actual_amount?: number;
          budget_id: string;
          category: string;
          created_at?: string;
          id?: string;
          notes?: string | null;
          planned_amount: number;
          target_date?: string | null;
          title: string;
          updated_at?: string;
          user_id: string;
        };
        Update: {
          actual_amount?: number;
          budget_id?: string;
          category?: string;
          created_at?: string;
          id?: string;
          notes?: string | null;
          planned_amount?: number;
          target_date?: string | null;
          title?: string;
          updated_at?: string;
          user_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "project_budget_items_budget_owner_fkey";
            columns: ["budget_id", "user_id"];
            isOneToOne: false;
            referencedRelation: "project_budgets";
            referencedColumns: ["id", "user_id"];
          },
        ];
      };
      project_subprojects: {
        Row: {
          created_at: string;
          deadline: string | null;
          description: string | null;
          id: string;
          notes: string | null;
          objective: string | null;
          priority: Database["public"]["Enums"]["task_priority"];
          project_id: string;
          start_date: string | null;
          status: Database["public"]["Enums"]["project_status"];
          title: string;
          updated_at: string;
          user_id: string;
        };
        Insert: {
          created_at?: string;
          deadline?: string | null;
          description?: string | null;
          id?: string;
          notes?: string | null;
          objective?: string | null;
          priority?: Database["public"]["Enums"]["task_priority"];
          project_id: string;
          start_date?: string | null;
          status?: Database["public"]["Enums"]["project_status"];
          title: string;
          updated_at?: string;
          user_id: string;
        };
        Update: {
          created_at?: string;
          deadline?: string | null;
          description?: string | null;
          id?: string;
          notes?: string | null;
          objective?: string | null;
          priority?: Database["public"]["Enums"]["task_priority"];
          project_id?: string;
          start_date?: string | null;
          status?: Database["public"]["Enums"]["project_status"];
          title?: string;
          updated_at?: string;
          user_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "project_subprojects_project_id_fkey";
            columns: ["project_id"];
            isOneToOne: false;
            referencedRelation: "projects";
            referencedColumns: ["id"];
          },
        ];
      };
      project_budgets: {
        Row: {
          available_funds: number | null;
          created_at: string;
          currency: string;
          id: string;
          planned_amount: number;
          project_id: string;
          updated_at: string;
          user_id: string;
        };
        Insert: {
          available_funds?: number | null;
          created_at?: string;
          currency?: string;
          id?: string;
          planned_amount: number;
          project_id: string;
          updated_at?: string;
          user_id: string;
        };
        Update: {
          available_funds?: number | null;
          created_at?: string;
          currency?: string;
          id?: string;
          planned_amount?: number;
          project_id?: string;
          updated_at?: string;
          user_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "project_budgets_project_id_fkey";
            columns: ["project_id"];
            isOneToOne: true;
            referencedRelation: "projects";
            referencedColumns: ["id"];
          },
        ];
      };
      projects: {
        Row: {
          created_at: string;
          deadline: string | null;
          description: string | null;
          goal_id: string | null;
          id: string;
          name: string;
          progress: number;
          start_date: string | null;
          status: Database["public"]["Enums"]["project_status"];
          updated_at: string;
          user_id: string;
        };
        Insert: {
          created_at?: string;
          deadline?: string | null;
          description?: string | null;
          goal_id?: string | null;
          id?: string;
          name: string;
          progress?: number;
          start_date?: string | null;
          status?: Database["public"]["Enums"]["project_status"];
          updated_at?: string;
          user_id: string;
        };
        Update: {
          created_at?: string;
          deadline?: string | null;
          description?: string | null;
          goal_id?: string | null;
          id?: string;
          name?: string;
          progress?: number;
          start_date?: string | null;
          status?: Database["public"]["Enums"]["project_status"];
          updated_at?: string;
          user_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "projects_goal_id_fkey";
            columns: ["goal_id"];
            isOneToOne: false;
            referencedRelation: "goals";
            referencedColumns: ["id"];
          },
        ];
      };
      routine_completions: {
        Row: {
          completed_at: string;
          completion_date: string;
          id: string;
          routine_id: string;
          user_id: string;
        };
        Insert: {
          completed_at?: string;
          completion_date: string;
          id?: string;
          routine_id: string;
          user_id: string;
        };
        Update: {
          completed_at?: string;
          completion_date?: string;
          id?: string;
          routine_id?: string;
          user_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "routine_completions_routine_id_user_id_fkey";
            columns: ["routine_id", "user_id"];
            isOneToOne: false;
            referencedRelation: "routines";
            referencedColumns: ["id", "user_id"];
          },
        ];
      };
      routines: {
        Row: {
          created_at: string;
          description: string | null;
          id: string;
          is_active: boolean;
          name: string;
          sort_order: number;
          updated_at: string;
          user_id: string;
        };
        Insert: {
          created_at?: string;
          description?: string | null;
          id?: string;
          is_active?: boolean;
          name: string;
          sort_order?: number;
          updated_at?: string;
          user_id: string;
        };
        Update: {
          created_at?: string;
          description?: string | null;
          id?: string;
          is_active?: boolean;
          name?: string;
          sort_order?: number;
          updated_at?: string;
          user_id?: string;
        };
        Relationships: [];
      };
      tasks: {
        Row: {
          created_at: string;
          description: string | null;
          due_date: string | null;
          id: string;
          priority: Database["public"]["Enums"]["task_priority"];
          project_id: string | null;
          status: Database["public"]["Enums"]["task_status"];
          title: string;
          updated_at: string;
          user_id: string;
        };
        Insert: {
          created_at?: string;
          description?: string | null;
          due_date?: string | null;
          id?: string;
          priority?: Database["public"]["Enums"]["task_priority"];
          project_id?: string | null;
          status?: Database["public"]["Enums"]["task_status"];
          title: string;
          updated_at?: string;
          user_id: string;
        };
        Update: {
          created_at?: string;
          description?: string | null;
          due_date?: string | null;
          id?: string;
          priority?: Database["public"]["Enums"]["task_priority"];
          project_id?: string | null;
          status?: Database["public"]["Enums"]["task_status"];
          title?: string;
          updated_at?: string;
          user_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "tasks_project_id_fkey";
            columns: ["project_id"];
            isOneToOne: false;
            referencedRelation: "projects";
            referencedColumns: ["id"];
          },
        ];
      };
      transactions: {
        Row: {
          amount: number;
          category: string | null;
          created_at: string;
          description: string | null;
          id: string;
          income_id: string | null;
          transaction_date: string;
          type: Database["public"]["Enums"]["transaction_type"];
          updated_at: string;
          user_id: string;
        };
        Insert: {
          amount: number;
          category?: string | null;
          created_at?: string;
          description?: string | null;
          id?: string;
          income_id?: string | null;
          transaction_date?: string;
          type: Database["public"]["Enums"]["transaction_type"];
          updated_at?: string;
          user_id: string;
        };
        Update: {
          amount?: number;
          category?: string | null;
          created_at?: string;
          description?: string | null;
          id?: string;
          income_id?: string | null;
          transaction_date?: string;
          type?: Database["public"]["Enums"]["transaction_type"];
          updated_at?: string;
          user_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "transactions_income_id_fkey";
            columns: ["income_id"];
            isOneToOne: false;
            referencedRelation: "transactions";
            referencedColumns: ["id"];
          },
        ];
      };
    };
    Views: {
      [_ in never]: never;
    };
    Functions: {
      business_account_balances: {
        Args: Record<PropertyKey, never>;
        Returns: {
          id: string;
          name: string;
          account_type: string;
          currency: string;
          opening_balance: number;
          balance: number;
        }[];
      };
      create_business_customer_transaction: {
        Args: {
          p_idempotency_key: string;
          p_customer_id: string;
          p_receipt_account_id: string;
          p_payout_account_id: string;
          p_transaction_date: string;
          p_htg_received: number;
          p_usd_sent: number;
          p_exchange_rate: number | null;
          p_service_fee_usd: number | null;
          p_crypto_cost_usd: number | null;
          p_transfer_fee_usd: number;
          p_other_expenses_usd: number | null;
          p_reference_code: string | null;
          p_notes: string | null;
        };
        Returns: string;
      };
      create_business_customer_transaction_with_due_date: {
        Args: {
          p_idempotency_key: string;
          p_customer_id: string;
          p_receipt_account_id: string;
          p_payout_account_id: string;
          p_transaction_date: string;
          p_htg_received: number;
          p_usd_sent: number;
          p_exchange_rate: number | null;
          p_service_fee_usd: number | null;
          p_crypto_cost_usd: number | null;
          p_transfer_fee_usd: number;
          p_other_expenses_usd: number | null;
          p_reference_code: string | null;
          p_notes: string | null;
          p_due_date: string | null;
        };
        Returns: string;
      };
      create_business_customer_payment: {
        Args: {
          p_idempotency_key: string;
          p_customer_transaction_id: string;
          p_account_id: string;
          p_amount: number;
          p_currency: string;
          p_payment_method: string;
          p_payment_date: string;
          p_reference: string | null;
          p_notes: string | null;
        };
        Returns: string;
      };
      create_business_loan: {
        Args: {
          p_idempotency_key: string;
          p_customer_id: string;
          p_account_id: string;
          p_principal_amount: number;
          p_currency: string;
          p_issued_date: string;
          p_due_date: string | null;
          p_interest_amount: number;
          p_fee_amount: number;
          p_notes: string | null;
        };
        Returns: string;
      };
      create_business_loan_repayment: {
        Args: {
          p_idempotency_key: string;
          p_loan_id: string;
          p_account_id: string;
          p_amount: number;
          p_currency: string;
          p_repayment_date: string;
          p_reference: string | null;
          p_notes: string | null;
        };
        Returns: string;
      };
      create_business_funding: {
        Args: {
          p_idempotency_key: string;
          p_funding_type: string;
          p_source_account_id: string | null;
          p_destination_account_id: string;
          p_source_amount: number | null;
          p_credited_amount: number;
          p_fee_amount: number;
          p_fee_usd: number | null;
          p_crypto_quantity: number | null;
          p_crypto_unit_price_usd: number | null;
          p_funding_date: string;
          p_reference_code: string | null;
          p_notes: string | null;
        };
        Returns: string;
      };
      create_business_expense: {
        Args: {
          p_idempotency_key: string;
          p_paid_from_account_id: string;
          p_category: string;
          p_amount: number;
          p_currency: string;
          p_usd_exchange_rate: number | null;
          p_expense_date: string;
          p_notes: string | null;
        };
        Returns: string;
      };
      create_business_adjustment: {
        Args: {
          p_idempotency_key: string;
          p_account_id: string;
          p_amount: number;
          p_reason: string;
        };
        Returns: string;
      };
      complete_business_operation: {
        Args: { p_operation_type: string; p_operation_id: string };
        Returns: undefined;
      };
      complete_business_transfer: {
        Args: { p_operation_id: string };
        Returns: undefined;
      };
      complete_business_non_transfer_operation: {
        Args: { p_operation_type: string; p_operation_id: string };
        Returns: undefined;
      };
      close_business_operation: {
        Args: { p_operation_type: string; p_operation_id: string; p_status: string };
        Returns: undefined;
      };
      reverse_business_operation: {
        Args: { p_operation_type: string; p_operation_id: string };
        Returns: undefined;
      };
      pay_future_expense: {
        Args: {
          p_future_expense_id: string;
          p_paid_date?: string;
        };
        Returns: string;
      };
    };
    Enums: {
      goal_status: "active" | "paused" | "completed" | "archived";
      project_status: "planning" | "active" | "on_hold" | "completed" | "archived";
      task_priority: "low" | "medium" | "high";
      task_status: "todo" | "in_progress" | "done";
      transaction_type: "income" | "expense";
    };
    CompositeTypes: {
      [_ in never]: never;
    };
  };
};

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">;

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">];

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R;
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] & DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R;
      }
      ? R
      : never
    : never;

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    keyof DefaultSchema["Tables"] | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I;
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I;
      }
      ? I
      : never
    : never;

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    keyof DefaultSchema["Tables"] | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U;
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U;
      }
      ? U
      : never
    : never;

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    keyof DefaultSchema["Enums"] | { schema: keyof DatabaseWithoutInternals },
  EnumName extends (DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never) = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never;

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    keyof DefaultSchema["CompositeTypes"] | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends (PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never) = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never;

export const Constants = {
  public: {
    Enums: {
      goal_status: ["active", "paused", "completed", "archived"],
      project_status: ["planning", "active", "on_hold", "completed", "archived"],
      task_priority: ["low", "medium", "high"],
      task_status: ["todo", "in_progress", "done"],
      transaction_type: ["income", "expense"],
    },
  },
} as const;
