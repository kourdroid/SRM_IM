/**
 * SRM Design System — Shared Token File
 * Single source of truth for all visual constants.
 * Import COLORS, TYPOGRAPHY, SPACING, and RADIUS into every screen.
 * Never hard-code hex values outside this file.
 */

// ─── Color Tokens ────────────────────────────────────────────────────────────
export const COLORS = {
  // Brand
  accent: '#DAF22C',        // Electric Lime — the safety signal

  // Surfaces
  background: '#F3F4F6',    // Field Gray — app canvas
  surface: '#FFFFFF',       // Surface White — cards, inputs, modals
  surfaceAlt: '#F9FAFB',    // Slightly tinted — nested card backs

  // Text
  textPrimary: '#111827',   // Control Dark — all primary text
  textSecondary: '#6B7280', // Text Secondary — labels, meta
  textMuted: '#9CA3AF',     // Text Muted — placeholders, disabled, version

  // Borders
  border: '#E5E7EB',        // Border Wire — all non-accent borders
  borderStrong: '#D1D5DB',  // Stronger dividers when needed

  // Status / Signal (strictly semantic — never decorative)
  signalRed: '#EF4444',     // Open incidents, errors, destructive
  signalGreen: '#22C55E',   // Resolved, success
  signalOrange: '#F59E0B',  // Reclamations, warnings
  signalBlue: '#3B82F6',    // Informational, total count

  // Signal Tints (backgrounds for badges)
  signalRedTint: '#FEF2F2',
  signalGreenTint: '#F0FDF4',
  signalOrangeTint: '#FFFBEB',
  signalBlueTint: '#EFF6FF',

  // Icon Tints (icon container backgrounds in stat cards)
  iconBlueTint: '#EFF6FF',
  iconRedTint: '#FEF2F2',
  iconGreenTint: '#F0FDF4',
  iconOrangeTint: '#FFFBEB',
} as const;

// ─── Typography Scale ────────────────────────────────────────────────────────
export const TYPOGRAPHY = {
  // Display — one per screen, screen title
  display: {
    fontSize: 26,
    fontWeight: '800' as const,
    letterSpacing: -0.5,
    lineHeight: 30,
  },
  // Heading — section headers, modal titles
  heading: {
    fontSize: 18,
    fontWeight: '700' as const,
    letterSpacing: 0,
    lineHeight: 24,
  },
  // Title — card primary text, list item titles
  title: {
    fontSize: 16,
    fontWeight: '700' as const,
    letterSpacing: 0,
    lineHeight: 22,
  },
  // Body — descriptions, detail values
  body: {
    fontSize: 14,
    fontWeight: '400' as const,
    letterSpacing: 0,
    lineHeight: 20,
  },
  // Body emphasized — settings labels, bold body
  bodyBold: {
    fontSize: 14,
    fontWeight: '600' as const,
    letterSpacing: 0,
    lineHeight: 20,
  },
  // Label — stat card labels, form field labels
  label: {
    fontSize: 12,
    fontWeight: '700' as const,
    letterSpacing: 0.3,
    lineHeight: 16,
  },
  // Label Uppercase — status badges, zone IDs, role indicators
  labelUppercase: {
    fontSize: 11,
    fontWeight: '900' as const,
    letterSpacing: 1.5,
    lineHeight: 14,
    textTransform: 'uppercase' as const,
  },
} as const;

// ─── Spacing Scale ───────────────────────────────────────────────────────────
export const SPACING = {
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 20,
  xxl: 24,
  section: 40,
} as const;

// ─── Border Radius ───────────────────────────────────────────────────────────
export const RADIUS = {
  none: 0,
  sm: 4,    // Inputs, badges, secondary buttons
  md: 8,    // Cards, tab items, menu rows
  lg: 16,   // Main content cards, bottom sheet top corners
  xl: 24,   // Admin header bottom corners (architectural)
  full: 50, // Avatar circles, pill badges
} as const;
