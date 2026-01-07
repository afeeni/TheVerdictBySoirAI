import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  Alert,
  ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { RootStackParamList } from '../navigation/AppNavigator';
import { useAuthStore } from '../store/authStore';
import { supabase } from '../services/supabase';
import LinearGradient from 'react-native-linear-gradient';

type Props = NativeStackScreenProps<RootStackParamList, 'Subscription'>;

interface SubscriptionPlan {
  id: string;
  name: string;
  price: string;
  period: string;
  features: string[];
  highlighted?: boolean;
}

const SubscriptionScreen: React.FC<Props> = ({ navigation }) => {
  const { user, profile, updateProfile } = useAuthStore();
  const [currentPlan, setCurrentPlan] = useState<'free' | 'premium'>('free');
  const [isLoading, setIsLoading] = useState(false);
  const [gamesHosted, setGamesHosted] = useState(0);

  const plans: SubscriptionPlan[] = [
    {
      id: 'free',
      name: 'FREE',
      price: '$0',
      period: 'Forever',
      features: [
        'Join unlimited games',
        'Host 2 games per month',
        'General question pack',
        'SFW question pack',
        'Basic game stats',
      ],
    },
    {
      id: 'premium',
      name: 'PREMIUM',
      price: '$4.99',
      period: '/month',
      features: [
        'Join unlimited games',
        'Host unlimited games',
        'All question packs',
        'Exclusive premium packs',
        'Advanced game stats',
        'Custom game settings',
        'Priority support',
        'No ads',
      ],
      highlighted: true,
    },
  ];

  useEffect(() => {
    loadSubscriptionData();
  }, []);

  const loadSubscriptionData = async () => {
    if (!user) return;

    try {
      const { data, error } = await supabase
        .from('users')
        .select('subscription_tier, games_hosted_this_month')
        .eq('id', user.id)
        .single();

      if (data) {
        setCurrentPlan(data.subscription_tier as 'free' | 'premium');
        setGamesHosted(data.games_hosted_this_month || 0);
      }
    } catch (error) {
      console.error('Error loading subscription data:', error);
    }
  };

  const handleSubscribe = async (planId: string) => {
    if (!user) return;

    if (planId === 'free' && currentPlan === 'free') {
      Alert.alert('Already on Free Plan', 'You are already using the free plan.');
      return;
    }

    if (planId === 'premium') {
      // In a real app, this would integrate with RevenueCat or Stripe
      Alert.alert(
        'Subscribe to Premium',
        'Premium subscription gives you unlimited hosting and access to all question packs.\n\nPrice: $4.99/month',
        [
          { text: 'Cancel', style: 'cancel' },
          {
            text: 'Subscribe',
            onPress: async () => {
              await updateSubscription('premium');
            },
          },
        ]
      );
    } else if (planId === 'free') {
      Alert.alert(
        'Downgrade to Free',
        'Are you sure you want to downgrade to the free plan? You will lose access to premium features.',
        [
          { text: 'Cancel', style: 'cancel' },
          {
            text: 'Downgrade',
            style: 'destructive',
            onPress: async () => {
              await updateSubscription('free');
            },
          },
        ]
      );
    }
  };

  const updateSubscription = async (tier: 'free' | 'premium') => {
    if (!user) return;

    setIsLoading(true);
    try {
      // Update subscription tier in database
      const { error } = await supabase
        .from('users')
        .update({
          subscription_tier: tier,
          updated_at: new Date().toISOString(),
        })
        .eq('id', user.id);

      if (error) throw error;

      // Update local state
      await updateProfile({ subscription_tier: tier });
      setCurrentPlan(tier);

      Alert.alert(
        'Success',
        tier === 'premium'
          ? 'Welcome to Premium! Enjoy unlimited hosting and exclusive content.'
          : 'You have been downgraded to the free plan.'
      );
    } catch (error: any) {
      Alert.alert('Error', error.message || 'Failed to update subscription');
    } finally {
      setIsLoading(false);
    }
  };

  const handleCancelSubscription = () => {
    if (currentPlan === 'free') {
      Alert.alert('No Active Subscription', 'You are currently on the free plan.');
      return;
    }

    Alert.alert(
      'Cancel Subscription',
      'Are you sure you want to cancel your premium subscription? You will keep access until the end of the current billing period.',
      [
        { text: 'Keep Premium', style: 'cancel' },
        {
          text: 'Cancel Subscription',
          style: 'destructive',
          onPress: async () => {
            await updateSubscription('free');
          },
        },
      ]
    );
  };

  const handleRestorePurchases = () => {
    // In a real app, this would check with RevenueCat/App Store/Google Play
    Alert.alert(
      'Restore Purchases',
      'Checking for previous purchases...',
      [{ text: 'OK' }]
    );
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
          <TouchableOpacity
            style={styles.backButton}
            onPress={() => navigation.goBack()}
          >
            <Text style={styles.backButtonText}>←</Text>
          </TouchableOpacity>
          <Text style={styles.title}>SUBSCRIPTION</Text>
          <View style={{ width: 44 }} />
        </View>

        {/* Current Plan */}
        <View style={styles.currentPlanContainer}>
          <Text style={styles.currentPlanLabel}>CURRENT PLAN</Text>
          <Text style={styles.currentPlanName}>
            {currentPlan === 'premium' ? 'PREMIUM' : 'FREE'}
          </Text>
          {currentPlan === 'free' && (
            <Text style={styles.gamesHostedText}>
              {gamesHosted}/2 games hosted this month
            </Text>
          )}
        </View>

        {/* Plans */}
        <View style={styles.plansContainer}>
          {plans.map((plan) => (
            <View
              key={plan.id}
              style={[
                styles.planCard,
                plan.highlighted && styles.planCardHighlighted,
                currentPlan === plan.id && styles.planCardActive,
              ]}
            >
              {plan.highlighted && (
                <View style={styles.popularBadge}>
                  <Text style={styles.popularBadgeText}>MOST POPULAR</Text>
                </View>
              )}

              <Text style={styles.planName}>{plan.name}</Text>
              <View style={styles.priceContainer}>
                <Text style={styles.planPrice}>{plan.price}</Text>
                <Text style={styles.planPeriod}>{plan.period}</Text>
              </View>

              <View style={styles.featuresContainer}>
                {plan.features.map((feature, index) => (
                  <View key={index} style={styles.featureItem}>
                    <Text style={styles.featureBullet}>✓</Text>
                    <Text style={styles.featureText}>{feature}</Text>
                  </View>
                ))}
              </View>

              {currentPlan === plan.id ? (
                <View style={styles.currentPlanBadge}>
                  <Text style={styles.currentPlanBadgeText}>CURRENT PLAN</Text>
                </View>
              ) : (
                <TouchableOpacity
                  style={styles.selectButton}
                  onPress={() => handleSubscribe(plan.id)}
                  disabled={isLoading}
                >
                  <LinearGradient
                    colors={plan.highlighted ? ['#e94560', '#c23652'] : ['#444', '#333']}
                    style={styles.selectButtonGradient}
                  >
                    <Text style={styles.selectButtonText}>
                      {plan.id === 'premium' ? 'UPGRADE' : 'DOWNGRADE'}
                    </Text>
                  </LinearGradient>
                </TouchableOpacity>
              )}
            </View>
          ))}
        </View>

        {/* Additional Options */}
        <View style={styles.additionalOptions}>
          {currentPlan === 'premium' && (
            <TouchableOpacity
              style={styles.cancelButton}
              onPress={handleCancelSubscription}
            >
              <Text style={styles.cancelButtonText}>Cancel Subscription</Text>
            </TouchableOpacity>
          )}

          <TouchableOpacity
            style={styles.restoreButton}
            onPress={handleRestorePurchases}
          >
            <Text style={styles.restoreButtonText}>Restore Purchases</Text>
          </TouchableOpacity>
        </View>

        {/* Terms */}
        <View style={styles.terms}>
          <Text style={styles.termsText}>
            By subscribing, you agree to our Terms of Service and Privacy Policy.
            Subscriptions automatically renew unless cancelled at least 24 hours
            before the end of the current period.
          </Text>
        </View>

        <View style={{ height: 50 }} />
      </ScrollView>

      {isLoading && (
        <View style={styles.loadingOverlay}>
          <ActivityIndicator size="large" color="#e94560" />
        </View>
      )}
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingVertical: 15,
  },
  backButton: {
    padding: 10,
  },
  backButtonText: {
    fontSize: 24,
    color: '#fff',
  },
  title: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#fff',
    letterSpacing: 2,
  },
  currentPlanContainer: {
    alignItems: 'center',
    paddingVertical: 20,
    marginHorizontal: 20,
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
    borderRadius: 15,
    marginBottom: 20,
  },
  currentPlanLabel: {
    fontSize: 12,
    color: '#999',
    letterSpacing: 1,
    marginBottom: 5,
  },
  currentPlanName: {
    fontSize: 28,
    fontWeight: 'bold',
    color: '#e94560',
    letterSpacing: 2,
  },
  gamesHostedText: {
    fontSize: 14,
    color: '#999',
    marginTop: 10,
  },
  plansContainer: {
    paddingHorizontal: 20,
  },
  planCard: {
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
    borderRadius: 20,
    padding: 25,
    marginBottom: 20,
    borderWidth: 2,
    borderColor: 'transparent',
  },
  planCardHighlighted: {
    borderColor: '#e94560',
    backgroundColor: 'rgba(233, 69, 96, 0.05)',
  },
  planCardActive: {
    borderColor: '#4CAF50',
  },
  popularBadge: {
    position: 'absolute',
    top: -12,
    right: 20,
    backgroundColor: '#e94560',
    paddingHorizontal: 15,
    paddingVertical: 5,
    borderRadius: 10,
  },
  popularBadgeText: {
    fontSize: 10,
    fontWeight: 'bold',
    color: '#fff',
    letterSpacing: 1,
  },
  planName: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#fff',
    marginBottom: 10,
  },
  priceContainer: {
    flexDirection: 'row',
    alignItems: 'baseline',
    marginBottom: 20,
  },
  planPrice: {
    fontSize: 36,
    fontWeight: 'bold',
    color: '#fff',
  },
  planPeriod: {
    fontSize: 16,
    color: '#999',
    marginLeft: 5,
  },
  featuresContainer: {
    marginBottom: 20,
  },
  featureItem: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 10,
  },
  featureBullet: {
    fontSize: 18,
    color: '#4CAF50',
    marginRight: 10,
  },
  featureText: {
    fontSize: 14,
    color: '#ddd',
    flex: 1,
  },
  currentPlanBadge: {
    backgroundColor: '#4CAF50',
    paddingVertical: 12,
    borderRadius: 12,
    alignItems: 'center',
  },
  currentPlanBadgeText: {
    fontSize: 14,
    fontWeight: 'bold',
    color: '#fff',
    letterSpacing: 1,
  },
  selectButton: {
    borderRadius: 12,
    overflow: 'hidden',
  },
  selectButtonGradient: {
    paddingVertical: 15,
    alignItems: 'center',
  },
  selectButtonText: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#fff',
    letterSpacing: 1,
  },
  additionalOptions: {
    paddingHorizontal: 20,
    marginTop: 30,
  },
  cancelButton: {
    paddingVertical: 15,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#e94560',
    borderRadius: 12,
    marginBottom: 15,
  },
  cancelButtonText: {
    fontSize: 16,
    color: '#e94560',
    fontWeight: '600',
  },
  restoreButton: {
    paddingVertical: 15,
    alignItems: 'center',
  },
  restoreButtonText: {
    fontSize: 14,
    color: '#999',
    textDecorationLine: 'underline',
  },
  terms: {
    paddingHorizontal: 30,
    marginTop: 30,
  },
  termsText: {
    fontSize: 12,
    color: '#666',
    textAlign: 'center',
    lineHeight: 18,
  },
  loadingOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
  },
});

export default SubscriptionScreen;