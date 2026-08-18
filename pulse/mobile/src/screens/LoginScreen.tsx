import React, { useState } from 'react';
import {
  ActivityIndicator,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import * as LocalAuthentication from 'expo-local-authentication';
import { useAuth } from '../AuthContext';
import { colors } from '../theme';

export function LoginScreen() {
  const { login } = useAuth();
  const [mode, setMode] = useState<'subscriber' | 'coach'>('subscriber');
  const [email, setEmail] = useState(
    mode === 'subscriber' ? 'sam.nguyen@email.com' : 'coach@pulse.club',
  );
  const [password, setPassword] = useState('pulse123');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function switchMode(next: 'subscriber' | 'coach') {
    setMode(next);
    setEmail(next === 'subscriber' ? 'sam.nguyen@email.com' : 'coach@pulse.club');
    setError(null);
  }

  async function submit() {
    setBusy(true);
    setError(null);
    try {
      await login(email.trim(), password, mode);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Login failed');
    } finally {
      setBusy(false);
    }
  }

  async function biometricsHint() {
    const has = await LocalAuthentication.hasHardwareAsync();
    const enrolled = await LocalAuthentication.isEnrolledAsync();
    if (!has || !enrolled) {
      setError('Biometrics unavailable on this device — use email/password then PIN.');
      return;
    }
    setError('Sign in with email first, then unlock with biometrics on the PIN screen.');
  }

  return (
    <View style={styles.wrap}>
      <Text style={styles.brand}>mobile.pulse</Text>
      <Text style={styles.eyebrow}>{mode === 'subscriber' ? 'Subscriber' : 'Fitness coach'}</Text>
      <Text style={styles.title}>Train. Book. Stamp in.</Text>

      <View style={styles.segment}>
        <Pressable
          style={[styles.segBtn, mode === 'subscriber' && styles.segOn]}
          onPress={() => switchMode('subscriber')}
        >
          <Text style={[styles.segText, mode === 'subscriber' && styles.segTextOn]}>Subscriber</Text>
        </Pressable>
        <Pressable
          style={[styles.segBtn, mode === 'coach' && styles.segOn]}
          onPress={() => switchMode('coach')}
        >
          <Text style={[styles.segText, mode === 'coach' && styles.segTextOn]}>Coach</Text>
        </Pressable>
      </View>

      {error ? <Text style={styles.error}>{error}</Text> : null}

      <Text style={styles.label}>Email</Text>
      <TextInput
        autoCapitalize="none"
        keyboardType="email-address"
        style={styles.input}
        value={email}
        onChangeText={setEmail}
      />
      <Text style={styles.label}>Password</Text>
      <TextInput
        secureTextEntry
        style={styles.input}
        value={password}
        onChangeText={setPassword}
      />

      <Pressable style={styles.primary} onPress={() => void submit()} disabled={busy}>
        {busy ? <ActivityIndicator color="#fff" /> : <Text style={styles.primaryText}>Continue</Text>}
      </Pressable>
      <Pressable style={styles.ghost} onPress={() => void biometricsHint()}>
        <Text style={styles.ghostText}>Biometrics info</Text>
      </Pressable>
      <Text style={styles.hint}>Demo PIN after login: 1234</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { flex: 1, backgroundColor: colors.paper, padding: 24, justifyContent: 'center' },
  brand: { fontSize: 18, fontWeight: '700', color: colors.ink, marginBottom: 8 },
  eyebrow: { color: colors.muted, fontSize: 12, letterSpacing: 1, textTransform: 'uppercase' },
  title: { fontSize: 28, fontWeight: '700', color: colors.ink, marginVertical: 12, maxWidth: 280 },
  segment: { flexDirection: 'row', gap: 8, marginBottom: 16 },
  segBtn: {
    flex: 1,
    borderWidth: 1,
    borderColor: colors.rule,
    borderRadius: 8,
    paddingVertical: 10,
    alignItems: 'center',
    backgroundColor: colors.white,
  },
  segOn: { backgroundColor: colors.accentSoft, borderColor: colors.accent },
  segText: { color: colors.muted, fontWeight: '600' },
  segTextOn: { color: colors.accent },
  label: { color: colors.muted, marginBottom: 6, marginTop: 8 },
  input: {
    backgroundColor: colors.white,
    borderWidth: 1,
    borderColor: colors.rule,
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 12,
    color: colors.ink,
  },
  primary: {
    marginTop: 20,
    backgroundColor: colors.accent,
    borderRadius: 8,
    paddingVertical: 14,
    alignItems: 'center',
  },
  primaryText: { color: colors.white, fontWeight: '700' },
  ghost: { marginTop: 12, alignItems: 'center', padding: 10 },
  ghostText: { color: colors.accent, fontWeight: '600' },
  error: {
    backgroundColor: '#fde8e6',
    color: colors.danger,
    padding: 10,
    borderRadius: 8,
    marginBottom: 8,
  },
  hint: { marginTop: 16, color: colors.muted, fontSize: 12 },
});
