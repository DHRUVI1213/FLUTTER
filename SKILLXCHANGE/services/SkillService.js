import { databases, DATABASE_ID } from './appwrite';
import { Query } from 'react-native-appwrite';

export const SkillService = {
    // Get all users who teach a skill the current user wants to learn
    getMatches: async (userSkillsToLearn) => {
        try {
            if (!userSkillsToLearn || userSkillsToLearn.length === 0) return [];

            // Appwrite: Query.contains matches any element in the array
            const response = await databases.listDocuments(
                DATABASE_ID,
                'profiles',
                [
                    Query.contains('skills_to_teach', userSkillsToLearn)
                ]
            );

            return response.documents;
        } catch (error) {
            console.error('Error fetching matches:', error);
            return [];
        }
    },

    // Get current user profile
    getUserProfile: async (userId) => {
        try {
            const data = await databases.getDocument(
                DATABASE_ID,
                'profiles',
                userId
            );
            return data;
        } catch (error) {
            // Only log if it's NOT a "not found" error
            if (error.code !== 404) {
                console.error('Error fetching profile:', error);
            }
            return null;
        }
    },

    // Update user skills
    updateSkills: async (userId, skillsToLearn, skillsToTeach) => {
        try {
            await databases.updateDocument(
                DATABASE_ID,
                'profiles',
                userId,
                {
                    skills_to_learn: skillsToLearn,
                    skills_to_teach: skillsToTeach
                }
            );
            return true;
        } catch (error) {
            console.error('Error updating skills:', error);
            return false;
        }
    }
};
