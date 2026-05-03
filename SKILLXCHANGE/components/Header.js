import React from 'react';
import { View, Image, StyleSheet, TouchableOpacity, Text } from 'react-native';
import { useTheme } from '../context/ThemeContext';

export default function Header({ title, rightComponent }) {
    const { colors, isDark } = useTheme();

    return (
        <View style={[styles.container, { backgroundColor: colors.card, borderBottomColor: colors.border }]}>
            <View style={styles.leftSection}>
                <Image
                    source={require('../assets/app_logo.png')}
                    style={styles.logo}
                    resizeMode="contain"
                />
                {title && <Text style={[styles.title, { color: colors.text }]}>{title}</Text>}
            </View>
            <View style={styles.rightSection}>
                {rightComponent}
            </View>
        </View>
    );
}

const styles = StyleSheet.create({
    container: {
        height: 60,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingHorizontal: 15,
        borderBottomWidth: 1,
        elevation: 2,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 1 },
        shadowOpacity: 0.1,
        shadowRadius: 2,
    },
    leftSection: {
        flexDirection: 'row',
        alignItems: 'center',
    },
    logo: {
        width: 35,
        height: 35,
        marginRight: 10,
    },
    title: {
        fontSize: 18,
        fontWeight: '800',
        letterSpacing: -0.5,
    },
    rightSection: {
        flexDirection: 'row',
        alignItems: 'center',
    },
});
