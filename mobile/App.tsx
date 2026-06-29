import React, { useEffect } from 'react';
import { Alert } from 'react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { useAuthStore } from './src/store/useAuthStore';
import AppNavigator from './src/navigation/AppNavigator';
import { setupNotificationHandlers, checkInitialNotification } from './src/utils/notifications';
import ErrorBoundary from './src/components/ErrorBoundary';

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: 2,
      staleTime: 1000 * 60 * 5,
    },
    mutations: {
      retry: 0,
      onError: (err: any) => {
        // 401/403 はスクリーン側で処理済み。それ以外の予期しないmutationエラーをグローバルキャッチ
        if (err?.response?.status >= 500) {
          Alert.alert('サーバーエラー', 'しばらく経ってから再度お試しください。');
        }
      },
    },
  },
});

export default function App() {
  const init = useAuthStore(s => s.init);
  useEffect(() => {
    init();
    try {
      setupNotificationHandlers();
      checkInitialNotification();
    } catch (e) {
      console.warn('Firebase notifications unavailable:', e);
    }
  }, []);

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <QueryClientProvider client={queryClient}>
        <ErrorBoundary>
          <AppNavigator />
        </ErrorBoundary>
      </QueryClientProvider>
    </GestureHandlerRootView>
  );
}
