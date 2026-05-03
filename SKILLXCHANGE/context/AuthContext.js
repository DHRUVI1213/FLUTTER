import React, { createContext, useState, useContext, useEffect } from 'react';
import { account } from '../services/appwrite';
import { SkillService } from '../services/SkillService';

const AuthContext = createContext();

export const AuthProvider = ({ children }) => {
    const [user, setUser] = useState(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        checkSession();
    }, []);

    const checkSession = async () => {
        try {
            setLoading(true);
            const session = await account.get();

            // Verify profile exists
            const profile = await SkillService.getUserProfile(session.$id);

            if (!profile) {
                // Ghost session, delete it
                try {
                    await account.deleteSession('current');
                } catch (e) { }
                setUser(null);
            } else {
                setUser(session);
            }
        } catch (error) {
            setUser(null);
        } finally {
            setLoading(false);
        }
    };

    const login = async (param1, param2) => {
        try {
            await account.deleteSession('current');
        } catch (e) { }

        if (typeof param1 === 'object' && param1.$id) {
            // Direct session login (from OTP)
            // No need to create a session, just check it
            await refreshUser();
        } else {
            // Email/Password login
            await account.createEmailPasswordSession(param1, param2);
            await checkSession();
        }
    };

    const logout = async () => {
        await account.deleteSession('current');
        setUser(null);
    };

    const refreshUser = async () => {
        await checkSession();
    };

    return (
        <AuthContext.Provider value={{ user, loading, login, logout, refreshUser, setUser }}>
            {children}
        </AuthContext.Provider>
    );
};

export const useAuth = () => useContext(AuthContext);
