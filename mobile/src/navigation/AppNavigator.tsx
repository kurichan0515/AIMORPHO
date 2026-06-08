import React from 'react';
import { Text } from 'react-native';
import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { useAuthStore } from '../store/useAuthStore';
import HomeScreen from '../screens/HomeScreen';
import WeightLogScreen from '../screens/WeightLogScreen';
import MealLogScreen from '../screens/MealLogScreen';
import ExerciseLogScreen from '../screens/ExerciseLogScreen';
import AvatarSetupScreen from '../screens/AvatarSetupScreen';
import BadgesScreen from '../screens/BadgesScreen';
import GroupScreen from '../screens/GroupScreen';
import ProfileScreen from '../screens/ProfileScreen';
import LoginScreen from '../screens/LoginScreen';
import RegisterScreen from '../screens/RegisterScreen';
import OnboardingProfileScreen from '../screens/OnboardingProfileScreen';
import OnboardingGoalScreen from '../screens/OnboardingGoalScreen';
import OnboardingAvatarScreen from '../screens/OnboardingAvatarScreen';

const Stack = createNativeStackNavigator();
const Tab = createBottomTabNavigator();
const LogStack = createNativeStackNavigator();
const OnboardingStack = createNativeStackNavigator();

function LogStackNavigator() {
  return (
    <LogStack.Navigator>
      <LogStack.Screen name="WeightLog"   component={WeightLogScreen}   options={{ title: '体重' }} />
      <LogStack.Screen name="MealLog"     component={MealLogScreen}     options={{ title: '食事' }} />
      <LogStack.Screen name="ExerciseLog" component={ExerciseLogScreen} options={{ title: '運動' }} />
    </LogStack.Navigator>
  );
}

const TAB_ICONS: Record<string, string> = {
  ホーム: '🏠', 記録: '📊', アバター: '🧑', グループ: '👥', プロフィール: '⚙️',
};

function MainTabs() {
  return (
    <Tab.Navigator
      screenOptions={({ route }) => ({
        tabBarIcon: () => <Text style={{ fontSize: 20 }}>{TAB_ICONS[route.name] || '●'}</Text>,
        tabBarActiveTintColor: '#007AFF',
        tabBarInactiveTintColor: '#999',
        headerShown: false,
      })}
    >
      <Tab.Screen name="ホーム"       component={HomeScreen} />
      <Tab.Screen name="記録"         component={LogStackNavigator} />
      <Tab.Screen name="アバター"     component={AvatarSetupScreen} />
      <Tab.Screen name="グループ"     component={GroupScreen} />
      <Tab.Screen name="プロフィール" component={ProfileScreen} />
    </Tab.Navigator>
  );
}

function OnboardingNavigator() {
  return (
    <OnboardingStack.Navigator screenOptions={{ headerShown: false }}>
      <OnboardingStack.Screen name="OnboardingProfile" component={OnboardingProfileScreen} />
      <OnboardingStack.Screen name="OnboardingGoal"    component={OnboardingGoalScreen} />
      <OnboardingStack.Screen name="OnboardingAvatar"  component={OnboardingAvatarScreen} />
    </OnboardingStack.Navigator>
  );
}

export default function AppNavigator() {
  const { isLoggedIn, onboardingCompleted } = useAuthStore();

  return (
    <NavigationContainer>
      <Stack.Navigator screenOptions={{ headerShown: false }}>
        {!isLoggedIn ? (
          <>
            <Stack.Screen name="Login"    component={LoginScreen} />
            <Stack.Screen name="Register" component={RegisterScreen} />
          </>
        ) : !onboardingCompleted ? (
          <Stack.Screen name="Onboarding" component={OnboardingNavigator} />
        ) : (
          <>
            <Stack.Screen name="Main"   component={MainTabs} />
            <Stack.Screen name="Badges" component={BadgesScreen} options={{ headerShown: true, title: 'バッジ一覧' }} />
          </>
        )}
      </Stack.Navigator>
    </NavigationContainer>
  );
}
