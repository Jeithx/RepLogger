import { View, Text, StyleSheet } from 'react-native';
import { Colors, Typography, Spacing } from '../../constants/theme';

export default function SettingsScreen() {
  return (
    <View style={styles.container}>
      <Text style={styles.text}>Settings</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.background,
    alignItems: 'center',
    justifyContent: 'center',
  },
  text: {
    color: Colors.text,
    fontSize: Typography.size.xl,
    fontWeight: Typography.weight.semibold,
    letterSpacing: Spacing.xs * 0.1,
  },
});
