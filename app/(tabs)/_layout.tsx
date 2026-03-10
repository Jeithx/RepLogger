import { Tabs, useRouter, usePathname } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import { View } from 'react-native';
import { Colors } from '../../constants/theme';

type IoniconName = React.ComponentProps<typeof Ionicons>['name'];

interface TabConfig {
  name: string;
  title: string;
  icon: IoniconName;
  iconFocused: IoniconName;
}

const TAB_CONFIG: TabConfig[] = [
  { name: 'index', title: 'Home', icon: 'home-outline', iconFocused: 'home' },
  { name: 'history', title: 'History', icon: 'bar-chart-outline', iconFocused: 'bar-chart' },
  { name: 'routines', title: 'Routines', icon: 'list-outline', iconFocused: 'list' },
  { name: 'settings', title: 'Settings', icon: 'settings-outline', iconFocused: 'settings' },
];

const TAB_ROUTES = [
  '/',
  '/history',
  '/routines',
  '/settings',
] as const;

export default function TabLayout() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const pathname = usePathname();

  const currentIdx = TAB_ROUTES.findIndex((r) =>
    r === '/' ? pathname === '/' : pathname.startsWith(r)
  );

  const swipe = Gesture.Pan()
    .runOnJS(true)
    .activeOffsetX([-40, 40])
    .failOffsetY([-15, 15])
    .onEnd((e) => {
      if (e.translationX < -40 && currentIdx < TAB_ROUTES.length - 1) {
        router.push(TAB_ROUTES[currentIdx + 1]);
      } else if (e.translationX > 40 && currentIdx > 0) {
        router.push(TAB_ROUTES[currentIdx - 1]);
      }
    });

  return (
    <GestureDetector gesture={swipe}>
      <View style={{ flex: 1 }}>
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarStyle: {
          backgroundColor: Colors.surface,
          borderTopColor: Colors.border,
          borderTopWidth: 1,
          height: 60 + insets.bottom,
          paddingBottom: 8 + insets.bottom,
          paddingTop: 8,
        },
        tabBarActiveTintColor: Colors.primary,
        tabBarInactiveTintColor: Colors.textSecondary,
        tabBarLabelStyle: {
          fontSize: 11,
          fontWeight: '500',
        },
      }}
    >
      {TAB_CONFIG.map((tab) => (
        <Tabs.Screen
          key={tab.name}
          name={tab.name}
          options={{
            title: tab.title,
            tabBarIcon: ({ color, focused }) => (
              <Ionicons
                name={focused ? tab.iconFocused : tab.icon}
                size={22}
                color={color}
              />
            ),
          }}
        />
      ))}
    </Tabs>
      </View>
    </GestureDetector>
  );
}
