import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { View, Text, StyleSheet } from 'react-native';
import { useAuth } from '../context/AuthContext';

// Screens
import LoginScreen    from '../screens/LoginScreen';
import SignupScreen   from '../screens/SignupScreen';
import JobsScreen     from '../screens/JobsScreen';
import EarningsScreen from '../screens/EarningsScreen';
import AvailabilityScreen from '../screens/AvailabilityScreen';
import ProfileScreen  from '../screens/ProfileScreen';
import JobDetailScreen from '../screens/JobDetailScreen';
import ChatScreen      from '../screens/ChatScreen';

const Stack = createNativeStackNavigator();
const Tab   = createBottomTabNavigator();
const TEAL  = '#0F6E56';
const GRAY  = '#9CA3AF';

function TabIcon({ label, emoji, focused }) {
  return (
    <View style={{ alignItems: 'center', gap: 3 }}>
      <Text style={{ fontSize: 20, opacity: focused ? 1 : 0.5 }}>{emoji}</Text>
      <Text style={{ fontSize: 10, color: focused ? TEAL : GRAY, fontWeight: focused ? '700' : '400' }}>{label}</Text>
    </View>
  );
}

function MainTabs() {
  return (
    <Tab.Navigator screenOptions={{ headerShown: false, tabBarStyle: { height: 72, paddingBottom: 12, borderTopWidth: 0.5, borderTopColor: '#E2E8E6' }, tabBarShowLabel: false }}>
      <Tab.Screen name="Jobs"         component={JobsScreen}         options={{ tabBarIcon: ({ focused }) => <TabIcon label="Jobs"      emoji="📋" focused={focused} /> }} />
      <Tab.Screen name="Earnings"     component={EarningsScreen}     options={{ tabBarIcon: ({ focused }) => <TabIcon label="Earnings"  emoji="💰" focused={focused} /> }} />
      <Tab.Screen name="Availability" component={AvailabilityScreen} options={{ tabBarIcon: ({ focused }) => <TabIcon label="Schedule"  emoji="🗓" focused={focused} /> }} />
      <Tab.Screen name="Profile"      component={ProfileScreen}      options={{ tabBarIcon: ({ focused }) => <TabIcon label="Profile"   emoji="☆"  focused={focused} /> }} />
    </Tab.Navigator>
  );
}

export default function RootNavigator() {
  const { user, loading } = useAuth();
  if (loading) return null;
  return (
    <Stack.Navigator screenOptions={{ headerShown: false }}>
      {!user ? (
        <>
          <Stack.Screen name="Login"  component={LoginScreen} />
          <Stack.Screen name="Signup" component={SignupScreen} />
        </>
      ) : (
        <>
          <Stack.Screen name="Main"      component={MainTabs} />
          <Stack.Screen name="JobDetail" component={JobDetailScreen} options={{ presentation: 'card' }} />
          <Stack.Screen name="Chat"      component={ChatScreen} />
        </>
      )}
    </Stack.Navigator>
  );
}
