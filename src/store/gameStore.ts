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
  votesChannel: RealtimeChannel | null;

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
  resetForPlayAgain: () => Promise<void>;
  subscribeToRoom: (roomId: string) => void;
  unsubscribeFromRoom: () => void;
  updateTimer: (seconds: number) => void;
  loadQuestions: (packId: string) => Promise<void>;
  addVote: (vote: any) => void;
  setCurrentSession: (session: any) => void;
  setCurrentQuestion: (question: any) => void;
  resetGame: () => void;
  clearVotes: () => void;
  setCurrentRoom: (room: any) => void;
  setPlayers: (players: any[]) => void;
  addPlayer: (player: any) => void;
  removePlayer: (playerId: string) => void;
  updatePlayer: (playerId: string, updates: any) => void;
  setTimeRemaining: (seconds: number) => void;
  setVotes: (votes: any[]) => void;
}

let isAdvancing = false;

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
  votesChannel: null,

  createRoom: async (hostId, gameMode, questionPackId, gameLength) => {
    // Clear any existing game state
    set({ isLoading: true, error: null, votes: [], players: [] });
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

      // Load initial players list
      const { data: initialPlayers } = await supabase
        .from('players')
        .select('*, user:users(*)')
        .eq('game_room_id', room.id);

      if (initialPlayers) {
        console.log('createRoom: Setting initial players:', initialPlayers.length);
        set({ players: initialPlayers as any });
      }

      // Subscribe to realtime updates
      console.log('createRoom: About to subscribe to room:', room.id);
      get().subscribeToRoom(room.id);
      console.log('createRoom: Subscription setup complete');

      return joinCode;
    } catch (error: any) {
      set({ error: error.message, isLoading: false });
      throw error;
    }
  },

  joinRoom: async (joinCode: string, userId: string) => {
    // Clear any existing game state
    set({ isLoading: true, error: null, votes: [], players: [] });
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

      // Load initial players list
      const { data: initialPlayers } = await supabase
        .from('players')
        .select('*, user:users(*)')
        .eq('game_room_id', room.id);

      if (initialPlayers) {
        console.log('joinRoom: Setting initial players:', initialPlayers.length);
        set({ players: initialPlayers as any });
      }

      // Subscribe to realtime updates
      console.log('joinRoom: About to subscribe to room:', room.id);
      get().subscribeToRoom(room.id);
      console.log('joinRoom: Subscription setup complete');
    } catch (error: any) {
      console.error('joinRoom error:', error);
      set({ error: error.message, isLoading: false });
      throw error;
    }
  },

  leaveRoom: async () => {
    const { channel, votesChannel } = get();
    if (channel) {
      await supabase.removeChannel(channel);
    }
    if (votesChannel) {
      await supabase.removeChannel(votesChannel);
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
      votesChannel: null,
    });
  },

  startGame: async () => {
    const { currentRoom, currentSession, questions } = get();
    if (!currentRoom || !currentSession) throw new Error('No active game');

    // Clear any existing votes from previous games
    console.log('Starting game - clearing votes. Previous vote count:', get().votes.length);
    set({ isLoading: true, error: null, votes: [] });
    console.log('Votes cleared. New vote count:', get().votes.length);
    try {
      // Update room status
      const { error: roomError } = await supabase
        .from('game_rooms')
        .update({ status: 'voting' })
        .eq('id', currentRoom.id);

      if (roomError) throw roomError;

      // Set first question - handle both camelCase and snake_case
      const votingQuestions = questions.filter(q =>
        q.questionType === 'voting' || (q as any).question_type === 'voting'
      );
      const firstQuestion = votingQuestions[0];

      if (!firstQuestion) {
        throw new Error('No voting questions found. Please check question pack.');
      }

      // Handle both camelCase and snake_case for gameLength
      const gameLength = currentRoom.gameLength || (currentRoom as any).game_length || 'standard';
      const config = GAME_CONFIGS[gameLength as keyof typeof GAME_CONFIGS];
      const timerEndTime = new Date(Date.now() + config.timerSeconds.voting * 1000).toISOString();

      // Get session ID - handle both cases
      const sessionId = currentSession.id;

      const { error: sessionError } = await supabase
        .from('game_sessions')
        .update({
          current_question_id: firstQuestion.id,
          timer_end_time: timerEndTime,
        })
        .eq('id', sessionId);

      if (sessionError) throw sessionError;

      set({
        currentRoom: { ...currentRoom, status: 'voting' },
        currentQuestion: firstQuestion,
        timeRemaining: config.timerSeconds.voting,
        isLoading: false,
      });
    } catch (error: any) {
      console.error('startGame error:', error);
      set({ error: error.message, isLoading: false });
      throw error;
    }
  },

  submitVote: async (votedForId: string | null, voteValue?: string) => {
    const { currentSession, currentRoom } = get();
    if (!currentSession || !currentRoom) throw new Error('No active game');

    set({ isLoading: true, error: null });
    try {
      // Handle both camelCase (from initial load) and snake_case (from realtime updates)
      const sessionId = currentSession.id;
      const roundNumber = currentSession.currentRound || (currentSession as any).current_round || 1;
      const currentPhase = currentSession.currentPhase || (currentSession as any).current_phase || 'voting';

      const vote: any = {
        game_session_id: sessionId,
        round_number: roundNumber,
        voter_id: await getCurrentUserId(),
        vote_type: currentPhase === 'voting' ? 'suspect' : 'verdict',
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
    if (!currentRoom || !currentSession) throw new Error('No active game');

    // Prevent rapid successive calls
    if (isAdvancing) {
      console.log('Already advancing, skipping duplicate call');
      return;
    }
    isAdvancing = true;

    set({ isLoading: true, error: null });
    try {
      // Handle both camelCase and snake_case
      const gameLength = currentRoom.gameLength || (currentRoom as any).game_length || 'standard';
      const config = GAME_CONFIGS[gameLength as keyof typeof GAME_CONFIGS];
      const currentPhase = currentSession.currentPhase || (currentSession as any).current_phase || 'voting';
      const currentRound = currentSession.currentRound || (currentSession as any).current_round || 1;
      const sessionId = currentSession.id;

      const isVotingPhase = currentPhase === 'voting';

      if (isVotingPhase) {
        // Calculate votes for current round
        await get().calculateVotes();

        // Check if we've completed all voting rounds
        if (currentRound >= config.votingRounds) {
          // Move to trial phase
          await get().startTrial();
          return;
        }

        // Get next voting question - filter with both camelCase and snake_case
        const votingQuestions = questions.filter(q =>
          q.questionType === 'voting' || (q as any).question_type === 'voting'
        );

        // currentRound is 1-based, array is 0-based, so next question is at index currentRound
        const nextQuestionData = votingQuestions[currentRound];

        if (!nextQuestionData) {
          console.error('No next question found at index', currentRound);
          throw new Error('No more questions available');
        }

        // Update session
        const timerEndTime = new Date(Date.now() + config.timerSeconds.voting * 1000).toISOString();

        const { error } = await supabase
          .from('game_sessions')
          .update({
            current_round: currentRound + 1,
            current_question_id: nextQuestionData.id,
            timer_end_time: timerEndTime,
          })
          .eq('id', sessionId);

        if (error) throw error;

        set({
          currentSession: {
            ...currentSession,
            currentRound: currentRound + 1,
            currentQuestionId: nextQuestionData.id,
            timerEndTime,
          },
          currentQuestion: nextQuestionData,
          timeRemaining: config.timerSeconds.voting,
          isLoading: false,
        });
      } else {
        // Trial phase
        const trialQuestions = questions.filter(q =>
          q.questionType === 'trial' || (q as any).question_type === 'trial'
        );

        console.log('Trial phase - found', trialQuestions.length, 'trial questions, config requires', config.trialQuestions);

        const currentQuestionId = currentQuestion?.id || (currentSession as any)?.current_question_id;
        console.log('Current question ID:', currentQuestionId);

        // If no current question ID, start from the first trial question
        let currentIndex = -1;
        if (currentQuestionId) {
          currentIndex = trialQuestions.findIndex(q => q.id === currentQuestionId);
        }
        console.log('Current index:', currentIndex);

        // Check if we've completed all trial questions
        const questionsCompleted = currentIndex + 1; // 0-based to 1-based
        if (questionsCompleted >= config.trialQuestions || trialQuestions.length === 0) {
          console.log('All trial questions completed, ending game');
          await get().endGame();
          return;
        }

        // Get next trial question
        const nextQuestionData = trialQuestions[currentIndex + 1];

        if (!nextQuestionData) {
          console.log('No more trial questions available, ending game');
          await get().endGame();
          return;
        }

        console.log('Advancing to trial question:', nextQuestionData.id);

        // Update session
        const timerEndTime = new Date(Date.now() + config.timerSeconds.trial * 1000).toISOString();

        const { error } = await supabase
          .from('game_sessions')
          .update({
            current_round: currentRound + 1,
            current_question_id: nextQuestionData.id,
            timer_end_time: timerEndTime,
          })
          .eq('id', sessionId);

        if (error) {
          console.error('Error updating session for trial question:', error);
          throw error;
        }

        set({
          currentSession: {
            ...currentSession,
            currentRound: currentRound + 1,
            currentQuestionId: nextQuestionData.id,
            timerEndTime,
          },
          currentQuestion: nextQuestionData,
          timeRemaining: config.timerSeconds.trial,
          isLoading: false,
        });
      }
    } catch (error: any) {
      set({ error: error.message, isLoading: false });
      throw error;
    } finally {
      // Reset the flag after a delay to allow the next advancement
      setTimeout(() => {
        isAdvancing = false;
      }, 1000);
    }
  },

  calculateVotes: async () => {
    const { currentSession, players } = get();
    if (!currentSession) return;

    // Handle both camelCase and snake_case
    const currentRound = currentSession.currentRound || (currentSession as any).current_round || 1;
    const sessionId = currentSession.id;
    const gameRoomId = currentSession.gameRoomId || (currentSession as any).game_room_id;

    // Get votes for current round
    const { data: votes } = await supabase
      .from('votes')
      .select('*')
      .eq('game_session_id', sessionId)
      .eq('round_number', currentRound)
      .eq('vote_type', 'suspect');

    if (votes && votes.length > 0) {
      // Count votes per player
      const voteCounts: Record<string, number> = {};
      votes.forEach(vote => {
        if (vote.voted_for_id) {
          voteCounts[vote.voted_for_id] = (voteCounts[vote.voted_for_id] || 0) + 1;
        }
      });

      // Find winner(s)
      const voteValues = Object.values(voteCounts);
      if (voteValues.length === 0) return;

      const maxVotes = Math.max(...voteValues);
      const winners = Object.keys(voteCounts).filter(id => voteCounts[id] === maxVotes);

      // Update scores
      const existingScores = currentSession.scores || {};
      const newScores = { ...existingScores };
      winners.forEach(winnerId => {
        newScores[winnerId] = (newScores[winnerId] || 0) + 1;
      });

      // Update session scores
      await supabase
        .from('game_sessions')
        .update({ scores: newScores })
        .eq('id', sessionId);

      // Update player points
      for (const winnerId of winners) {
        await supabase
          .from('players')
          .update({ points: newScores[winnerId] })
          .eq('game_room_id', gameRoomId)
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

    // Clear votes from voting phase before starting trial
    set({ isLoading: true, error: null, votes: [] });
    try {
      // Calculate who is the suspect
      const suspectId = await get().calculateSuspect();

      // Update room status
      await supabase
        .from('game_rooms')
        .update({ status: 'trial' })
        .eq('id', currentRoom.id);

      // Get first trial question - handle both camelCase and snake_case
      const trialQuestions = questions.filter(q =>
        q.questionType === 'trial' || (q as any).question_type === 'trial'
      );
      const firstQuestion = trialQuestions[0];

      if (!firstQuestion) {
        throw new Error('No trial questions available');
      }

      // Update session - handle both camelCase and snake_case
      const gameLength = currentRoom.gameLength || (currentRoom as any).game_length || 'standard';
      const config = GAME_CONFIGS[gameLength as keyof typeof GAME_CONFIGS];
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

  resetForPlayAgain: async () => {
    const { currentRoom, currentSession } = get();
    if (!currentRoom) throw new Error('No active game room');

    set({ isLoading: true, error: null });
    try {
      const roomId = currentRoom.id;
      const questionPackId = currentRoom.questionPackId || (currentRoom as any).question_pack_id;

      // Delete old game session and all votes
      if (currentSession?.id) {
        await supabase.from('votes').delete().eq('game_session_id', currentSession.id);
        await supabase.from('game_sessions').delete().eq('id', currentSession.id);
      }

      // Reset all players' points and guilty verdicts
      await supabase
        .from('players')
        .update({ points: 0, guilty_verdicts: 0 })
        .eq('game_room_id', roomId);

      // Create new game session
      const { data: newSession, error: sessionError } = await supabase
        .from('game_sessions')
        .insert({
          game_room_id: roomId,
          current_round: 1,
          current_phase: 'voting',
          scores: {},
        })
        .select()
        .single();

      if (sessionError) throw sessionError;

      // Update room status back to lobby
      const { error: roomError } = await supabase
        .from('game_rooms')
        .update({ status: 'lobby' })
        .eq('id', roomId);

      if (roomError) throw roomError;

      // Reload questions
      await get().loadQuestions(questionPackId);

      // Clear local state
      set({
        currentSession: {
          id: newSession.id,
          gameRoomId: newSession.game_room_id,
          currentRound: newSession.current_round,
          currentPhase: newSession.current_phase,
          currentQuestionId: newSession.current_question_id,
          suspectId: newSession.suspect_id,
          timerEndTime: newSession.timer_end_time,
          scores: newSession.scores || {},
        },
        currentRoom: { ...currentRoom, status: 'lobby' },
        currentQuestion: null,
        votes: [],
        timeRemaining: 0,
        isLoading: false,
      });

      // Reload players with reset stats
      const { data: resetPlayers } = await supabase
        .from('players')
        .select('*, user:users(*)')
        .eq('game_room_id', roomId);

      if (resetPlayers) {
        set({ players: resetPlayers as any });
      }
    } catch (error: any) {
      set({ error: error.message, isLoading: false });
      throw error;
    }
  },

  subscribeToRoom: (roomId: string) => {
    // Clean up any existing channel first
    const { channel: existingChannel, votesChannel: existingVotesChannel, currentSession } = get();
    console.log('subscribeToRoom called - roomId:', roomId, 'hasExistingChannel:', !!existingChannel, 'sessionId:', currentSession?.id);

    if (existingChannel) {
      console.log('Cleaning up existing channel before subscribing');
      supabase.removeChannel(existingChannel);
      set({ channel: null });
    }
    if (existingVotesChannel) {
      supabase.removeChannel(existingVotesChannel);
      set({ votesChannel: null });
    }

    console.log('Setting up subscription for room:', roomId);
    const channel = supabase
      .channel(`room:${roomId}`, {
        config: {
          broadcast: { self: true },
        },
      })
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'game_rooms', filter: `id=eq.${roomId}` },
        (payload) => {
          console.log('Game room update:', payload);
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
        async (payload) => {
          console.log('Game session update:', payload);
          if (payload.eventType === 'UPDATE') {
            const newSession = payload.new;

            // Update session state
            set((state) => {
              const prev = state.currentSession;
              const normalizedSession = {
                id: newSession.id ?? prev?.id,
                gameRoomId: newSession.game_room_id ?? prev?.gameRoomId,
                currentRound: newSession.current_round ?? prev?.currentRound,
                currentPhase: newSession.current_phase ?? prev?.currentPhase,
                currentQuestionId: newSession.current_question_id ?? prev?.currentQuestionId,
                suspectId: newSession.suspect_id ?? prev?.suspectId,
                timerEndTime: newSession.timer_end_time ?? prev?.timerEndTime,
                scores: newSession.scores ?? prev?.scores ?? {},
              };

              return { currentSession: normalizedSession };
            });

            // If there's a new question ID, fetch the question
            if (newSession.current_question_id) {
              const { data: question } = await supabase
                .from('questions')
                .select('*')
                .eq('id', newSession.current_question_id)
                .single();

              if (question) {
                console.log('Fetched question:', question.question_text);
                set({ currentQuestion: question });
              }
            }

            // Update timer if there's a new timer_end_time
            if (newSession.timer_end_time) {
              const endTime = new Date(newSession.timer_end_time).getTime();
              const now = Date.now();
              const remaining = Math.max(0, Math.floor((endTime - now) / 1000));
              set({ timeRemaining: remaining });
            }
          }
        }
      )
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'players', filter: `game_room_id=eq.${roomId}` },
        async (payload) => {
          console.log('Player INSERT:', payload);
          // Reload players list when a new player joins
          const { data: players } = await supabase
            .from('players')
            .select('*, user:users(*)')
            .eq('game_room_id', roomId);

          console.log('Reloaded players:', players);
          if (players) {
            set({ players: players as any });
          }
        }
      )
      .on(
        'postgres_changes',
        { event: 'DELETE', schema: 'public', table: 'players', filter: `game_room_id=eq.${roomId}` },
        async (payload) => {
          console.log('Player DELETE:', payload);
          // Reload players list when a player leaves
          const { data: players } = await supabase
            .from('players')
            .select('*, user:users(*)')
            .eq('game_room_id', roomId);

          if (players) {
            set({ players: players as any });
          }
        }
      )
      .subscribe((status, err) => {
        console.log('Subscription status:', status, 'for room:', roomId);
        if (err) {
          console.error('Subscription error details:', JSON.stringify(err));
        }
        if (status === 'SUBSCRIBED') {
          console.log('Successfully subscribed to room:', roomId, '- channel state:', channel.state);

          // Now set up votes subscription with session filter
          const { currentSession } = get();
          const sessionId = currentSession?.id;
          if (sessionId) {
            console.log('Setting up votes subscription for session:', sessionId);
            const { votesChannel: existingVotesChannel } = get();
            if (existingVotesChannel) {
              supabase.removeChannel(existingVotesChannel);
              set({ votesChannel: null });
            }

            const votesChannel = supabase
              .channel(`votes:${sessionId}`)
              .on(
                'postgres_changes',
                {
                  event: 'INSERT',
                  schema: 'public',
                  table: 'votes',
                  filter: `game_session_id=eq.${sessionId}`,
                },
                (payload) => {
                  console.log('Vote INSERT:', payload);
                  const newVote = payload.new;
                  const { votes } = get();

                  // Check if vote already exists (prevent duplicates)
                  const voteExists = votes.some(v => v.id === newVote.id);
                  if (!voteExists) {
                    set((state) => ({
                      votes: [...state.votes, newVote],
                    }));
                    console.log('Added vote, total votes:', get().votes.length);
                  } else {
                    console.log('Vote already exists, skipping');
                  }
                }
              )
              .subscribe((voteStatus, voteErr) => {
                if (voteStatus === 'SUBSCRIBED') {
                  console.log('Votes subscription active');
                } else if (voteErr) {
                  console.error('Votes subscription error:', voteErr);
                }
              });

            set({ votesChannel });
          }
        } else if (status === 'CHANNEL_ERROR') {
          console.error('Channel error - check Supabase realtime config');
        } else if (status === 'TIMED_OUT') {
          console.error('Subscription timed out');
        } else if (status === 'CLOSED') {
          console.log('Subscription closed');
        }
      });

    set({ channel });
  },

  unsubscribeFromRoom: () => {
    const { channel, votesChannel } = get();
    if (channel) {
      supabase.removeChannel(channel);
    }
    if (votesChannel) {
      supabase.removeChannel(votesChannel);
    }
    set({ channel: null, votesChannel: null });
  },

  updateTimer: (seconds: number) => {
    set({ timeRemaining: seconds });
  },

  loadQuestions: async (packId: string) => {
    console.log('Loading questions for pack:', packId);
    const { data: questions, error } = await supabase
      .from('questions')
      .select('*')
      .eq('pack_id', packId);

    if (error) {
      console.error('Error loading questions:', error);
      throw error;
    }

    // Shuffle questions randomly
    const shuffled = [...(questions || [])].sort(() => Math.random() - 0.5);

    console.log('Loaded and shuffled questions:', shuffled?.length, 'questions');
    set({ questions: shuffled });
  },

  addVote: (vote: any) => {
    set((state) => ({
      votes: [...state.votes, vote],
    }));
  },

  setCurrentSession: (session: any) => {
    set({ currentSession: session });
  },

  setCurrentQuestion: (question: any) => {
    set({ currentQuestion: question });
  },

  resetGame: () => {
    const { channel, votesChannel } = get();
    if (channel) {
      supabase.removeChannel(channel);
    }
    if (votesChannel) {
      supabase.removeChannel(votesChannel);
    }
    set({
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
      votesChannel: null,
    });
  },

  clearVotes: () => {
    set({ votes: [] });
  },

  setCurrentRoom: (room: any) => {
    set({ currentRoom: room });
  },

  setPlayers: (players: any[]) => {
    set({ players });
  },

  addPlayer: (player: any) => {
    set((state) => ({
      players: [...state.players, player],
    }));
  },

  removePlayer: (playerId: string) => {
    set((state) => ({
      players: state.players.filter((p) => p.id !== playerId),
    }));
  },

  updatePlayer: (playerId: string, updates: any) => {
    set((state) => ({
      players: state.players.map((p) =>
        p.id === playerId ? { ...p, ...updates } : p
      ),
    }));
  },

  setTimeRemaining: (seconds: number) => {
    set({ timeRemaining: seconds });
  },

  setVotes: (votes: any[]) => {
    set({ votes });
  },
}));

// Helper function to get current user ID
async function getCurrentUserId(): Promise<string> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error('No user logged in');
  return user.id;
}
