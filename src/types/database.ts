export interface Database {
  public: {
    Tables: {
      users: {
        Row: {
          id: string;
          name: string;
          age: number | null;
          front_photo_url: string | null;
          side_photo_url: string | null;
          known_for: string | null;
          red_flag: string | null;
          guilty_pleasure: string | null;
          secret_talent: string | null;
          hot_take: string | null;
          subscription_tier: 'free' | 'premium';
          games_hosted_this_month: number;
          total_games_hosted: number;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          name: string;
          age?: number | null;
          front_photo_url?: string | null;
          side_photo_url?: string | null;
          known_for?: string | null;
          red_flag?: string | null;
          guilty_pleasure?: string | null;
          secret_talent?: string | null;
          hot_take?: string | null;
          subscription_tier?: 'free' | 'premium';
          games_hosted_this_month?: number;
          total_games_hosted?: number;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          name?: string;
          age?: number | null;
          front_photo_url?: string | null;
          side_photo_url?: string | null;
          known_for?: string | null;
          red_flag?: string | null;
          guilty_pleasure?: string | null;
          secret_talent?: string | null;
          hot_take?: string | null;
          subscription_tier?: 'free' | 'premium';
          games_hosted_this_month?: number;
          total_games_hosted?: number;
          created_at?: string;
          updated_at?: string;
        };
      };
      game_rooms: {
        Row: {
          id: string;
          join_code: string;
          host_id: string;
          game_mode: 'standard' | 'drinking';
          question_pack_id: string;
          game_length: 'quick' | 'standard' | 'extended';
          status: 'lobby' | 'voting' | 'trial' | 'finished';
          created_at: string;
        };
        Insert: {
          id?: string;
          join_code: string;
          host_id: string;
          game_mode: 'standard' | 'drinking';
          question_pack_id: string;
          game_length: 'quick' | 'standard' | 'extended';
          status?: 'lobby' | 'voting' | 'trial' | 'finished';
          created_at?: string;
        };
        Update: {
          id?: string;
          join_code?: string;
          host_id?: string;
          game_mode?: 'standard' | 'drinking';
          question_pack_id?: string;
          game_length?: 'quick' | 'standard' | 'extended';
          status?: 'lobby' | 'voting' | 'trial' | 'finished';
          created_at?: string;
        };
      };
      game_sessions: {
        Row: {
          id: string;
          game_room_id: string;
          current_round: number;
          current_phase: 'voting' | 'trial';
          current_question_id: string | null;
          suspect_id: string | null;
          timer_end_time: string | null;
          scores: any;
          updated_at: string;
        };
        Insert: {
          id?: string;
          game_room_id: string;
          current_round?: number;
          current_phase?: 'voting' | 'trial';
          current_question_id?: string | null;
          suspect_id?: string | null;
          timer_end_time?: string | null;
          scores?: any;
          updated_at?: string;
        };
        Update: {
          id?: string;
          game_room_id?: string;
          current_round?: number;
          current_phase?: 'voting' | 'trial';
          current_question_id?: string | null;
          suspect_id?: string | null;
          timer_end_time?: string | null;
          scores?: any;
          updated_at?: string;
        };
      };
      players: {
        Row: {
          id: string;
          game_room_id: string;
          user_id: string;
          points: number;
          guilty_verdicts: number;
          joined_at: string;
        };
        Insert: {
          id?: string;
          game_room_id: string;
          user_id: string;
          points?: number;
          guilty_verdicts?: number;
          joined_at?: string;
        };
        Update: {
          id?: string;
          game_room_id?: string;
          user_id?: string;
          points?: number;
          guilty_verdicts?: number;
          joined_at?: string;
        };
      };
      votes: {
        Row: {
          id: string;
          game_session_id: string;
          round_number: number;
          voter_id: string;
          voted_for_id: string | null;
          vote_type: 'suspect' | 'verdict';
          vote_value: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          game_session_id: string;
          round_number: number;
          voter_id: string;
          voted_for_id?: string | null;
          vote_type: 'suspect' | 'verdict';
          vote_value?: string | null;
          created_at?: string;
        };
        Update: {
          id?: string;
          game_session_id?: string;
          round_number?: number;
          voter_id?: string;
          voted_for_id?: string | null;
          vote_type?: 'suspect' | 'verdict';
          vote_value?: string | null;
          created_at?: string;
        };
      };
      question_packs: {
        Row: {
          id: string;
          name: string;
          is_premium: boolean;
          description: string;
          created_at: string;
        };
        Insert: {
          id?: string;
          name: string;
          is_premium?: boolean;
          description: string;
          created_at?: string;
        };
        Update: {
          id?: string;
          name?: string;
          is_premium?: boolean;
          description?: string;
          created_at?: string;
        };
      };
      questions: {
        Row: {
          id: string;
          pack_id: string;
          question_text: string;
          question_type: 'voting' | 'trial';
          created_at: string;
        };
        Insert: {
          id?: string;
          pack_id: string;
          question_text: string;
          question_type: 'voting' | 'trial';
          created_at?: string;
        };
        Update: {
          id?: string;
          pack_id?: string;
          question_text?: string;
          question_type?: 'voting' | 'trial';
          created_at?: string;
        };
      };
    };
    Views: {};
    Functions: {};
    Enums: {};
  };
}