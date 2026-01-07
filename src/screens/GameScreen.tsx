import React, { useEffect, useState, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  FlatList,
  Image,
  Alert,
  Animated,
  ActivityIndicator,
  ScrollView,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { RootStackParamList } from '../navigation/AppNavigator';
import { useGameStore } from '../store/gameStore';
import { useAuthStore } from '../store/authStore';
import { supabase } from '../services/supabase';
import LinearGradient from 'react-native-linear-gradient';

type Props = NativeStackScreenProps<RootStackParamList, 'Game'>;

const GameScreen: React.FC<Props> = ({ navigation, route }) => {
  const { roomId, phase: initialPhase } = route.params;
  const {
    currentRoom,
    currentSession,
    players,
    currentQuestion,
    timeRemaining,
    votes,
    submitVote,
    nextQuestion,
    startTrial,
    endGame,
    subscribeToGame,
    unsubscribeFromGame,
  } = useGameStore();
  const { user, profile } = useAuthStore();

  const [selectedPlayer, setSelectedPlayer] = useState<string | null>(null);
  const [verdict, setVerdict] = useState<'guilty' | 'not_guilty' | null>(null);
  const [showVerdictResult, setShowVerdictResult] = useState(false);
  const [verdictResult, setVerdictResult] = useState<'guilty' | 'not_guilty' | null>(null);
  const [phase, setPhase] = useState(initialPhase || 'voting');
  const [isLoading, setIsLoading] = useState(false);
  const [roundResults, setRoundResults] = useState<{ [key: string]: number }>({});

  const scaleAnim = useRef(new Animated.Value(0)).current;
  const fadeAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    // Subscribe to real-time updates
    subscribeToGame(roomId);

    return () => {
      unsubscribeFromGame();
    };
  }, [roomId]);

  useEffect(() => {
    // Update phase from game session
    if (currentSession?.current_phase) {
      setPhase(currentSession.current_phase);
    }
  }, [currentSession]);

  useEffect(() => {
    // Handle timer countdown
    const timer = setInterval(() => {
      if (timeRemaining && timeRemaining > 0) {
        // Timer is handled in the store
      } else if (timeRemaining === 0) {
        handleTimerExpired();
      }
    }, 1000);

    return () => clearInterval(timer);
  }, [timeRemaining]);

  const handleTimerExpired = async () => {
    if (phase === 'voting' && !selectedPlayer) {
      // Auto-submit a random vote if no selection made
      const availablePlayers = players.filter(p => p.user_id !== user?.id);
      if (availablePlayers.length > 0) {
        const randomPlayer = availablePlayers[Math.floor(Math.random() * availablePlayers.length)];
        await submitVote(randomPlayer.user_id, 'suspect');
      }
    } else if (phase === 'trial' && !verdict) {
      // Auto-submit "not guilty" if no verdict selected
      await submitVote(null, 'verdict', 'not_guilty');
    }
  };

  const handleVoteSubmit = async () => {
    if (phase === 'voting' && selectedPlayer) {
      setIsLoading(true);
      try {
        await submitVote(selectedPlayer, 'suspect');
        setSelectedPlayer(null);
      } catch (error) {
        Alert.alert('Error', 'Failed to submit vote');
      } finally {
        setIsLoading(false);
      }
    }
  };

  const handleVerdictSubmit = async () => {
    if (phase === 'trial' && verdict) {
      setIsLoading(true);
      try {
        await submitVote(null, 'verdict', verdict);
        setVerdict(null);
      } catch (error) {
        Alert.alert('Error', 'Failed to submit verdict');
      } finally {
        setIsLoading(false);
      }
    }
  };

  const renderVotingPhase = () => {
    const isHost = currentRoom?.host_id === user?.id;
    const hasVoted = votes.some(v => v.voter_id === user?.id && v.round_number === currentSession?.current_round);

    return (
      <View style={styles.container}>
        <LinearGradient
          colors={['#1a1a2e', '#16213e']}
          style={StyleSheet.absoluteFillObject}
        />

        {/* Header */}
        <View style={styles.header}>
          <Text style={styles.phaseLabel}>VOTING ROUND</Text>
          <Text style={styles.roundText}>Round {currentSession?.current_round || 1}</Text>
        </View>

        {/* Timer */}
        <View style={styles.timerContainer}>
          <Text style={styles.timerText}>{timeRemaining || 30}s</Text>
          <View style={styles.timerBar}>
            <View
              style={[
                styles.timerFill,
                { width: `${((timeRemaining || 30) / 30) * 100}%` },
              ]}
            />
          </View>
        </View>

        {/* Question */}
        <View style={styles.questionContainer}>
          <Text style={styles.questionText}>{currentQuestion?.question_text}</Text>
        </View>

        {/* Players Grid */}
        {!hasVoted ? (
          <>
            <ScrollView style={styles.playersContainer}>
              <View style={styles.playersGrid}>
                {players
                  .filter(p => p.user_id !== user?.id)
                  .map((player) => (
                    <TouchableOpacity
                      key={player.id}
                      style={[
                        styles.playerCard,
                        selectedPlayer === player.user_id && styles.playerCardSelected,
                      ]}
                      onPress={() => setSelectedPlayer(player.user_id)}
                      disabled={hasVoted || isLoading}
                    >
                      {player.user?.front_photo_url ? (
                        <Image
                          source={{ uri: player.user?.front_photo_url }}
                          style={styles.playerPhoto}
                        />
                      ) : (
                        <View style={styles.playerPhotoPlaceholder}>
                          <Text style={styles.playerInitial}>
                            {player.user?.name?.charAt(0).toUpperCase()}
                          </Text>
                        </View>
                      )}
                      <Text style={styles.playerName}>{player.user?.name}</Text>
                    </TouchableOpacity>
                  ))}
              </View>
            </ScrollView>

            {/* Submit Button */}
            <TouchableOpacity
              style={[
                styles.submitButton,
                (!selectedPlayer || isLoading) && styles.submitButtonDisabled,
              ]}
              onPress={handleVoteSubmit}
              disabled={!selectedPlayer || isLoading}
            >
              <LinearGradient
                colors={selectedPlayer ? ['#e94560', '#c23652'] : ['#666', '#555']}
                style={styles.submitButtonGradient}
              >
                <Text style={styles.submitButtonText}>
                  {isLoading ? 'Submitting...' : 'SUBMIT VOTE'}
                </Text>
              </LinearGradient>
            </TouchableOpacity>
          </>
        ) : (
          <View style={styles.waitingContainer}>
            <ActivityIndicator size="large" color="#e94560" />
            <Text style={styles.waitingText}>Waiting for other players...</Text>
            <Text style={styles.waitingSubtext}>
              {votes.filter(v => v.round_number === currentSession?.current_round).length} / {players.length} voted
            </Text>
          </View>
        )}
      </View>
    );
  };

  const renderTrialPhase = () => {
    const suspect = players.find(p => p.user_id === currentSession?.suspect_id);
    const hasVoted = votes.some(
      v => v.voter_id === user?.id &&
      v.round_number === currentSession?.current_round &&
      v.vote_type === 'verdict'
    );

    return (
      <View style={styles.container}>
        <LinearGradient
          colors={['#2a0845', '#1a0530']}
          style={StyleSheet.absoluteFillObject}
        />

        {/* Header */}
        <View style={styles.header}>
          <Text style={styles.phaseLabel}>HOT SEAT TRIAL</Text>
          <Text style={styles.roundText}>Question {currentSession?.current_round || 1}</Text>
        </View>

        {/* Timer */}
        <View style={styles.timerContainer}>
          <Text style={styles.timerText}>{timeRemaining || 20}s</Text>
          <View style={styles.timerBar}>
            <View
              style={[
                styles.timerFill,
                { width: `${((timeRemaining || 20) / 20) * 100}%` },
              ]}
            />
          </View>
        </View>

        {/* Suspect Display */}
        <View style={styles.suspectContainer}>
          <Text style={styles.suspectLabel}>ON TRIAL</Text>
          {suspect?.user?.front_photo_url ? (
            <Image
              source={{ uri: suspect.user.front_photo_url }}
              style={styles.suspectPhoto}
            />
          ) : (
            <View style={styles.suspectPhotoPlaceholder}>
              <Text style={styles.suspectInitial}>
                {suspect?.user?.name?.charAt(0).toUpperCase()}
              </Text>
            </View>
          )}
          <Text style={styles.suspectName}>{suspect?.user?.name}</Text>
        </View>

        {/* Question */}
        <View style={styles.questionContainer}>
          <Text style={styles.trialQuestionText}>{currentQuestion?.question_text}</Text>
        </View>

        {/* Verdict Buttons */}
        {suspect?.user_id !== user?.id && !hasVoted ? (
          <View style={styles.verdictContainer}>
            <TouchableOpacity
              style={[
                styles.verdictButton,
                verdict === 'guilty' && styles.guiltyButtonSelected,
              ]}
              onPress={() => setVerdict('guilty')}
              disabled={hasVoted || isLoading}
            >
              <Text style={[styles.verdictButtonText, verdict === 'guilty' && styles.verdictButtonTextSelected]}>
                GUILTY
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[
                styles.verdictButton,
                styles.notGuiltyButton,
                verdict === 'not_guilty' && styles.notGuiltyButtonSelected,
              ]}
              onPress={() => setVerdict('not_guilty')}
              disabled={hasVoted || isLoading}
            >
              <Text style={[styles.verdictButtonText, verdict === 'not_guilty' && styles.verdictButtonTextSelected]}>
                NOT GUILTY
              </Text>
            </TouchableOpacity>

            {/* Submit Verdict */}
            <TouchableOpacity
              style={[
                styles.submitButton,
                (!verdict || isLoading) && styles.submitButtonDisabled,
              ]}
              onPress={handleVerdictSubmit}
              disabled={!verdict || isLoading}
            >
              <LinearGradient
                colors={verdict ? ['#e94560', '#c23652'] : ['#666', '#555']}
                style={styles.submitButtonGradient}
              >
                <Text style={styles.submitButtonText}>
                  {isLoading ? 'Submitting...' : 'SUBMIT VERDICT'}
                </Text>
              </LinearGradient>
            </TouchableOpacity>
          </View>
        ) : suspect?.user_id === user?.id ? (
          <View style={styles.onTrialMessage}>
            <Text style={styles.onTrialText}>You are on trial!</Text>
            <Text style={styles.onTrialSubtext}>Wait for the verdict...</Text>
          </View>
        ) : (
          <View style={styles.waitingContainer}>
            <ActivityIndicator size="large" color="#e94560" />
            <Text style={styles.waitingText}>Waiting for verdicts...</Text>
          </View>
        )}

        {/* Show Verdict Result */}
        {showVerdictResult && (
          <Animated.View
            style={[
              styles.verdictResultOverlay,
              {
                opacity: fadeAnim,
                transform: [{ scale: scaleAnim }],
              },
            ]}
          >
            <Text style={styles.verdictResultText}>
              {verdictResult === 'guilty' ? 'GUILTY!' : 'NOT GUILTY'}
            </Text>
          </Animated.View>
        )}
      </View>
    );
  };

  return (
    <SafeAreaView style={styles.container}>
      {phase === 'voting' ? renderVotingPhase() : renderTrialPhase()}
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  header: {
    paddingHorizontal: 20,
    paddingTop: 20,
    paddingBottom: 10,
    alignItems: 'center',
  },
  phaseLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: '#999',
    letterSpacing: 2,
  },
  roundText: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#fff',
    marginTop: 5,
  },
  timerContainer: {
    paddingHorizontal: 20,
    paddingVertical: 10,
  },
  timerText: {
    fontSize: 32,
    fontWeight: 'bold',
    color: '#e94560',
    textAlign: 'center',
    marginBottom: 10,
  },
  timerBar: {
    height: 4,
    backgroundColor: '#333',
    borderRadius: 2,
    overflow: 'hidden',
  },
  timerFill: {
    height: '100%',
    backgroundColor: '#e94560',
  },
  questionContainer: {
    paddingHorizontal: 20,
    paddingVertical: 20,
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
    marginHorizontal: 20,
    borderRadius: 15,
    marginBottom: 20,
  },
  questionText: {
    fontSize: 20,
    fontWeight: '600',
    color: '#fff',
    textAlign: 'center',
    lineHeight: 28,
  },
  trialQuestionText: {
    fontSize: 22,
    fontWeight: 'bold',
    color: '#fff',
    textAlign: 'center',
    lineHeight: 30,
  },
  playersContainer: {
    flex: 1,
    paddingHorizontal: 20,
  },
  playersGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
  },
  playerCard: {
    width: '48%',
    alignItems: 'center',
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
    borderRadius: 15,
    padding: 15,
    marginBottom: 15,
    borderWidth: 2,
    borderColor: 'transparent',
  },
  playerCardSelected: {
    borderColor: '#e94560',
    backgroundColor: 'rgba(233, 69, 96, 0.1)',
  },
  playerPhoto: {
    width: 80,
    height: 80,
    borderRadius: 40,
    marginBottom: 10,
  },
  playerPhotoPlaceholder: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: '#333',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 10,
  },
  playerInitial: {
    fontSize: 32,
    fontWeight: 'bold',
    color: '#fff',
  },
  playerName: {
    fontSize: 16,
    fontWeight: '600',
    color: '#fff',
    textAlign: 'center',
  },
  submitButton: {
    marginHorizontal: 20,
    marginBottom: 20,
    borderRadius: 25,
    overflow: 'hidden',
  },
  submitButtonDisabled: {
    opacity: 0.5,
  },
  submitButtonGradient: {
    paddingVertical: 18,
    alignItems: 'center',
  },
  submitButtonText: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#fff',
    letterSpacing: 1,
  },
  waitingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  waitingText: {
    fontSize: 18,
    color: '#fff',
    marginTop: 20,
  },
  waitingSubtext: {
    fontSize: 14,
    color: '#999',
    marginTop: 5,
  },
  suspectContainer: {
    alignItems: 'center',
    paddingVertical: 20,
  },
  suspectLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: '#e94560',
    letterSpacing: 2,
    marginBottom: 15,
  },
  suspectPhoto: {
    width: 120,
    height: 120,
    borderRadius: 60,
    borderWidth: 4,
    borderColor: '#e94560',
    marginBottom: 15,
  },
  suspectPhotoPlaceholder: {
    width: 120,
    height: 120,
    borderRadius: 60,
    backgroundColor: '#333',
    borderWidth: 4,
    borderColor: '#e94560',
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
    fontSize: 24,
    fontWeight: 'bold',
    color: '#fff',
  },
  verdictContainer: {
    paddingHorizontal: 20,
  },
  verdictButton: {
    backgroundColor: '#e94560',
    paddingVertical: 20,
    borderRadius: 15,
    marginBottom: 15,
    alignItems: 'center',
    borderWidth: 2,
    borderColor: '#e94560',
  },
  notGuiltyButton: {
    backgroundColor: 'transparent',
    borderColor: '#4CAF50',
  },
  guiltyButtonSelected: {
    backgroundColor: '#e94560',
  },
  notGuiltyButtonSelected: {
    backgroundColor: '#4CAF50',
    borderColor: '#4CAF50',
  },
  verdictButtonText: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#fff',
    letterSpacing: 1,
  },
  verdictButtonTextSelected: {
    color: '#fff',
  },
  onTrialMessage: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  onTrialText: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#e94560',
  },
  onTrialSubtext: {
    fontSize: 16,
    color: '#999',
    marginTop: 10,
  },
  verdictResultOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(0, 0, 0, 0.9)',
  },
  verdictResultText: {
    fontSize: 48,
    fontWeight: 'bold',
    color: '#e94560',
    letterSpacing: 4,
  },
});

export default GameScreen;