import React, { useCallback, useLayoutEffect, useMemo, useState } from 'react';
import {
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { useFocusEffect, useNavigation } from '@react-navigation/native';
import { api } from '../api';
import { useAuth } from '../AuthContext';
import { colors } from '../theme';
import { combineLocal, monthMatrix, parseYmd, ymd } from '../calendarUtils';

type Member = { id: string; firstName: string; lastName: string };
type Location = { id: string; name: string };
type Apt = {
  id: string;
  title: string;
  startsAt: string;
  endsAt: string;
  status: string;
  requestStatus?: string;
  member?: Member | null;
  coach?: { name: string } | null;
};

const WEEKDAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

function TapButton({
  onPress,
  style,
  children,
  accessibilityLabel,
}: {
  onPress: () => void;
  style?: object;
  children: React.ReactNode;
  accessibilityLabel?: string;
}) {
  const webHandlers =
    Platform.OS === 'web'
      ? ({
          onClick: (e: { stopPropagation?: () => void }) => {
            e?.stopPropagation?.();
            onPress();
          },
          cursor: 'pointer',
        } as Record<string, unknown>)
      : {};
  return (
    <Pressable
      onPress={onPress}
      style={style}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel}
      {...webHandlers}
    >
      {children}
    </Pressable>
  );
}

export function HomeScreen() {
  const navigation = useNavigation();
  const { logout } = useAuth();
  const today = useMemo(() => new Date(), []);
  const [cursor, setCursor] = useState(() => new Date(today.getFullYear(), today.getMonth(), 1));
  const [selectedDay, setSelectedDay] = useState(() => ymd(today));
  const [rows, setRows] = useState<Apt[]>([]);
  const [members, setMembers] = useState<Member[]>([]);
  const [locations, setLocations] = useState<Location[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [composerOpen, setComposerOpen] = useState(false);
  const [title, setTitle] = useState('Training session');
  const [dateValue, setDateValue] = useState(() => ymd(today));
  const [timeValue, setTimeValue] = useState('09:00');
  const [durationMin, setDurationMin] = useState('60');
  const [memberId, setMemberId] = useState('');
  const [memberQuery, setMemberQuery] = useState('');
  const [locationId, setLocationId] = useState('');
  const [saving, setSaving] = useState(false);

  const openComposer = useCallback((day?: string) => {
    setError(null);
    setDateValue(day || selectedDay);
    setTimeValue('09:00');
    setDurationMin('60');
    setTitle('Training session');
    setMemberQuery('');
    setComposerOpen(true);
  }, [selectedDay]);

  useLayoutEffect(() => {
    navigation.setOptions({
      headerRight: () => (
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 14, marginRight: 12 }}>
          <TapButton onPress={() => openComposer()} accessibilityLabel="Add appointment">
            <Text style={{ color: colors.accent, fontWeight: '700' }}>+ Add</Text>
          </TapButton>
          <TapButton onPress={() => void logout()} accessibilityLabel="Sign out">
            <Text style={{ color: colors.accent, fontWeight: '600' }}>Sign out</Text>
          </TapButton>
        </View>
      ),
    });
  }, [navigation, openComposer, logout]);


  const load = useCallback(async () => {
    const [cal, me, mem] = await Promise.all([
      api<Apt[]>('/api/mobile/calendar?scope=all'),
      api<{ locations: Location[] }>('/api/mobile/me'),
      api<Member[]>('/api/mobile/members'),
    ]);
    setRows(cal);
    setLocations(me.locations || []);
    if (!locationId && me.locations?.[0]) setLocationId(me.locations[0].id);
    setMembers(mem);
    if (!memberId && mem[0]) setMemberId(mem[0].id);
  }, [locationId, memberId]);

  useFocusEffect(
    useCallback(() => {
      void load().catch((e) => setError(e instanceof Error ? e.message : 'Load failed'));
    }, [load]),
  );

  useLayoutEffect(() => {
    if (Platform.OS !== 'web' || typeof window === 'undefined') return;
    if (new URLSearchParams(window.location.search).get('openAdd') === '1') {
      openComposer();
    }
  }, [openComposer]);

  const byDay = useMemo(() => {
    const map = new Map<string, Apt[]>();
    for (const a of rows) {
      const key = ymd(new Date(a.startsAt));
      const list = map.get(key) || [];
      list.push(a);
      map.set(key, list);
    }
    return map;
  }, [rows]);

  const dayAppointments = byDay.get(selectedDay) || [];

  const filteredMembers = useMemo(() => {
    const q = memberQuery.trim().toLowerCase();
    if (!q) return members;
    return members.filter((m) => `${m.firstName} ${m.lastName}`.toLowerCase().includes(q));
  }, [memberQuery, members]);

  async function saveAppointment() {
    try {
      setSaving(true);
      setError(null);
      if (!memberId) throw new Error('Tag a member for this appointment');
      if (!locationId) throw new Error('Choose a location');
      const start = combineLocal(dateValue, timeValue);
      if (!start) throw new Error('Use date YYYY-MM-DD and time HH:MM');
      const mins = Number(durationMin) || 60;
      const end = new Date(start.getTime() + mins * 60 * 1000);
      await api('/api/mobile/calendar/book', {
        method: 'POST',
        body: JSON.stringify({
          title: title.trim() || 'Training session',
          startsAt: start.toISOString(),
          endsAt: end.toISOString(),
          locationId,
          memberId,
          scheduled: true,
        }),
      });
      setComposerOpen(false);
      setSelectedDay(dateValue);
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not save appointment');
    } finally {
      setSaving(false);
    }
  }

  const year = cursor.getFullYear();
  const month = cursor.getMonth();
  const matrix = monthMatrix(year, month);
  const monthLabel = cursor.toLocaleString(undefined, { month: 'long', year: 'numeric' });

  return (
    <View style={styles.root}>
      <View style={styles.headerRow}>
        <View style={{ flex: 1 }}>
          <Text style={styles.title}>Home</Text>
          <Text style={styles.sub}>All appointments on your calendar</Text>
        </View>
        <TapButton
          style={styles.addBtn}
          onPress={() => openComposer()}
          accessibilityLabel="Add appointment"
        >
          <Text style={styles.addBtnText}>+ Add</Text>
        </TapButton>
      </View>

      <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
        {error && !composerOpen ? <Text style={styles.error}>{error}</Text> : null}

        <View style={styles.calCard}>
          <View style={styles.calNav}>
            <Pressable
              onPress={() => setCursor(new Date(year, month - 1, 1))}
              hitSlop={8}
            >
              <Text style={styles.navArrow}>‹</Text>
            </Pressable>
            <Text style={styles.monthLabel}>{monthLabel}</Text>
            <Pressable
              onPress={() => setCursor(new Date(year, month + 1, 1))}
              hitSlop={8}
            >
              <Text style={styles.navArrow}>›</Text>
            </Pressable>
          </View>

          <View style={styles.weekRow}>
            {WEEKDAYS.map((d) => (
              <Text key={d} style={styles.weekday}>
                {d}
              </Text>
            ))}
          </View>

          {matrix.map((week, wi) => (
            <View key={`w-${wi}`} style={styles.weekRow}>
              {week.map((day, di) => {
                if (day == null) {
                  return <View key={`e-${wi}-${di}`} style={styles.dayCell} />;
                }
                const key = ymd(new Date(year, month, day));
                const selected = key === selectedDay;
                const isToday = key === ymd(today);
                const count = byDay.get(key)?.length || 0;
                return (
                  <Pressable
                    key={key}
                    style={[
                      styles.dayCell,
                      selected && styles.daySelected,
                      isToday && !selected && styles.dayToday,
                    ]}
                    onPress={() => setSelectedDay(key)}
                    onLongPress={() => openComposer(key)}
                  >
                    <Text
                      style={[
                        styles.dayNum,
                        selected && styles.dayNumSelected,
                        isToday && !selected && styles.dayNumToday,
                      ]}
                    >
                      {day}
                    </Text>
                    {count > 0 ? (
                      <View style={styles.dotRow}>
                        {Array.from({ length: Math.min(count, 3) }).map((_, i) => (
                          <View
                            key={i}
                            style={[styles.dot, selected && styles.dotSelected]}
                          />
                        ))}
                      </View>
                    ) : (
                      <View style={styles.dotPlaceholder} />
                    )}
                  </Pressable>
                );
              })}
            </View>
          ))}
        </View>

        <View style={styles.dayHeader}>
          <Text style={styles.dayTitle}>
            {parseYmd(selectedDay)?.toLocaleDateString(undefined, {
              weekday: 'long',
              month: 'short',
              day: 'numeric',
            }) || selectedDay}
          </Text>
          <TapButton onPress={() => openComposer(selectedDay)}>
            <Text style={styles.link}>New appointment</Text>
          </TapButton>
        </View>

        {dayAppointments.length === 0 ? (
          <View style={styles.emptyCard}>
            <Text style={styles.emptyText}>No appointments this day</Text>
            <TapButton style={styles.primary} onPress={() => openComposer(selectedDay)}>
              <Text style={styles.primaryText}>Add appointment</Text>
            </TapButton>
          </View>
        ) : (
          dayAppointments.map((a) => (
            <View key={a.id} style={styles.aptCard}>
              <Text style={styles.aptTime}>
                {new Date(a.startsAt).toLocaleTimeString(undefined, {
                  hour: '2-digit',
                  minute: '2-digit',
                })}
                {' – '}
                {new Date(a.endsAt).toLocaleTimeString(undefined, {
                  hour: '2-digit',
                  minute: '2-digit',
                })}
              </Text>
              <Text style={styles.aptTitle}>{a.title}</Text>
              <Text style={styles.aptMeta}>
                {a.member ? `${a.member.firstName} ${a.member.lastName}` : 'Untagged'}
                {a.coach ? ` · ${a.coach.name}` : ''}
              </Text>
              <Text style={styles.badge}>{a.requestStatus || a.status}</Text>
            </View>
          ))
        )}
      </ScrollView>

      {composerOpen ? (
        <View style={styles.modalBackdrop} pointerEvents="box-none">
          <View style={styles.modalSheet}>
            <ScrollView
              keyboardShouldPersistTaps="handled"
              contentContainerStyle={{ gap: 8, paddingBottom: 12 }}
            >
              <Text style={styles.modalTitle}>New appointment</Text>
              <Text style={styles.label}>Title</Text>
              <TextInput style={styles.input} value={title} onChangeText={setTitle} />
              <Text style={styles.label}>Date (YYYY-MM-DD)</Text>
              <TextInput
                style={styles.input}
                value={dateValue}
                onChangeText={setDateValue}
                autoCapitalize="none"
                placeholder="2026-08-18"
                placeholderTextColor={colors.muted}
              />
              <Text style={styles.label}>Time (HH:MM)</Text>
              <TextInput
                style={styles.input}
                value={timeValue}
                onChangeText={setTimeValue}
                autoCapitalize="none"
                placeholder="09:00"
                placeholderTextColor={colors.muted}
              />
              <Text style={styles.label}>Duration (minutes)</Text>
              <TextInput
                style={styles.input}
                value={durationMin}
                onChangeText={setDurationMin}
                keyboardType="number-pad"
              />

              <Text style={styles.label}>Tag member</Text>
              <TextInput
                style={styles.input}
                value={memberQuery}
                onChangeText={setMemberQuery}
                placeholder="Search members"
                placeholderTextColor={colors.muted}
              />
              <View style={styles.memberList}>
                {filteredMembers.map((m) => (
                  <Pressable
                    key={m.id}
                    onPress={() => setMemberId(m.id)}
                    style={styles.memberRow}
                    accessibilityRole="button"
                  >
                    <Text style={{ color: memberId === m.id ? colors.accent : colors.ink2 }}>
                      {memberId === m.id ? '● ' : '○ '}
                      {m.firstName} {m.lastName}
                    </Text>
                  </Pressable>
                ))}
              </View>

              <Text style={styles.label}>Location</Text>
              {locations.map((l) => (
                <Pressable
                  key={l.id}
                  onPress={() => setLocationId(l.id)}
                  style={styles.memberRow}
                  accessibilityRole="button"
                >
                  <Text style={{ color: locationId === l.id ? colors.accent : colors.ink2 }}>
                    {locationId === l.id ? '● ' : '○ '}
                    {l.name}
                  </Text>
                </Pressable>
              ))}

              {error ? <Text style={styles.error}>{error}</Text> : null}

              <View style={styles.modalActions}>
                <Pressable
                  style={styles.ghost}
                  onPress={() => setComposerOpen(false)}
                  accessibilityRole="button"
                >
                  <Text style={styles.ghostText}>Cancel</Text>
                </Pressable>
                <Pressable
                  style={[styles.primary, { flex: 1 }, saving && { opacity: 0.6 }]}
                  disabled={saving}
                  onPress={() => void saveAppointment()}
                  accessibilityRole="button"
                >
                  <Text style={styles.primaryText}>{saving ? 'Saving…' : 'Save appointment'}</Text>
                </Pressable>
              </View>
            </ScrollView>
          </View>
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.paper },
  content: { padding: 16, gap: 12, paddingBottom: 40, paddingTop: 8 },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 12,
    paddingHorizontal: 16,
    paddingTop: 16,
    paddingBottom: 4,
    backgroundColor: colors.paper,
  },
  title: { fontSize: 24, fontWeight: '700', color: colors.ink },
  sub: { color: colors.muted, marginTop: 2 },
  addBtn: {
    backgroundColor: colors.accent,
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 10,
  },
  addBtnText: { color: '#fff', fontWeight: '700' },
  calCard: {
    backgroundColor: colors.white,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: colors.rule,
    padding: 12,
    gap: 6,
  },
  calNav: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 4,
  },
  navArrow: { fontSize: 28, color: colors.accent, paddingHorizontal: 8, fontWeight: '600' },
  monthLabel: { fontSize: 16, fontWeight: '700', color: colors.ink },
  weekRow: { flexDirection: 'row' },
  weekday: {
    flex: 1,
    textAlign: 'center',
    color: colors.muted,
    fontSize: 11,
    fontWeight: '600',
    paddingVertical: 4,
  },
  dayCell: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: 8,
    borderRadius: 10,
    minHeight: 44,
  },
  daySelected: { backgroundColor: colors.accent },
  dayToday: { backgroundColor: colors.accentSoft },
  dayNum: { color: colors.ink2, fontWeight: '600', fontSize: 14 },
  dayNumSelected: { color: '#fff' },
  dayNumToday: { color: colors.accent },
  dotRow: { flexDirection: 'row', gap: 2, marginTop: 4, minHeight: 6 },
  dotPlaceholder: { height: 6, marginTop: 4 },
  dot: {
    width: 5,
    height: 5,
    borderRadius: 3,
    backgroundColor: colors.accent,
  },
  dotSelected: { backgroundColor: '#fff' },
  dayHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 4,
  },
  dayTitle: { fontSize: 16, fontWeight: '700', color: colors.ink },
  link: { color: colors.accent, fontWeight: '600' },
  emptyCard: {
    backgroundColor: colors.white,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.rule,
    padding: 16,
    gap: 12,
    alignItems: 'flex-start',
  },
  emptyText: { color: colors.muted },
  aptCard: {
    backgroundColor: colors.white,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.rule,
    padding: 14,
    gap: 4,
  },
  aptTime: { color: colors.accent, fontWeight: '700', fontSize: 13 },
  aptTitle: { color: colors.ink, fontWeight: '700', fontSize: 16 },
  aptMeta: { color: colors.muted, fontSize: 13 },
  badge: {
    alignSelf: 'flex-start',
    marginTop: 4,
    backgroundColor: colors.accentSoft,
    color: colors.accent,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
    overflow: 'hidden',
    fontSize: 12,
    fontWeight: '600',
  },
  primary: {
    backgroundColor: colors.accent,
    borderRadius: 8,
    paddingVertical: 12,
    paddingHorizontal: 16,
    alignItems: 'center',
  },
  primaryText: { color: '#fff', fontWeight: '700' },
  ghost: { alignItems: 'center', justifyContent: 'center', paddingHorizontal: 12 },
  ghostText: { color: colors.accent, fontWeight: '600' },
  error: { color: colors.danger },
  modalBackdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(27,36,48,0.45)',
    justifyContent: 'flex-end',
    zIndex: 50,
  },
  modalSheet: {
    backgroundColor: colors.white,
    borderTopLeftRadius: 16,
    borderTopRightRadius: 16,
    padding: 16,
    maxHeight: '92%',
  },
  modalTitle: { fontSize: 18, fontWeight: '700', color: colors.ink, marginBottom: 4 },
  label: { color: colors.muted, fontSize: 12, textTransform: 'uppercase', marginTop: 4 },
  input: {
    borderWidth: 1,
    borderColor: colors.rule,
    borderRadius: 8,
    padding: 10,
    color: colors.ink,
  },
  memberList: { maxHeight: 140 },
  memberRow: { paddingVertical: 6 },
  modalActions: { flexDirection: 'row', gap: 8, marginTop: 8, marginBottom: 8 },
});
