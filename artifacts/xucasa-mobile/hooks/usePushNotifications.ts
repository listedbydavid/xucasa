import { useEffect } from 'react';
import { Platform } from 'react-native';
import { useRouter } from 'expo-router';
import * as Notifications from 'expo-notifications';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { apiGet } from '@/lib/api';
import { useAuth } from '@/contexts/AuthContext';
import { registerPushDevice } from '@/lib/pushNotifications';

export interface NotificationPreferences {
  pushEnabled: boolean;
  pushPriceDrop: boolean;
}

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowBanner: true,
    shouldShowList: true,
    shouldPlaySound: true,
    shouldSetBadge: false,
  }),
});

export function usePushNotifications(): void {
  const router = useRouter();
  const queryClient = useQueryClient();
  const { isAuthenticated } = useAuth();
  const { data: preferences } = useQuery({
    queryKey: ['notification-preferences'],
    queryFn: () => apiGet<NotificationPreferences>('/api/notification-preferences'),
    enabled: isAuthenticated,
  });

  useEffect(() => {
    if (!isAuthenticated || preferences?.pushEnabled === false || preferences?.pushPriceDrop === false) return;
    registerPushDevice().catch((error) => {
      if (__DEV__) console.warn('[xucasa] Push registration unavailable', error);
    });
  }, [isAuthenticated, preferences?.pushEnabled, preferences?.pushPriceDrop]);

  useEffect(() => {
    if (Platform.OS === 'web') return;
    const openProperty = (response: Notifications.NotificationResponse | null) => {
      const propertyId = response?.notification.request.content.data?.propertyId;
      if (typeof propertyId === 'number' || typeof propertyId === 'string') {
        router.push(`/property/${propertyId}` as never);
      }
    };
    Notifications.getLastNotificationResponseAsync()
      .then(openProperty)
      .catch(() => undefined);
    const received = Notifications.addNotificationReceivedListener(() => {
      queryClient.invalidateQueries({ queryKey: ['notifications'] });
    });
    const responded = Notifications.addNotificationResponseReceivedListener(openProperty);
    return () => {
      received.remove();
      responded.remove();
    };
  }, [queryClient, router]);
}