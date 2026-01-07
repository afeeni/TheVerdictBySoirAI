import { create } from 'zustand';
import { supabase, generateJoinCode } from '../services/supabase';
import {
  GameRoom,
  GameSession,
  Player,
  Question,
  Vote,
  GAME_CONFIGS,
  User,
} from '../types';
import { RealtimeChannel } from '@supabase/supabase-js';

interface GameState {
  // Current game state
  currentRoom: GameRoom | null;
  currentSession: GameSession | null;
  players: Player[];
  currentQuestion: Question | null;
  questions: Question[];
  votes: Vote[];
  timeRemaining: number;

  // Loading states
  isLoading: boolean;
  error: string | null;

  // Realtime channel
  channel: RealtimeChannel | null;

  // Actions
  createRoom: (
    hostId: string,
    gameMode: 'standard' | 'drinking',
    questionPackId: string,
    gameLength: 'quick' | 'standard' | 'extended'
  ) => Promise<string>;
  joinRoom: (joinCode: string, userId: string) => Promise<void>;
  leaveRoom: () => Promise<void>;
  startGame: () => Promise<void>;
  submitVote: (votedForId: string | null, voteValue?: string) => Promise<void>;
  nextQuestion: () => Promise<void>;
  calculateSuspect: () => Promise<string>;
  startTrial: () => Promise<void>;
  endGame: () => Promise<void>;
  subscribeToRoom: (roomId: string) => void;
  unsubscribeFromRoom: () => void;
  updateTimer: (seconds: number) => void;
  loadQuestions: (packId: string) => Promise<void>;
}

export const useGameStore = create<GameState>((set, get) => ({
  currentRoom: null,
  currentSession: null,
  players: [],
  currentQuestion: null,
  questions: [],
  votes: [],
  timeRemaining: 0,
  isLoading: false,
  error: null,
  channel: null,

  createRoom: async (hostId, gameMode, questionPackId, gameLength) => {
    set({ isLoading: true, error: null });
    try {
      const joinCode = generateJoinCode();

      // Create game room
      const { data: room, error: roomError } = await supabase
        .from('game_rooms')
        .insert({
          join_code: joinCode,
          host_id: hostId,
          game_mode: gameMode,
          question_pack_id: questionPackId,
          game_length: gameLength,
          status: 'lobby',
        })
        .select()
        .single();

      if (roomError) throw roomError;

      // Create game session
      const { data: session, error: sessionError } = await supabase
        .from('game_sessions')
        .insert({
          game_room_id: room.id,
          current_round: 1,
          current_phase: 'voting',
          scores: {},
        })
        .select()
        .single();

      if (sessionError) throw sessionError;

      // Add host as player
      const { error: playerError } = await supabase
        .from('players')
        .insert({
          game_room_id: room.id,
          user_id: hostId,
          points: 0,
          guilty_verdicts: 0,
        });

      if (playerError) throw playerError;

      // Load questions for the game
      await get().loadQuestions(questionPackId);

      set({
        currentRoom: {
          id: room.id,
          joinCode: room.join_code,
          hostId: room.host_id,
          gameMode: room.game_mode,
          questionPackId: room.question_pack_id,
          gameLength: room.game_length,
          status: room.status,
          createdAt: room.created_at,
        },
        currentSession: {
          id: session.id,
          gameRoomId: session.game_room_id,
          currentRound: session.current_round,
          currentPhase: session.current_phase,
          currentQuestionId: session.current_question_id,
          suspectId: session.suspect_id,
          timerEndTime: session.timer_end_time,
          scores: session.scores || {},
        },
        isLoading: false,
      });

      // Subscribe to realtime updates
      get().subscribeToRoom(room.id);

      return joinCode;
    } catch (error: any) {
      set({ error: error.message, isLoading: false });
      throw error;
    }
  },

  joinRoom: async (joinCode: string, userId: string) => {
    set({ isLoading: true, error: null });
    try {
      // Find room by join code
      const { data: room, error: roomError } = await supabase
        .from('game_rooms')
        .select('*')
        .eq('join_code', joinCode)
        .single();

      if (roomError) throw new Error('Invalid join code');
      if (room.status !== 'lobby') throw new Error('Game has already started');

      // Check if player already in game
      const { data: existingPlayer } = await supabase
        .from('players')
        .select('*')
        .eq('game_room_id', room.id)
        .eq('user_id', userId)
        .single();

      if (!existingPlayer) {
        // Add player to game
        const { error: playerError } = await supabase
          .from('players')
          .insert({
            game_room_id: room.id,
            user_id: userId,
            points: 0,
            guilty_verdicts: 0,
          });

        if (playerError) throw playerError;
      }

      // Get game session
      const { data: session, error: sessionError } = await supabase
        .from('game_sessions')
        .select('*')
        .eq('game_room_id', room.id)
        .single();

      if (sessionError) throw sessionError;

      // Load questions for the game
      await get().loadQuestions(room.question_pack_id);

      set({
        currentRoom: {
          id: room.id,
          joinCode: room.join_code,
          hostId: room.host_id,
          gameMode: room.game_mode,
          questionPackId: room.question_pack_id,
          gameLength: room.game_length,
          status: room.status,
          createdAt: room.created_at,
        },
        currentSession: {
          id: session.id,
          gameRoomId: session.game_room_id,
          currentRound: session.current_round,
          currentPhase: session.current_phase,
          currentQuestionId: session.current_question_id,
          suspectId: session.suspect_id,
          timerEndTime: session.timer_end_time,
          scores: session.scores || {},
        },
        isLoading: false,
      });

      // Subscribe to realtime updates
      get().subscribeToRoom(room.id);
    } catch (error: any) {
      set({ error: error.message, isLoading: false });
      throw error;
    }
  },

  leaveRoom: async () => {
    const { channel } = get();
    if (channel) {
      await supabase.removeChannel(channel);
    }
    set({
      currentRoom: null,
      currentSession: null,
      players: [],
      currentQuestion: null,
      questions: [],
      votes: [],
      timeRemaining: 0,
      channel: null,
    });
  },

  startGame: async () => {
    const { currentRoom, currentSession, questions } = get();
    if (!currentRoom || !currentSession) throw new Error('No active game');

    set({ isLoading: true, error: null });
    try {
      // Update room status
      const { error: roomError } = await supabase
        .from('game_rooms')
        .update({ status: 'voting' })
        .eq('id', currentRoom.id);

      if (roomError) throw roomError;

      // Set first question
      const votingQuestions = questions.filter(q => q.questionType === 'voting');
      const firstQuestion = votingQuestions[0];

      // Update session with first question and timer
      const config = GAME_CONFIGS[currentRoom.gameLength];
      const timerEndTime = new Date(Date.now() + config.timerSeconds.voting * 1000).toISOString();

      const { error: sessionError } = await supabase
        .from('game_sessions')
        .update({
          current_question_id: firstQuestion.id,
          timer_end_time: timerEndTime,
        })
        .eq('id', currentSession.id);

      if (sessionError) throw sessionError;

      set({
        currentRoom: { ...currentRoom, status: 'voting' },
        currentQuestion: firstQuestion,
        timeRemaining: config.timerSeconds.voting,
        isLoading: false,
      });
    } catch (error: any) {
      set({ error: error.message, isLoading: false });
      throw error;
    }
  },

  submitVote: async (votedForId: string | null, voteValue?: string) => {
    const { currentSession, currentRoom } = get();
    if (!currentSession || !currentRoom) throw new Error('No active game');

    set({ isLoading: true, error: null });
    try {
      const vote: any = {
        game_session_id: currentSession.id,
        round_number: currentSession.currentRound,
        voter_id: await getCurrentUserId(),
        vote_type: currentSession.currentPhase === 'voting' ? 'suspect' : 'verdict',
      };

      if (votedForId) vote.voted_for_id = votedForId;
      if (voteValue) vote.vote_value = voteValue;

      const { error } = await supabase.from('votes').insert(vote);
      if (error) throw error;

      set({ isLoading: false });
    } catch (error: any) {
      set({ error: error.message, isLoading: false });
      throw error;
    }
  },

  nextQuestion: async () => {
    const { currentRoom, currentSession, questions, currentQuestion } = get();
    if (!currentRoom || !currentSession || !currentQuestion) throw new Error('No active game');

    set({ isLoading: true, error: null });
    try {
      const config = GAME_CONFIGS[currentRoom.gameLength];
      const isVotingPhase = currentSession.currentPhase === 'voting';

      if (isVotingPhase) {
        // Calculate votes for current round
        await get().calculateVotes();

        // Check if we've completed all voting rounds
        if (currentSession.currentRound >= config.votingRounds) {
          // Move to trial phase
          await get().startTrial();
          return;
        }

        // Get next voting question
        const votingQuestions = questions.filter(q => q.questionType === 'voting');
        const nextQuestion = votingQuestions[currentSession.currentRound];

        // Update session
        const timerEndTime = new Date(Date.now() + config.timerSeconds.voting * 1000).toISOString();

        const { error } = await supabase
          .from('game_sessions')
          .update({
            current_round: currentSession.currentRound + 1,
            current_question_id: nextQuestion.id,
            timer_end_time: timerEndTime,
          })
          .eq('id', currentSession.id);

        if (error) throw error;

        set({
          currentSession: {
            ...currentSession,
            currentRound: currentSession.currentRound + 1,
            currentQuestionId: nextQuestion.id,
            timerEndTime,
          },
          currentQuestion: nextQuestion,
          timeRemaining: config.timerSeconds.voting,
          isLoading: false,
        });
      } else {
        // Trial phase
        const trialQuestions = questions.filter(q => q.questionType === 'trial');
        const currentIndex = trialQuestions.findIndex(q => q.id === currentQuestion.id);

        if (currentIndex >= config.trialQuestions - 1) {
          // End game
          await get().endGame();
          return;
        }

        // Get next trial question
        const nextQuestion = trialQuestions[currentIndex + 1];

        // Update session
        const timerEndTime = new Date(Date.now() + config.timerSeconds.trial * 1000).toISOString();

        const { error } = await supabase
          .from('game_sessions')
          .update({
            current_round: currentSession.currentRound + 1,
            current_question_id: nextQuestion.id,
            timer_end_time: timerEndTime,
          })
          .eq('id', currentSession.id);

        if (error) throw error;

        set({
          currentSession: {
            ...currentSession,
            currentRound: currentSession.currentRound + 1,
            currentQuestionId: nextQuestion.id,
            timerEndTime,
          },
          currentQuestion: nextQuestion,
          timeRemaining: config.timerSeconds.trial,
          isLoading: false,
        });
      }
    } catch (error: any) {
      set({ error: error.message, isLoading: false });
      throw error;
    }
  },

  calculateVotes: async () => {
    const { currentSession, players } = get();
    if (!currentSession) return;

    // Get votes for current round
    const { data: votes } = await supabase
      .from('votes')
      .select('*')
      .eq('game_session_id', currentSession.id)
      .eq('round_number', currentSession.currentRound)
      .eq('vote_type', 'suspect');

    if (votes) {
      // Count votes per player
      const voteCounts: Record<string, number> = {};
      votes.forEach(vote => {
        if (vote.voted_for_id) {
          voteCounts[vote.voted_for_id] = (voteCounts[vote.voted_for_id] || 0) + 1;
        }
      });

      // Find winner(s)
      const maxVotes = Math.max(...Object.values(voteCounts));
      const winners = Object.keys(voteCounts).filter(id => voteCounts[id] === maxVotes);

      // Update scores
      const newScores = { ...currentSession.scores };
      winners.forEach(winnerId => {
        newScores[winnerId] = (newScores[winnerId] || 0) + 1;
      });

      // Update session scores
      await supabase
        .from('game_sessions')
        .update({ scores: newScores })
        .eq('id', currentSession.id);

      // Update player points
      for (const winnerId of winners) {
        await supabase
          .from('players')
          .update({ points: newScores[winnerId] })
          .eq('game_room_id', currentSession.gameRoomId)
          .eq('user_id', winnerId);
      }
    }
  },

  calculateSuspect: async () => {
    const { currentSession } = get();
    if (!currentSession) throw new Error('No active session');

    // Find player with most points
    const scores = currentSession.scores;
    const maxScore = Math.max(...Object.values(scores));
    const suspects = Object.keys(scores).filter(id => scores[id] === maxScore);

    // If tie, pick random
    const suspectId = suspects[Math.floor(Math.random() * suspects.length)];

    return suspectId;
  },

  startTrial: async () => {
    const { currentRoom, currentSession, questions } = get();
    if (!currentRoom || !currentSession) throw new Error('No active game');

    set({ isLoading: true, error: null });
    try {
      // Calculate who is the suspect
      const suspectId = await get().calculateSuspect();

      // Update room status
      await supabase
        .from('game_rooms')
        .update({ status: 'trial' })
        .eq('id', currentRoom.id);

      // Get first trial question
      const trialQuestions = questions.filter(q => q.questionType === 'trial');
      const firstQuestion = trialQuestions[0];

      // Update session
      const config = GAME_CONFIGS[currentRoom.gameLength];
      const timerEndTime = new Date(Date.now() + config.timerSeconds.trial * 1000).toISOString();

      const { error } = await supabase
        .from('game_sessions')
        .update({
          current_phase: 'trial',
          current_round: 1,
          suspect_id: suspectId,
          current_question_id: firstQuestion.id,
          timer_end_time: timerEndTime,
        })
        .eq('id', currentSession.id);

      if (error) throw error;

      set({
        currentRoom: { ...currentRoom, status: 'trial' },
        currentSession: {
          ...currentSession,
          currentPhase: 'trial',
          currentRound: 1,
          suspectId,
          currentQuestionId: firstQuestion.id,
          timerEndTime,
        },
        currentQuestion: firstQuestion,
        timeRemaining: config.timerSeconds.trial,
        isLoading: false,
      });
    } catch (error: any) {
      set({ error: error.message, isLoading: false });
      throw error;
    }
  },

  endGame: async () => {
    const { currentRoom, currentSession } = get();
    if (!currentRoom || !currentSession) throw new Error('No active game');

    set({ isLoading: true, error: null });
    try {
      // Calculate guilty verdicts
      const { data: verdictVotes } = await supabase
        .from('votes')
        .select('*')
        .eq('game_session_id', currentSession.id)
        .eq('vote_type', 'verdict')
        .eq('vote_value', 'guilty');

      if (verdictVotes && currentSession.suspectId) {
        const guiltyCount = verdictVotes.length;

        // Update suspect's guilty verdict count
        await supabase
          .from('players')
          .update({ guilty_verdicts: guiltyCount })
          .eq('game_room_id', currentRoom.id)
          .eq('user_id', currentSession.suspectId);
      }

      // Update room status
      await supabase
        .from('game_rooms')
        .update({ status: 'finished' })
        .eq('id', currentRoom.id);

      set({
        currentRoom: { ...currentRoom, status: 'finished' },
        isLoading: false,
      });
    } catch (error: any) {
      set({ error: error.message, isLoading: false });
      throw error;
    }
  },

  subscribeToRoom: (roomId: string) => {
    const channel = supabase
      .channel(`room:${roomId}`)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'game_rooms', filter: `id=eq.${roomId}` },
        (payload) => {
          if (payload.eventType === 'UPDATE') {
            set((state) => ({
              currentRoom: state.currentRoom
                ? { ...state.currentRoom, ...payload.new }
                : null,
            }));
          }
        }
      )
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'game_sessions', filter: `game_room_id=eq.${roomId}` },
        (payload) => {
          if (payload.eventType === 'UPDATE') {
            set((state) => ({
              currentSession: state.currentSession
                ? { ...state.currentSession, ...payload.new }
                : null,
            }));
          }
        }
      )
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'players', filter: `game_room_id=eq.${roomId}` },
        async () => {
          // Reload players list
          const { data: players } = await supabase
            .from('players')
            .select('*, user:users(*)')
            .eq('game_room_id', roomId);

          if (players) {
            set({ players: players as any });
          }
        }
      )
      .subscribe();

    set({ channel });
  },

  unsubscribeFromRoom: () => {
    const { channel } = get();
    if (channel) {
      supabase.removeChannel(channel);
      set({ channel: null });
    }
  },

  updateTimer: (seconds: number) => {
    set({ timeRemaining: seconds });
  },

  loadQuestions: async (packId: string) => {
    const { data: questions, error } = await supabase
      .from('questions')
      .select('*')
      .eq('pack_id', packId)
      .order('created_at');

    if (error) throw error;

    set({ questions: questions || [] });
  },
}));

// Helper function to get current user ID
async function getCurrentUserId(): Promise<string> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error('No user logged in');
  return user.id;
}