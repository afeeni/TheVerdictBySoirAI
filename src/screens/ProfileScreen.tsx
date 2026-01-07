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
  const { user, updateProfile, signOut } = useAuthStore();
  const [isEditing, setIsEditing] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [formData, setFormData] = useState({
    name: user?.name || '',
    age: user?.age?.toString() || '',
    known_for: user?.knownFor || '',
    red_flag: user?.redFlag || '',
    guilty_pleasure: user?.guiltyPleasure || '',
    secret_talent: user?.secretTalent || '',
    hot_take: user?.hotTake || '',
  });
  const [frontPhoto, setFrontPhoto] = useState<string | null>(user?.frontPhotoUrl || null);
  const [sidePhoto, setSidePhoto] = useState<string | null>(user?.sidePhotoUrl || null);
  const [frontPhotoType, setFrontPhotoType] = useState<string>('image/jpeg');
  const [sidePhotoType, setSidePhotoType] = useState<string>('image/jpeg');

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
        const fileType = asset.type || 'image/jpeg';
        console.log('Selected photo type:', fileType, 'URI:', asset.uri);

        if (type === 'front') {
          setFrontPhoto(asset.uri);
          setFrontPhotoType(fileType);
        } else {
          setSidePhoto(asset.uri);
          setSidePhotoType(fileType);
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
    if (!user) return {};

    const photoUrls: { front_photo_url?: string; side_photo_url?: string } = {};

    try {
      // Upload front photo if it's new
      if (frontPhoto && frontPhoto.startsWith('file://')) {
        console.log('Uploading front photo...', frontPhoto, 'Type:', frontPhotoType);
        const ext = frontPhotoType === 'image/heic' ? 'heic' : 'jpg';
        const fileName = `${user.id}/front-${Date.now()}.${ext}`;

        try {
          // Read file as ArrayBuffer for React Native
          const response = await fetch(frontPhoto);
          const arrayBuffer = await response.arrayBuffer();

          console.log('ArrayBuffer size:', arrayBuffer.byteLength);

          if (arrayBuffer.byteLength === 0) {
            throw new Error('File is empty');
          }

          const { data, error } = await supabase.storage
            .from('user-photos')
            .upload(fileName, arrayBuffer, {
              cacheControl: '3600',
              upsert: true,
              contentType: frontPhotoType,
            });

          if (error) throw error;

          const { data: urlData } = supabase.storage
            .from('user-photos')
            .getPublicUrl(fileName);

          photoUrls.front_photo_url = urlData.publicUrl;
          console.log('Front photo uploaded:', urlData.publicUrl);
        } catch (error: any) {
          console.error('Front photo upload error:', error);
          Alert.alert('Photo Upload Error', `Failed to upload front photo: ${error.message}`);
        }
      }

      // Upload side photo if it's new
      if (sidePhoto && sidePhoto.startsWith('file://')) {
        console.log('Uploading side photo...', sidePhoto, 'Type:', sidePhotoType);
        const ext = sidePhotoType === 'image/heic' ? 'heic' : 'jpg';
        const fileName = `${user.id}/side-${Date.now()}.${ext}`;

        try {
          // Read file as ArrayBuffer for React Native
          const response = await fetch(sidePhoto);
          const arrayBuffer = await response.arrayBuffer();

          console.log('ArrayBuffer size:', arrayBuffer.byteLength);

          if (arrayBuffer.byteLength === 0) {
            throw new Error('File is empty');
          }

          const { data, error } = await supabase.storage
            .from('user-photos')
            .upload(fileName, arrayBuffer, {
              cacheControl: '3600',
              upsert: true,
              contentType: sidePhotoType,
            });

          if (error) throw error;

          const { data: urlData } = supabase.storage
            .from('user-photos')
            .getPublicUrl(fileName);

          photoUrls.side_photo_url = urlData.publicUrl;
          console.log('Side photo uploaded:', urlData.publicUrl);
        } catch (error: any) {
          console.error('Side photo upload error:', error);
          Alert.alert('Photo Upload Error', `Failed to upload side photo: ${error.message}`);
        }
      }
    } catch (error: any) {
      console.error('Photo upload error:', error);
      Alert.alert('Error', `Failed to process photos: ${error.message}`);
    }

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

      // Prepare update data for database
      const dbUpdateData: any = {
        name: formData.name.trim(),
        age: formData.age ? parseInt(formData.age) : null,
        known_for: formData.known_for.trim() || null,
        red_flag: formData.red_flag.trim() || null,
        guilty_pleasure: formData.guilty_pleasure.trim() || null,
        secret_talent: formData.secret_talent.trim() || null,
        hot_take: formData.hot_take.trim() || null,
        updated_at: new Date().toISOString(),
      };

      // Prepare update data for local state (camelCase)
      const stateUpdateData: any = {
        name: formData.name.trim(),
        age: formData.age ? parseInt(formData.age) : null,
        knownFor: formData.known_for.trim() || null,
        redFlag: formData.red_flag.trim() || null,
        guiltyPleasure: formData.guilty_pleasure.trim() || null,
        secretTalent: formData.secret_talent.trim() || null,
        hotTake: formData.hot_take.trim() || null,
      };

      if (photoUrls?.front_photo_url) {
        dbUpdateData.front_photo_url = photoUrls.front_photo_url;
        stateUpdateData.frontPhotoUrl = photoUrls.front_photo_url;
      }
      if (photoUrls?.side_photo_url) {
        dbUpdateData.side_photo_url = photoUrls.side_photo_url;
        stateUpdateData.sidePhotoUrl = photoUrls.side_photo_url;
      }

      // Update profile in database
      const { error } = await supabase
        .from('users')
        .update(dbUpdateData)
        .eq('id', user.id);

      if (error) throw error;

      // Update local state
      await updateProfile(stateUpdateData);
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
            <Text style={styles.title}>SUSPECT FILE</Text>
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

          {/* Criminal History */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>CRIMINAL HISTORY</Text>

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
    paddingVertical: 20,
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
    marginBottom: 15,
    borderRadius: 25,
    overflow: 'hidden',
    elevation: 5,
    shadowColor: '#e94560',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
  },
  buttonGradient: {
    paddingVertical: 22,
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
    marginTop: 10,
    marginBottom: 20,
    paddingVertical: 20,
    alignItems: 'center',
    borderWidth: 2,
    borderColor: '#666',
    borderRadius: 25,
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
  },
  signOutButtonText: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#fff',
    letterSpacing: 1,
  },
});

export default ProfileScreen;