import 'react-native-url-polyfill/auto';
import React, { useEffect, useState, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TextInput,
  TouchableOpacity,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  Alert,
  StatusBar,
  Modal,
  Linking
} from 'react-native';
import { account } from '../services/appwrite';
import { ChatService } from '../services/ChatService';
import { SkillService } from '../services/SkillService';
import { SessionService } from '../services/SessionService';
import { useTheme } from '../context/ThemeContext';
import DateTimePicker from '@react-native-community/datetimepicker';

export default function ChatScreen({ route, navigation }) {
  const { colors, isDark } = useTheme();
  const { userId, userName } = route.params;
  const [messages, setMessages] = useState([]);
  const [newMessage, setNewMessage] = useState('');
  const [loading, setLoading] = useState(true);
  const [otherUserData, setOtherUserData] = useState(null);
  const [currentUserId, setCurrentUserId] = useState(null);
  const [currentUserData, setCurrentUserData] = useState(null);
  const [matchId, setMatchId] = useState(null);
  const scrollViewRef = useRef();

  // Scheduling State
  const [showScheduleModal, setShowScheduleModal] = useState(false);
  const [sessionSkill, setSessionSkill] = useState('');
  const [sessionDate, setSessionDate] = useState(new Date());
  const [sessionTime, setSessionTime] = useState(new Date());
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [showTimePicker, setShowTimePicker] = useState(false);
  const [isTeacher, setIsTeacher] = useState(false); // Default to learner
  const [sessionDuration, setSessionDuration] = useState('60');

  useEffect(() => {
    let subscriptionObj = null;

    const initializeChat = async () => {
      try {
        const session = await account.get();
        if (!session) {
          Alert.alert('Error', 'Not authenticated');
          navigation.goBack();
          return;
        }
        const myId = session.$id;
        setCurrentUserId(myId);

        const otherUser = await SkillService.getUserProfile(userId);
        setOtherUserData(otherUser);

        const myProfile = await SkillService.getUserProfile(myId);
        setCurrentUserData(myProfile);

        // Default skill to first common skill or first other user teaching skill
        const common = (otherUser?.skills_to_teach || []).filter(s => myProfile?.skills_to_learn?.includes(s));
        if (common.length > 0) {
          setSessionSkill(common[0]);
          setIsTeacher(false);
        } else if ((myProfile?.skills_to_teach || []).some(s => otherUser?.skills_to_learn?.includes(s))) {
          setSessionSkill(myProfile?.skills_to_teach[0]);
          setIsTeacher(true);
        }

        const match = await ChatService.createMatch(myId, userId);
        if (match) {
          setMatchId(match.$id || match.id); // Appwrite uses $id
          const initialMessages = await ChatService.getMessages(match.$id || match.id);
          setMessages(initialMessages || []);

          subscriptionObj = ChatService.subscribeToMessages(matchId, (msg) => {
            setMessages((prev) => {
              // Check if message ID already exists
              if (prev.some(m => (m.$id || m.id) === (msg.$id || msg.id))) return prev;

              // If it's our own message, it might be the official version of an optimistic message
              if (msg.sender_id === myId) {
                // Filter out the optimistic version if it exists
                return [...prev.filter(m => !m.$id?.startsWith('optimistic-') || m.text !== msg.text), msg];
              }

              return [...prev, msg];
            });
          });

          setLoading(false);
        } else {
          Alert.alert('Error', 'Could not initialize chat');
          setLoading(false);
        }
      } catch (error) {
        console.log('Error initializing chat:', error);
        setLoading(false);
      }
    };

    initializeChat();

    return () => {
      if (subscriptionObj && subscriptionObj.unsubscribe) {
        subscriptionObj.unsubscribe();
      }
    };
  }, []);

  const sendMessage = async () => {
    if (!newMessage.trim() || !matchId || !currentUserId) return;

    const textToSend = newMessage.trim();
    setNewMessage('');

    // Optimistic Update
    const tempId = `optimistic-${Date.now()}`;
    const optimisticMessage = {
      $id: tempId,
      match_id: matchId,
      sender_id: currentUserId,
      text: textToSend,
      created_at: new Date().toISOString(),
    };

    setMessages((prev) => [...prev, optimisticMessage]);

    try {
      await ChatService.sendMessage(matchId, currentUserId, textToSend);
    } catch (error) {
      console.log('Error sending message:', error);
      setMessages((prev) => prev.filter(m => (m.$id || m.id) !== tempId));
      Alert.alert('Error', 'Failed to send message');
    }
  };

  const handleProposeSession = async () => {
    if (!sessionSkill.trim()) {
      Alert.alert('Error', 'Please enter a skill');
      return;
    }

    try {
      const date = new Date(sessionDate);
      date.setHours(sessionTime.getHours());
      date.setMinutes(sessionTime.getMinutes());

      const teacherId = isTeacher ? currentUserId : userId;
      const learnerId = isTeacher ? userId : currentUserId;

      const result = await SessionService.createSession(
        teacherId,
        learnerId,
        sessionSkill,
        date.toISOString(),
        parseInt(sessionDuration) || 60
      );
      if (result) {
        Alert.alert('Success', 'Session proposed! Check "My Sessions" for status.');
        setShowScheduleModal(false);
        // Optionally send a message to the chat
        await ChatService.sendMessage(matchId, currentUserId, `📅 Proposed a ${sessionDuration}min session for ${sessionSkill} on ${date.toLocaleDateString()} at ${date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`);
      }
    } catch (error) {
      console.log('Error proposing session:', error);
      Alert.alert('Error', 'Failed to propose session');
    }
  };

  const startVideoCall = () => {
    // Generate a unique room ID based on the matchId
    const roomId = `SkillXchange-${matchId}`;
    const url = `https://meet.jit.si/${roomId}`;

    Alert.alert(
      'Start Video Call',
      'This will open Jitsi Meet in your browser. Ready to learn?',
      [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Join', onPress: () => Linking.openURL(url) }
      ]
    );
  };

  // Dynamic Styles
  const dynamicStyles = {
    container: { backgroundColor: colors.background },
    text: { color: colors.text },
    textSecondary: { color: colors.textSecondary },
    header: { backgroundColor: colors.card, borderBottomColor: colors.border },
    inputContainer: { borderTopColor: colors.border },
    input: {
      backgroundColor: isDark ? '#374151' : '#F3F4F6',
      color: colors.text,
      borderColor: colors.border
    },
    currentUserBubble: { backgroundColor: colors.primary },
    otherUserBubble: { backgroundColor: isDark ? '#374151' : '#E5E7EB' },
    otherUserText: { color: colors.text },
    timestamp: { color: colors.textSecondary }
  };

  if (loading) {
    return (
      <View style={[styles.center, { backgroundColor: colors.background }]}>
        <ActivityIndicator size="large" color={colors.primary} />
      </View>
    );
  }

  return (
    <KeyboardAvoidingView
      style={[styles.container, dynamicStyles.container]}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      keyboardVerticalOffset={Platform.OS === 'ios' ? 0 : 0}
    >
      <StatusBar barStyle={isDark ? 'light-content' : 'dark-content'} />

      {/* Header */}
      <View style={[styles.header, dynamicStyles.header]}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButtonTouch}>
          <Text style={[styles.backButton, { color: colors.primary }]}>←</Text>
        </TouchableOpacity>
        <View style={styles.headerContent}>
          <Text style={[styles.headerTitle, dynamicStyles.text]}>{userName}</Text>
          {otherUserData?.availability && (
            <Text style={[styles.headerSubtitle, dynamicStyles.textSecondary]}>
              {otherUserData.availability}
            </Text>
          )}
        </View>
        <TouchableOpacity onPress={startVideoCall} style={styles.videoButton}>
          <Text style={styles.scheduleButtonText}>📹</Text>
        </TouchableOpacity>
        <TouchableOpacity onPress={() => setShowScheduleModal(true)} style={styles.scheduleButton}>
          <Text style={styles.scheduleButtonText}>📅</Text>
        </TouchableOpacity>
      </View>

      {/* Messages List */}
      <FlatList
        data={messages}
        ref={scrollViewRef}
        onContentSizeChange={() => scrollViewRef.current?.scrollToEnd({ animated: true })}
        keyExtractor={(item) => (item.$id || item.id).toString()}
        renderItem={({ item }) => {
          const isCurrentUser = item.sender_id === currentUserId;
          return (
            <View style={[styles.messageContainer, isCurrentUser && styles.currentUserContainer]}>
              <View
                style={[
                  styles.messageBubble,
                  isCurrentUser ? dynamicStyles.currentUserBubble : dynamicStyles.otherUserBubble,
                ]}
              >
                <Text style={[
                  styles.messageText,
                  isCurrentUser ? { color: '#fff' } : dynamicStyles.otherUserText
                ]}>
                  {item.text}
                </Text>
                <Text style={[
                  styles.timestamp,
                  isCurrentUser ? { color: 'rgba(255,255,255,0.7)' } : dynamicStyles.timestamp
                ]}>
                  {item.created_at
                    ? new Date(item.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
                    : ''}
                </Text>
              </View>
            </View>
          );
        }}
        contentContainerStyle={styles.messagesList}
      />

      {/* Input Area */}
      <View style={[styles.inputContainer, dynamicStyles.inputContainer]}>
        <TextInput
          style={[styles.input, dynamicStyles.input]}
          placeholder="Type a message..."
          value={newMessage}
          onChangeText={setNewMessage}
          placeholderTextColor={colors.textSecondary}
          multiline
        />
        <TouchableOpacity style={[styles.sendButton, { backgroundColor: colors.primary }]} onPress={sendMessage}>
          <Text style={styles.sendButtonText}>Send</Text>
        </TouchableOpacity>
      </View>

      {/* Schedule Modal */}
      <Modal visible={showScheduleModal} transparent animationType="slide">
        <View style={styles.modalOverlay}>
          <View style={[styles.modalContent, { backgroundColor: colors.card }]}>
            <Text style={[styles.modalTitle, { color: colors.text }]}>Propose Session 📅</Text>

            <Text style={[styles.label, { color: colors.textSecondary }]}>SKILL TO FOCUS ON</Text>
            <TextInput
              style={[styles.modalInput, { backgroundColor: isDark ? '#374151' : '#F3F4F6', color: colors.text, borderColor: colors.border }]}
              placeholder="e.g. JavaScript Basics"
              value={sessionSkill}
              onChangeText={setSessionSkill}
              placeholderTextColor={colors.textSecondary}
            />

            <Text style={[styles.label, { color: colors.textSecondary }]}>I WILL BE THE</Text>
            <View style={styles.roleToggle}>
              <TouchableOpacity
                style={[styles.roleButton, isTeacher && { backgroundColor: colors.primary }]}
                onPress={() => setIsTeacher(true)}
              >
                <Text style={[styles.roleButtonText, isTeacher ? { color: '#fff' } : { color: colors.textSecondary }]}>Teacher 🎓</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.roleButton, !isTeacher && { backgroundColor: colors.primary }]}
                onPress={() => setIsTeacher(false)}
              >
                <Text style={[styles.roleButtonText, !isTeacher ? { color: '#fff' } : { color: colors.textSecondary }]}>Learner 📚</Text>
              </TouchableOpacity>
            </View>

            <View style={styles.dateTimeRow}>
              <View style={{ flex: 1, marginRight: 10 }}>
                <Text style={[styles.label, { color: colors.textSecondary }]}>DATE</Text>
                <TouchableOpacity
                  style={[styles.pickerButton, { backgroundColor: isDark ? '#374151' : '#F3F4F6', borderColor: colors.border }]}
                  onPress={() => setShowDatePicker(true)}
                >
                  <Text style={[styles.pickerText, { color: colors.text }]}>{sessionDate.toLocaleDateString()}</Text>
                </TouchableOpacity>
              </View>
              <View style={{ flex: 1, marginRight: 10 }}>
                <Text style={[styles.label, { color: colors.textSecondary }]}>TIME</Text>
                <TouchableOpacity
                  style={[styles.pickerButton, { backgroundColor: isDark ? '#374151' : '#F3F4F6', borderColor: colors.border }]}
                  onPress={() => setShowTimePicker(true)}
                >
                  <Text style={[styles.pickerText, { color: colors.text }]}>
                    {sessionTime.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                  </Text>
                </TouchableOpacity>
              </View>
              <View style={{ flex: 1 }}>
                <Text style={[styles.label, { color: colors.textSecondary }]}>MINS</Text>
                <TextInput
                  style={[styles.modalInput, { backgroundColor: isDark ? '#374151' : '#F3F4F6', color: colors.text, borderColor: colors.border, marginBottom: 0 }]}
                  value={sessionDuration}
                  onChangeText={setSessionDuration}
                  keyboardType="numeric"
                  placeholder="60"
                />
              </View>
            </View>

            {showDatePicker && (
              <DateTimePicker
                value={sessionDate}
                mode="date"
                display="default"
                onChange={(e, d) => { setShowDatePicker(false); if (d) setSessionDate(d); }}
              />
            )}

            {showTimePicker && (
              <DateTimePicker
                value={sessionTime}
                mode="time"
                display="default"
                onChange={(e, t) => { setShowTimePicker(false); if (t) setSessionTime(t); }}
              />
            )}

            <View style={styles.modalActions}>
              <TouchableOpacity
                style={[styles.submitButton, { backgroundColor: colors.primary }]}
                onPress={handleProposeSession}
              >
                <Text style={styles.submitButtonText}>Send Proposal</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.cancelButton}
                onPress={() => setShowScheduleModal(false)}
              >
                <Text style={[styles.cancelButtonText, { color: colors.textSecondary }]}>Cancel</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  center: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  container: { flex: 1 },
  header: {
    paddingHorizontal: 15, paddingVertical: 10, paddingTop: Platform.OS === 'ios' ? 10 : 15,
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    borderBottomWidth: 1, elevation: 2, shadowColor: '#000', shadowOffset: { height: 1 }
  },
  backButtonTouch: { padding: 8 },
  backButton: { fontSize: 24, fontWeight: 'bold' },
  headerContent: { alignItems: 'center', flex: 1 },
  headerTitle: { fontSize: 18, fontWeight: '700' },
  headerSubtitle: { fontSize: 12, marginTop: 2 },
  scheduleButton: { padding: 8 },
  videoButton: { padding: 8, marginRight: 5 },
  scheduleButtonText: { fontSize: 22 },
  messagesList: { paddingHorizontal: 15, paddingVertical: 15 },
  messageContainer: { flexDirection: 'row', marginBottom: 12, justifyContent: 'flex-start' },
  currentUserContainer: { justifyContent: 'flex-end' },
  messageBubble: { paddingHorizontal: 16, paddingVertical: 12, borderRadius: 20, maxWidth: '80%' },
  messageText: { fontSize: 15, lineHeight: 22 },
  timestamp: { fontSize: 11, marginTop: 4, alignSelf: 'flex-end' },
  inputContainer: {
    flexDirection: 'row', padding: 12, borderTopWidth: 1, alignItems: 'center', marginBottom: 20
  },
  input: {
    flex: 1, borderWidth: 1, borderRadius: 24, paddingHorizontal: 16,
    paddingVertical: 10, marginRight: 10, maxHeight: 100, fontSize: 15
  },
  sendButton: {
    paddingHorizontal: 20, paddingVertical: 12, borderRadius: 24, justifyContent: 'center'
  },
  sendButtonText: { color: '#fff', fontWeight: '700', fontSize: 14 },

  // Modal Styles
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'center', padding: 20 },
  modalContent: { borderRadius: 24, padding: 24, shadowColor: '#000', shadowOffset: { width: 0, height: 10 }, shadowOpacity: 0.2, shadowRadius: 20, elevation: 10 },
  modalTitle: { fontSize: 22, fontWeight: '800', marginBottom: 20, textAlign: 'center' },
  label: { fontSize: 11, fontWeight: '800', marginBottom: 8, letterSpacing: 1 },
  modalInput: { borderWidth: 1, borderRadius: 12, padding: 12, fontSize: 16, marginBottom: 16 },
  roleToggle: { flexDirection: 'row', gap: 10, marginBottom: 16 },
  roleButton: { flex: 1, paddingVertical: 12, borderRadius: 12, alignItems: 'center', borderWidth: 1, borderColor: '#eee' },
  roleButtonText: { fontWeight: '700', fontSize: 14 },
  dateTimeRow: { flexDirection: 'row', marginBottom: 24 },
  pickerButton: { borderWidth: 1, borderRadius: 12, padding: 12, alignItems: 'center' },
  pickerText: { fontWeight: '600' },
  modalActions: { gap: 10 },
  submitButton: { paddingVertical: 14, borderRadius: 14, alignItems: 'center' },
  submitButtonText: { color: '#fff', fontWeight: '700', fontSize: 16 },
  cancelButton: { paddingVertical: 12, alignItems: 'center' },
  cancelButtonText: { fontWeight: '600', fontSize: 14 }
});
