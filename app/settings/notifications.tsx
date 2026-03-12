import { useCallback, useEffect, useState } from 'react';
import {
    Alert,
    Linking,
    Platform,
    Pressable,
    ScrollView,
    StyleSheet,
    Switch,
    Text,
    View,
} from 'react-native';
import { router, useFocusEffect } from 'expo-router';
import DateTimePicker, {
    DateTimePickerEvent,
} from '@react-native-community/datetimepicker';
import { Ionicons } from '@expo/vector-icons';
import { getSetting, setSetting } from '../../db/settingsQueries';
import {
    checkPermissions,
    requestPermissions,
    scheduleWorkoutReminder,
    scheduleWaterReminder,
    scheduleWeightReminder,
    cancelWorkoutReminders,
    cancelWaterReminders,
    cancelWeightReminder,
} from '../../utils/notificationService';
import {
    BorderRadius,
    Colors,
    Spacing,
    Typography,
} from '../../constants/theme';

// ── Day helpers ──────────────────────────────────────────────────────────────

/** Expo weekdays: 1 = Sun … 7 = Sat */
interface DayInfo {
    label: string;
    expoWeekday: number;
}

const DAYS: DayInfo[] = [
    { label: 'Mon', expoWeekday: 2 },
    { label: 'Tue', expoWeekday: 3 },
    { label: 'Wed', expoWeekday: 4 },
    { label: 'Thu', expoWeekday: 5 },
    { label: 'Fri', expoWeekday: 6 },
    { label: 'Sat', expoWeekday: 7 },
    { label: 'Sun', expoWeekday: 1 },
];

const DEFAULT_DAYS = [2, 3, 4, 5, 6]; // Mon–Fri

type IntervalOption = 1 | 2 | 3;
const INTERVAL_OPTIONS: IntervalOption[] = [1, 2, 3];

// ── Helpers ──────────────────────────────────────────────────────────────────

function pad(n: number): string {
    return n < 10 ? `0${n}` : String(n);
}

function dateForTime(h: number, m: number): Date {
    const d = new Date();
    d.setHours(h, m, 0, 0);
    return d;
}

function dayLabelsForWeekdays(weekdays: number[]): string {
    return DAYS.filter((d) => weekdays.includes(d.expoWeekday))
        .map((d) => d.label)
        .join(', ');
}

// ── Component ────────────────────────────────────────────────────────────────

export default function NotificationSettingsScreen() {
    // Permission
    const [permGranted, setPermGranted] = useState(true);

    // Workout
    const [workoutEnabled, setWorkoutEnabled] = useState(false);
    const [workoutHour, setWorkoutHour] = useState(7);
    const [workoutMinute, setWorkoutMinute] = useState(30);
    const [workoutDays, setWorkoutDays] = useState<number[]>(DEFAULT_DAYS);
    const [showWorkoutPicker, setShowWorkoutPicker] = useState(false);

    // Water
    const [waterEnabled, setWaterEnabled] = useState(false);
    const [waterInterval, setWaterInterval] = useState<IntervalOption>(2);
    const [waterStart, setWaterStart] = useState(8);
    const [waterEnd, setWaterEnd] = useState(22);
    const [showWaterStartPicker, setShowWaterStartPicker] = useState(false);
    const [showWaterEndPicker, setShowWaterEndPicker] = useState(false);

    // Weight
    const [weightEnabled, setWeightEnabled] = useState(false);
    const [weightHour, setWeightHour] = useState(8);
    const [weightMinute, setWeightMinute] = useState(0);
    const [showWeightPicker, setShowWeightPicker] = useState(false);

    // ── Load saved settings ──────────────────────────────────────────────────

    useFocusEffect(
        useCallback(() => {
            (async () => {
                const granted = await checkPermissions();
                setPermGranted(granted);
            })();

            // Workout
            const wEnabled = getSetting('workout_reminder_enabled');
            const wTime = getSetting('workout_reminder_time');
            const wDays = getSetting('workout_reminder_days');
            if (wTime) {
                const [h, m] = wTime.split(':').map(Number);
                setWorkoutHour(h);
                setWorkoutMinute(m);
            }
            if (wDays) {
                try {
                    const parsed = JSON.parse(wDays) as number[];
                    if (parsed.length > 0) setWorkoutDays(parsed);
                } catch {
                    // ignore
                }
            }
            // Enabled state: explicit '1' = on, explicit '0' = off, '' = fall back to time presence
            setWorkoutEnabled(wEnabled === '1' || (wEnabled !== '0' && !!wTime));

            // Water
            const waterEnabled = getSetting('water_reminder_enabled');
            const wInterval = getSetting('water_reminder_interval');
            const wStart = getSetting('water_reminder_start');
            const wEnd = getSetting('water_reminder_end');
            if (wInterval) {
                const iv = parseInt(wInterval, 10) as IntervalOption;
                if (INTERVAL_OPTIONS.includes(iv)) setWaterInterval(iv);
            }
            if (wStart) setWaterStart(parseInt(wStart, 10));
            if (wEnd) setWaterEnd(parseInt(wEnd, 10));
            setWaterEnabled(waterEnabled === '1' || (waterEnabled !== '0' && !!wInterval));

            // Weight
            const weightEnabled = getSetting('weight_reminder_enabled');
            const weightTime = getSetting('weight_reminder_time');
            if (weightTime) {
                const [h, m] = weightTime.split(':').map(Number);
                setWeightHour(h);
                setWeightMinute(m);
            }
            setWeightEnabled(weightEnabled === '1' || (weightEnabled !== '0' && !!weightTime));
        }, [])
    );

    // ── Handlers ─────────────────────────────────────────────────────────────

    // Workout
    const handleWorkoutToggle = async (val: boolean) => {
        setWorkoutEnabled(val);
        setSetting('workout_reminder_enabled', val ? '1' : '0');
        if (val) {
            const granted = await requestPermissions();
            if (!granted) {
                setPermGranted(false);
                setWorkoutEnabled(false);
                setSetting('workout_reminder_enabled', '0');
                return;
            }
            setPermGranted(true);
            await scheduleWorkoutReminder(workoutHour, workoutMinute, workoutDays);
        } else {
            await cancelWorkoutReminders();
        }
    };

    const handleWorkoutTimeChange = async (_: DateTimePickerEvent, date?: Date) => {
        setShowWorkoutPicker(Platform.OS === 'ios');
        if (date) {
            const h = date.getHours();
            const m = date.getMinutes();
            setWorkoutHour(h);
            setWorkoutMinute(m);
            if (workoutEnabled) {
                await scheduleWorkoutReminder(h, m, workoutDays);
            }
        }
    };

    const toggleWorkoutDay = async (weekday: number) => {
        const current = workoutDays.includes(weekday)
            ? workoutDays.filter((d) => d !== weekday)
            : [...workoutDays, weekday];

        // Prevent deselecting all
        if (current.length === 0) return;

        setWorkoutDays(current);
        if (workoutEnabled) {
            await scheduleWorkoutReminder(workoutHour, workoutMinute, current);
        }
    };

    // Water
    const handleWaterToggle = async (val: boolean) => {
        setWaterEnabled(val);
        setSetting('water_reminder_enabled', val ? '1' : '0');
        if (val) {
            const granted = await requestPermissions();
            if (!granted) {
                setPermGranted(false);
                setWaterEnabled(false);
                setSetting('water_reminder_enabled', '0');
                return;
            }
            setPermGranted(true);
            await scheduleWaterReminder(waterInterval, waterStart, waterEnd);
        } else {
            await cancelWaterReminders();
        }
    };

    const handleWaterIntervalChange = async (iv: IntervalOption) => {
        setWaterInterval(iv);
        if (waterEnabled) {
            await scheduleWaterReminder(iv, waterStart, waterEnd);
        }
    };

    const handleWaterStartChange = async (_: DateTimePickerEvent, date?: Date) => {
        setShowWaterStartPicker(Platform.OS === 'ios');
        if (date) {
            const h = date.getHours();
            setWaterStart(h);
            if (waterEnabled) {
                await scheduleWaterReminder(waterInterval, h, waterEnd);
            }
        }
    };

    const handleWaterEndChange = async (_: DateTimePickerEvent, date?: Date) => {
        setShowWaterEndPicker(Platform.OS === 'ios');
        if (date) {
            const h = date.getHours();
            setWaterEnd(h);
            if (waterEnabled) {
                await scheduleWaterReminder(waterInterval, waterStart, h);
            }
        }
    };

    // Weight
    const handleWeightToggle = async (val: boolean) => {
        setWeightEnabled(val);
        setSetting('weight_reminder_enabled', val ? '1' : '0');
        if (val) {
            const granted = await requestPermissions();
            if (!granted) {
                setPermGranted(false);
                setWeightEnabled(false);
                setSetting('weight_reminder_enabled', '0');
                return;
            }
            setPermGranted(true);
            await scheduleWeightReminder(weightHour, weightMinute);
        } else {
            await cancelWeightReminder();
        }
    };

    const handleWeightTimeChange = async (_: DateTimePickerEvent, date?: Date) => {
        setShowWeightPicker(Platform.OS === 'ios');
        if (date) {
            const h = date.getHours();
            const m = date.getMinutes();
            setWeightHour(h);
            setWeightMinute(m);
            if (weightEnabled) {
                await scheduleWeightReminder(h, m);
            }
        }
    };

    // ── Render ───────────────────────────────────────────────────────────────

    return (
        <ScrollView style={styles.container} contentContainerStyle={styles.content}>
            {/* Header */}
            <Pressable style={styles.backRow} onPress={() => router.back()}>
                <Ionicons name="chevron-back" size={22} color={Colors.primary} />
                <Text style={styles.backText}>Settings</Text>
            </Pressable>
            <Text style={styles.pageTitle}>Notifications</Text>

            {/* ── Permission banner ───────────────────────────────────────────── */}
            {!permGranted && (
                <View style={styles.warningCard}>
                    <Text style={styles.warningText}>
                        Notifications are disabled. Enable them in your device settings to use
                        reminders.
                    </Text>
                    <Pressable
                        style={styles.warningButton}
                        onPress={() => Linking.openSettings()}
                    >
                        <Text style={styles.warningButtonText}>Open Settings</Text>
                    </Pressable>
                </View>
            )}

            {/* ── Workout Reminder ────────────────────────────────────────────── */}
            <Text style={styles.sectionHeader}>WORKOUT REMINDER</Text>
            <View style={styles.card}>
                <View style={styles.toggleRow}>
                    <Text style={styles.rowLabel}>Remind me to train</Text>
                    <Switch
                        value={workoutEnabled}
                        onValueChange={handleWorkoutToggle}
                        trackColor={{ false: Colors.surfaceElevated, true: Colors.primary }}
                        thumbColor={Colors.text}
                    />
                </View>

                {workoutEnabled && (
                    <>
                        <View style={styles.divider} />
                        <Pressable
                            style={styles.settingsRow}
                            onPress={() => setShowWorkoutPicker(true)}
                        >
                            <Text style={styles.rowLabel}>Remind me at</Text>
                            <Text style={styles.timeValue}>
                                {pad(workoutHour)}:{pad(workoutMinute)}
                            </Text>
                        </Pressable>

                        {showWorkoutPicker && (
                            <DateTimePicker
                                value={dateForTime(workoutHour, workoutMinute)}
                                mode="time"
                                is24Hour
                                display={Platform.OS === 'ios' ? 'spinner' : 'default'}
                                onChange={handleWorkoutTimeChange}
                                themeVariant="dark"
                            />
                        )}

                        <View style={styles.divider} />
                        <View style={styles.dayRow}>
                            {DAYS.map((d) => {
                                const active = workoutDays.includes(d.expoWeekday);
                                return (
                                    <Pressable
                                        key={d.expoWeekday}
                                        style={[styles.dayPill, active && styles.dayPillActive]}
                                        onPress={() => toggleWorkoutDay(d.expoWeekday)}
                                    >
                                        <Text
                                            style={[
                                                styles.dayPillText,
                                                active && styles.dayPillTextActive,
                                            ]}
                                        >
                                            {d.label}
                                        </Text>
                                    </Pressable>
                                );
                            })}
                        </View>

                        <View style={styles.divider} />
                        <View style={styles.summaryRow}>
                            <Text style={styles.helperText}>
                                Active: {dayLabelsForWeekdays(workoutDays)} at{' '}
                                {pad(workoutHour)}:{pad(workoutMinute)}
                            </Text>
                        </View>
                    </>
                )}

                {!workoutEnabled && workoutHour !== null && getSetting('workout_reminder_time') !== null && (
                    <View style={styles.summaryRow}>
                        <Text style={styles.cancelledText}>Reminders cancelled</Text>
                    </View>
                )}
            </View>

            {/* ── Water Reminder ──────────────────────────────────────────────── */}
            <Text style={styles.sectionHeader}>WATER REMINDER</Text>
            <View style={styles.card}>
                <View style={styles.toggleRow}>
                    <Text style={styles.rowLabel}>Remind me to drink water</Text>
                    <Switch
                        value={waterEnabled}
                        onValueChange={handleWaterToggle}
                        trackColor={{ false: Colors.surfaceElevated, true: Colors.primary }}
                        thumbColor={Colors.text}
                    />
                </View>

                {waterEnabled && (
                    <>
                        <View style={styles.divider} />
                        <View style={styles.settingsRow}>
                            <Text style={styles.rowLabel}>Remind me every</Text>
                            <View style={styles.segmentGroup}>
                                {INTERVAL_OPTIONS.map((iv) => (
                                    <Pressable
                                        key={iv}
                                        style={[
                                            styles.segmentPill,
                                            waterInterval === iv && styles.segmentPillActive,
                                        ]}
                                        onPress={() => handleWaterIntervalChange(iv)}
                                    >
                                        <Text
                                            style={[
                                                styles.segmentText,
                                                waterInterval === iv && styles.segmentTextActive,
                                            ]}
                                        >
                                            {iv}h
                                        </Text>
                                    </Pressable>
                                ))}
                            </View>
                        </View>

                        <View style={styles.divider} />
                        <View style={styles.settingsRow}>
                            <Text style={styles.rowLabel}>Between</Text>
                            <View style={styles.timeRangeRow}>
                                <Pressable
                                    style={styles.timeBadge}
                                    onPress={() => setShowWaterStartPicker(true)}
                                >
                                    <Text style={styles.timeBadgeText}>{pad(waterStart)}:00</Text>
                                </Pressable>
                                <Text style={styles.timeSeparator}>–</Text>
                                <Pressable
                                    style={styles.timeBadge}
                                    onPress={() => setShowWaterEndPicker(true)}
                                >
                                    <Text style={styles.timeBadgeText}>{pad(waterEnd)}:00</Text>
                                </Pressable>
                            </View>
                        </View>

                        {showWaterStartPicker && (
                            <DateTimePicker
                                value={dateForTime(waterStart, 0)}
                                mode="time"
                                is24Hour
                                display={Platform.OS === 'ios' ? 'spinner' : 'default'}
                                onChange={handleWaterStartChange}
                                themeVariant="dark"
                            />
                        )}

                        {showWaterEndPicker && (
                            <DateTimePicker
                                value={dateForTime(waterEnd, 0)}
                                mode="time"
                                is24Hour
                                display={Platform.OS === 'ios' ? 'spinner' : 'default'}
                                onChange={handleWaterEndChange}
                                themeVariant="dark"
                            />
                        )}

                        <View style={styles.divider} />
                        <View style={styles.summaryRow}>
                            <Text style={styles.helperText}>
                                Reminders will adjust based on how much you've drunk.
                            </Text>
                        </View>
                    </>
                )}

                {!waterEnabled && getSetting('water_reminder_interval') !== null && (
                    <View style={styles.summaryRow}>
                        <Text style={styles.cancelledText}>Reminders cancelled</Text>
                    </View>
                )}
            </View>

            {/* ── Weight Reminder ─────────────────────────────────────────────── */}
            <Text style={styles.sectionHeader}>WEIGHT REMINDER</Text>
            <View style={styles.card}>
                <View style={styles.toggleRow}>
                    <Text style={styles.rowLabel}>Remind me to log weight</Text>
                    <Switch
                        value={weightEnabled}
                        onValueChange={handleWeightToggle}
                        trackColor={{ false: Colors.surfaceElevated, true: Colors.primary }}
                        thumbColor={Colors.text}
                    />
                </View>

                {weightEnabled && (
                    <>
                        <View style={styles.divider} />
                        <Pressable
                            style={styles.settingsRow}
                            onPress={() => setShowWeightPicker(true)}
                        >
                            <Text style={styles.rowLabel}>Remind me at</Text>
                            <Text style={styles.timeValue}>
                                {pad(weightHour)}:{pad(weightMinute)}
                            </Text>
                        </Pressable>

                        {showWeightPicker && (
                            <DateTimePicker
                                value={dateForTime(weightHour, weightMinute)}
                                mode="time"
                                is24Hour
                                display={Platform.OS === 'ios' ? 'spinner' : 'default'}
                                onChange={handleWeightTimeChange}
                                themeVariant="dark"
                            />
                        )}

                        <View style={styles.divider} />
                        <View style={styles.summaryRow}>
                            <Text style={styles.helperText}>
                                You'll only be reminded if you haven't logged today.
                            </Text>
                        </View>
                    </>
                )}

                {!weightEnabled && getSetting('weight_reminder_time') !== null && (
                    <View style={styles.summaryRow}>
                        <Text style={styles.cancelledText}>Reminders cancelled</Text>
                    </View>
                )}
            </View>
        </ScrollView>
    );
}

// ── Styles ─────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: Colors.background },
    content: {
        paddingHorizontal: Spacing.lg,
        paddingTop: Spacing.xxxl,
        paddingBottom: Spacing.xxxl,
        gap: Spacing.sm,
    },
    backRow: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: Spacing.xs,
        marginBottom: Spacing.sm,
    },
    backText: {
        color: Colors.primary,
        fontSize: Typography.size.md,
        fontWeight: Typography.weight.medium,
    },
    pageTitle: {
        color: Colors.text,
        fontSize: Typography.size.xxl,
        fontWeight: Typography.weight.bold,
        letterSpacing: -0.5,
        marginBottom: Spacing.md,
    },

    // Warning banner
    warningCard: {
        backgroundColor: '#3B3200',
        borderRadius: BorderRadius.lg,
        borderWidth: 1,
        borderColor: '#665800',
        padding: Spacing.lg,
        gap: Spacing.md,
        marginBottom: Spacing.sm,
    },
    warningText: {
        color: '#FFD600',
        fontSize: Typography.size.sm,
        fontWeight: Typography.weight.medium,
        lineHeight: Typography.size.sm * Typography.lineHeight.normal,
    },
    warningButton: {
        alignSelf: 'flex-start',
        backgroundColor: '#FFD600',
        borderRadius: BorderRadius.md,
        paddingHorizontal: Spacing.lg,
        paddingVertical: Spacing.sm,
    },
    warningButtonText: {
        color: '#1A1A00',
        fontSize: Typography.size.sm,
        fontWeight: Typography.weight.bold,
    },

    // Sections
    sectionHeader: {
        color: Colors.textTertiary,
        fontSize: Typography.size.xs,
        fontWeight: Typography.weight.semibold,
        textTransform: 'uppercase',
        letterSpacing: 0.8,
        marginTop: Spacing.lg,
        marginBottom: Spacing.xs,
    },
    card: {
        backgroundColor: Colors.surface,
        borderRadius: BorderRadius.lg,
        borderWidth: 1,
        borderColor: Colors.border,
        overflow: 'hidden',
    },
    toggleRow: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingHorizontal: Spacing.lg,
        paddingVertical: Spacing.md,
        minHeight: 52,
    },
    settingsRow: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingHorizontal: Spacing.lg,
        paddingVertical: Spacing.md,
        minHeight: 52,
        gap: Spacing.md,
    },
    rowLabel: {
        flex: 1,
        color: Colors.text,
        fontSize: Typography.size.md,
        fontWeight: Typography.weight.medium,
    },
    divider: {
        height: 1,
        backgroundColor: Colors.border,
        marginHorizontal: Spacing.lg,
    },

    // Time values
    timeValue: {
        color: Colors.primary,
        fontSize: Typography.size.md,
        fontWeight: Typography.weight.bold,
    },

    // Day pills
    dayRow: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        gap: Spacing.xs,
        paddingHorizontal: Spacing.lg,
        paddingVertical: Spacing.md,
    },
    dayPill: {
        paddingHorizontal: Spacing.sm + 2,
        paddingVertical: Spacing.xs + 2,
        borderRadius: BorderRadius.md,
        borderWidth: 1,
        borderColor: Colors.border,
        backgroundColor: Colors.surfaceElevated,
    },
    dayPillActive: {
        backgroundColor: Colors.primary,
        borderColor: Colors.primary,
    },
    dayPillText: {
        color: Colors.textSecondary,
        fontSize: Typography.size.sm,
        fontWeight: Typography.weight.semibold,
    },
    dayPillTextActive: {
        color: Colors.background,
    },

    // Segment control
    segmentGroup: {
        flexDirection: 'row',
        gap: Spacing.xs,
    },
    segmentPill: {
        paddingHorizontal: Spacing.md,
        paddingVertical: Spacing.xs + 2,
        borderRadius: BorderRadius.md,
        borderWidth: 1,
        borderColor: Colors.border,
        backgroundColor: Colors.surfaceElevated,
    },
    segmentPillActive: {
        backgroundColor: Colors.primary,
        borderColor: Colors.primary,
    },
    segmentText: {
        color: Colors.textSecondary,
        fontSize: Typography.size.sm,
        fontWeight: Typography.weight.semibold,
    },
    segmentTextActive: {
        color: Colors.background,
    },

    // Time range
    timeRangeRow: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: Spacing.sm,
    },
    timeBadge: {
        backgroundColor: Colors.surfaceElevated,
        borderRadius: BorderRadius.md,
        borderWidth: 1,
        borderColor: Colors.border,
        paddingHorizontal: Spacing.md,
        paddingVertical: Spacing.xs + 2,
    },
    timeBadgeText: {
        color: Colors.primary,
        fontSize: Typography.size.sm,
        fontWeight: Typography.weight.bold,
    },
    timeSeparator: {
        color: Colors.textSecondary,
        fontSize: Typography.size.md,
    },

    // Summary / helper
    summaryRow: {
        paddingHorizontal: Spacing.lg,
        paddingVertical: Spacing.md,
    },
    helperText: {
        color: Colors.textSecondary,
        fontSize: Typography.size.sm,
        lineHeight: Typography.size.sm * Typography.lineHeight.normal,
    },
    cancelledText: {
        color: Colors.textTertiary,
        fontSize: Typography.size.sm,
        fontStyle: 'italic',
    },
});
