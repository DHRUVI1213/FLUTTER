import React, { useState } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  Alert,
  StyleSheet,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  ActivityIndicator,
} from 'react-native';

import { useAuth } from '../context/AuthContext';
import { auth as appwriteAuth } from '../services/appwrite';
import { ID } from 'react-native-appwrite';

export default function LoginScreen({ navigation }) {
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [password, setPassword] = useState('');
  const [loginMethod, setLoginMethod] = useState('email_otp'); // 'email' (password), 'email_otp', or 'phone'
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const { login } = useAuth();

  const handleLogin = async () => {
    if (loginMethod === 'email') {
      // Password Login
      if (!email || !password) {
        Alert.alert('Error', 'Please fill in all fields');
        return;
      }
      setLoading(true);
      try {
        await login(email, password);
      } catch (error) {
        console.log('Login Error:', error);
        Alert.alert('Login Error', error.message);
      } finally {
        setLoading(false);
      }
    } else if (loginMethod === 'email_otp') {
      // Email OTP Login
      if (!email) {
        Alert.alert('Error', 'Please enter your email');
        return;
      }
      setLoading(true);
      try {
        const token = await appwriteAuth.sendEmailOTP(ID.unique(), email);
        navigation.navigate('OTPScreen', {
          userId: token.userId,
          type: 'email',
          contactInfo: email
        });
      } catch (error) {
        console.log('Email OTP Login Error:', error);
        Alert.alert('Error', 'Failed to send OTP to email. Check if email is correct.');
      } finally {
        setLoading(false);
      }
    } else {
      // Phone OTP Login
      if (!phone) {
        Alert.alert('Error', 'Please enter your phone number (+ sign included)');
        return;
      }
      setLoading(true);
      try {
        // Appwrite requires a unique ID for the user if it's a new login, 
        // or the existing userId if we know it. 
        // For simple phone login, we use ID.unique() if it's a first time,
        // but typically Phone login is for existing users or direct signup.
        const token = await appwriteAuth.sendPhoneOTP(ID.unique(), phone);
        navigation.navigate('OTPScreen', {
          userId: token.userId,
          type: 'phone',
          contactInfo: phone
        });
      } catch (error) {
        console.log('Phone Login Error:', error);
        Alert.alert('Error', 'Failed to send OTP. Check if phone is correctly formatted (e.g., +1234567890)');
      } finally {
        setLoading(false);
      }
    }
  };

  return (
    <KeyboardAvoidingView
      style={{ flex: 1 }}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      keyboardVerticalOffset={Platform.OS === 'ios' ? 0 : 20}
    >
      <ScrollView contentContainerStyle={styles.container}>
        <View style={styles.box}>
          <Text style={styles.title}>Welcome Back</Text>

          <View style={styles.methodSelector}>
            <TouchableOpacity
              onPress={() => setLoginMethod('email_otp')}
              style={[styles.methodTab, loginMethod === 'email_otp' && styles.activeTab]}
            >
              <Text style={[styles.methodText, loginMethod === 'email_otp' && styles.activeTabText]}>Email OTP</Text>
            </TouchableOpacity>
            <TouchableOpacity
              onPress={() => setLoginMethod('email')}
              style={[styles.methodTab, loginMethod === 'email' && styles.activeTab]}
            >
              <Text style={[styles.methodText, loginMethod === 'email' && styles.activeTabText]}>Password</Text>
            </TouchableOpacity>
            <TouchableOpacity
              onPress={() => setLoginMethod('phone')}
              style={[styles.methodTab, loginMethod === 'phone' && styles.activeTab]}
            >
              <Text style={[styles.methodText, loginMethod === 'phone' && styles.activeTabText]}>Phone</Text>
            </TouchableOpacity>
          </View>

          {(loginMethod === 'email' || loginMethod === 'email_otp') ? (
            <>
              <TextInput
                style={styles.input}
                placeholder="Email"
                placeholderTextColor="#666"
                onChangeText={setEmail}
                value={email}
                editable={!loading}
                autoCapitalize="none"
              />
              {loginMethod === 'email' && (
                <>
                  <TextInput
                    style={styles.input}
                    placeholder="Password"
                    placeholderTextColor="#666"
                    secureTextEntry={!showPassword}
                    onChangeText={setPassword}
                    value={password}
                    editable={!loading}
                  />
                  <TouchableOpacity onPress={() => setShowPassword(!showPassword)} disabled={loading}>
                    <Text style={styles.link}>
                      {showPassword ? 'Hide Password' : 'Show Password'}
                    </Text>
                  </TouchableOpacity>
                </>
              )}
            </>
          ) : (
            <TextInput
              style={styles.input}
              placeholder="Phone (e.g., +1234567890)"
              placeholderTextColor="#666"
              onChangeText={setPhone}
              value={phone}
              editable={!loading}
              keyboardType="phone-pad"
            />
          )}

          <TouchableOpacity
            style={[styles.button, loading && styles.buttonDisabled]}
            onPress={handleLogin}
            disabled={loading}
          >
            {loading ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <Text style={styles.buttonText}>
                {loginMethod === 'email' ? 'Login' : 'Send OTP'}
              </Text>
            )}
          </TouchableOpacity>

          <TouchableOpacity onPress={() => navigation.navigate('SignupScreen')} disabled={loading}>
            <Text style={styles.link}>Don't have an account? Sign Up</Text>
          </TouchableOpacity>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flexGrow: 1,
    justifyContent: 'center',
    padding: 20,
    backgroundColor: '#ffffff',
  },
  box: {
    backgroundColor: '#ffffff',
    padding: 20,
    borderRadius: 12,
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    marginBottom: 20,
    textAlign: 'center',
    color: '#000000',
  },
  input: {
    borderWidth: 1,
    borderColor: '#000000',
    borderRadius: 8,
    padding: 10,
    marginBottom: 12,
    color: '#000000',
  },
  button: {
    backgroundColor: '#000000',
    padding: 14,
    borderRadius: 8,
    marginTop: 10,
  },
  buttonDisabled: {
    opacity: 0.6,
  },
  buttonText: {
    color: '#ffffff',
    textAlign: 'center',
    fontWeight: 'bold',
  },
  link: {
    color: '#000000',
    textAlign: 'center',
    marginTop: 10,
    textDecorationLine: 'underline',
  },
  methodSelector: {
    flexDirection: 'row',
    marginBottom: 20,
    backgroundColor: '#F3F4F6',
    borderRadius: 8,
    padding: 4
  },
  methodTab: {
    flex: 1,
    paddingVertical: 8,
    alignItems: 'center',
    borderRadius: 6
  },
  activeTab: {
    backgroundColor: '#ffffff',
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2
  },
  methodText: {
    fontWeight: '600',
    color: '#666'
  },
  activeTabText: {
    color: '#000'
  }
});
