export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[];

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "14.5";
  };
  public: {
    Tables: {
      admin_audit: {
        Row: {
          action: string;
          actor_email: string | null;
          actor_id: string | null;
          created_at: string;
          details: Json;
          id: string;
        };
        Insert: {
          action: string;
          actor_email?: string | null;
          actor_id?: string | null;
          created_at?: string;
          details?: Json;
          id?: string;
        };
        Update: {
          action?: string;
          actor_email?: string | null;
          actor_id?: string | null;
          created_at?: string;
          details?: Json;
          id?: string;
        };
        Relationships: [];
      };
      admin_audit_logs: {
        Row: {
          action: string;
          admin_email: string | null;
          admin_user_id: string | null;
          created_at: string;
          id: string;
          metadata: Json;
          reason: string | null;
          target_email: string | null;
          target_user_id: string | null;
        };
        Insert: {
          action: string;
          admin_email?: string | null;
          admin_user_id?: string | null;
          created_at?: string;
          id?: string;
          metadata?: Json;
          reason?: string | null;
          target_email?: string | null;
          target_user_id?: string | null;
        };
        Update: {
          action?: string;
          admin_email?: string | null;
          admin_user_id?: string | null;
          created_at?: string;
          id?: string;
          metadata?: Json;
          reason?: string | null;
          target_email?: string | null;
          target_user_id?: string | null;
        };
        Relationships: [];
      };
      agenda: {
        Row: {
          created_at: string;
          id: string;
          match_id: string;
          status: string;
          user_id: string | null;
        };
        Insert: {
          created_at?: string;
          id?: string;
          match_id: string;
          status?: string;
          user_id?: string | null;
        };
        Update: {
          created_at?: string;
          id?: string;
          match_id?: string;
          status?: string;
          user_id?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: "agenda_match_id_fkey";
            columns: ["match_id"];
            isOneToOne: true;
            referencedRelation: "matches";
            referencedColumns: ["id"];
          },
        ];
      };
      app_settings: {
        Row: {
          accent: string;
          agency: string | null;
          city: string | null;
          company: string | null;
          created_at: string;
          default_credit: string | null;
          email: string | null;
          favorite_competitions: Json;
          favorite_states: Json;
          first_day_of_week: number;
          full_name: string | null;
          id: string;
          instagram: string | null;
          language: string;
          logo_url: string | null;
          max_radius_km: number | null;
          min_value: number | null;
          phone: string | null;
          photo_url: string | null;
          primary_sport: string;
          sports: Json;
          state: string | null;
          theme: string;
          updated_at: string;
          user_id: string | null;
          website: string | null;
        };
        Insert: {
          accent?: string;
          agency?: string | null;
          city?: string | null;
          company?: string | null;
          created_at?: string;
          default_credit?: string | null;
          email?: string | null;
          favorite_competitions?: Json;
          favorite_states?: Json;
          first_day_of_week?: number;
          full_name?: string | null;
          id?: string;
          instagram?: string | null;
          language?: string;
          logo_url?: string | null;
          max_radius_km?: number | null;
          min_value?: number | null;
          phone?: string | null;
          photo_url?: string | null;
          primary_sport?: string;
          sports?: Json;
          state?: string | null;
          theme?: string;
          updated_at?: string;
          user_id?: string | null;
          website?: string | null;
        };
        Update: {
          accent?: string;
          agency?: string | null;
          city?: string | null;
          company?: string | null;
          created_at?: string;
          default_credit?: string | null;
          email?: string | null;
          favorite_competitions?: Json;
          favorite_states?: Json;
          first_day_of_week?: number;
          full_name?: string | null;
          id?: string;
          instagram?: string | null;
          language?: string;
          logo_url?: string | null;
          max_radius_km?: number | null;
          min_value?: number | null;
          phone?: string | null;
          photo_url?: string | null;
          primary_sport?: string;
          sports?: Json;
          state?: string | null;
          theme?: string;
          updated_at?: string;
          user_id?: string | null;
          website?: string | null;
        };
        Relationships: [];
      };
      athlete_data_sources: {
        Row: {
          category: string | null;
          created_at: string;
          deleted_at: string | null;
          id: string;
          last_error: string | null;
          last_sync_at: string | null;
          name: string;
          provider: string;
          sport: string | null;
          status: string;
          team_id: string | null;
          updated_at: string;
          url: string;
          user_id: string;
        };
        Insert: {
          category?: string | null;
          created_at?: string;
          deleted_at?: string | null;
          id?: string;
          last_error?: string | null;
          last_sync_at?: string | null;
          name: string;
          provider: string;
          sport?: string | null;
          status?: string;
          team_id?: string | null;
          updated_at?: string;
          url: string;
          user_id?: string;
        };
        Update: {
          category?: string | null;
          created_at?: string;
          deleted_at?: string | null;
          id?: string;
          last_error?: string | null;
          last_sync_at?: string | null;
          name?: string;
          provider?: string;
          sport?: string | null;
          status?: string;
          team_id?: string | null;
          updated_at?: string;
          url?: string;
          user_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "athlete_data_sources_team_id_fkey";
            columns: ["team_id"];
            isOneToOne: false;
            referencedRelation: "teams";
            referencedColumns: ["id"];
          },
        ];
      };
      athlete_event_engagements: {
        Row: {
          athlete_id: string;
          contact_status: string;
          contacted_at: string | null;
          created_at: string;
          event_category_id: string | null;
          event_id: string;
          id: string;
          next_action: string | null;
          no_response: boolean;
          notes: string | null;
          package_name: string | null;
          package_status: string;
          package_value: number | null;
          updated_at: string;
          user_id: string;
        };
        Insert: {
          athlete_id: string;
          contact_status?: string;
          contacted_at?: string | null;
          created_at?: string;
          event_category_id?: string | null;
          event_id: string;
          id?: string;
          next_action?: string | null;
          no_response?: boolean;
          notes?: string | null;
          package_name?: string | null;
          package_status?: string;
          package_value?: number | null;
          updated_at?: string;
          user_id?: string;
        };
        Update: {
          athlete_id?: string;
          contact_status?: string;
          contacted_at?: string | null;
          created_at?: string;
          event_category_id?: string | null;
          event_id?: string;
          id?: string;
          next_action?: string | null;
          no_response?: boolean;
          notes?: string | null;
          package_name?: string | null;
          package_status?: string;
          package_value?: number | null;
          updated_at?: string;
          user_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "athlete_event_engagements_athlete_id_fkey";
            columns: ["athlete_id"];
            isOneToOne: false;
            referencedRelation: "athletes";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "athlete_event_engagements_event_category_id_fkey";
            columns: ["event_category_id"];
            isOneToOne: false;
            referencedRelation: "event_categories";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "athlete_event_engagements_event_id_fkey";
            columns: ["event_id"];
            isOneToOne: false;
            referencedRelation: "events";
            referencedColumns: ["id"];
          },
        ];
      };
      athlete_match_engagements: {
        Row: {
          athlete_id: string;
          contact_status: string;
          contacted_at: string | null;
          created_at: string;
          id: string;
          match_id: string;
          next_action: string | null;
          no_response: boolean;
          notes: string | null;
          package_name: string | null;
          package_status: string;
          package_value: number | null;
          updated_at: string;
          user_id: string;
        };
        Insert: {
          athlete_id: string;
          contact_status?: string;
          contacted_at?: string | null;
          created_at?: string;
          id?: string;
          match_id: string;
          next_action?: string | null;
          no_response?: boolean;
          notes?: string | null;
          package_name?: string | null;
          package_status?: string;
          package_value?: number | null;
          updated_at?: string;
          user_id?: string;
        };
        Update: {
          athlete_id?: string;
          contact_status?: string;
          contacted_at?: string | null;
          created_at?: string;
          id?: string;
          match_id?: string;
          next_action?: string | null;
          no_response?: boolean;
          notes?: string | null;
          package_name?: string | null;
          package_status?: string;
          package_value?: number | null;
          updated_at?: string;
          user_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "athlete_match_engagements_athlete_id_fkey";
            columns: ["athlete_id"];
            isOneToOne: false;
            referencedRelation: "athletes";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "athlete_match_engagements_match_id_fkey";
            columns: ["match_id"];
            isOneToOne: false;
            referencedRelation: "matches";
            referencedColumns: ["id"];
          },
        ];
      };
      athlete_source_links: {
        Row: {
          athlete_id: string;
          created_at: string;
          created_batch_id: string | null;
          created_by_source: boolean;
          external_player_id: string | null;
          id: string;
          last_seen_at: string | null;
          source_full_name: string | null;
          source_id: string;
          source_name: string | null;
          source_team_name: string | null;
          user_id: string;
        };
        Insert: {
          athlete_id: string;
          created_at?: string;
          created_batch_id?: string | null;
          created_by_source?: boolean;
          external_player_id?: string | null;
          id?: string;
          last_seen_at?: string | null;
          source_full_name?: string | null;
          source_id: string;
          source_name?: string | null;
          source_team_name?: string | null;
          user_id?: string;
        };
        Update: {
          athlete_id?: string;
          created_at?: string;
          created_batch_id?: string | null;
          created_by_source?: boolean;
          external_player_id?: string | null;
          id?: string;
          last_seen_at?: string | null;
          source_full_name?: string | null;
          source_id?: string;
          source_name?: string | null;
          source_team_name?: string | null;
          user_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "athlete_source_links_athlete_id_fkey";
            columns: ["athlete_id"];
            isOneToOne: false;
            referencedRelation: "athletes";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "athlete_source_links_source_id_fkey";
            columns: ["source_id"];
            isOneToOne: false;
            referencedRelation: "athlete_data_sources";
            referencedColumns: ["id"];
          },
        ];
      };
      athletes: {
        Row: {
          category: string | null;
          created_at: string;
          deleted_at: string | null;
          deleted_by: string | null;
          deletion_batch_id: string | null;
          email: string | null;
          full_name: string | null;
          id: string;
          instagram: string | null;
          name: string;
          nickname: string | null;
          notes: string | null;
          number: number | null;
          phone: string | null;
          photo_manual: boolean;
          photo_url: string | null;
          position: string | null;
          relationship: string;
          sport: string | null;
          status: string;
          team_id: string | null;
          updated_at: string;
          user_id: string | null;
          whatsapp: string | null;
        };
        Insert: {
          category?: string | null;
          created_at?: string;
          deleted_at?: string | null;
          deleted_by?: string | null;
          deletion_batch_id?: string | null;
          email?: string | null;
          full_name?: string | null;
          id?: string;
          instagram?: string | null;
          name: string;
          nickname?: string | null;
          notes?: string | null;
          number?: number | null;
          phone?: string | null;
          photo_manual?: boolean;
          photo_url?: string | null;
          position?: string | null;
          relationship?: string;
          sport?: string | null;
          status?: string;
          team_id?: string | null;
          updated_at?: string;
          user_id?: string | null;
          whatsapp?: string | null;
        };
        Update: {
          category?: string | null;
          created_at?: string;
          deleted_at?: string | null;
          deleted_by?: string | null;
          deletion_batch_id?: string | null;
          email?: string | null;
          full_name?: string | null;
          id?: string;
          instagram?: string | null;
          name?: string;
          nickname?: string | null;
          notes?: string | null;
          number?: number | null;
          phone?: string | null;
          photo_manual?: boolean;
          photo_url?: string | null;
          position?: string | null;
          relationship?: string;
          sport?: string | null;
          status?: string;
          team_id?: string | null;
          updated_at?: string;
          user_id?: string | null;
          whatsapp?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: "athletes_team_id_fkey";
            columns: ["team_id"];
            isOneToOne: false;
            referencedRelation: "teams";
            referencedColumns: ["id"];
          },
        ];
      };
      billing_events: {
        Row: {
          amount_cents: number | null;
          buyer_email: string | null;
          buyer_name: string | null;
          created_at: string;
          currency: string | null;
          error_reason: string | null;
          event: string;
          event_version: string | null;
          id: string;
          is_test: boolean;
          linked_manually: boolean;
          note: string | null;
          offer_id: string | null;
          payload: Json;
          processed: boolean;
          processed_at: string | null;
          product_id: string | null;
          provider: string;
          provider_event_id: string | null;
          result: string;
          status: string | null;
          transaction_id: string | null;
          user_id: string | null;
        };
        Insert: {
          amount_cents?: number | null;
          buyer_email?: string | null;
          buyer_name?: string | null;
          created_at?: string;
          currency?: string | null;
          error_reason?: string | null;
          event: string;
          event_version?: string | null;
          id?: string;
          is_test?: boolean;
          linked_manually?: boolean;
          note?: string | null;
          offer_id?: string | null;
          payload?: Json;
          processed?: boolean;
          processed_at?: string | null;
          product_id?: string | null;
          provider?: string;
          provider_event_id?: string | null;
          result?: string;
          status?: string | null;
          transaction_id?: string | null;
          user_id?: string | null;
        };
        Update: {
          amount_cents?: number | null;
          buyer_email?: string | null;
          buyer_name?: string | null;
          created_at?: string;
          currency?: string | null;
          error_reason?: string | null;
          event?: string;
          event_version?: string | null;
          id?: string;
          is_test?: boolean;
          linked_manually?: boolean;
          note?: string | null;
          offer_id?: string | null;
          payload?: Json;
          processed?: boolean;
          processed_at?: string | null;
          product_id?: string | null;
          provider?: string;
          provider_event_id?: string | null;
          result?: string;
          status?: string | null;
          transaction_id?: string | null;
          user_id?: string | null;
        };
        Relationships: [];
      };
      billing_secrets: {
        Row: {
          created_at: string;
          id: string;
          provider: string;
          updated_at: string;
          updated_by: string | null;
          webhook_token: string | null;
        };
        Insert: {
          created_at?: string;
          id?: string;
          provider: string;
          updated_at?: string;
          updated_by?: string | null;
          webhook_token?: string | null;
        };
        Update: {
          created_at?: string;
          id?: string;
          provider?: string;
          updated_at?: string;
          updated_by?: string | null;
          webhook_token?: string | null;
        };
        Relationships: [];
      };
      billing_settings: {
        Row: {
          checkout_url: string | null;
          created_at: string;
          environment: string;
          id: string;
          offer_id: string | null;
          offer_name: string | null;
          price_cents: number | null;
          product_id: string | null;
          product_name: string | null;
          provider: string;
          updated_at: string;
        };
        Insert: {
          checkout_url?: string | null;
          created_at?: string;
          environment?: string;
          id?: string;
          offer_id?: string | null;
          offer_name?: string | null;
          price_cents?: number | null;
          product_id?: string | null;
          product_name?: string | null;
          provider?: string;
          updated_at?: string;
        };
        Update: {
          checkout_url?: string | null;
          created_at?: string;
          environment?: string;
          id?: string;
          offer_id?: string | null;
          offer_name?: string | null;
          price_cents?: number | null;
          product_id?: string | null;
          product_name?: string | null;
          provider?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      competitions: {
        Row: {
          active: boolean;
          category: string;
          color: string;
          country: string;
          created_at: string;
          deleted_at: string | null;
          deleted_by: string | null;
          description: string | null;
          gender: string | null;
          id: string;
          logo_url: string | null;
          name: string;
          season: string;
          short_name: string | null;
          sport_key: string;
          state: string | null;
          type: string | null;
          updated_at: string;
          user_id: string;
        };
        Insert: {
          active?: boolean;
          category?: string;
          color?: string;
          country?: string;
          created_at?: string;
          deleted_at?: string | null;
          deleted_by?: string | null;
          description?: string | null;
          gender?: string | null;
          id?: string;
          logo_url?: string | null;
          name: string;
          season?: string;
          short_name?: string | null;
          sport_key?: string;
          state?: string | null;
          type?: string | null;
          updated_at?: string;
          user_id?: string;
        };
        Update: {
          active?: boolean;
          category?: string;
          color?: string;
          country?: string;
          created_at?: string;
          deleted_at?: string | null;
          deleted_by?: string | null;
          description?: string | null;
          gender?: string | null;
          id?: string;
          logo_url?: string | null;
          name?: string;
          season?: string;
          short_name?: string | null;
          sport_key?: string;
          state?: string | null;
          type?: string | null;
          updated_at?: string;
          user_id?: string;
        };
        Relationships: [];
      };
      contact_messages: {
        Row: {
          created_at: string;
          email: string;
          id: string;
          message: string;
          name: string;
        };
        Insert: {
          created_at?: string;
          email: string;
          id?: string;
          message: string;
          name: string;
        };
        Update: {
          created_at?: string;
          email?: string;
          id?: string;
          message?: string;
          name?: string;
        };
        Relationships: [];
      };
      content_sources: {
        Row: {
          competition_id: string | null;
          config: Json;
          created_at: string;
          id: string;
          last_error: string | null;
          last_synced_at: string | null;
          name: string;
          status: string;
          type: string;
          updated_at: string;
          url: string | null;
          user_id: string | null;
        };
        Insert: {
          competition_id?: string | null;
          config?: Json;
          created_at?: string;
          id?: string;
          last_error?: string | null;
          last_synced_at?: string | null;
          name: string;
          status?: string;
          type?: string;
          updated_at?: string;
          url?: string | null;
          user_id?: string | null;
        };
        Update: {
          competition_id?: string | null;
          config?: Json;
          created_at?: string;
          id?: string;
          last_error?: string | null;
          last_synced_at?: string | null;
          name?: string;
          status?: string;
          type?: string;
          updated_at?: string;
          url?: string | null;
          user_id?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: "content_sources_competition_id_fkey";
            columns: ["competition_id"];
            isOneToOne: false;
            referencedRelation: "competitions";
            referencedColumns: ["id"];
          },
        ];
      };
      coverages: {
        Row: {
          completed_at: string | null;
          created_at: string;
          credential_status: string;
          id: string;
          match_id: string;
          notes: string | null;
          updated_at: string;
          user_id: string | null;
        };
        Insert: {
          completed_at?: string | null;
          created_at?: string;
          credential_status?: string;
          id?: string;
          match_id: string;
          notes?: string | null;
          updated_at?: string;
          user_id?: string | null;
        };
        Update: {
          completed_at?: string | null;
          created_at?: string;
          credential_status?: string;
          id?: string;
          match_id?: string;
          notes?: string | null;
          updated_at?: string;
          user_id?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: "coverages_match_id_fkey";
            columns: ["match_id"];
            isOneToOne: true;
            referencedRelation: "matches";
            referencedColumns: ["id"];
          },
        ];
      };
      data_sources: {
        Row: {
          competition_id: string | null;
          created_at: string;
          deleted_at: string | null;
          deleted_by: string | null;
          file_name: string | null;
          games_count: number;
          id: string;
          last_error: string | null;
          last_sync: string | null;
          last_update: string | null;
          name: string;
          season: string;
          status: string;
          type: string;
          updated_at: string;
          url: string | null;
          user_id: string | null;
        };
        Insert: {
          competition_id?: string | null;
          created_at?: string;
          deleted_at?: string | null;
          deleted_by?: string | null;
          file_name?: string | null;
          games_count?: number;
          id?: string;
          last_error?: string | null;
          last_sync?: string | null;
          last_update?: string | null;
          name: string;
          season?: string;
          status?: string;
          type?: string;
          updated_at?: string;
          url?: string | null;
          user_id?: string | null;
        };
        Update: {
          competition_id?: string | null;
          created_at?: string;
          deleted_at?: string | null;
          deleted_by?: string | null;
          file_name?: string | null;
          games_count?: number;
          id?: string;
          last_error?: string | null;
          last_sync?: string | null;
          last_update?: string | null;
          name?: string;
          season?: string;
          status?: string;
          type?: string;
          updated_at?: string;
          url?: string | null;
          user_id?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: "data_sources_competition_id_fkey";
            columns: ["competition_id"];
            isOneToOne: false;
            referencedRelation: "competitions";
            referencedColumns: ["id"];
          },
        ];
      };
      event_categories: {
        Row: {
          created_at: string;
          event_id: string;
          id: string;
          name: string;
          user_id: string;
        };
        Insert: {
          created_at?: string;
          event_id: string;
          id?: string;
          name: string;
          user_id?: string;
        };
        Update: {
          created_at?: string;
          event_id?: string;
          id?: string;
          name?: string;
          user_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "event_categories_event_id_fkey";
            columns: ["event_id"];
            isOneToOne: false;
            referencedRelation: "events";
            referencedColumns: ["id"];
          },
        ];
      };
      event_coverages: {
        Row: {
          completed_at: string | null;
          created_at: string;
          credential_status: string;
          event_id: string;
          id: string;
          notes: string | null;
          updated_at: string;
          user_id: string;
        };
        Insert: {
          completed_at?: string | null;
          created_at?: string;
          credential_status?: string;
          event_id: string;
          id?: string;
          notes?: string | null;
          updated_at?: string;
          user_id?: string;
        };
        Update: {
          completed_at?: string | null;
          created_at?: string;
          credential_status?: string;
          event_id?: string;
          id?: string;
          notes?: string | null;
          updated_at?: string;
          user_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "event_coverages_event_id_fkey";
            columns: ["event_id"];
            isOneToOne: false;
            referencedRelation: "events";
            referencedColumns: ["id"];
          },
        ];
      };
      events: {
        Row: {
          accreditation_required: boolean;
          city: string | null;
          created_at: string;
          deleted_at: string | null;
          end_date: string | null;
          end_time: string | null;
          id: string;
          name: string;
          notes: string | null;
          official_url: string | null;
          organizer: string | null;
          sport: string;
          start_date: string;
          start_time: string | null;
          state: string | null;
          status: string;
          updated_at: string;
          user_id: string;
          venue: string | null;
        };
        Insert: {
          accreditation_required?: boolean;
          city?: string | null;
          created_at?: string;
          deleted_at?: string | null;
          end_date?: string | null;
          end_time?: string | null;
          id?: string;
          name: string;
          notes?: string | null;
          official_url?: string | null;
          organizer?: string | null;
          sport: string;
          start_date: string;
          start_time?: string | null;
          state?: string | null;
          status?: string;
          updated_at?: string;
          user_id?: string;
          venue?: string | null;
        };
        Update: {
          accreditation_required?: boolean;
          city?: string | null;
          created_at?: string;
          deleted_at?: string | null;
          end_date?: string | null;
          end_time?: string | null;
          id?: string;
          name?: string;
          notes?: string | null;
          official_url?: string | null;
          organizer?: string | null;
          sport?: string;
          start_date?: string;
          start_time?: string | null;
          state?: string | null;
          status?: string;
          updated_at?: string;
          user_id?: string;
          venue?: string | null;
        };
        Relationships: [];
      };
      feature_interest: {
        Row: {
          created_at: string;
          feature: string;
          id: string;
          user_id: string;
        };
        Insert: {
          created_at?: string;
          feature: string;
          id?: string;
          user_id?: string;
        };
        Update: {
          created_at?: string;
          feature?: string;
          id?: string;
          user_id?: string;
        };
        Relationships: [];
      };
      feature_suggestions: {
        Row: {
          admin_note: string | null;
          category: string;
          created_at: string;
          description: string;
          id: string;
          status: string;
          title: string;
          updated_at: string;
          user_id: string;
        };
        Insert: {
          admin_note?: string | null;
          category?: string;
          created_at?: string;
          description: string;
          id?: string;
          status?: string;
          title: string;
          updated_at?: string;
          user_id?: string;
        };
        Update: {
          admin_note?: string | null;
          category?: string;
          created_at?: string;
          description?: string;
          id?: string;
          status?: string;
          title?: string;
          updated_at?: string;
          user_id?: string;
        };
        Relationships: [];
      };
      financial_categories: {
        Row: {
          created_at: string;
          icon_key: string | null;
          id: string;
          is_active: boolean;
          name: string;
          sort_order: number;
          type: string;
          updated_at: string;
          user_id: string;
        };
        Insert: {
          created_at?: string;
          icon_key?: string | null;
          id?: string;
          is_active?: boolean;
          name: string;
          sort_order?: number;
          type: string;
          updated_at?: string;
          user_id: string;
        };
        Update: {
          created_at?: string;
          icon_key?: string | null;
          id?: string;
          is_active?: boolean;
          name?: string;
          sort_order?: number;
          type?: string;
          updated_at?: string;
          user_id?: string;
        };
        Relationships: [];
      };
      financial_entries: {
        Row: {
          amount: number;
          category: string | null;
          coverage_date: string | null;
          coverage_label: string | null;
          coverage_type: string | null;
          created_at: string;
          description: string | null;
          event_id: string | null;
          id: string;
          match_id: string | null;
          notes: string | null;
          occurred_at: string;
          type: string;
          updated_at: string;
          user_id: string;
        };
        Insert: {
          amount: number;
          category?: string | null;
          coverage_date?: string | null;
          coverage_label?: string | null;
          coverage_type?: string | null;
          created_at?: string;
          description?: string | null;
          event_id?: string | null;
          id?: string;
          match_id?: string | null;
          notes?: string | null;
          occurred_at?: string;
          type: string;
          updated_at?: string;
          user_id?: string;
        };
        Update: {
          amount?: number;
          category?: string | null;
          coverage_date?: string | null;
          coverage_label?: string | null;
          coverage_type?: string | null;
          created_at?: string;
          description?: string | null;
          event_id?: string | null;
          id?: string;
          match_id?: string | null;
          notes?: string | null;
          occurred_at?: string;
          type?: string;
          updated_at?: string;
          user_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "financial_entries_event_id_fkey";
            columns: ["event_id"];
            isOneToOne: false;
            referencedRelation: "events";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "financial_entries_match_id_fkey";
            columns: ["match_id"];
            isOneToOne: false;
            referencedRelation: "matches";
            referencedColumns: ["id"];
          },
        ];
      };
      help_page_sections: {
        Row: {
          created_at: string;
          id: string;
          is_visible: boolean;
          section_key: string;
          sort_order: number;
          updated_at: string;
        };
        Insert: {
          created_at?: string;
          id?: string;
          is_visible?: boolean;
          section_key: string;
          sort_order?: number;
          updated_at?: string;
        };
        Update: {
          created_at?: string;
          id?: string;
          is_visible?: boolean;
          section_key?: string;
          sort_order?: number;
          updated_at?: string;
        };
        Relationships: [];
      };
      import_history: {
        Row: {
          batch: string | null;
          created_at: string;
          data_source_id: string | null;
          file_hash: string | null;
          file_name: string | null;
          found: number;
          id: string;
          imported: number;
          message: string | null;
          skipped: number;
          source_type: string;
          status: string;
          updated: number;
          user_id: string | null;
        };
        Insert: {
          batch?: string | null;
          created_at?: string;
          data_source_id?: string | null;
          file_hash?: string | null;
          file_name?: string | null;
          found?: number;
          id?: string;
          imported?: number;
          message?: string | null;
          skipped?: number;
          source_type?: string;
          status?: string;
          updated?: number;
          user_id?: string | null;
        };
        Update: {
          batch?: string | null;
          created_at?: string;
          data_source_id?: string | null;
          file_hash?: string | null;
          file_name?: string | null;
          found?: number;
          id?: string;
          imported?: number;
          message?: string | null;
          skipped?: number;
          source_type?: string;
          status?: string;
          updated?: number;
          user_id?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: "import_history_data_source_id_fkey";
            columns: ["data_source_id"];
            isOneToOne: false;
            referencedRelation: "data_sources";
            referencedColumns: ["id"];
          },
        ];
      };
      match_radar: {
        Row: {
          attention_points: Json;
          coverage_id: string | null;
          created_at: string;
          id: string;
          last_synced_at: string | null;
          match_id: string;
          news: Json;
          photo_suggestions: Json;
          sources_used: Json;
          status: string;
          summary: string | null;
          updated_at: string;
          user_id: string | null;
        };
        Insert: {
          attention_points?: Json;
          coverage_id?: string | null;
          created_at?: string;
          id?: string;
          last_synced_at?: string | null;
          match_id: string;
          news?: Json;
          photo_suggestions?: Json;
          sources_used?: Json;
          status?: string;
          summary?: string | null;
          updated_at?: string;
          user_id?: string | null;
        };
        Update: {
          attention_points?: Json;
          coverage_id?: string | null;
          created_at?: string;
          id?: string;
          last_synced_at?: string | null;
          match_id?: string;
          news?: Json;
          photo_suggestions?: Json;
          sources_used?: Json;
          status?: string;
          summary?: string | null;
          updated_at?: string;
          user_id?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: "match_radar_coverage_id_fkey";
            columns: ["coverage_id"];
            isOneToOne: false;
            referencedRelation: "coverages";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "match_radar_match_id_fkey";
            columns: ["match_id"];
            isOneToOne: true;
            referencedRelation: "matches";
            referencedColumns: ["id"];
          },
        ];
      };
      matches: {
        Row: {
          away_score: number | null;
          away_team: string;
          away_team_id: string | null;
          broadcast: string | null;
          category: string | null;
          city: string | null;
          competition_id: string | null;
          created_at: string;
          date: string;
          deleted_at: string | null;
          deleted_by: string | null;
          deletion_batch_id: string | null;
          external_id: string | null;
          group_name: string | null;
          home_score: number | null;
          home_team: string;
          home_team_id: string | null;
          id: string;
          import_batch: string | null;
          import_batch_id: string | null;
          import_type: string | null;
          imported_at: string | null;
          match_number: string | null;
          match_status: string | null;
          notes: string | null;
          participants_tbd: boolean;
          phase: string | null;
          round: string | null;
          source: string;
          source_file: string | null;
          source_id: string | null;
          state: string | null;
          time: string;
          updated_at: string;
          user_id: string | null;
          venue: string | null;
        };
        Insert: {
          away_score?: number | null;
          away_team: string;
          away_team_id?: string | null;
          broadcast?: string | null;
          category?: string | null;
          city?: string | null;
          competition_id?: string | null;
          created_at?: string;
          date: string;
          deleted_at?: string | null;
          deleted_by?: string | null;
          deletion_batch_id?: string | null;
          external_id?: string | null;
          group_name?: string | null;
          home_score?: number | null;
          home_team: string;
          home_team_id?: string | null;
          id?: string;
          import_batch?: string | null;
          import_batch_id?: string | null;
          import_type?: string | null;
          imported_at?: string | null;
          match_number?: string | null;
          match_status?: string | null;
          notes?: string | null;
          participants_tbd?: boolean;
          phase?: string | null;
          round?: string | null;
          source?: string;
          source_file?: string | null;
          source_id?: string | null;
          state?: string | null;
          time?: string;
          updated_at?: string;
          user_id?: string | null;
          venue?: string | null;
        };
        Update: {
          away_score?: number | null;
          away_team?: string;
          away_team_id?: string | null;
          broadcast?: string | null;
          category?: string | null;
          city?: string | null;
          competition_id?: string | null;
          created_at?: string;
          date?: string;
          deleted_at?: string | null;
          deleted_by?: string | null;
          deletion_batch_id?: string | null;
          external_id?: string | null;
          group_name?: string | null;
          home_score?: number | null;
          home_team?: string;
          home_team_id?: string | null;
          id?: string;
          import_batch?: string | null;
          import_batch_id?: string | null;
          import_type?: string | null;
          imported_at?: string | null;
          match_number?: string | null;
          match_status?: string | null;
          notes?: string | null;
          participants_tbd?: boolean;
          phase?: string | null;
          round?: string | null;
          source?: string;
          source_file?: string | null;
          source_id?: string | null;
          state?: string | null;
          time?: string;
          updated_at?: string;
          user_id?: string | null;
          venue?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: "matches_away_team_id_fkey";
            columns: ["away_team_id"];
            isOneToOne: false;
            referencedRelation: "teams";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "matches_competition_id_fkey";
            columns: ["competition_id"];
            isOneToOne: false;
            referencedRelation: "competitions";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "matches_home_team_id_fkey";
            columns: ["home_team_id"];
            isOneToOne: false;
            referencedRelation: "teams";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "matches_source_id_fkey";
            columns: ["source_id"];
            isOneToOne: false;
            referencedRelation: "data_sources";
            referencedColumns: ["id"];
          },
        ];
      };
      news_items: {
        Row: {
          article_content_available: boolean;
          article_enriched_at: string | null;
          article_highlights: Json;
          article_summary: string | null;
          cover_image_url: string | null;
          created_at: string;
          entities: Json;
          excerpt: string | null;
          fact_key: string | null;
          feed_type: string;
          guid: string | null;
          id: string;
          image_url: string | null;
          published_at: string | null;
          related_athlete_ids: Json;
          related_competition_ids: Json;
          related_match_ids: Json;
          related_team_ids: Json;
          source_id: string | null;
          status: string;
          summary: string | null;
          title: string;
          updated_at: string;
          url: string;
          user_id: string | null;
        };
        Insert: {
          article_content_available?: boolean;
          article_enriched_at?: string | null;
          article_highlights?: Json;
          article_summary?: string | null;
          cover_image_url?: string | null;
          created_at?: string;
          entities?: Json;
          excerpt?: string | null;
          fact_key?: string | null;
          feed_type?: string;
          guid?: string | null;
          id?: string;
          image_url?: string | null;
          published_at?: string | null;
          related_athlete_ids?: Json;
          related_competition_ids?: Json;
          related_match_ids?: Json;
          related_team_ids?: Json;
          source_id?: string | null;
          status?: string;
          summary?: string | null;
          title: string;
          updated_at?: string;
          url: string;
          user_id?: string | null;
        };
        Update: {
          article_content_available?: boolean;
          article_enriched_at?: string | null;
          article_highlights?: Json;
          article_summary?: string | null;
          cover_image_url?: string | null;
          created_at?: string;
          entities?: Json;
          excerpt?: string | null;
          fact_key?: string | null;
          feed_type?: string;
          guid?: string | null;
          id?: string;
          image_url?: string | null;
          published_at?: string | null;
          related_athlete_ids?: Json;
          related_competition_ids?: Json;
          related_match_ids?: Json;
          related_team_ids?: Json;
          source_id?: string | null;
          status?: string;
          summary?: string | null;
          title?: string;
          updated_at?: string;
          url?: string;
          user_id?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: "news_items_source_id_fkey";
            columns: ["source_id"];
            isOneToOne: false;
            referencedRelation: "content_sources";
            referencedColumns: ["id"];
          },
        ];
      };
      operation_batches: {
        Row: {
          affected_count: number;
          created_at: string;
          description: string | null;
          entity_type: string;
          id: string;
          import_batch_id: string | null;
          metadata: Json;
          operation_type: string;
          source_id: string | null;
          status: string;
          undone_at: string | null;
          undone_by: string | null;
          user_id: string;
        };
        Insert: {
          affected_count?: number;
          created_at?: string;
          description?: string | null;
          entity_type?: string;
          id?: string;
          import_batch_id?: string | null;
          metadata?: Json;
          operation_type: string;
          source_id?: string | null;
          status?: string;
          undone_at?: string | null;
          undone_by?: string | null;
          user_id?: string;
        };
        Update: {
          affected_count?: number;
          created_at?: string;
          description?: string | null;
          entity_type?: string;
          id?: string;
          import_batch_id?: string | null;
          metadata?: Json;
          operation_type?: string;
          source_id?: string | null;
          status?: string;
          undone_at?: string | null;
          undone_by?: string | null;
          user_id?: string;
        };
        Relationships: [];
      };
      plans: {
        Row: {
          active: boolean;
          billing_period: string;
          code: string;
          created_at: string;
          currency: string;
          description: string | null;
          features: Json;
          id: string;
          lifetime: boolean;
          limits: Json;
          name: string;
          price_cents: number;
          sort_order: number;
          updated_at: string;
          visible: boolean;
        };
        Insert: {
          active?: boolean;
          billing_period?: string;
          code: string;
          created_at?: string;
          currency?: string;
          description?: string | null;
          features?: Json;
          id?: string;
          lifetime?: boolean;
          limits?: Json;
          name: string;
          price_cents?: number;
          sort_order?: number;
          updated_at?: string;
          visible?: boolean;
        };
        Update: {
          active?: boolean;
          billing_period?: string;
          code?: string;
          created_at?: string;
          currency?: string;
          description?: string | null;
          features?: Json;
          id?: string;
          lifetime?: boolean;
          limits?: Json;
          name?: string;
          price_cents?: number;
          sort_order?: number;
          updated_at?: string;
          visible?: boolean;
        };
        Relationships: [];
      };
      product_update_reads: {
        Row: {
          id: string;
          read_at: string;
          update_id: string;
          user_id: string;
        };
        Insert: {
          id?: string;
          read_at?: string;
          update_id: string;
          user_id: string;
        };
        Update: {
          id?: string;
          read_at?: string;
          update_id?: string;
          user_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "product_update_reads_update_id_fkey";
            columns: ["update_id"];
            isOneToOne: false;
            referencedRelation: "product_updates";
            referencedColumns: ["id"];
          },
        ];
      };
      product_updates: {
        Row: {
          category: string;
          created_at: string;
          description: string;
          icon: string | null;
          id: string;
          is_published: boolean;
          published_at: string;
          related_route: string | null;
          title: string;
          updated_at: string;
        };
        Insert: {
          category?: string;
          created_at?: string;
          description: string;
          icon?: string | null;
          id?: string;
          is_published?: boolean;
          published_at?: string;
          related_route?: string | null;
          title: string;
          updated_at?: string;
        };
        Update: {
          category?: string;
          created_at?: string;
          description?: string;
          icon?: string | null;
          id?: string;
          is_published?: boolean;
          published_at?: string;
          related_route?: string | null;
          title?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      profiles: {
        Row: {
          account_status: string;
          bio: string | null;
          blocked_at: string | null;
          blocked_by: string | null;
          blocked_reason: string | null;
          city: string | null;
          created_at: string;
          deleted_at: string | null;
          email: string | null;
          feedback_whatsapp_opt_in: boolean;
          feedback_whatsapp_opt_in_at: string | null;
          first_name: string | null;
          founder_community_interest: boolean;
          id: string;
          last_name: string | null;
          logo_url: string | null;
          onboarded: boolean;
          photo_url: string | null;
          post_trial_contacted_at: string | null;
          post_trial_contacted_by: string | null;
          professional_name: string | null;
          state: string | null;
          updated_at: string;
          user_id: string;
          whatsapp: string | null;
        };
        Insert: {
          account_status?: string;
          bio?: string | null;
          blocked_at?: string | null;
          blocked_by?: string | null;
          blocked_reason?: string | null;
          city?: string | null;
          created_at?: string;
          deleted_at?: string | null;
          email?: string | null;
          feedback_whatsapp_opt_in?: boolean;
          feedback_whatsapp_opt_in_at?: string | null;
          first_name?: string | null;
          founder_community_interest?: boolean;
          id?: string;
          last_name?: string | null;
          logo_url?: string | null;
          onboarded?: boolean;
          photo_url?: string | null;
          post_trial_contacted_at?: string | null;
          post_trial_contacted_by?: string | null;
          professional_name?: string | null;
          state?: string | null;
          updated_at?: string;
          user_id: string;
          whatsapp?: string | null;
        };
        Update: {
          account_status?: string;
          bio?: string | null;
          blocked_at?: string | null;
          blocked_by?: string | null;
          blocked_reason?: string | null;
          city?: string | null;
          created_at?: string;
          deleted_at?: string | null;
          email?: string | null;
          feedback_whatsapp_opt_in?: boolean;
          feedback_whatsapp_opt_in_at?: string | null;
          first_name?: string | null;
          founder_community_interest?: boolean;
          id?: string;
          last_name?: string | null;
          logo_url?: string | null;
          onboarded?: boolean;
          photo_url?: string | null;
          post_trial_contacted_at?: string | null;
          post_trial_contacted_by?: string | null;
          professional_name?: string | null;
          state?: string | null;
          updated_at?: string;
          user_id?: string;
          whatsapp?: string | null;
        };
        Relationships: [];
      };
      teams: {
        Row: {
          abbreviation: string | null;
          category: string | null;
          city: string | null;
          created_at: string;
          gender: string | null;
          id: string;
          logo_local: string | null;
          logo_url: string | null;
          name: string;
          normalized_name: string | null;
          short_name: string | null;
          slug: string | null;
          sport_key: string;
          state: string | null;
          updated_at: string;
          user_id: string;
        };
        Insert: {
          abbreviation?: string | null;
          category?: string | null;
          city?: string | null;
          created_at?: string;
          gender?: string | null;
          id?: string;
          logo_local?: string | null;
          logo_url?: string | null;
          name: string;
          normalized_name?: string | null;
          short_name?: string | null;
          slug?: string | null;
          sport_key?: string;
          state?: string | null;
          updated_at?: string;
          user_id?: string;
        };
        Update: {
          abbreviation?: string | null;
          category?: string | null;
          city?: string | null;
          created_at?: string;
          gender?: string | null;
          id?: string;
          logo_local?: string | null;
          logo_url?: string | null;
          name?: string;
          normalized_name?: string | null;
          short_name?: string | null;
          slug?: string | null;
          sport_key?: string;
          state?: string | null;
          updated_at?: string;
          user_id?: string;
        };
        Relationships: [];
      };
      tutorial_videos: {
        Row: {
          category: string;
          created_at: string;
          description: string | null;
          id: string;
          is_featured: boolean;
          is_published: boolean;
          related_route: string | null;
          sort_order: number;
          title: string;
          updated_at: string;
          youtube_url: string;
          youtube_video_id: string;
        };
        Insert: {
          category?: string;
          created_at?: string;
          description?: string | null;
          id?: string;
          is_featured?: boolean;
          is_published?: boolean;
          related_route?: string | null;
          sort_order?: number;
          title: string;
          updated_at?: string;
          youtube_url: string;
          youtube_video_id: string;
        };
        Update: {
          category?: string;
          created_at?: string;
          description?: string | null;
          id?: string;
          is_featured?: boolean;
          is_published?: boolean;
          related_route?: string | null;
          sort_order?: number;
          title?: string;
          updated_at?: string;
          youtube_url?: string;
          youtube_video_id?: string;
        };
        Relationships: [];
      };
      user_access: {
        Row: {
          access_status: Database["public"]["Enums"]["access_status_t"];
          access_type: Database["public"]["Enums"]["access_type_t"];
          activated_at: string | null;
          billing_product_id: string | null;
          billing_provider: string | null;
          created_at: string;
          email: string | null;
          external_transaction_id: string | null;
          id: string;
          lifetime_access: boolean;
          plan_code: string | null;
          revoked_at: string | null;
          revoked_reason: string | null;
          source: string | null;
          trial_ends_at: string;
          trial_started_at: string;
          updated_at: string;
          user_id: string;
        };
        Insert: {
          access_status?: Database["public"]["Enums"]["access_status_t"];
          access_type?: Database["public"]["Enums"]["access_type_t"];
          activated_at?: string | null;
          billing_product_id?: string | null;
          billing_provider?: string | null;
          created_at?: string;
          email?: string | null;
          external_transaction_id?: string | null;
          id?: string;
          lifetime_access?: boolean;
          plan_code?: string | null;
          revoked_at?: string | null;
          revoked_reason?: string | null;
          source?: string | null;
          trial_ends_at?: string;
          trial_started_at?: string;
          updated_at?: string;
          user_id: string;
        };
        Update: {
          access_status?: Database["public"]["Enums"]["access_status_t"];
          access_type?: Database["public"]["Enums"]["access_type_t"];
          activated_at?: string | null;
          billing_product_id?: string | null;
          billing_provider?: string | null;
          created_at?: string;
          email?: string | null;
          external_transaction_id?: string | null;
          id?: string;
          lifetime_access?: boolean;
          plan_code?: string | null;
          revoked_at?: string | null;
          revoked_reason?: string | null;
          source?: string | null;
          trial_ends_at?: string;
          trial_started_at?: string;
          updated_at?: string;
          user_id?: string;
        };
        Relationships: [];
      };
      user_roles: {
        Row: {
          created_at: string;
          id: string;
          role: Database["public"]["Enums"]["app_role"];
          user_id: string;
        };
        Insert: {
          created_at?: string;
          id?: string;
          role: Database["public"]["Enums"]["app_role"];
          user_id: string;
        };
        Update: {
          created_at?: string;
          id?: string;
          role?: Database["public"]["Enums"]["app_role"];
          user_id?: string;
        };
        Relationships: [];
      };
      webhook_diagnostics: {
        Row: {
          authenticated: boolean;
          body_size: number | null;
          content_type: string | null;
          event: string | null;
          is_test: boolean;
          method: string;
          note: string | null;
          provider: string;
          received_at: string;
          token_present: boolean;
        };
        Insert: {
          authenticated?: boolean;
          body_size?: number | null;
          content_type?: string | null;
          event?: string | null;
          is_test?: boolean;
          method: string;
          note?: string | null;
          provider: string;
          received_at?: string;
          token_present?: boolean;
        };
        Update: {
          authenticated?: boolean;
          body_size?: number | null;
          content_type?: string | null;
          event?: string | null;
          is_test?: boolean;
          method?: string;
          note?: string | null;
          provider?: string;
          received_at?: string;
          token_present?: boolean;
        };
        Relationships: [];
      };
    };
    Views: {
      [_ in never]: never;
    };
    Functions: {
      clear_content_source_news: {
        Args: { p_source_id: string };
        Returns: number;
      };
      delete_content_source: {
        Args: { p_delete_news?: boolean; p_source_id: string };
        Returns: number;
      };
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"];
          _user_id: string;
        };
        Returns: boolean;
      };
      identity_key: { Args: { _value: string }; Returns: string };
      is_master_admin: { Args: { _user_id: string }; Returns: boolean };
      merge_teams: {
        Args: { p_drop_id: string; p_keep_id: string };
        Returns: undefined;
      };
      my_access: {
        Args: never;
        Returns: {
          access_status: Database["public"]["Enums"]["access_status_t"];
          access_type: Database["public"]["Enums"]["access_type_t"];
          days_left: number;
          is_active: boolean;
          is_master: boolean;
          lifetime_access: boolean;
          plan_code: string;
          trial_ends_at: string;
          trial_started_at: string;
        }[];
      };
      normalize_category_name: { Args: { _name: string }; Returns: string };
    };
    Enums: {
      access_status_t: "trial" | "active" | "expired" | "cancelled";
      access_type_t: "trial" | "founder" | "monthly" | "annual" | "professional" | "business";
      app_role: "admin" | "user";
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
      access_status_t: ["trial", "active", "expired", "cancelled"],
      access_type_t: ["trial", "founder", "monthly", "annual", "professional", "business"],
      app_role: ["admin", "user"],
    },
  },
} as const;
