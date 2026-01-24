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
  AppState,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { RootStackParamList } from '../navigation/AppNavigator';
import { useGameStore } from '../store/gameStore';
import { useAuthStore } from '../store/authStore';
import { supabase } from '../services/supabase';
import LinearGradient from 'react-native-linear-gradient';
import { useGameRealtime } from '../hooks/useGameRealtime';

type Props = NativeStackScreenProps<RootStackParamList, 'Game'>;

const GameScreen: React.FC<Props> = ({ navigation, route }) => {
  const { roomId, phase: initialPhase } = route.params || {};
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
    updateTimer,
    clearVotes,
    setVotes,
    setCurrentSession,
    setCurrentQuestion,
    setPlayers,
  } = useGameStore();
  const { user, profile } = useAuthStore();
  const { subscribeToGame, unsubscribeFromGame } = useGameRealtime(roomId || null);

  const [selectedPlayer, setSelectedPlayer] = useState<string | null>(null);
  const [verdict, setVerdict] = useState<'guilty' | 'not_guilty' | null>(null);
  const [showVerdictResult, setShowVerdictResult] = useState(false);
  const [verdictResult, setVerdictResult] = useState<'guilty' | 'not_guilty' | null>(null);
  const [phase, setPhase] = useState(initialPhase || 'voting');
  const [isLoading, setIsLoading] = useState(false);
  const [roundResults, setRoundResults] = useState<{ [key: string]: number }>({});
  const [hasSubmittedVote, setHasSubmittedVote] = useState(false);
  const [currentRoundRef, setCurrentRoundRef] = useState(1);

  const scaleAnim = useRef(new Animated.Value(0)).current;
  const fadeAnim = useRef(new Animated.Value(0)).current;

  const mergeVotesById = (existing: any[], incoming: any[]) => {
    const map = new Map<string, any>();
    existing.forEach((vote) => {
      if (vote?.id) {
        map.set(vote.id, vote);
      }
    });
    incoming.forEach((vote) => {
      if (vote?.id) {
        map.set(vote.id, vote);
      }
    });
    return Array.from(map.values());
  };

  const countUniqueVoters = (roundVotes: any[]) => {
    const unique = new Set(roundVotes.map((vote) => vote?.voter_id).filter(Boolean));
    return unique.size;
  };

  const countUniquePlayers = (list: any[]) => {
    const unique = new Set(list.map((player) => player?.user_id).filter(Boolean));
    return unique.size;
  };

  // Clear votes only once when first entering game screen
  useEffect(() => {
    console.log('GameScreen mounted, clearing votes');
    clearVotes();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    // Room subscription is already set up in gameStore from lobby
    // This hook provides additional game-specific realtime features
    let channel: any = null;

    const setupSubscription = async () => {
      if (roomId) {
        channel = await subscribeToGame();
      }
    };

    setupSubscription();

    return () => {
      if (channel) {
        unsubscribeFromGame(channel);
      }
    };
  }, [roomId, subscribeToGame, unsubscribeFromGame]);

  useEffect(() => {
    if (!currentRoom?.id) return;
    let isActive = true;

    const refreshPlayers = async () => {
      try {
        const { data, error } = await supabase
          .from('players')
          .select('*, user:users(*)')
          .eq('game_room_id', currentRoom.id);

        if (error) throw error;
        if (data && isActive) {
          setPlayers(data as any);
        }
      } catch (error) {
        console.error('Error refreshing players:', error);
      }
    };

    refreshPlayers();
    const timeoutId = setTimeout(refreshPlayers, 1500);

    return () => {
      isActive = false;
      clearTimeout(timeoutId);
    };
  }, [currentRoom?.id, setPlayers]);

  useEffect(() => {
    let isActive = true;

    const refreshSession = async () => {
      if (!currentSession?.id) return;

      try {
        const { data: session, error } = await supabase
          .from('game_sessions')
          .select('*')
          .eq('id', currentSession.id)
          .single();

        if (error) throw error;
        if (!session || !isActive) return;

        setCurrentSession(session);

        if (session.current_question_id) {
          const { data: question } = await supabase
            .from('questions')
            .select('*')
            .eq('id', session.current_question_id)
            .single();

          if (question && isActive) {
            setCurrentQuestion(question);
          }
        }
      } catch (error) {
        console.error('Error refreshing session:', error);
      }
    };

    refreshSession();

    return () => {
      isActive = false;
    };
  }, [currentSession?.id, setCurrentQuestion, setCurrentSession]);

  useEffect(() => {
    if (!hasSubmittedVote || !currentSession?.id) return;
    let isActive = true;

    const pollForAdvance = async () => {
      try {
        const { data: session, error } = await supabase
          .from('game_sessions')
          .select('*')
          .eq('id', currentSession.id)
          .single();

        if (error) throw error;
        if (!session || !isActive) return;

        setCurrentSession(session);

        const currentRound = session.current_round ?? 1;
        const voteType = session.current_phase === 'voting' ? 'suspect' : 'verdict';
        const { data: votesData } = await supabase
          .from('votes')
          .select('*')
          .eq('game_session_id', session.id)
          .eq('round_number', currentRound)
          .eq('vote_type', voteType);

        if (votesData && isActive) {
          const mergedVotes = mergeVotesById(votes, votesData);
          setVotes(mergedVotes);
        }
      } catch (error) {
        console.error('Error polling for advance:', error);
      }
    };

    pollForAdvance();
    const intervalId = setInterval(pollForAdvance, 1500);

    return () => {
      isActive = false;
      clearInterval(intervalId);
    };
  }, [currentSession?.id, hasSubmittedVote, setCurrentSession, setVotes, votes]);

  // Navigate to Results when game ends
  useEffect(() => {
    const status = currentRoom?.status || (currentRoom as any)?.status;
    if (status === 'finished' && roomId) {
      navigation.replace('Results', { roomId });
    }
  }, [currentRoom?.status]);

  useEffect(() => {
    // Update phase from game session
    const sessionPhase = (currentSession as any)?.current_phase ?? currentSession?.currentPhase;
    if (sessionPhase) {
      setPhase(sessionPhase);
    }

    // Check if round changed - reset vote state
    const newRound = (currentSession as any)?.current_round ?? currentSession?.currentRound ?? 1;
    if (newRound !== currentRoundRef) {
      console.log('Round changed from', currentRoundRef, 'to', newRound);
      setCurrentRoundRef(newRound);
      setHasSubmittedVote(false);
      setSelectedPlayer(null);
      setVerdict(null);
    }

    // Sync timer from session's timer_end_time
    const timerEndTime = (currentSession as any)?.timer_end_time ?? currentSession?.timerEndTime;
    if (timerEndTime) {
      const endTime = new Date(timerEndTime).getTime();
      const now = Date.now();
      const remaining = Math.max(0, Math.floor((endTime - now) / 1000));
      // Always update timer, even if 0, to ensure proper countdown
      updateTimer(remaining);
    }
  }, [currentSession]);

  // Also reset when question changes
  const [lastQuestionId, setLastQuestionId] = useState<string | null>(null);
  useEffect(() => {
    const questionId = currentQuestion?.id;
    if (questionId && questionId !== lastQuestionId) {
      console.log('Question changed, resetting vote state');
      setLastQuestionId(questionId);
      setHasSubmittedVote(false);
      setSelectedPlayer(null);
      setVerdict(null);
    }
  }, [currentQuestion]);

  useEffect(() => {
    // Handle timer countdown
    if (timeRemaining <= 0) {
      // Don't create interval if timer is already at 0
      return;
    }

    const timer = setInterval(() => {
      if (timeRemaining > 1) {
        updateTimer(timeRemaining - 1);
      } else if (timeRemaining === 1) {
        updateTimer(0);
        // Call immediately when hitting 0
        handleTimerExpired();
      }
    }, 1000);

    return () => clearInterval(timer);
  }, [timeRemaining]);

  // Check if host and if all players have voted, then advance
  const checkAndAdvance = async () => {
    const hostId = (currentRoom as any)?.host_id || currentRoom?.hostId;
    const isHost = hostId === user?.id;

    if (!isHost) return; // Only host advances the game

    const currentRound = (currentSession as any)?.current_round ?? currentSession?.currentRound ?? 1;
    const currentPhase = (currentSession as any)?.current_phase ?? currentSession?.currentPhase ?? 'voting';
    const sessionId = currentSession?.id;

    // Don't advance if timer hasn't started yet (timeRemaining is 0 could mean not initialized)
    if (!currentSession?.timerEndTime && timeRemaining === 0) {
      console.log('Timer not initialized, skipping advance check');
      return;
    }

    // Filter votes by round AND vote_type
    const voteType = currentPhase === 'voting' ? 'suspect' : 'verdict';
    let votesThisRound = votes.filter(v =>
      v.round_number === currentRound && v.vote_type === voteType
    );

    // In trial phase, suspect can't vote on themselves, so expected voters = players - 1
    const totalPlayers = countUniquePlayers(players);
    const expectedVoters = currentPhase === 'trial' ? totalPlayers - 1 : totalPlayers;

    console.log('Checking advance:', votesThisRound.length, 'votes,', expectedVoters, 'expected voters, phase:', currentPhase, 'round:', currentRound);

    if (countUniqueVoters(votesThisRound) < expectedVoters && sessionId) {
      try {
        const { data, error } = await supabase
          .from('votes')
          .select('*')
          .eq('game_session_id', sessionId)
          .eq('round_number', currentRound)
          .eq('vote_type', voteType);

        if (error) throw error;
        if (data) {
          const mergedVotes = mergeVotesById(votes, data);
          setVotes(mergedVotes);
          votesThisRound = data;
        }
      } catch (error) {
        console.error('Error fetching votes for advance check:', error);
      }
    }

    if (countUniqueVoters(votesThisRound) >= expectedVoters) {
      console.log('All players voted, advancing to next question');
      try {
        await nextQuestion();
      } catch (error) {
        console.error('Error advancing:', error);
      }
    }
  };

  const handleTimerExpired = async () => {
    const hostId = (currentRoom as any)?.host_id || currentRoom?.hostId;
    const isHost = hostId === user?.id;
    const currentRound = (currentSession as any)?.current_round ?? currentSession?.currentRound ?? 1;
    const currentPhase = (currentSession as any)?.current_phase ?? currentSession?.currentPhase ?? phase;
    const voteType = currentPhase === 'voting' ? 'suspect' : 'verdict';
    const hasVotedFromStore = votes.some(
      (v) => v.voter_id === user?.id && v.round_number === currentRound && v.vote_type === voteType
    );

    if (hasSubmittedVote || hasVotedFromStore) {
      if (isHost) {
        console.log('Timer expired, host advancing to next question');
        try {
          await nextQuestion();
        } catch (error) {
          console.error('Error advancing after timer:', error);
        }
      }
      return;
    }

    if (currentPhase === 'voting' && !selectedPlayer) {
      // Auto-submit a random vote if no selection made
      const availablePlayers = players.filter(p => p.user_id !== user?.id);
      if (availablePlayers.length > 0) {
        const randomPlayer = availablePlayers[Math.floor(Math.random() * availablePlayers.length)];
        await submitVote(randomPlayer.user_id);
      }
    } else if (currentPhase === 'trial' && !verdict) {
      // Auto-submit "not guilty" if no verdict selected
      const suspectId = (currentSession as any)?.suspect_id ?? currentSession?.suspectId;
      if (suspectId !== user?.id) {
        await submitVote(null, 'not_guilty');
      }
    }

    // Host advances the game when timer expires
    if (isHost) {
      console.log('Timer expired, host advancing to next question');
      try {
        await nextQuestion();
      } catch (error) {
        console.error('Error advancing after timer:', error);
      }
    }
  };

  useEffect(() => {
    const hostId = (currentRoom as any)?.host_id || currentRoom?.hostId;
    const isHost = hostId === user?.id;
    if (!isHost) return;

    checkAndAdvance();
  }, [
    votes,
    players.length,
    currentSession?.id,
    currentSession?.currentRound,
    currentSession?.currentPhase,
  ]);

  useEffect(() => {
    const hostId = (currentRoom as any)?.host_id || currentRoom?.hostId;
    const isHost = hostId === user?.id;
    if (!isHost) return;

    const handleAppStateChange = (nextState: string) => {
      if (nextState !== 'active') return;
      const timerEndTime = (currentSession as any)?.timer_end_time ?? currentSession?.timerEndTime;
      if (!timerEndTime) return;
      const endTime = new Date(timerEndTime).getTime();
      if (Date.now() >= endTime) {
        handleTimerExpired();
      }
    };

    const subscription = AppState.addEventListener('change', handleAppStateChange);
    return () => subscription.remove();
  }, [currentRoom, currentSession, user?.id]);

  const handleVoteSubmit = async () => {
    if (phase === 'voting' && selectedPlayer) {
      setIsLoading(true);
      try {
        await submitVote(selectedPlayer);
        setSelectedPlayer(null);
        setHasSubmittedVote(true);
        // Check if all players have voted
        setTimeout(() => checkAndAdvance(), 500);
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
        await submitVote(null, verdict);
        setVerdict(null);
        setHasSubmittedVote(true);
        // Check if all players have voted
        setTimeout(() => checkAndAdvance(), 500);
      } catch (error) {
        Alert.alert('Error', 'Failed to submit verdict');
      } finally {
        setIsLoading(false);
      }
    }
  };

  const renderVotingPhase = () => {
    const isHost = (currentRoom as any)?.host_id === user?.id || currentRoom?.hostId === user?.id;
    const currentRound = (currentSession as any)?.current_round ?? currentSession?.currentRound ?? 1;
    const hasVotedFromStore = votes.some(
      v => v.voter_id === user?.id && v.round_number === currentRound && v.vote_type === 'suspect'
    );
    const hasVoted = hasSubmittedVote || hasVotedFromStore;
    const totalPlayers = countUniquePlayers(players);
    const votesThisRound = votes.filter(v => v.round_number === currentRound && v.vote_type === 'suspect');
    const uniqueVotesCount = countUniqueVoters(votesThisRound);

    // Debug logging
    console.log('Voting phase - round:', currentRound, 'votes:', votes.length, 'hasVoted:', hasVoted, 'hasSubmittedVote:', hasSubmittedVote);

    return (
      <View style={styles.container}>
        <LinearGradient
          colors={['#1a1a2e', '#16213e']}
          style={StyleSheet.absoluteFillObject}
        />

        {/* Header */}
        <View style={styles.header}>
          <Text style={styles.phaseLabel}>VOTING ROUND</Text>
          <Text style={styles.roundText}>Round {currentRound}</Text>
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
                { backgroundColor: selectedPlayer ? '#e94560' : '#666' },
                (!selectedPlayer || isLoading) && styles.submitButtonDisabled,
              ]}
              onPress={handleVoteSubmit}
              disabled={!selectedPlayer || isLoading}
            >
              <View style={styles.submitButtonGradient}>
                <Text style={styles.submitButtonText}>
                  {isLoading ? 'Submitting...' : 'SUBMIT VOTE'}
                </Text>
              </View>
            </TouchableOpacity>
          </>
        ) : (
          <View style={styles.waitingContainer}>
            <Text style={styles.voteConfirmText}>✓ Vote Submitted!</Text>
            <ActivityIndicator size="large" color="#e94560" style={{ marginTop: 20 }} />
            <Text style={styles.waitingText}>Waiting for other players...</Text>
            <Text style={styles.waitingSubtext}>
              {uniqueVotesCount} / {totalPlayers} voted
            </Text>
          </View>
        )}
      </View>
    );
  };

  const renderTrialPhase = () => {
    const suspectId = (currentSession as any)?.suspect_id ?? currentSession?.suspectId;
    const suspect = players.find(p => p.user_id === suspectId);
    const currentRound = (currentSession as any)?.current_round ?? currentSession?.currentRound ?? 1;
    const hasVotedFromStore = votes.some(
      v => v.voter_id === user?.id &&
      v.round_number === currentRound &&
      v.vote_type === 'verdict'
    );
    const hasVoted = hasSubmittedVote || hasVotedFromStore;
    const totalPlayers = countUniquePlayers(players);
    const verdictVotesThisRound = votes.filter(v => v.round_number === currentRound && v.vote_type === 'verdict');
    const uniqueVerdictVotesCount = countUniqueVoters(verdictVotesThisRound);

    // Debug logging
    console.log('Trial phase - round:', currentRound, 'votes:', votes.length, 'hasVoted:', hasVoted, 'hasSubmittedVote:', hasSubmittedVote);

    return (
      <View style={styles.container}>
        <LinearGradient
          colors={['#2a0845', '#1a0530']}
          style={StyleSheet.absoluteFillObject}
        />

        {/* Header */}
        <View style={styles.header}>
          <Text style={styles.phaseLabel}>HOT SEAT TRIAL</Text>
          <Text style={styles.roundText}>Question {currentRound}</Text>
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
                { backgroundColor: verdict ? '#e94560' : '#666' },
                (!verdict || isLoading) && styles.submitButtonDisabled,
              ]}
              onPress={handleVerdictSubmit}
              disabled={!verdict || isLoading}
            >
              <View style={styles.submitButtonGradient}>
                <Text style={styles.submitButtonText}>
                  {isLoading ? 'Submitting...' : 'SUBMIT VERDICT'}
                </Text>
              </View>
            </TouchableOpacity>
          </View>
        ) : suspect?.user_id === user?.id ? (
          <View style={styles.onTrialMessage}>
            <Text style={styles.onTrialText}>You are on trial!</Text>
            <Text style={styles.onTrialSubtext}>Wait for the verdict...</Text>
          </View>
        ) : (
          <View style={styles.waitingContainer}>
            <Text style={styles.voteConfirmText}>✓ Verdict Submitted!</Text>
            <ActivityIndicator size="large" color="#e94560" style={{ marginTop: 20 }} />
            <Text style={styles.waitingText}>Waiting for other verdicts...</Text>
            <Text style={styles.waitingSubtext}>
              {uniqueVerdictVotesCount} / {totalPlayers - 1} voted
            </Text>
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

  // Show loading if game data isn't ready
  if (!currentRoom || !currentSession) {
    return (
      <SafeAreaView style={[styles.container, { backgroundColor: '#1a1a2e' }]}>
        <View style={styles.waitingContainer}>
          <ActivityIndicator size="large" color="#e94560" />
          <Text style={styles.waitingText}>Loading game...</Text>
        </View>
      </SafeAreaView>
    );
  }

  const bgColor = phase === 'voting' ? '#1a1a2e' : '#2a0845';

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: bgColor }]}>
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
  voteConfirmText: {
    fontSize: 28,
    fontWeight: 'bold',
    color: '#4CAF50',
    marginBottom: 10,
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
