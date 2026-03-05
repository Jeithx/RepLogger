import { useCallback, useState } from 'react';
import {
  ActivityIndicator,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import * as FileSystem from 'expo-file-system/legacy';
import * as Sharing from 'expo-sharing';
import * as DocumentPicker from 'expo-document-picker';
import { router, useFocusEffect } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { exportFullBackup, importFullBackup, BackupData } from '../../db/backupQueries';
import { getSetting, setSetting } from '../../db/settingsQueries';
import { reloadAllStores } from '../../utils/reloadAllStores';
import { useToastStore } from '../../store/useToastStore';
import { BorderRadius, Colors, Spacing, Typography } from '../../constants/theme';

function formatDate(iso: string): string {
  try {
    return new Date(iso).toLocaleDateString(undefined, {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  } catch {
    return iso;
  }
}

export default function BackupScreen() {
  const [lastBackupDate, setLastBackupDate] = useState<string | null>(null);
  const [isCreating, setIsCreating] = useState(false);
  const [isImporting, setIsImporting] = useState(false);
  const [pendingBackup, setPendingBackup] = useState<BackupData | null>(null);
  const [confirmVisible, setConfirmVisible] = useState(false);
  const showToast = useToastStore((s) => s.showToast);

  useFocusEffect(
    useCallback(() => {
      const date = getSetting('last_backup_date');
      setLastBackupDate(date || null);
    }, [])
  );

  const handleCreateBackup = async () => {
    if (isCreating || isImporting) return;
    setIsCreating(true);
    try {
      const data = exportFullBackup();
      const json = JSON.stringify(data, null, 2);
      const today = new Date().toISOString().slice(0, 10);
      const filename = `HRmetrics_backup_${today}.json`;
      const uri = (FileSystem.cacheDirectory ?? '') + filename;

      await FileSystem.writeAsStringAsync(uri, json, {
        encoding: FileSystem.EncodingType.UTF8,
      });

      const canShare = await Sharing.isAvailableAsync();
      if (!canShare) {
        showToast('Sharing not available on this device', 'error');
        return;
      }

      await Sharing.shareAsync(uri, {
        mimeType: 'application/json',
        UTI: 'public.json',
      });

      const now = new Date().toISOString();
      setSetting('last_backup_date', now);
      setLastBackupDate(now);
      showToast('Backup created successfully', 'success');
    } catch (e) {
      showToast(`Backup failed: ${e instanceof Error ? e.message : String(e)}`, 'error');
    } finally {
      setIsCreating(false);
    }
  };

  const handleImportFile = async () => {
    if (isCreating || isImporting) return;
    try {
      const result = await DocumentPicker.getDocumentAsync({
        type: 'application/json',
        copyToCacheDirectory: true,
      });

      if (result.canceled || result.assets.length === 0) return;

      setIsImporting(true);
      const asset = result.assets[0];
      const content = await FileSystem.readAsStringAsync(asset.uri);

      let parsed: unknown;
      try {
        parsed = JSON.parse(content);
      } catch {
        showToast('Selected file is not valid JSON', 'error');
        setIsImporting(false);
        return;
      }

      if (
        typeof parsed !== 'object' ||
        parsed === null ||
        (parsed as Record<string, unknown>)['version'] !== 1
      ) {
        showToast('This file is not a HRmetrics backup', 'error');
        setIsImporting(false);
        return;
      }

      setPendingBackup(parsed as BackupData);
      setConfirmVisible(true);
      setIsImporting(false);
    } catch (e) {
      showToast(`Import failed: ${e instanceof Error ? e.message : String(e)}`, 'error');
      setIsImporting(false);
    }
  };

  const handleConfirmRestore = () => {
    if (!pendingBackup) return;
    setConfirmVisible(false);
    setIsImporting(true);

    // Small delay so the modal can close before the sync DB work blocks the thread
    setTimeout(() => {
      const result = importFullBackup(pendingBackup);
      setIsImporting(false);
      setPendingBackup(null);

      if (result.success) {
        reloadAllStores();
        showToast('Restore complete', 'success');
      } else {
        showToast(`Restore failed: ${result.error ?? 'Unknown error'}`, 'error');
      }
    }, 150);
  };

  const handleCancelConfirm = () => {
    setConfirmVisible(false);
    setPendingBackup(null);
  };

  const busy = isCreating || isImporting;

  const backupStats = pendingBackup
    ? {
      workouts: pendingBackup.workouts.length,
      routines: pendingBackup.routines.length,
      bodyWeight: pendingBackup.bodyWeightEntries.length,
    }
    : null;

  return (
    <View style={styles.root}>
      {/* ── Header ── */}
      <View style={styles.header}>
        <Pressable onPress={() => router.back()} hitSlop={12} style={styles.headerSide}>
          <Ionicons name="chevron-back" size={24} color={Colors.text} />
        </Pressable>
        <Text style={styles.headerTitle}>Backup & Restore</Text>
        <View style={styles.headerSide} />
      </View>

      <ScrollView contentContainerStyle={styles.content}>

        {/* ── Backup ── */}
        <Text style={styles.sectionHeader}>BACKUP</Text>
        <View style={styles.card}>
          <Text style={styles.descText}>
            Save all your workouts, routines, and progress to a file on your device.
          </Text>
          <View style={styles.infoRow}>
            <Text style={styles.infoLabel}>Last backup</Text>
            <Text style={styles.infoValue}>
              {lastBackupDate ? formatDate(lastBackupDate) : 'Never'}
            </Text>
          </View>
          <Pressable
            style={({ pressed }) => [
              styles.primaryBtn,
              busy && styles.btnDisabled,
              pressed && !busy && styles.btnPressed,
            ]}
            onPress={handleCreateBackup}
            disabled={busy}
          >
            {isCreating ? (
              <ActivityIndicator color={Colors.background} size="small" />
            ) : (
              <Text style={styles.primaryBtnText}>Create Backup</Text>
            )}
          </Pressable>
        </View>

        {/* ── Restore ── */}
        <Text style={styles.sectionHeader}>RESTORE</Text>
        <View style={styles.card}>
          <View style={styles.warningCard}>
            <Text style={styles.warningText}>
              ⚠️  Restoring a backup will replace ALL current data. This cannot be undone.
            </Text>
          </View>
          <Pressable
            style={({ pressed }) => [
              styles.outlineBtn,
              busy && styles.btnDisabled,
              pressed && !busy && styles.btnPressed,
            ]}
            onPress={handleImportFile}
            disabled={busy}
          >
            {isImporting ? (
              <ActivityIndicator color={Colors.text} size="small" />
            ) : (
              <Text style={styles.outlineBtnText}>Import Backup File</Text>
            )}
          </Pressable>
        </View>

        {/* ── Tip ── */}
        <View style={styles.tipCard}>
          <Text style={styles.tipText}>
            Tip: Back up regularly to avoid losing your data. Your data is stored only on this device.
          </Text>
        </View>

      </ScrollView>

      {/* ── Confirm Restore Sheet ── */}
      <Modal
        visible={confirmVisible}
        transparent
        animationType="slide"
        onRequestClose={handleCancelConfirm}
      >
        <Pressable style={styles.backdrop} onPress={handleCancelConfirm} />
        <View style={styles.sheet}>
          <Text style={styles.sheetTitle}>Restore Backup?</Text>

          {pendingBackup && (
            <Text style={styles.sheetMeta}>
              From {formatDate(pendingBackup.exportedAt)}
            </Text>
          )}

          {backupStats && (
            <View style={styles.statsRow}>
              <View style={styles.statChip}>
                <Text style={styles.statNumber}>{backupStats.workouts}</Text>
                <Text style={styles.statLabel}>workout{backupStats.workouts !== 1 ? 's' : ''}</Text>
              </View>
              <View style={styles.statChip}>
                <Text style={styles.statNumber}>{backupStats.routines}</Text>
                <Text style={styles.statLabel}>routine{backupStats.routines !== 1 ? 's' : ''}</Text>
              </View>
              <View style={styles.statChip}>
                <Text style={styles.statNumber}>{backupStats.bodyWeight}</Text>
                <Text style={styles.statLabel}>weigh-ins</Text>
              </View>
            </View>
          )}

          <Text style={styles.sheetWarning}>
            All current data will be replaced. This cannot be undone.
          </Text>

          <View style={styles.sheetButtons}>
            <Pressable
              style={({ pressed }) => [styles.cancelBtn, pressed && styles.btnPressed]}
              onPress={handleCancelConfirm}
            >
              <Text style={styles.cancelBtnText}>Cancel</Text>
            </Pressable>
            <Pressable
              style={({ pressed }) => [styles.restoreBtn, pressed && styles.btnPressed]}
              onPress={handleConfirmRestore}
            >
              <Text style={styles.restoreBtnText}>Restore</Text>
            </Pressable>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: Colors.background },

  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: Spacing.md,
    paddingTop: Spacing.xxxl,
    paddingBottom: Spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
  },
  headerSide: { width: 40, alignItems: 'center' },
  headerTitle: {
    flex: 1,
    color: Colors.text,
    fontSize: Typography.size.lg,
    fontWeight: Typography.weight.bold,
    textAlign: 'center',
  },

  content: {
    paddingHorizontal: Spacing.lg,
    paddingTop: Spacing.lg,
    paddingBottom: Spacing.xxxl,
    gap: Spacing.sm,
  },

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
    padding: Spacing.lg,
    gap: Spacing.md,
  },

  descText: {
    color: Colors.textSecondary,
    fontSize: Typography.size.sm,
    lineHeight: 20,
  },

  infoRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  infoLabel: {
    color: Colors.textSecondary,
    fontSize: Typography.size.sm,
  },
  infoValue: {
    color: Colors.text,
    fontSize: Typography.size.sm,
    fontWeight: Typography.weight.medium,
  },

  primaryBtn: {
    backgroundColor: Colors.primary,
    borderRadius: BorderRadius.md,
    paddingVertical: Spacing.md,
    alignItems: 'center',
    minHeight: 48,
    justifyContent: 'center',
  },
  primaryBtnText: {
    color: Colors.background,
    fontSize: Typography.size.md,
    fontWeight: Typography.weight.bold,
  },

  outlineBtn: {
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: BorderRadius.md,
    paddingVertical: Spacing.md,
    alignItems: 'center',
    minHeight: 48,
    justifyContent: 'center',
  },
  outlineBtnText: {
    color: Colors.text,
    fontSize: Typography.size.md,
    fontWeight: Typography.weight.semibold,
  },

  btnDisabled: { opacity: 0.5 },
  btnPressed: { opacity: 0.75 },

  warningCard: {
    backgroundColor: '#3D2E00',
    borderRadius: BorderRadius.md,
    borderWidth: 1,
    borderColor: '#7A5C00',
    padding: Spacing.md,
  },
  warningText: {
    color: '#FFD60A',
    fontSize: Typography.size.sm,
    lineHeight: 20,
  },

  tipCard: {
    marginTop: Spacing.lg,
    padding: Spacing.lg,
    backgroundColor: Colors.surface,
    borderRadius: BorderRadius.lg,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  tipText: {
    color: Colors.textSecondary,
    fontSize: Typography.size.sm,
    lineHeight: 20,
    textAlign: 'center',
    fontStyle: 'italic',
  },

  // ── Confirm sheet ──
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.6)',
  },
  sheet: {
    backgroundColor: Colors.surface,
    borderTopLeftRadius: BorderRadius.xl,
    borderTopRightRadius: BorderRadius.xl,
    borderWidth: 1,
    borderColor: Colors.border,
    paddingHorizontal: Spacing.xl,
    paddingTop: Spacing.xl,
    paddingBottom: Spacing.xxxl,
    gap: Spacing.md,
  },
  sheetTitle: {
    color: Colors.text,
    fontSize: Typography.size.xl,
    fontWeight: Typography.weight.bold,
    textAlign: 'center',
  },
  sheetMeta: {
    color: Colors.textSecondary,
    fontSize: Typography.size.sm,
    textAlign: 'center',
  },
  statsRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: Spacing.sm,
    marginVertical: Spacing.xs,
  },
  statChip: {
    flex: 1,
    backgroundColor: Colors.surfaceElevated,
    borderRadius: BorderRadius.md,
    borderWidth: 1,
    borderColor: Colors.border,
    paddingVertical: Spacing.sm,
    alignItems: 'center',
    gap: 2,
  },
  statNumber: {
    color: Colors.text,
    fontSize: Typography.size.lg,
    fontWeight: Typography.weight.bold,
  },
  statLabel: {
    color: Colors.textSecondary,
    fontSize: Typography.size.xs,
  },
  sheetWarning: {
    color: Colors.textSecondary,
    fontSize: Typography.size.sm,
    textAlign: 'center',
  },
  sheetButtons: {
    flexDirection: 'row',
    gap: Spacing.md,
    marginTop: Spacing.sm,
  },
  cancelBtn: {
    flex: 1,
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: BorderRadius.md,
    paddingVertical: Spacing.md,
    alignItems: 'center',
  },
  cancelBtnText: {
    color: Colors.text,
    fontSize: Typography.size.md,
    fontWeight: Typography.weight.semibold,
  },
  restoreBtn: {
    flex: 1,
    backgroundColor: Colors.error,
    borderRadius: BorderRadius.md,
    paddingVertical: Spacing.md,
    alignItems: 'center',
  },
  restoreBtnText: {
    color: Colors.text,
    fontSize: Typography.size.md,
    fontWeight: Typography.weight.bold,
  },
});
