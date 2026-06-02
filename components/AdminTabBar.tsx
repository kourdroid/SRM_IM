import { SrmTabBar } from '@/components/ui/SrmTabBar';
import type { BottomTabBarProps } from '@react-navigation/bottom-tabs';

export default function AdminTabBar(props: BottomTabBarProps) {
  return (
    <SrmTabBar
      {...props}
      hiddenRoutes={['users', 'communes']}
      activeRouteFor={(routeName, currentRouteName) =>
        routeName === 'profile' && (currentRouteName === 'users' || currentRouteName === 'communes')
      }
      items={{
        dashboard: {
          label: 'Accueil',
          focusedIcon: 'home',
          icon: 'home-outline',
        },
        incidents: {
          label: 'Incidents',
          focusedIcon: 'flash',
          icon: 'flash-outline',
        },
        reports: {
          label: 'Rapports',
          focusedIcon: 'document-text',
          icon: 'document-text-outline',
        },
        profile: {
          label: 'Paramètres',
          focusedIcon: 'settings',
          icon: 'settings-outline',
        },
      }}
    />
  );
}
