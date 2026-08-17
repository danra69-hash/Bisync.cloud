import React, { useState } from 'react';
import { Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import * as LocalAuthentication from 'expo-local-authentication';
import { useAuth } from '../AuthContext';
import { colors } from '../theme';

export function PinScreen() {
  const { verifyPin, unlockWithBiometricsFlag, logout, user } = useAuth();
  const [pin, setPin] = useState('');
  const [error, setError] = useState<string | null>(null);

  async function submit() {
    setError(null);
    try {
      await verifyPin(pin);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'PIN failed');
      setPin('');
    }
  }

  async function biometrics() {
    setError(null);
    try {
      const result = await LocalAuthentication.authenticateAsync({
        promptMessage: 'Unlock mobile.pulse',
        fallbackLabel: 'Use PIN',
      });
      if (result.success) await unlockWithBiometricsFlag();
      else setError('Biometrics cancelled — enter PIN.');
    } catch {
      setError('Biometrics unavailable — enter PIN 1234.');
    }
  }

  return (
    <View style={styles.wrap}>
      <Text style={styles.eyebrow}>{user?.type}</Text>
      <Text style={styles.title}>Enter PIN</Text>
      <Text style={styles.sub}>{user?.name}</Text>
      {error ? <Text style={styles.error}>{error}</Text> : null}
      <TextInput
        value={pin}
        onChangeText={setPin}
        keyboardType="number-pad"
        secureTextEntry
        maxLength={6}
        style={styles.input}
        placeholder="••••"
        placeholderTextColor={colors.muted}
      />
      <Pressable style={styles.primary} onPress={() => void submit()}>
        <Text style={styles.primaryText}>Unlock</Text>
      </Pressable>
      <Pressable style={styles.ghost} onPress={() => void biometrics()}>
        <Text style={styles.ghostText}>Use biometrics</Text>
      </Pressable>
      <Pressable style={styles.ghost} onPress={() => void logout()}>
        <Text style={styles.ghostText}>Sign out</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { flex: 1, backgroundColor: colors.paper, padding: 24, justifyContent: 'center' },
  eyebrow: { textTransform: 'uppercase', color: colors.muted, letterSpacing: 1, fontSize: 12 },
  title: { fontSize: 28, fontWeight: '700', color: colors.ink, marginTop: 8 },
  sub: { color: colors.ink2, marginBottom: 16 },
  input: {
    backgroundColor: colors.white,
    borderWidth: 1,
    borderColor: colors.rule,
    borderRadius: 8,
    padding: 16,
    fontSize: 24,
    letterSpacing: 8,
    textAlign: 'center',
    color: colors.ink,
  },
  primary: {
    marginTop: 16,
    backgroundColor: colors.accent,
    borderRadius: 8,
    paddingVertical: 14,
    alignItems: 'center',
  },
  primaryText: { color: '#fff', fontWeight: '700' },
  ghost: { marginTop: 12, alignItems: 'center', padding: 10 },
  ghostText: { color: colors.accent, fontWeight: '600' },
  error: { color: colors.danger, marginBottom: 8 },
});
