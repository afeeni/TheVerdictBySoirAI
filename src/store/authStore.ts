import { create } from 'zustand';
import { supabase } from '../services/supabase';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { User } from '../types';

interface AuthState {
  user: User | null;
  session: any | null;
  isLoading: boolean;
  error: string | null;
  signUp: (email: string, password: string, name: string) => Promise<void>;
  signIn: (email: string, password: string) => Promise<void>;
  signOut: () => Promise<void>;
  updateProfile: (updates: Partial<User>) => Promise<void>;
  loadSession: () => Promise<void>;
  checkSubscriptionLimit: () => Promise<boolean>;
  incrementHostedGames: () => Promise<void>;
}

export const useAuthStore = create<AuthState>((set, get) => ({
  user: null,
  session: null,
  isLoading: true,
  error: null,

  signUp: async (email: string, password: string, name: string) => {
    set({ isLoading: true, error: null });
    try {
      const { data: authData, error: authError } = await supabase.auth.signUp({
        email,
        password,
      });

      if (authError) throw authError;

      if (authData.user) {
        // Create user profile
        const { error: profileError } = await supabase
          .from('users')
          .insert({
            id: authData.user.id,
            name,
            subscription_tier: 'free',
            games_hosted_this_month: 0,
          });

        if (profileError) throw profileError;

        const userProfile: User = {
          id: authData.user.id,
          name,
          subscriptionTier: 'free',
          gamesHostedThisMonth: 0,
        };

        set({
          user: userProfile,
          session: authData.session,
          isLoading: false,
        });
      }
    } catch (error: any) {
      set({ error: error.message, isLoading: false });
      throw error;
    }
  },

  signIn: async (email: string, password: string) => {
    set({ isLoading: true, error: null });
    try {
      const { data: authData, error: authError } = await supabase.auth.signInWithPassword({
        email,
        password,
      });

      if (authError) throw authError;

      if (authData.user) {
        // Fetch user profile
        const { data: profile, error: profileError } = await supabase
          .from('users')
          .select('*')
          .eq('id', authData.user.id)
          .single();

        if (profileError) throw profileError;

        const userProfile: User = {
          id: profile.id,
          name: profile.name,
          age: profile.age,
          frontPhotoUrl: profile.front_photo_url,
          sidePhotoUrl: profile.side_photo_url,
          knownFor: profile.known_for,
          redFlag: profile.red_flag,
          guiltyPleasure: profile.guilty_pleasure,
          secretTalent: profile.secret_talent,
          hotTake: profile.hot_take,
          subscriptionTier: profile.subscription_tier,
          gamesHostedThisMonth: profile.games_hosted_this_month,
        };

        set({
          user: userProfile,
          session: authData.session,
          isLoading: false,
        });
      }
    } catch (error: any) {
      set({ error: error.message, isLoading: false });
      throw error;
    }
  },

  signOut: async () => {
    set({ isLoading: true });
    try {
      const { error } = await supabase.auth.signOut();
      if (error) throw error;

      await AsyncStorage.clear();
      set({ user: null, session: null, isLoading: false });
    } catch (error: any) {
      set({ error: error.message, isLoading: false });
      throw error;
    }
  },

  updateProfile: async (updates: Partial<User>) => {
    const { user } = get();
    if (!user) throw new Error('No user logged in');

    set({ isLoading: true, error: null });
    try {
      const dbUpdates: any = {};

      if (updates.name !== undefined) dbUpdates.name = updates.name;
      if (updates.age !== undefined) dbUpdates.age = updates.age;
      if (updates.frontPhotoUrl !== undefined) dbUpdates.front_photo_url = updates.frontPhotoUrl;
      if (updates.sidePhotoUrl !== undefined) dbUpdates.side_photo_url = updates.sidePhotoUrl;
      if (updates.knownFor !== undefined) dbUpdates.known_for = updates.knownFor;
      if (updates.redFlag !== undefined) dbUpdates.red_flag = updates.redFlag;
      if (updates.guiltyPleasure !== undefined) dbUpdates.guilty_pleasure = updates.guiltyPleasure;
      if (updates.secretTalent !== undefined) dbUpdates.secret_talent = updates.secretTalent;
      if (updates.hotTake !== undefined) dbUpdates.hot_take = updates.hotTake;

      const { error } = await supabase
        .from('users')
        .update(dbUpdates)
        .eq('id', user.id);

      if (error) throw error;

      set({
        user: { ...user, ...updates },
        isLoading: false,
      });
    } catch (error: any) {
      set({ error: error.message, isLoading: false });
      throw error;
    }
  },

  loadSession: async () => {
    set({ isLoading: true });
    try {
      const { data: { session } } = await supabase.auth.getSession();

      if (session?.user) {
        // Fetch user profile
        const { data: profile, error: profileError } = await supabase
          .from('users')
          .select('*')
          .eq('id', session.user.id)
          .single();

        if (!profileError && profile) {
          const userProfile: User = {
            id: profile.id,
            name: profile.name,
            age: profile.age,
            frontPhotoUrl: profile.front_photo_url,
            sidePhotoUrl: profile.side_photo_url,
            knownFor: profile.known_for,
            redFlag: profile.red_flag,
            guiltyPleasure: profile.guilty_pleasure,
            secretTalent: profile.secret_talent,
            hotTake: profile.hot_take,
            subscriptionTier: profile.subscription_tier,
            gamesHostedThisMonth: profile.games_hosted_this_month,
          };

          set({
            user: userProfile,
            session,
            isLoading: false,
          });
        } else {
          set({ isLoading: false });
        }
      } else {
        set({ isLoading: false });
      }
    } catch (error: any) {
      set({ error: error.message, isLoading: false });
    }
  },

  checkSubscriptionLimit: async () => {
    const { user } = get();
    if (!user) return false;

    if (user.subscriptionTier === 'premium') return true;
    return user.gamesHostedThisMonth < 2;
  },

  incrementHostedGames: async () => {
    const { user } = get();
    if (!user) throw new Error('No user logged in');

    const newCount = user.gamesHostedThisMonth + 1;

    const { error } = await supabase
      .from('users')
      .update({ games_hosted_this_month: newCount })
      .eq('id', user.id);

    if (error) throw error;

    set({
      user: { ...user, gamesHostedThisMonth: newCount },
    });
  },
}));