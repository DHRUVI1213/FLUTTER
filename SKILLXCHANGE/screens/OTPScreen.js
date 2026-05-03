import React, { useState, useEffect } from 'react';
import {
    View,
    Text,
    StyleSheet,
    TextInput,
    TouchableOpacity,
    ActivityIndicator,
    Alert,
    KeyboardAvoidingView,
    Platform,
    StatusBar
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useTheme } from '../context/ThemeContext';
import { auth } from '../services/appwrite';
import { useAuth } from '../context/AuthContext';

export default function OTPScreen({ route, navigation }) {
    const { colors, isDark } = useTheme();
    const { userId, type, contactInfo } = route.params; // type: 'phone' or 'email'
    const [otp, setOtp] = useState('');
    const [loading, setLoading] = useState(false);
    const [timer, setTimer] = useState(60);
    const { login } = useAuth();

    useEffect(() => {
        const interval = setInterval(() => {
            setTimer((prev) => (prev > 0 ? prev - 1 : 0));
        }, 1000);
        return () => clearInterval(interval);
    }, []);

    const handleVerify = async () => {
        if (otp.length !== 6) {
            Alert.alert('Error', 'Please enter a 6-digit code');
            return;
        }

        setLoading(true);
        try {
            let session;
            if (type === 'phone') {
                session = await auth.verifyPhoneOTP(userId, otp);
            } else {
                session = await auth.verifyEmailOTP(userId, otp);
            }

            if (session) {
                // Login via AuthContext
                await login(session);
                // AuthContext usually handles navigation via state change,
                // but we can also navigate home if needed.
            }
        } catch (error) {
            console.error('OTP Verification Error:', error);
            Alert.alert('Error', 'Invalid OTP. Please try again.');
        } finally {
            setLoading(false);
        }
    };

    const handleResend = async () => {
        if (timer > 0) return;

        setLoading(true);
        try {
            if (type === 'phone') {
                await auth.sendPhoneOTP(userId, contactInfo);
            } else {
                await auth.sendEmailOTP(userId, contactInfo);
            }
            setTimer(60);
            Alert.alert('Success', 'Verification code resent!');
        } catch (error) {
            Alert.alert('Error', 'Failed to resend code');
        } finally {
            setLoading(false);
        }
    };

    return (
        <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]}>
            <StatusBar barStyle={isDark ? 'light-content' : 'dark-content'} />

            <KeyboardAvoidingView
                behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
                style={styles.keyboardView}
            >
                <TouchableOpacity
                    style={styles.backButton}
                    onPress={() => navigation.goBack()}
                >
                    <Text style={[styles.backText, { color: colors.primary }]}>← Back</Text>
                </TouchableOpacity>

                <View style={styles.header}>
                    <Text style={[styles.title, { color: colors.text }]}>Verify {type === 'phone' ? 'Phone' : 'Email'}</Text>
                    <Text style={[styles.subtitle, { color: colors.textSecondary }]}>
                        Enter the 6-digit code we sent to: {'\n'}
                        <Text style={{ color: colors.primary, fontWeight: '700' }}>{contactInfo}</Text>
                    </Text>
                </View>

                <View style={styles.inputContainer}>
                    <TextInput
                        style={[
                            styles.otpInput,
                            {
                                backgroundColor: isDark ? '#374151' : '#F3F4F6',
                                color: colors.text,
                                borderColor: colors.border
                            }
                        ]}
                        placeholder="000000"
                        placeholderTextColor={colors.textSecondary}
                        keyboardType="number-pad"
                        maxLength={6}
                        value={otp}
                        onChangeText={setOtp}
                        autoFocus
                    />
                </View>

                <TouchableOpacity
                    style={[styles.verifyButton, { backgroundColor: colors.primary }, loading && { opacity: 0.7 }]}
                    onPress={handleVerify}
                    disabled={loading}
                >
                    {loading ? (
                        <ActivityIndicator color="#FFF" />
                    ) : (
                        <Text style={styles.verifyButtonText}>Verify & Continue</Text>
                    )}
                </TouchableOpacity>

                <View style={styles.resendContainer}>
                    <Text style={[styles.resendText, { color: colors.textSecondary }]}>
                        Didn't receive the code?
                    </Text>
                    <TouchableOpacity onPress={handleResend} disabled={timer > 0}>
                        <Text style={[
                            styles.resendLink,
                            { color: timer > 0 ? colors.textSecondary : colors.primary }
                        ]}>
                            {timer > 0 ? `Resend in ${timer}s` : 'Resend Code'}
                        </Text>
                    </TouchableOpacity>
                </View>
            </KeyboardAvoidingView>
        </SafeAreaView>
    );
}

const styles = StyleSheet.create({
    container: { flex: 1 },
    keyboardView: { flex: 1, padding: 25 },
    backButton: { marginBottom: 30 },
    backText: { fontSize: 16, fontWeight: '600' },
    header: { marginBottom: 40 },
    title: { fontSize: 28, fontWeight: '800', marginBottom: 12 },
    subtitle: { fontSize: 16, lineHeight: 24 },
    inputContainer: { marginBottom: 30 },
    otpInput: {
        fontSize: 32,
        fontWeight: '700',
        textAlign: 'center',
        paddingVertical: 15,
        borderRadius: 16,
        borderWidth: 1,
        letterSpacing: 8
    },
    verifyButton: {
        borderRadius: 16,
        paddingVertical: 18,
        alignItems: 'center',
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.1,
        shadowRadius: 8,
        elevation: 4
    },
    verifyButtonText: { color: '#FFF', fontSize: 18, fontWeight: '700' },
    resendContainer: {
        marginTop: 30,
        alignItems: 'center',
        flexDirection: 'row',
        justifyContent: 'center'
    },
    resendText: { fontSize: 14, marginRight: 5 },
    resendLink: { fontSize: 14, fontWeight: '700' }
});
