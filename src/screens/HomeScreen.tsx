import React from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  SafeAreaView,
  ScrollView,
  Alert,
} from 'react-native';
import { useAuthStore } from '../store/authStore';
import { useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { RootStackParamList } from '../navigation/AppNavigator';

type HomeScreenNavigationProp = NativeStackNavigationProp<
  RootStackParamList,
  'Home'
>;

const HomeScreen = () => {
  const navigation = useNavigation<HomeScreenNavigationProp>();
  const { user, checkSubscriptionLimit } = useAuthStore();

  const handleCreateGame = async () => {
    const canHost = await checkSubscriptionLimit();
    if (!canHost) {
      Alert.alert(
        'Hosting Limit Reached',
        'You have reached your monthly limit of 2 games. Upgrade to premium for unlimited hosting.',
        [
          { text: 'Cancel', style: 'cancel' },
          { text: 'Upgrade', onPress: () => navigation.navigate('Subscription') },
        ]
      );
      return;
    }
    navigation.navigate('CreateGame');
  };

  const handleJoinGame = () => {
    navigation.navigate('JoinGame');
  };

  const handleProfile = () => {
    navigation.navigate('Profile');
  };

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView contentContainerStyle={styles.scrollContent}>
        <View style={styles.header}>
          <Text style={styles.title}>THE VERDICT</Text>
          <Text style={styles.subtitle}>by SoirAI</Text>
          <Text style={styles.welcome}>Welcome, {user?.name}!</Text>
        </View>

        <View style={styles.mainActions}>
          <TouchableOpacity style={styles.primaryButton} onPress={handleCreateGame}>
            <Text style={styles.primaryButtonText}>HOST GAME</Text>
            <Text style={styles.buttonSubtext}>Create a new game room</Text>
          </TouchableOpacity>

          <TouchableOpacity style={styles.primaryButton} onPress={handleJoinGame}>
            <Text style={styles.primaryButtonText}>JOIN GAME</Text>
            <Text style={styles.buttonSubtext}>Enter a room code</Text>
          </TouchableOpacity>
        </View>

        <View style={styles.stats}>
          <View style={styles.statItem}>
            <Text style={styles.statValue}>
              {user?.subscriptionTier === 'premium'
                ? user?.totalGamesHosted || 0
                : `${user?.gamesHostedThisMonth || 0}/2`}
            </Text>
            <Text style={styles.statLabel}>
              {user?.subscriptionTier === 'premium' ? 'Total Games Hosted' : 'Games Hosted'}
            </Text>
            {user?.subscriptionTier === 'free' && (
              <Text style={styles.statNote}>(This Month)</Text>
            )}
          </View>
        </View>

        <TouchableOpacity style={styles.editProfileButton} onPress={handleProfile}>
          <Text style={styles.editProfileButtonText}>EDIT PROFILE</Text>
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
  header: {
    alignItems: 'center',
    marginBottom: 48,
  },
  title: {
    fontSize: 42,
    fontWeight: '900',
    color: '#FFFFFF',
    letterSpacing: 2,
  },
  subtitle: {
    fontSize: 16,
    color: '#FF6B6B',
    marginTop: 4,
    fontWeight: '600',
  },
  welcome: {
    fontSize: 18,
    color: '#FFFFFF',
    marginTop: 24,
  },
  mainActions: {
    marginBottom: 32,
  },
  primaryButton: {
    backgroundColor: '#FF6B6B',
    borderRadius: 16,
    paddingVertical: 24,
    paddingHorizontal: 32,
    alignItems: 'center',
    marginBottom: 16,
    elevation: 5,
    shadowColor: '#FF6B6B',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
  },
  primaryButtonText: {
    fontSize: 24,
    fontWeight: '800',
    color: '#FFFFFF',
    letterSpacing: 1,
  },
  buttonSubtext: {
    fontSize: 14,
    color: '#FFD0D0',
    marginTop: 4,
  },
  stats: {
    backgroundColor: '#2A2A2A',
    borderRadius: 12,
    padding: 20,
    marginBottom: 24,
    borderWidth: 1,
    borderColor: '#333',
  },
  statItem: {
    alignItems: 'center',
  },
  statValue: {
    fontSize: 28,
    fontWeight: '800',
    color: '#FF6B6B',
  },
  statLabel: {
    fontSize: 14,
    color: '#999',
    marginTop: 4,
  },
  statNote: {
    fontSize: 12,
    color: '#666',
    marginTop: 2,
    fontStyle: 'italic',
  },
  editProfileButton: {
    backgroundColor: '#2A2A2A',
    borderRadius: 12,
    paddingVertical: 16,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#333',
  },
  editProfileButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#FFFFFF',
  },
});

export default HomeScreen;