// Custom entry point — registers the Android widget task handler
// BEFORE expo-router's entry loads, so it's available in headless JS context.
import { registerWidgetTaskHandler } from 'react-native-android-widget';
import { widgetTaskHandler } from './widgets/widgetTaskHandler';

registerWidgetTaskHandler(widgetTaskHandler);

// Boot expo-router normally
import 'expo-router/entry';
