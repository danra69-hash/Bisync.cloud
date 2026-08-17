import React, { useCallback, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useFocusEffect, useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { api } from '../api';
import { colors } from '../theme';
import type { RootStackParamList } from '../navigation';

export type CoachingMember = {
  id: string;
  firstName: string;
  lastName: string;
  email?: string;
  sessionsPurchased: number;
  sessionsUsed: number;
  sessionsRemaining: number;
  packageCount: number;
};

export function MembersScreen({ mode = 'directory' }: { mode?: 'directory' | 'attendance' }) {
  const nav = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const [rows, setRows] = useState<CoachingMember[]>([]);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    const list = await api<CoachingMember[]>('/api/mobile/members/coaching');
    setRows(list);
  }, []);

  useFocusEffect(
    useCallback(() => {
      void load().catch((e) => setError(e instanceof Error ? e.message : 'Load failed'));
    }, [load]),
  );

  const title = mode === 'attendance' ? 'Attendance' : 'Members';
  const sub =
    mode === 'attendance'
      ? 'Tap a member to open stamps, scan their QR, and mark a session used.'
      : 'Members who purchased training sessions with you — purchased vs used.';

  return (
    <ScrollView style={styles.wrap} contentContainerStyle={{ padding: 16, gap: 12 }}>
      <Text style={styles.title}>{title}</Text>
      <Text style={styles.sub}>{sub}</Text>
      {error ? <Text style={styles.error}>{error}</Text> : null}

      {rows.length === 0 ? (
        <View style={styles.card}>
          <Text style={styles.meta}>No coaching package purchases yet.</Text>
        </View>
      ) : (
        rows.map((m) => (
          <Pressable
            key={m.id}
            style={styles.card}
            onPress={() =>
              nav.navigate('MemberStamps', {
                memberId: m.id,
                memberName: `${m.firstName} ${m.lastName}`,
              })
            }
            accessibilityRole="button"
          >
            <Text style={styles.name}>
              {m.firstName} {m.lastName}
            </Text>
            {m.email ? <Text style={styles.meta}>{m.email}</Text> : null}
            <View style={styles.stats}>
              <View style={styles.stat}>
                <Text style={styles.statNum}>{m.sessionsPurchased}</Text>
                <Text style={styles.statLabel}>Purchased</Text>
              </View>
              <View style={styles.stat}>
                <Text style={styles.statNum}>{m.sessionsUsed}</Text>
                <Text style={styles.statLabel}>Used</Text>
              </View>
              <View style={styles.stat}>
                <Text style={[styles.statNum, { color: colors.accent }]}>
                  {m.sessionsRemaining}
                </Text>
                <Text style={styles.statLabel}>Remaining</Text>
              </View>
            </View>
            <Text style={styles.link}>
              {mode === 'attendance' ? 'Open stamps →' : 'View stamps →'}
            </Text>
          </Pressable>
        ))
      )}
    </ScrollView>
  );
}

export function AttendanceScreen() {
  return <MembersScreen mode="attendance" />;
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
    gap: 6,
  },
  name: { fontSize: 17, fontWeight: '700', color: colors.ink },
  meta: { color: colors.muted, fontSize: 13 },
  stats: { flexDirection: 'row', gap: 12, marginTop: 8 },
  stat: { flex: 1, backgroundColor: colors.paper, borderRadius: 8, padding: 10 },
  statNum: { fontSize: 20, fontWeight: '700', color: colors.ink },
  statLabel: { color: colors.muted, fontSize: 11, textTransform: 'uppercase' },
  link: { color: colors.accent, fontWeight: '600', marginTop: 4 },
  error: { color: colors.danger },
});
