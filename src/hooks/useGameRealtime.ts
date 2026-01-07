import { useEffect, useCallback } from 'react';
import { supabase } from '../services/supabase';
import { useGameStore } from '../store/gameStore';
import { RealtimeChannel, RealtimePostgresChangesPayload } from '@supabase/supabase-js';

export const useGameRealtime = (roomId: string | null) => {
  const {
    setCurrentRoom,
    setCurrentSession,
    setPlayers,
    addPlayer,
    removePlayer,
    updatePlayer,
    setCurrentQuestion,
    setTimeRemaining,
    setVotes,
    addVote,
  } = useGameStore();

  const subscribeToGame = useCallback(async () => {
    if (!roomId) return null;

    // Create a channel for this game room
    const channel = supabase.channel(`game-${roomId}`);

    // Subscribe to game_rooms changes
    channel
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'game_rooms',
          filter: `id=eq.${roomId}`,
        },
        async (payload: RealtimePostgresChangesPayload<any>) => {
          if (payload.eventType === 'UPDATE') {
            setCurrentRoom(payload.new);
          }
        }
      )
      // Subscribe to game_sessions changes
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'game_sessions',
          filter: `game_room_id=eq.${roomId}`,
        },
        async (payload: RealtimePostgresChangesPayload<any>) => {
          if (payload.eventType === 'INSERT' || payload.eventType === 'UPDATE') {
            const session = payload.new;
            setCurrentSession(session);

            // If there's a new question, fetch it
            if (session.current_question_id) {
              const { data: question } = await supabase
                .from('questions')
                .select('*')
                .eq('id', session.current_question_id)
                .single();

              if (question) {
                setCurrentQuestion(question);
              }
            }

            // Update timer
            if (session.timer_end_time) {
              const endTime = new Date(session.timer_end_time).getTime();
              const now = Date.now();
              const remaining = Math.max(0, Math.floor((endTime - now) / 1000));
              setTimeRemaining(remaining);
            }
          }
        }
      )
      // Subscribe to players changes
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'players',
          filter: `game_room_id=eq.${roomId}`,
        },
        async (payload: RealtimePostgresChangesPayload<any>) => {
          if (payload.eventType === 'INSERT') {
            // Fetch user data for new player
            const { data: user } = await supabase
              .from('users')
              .select('*')
              .eq('id', payload.new.user_id)
              .single();

            if (user) {
              addPlayer({ ...payload.new, user });
            }
          } else if (payload.eventType === 'UPDATE') {
            updatePlayer(payload.new.id, payload.new);
          } else if (payload.eventType === 'DELETE') {
            removePlayer(payload.old.id);
          }
        }
      )
      // Subscribe to votes changes
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'votes',
        },
        async (payload: RealtimePostgresChangesPayload<any>) => {
          // Check if this vote belongs to our game session
          const { data: session } = await supabase
            .from('game_sessions')
            .select('game_room_id')
            .eq('id', payload.new.game_session_id)
            .single();

          if (session?.game_room_id === roomId) {
            addVote(payload.new);
          }
        }
      )
      // Subscribe to broadcast events for real-time updates
      .on(
        'broadcast',
        { event: 'timer-update' },
        (payload) => {
          setTimeRemaining(payload.payload.timeRemaining);
        }
      )
      .on(
        'broadcast',
        { event: 'round-complete' },
        async (payload) => {
          // Fetch updated scores
          const { data: players } = await supabase
            .from('players')
            .select('*, user:users(*)')
            .eq('game_room_id', roomId);

          if (players) {
            setPlayers(players);
          }
        }
      )
      .on(
        'broadcast',
        { event: 'game-end' },
        (payload) => {
          // Navigate to results
          console.log('Game ended:', payload);
        }
      )
      .subscribe();

    return channel;
  }, [roomId]);

  const unsubscribeFromGame = useCallback(async (channel: RealtimeChannel | null) => {
    if (channel) {
      await supabase.removeChannel(channel);
    }
  }, []);

  const broadcastTimerUpdate = useCallback((timeRemaining: number) => {
    if (!roomId) return;

    const channel = supabase.channel(`game-${roomId}`);
    channel.send({
      type: 'broadcast',
      event: 'timer-update',
      payload: { timeRemaining },
    });
  }, [roomId]);

  const broadcastRoundComplete = useCallback(() => {
    if (!roomId) return;

    const channel = supabase.channel(`game-${roomId}`);
    channel.send({
      type: 'broadcast',
      event: 'round-complete',
      payload: {},
    });
  }, [roomId]);

  const broadcastGameEnd = useCallback(() => {
    if (!roomId) return;

    const channel = supabase.channel(`game-${roomId}`);
    channel.send({
      type: 'broadcast',
      event: 'game-end',
      payload: {},
    });
  }, [roomId]);

  return {
    subscribeToGame,
    unsubscribeFromGame,
    broadcastTimerUpdate,
    broadcastRoundComplete,
    broadcastGameEnd,
  };
};

// Hook for presence (showing who's online in the game)
export const useGamePresence = (roomId: string | null, userId: string | null) => {
  useEffect(() => {
    if (!roomId || !userId) return;

    const channel = supabase.channel(`presence-${roomId}`);

    channel
      .on('presence', { event: 'sync' }, () => {
        const state = channel.presenceState();
        console.log('Presence state:', state);
      })
      .on('presence', { event: 'join' }, ({ key, newPresences }) => {
        console.log('User joined:', key, newPresences);
      })
      .on('presence', { event: 'leave' }, ({ key, leftPresences }) => {
        console.log('User left:', key, leftPresences);
      })
      .subscribe(async (status) => {
        if (status === 'SUBSCRIBED') {
          await channel.track({
            user_id: userId,
            online_at: new Date().toISOString(),
          });
        }
      });

    return () => {
      channel.unsubscribe();
    };
  }, [roomId, userId]);
};