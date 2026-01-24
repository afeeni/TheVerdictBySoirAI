import { useEffect, useCallback, useRef } from 'react';
import { supabase } from '../services/supabase';
import { useGameStore } from '../store/gameStore';
import { RealtimeChannel } from '@supabase/supabase-js';

export const useGameRealtime = (roomId: string | null) => {
  const { setPlayers, setTimeRemaining } = useGameStore();
  const channelRef = useRef<RealtimeChannel | null>(null);

  const subscribeToGame = useCallback(async () => {
    if (!roomId) return null;

    // All postgres_changes are already handled by gameStore.subscribeToRoom
    // This hook only handles broadcast events for real-time sync
    const channel = supabase.channel(`game-broadcast-${roomId}`);

    channel
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
        async () => {
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
          console.log('Game ended:', payload);
        }
      )
      .subscribe((status, err) => {
        if (status === 'SUBSCRIBED') {
          console.log('Broadcast channel subscribed');
        } else if (err) {
          console.error('Broadcast channel error:', err);
        }
      });

    channelRef.current = channel;
    return channel;
  }, [roomId, setPlayers, setTimeRemaining]);

  const unsubscribeFromGame = useCallback(async (channel: RealtimeChannel | null) => {
    if (channel) {
      await supabase.removeChannel(channel);
    }
    channelRef.current = null;
  }, []);

  const broadcastTimerUpdate = useCallback((timeRemaining: number) => {
    if (!channelRef.current) return;

    channelRef.current.send({
      type: 'broadcast',
      event: 'timer-update',
      payload: { timeRemaining },
    });
  }, []);

  const broadcastRoundComplete = useCallback(() => {
    if (!channelRef.current) return;

    channelRef.current.send({
      type: 'broadcast',
      event: 'round-complete',
      payload: {},
    });
  }, []);

  const broadcastGameEnd = useCallback(() => {
    if (!channelRef.current) return;

    channelRef.current.send({
      type: 'broadcast',
      event: 'game-end',
      payload: {},
    });
  }, []);

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