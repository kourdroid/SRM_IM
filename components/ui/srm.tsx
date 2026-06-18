import { COLORS, RADIUS, SPACING, TYPOGRAPHY } from '@/src/core/constants/theme';
import { Ionicons } from '@expo/vector-icons';
import type { ReactNode } from 'react';
import {
  ActivityIndicator,
  Platform,
  StyleProp,
  StyleSheet,
  Text,
  TextInput,
  TextStyle,
  TouchableOpacity,
  View,
  ViewStyle,
} from 'react-native';

type IconName = keyof typeof Ionicons.glyphMap;

interface ScreenHeaderProps {
  kicker?: string;
  title: string;
  subtitle?: string;
  rightSlot?: ReactNode;
  avatarText?: string;
  style?: StyleProp<ViewStyle>;
}

export function SrmScreenHeader({
  kicker,
  title,
  subtitle,
  rightSlot,
  avatarText,
  style,
}: ScreenHeaderProps) {
  return (
    <View style={[styles.screenHeader, style]}>
      {avatarText ? (
        <View style={styles.headerAvatar}>
          <Text style={styles.headerAvatarText}>{avatarText}</Text>
        </View>
      ) : null}

      <View style={styles.headerCopy}>
        {kicker ? <Text style={styles.headerKicker}>{kicker}</Text> : null}
        <Text style={styles.headerTitle} numberOfLines={1}>{title}</Text>
        {subtitle ? <Text style={styles.headerSubtitle} numberOfLines={1}>{subtitle}</Text> : null}
      </View>

      {rightSlot ? <View style={styles.headerRight}>{rightSlot}</View> : null}
    </View>
  );
}

interface PanelProps {
  children: ReactNode;
  style?: StyleProp<ViewStyle>;
}

export function SrmPanel({ children, style }: PanelProps) {
  return <View style={[styles.panel, style]}>{children}</View>;
}

interface SettingsRowProps {
  icon: IconName;
  iconColor?: string;
  iconBackground?: string;
  title: string;
  description?: string;
  trailing?: ReactNode;
  danger?: boolean;
  onPress?: () => void;
  isLast?: boolean;
}

export function SrmSettingsRow({
  icon,
  iconColor = COLORS.textPrimary,
  iconBackground = COLORS.background,
  title,
  description,
  trailing,
  danger,
  onPress,
  isLast,
}: SettingsRowProps) {
  const Container = onPress ? TouchableOpacity : View;

  return (
    <Container
      style={[styles.settingsRow, !isLast && styles.rowDivider]}
      onPress={onPress}
      activeOpacity={0.78}
    >
      <View style={[styles.rowIcon, { backgroundColor: iconBackground }]}>
        <Ionicons name={icon} size={20} color={danger ? COLORS.signalRed : iconColor} />
      </View>

      <View style={styles.rowCopy}>
        <Text style={[styles.rowTitle, danger && styles.dangerText]}>{title}</Text>
        {description ? <Text style={styles.rowDescription} numberOfLines={2}>{description}</Text> : null}
      </View>

      {trailing ?? (onPress ? <Ionicons name="chevron-forward" size={20} color={COLORS.textMuted} /> : null)}
    </Container>
  );
}

interface ActionButtonProps {
  label: string;
  icon?: IconName;
  variant?: 'primary' | 'secondary' | 'danger';
  loading?: boolean;
  disabled?: boolean;
  onPress: () => void;
  style?: StyleProp<ViewStyle>;
}

export function SrmActionButton({
  label,
  icon,
  variant = 'primary',
  loading,
  disabled,
  onPress,
  style,
}: ActionButtonProps) {
  const isDanger = variant === 'danger';
  const isSecondary = variant === 'secondary';
  const textColor = isDanger ? COLORS.signalRed : COLORS.textPrimary;

  return (
    <TouchableOpacity
      style={[
        styles.actionButton,
        isSecondary && styles.secondaryButton,
        isDanger && styles.dangerButton,
        disabled && styles.disabled,
        style,
      ]}
      onPress={onPress}
      disabled={disabled || loading}
      activeOpacity={0.84}
    >
      {loading ? (
        <ActivityIndicator color={textColor} size="small" />
      ) : (
        <>
          {icon ? <Ionicons name={icon} size={18} color={textColor} /> : null}
          <Text style={[styles.actionButtonText, { color: textColor }]}>{label}</Text>
        </>
      )}
    </TouchableOpacity>
  );
}

interface IconButtonProps {
  icon: IconName;
  color?: string;
  disabled?: boolean;
  onPress: () => void;
}

export function SrmIconButton({
  icon,
  color = COLORS.textSecondary,
  disabled,
  onPress,
}: IconButtonProps) {
  return (
    <TouchableOpacity
      style={[styles.iconButton, disabled && styles.disabled]}
      onPress={onPress}
      disabled={disabled}
      activeOpacity={0.7}
    >
      <Ionicons name={icon} size={20} color={color} />
    </TouchableOpacity>
  );
}

interface StatusBadgeProps {
  label: string;
  variant?: 'neutral' | 'success' | 'danger' | 'warning' | 'info';
  style?: StyleProp<ViewStyle>;
}

export function SrmStatusBadge({ label, variant = 'neutral', style }: StatusBadgeProps) {
  const variantStyle = badgeVariants[variant];

  return (
    <View style={[styles.badge, variantStyle.container, style]}>
      <Text style={[styles.badgeText, variantStyle.text]}>{label}</Text>
    </View>
  );
}

interface SearchFieldProps {
  value: string;
  placeholder: string;
  onChangeText: (value: string) => void;
  onClear?: () => void;
  autoCapitalize?: 'none' | 'sentences' | 'words' | 'characters';
  style?: StyleProp<ViewStyle>;
}

export function SrmSearchField({
  value,
  placeholder,
  onChangeText,
  onClear,
  autoCapitalize = 'none',
  style,
}: SearchFieldProps) {
  return (
    <View style={[styles.searchRow, style]}>
      <Ionicons name="search" size={20} color={COLORS.textMuted} />
      <TextInput
        value={value}
        onChangeText={onChangeText}
        placeholder={placeholder}
        placeholderTextColor={COLORS.textMuted}
        style={styles.searchInput}
        autoCapitalize={autoCapitalize}
      />
      {value.length > 0 && onClear ? (
        <TouchableOpacity onPress={onClear} activeOpacity={0.7}>
          <Ionicons name="close-circle" size={20} color={COLORS.textMuted} />
        </TouchableOpacity>
      ) : null}
    </View>
  );
}

interface MetricItem {
  label: string;
  value: string | number;
}

interface MetricStripProps {
  items: MetricItem[];
}

export function SrmMetricStrip({ items }: MetricStripProps) {
  return (
    <View style={styles.metricStrip}>
      {items.map((item, index) => (
        <View
          key={item.label}
          style={[styles.metricItem, index < items.length - 1 && styles.metricDivider]}
        >
          <Text style={styles.metricValue}>{item.value}</Text>
          <Text style={styles.metricLabel}>{item.label}</Text>
        </View>
      ))}
    </View>
  );
}

export function SrmEmptyState({
  icon,
  title,
  message,
}: {
  icon: IconName;
  title: string;
  message: string;
}) {
  return (
    <View style={styles.emptyContainer}>
      <View style={styles.emptyIcon}>
        <Ionicons name={icon} size={34} color={COLORS.signalBlue} />
      </View>
      <Text style={styles.emptyTitle}>{title}</Text>
      <Text style={styles.emptyText}>{message}</Text>
    </View>
  );
}

type SkeletonSize = number | `${number}%`;

interface SkeletonBlockProps {
  width?: SkeletonSize;
  height?: number;
  radius?: number;
  style?: StyleProp<ViewStyle>;
}

export function SrmSkeletonBlock({
  width = '100%',
  height = 14,
  radius = RADIUS.sm,
  style,
}: SkeletonBlockProps) {
  return (
    <View
      style={[
        styles.skeletonBlock,
        { width, height, borderRadius: radius },
        style,
      ]}
    />
  );
}

export function SrmSkeletonCard({
  rows = 3,
  showAvatar,
  style,
}: {
  rows?: number;
  showAvatar?: boolean;
  style?: StyleProp<ViewStyle>;
}) {
  return (
    <View style={[styles.skeletonCard, style]}>
      <View style={styles.skeletonCardRow}>
        {showAvatar ? <SrmSkeletonBlock width={42} height={42} radius={RADIUS.md} /> : null}
        <View style={styles.skeletonCardCopy}>
          {Array.from({ length: rows }).map((_, index) => (
            <SrmSkeletonBlock
              key={index}
              width={index === 0 ? '72%' : index === rows - 1 ? '44%' : '92%'}
              height={index === 0 ? 16 : 12}
              style={index > 0 ? styles.skeletonLineGap : undefined}
            />
          ))}
        </View>
      </View>
    </View>
  );
}

export function SrmListSkeleton({
  count = 5,
  showAvatar,
  style,
}: {
  count?: number;
  showAvatar?: boolean;
  style?: StyleProp<ViewStyle>;
}) {
  return (
    <View style={[styles.skeletonList, style]}>
      {Array.from({ length: count }).map((_, index) => (
        <SrmSkeletonCard key={index} showAvatar={showAvatar} />
      ))}
    </View>
  );
}

const badgeVariants: Record<
  NonNullable<StatusBadgeProps['variant']>,
  { container: ViewStyle; text: TextStyle }
> = {
  neutral: {
    container: { backgroundColor: 'rgba(107, 114, 128, 0.12)' },
    text: { color: COLORS.textSecondary },
  },
  success: {
    container: { backgroundColor: COLORS.signalGreenTint },
    text: { color: COLORS.signalGreen },
  },
  danger: {
    container: { backgroundColor: COLORS.signalRedTint },
    text: { color: COLORS.signalRed },
  },
  warning: {
    container: { backgroundColor: COLORS.signalOrangeTint, borderWidth: 1, borderColor: COLORS.signalOrange },
    text: { color: COLORS.signalOrange },
  },
  info: {
    container: { backgroundColor: COLORS.signalBlueTint },
    text: { color: COLORS.signalBlue },
  },
};

const styles = StyleSheet.create({
  screenHeader: {
    backgroundColor: COLORS.textPrimary,
    paddingHorizontal: SPACING.xl,
    paddingTop: Platform.OS === 'ios' ? 60 : 48,
    paddingBottom: SPACING.xxl,
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.lg,
  },
  headerAvatar: {
    width: 58,
    height: 58,
    borderRadius: RADIUS.md,
    backgroundColor: COLORS.accent,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerAvatarText: {
    color: COLORS.textPrimary,
    fontSize: 25,
    fontWeight: '900',
  },
  headerCopy: {
    flex: 1,
    minWidth: 0,
  },
  headerKicker: {
    ...TYPOGRAPHY.labelUppercase,
    color: COLORS.accent,
    marginBottom: SPACING.xs,
  },
  headerTitle: {
    ...TYPOGRAPHY.display,
    color: COLORS.surface,
  },
  headerSubtitle: {
    ...TYPOGRAPHY.label,
    color: COLORS.textMuted,
    marginTop: SPACING.xs,
  },
  headerRight: {
    flexShrink: 0,
  },
  panel: {
    backgroundColor: COLORS.surface,
    borderRadius: RADIUS.lg,
    borderWidth: 1,
    borderColor: COLORS.border,
    overflow: 'hidden',
    ...Platform.select({
      ios: {
        shadowColor: COLORS.textPrimary,
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.04,
        shadowRadius: 6,
      },
      android: {
        elevation: 1,
      },
    }),
  },
  settingsRow: {
    minHeight: 78,
    padding: SPACING.lg,
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.md,
    backgroundColor: COLORS.surface,
  },
  rowDivider: {
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
  },
  rowIcon: {
    width: 42,
    height: 42,
    borderRadius: RADIUS.md,
    alignItems: 'center',
    justifyContent: 'center',
  },
  rowCopy: {
    flex: 1,
    minWidth: 0,
  },
  rowTitle: {
    ...TYPOGRAPHY.title,
    color: COLORS.textPrimary,
  },
  rowDescription: {
    ...TYPOGRAPHY.label,
    color: COLORS.textSecondary,
    marginTop: 3,
  },
  dangerText: {
    color: COLORS.signalRed,
  },
  actionButton: {
    height: 48,
    borderRadius: RADIUS.md,
    backgroundColor: COLORS.accent,
    borderWidth: 1,
    borderColor: COLORS.accent,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: SPACING.sm,
  },
  secondaryButton: {
    backgroundColor: COLORS.background,
    borderColor: COLORS.border,
  },
  dangerButton: {
    backgroundColor: COLORS.signalRedTint,
    borderColor: '#FCA5A5',
  },
  disabled: {
    opacity: 0.55,
  },
  actionButtonText: {
    ...TYPOGRAPHY.bodyBold,
  },
  iconButton: {
    width: 36,
    height: 36,
    borderRadius: RADIUS.md,
    backgroundColor: COLORS.background,
    alignItems: 'center',
    justifyContent: 'center',
  },
  badge: {
    borderRadius: RADIUS.sm,
    paddingHorizontal: 7,
    paddingVertical: 5,
  },
  badgeText: {
    fontSize: 9,
    fontWeight: '900',
    letterSpacing: 0.7,
  },
  searchRow: {
    height: 52,
    paddingHorizontal: 14,
    borderRadius: RADIUS.md,
    borderWidth: 1,
    borderColor: COLORS.border,
    backgroundColor: COLORS.surface,
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.sm,
  },
  searchInput: {
    flex: 1,
    color: COLORS.textPrimary,
    fontSize: 14,
    fontWeight: '600',
  },
  metricStrip: {
    flexDirection: 'row',
    backgroundColor: COLORS.surface,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
  },
  metricItem: {
    flex: 1,
    paddingVertical: 14,
    alignItems: 'center',
  },
  metricDivider: {
    borderRightWidth: 1,
    borderRightColor: COLORS.border,
  },
  metricValue: {
    color: COLORS.textPrimary,
    fontSize: 20,
    fontWeight: '800',
  },
  metricLabel: {
    color: COLORS.textMuted,
    fontSize: 10,
    fontWeight: '900',
    letterSpacing: 0.9,
    marginTop: 2,
  },
  emptyContainer: {
    paddingTop: 60,
    alignItems: 'center',
    paddingHorizontal: 28,
  },
  emptyIcon: {
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: COLORS.signalBlueTint,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 14,
  },
  emptyTitle: {
    ...TYPOGRAPHY.title,
    color: COLORS.textPrimary,
  },
  emptyText: {
    ...TYPOGRAPHY.label,
    color: COLORS.textSecondary,
    textAlign: 'center',
    marginTop: SPACING.sm,
  },
  skeletonBlock: {
    backgroundColor: COLORS.border,
  },
  skeletonList: {
    paddingHorizontal: SPACING.lg,
    paddingTop: SPACING.lg,
  },
  skeletonCard: {
    backgroundColor: COLORS.surface,
    borderRadius: RADIUS.md,
    borderWidth: 1,
    borderColor: COLORS.border,
    padding: SPACING.lg,
    marginBottom: SPACING.md,
  },
  skeletonCardRow: {
    flexDirection: 'row',
    gap: SPACING.md,
    alignItems: 'center',
  },
  skeletonCardCopy: {
    flex: 1,
    minWidth: 0,
  },
  skeletonLineGap: {
    marginTop: SPACING.sm,
  },
});
