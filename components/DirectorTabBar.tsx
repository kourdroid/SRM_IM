import { SrmTabBar } from '@/components/ui/SrmTabBar';
import type { BottomTabBarProps } from '@react-navigation/bottom-tabs';

export default function DirectorTabBar(props: BottomTabBarProps) {
  return (
    <SrmTabBar
      {...props}
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
      }}
    />
  );
}
