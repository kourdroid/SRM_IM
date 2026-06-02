import { SrmTabBar } from '@/components/ui/SrmTabBar';
import type { BottomTabBarProps } from '@react-navigation/bottom-tabs';

export default function CustomTabBar(props: BottomTabBarProps) {
  return (
    <SrmTabBar
      {...props}
      hiddenRoutes={['index']}
      items={{
        home: {
          label: 'Accueil',
          focusedIcon: 'home',
          icon: 'home-outline',
        },
        'create-incident-new': {
          label: 'Signaler',
          focusedIcon: 'add',
          icon: 'add',
          hideLabelWhenFocused: true,
        },
        profile: {
          label: 'Profil',
          focusedIcon: 'person',
          icon: 'person-outline',
        },
      }}
    />
  );
}
