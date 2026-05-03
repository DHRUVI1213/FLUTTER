import { Client, Account, Databases, Storage } from 'react-native-appwrite';

export const APPWRITE_ENDPOINT = 'https://fra.cloud.appwrite.io/v1';
export const APPWRITE_PROJECT_ID = '69a7cb010025a997d93f';

const client = new Client();

client
    .setEndpoint(APPWRITE_ENDPOINT)
    .setProject(APPWRITE_PROJECT_ID)
    .setPlatform('com.skillxchange.app');

export const account = new Account(client);
export const databases = new Databases(client);
export const storage = new Storage(client);
export { client };

// Database and Storage IDs
export const DATABASE_ID = '69a7cb2a0027a2743169';
export const AVATARS_BUCKET_ID = '69a7e92600228e2828c7';

// OTP Helper Methods
export const auth = {
    // Send OTP to phone
    sendPhoneOTP: async (userId, phone) => {
        return await account.createPhoneToken(userId, phone);
    },
    // Verify phone OTP and create session
    verifyPhoneOTP: async (userId, otp) => {
        return await account.updatePhoneSession(userId, otp);
    },
    // Send OTP to email
    sendEmailOTP: async (userId, email) => {
        return await account.createEmailToken(userId, email);
    },
    // Verify email OTP and create session
    verifyEmailOTP: async (userId, otp) => {
        return await account.updateEmailSession(userId, otp);
    }
};
