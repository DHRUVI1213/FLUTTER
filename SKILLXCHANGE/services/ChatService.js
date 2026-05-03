import 'react-native-url-polyfill/auto';
import { account, databases, client, DATABASE_ID } from './appwrite';
import { ID, Query } from 'react-native-appwrite';

export const ChatService = {
    // Create a match (start a conversation)
    createMatch: async (user1Id, user2Id) => {
        console.log('ChatService.createMatch called with:', { user1Id, user2Id });
        try {
            // Check if match already exists
            const existing = await databases.listDocuments(
                DATABASE_ID,
                'matches',
                [
                    Query.or([
                        Query.and([Query.equal('user1_id', user1Id), Query.equal('user2_id', user2Id)]),
                        Query.and([Query.equal('user1_id', user2Id), Query.equal('user2_id', user1Id)])
                    ])
                ]
            );

            if (existing.total > 0) {
                console.log('Match already exists:', existing.documents[0]);
                return existing.documents[0];
            }

            console.log('Creating new match...');
            const data = await databases.createDocument(
                DATABASE_ID,
                'matches',
                ID.unique(),
                { user1_id: user1Id, user2_id: user2Id, status: 'pending' }
            );

            return data;
        } catch (error) {
            console.error('Error creating match:', error);
            return null;
        }
    },

    // Get user's matches (conversations)
    getMatches: async (userId) => {
        try {
            // Fetch matches where user is user1 or user2.
            // In a production app, we would fetch the profile for each user1/user2 after getting the matches.
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

            return response.documents;
        } catch (error) {
            console.error('Error getting matches:', error);
            return [];
        }
    },

    // Send message
    sendMessage: async (matchId, senderId, text) => {
        try {
            await databases.createDocument(
                DATABASE_ID,
                'messages',
                ID.unique(),
                { match_id: matchId, sender_id: senderId, text }
            );
        } catch (error) {
            console.error('Error sending message:', error);
        }
    },

    // Subscribe to messages in a match
    subscribeToMessages: (matchId, callback) => {
        const unsubscribe = client.subscribe(
            `databases.${DATABASE_ID}.collections.messages.documents`,
            (response) => {
                if (
                    response.events.includes('databases.*.collections.*.documents.*.create') &&
                    response.payload.match_id === matchId
                ) {
                    callback(response.payload);
                }
            }
        );
        return { unsubscribe };
    },

    // Get messages
    getMessages: async (matchId) => {
        try {
            const response = await databases.listDocuments(
                DATABASE_ID,
                'messages',
                [
                    Query.equal('match_id', matchId),
                    Query.orderAsc('$createdAt')
                ]
            );
            return response.documents;
        } catch (error) {
            console.error('Error getting messages:', error);
            return [];
        }
    }
};
