import { useAuth } from '@/contexts/AuthContext';
import {
  parseAdminNotificationTarget,
  setActiveAdminNotificationUser,
  syncAdminPushNotifications,
  unregisterAdminPushNotifications,
} from '@/lib/adminNotifications';
import { Sentry } from '@/lib/monitoring';
import * as Notifications from 'expo-notifications';
import { router, useRootNavigationState } from 'expo-router';
import { useCallback, useEffect, useRef, useState } from 'react';
import { AppState, Platform } from 'react-native';

export default function AdminNotificationCoordinator() {
  const { user, loading, isAdmin, isDirector } = useAuth();
  const navigation = useRootNavigationState();
  const [response, setResponse] = useState<Notifications.NotificationResponse | null>(null);
  const handledResponse = useRef<string | null>(null);
  const currentAdmin = !loading && (isAdmin || isDirector) ? user?.id ?? null : null;
  const adminRef = useRef(currentAdmin);
  adminRef.current = currentAdmin;

  const refreshRegistration = useCallback((token?: Notifications.DevicePushToken) => {
    if (!adminRef.current) return;
    void syncAdminPushNotifications(token).catch(() => {
      // The profile exposes activation errors; never include device tokens in monitoring.
      Sentry.captureMessage('Admin push registration could not be refreshed', 'warning');
    });
  }, []);

  useEffect(() => {
    setActiveAdminNotificationUser(currentAdmin);
    if (currentAdmin) refreshRegistration();
    else if (!loading) void unregisterAdminPushNotifications().catch(() => undefined);
    return () => setActiveAdminNotificationUser(null);
  }, [currentAdmin, loading, refreshRegistration]);

  useEffect(() => {
    if (Platform.OS === 'web') return;
    let mounted = true;
    const responseListener = Notifications.addNotificationResponseReceivedListener(setResponse);
    const tokenListener = Notifications.addPushTokenListener(refreshRegistration);
    const appStateListener = AppState.addEventListener('change', state => {
      if (state === 'active') refreshRegistration();
    });
    void Notifications.getLastNotificationResponseAsync().then(last => {
      if (mounted) setResponse(current => current ?? last);
    }).catch(() => undefined);
    return () => {
      mounted = false;
      responseListener.remove();
      tokenListener.remove();
      appStateListener.remove();
    };
  }, [refreshRegistration]);

  useEffect(() => {
    if (!response || loading || !navigation?.key) return;
    const responseKey = `${response.notification.request.identifier}:${response.actionIdentifier}`;
    if (handledResponse.current === responseKey) return;
    const target = parseAdminNotificationTarget(response.notification.request.content.data, currentAdmin);
    if (!target && !user) return;
    handledResponse.current = responseKey;
    setResponse(null);
    void Notifications.clearLastNotificationResponseAsync().catch(() => undefined);
    if (target && response.actionIdentifier === Notifications.DEFAULT_ACTION_IDENTIFIER) {
      router.push({ pathname: isDirector ? '/(director)/incidents' : '/(admin)/incidents', params: target });
    }
  }, [response, loading, navigation?.key, currentAdmin, user, isDirector]);

  return null;
}
