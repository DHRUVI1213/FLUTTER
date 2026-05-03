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

import { account, databases, DATABASE_ID, auth as appwriteAuth } from '../services/appwrite';
import { ID } from 'react-native-appwrite';
import { useAuth } from '../context/AuthContext';

export default function SignupScreen({ navigation }) {
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [skillToLearn, setSkillToLearn] = useState('');
  const [skillToTeach, setSkillToTeach] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [verifyMethod, setVerifyMethod] = useState('email'); // 'phone' or 'email' default to email

  const { setUser, refreshUser } = useAuth();

  const handleSignup = async () => {
    if (
      !name || !email || !password || !confirmPassword ||
      !skillToLearn || !skillToTeach
    ) {
      Alert.alert('Error', 'All fields are required');
      return;
    }

    if (password !== confirmPassword) {
      Alert.alert('Error', 'Passwords do not match');
      return;
    }

    setLoading(true);
    try {
      // 1️⃣ Create Account
      const userAccount = await account.create(
        ID.unique(),
        email,
        password,
        name
      );

      // 2️⃣ Create Session immediately to allow DB writing
      try {
        await account.deleteSession('current');
      } catch (e) { }
      await account.createEmailPasswordSession(email, password);

      // 3️⃣ Create Profile Document in Appwrite Database
      await databases.createDocument(
        DATABASE_ID,
        'profiles',
        userAccount.$id,
        {
          name: name,
          email: email,
          skills_to_learn: [skillToLearn],
          skills_to_teach: [skillToTeach],
        }
      );

      // 4️⃣ Trigger OTP Verification
      try {
        if (verifyMethod === 'phone') {
          if (!phone) throw new Error('Phone number is required for phone verification');
          const token = await appwriteAuth.sendPhoneOTP(userAccount.$id, phone);
          Alert.alert('Success', 'Account created! Please verify your phone.');
          navigation.navigate('OTPScreen', {
            userId: token.userId,
            type: 'phone',
            contactInfo: phone
          });
        } else {
          const token = await appwriteAuth.sendEmailOTP(userAccount.$id, email);
          Alert.alert('Success', 'Account created! Please verify your email.');
          navigation.navigate('OTPScreen', {
            userId: token.userId,
            type: 'email',
            contactInfo: email
          });
        }
      } catch (otpErr) {
        console.log('OTP trigger error:', otpErr);
        Alert.alert('Partial Success', 'Account created, but failed to send verification code. Please login to try again.');
        navigation.navigate('LoginScreen');
      }

    } catch (error) {
      Alert.alert('Signup Error', error.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <KeyboardAvoidingView
      style={{ flex: 1 }}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      keyboardVerticalOffset={Platform.OS === 'ios' ? 0 : 20}
    >
      <ScrollView
        contentContainerStyle={styles.container}
        scrollEnabled={true}
        keyboardShouldPersistTaps="handled"
      >
        <View style={styles.box}>
          <Text style={styles.title}>Create Account</Text>

          <TextInput
            style={styles.input}
            placeholder="Name"
            onChangeText={setName}
            placeholderTextColor="#666"
            editable={!loading}
          />
          <TextInput
            style={styles.input}
            placeholder="Email"
            onChangeText={setEmail}
            keyboardType="email-address"
            placeholderTextColor="#666"
            autoCapitalize="none"
            editable={!loading}
          />
          <TextInput
            style={styles.input}
            placeholder="Phone (e.g. +1234567890)"
            onChangeText={setPhone}
            keyboardType="phone-pad"
            placeholderTextColor="#666"
            editable={!loading}
          />

          <View style={styles.methodSelector}>
            <Text style={[styles.label, { marginBottom: 10, alignSelf: 'flex-start' }]}>VERIFY VIA</Text>
            <View style={styles.tabContainer}>
              <TouchableOpacity
                onPress={() => setVerifyMethod('phone')}
                style={[styles.methodTab, verifyMethod === 'phone' && styles.activeTab]}
              >
                <Text style={[styles.methodText, verifyMethod === 'phone' && styles.activeTabText]}>Phone</Text>
              </TouchableOpacity>
              <TouchableOpacity
                onPress={() => setVerifyMethod('email')}
                style={[styles.methodTab, verifyMethod === 'email' && styles.activeTab]}
              >
                <Text style={[styles.methodText, verifyMethod === 'email' && styles.activeTabText]}>Email</Text>
              </TouchableOpacity>
            </View>
          </View>

          <View style={styles.passwordContainer}>
            <TextInput
              style={styles.passwordInput}
              placeholder="Password"
              secureTextEntry={!showPassword}
              onChangeText={setPassword}
              placeholderTextColor="#666"
              editable={!loading}
            />
            <TouchableOpacity style={styles.eyeIcon} onPress={() => setShowPassword(!showPassword)}>
              <Text style={styles.eyeText}>{showPassword ? '👁️' : '👁️‍🗨️'}</Text>
            </TouchableOpacity>
          </View>

          <View style={styles.passwordContainer}>
            <TextInput
              style={styles.passwordInput}
              placeholder="Confirm Password"
              secureTextEntry={!showPassword}
              onChangeText={setConfirmPassword}
              placeholderTextColor="#666"
              editable={!loading}
            />
            <TouchableOpacity style={styles.eyeIcon} onPress={() => setShowPassword(!showPassword)}>
              <Text style={styles.eyeText}>{showPassword ? '👁️' : '👁️‍🗨️'}</Text>
            </TouchableOpacity>
          </View>

          <TextInput
            style={styles.input}
            placeholder="Skill to Learn"
            onChangeText={setSkillToLearn}
            placeholderTextColor="#666"
            editable={!loading}
          />
          <TextInput
            style={styles.input}
            placeholder="Skill to Teach"
            onChangeText={setSkillToTeach}
            placeholderTextColor="#666"
            editable={!loading}
          />

          <TouchableOpacity
            style={[styles.button, loading && { opacity: 0.7 }]}
            onPress={handleSignup}
            disabled={loading}
          >
            {loading ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <Text style={styles.buttonText}>Sign Up</Text>
            )}
          </TouchableOpacity>

          <TouchableOpacity onPress={() => navigation.navigate('LoginScreen')} disabled={loading}>
            <Text style={styles.link}>Already have an account? Login</Text>
          </TouchableOpacity>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flexGrow: 1,
    justifyContent: 'flex-start',
    padding: 20,
    paddingTop: 40,
    paddingBottom: 60,
    backgroundColor: '#ffffff',
  },
  box: {
    backgroundColor: '#ffffff',
    padding: 20,
    borderRadius: 12,
    marginBottom: 40,
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    marginBottom: 25,
    textAlign: 'center',
    color: '#000000',
  },
  input: {
    borderWidth: 1,
    borderColor: '#000000',
    borderRadius: 8,
    padding: 12,
    marginBottom: 15,
    fontSize: 16,
    color: '#000000',
  },
  passwordContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#000000',
    borderRadius: 8,
    marginBottom: 15,
    paddingRight: 10,
  },
  passwordInput: {
    flex: 1,
    padding: 12,
    fontSize: 16,
    color: '#000000',
  },
  eyeIcon: {
    padding: 8,
  },
  eyeText: {
    fontSize: 18,
  },
  button: {
    backgroundColor: '#000000',
    padding: 14,
    borderRadius: 8,
    marginTop: 15,
    marginBottom: 15,
  },
  buttonText: {
    color: '#ffffff',
    textAlign: 'center',
    fontWeight: 'bold',
    fontSize: 16,
  },
  link: {
    color: '#000000',
    textAlign: 'center',
    marginTop: 12,
    fontSize: 14,
    textDecorationLine: 'underline',
  },
  label: { fontSize: 11, fontWeight: '800', letterSpacing: 1 },
  methodSelector: {
    marginBottom: 20,
    width: '100%'
  },
  tabContainer: {
    flexDirection: 'row',
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
