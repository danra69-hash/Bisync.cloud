import React, { useCallback, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { api } from '../api';
import { useAuth } from '../AuthContext';
import { colors } from '../theme';

type Apt = {
  id: string;
  title: string;
  startsAt: string;
  endsAt: string;
  status: string;
  requestStatus?: string;
  requestOrigin?: string;
  member?: { firstName: string; lastName: string } | null;
  coach?: { name: string } | null;
};

export function CalendarScreen() {
  const { user } = useAuth();
  const [rows, setRows] = useState<Apt[]>([]);
  const [coaches, setCoaches] = useState<{ id: string; name: string }[]>([]);
  const [members, setMembers] = useState<{ id: string; firstName: string; lastName: string }[]>([]);
  const [locations, setLocations] = useState<{ id: string; name: string }[]>([]);
  const [coachUserId, setCoachUserId] = useState('');
  const [memberId, setMemberId] = useState('');
  const [locationId, setLocationId] = useState('');
  const [title, setTitle] = useState('Training session');
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    const [cal, me] = await Promise.all([
      api<Apt[]>('/api/mobile/calendar'),
      api<{ locations: { id: string; name: string }[] }>('/api/mobile/me'),
    ]);
    setRows(cal);
    setLocations(me.locations || []);
    if (!locationId && me.locations?.[0]) setLocationId(me.locations[0].id);
    if (user?.type === 'subscriber') {
      const c = await api<{ id: string; name: string }[]>('/api/mobile/coaches/available');
      setCoaches(c);
      if (!coachUserId && c[0]) setCoachUserId(c[0].id);
    } else {
      const m = await api<{ id: string; firstName: string; lastName: string }[]>(
        '/api/mobile/members',
      );
      setMembers(m);
      if (!memberId && m[0]) setMemberId(m[0].id);
    }
  }, [coachUserId, locationId, memberId, user?.type]);

  useFocusEffect(
    useCallback(() => {
      void load().catch((e) => setError(e.message));
    }, [load]),
  );

  async function book() {
    try {
      setError(null);
      const start = new Date();
      start.setHours(start.getHours() + 2, 0, 0, 0);
      const end = new Date(start.getTime() + 60 * 60 * 1000);
      const body: Record<string, string> = {
        title,
        startsAt: start.toISOString(),
        endsAt: end.toISOString(),
        locationId,
      };
      if (user?.type === 'subscriber') body.coachUserId = coachUserId;
      else body.memberId = memberId;
      await api('/api/mobile/calendar/book', { method: 'POST', body: JSON.stringify(body) });
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Book failed');
    }
  }

  async function respond(id: string, accept: boolean) {
    await api(`/api/mobile/calendar/${id}/respond`, {
      method: 'POST',
      body: JSON.stringify({ accept }),
    });
    await load();
  }

  return (
    <ScrollView style={styles.wrap} contentContainerStyle={{ padding: 16, gap: 12 }}>
      <Text style={styles.title}>Calendar</Text>
      <Text style={styles.sub}>
        {user?.type === 'subscriber'
          ? 'Book an available fitness coach, or accept coach requests.'
          : 'Request a session — subscriber must accept before it is confirmed.'}
      </Text>
      {error ? <Text style={styles.error}>{error}</Text> : null}

      <View style={styles.card}>
        <Text style={styles.label}>New booking</Text>
        <TextInput style={styles.input} value={title} onChangeText={setTitle} />
        {user?.type === 'subscriber'
          ? coaches.map((c) => (
              <Pressable key={c.id} onPress={() => setCoachUserId(c.id)}>
                <Text style={{ color: coachUserId === c.id ? colors.accent : colors.ink2 }}>
                  {coachUserId === c.id ? '● ' : '○ '}
                  {c.name}
                </Text>
              </Pressable>
            ))
          : members.map((m) => (
              <Pressable key={m.id} onPress={() => setMemberId(m.id)}>
                <Text style={{ color: memberId === m.id ? colors.accent : colors.ink2 }}>
                  {memberId === m.id ? '● ' : '○ '}
                  {m.firstName} {m.lastName}
                </Text>
              </Pressable>
            ))}
        {locations.map((l) => (
          <Pressable key={l.id} onPress={() => setLocationId(l.id)}>
            <Text style={{ color: locationId === l.id ? colors.accent : colors.ink2 }}>
              {locationId === l.id ? '● ' : '○ '}
              {l.name}
            </Text>
          </Pressable>
        ))}
        <Pressable style={styles.primary} onPress={() => void book()}>
          <Text style={styles.primaryText}>
            {user?.type === 'subscriber' ? 'Book coach' : 'Request subscriber'}
          </Text>
        </Pressable>
      </View>

      {rows.map((a) => (
        <View key={a.id} style={styles.card}>
          <Text style={styles.itemTitle}>{a.title}</Text>
          <Text style={styles.meta}>{new Date(a.startsAt).toLocaleString()}</Text>
          <Text style={styles.meta}>
            {a.member ? `${a.member.firstName} ${a.member.lastName}` : ''}
            {a.coach ? ` · ${a.coach.name}` : ''}
          </Text>
          <Text style={styles.badge}>{a.requestStatus || a.status}</Text>
          {user?.type === 'subscriber' &&
          a.requestOrigin === 'coach' &&
          (a.requestStatus === 'pending' || a.status === 'pending') ? (
            <View style={styles.row}>
              <Pressable style={styles.primary} onPress={() => void respond(a.id, true)}>
                <Text style={styles.primaryText}>Accept</Text>
              </Pressable>
              <Pressable style={styles.ghost} onPress={() => void respond(a.id, false)}>
                <Text style={styles.ghostText}>Decline</Text>
              </Pressable>
            </View>
          ) : null}
        </View>
      ))}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  wrap: { flex: 1, backgroundColor: colors.paper },
  title: { fontSize: 24, fontWeight: '700', color: colors.ink },
  sub: { color: colors.muted },
  card: {
    backgroundColor: colors.white,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.rule,
    padding: 14,
    gap: 8,
  },
  label: { color: colors.muted, fontSize: 12, textTransform: 'uppercase' },
  input: {
    borderWidth: 1,
    borderColor: colors.rule,
    borderRadius: 8,
    padding: 10,
    color: colors.ink,
  },
  primary: {
    backgroundColor: colors.accent,
    borderRadius: 8,
    paddingVertical: 12,
    alignItems: 'center',
    flex: 1,
  },
  primaryText: { color: '#fff', fontWeight: '700' },
  ghost: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  ghostText: { color: colors.accent, fontWeight: '600' },
  error: { color: colors.danger },
  itemTitle: { fontWeight: '700', color: colors.ink },
  meta: { color: colors.muted, fontSize: 13 },
  badge: {
    alignSelf: 'flex-start',
    backgroundColor: colors.accentSoft,
    color: colors.accent,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
    overflow: 'hidden',
    fontSize: 12,
    fontWeight: '600',
  },
  row: { flexDirection: 'row', gap: 8 },
});
