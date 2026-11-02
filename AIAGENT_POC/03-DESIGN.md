# DESIGN.md — UI/UX Design Document

## Content Management System (CMS) — MVP

| Field             | Value                                       |
| ----------------- | ------------------------------------------- |
| Document Type     | UI/UX Design Specification                  |
| Document Version  | 1.0                                         |
| Status            | Draft                                       |
| Date              | 2026-05-11                                  |
| Classification    | Internal                                    |
| Design System     | Material Design 3 (Material You)            |
| Companion Docs    | 01-Requirements-Specification.md, 02-Software-Requirements-Specification.md |

---

## Table of Contents

1. Introduction
2. Design Principles
3. Material Design 3 Foundations
4. Design Tokens
5. Typography System
6. Color System
7. Elevation, Shape & Spacing
8. Iconography
9. Motion & Transitions
10. Component Library
11. Layout & Navigation Structure
12. Screen Designs
13. Forms & Validation Patterns
14. Empty, Loading & Error States
15. Feedback & Notifications
16. Responsive Behavior
17. Accessibility (a11y)
18. Dark Mode
19. Content Editor — Rich Text UX
20. Media Library — UX Specification
21. Appendices

---

## 1. Introduction

### 1.1 Purpose

This document defines the **visual design, interaction patterns, and user experience** for the CMS MVP Admin Panel, using **Material Design 3 (Material You)** as the design system. It is the authoritative reference for designers and frontend developers building the Admin SPA.

### 1.2 Scope

| In Scope                                          | Out of Scope                              |
| ------------------------------------------------- | ----------------------------------------- |
| All Admin Panel screens                           | Public-facing website design              |
| Material Design 3 token mapping                   | Marketing materials                       |
| Components, layouts, interaction patterns         | Mobile native app design                  |
| Responsive behavior, accessibility, dark mode     | Custom illustrations                      |
| Rich text editor and media library UX             | Email template design                     |

### 1.3 Audience

| Audience              | Focus Sections                  |
| --------------------- | ------------------------------- |
| UI/UX Designers       | All sections                    |
| Frontend Developers   | 3–20                            |
| Product Owners        | 2, 11, 12                       |
| QA Engineers          | 12, 13, 14, 17                  |
| Accessibility Reviewers | 17                            |

### 1.4 References

- Material Design 3 — https://m3.material.io
- Material Web Components — https://github.com/material-components/material-web
- MUI v6 (React) — https://mui.com (MD3-aligned implementation)
- WCAG 2.1 — https://www.w3.org/TR/WCAG21
- Material Symbols — https://fonts.google.com/icons

---

## 2. Design Principles

### 2.1 Material Design 3 Core Principles

1. **Personal** — Dynamic color and theme adapt to user preference (light/dark, optional custom seed).
2. **Adaptive** — Layout responds to viewport breakpoints; respects user accessibility settings.
3. **Expressive** — Use color, type, and motion to communicate hierarchy and state intentionally.

### 2.2 CMS-Specific UX Principles

1. **Speed for repeat users** — Editors and Authors use this daily. Reduce clicks for "save draft", "publish", "search content."
2. **Safety by default** — Destructive actions (delete, unpublish) require confirmation. Autosave prevents lost work.
3. **Status is always visible** — Content status (Draft, In Review, Published) is shown via consistent chips everywhere.
4. **Predictable navigation** — Same nav structure on every screen. Breadcrumbs for context.
5. **Forgiving** — Undo where possible. Version history is one click away from the editor.
6. **Inclusive** — Keyboard-first, screen-reader-compatible, WCAG 2.1 AA.

---

## 3. Material Design 3 Foundations

### 3.1 What "Using MD3" Means Concretely

- **Color**: Use MD3 color roles (`primary`, `on-primary`, `surface`, `surface-container`, etc.) rather than raw hex values in components. Themes are generated from a seed color through MD3's tonal palette algorithm.
- **Typography**: Use the MD3 type scale (`display`, `headline`, `title`, `body`, `label` with `large/medium/small` variants).
- **Shape**: Use MD3 shape scale (`none`, `extra-small`, `small`, `medium`, `large`, `extra-large`, `full`).
- **Elevation**: 6 levels (0–5) expressed as combined shadow + surface tint overlay.
- **Motion**: Use MD3 easing tokens and standard durations.
- **Components**: Prefer MD3 components as-is. Custom components must compose from MD3 primitives and honor tokens.

### 3.2 Recommended Implementation

- **Library**: MUI v6 (Material UI) for React, configured with MD3 theme.
- **Icons**: Material Symbols (variable font), rounded style at weight 400, grade 0, optical size 24.
- **Fonts**: Roboto Flex (variable) as primary; Roboto Mono for code.

---

## 4. Design Tokens

Tokens are the single source of truth. Components reference token names, never raw values.

### 4.1 Token Categories

| Category   | Examples                                          |
| ---------- | ------------------------------------------------- |
| Color      | `md.sys.color.primary`, `md.sys.color.on-surface` |
| Typography | `md.sys.typescale.body-large`                     |
| Elevation  | `md.sys.elevation.level2`                         |
| Shape      | `md.sys.shape.corner.medium`                      |
| Motion     | `md.sys.motion.duration.medium2`, `easing.standard` |
| Spacing    | `md.sys.spacing.4` (= 16 dp)                      |
| State      | `md.sys.state.hover.state-layer-opacity` (= 0.08) |

### 4.2 Spacing Scale (8 dp base)

| Token     | Value | Use                                 |
| --------- | ----- | ----------------------------------- |
| spacing.1 | 4 dp  | Tight inline gaps (chips, icons)    |
| spacing.2 | 8 dp  | Default inline gap                  |
| spacing.3 | 12 dp | Form field internal padding         |
| spacing.4 | 16 dp | Card padding, list item padding     |
| spacing.5 | 20 dp | Section internal gap                |
| spacing.6 | 24 dp | Card-to-card vertical gap           |
| spacing.7 | 32 dp | Page section gap                    |
| spacing.8 | 40 dp | Major layout division               |
| spacing.9 | 48 dp | Page top padding                    |

---

## 5. Typography System

### 5.1 Type Scale (Material Design 3)

| Role            | Token                | Font       | Size  | Line  | Weight | Tracking | Use Case                       |
| --------------- | -------------------- | ---------- | ----- | ----- | ------ | -------- | ------------------------------ |
| Display Large   | display-large        | Roboto Flex | 57 sp | 64 sp | 400    | -0.25    | Hero headers (rare in CMS)     |
| Display Medium  | display-medium       | Roboto Flex | 45 sp | 52 sp | 400    | 0        | Login screen title             |
| Display Small   | display-small        | Roboto Flex | 36 sp | 44 sp | 400    | 0        | Dashboard greeting             |
| Headline Large  | headline-large       | Roboto Flex | 32 sp | 40 sp | 400    | 0        | Page title                     |
| Headline Medium | headline-medium      | Roboto Flex | 28 sp | 36 sp | 400    | 0        | Section title                  |
| Headline Small  | headline-small       | Roboto Flex | 24 sp | 32 sp | 400    | 0        | Card group title               |
| Title Large     | title-large          | Roboto Flex | 22 sp | 28 sp | 500    | 0        | Card title, dialog title       |
| Title Medium    | title-medium         | Roboto Flex | 16 sp | 24 sp | 500    | 0.15     | List item primary, table header|
| Title Small     | title-small          | Roboto Flex | 14 sp | 20 sp | 500    | 0.1      | Tab label, chip label          |
| Body Large      | body-large           | Roboto Flex | 16 sp | 24 sp | 400    | 0.5      | Default body text              |
| Body Medium     | body-medium          | Roboto Flex | 14 sp | 20 sp | 400    | 0.25     | Secondary body                 |
| Body Small      | body-small           | Roboto Flex | 12 sp | 16 sp | 400    | 0.4      | Helper text, captions          |
| Label Large     | label-large          | Roboto Flex | 14 sp | 20 sp | 500    | 0.1      | Button label                   |
| Label Medium    | label-medium         | Roboto Flex | 12 sp | 16 sp | 500    | 0.5      | Small button, badge            |
| Label Small     | label-small          | Roboto Flex | 11 sp | 16 sp | 500    | 0.5      | Tiny label, metadata           |

### 5.2 Typography Usage Map

| UI Element                  | Token            |
| --------------------------- | ---------------- |
| Login screen title          | display-medium   |
| Dashboard greeting          | display-small    |
| Page title (e.g., "Articles") | headline-large |
| Section title               | headline-medium  |
| Card title                  | title-large      |
| Form field label            | body-small (16sp when floated up: body-medium) |
| Table column header         | title-small      |
| Table cell text             | body-medium      |
| Status chip label           | label-medium     |
| Button label                | label-large      |
| Helper / error text         | body-small       |
| Snackbar message            | body-medium      |
| Tooltip                     | body-small       |

### 5.3 Reading Hierarchy in Long Forms

The Content Editor uses a strict hierarchy:

- **Page title** (the article title input): styled as `headline-large` even in input mode (give it room).
- **Section labels** (SEO Settings, Media): `title-medium`.
- **Field labels**: standard MD3 floating label.
- **Body editor content**: `body-large` for editable area, `body-medium` for preview when shrunk.

---

## 6. Color System

### 6.1 MD3 Color Roles (Light Theme — generated from seed)

> Seed color recommendation: **`#6750A4`** (Material Default Purple) — neutral, professional, distinguishable. Replace with brand color if available.

| Role                         | Hex (Light) | Use                                            |
| ---------------------------- | ----------- | ---------------------------------------------- |
| primary                      | `#6750A4`   | Primary buttons, active nav, key actions       |
| on-primary                   | `#FFFFFF`   | Text/icons on primary                          |
| primary-container            | `#EADDFF`   | Filled chip background, FAB background variant |
| on-primary-container         | `#21005D`   | Text on primary-container                      |
| secondary                    | `#625B71`   | Secondary actions, supporting accents          |
| on-secondary                 | `#FFFFFF`   |                                                |
| secondary-container          | `#E8DEF8`   | Selected list item background                  |
| on-secondary-container       | `#1D192B`   |                                                |
| tertiary                     | `#7D5260`   | Accents, highlight states                      |
| on-tertiary                  | `#FFFFFF`   |                                                |
| tertiary-container           | `#FFD8E4`   | Notification badges                            |
| on-tertiary-container        | `#31111D`   |                                                |
| error                        | `#B3261E`   | Error text, destructive buttons                |
| on-error                     | `#FFFFFF`   |                                                |
| error-container              | `#F9DEDC`   | Error banner background                        |
| on-error-container           | `#410E0B`   |                                                |
| surface                      | `#FEF7FF`   | Default page background                        |
| on-surface                   | `#1D1B20`   | Primary text on surface                        |
| on-surface-variant           | `#49454F`   | Secondary text on surface                      |
| surface-container-lowest     | `#FFFFFF`   | Floating cards (highest elevation)             |
| surface-container-low        | `#F7F2FA`   | Subtle card backgrounds                        |
| surface-container            | `#F3EDF7`   | Default container background                   |
| surface-container-high       | `#ECE6F0`   | Selected/hovered surface                       |
| surface-container-highest    | `#E6E0E9`   | Top app bar (scrolled state)                   |
| outline                      | `#79747E`   | Borders, dividers, outlined buttons            |
| outline-variant              | `#CAC4D0`   | Subtle dividers, disabled outlines             |
| inverse-surface              | `#322F35`   | Snackbar background                            |
| inverse-on-surface           | `#F5EFF7`   | Snackbar text                                  |

### 6.2 Semantic Status Colors

Status chips for content lifecycle have fixed semantic colors that map to MD3 roles:

| Status      | Chip Background          | Chip Text Color           | Conceptual Color |
| ----------- | ------------------------ | ------------------------- | ---------------- |
| Draft       | surface-container-high   | on-surface-variant        | Neutral gray     |
| In Review   | tertiary-container       | on-tertiary-container     | Amber/pink       |
| Scheduled   | secondary-container      | on-secondary-container    | Lavender         |
| Published   | `#C8E6C9` (success-container) | `#1B5E20` (on-success) | Green            |
| Unpublished | outline-variant          | on-surface-variant        | Muted gray       |
| Archived    | surface-container        | on-surface-variant (italic) | Faded          |

> **Note**: MD3 doesn't include a "success" role by default. We extend the palette with `success` / `success-container` tokens generated from `#2E7D32` using the same tonal palette algorithm.

### 6.3 State Layers

Material Design 3 uses **state layers** — translucent overlays on top of the base color — to communicate interaction state:

| State      | Opacity |
| ---------- | ------- |
| Hover      | 0.08    |
| Focus      | 0.12    |
| Pressed    | 0.12    |
| Dragged    | 0.16    |
| Disabled (background) | 0.12 |
| Disabled (content)    | 0.38 |

State layer color = `on-` color of the underlying surface. For example, a button with `surface` background uses an `on-surface` state layer.

### 6.4 Color Contrast Requirements

All text/background pairs MUST meet WCAG 2.1 AA:

- Body text (< 18 sp): contrast ratio ≥ 4.5:1
- Large text (≥ 18 sp or ≥ 14 sp bold): contrast ratio ≥ 3:1
- Non-text UI (icons, borders): contrast ratio ≥ 3:1

The MD3-generated palette already satisfies these for default role pairings. Custom combinations must be verified.

---

## 7. Elevation, Shape & Spacing

### 7.1 Elevation Levels (MD3)

Elevation is expressed as shadow + surface tint overlay. Higher elevation = more prominent surface tint.

| Level | Shadow                                          | Tint Opacity | Use                                |
| ----- | ----------------------------------------------- | ------------ | ---------------------------------- |
| 0     | none                                            | 0%           | Flat surface (e.g., page background) |
| 1     | `0 1px 2px rgba(0,0,0,0.30), 0 1px 3px 1px rgba(0,0,0,0.15)` | 5%  | Resting card, app bar (default)    |
| 2     | `0 1px 2px rgba(0,0,0,0.30), 0 2px 6px 2px rgba(0,0,0,0.15)` | 8%  | Hovered card, FAB resting          |
| 3     | `0 1px 3px rgba(0,0,0,0.30), 0 4px 8px 3px rgba(0,0,0,0.15)` | 11% | Modal bottom sheet, navigation drawer |
| 4     | `0 2px 3px rgba(0,0,0,0.30), 0 6px 10px 4px rgba(0,0,0,0.15)` | 12% | Dialog                             |
| 5     | `0 4px 4px rgba(0,0,0,0.30), 0 8px 12px 6px rgba(0,0,0,0.15)`| 14% | Modal, dragged FAB                 |

### 7.2 Shape Scale

| Token             | Radius | Use                                       |
| ----------------- | ------ | ----------------------------------------- |
| corner.none       | 0      | Edge-to-edge surfaces                     |
| corner.extra-small | 4 dp  | Tooltip, snackbar                         |
| corner.small      | 8 dp   | Chip, small button                        |
| corner.medium     | 12 dp  | Card, dialog, text field (filled variant) |
| corner.large      | 16 dp  | FAB (extended), navigation drawer corners |
| corner.extra-large| 28 dp  | Dialog (alternative), bottom sheet        |
| corner.full       | 9999 px| Pill button, chip, FAB                    |

### 7.3 Component-to-Shape Mapping

| Component             | Shape Token        |
| --------------------- | ------------------ |
| Filled Button         | corner.full        |
| Outlined Button       | corner.full        |
| Text Button           | corner.full        |
| Filled Tonal Button   | corner.full        |
| FAB                   | corner.large       |
| Card                  | corner.medium      |
| Dialog                | corner.extra-large |
| Snackbar              | corner.extra-small |
| Text Field (filled)   | corner.extra-small (top only, bottom 0) |
| Text Field (outlined) | corner.extra-small |
| Chip                  | corner.small       |
| Status Badge          | corner.full        |
| Menu / Dropdown       | corner.extra-small |

---

## 8. Iconography

### 8.1 Icon System

- **Library**: Material Symbols (Rounded variant).
- **Default size**: 24 dp.
- **Sizes used**: 16 dp (inline with body text), 20 dp (chip leading icon), 24 dp (default), 40 dp (avatar/empty state), 48 dp (large empty state).
- **Color**: Inherits from `on-surface` / `on-surface-variant` / `primary` based on context. Always token-driven, never raw hex.
- **Style settings**: Weight 400, Grade 0, Optical Size 24.

### 8.2 Icon Inventory

| Action / Concept     | Icon                  |
| -------------------- | --------------------- |
| Dashboard            | `dashboard`           |
| Content / Articles   | `article`             |
| Pages                | `description`         |
| Media Library        | `perm_media`          |
| Users                | `group`               |
| Audit Log            | `history`             |
| API Keys             | `vpn_key`             |
| Settings             | `settings`            |
| Logout               | `logout`              |
| Search               | `search`              |
| Filter               | `filter_list`         |
| Sort                 | `swap_vert`           |
| Add                  | `add`                 |
| Edit                 | `edit`                |
| Delete               | `delete`              |
| Save                 | `save`                |
| Publish              | `publish`             |
| Unpublish            | `unpublished`         |
| Schedule             | `schedule`            |
| Preview              | `visibility`          |
| Submit for review    | `send`                |
| Approve              | `check_circle`        |
| Reject               | `cancel`              |
| More options         | `more_vert`           |
| Notification         | `notifications`       |
| Profile              | `account_circle`      |
| Help                 | `help_outline`        |
| Upload               | `upload`              |
| Download             | `download`            |
| Image                | `image`               |
| Video                | `videocam`            |
| Document             | `description`         |
| Link                 | `link`                |
| Copy                 | `content_copy`        |
| Expand               | `expand_more`         |
| Collapse             | `expand_less`         |
| Back                 | `arrow_back`          |
| Close                | `close`               |
| Check (success)      | `check`               |
| Warning              | `warning`             |
| Error                | `error`               |
| Info                 | `info`                |

---

## 9. Motion & Transitions

### 9.1 Duration Tokens

| Token            | Value  | Use                                          |
| ---------------- | ------ | -------------------------------------------- |
| duration.short1  | 50 ms  | Tooltip appear                               |
| duration.short2  | 100 ms | Selection state, chip toggle                 |
| duration.short3  | 150 ms | Switch toggle                                |
| duration.short4  | 200 ms | Standard small-element transition            |
| duration.medium1 | 250 ms | Card expand                                  |
| duration.medium2 | 300 ms | Dialog enter/exit                            |
| duration.medium3 | 350 ms | Navigation drawer slide                      |
| duration.medium4 | 400 ms | Large dialog                                 |
| duration.long1   | 450 ms | Complex screen transition                    |
| duration.long2   | 500 ms | Bottom sheet expand                          |
| duration.long3   | 550 ms | (rare)                                       |
| duration.long4   | 600 ms | (rare)                                       |

### 9.2 Easing Tokens

| Token                     | Curve                              | Use                                  |
| ------------------------- | ---------------------------------- | ------------------------------------ |
| easing.linear             | `linear`                           | Loops, progress indicators           |
| easing.standard           | `cubic-bezier(0.2, 0, 0, 1.0)`     | Default for most transitions         |
| easing.standard-accelerate| `cubic-bezier(0.3, 0, 1, 1)`       | Element exits                        |
| easing.standard-decelerate| `cubic-bezier(0, 0, 0, 1)`         | Element enters                       |
| easing.emphasized         | `cubic-bezier(0.2, 0, 0, 1.0)`     | High-attention transitions           |
| easing.emphasized-accelerate | `cubic-bezier(0.3, 0, 0.8, 0.15)` | Exits requiring emphasis           |
| easing.emphasized-decelerate | `cubic-bezier(0.05, 0.7, 0.1, 1)` | Enters requiring emphasis           |

### 9.3 Standard Motion Patterns

| Pattern                          | Duration | Easing                    |
| -------------------------------- | -------- | ------------------------- |
| Page route change                | 300 ms   | emphasized                |
| Dialog open                      | 300 ms   | emphasized-decelerate     |
| Dialog close                     | 200 ms   | emphasized-accelerate     |
| Snackbar appear                  | 250 ms   | standard-decelerate       |
| Snackbar dismiss                 | 150 ms   | standard-accelerate       |
| Menu open                        | 200 ms   | standard-decelerate       |
| Tooltip appear                   | 150 ms   | standard                  |
| Button state layer fade          | 100 ms   | standard                  |
| Floating label up/down           | 150 ms   | standard                  |
| Chip select                      | 100 ms   | standard                  |
| Skeleton shimmer                 | 1500 ms (loop) | linear              |

### 9.4 Reduced Motion

When `prefers-reduced-motion: reduce` is detected:
- All transitions ≤ 50 ms or replaced with opacity-only crossfade.
- Skeleton shimmer disabled; static skeleton shown.
- No parallax, no auto-playing animations.

---

## 10. Component Library

This is the full component inventory the Admin SPA will use. All components follow Material Design 3 specifications.

### 10.1 Buttons

| Variant         | When to Use                                              | Example                |
| --------------- | -------------------------------------------------------- | ---------------------- |
| Filled          | Primary action on a screen (one per view)                | "Publish", "Save"      |
| Filled tonal    | Important but not primary; pairs with Filled             | "Save Draft" next to "Publish" |
| Outlined        | Secondary actions; alternatives to Filled                | "Cancel", "Discard"    |
| Text            | Tertiary, low-emphasis actions; in dialogs               | "Learn more"           |
| Elevated        | Used over busy/colored backgrounds (rare in CMS)         | Action over hero image |
| Icon button     | Compact actions in tables, app bars                      | "Edit", "More"         |
| FAB             | Single most important screen action; floats              | "+ New Article"        |
| Extended FAB    | FAB with text label                                      | "+ New Article" (wide) |

**Anatomy & specs (Filled Button):**

- Height: 40 dp
- Horizontal padding: 24 dp (16 dp if with leading icon)
- Corner: `corner.full`
- Label: `label-large`
- Icon size: 18 dp, gap 8 dp to label
- States: enabled, hovered (state layer 0.08), focused (state layer 0.12), pressed (state layer 0.12), disabled (38% content opacity, 12% background opacity)

### 10.2 Top App Bar

- **Variant used**: **Center-aligned** or **Small** depending on screen.
- Height: 64 dp (small).
- Background: `surface` resting, `surface-container` on scroll (with subtle elevation 2 tint).
- Title: `title-large`, left-aligned for Small variant.
- Leading: optional navigation icon (menu toggle on narrow viewports).
- Trailing: search icon, notification icon, profile avatar (max 3 trailing icons).

### 10.3 Navigation Rail

The admin panel uses a **persistent Navigation Rail** on the left (desktop) or a **Navigation Drawer** (modal) on narrow viewports.

**Navigation Rail (desktop ≥ 1240 px):**

- Width: 80 dp (icon + label below).
- Background: `surface`.
- Items: icon (24 dp) + label (`label-medium`) stacked, 56 dp tall each.
- Active item: filled pill background `secondary-container`, icon and label `on-secondary-container`.
- Inactive item: icon `on-surface-variant`, label `on-surface-variant`.
- State layer on hover/focus per MD3.
- Order of items: Dashboard → Content → Media → Users → Audit Log → API Keys → Settings.

**Navigation Drawer (modal, mobile/tablet < 1240 px):**

- Width: 360 dp.
- Slides in from left, scrim behind.
- Same item structure but horizontal layout (icon + label side-by-side, 56 dp tall).

### 10.4 Cards

| Variant   | Background                | Border         | Elevation |
| --------- | ------------------------- | -------------- | --------- |
| Elevated  | `surface-container-low`   | none           | 1 (resting), 2 (hover) |
| Filled    | `surface-container-highest` | none         | 0         |
| Outlined  | `surface`                 | 1 dp `outline-variant` | 0 |

- Corner: `corner.medium` (12 dp).
- Padding: 16 dp by default; 24 dp for "feature" cards on dashboard.
- Header: optional `title-large`, optional supporting `body-medium`.

### 10.5 Text Fields

- **Variants**: Filled (default for forms) and Outlined (used inside cards / dialogs to reduce visual weight).
- Height: 56 dp (single line), grows for multiline.
- Corner: `corner.extra-small`.
- Label: floats up to `body-small` size when focused or filled.
- Supporting text: `body-small`, `on-surface-variant`.
- Error state: outline / underline becomes `error`, supporting text becomes `error`, trailing icon = `error`.
- Leading icon: optional, 24 dp, `on-surface-variant`.
- Trailing icon: optional (e.g., clear, password toggle).

### 10.6 Chips

| Variant     | Use                                            |
| ----------- | ---------------------------------------------- |
| Assist      | Suggested actions (rare in CMS)                |
| Filter      | Filter content list by status, type, tag       |
| Input       | Tags input on Article editor                   |
| Suggestion  | Slug suggestions, AI-generated drafts (future) |

- Height: 32 dp.
- Corner: `corner.small`.
- Leading icon: 18 dp, optional.
- Label: `label-large`.
- Selected filter chip: `secondary-container` background, `on-secondary-container` text/icon.

### 10.7 Data Table

Custom MD3-styled table for Content List, Users, Audit Log.

- Header row: `surface-container`, text `title-small`.
- Body rows: `surface`, text `body-medium`.
- Row height: 52 dp.
- Row hover: state layer 0.08 over `on-surface`.
- Row selected: `secondary-container` background.
- Row divider: 1 dp `outline-variant`.
- Sticky header on vertical scroll.
- Column sort indicator: arrow icon next to header label (`primary` color when active).
- Bulk select: leading checkbox column when bulk actions enabled.

### 10.8 Dialogs

| Variant | Use                                          |
| ------- | -------------------------------------------- |
| Basic   | Confirmations, simple info                   |
| Full-screen | Complex flows (rare in CMS)              |

**Basic dialog specs:**

- Min width: 280 dp; max width: 560 dp.
- Background: `surface-container-high`.
- Elevation: 4.
- Corner: `corner.extra-large` (28 dp).
- Padding: 24 dp.
- Title: `headline-small`.
- Body: `body-medium`.
- Actions: right-aligned, Text buttons; dismiss action on the left.

### 10.9 Snackbars

- Background: `inverse-surface`.
- Text: `inverse-on-surface`, `body-medium`.
- Action label: `inverse-primary`, `label-large`.
- Corner: `corner.extra-small`.
- Min height: 48 dp; max 2 lines of text.
- Position: bottom-left on desktop, bottom-center on mobile.
- Default duration: 4 s; with action: 6 s; can be made indefinite for ongoing operations.

### 10.10 Menus

- Background: `surface-container`.
- Elevation: 2.
- Corner: `corner.extra-small`.
- Item height: 48 dp.
- Item text: `body-large`.
- Optional leading icon (24 dp), trailing meta (e.g., keyboard shortcut, `label-small`).

### 10.11 Switches, Checkboxes, Radio Buttons

Use MD3 default styling. No custom overrides.

### 10.12 Progress Indicators

- **Linear**: at the top of the page during route transitions; full width, 4 dp tall, `primary` color.
- **Circular**: 24 dp inline (button loading state), 48 dp center-of-page (initial load).
- Indeterminate variant during unknown-duration operations; determinate when progress is known (uploads).

---

## 11. Layout & Navigation Structure

### 11.1 Global Layout (Desktop)

```
┌────────────────────────────────────────────────────────────────────────┐
│  Top App Bar  [≡] [Page Title]                  [🔍] [🔔] [👤 Avatar]  │  64 dp
├────┬───────────────────────────────────────────────────────────────────┤
│ N  │                                                                    │
│ a  │                                                                    │
│ v  │                                                                    │
│    │              Main Content Area                                     │
│ R  │              (max-width 1440 dp, centered)                         │
│ a  │              padding: 24 dp                                        │
│ i  │                                                                    │
│ l  │                                                                    │
│    │                                                                    │
│ 80 │                                                                    │
│ dp │                                                                    │
└────┴───────────────────────────────────────────────────────────────────┘
```

### 11.2 Navigation Hierarchy

```
Dashboard
Content
├── Articles
│   ├── List (default)
│   ├── Editor (/content/articles/new, /content/articles/:id)
│   └── Version History (/content/articles/:id/versions)
└── Pages
    ├── List
    ├── Editor
    └── Version History
Media Library
Users  ┃ Admin only
Audit Log  ┃ Admin only
API Keys  ┃ Admin only
Settings
└── Profile
```

### 11.3 Breadcrumbs

Shown directly below the top app bar on screens deeper than 1 level:

```
Content / Articles / Editing "My First Post"
```

- Style: `body-medium`, `on-surface-variant`, current item `on-surface`.
- Separator: `/` with `on-surface-variant` color.
- Each link reachable; current item not a link.

### 11.4 Viewport Breakpoints (MD3)

| Breakpoint | Width Range  | Layout                                  |
| ---------- | ------------ | --------------------------------------- |
| Compact    | 0–599 dp     | Drawer (modal), single-column           |
| Medium     | 600–839 dp   | Drawer (modal), single-column           |
| Expanded   | 840–1239 dp  | Navigation Rail, single content column  |
| Large      | 1240–1599 dp | Navigation Rail, two-pane where useful  |
| Extra large| 1600+ dp     | Navigation Rail, two-pane, max-width caps |

The admin panel is **optimized for Expanded and Large** breakpoints. Mobile (Compact) is functional but not the primary target per requirements.

---

## 12. Screen Designs

### 12.1 Login Screen

**Layout**: Centered card on `surface` background, no nav rail, no app bar.

```
                  ┌──────────────────────────────┐
                  │                              │
                  │       [CMS Logo 64 dp]       │
                  │                              │
                  │       Sign in to CMS          │  ← display-medium
                  │       Welcome back            │  ← body-medium, on-surface-variant
                  │                              │
                  │   ┌────────────────────────┐ │
                  │   │ Email                  │ │  ← Filled TextField
                  │   └────────────────────────┘ │
                  │                              │
                  │   ┌────────────────────────┐ │
                  │   │ Password         [👁]  │ │  ← Filled TextField
                  │   └────────────────────────┘ │
                  │                              │
                  │   [Forgot password?]          │  ← Text Button, left
                  │                              │
                  │   ┌────────────────────────┐ │
                  │   │       Sign in           │ │  ← Filled Button, full width
                  │   └────────────────────────┘ │
                  │                              │
                  └──────────────────────────────┘
                          Card 400 dp wide
```

**Spec**:
- Card: Elevated, corner.medium, padding 32 dp, 400 dp wide.
- Logo: 64 dp, top-centered, 24 dp gap below.
- Error state: error banner above form ("Email or password is incorrect.").
- After 5 failed attempts: lockout message (generic, no count revealed).

### 12.2 Dashboard

**Layout**: 12-column grid, 24 dp gutter.

```
┌─────────────────────────────────────────────────────────────────────┐
│ Good afternoon, [Name]                                              │  ← display-small
│ Here's what's happening in your workspace                            │  ← body-medium
│                                                                      │
│ ┌────────────┐ ┌────────────┐ ┌────────────┐ ┌────────────┐         │
│ │ Total      │ │ Published  │ │ In Review  │ │ Drafts     │         │
│ │   137      │ │    98      │ │    12      │ │    27      │         │
│ │ articles   │ │            │ │            │ │            │         │
│ │ [article]  │ │ [check]    │ │ [hourglass]│ │ [edit]     │         │
│ └────────────┘ └────────────┘ └────────────┘ └────────────┘         │
│  Stat Card     Stat Card      Stat Card      Stat Card               │
│                                                                      │
│ ┌──────────────────────────────────┐ ┌────────────────────────────┐ │
│ │ Recent activity                   │ │ Quick actions               │ │
│ │ ─────────────────────────────────│ │ ─────────────────────────── │ │
│ │ • Alice published "Q2 Report"     │ │  [+ New Article]            │ │
│ │   2 min ago                       │ │  [+ New Page]               │ │
│ │ • Bob submitted "Roadmap" for     │ │  [Upload Media]             │ │
│ │   review · 15 min ago             │ │                             │ │
│ │ • Carol updated "Pricing Page"    │ │                             │ │
│ │   1 hr ago                        │ │                             │ │
│ │   ...                             │ │                             │ │
│ │  [View audit log →]               │ │                             │ │
│ └──────────────────────────────────┘ └────────────────────────────┘ │
└─────────────────────────────────────────────────────────────────────┘
```

**Spec**:
- 4 stat cards in a row (Expanded breakpoint), wrap to 2x2 (Medium), stack (Compact).
- Stat number: `display-small`, primary color.
- Stat label: `body-medium`, on-surface-variant.
- Recent activity: list of last 10 audit events; each item 56 dp with icon, primary line, secondary timestamp.

### 12.3 Content List (Articles)

```
┌─────────────────────────────────────────────────────────────────────┐
│ Articles                                                  [+ New]   │  ← Headline + Extended FAB
├─────────────────────────────────────────────────────────────────────┤
│ ┌───────────────────────┐  Filter chips:                            │
│ │ 🔍 Search by title... │  [All] [Draft] [In Review] [Published]   │
│ └───────────────────────┘  [Mine] [Last 30 days]    [⚙ More]      │
├─────────────────────────────────────────────────────────────────────┤
│ ┌───────────────────────────────────────────────────────────────┐  │
│ │ Title ▼          │ Status     │ Author    │ Updated     │ ⋮  │  │
│ ├───────────────────────────────────────────────────────────────┤  │
│ │ Q2 Financial...  │ [Published]│ Alice     │ 2 min ago   │ ⋮  │  │
│ │ Product Roadmap  │ [In Review]│ Bob       │ 15 min ago  │ ⋮  │  │
│ │ Pricing Update   │ [Draft]    │ Carol     │ 1 hr ago    │ ⋮  │  │
│ │ ...                                                            │  │
│ ├───────────────────────────────────────────────────────────────┤  │
│ │  Page 1 of 6                       [< Prev]  [Next >]         │  │
│ └───────────────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────────────┘
```

**Spec**:
- Page title: `headline-large`.
- Search field: outlined, leading `search` icon, debounce 300 ms.
- Filter chips: Filter variant, selectable. Active chips show check icon.
- Table: sortable columns Title, Status, Author, Updated. Row click → Editor.
- Row action menu (⋮): View, Edit, Duplicate, Submit for review / Publish / Unpublish (status-dependent), Delete.
- Pagination: text indicator + Prev/Next buttons; page-size selector hidden behind ⚙ More.

### 12.4 Content Editor (Article)

**Layout**: Two-pane on Large breakpoint; single-column on Expanded.

```
┌─────────────────────────────────────────────────────────────────────┐
│ ← Articles / Editing "Q2 Financial Report"                          │  ← Breadcrumb
├─────────────────────────────────────────────────────────────────────┤
│ ┌─────────────────────────────────────┐ ┌──────────────────────┐    │
│ │ [Q2 Financial Report             ]  │ │ Publish              │    │
│ │  Title (headline-large input)        │ │ ──────────────────── │    │
│ │                                      │ │ Status: [Draft]      │    │
│ │ [q2-financial-report             ]  │ │                       │    │
│ │  Slug (filled text field)            │ │ [Save Draft]         │    │
│ │                                      │ │ [Submit for Review]  │    │
│ │ ┌──────────────────────────────────┐ │ │ [Publish] (disabled  │    │
│ │ │ Rich Text Toolbar                │ │ │  if Author role)     │    │
│ │ │ B  I  U  H2 H3 • 1. " <> 🔗 🖼  │ │ │                       │    │
│ │ │──────────────────────────────────│ │ │ [Schedule...]        │    │
│ │ │                                  │ │ │                       │    │
│ │ │   Body editor area               │ │ │ ──────────────────── │    │
│ │ │   (body-large)                   │ │ │ SEO                   │    │
│ │ │                                  │ │ │ ──────────────────── │    │
│ │ │                                  │ │ │ Meta Title           │    │
│ │ │                                  │ │ │ [_________________]  │    │
│ │ │                                  │ │ │  62/70                │    │
│ │ │                                  │ │ │ Meta Description     │    │
│ │ │                                  │ │ │ [_________________]  │    │
│ │ │                                  │ │ │  142/160              │    │
│ │ │                                  │ │ │                       │    │
│ │ │                                  │ │ │ Social Image          │    │
│ │ │                                  │ │ │ [📷 Select image]    │    │
│ │ │                                  │ │ │                       │    │
│ │ │                                  │ │ │ ──────────────────── │    │
│ │ │                                  │ │ │ Featured Image       │    │
│ │ │                                  │ │ │ [📷 Select image]    │    │
│ │ │                                  │ │ │                       │    │
│ │ │                                  │ │ │ Tags                  │    │
│ │ │                                  │ │ │ [finance×] [q2×]     │    │
│ │ │                                  │ │ │ [+ Add tag]           │    │
│ │ │                                  │ │ │                       │    │
│ │ │                                  │ │ │ Category              │    │
│ │ │                                  │ │ │ [Reports         ▼]  │    │
│ │ └──────────────────────────────────┘ │ └──────────────────────┘    │
│ └─────────────────────────────────────┘                              │
│  Main editor (8 cols)                    Side panel (4 cols)         │
└─────────────────────────────────────────────────────────────────────┘
```

**Spec**:
- Title input: borderless, `headline-large` style.
- Slug: auto-generated from title; editable; live validation for uniqueness.
- Rich text toolbar: sticky at top of editor pane when scrolled.
- Side panel: sticky on scroll.
- Autosave: every 30 s while typing; "Saved 3 sec ago" indicator below title.
- Unsaved changes prompt on navigation.
- "Schedule..." opens dialog with date+time picker.

### 12.5 Media Library

```
┌─────────────────────────────────────────────────────────────────────┐
│ Media Library                                            [↑ Upload] │
├─────────────────────────────────────────────────────────────────────┤
│ [🔍 Search by filename or alt text]   [All types ▼] [⊞ Grid] [☰ List]│
├─────────────────────────────────────────────────────────────────────┤
│ ┌─────┐ ┌─────┐ ┌─────┐ ┌─────┐ ┌─────┐ ┌─────┐ ┌─────┐ ┌─────┐    │
│ │ img │ │ img │ │ pdf │ │ img │ │ img │ │ img │ │ img │ │ img │    │
│ │     │ │     │ │     │ │     │ │     │ │     │ │     │ │     │    │
│ ├─────┤ ├─────┤ ├─────┤ ├─────┤ ├─────┤ ├─────┤ ├─────┤ ├─────┤    │
│ │hero │ │team │ │FAQ  │ │logo │ │bg.png│ │img4 │ │img5 │ │img6 │    │
│ │.jpg │ │.png │ │.pdf │ │.svg │ │      │ │.jpg │ │.jpg │ │.jpg │    │
│ └─────┘ └─────┘ └─────┘ └─────┘ └─────┘ └─────┘ └─────┘ └─────┘    │
│                                                                      │
│ ... (paginated grid)                                                │
└─────────────────────────────────────────────────────────────────────┘
```

**Spec**:
- Grid tile: 160 dp square (image preview), card variant Outlined, corner.medium.
- Filename below image, `label-medium`, truncated with tooltip.
- Hover: state layer + overlay actions (preview, copy URL, delete).
- Click tile: opens side drawer with full details (alt text, caption, size, uploader, "Used in N pieces of content").
- Upload: drag-and-drop zone reveals on drag-enter; click [↑ Upload] opens file picker.
- Multi-select: checkbox on tile hover; bulk delete with confirmation.

### 12.6 Users (Admin only)

Standard data table layout, similar to Content List.

Columns: Avatar + Name, Email, Role, Status, Last login, ⋮ menu (Edit role, Deactivate, Reset password, Resend invite).

[+ Invite user] FAB top-right opens dialog with email + role select.

### 12.7 Audit Log (Admin only)

Read-only data table, sortable by timestamp (default desc), filterable by Actor, Action, Target type, Date range.

Columns: Timestamp (local TZ), Actor (name + email tooltip), Action (chip), Target, Summary (truncated, expandable).

Export CSV button top-right.

### 12.8 API Keys (Admin only)

```
┌─────────────────────────────────────────────────────────────────────┐
│ API Keys                                              [+ New Key]   │
├─────────────────────────────────────────────────────────────────────┤
│ ┌─────────────────────────────────────────────────────────────┐    │
│ │ Name              │ Prefix       │ Last used    │ Status │ ⋮ │    │
│ ├─────────────────────────────────────────────────────────────┤    │
│ │ Production Web    │ cmsk_a1b2c3..│ 5 min ago    │ Active │ ⋮ │    │
│ │ Mobile App        │ cmsk_d4e5f6..│ 2 days ago   │ Active │ ⋮ │    │
│ │ Legacy v0         │ cmsk_x7y8z9..│ 3 months ago │ Revoked│ ⋮ │    │
│ └─────────────────────────────────────────────────────────────┘    │
└─────────────────────────────────────────────────────────────────────┘
```

On creation: full key displayed **once** in a dialog with a copy-to-clipboard button and a strong warning ("You will not be able to view this key again. Store it securely.").

### 12.9 Profile / Settings

Simple form: change own password, view own account info, theme selector (Light / Dark / System), language (future placeholder).

---

## 13. Forms & Validation Patterns

### 13.1 Validation Strategy

- **Client-side**: instant feedback via Zod schema; show errors after first blur or on submit.
- **Server-side**: authoritative; always re-validate. Return field-keyed error map.
- **On submit failure**: scroll to first error, focus it, show error summary banner at top of form.

### 13.2 Validation State Display

| State          | TextField Appearance                                  |
| -------------- | ----------------------------------------------------- |
| Default        | outline `outline`, label `on-surface-variant`         |
| Focused        | outline `primary` (2 dp), label `primary`             |
| Filled, valid  | outline `outline-variant`, label floats up            |
| Error          | outline `error`, label `error`, helper text `error`, trailing icon `error` |
| Disabled       | outline `outline-variant` with 38% opacity, label same |

### 13.3 Helper Text Patterns

- Static helper text (e.g., "URL-friendly identifier, lowercase letters and hyphens only").
- Live character count (e.g., "62/70") for length-limited fields. Turns `error` color when over.
- Async validation (e.g., slug uniqueness): trailing spinner appears for 300+ ms checks; check or error icon on resolution.

### 13.4 Form Layout Rules

- One column on Compact/Medium; two columns acceptable on Expanded+ for short fields (e.g., date + time).
- Group related fields under section headers (`title-medium`).
- Vertical gap between fields: 16 dp (spacing.4).
- Vertical gap between sections: 32 dp (spacing.7).
- Form actions sticky at the bottom of the form on long forms.

### 13.5 Destructive Action Confirmation

Pattern: open Basic Dialog with:

- Title: clear about what's being deleted, e.g., "Delete this article?"
- Body: consequences, e.g., "This will move 'Q2 Financial Report' to the trash. It will be permanently deleted after 30 days."
- Actions: "Cancel" (Text button, left), "Delete" (Filled button, `error` color, right).

For irreversible actions (delete media that's referenced, revoke API key), require typing the resource name to enable the destructive button.

---

## 14. Empty, Loading & Error States

### 14.1 Empty States

Template:

```
              ┌──────────────────────────────┐
              │                              │
              │       [Illustration]         │  ← 120 dp icon or illustration
              │                              │
              │     No articles yet          │  ← title-large
              │                              │
              │     Create your first        │  ← body-medium, on-surface-variant
              │     article to get started   │
              │                              │
              │     [+ New Article]          │  ← Filled Button
              │                              │
              └──────────────────────────────┘
```

For filtered empty states ("No articles match these filters"): primary action is "Clear filters", secondary "Create article".

### 14.2 Loading States

| Context                      | Pattern                                          |
| ---------------------------- | ------------------------------------------------ |
| Initial page load            | Skeleton screens matching layout (cards, table rows) |
| Route transition             | Linear progress bar at top                       |
| Async action (button click)  | Button shows inline circular progress (24 dp), label hidden, button remains same width |
| Long async (>2 s)            | Snackbar "Still working..."                      |
| Background autosave          | Subtle "Saving..." text below title, no blocking |

Skeleton elements: rounded rectangles `surface-container-high`, shimmer animation 1500 ms loop linear.

### 14.3 Error States

| Type             | Pattern                                                              |
| ---------------- | -------------------------------------------------------------------- |
| Field validation | Inline under field (see 13.2)                                        |
| Form submission  | Error banner at top of form (`error-container` background, error icon, message) |
| Page-level fetch | Centered card: error icon (48 dp `error`), `headline-small` title, `body-medium` description, [Retry] button |
| Network offline  | Snackbar "You're offline. Changes will not be saved." persistent until reconnect |
| 404              | Friendly screen with "Page not found" + link back to Dashboard       |
| 500              | "Something went wrong" + request ID for support + [Reload] button    |
| Permission (403) | "You don't have permission to view this." + link back               |

---

## 15. Feedback & Notifications

### 15.1 Snackbar Use Cases

| Scenario               | Message                                  | Action       | Duration |
| ---------------------- | ---------------------------------------- | ------------ | -------- |
| Saved draft            | "Draft saved"                            | none         | 4 s      |
| Published              | "Article published"                      | "View"       | 6 s      |
| Unpublished            | "Article unpublished"                    | "Undo" (60s window) | 6 s |
| Deleted                | "Article moved to trash"                 | "Undo" (10s window) | 6 s |
| Copied API key         | "Copied to clipboard"                    | none         | 2 s      |
| Bulk action complete   | "5 articles published"                   | none         | 4 s      |
| Network error          | "Couldn't save. Check your connection."  | "Retry"      | persistent |

### 15.2 Inline Status Indicators

Above the main content area, when relevant:

- "Saving..." → "Saved 5 seconds ago" (autosave indicator)
- "This article is scheduled to publish on May 15, 2026 at 09:00." (banner, info color)
- "This is a previous version. Editing will create a new version." (banner, warning color)

---

## 16. Responsive Behavior

### 16.1 Breakpoint Behaviors

| Breakpoint | Nav            | Content Editor          | Tables          | Cards (Dashboard) |
| ---------- | -------------- | ----------------------- | --------------- | ----------------- |
| Compact    | Drawer (modal) | Single column, side panel becomes accordion | Horizontal scroll within card | 1 column |
| Medium     | Drawer (modal) | Single column, side panel collapsible | Horizontal scroll | 2 columns |
| Expanded   | Rail (80 dp)   | Single column, side panel right | Full table | 4 columns |
| Large      | Rail (80 dp)   | Two-pane (editor + side panel) | Full table | 4 columns |
| Extra large| Rail (80 dp)   | Two-pane, max-width 1440 dp centered | Full table | 4 columns |

### 16.2 Touch Targets

All interactive elements ≥ 48×48 dp touch target (even if visual size is smaller, padding extends hit area).

### 16.3 Mobile-Specific Adaptations (Compact)

- Top app bar collapses search into icon → opens overlay.
- Filter chips wrap onto multiple rows.
- FAB sits bottom-right, 16 dp margin.
- Side panels become bottom sheets when triggered.

---

## 17. Accessibility (a11y)

### 17.1 Compliance Target

**WCAG 2.1 Level AA** across the entire admin panel.

### 17.2 Keyboard Navigation

- All interactive elements reachable via Tab in logical order.
- Skip-to-content link at top of page (visible on focus).
- Focus indicator: 2 dp outline `primary` with 2 dp gap from element, visible against any background.
- Modals trap focus; Esc closes.
- Menus: arrow keys to navigate, Enter to select, Esc to close.
- Tables: arrow keys to navigate cells when table has focus.

### 17.3 Screen Reader Support

- All icons that convey meaning have `aria-label`.
- Icon-only buttons have descriptive labels (e.g., `aria-label="Delete article"`).
- Form fields use proper `label` association.
- Error messages use `aria-live="polite"` or `aria-describedby`.
- Loading states use `aria-busy="true"`.
- Snackbars use `role="status"` (polite) or `role="alert"` (errors).
- Status chips include hidden status text for screen readers ("Status: Published").
- Data table uses proper `<thead>`, `<th scope>`, `<tbody>`, `<caption>` semantics.

### 17.4 Color & Contrast

- All text/background pairs verified ≥ 4.5:1 (body) or 3:1 (large/UI).
- Never rely on color alone to convey status — combine with icon and text label.
- Focus indicator independent of color (uses outline thickness).

### 17.5 Reduced Motion

`@media (prefers-reduced-motion: reduce)`:
- Disable shimmer, parallax.
- Reduce all durations to ≤ 50 ms.
- Replace slide animations with opacity crossfade.

### 17.6 Other

- Form errors announce on submit failure.
- Time-limited actions (snackbar Undo) have configurable longer duration if needed.
- Confirmation dialogs for all destructive actions.

---

## 18. Dark Mode

### 18.1 Toggle

User preference in Settings → Profile: Light / Dark / System (default).

### 18.2 Dark Theme Color Roles

Generated from the same seed via MD3 algorithm:

| Role                      | Hex (Dark)  |
| ------------------------- | ----------- |
| primary                   | `#D0BCFF`   |
| on-primary                | `#381E72`   |
| primary-container         | `#4F378B`   |
| on-primary-container      | `#EADDFF`   |
| surface                   | `#141218`   |
| on-surface                | `#E6E0E9`   |
| on-surface-variant        | `#CAC4D0`   |
| surface-container-lowest  | `#0F0D13`   |
| surface-container-low     | `#1D1B20`   |
| surface-container         | `#211F26`   |
| surface-container-high    | `#2B2930`   |
| surface-container-highest | `#36343B`   |
| outline                   | `#938F99`   |
| outline-variant           | `#49454F`   |
| error                     | `#F2B8B5`   |
| error-container           | `#8C1D18`   |

Status chip colors are remapped to maintain ≥ 4.5:1 contrast on dark surfaces.

### 18.3 Elevation in Dark Mode

In dark mode, elevation is communicated more via **surface tint** than shadow (shadows are less visible). The surface tint overlay opacity follows MD3 specs but uses `primary` color as tint.

---

## 19. Content Editor — Rich Text UX

### 19.1 Editor Library

**TipTap** (ProseMirror-based) styled to MD3.

### 19.2 Toolbar

Sticky toolbar at top of editor pane. Grouped buttons separated by 1 dp vertical dividers (`outline-variant`):

| Group        | Buttons                                                 |
| ------------ | ------------------------------------------------------- |
| History      | Undo, Redo                                              |
| Block        | Paragraph, Heading 2, Heading 3, Heading 4              |
| Inline       | Bold, Italic, Underline, Strikethrough, Code            |
| List         | Bulleted list, Numbered list                            |
| Insert       | Link, Image, Horizontal rule, Blockquote, Code block    |
| View         | Fullscreen toggle                                       |

Each button: 40×40 dp icon button, active state = `secondary-container` background.

### 19.3 Inline Behaviors

- **Link**: Cmd/Ctrl-K opens link dialog (URL field, optional display text override, target option).
- **Image**: Opens Media Picker dialog; on insert, embedded block with alt text editable inline; resizable via drag handles.
- **Slash commands** (future, not MVP): typing `/` opens command menu for block insertion.
- **Paste**: HTML paste is sanitized through server allow-list on save; rich pastes from Word/Google Docs are converted to clean formatting.

### 19.4 Autosave UX

- Trigger: every 30 seconds of inactivity, or on field blur for title/slug/SEO fields.
- Indicator: small text below title:
  - "Saving..." with subtle spinner during save.
  - "Saved 5 seconds ago" after success.
  - "Couldn't save. Retrying..." on failure (`error` color).
- Conflict resolution: if server returns a newer version on save, show dialog: "This article was updated by [Other User] [time ago]. Reload to see the latest version or save a copy as a new draft."

### 19.5 Version History

Accessible from "View version history" link in side panel. Opens dedicated screen:

- Left: list of versions (timestamp + editor avatar/name).
- Right: read-only preview of selected version.
- Action: "Revert to this version" — creates a new version with this snapshot.

---

## 20. Media Library — UX Specification

### 20.1 Upload Flow

1. User clicks [↑ Upload] or drags files into the library.
2. Files validated client-side (type, size). Invalid → toast error per file.
3. For valid files, the SPA requests presigned URLs.
4. Each file uploads directly to S3; progress shown in a stacked toast/banner ("Uploading 3 of 5 files... 67%").
5. On completion, SPA POSTs metadata; backend enqueues variant generation.
6. Tile appears in grid with placeholder thumbnail until variants are ready (max ~3 s).

### 20.2 Media Picker Dialog (from Content Editor)

Opens as a Basic Dialog with:

- Search field, filters (type, recent, mine).
- Grid of media (same tile design).
- "Upload new" button at top.
- Selecting a tile → tile gets primary outline + checkmark; "Insert" button enables.
- Confirm with [Insert] (Filled button) or [Cancel] (Text button).

### 20.3 Media Details Drawer

Clicking a tile in the library opens a right-side drawer:

```
┌────────────────────────────────────┐
│ hero.jpg                       [✕] │
├────────────────────────────────────┤
│ [Large preview image]              │
│                                    │
│ Alt text (required for a11y)       │
│ [______________________________]   │
│                                    │
│ Caption (optional)                  │
│ [______________________________]   │
│                                    │
│ ─────────────────────────────────  │
│ Filename:    hero.jpg              │
│ Size:        1.2 MB                │
│ Dimensions:  1920 × 1080           │
│ Uploaded by: Alice · 2 days ago    │
│ Used in:     3 articles ▾          │
│                                    │
│ ─────────────────────────────────  │
│ [📋 Copy URL]  [💾 Download]       │
│                                    │
│ [🗑 Delete]    (error color, only  │
│                 if not referenced)  │
└────────────────────────────────────┘
```

Drawer width: 400 dp; slides in from right; closes on Esc or scrim click.

---

## 21. Appendices

### 21.1 Appendix A — Component Cheat Sheet

| Need to...                            | Use                                           |
| ------------------------------------- | --------------------------------------------- |
| Trigger the primary action            | Filled Button                                 |
| Suggest a secondary action            | Outlined Button or Filled Tonal               |
| Offer a low-emphasis action           | Text Button                                   |
| Provide screen-level main action      | Extended FAB                                  |
| Display tabular data                  | Data Table                                    |
| Show status                           | Filter or Assist Chip (status variant)        |
| Group related content                 | Card (Outlined for low emphasis, Elevated for high) |
| Get user input (single line)          | Filled Text Field                             |
| Get user input inside a Card / Dialog | Outlined Text Field                           |
| Confirm a destructive action          | Basic Dialog                                  |
| Show transient success/failure        | Snackbar                                      |
| Reveal more options                   | Menu via icon button (`more_vert`)            |
| Navigate top-level sections           | Navigation Rail                               |

### 21.2 Appendix B — Design Tokens Export (JSON skeleton)

```json
{
  "color": {
    "light": {
      "primary": "#6750A4",
      "on-primary": "#FFFFFF",
      "primary-container": "#EADDFF",
      "on-primary-container": "#21005D",
      "surface": "#FEF7FF",
      "on-surface": "#1D1B20",
      "outline": "#79747E"
    },
    "dark": {
      "primary": "#D0BCFF",
      "on-primary": "#381E72",
      "surface": "#141218",
      "on-surface": "#E6E0E9",
      "outline": "#938F99"
    }
  },
  "typography": {
    "fontFamily": {
      "sans": "Roboto Flex, system-ui, sans-serif",
      "mono": "Roboto Mono, ui-monospace, monospace"
    },
    "scale": {
      "display-medium": { "size": 45, "lineHeight": 52, "weight": 400 },
      "headline-large": { "size": 32, "lineHeight": 40, "weight": 400 },
      "title-large":    { "size": 22, "lineHeight": 28, "weight": 500 },
      "body-large":     { "size": 16, "lineHeight": 24, "weight": 400 },
      "label-large":    { "size": 14, "lineHeight": 20, "weight": 500 }
    }
  },
  "shape": {
    "corner-small": 8,
    "corner-medium": 12,
    "corner-large": 16,
    "corner-extra-large": 28,
    "corner-full": 9999
  },
  "spacing": {
    "1": 4, "2": 8, "3": 12, "4": 16, "5": 20,
    "6": 24, "7": 32, "8": 40, "9": 48
  },
  "motion": {
    "duration": {
      "short4": 200,
      "medium2": 300,
      "long1": 450
    },
    "easing": {
      "standard": "cubic-bezier(0.2, 0, 0, 1.0)",
      "emphasized-decelerate": "cubic-bezier(0.05, 0.7, 0.1, 1)"
    }
  }
}
```

### 21.3 Appendix C — Material Design 3 References

- Foundations: https://m3.material.io/foundations
- Color system: https://m3.material.io/styles/color/system/overview
- Typography: https://m3.material.io/styles/typography/overview
- Components: https://m3.material.io/components
- Motion: https://m3.material.io/styles/motion/overview
- Accessibility: https://m3.material.io/foundations/accessible-design/overview

### 21.4 Appendix D — Document Change Log

| Version | Date       | Author | Change                          |
| ------- | ---------- | ------ | ------------------------------- |
| 1.0     | 2026-05-11 | —      | Initial MVP UI/UX design        |

---

**End of Document**
