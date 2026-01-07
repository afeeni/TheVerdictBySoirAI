export interface User {
  id: string;
  name: string;
  age?: number | null;
  frontPhotoUrl?: string | null;
  sidePhotoUrl?: string | null;
  knownFor?: string | null;
  redFlag?: string | null;
  guiltyPleasure?: string | null;
  secretTalent?: string | null;
  hotTake?: string | null;
  subscriptionTier: 'free' | 'premium';
  gamesHostedThisMonth: number;
  totalGamesHosted: number;
}

export interface GameRoom {
  id: string;
  joinCode: string;
  hostId: string;
  gameMode: 'standard' | 'drinking';
  questionPackId: string;
  gameLength: 'quick' | 'standard' | 'extended';
  status: 'lobby' | 'voting' | 'trial' | 'finished';
  createdAt: string;
}

export interface GameSession {
  id: string;
  gameRoomId: string;
  currentRound: number;
  currentPhase: 'voting' | 'trial';
  currentQuestionId?: string | null;
  suspectId?: string | null;
  timerEndTime?: string | null;
  scores: Record<string, number>;
}

export interface Player {
  id: string;
  gameRoomId: string;
  userId: string;
  points: number;
  guiltyVerdicts: number;
  user?: User;
}

export interface Question {
  id: string;
  packId: string;
  questionText: string;
  questionType: 'voting' | 'trial';
}

export interface QuestionPack {
  id: string;
  name: string;
  isPremium: boolean;
  description: string;
}

export interface Vote {
  id?: string;
  gameSessionId: string;
  roundNumber: number;
  voterId: string;
  votedForId?: string | null;
  voteType: 'suspect' | 'verdict';
  voteValue?: string | null;
}

export interface GameConfig {
  votingRounds: number;
  trialQuestions: number;
  timerSeconds: {
    voting: number;
    trial: number;
  };
}

export const GAME_CONFIGS: Record<'quick' | 'standard' | 'extended', GameConfig> = {
  quick: {
    votingRounds: 5,
    trialQuestions: 8,
    timerSeconds: {
      voting: 30,
      trial: 20,
    },
  },
  standard: {
    votingRounds: 7,
    trialQuestions: 10,
    timerSeconds: {
      voting: 30,
      trial: 20,
    },
  },
  extended: {
    votingRounds: 10,
    trialQuestions: 12,
    timerSeconds: {
      voting: 30,
      trial: 20,
    },
  },
};