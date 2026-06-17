import React from 'react';
import { View, ActivityIndicator } from 'react-native';
import { HomeIcon, RecordIcon, BadgeIcon, GroupIcon, SettingsIcon } from '../components/ui/icons';
import { colors } from '../theme/colors';
import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { useAuthStore } from '../store/useAuthStore';
import HomeScreen from '../screens/HomeScreen';
import LogScreen from '../screens/LogScreen';
import AvatarSetupScreen from '../screens/AvatarSetupScreen';
import BadgesScreen from '../screens/BadgesScreen';
import GroupScreen from '../screens/GroupScreen';
import ProfileScreen from '../screens/ProfileScreen';
import LoginScreen from '../screens/LoginScreen';
import RegisterScreen from '../screens/RegisterScreen';
import OnboardingWelcomeScreen from '../screens/OnboardingWelcomeScreen';
import OnboardingProfileScreen from '../screens/OnboardingProfileScreen';
import OnboardingGoalScreen from '../screens/OnboardingGoalScreen';
import OnboardingAvatarScreen from '../screens/OnboardingAvatarScreen';

const Stack = createNativeStackNavigator();
const Tab = createBottomTabNavigator();
const OnboardingStack = createNativeStackNavigator();

const TAB_ICONS: Record<string, (props: { color: string; size?: number }) => React.JSX.Element> = {
  ホーム: HomeIcon, 記録: RecordIcon, リワード: BadgeIcon, グループ: GroupIcon, 設定: SettingsIcon,
};

function MainTabs() {
  return (
    <Tab.Navigator
      screenOptions={({ route }) => ({
        tabBarIcon: ({ color, size }) => {
          const Icon = TAB_ICONS[route.name];
          return Icon ? <Icon color={color} size={size} /> : null;
        },
        tabBarActiveTintColor: colors.neon.blue,
        tabBarInactiveTintColor: colors.text.muted,
        tabBarStyle: {
          backgroundColor: colors.bg.navBar,
          borderTopColor: colors.border.subtle,
          borderTopWidth: 1,
        },
        headerShown: false,
      })}
    >
      <Tab.Screen name="ホーム"   component={HomeScreen} />
      <Tab.Screen name="記録"     component={LogScreen} />
      <Tab.Screen name="リワード" component={BadgesScreen} />
      <Tab.Screen name="グループ" component={GroupScreen} />
      <Tab.Screen name="設定"     component={ProfileScreen} />
    </Tab.Navigator>
  );
}

function OnboardingNavigator() {
  return (
    <OnboardingStack.Navigator screenOptions={{ headerShown: false }}>
      <OnboardingStack.Screen name="OnboardingWelcome" component={OnboardingWelcomeScreen} />
      <OnboardingStack.Screen name="OnboardingProfile" component={OnboardingProfileScreen} />
      <OnboardingStack.Screen name="OnboardingGoal"    component={OnboardingGoalScreen} />
      <OnboardingStack.Screen name="OnboardingAvatar"  component={OnboardingAvatarScreen} />
    </OnboardingStack.Navigator>
  );
}

export default function AppNavigator() {
  const { isInitialized, onboardingCompleted } = useAuthStore();

  if (!isInitialized) {
    return (
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: colors.bg.primary }}>
        <ActivityIndicator size="large" color={colors.neon.blue} />
      </View>
    );
  }

  return (
    <NavigationContainer>
      <Stack.Navigator screenOptions={{ headerShown: false }}>
        {!onboardingCompleted ? (
          <Stack.Screen name="Onboarding" component={OnboardingNavigator} />
        ) : (
          <>
            <Stack.Screen name="Main"       component={MainTabs} />
            <Stack.Screen name="AvatarSetup" component={AvatarSetupScreen} options={{ headerShown: true, title: 'アバター設定' }} />
            <Stack.Screen name="Login"    component={LoginScreen}   options={{ headerShown: true, title: '既存アカウントでログイン' }} />
            <Stack.Screen name="Register" component={RegisterScreen} options={{ headerShown: true, title: 'アカウント登録' }} />
          </>
        )}
      </Stack.Navigator>
    </NavigationContainer>
  );
}
