---
name: SRM
description: ONEE Field Incident Management System
colors:
  electric-lime: "#DAF22C"
  control-dark: "#111827"
  field-gray-bg: "#F3F4F6"
  surface-white: "#FFFFFF"
  border-wire: "#E5E7EB"
  text-secondary: "#6B7280"
  text-muted: "#9CA3AF"
  signal-red: "#EF4444"
  signal-green: "#22C55E"
  signal-orange: "#F59E0B"
  signal-blue: "#3B82F6"
  brand-dark-legacy: "#191820"
typography:
  display:
    fontFamily: "Inter, -apple-system, BlinkMacSystemFont, system-ui, sans-serif"
    fontSize: "26px"
    fontWeight: 800
    lineHeight: 1.15
    letterSpacing: "-0.5px"
  title:
    fontFamily: "Inter, system-ui, sans-serif"
    fontSize: "18px"
    fontWeight: 700
    lineHeight: 1.3
    letterSpacing: "0px"
  body:
    fontFamily: "Inter, system-ui, sans-serif"
    fontSize: "14px"
    fontWeight: 400
    lineHeight: 1.5
    letterSpacing: "0px"
  label:
    fontFamily: "Inter, system-ui, sans-serif"
    fontSize: "12px"
    fontWeight: 700
    lineHeight: 1.3
    letterSpacing: "0.3px"
  label-uppercase:
    fontFamily: "Inter, system-ui, sans-serif"
    fontSize: "11px"
    fontWeight: 900
    lineHeight: 1.2
    letterSpacing: "1.5px"
rounded:
  none: "0px"
  sm: "4px"
  md: "8px"
  lg: "16px"
  pill: "20px"
  full: "50px"
spacing:
  xs: "4px"
  sm: "8px"
  md: "12px"
  lg: "16px"
  xl: "20px"
  xxl: "24px"
  section: "40px"
components:
  button-primary:
    backgroundColor: "{colors.electric-lime}"
    textColor: "{colors.control-dark}"
    rounded: "{rounded.sm}"
    padding: "16px 48px"
  button-primary-hover:
    backgroundColor: "{colors.electric-lime}"
  button-danger:
    backgroundColor: "{colors.signal-red}"
    textColor: "{colors.surface-white}"
    rounded: "{rounded.sm}"
    padding: "16px 48px"
  card-surface:
    backgroundColor: "{colors.surface-white}"
    textColor: "{colors.control-dark}"
    rounded: "{rounded.lg}"
    padding: "16px"
  input-field:
    backgroundColor: "{colors.surface-white}"
    textColor: "{colors.control-dark}"
    rounded: "{rounded.sm}"
    padding: "16px"
  tab-active:
    backgroundColor: "{colors.electric-lime}"
    textColor: "{colors.control-dark}"
    rounded: "{rounded.md}"
    padding: "0px"
  tab-inactive:
    backgroundColor: "{colors.field-gray-bg}"
    textColor: "{colors.text-muted}"
    rounded: "{rounded.md}"
    padding: "0px"
  status-badge-open:
    backgroundColor: "rgba(239, 68, 68, 0.1)"
    textColor: "{colors.signal-red}"
    rounded: "{rounded.sm}"
    padding: "4px 8px"
  status-badge-closed:
    backgroundColor: "rgba(34, 197, 94, 0.1)"
    textColor: "{colors.signal-green}"
    rounded: "{rounded.sm}"
    padding: "4px 8px"
---

# Design System: SRM

## 1. Overview

**Creative North Star: "The Safety Vest"**

High-contrast industrial markers on a neutral canvas. The electric lime accent is the safety signal, not decoration. It marks what matters: the current tab, the primary action, the sync indicator, the resolved status. Everything else steps back into grays, whites, and dark text.

SRM is a field utility tool for ONEE electrical technicians. The visual system prioritizes legibility in harsh outdoor light, one-handed operation, and instant status recognition over aesthetic finesse. It borrows from industrial control panels and safety equipment: high-contrast pairs, uppercase labels with wide tracking, dense data without ornamental spacing.

The system explicitly rejects consumer social app aesthetics, SaaS dashboard clichés (gradient hero cards, bouncing counters, glassmorphism), Material Design defaults (too rounded, too colorful), and neon dark-mode aesthetics. This is a governmental utility, not a startup product.

**Key Characteristics:**
- Industrial high-contrast: dark text on light surfaces, lime on dark headers
- Flat by default: depth through tonal layering, not shadows
- Label-heavy: uppercase, tracked, 11-12px labels everywhere
- Status-driven: color encodes meaning (red = open, green = resolved, orange = reclamation, blue = informational)
- Dense: information over whitespace

## 2. Colors: The Safety Vest Palette

A restrained palette with one high-visibility accent. Color is functional, encoding status and hierarchy. The lime is rare enough to command attention.

### Primary
- **Electric Lime** (`#DAF22C`): The safety signal. Used on active tab backgrounds, primary CTA buttons, the sync indicator border, and resolved-status tints. Forbidden on large surfaces, text, or decorative fills. Its power comes from scarcity.

### Neutral
- **Control Dark** (`#111827`): Primary text, header backgrounds, icon color on active states. The anchoring dark; never pure black.
- **Field Gray** (`#F3F4F6`): The canvas. App background, inactive tab fill, secondary surface behind content.
- **Surface White** (`#FFFFFF`): Card backgrounds, input fields, modal content. The primary content surface.
- **Border Wire** (`#E5E7EB`): All non-accent borders, card outlines, tab bar top edge, dividers.
- **Text Secondary** (`#6B7280`): Timestamps, sublabels, meta-information.
- **Text Muted** (`#9CA3AF`): Placeholder text, disabled states, inactive tab icons, version labels.

### Signal (Semantic)
- **Signal Red** (`#EF4444`): Open incidents, error states, destructive actions (delete, sign out).
- **Signal Green** (`#22C55E`): Resolved incidents, success confirmation.
- **Signal Orange** (`#F59E0B`): Reclamation flags, warning states.
- **Signal Blue** (`#3B82F6`): Informational KPIs (total incident count), loading indicators on legacy screens.

### Named Rules
**The Vest Rule.** Electric Lime covers no more than 15% of any screen. Active tab + primary CTA + accent borders, nothing else. If lime starts appearing on cards, badges, or decorative elements, the safety signal is diluted.

**The Status Truth Rule.** Red, green, orange, and blue are reserved exclusively for status communication. They never appear as decoration, branding, or emphasis. If a color doesn't encode a state, it must be a neutral.

## 3. Typography

**Body Font:** Inter (with system-ui, -apple-system fallback)

**Character:** A single sans-serif family carries the entire interface. Inter was chosen for its tall x-height, clear numerals, and availability across platforms. No display pairing; this is a data tool, not editorial content.

### Hierarchy
- **Display** (800, 26px, 1.15 line-height, -0.5px tracking): Screen titles only. "Tableau de bord", "HELLO, MEHDI". One per screen.
- **Title** (700, 18px, 1.3 line-height): Section headers, modal titles, card primary text.
- **Body** (400/600, 14px, 1.5 line-height): Descriptions, detail values, settings labels. Max line length 75ch for prose blocks.
- **Label** (700, 12px, 0.3px tracking): Stat card labels, detail row headers, form field labels. The workhorse.
- **Label Uppercase** (900, 11px, 1.5px tracking, uppercase): Status badges, role indicators, zone identifiers, type badges. The industrial voice.

### Named Rules
**The Weight Ladder Rule.** Four weights only: 400 (body), 600 (emphasized body), 700 (labels and titles), 800/900 (display and badges). No 300 or 500 in the system; they blur the hierarchy.

## 4. Elevation

Flat by default. Depth is conveyed through tonal layering: Field Gray canvas (`#F3F4F6`) sits behind Surface White cards (`#FFFFFF`), which sit behind Control Dark headers (`#111827`). This three-tier stack is the entire depth model.

Shadows appear only in two contexts:
1. **Cards on iOS** receive a barely perceptible ambient shadow (`shadowOpacity: 0.04, shadowRadius: 6`) to compensate for the lack of border rendering differences. Android uses `elevation: 2`.
2. **Modals** use a dark scrim overlay (`rgba(0,0,0,0.5)`) and slide up from the bottom.

### Named Rules
**The Flat Field Rule.** No decorative shadows. If a surface needs to feel elevated, it gets a 1px border in Border Wire (`#E5E7EB`) or a tonal step change, not a drop shadow. Shadows are reserved for platform-specific card rendering and modal scrims.

## 5. Components

### Tab Bars
Both field agent and admin tab bars share the same pattern: a row of pill-shaped segments with Electric Lime for the active state and Field Gray for inactive. Active tabs expand to show a label; inactive tabs show icon only.

- **Shape:** Gently curved (8px radius)
- **Active:** Electric Lime background, Control Dark icon and label, flex: 2
- **Inactive:** Field Gray background, Text Muted icon, flex: 1
- **Feedback:** Haptic impact (light) on press. LayoutAnimation (150ms, easeOut) on tab change.
- **Admin variant:** 4 tabs (Home, Incidents, Users, Settings). No "+" button.
- **Field variant:** 3 tabs (Home, Add, Profile). Center tab is always the "+" action.

### Stat Cards
- **Shape:** Rounded surface (16px radius), 1px Border Wire outline
- **Left accent:** 4px colored border-left (blue, red, green, orange matching status meaning)
- **Internal:** 34px icon container (8px radius, tinted background) + Label + Display-weight number
- **Elevation:** Platform shadow on iOS, elevation 2 on Android

### Status Badges
- **Shape:** Sharp corners (4px radius)
- **Open:** Red-tinted background (`rgba(239,68,68,0.1)`), Signal Red text, uppercase 11px
- **Closed/Resolved:** Green-tinted background, Signal Green text
- **Reclamation:** Orange-tinted background with 1px orange border

### Buttons (Primary)
- **Shape:** Sharp corners (4px radius on auth screens, 12px on admin). The auth screens are more industrial; admin uses slightly softer radii.
- **Primary:** Electric Lime background, Control Dark text, 14px height, full-width.
- **Danger:** Signal Red background, white text. Used only for destructive actions (sign out, delete user).
- **States:** Disabled shows ActivityIndicator in brand color. No hover (mobile-only).

### Inputs
- **Shape:** Rounded (12px radius on auth, 8px on admin modals)
- **Border:** 1px Border Wire, no fill change on focus
- **Internal:** Leading icon (Ionicons, 20px, Text Muted color) + text input
- **Height:** 56px (h-14 in NativeWind)

### Cards / Containers
- **Corner style:** Gently curved (16px radius for main cards, 8px for nested elements)
- **Background:** Surface White
- **Border:** 1px Border Wire. No shadow strategy beyond platform ambient.
- **Internal padding:** 16px standard, 20px for modal content
- **Incident cards:** Include type badge, date, description preview, location footer with divider

### Modals (Bottom Sheet Pattern)
- **Overlay:** Dark scrim (`rgba(0,0,0,0.5)`)
- **Content:** Surface White, top corners rounded (24px), slide-up animation
- **Max height:** 85% of screen
- **Header:** Row with title + close button (32px circle, Field Gray background)
- **Footer:** Fixed action button area with bottom safe-area padding

### Navigation Headers (Admin)
- **Dashboard header:** Full-width Control Dark background with bottom corners rounded (24px). Electric Lime subtitle label + white display title + "Live" badge pill.
- **Other screens:** Standard flat headers or no header (headerShown: false with custom inline headers).

## 6. Do's and Don'ts

### Do:
- **Do** use uppercase + wide tracking (1-2px) for status indicators, zone labels, and type badges. This is the industrial voice.
- **Do** keep Electric Lime below 15% surface area per screen. One active tab + one CTA is the ceiling.
- **Do** use the three-tier depth model (Field Gray → Surface White → Control Dark) for all spatial hierarchy.
- **Do** use 1px Border Wire borders on every card and input. The border is the affordance.
- **Do** localize all user-facing labels to French. The system language is French ("Tableau de bord", "En cours", "Résolus").
- **Do** show haptic feedback (light impact) on every tab press and primary action.
- **Do** reserve signal colors (red, green, orange, blue) strictly for status encoding.

### Don't:
- **Don't** use Electric Lime as text color, on large surfaces, or as a decorative fill. It is a marker, not a theme.
- **Don't** use gradient backgrounds, gradient text, or glassmorphism. This is a governmental field tool.
- **Don't** use border-left greater than 1px as a colored accent stripe on cards. The stat cards currently violate this (4px border-left). This should be replaced with a tinted left edge or icon color.
- **Don't** use bounce, elastic, or spring animations. All motion is 150ms easeOut or LayoutAnimation only.
- **Don't** use decorative shadows. If it's not a platform-specific card rendering or a modal scrim, it doesn't get a shadow.
- **Don't** mix NativeWind className and inline StyleSheet styles on the same screen. Pick one approach per file and commit.
- **Don't** use `#000` or `#fff` raw. Use Control Dark (`#111827`) and Surface White (`#FFFFFF`) everywhere.
- **Don't** introduce display typefaces, serif fonts, or font pairings. Single family (Inter/system), four weights.
- **Don't** use SaaS dashboard clichés: big-number hero metrics with gradient accent, identical card grids, bouncing counters.
- **Don't** use Material Design default roundedness (24px+ buttons, fully rounded chips). Keep edges sharp (4-8px) for the industrial register.
