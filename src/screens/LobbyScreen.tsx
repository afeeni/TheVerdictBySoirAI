import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  SafeAreaView,
  ScrollView,
  Alert,
  ActivityIndicator,
  Image,
  Share,
} from 'react-native';
import { useAuthStore } from '../store/authStore';
import { useGameStore } from '../store/gameStore';
import { useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { RootStackParamList } from '../navigation/AppNavigator';
import { Player } from '../types';

type LobbyNavigationProp = NativeStackNavigationProp<
  RootStackParamList,
  'Lobby'
>;

const LobbyScreen = () => {
  const navigation = useNavigation<LobbyNavigationProp>();
  const { user } = useAuthStore();
  const {
    currentRoom,
    players,
    startGame,
    leaveRoom,
    subscribeToRoom,
    unsubscribeFromRoom,
  } = useGameStore();
  const [isLoading, setIsLoading] = useState(false);
  const [showLineup, setShowLineup] = useState(false);

  useEffect(() => {
    if (currentRoom) {
      // Room updates are already subscribed from join/create
      loadPlayers();
    }

    return () => {
      // Cleanup handled by navigation
    };
  }, []);

  useEffect(() => {
    // Check if game has started
    if (currentRoom?.status === 'voting') {
      navigation.replace('Game');
    }
  }, [currentRoom?.status]);

  const loadPlayers = async () => {
    // Players are loaded via subscription in gameStore
  };

  const handleStartGame = async () => {
    if (!currentRoom || !user) return;

    if (players.length < 4) {
      Alert.alert('Not Enough Players', 'You need at least 4 players to start the game');
      return;
    }

    if (players.length > 10) {
      Alert.alert('Too Many Players', 'Maximum 10 players allowed');
      return;
    }

    // Show lineup first
    setShowLineup(true);

    // Start game after showing lineup
    setTimeout(async () => {
      setIsLoading(true);
      try {
        await startGame();
        navigation.replace('Game');
      } catch (error: any) {
        Alert.alert('Error', error.message);
        setShowLineup(false);
      } finally {
        setIsLoading(false);
      }
    }, 5000); // Show lineup for 5 seconds
  };

  const handleLeaveGame = () => {
    Alert.alert(
      'Leave Game',
      'Are you sure you want to leave this game?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Leave',
          style: 'destructive',
          onPress: async () => {
            await leaveRoom();
            navigation.navigate('Home');
          },
        },
      ]
    );
  };

  const handleShareCode = async () => {
    if (!currentRoom) return;

    try {
      await Share.share({
        message: `Join my Verdict game! Room code: ${currentRoom.joinCode}`,
      });
    } catch (error) {
      console.error('Error sharing:', error);
    }
  };

  const isHost = user?.id === currentRoom?.hostId;

  if (showLineup) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.lineupContainer}>
          <Text style={styles.lineupTitle}>MEET THE LINEUP</Text>
          <ScrollView contentContainerStyle={styles.lineupGrid}>
            {players.map((player) => (
              <View key={player.id} style={styles.lineupItem}>
                {player.user?.frontPhotoUrl ? (
                  <Image
                    source={{ uri: player.user.frontPhotoUrl }}
                    style={styles.mugshot}
                  />
                ) : (
                  <View style={styles.mugshotPlaceholder}>
                    <Text style={styles.mugshotInitial}>
                      {player.user?.name?.charAt(0).toUpperCase()}
                    </Text>
                  </View>
                )}
                <Text style={styles.playerName}>{player.user?.name}</Text>
                {player.user?.age && (
                  <Text style={styles.playerAge}>
                    Facing {100 - player.user.age} years
                  </Text>
                )}
                {player.user?.knownFor && (
                  <Text style={styles.playerFact}>
                    Known for: {player.user.knownFor}
                  </Text>
                )}
              </View>
            ))}
          </ScrollView>
          <Text style={styles.lineupCountdown}>Starting game...</Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView contentContainerStyle={styles.scrollContent}>
        <View style={styles.header}>
          <Text style={styles.title}>Game Lobby</Text>
          <View style={styles.codeContainer}>
            <Text style={styles.codeLabel}>Room Code:</Text>
            <Text style={styles.codeValue}>{currentRoom?.joinCode}</Text>
            <TouchableOpacity style={styles.shareButton} onPress={handleShareCode}>
              <Text style={styles.shareButtonText}>Share</Text>
            </TouchableOpacity>
          </View>
        </View>

        <View style={styles.playersSection}>
          <Text style={styles.sectionTitle}>
            Players ({players.length}/10)
          </Text>
          <View style={styles.playersList}>
            {players.map((player) => (
              <View key={player.id} style={styles.playerItem}>
                <View style={styles.playerInfo}>
                  <Text style={styles.playerName}>
                    {player.user?.name}
                    {player.userId === currentRoom?.hostId && ' 👑'}
                  </Text>
                </View>
                {player.userId === user?.id && (
                  <Text style={styles.youLabel}>You</Text>
                )}
              </View>
            ))}
          </View>

          {players.length < 4 && (
            <Text style={styles.warningText}>
              Need at least {4 - players.length} more player(s) to start
            </Text>
          )}
        </View>

        <View style={styles.gameInfo}>
          <Text style={styles.infoTitle}>Game Settings</Text>
          <View style={styles.infoRow}>
            <Text style={styles.infoLabel}>Mode:</Text>
            <Text style={styles.infoValue}>
              {currentRoom?.gameMode === 'drinking' ? 'Drinking 🍺' : 'Standard'}
            </Text>
          </View>
          <View style={styles.infoRow}>
            <Text style={styles.infoLabel}>Length:</Text>
            <Text style={styles.infoValue}>
              {currentRoom?.gameLength?.charAt(0).toUpperCase()}
              {currentRoom?.gameLength?.slice(1)}
            </Text>
          </View>
        </View>

        <View style={styles.actions}>
          {isHost ? (
            <TouchableOpacity
              style={[
                styles.startButton,
                (isLoading || players.length < 4) && styles.buttonDisabled,
              ]}
              onPress={handleStartGame}
              disabled={isLoading || players.length < 4}
            >
              {isLoading ? (
                <ActivityIndicator color="#FFFFFF" />
              ) : (
                <Text style={styles.startButtonText}>Start Game</Text>
              )}
            </TouchableOpacity>
          ) : (
            <View style={styles.waitingContainer}>
              <ActivityIndicator size="large" color="#FF6B6B" />
              <Text style={styles.waitingText}>Waiting for host to start...</Text>
            </View>
          )}

          <TouchableOpacity style={styles.leaveButton} onPress={handleLeaveGame}>
            <Text style={styles.leaveButtonText}>Leave Game</Text>
          </TouchableOpacity>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#1A1A1A',
  },
  scrollContent: {
    paddingHorizontal: 24,
    paddingVertical: 32,
  },
  header: {
    marginBottom: 32,
  },
  title: {
    fontSize: 32,
    fontWeight: '800',
    color: '#FFFFFF',
    marginBottom: 16,
  },
  codeContainer: {
    backgroundColor: '#2A2A2A',
    borderRadius: 12,
    padding: 16,
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 2,
    borderColor: '#FF6B6B',
  },
  codeLabel: {
    fontSize: 14,
    color: '#999',
  },
  codeValue: {
    fontSize: 24,
    fontWeight: '700',
    color: '#FF6B6B',
    marginLeft: 12,
    letterSpacing: 2,
    flex: 1,
  },
  shareButton: {
    backgroundColor: '#FF6B6B',
    borderRadius: 8,
    paddingHorizontal: 16,
    paddingVertical: 8,
  },
  shareButtonText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#FFFFFF',
  },
  playersSection: {
    marginBottom: 32,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#FFFFFF',
    marginBottom: 16,
  },
  playersList: {
    backgroundColor: '#2A2A2A',
    borderRadius: 12,
    padding: 12,
    borderWidth: 1,
    borderColor: '#333',
  },
  playerItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 12,
    paddingHorizontal: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#333',
  },
  playerInfo: {
    flex: 1,
  },
  playerName: {
    fontSize: 16,
    fontWeight: '600',
    color: '#FFFFFF',
  },
  youLabel: {
    fontSize: 12,
    color: '#FF6B6B',
    fontWeight: '600',
  },
  warningText: {
    fontSize: 14,
    color: '#FFB84D',
    marginTop: 12,
    fontStyle: 'italic',
    textAlign: 'center',
  },
  gameInfo: {
    backgroundColor: '#2A2A2A',
    borderRadius: 12,
    padding: 16,
    marginBottom: 32,
    borderWidth: 1,
    borderColor: '#333',
  },
  infoTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#FFFFFF',
    marginBottom: 12,
  },
  infoRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  infoLabel: {
    fontSize: 14,
    color: '#999',
  },
  infoValue: {
    fontSize: 14,
    fontWeight: '600',
    color: '#FFFFFF',
  },
  actions: {
    gap: 16,
  },
  startButton: {
    backgroundColor: '#FF6B6B',
    borderRadius: 12,
    paddingVertical: 16,
    alignItems: 'center',
    marginBottom: 16,
  },
  buttonDisabled: {
    opacity: 0.6,
  },
  startButtonText: {
    fontSize: 18,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  waitingContainer: {
    alignItems: 'center',
    marginBottom: 24,
  },
  waitingText: {
    fontSize: 16,
    color: '#999',
    marginTop: 12,
  },
  leaveButton: {
    borderWidth: 1,
    borderColor: '#999',
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: 'center',
  },
  leaveButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#999',
  },
  lineupContainer: {
    flex: 1,
    backgroundColor: '#1A1A1A',
    padding: 24,
    justifyContent: 'center',
  },
  lineupTitle: {
    fontSize: 32,
    fontWeight: '900',
    color: '#FF6B6B',
    textAlign: 'center',
    marginBottom: 32,
    letterSpacing: 2,
  },
  lineupGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'center',
  },
  lineupItem: {
    width: '45%',
    margin: '2.5%',
    alignItems: 'center',
  },
  mugshot: {
    width: 100,
    height: 133,
    borderRadius: 8,
    marginBottom: 8,
  },
  mugshotPlaceholder: {
    width: 100,
    height: 133,
    borderRadius: 8,
    backgroundColor: '#2A2A2A',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 8,
  },
  mugshotInitial: {
    fontSize: 36,
    fontWeight: '700',
    color: '#FF6B6B',
  },
  playerAge: {
    fontSize: 11,
    color: '#999',
    marginTop: 2,
  },
  playerFact: {
    fontSize: 10,
    color: '#666',
    marginTop: 4,
    textAlign: 'center',
  },
  lineupCountdown: {
    fontSize: 18,
    color: '#FFFFFF',
    textAlign: 'center',
    marginTop: 32,
    fontStyle: 'italic',
  },
});

export default LobbyScreen;