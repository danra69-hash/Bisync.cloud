import React, { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  View,
  useWindowDimensions,
} from 'react-native';
import { NavigationContainer, DefaultTheme } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { SafeAreaProvider, useSafeAreaInsets } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import { AuthProvider, useAuth } from './src/AuthContext';
import { LoginScreen } from './src/screens/LoginScreen';
import { PinScreen } from './src/screens/PinScreen';
import { TrainingScreen } from './src/screens/TrainingScreen';
import { CalendarScreen } from './src/screens/CalendarScreen';
import { PackagesScreen } from './src/screens/PackagesScreen';
import { ScanScreen } from './src/screens/ScanScreen';
import { colors } from './src/theme';
import type { MainTabParamList, RootStackParamList } from './src/navigation';

const Stack = createNativeStackNavigator<RootStackParamList>();
const Tabs = createBottomTabNavigator<MainTabParamList>();

/** Content row for icons+labels; extra bottom pad clears browser chrome / home indicator. */
const TAB_BAR_CONTENT = 52;
/** When safe-area reports 0 (common on Android Chrome), still lift the bar. */
const TAB_BAR_MIN_BOTTOM_WEB = 28;

/**
 * Mobile browsers often report layout height taller than what's visible
 * (URL bar / bottom toolbar). Bind the app shell to visualViewport height.
 */
function useVisibleHeight() {
  const { height: windowHeight } = useWindowDimensions();
  const [height, setHeight] = useState(windowHeight);

  useEffect(() => {
    if (Platform.OS !== 'web' || typeof window === 'undefined') {
      setHeight(windowHeight);
      return;
    }

    const apply = () => {
      const vv = window.visualViewport;
      const next = Math.floor(vv?.height || window.innerHeight || windowHeight);
      setHeight(next > 0 ? next : windowHeight);
    };

    apply();
    const vv = window.visualViewport;
    vv?.addEventListener('resize', apply);
    vv?.addEventListener('scroll', apply);
    window.addEventListener('resize', apply);
    window.addEventListener('orientationchange', apply);
    return () => {
      vv?.removeEventListener('resize', apply);
      vv?.removeEventListener('scroll', apply);
      window.removeEventListener('resize', apply);
      window.removeEventListener('orientationchange', apply);
    };
  }, [windowHeight]);

  return height;
}

function MainTabs() {
  const { logout, user } = useAuth();
  const insets = useSafeAreaInsets();
  const bottomPad =
    Platform.OS === 'web'
      ? Math.max(insets.bottom, TAB_BAR_MIN_BOTTOM_WEB)
      : Math.max(insets.bottom, 8);

  return (
    <Tabs.Navigator
      screenOptions={{
        headerStyle: { backgroundColor: colors.paper },
        headerTitleStyle: { color: colors.ink, fontWeight: '700' },
        headerRight: () => (
          <Pressable onPress={() => void logout()} style={{ marginRight: 12 }}>
            <Text style={{ color: colors.accent, fontWeight: '600' }}>Sign out</Text>
          </Pressable>
        ),
        tabBarActiveTintColor: colors.accent,
        tabBarInactiveTintColor: colors.muted,
        tabBarHideOnKeyboard: true,
        tabBarLabelStyle: {
          fontSize: 11,
          fontWeight: '600',
          paddingBottom: 0,
        },
        tabBarIconStyle: { marginTop: 2 },
        tabBarStyle: {
          backgroundColor: colors.white,
          borderTopColor: colors.rule,
          borderTopWidth: StyleSheet.hairlineWidth,
          height: TAB_BAR_CONTENT + bottomPad,
          paddingTop: 4,
          paddingBottom: bottomPad,
          marginBottom: 0,
          position: 'relative',
          // Avoid absolute positioning that can slide under browser chrome.
          bottom: undefined,
          left: undefined,
          right: undefined,
        },
        tabBarItemStyle: {
          justifyContent: 'center',
          paddingTop: 2,
        },
      }}
    >
      <Tabs.Screen
        name="Training"
        component={TrainingScreen}
        options={{
          title: user?.type === 'coach' ? 'Coach training' : 'My training',
          tabBarLabel: user?.type === 'coach' ? 'Training' : 'Training',
        }}
      />
      <Tabs.Screen
        name="Calendar"
        component={CalendarScreen}
        options={{ title: 'Calendar', tabBarLabel: 'Calendar' }}
      />
      <Tabs.Screen
        name="Packages"
        component={PackagesScreen}
        options={{
          title: 'Packages & stamps',
          tabBarLabel: 'Packages',
        }}
      />
    </Tabs.Navigator>
  );
}

function Root() {
  const { user, loading, pinOk } = useAuth();
  const visibleHeight = useVisibleHeight();

  if (loading) {
    return (
      <View style={[styles.boot, Platform.OS === 'web' && { height: visibleHeight }]}>
        <ActivityIndicator color={colors.accent} />
        <Text style={styles.bootText}>mobile.pulse</Text>
      </View>
    );
  }

  if (!user) {
    return (
      <View style={Platform.OS === 'web' ? { height: visibleHeight, flex: 1 } : { flex: 1 }}>
        <LoginScreen />
      </View>
    );
  }
  if (!pinOk) {
    return (
      <View style={Platform.OS === 'web' ? { height: visibleHeight, flex: 1 } : { flex: 1 }}>
        <PinScreen />
      </View>
    );
  }

  return (
    <View
      style={
        Platform.OS === 'web'
          ? { height: visibleHeight, maxHeight: visibleHeight, overflow: 'hidden', flex: 1 }
          : { flex: 1 }
      }
    >
      <NavigationContainer theme={DefaultTheme}>
        <Stack.Navigator>
          <Stack.Screen name="MainTabs" component={MainTabs} options={{ headerShown: false }} />
          <Stack.Screen name="Scan" component={ScanScreen} options={{ title: 'Scan QR' }} />
        </Stack.Navigator>
      </NavigationContainer>
    </View>
  );
}

function installWebViewport() {
  if (Platform.OS !== 'web' || typeof document === 'undefined') return () => {};
  const meta = document.querySelector('meta[name="viewport"]');
  if (meta) {
    meta.setAttribute(
      'content',
      'width=device-width, initial-scale=1, maximum-scale=1, viewport-fit=cover',
    );
  }
  const html = document.documentElement;
  const body = document.body;
  html.style.height = '100%';
  html.style.overflow = 'hidden';
  body.style.height = '100%';
  body.style.margin = '0';
  body.style.overflow = 'hidden';
  // Prefer dynamic viewport units when supported.
  body.style.minHeight = '100dvh';
  const root = document.getElementById('root');
  if (root) {
    root.style.height = '100%';
    root.style.minHeight = '100dvh';
    root.style.display = 'flex';
    root.style.flexDirection = 'column';
    root.style.overflow = 'hidden';
  }
  return () => {};
}

export default function App() {
  React.useEffect(() => installWebViewport(), []);

  return (
    <SafeAreaProvider>
      <AuthProvider>
        <StatusBar style="dark" />
        <Root />
      </AuthProvider>
    </SafeAreaProvider>
  );
}

const styles = StyleSheet.create({
  boot: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.paper,
    gap: 12,
  },
  bootText: { color: colors.ink, fontWeight: '700', fontSize: 18 },
});
