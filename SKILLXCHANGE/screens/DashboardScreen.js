import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  ActivityIndicator,
  FlatList,
  Modal,
  TextInput,
  Alert,
  StatusBar,
  Image,
  KeyboardAvoidingView,
  Platform,
  TouchableWithoutFeedback,
  Keyboard
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { account, databases, client, DATABASE_ID } from '../services/appwrite';
import { Query, ID } from 'react-native-appwrite';
import { SkillService } from '../services/SkillService';
import { useAuth } from '../context/AuthContext';
import { useTheme } from '../context/ThemeContext';
import Header from '../components/Header';

export default function DashboardScreen({ navigation }) {
  const { colors, isDark } = useTheme();
  const [userData, setUserData] = useState(null);
  const [authorProfiles, setAuthorProfiles] = useState({});
  const [posts, setPosts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showCreatePost, setShowCreatePost] = useState(false);
  const [postType, setPostType] = useState('teach');
  const [postSkill, setPostSkill] = useState('');
  const [postDescription, setPostDescription] = useState('');
  const [creating, setCreating] = useState(false);
  const [refreshing, setRefreshing] = useState(false);

  const { user } = useAuth();

  useEffect(() => {
    if (user) {
      fetchUserData(user.$id);
      fetchPosts();
    }

    const unsubscribe = client.subscribe(
      `databases.${DATABASE_ID}.collections.posts.documents`,
      () => {
        fetchPosts();
      }
    );

    return () => {
      unsubscribe();
    };
  }, []);

  const fetchUserData = async (userId) => {
    try {
      const profile = await SkillService.getUserProfile(userId);
      setUserData(profile);
    } catch (error) {
      console.log('Error fetching user data:', error);
    }
  };

  const fetchPosts = async () => {
    try {
      const response = await databases.listDocuments(
        DATABASE_ID,
        'posts',
        [Query.orderDesc('$createdAt')]
      );

      const postDocs = response.documents;

      // Fetch author profiles manually since Appwrite doesn't have joins
      const authorIds = [...new Set(postDocs.map(p => p.user_id))];
      const profilesMap = { ...authorProfiles };

      await Promise.all(authorIds.map(async (id) => {
        if (!profilesMap[id]) {
          try {
            const profile = await databases.getDocument(DATABASE_ID, 'profiles', id);
            profilesMap[id] = profile;
          } catch (e) {
            console.log(`Error fetching profile for ${id}:`, e);
          }
        }
      }));

      setAuthorProfiles(profilesMap);
      setPosts(postDocs);
      setLoading(false);
    } catch (error) {
      console.log('Error fetching posts:', error);
      setLoading(false);
    }
  };

  const createPost = async () => {
    if (!postSkill.trim()) {
      Alert.alert('Error', 'Please enter a skill');
      return;
    }

    setCreating(true);
    try {
      await databases.createDocument(
        DATABASE_ID,
        'posts',
        ID.unique(),
        {
          user_id: user.$id,
          user_name: userData?.name || 'User',
          type: postType,
          skill: postSkill.trim(),
          content: postDescription.trim(),
          likes: 0,
          liked_by: [],
        },
      );

      Alert.alert('Success', 'Post created!');
      setShowCreatePost(false);
      setPostSkill('');
      setPostDescription('');
      setPostType('teach');
      fetchPosts();
    } catch (error) {
      console.log('Error creating post:', error);
      Alert.alert('Error', 'Failed to create post');
    } finally {
      setCreating(false);
    }
  };

  const likePost = async (postId, currentLikes, likedBy) => {
    const hasLiked = likedBy.includes(user.$id);
    let newLikes = currentLikes;
    let newLikedBy = [...likedBy];

    if (hasLiked) {
      newLikes = Math.max(0, currentLikes - 1);
      newLikedBy = likedBy.filter((id) => id !== user.$id);
    } else {
      newLikes = currentLikes + 1;
      newLikedBy.push(user.$id);
    }

    // Optimistic update
    setPosts(prevPosts =>
      prevPosts.map(post =>
        post.$id === postId
          ? { ...post, likes: newLikes, liked_by: newLikedBy }
          : post
      )
    );

    try {
      await databases.updateDocument(
        DATABASE_ID,
        'posts',
        postId,
        { likes: newLikes, liked_by: newLikedBy }
      );
    } catch (error) {
      console.log('Error liking post:', error);
      fetchPosts(); // Revert on error
      Alert.alert('Error', 'Failed to like post');
    }
  };

  // Dynamic Styles
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
    header: { backgroundColor: colors.card, borderBottomColor: colors.border }
  };

  const renderPost = ({ item }) => {
    const hasLiked = item.liked_by?.includes(user?.$id);
    const authorProfile = authorProfiles[item.user_id];
    const avatarUrl = authorProfile?.avatar_url;
    const userName = authorProfile?.name || item.user_name || 'User';

    return (
      <View style={[styles.postCard, dynamicStyles.card]}>
        {/* Post Header */}
        <View style={styles.postHeader}>
          <View style={styles.userInfo}>
            {avatarUrl ? (
              <Image source={{ uri: avatarUrl }} style={styles.avatarImage} />
            ) : (
              <View style={[styles.avatar, { backgroundColor: colors.tint }]}>
                <Text style={[styles.avatarText, { color: colors.primary }]}>
                  {userName.charAt(0).toUpperCase()}
                </Text>
              </View>
            )}

            <View style={styles.userDetails}>
              <Text style={[styles.userName, dynamicStyles.text]}>{userName}</Text>
              <Text style={[styles.timestamp, dynamicStyles.textSecondary]}>
                {item.created_at
                  ? new Date(item.created_at).toLocaleDateString()
                  : ''}
              </Text>
            </View>
          </View>
          <View
            style={[
              styles.typeBadge,
              item.type === 'teach'
                ? { backgroundColor: isDark ? 'rgba(52, 211, 153, 0.2)' : '#DCFCE7' }
                : { backgroundColor: isDark ? 'rgba(251, 191, 36, 0.2)' : '#FEF08A' },
            ]}
          >
            <Text style={[
              styles.typeText,
              { color: item.type === 'teach' ? (isDark ? '#34D399' : '#166534') : (isDark ? '#FBBF24' : '#854D0E') }
            ]}>
              {item.type === 'teach' ? '🎓 Teaching' : '📚 Learning'}
            </Text>
          </View>
        </View>

        {/* Post Content */}
        <View style={[styles.postContent, { borderTopColor: isDark ? '#374151' : '#F3F4F6' }]}>
          <Text style={[styles.skillTitle, dynamicStyles.text]}>{item.skill}</Text>
          {item.content && (
            <Text style={[styles.description, dynamicStyles.textSecondary]}>{item.content}</Text>
          )}
        </View>

        {/* Post Actions */}
        <View style={[styles.postActions, { borderTopColor: isDark ? '#374151' : '#F3F4F6' }]}>
          <TouchableOpacity
            style={styles.actionButton}
            onPress={() => likePost(item.$id, item.likes || 0, item.liked_by || [])}
          >
            <Text style={[styles.actionIcon, hasLiked && { color: '#EF4444' }]}>
              {hasLiked ? '❤️' : '🤍'}
            </Text>
            <Text style={[styles.actionText, dynamicStyles.textSecondary, hasLiked && { color: '#EF4444' }]}>
              {item.likes || 0}
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.actionButton}
            onPress={() =>
              navigation.navigate('Chat', {
                userId: item.user_id,
                userName: userName,
              })
            }
          >
            <Text style={styles.actionIcon}>💬</Text>
            <Text style={[styles.actionText, dynamicStyles.textSecondary]}>Message</Text>
          </TouchableOpacity>
        </View>
      </View >
    );
  };

  if (loading) {
    return (
      <View style={[styles.center, { backgroundColor: colors.background }]}>
        <ActivityIndicator size="large" color={colors.primary} />
      </View>
    );
  }

  return (
    <SafeAreaView style={[styles.containerSafe, dynamicStyles.container]}>
      <StatusBar barStyle={isDark ? 'light-content' : 'dark-content'} />

      <Header
        title="SkillXchange"
        rightComponent={
          <TouchableOpacity
            style={[styles.createPostButton, { backgroundColor: colors.primary }]}
            onPress={() => setShowCreatePost(true)}
          >
            <Text style={styles.createPostButtonText}>+ New Post</Text>
          </TouchableOpacity>
        }
      />

      {/* Posts Feed */}
      {posts.length === 0 ? (
        <View style={styles.emptyContainer}>
          <Text style={[styles.emptyText, dynamicStyles.text]}>No posts yet 👀</Text>
          <Text style={[styles.emptySubtext, dynamicStyles.textSecondary]}>Be the first to share your skills!</Text>
        </View>
      ) : (
        <FlatList
          data={posts}
          keyExtractor={(item) => item.$id}
          renderItem={renderPost}
          contentContainerStyle={styles.feedContent}
          showsVerticalScrollIndicator={false}
          refreshing={refreshing}
          onRefresh={fetchPosts}
        />
      )}

      {/* Create Post Modal */}
      <Modal visible={showCreatePost} transparent animationType="slide">
        <KeyboardAvoidingView
          style={{ flex: 1 }}
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
          keyboardVerticalOffset={Platform.OS === 'ios' ? 0 : 20}
        >
          <TouchableWithoutFeedback onPress={Keyboard.dismiss}>
            <View style={styles.modalOverlay}>
              <View style={[styles.modalContent, dynamicStyles.card, { maxHeight: '85%' }]}>
                <ScrollView showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
                  <View style={styles.modalHeader}>
                    <Text style={[styles.modalTitle, dynamicStyles.text]}>Create a Post</Text>
                    <TouchableOpacity onPress={() => setShowCreatePost(false)}>
                      <Text style={[styles.closeButton, dynamicStyles.textSecondary]}>✕</Text>
                    </TouchableOpacity>
                  </View>

                  <Text style={[styles.label, dynamicStyles.text]}>I want to:</Text>
                  <View style={styles.typeSelector}>
                    <TouchableOpacity
                      style={[
                        styles.typeOption,
                        postType === 'teach' && { backgroundColor: isDark ? 'rgba(52, 211, 153, 0.2)' : '#DCFCE7', borderColor: colors.secondary },
                        postType !== 'teach' && { borderColor: colors.border }
                      ]}
                      onPress={() => setPostType('teach')}
                    >
                      <Text style={[styles.typeOptionText, { color: isDark ? '#34D399' : '#166534' }]}>🎓 Teach</Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                      style={[
                        styles.typeOption,
                        postType === 'learn' && { backgroundColor: isDark ? 'rgba(251, 191, 36, 0.2)' : '#FEF08A', borderColor: '#F59E0B' },
                        postType !== 'learn' && { borderColor: colors.border }
                      ]}
                      onPress={() => setPostType('learn')}
                    >
                      <Text style={[styles.typeOptionText, { color: isDark ? '#FBBF24' : '#854D0E' }]}>📚 Learn</Text>
                    </TouchableOpacity>
                  </View>

                  <Text style={[styles.label, dynamicStyles.text]}>Skill/Topic</Text>
                  <TextInput
                    style={[styles.input, dynamicStyles.input]}
                    placeholder="e.g., Python, Guitar, Design"
                    value={postSkill}
                    onChangeText={setPostSkill}
                    placeholderTextColor={colors.textSecondary}
                  />

                  <Text style={[styles.label, dynamicStyles.text]}>Description</Text>
                  <TextInput
                    style={[styles.input, styles.descriptionInput, dynamicStyles.input]}
                    placeholder="Tell more about what you want..."
                    value={postDescription}
                    onChangeText={setPostDescription}
                    placeholderTextColor={colors.textSecondary}
                    multiline
                    numberOfLines={4}
                  />

                  <View style={styles.modalActions}>
                    <TouchableOpacity
                      style={[styles.modalButton, { backgroundColor: colors.primary }, creating && { opacity: 0.7 }]}
                      onPress={createPost}
                      disabled={creating}
                    >
                      {creating ? <ActivityIndicator color="#fff" /> : <Text style={styles.postButtonText}>Post</Text>}
                    </TouchableOpacity>
                  </View>
                </ScrollView>
              </View>
            </View>
          </TouchableWithoutFeedback>
        </KeyboardAvoidingView>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  center: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  containerSafe: { flex: 1 },
  headerSection: {
    paddingHorizontal: 20,
    paddingVertical: 15,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    borderBottomWidth: 1,
    borderBottomColor: 'transparent',
  },
  greetingTitle: { fontSize: 22, fontWeight: '800' },
  greetingSubtitle: { fontSize: 14, fontWeight: '500' },
  createPostButton: {
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 25,
    elevation: 2,
    shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.1, shadowRadius: 4
  },
  createPostButtonText: { color: '#fff', fontWeight: '700', fontSize: 13 },
  feedContent: { padding: 15 },
  emptyContainer: { flex: 1, justifyContent: 'center', alignItems: 'center', marginTop: 50 },
  emptyText: { fontSize: 20, fontWeight: '700', marginBottom: 10 },
  emptySubtext: { fontSize: 15 },
  postCard: {
    borderRadius: 16,
    marginBottom: 16,
    borderWidth: 1,
    overflow: 'hidden',
    shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.05, shadowRadius: 8,
    elevation: 2
  },
  postHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 16,
  },
  userInfo: { flexDirection: 'row', alignItems: 'center', flex: 1 },
  avatar: {
    width: 44, height: 44, borderRadius: 22,
    justifyContent: 'center', alignItems: 'center', marginRight: 12
  },
  avatarImage: {
    width: 44, height: 44, borderRadius: 22, marginRight: 12
  },
  avatarText: { fontSize: 18, fontWeight: '700' },
  userDetails: { flex: 1 },
  userName: { fontSize: 15, fontWeight: '700' },
  timestamp: { fontSize: 12, marginTop: 2 },
  typeBadge: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 12 },
  typeText: { fontSize: 11, fontWeight: '800', textTransform: 'uppercase', letterSpacing: 0.5 },
  postContent: { paddingHorizontal: 16, paddingBottom: 16, paddingTop: 0, borderTopWidth: 0 },
  skillTitle: { fontSize: 17, fontWeight: '700', marginBottom: 8 },
  description: { fontSize: 14, lineHeight: 20 },
  postActions: {
    flexDirection: 'row',
    padding: 12,
    borderTopWidth: 1,
    alignItems: 'center'
  },
  actionButton: {
    flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    paddingVertical: 4
  },
  actionIcon: { fontSize: 18, marginRight: 6 },
  actionText: { fontSize: 13, fontWeight: '600' },
  modalOverlay: {
    flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end'
  },
  modalContent: {
    borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: 24, paddingBottom: 40
  },
  modalHeader: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20
  },
  modalTitle: { fontSize: 20, fontWeight: 'bold' },
  closeButton: { fontSize: 22, fontWeight: 'bold' },
  label: { fontSize: 14, fontWeight: '700', marginBottom: 10, marginTop: 10 },
  typeSelector: { flexDirection: 'row', gap: 12, marginBottom: 10 },
  typeOption: {
    flex: 1, paddingVertical: 12, borderRadius: 12, borderWidth: 2, alignItems: 'center', justifyContent: 'center'
  },
  typeOptionText: { fontWeight: '700', fontSize: 14 },
  input: {
    borderWidth: 1, borderRadius: 12, paddingHorizontal: 15, paddingVertical: 12, fontSize: 15
  },
  descriptionInput: { height: 100, textAlignVertical: 'top' },
  modalActions: { marginTop: 25 },
  modalButton: { paddingVertical: 14, borderRadius: 12, alignItems: 'center' },
  postButtonText: { color: '#fff', fontWeight: '700', fontSize: 16 }
});