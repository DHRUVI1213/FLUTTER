import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
  Modal,
  StatusBar,
  Image
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { account, databases, client, DATABASE_ID } from '../services/appwrite';
import { Query } from 'react-native-appwrite';
import { useTheme } from '../context/ThemeContext';
import Header from '../components/Header';

export default function ConversationsScreen({ navigation }) {
  const { colors, isDark } = useTheme();
  const [conversations, setConversations] = useState([]);
  const [allUsers, setAllUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showNewChat, setShowNewChat] = useState(false);
  const [currentUser, setCurrentUser] = useState(null);

  useEffect(() => {
    const initConversations = async () => {
      try {
        const session = await account.get();
        setCurrentUser(session);
        if (session) {
          fetchConversations(session.$id);
          fetchAllUsers(session.$id);
        }
      } catch (error) {
        setLoading(false);
      }
    };

    initConversations();

    const unsubscribe = client.subscribe(
      `databases.${DATABASE_ID}.collections.messages.documents`,
      () => {
        if (currentUser) fetchConversations(currentUser.$id);
      }
    );

    return () => {
      unsubscribe();
    };
  }, [currentUser?.$id]);

  const fetchConversations = async (userId) => {
    try {
      const response = await databases.listDocuments(
        DATABASE_ID,
        'matches',
        [
          Query.or([
            Query.equal('user1_id', userId),
            Query.equal('user2_id', userId)
          ])
        ]
      );

      const matches = response.documents;

      const conversationsData = await Promise.all(
        matches.map(async (match) => {
          const otherUserId = match.user1_id === userId ? match.user2_id : match.user1_id;

          // Fetch other user profile manually (Appwrite has no joins)
          let otherUser = null;
          try {
            otherUser = await databases.getDocument(DATABASE_ID, 'profiles', otherUserId);
          } catch (e) {
            console.log('Error fetching other user:', e);
          }

          const messagesResponse = await databases.listDocuments(
            DATABASE_ID,
            'messages',
            [
              Query.equal('match_id', match.$id || match.id),
              Query.orderDesc('$createdAt'),
              Query.limit(1)
            ]
          );

          const lastMessage = messagesResponse.documents[0];

          return {
            chatId: match.$id,
            userId: otherUserId,
            userName: otherUser?.name || 'User',
            userAvatarUrl: otherUser?.avatar_url,
            lastMessage: lastMessage?.text || 'Start chatting!',
            lastMessageTime: lastMessage?.$createdAt || match.$createdAt,
          };
        })
      );

      conversationsData.sort((a, b) => {
        return new Date(b.lastMessageTime) - new Date(a.lastMessageTime);
      });

      setConversations(conversationsData);
    } catch (error) {
      console.log('Error fetching conversations:', error);
    } finally {
      setLoading(false);
    }
  };

  const fetchAllUsers = async (currentUserId) => {
    try {
      const response = await databases.listDocuments(
        DATABASE_ID,
        'profiles',
        [Query.notEqual('$id', currentUserId)]
      );
      setAllUsers(response.documents || []);
    } catch (error) {
      console.log('Error fetching all users:', error);
    }
  };

  // Dynamic Styles
  const dynamicStyles = {
    container: { backgroundColor: colors.background },
    text: { color: colors.text },
    textSecondary: { color: colors.textSecondary },
    card: { backgroundColor: colors.card, borderColor: colors.border },
    header: { backgroundColor: colors.card, borderBottomColor: colors.border },
    modalHeader: { backgroundColor: colors.card, borderBottomColor: colors.border }
  };

  const renderConversation = ({ item }) => (
    <TouchableOpacity
      style={[styles.conversationCard, dynamicStyles.card]}
      onPress={() =>
        navigation.navigate('Chat', {
          userId: item.userId,
          userName: item.userName,
        })
      }
    >
      {item.userAvatarUrl ? (
        <Image source={{ uri: item.userAvatarUrl }} style={styles.avatarImage} />
      ) : (
        <View style={[styles.avatar, { backgroundColor: colors.tint }]}>
          <Text style={[styles.avatarText, { color: colors.primary }]}>
            {item.userName?.charAt(0).toUpperCase()}
          </Text>
        </View>
      )}

      <View style={styles.conversationInfo}>
        <Text style={[styles.userName, dynamicStyles.text]}>{item.userName}</Text>
        <Text style={[styles.lastMessage, dynamicStyles.textSecondary]} numberOfLines={1}>
          {item.lastMessage}
        </Text>
      </View>

      <View style={styles.timeContainer}>
        <Text style={[styles.time, dynamicStyles.textSecondary]}>
          {item.lastMessageTime
            ? new Date(item.lastMessageTime).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })
            : ''}
        </Text>
      </View>
    </TouchableOpacity>
  );

  const renderUserForNewChat = ({ item }) => (
    <TouchableOpacity
      style={[styles.userCard, dynamicStyles.card]}
      onPress={() => {
        setShowNewChat(false);
        navigation.navigate('Chat', {
          userId: item.$id,
          userName: item.name,
        });
      }}
    >
      {item.avatar_url ? (
        <Image source={{ uri: item.avatar_url }} style={styles.avatarImage} />
      ) : (
        <View style={[styles.avatar, { backgroundColor: colors.tint }]}>
          <Text style={[styles.avatarText, { color: colors.primary }]}>
            {item.name?.charAt(0).toUpperCase()}
          </Text>
        </View>
      )}

      <View style={styles.userInfo}>
        <Text style={[styles.userName, dynamicStyles.text]}>{item.name}</Text>
        <Text style={[styles.userSkills, dynamicStyles.textSecondary]} numberOfLines={1}>
          {item.skills_to_teach?.join(', ') || 'No skills listed'}
        </Text>
      </View>
    </TouchableOpacity>
  );

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
        title="Messages"
        rightComponent={
          <TouchableOpacity
            style={[styles.newChatButton, { backgroundColor: colors.primary }]}
            onPress={() => setShowNewChat(true)}
          >
            <Text style={styles.newChatButtonText}>+</Text>
          </TouchableOpacity>
        }
      />

      {/* List */}
      {conversations.length === 0 ? (
        <View style={styles.emptyContainer}>
          <Text style={[styles.emptyText, dynamicStyles.text]}>No conversations yet</Text>
          <Text style={[styles.emptySubtext, dynamicStyles.textSecondary]}>
            Start a chat to connect with others!
          </Text>
        </View>
      ) : (
        <FlatList
          data={conversations}
          keyExtractor={(item) => item.chatId}
          renderItem={renderConversation}
          contentContainerStyle={styles.listContent}
        />
      )}

      {/* New Chat Modal */}
      <Modal visible={showNewChat} transparent animationType="slide">
        <SafeAreaView style={[styles.modalContainer, dynamicStyles.container]}>
          <View style={[styles.header, dynamicStyles.header]}>
            <TouchableOpacity onPress={() => setShowNewChat(false)} style={styles.closeButtonWrapper}>
              <Text style={[styles.modalCloseButton, dynamicStyles.text]}>✕</Text>
            </TouchableOpacity>
            <Text style={[styles.headerTitle, dynamicStyles.text]}>New Chat</Text>
            <View style={{ width: 40 }} />
          </View>

          <FlatList
            data={allUsers}
            keyExtractor={(item) => item.$id}
            renderItem={renderUserForNewChat}
            contentContainerStyle={styles.userListContent}
          />
        </SafeAreaView>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  center: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  containerSafe: { flex: 1 },
  header: {
    paddingHorizontal: 20,
    paddingVertical: 15,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    borderBottomWidth: 1,
  },
  headerTitle: { fontSize: 22, fontWeight: '800' },
  newChatButton: {
    width: 36, height: 36, borderRadius: 18,
    justifyContent: 'center', alignItems: 'center', elevation: 2
  },
  newChatButtonText: { fontSize: 22, color: '#fff', fontWeight: '400', lineHeight: 24 },
  emptyContainer: { flex: 1, justifyContent: 'center', alignItems: 'center', marginTop: 50 },
  emptyText: { fontSize: 18, fontWeight: '700', marginBottom: 8 },
  emptySubtext: { fontSize: 14, textAlign: 'center', paddingHorizontal: 40 },
  listContent: { padding: 15 },
  conversationCard: {
    borderRadius: 16, marginBottom: 12, padding: 12,
    flexDirection: 'row', alignItems: 'center',
    borderWidth: 1,
    shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.05, shadowRadius: 2, elevation: 1
  },
  avatar: {
    width: 50, height: 50, borderRadius: 25,
    justifyContent: 'center', alignItems: 'center', marginRight: 12
  },
  avatarImage: {
    width: 50, height: 50, borderRadius: 25, marginRight: 12
  },
  avatarText: { fontSize: 20, fontWeight: '700' },
  conversationInfo: { flex: 1 },
  userName: { fontSize: 16, fontWeight: '700', marginBottom: 4 },
  lastMessage: { fontSize: 14 },
  timeContainer: { marginLeft: 10 },
  time: { fontSize: 12 },
  modalContainer: { flex: 1 },
  modalCloseButton: { fontSize: 24, fontWeight: '400' },
  closeButtonWrapper: { width: 40, alignItems: 'flex-start' },
  userListContent: { padding: 15 },
  userCard: {
    borderRadius: 16, marginBottom: 12, padding: 12,
    flexDirection: 'row', alignItems: 'center',
    borderWidth: 1
  },
  userInfo: { flex: 1 },
  userSkills: { fontSize: 13, marginTop: 4 }
});
