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
import LinearGradient from 'react-native-linear-gradient';
import { supabase } from '../services/supabase';

type Props = NativeStackScreenProps<RootStackParamList, 'Results'>;

interface PlayerStats {
  user_id: string;
  name: string;
  photo_url: string | null;
  points: number;
  guilty_verdicts: number;
  age?: number;
}

const ResultsScreen: React.FC<Props> = ({ navigation, route }) => {
  const { roomId } = route.params;
  const { currentRoom, players, resetGame } = useGameStore();
  const { user } = useAuthStore();
  const [playerStats, setPlayerStats] = useState<PlayerStats[]>([]);
  const [isHost, setIsHost] = useState(false);
  const [mostGuilty, setMostGuilty] = useState<PlayerStats | null>(null);
  const [suspect, setSuspect] = useState<PlayerStats | null>(null);

  useEffect(() => {
    loadResults();
  }, [roomId]);

  const loadResults = async () => {
    try {
      // Get player stats from the game
      const stats = players.map(player => ({
        user_id: player.user_id,
        name: player.user?.name || 'Unknown',
        photo_url: player.user?.front_photo_url || null,
        points: player.points,
        guilty_verdicts: player.guilty_verdicts,
        age: player.user?.age,
      }));

      // Sort by points for main leaderboard
      stats.sort((a, b) => b.points - a.points);
      setPlayerStats(stats);

      // Find the suspect (person with most points from voting rounds)
      const suspectPlayer = stats.reduce((prev, current) =>
        prev.points > current.points ? prev : current
      );
      setSuspect(suspectPlayer);

      // Find most guilty (person with most guilty verdicts)
      const mostGuiltyPlayer = stats.reduce((prev, current) =>
        prev.guilty_verdicts > current.guilty_verdicts ? prev : current
      );
      setMostGuilty(mostGuiltyPlayer);

      // Check if current user is host
      setIsHost(currentRoom?.host_id === user?.id);
    } catch (error) {
      console.error('Error loading results:', error);
    }
  };

  const handlePlayAgain = async () => {
    if (!isHost) {
      Alert.alert('Only the host can start a new game');
      return;
    }

    try {
      // Reset the game and go back to lobby
      await resetGame();
      navigation.navigate('Lobby', { roomId });
    } catch (error) {
      Alert.alert('Error', 'Failed to start new game');
    }
  };

  const handleBackToHome = () => {
    resetGame();
    navigation.navigate('Home');
  };

  const renderAge = (age?: number) => {
    if (!age) return null;
    const reversedAge = parseInt(age.toString().split('').reverse().join(''));
    return `Facing ${reversedAge} years`;
  };

  return (
    <SafeAreaView style={styles.container}>
      <LinearGradient
        colors={['#1a1a2e', '#0f0f1e']}
        style={StyleSheet.absoluteFillObject}
      />

      <ScrollView showsVerticalScrollIndicator={false}>
        {/* Header */}
        <View style={styles.header}>
          <Text style={styles.title}>THE VERDICT</Text>
          <Text style={styles.subtitle}>Case Closed</Text>
        </View>

        {/* Main Suspect Card */}
        {suspect && (
          <View style={styles.suspectCard}>
            <LinearGradient
              colors={['#e94560', '#c23652']}
              style={styles.suspectCardGradient}
            >
              <Text style={styles.suspectCardTitle}>THE SUSPECT</Text>
              {suspect.photo_url ? (
                <Image source={{ uri: suspect.photo_url }} style={styles.suspectPhoto} />
              ) : (
                <View style={styles.suspectPhotoPlaceholder}>
                  <Text style={styles.suspectInitial}>
                    {suspect.name.charAt(0).toUpperCase()}
                  </Text>
                </View>
              )}
              <Text style={styles.suspectName}>{suspect.name}</Text>
              <Text style={styles.suspectAge}>{renderAge(suspect.age)}</Text>
              <View style={styles.suspectStats}>
                <View style={styles.statItem}>
                  <Text style={styles.statValue}>{suspect.points}</Text>
                  <Text style={styles.statLabel}>VOTES</Text>
                </View>
                <View style={styles.statDivider} />
                <View style={styles.statItem}>
                  <Text style={styles.statValue}>{suspect.guilty_verdicts}</Text>
                  <Text style={styles.statLabel}>GUILTY</Text>
                </View>
              </View>
            </LinearGradient>
          </View>
        )}

        {/* Most Guilty Badge */}
        {mostGuilty && mostGuilty.guilty_verdicts > 0 && (
          <View style={styles.badgeContainer}>
            <LinearGradient
              colors={['#8B0000', '#DC143C']}
              style={styles.badge}
            >
              <Text style={styles.badgeTitle}>MOST GUILTY</Text>
              <Text style={styles.badgeName}>{mostGuilty.name}</Text>
              <Text style={styles.badgeValue}>{mostGuilty.guilty_verdicts} verdicts</Text>
            </LinearGradient>
          </View>
        )}

        {/* Drinking Mode Results */}
        {currentRoom?.game_mode === 'drinking' && (
          <View style={styles.drinkingCard}>
            <Text style={styles.drinkingTitle}>DRINKING PENALTIES</Text>
            <View style={styles.drinkingRules}>
              <Text style={styles.drinkingRule}>
                {suspect?.name}: 1 shot (chosen as suspect)
              </Text>
              {mostGuilty && mostGuilty.guilty_verdicts >= 5 && (
                <Text style={styles.drinkingRule}>
                  {mostGuilty.name}: 2 shots (found guilty)
                </Text>
              )}
            </View>
            <Text style={styles.drinkingDisclaimer}>Drink responsibly!</Text>
          </View>
        )}

        {/* Full Leaderboard */}
        <View style={styles.leaderboard}>
          <Text style={styles.leaderboardTitle}>FINAL STANDINGS</Text>
          {playerStats.map((player, index) => (
            <View key={player.user_id} style={styles.leaderboardItem}>
              <Text style={styles.leaderboardRank}>#{index + 1}</Text>
              {player.photo_url ? (
                <Image source={{ uri: player.photo_url }} style={styles.leaderboardPhoto} />
              ) : (
                <View style={styles.leaderboardPhotoPlaceholder}>
                  <Text style={styles.leaderboardInitial}>
                    {player.name.charAt(0).toUpperCase()}
                  </Text>
                </View>
              )}
              <View style={styles.leaderboardInfo}>
                <Text style={styles.leaderboardName}>{player.name}</Text>
                <Text style={styles.leaderboardStats}>
                  {player.points} votes • {player.guilty_verdicts} guilty
                </Text>
              </View>
            </View>
          ))}
        </View>

        {/* Action Buttons */}
        <View style={styles.actions}>
          {isHost && (
            <TouchableOpacity style={styles.playAgainButton} onPress={handlePlayAgain}>
              <LinearGradient
                colors={['#4CAF50', '#45a049']}
                style={styles.buttonGradient}
              >
                <Text style={styles.buttonText}>PLAY AGAIN</Text>
              </LinearGradient>
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
  subtitle: {
    fontSize: 16,
    color: '#999',
    marginTop: 5,
    letterSpacing: 2,
  },
  suspectCard: {
    marginHorizontal: 20,
    marginBottom: 20,
    borderRadius: 20,
    overflow: 'hidden',
  },
  suspectCardGradient: {
    padding: 30,
    alignItems: 'center',
  },
  suspectCardTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: 'rgba(255, 255, 255, 0.8)',
    letterSpacing: 2,
    marginBottom: 20,
  },
  suspectPhoto: {
    width: 120,
    height: 120,
    borderRadius: 60,
    borderWidth: 4,
    borderColor: 'rgba(255, 255, 255, 0.3)',
    marginBottom: 15,
  },
  suspectPhotoPlaceholder: {
    width: 120,
    height: 120,
    borderRadius: 60,
    backgroundColor: 'rgba(0, 0, 0, 0.3)',
    borderWidth: 4,
    borderColor: 'rgba(255, 255, 255, 0.3)',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 15,
  },
  suspectInitial: {
    fontSize: 48,
    fontWeight: 'bold',
    color: '#fff',
  },
  suspectName: {
    fontSize: 28,
    fontWeight: 'bold',
    color: '#fff',
    marginBottom: 5,
  },
  suspectAge: {
    fontSize: 16,
    color: 'rgba(255, 255, 255, 0.8)',
    marginBottom: 20,
  },
  suspectStats: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  statItem: {
    alignItems: 'center',
    paddingHorizontal: 30,
  },
  statValue: {
    fontSize: 32,
    fontWeight: 'bold',
    color: '#fff',
  },
  statLabel: {
    fontSize: 12,
    color: 'rgba(255, 255, 255, 0.6)',
    letterSpacing: 1,
    marginTop: 5,
  },
  statDivider: {
    width: 1,
    height: 40,
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
  },
  badgeContainer: {
    marginHorizontal: 20,
    marginBottom: 20,
    borderRadius: 15,
    overflow: 'hidden',
  },
  badge: {
    padding: 20,
    alignItems: 'center',
  },
  badgeTitle: {
    fontSize: 12,
    fontWeight: '600',
    color: 'rgba(255, 255, 255, 0.8)',
    letterSpacing: 2,
    marginBottom: 10,
  },
  badgeName: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#fff',
    marginBottom: 5,
  },
  badgeValue: {
    fontSize: 14,
    color: 'rgba(255, 255, 255, 0.8)',
  },
  drinkingCard: {
    marginHorizontal: 20,
    marginBottom: 20,
    backgroundColor: 'rgba(139, 0, 0, 0.2)',
    borderRadius: 15,
    padding: 20,
    borderWidth: 1,
    borderColor: 'rgba(220, 20, 60, 0.3)',
  },
  drinkingTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#DC143C',
    letterSpacing: 1,
    marginBottom: 15,
  },
  drinkingRules: {
    marginBottom: 15,
  },
  drinkingRule: {
    fontSize: 14,
    color: '#fff',
    marginBottom: 8,
  },
  drinkingDisclaimer: {
    fontSize: 12,
    color: '#999',
    fontStyle: 'italic',
  },
  leaderboard: {
    marginHorizontal: 20,
    marginBottom: 30,
  },
  leaderboardTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#fff',
    letterSpacing: 2,
    marginBottom: 20,
  },
  leaderboardItem: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
    borderRadius: 12,
    padding: 15,
    marginBottom: 10,
  },
  leaderboardRank: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#e94560',
    marginRight: 15,
    width: 30,
  },
  leaderboardPhoto: {
    width: 50,
    height: 50,
    borderRadius: 25,
    marginRight: 15,
  },
  leaderboardPhotoPlaceholder: {
    width: 50,
    height: 50,
    borderRadius: 25,
    backgroundColor: '#333',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 15,
  },
  leaderboardInitial: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#fff',
  },
  leaderboardInfo: {
    flex: 1,
  },
  leaderboardName: {
    fontSize: 16,
    fontWeight: '600',
    color: '#fff',
    marginBottom: 3,
  },
  leaderboardStats: {
    fontSize: 12,
    color: '#999',
  },
  actions: {
    paddingHorizontal: 20,
    paddingBottom: 30,
  },
  playAgainButton: {
    borderRadius: 25,
    overflow: 'hidden',
    marginBottom: 15,
  },
  buttonGradient: {
    paddingVertical: 18,
    alignItems: 'center',
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