import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  SafeAreaView,
  ScrollView,
  Alert,
  ActivityIndicator,
  Switch,
} from 'react-native';
import { useAuthStore } from '../store/authStore';
import { useGameStore } from '../store/gameStore';
import { useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { RootStackParamList } from '../navigation/AppNavigator';
import { supabase } from '../services/supabase';
import { QuestionPack } from '../types';

type CreateGameNavigationProp = NativeStackNavigationProp<
  RootStackParamList,
  'CreateGame'
>;

const CreateGameScreen = () => {
  const navigation = useNavigation<CreateGameNavigationProp>();
  const { user } = useAuthStore();
  const { createRoom } = useGameStore();

  const [gameMode, setGameMode] = useState<'standard' | 'drinking'>('standard');
  const [gameLength, setGameLength] = useState<'quick' | 'standard' | 'extended'>('standard');
  const [selectedPackId, setSelectedPackId] = useState<string>('');
  const [questionPacks, setQuestionPacks] = useState<QuestionPack[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [showAgeGate, setShowAgeGate] = useState(false);

  useEffect(() => {
    loadQuestionPacks();
  }, []);

  const loadQuestionPacks = async () => {
    try {
      const { data, error } = await supabase
        .from('question_packs')
        .select('*')
        .order('is_premium', { ascending: true });

      if (error) throw error;

      if (data) {
        setQuestionPacks(data);
        // Select first available pack by default
        const defaultPack = data.find(p => !p.is_premium || user?.subscriptionTier === 'premium');
        if (defaultPack) {
          setSelectedPackId(defaultPack.id);
        }
      }
    } catch (error) {
      console.error('Error loading question packs:', error);
    }
  };

  const handleCreateGame = async () => {
    if (!user) return;

    if (gameMode === 'drinking' && !showAgeGate) {
      setShowAgeGate(true);
      return;
    }

    if (!selectedPackId) {
      Alert.alert('Error', 'Please select a question pack');
      return;
    }

    setIsLoading(true);
    try {
      const joinCode = await createRoom(
        user.id,
        gameMode,
        selectedPackId,
        gameLength
      );

      navigation.navigate('Lobby');
    } catch (error: any) {
      Alert.alert('Error', error.message);
    } finally {
      setIsLoading(false);
    }
  };

  const handleAgeConfirmation = () => {
    Alert.alert(
      'Age Verification',
      'By continuing, you confirm that all players are 21+ and will drink responsibly.',
      [
        { text: 'Cancel', style: 'cancel', onPress: () => setShowAgeGate(false) },
        { text: 'Confirm', onPress: handleCreateGame },
      ]
    );
  };

  const canSelectPack = (pack: QuestionPack) => {
    if (!pack.is_premium) return true;
    return user?.subscriptionTier === 'premium';
  };

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView contentContainerStyle={styles.scrollContent}>
        <TouchableOpacity
          style={styles.backButton}
          onPress={() => navigation.goBack()}
        >
          <Text style={styles.backText}>← Back</Text>
        </TouchableOpacity>

        <View style={styles.header}>
          <Text style={styles.title}>Create Game</Text>
          <Text style={styles.subtitle}>Configure your game settings</Text>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Game Mode</Text>
          <View style={styles.modeContainer}>
            <TouchableOpacity
              style={[
                styles.modeButton,
                gameMode === 'standard' && styles.modeButtonActive,
              ]}
              onPress={() => setGameMode('standard')}
            >
              <Text
                style={[
                  styles.modeButtonText,
                  gameMode === 'standard' && styles.modeButtonTextActive,
                ]}
              >
                Standard
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[
                styles.modeButton,
                gameMode === 'drinking' && styles.modeButtonActive,
              ]}
              onPress={() => setGameMode('drinking')}
            >
              <Text
                style={[
                  styles.modeButtonText,
                  gameMode === 'drinking' && styles.modeButtonTextActive,
                ]}
              >
                Drinking Mode 🍺
              </Text>
            </TouchableOpacity>
          </View>
          {gameMode === 'drinking' && (
            <Text style={styles.modeWarning}>
              21+ only. Drink responsibly.
            </Text>
          )}
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Question Pack</Text>
          {questionPacks.map((pack) => {
            const isLocked = !canSelectPack(pack);
            return (
              <TouchableOpacity
                key={pack.id}
                style={[
                  styles.packButton,
                  selectedPackId === pack.id && styles.packButtonActive,
                  isLocked && styles.packButtonLocked,
                ]}
                onPress={() => !isLocked && setSelectedPackId(pack.id)}
                disabled={isLocked}
              >
                <View style={styles.packInfo}>
                  <Text
                    style={[
                      styles.packName,
                      selectedPackId === pack.id && styles.packNameActive,
                    ]}
                  >
                    {pack.name} {pack.is_premium && '👑'}
                  </Text>
                  <Text style={styles.packDescription}>{pack.description}</Text>
                </View>
                {isLocked && (
                  <Text style={styles.lockText}>Premium Only</Text>
                )}
              </TouchableOpacity>
            );
          })}
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Game Length</Text>
          <View style={styles.lengthContainer}>
            {(['quick', 'standard', 'extended'] as const).map((length) => (
              <TouchableOpacity
                key={length}
                style={[
                  styles.lengthButton,
                  gameLength === length && styles.lengthButtonActive,
                ]}
                onPress={() => setGameLength(length)}
              >
                <Text
                  style={[
                    styles.lengthButtonText,
                    gameLength === length && styles.lengthButtonTextActive,
                  ]}
                >
                  {length.charAt(0).toUpperCase() + length.slice(1)}
                </Text>
                <Text style={styles.lengthDetail}>
                  {length === 'quick' && '5 voting + 8 trial'}
                  {length === 'standard' && '7 voting + 10 trial'}
                  {length === 'extended' && '10 voting + 12 trial'}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>

        <TouchableOpacity
          style={[styles.createButton, isLoading && styles.buttonDisabled]}
          onPress={showAgeGate ? handleAgeConfirmation : handleCreateGame}
          disabled={isLoading}
        >
          {isLoading ? (
            <ActivityIndicator color="#FFFFFF" />
          ) : (
            <Text style={styles.createButtonText}>Create Game Room</Text>
          )}
        </TouchableOpacity>
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
  backButton: {
    marginBottom: 24,
  },
  backText: {
    fontSize: 16,
    color: '#999',
  },
  header: {
    marginBottom: 32,
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
  section: {
    marginBottom: 32,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#FFFFFF',
    marginBottom: 16,
  },
  modeContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  modeButton: {
    flex: 0.48,
    backgroundColor: '#2A2A2A',
    borderRadius: 12,
    paddingVertical: 16,
    alignItems: 'center',
    borderWidth: 2,
    borderColor: '#333',
  },
  modeButtonActive: {
    backgroundColor: '#FF6B6B',
    borderColor: '#FF6B6B',
  },
  modeButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#999',
  },
  modeButtonTextActive: {
    color: '#FFFFFF',
  },
  modeWarning: {
    fontSize: 12,
    color: '#FFB84D',
    marginTop: 8,
    fontStyle: 'italic',
  },
  packButton: {
    backgroundColor: '#2A2A2A',
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    borderWidth: 2,
    borderColor: '#333',
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  packButtonActive: {
    backgroundColor: '#FF6B6B',
    borderColor: '#FF6B6B',
  },
  packButtonLocked: {
    opacity: 0.5,
  },
  packInfo: {
    flex: 1,
  },
  packName: {
    fontSize: 16,
    fontWeight: '600',
    color: '#FFFFFF',
  },
  packNameActive: {
    color: '#FFFFFF',
  },
  packDescription: {
    fontSize: 12,
    color: '#999',
    marginTop: 4,
  },
  lockText: {
    fontSize: 12,
    color: '#FFB84D',
    fontWeight: '600',
  },
  lengthContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  lengthButton: {
    flex: 0.31,
    backgroundColor: '#2A2A2A',
    borderRadius: 12,
    paddingVertical: 12,
    paddingHorizontal: 8,
    alignItems: 'center',
    borderWidth: 2,
    borderColor: '#333',
  },
  lengthButtonActive: {
    backgroundColor: '#FF6B6B',
    borderColor: '#FF6B6B',
  },
  lengthButtonText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#999',
  },
  lengthButtonTextActive: {
    color: '#FFFFFF',
  },
  lengthDetail: {
    fontSize: 10,
    color: '#666',
    marginTop: 4,
    textAlign: 'center',
  },
  createButton: {
    backgroundColor: '#FF6B6B',
    borderRadius: 12,
    paddingVertical: 16,
    alignItems: 'center',
    marginTop: 16,
  },
  buttonDisabled: {
    opacity: 0.6,
  },
  createButtonText: {
    fontSize: 18,
    fontWeight: '700',
    color: '#FFFFFF',
  },
});

export default CreateGameScreen;