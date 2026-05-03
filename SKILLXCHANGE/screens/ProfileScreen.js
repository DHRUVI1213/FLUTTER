import 'react-native-url-polyfill/auto';
import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ActivityIndicator,
  TouchableOpacity,
  ScrollView,
  TextInput,
  Modal,
  Alert,
  Image,
  Switch,
  StatusBar
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import * as ImagePicker from 'expo-image-picker';
import { databases, storage, APPWRITE_ENDPOINT, APPWRITE_PROJECT_ID, DATABASE_ID, AVATARS_BUCKET_ID } from '../services/appwrite';
import { ID } from 'react-native-appwrite';
import { SkillService } from '../services/SkillService';
import { SessionService } from '../services/SessionService';
import { useAuth } from '../context/AuthContext';
import { useTheme } from '../context/ThemeContext';
import Header from '../components/Header';

export default function ProfileScreen({ navigation }) {
  const { colors, isDark, toggleTheme } = useTheme();
  const { user, logout } = useAuth();

  const [userData, setUserData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [editMode, setEditMode] = useState(false);
  const [showAddSkill, setShowAddSkill] = useState(false);
  const [skillType, setSkillType] = useState('teach'); // 'teach' or 'learn'
  const [newSkill, setNewSkill] = useState('');
  const [availability, setAvailability] = useState('');
  const [uploading, setUploading] = useState(false);
  const [activeTab, setActiveTab] = useState('teach'); // 'teach' | 'learn'
  const [ratingData, setRatingData] = useState({ average: 0, count: 0 });

  useEffect(() => {
    if (user) {
      fetchUserData(user.$id);
    } else {
      setLoading(false);
    }
  }, [user]);

  const fetchUserData = async (userId) => {
    try {
      setLoading(true);
      const data = await SkillService.getUserProfile(userId);
      setUserData(data);
      setAvailability(data?.availability || '');

      const ratings = await SessionService.getProfileRatings(userId);
      setRatingData(ratings);
    } catch (error) {
      console.log('Error fetching profile:', error);
      Alert.alert('Error', 'Failed to load profile');
    } finally {
      setLoading(false);
    }
  };

  const pickImage = async () => {
    try {
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ['images'],
        allowsEditing: true,
        aspect: [1, 1],
        quality: 0.5,
      });

      if (!result.canceled && result.assets && result.assets[0]) {
        uploadImage(result.assets[0]);
      }
    } catch (error) {
      Alert.alert('Error', 'Error picking image');
    }
  };

  const uploadImage = async (imageAsset) => {
    if (!user?.$id) {
      console.log('Error: No user session found for upload');
      return;
    }

    try {
      setUploading(true);
      console.log('Starting upload for user:', user.$id);
      console.log('Full imageAsset received:', JSON.stringify(imageAsset));

      // 1. Prepare file
      const file = {
        uri: imageAsset.uri,
        name: imageAsset.fileName || `avatar_${user.$id}_${Date.now()}.jpg`,
        type: imageAsset.mimeType || 'image/jpeg',
        size: imageAsset.fileSize || 0, // Appwrite sometimes needs size
      };

      console.log('File object being sent to Appwrite:', JSON.stringify(file));

      // 2. Upload to Appwrite Storage
      // Making sure we catch the specific Appwrite error here
      let response;
      try {
        response = await storage.createFile(
          AVATARS_BUCKET_ID,
          ID.unique(),
          file
        );
        console.log('Raw Appwrite Storage response:', JSON.stringify(response));
      } catch (appwriteErr) {
        console.log('Appwrite SDK internal error:', appwriteErr);
        throw appwriteErr;
      }

      if (!response?.$id) {
        console.log('Response returned but missing $id. Response was:', response);
        throw new Error('Storage response missing ID');
      }

      console.log('File successfully uploaded, ID:', response.$id);

      // 3. Get public URL
      const fileUrl = `${APPWRITE_ENDPOINT}/storage/buckets/${AVATARS_BUCKET_ID}/files/${response.$id}/view?project=${APPWRITE_PROJECT_ID}`;

      // 4. Update Profile Document
      await databases.updateDocument(
        DATABASE_ID,
        'profiles',
        user.$id,
        { avatar_url: fileUrl }
      );

      setUserData({ ...userData, avatar_url: fileUrl });
      Alert.alert('Success', 'Profile photo updated!');
    } catch (error) {
      console.log('Detailed Upload Error:', error);
      Alert.alert('Error', `Upload failed: ${error.message || 'Unknown error'}`);
    } finally {
      setUploading(false);
    }
  };

  const removePhoto = async () => {
    if (!user) return;
    try {
      setUploading(true);

      // Update Profile Document to remove URL
      await databases.updateDocument(
        DATABASE_ID,
        'profiles',
        user.$id,
        { avatar_url: '' }
      );

      setUserData({ ...userData, avatar_url: '' });
      Alert.alert('Success', 'Profile photo removed');
    } catch (error) {
      Alert.alert('Error', 'Failed to remove photo');
    } finally {
      setUploading(false);
    }
  };

  const addSkill = async () => {
    if (!newSkill.trim() || !user) return;
    try {
      const normalizedSkill = newSkill.trim();
      let updatedTeach = userData?.skills_to_teach || [];
      let updatedLearn = userData?.skills_to_learn || [];

      if (skillType === 'teach') updatedTeach = [...updatedTeach, normalizedSkill];
      else updatedLearn = [...updatedLearn, normalizedSkill];

      await SkillService.updateSkills(user.$id, updatedLearn, updatedTeach);
      setUserData({ ...userData, skills_to_teach: updatedTeach, skills_to_learn: updatedLearn });
      setNewSkill('');
      setShowAddSkill(false);
    } catch (error) {
      Alert.alert('Error', 'Failed to add skill');
    }
  };

  const removeSkill = async (skill, type) => {
    if (!user) return;
    try {
      let updatedTeach = userData?.skills_to_teach || [];
      let updatedLearn = userData?.skills_to_learn || [];

      if (type === 'teach') updatedTeach = updatedTeach.filter((s) => s !== skill);
      else updatedLearn = updatedLearn.filter((s) => s !== skill);

      await SkillService.updateSkills(user.$id, updatedLearn, updatedTeach);
      setUserData({ ...userData, skills_to_teach: updatedTeach, skills_to_learn: updatedLearn });
    } catch (error) {
      Alert.alert('Error', 'Failed to remove skill');
    }
  };

  const updateAvailability = async () => {
    if (!availability.trim() || !user) return;
    try {
      await databases.updateDocument(
        DATABASE_ID,
        'profiles',
        user.$id,
        { availability: availability.trim() }
      );
      setUserData({ ...userData, availability: availability.trim() });
      setEditMode(false);
      Alert.alert('Success', 'Availability updated!');
    } catch (error) {
      Alert.alert('Error', 'Failed to update availability');
    }
  };

  const handleLogout = async () => {
    try {
      await logout();
    } catch (error) {
      Alert.alert('Error', 'Failed to logout');
    }
  };

  if (loading) {
    return (
      <View style={[styles.center, { backgroundColor: colors.background }]}>
        <ActivityIndicator size="large" color={colors.primary} />
      </View>
    );
  }

  // Styles computed with theme
  const dynamicStyles = {
    container: { backgroundColor: colors.background },
    text: { color: colors.text },
    textSecondary: { color: colors.textSecondary },
    card: { backgroundColor: colors.card, borderColor: colors.border },
    input: {
      backgroundColor: isDark ? '#374151' : '#F3F4F6',
      color: colors.text,
      borderColor: colors.border
    },
    tabActive: { borderBottomColor: colors.primary },
    tabInactive: { borderBottomColor: 'transparent' },
    tabTextActive: { color: colors.primary },
    tabTextInactive: { color: colors.textSecondary },
  };

  return (
    <SafeAreaView style={[styles.containerSafe, dynamicStyles.container]}>
      <StatusBar barStyle={isDark ? 'light-content' : 'dark-content'} />
      <Header
        title="My Profile"
        rightComponent={
          <View style={styles.themeToggle}>
            <Text style={[styles.themeLabel, dynamicStyles.textSecondary]}>{isDark ? '🌙' : '☀️'}</Text>
            <Switch
              value={isDark}
              onValueChange={toggleTheme}
              trackColor={{ false: '#D1D5DB', true: '#6366F1' }}
              thumbColor={isDark ? '#fff' : '#f4f3f4'}
            />
          </View>
        }
      />

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingHorizontal: 20, paddingTop: 20 }}>
        {/* Avatar Section */}
        <View style={styles.avatarContainer}>
          <TouchableOpacity onPress={pickImage} disabled={uploading}>
            {userData?.avatar_url ? (
              <Image source={{ uri: userData.avatar_url }} style={styles.avatarImage} />
            ) : (
              <View style={[styles.avatarPlaceholder, { backgroundColor: colors.tint }]}>
                <Text style={[styles.avatarPlaceholderText, { color: colors.primary }]}>
                  {userData?.name?.charAt(0).toUpperCase() || user?.name?.charAt(0).toUpperCase() || 'U'}
                </Text>
              </View>
            )}

            <View style={[styles.editIconContainer, { backgroundColor: colors.primary }]}>
              {uploading ? (
                <ActivityIndicator size="small" color="#fff" />
              ) : (
                <Text style={styles.editIconText}>📷</Text>
              )}
            </View>
          </TouchableOpacity>

          {userData?.avatar_url && !uploading && (
            <TouchableOpacity onPress={removePhoto} style={{ marginTop: 8 }}>
              <Text style={{ color: colors.error, fontSize: 13, fontWeight: '600' }}>Remove Photo</Text>
            </TouchableOpacity>
          )}
          <Text style={[styles.userName, dynamicStyles.text]}>{userData?.name || user?.name}</Text>
          {ratingData.count > 0 && (
            <View style={styles.profileRatingBadge}>
              <Text style={styles.profileRatingStars}>⭐ {ratingData.average}</Text>
              <Text style={styles.profileRatingCount}>({ratingData.count} reviews)</Text>
            </View>
          )}
          <Text style={[styles.userEmail, dynamicStyles.textSecondary]}>{user?.email}</Text>
        </View>

        {/* Availability Card */}
        <View style={[styles.card, dynamicStyles.card]}>
          <Text style={[styles.label, { color: colors.primary }]}>AVAILABILITY</Text>
          {editMode ? (
            <View>
              <TextInput
                style={[styles.input, dynamicStyles.input]}
                placeholder="e.g., Weekends, After 6 PM"
                value={availability}
                onChangeText={setAvailability}
                placeholderTextColor={colors.textSecondary}
              />
              <View style={styles.buttonRow}>
                <TouchableOpacity onPress={updateAvailability} style={[styles.smallButton, { backgroundColor: colors.primary }]}>
                  <Text style={styles.smallButtonText}>Save</Text>
                </TouchableOpacity>
                <TouchableOpacity onPress={() => setEditMode(false)} style={[styles.smallButton, { backgroundColor: colors.textSecondary }]}>
                  <Text style={styles.smallButtonText}>Cancel</Text>
                </TouchableOpacity>
              </View>
            </View>
          ) : (
            <View style={styles.availabilityRow}>
              <Text style={[styles.value, dynamicStyles.text]}>{userData?.availability || 'Not set'}</Text>
              <TouchableOpacity onPress={() => setEditMode(true)}>
                <Text style={[styles.editLink, { color: colors.primary }]}>Edit</Text>
              </TouchableOpacity>
            </View>
          )}
        </View>

        {/* Skills Tabs */}
        <View style={styles.tabContainer}>
          <TouchableOpacity
            style={[styles.tab, activeTab === 'teach' ? dynamicStyles.tabActive : dynamicStyles.tabInactive]}
            onPress={() => setActiveTab('teach')}
          >
            <Text style={[styles.tabText, activeTab === 'teach' ? dynamicStyles.tabTextActive : dynamicStyles.tabTextInactive]}>
              Teaching ({userData?.skills_to_teach?.length || 0})
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.tab, activeTab === 'learn' ? dynamicStyles.tabActive : dynamicStyles.tabInactive]}
            onPress={() => setActiveTab('learn')}
          >
            <Text style={[styles.tabText, activeTab === 'learn' ? dynamicStyles.tabTextActive : dynamicStyles.tabTextInactive]}>
              Learning ({userData?.skills_to_learn?.length || 0})
            </Text>
          </TouchableOpacity>
        </View>

        {/* Skills List */}
        <View style={[styles.card, dynamicStyles.card, { marginTop: 0, borderTopLeftRadius: 0, borderTopRightRadius: 0 }]}>
          <View style={styles.skillListHeader}>
            <Text style={[styles.sectionTitle, dynamicStyles.text]}>
              {activeTab === 'teach' ? 'Skills I Teach' : 'Skills I Want to Learn'}
            </Text>
            <TouchableOpacity onPress={() => { setSkillType(activeTab); setShowAddSkill(true); }}>
              <Text style={[styles.addButton, { color: colors.primary }]}>+ Add New</Text>
            </TouchableOpacity>
          </View>

          {userData && (activeTab === 'teach' ? userData.skills_to_teach : userData.skills_to_learn)?.length > 0 ? (
            <View style={styles.skillsGrid}>
              {(activeTab === 'teach' ? userData.skills_to_teach : userData.skills_to_learn).map((skill, index) => (
                <View key={index} style={[styles.skillPill, { backgroundColor: isDark ? '#374151' : '#E0E7FF' }]}>
                  <Text style={[styles.skillText, { color: isDark ? '#E5E7EB' : '#3730A3' }]}>{skill}</Text>
                  <TouchableOpacity onPress={() => removeSkill(skill, activeTab)}>
                    <Text style={[styles.removeX, { color: colors.textSecondary }]}>✕</Text>
                  </TouchableOpacity>
                </View>
              ))}
            </View>
          ) : (
            <Text style={[styles.emptyText, dynamicStyles.textSecondary]}>
              No skills added yet. Tap + to add one.
            </Text>
          )}
        </View>

        {/* Logout */}
        <TouchableOpacity style={[styles.logoutButton, { backgroundColor: colors.error, marginTop: 20 }]} onPress={handleLogout}>
          <Text style={styles.logoutButtonText}>Logout</Text>
        </TouchableOpacity>

        <View style={{ height: 40 }} />

        {/* Modal */}
        <Modal visible={showAddSkill} transparent animationType="fade">
          <View style={styles.modalOverlay}>
            <View style={[styles.modalContent, dynamicStyles.card]}>
              <Text style={[styles.modalTitle, dynamicStyles.text]}>Add Skill</Text>
              <TextInput
                style={[styles.input, dynamicStyles.input]}
                placeholder="e.g. Photography"
                value={newSkill}
                onChangeText={setNewSkill}
                placeholderTextColor={colors.textSecondary}
                autoFocus
              />
              <View style={styles.buttonRow}>
                <TouchableOpacity onPress={addSkill} style={[styles.button, { backgroundColor: colors.primary }]}>
                  <Text style={styles.buttonText}>Add</Text>
                </TouchableOpacity>
                <TouchableOpacity onPress={() => setShowAddSkill(false)} style={[styles.button, { backgroundColor: colors.textSecondary }]}>
                  <Text style={styles.buttonText}>Cancel</Text>
                </TouchableOpacity>
              </View>
            </View>
          </View>
        </Modal>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  center: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  containerSafe: { flex: 1 },
  header: {
    padding: 20, paddingBottom: 15, borderBottomWidth: 1, alignItems: 'center'
  },
  themeToggle: { flexDirection: 'row', alignItems: 'center' },
  themeLabel: { fontSize: 18, marginRight: 8 },
  avatarContainer: { alignItems: 'center', marginBottom: 25 },
  avatarImage: { width: 110, height: 110, borderRadius: 55 },
  avatarPlaceholder: { width: 110, height: 110, borderRadius: 55, justifyContent: 'center', alignItems: 'center' },
  avatarPlaceholderText: { fontSize: 40, fontWeight: 'bold' },
  editIconContainer: {
    position: 'absolute', bottom: 0, right: 0, width: 34, height: 34, borderRadius: 17,
    justifyContent: 'center', alignItems: 'center', borderWidth: 2, borderColor: '#fff'
  },
  editIconText: { fontSize: 16 },
  userName: { fontSize: 22, fontWeight: '700', marginTop: 12 },
  userEmail: { fontSize: 14, marginTop: 2 },
  card: { borderRadius: 16, padding: 20, marginBottom: 20, borderWidth: 1 },
  label: { fontSize: 11, fontWeight: '700', letterSpacing: 1, marginBottom: 8 },
  value: { fontSize: 16, fontWeight: '500' },
  availabilityRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  editLink: { fontWeight: '600', fontSize: 14 },
  input: { borderRadius: 8, paddingHorizontal: 16, paddingVertical: 12, fontSize: 16, borderWidth: 1 },
  buttonRow: { flexDirection: 'row', justifyContent: 'flex-end', marginTop: 12, gap: 10 },
  smallButton: { paddingVertical: 8, paddingHorizontal: 16, borderRadius: 8 },
  smallButtonText: { color: '#fff', fontSize: 13, fontWeight: '600' },
  tabContainer: { flexDirection: 'row', marginBottom: 0 },
  tab: { flex: 1, paddingVertical: 14, alignItems: 'center', borderBottomWidth: 3 },
  tabText: { fontWeight: '600', fontSize: 15 },
  skillListHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 15 },
  sectionTitle: { fontSize: 18, fontWeight: '700' },
  addButton: { fontSize: 14, fontWeight: '700' },
  skillsGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  skillPill: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 12, paddingVertical: 8, borderRadius: 20 },
  skillText: { fontSize: 14, fontWeight: '600', marginRight: 6 },
  removeX: { fontSize: 14, fontWeight: 'bold' },
  emptyText: { fontStyle: 'italic', marginTop: 10 },
  logoutButton: { paddingVertical: 16, borderRadius: 12, alignItems: 'center' },
  logoutButtonText: { color: '#fff', fontSize: 16, fontWeight: 'bold' },
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'center', padding: 20 },
  modalContent: { borderRadius: 16, padding: 24 },
  modalTitle: { fontSize: 20, fontWeight: 'bold', marginBottom: 16 },
  button: { paddingVertical: 12, paddingHorizontal: 24, borderRadius: 10 },
  buttonText: { color: '#fff', fontWeight: '600', fontSize: 15 },
  profileRatingBadge: { flexDirection: 'row', alignItems: 'center', marginTop: 4, backgroundColor: 'rgba(251, 191, 36, 0.15)', paddingHorizontal: 10, paddingVertical: 4, borderRadius: 20 },
  profileRatingStars: { fontSize: 14, fontWeight: '700', color: '#B45309' },
  profileRatingCount: { fontSize: 12, color: '#B45309', marginLeft: 4, opacity: 0.8 }
});
