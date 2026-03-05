import * as Notifications from 'expo-notifications';
import { Platform } from 'react-native';
import { getSetting, setSetting } from '../db/settingsQueries';
import { getTodaysRoutineDay } from '../db/routineQueries';
import { getTodaysTotalMl } from '../db/waterQueries';

// ── Channel setup (Android) ──────────────────────────────────────────────────

Notifications.setNotificationHandler({
    handleNotification: async () => ({
        shouldShowAlert: true,
        shouldPlaySound: true,
        shouldSetBadge: false,
        shouldShowBanner: true,
        shouldShowList: true,
    }),
});

if (Platform.OS === 'android') {
    Notifications.setNotificationChannelAsync('reminders', {
        name: 'Reminders',
        importance: Notifications.AndroidImportance.HIGH,
        vibrationPattern: [0, 250, 250, 250],
        lightColor: '#C8FF00',
    });
    Notifications.setNotificationChannelAsync('workout-active', {
        name: 'Active Workout',
        importance: Notifications.AndroidImportance.LOW,
        showBadge: false,
    });
    Notifications.setNotificationChannelAsync('rest-timer', {
        name: 'Rest Timer',
        importance: Notifications.AndroidImportance.DEFAULT,
        vibrationPattern: [0, 200, 100, 200],
        lightColor: '#C8FF00',
    });
}

// ── Identifier prefixes ──────────────────────────────────────────────────────

const PREFIX_WORKOUT = 'workout-';
const PREFIX_WATER = 'water-';
const PREFIX_WEIGHT = 'weight';

// ── Helpers ──────────────────────────────────────────────────────────────────

function getActiveRoutineId(): number | null {
    const idStr = getSetting('active_routine_id');
    return idStr ? parseInt(idStr, 10) : null;
}

function getWorkoutBody(): string {
    try {
        const routineId = getActiveRoutineId();
        if (routineId) {
            const day = getTodaysRoutineDay(routineId);
            if (day) {
                return `Today is ${day.name} day. Let's go!`;
            }
        }
    } catch {
        // swallow — fallback below
    }
    return "Time for your workout!";
}

function getWaterBody(): string {
    try {
        const goalStr = getSetting('daily_water_goal_ml');
        const goalMl = goalStr ? parseInt(goalStr, 10) : 2500;
        const totalMl = getTodaysTotalMl();
        const pct = goalMl > 0 ? totalMl / goalMl : 0;
        const remaining = Math.max(0, goalMl - totalMl);

        if (pct < 0.5) {
            return `You've only had ${totalMl} ml today. Drink up!`;
        }
        if (pct < 0.8) {
            return `Almost there! ${remaining} ml left to hit your goal.`;
        }
        return 'Great hydration today! Keep it up.';
    } catch {
        return 'Time to drink some water!';
    }
}

// ── Permissions ──────────────────────────────────────────────────────────────

export async function requestPermissions(): Promise<boolean> {
    try {
        const { status: existing } = await Notifications.getPermissionsAsync();
        let finalStatus = existing;

        if (existing !== 'granted') {
            const { status } = await Notifications.requestPermissionsAsync();
            finalStatus = status;
        }

        const granted = finalStatus === 'granted';
        setSetting('notifications_enabled', granted ? '1' : '0');
        setSetting('notifications_permission_asked', '1');
        return granted;
    } catch (error) {
        console.error('requestPermissions failed:', error);
        setSetting('notifications_enabled', '0');
        return false;
    }
}

export async function checkPermissions(): Promise<boolean> {
    try {
        const { status } = await Notifications.getPermissionsAsync();
        return status === 'granted';
    } catch {
        return false;
    }
}

// ── Cancel helpers ───────────────────────────────────────────────────────────

async function cancelByPrefix(prefix: string): Promise<void> {
    try {
        const all = await Notifications.getAllScheduledNotificationsAsync();
        const toCancel = all.filter(
            (n) => n.identifier.startsWith(prefix)
        );
        for (const n of toCancel) {
            await Notifications.cancelScheduledNotificationAsync(n.identifier);
        }
    } catch (error) {
        console.error(`cancelByPrefix(${prefix}) failed:`, error);
    }
}

export async function cancelWorkoutReminders(): Promise<void> {
    await cancelByPrefix(PREFIX_WORKOUT);
}

export async function cancelWaterReminders(): Promise<void> {
    await cancelByPrefix(PREFIX_WATER);
}

export async function cancelWeightReminder(): Promise<void> {
    await cancelByPrefix(PREFIX_WEIGHT);
}

export async function cancelAllReminders(): Promise<void> {
    await cancelWorkoutReminders();
    await cancelWaterReminders();
    await cancelWeightReminder();
}

// ── Schedule: Workout ────────────────────────────────────────────────────────

/** Days of week: 1 = Sunday, 2 = Monday, …, 7 = Saturday (Expo convention) */
export async function scheduleWorkoutReminder(
    hour: number,
    minute: number,
    daysOfWeek: number[]
): Promise<void> {
    try {
        const granted = await checkPermissions();
        if (!granted) return;

        await cancelWorkoutReminders();

        const body = getWorkoutBody();

        for (const weekday of daysOfWeek) {
            await Notifications.scheduleNotificationAsync({
                identifier: `${PREFIX_WORKOUT}${weekday}`,
                content: {
                    title: 'Time to train 💪',
                    body,
                    sound: 'default',
                    ...(Platform.OS === 'android' && { channelId: 'reminders' }),
                },
                trigger: {
                    type: Notifications.SchedulableTriggerInputTypes.WEEKLY,
                    weekday,
                    hour,
                    minute,
                },
            });
        }

        setSetting('workout_reminder_time', `${hour}:${minute}`);
        setSetting('workout_reminder_days', JSON.stringify(daysOfWeek));
    } catch (error) {
        console.error('scheduleWorkoutReminder failed:', error);
    }
}

// ── Schedule: Water ──────────────────────────────────────────────────────────

export async function scheduleWaterReminder(
    intervalHours: number,
    startHour: number,
    endHour: number
): Promise<void> {
    try {
        const granted = await checkPermissions();
        if (!granted) return;

        await cancelWaterReminders();

        const body = getWaterBody();
        let slotIndex = 0;

        for (let h = startHour; h <= endHour; h += intervalHours) {
            await Notifications.scheduleNotificationAsync({
                identifier: `${PREFIX_WATER}${slotIndex}`,
                content: {
                    title: 'Stay hydrated 💧',
                    body,
                    sound: 'default',
                    ...(Platform.OS === 'android' && { channelId: 'reminders' }),
                },
                trigger: {
                    type: Notifications.SchedulableTriggerInputTypes.DAILY,
                    hour: h,
                    minute: 0,
                },
            });
            slotIndex++;
        }

        setSetting('water_reminder_interval', String(intervalHours));
        setSetting('water_reminder_start', String(startHour));
        setSetting('water_reminder_end', String(endHour));
    } catch (error) {
        console.error('scheduleWaterReminder failed:', error);
    }
}

// ── Schedule: Weight ─────────────────────────────────────────────────────────

export async function scheduleWeightReminder(
    hour: number,
    minute: number
): Promise<void> {
    try {
        const granted = await checkPermissions();
        if (!granted) return;

        await cancelWeightReminder();

        await Notifications.scheduleNotificationAsync({
            identifier: PREFIX_WEIGHT,
            content: {
                title: 'Log your weight ⚖️',
                body: "Step on the scale and log today's weight.",
                sound: 'default',
                ...(Platform.OS === 'android' && { channelId: 'reminders' }),
            },
            trigger: {
                type: Notifications.SchedulableTriggerInputTypes.DAILY,
                hour,
                minute,
            },
        });

        setSetting('weight_reminder_time', `${hour}:${minute}`);
    } catch (error) {
        console.error('scheduleWeightReminder failed:', error);
    }
}

// ── Active Workout Notification ───────────────────────────────────────────────

const WORKOUT_ACTIVE_ID = 'workout-active-ongoing';

export async function showWorkoutActiveNotification(startTimestamp: number): Promise<void> {
    try {
        await Notifications.scheduleNotificationAsync({
            identifier: WORKOUT_ACTIVE_ID,
            content: {
                title: 'Workout in progress',
                body: 'Tap to return to your workout',
                sticky: true,
                ...(Platform.OS === 'android' && {
                    android: {
                        channelId: 'workout-active',
                        ongoing: true,
                        sticky: true,
                        usesChronometer: true,
                        showWhen: true,
                        when: startTimestamp,
                        priority: Notifications.AndroidNotificationPriority.LOW,
                    } as any,
                }),
            },
            trigger: null,
        });
    } catch (error) {
        console.error('showWorkoutActiveNotification failed:', error);
    }
}

export async function dismissWorkoutActiveNotification(): Promise<void> {
    try {
        await Notifications.dismissNotificationAsync(WORKOUT_ACTIVE_ID);
    } catch { /* notification may not exist */ }
}

// ── Rest Timer Notification ───────────────────────────────────────────────────

const REST_TIMER_ID = 'rest-timer-ongoing';
const REST_COMPLETE_ID = 'rest-timer-complete';

export async function showRestTimerNotification(endTimestamp: number): Promise<void> {
    try {
        await Notifications.dismissNotificationAsync(REST_TIMER_ID).catch(() => { });
        await Notifications.cancelScheduledNotificationAsync(REST_COMPLETE_ID).catch(() => { });

        await Notifications.scheduleNotificationAsync({
            identifier: REST_TIMER_ID,
            content: {
                title: 'Rest Timer',
                body: 'Resting — tap to return',
                sticky: true,
                ...(Platform.OS === 'android' && {
                    android: {
                        channelId: 'rest-timer',
                        ongoing: true,
                        sticky: true,
                        usesChronometer: true,
                        chronometerCountDown: true,
                        showWhen: true,
                        when: endTimestamp,
                        priority: Notifications.AndroidNotificationPriority.DEFAULT,
                    } as any,
                }),
            },
            trigger: null,
        });

        const delaySeconds = Math.ceil((endTimestamp - Date.now()) / 1000);
        if (delaySeconds > 0) {
            await Notifications.scheduleNotificationAsync({
                identifier: REST_COMPLETE_ID,
                content: {
                    title: 'Rest Complete!',
                    body: 'Time to get back to work 💪',
                    sound: 'default',
                    ...(Platform.OS === 'android' && {
                        android: { channelId: 'rest-timer' },
                    }),
                },
                trigger: {
                    type: Notifications.SchedulableTriggerInputTypes.TIME_INTERVAL,
                    seconds: delaySeconds,
                },
            });
        }
    } catch (error) {
        console.error('showRestTimerNotification failed:', error);
    }
}

export async function dismissRestTimerNotification(): Promise<void> {
    try {
        await Notifications.dismissNotificationAsync(REST_TIMER_ID).catch(() => { });
        await Notifications.cancelScheduledNotificationAsync(REST_COMPLETE_ID).catch(() => { });
    } catch { /* ignore */ }
}

// ── Debug ────────────────────────────────────────────────────────────────────

export async function getScheduledNotifications(): Promise<
    Notifications.NotificationRequest[]
> {
    try {
        return await Notifications.getAllScheduledNotificationsAsync();
    } catch (error) {
        console.error('getScheduledNotifications failed:', error);
        return [];
    }
}
