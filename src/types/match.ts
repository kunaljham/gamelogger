// Types matching the backend Go models exactly.
// Used by the feed page and (later) the match logging form.

export interface Game {
  id: string;
  match_id: string;
  game_number: number;
  user_score: number;
  opponent_score: number;
}

export interface Opponent {
  id: string;
  user_id: string;
  email?: string;
  name: string;
  is_registered: boolean;
  created_at: string;
  updated_at: string;
}

export interface Match {
  id: string;
  user_id: string;
  opponent_id: string;
  opponent?: Opponent;
  match_type: "bo3" | "bo5";
  played_at: string;
  notes?: string;
  games: Game[];
  user_won: boolean;
  user_wins: number;
  opponent_wins: number;
  created_at: string;
  updated_at: string;
}

export interface ListMatchesResponse {
  matches: Match[];
  next_cursor?: string;
}

export interface ListOpponentsResponse {
  opponents: Opponent[];
}
