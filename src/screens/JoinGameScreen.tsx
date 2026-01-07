import React, { useState } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  SafeAreaView,
  Alert,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { useAuthStore } from '../store/authStore';
import { useGameStore } from '../store/gameStore';
import { useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { RootStackParamList } from '../navigation/AppNavigator';

type JoinGameNavigationProp = NativeStackNavigationProp<
  RootStackParamList,
  'JoinGame'
>;

const JoinGameScreen = () => {
  const navigation = useNavigation<JoinGameNavigationProp>();
  const { user } = useAuthStore();
  const { joinRoom } = useGameStore();
  const [joinCode, setJoinCode] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  const handleJoinGame = async () => {
    if (!user) return;

    if (!joinCode || joinCode.length !== 6) {
      Alert.alert('Error', 'Please enter a valid 6-character join code');
      return;
    }

    setIsLoading(true);
    try {
      await joinRoom(joinCode.toUpperCase(), user.id);
      navigation.navigate('Lobby');
    } catch (error: any) {
      Alert.alert('Error', error.message || 'Invalid join code');
    } finally {
      setIsLoading(false);
    }
  };

  const handleCodeChange = (text: string) => {
    // Only allow alphanumeric characters and limit to 6
    const cleaned = text.toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 6);
    setJoinCode(cleaned);
  };

  return (
    <SafeAreaView style={styles.container}>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={styles.keyboardView}
      >
        <View style={styles.content}>
          <TouchableOpacity
            style={styles.backButton}
            onPress={() => navigation.goBack()}
          >
            <Text style={styles.backText}>← Back</Text>
          </TouchableOpacity>

          <View style={styles.header}>
            <Text style={styles.title}>Join Game</Text>
            <Text style={styles.subtitle}>Enter the room code to join</Text>
          </View>

          <View style={styles.codeContainer}>
            <TextInput
              style={styles.codeInput}
              placeholder="XXXXXX"
              placeholderTextColor="#666"
              value={joinCode}
              onChangeText={handleCodeChange}
              maxLength={6}
              autoCapitalize="characters"
              autoCorrect={false}
              keyboardType="default"
            />
            <Text style={styles.codeHint}>
              Ask the host for the 6-character room code
            </Text>
          </View>

          <TouchableOpacity
            style={[
              styles.joinButton,
              (isLoading || joinCode.length !== 6) && styles.buttonDisabled,
            ]}
            onPress={handleJoinGame}
            disabled={isLoading || joinCode.length !== 6}
          >
            {isLoading ? (
              <ActivityIndicator color="#FFFFFF" />
            ) : (
              <Text style={styles.joinButtonText}>Join Room</Text>
            )}
          </TouchableOpacity>

          <View style={styles.instructions}>
            <Text style={styles.instructionsTitle}>How to Join:</Text>
            <Text style={styles.instructionItem}>
              1. Get the room code from the host
            </Text>
            <Text style={styles.instructionItem}>
              2. Enter the 6-character code above
            </Text>
            <Text style={styles.instructionItem}>
              3. Tap "Join Room" to enter the lobby
            </Text>
          </View>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#1A1A1A',
  },
  keyboardView: {
    flex: 1,
  },
  content: {
    flex: 1,
    paddingHorizontal: 24,
    paddingVertical: 32,
  },
  backButton: {
    marginBottom: 24,
  },
  backText: {
    fontSize: 16,
    color: '#999',
  },
  header: {
    marginBottom: 48,
  },
  title: {
    fontSize: 32,
    fontWeight: '800',
    color: '#FFFFFF',
  },
  subtitle: {
    fontSize: 16,
    color: '#999',
    marginTop: 4,
  },
  codeContainer: {
    marginBottom: 32,
  },
  codeInput: {
    backgroundColor: '#2A2A2A',
    borderRadius: 16,
    paddingHorizontal: 32,
    paddingVertical: 24,
    fontSize: 32,
    fontWeight: '700',
    color: '#FFFFFF',
    textAlign: 'center',
    letterSpacing: 8,
    borderWidth: 2,
    borderColor: '#FF6B6B',
  },
  codeHint: {
    fontSize: 14,
    color: '#666',
    textAlign: 'center',
    marginTop: 12,
  },
  joinButton: {
    backgroundColor: '#FF6B6B',
    borderRadius: 12,
    paddingVertical: 16,
    alignItems: 'center',
    marginBottom: 48,
  },
  buttonDisabled: {
    opacity: 0.6,
  },
  joinButtonText: {
    fontSize: 18,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  instructions: {
    backgroundColor: '#2A2A2A',
    borderRadius: 12,
    padding: 20,
    borderWidth: 1,
    borderColor: '#333',
  },
  instructionsTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#FFFFFF',
    marginBottom: 12,
  },
  instructionItem: {
    fontSize: 14,
    color: '#999',
    marginBottom: 8,
    lineHeight: 20,
  },
});

export default JoinGameScreen;