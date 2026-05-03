import { databases, DATABASE_ID } from './appwrite';
import { ID, Query } from 'react-native-appwrite';

export const SessionService = {
    createSession: async (teacherId, learnerId, skill, date, duration) => {
        try {
            const data = await databases.createDocument(
                DATABASE_ID,
                'sessions',
                ID.unique(),
                {
                    teacher_id: teacherId,
                    learner_id: learnerId,
                    skill,
                    date,
                    duration: duration || 60, // Default 60 mins
                    status: 'proposed'
                }
            );
            return data;
        } catch (error) {
            console.error('Error creating session:', error);
            return null;
        }
    },

    getSessions: async (userId) => {
        try {
            // Appwrite doesn't support joins like Supabase.
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
            return response.documents;
        } catch (error) {
            console.error('Error fetching sessions:', error);
            return [];
        }
    },

    updateSessionStatus: async (sessionId, status) => {
        try {
            const data = await databases.updateDocument(
                DATABASE_ID,
                'sessions',
                sessionId,
                { status }
            );
            return data;
        } catch (error) {
            console.error('Error updating session:', error);
            return null;
        }
    },

    submitRating: async (sessionId, raterId, targetId, rating, comment) => {
        try {
            const data = await databases.createDocument(
                DATABASE_ID,
                'ratings',
                ID.unique(),
                {
                    session_id: sessionId,
                    ratee_id: targetId,
                    rated_id: targetId,
                    rating,
                    comment
                }
            );
            return data;
        } catch (error) {
            console.error('Error submitting rating:', error);
            return null;
        }
    },

    getProfileRatings: async (userId) => {
        try {
            const response = await databases.listDocuments(
                DATABASE_ID,
                'ratings',
                [
                    Query.or([
                        Query.equal('ratee_id', userId),
                        Query.equal('rated_id', userId)
                    ])
                ]
            );

            const data = response.documents;
            if (!data || data.length === 0) return { average: 0, count: 0 };

            const sum = data.reduce((acc, curr) => acc + curr.rating, 0);
            return {
                average: (sum / data.length).toFixed(1),
                count: data.length
            };
        } catch (error) {
            console.error('Error fetching ratings:', error);
            return { average: 0, count: 0 };
        }
    }
};
