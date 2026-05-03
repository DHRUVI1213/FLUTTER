import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  ActivityIndicator,
  TouchableOpacity,
  ScrollView,
  Alert,
  StatusBar,
  Image
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { account, databases, DATABASE_ID } from '../services/appwrite';
import { Query } from 'react-native-appwrite';
import { SkillService } from '../services/SkillService';
import { SessionService } from '../services/SessionService';
import { useTheme } from '../context/ThemeContext';
import Header from '../components/Header';

export default function MatchScreen({ navigation }) {
  const { colors, isDark } = useTheme();
  const [matches, setMatches] = useState([]);
  const [loading, setLoading] = useState(true);
  const [currentUserData, setCurrentUserData] = useState(null);
  const [currentUserId, setCurrentUserId] = useState(null);

  useEffect(() => {
    const initMatches = async () => {
      try {
        const session = await account.get();
        if (session) {
          setCurrentUserId(session.$id);
          fetchMatches(session.$id);
        } else {
          setLoading(false);
        }
      } catch (error) {
        setLoading(false);
      }
    };

    initMatches();
  }, []);

  const fetchMatches = async (userId) => {
    try {
      const currentUserInfo = await SkillService.getUserProfile(userId);
      setCurrentUserData(currentUserInfo);

      const response = await databases.listDocuments(
        DATABASE_ID,
        'profiles',
        [Query.notEqual('$id', userId)]
      );

      const allUsers = response.documents;

      // Filter matches based on common skills
      const filteredMatches = allUsers.filter((user) => {
        const userTeaches = user.skills_to_teach || [];
        const userLearns = user.skills_to_learn || [];
        const myTeaches = currentUserInfo?.skills_to_teach || [];
        const myLearns = currentUserInfo?.skills_to_learn || [];

        const teachesWhatIWant = userTeaches.some((s) => myLearns.includes(s));
        const learnsWhatITeach = myTeaches.some((s) => userLearns.includes(s));

        return teachesWhatIWant || learnsWhatITeach;
      });

      // Fetch ratings for matches
      const matchesWithRatings = await Promise.all(filteredMatches.map(async (user) => {
        const ratingData = await SessionService.getProfileRatings(user.$id);
        return { ...user, ratingData };
      }));

      setMatches(matchesWithRatings);
    } catch (error) {
      console.log('Error fetching matches:', error);
      Alert.alert('Error', 'Failed to fetch matches');
    } finally {
      setLoading(false);
    }
  };

  const getCommonSkills = (user) => {
    const userTeaches = user.skills_to_teach || [];
    const currentUserLearns = currentUserData?.skills_to_learn || [];
    return userTeaches.filter((skill) => currentUserLearns.includes(skill));
  };

  const handleStartChat = async (matchedUser) => {
    navigation.navigate('Chat', {
      userId: matchedUser.$id,
      userName: matchedUser.name,
    });
  };

  // Dynamic Styles
  const dynamicStyles = {
    container: { backgroundColor: colors.background },
    text: { color: colors.text },
    textSecondary: { color: colors.textSecondary },
    card: { backgroundColor: colors.card, borderColor: colors.border },
    header: { backgroundColor: colors.card, borderBottomColor: colors.border }
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
        title="Skill Matches 🎯"
        rightComponent={
          <View style={{ marginRight: 5 }}>
            <Text style={[styles.headerSubtitle, dynamicStyles.textSecondary]}>
              Found {matches.length} {matches.length === 1 ? 'person' : 'people'}
            </Text>
          </View>
        }
      />

      {matches.length === 0 ? (
        <View style={[styles.center, { backgroundColor: colors.background, flex: 1 }]}>
          <View style={[styles.emptyIconContainer, { backgroundColor: colors.tint }]}>
            <Text style={{ fontSize: 40 }}>🧩</Text>
          </View>
          <Text style={[styles.emptyText, dynamicStyles.text]}>No matches yet</Text>
          <Text style={[styles.emptySubtext, dynamicStyles.textSecondary]}>
            Add more skills to your profile to find your perfect match!
          </Text>
        </View>
      ) : (
        <>
          <View style={{ paddingHorizontal: 20, paddingTop: 10 }}>
            <Text style={[styles.sectionTitle, dynamicStyles.text]}>Skill Matches 🎯</Text>
          </View>

          <FlatList
            data={matches}
            keyExtractor={(item) => item.$id}
            contentContainerStyle={styles.listContent}
            renderItem={({ item }) => {
              const commonSkills = getCommonSkills(item);
              return (
                <View style={[styles.card, dynamicStyles.card]}>
                  {/* Header with name and match badge */}
                  <View style={styles.cardHeader}>
                    <View style={styles.userInfo}>
                      {item.avatar_url ? (
                        <Image source={{ uri: item.avatar_url }} style={styles.avatar} />
                      ) : (
                        <View style={[styles.avatarPlaceholder, { backgroundColor: colors.tint }]}>
                          <Text style={[styles.avatarText, { color: colors.primary }]}>
                            {item.name?.charAt(0).toUpperCase()}
                          </Text>
                        </View>
                      )}
                      <View style={{ flex: 1 }}>
                        <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                          <Text style={[styles.name, dynamicStyles.text]}>{item.name}</Text>
                          {item.ratingData?.count > 0 && (
                            <View style={styles.ratingBadge}>
                              <Text style={styles.ratingStars}>⭐ {item.ratingData.average}</Text>
                              <Text style={styles.ratingCount}>({item.ratingData.count})</Text>
                            </View>
                          )}
                        </View>
                        <Text style={[styles.email, dynamicStyles.textSecondary]}>{item.email}</Text>
                      </View>
                    </View>
                    <View style={styles.matchBadge}>
                      <Text style={styles.matchBadgeText}>✓ Match</Text>
                    </View>
                  </View>

                  {/* Info Rows */}
                  <View style={styles.divider} />

                  <View style={styles.infoRow}>
                    <Text style={[styles.label, { color: colors.primary }]}>CAN TEACH YOU</Text>
                    <View style={styles.skillsContainer}>
                      {commonSkills.length > 0 ? commonSkills.map((skill, idx) => (
                        <View key={idx} style={[styles.skillBadge, { backgroundColor: isDark ? 'rgba(52, 211, 153, 0.2)' : '#DCFCE7' }]}>
                          <Text style={[styles.skillBadgeText, { color: isDark ? '#34D399' : '#166534' }]}>{skill}</Text>
                        </View>
                      )) : (
                        <Text style={[styles.noSkillText, dynamicStyles.textSecondary]}>None</Text>
                      )}
                    </View>
                  </View>

                  <View style={styles.infoRow}>
                    <Text style={[styles.label, { color: colors.secondary }]}>THEY ALSO TEACH</Text>
                    <View style={styles.skillsContainer}>
                      {(item.skills_to_teach || []).filter(s => !commonSkills.includes(s)).map((skill, idx) => (
                        <View key={idx} style={[styles.skillTag, { backgroundColor: isDark ? 'rgba(99, 102, 241, 0.2)' : '#E0E7FF' }]}>
                          <Text style={[styles.skillTagText, { color: isDark ? '#818CF8' : '#4338CA' }]}>{skill}</Text>
                        </View>
                      ))}
                      {(item.skills_to_teach || []).length === 0 && (
                        <Text style={[styles.noSkillText, dynamicStyles.textSecondary]}>No other skills</Text>
                      )}
                    </View>
                  </View>

                  {/* Chat Button */}
                  <TouchableOpacity
                    style={[styles.chatButton, { backgroundColor: colors.primary }]}
                    onPress={() => handleStartChat(item)}
                  >
                    <Text style={styles.chatButtonText}>💬 Start Chat</Text>
                  </TouchableOpacity>
                </View>
              );
            }}
          />
        </>
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  center: { flex: 1, justifyContent: 'center', alignItems: 'center', paddingHorizontal: 30 },
  containerSafe: { flex: 1 },
  header: {
    padding: 20, paddingBottom: 15, borderBottomWidth: 1, alignItems: 'center'
  },
  headerTitle: { fontSize: 22, fontWeight: '800' },
  headerSubtitle: { fontSize: 14, marginTop: 4, fontWeight: '500' },
  sectionTitle: { fontSize: 20, fontWeight: 'bold', marginBottom: 5 },
  emptyIconContainer: {
    width: 80, height: 80, borderRadius: 40, justifyContent: 'center', alignItems: 'center', marginBottom: 20
  },
  emptyText: { fontSize: 20, fontWeight: '700', marginBottom: 10 },
  emptySubtext: { fontSize: 15, textAlign: 'center' },
  listContent: { padding: 15 },
  card: {
    borderRadius: 16, marginBottom: 16, padding: 16, borderWidth: 1,
    shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.05, shadowRadius: 4, elevation: 2
  },
  cardHeader: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start',
  },
  userInfo: { flexDirection: 'row', alignItems: 'center', flex: 1, marginRight: 10 },
  avatar: { width: 48, height: 48, borderRadius: 24, marginRight: 12 },
  avatarPlaceholder: {
    width: 48, height: 48, borderRadius: 24, justifyContent: 'center', alignItems: 'center', marginRight: 12
  },
  avatarText: { fontSize: 20, fontWeight: '700' },
  name: { fontSize: 17, fontWeight: '700' },
  email: { fontSize: 13, marginTop: 2 },
  matchBadge: {
    backgroundColor: '#DCFCE7', paddingHorizontal: 10, paddingVertical: 5, borderRadius: 12
  },
  matchBadgeText: { color: '#16A34A', fontWeight: '700', fontSize: 11 },
  divider: { height: 1, backgroundColor: '#E5E7EB', marginVertical: 12, opacity: 0.5 },
  infoRow: { marginBottom: 12 },
  label: { fontSize: 11, fontWeight: '800', letterSpacing: 0.5, marginBottom: 8, textTransform: 'uppercase' },
  skillsContainer: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  skillBadge: { paddingHorizontal: 10, paddingVertical: 5, borderRadius: 10 },
  skillBadgeText: { fontWeight: '700', fontSize: 12 },
  skillTag: { paddingHorizontal: 10, paddingVertical: 5, borderRadius: 10 },
  skillTagText: { fontWeight: '600', fontSize: 12 },
  noSkillText: { fontSize: 13, fontStyle: 'italic' },
  chatButton: {
    paddingVertical: 12, borderRadius: 12, alignItems: 'center', marginTop: 8
  },
  chatButtonText: { color: '#fff', fontWeight: '700', fontSize: 14 },
  ratingBadge: { flexDirection: 'row', alignItems: 'center', marginLeft: 8, backgroundColor: 'rgba(251, 191, 36, 0.1)', paddingHorizontal: 6, paddingVertical: 2, borderRadius: 6 },
  ratingStars: { fontSize: 12, fontWeight: '700', color: '#B45309' },
  ratingCount: { fontSize: 10, color: '#B45309', marginLeft: 2, opacity: 0.7 }
});
