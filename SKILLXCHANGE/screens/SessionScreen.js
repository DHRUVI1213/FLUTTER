import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
  TextInput,
  Modal,
  StatusBar,
  Linking
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { account, databases, DATABASE_ID } from '../services/appwrite';
import { ID, Query } from 'react-native-appwrite';
import { SessionService } from '../services/SessionService';
import DateTimePicker from '@react-native-community/datetimepicker';
import { useTheme } from '../context/ThemeContext';
import Header from '../components/Header';

export default function SessionScreen() {
  const { colors, isDark } = useTheme();
  const [sessions, setSessions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [selectedDate, setSelectedDate] = useState(new Date());
  const [selectedTime, setSelectedTime] = useState(new Date());
  const [skill, setSkill] = useState('');
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [showTimePicker, setShowTimePicker] = useState(false);
  const [currentUser, setCurrentUser] = useState(null);

  // Rating State
  const [showRatingModal, setShowRatingModal] = useState(false);
  const [selectedSession, setSelectedSession] = useState(null);
  const [userRating, setUserRating] = useState(5);
  const [ratingComment, setRatingComment] = useState('');

  useEffect(() => {
    let subscription = null;
    const initSessions = async () => {
      try {
        const session = await account.get();
        setCurrentUser(session);
        if (session) {
          fetchSessions(session.$id);

          // Real-time subscription for sessions
          subscription = client.subscribe(
            `databases.${DATABASE_ID}.collections.sessions.documents`,
            (response) => {
              if (response.payload.teacher_id === session.$id || response.payload.learner_id === session.$id) {
                fetchSessions(session.$id);
              }
            }
          );
        } else {
          setLoading(false);
        }
      } catch (error) {
        setLoading(false);
      }
    };

    initSessions();

    return () => {
      if (subscription) subscription();
    };
  }, []);

  const fetchSessions = async (userId) => {
    try {
      const response = await databases.listDocuments(
        DATABASE_ID,
        'sessions',
        [
          Query.or([
            Query.equal('teacher_id', userId),
            Query.equal('learner_id', userId)
          ]),
          Query.orderAsc('date')
        ]
      );

      const sessionsData = await Promise.all(
        response.documents.map(async (session) => {
          // Fetch teacher and learner profiles manually
          let teacher = null;
          let learner = null;
          try {
            if (session.teacher_id) teacher = await databases.getDocument(DATABASE_ID, 'profiles', session.teacher_id);
            if (session.learner_id) learner = await databases.getDocument(DATABASE_ID, 'profiles', session.learner_id);
          } catch (e) {
            console.log('Error fetching associated profiles:', e);
          }
          return { ...session, id: session.$id, teacher, learner };
        })
      );

      setSessions(sessionsData || []);
    } catch (error) {
      console.log('Error fetching sessions:', error);
      Alert.alert('Error', 'Failed to fetch sessions');
    } finally {
      setLoading(false);
    }
  };

  const createSession = async () => {
    if (!skill.trim()) {
      Alert.alert('Error', 'Please enter a skill');
      return;
    }

    try {
      const sessionDate = new Date(selectedDate);
      sessionDate.setHours(selectedTime.getHours());
      sessionDate.setMinutes(selectedTime.getMinutes());

      await databases.createDocument(
        DATABASE_ID,
        'sessions',
        ID.unique(),
        {
          teacher_id: currentUser.$id,
          learner_id: '', // Blank or null
          skill: skill.trim(),
          date: sessionDate.toISOString(),
          status: 'proposed',
        }
      );

      Alert.alert('Success', 'Session created successfully!');
      setShowModal(false);
      setSkill('');
      fetchSessions(currentUser.$id);
    } catch (error) {
      Alert.alert('Error', 'Failed to create session');
    }
  };

  const updateSessionStatus = async (sessionId, newStatus) => {
    try {
      await databases.updateDocument(
        DATABASE_ID,
        'sessions',
        sessionId,
        { status: newStatus }
      );
      Alert.alert('Success', `Session ${newStatus}!`);

      if (newStatus === 'completed') {
        const session = sessions.find(s => s.$id === sessionId);
        if (session && session.learner_id === currentUser.$id) {
          setSelectedSession(session);
          setShowRatingModal(true);
        }
      }

      fetchSessions(currentUser.$id);
    } catch (error) {
      Alert.alert('Error', 'Failed to update session');
    }
  };

  const startSessionCall = (sessionId) => {
    const roomId = `SkillXchange-Session-${sessionId}`;
    const url = `https://meet.jit.si/${roomId}`;
    Linking.openURL(url);
  };

  const submitRating = async () => {
    if (!selectedSession) return;

    try {
      const result = await SessionService.submitRating(
        selectedSession.id,
        currentUser.$id, // rater
        selectedSession.teacher_id, // ratee
        userRating,
        ratingComment
      );

      if (result) {
        Alert.alert('Thank You!', 'Your rating has been submitted.');
        setShowRatingModal(false);
        setUserRating(5);
        setRatingComment('');
      } else {
        throw new Error('Failed to submit rating');
      }
    } catch (error) {
      Alert.alert('Error', 'Failed to submit rating. Please try again.');
    }
  };

  const handleDateChange = (event, date) => {
    if (date) setSelectedDate(date);
    setShowDatePicker(false);
  };

  const handleTimeChange = (event, time) => {
    if (time) setSelectedTime(time);
    setShowTimePicker(false);
  };

  const getStatusColor = (status) => {
    switch (status) {
      case 'proposed': return isDark ? 'rgba(251, 191, 36, 0.2)' : '#FEF08A';
      case 'accepted': return isDark ? 'rgba(52, 211, 153, 0.2)' : '#DCFCE7';
      case 'rejected': return isDark ? 'rgba(239, 68, 68, 0.2)' : '#FEE2E2';
      case 'completed': return isDark ? 'rgba(59, 130, 246, 0.2)' : '#DBEAFE';
      default: return isDark ? '#374151' : '#F3F4F6';
    }
  };

  const getStatusTextColor = (status) => {
    switch (status) {
      case 'proposed': return isDark ? '#FBBF24' : '#B45309';
      case 'accepted': return isDark ? '#34D399' : '#16A34A';
      case 'rejected': return isDark ? '#F87171' : '#DC2626';
      case 'completed': return isDark ? '#60A5FA' : '#1E40AF';
      default: return colors.textSecondary;
    }
  };

  // Dynamic Styles
  const dynamicStyles = {
    container: { backgroundColor: colors.background },
    text: { color: colors.text },
    textSecondary: { color: colors.textSecondary },
    card: { backgroundColor: colors.card, borderColor: colors.border },
    header: { backgroundColor: colors.card, borderBottomColor: colors.border },
    input: {
      backgroundColor: isDark ? '#374151' : '#F3F4F6',
      color: colors.text,
      borderColor: colors.border
    },
    pickerButton: { backgroundColor: isDark ? '#374151' : '#F3F4F6', borderColor: colors.border }
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
      <Header title="My Sessions 📅" />

      <View style={styles.tabContainer}>
        <Text style={[styles.subtitle, dynamicStyles.textSecondary]}>
          Upcoming & Past Meetings
        </Text>
      </View>

      <ScrollView contentContainerStyle={styles.scrollContent}>
        {sessions.length === 0 ? (
          <View style={styles.emptyContainer}>
            <Text style={{ fontSize: 40, marginBottom: 10 }}>🗓️</Text>
            <Text style={[styles.emptyText, dynamicStyles.text]}>No sessions yet</Text>
            <Text style={[styles.emptySubtext, dynamicStyles.textSecondary]}>
              Create your first session below!
            </Text>
          </View>
        ) : (
          sessions.map((session) => (
            <View key={session.$id} style={[styles.sessionCard, dynamicStyles.card]}>
              <View style={styles.cardHeader}>
                <Text style={[styles.skillName, dynamicStyles.text]}>{session.skill}</Text>
                <View style={[styles.statusBadge, { backgroundColor: getStatusColor(session.status) }]}>
                  <Text style={[styles.statusText, { color: getStatusTextColor(session.status) }]}>
                    {session.status.toUpperCase()}
                  </Text>
                </View>
              </View>

              <View style={styles.divider} />

              {session.date && (
                <View style={styles.infoRow}>
                  <Text style={[styles.iconLabel, dynamicStyles.textSecondary]}>🕒</Text>
                  <Text style={[styles.dateText, dynamicStyles.text]}>
                    {new Date(session.date).toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric' })}
                    {' at '}
                    {new Date(session.date).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                  </Text>
                </View>
              )}

              <View style={styles.roleSection}>
                <View style={styles.roleRow}>
                  <Text style={[styles.roleLabel, dynamicStyles.textSecondary]}>Role:</Text>
                  <Text style={[styles.roleValue, { color: colors.primary }]}>
                    {session.teacher_id === currentUser?.$id ? '🎓 Teacher' : '📚 Learner'}
                  </Text>
                </View>

                {session.teacher_id === currentUser?.$id && session.learner && (
                  <View style={styles.roleRow}>
                    <Text style={[styles.roleLabel, dynamicStyles.textSecondary]}>With:</Text>
                    <Text style={[styles.roleValue, dynamicStyles.text]}>{session.learner.name}</Text>
                  </View>
                )}
                {session.learner_id === currentUser?.$id && session.teacher && (
                  <View style={styles.roleRow}>
                    <Text style={[styles.roleLabel, dynamicStyles.textSecondary]}>With:</Text>
                    <Text style={[styles.roleValue, dynamicStyles.text]}>{session.teacher.name}</Text>
                  </View>
                )}
              </View>

              {session.status === 'proposed' && (
                <View style={styles.proposalContainer}>
                  <Text style={[styles.proposalText, { color: colors.textSecondary }]}>
                    {session.teacher_id === currentUser?.$id ? 'Waiting for learner to accept...' : 'Accept this session?'}
                  </Text>
                  {session.learner_id === currentUser?.$id && (
                    <View style={styles.actionButtons}>
                      <TouchableOpacity
                        style={[styles.button, styles.acceptButton, { backgroundColor: isDark ? 'rgba(52, 211, 153, 0.2)' : '#DCFCE7' }]}
                        onPress={() => updateSessionStatus(session.id, 'accepted')}
                      >
                        <Text style={[styles.buttonText, { color: isDark ? '#34D399' : '#166534' }]}>✓ Accept</Text>
                      </TouchableOpacity>
                      <TouchableOpacity
                        style={[styles.button, styles.rejectButton, { backgroundColor: isDark ? 'rgba(239, 68, 68, 0.2)' : '#FEE2E2' }]}
                        onPress={() => updateSessionStatus(session.id, 'rejected')}
                      >
                        <Text style={[styles.buttonText, { color: isDark ? '#F87171' : '#991B1B' }]}>✕ Reject</Text>
                      </TouchableOpacity>
                    </View>
                  )}
                </View>
              )}

              {session.status === 'accepted' && (
                <View style={{ gap: 10, marginTop: 15 }}>
                  <TouchableOpacity
                    style={[styles.button, { backgroundColor: colors.primary }]}
                    onPress={() => startSessionCall(session.$id)}
                  >
                    <Text style={[styles.buttonText, { color: '#fff' }]}>📹 Join Video Call</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={[styles.button, styles.completeButton, { backgroundColor: colors.secondary, marginTop: 0 }]}
                    onPress={() => updateSessionStatus(session.id, 'completed')}
                  >
                    <Text style={[styles.buttonText, { color: '#fff' }]}>Mark as Completed</Text>
                  </TouchableOpacity>
                </View>
              )}
            </View>
          ))
        )}
      </ScrollView>

      {/* FAB */}
      <TouchableOpacity
        style={[styles.fab, { backgroundColor: colors.primary }]}
        onPress={() => setShowModal(true)}
      >
        <Text style={styles.fabText}>+</Text>
      </TouchableOpacity>

      {/* Modal */}
      <Modal visible={showModal} transparent animationType="fade">
        <View style={styles.modalOverlay}>
          <View style={[styles.modalContent, dynamicStyles.card]}>
            <Text style={[styles.modalTitle, dynamicStyles.text]}>New Session</Text>

            <Text style={[styles.label, dynamicStyles.text]}>Topic / Skill</Text>
            <TextInput
              style={[styles.input, dynamicStyles.input]}
              placeholder="e.g. Guitar Lesson"
              value={skill}
              onChangeText={setSkill}
              placeholderTextColor={colors.textSecondary}
            />

            <View style={styles.dateTimeRow}>
              <View style={{ flex: 1, marginRight: 10 }}>
                <Text style={[styles.label, dynamicStyles.text]}>Date</Text>
                <TouchableOpacity
                  style={[styles.pickerButton, dynamicStyles.pickerButton]}
                  onPress={() => setShowDatePicker(true)}
                >
                  <Text style={[styles.pickerText, dynamicStyles.text]}>{selectedDate.toLocaleDateString()}</Text>
                </TouchableOpacity>
              </View>
              <View style={{ flex: 1 }}>
                <Text style={[styles.label, dynamicStyles.text]}>Time</Text>
                <TouchableOpacity
                  style={[styles.pickerButton, dynamicStyles.pickerButton]}
                  onPress={() => setShowTimePicker(true)}
                >
                  <Text style={[styles.pickerText, dynamicStyles.text]}>
                    {selectedTime.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                  </Text>
                </TouchableOpacity>
              </View>
            </View>

            {showDatePicker && (
              <DateTimePicker
                value={selectedDate}
                mode="date"
                display="spinner"
                onChange={handleDateChange}
              />
            )}

            {showTimePicker && (
              <DateTimePicker
                value={selectedTime}
                mode="time"
                display="spinner"
                onChange={handleTimeChange}
              />
            )}

            <View style={styles.modalActions}>
              <TouchableOpacity
                style={[styles.modalButton, { backgroundColor: colors.primary }]}
                onPress={createSession}
              >
                <Text style={styles.modalButtonText}>Create Schedule</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.modalButton, { backgroundColor: 'transparent', borderWidth: 1, borderColor: colors.border }]}
                onPress={() => setShowModal(false)}
              >
                <Text style={[styles.modalButtonText, { color: colors.textSecondary }]}>Cancel</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* Rating Modal */}
      <Modal visible={showRatingModal} transparent animationType="slide">
        <View style={styles.modalOverlay}>
          <View style={[styles.modalContent, dynamicStyles.card]}>
            <Text style={[styles.modalTitle, dynamicStyles.text]}>Rate your Session ⭐</Text>
            <Text style={[styles.modalSubtitle, dynamicStyles.textSecondary]}>
              How was your {selectedSession?.skill} session with {selectedSession?.teacher?.name}?
            </Text>

            <View style={styles.ratingStars}>
              {[1, 2, 3, 4, 5].map((star) => (
                <TouchableOpacity key={star} onPress={() => setUserRating(star)}>
                  <Text style={[styles.starIcon, { opacity: userRating >= star ? 1 : 0.3 }]}>⭐</Text>
                </TouchableOpacity>
              ))}
            </View>

            <TextInput
              style={[styles.input, dynamicStyles.input, { height: 80, textAlignVertical: 'top' }]}
              placeholder="Leave a comment (optional)"
              value={ratingComment}
              onChangeText={setRatingComment}
              placeholderTextColor={colors.textSecondary}
              multiline
            />

            <View style={styles.modalActions}>
              <TouchableOpacity
                style={[styles.modalButton, { backgroundColor: colors.primary }]}
                onPress={submitRating}
              >
                <Text style={styles.modalButtonText}>Submit Rating</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.modalButton, { backgroundColor: 'transparent' }]}
                onPress={() => setShowRatingModal(false)}
              >
                <Text style={[styles.modalButtonText, { color: colors.textSecondary }]}>Skip</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  center: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  containerSafe: { flex: 1 },
  header: { padding: 20, paddingBottom: 15, borderBottomWidth: 1, alignItems: 'center' },
  title: { fontSize: 22, fontWeight: '800' },
  subtitle: { fontSize: 14, marginTop: 4 },
  scrollContent: { padding: 20, paddingBottom: 100 },
  emptyContainer: { alignItems: 'center', justifyContent: 'center', marginTop: 50 },
  emptyText: { fontSize: 18, fontWeight: '700', marginBottom: 5 },
  emptySubtext: { fontSize: 14 },
  sessionCard: {
    borderRadius: 16, marginBottom: 16, padding: 16, borderWidth: 1,
    shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.05, shadowRadius: 4, elevation: 2
  },
  cardHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  skillName: { fontSize: 18, fontWeight: '700' },
  statusBadge: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 8 },
  statusText: { fontWeight: '700', fontSize: 11 },
  divider: { height: 1, backgroundColor: '#E5E7EB', marginVertical: 12, opacity: 0.5 },
  infoRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 10 },
  iconLabel: { fontSize: 16, marginRight: 8 },
  dateText: { fontSize: 15, fontWeight: '600' },
  roleSection: { flexDirection: 'row', flexWrap: 'wrap', gap: 15 },
  roleRow: { flexDirection: 'row', alignItems: 'center', marginRight: 10 },
  roleLabel: { fontSize: 13, marginRight: 5, fontWeight: '600' },
  roleValue: { fontSize: 13, fontWeight: '700' },
  actionButtons: { flexDirection: 'row', gap: 10, marginTop: 15 },
  button: { flex: 1, paddingVertical: 10, borderRadius: 10, alignItems: 'center' },
  buttonText: { fontWeight: '700', fontSize: 13 },
  completeButton: { marginTop: 15 },
  fab: {
    position: 'absolute', bottom: 30, right: 30, width: 56, height: 56, borderRadius: 28,
    justifyContent: 'center', alignItems: 'center', elevation: 5,
    shadowColor: '#000', shadowOffset: { width: 0, height: 3 }, shadowOpacity: 0.3, shadowRadius: 4
  },
  fabText: { fontSize: 30, color: '#fff', marginTop: -2 },
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'center', padding: 20 },
  modalContent: { borderRadius: 20, padding: 24 },
  modalTitle: { fontSize: 20, fontWeight: '800', marginBottom: 20 },
  label: { fontSize: 13, fontWeight: '700', marginBottom: 8 },
  input: { borderWidth: 1, borderRadius: 10, padding: 12, fontSize: 15, marginBottom: 15 },
  dateTimeRow: { flexDirection: 'row', marginBottom: 20 },
  pickerButton: { borderWidth: 1, borderRadius: 10, padding: 12, alignItems: 'center' },
  pickerText: { fontWeight: '600' },
  modalActions: { gap: 10 },
  modalButton: { paddingVertical: 14, borderRadius: 10, alignItems: 'center' },
  modalButtonText: { color: '#fff', fontWeight: '700', fontSize: 15 },
  proposalContainer: { marginTop: 10, padding: 10, borderRadius: 12, backgroundColor: 'rgba(0,0,0,0.02)' },
  proposalText: { fontSize: 13, fontStyle: 'italic', marginBottom: 10, textAlign: 'center' },
  modalSubtitle: { fontSize: 14, textAlign: 'center', marginBottom: 20 },
  ratingStars: { flexDirection: 'row', justifyContent: 'center', gap: 10, marginBottom: 25 },
  starIcon: { fontSize: 35 }
});
