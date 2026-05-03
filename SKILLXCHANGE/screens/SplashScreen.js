import React, { useEffect } from 'react';
import { View, Text, StyleSheet, Animated, StatusBar, ActivityIndicator } from 'react-native';
import { useTheme } from '../context/ThemeContext';

export default function SplashScreen() {
    const { colors, isDark } = useTheme();
    const fadeAnim = React.useRef(new Animated.Value(0)).current;
    const scaleAnim = React.useRef(new Animated.Value(0.8)).current;

    useEffect(() => {
        fadeAnim.setValue(0);
        scaleAnim.setValue(0.8);

        Animated.parallel([
            Animated.timing(fadeAnim, {
                toValue: 1,
                duration: 1000,
                useNativeDriver: true,
            }),
            Animated.spring(scaleAnim, {
                toValue: 1,
                friction: 4,
                useNativeDriver: true,
            }),
        ]).start();
    }, []);

    return (
        <View style={[styles.container, { backgroundColor: colors.background }]}>
            <StatusBar hidden />
            <Animated.View style={{ opacity: fadeAnim, transform: [{ scale: scaleAnim }], alignItems: 'center' }}>
                <View style={styles.logoWrapper}>
                    <View style={[styles.logoShape, { backgroundColor: colors.primary, borderColor: isDark ? '#fff' : '#fff', borderWidth: 2 }]} />
                    <View style={[styles.logoShape, { backgroundColor: colors.secondary, position: 'absolute', top: 15, left: 15, opacity: 0.9, borderColor: isDark ? '#fff' : '#fff', borderWidth: 2 }]} />
                    <View style={styles.logoOverlay}>
                        <Text style={styles.logoIcon}>⚡</Text>
                    </View>
                </View>

                <Text style={[styles.title, { color: colors.text }]}>SkillXchange</Text>
                <View style={[styles.taglineReveal, { backgroundColor: colors.primary + '20' }]}>
                    <Text style={[styles.subtitle, { color: colors.primary }]}>
                        Master • Mentor • Connect
                    </Text>
                </View>
            </Animated.View>

            <View style={styles.loaderContainer}>
                <ActivityIndicator color={colors.primary} size="large" />
                <Text style={[styles.loadingText, { color: colors.textSecondary }]}>Setting up your experience...</Text>
            </View>
        </View>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
    },
    logoWrapper: {
        width: 120,
        height: 120,
        justifyContent: 'center',
        alignItems: 'center',
        marginBottom: 30,
    },
    logoShape: {
        width: 70,
        height: 70,
        borderRadius: 18,
        transform: [{ rotate: '45deg' }],
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 10 },
        shadowOpacity: 0.3,
        shadowRadius: 15,
        elevation: 10,
    },
    logoOverlay: {
        position: 'absolute',
        justifyContent: 'center',
        alignItems: 'center',
    },
    logoIcon: {
        fontSize: 40,
        textShadowColor: 'rgba(0, 0, 0, 0.2)',
        textShadowOffset: { width: 0, height: 2 },
        textShadowRadius: 4,
    },
    title: {
        fontSize: 40,
        fontWeight: '900',
        letterSpacing: -1,
    },
    taglineReveal: {
        marginTop: 15,
        paddingHorizontal: 16,
        paddingVertical: 6,
        borderRadius: 30,
    },
    subtitle: {
        fontSize: 13,
        fontWeight: '800',
        letterSpacing: 1.5,
        textTransform: 'uppercase',
    },
    loaderContainer: {
        position: 'absolute',
        bottom: 60,
        alignItems: 'center',
    },
    loadingText: {
        marginTop: 15,
        fontSize: 12,
        fontWeight: '600',
        letterSpacing: 0.5,
        opacity: 0.6,
    },
});
