import React, { useCallback, useState } from 'react';
import { Platform, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useFocusEffect, useNavigation, useRoute } from '@react-navigation/native';
import type { RouteProp } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { api } from '../api';
import { colors } from '../theme';
import type { RootStackParamList } from '../navigation';

type Stamp = {
  id: string;
  index: number;
  status: string;
};

type Pack = {
  id: string;
  name: string;
  stampsTotal: number;
  stampsUsed: number;
  stamps: Stamp[];
  description: string;
};

export function MemberStampsScreen() {
  const route = useRoute<RouteProp<RootStackParamList, 'MemberStamps'>>();
  const nav = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const { memberId, memberName } = route.params;
  const [packs, setPacks] = useState<Pack[]>([]);
  const [locations, setLocations] = useState<{ id: string; name: string }[]>([]);
  const [locationId, setLocationId] = useState('');
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    const me = await api<{ locations: { id: string; name: string }[] }>('/api/mobile/me');
    setLocations(me.locations || []);
    if (!locationId && me.locations?.[0]) setLocationId(me.locations[0].id);
    const data = await api<{ coachingPackages: Pack[] }>(
      `/api/mobile/packages?memberId=${memberId}`,
    );
    setPacks(data.coachingPackages || []);
  }, [locationId, memberId]);

  useFocusEffect(
    useCallback(() => {
      void load().catch((e) => setError(e instanceof Error ? e.message : 'Load failed'));
    }, [load]),
  );

  function chooseStamp(pack: Pack, stamp: Stamp) {
    if (stamp.status === 'confirmed') return;
    if (!locationId) {
      setError('Choose a location first');
      return;
    }
    nav.navigate('Scan', {
      purpose: 'coachStamp',
      memberPackageId: pack.id,
      stampIndex: stamp.index,
      locationId,
      memberId,
      memberName,
    });
  }

  return (
    <ScrollView style={styles.wrap} contentContainerStyle={{ padding: 16, gap: 12 }}>
      <Text style={styles.title}>{memberName}</Text>
      <Text style={styles.sub}>
        Choose an available stamp, then scan the member&apos;s check-in QR to mark it used.
      </Text>
      {error ? <Text style={styles.error}>{error}</Text> : null}

      <View style={styles.card}>
        <Text style={styles.label}>Location</Text>
        {locations.map((l) => (
          <Pressable key={l.id} onPress={() => setLocationId(l.id)}>
            <Text style={{ color: locationId === l.id ? colors.accent : colors.ink2 }}>
              {locationId === l.id ? '● ' : '○ '}
              {l.name}
            </Text>
          </Pressable>
        ))}
      </View>

      {packs.map((pack) => (
        <View key={pack.id} style={styles.card}>
          <Text style={styles.itemTitle}>{pack.name}</Text>
          <Text style={styles.meta}>
            {pack.stampsUsed}/{pack.stampsTotal} sessions used
          </Text>
          <Text style={styles.meta}>{pack.description}</Text>
          <View style={styles.stamps}>
            {pack.stamps.map((s) => {
              const used = s.status === 'confirmed';
              const pending = s.status === 'pending';
              return (
                <Pressable
                  key={s.id}
                  style={[
                    styles.stamp,
                    used && styles.stampDone,
                    pending && styles.stampPending,
                  ]}
                  onPress={() => chooseStamp(pack, s)}
                  disabled={used}
                  accessibilityRole="button"
                  accessibilityLabel={`Stamp ${s.index}`}
                  {...(Platform.OS === 'web' && !used
                    ? ({ onClick: () => chooseStamp(pack, s), cursor: 'pointer' } as object)
                    : {})}
                >
                  <Text style={[styles.stampText, used && styles.stampTextDone]}>
                    {used ? '✕' : s.index}
                  </Text>
                </Pressable>
              );
            })}
          </View>
          <Text style={styles.hint}>Available stamps open the camera to scan the member QR.</Text>
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
  itemTitle: { fontWeight: '700', color: colors.ink, fontSize: 16 },
  meta: { color: colors.muted, fontSize: 13 },
  stamps: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 8 },
  stamp: {
    width: 48,
    height: 48,
    borderRadius: 24,
    borderWidth: 2,
    borderColor: colors.accent,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.accentSoft,
  },
  stampPending: { borderColor: colors.warn, backgroundColor: '#fff7e8' },
  stampDone: { borderColor: colors.ok, backgroundColor: '#e8f8f0', opacity: 0.85 },
  stampText: { fontWeight: '700', color: colors.accent, fontSize: 16 },
  stampTextDone: { color: colors.ok, fontSize: 18 },
  hint: { color: colors.muted, fontSize: 12 },
  error: { color: colors.danger },
});
