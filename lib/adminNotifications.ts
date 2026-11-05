import Constants from 'expo-constants';
import * as Device from 'expo-device';
import * as Notifications from 'expo-notifications';
import { Platform } from 'react-native';
import { authStorage } from './authStorage';
import { supabase } from './supabase';

export const ADMIN_NOTIFICATION_CHANNEL = 'incidents-urgent-v1';
const TOKEN_STORAGE_KEY = 'intervx_admin_push_token';
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export type AdminNotificationStatus = {
  supported: boolean;
  permission: 'granted' | 'denied' | 'undetermined';
  canAskAgain: boolean;
  channelBlocked: boolean;
  soundEnabled: boolean;
  registered: boolean;
};

type RegisteredToken = { token: string; userId: string; retiredTokens?: string[] };
let activeAdminUserId: string | null = null;
let handlerConfigured = false;
let pendingRegistration: Promise<void> = Promise.resolve();

export function parseAdminNotificationTarget(data: unknown, userId: string | null) {
  if (!userId || !data || typeof data !== 'object') return null;
  const value = data as Record<string, unknown>;
  if (value.recipient_id !== userId || typeof value.incident_id !== 'string'
    || typeof value.notification_id !== 'string'
    || !UUID.test(value.incident_id) || !UUID.test(value.notification_id)) return null;
  return { incidentId: value.incident_id, notificationId: value.notification_id };
}

export function setActiveAdminNotificationUser(userId: string | null): void {
  activeAdminUserId = userId;
  if (Platform.OS === 'web' || handlerConfigured) return;
  handlerConfigured = true;
  Notifications.setNotificationHandler({
    handleNotification: async (notification) => {
      const allowed = Boolean(parseAdminNotificationTarget(notification.request.content.data, activeAdminUserId));
      return {
        shouldPlaySound: allowed,
        shouldSetBadge: false,
        shouldShowBanner: allowed,
        shouldShowList: allowed,
      };
    },
  });
}

async function readRegisteredToken(): Promise<RegisteredToken | null> {
  const raw = await authStorage.getItemAsync(TOKEN_STORAGE_KEY);
  if (!raw) return null;
  try {
    const value = JSON.parse(raw);
    if (typeof value.token !== 'string' || typeof value.userId !== 'string') return null;
    return {
      token: value.token,
      userId: value.userId,
      retiredTokens: Array.isArray(value.retiredTokens) ? value.retiredTokens.filter((token: unknown) => typeof token === 'string') : [],
    };
  } catch {
    return null;
  }
}

async function prepareChannel(): Promise<void> {
  if (Platform.OS !== 'android') return;
  await Notifications.setNotificationChannelAsync(ADMIN_NOTIFICATION_CHANNEL, {
    name: 'Incidents urgents',
    description: 'Nouveaux incidents BT et MT et rappels de prise en compte.',
    importance: Notifications.AndroidImportance.MAX,
    sound: 'intervx_alert.wav',
    enableVibrate: true,
    vibrationPattern: [0, 300, 150, 300],
    lockscreenVisibility: Notifications.AndroidNotificationVisibility.PRIVATE,
    showBadge: true,
    bypassDnd: false,
  });
}

export async function getAdminNotificationStatus(): Promise<AdminNotificationStatus> {
  if (Platform.OS === 'web' || !Device.isDevice) {
    return { supported: false, permission: 'undetermined', canAskAgain: false, channelBlocked: false, soundEnabled: false, registered: false };
  }
  const [permission, stored, channel] = await Promise.all([
    Notifications.getPermissionsAsync(),
    readRegisteredToken(),
    Platform.OS === 'android' ? Notifications.getNotificationChannelAsync(ADMIN_NOTIFICATION_CHANNEL) : null,
  ]);
  return {
    supported: true,
    permission: permission.status,
    canAskAgain: permission.canAskAgain,
    channelBlocked: Boolean(channel && channel.importance < Notifications.AndroidImportance.HIGH),
    soundEnabled: permission.granted && (Platform.OS === 'android' ? Boolean(channel?.sound) : permission.ios?.allowsSound !== false),
    registered: Boolean(stored && stored.userId === activeAdminUserId),
  };
}

async function registerPushToken(requestPermission: boolean, devicePushToken?: Notifications.DevicePushToken): Promise<AdminNotificationStatus> {
  const userId = activeAdminUserId;
  if (!userId) throw new Error('Une session administrateur approuvée est nécessaire.');
  if (Platform.OS === 'web' || !Device.isDevice) return getAdminNotificationStatus();
  // Android needs a channel before displaying its notification permission prompt.
  await prepareChannel();
  let permission = await Notifications.getPermissionsAsync();
  if (!permission.granted && requestPermission && permission.canAskAgain) {
    permission = await Notifications.requestPermissionsAsync({ ios: { allowAlert: true, allowBadge: true, allowSound: true } });
  }
  if (!permission.granted) {
    await unregisterAdminPushNotifications();
    return getAdminNotificationStatus();
  }
  const projectId = Constants.expoConfig?.extra?.eas?.projectId ?? Constants.easConfig?.projectId;
  if (!projectId) throw new Error('La configuration des notifications est absente de cette version.');
  let token: string;
  try {
    token = (await Notifications.getExpoPushTokenAsync({ projectId, devicePushToken })).data;
  } catch {
    throw new Error('Impossible de connecter ce téléphone aux notifications. Vérifiez Internet et la configuration de cette version.');
  }
  const { data: { session } } = await supabase.auth.getSession();
  if (activeAdminUserId !== userId || session?.user.id !== userId) {
    throw new Error('La session a changé. Réessayez depuis le profil administrateur.');
  }
  const previous = await readRegisteredToken();
  const { error } = await supabase.rpc('register_admin_push_token', { p_token: token });
  if (error) throw new Error('Impossible d’enregistrer ce téléphone. Vérifiez votre connexion et votre accès administrateur.');
  if (activeAdminUserId !== userId) {
    await supabase.rpc('unregister_admin_push_token', { p_token: token });
    throw new Error('La session a changé pendant l’activation des notifications.');
  }
  const retiredTokens = previous?.userId === userId
    ? [...new Set([previous.token, ...(previous.retiredTokens ?? [])])].filter(value => value !== token) : [];
  await authStorage.setItemAsync(TOKEN_STORAGE_KEY, JSON.stringify({ token, userId, retiredTokens }));
  for (const retiredToken of retiredTokens) {
    const { error: removeError } = await supabase.rpc('unregister_admin_push_token', { p_token: retiredToken });
    if (removeError) throw new Error('L’ancien jeton de notification doit encore être désactivé. Réessayez.');
  }
  if (activeAdminUserId !== userId) throw new Error('La session a changé pendant l’activation des notifications.');
  await authStorage.setItemAsync(TOKEN_STORAGE_KEY, JSON.stringify({ token, userId }));
  return getAdminNotificationStatus();
}

function queueRegistration(requestPermission: boolean, devicePushToken?: Notifications.DevicePushToken): Promise<AdminNotificationStatus> {
  const expectedUserId = activeAdminUserId;
  const result = pendingRegistration.then(() => {
    if (activeAdminUserId !== expectedUserId) throw new Error('La session a changé. Réessayez depuis le profil administrateur.');
    return registerPushToken(requestPermission, devicePushToken);
  });
  // Token refresh and permission activation can overlap; account transfers must finish in order.
  pendingRegistration = result.then(() => undefined, () => undefined);
  return result;
}

export function registerAdminPushNotifications(): Promise<AdminNotificationStatus> {
  return queueRegistration(true);
}

export function syncAdminPushNotifications(devicePushToken?: Notifications.DevicePushToken): Promise<AdminNotificationStatus> {
  return queueRegistration(false, devicePushToken);
}

export async function unregisterAdminPushNotifications(): Promise<void> {
  try {
    const stored = await readRegisteredToken();
    if (stored) {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 4000);
      try {
        for (const token of new Set([stored.token, ...(stored.retiredTokens ?? [])])) {
          const { error } = await supabase.rpc('unregister_admin_push_token', { p_token: token }).abortSignal(controller.signal);
          if (error) throw new Error('Impossible de désactiver les notifications sur le serveur. Réessayez avec Internet.');
        }
        await authStorage.deleteItemAsync(TOKEN_STORAGE_KEY);
      } finally {
        clearTimeout(timeout);
      }
    }
  } finally {
    if (Platform.OS !== 'web') {
      await Notifications.dismissAllNotificationsAsync();
      await Notifications.clearLastNotificationResponseAsync();
    }
  }
}
