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
      ai_call_log: {
        Row: {
          agent: string
          created_at: string
          error: string | null
          id: string
          input_tokens: number | null
          latency_ms: number | null
          model: string
          moment: string | null
          output_tokens: number | null
          status: string
          story_id: string | null
          user_id: string | null
        }
        Insert: {
          agent: string
          created_at?: string
          error?: string | null
          id?: string
          input_tokens?: number | null
          latency_ms?: number | null
          model: string
          moment?: string | null
          output_tokens?: number | null
          status?: string
          story_id?: string | null
          user_id?: string | null
        }
        Update: {
          agent?: string
          created_at?: string
          error?: string | null
          id?: string
          input_tokens?: number | null
          latency_ms?: number | null
          model?: string
          moment?: string | null
          output_tokens?: number | null
          status?: string
          story_id?: string | null
          user_id?: string | null
        }
        Relationships: []
      }
      alias_pool_creatures: {
        Row: {
          name: string
        }
        Insert: {
          name: string
        }
        Update: {
          name?: string
        }
        Relationships: []
      }
      alias_pool_emotions: {
        Row: {
          name: string
        }
        Insert: {
          name: string
        }
        Update: {
          name?: string
        }
        Relationships: []
      }
      alias_pool_nationalities: {
        Row: {
          name: string
        }
        Insert: {
          name: string
        }
        Update: {
          name?: string
        }
        Relationships: []
      }
      bench_voice_strings: {
        Row: {
          key: string
          locale: string
          text: string
          updated_at: string
        }
        Insert: {
          key: string
          locale: string
          text: string
          updated_at?: string
        }
        Update: {
          key?: string
          locale?: string
          text?: string
          updated_at?: string
        }
        Relationships: []
      }
      blocks: {
        Row: {
          blocked_id: string
          blocker_id: string
          created_at: string
        }
        Insert: {
          blocked_id: string
          blocker_id: string
          created_at?: string
        }
        Update: {
          blocked_id?: string
          blocker_id?: string
          created_at?: string
        }
        Relationships: []
      }
      city_courts: {
        Row: {
          active: boolean
          code: string
          country_code: string | null
          created_at: string
          id: string
          label: string
          nomination_cap: number
          paused_reason: string | null
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          active?: boolean
          code: string
          country_code?: string | null
          created_at?: string
          id?: string
          label: string
          nomination_cap?: number
          paused_reason?: string | null
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          active?: boolean
          code?: string
          country_code?: string | null
          created_at?: string
          id?: string
          label?: string
          nomination_cap?: number
          paused_reason?: string | null
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: []
      }
      comments: {
        Row: {
          body: string
          created_at: string
          id: string
          status: Database["public"]["Enums"]["story_status"]
          story_id: string
          user_id: string
        }
        Insert: {
          body: string
          created_at?: string
          id?: string
          status?: Database["public"]["Enums"]["story_status"]
          story_id: string
          user_id: string
        }
        Update: {
          body?: string
          created_at?: string
          id?: string
          status?: Database["public"]["Enums"]["story_status"]
          story_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "comments_story_id_fkey"
            columns: ["story_id"]
            isOneToOne: false
            referencedRelation: "stories"
            referencedColumns: ["id"]
          },
        ]
      }
      consent: {
        Row: {
          consented_at: string
          created_at: string
          id: string
          revoked_at: string | null
          service_category: string
          story_id: string | null
          user_id: string
        }
        Insert: {
          consented_at?: string
          created_at?: string
          id?: string
          revoked_at?: string | null
          service_category: string
          story_id?: string | null
          user_id: string
        }
        Update: {
          consented_at?: string
          created_at?: string
          id?: string
          revoked_at?: string | null
          service_category?: string
          story_id?: string | null
          user_id?: string
        }
        Relationships: []
      }
      court_case_badges: {
        Row: {
          author_id: string
          badge_kind: string
          case_id: string | null
          earned_at: string
          id: string
          pinned: boolean
          post_id: string
          region_label: string
        }
        Insert: {
          author_id: string
          badge_kind: string
          case_id?: string | null
          earned_at?: string
          id?: string
          pinned?: boolean
          post_id: string
          region_label: string
        }
        Update: {
          author_id?: string
          badge_kind?: string
          case_id?: string | null
          earned_at?: string
          id?: string
          pinned?: boolean
          post_id?: string
          region_label?: string
        }
        Relationships: [
          {
            foreignKeyName: "court_case_badges_case_id_fkey"
            columns: ["case_id"]
            isOneToOne: false
            referencedRelation: "court_cases"
            referencedColumns: ["id"]
          },
        ]
      }
      court_cases: {
        Row: {
          ai_summary: string | null
          bench_verdict_line: string | null
          candidacy_paused: boolean
          closes_at: string | null
          controversy_score: number
          created_at: string
          current_category_court: string | null
          current_tier: string | null
          decided_at: string | null
          engagement_score: number
          final_judgment: string | null
          final_verdict: string | null
          flip_round_count: number
          flip_window_closes_at: string | null
          flip_window_opened_at: string | null
          id: string
          is_flip_round: boolean
          nominated_at: string
          og_image_url: string | null
          opens_at: string | null
          post_id: string
          pre_flip_verdict: string | null
          region_code: string
          region_label: string
          scope: string
          status: string
          updated_at: string
          verdict_lock_at: string | null
        }
        Insert: {
          ai_summary?: string | null
          bench_verdict_line?: string | null
          candidacy_paused?: boolean
          closes_at?: string | null
          controversy_score?: number
          created_at?: string
          current_category_court?: string | null
          current_tier?: string | null
          decided_at?: string | null
          engagement_score?: number
          final_judgment?: string | null
          final_verdict?: string | null
          flip_round_count?: number
          flip_window_closes_at?: string | null
          flip_window_opened_at?: string | null
          id?: string
          is_flip_round?: boolean
          nominated_at?: string
          og_image_url?: string | null
          opens_at?: string | null
          post_id: string
          pre_flip_verdict?: string | null
          region_code: string
          region_label: string
          scope: string
          status?: string
          updated_at?: string
          verdict_lock_at?: string | null
        }
        Update: {
          ai_summary?: string | null
          bench_verdict_line?: string | null
          candidacy_paused?: boolean
          closes_at?: string | null
          controversy_score?: number
          created_at?: string
          current_category_court?: string | null
          current_tier?: string | null
          decided_at?: string | null
          engagement_score?: number
          final_judgment?: string | null
          final_verdict?: string | null
          flip_round_count?: number
          flip_window_closes_at?: string | null
          flip_window_opened_at?: string | null
          id?: string
          is_flip_round?: boolean
          nominated_at?: string
          og_image_url?: string | null
          opens_at?: string | null
          post_id?: string
          pre_flip_verdict?: string | null
          region_code?: string
          region_label?: string
          scope?: string
          status?: string
          updated_at?: string
          verdict_lock_at?: string | null
        }
        Relationships: []
      }
      court_tiers: {
        Row: {
          case_id: string
          created_at: string
          ended_at: string | null
          id: string
          started_at: string
          tier: string
          vote_count: number
        }
        Insert: {
          case_id: string
          created_at?: string
          ended_at?: string | null
          id?: string
          started_at?: string
          tier: string
          vote_count?: number
        }
        Update: {
          case_id?: string
          created_at?: string
          ended_at?: string | null
          id?: string
          started_at?: string
          tier?: string
          vote_count?: number
        }
        Relationships: [
          {
            foreignKeyName: "court_tiers_case_id_fkey"
            columns: ["case_id"]
            isOneToOne: false
            referencedRelation: "court_cases"
            referencedColumns: ["id"]
          },
        ]
      }
      daily_cases: {
        Row: {
          ai_summary: string | null
          case_date: string
          created_at: string
          headline: string | null
          post_id: string
          subheadline: string | null
          updated_at: string
        }
        Insert: {
          ai_summary?: string | null
          case_date: string
          created_at?: string
          headline?: string | null
          post_id: string
          subheadline?: string | null
          updated_at?: string
        }
        Update: {
          ai_summary?: string | null
          case_date?: string
          created_at?: string
          headline?: string | null
          post_id?: string
          subheadline?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "daily_cases_post_id_fkey"
            columns: ["post_id"]
            isOneToOne: false
            referencedRelation: "posts"
            referencedColumns: ["id"]
          },
        ]
      }
      follows: {
        Row: {
          created_at: string
          followee_id: string
          follower_id: string
        }
        Insert: {
          created_at?: string
          followee_id: string
          follower_id: string
        }
        Update: {
          created_at?: string
          followee_id?: string
          follower_id?: string
        }
        Relationships: []
      }
      friendships: {
        Row: {
          addressee_id: string
          created_at: string
          requester_id: string
          responded_at: string | null
          status: string
        }
        Insert: {
          addressee_id: string
          created_at?: string
          requester_id: string
          responded_at?: string | null
          status?: string
        }
        Update: {
          addressee_id?: string
          created_at?: string
          requester_id?: string
          responded_at?: string | null
          status?: string
        }
        Relationships: []
      }
      hof_scores: {
        Row: {
          entity_id: string
          entity_type: string
          id: string
          metrics: Json
          period: string
          score: number
          updated_at: string
        }
        Insert: {
          entity_id: string
          entity_type: string
          id?: string
          metrics?: Json
          period?: string
          score?: number
          updated_at?: string
        }
        Update: {
          entity_id?: string
          entity_type?: string
          id?: string
          metrics?: Json
          period?: string
          score?: number
          updated_at?: string
        }
        Relationships: []
      }
      hof_snapshots: {
        Row: {
          created_at: string
          id: string
          payload: Json
          period: string
          period_end: string
          period_start: string
        }
        Insert: {
          created_at?: string
          id?: string
          payload: Json
          period: string
          period_end: string
          period_start: string
        }
        Update: {
          created_at?: string
          id?: string
          payload?: Json
          period?: string
          period_end?: string
          period_start?: string
        }
        Relationships: []
      }
      lead_contacts: {
        Row: {
          assigned_to: string | null
          city: string | null
          consent_at: string | null
          consent_given: boolean
          country_code: string | null
          created_at: string
          email: string | null
          help_type: Database["public"]["Enums"]["intent_kind"] | null
          id: string
          intent_id: string | null
          notes: string | null
          phone: string | null
          status: string
          updated_at: string
          user_id: string
        }
        Insert: {
          assigned_to?: string | null
          city?: string | null
          consent_at?: string | null
          consent_given?: boolean
          country_code?: string | null
          created_at?: string
          email?: string | null
          help_type?: Database["public"]["Enums"]["intent_kind"] | null
          id?: string
          intent_id?: string | null
          notes?: string | null
          phone?: string | null
          status?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          assigned_to?: string | null
          city?: string | null
          consent_at?: string | null
          consent_given?: boolean
          country_code?: string | null
          created_at?: string
          email?: string | null
          help_type?: Database["public"]["Enums"]["intent_kind"] | null
          id?: string
          intent_id?: string | null
          notes?: string | null
          phone?: string | null
          status?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "lead_contacts_intent_id_fkey"
            columns: ["intent_id"]
            isOneToOne: false
            referencedRelation: "professional_intents"
            referencedColumns: ["id"]
          },
        ]
      }
      leads: {
        Row: {
          case_type: string | null
          city: string | null
          consent_id: string | null
          contact: Json
          country: string | null
          created_at: string
          emotional_intensity: number | null
          id: string
          notes: string | null
          status: Database["public"]["Enums"]["lead_status"]
          story_id: string | null
          urgency: number | null
          user_id: string | null
        }
        Insert: {
          case_type?: string | null
          city?: string | null
          consent_id?: string | null
          contact?: Json
          country?: string | null
          created_at?: string
          emotional_intensity?: number | null
          id?: string
          notes?: string | null
          status?: Database["public"]["Enums"]["lead_status"]
          story_id?: string | null
          urgency?: number | null
          user_id?: string | null
        }
        Update: {
          case_type?: string | null
          city?: string | null
          consent_id?: string | null
          contact?: Json
          country?: string | null
          created_at?: string
          emotional_intensity?: number | null
          id?: string
          notes?: string | null
          status?: Database["public"]["Enums"]["lead_status"]
          story_id?: string | null
          urgency?: number | null
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "leads_consent_id_fkey"
            columns: ["consent_id"]
            isOneToOne: false
            referencedRelation: "consent"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "leads_story_id_fkey"
            columns: ["story_id"]
            isOneToOne: false
            referencedRelation: "stories"
            referencedColumns: ["id"]
          },
        ]
      }
      mod_queue: {
        Row: {
          case_id: string | null
          created_at: string
          id: string
          moderator_id: string | null
          notes: string | null
          post_id: string
          reason: string
          resolved_at: string | null
          status: string
          updated_at: string
        }
        Insert: {
          case_id?: string | null
          created_at?: string
          id?: string
          moderator_id?: string | null
          notes?: string | null
          post_id: string
          reason: string
          resolved_at?: string | null
          status?: string
          updated_at?: string
        }
        Update: {
          case_id?: string | null
          created_at?: string
          id?: string
          moderator_id?: string | null
          notes?: string | null
          post_id?: string
          reason?: string
          resolved_at?: string | null
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "mod_queue_case_id_fkey"
            columns: ["case_id"]
            isOneToOne: false
            referencedRelation: "court_cases"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "mod_queue_post_id_fkey"
            columns: ["post_id"]
            isOneToOne: false
            referencedRelation: "posts"
            referencedColumns: ["id"]
          },
        ]
      }
      nicknames: {
        Row: {
          created_at: string
          id: string
          locale: string
          text: string
          used_count: number
        }
        Insert: {
          created_at?: string
          id?: string
          locale: string
          text: string
          used_count?: number
        }
        Update: {
          created_at?: string
          id?: string
          locale?: string
          text?: string
          used_count?: number
        }
        Relationships: []
      }
      notifications: {
        Row: {
          created_at: string
          id: string
          kind: string
          payload: Json
          read_at: string | null
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          kind: string
          payload?: Json
          read_at?: string | null
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          kind?: string
          payload?: Json
          read_at?: string | null
          user_id?: string
        }
        Relationships: []
      }
      outcome_reminders: {
        Row: {
          id: string
          milestone_day: number
          sent_at: string
          story_id: string
        }
        Insert: {
          id?: string
          milestone_day: number
          sent_at?: string
          story_id: string
        }
        Update: {
          id?: string
          milestone_day?: number
          sent_at?: string
          story_id?: string
        }
        Relationships: []
      }
      post_approvals: {
        Row: {
          approved_at: string
          claimer_id: string | null
          id: string
          post_id: string
          status: string
          user_id: string
          version_snapshot: Json
        }
        Insert: {
          approved_at?: string
          claimer_id?: string | null
          id?: string
          post_id: string
          status?: string
          user_id: string
          version_snapshot?: Json
        }
        Update: {
          approved_at?: string
          claimer_id?: string | null
          id?: string
          post_id?: string
          status?: string
          user_id?: string
          version_snapshot?: Json
        }
        Relationships: [
          {
            foreignKeyName: "post_approvals_post_id_fkey"
            columns: ["post_id"]
            isOneToOne: false
            referencedRelation: "posts"
            referencedColumns: ["id"]
          },
        ]
      }
      post_arc_follows: {
        Row: {
          created_at: string
          post_id: string
          user_id: string
        }
        Insert: {
          created_at?: string
          post_id: string
          user_id: string
        }
        Update: {
          created_at?: string
          post_id?: string
          user_id?: string
        }
        Relationships: []
      }
      post_comment_reactions: {
        Row: {
          comment_id: string
          created_at: string
          id: string
          kind: string
          user_id: string
        }
        Insert: {
          comment_id: string
          created_at?: string
          id?: string
          kind: string
          user_id: string
        }
        Update: {
          comment_id?: string
          created_at?: string
          id?: string
          kind?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "post_comment_reactions_comment_id_fkey"
            columns: ["comment_id"]
            isOneToOne: false
            referencedRelation: "post_comments"
            referencedColumns: ["id"]
          },
        ]
      }
      post_comments: {
        Row: {
          body: string
          created_at: string
          deleted_at: string | null
          funny_count: number
          id: string
          like_count: number
          parent_id: string | null
          post_id: string
          status: string
          updated_at: string
          user_id: string
        }
        Insert: {
          body: string
          created_at?: string
          deleted_at?: string | null
          funny_count?: number
          id?: string
          like_count?: number
          parent_id?: string | null
          post_id: string
          status?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          body?: string
          created_at?: string
          deleted_at?: string | null
          funny_count?: number
          id?: string
          like_count?: number
          parent_id?: string | null
          post_id?: string
          status?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "post_comments_parent_id_fkey"
            columns: ["parent_id"]
            isOneToOne: false
            referencedRelation: "post_comments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "post_comments_post_id_fkey"
            columns: ["post_id"]
            isOneToOne: false
            referencedRelation: "posts"
            referencedColumns: ["id"]
          },
        ]
      }
      post_drafts: {
        Row: {
          created_at: string
          id: string
          post_id: string | null
          reason: string | null
          story_text: string | null
          title: string | null
          tone: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          post_id?: string | null
          reason?: string | null
          story_text?: string | null
          title?: string | null
          tone?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          post_id?: string | null
          reason?: string | null
          story_text?: string | null
          title?: string | null
          tone?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      post_forwards: {
        Row: {
          channel: string
          created_at: string
          id: string
          post_id: string
          sender_id: string | null
        }
        Insert: {
          channel: string
          created_at?: string
          id?: string
          post_id: string
          sender_id?: string | null
        }
        Update: {
          channel?: string
          created_at?: string
          id?: string
          post_id?: string
          sender_id?: string | null
        }
        Relationships: []
      }
      post_perspective_comments: {
        Row: {
          author_id: string
          body: string
          created_at: string
          deleted_at: string | null
          id: string
          perspective_id: string
        }
        Insert: {
          author_id: string
          body: string
          created_at?: string
          deleted_at?: string | null
          id?: string
          perspective_id: string
        }
        Update: {
          author_id?: string
          body?: string
          created_at?: string
          deleted_at?: string | null
          id?: string
          perspective_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "post_perspective_comments_perspective_id_fkey"
            columns: ["perspective_id"]
            isOneToOne: false
            referencedRelation: "post_perspectives"
            referencedColumns: ["id"]
          },
        ]
      }
      post_perspective_relates: {
        Row: {
          created_at: string
          perspective_id: string
          user_id: string
        }
        Insert: {
          created_at?: string
          perspective_id: string
          user_id: string
        }
        Update: {
          created_at?: string
          perspective_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "post_perspective_relates_perspective_id_fkey"
            columns: ["perspective_id"]
            isOneToOne: false
            referencedRelation: "post_perspectives"
            referencedColumns: ["id"]
          },
        ]
      }
      post_perspective_verdicts: {
        Row: {
          created_at: string
          kind: string
          perspective_id: string
          user_id: string
          weight: number
        }
        Insert: {
          created_at?: string
          kind: string
          perspective_id: string
          user_id: string
          weight?: number
        }
        Update: {
          created_at?: string
          kind?: string
          perspective_id?: string
          user_id?: string
          weight?: number
        }
        Relationships: [
          {
            foreignKeyName: "post_perspective_verdicts_perspective_id_fkey"
            columns: ["perspective_id"]
            isOneToOne: false
            referencedRelation: "post_perspectives"
            referencedColumns: ["id"]
          },
        ]
      }
      post_perspectives: {
        Row: {
          comment_count: number
          created_at: string
          id: string
          locked_at: string | null
          post_id: string
          receipts_urls: string[]
          relate_count: number
          responder_id: string
          response_text: string | null
          role: string
          standing_notes: string | null
          standing_score: number | null
          standing_status: string
          updated_at: string
        }
        Insert: {
          comment_count?: number
          created_at?: string
          id?: string
          locked_at?: string | null
          post_id: string
          receipts_urls?: string[]
          relate_count?: number
          responder_id: string
          response_text?: string | null
          role: string
          standing_notes?: string | null
          standing_score?: number | null
          standing_status?: string
          updated_at?: string
        }
        Update: {
          comment_count?: number
          created_at?: string
          id?: string
          locked_at?: string | null
          post_id?: string
          receipts_urls?: string[]
          relate_count?: number
          responder_id?: string
          response_text?: string | null
          role?: string
          standing_notes?: string | null
          standing_score?: number | null
          standing_status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "post_perspectives_post_id_fkey"
            columns: ["post_id"]
            isOneToOne: false
            referencedRelation: "posts"
            referencedColumns: ["id"]
          },
        ]
      }
      post_reactions: {
        Row: {
          created_at: string
          id: string
          kind: Database["public"]["Enums"]["reaction_kind"]
          post_id: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          kind: Database["public"]["Enums"]["reaction_kind"]
          post_id: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          kind?: Database["public"]["Enums"]["reaction_kind"]
          post_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "post_reactions_post_id_fkey"
            columns: ["post_id"]
            isOneToOne: false
            referencedRelation: "posts"
            referencedColumns: ["id"]
          },
        ]
      }
      post_shares: {
        Row: {
          id: string
          platform: Database["public"]["Enums"]["share_platform"]
          post_id: string
          referrer_clicks: number
          shared_at: string
          user_id: string | null
        }
        Insert: {
          id?: string
          platform: Database["public"]["Enums"]["share_platform"]
          post_id: string
          referrer_clicks?: number
          shared_at?: string
          user_id?: string | null
        }
        Update: {
          id?: string
          platform?: Database["public"]["Enums"]["share_platform"]
          post_id?: string
          referrer_clicks?: number
          shared_at?: string
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "post_shares_post_id_fkey"
            columns: ["post_id"]
            isOneToOne: false
            referencedRelation: "posts"
            referencedColumns: ["id"]
          },
        ]
      }
      post_update_requests: {
        Row: {
          created_at: string
          id: string
          post_id: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          post_id: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          post_id?: string
          user_id?: string
        }
        Relationships: []
      }
      post_updates: {
        Row: {
          author_id: string
          body: string
          created_at: string
          deleted_at: string | null
          episode_number: number
          id: string
          kind: string
          media_url: string | null
          post_id: string
          status: string
          title: string | null
          updated_at: string
        }
        Insert: {
          author_id: string
          body: string
          created_at?: string
          deleted_at?: string | null
          episode_number?: number
          id?: string
          kind?: string
          media_url?: string | null
          post_id: string
          status?: string
          title?: string | null
          updated_at?: string
        }
        Update: {
          author_id?: string
          body?: string
          created_at?: string
          deleted_at?: string | null
          episode_number?: number
          id?: string
          kind?: string
          media_url?: string | null
          post_id?: string
          status?: string
          title?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      post_verdict_votes: {
        Row: {
          created_at: string
          flip_round: number
          ip_hash: string | null
          kind: string
          post_id: string
          quarantined: boolean
          read_depth_percent: number | null
          user_id: string
          weight: number
        }
        Insert: {
          created_at?: string
          flip_round?: number
          ip_hash?: string | null
          kind: string
          post_id: string
          quarantined?: boolean
          read_depth_percent?: number | null
          user_id: string
          weight?: number
        }
        Update: {
          created_at?: string
          flip_round?: number
          ip_hash?: string | null
          kind?: string
          post_id?: string
          quarantined?: boolean
          read_depth_percent?: number | null
          user_id?: string
          weight?: number
        }
        Relationships: [
          {
            foreignKeyName: "post_verdict_votes_post_id_fkey"
            columns: ["post_id"]
            isOneToOne: false
            referencedRelation: "posts"
            referencedColumns: ["id"]
          },
        ]
      }
      post_views: {
        Row: {
          country: string | null
          id: string
          post_id: string
          session_hash: string
          viewed_at: string
          viewer_id: string | null
        }
        Insert: {
          country?: string | null
          id?: string
          post_id: string
          session_hash: string
          viewed_at?: string
          viewer_id?: string | null
        }
        Update: {
          country?: string | null
          id?: string
          post_id?: string
          session_hash?: string
          viewed_at?: string
          viewer_id?: string | null
        }
        Relationships: []
      }
      posts: {
        Row: {
          additional_perspectives: boolean
          author_id: string
          badges: string[]
          both_sides_heard: boolean
          candidacy_paused: boolean
          case_title: string | null
          comment_count: number
          controversy_score: number
          cool_down_until: string | null
          created_at: string
          deleted_at: string | null
          drama_score: number
          expiry_at: string | null
          forward_count: number
          hashtags: string[]
          id: string
          is_seed: boolean
          like_count: number
          locale: string
          media_url: string | null
          nomination_score: number
          perspective_count: number
          pii_removed: boolean
          platform_captions: Json
          prediction_options: Json
          published_at: string | null
          question_before_court: string | null
          relate_count: number
          save_count: number
          score: number | null
          score_category: string | null
          share_card_square: string | null
          share_card_vertical: string | null
          share_card_xhs: string | null
          share_count: number
          status: Database["public"]["Enums"]["post_status"]
          story_id: string | null
          story_text: string
          title: string
          tone: Database["public"]["Enums"]["post_tone"]
          update_count: number
          update_request_count: number
          updated_at: string
          view_count: number
          visibility: string
          weighted_vote_sum: number
        }
        Insert: {
          additional_perspectives?: boolean
          author_id: string
          badges?: string[]
          both_sides_heard?: boolean
          candidacy_paused?: boolean
          case_title?: string | null
          comment_count?: number
          controversy_score?: number
          cool_down_until?: string | null
          created_at?: string
          deleted_at?: string | null
          drama_score?: number
          expiry_at?: string | null
          forward_count?: number
          hashtags?: string[]
          id?: string
          is_seed?: boolean
          like_count?: number
          locale?: string
          media_url?: string | null
          nomination_score?: number
          perspective_count?: number
          pii_removed?: boolean
          platform_captions?: Json
          prediction_options?: Json
          published_at?: string | null
          question_before_court?: string | null
          relate_count?: number
          save_count?: number
          score?: number | null
          score_category?: string | null
          share_card_square?: string | null
          share_card_vertical?: string | null
          share_card_xhs?: string | null
          share_count?: number
          status?: Database["public"]["Enums"]["post_status"]
          story_id?: string | null
          story_text: string
          title: string
          tone?: Database["public"]["Enums"]["post_tone"]
          update_count?: number
          update_request_count?: number
          updated_at?: string
          view_count?: number
          visibility?: string
          weighted_vote_sum?: number
        }
        Update: {
          additional_perspectives?: boolean
          author_id?: string
          badges?: string[]
          both_sides_heard?: boolean
          candidacy_paused?: boolean
          case_title?: string | null
          comment_count?: number
          controversy_score?: number
          cool_down_until?: string | null
          created_at?: string
          deleted_at?: string | null
          drama_score?: number
          expiry_at?: string | null
          forward_count?: number
          hashtags?: string[]
          id?: string
          is_seed?: boolean
          like_count?: number
          locale?: string
          media_url?: string | null
          nomination_score?: number
          perspective_count?: number
          pii_removed?: boolean
          platform_captions?: Json
          prediction_options?: Json
          published_at?: string | null
          question_before_court?: string | null
          relate_count?: number
          save_count?: number
          score?: number | null
          score_category?: string | null
          share_card_square?: string | null
          share_card_vertical?: string | null
          share_card_xhs?: string | null
          share_count?: number
          status?: Database["public"]["Enums"]["post_status"]
          story_id?: string | null
          story_text?: string
          title?: string
          tone?: Database["public"]["Enums"]["post_tone"]
          update_count?: number
          update_request_count?: number
          updated_at?: string
          view_count?: number
          visibility?: string
          weighted_vote_sum?: number
        }
        Relationships: [
          {
            foreignKeyName: "posts_story_id_fkey"
            columns: ["story_id"]
            isOneToOne: false
            referencedRelation: "stories"
            referencedColumns: ["id"]
          },
        ]
      }
      prediction_results: {
        Row: {
          id: string
          is_correct: boolean
          post_id: string
          prediction_id: string
          scored_at: string
          user_id: string
        }
        Insert: {
          id?: string
          is_correct: boolean
          post_id: string
          prediction_id: string
          scored_at?: string
          user_id: string
        }
        Update: {
          id?: string
          is_correct?: boolean
          post_id?: string
          prediction_id?: string
          scored_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "prediction_results_post_id_fkey"
            columns: ["post_id"]
            isOneToOne: false
            referencedRelation: "posts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "prediction_results_prediction_id_fkey"
            columns: ["prediction_id"]
            isOneToOne: true
            referencedRelation: "predictions"
            referencedColumns: ["id"]
          },
        ]
      }
      predictions: {
        Row: {
          confidence: number
          created_at: string
          id: string
          post_id: string
          predicted_outcome: string
          user_id: string
        }
        Insert: {
          confidence: number
          created_at?: string
          id?: string
          post_id: string
          predicted_outcome: string
          user_id: string
        }
        Update: {
          confidence?: number
          created_at?: string
          id?: string
          post_id?: string
          predicted_outcome?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "predictions_post_id_fkey"
            columns: ["post_id"]
            isOneToOne: false
            referencedRelation: "posts"
            referencedColumns: ["id"]
          },
        ]
      }
      professional_intents: {
        Row: {
          created_at: string
          id: string
          intent: Database["public"]["Enums"]["intent_kind"]
          lead_score: number
          lead_temperature: Database["public"]["Enums"]["lead_temperature"]
          note: string | null
          post_id: string | null
          scan_id: string | null
          signals: Json
          source: string | null
          urgency: number
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          intent: Database["public"]["Enums"]["intent_kind"]
          lead_score?: number
          lead_temperature?: Database["public"]["Enums"]["lead_temperature"]
          note?: string | null
          post_id?: string | null
          scan_id?: string | null
          signals?: Json
          source?: string | null
          urgency?: number
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          intent?: Database["public"]["Enums"]["intent_kind"]
          lead_score?: number
          lead_temperature?: Database["public"]["Enums"]["lead_temperature"]
          note?: string | null
          post_id?: string | null
          scan_id?: string | null
          signals?: Json
          source?: string | null
          urgency?: number
          user_id?: string
        }
        Relationships: []
      }
      profiles: {
        Row: {
          account_created_at: string
          age_verified: boolean
          anonymous_mode: boolean
          avatar_kind: string
          avatar_url: string | null
          bio: string | null
          blocked_at: string | null
          blocked_reason: string | null
          city: string | null
          city_label: string | null
          counsel_count: number
          country: string | null
          country_code: string | null
          created_at: string
          creature: string | null
          descriptor: string | null
          display_name: string | null
          dob: string | null
          dob_month: number | null
          dob_year: number | null
          email: string | null
          emoji: string | null
          emotion: string | null
          emotional_embedding: string | null
          empathy_score: number
          handle: string
          id: string
          juror_tier: string | null
          juror_title: string | null
          justice_score: number
          last_seen_at: string | null
          locale: string
          nationality: string | null
          nickname: string
          notif_prefs: Json
          onboarded_at: string | null
          phone: string | null
          phone_verified: boolean
          prediction_score: number
          privacy: Json
          region: string | null
          reroll_used: boolean
          updated_at: string
          vibe: string | null
          wisdom_score: number
        }
        Insert: {
          account_created_at?: string
          age_verified?: boolean
          anonymous_mode?: boolean
          avatar_kind?: string
          avatar_url?: string | null
          bio?: string | null
          blocked_at?: string | null
          blocked_reason?: string | null
          city?: string | null
          city_label?: string | null
          counsel_count?: number
          country?: string | null
          country_code?: string | null
          created_at?: string
          creature?: string | null
          descriptor?: string | null
          display_name?: string | null
          dob?: string | null
          dob_month?: number | null
          dob_year?: number | null
          email?: string | null
          emoji?: string | null
          emotion?: string | null
          emotional_embedding?: string | null
          empathy_score?: number
          handle: string
          id: string
          juror_tier?: string | null
          juror_title?: string | null
          justice_score?: number
          last_seen_at?: string | null
          locale?: string
          nationality?: string | null
          nickname: string
          notif_prefs?: Json
          onboarded_at?: string | null
          phone?: string | null
          phone_verified?: boolean
          prediction_score?: number
          privacy?: Json
          region?: string | null
          reroll_used?: boolean
          updated_at?: string
          vibe?: string | null
          wisdom_score?: number
        }
        Update: {
          account_created_at?: string
          age_verified?: boolean
          anonymous_mode?: boolean
          avatar_kind?: string
          avatar_url?: string | null
          bio?: string | null
          blocked_at?: string | null
          blocked_reason?: string | null
          city?: string | null
          city_label?: string | null
          counsel_count?: number
          country?: string | null
          country_code?: string | null
          created_at?: string
          creature?: string | null
          descriptor?: string | null
          display_name?: string | null
          dob?: string | null
          dob_month?: number | null
          dob_year?: number | null
          email?: string | null
          emoji?: string | null
          emotion?: string | null
          emotional_embedding?: string | null
          empathy_score?: number
          handle?: string
          id?: string
          juror_tier?: string | null
          juror_title?: string | null
          justice_score?: number
          last_seen_at?: string | null
          locale?: string
          nationality?: string | null
          nickname?: string
          notif_prefs?: Json
          onboarded_at?: string | null
          phone?: string | null
          phone_verified?: boolean
          prediction_score?: number
          privacy?: Json
          region?: string | null
          reroll_used?: boolean
          updated_at?: string
          vibe?: string | null
          wisdom_score?: number
        }
        Relationships: []
      }
      rate_limit_counters: {
        Row: {
          bucket: string
          count: number
          id: string
          user_id: string
          window_start: string
        }
        Insert: {
          bucket: string
          count?: number
          id?: string
          user_id: string
          window_start: string
        }
        Update: {
          bucket?: string
          count?: number
          id?: string
          user_id?: string
          window_start?: string
        }
        Relationships: []
      }
      reputation_events: {
        Row: {
          case_id: string | null
          created_at: string
          delta: Json
          event_type: string
          id: string
          post_id: string | null
          user_id: string
        }
        Insert: {
          case_id?: string | null
          created_at?: string
          delta?: Json
          event_type: string
          id?: string
          post_id?: string | null
          user_id: string
        }
        Update: {
          case_id?: string | null
          created_at?: string
          delta?: Json
          event_type?: string
          id?: string
          post_id?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "reputation_events_case_id_fkey"
            columns: ["case_id"]
            isOneToOne: false
            referencedRelation: "court_cases"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "reputation_events_post_id_fkey"
            columns: ["post_id"]
            isOneToOne: false
            referencedRelation: "posts"
            referencedColumns: ["id"]
          },
        ]
      }
      safety_events: {
        Row: {
          action: string | null
          created_at: string
          draft_id: string | null
          id: string
          post_id: string | null
          reasons: string[]
          resolved_at: string | null
          user_id: string
        }
        Insert: {
          action?: string | null
          created_at?: string
          draft_id?: string | null
          id?: string
          post_id?: string | null
          reasons?: string[]
          resolved_at?: string | null
          user_id: string
        }
        Update: {
          action?: string | null
          created_at?: string
          draft_id?: string | null
          id?: string
          post_id?: string | null
          reasons?: string[]
          resolved_at?: string | null
          user_id?: string
        }
        Relationships: []
      }
      saved_posts: {
        Row: {
          created_at: string
          post_id: string
          user_id: string
        }
        Insert: {
          created_at?: string
          post_id: string
          user_id: string
        }
        Update: {
          created_at?: string
          post_id?: string
          user_id?: string
        }
        Relationships: []
      }
      scan_results: {
        Row: {
          answers: Json
          badges: string[]
          category: string | null
          completed_at: string | null
          created_at: string
          current_step: number
          flow_path: Json
          id: string
          locale: string
          percentile: number | null
          post_id: string | null
          score: number | null
          status: string
          subscores: Json | null
          tags: string[]
          updated_at: string
          user_id: string
        }
        Insert: {
          answers?: Json
          badges?: string[]
          category?: string | null
          completed_at?: string | null
          created_at?: string
          current_step?: number
          flow_path?: Json
          id?: string
          locale?: string
          percentile?: number | null
          post_id?: string | null
          score?: number | null
          status?: string
          subscores?: Json | null
          tags?: string[]
          updated_at?: string
          user_id: string
        }
        Update: {
          answers?: Json
          badges?: string[]
          category?: string | null
          completed_at?: string | null
          created_at?: string
          current_step?: number
          flow_path?: Json
          id?: string
          locale?: string
          percentile?: number | null
          post_id?: string | null
          score?: number | null
          status?: string
          subscores?: Json | null
          tags?: string[]
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      standing_verifications: {
        Row: {
          agent_output: Json | null
          attempt_no: number
          claimed_facts: Json
          created_at: string
          decision: string
          id: string
          perspective_id: string
          responder_id: string
        }
        Insert: {
          agent_output?: Json | null
          attempt_no?: number
          claimed_facts?: Json
          created_at?: string
          decision: string
          id?: string
          perspective_id: string
          responder_id: string
        }
        Update: {
          agent_output?: Json | null
          attempt_no?: number
          claimed_facts?: Json
          created_at?: string
          decision?: string
          id?: string
          perspective_id?: string
          responder_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "standing_verifications_perspective_id_fkey"
            columns: ["perspective_id"]
            isOneToOne: false
            referencedRelation: "post_perspectives"
            referencedColumns: ["id"]
          },
        ]
      }
      stories: {
        Row: {
          ai_verdict: string | null
          author_id: string
          body_original: string
          body_rewritten: string | null
          city: string | null
          country: string | null
          created_at: string
          embedding: string | null
          id: string
          like_count: number
          locale: string
          media: Json
          outcome_recorded_at: string | null
          published_at: string | null
          region: string | null
          score: number | null
          score_category: string | null
          share_count: number
          status: Database["public"]["Enums"]["story_status"]
          subscores: Json | null
          tags: string[]
          title: string | null
          updated_at: string
          view_count: number
        }
        Insert: {
          ai_verdict?: string | null
          author_id: string
          body_original: string
          body_rewritten?: string | null
          city?: string | null
          country?: string | null
          created_at?: string
          embedding?: string | null
          id?: string
          like_count?: number
          locale?: string
          media?: Json
          outcome_recorded_at?: string | null
          published_at?: string | null
          region?: string | null
          score?: number | null
          score_category?: string | null
          share_count?: number
          status?: Database["public"]["Enums"]["story_status"]
          subscores?: Json | null
          tags?: string[]
          title?: string | null
          updated_at?: string
          view_count?: number
        }
        Update: {
          ai_verdict?: string | null
          author_id?: string
          body_original?: string
          body_rewritten?: string | null
          city?: string | null
          country?: string | null
          created_at?: string
          embedding?: string | null
          id?: string
          like_count?: number
          locale?: string
          media?: Json
          outcome_recorded_at?: string | null
          published_at?: string | null
          region?: string | null
          score?: number | null
          score_category?: string | null
          share_count?: number
          status?: Database["public"]["Enums"]["story_status"]
          subscores?: Json | null
          tags?: string[]
          title?: string | null
          updated_at?: string
          view_count?: number
        }
        Relationships: []
      }
      story_ai_runs: {
        Row: {
          cost_ms: number | null
          created_at: string
          id: string
          input: Json | null
          model: string
          output: Json | null
          provider: string
          stage: string
          story_id: string | null
        }
        Insert: {
          cost_ms?: number | null
          created_at?: string
          id?: string
          input?: Json | null
          model: string
          output?: Json | null
          provider: string
          stage: string
          story_id?: string | null
        }
        Update: {
          cost_ms?: number | null
          created_at?: string
          id?: string
          input?: Json | null
          model?: string
          output?: Json | null
          provider?: string
          stage?: string
          story_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "story_ai_runs_story_id_fkey"
            columns: ["story_id"]
            isOneToOne: false
            referencedRelation: "stories"
            referencedColumns: ["id"]
          },
        ]
      }
      story_interactions: {
        Row: {
          created_at: string
          dwell_ms: number | null
          id: string
          kind: Database["public"]["Enums"]["interaction_kind"]
          story_id: string
          user_id: string
        }
        Insert: {
          created_at?: string
          dwell_ms?: number | null
          id?: string
          kind: Database["public"]["Enums"]["interaction_kind"]
          story_id: string
          user_id: string
        }
        Update: {
          created_at?: string
          dwell_ms?: number | null
          id?: string
          kind?: Database["public"]["Enums"]["interaction_kind"]
          story_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "story_interactions_story_id_fkey"
            columns: ["story_id"]
            isOneToOne: false
            referencedRelation: "stories"
            referencedColumns: ["id"]
          },
        ]
      }
      story_outcomes: {
        Row: {
          created_at: string
          days_elapsed: number | null
          detail: string | null
          id: string
          outcome_type: string
          post_id: string
          submitted_by: string
        }
        Insert: {
          created_at?: string
          days_elapsed?: number | null
          detail?: string | null
          id?: string
          outcome_type: string
          post_id: string
          submitted_by: string
        }
        Update: {
          created_at?: string
          days_elapsed?: number | null
          detail?: string | null
          id?: string
          outcome_type?: string
          post_id?: string
          submitted_by?: string
        }
        Relationships: [
          {
            foreignKeyName: "story_outcomes_post_id_fkey"
            columns: ["post_id"]
            isOneToOne: true
            referencedRelation: "posts"
            referencedColumns: ["id"]
          },
        ]
      }
      story_tags: {
        Row: {
          confidence: number
          created_at: string
          id: string
          source: string
          story_id: string
          tag: string
        }
        Insert: {
          confidence?: number
          created_at?: string
          id?: string
          source?: string
          story_id: string
          tag: string
        }
        Update: {
          confidence?: number
          created_at?: string
          id?: string
          source?: string
          story_id?: string
          tag?: string
        }
        Relationships: []
      }
      tea_drafts: {
        Row: {
          category: string | null
          category_key: string | null
          chat_messages: Json
          cover_kind: string | null
          cover_url: string | null
          created_at: string
          draft_variants: Json | null
          extracted: Json
          final_post_id: string | null
          id: string
          locale: string
          media: Json
          rankings: Json | null
          raw_dump: string | null
          ready_for_score: boolean
          score: number | null
          selected_story: string | null
          selected_title: string | null
          selected_tone: string | null
          status: Database["public"]["Enums"]["tea_status"]
          subscores: Json | null
          updated_at: string
          user_id: string
        }
        Insert: {
          category?: string | null
          category_key?: string | null
          chat_messages?: Json
          cover_kind?: string | null
          cover_url?: string | null
          created_at?: string
          draft_variants?: Json | null
          extracted?: Json
          final_post_id?: string | null
          id?: string
          locale?: string
          media?: Json
          rankings?: Json | null
          raw_dump?: string | null
          ready_for_score?: boolean
          score?: number | null
          selected_story?: string | null
          selected_title?: string | null
          selected_tone?: string | null
          status?: Database["public"]["Enums"]["tea_status"]
          subscores?: Json | null
          updated_at?: string
          user_id: string
        }
        Update: {
          category?: string | null
          category_key?: string | null
          chat_messages?: Json
          cover_kind?: string | null
          cover_url?: string | null
          created_at?: string
          draft_variants?: Json | null
          extracted?: Json
          final_post_id?: string | null
          id?: string
          locale?: string
          media?: Json
          rankings?: Json | null
          raw_dump?: string | null
          ready_for_score?: boolean
          score?: number | null
          selected_story?: string | null
          selected_title?: string | null
          selected_tone?: string | null
          status?: Database["public"]["Enums"]["tea_status"]
          subscores?: Json | null
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      trends: {
        Row: {
          ai_framing: Json | null
          created_at: string
          id: string
          locale: string
          raw: Json | null
          scheduled_for: string | null
          source: string
          status: Database["public"]["Enums"]["trend_status"]
          topic: string
        }
        Insert: {
          ai_framing?: Json | null
          created_at?: string
          id?: string
          locale?: string
          raw?: Json | null
          scheduled_for?: string | null
          source: string
          status?: Database["public"]["Enums"]["trend_status"]
          topic: string
        }
        Update: {
          ai_framing?: Json | null
          created_at?: string
          id?: string
          locale?: string
          raw?: Json | null
          scheduled_for?: string | null
          source?: string
          status?: Database["public"]["Enums"]["trend_status"]
          topic?: string
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
      user_streaks: {
        Row: {
          current_streak: number
          last_active_date: string | null
          longest_streak: number
          updated_at: string
          user_id: string
        }
        Insert: {
          current_streak?: number
          last_active_date?: string | null
          longest_streak?: number
          updated_at?: string
          user_id: string
        }
        Update: {
          current_streak?: number
          last_active_date?: string | null
          longest_streak?: number
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      user_tags: {
        Row: {
          confidence: number
          created_at: string
          id: string
          last_seen_at: string
          tag: string
          user_id: string
        }
        Insert: {
          confidence?: number
          created_at?: string
          id?: string
          last_seen_at?: string
          tag: string
          user_id: string
        }
        Update: {
          confidence?: number
          created_at?: string
          id?: string
          last_seen_at?: string
          tag?: string
          user_id?: string
        }
        Relationships: []
      }
      wisdom_graph_edges: {
        Row: {
          created_at: string
          from_node: string
          id: string
          relation: string
          to_node: string
          weight: number
        }
        Insert: {
          created_at?: string
          from_node: string
          id?: string
          relation: string
          to_node: string
          weight?: number
        }
        Update: {
          created_at?: string
          from_node?: string
          id?: string
          relation?: string
          to_node?: string
          weight?: number
        }
        Relationships: [
          {
            foreignKeyName: "wisdom_graph_edges_from_node_fkey"
            columns: ["from_node"]
            isOneToOne: false
            referencedRelation: "wisdom_graph_nodes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "wisdom_graph_edges_to_node_fkey"
            columns: ["to_node"]
            isOneToOne: false
            referencedRelation: "wisdom_graph_nodes"
            referencedColumns: ["id"]
          },
        ]
      }
      wisdom_graph_nodes: {
        Row: {
          category: string | null
          created_at: string
          id: string
          node_type: string
          payload: Json
          post_id: string | null
          weight: number
        }
        Insert: {
          category?: string | null
          created_at?: string
          id?: string
          node_type: string
          payload?: Json
          post_id?: string | null
          weight?: number
        }
        Update: {
          category?: string | null
          created_at?: string
          id?: string
          node_type?: string
          payload?: Json
          post_id?: string | null
          weight?: number
        }
        Relationships: [
          {
            foreignKeyName: "wisdom_graph_nodes_post_id_fkey"
            columns: ["post_id"]
            isOneToOne: false
            referencedRelation: "posts"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      post_reaction_counts: {
        Row: {
          count: number | null
          kind: Database["public"]["Enums"]["reaction_kind"] | null
          post_id: string | null
        }
        Relationships: [
          {
            foreignKeyName: "post_reactions_post_id_fkey"
            columns: ["post_id"]
            isOneToOne: false
            referencedRelation: "posts"
            referencedColumns: ["id"]
          },
        ]
      }
      post_verdict_counts: {
        Row: {
          count: number | null
          kind: string | null
          post_id: string | null
        }
        Relationships: [
          {
            foreignKeyName: "post_verdict_votes_post_id_fkey"
            columns: ["post_id"]
            isOneToOne: false
            referencedRelation: "posts"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Functions: {
      _bump_comment_counter: {
        Args: { _col: string; _comment_id: string; _delta: number }
        Returns: undefined
      }
      _bump_post_counter: {
        Args: { _col: string; _delta: number; _post_id: string }
        Returns: undefined
      }
      _resolve_entry_tier: {
        Args: { _post_id: string }
        Returns: {
          region_code: string
          region_label: string
          tier: string
        }[]
      }
      _slugify_handle: { Args: { _text: string }; Returns: string }
      _tier_duration: { Args: { _tier: string }; Returns: string }
      bump_streak: {
        Args: { _today: string; _user_id: string }
        Returns: {
          current_streak: number
          last_active_date: string | null
          longest_streak: number
          updated_at: string
          user_id: string
        }
        SetofOptions: {
          from: "*"
          to: "user_streaks"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      compute_post_nomination_score: {
        Args: { _post_id: string }
        Returns: undefined
      }
      ensure_daily_case: {
        Args: { _date: string }
        Returns: {
          ai_summary: string | null
          case_date: string
          created_at: string
          headline: string | null
          post_id: string
          subheadline: string | null
          updated_at: string
        }
        SetofOptions: {
          from: "*"
          to: "daily_cases"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      finalize_court_cases: { Args: never; Returns: number }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      increment_post_view: {
        Args: { _post_id: string; _session_hash: string; _viewer_id: string }
        Returns: boolean
      }
      is_friend: { Args: { _a: string; _b: string }; Returns: boolean }
      is_handle_available: { Args: { _handle: string }; Returns: boolean }
      maybe_nominate_post: { Args: { _post_id: string }; Returns: boolean }
      nominate_court_cases: {
        Args: {
          _limit?: number
          _region_code: string
          _region_label: string
          _scope: string
        }
        Returns: number
      }
      promote_court_cases: { Args: never; Returns: number }
      suggest_handles: { Args: { _base: string }; Returns: string[] }
    }
    Enums: {
      app_role: "admin" | "moderator" | "user"
      intent_kind:
        | "reactions"
        | "support"
        | "documentation"
        | "legal"
        | "next_steps"
      interaction_kind:
        | "view"
        | "like"
        | "save"
        | "share"
        | "been_through"
        | "worse"
        | "report"
        | "comment"
      lead_status: "new" | "contacted" | "converted" | "closed"
      lead_temperature: "cold" | "early" | "warm" | "hot"
      post_status: "draft" | "published" | "removed"
      post_tone: "funny" | "serious" | "chaotic" | "soft"
      reaction_kind: "been_there" | "worse" | "hug" | "laugh" | "drama"
      share_platform:
        | "x"
        | "tiktok"
        | "instagram"
        | "xiaohongshu"
        | "facebook"
        | "imessage"
        | "whatsapp"
        | "copy_link"
      story_status: "draft" | "pending" | "published" | "sensitive" | "removed"
      tea_status:
        | "chatting"
        | "scoring"
        | "drafting"
        | "previewing"
        | "published"
        | "abandoned"
      trend_status: "ingested" | "approved" | "published" | "rejected"
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
      intent_kind: [
        "reactions",
        "support",
        "documentation",
        "legal",
        "next_steps",
      ],
      interaction_kind: [
        "view",
        "like",
        "save",
        "share",
        "been_through",
        "worse",
        "report",
        "comment",
      ],
      lead_status: ["new", "contacted", "converted", "closed"],
      lead_temperature: ["cold", "early", "warm", "hot"],
      post_status: ["draft", "published", "removed"],
      post_tone: ["funny", "serious", "chaotic", "soft"],
      reaction_kind: ["been_there", "worse", "hug", "laugh", "drama"],
      share_platform: [
        "x",
        "tiktok",
        "instagram",
        "xiaohongshu",
        "facebook",
        "imessage",
        "whatsapp",
        "copy_link",
      ],
      story_status: ["draft", "pending", "published", "sensitive", "removed"],
      tea_status: [
        "chatting",
        "scoring",
        "drafting",
        "previewing",
        "published",
        "abandoned",
      ],
      trend_status: ["ingested", "approved", "published", "rejected"],
    },
  },
} as const
