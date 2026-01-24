import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  Image,
  Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { RootStackParamList } from '../navigation/AppNavigator';
import { useGameStore } from '../store/gameStore';
import { useAuthStore } from '../store/authStore';
import { supabase } from '../services/supabase';

type Props = NativeStackScreenProps<RootStackParamList, 'Results'>;

interface PlayerStats {
  user_id: string;
  name: string;
  photo_url: string | null;
  points: number;
  guilty_verdicts: number;
  total_verdicts: number;
  age?: number;
}

const ResultsScreen: React.FC<Props> = ({ navigation, route }) => {
  const { roomId } = route.params;
  const { currentRoom, currentSession, players, resetGame, resetForPlayAgain } = useGameStore();
  const { user } = useAuthStore();
  const [suspect, setSuspect] = useState<PlayerStats | null>(null);
  const [isGuilty, setIsGuilty] = useState(false);
  const [guiltyPercentage, setGuiltyPercentage] = useState(0);
  const [isHost, setIsHost] = useState(false);

  useEffect(() => {
    loadResults();
  }, [roomId]);

  // Navigate all players back to lobby when host clicks "Play Again"
  useEffect(() => {
    const roomStatus = currentRoom?.status || (currentRoom as any)?.status;
    if (roomStatus === 'lobby') {
      navigation.replace('Lobby');
    }
  }, [currentRoom?.status, (currentRoom as any)?.status]);

  const loadResults = async () => {
    try {
      let sessionId = currentSession?.id;
      let suspectId = currentSession?.suspectId || (currentSession as any)?.suspect_id;

      if (!sessionId) {
        const { data: session, error: sessionError } = await supabase
          .from('game_sessions')
          .select('*')
          .eq('game_room_id', roomId)
          .single();

        if (sessionError) throw sessionError;
        sessionId = session.id;
        suspectId = session.suspect_id;
      }

      const { data: allVotes, error: votesError } = await supabase
        .from('votes')
        .select('*')
        .eq('game_session_id', sessionId);

      if (votesError) throw votesError;

      // Find suspect player
      const suspectPlayer = players.find(p => p.user_id === suspectId);

      if (suspectPlayer) {
        // Count guilty vs not guilty verdicts for the suspect
        const verdictVotes = (allVotes || []).filter(v => v.vote_type === 'verdict');
        const uniqueVerdictMap = new Map<string, any>();
        verdictVotes.forEach((vote) => {
          if (!vote?.voter_id || vote?.round_number == null) return;
          const key = `${vote.voter_id}:${vote.round_number}`;
          if (!uniqueVerdictMap.has(key)) {
            uniqueVerdictMap.set(key, vote);
          }
        });
        const uniqueVerdictVotes = Array.from(uniqueVerdictMap.values());
        const guiltyVotes = uniqueVerdictVotes.filter(v => v.vote_value === 'guilty').length;
        const totalVerdicts = uniqueVerdictVotes.length;

        const percentage = totalVerdicts > 0 ? Math.round((guiltyVotes / totalVerdicts) * 100) : 0;

        setSuspect({
          user_id: suspectPlayer.user_id,
          name: suspectPlayer.user?.name || 'Unknown',
          photo_url: suspectPlayer.user?.front_photo_url || null,
          points: suspectPlayer.points || 0,
          guilty_verdicts: guiltyVotes,
          total_verdicts: totalVerdicts,
          age: suspectPlayer.user?.age,
        });

        setGuiltyPercentage(percentage);
        setIsGuilty(percentage >= 50);
      }

      // Check if current user is host
      const hostId = currentRoom?.hostId || (currentRoom as any)?.host_id;
      setIsHost(hostId === user?.id);
    } catch (error) {
      console.error('Error loading results:', error);
    }
  };

  const handlePlayAgain = async () => {
    if (!isHost) {
      Alert.alert('Only Host', 'Only the host can start a new game');
      return;
    }

    try {
      // Reset the game session but keep the room and players
      await resetForPlayAgain();

      // Navigate back to lobby - all users will be redirected via realtime updates
      navigation.replace('Lobby');
    } catch (error) {
      console.error('Error resetting game:', error);
      Alert.alert('Error', 'Failed to reset game. Please try again.');
    }
  };

  const handleBackToHome = () => {
    resetGame();
    navigation.replace('Home');
  };

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: '#1a1a2e' }]}>
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scrollContent}>
        {/* Header */}
        <View style={styles.header}>
          <Text style={styles.title}>THE VERDICT</Text>
        </View>

        {/* Suspect Card with Verdict */}
        {suspect && (
          <View style={styles.suspectCard}>
            <View style={[styles.suspectCardInner, { backgroundColor: isGuilty ? '#8B0000' : '#2E7D32' }]}>
              {/* Suspect Photo */}
              {suspect.photo_url ? (
                <Image source={{ uri: suspect.photo_url }} style={styles.suspectPhoto} />
              ) : (
                <View style={styles.suspectPhotoPlaceholder}>
                  <Text style={styles.suspectInitial}>
                    {suspect.name.charAt(0).toUpperCase()}
                  </Text>
                </View>
              )}

              {/* Suspect Name */}
              <Text style={styles.suspectName}>{suspect.name}</Text>

              {/* Verdict */}
              <View style={styles.verdictContainer}>
                <Text style={styles.verdictLabel}>IS</Text>
                <Text style={styles.verdictText}>
                  {isGuilty ? 'GUILTY!' : 'NOT GUILTY!'}
                </Text>
              </View>

              {/* Vote Breakdown */}
              <View style={styles.voteBreakdown}>
                <Text style={styles.voteText}>
                  {guiltyPercentage}% found guilty
                </Text>
                <Text style={styles.voteSubtext}>
                  ({suspect.guilty_verdicts} of {suspect.total_verdicts} votes)
                </Text>
              </View>
            </View>
          </View>
        )}

        {/* Drinking Mode Results - Only show if guilty */}
        {(currentRoom?.gameMode === 'drinking' || (currentRoom as any)?.game_mode === 'drinking') && suspect && isGuilty && (
          <View style={styles.drinkingCard}>
            <Text style={styles.drinkingTitle}>DRINKING PENALTY</Text>
            <Text style={styles.drinkingRule}>
              {suspect.name} must take {guiltyPercentage > 85 ? '2 shots' : '1 shot'}!
            </Text>
            <Text style={styles.drinkingDisclaimer}>Drink responsibly!</Text>
          </View>
        )}

        {/* Action Buttons */}
        <View style={styles.actions}>
          {isHost && (
            <TouchableOpacity
              style={[styles.playAgainButton, { backgroundColor: '#4CAF50' }]}
              onPress={handlePlayAgain}
            >
              <Text style={styles.buttonText}>PLAY AGAIN</Text>
            </TouchableOpacity>
          )}

          <TouchableOpacity style={styles.homeButton} onPress={handleBackToHome}>
            <Text style={styles.homeButtonText}>BACK TO HOME</Text>
          </TouchableOpacity>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  scrollContent: {
    flexGrow: 1,
    paddingBottom: 30,
  },
  header: {
    alignItems: 'center',
    paddingVertical: 30,
  },
  title: {
    fontSize: 36,
    fontWeight: 'bold',
    color: '#e94560',
    letterSpacing: 4,
  },
  suspectCard: {
    marginHorizontal: 20,
    marginBottom: 20,
    borderRadius: 20,
    overflow: 'hidden',
  },
  suspectCardInner: {
    padding: 30,
    alignItems: 'center',
  },
  suspectPhoto: {
    width: 150,
    height: 150,
    borderRadius: 75,
    borderWidth: 4,
    borderColor: 'rgba(255, 255, 255, 0.3)',
    marginBottom: 20,
  },
  suspectPhotoPlaceholder: {
    width: 150,
    height: 150,
    borderRadius: 75,
    backgroundColor: 'rgba(0, 0, 0, 0.3)',
    borderWidth: 4,
    borderColor: 'rgba(255, 255, 255, 0.3)',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 20,
  },
  suspectInitial: {
    fontSize: 60,
    fontWeight: 'bold',
    color: '#fff',
  },
  suspectName: {
    fontSize: 32,
    fontWeight: 'bold',
    color: '#fff',
    marginBottom: 20,
  },
  verdictContainer: {
    alignItems: 'center',
    marginBottom: 20,
  },
  verdictLabel: {
    fontSize: 16,
    color: 'rgba(255, 255, 255, 0.7)',
    letterSpacing: 2,
  },
  verdictText: {
    fontSize: 48,
    fontWeight: 'bold',
    color: '#fff',
    letterSpacing: 2,
  },
  voteBreakdown: {
    alignItems: 'center',
  },
  voteText: {
    fontSize: 18,
    color: 'rgba(255, 255, 255, 0.9)',
  },
  voteSubtext: {
    fontSize: 14,
    color: 'rgba(255, 255, 255, 0.6)',
    marginTop: 5,
  },
  drinkingCard: {
    marginHorizontal: 20,
    marginBottom: 20,
    backgroundColor: 'rgba(139, 0, 0, 0.3)',
    borderRadius: 15,
    padding: 20,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: 'rgba(220, 20, 60, 0.3)',
  },
  drinkingTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#DC143C',
    letterSpacing: 1,
    marginBottom: 10,
  },
  drinkingRule: {
    fontSize: 18,
    color: '#fff',
    marginBottom: 10,
  },
  drinkingDisclaimer: {
    fontSize: 12,
    color: '#999',
    fontStyle: 'italic',
  },
  actions: {
    paddingHorizontal: 20,
    marginTop: 'auto',
  },
  playAgainButton: {
    borderRadius: 25,
    paddingVertical: 18,
    alignItems: 'center',
    marginBottom: 15,
  },
  buttonText: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#fff',
    letterSpacing: 1,
  },
  homeButton: {
    paddingVertical: 18,
    alignItems: 'center',
    borderWidth: 2,
    borderColor: '#666',
    borderRadius: 25,
  },
  homeButtonText: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#999',
    letterSpacing: 1,
  },
});

export default ResultsScreen;
