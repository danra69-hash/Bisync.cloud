import React, { useRef, useState } from 'react';
import { Alert, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { CameraView, useCameraPermissions } from 'expo-camera';
import { useNavigation, useRoute } from '@react-navigation/native';
import type { RouteProp } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { api } from '../api';
import { colors } from '../theme';
import type { RootStackParamList } from '../navigation';

export function ScanScreen() {
  const route = useRoute<RouteProp<RootStackParamList, 'Scan'>>();
  const nav = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const params = route.params || {};
  const isCoachStamp = params.purpose === 'coachStamp';
  const [permission, requestPermission] = useCameraPermissions();
  const [manual, setManual] = useState('');
  const [mode, setMode] = useState<'attendance' | 'end'>(
    params.purpose === 'end' ? 'end' : 'attendance',
  );
  const [busy, setBusy] = useState(false);
  const scannedRef = useRef(false);

  async function confirm(payload: string) {
    if (!payload || busy || scannedRef.current) return;
    scannedRef.current = true;
    setBusy(true);
    try {
      if (isCoachStamp) {
        const res = await api<{
          stampId: string;
          memberId: string;
          locationId: string;
        }>('/api/mobile/attendance/stamp/coach-scan', {
          method: 'POST',
          body: JSON.stringify({
            memberPackageId: params.memberPackageId,
            stampIndex: params.stampIndex,
            locationId: params.locationId,
            qrPayload: payload,
          }),
        });
        Alert.alert(
          'Stamp used',
          `Session stamped for ${params.memberName || 'member'}. Start training now?`,
          [
            {
              text: 'Later',
              style: 'cancel',
              onPress: () => nav.navigate('MainTabs'),
            },
            {
              text: 'Start training',
              onPress: () =>
                nav.navigate('MainTabs', {
                  screen: 'Training',
                  params: {
                    memberId: res.memberId,
                    stampId: res.stampId,
                    locationId: res.locationId,
                    autoStart: true,
                    memberName: params.memberName,
                  },
                }),
            },
          ],
        );
        return;
      }

      if (mode === 'attendance') {
        const res = await api<{ stampId: string; memberId?: string }>(
          '/api/mobile/attendance/confirm',
          { method: 'POST', body: JSON.stringify({ qrPayload: payload }) },
        );
        Alert.alert(
          'Attendance confirmed',
          `Stamp ${res.stampId}${res.memberId ? `\nMember ${res.memberId}` : ''}`,
        );
      } else {
        await api('/api/mobile/training/end/confirm', {
          method: 'POST',
          body: JSON.stringify({ qrPayload: payload }),
        });
        Alert.alert('Session counter-confirmed', 'End QR accepted.');
      }
    } catch (e) {
      scannedRef.current = false;
      Alert.alert('Confirm failed', e instanceof Error ? e.message : 'Error');
    } finally {
      setBusy(false);
    }
  }

  if (!permission?.granted) {
    return (
      <View style={styles.wrap}>
        <Text style={styles.title}>Camera permission</Text>
        <Pressable style={styles.primary} onPress={() => void requestPermission()}>
          <Text style={styles.primaryText}>Allow camera</Text>
        </Pressable>
        <ManualBox value={manual} onChange={setManual} onSubmit={() => void confirm(manual)} />
      </View>
    );
  }

  return (
    <View style={styles.wrap}>
      <Text style={styles.title}>
        {isCoachStamp ? `Scan ${params.memberName || 'member'} QR` : 'Scan QR'}
      </Text>
      {isCoachStamp ? (
        <Text style={styles.sub}>
          Stamp #{params.stampIndex} — scan the member check-in QR (PULSEMEMBER|…) or their stamp
          QR.
        </Text>
      ) : (
        <View style={styles.segment}>
          <Pressable
            style={[styles.segBtn, mode === 'attendance' && styles.segOn]}
            onPress={() => setMode('attendance')}
          >
            <Text>Attendance</Text>
          </Pressable>
          <Pressable
            style={[styles.segBtn, mode === 'end' && styles.segOn]}
            onPress={() => setMode('end')}
          >
            <Text>End session</Text>
          </Pressable>
        </View>
      )}
      <CameraView
        style={styles.camera}
        barcodeScannerSettings={{ barcodeTypes: ['qr'] }}
        onBarcodeScanned={({ data }) => void confirm(data)}
      />
      <ManualBox value={manual} onChange={setManual} onSubmit={() => void confirm(manual)} />
    </View>
  );
}

function ManualBox({
  value,
  onChange,
  onSubmit,
}: {
  value: string;
  onChange: (v: string) => void;
  onSubmit: () => void;
}) {
  return (
    <View style={{ gap: 8, marginTop: 12 }}>
      <Text style={{ color: colors.muted }}>Or paste QR payload</Text>
      <TextInput
        style={styles.input}
        value={value}
        onChangeText={onChange}
        autoCapitalize="none"
        placeholder="PULSEMEMBER|mem_… or PULSE|…"
        placeholderTextColor={colors.muted}
      />
      <Pressable style={styles.primary} onPress={onSubmit}>
        <Text style={styles.primaryText}>Confirm payload</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { flex: 1, backgroundColor: colors.paper, padding: 16 },
  title: { fontSize: 22, fontWeight: '700', color: colors.ink, marginBottom: 8 },
  sub: { color: colors.muted, marginBottom: 8 },
  camera: { height: 280, borderRadius: 12, overflow: 'hidden' },
  primary: {
    backgroundColor: colors.accent,
    borderRadius: 8,
    paddingVertical: 12,
    alignItems: 'center',
  },
  primaryText: { color: '#fff', fontWeight: '700' },
  input: {
    borderWidth: 1,
    borderColor: colors.rule,
    borderRadius: 8,
    padding: 10,
    backgroundColor: colors.white,
    color: colors.ink,
  },
  segment: { flexDirection: 'row', gap: 8, marginBottom: 8 },
  segBtn: {
    flex: 1,
    borderWidth: 1,
    borderColor: colors.rule,
    borderRadius: 8,
    padding: 10,
    alignItems: 'center',
    backgroundColor: colors.white,
  },
  segOn: { backgroundColor: colors.accentSoft, borderColor: colors.accent },
});
