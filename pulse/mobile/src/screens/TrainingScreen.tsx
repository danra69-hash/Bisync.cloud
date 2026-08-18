import React, { useCallback, useState } from 'react';
import {
  Alert,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { api } from '../api';
import { useAuth } from '../AuthContext';
import { colors } from '../theme';

type SetRow = {
  id: string;
  setIndex?: number;
  modality: string;
  equipmentName: string;
  weight: number | null;
  reps: number | null;
  setsCount: number | null;
  speed: number | null;
  incline: number | null;
  durationSec: number | null;
};

type Session = {
  id: string;
  status: string;
  sets: SetRow[];
  endQrPayload?: string | null;
};

export function TrainingScreen() {
  const { user } = useAuth();
  const [session, setSession] = useState<Session | null>(null);
  const [locations, setLocations] = useState<{ id: string; name: string }[]>([]);
  const [locationId, setLocationId] = useState('');
  const [members, setMembers] = useState<{ id: string; firstName: string; lastName: string }[]>([]);
  const [memberId, setMemberId] = useState('');
  const [stampId, setStampId] = useState('');
  const [modality, setModality] = useState<'strength' | 'cardio'>('strength');
  const [equipmentName, setEquipmentName] = useState('');
  const [weight, setWeight] = useState('60');
  const [reps, setReps] = useState('8');
  const [setsCount, setSetsCount] = useState('3');
  const [speed, setSpeed] = useState('8');
  const [incline, setIncline] = useState('2');
  const [durationSec, setDurationSec] = useState('600');
  const [endQr, setEndQr] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setError(null);
    const me = await api<{ locations: { id: string; name: string }[] }>('/api/mobile/me');
    setLocations(me.locations || []);
    if (!locationId && me.locations?.[0]) setLocationId(me.locations[0].id);
    const active = await api<Session | null>('/api/mobile/training/active');
    setSession(active);
    if (user?.type === 'coach') {
      const m = await api<{ id: string; firstName: string; lastName: string }[]>(
        '/api/mobile/members',
      );
      setMembers(m);
      if (!memberId && m[0]) setMemberId(m[0].id);
    }
  }, [locationId, memberId, user?.type]);

  useFocusEffect(
    useCallback(() => {
      void load().catch((e) => setError(e.message));
    }, [load]),
  );

  async function start() {
    try {
      setError(null);
      const body: Record<string, string> = { locationId };
      if (user?.type === 'coach') {
        body.memberId = memberId;
        body.attendanceStampId = stampId;
      }
      const s = await api<Session>('/api/mobile/training/start', {
        method: 'POST',
        body: JSON.stringify(body),
      });
      setSession(s);
      setEndQr(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Start failed');
    }
  }

  async function addSet() {
    if (!session) return;
    try {
      const body =
        modality === 'strength'
          ? { modality, equipmentName, weight: Number(weight), reps: Number(reps), setsCount: Number(setsCount) }
          : {
              modality,
              equipmentName,
              speed: Number(speed),
              incline: Number(incline),
              durationSec: Number(durationSec),
            };
      const s = await api<Session>(`/api/mobile/training/${session.id}/sets`, {
        method: 'POST',
        body: JSON.stringify(body),
      });
      setSession(s);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Add set failed');
    }
  }

  async function endSession() {
    if (!session) return;
    try {
      const res = await api<{ session: Session; endQrPayload: string }>(
        `/api/mobile/training/${session.id}/end`,
        { method: 'POST', body: '{}' },
      );
      setSession(res.session);
      setEndQr(res.endQrPayload);
      Alert.alert('Session ended', 'Show end QR to the other party to counter-confirm.');
    } catch (e) {
      setError(e instanceof Error ? e.message : 'End failed');
    }
  }

  return (
    <ScrollView style={styles.wrap} contentContainerStyle={{ padding: 16, gap: 12 }}>
      <Text style={styles.title}>Training</Text>
      <Text style={styles.sub}>
        {user?.type === 'coach'
          ? 'Confirm attendance first, then log sets. Ending creates a QR for the subscriber.'
          : 'Start your own session and log strength or cardio sets.'}
      </Text>
      {error ? <Text style={styles.error}>{error}</Text> : null}

      {!session || session.status !== 'active' ? (
        <View style={styles.card}>
          <Text style={styles.label}>Location</Text>
          {locations.map((l) => (
            <Pressable key={l.id} onPress={() => setLocationId(l.id)} style={styles.chip}>
              <Text style={{ color: locationId === l.id ? colors.accent : colors.ink2 }}>
                {locationId === l.id ? '● ' : '○ '}
                {l.name}
              </Text>
            </Pressable>
          ))}
          {user?.type === 'coach' ? (
            <>
              <Text style={styles.label}>Subscriber</Text>
              {members.map((m) => (
                <Pressable key={m.id} onPress={() => setMemberId(m.id)} style={styles.chip}>
                  <Text style={{ color: memberId === m.id ? colors.accent : colors.ink2 }}>
                    {memberId === m.id ? '● ' : '○ '}
                    {m.firstName} {m.lastName}
                  </Text>
                </Pressable>
              ))}
              <Text style={styles.label}>Confirmed stamp ID</Text>
              <TextInput
                style={styles.input}
                value={stampId}
                onChangeText={setStampId}
                placeholder="From attendance confirm"
                placeholderTextColor={colors.muted}
              />
            </>
          ) : null}
          <Pressable style={styles.primary} onPress={() => void start()}>
            <Text style={styles.primaryText}>Start session</Text>
          </Pressable>
        </View>
      ) : (
        <View style={styles.card}>
          <Text style={styles.label}>Active session · {session.sets.length} sets</Text>
          {session.sets.map((s) => (
            <Text key={s.id} style={styles.setLine}>
              #{s.setIndex ?? ''} {s.modality} {s.equipmentName}{' '}
              {s.modality === 'cardio'
                ? `${s.speed} km/h · ${s.incline}% · ${s.durationSec}s`
                : `${s.weight}kg × ${s.reps} × ${s.setsCount}`}
            </Text>
          ))}

          <View style={styles.segment}>
            <Pressable
              style={[styles.segBtn, modality === 'strength' && styles.segOn]}
              onPress={() => setModality('strength')}
            >
              <Text>Strength</Text>
            </Pressable>
            <Pressable
              style={[styles.segBtn, modality === 'cardio' && styles.segOn]}
              onPress={() => setModality('cardio')}
            >
              <Text>Cardio</Text>
            </Pressable>
          </View>
          <TextInput
            style={styles.input}
            value={equipmentName}
            onChangeText={setEquipmentName}
            placeholder="Equipment"
            placeholderTextColor={colors.muted}
          />
          {modality === 'strength' ? (
            <View style={styles.row}>
              <TextInput style={[styles.input, styles.flex]} value={weight} onChangeText={setWeight} placeholder="Weight" keyboardType="decimal-pad" />
              <TextInput style={[styles.input, styles.flex]} value={reps} onChangeText={setReps} placeholder="Reps" keyboardType="number-pad" />
              <TextInput style={[styles.input, styles.flex]} value={setsCount} onChangeText={setSetsCount} placeholder="Sets" keyboardType="number-pad" />
            </View>
          ) : (
            <View style={styles.row}>
              <TextInput style={[styles.input, styles.flex]} value={speed} onChangeText={setSpeed} placeholder="Speed" keyboardType="decimal-pad" />
              <TextInput style={[styles.input, styles.flex]} value={incline} onChangeText={setIncline} placeholder="Incline" keyboardType="decimal-pad" />
              <TextInput style={[styles.input, styles.flex]} value={durationSec} onChangeText={setDurationSec} placeholder="Seconds" keyboardType="number-pad" />
            </View>
          )}
          <Pressable style={styles.primary} onPress={() => void addSet()}>
            <Text style={styles.primaryText}>Add set</Text>
          </Pressable>
          <Pressable style={styles.danger} onPress={() => void endSession()}>
            <Text style={styles.primaryText}>End session</Text>
          </Pressable>
        </View>
      )}

      {endQr ? (
        <View style={styles.card}>
          <Text style={styles.label}>End QR payload (counterparty scans)</Text>
          <Text selectable style={styles.mono}>
            {endQr}
          </Text>
        </View>
      ) : null}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  wrap: { flex: 1, backgroundColor: colors.paper },
  title: { fontSize: 24, fontWeight: '700', color: colors.ink },
  sub: { color: colors.muted, marginBottom: 8 },
  card: {
    backgroundColor: colors.white,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.rule,
    padding: 14,
    gap: 8,
  },
  label: { color: colors.muted, fontSize: 12, textTransform: 'uppercase', letterSpacing: 0.6 },
  input: {
    borderWidth: 1,
    borderColor: colors.rule,
    borderRadius: 8,
    padding: 10,
    color: colors.ink,
    backgroundColor: colors.paper,
  },
  primary: {
    backgroundColor: colors.accent,
    borderRadius: 8,
    paddingVertical: 12,
    alignItems: 'center',
    marginTop: 4,
  },
  danger: {
    backgroundColor: colors.ink,
    borderRadius: 8,
    paddingVertical: 12,
    alignItems: 'center',
  },
  primaryText: { color: '#fff', fontWeight: '700' },
  error: { color: colors.danger },
  chip: { paddingVertical: 6 },
  row: { flexDirection: 'row', gap: 8 },
  flex: { flex: 1 },
  segment: { flexDirection: 'row', gap: 8 },
  segBtn: {
    flex: 1,
    borderWidth: 1,
    borderColor: colors.rule,
    borderRadius: 8,
    padding: 10,
    alignItems: 'center',
  },
  segOn: { backgroundColor: colors.accentSoft, borderColor: colors.accent },
  setLine: { color: colors.ink2, fontSize: 13 },
  mono: { fontFamily: 'monospace', fontSize: 11, color: colors.ink2 },
});
