import { Platform } from 'react-native';

type NotificationsModule = typeof import('expo-notifications');

let loaded: NotificationsModule | null | undefined;

/**
 * expo-notifications, or null where it can't load. Expo Go on Android lacks
 * one of its native modules (topic subscriptions) and importing it there
 * crashes the app, so it is required lazily and only once.
 */
function notifications(): NotificationsModule | null {
  if (loaded !== undefined) return loaded;
  if (Platform.OS === 'web') return (loaded = null);
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const mod = require('expo-notifications') as NotificationsModule;
    // Show reminders even while the app is open.
    mod.setNotificationHandler({
      handleNotification: async () => ({
        shouldShowBanner: true,
        shouldShowList: true,
        shouldPlaySound: true,
        shouldSetBadge: false,
      }),
    });
    loaded = mod;
  } catch {
    loaded = null;
  }
  return loaded;
}

/** Whether this phone can schedule reminders (not in Expo Go on Android). */
export function remindersAvailable(): boolean {
  return notifications() !== null;
}

const id = (entryId: string) => `med-${entryId}`;

/** Asks for permission the first time. Returns false if the person said no. */
async function allowed(N: NotificationsModule): Promise<boolean> {
  const current = await N.getPermissionsAsync();
  if (current.granted) return true;
  if (!current.canAskAgain) return false;
  return (await N.requestPermissionsAsync()).granted;
}

/**
 * A reminder on this phone when the next dose is allowed. Keyed by the dose's
 * entry, so deleting or re-timing the dose can cancel it.
 */
export async function remindNextDose(entryId: string, medName: string, at: Date): Promise<boolean> {
  const N = notifications();
  if (!N || at.getTime() <= Date.now() || !(await allowed(N))) return false;
  if (Platform.OS === 'android') {
    await N.setNotificationChannelAsync('reminders', { name: 'Reminders', importance: N.AndroidImportance.HIGH });
  }
  await N.scheduleNotificationAsync({
    identifier: id(entryId),
    content: { title: `${medName} can be given again`, body: 'Tap to log the dose.', data: { url: '/log/med' } },
    trigger: { type: N.SchedulableTriggerInputTypes.DATE, date: at, channelId: 'reminders' },
  });
  return true;
}

export async function cancelReminder(entryId: string) {
  const N = notifications();
  if (!N) return;
  try {
    await N.cancelScheduledNotificationAsync(id(entryId));
  } catch {
    // Nothing scheduled.
  }
}

/** Opens the screen a reminder points to when it's tapped. Returns the unsubscribe. */
export function onReminderTap(open: (url: string) => void): () => void {
  const N = notifications();
  if (!N) return () => {};
  const sub = N.addNotificationResponseReceivedListener((r) => {
    const url = r.notification.request.content.data?.url;
    if (typeof url === 'string') open(url);
  });
  return () => sub.remove();
}
