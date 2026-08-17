import React, { useCallback, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useFocusEffect, useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import QRCode from 'react-native-qrcode-svg';
import { api } from '../api';
import { useAuth } from '../AuthContext';
import { colors } from '../theme';
import type { RootStackParamList } from '../navigation';

type Stamp = {
  id: string;
  index: number;
  status: string;
  qrPayload?: string | null;
};

type Pack = {
  id: string;
  name: string;
  stampsTotal: number;
  stampsUsed: number;
  stamps: Stamp[];
  description: string;
  price: number;
};

type PackagesResponse = {
  subscription: {
    plan: string;
    status: string;
    productName?: string;
    price?: number | null;
    billingInterval?: string;
    renewsAt?: string | null;
  } | null;
  coachingPackages: Pack[];
  memberQr?: string;
  memberId?: string;
};

export function PackagesScreen() {
  const { user } = useAuth();
  const nav = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const [data, setData] = useState<PackagesResponse | null>(null);
  const [members, setMembers] = useState<{ id: string; firstName: string; lastName: string }[]>([]);
  const [memberId, setMemberId] = useState('');
  const [locations, setLocations] = useState<{ id: string; name: string }[]>([]);
  const [locationId, setLocationId] = useState('');
  const [activeQr, setActiveQr] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    const me = await api<{ locations: { id: string; name: string }[] }>('/api/mobile/me');
    setLocations(me.locations || []);
    if (!locationId && me.locations?.[0]) setLocationId(me.locations[0].id);

    let mid = user?.memberId || memberId;
    if (user?.type === 'coach') {
      const m = await api<{ id: string; firstName: string; lastName: string }[]>(
        '/api/mobile/members',
      );
      setMembers(m);
      if (!mid && m[0]) {
        mid = m[0].id;
        setMemberId(m[0].id);
      }
    }
    if (!mid) return;
    const packs = await api<PackagesResponse>(
      `/api/mobile/packages${user?.type === 'coach' ? `?memberId=${mid}` : ''}`,
    );
    setData(packs);
  }, [locationId, memberId, user?.memberId, user?.type]);

  useFocusEffect(
    useCallback(() => {
      void load().catch((e) => setError(e.message));
    }, [load]),
  );

  async function tapStamp(pack: Pack, stamp: Stamp) {
    try {
      setError(null);
      if (stamp.status === 'confirmed') return;
      const now = new Date();
      const sessionDate = now.toISOString().slice(0, 10);
      const sessionTime = now.toISOString().slice(11, 16);
      const res = await api<{ qrPayload: string }>('/api/mobile/attendance/stamp/qr', {
        method: 'POST',
        body: JSON.stringify({
          memberPackageId: pack.id,
          stampIndex: stamp.index,
          locationId,
          sessionDate,
          sessionTime,
        }),
      });
      setActiveQr(res.qrPayload);
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Stamp failed');
    }
  }

  return (
    <ScrollView style={styles.wrap} contentContainerStyle={{ padding: 16, gap: 12 }}>
      <Text style={styles.title}>Packages</Text>
      <Text style={styles.sub}>
        Subscription detail and coaching stamp card. Tap a stamp to mint a QR (location / date /
        time / 4-digit).
      </Text>
      {error ? <Text style={styles.error}>{error}</Text> : null}

      {user?.type === 'coach' ? (
        <View style={styles.card}>
          <Text style={styles.label}>Subscriber</Text>
          {members.map((m) => (
            <Pressable
              key={m.id}
              onPress={() => {
                setMemberId(m.id);
                void api<PackagesResponse>(`/api/mobile/packages?memberId=${m.id}`)
                  .then(setData)
                  .catch((e) => setError(e.message));
              }}
            >
              <Text style={{ color: memberId === m.id ? colors.accent : colors.ink2 }}>
                {memberId === m.id ? '● ' : '○ '}
                {m.firstName} {m.lastName}
              </Text>
            </Pressable>
          ))}
        </View>
      ) : null}

      <View style={styles.card}>
        <Text style={styles.label}>Location for QR</Text>
        {locations.map((l) => (
          <Pressable key={l.id} onPress={() => setLocationId(l.id)}>
            <Text style={{ color: locationId === l.id ? colors.accent : colors.ink2 }}>
              {locationId === l.id ? '● ' : '○ '}
              {l.name}
            </Text>
          </Pressable>
        ))}
      </View>

      {user?.type === 'subscriber' && data?.memberQr ? (
        <View style={[styles.card, { alignItems: 'center' }]}>
          <Text style={styles.label}>Your check-in QR</Text>
          <Text style={styles.meta}>Show this to your coach for attendance</Text>
          <QRCode value={data.memberQr} size={180} />
          <Text selectable style={styles.mono}>
            {data.memberQr}
          </Text>
        </View>
      ) : null}

      {data?.subscription ? (
        <View style={styles.card}>
          <Text style={styles.label}>Subscription</Text>
          <Text style={styles.itemTitle}>
            {data.subscription.productName || data.subscription.plan}
          </Text>
          <Text style={styles.meta}>
            {data.subscription.status}
            {data.subscription.price != null
              ? ` · $${data.subscription.price}/${data.subscription.billingInterval}`
              : ''}
          </Text>
        </View>
      ) : null}

      {(data?.coachingPackages || []).map((pack) => (
        <View key={pack.id} style={styles.card}>
          <Text style={styles.itemTitle}>{pack.name}</Text>
          <Text style={styles.meta}>
            {pack.stampsUsed}/{pack.stampsTotal} used · ${pack.price}
          </Text>
          <Text style={styles.meta}>{pack.description}</Text>
          <View style={styles.stamps}>
            {pack.stamps.map((s) => (
              <Pressable
                key={s.id}
                style={[
                  styles.stamp,
                  s.status === 'confirmed' && styles.stampDone,
                  s.status === 'pending' && styles.stampPending,
                ]}
                onPress={() => void tapStamp(pack, s)}
              >
                <Text style={styles.stampText}>{s.index}</Text>
              </Pressable>
            ))}
          </View>
        </View>
      ))}

      {activeQr ? (
        <View style={[styles.card, { alignItems: 'center' }]}>
          <Text style={styles.label}>Attendance QR</Text>
          <QRCode value={activeQr} size={200} />
          <Text selectable style={styles.mono}>
            {activeQr}
          </Text>
          <Pressable style={styles.primary} onPress={() => nav.navigate('Scan')}>
            <Text style={styles.primaryText}>Open scanner (counterparty)</Text>
          </Pressable>
        </View>
      ) : (
        <Pressable style={styles.primary} onPress={() => nav.navigate('Scan')}>
          <Text style={styles.primaryText}>Scan QR to confirm</Text>
        </Pressable>
      )}
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
  itemTitle: { fontWeight: '700', color: colors.ink, fontSize: 16 },
  meta: { color: colors.muted, fontSize: 13 },
  stamps: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 8 },
  stamp: {
    width: 44,
    height: 44,
    borderRadius: 22,
    borderWidth: 2,
    borderColor: colors.rule,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.paper,
  },
  stampPending: { borderColor: colors.warn, backgroundColor: '#fff7e8' },
  stampDone: { borderColor: colors.ok, backgroundColor: '#e8f8f0' },
  stampText: { fontWeight: '700', color: colors.ink },
  primary: {
    backgroundColor: colors.accent,
    borderRadius: 8,
    paddingVertical: 12,
    alignItems: 'center',
  },
  primaryText: { color: '#fff', fontWeight: '700' },
  error: { color: colors.danger },
  mono: { fontSize: 10, color: colors.muted, marginTop: 8 },
});
