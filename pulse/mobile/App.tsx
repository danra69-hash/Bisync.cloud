import React from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';
import { NavigationContainer, DefaultTheme } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { StatusBar } from 'expo-status-bar';
import { AuthProvider, useAuth } from './src/AuthContext';
import { LoginScreen } from './src/screens/LoginScreen';
import { PinScreen } from './src/screens/PinScreen';
import { HomeScreen } from './src/screens/HomeScreen';
import { TrainingScreen } from './src/screens/TrainingScreen';
import { CalendarScreen } from './src/screens/CalendarScreen';
import { PackagesScreen } from './src/screens/PackagesScreen';
import { ScanScreen } from './src/screens/ScanScreen';
import { colors } from './src/theme';
import type { MainTabParamList, RootStackParamList } from './src/navigation';

const Stack = createNativeStackNavigator<RootStackParamList>();
const Tabs = createBottomTabNavigator<MainTabParamList>();

function MainTabs() {
  const { logout, user } = useAuth();
  const isCoach = user?.type === 'coach';
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
        tabBarStyle: { backgroundColor: colors.white, borderTopColor: colors.rule },
      }}
    >
      {isCoach ? (
        <Tabs.Screen
          name="Home"
          component={HomeScreen}
          options={{ title: 'Home', tabBarLabel: 'Home' }}
        />
      ) : null}
      <Tabs.Screen
        name="Training"
        component={TrainingScreen}
        options={{ title: user?.type === 'coach' ? 'Coach training' : 'My training' }}
      />
      <Tabs.Screen name="Calendar" component={CalendarScreen} />
      <Tabs.Screen
        name="Packages"
        component={PackagesScreen}
        options={{ title: 'Packages & stamps' }}
      />
    </Tabs.Navigator>
  );
}

function Root() {
  const { user, loading, pinOk } = useAuth();

  if (loading) {
    return (
      <View style={styles.boot}>
        <ActivityIndicator color={colors.accent} />
        <Text style={styles.bootText}>mobile.pulse</Text>
      </View>
    );
  }

  if (!user) return <LoginScreen />;
  if (!pinOk) return <PinScreen />;

  return (
    <NavigationContainer theme={DefaultTheme}>
      <Stack.Navigator>
        <Stack.Screen name="MainTabs" component={MainTabs} options={{ headerShown: false }} />
        <Stack.Screen name="Scan" component={ScanScreen} options={{ title: 'Scan QR' }} />
      </Stack.Navigator>
    </NavigationContainer>
  );
}

export default function App() {
  return (
    <AuthProvider>
      <StatusBar style="dark" />
      <Root />
    </AuthProvider>
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
