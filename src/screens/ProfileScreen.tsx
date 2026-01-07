import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  Image,
  TextInput,
  Alert,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { RootStackParamList } from '../navigation/AppNavigator';
import { useAuthStore } from '../store/authStore';
import { supabase, uploadImage } from '../services/supabase';
import LinearGradient from 'react-native-linear-gradient';
import { launchImageLibrary, launchCamera } from 'react-native-image-picker';

type Props = NativeStackScreenProps<RootStackParamList, 'Profile'>;

const ProfileScreen: React.FC<Props> = ({ navigation }) => {
  const { user, profile, updateProfile, signOut } = useAuthStore();
  const [isEditing, setIsEditing] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [formData, setFormData] = useState({
    name: profile?.name || '',
    age: profile?.age?.toString() || '',
    known_for: profile?.known_for || '',
    red_flag: profile?.red_flag || '',
    guilty_pleasure: profile?.guilty_pleasure || '',
    secret_talent: profile?.secret_talent || '',
    hot_take: profile?.hot_take || '',
  });
  const [frontPhoto, setFrontPhoto] = useState<string | null>(profile?.front_photo_url || null);
  const [sidePhoto, setSidePhoto] = useState<string | null>(profile?.side_photo_url || null);

  const personalFactsFields = [
    { key: 'known_for', label: 'Known for...', placeholder: 'Being the party starter' },
    { key: 'red_flag', label: 'Red flag...', placeholder: 'Never returns borrowed items' },
    { key: 'guilty_pleasure', label: 'Guilty pleasure...', placeholder: 'Reality TV shows' },
    { key: 'secret_talent', label: 'Secret talent...', placeholder: 'Can juggle' },
    { key: 'hot_take', label: 'Hot take...', placeholder: 'Pineapple belongs on pizza' },
  ];

  const selectPhoto = async (type: 'front' | 'side', source: 'camera' | 'gallery') => {
    const options = {
      mediaType: 'photo' as const,
      includeBase64: false,
      maxWidth: 800,
      maxHeight: 800,
      quality: 0.8,
    };

    const result = source === 'camera'
      ? await launchCamera(options)
      : await launchImageLibrary(options);

    if (!result.didCancel && result.assets && result.assets[0]) {
      const asset = result.assets[0];

      if (asset.uri) {
        if (type === 'front') {
          setFrontPhoto(asset.uri);
        } else {
          setSidePhoto(asset.uri);
        }
      }
    }
  };

  const showPhotoOptions = (type: 'front' | 'side') => {
    Alert.alert(
      'Select Photo',
      'Choose how to add your photo',
      [
        { text: 'Camera', onPress: () => selectPhoto(type, 'camera') },
        { text: 'Gallery', onPress: () => selectPhoto(type, 'gallery') },
        { text: 'Cancel', style: 'cancel' },
      ]
    );
  };

  const uploadPhotos = async () => {
    if (!user) return;

    const uploadPromises = [];

    if (frontPhoto && frontPhoto.startsWith('file://')) {
      const fileName = `${user.id}/front-${Date.now()}.jpg`;
      const blob = await fetch(frontPhoto).then(r => r.blob());
      uploadPromises.push(
        uploadImage('user-photos', fileName, blob).then(url => ({
          type: 'front',
          url,
        }))
      );
    }

    if (sidePhoto && sidePhoto.startsWith('file://')) {
      const fileName = `${user.id}/side-${Date.now()}.jpg`;
      const blob = await fetch(sidePhoto).then(r => r.blob());
      uploadPromises.push(
        uploadImage('user-photos', fileName, blob).then(url => ({
          type: 'side',
          url,
        }))
      );
    }

    const results = await Promise.all(uploadPromises);
    const photoUrls: { front_photo_url?: string; side_photo_url?: string } = {};

    results.forEach(result => {
      if (result.type === 'front') {
        photoUrls.front_photo_url = result.url;
      } else {
        photoUrls.side_photo_url = result.url;
      }
    });

    return photoUrls;
  };

  const handleSave = async () => {
    if (!user) return;

    if (!formData.name.trim()) {
      Alert.alert('Error', 'Name is required');
      return;
    }

    setIsLoading(true);
    try {
      // Upload photos if they are new
      const photoUrls = await uploadPhotos();

      // Prepare update data
      const updateData: any = {
        name: formData.name.trim(),
        age: formData.age ? parseInt(formData.age) : null,
        known_for: formData.known_for.trim() || null,
        red_flag: formData.red_flag.trim() || null,
        guilty_pleasure: formData.guilty_pleasure.trim() || null,
        secret_talent: formData.secret_talent.trim() || null,
        hot_take: formData.hot_take.trim() || null,
        updated_at: new Date().toISOString(),
      };

      if (photoUrls?.front_photo_url) {
        updateData.front_photo_url = photoUrls.front_photo_url;
      }
      if (photoUrls?.side_photo_url) {
        updateData.side_photo_url = photoUrls.side_photo_url;
      }

      // Update profile in database
      const { error } = await supabase
        .from('users')
        .update(updateData)
        .eq('id', user.id);

      if (error) throw error;

      // Update local state
      await updateProfile(updateData);
      setIsEditing(false);
      Alert.alert('Success', 'Profile updated successfully');
    } catch (error: any) {
      Alert.alert('Error', error.message || 'Failed to update profile');
    } finally {
      setIsLoading(false);
    }
  };

  const handleSignOut = () => {
    Alert.alert(
      'Sign Out',
      'Are you sure you want to sign out?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Sign Out',
          style: 'destructive',
          onPress: async () => {
            await signOut();
            navigation.navigate('Auth');
          },
        },
      ]
    );
  };

  const renderAge = () => {
    if (!formData.age) return 'Not set';
    const reversedAge = parseInt(formData.age.split('').reverse().join(''));
    return `Facing ${reversedAge} years`;
  };

  return (
    <SafeAreaView style={styles.container}>
      <LinearGradient
        colors={['#1a1a2e', '#0f0f1e']}
        style={StyleSheet.absoluteFillObject}
      />

      <KeyboardAvoidingView
        style={styles.container}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      >
        <ScrollView showsVerticalScrollIndicator={false}>
          {/* Header */}
          <View style={styles.header}>
            <TouchableOpacity
              style={styles.backButton}
              onPress={() => navigation.goBack()}
            >
              <Text style={styles.backButtonText}>←</Text>
            </TouchableOpacity>
            <Text style={styles.title}>MY PROFILE</Text>
            <TouchableOpacity
              style={styles.editButton}
              onPress={() => setIsEditing(!isEditing)}
            >
              <Text style={styles.editButtonText}>{isEditing ? 'Cancel' : 'Edit'}</Text>
            </TouchableOpacity>
          </View>

          {/* Mugshots */}
          <View style={styles.mugshotSection}>
            <Text style={styles.sectionTitle}>MUGSHOTS</Text>
            <View style={styles.mugshotContainer}>
              <View style={styles.mugshotItem}>
                <TouchableOpacity
                  onPress={() => isEditing && showPhotoOptions('front')}
                  disabled={!isEditing}
                >
                  {frontPhoto ? (
                    <Image source={{ uri: frontPhoto }} style={styles.mugshot} />
                  ) : (
                    <View style={styles.mugshotPlaceholder}>
                      <Text style={styles.mugshotPlaceholderText}>Front</Text>
                    </View>
                  )}
                </TouchableOpacity>
                <Text style={styles.mugshotLabel}>FRONT</Text>
              </View>

              <View style={styles.mugshotItem}>
                <TouchableOpacity
                  onPress={() => isEditing && showPhotoOptions('side')}
                  disabled={!isEditing}
                >
                  {sidePhoto ? (
                    <Image source={{ uri: sidePhoto }} style={styles.mugshot} />
                  ) : (
                    <View style={styles.mugshotPlaceholder}>
                      <Text style={styles.mugshotPlaceholderText}>Side</Text>
                    </View>
                  )}
                </TouchableOpacity>
                <Text style={styles.mugshotLabel}>SIDE</Text>
              </View>
            </View>
          </View>

          {/* Basic Info */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>BASIC INFO</Text>

            <View style={styles.field}>
              <Text style={styles.fieldLabel}>Name</Text>
              {isEditing ? (
                <TextInput
                  style={styles.input}
                  value={formData.name}
                  onChangeText={(text) => setFormData({ ...formData, name: text })}
                  placeholder="Enter your name"
                  placeholderTextColor="#666"
                />
              ) : (
                <Text style={styles.fieldValue}>{formData.name || 'Not set'}</Text>
              )}
            </View>

            <View style={styles.field}>
              <Text style={styles.fieldLabel}>Age</Text>
              {isEditing ? (
                <TextInput
                  style={styles.input}
                  value={formData.age}
                  onChangeText={(text) => setFormData({ ...formData, age: text })}
                  placeholder="Enter your age"
                  placeholderTextColor="#666"
                  keyboardType="numeric"
                />
              ) : (
                <Text style={styles.fieldValue}>{renderAge()}</Text>
              )}
            </View>
          </View>

          {/* Personal Facts */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>PERSONAL FACTS</Text>

            {personalFactsFields.map((field) => (
              <View key={field.key} style={styles.field}>
                <Text style={styles.fieldLabel}>{field.label}</Text>
                {isEditing ? (
                  <TextInput
                    style={styles.input}
                    value={formData[field.key as keyof typeof formData]}
                    onChangeText={(text) => setFormData({ ...formData, [field.key]: text })}
                    placeholder={field.placeholder}
                    placeholderTextColor="#666"
                    multiline
                  />
                ) : (
                  <Text style={styles.fieldValue}>
                    {formData[field.key as keyof typeof formData] || 'Not set'}
                  </Text>
                )}
              </View>
            ))}
          </View>

          {/* Action Buttons */}
          {isEditing ? (
            <TouchableOpacity
              style={styles.saveButton}
              onPress={handleSave}
              disabled={isLoading}
            >
              <LinearGradient
                colors={['#4CAF50', '#45a049']}
                style={styles.saveButtonGradient}
              >
                {isLoading ? (
                  <ActivityIndicator color="#fff" />
                ) : (
                  <Text style={styles.saveButtonText}>SAVE CHANGES</Text>
                )}
              </LinearGradient>
            </TouchableOpacity>
          ) : (
            <>
              <TouchableOpacity
                style={styles.subscriptionButton}
                onPress={() => navigation.navigate('Subscription')}
              >
                <LinearGradient
                  colors={['#e94560', '#c23652']}
                  style={styles.buttonGradient}
                >
                  <Text style={styles.buttonText}>MANAGE SUBSCRIPTION</Text>
                </LinearGradient>
              </TouchableOpacity>

              <TouchableOpacity style={styles.signOutButton} onPress={handleSignOut}>
                <Text style={styles.signOutButtonText}>SIGN OUT</Text>
              </TouchableOpacity>
            </>
          )}

          <View style={{ height: 50 }} />
        </ScrollView>
      </KeyboardAvoidingView>
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
  editButton: {
    padding: 10,
  },
  editButtonText: {
    fontSize: 16,
    color: '#e94560',
    fontWeight: '600',
  },
  mugshotSection: {
    paddingHorizontal: 20,
    paddingVertical: 20,
  },
  sectionTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: '#999',
    letterSpacing: 2,
    marginBottom: 15,
  },
  mugshotContainer: {
    flexDirection: 'row',
    justifyContent: 'space-around',
  },
  mugshotItem: {
    alignItems: 'center',
  },
  mugshot: {
    width: 140,
    height: 140,
    borderRadius: 15,
    borderWidth: 2,
    borderColor: '#333',
  },
  mugshotPlaceholder: {
    width: 140,
    height: 140,
    borderRadius: 15,
    backgroundColor: '#222',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 2,
    borderColor: '#333',
    borderStyle: 'dashed',
  },
  mugshotPlaceholderText: {
    fontSize: 14,
    color: '#666',
  },
  mugshotLabel: {
    fontSize: 12,
    color: '#666',
    marginTop: 8,
    letterSpacing: 1,
  },
  section: {
    paddingHorizontal: 20,
    paddingVertical: 20,
  },
  field: {
    marginBottom: 20,
  },
  fieldLabel: {
    fontSize: 12,
    color: '#999',
    marginBottom: 8,
    letterSpacing: 1,
  },
  fieldValue: {
    fontSize: 16,
    color: '#fff',
    paddingVertical: 12,
    paddingHorizontal: 15,
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
    borderRadius: 10,
  },
  input: {
    fontSize: 16,
    color: '#fff',
    paddingVertical: 12,
    paddingHorizontal: 15,
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#333',
  },
  saveButton: {
    marginHorizontal: 20,
    marginTop: 20,
    borderRadius: 25,
    overflow: 'hidden',
  },
  saveButtonGradient: {
    paddingVertical: 18,
    alignItems: 'center',
  },
  saveButtonText: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#fff',
    letterSpacing: 1,
  },
  subscriptionButton: {
    marginHorizontal: 20,
    marginTop: 30,
    borderRadius: 25,
    overflow: 'hidden',
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
  signOutButton: {
    marginHorizontal: 20,
    marginTop: 15,
    paddingVertical: 18,
    alignItems: 'center',
    borderWidth: 2,
    borderColor: '#666',
    borderRadius: 25,
  },
  signOutButtonText: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#999',
    letterSpacing: 1,
  },
});

export default ProfileScreen;