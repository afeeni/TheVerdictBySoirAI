import React, { useState } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  SafeAreaView,
  ScrollView,
  Alert,
  Image,
  ActivityIndicator,
} from 'react-native';
import { useAuthStore } from '../store/authStore';
import { useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { RootStackParamList } from '../navigation/AppNavigator';
import { launchImageLibrary, launchCamera } from 'react-native-image-picker';
import { supabase, uploadImage } from '../services/supabase';

type ProfileSetupNavigationProp = NativeStackNavigationProp<
  RootStackParamList,
  'ProfileSetup'
>;

const PROFILE_PROMPTS = [
  { key: 'knownFor', label: 'Known for...', placeholder: 'Being the life of the party' },
  { key: 'redFlag', label: 'Red flag...', placeholder: 'Never texts back' },
  { key: 'guiltyPleasure', label: 'Guilty pleasure...', placeholder: 'Reality TV shows' },
  { key: 'secretTalent', label: 'Secret talent...', placeholder: 'Can juggle' },
  { key: 'hotTake', label: 'Hot take...', placeholder: 'Pineapple belongs on pizza' },
];

const ProfileSetupScreen = () => {
  const navigation = useNavigation<ProfileSetupNavigationProp>();
  const { user, updateProfile } = useAuthStore();
  const [age, setAge] = useState('');
  const [frontPhoto, setFrontPhoto] = useState<string | null>(null);
  const [sidePhoto, setSidePhoto] = useState<string | null>(null);
  const [profileData, setProfileData] = useState({
    knownFor: '',
    redFlag: '',
    guiltyPleasure: '',
    secretTalent: '',
    hotTake: '',
  });
  const [isLoading, setIsLoading] = useState(false);

  const selectPhoto = (type: 'front' | 'side', source: 'camera' | 'library') => {
    const options = {
      mediaType: 'photo' as const,
      includeBase64: true,
      maxWidth: 800,
      maxHeight: 800,
      quality: 0.8,
    };

    const launchFunction = source === 'camera' ? launchCamera : launchImageLibrary;

    launchFunction(options, async (response) => {
      if (!response.didCancel && response.assets && response.assets[0]) {
        const asset = response.assets[0];
        if (asset.base64) {
          if (type === 'front') {
            setFrontPhoto(`data:${asset.type};base64,${asset.base64}`);
          } else {
            setSidePhoto(`data:${asset.type};base64,${asset.base64}`);
          }
        }
      }
    });
  };

  const showPhotoOptions = (type: 'front' | 'side') => {
    Alert.alert(
      'Select Photo',
      'Choose photo source',
      [
        { text: 'Camera', onPress: () => selectPhoto(type, 'camera') },
        { text: 'Library', onPress: () => selectPhoto(type, 'library') },
        { text: 'Cancel', style: 'cancel' },
      ],
      { cancelable: true }
    );
  };

  const handleSaveProfile = async () => {
    if (!user) return;

    if (!frontPhoto || !sidePhoto) {
      Alert.alert('Error', 'Please add both mugshot photos');
      return;
    }

    const filledPrompts = Object.values(profileData).filter(v => v.trim()).length;
    if (filledPrompts < 3) {
      Alert.alert('Error', 'Please fill at least 3 personal facts');
      return;
    }

    setIsLoading(true);
    try {
      // Upload photos to Supabase Storage
      const frontPhotoBlob = await (await fetch(frontPhoto)).blob();
      const sidePhotoBlob = await (await fetch(sidePhoto)).blob();

      const frontPhotoUrl = await uploadImage(
        'user-photos',
        `${user.id}/front-${Date.now()}.jpg`,
        frontPhotoBlob
      );

      const sidePhotoUrl = await uploadImage(
        'user-photos',
        `${user.id}/side-${Date.now()}.jpg`,
        sidePhotoBlob
      );

      // Update profile
      await updateProfile({
        age: age ? parseInt(age) : undefined,
        frontPhotoUrl,
        sidePhotoUrl,
        knownFor: profileData.knownFor || undefined,
        redFlag: profileData.redFlag || undefined,
        guiltyPleasure: profileData.guiltyPleasure || undefined,
        secretTalent: profileData.secretTalent || undefined,
        hotTake: profileData.hotTake || undefined,
      });

      navigation.navigate('Home' as any);
    } catch (error: any) {
      Alert.alert('Error', error.message);
    } finally {
      setIsLoading(false);
    }
  };

  const renderAge = () => {
    if (!age) return null;
    const displayAge = 100 - parseInt(age);
    return `Facing ${displayAge} years`;
  };

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView contentContainerStyle={styles.scrollContent}>
        <View style={styles.header}>
          <Text style={styles.title}>Complete Your Profile</Text>
          <Text style={styles.subtitle}>Create your criminal record</Text>
        </View>

        <View style={styles.mugshotSection}>
          <Text style={styles.sectionTitle}>Mugshot Photos</Text>
          <View style={styles.photosRow}>
            <TouchableOpacity
              style={styles.photoButton}
              onPress={() => showPhotoOptions('front')}
            >
              {frontPhoto ? (
                <Image source={{ uri: frontPhoto }} style={styles.photo} />
              ) : (
                <View style={styles.photoPlaceholder}>
                  <Text style={styles.photoText}>Front</Text>
                  <Text style={styles.photoIcon}>+</Text>
                </View>
              )}
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.photoButton}
              onPress={() => showPhotoOptions('side')}
            >
              {sidePhoto ? (
                <Image source={{ uri: sidePhoto }} style={styles.photo} />
              ) : (
                <View style={styles.photoPlaceholder}>
                  <Text style={styles.photoText}>Side</Text>
                  <Text style={styles.photoIcon}>+</Text>
                </View>
              )}
            </TouchableOpacity>
          </View>
        </View>

        <View style={styles.ageSection}>
          <Text style={styles.sectionTitle}>Age (Optional)</Text>
          <View style={styles.ageRow}>
            <TextInput
              style={styles.ageInput}
              placeholder="Enter age"
              placeholderTextColor="#666"
              value={age}
              onChangeText={setAge}
              keyboardType="number-pad"
              maxLength={2}
            />
            {age && (
              <Text style={styles.ageDisplay}>{renderAge()}</Text>
            )}
          </View>
        </View>

        <View style={styles.promptsSection}>
          <Text style={styles.sectionTitle}>Personal Facts (Fill at least 3)</Text>
          {PROFILE_PROMPTS.map((prompt) => (
            <View key={prompt.key} style={styles.promptItem}>
              <Text style={styles.promptLabel}>{prompt.label}</Text>
              <TextInput
                style={styles.promptInput}
                placeholder={prompt.placeholder}
                placeholderTextColor="#666"
                value={profileData[prompt.key as keyof typeof profileData]}
                onChangeText={(text) =>
                  setProfileData({ ...profileData, [prompt.key]: text })
                }
                maxLength={50}
              />
            </View>
          ))}
        </View>

        <TouchableOpacity
          style={[styles.saveButton, isLoading && styles.buttonDisabled]}
          onPress={handleSaveProfile}
          disabled={isLoading}
        >
          {isLoading ? (
            <ActivityIndicator color="#FFFFFF" />
          ) : (
            <Text style={styles.saveButtonText}>Save Profile</Text>
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
  header: {
    marginBottom: 32,
  },
  title: {
    fontSize: 28,
    fontWeight: '800',
    color: '#FFFFFF',
  },
  subtitle: {
    fontSize: 16,
    color: '#999',
    marginTop: 4,
  },
  mugshotSection: {
    marginBottom: 32,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#FFFFFF',
    marginBottom: 16,
  },
  photosRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  photoButton: {
    width: '48%',
    aspectRatio: 3/4,
    borderRadius: 12,
    overflow: 'hidden',
  },
  photo: {
    width: '100%',
    height: '100%',
  },
  photoPlaceholder: {
    width: '100%',
    height: '100%',
    backgroundColor: '#2A2A2A',
    borderWidth: 2,
    borderColor: '#FF6B6B',
    borderStyle: 'dashed',
    justifyContent: 'center',
    alignItems: 'center',
  },
  photoText: {
    fontSize: 16,
    color: '#999',
    marginBottom: 8,
  },
  photoIcon: {
    fontSize: 32,
    color: '#FF6B6B',
  },
  ageSection: {
    marginBottom: 32,
  },
  ageRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  ageInput: {
    backgroundColor: '#2A2A2A',
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 12,
    fontSize: 16,
    color: '#FFFFFF',
    width: 100,
    borderWidth: 1,
    borderColor: '#333',
  },
  ageDisplay: {
    fontSize: 16,
    color: '#FF6B6B',
    marginLeft: 16,
    fontStyle: 'italic',
  },
  promptsSection: {
    marginBottom: 32,
  },
  promptItem: {
    marginBottom: 16,
  },
  promptLabel: {
    fontSize: 14,
    color: '#999',
    marginBottom: 8,
  },
  promptInput: {
    backgroundColor: '#2A2A2A',
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 12,
    fontSize: 16,
    color: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#333',
  },
  saveButton: {
    backgroundColor: '#FF6B6B',
    borderRadius: 12,
    paddingVertical: 16,
    alignItems: 'center',
  },
  buttonDisabled: {
    opacity: 0.6,
  },
  saveButtonText: {
    fontSize: 18,
    fontWeight: '700',
    color: '#FFFFFF',
  },
});

export default ProfileSetupScreen;