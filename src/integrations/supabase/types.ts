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
          closes_at: string | null
          controversy_score: number
          created_at: string
          decided_at: string | null
          engagement_score: number
          final_verdict: string | null
          id: string
          nominated_at: string
          opens_at: string | null
          post_id: string
          region_code: string
          region_label: string
          scope: string
          status: string
          updated_at: string
        }
        Insert: {
          ai_summary?: string | null
          closes_at?: string | null
          controversy_score?: number
          created_at?: string
          decided_at?: string | null
          engagement_score?: number
          final_verdict?: string | null
          id?: string
          nominated_at?: string
          opens_at?: string | null
          post_id: string
          region_code: string
          region_label: string
          scope: string
          status?: string
          updated_at?: string
        }
        Update: {
          ai_summary?: string | null
          closes_at?: string | null
          controversy_score?: number
          created_at?: string
          decided_at?: string | null
          engagement_score?: number
          final_verdict?: string | null
          id?: string
          nominated_at?: string
          opens_at?: string | null
          post_id?: string
          region_code?: string
          region_label?: string
          scope?: string
          status?: string
          updated_at?: string
        }
        Relationships: []
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
            foreignKeyName: "leads_story_id_fkey"
            columns: ["story_id"]
            isOneToOne: false
            referencedRelation: "stories"
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
      post_approvals: {
        Row: {
          approved_at: string
          id: string
          post_id: string
          user_id: string
          version_snapshot: Json
        }
        Insert: {
          approved_at?: string
          id?: string
          post_id: string
          user_id: string
          version_snapshot?: Json
        }
        Update: {
          approved_at?: string
          id?: string
          post_id?: string
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
          kind: string
          post_id: string
          user_id: string
        }
        Insert: {
          created_at?: string
          kind: string
          post_id: string
          user_id: string
        }
        Update: {
          created_at?: string
          kind?: string
          post_id?: string
          user_id?: string
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
          author_id: string
          badges: string[]
          comment_count: number
          created_at: string
          deleted_at: string | null
          forward_count: number
          hashtags: string[]
          id: string
          is_seed: boolean
          like_count: number
          locale: string
          media_url: string | null
          platform_captions: Json
          published_at: string | null
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
        }
        Insert: {
          author_id: string
          badges?: string[]
          comment_count?: number
          created_at?: string
          deleted_at?: string | null
          forward_count?: number
          hashtags?: string[]
          id?: string
          is_seed?: boolean
          like_count?: number
          locale?: string
          media_url?: string | null
          platform_captions?: Json
          published_at?: string | null
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
        }
        Update: {
          author_id?: string
          badges?: string[]
          comment_count?: number
          created_at?: string
          deleted_at?: string | null
          forward_count?: number
          hashtags?: string[]
          id?: string
          is_seed?: boolean
          like_count?: number
          locale?: string
          media_url?: string | null
          platform_captions?: Json
          published_at?: string | null
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
          anonymous_mode: boolean
          avatar_kind: string
          avatar_url: string | null
          bio: string | null
          city: string | null
          city_label: string | null
          country: string | null
          country_code: string | null
          created_at: string
          descriptor: string | null
          display_name: string | null
          email: string | null
          emotional_embedding: string | null
          handle: string
          id: string
          last_seen_at: string | null
          locale: string
          nickname: string
          notif_prefs: Json
          onboarded_at: string | null
          privacy: Json
          region: string | null
          updated_at: string
          vibe: string | null
        }
        Insert: {
          anonymous_mode?: boolean
          avatar_kind?: string
          avatar_url?: string | null
          bio?: string | null
          city?: string | null
          city_label?: string | null
          country?: string | null
          country_code?: string | null
          created_at?: string
          descriptor?: string | null
          display_name?: string | null
          email?: string | null
          emotional_embedding?: string | null
          handle: string
          id: string
          last_seen_at?: string | null
          locale?: string
          nickname: string
          notif_prefs?: Json
          onboarded_at?: string | null
          privacy?: Json
          region?: string | null
          updated_at?: string
          vibe?: string | null
        }
        Update: {
          anonymous_mode?: boolean
          avatar_kind?: string
          avatar_url?: string | null
          bio?: string | null
          city?: string | null
          city_label?: string | null
          country?: string | null
          country_code?: string | null
          created_at?: string
          descriptor?: string | null
          display_name?: string | null
          email?: string | null
          emotional_embedding?: string | null
          handle?: string
          id?: string
          last_seen_at?: string | null
          locale?: string
          nickname?: string
          notif_prefs?: Json
          onboarded_at?: string | null
          privacy?: Json
          region?: string | null
          updated_at?: string
          vibe?: string | null
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
      _slugify_handle: { Args: { _text: string }; Returns: string }
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
