import { Platform } from 'react-native';
import Constants from 'expo-constants';
import * as Notifications from 'expo-notifications';
import * as SecureStore from 'expo-secure-store';
import { apiDelete, apiPost } from '@/lib/api';

const PUSH_TOKEN_KEY = 'xucasa.expo_push_token';
const PENDING_PUSH_TOKEN_KEY = 'xucasa.pending_push_token_removal';

export async function registerPushDevice(): Promise<void> {
  if (Platform.OS === 'web') return;
  if (Platform.OS === 'android') {
    await Notifications.setNotificationChannelAsync('price-drops', {
      name: 'Price drop alerts',
      importance: Notifications.AndroidImportance.HIGH,
      sound: 'default',
    });
  }

  const current = await Notifications.getPermissionsAsync();
  const permission = current.status === 'granted'
    ? current
    : await Notifications.requestPermissionsAsync();
  if (permission.status !== 'granted') return;

  const projectId =
    Constants.easConfig?.projectId ??
    (Constants.expoConfig?.extra?.eas?.projectId as string | undefined);
  const result = await Notifications.getExpoPushTokenAsync(
    projectId ? { projectId } : undefined,
  );
  const previousToken = await SecureStore.getItemAsync(PUSH_TOKEN_KEY);
  if (previousToken && previousToken !== result.data) {
    await apiDelete(`/api/push-tokens/${encodeURIComponent(previousToken)}`).catch(() => undefined);
  }
  await apiPost<{ registered: true }>('/api/push-tokens', {
    token: result.data,
    platform: Platform.OS,
  });
  await SecureStore.setItemAsync(PUSH_TOKEN_KEY, result.data);
  await SecureStore.deleteItemAsync(PENDING_PUSH_TOKEN_KEY);
}

export async function unregisterPushDevice(): Promise<void> {
  if (Platform.OS === 'web') return;
  const token = await SecureStore.getItemAsync(PUSH_TOKEN_KEY);
  if (!token) return;
  try {
    await apiDelete(`/api/push-tokens/${encodeURIComponent(token)}`);
    await SecureStore.deleteItemAsync(PENDING_PUSH_TOKEN_KEY);
  } catch (error) {
    await SecureStore.setItemAsync(PENDING_PUSH_TOKEN_KEY, token);
    throw error;
  } finally {
    await SecureStore.deleteItemAsync(PUSH_TOKEN_KEY);
  }
}

export async function retryPendingPushUnregistration(): Promise<void> {
  if (Platform.OS === 'web') return;
  const pendingToken = await SecureStore.getItemAsync(PENDING_PUSH_TOKEN_KEY);
  if (!pendingToken) return;
  await apiDelete(`/api/push-tokens/${encodeURIComponent(pendingToken)}`);
  await SecureStore.deleteItemAsync(PENDING_PUSH_TOKEN_KEY);
}