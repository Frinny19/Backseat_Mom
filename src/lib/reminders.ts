import * as Notifications from 'expo-notifications';
import { Platform } from 'react-native';

// Show reminders even while the app is open.
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowBanner: true,
    shouldShowList: true,
    shouldPlaySound: true,
    shouldSetBadge: false,
  }),
});

const id = (entryId: string) => `med-${entryId}`;

/** Asks for permission the first time. Returns false if the person said no. */
async function allowed(): Promise<boolean> {
  if (Platform.OS === 'web') return false;
  const current = await Notifications.getPermissionsAsync();
  if (current.granted) return true;
  if (!current.canAskAgain) return false;
  return (await Notifications.requestPermissionsAsync()).granted;
}

/**
 * A reminder on this phone when the next dose is allowed. Keyed by the dose's
 * entry, so deleting or re-timing the dose can cancel it.
 */
export async function remindNextDose(entryId: string, medName: string, at: Date): Promise<boolean> {
  if (at.getTime() <= Date.now() || !(await allowed())) return false;
  if (Platform.OS === 'android') {
    await Notifications.setNotificationChannelAsync('reminders', {
      name: 'Reminders',
      importance: Notifications.AndroidImportance.HIGH,
    });
  }
  await Notifications.scheduleNotificationAsync({
    identifier: id(entryId),
    content: { title: `${medName} can be given again`, body: 'Tap to log the dose.', data: { url: '/log/med' } },
    trigger: { type: Notifications.SchedulableTriggerInputTypes.DATE, date: at, channelId: 'reminders' },
  });
  return true;
}

export async function cancelReminder(entryId: string) {
  if (Platform.OS === 'web') return;
  try {
    await Notifications.cancelScheduledNotificationAsync(id(entryId));
  } catch {
    // Nothing scheduled.
  }
}

/** Opens the screen a reminder points to when it's tapped. Returns the unsubscribe. */
export function onReminderTap(open: (url: string) => void): () => void {
  if (Platform.OS === 'web') return () => {};
  const sub = Notifications.addNotificationResponseReceivedListener((r) => {
    const url = r.notification.request.content.data?.url;
    if (typeof url === 'string') open(url);
  });
  return () => sub.remove();
}
