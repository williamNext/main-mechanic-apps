# Design Guide — Oficina Platform

> **Audience:** Claude (and any agent or designer) asked to change how the apps *look*.
> **Purpose:** describe the current design system exactly as it is implemented, name every knob you
> can turn, and give safe recipes for changing the look without breaking screens.
> **Companion doc:** [`PROJECT_CONTEXT.md`](PROJECT_CONTEXT.md) — architecture, data, use cases.
> Anything non-visual belongs there, not here.
>
> **Shell dialect:** command blocks assume **bash** (Git Bash on Windows), not PowerShell.
>
> **Verification status (2026-08-10):** §3 (tokens), §4, §7–§11 and §15 were checked line-by-line
> against the code and survived two review passes. The **counts** in §1 and §5 are point-in-time
> measurements — re-derive them with the grep in §1 rather than trusting them. §6's component
> inventory covers `oficina`/`mechanic` only; `admin` has no equivalent set (§5).
> If this guide and `packages/theme`'s `src/theme.ts` disagree, the code wins.

---

## Table of contents

1. [Read this first](#1-read-this-first)
2. [Where design lives](#2-where-design-lives)
3. [Design tokens reference](#3-design-tokens-reference)
4. [The two-generation problem](#4-the-two-generation-problem)
5. [The admin app is a separate design system](#5-the-admin-app-is-a-separate-design-system)
6. [Component inventory](#6-component-inventory)
7. [Layout, navigation and screen anatomy](#7-layout-navigation-and-screen-anatomy)
8. [Status colors and semantics](#8-status-colors-and-semantics)
9. [Dark mode: currently disabled](#9-dark-mode-currently-disabled)
10. [Icons, fonts and assets](#10-icons-fonts-and-assets)
11. [Accessibility rules](#11-accessibility-rules)
12. [Recipes: how to make specific changes](#12-recipes-how-to-make-specific-changes)
13. [Rules for agents changing design](#13-rules-for-agents-changing-design)
14. [Change checklist](#14-change-checklist)
15. [Known design debt](#15-known-design-debt)

---

## 1. Read this first

Three apps, three copies of the design system:

| App | Role | Design source | Token discipline |
|---|---|---|---|
| `oficina/` | client-facing, mobile-first | `@main-mechanic/theme` (`packages/theme`) | ✅ good — 1 hard-coded hex in all of `app/` + `components/` |
| `mechanic/` | mechanic, mobile-first | `@main-mechanic/theme` (same package, same tokens) | ✅ good — 1 hard-coded hex |
| `admin/` | admin panel, desktop-first web | `@main-mechanic/theme` exists **but is largely bypassed** | ❌ poor — **219 hard-coded hexes** in `app/` + `components/` |

Counts above were measured on 2026-08-10. Re-derive them at any time with:

```bash
grep -rhoE "#[0-9a-fA-F]{6}\b" oficina/app oficina/components | wc -l
```

Swap the app name; append `| sort | uniq -c | sort -rn` for the frequency table in §5 (`-h`
suppresses filenames, which matters on Windows paths — a `cut -d:` pipeline would split on the
drive-letter colon). The regex matches **6-digit** hexes only — as of 2026-08-10 that is every hex
literal in these files (a `{3,8}` variant returns the identical 1 / 1 / 208), but it would miss
3-digit (`#fff`) or 8-digit alpha forms if any were introduced. The runtime `color + '1A'`
alpha-suffix pattern (§6.1) is never matched by any of these greps.

**`@main-mechanic/theme` (`packages/theme`) is the shared design package**, since Phase 4
(`D-AN`). A token change is **one edit**, checked by the package's own typecheck/lint/test and
consumed by all three apps through one workspace dependency. No app declares `constants/theme.ts`
any more — the copy-and-drift failure mode this section used to describe (one real instance was
found and closed before extraction: two `letterSpacing` values, see §3.4) can no longer happen,
because there is only one file left to drift from.

Everything is React Native `StyleSheet` (via `react-native-web` on web). There is no Tailwind, no
CSS-in-JS library, no styled-components, no NativeWind.

---

## 2. Where design lives

```
packages/theme/
  src/theme.ts          ★ THE design token file — colors, spacing, radius, typography,
                          shadows, status theme, layout metrics. Change design HERE.
  src/use-theme.ts       useAppTheme() → { colors, theme }   ← currently HARD-LOCKED to 'light'
  src/index.ts            barrel — all 17 exported names, this package's only public surface

<app>/
  app/**/*.tsx           Screens: local StyleSheet blocks that consume the tokens, imported
                          from `@main-mechanic/theme`
  components/
    ui/                  Generation-1 primitives (the ones screens actually use)
    app/                 Generation-2 primitives (AppButton, AppCard, AppInput, Avatar,
                         Badge, ScreenContainer) — partially adopted
  assets/images/         icon, splash, adaptive icons, favicon
  app.json               splash screen config, adaptive icon colors, userInterfaceStyle
```

Since Phase 4 (`D-AN`, `D-AO`), no app has its own `constants/theme.ts`, `hooks/use-theme.ts`, or
`hooks/use-theme-color.ts` — every screen imports `colors`, `spacing`, `radius`, `typography`,
`shadow`, `statusTheme`, `StatusLabels`, `useAppTheme`, and the rest directly from
`@main-mechanic/theme`. `hooks/use-color-scheme.ts` and the Expo-template leftovers
(`themed-text.tsx`, `themed-view.tsx`, `components/ui/collapsible.tsx`,
`components/ui/icon-symbol*.tsx`) are deleted outright in every app, not moved — `useAppTheme` was
the only live accessor on that seam. See `PROJECT_CONTEXT.md` §10.3 `D-AO` for the full 22-file
list and [ADR 0002](docs/adr/0002-npm-workspaces-shared-wire-client.md) for why the package
mechanism is npm workspaces, not a build step or a sync script.

**`admin/` has a different tree.** It has **no generation-1 `components/ui/` set** — only:

```
admin/
  components/admin/AdminShell.tsx    sidebar + topbar chrome, the 900px breakpoint, nav items
  components/ui/AdminControls.tsx    filter/search/pagination controls
  features/admin/filter-utils.ts     AdminFilters defaults + sanitizing (not visual, but drives
                                     what the filter controls render)
  tests/e2e/ + playwright.config.ts  add-mechanic, delete-all-mechanics, finance
  utils/csv.ts                       export formatting
```

Both component files style themselves with literal hexes. So "restyle an admin table" means
editing the screen files in `admin/app/(admin)/` directly — `mechanics/index.tsx` (536 lines, the
largest), `finance.tsx` (504), `appointments.tsx` (201), `mechanics/[id].tsx` (163),
`reports.tsx` (107), `dashboard.tsx` (105), `settings.tsx` (58) — there is no shared table
component to change.

---

## 3. Design tokens reference

All from `@main-mechanic/theme`'s `src/theme.ts` — one file, all three apps. `admin/` imports the
same package but most of its screens ignore it (§5).

### 3.1 `colors` — the raw palette (Material-3-flavored naming)

| Token | Value | Reads as | Used for |
|---|---|---|---|
| `primary` | `#181f21` | near-black charcoal | primary surfaces, `confirmado` status, outlined-button text |
| `onPrimary` | `#ffffff` | white | text on primary/filled buttons |
| `primaryContainer` | `#2d3436` | dark slate | raised dark blocks |
| `primaryFixed` | `#dde4e6` | pale blue-grey | subtle fills |
| `secondary` | `#a83639` | deep red | mapped to `success` (⚠️ see §15) |
| `onSecondary` | `#ffffff` | white | |
| `secondaryContainer` | `#ff7675` | coral | secondary buttons + the `coral` shadow |
| `onSecondaryContainer` | `#720b16` | dark maroon | |
| `background` | `#f9f9f9` | off-white | every screen background |
| `surface` | `#f9f9f9` | off-white | cards |
| `surfaceContainerLowest` | `#ffffff` | white | elevated cards, inputs |
| `surfaceContainerLow` | `#f3f3f3` | | |
| `surfaceContainer` | `#eeeeee` | | ripple, dividers |
| `surfaceContainerHigh` | `#e8e8e8` | | `acabado` status chip, ripples |
| `outline` | `#747879` | mid grey | borders, muted text |
| `outlineVariant` | `#c3c7c8` | light grey | subtle borders |
| `onBackground` / `onSurface` | `#1a1c1c` | near-black | body text |
| `onSurfaceVariant` | `#434749` | dark grey | secondary text, icons |
| `safetyOrange` | `#ff6b00` | orange | **the brand accent — primary CTA fill**, `nao_finalizado` |
| `whatsapp` | `#25d366` | WhatsApp green | the WhatsApp button variant |
| `error` | `#ba1a1a` | red | errors, `cancelado` |
| `errorContainer` | `#ffdad6` | pale pink | error backgrounds, cancelled chip |
| `shadowBase` | `#000000` | black | shadow color base |

**Brand read:** near-black + off-white base, **safety orange** as the action color (auto-shop
signal), coral as a secondary accent, WhatsApp green reserved for WhatsApp only.

### 3.2 `spacing` (and the `Spacing` alias)

`spacing` (raw, used by generation-1 components):
`xs: 4 · base: 8 · sm: 12 · md: 24 · lg: 40 · xl: 64 · gutterMobile: 16 · gutterDesktop: 24 ·
marginMobile: 20`

⚠️ **`spacing.sm` (12) is LARGER than `spacing.base` (8)** — the names are not in ascending order.
Read the number, not the name.

`Spacing` (remapped alias, used by generation-2 components — a **conventional** scale):
`xs: 4 · sm: 8 · md: 16 · lg: 24 · xl: 32 · xxl: 40 · xxxl: 64`

Both exports live in the same file and are both in use. `Spacing.md = 16` while `spacing.md = 24`.
**Check which one a file imports before editing.**

### 3.3 Radius

`radius`: `sm: 4 · md: 8 · lg: 12 · full: 9999`
`BorderRadius` (alias + one extra): `sm: 4 · md: 8 · lg: 12 · xl: 16 · full: 9999`
Cards and buttons use `lg` (12). Badges/pills use `full`.

### 3.4 Typography

Font family: **Inter**, loaded via `@expo-google-fonts/inter` in `app/_layout.tsx`. The splash
screen is held until fonts resolve, so a missing weight is a visible bug.

`fontFamilies`: `regular: Inter_400Regular · medium: Inter_500Medium · semibold: Inter_600SemiBold ·
bold: Inter_700Bold · extrabold: Inter_800ExtraBold`

`typography` presets (preferred — they bundle size + line-height + family):

| Preset | Size / line-height | Family | Use |
|---|---|---|---|
| `headlineXl` | 48 / 56, `letterSpacing -0.96` | extrabold | hero |
| `headlineLg` | 32 / 40, `letterSpacing -0.32` | bold | page titles (desktop) |
| `headlineLgMobile` | 24 / 32 | bold | page titles (mobile) |
| `headlineMd` | 20 / 28 | semibold | section titles |
| `bodyLg` | 18 / 28 | regular | lead paragraphs |
| `bodyMd` | 16 / 24 | regular | body text |
| `labelMd` | 14 / 20, `letterSpacing 0.7` | semibold | **button labels (uppercase)** |
| `labelSm` | 12 / 16 | medium | captions, meta |

`FontSize` / `FontWeight` are the generation-2 escape hatch (`xs 11 · sm 12 · md 16 · lg 18 ·
xl 20 · xxl 24 · xxxl 32 · hero 48`; weights `400/500/600/700`). **Prefer the `typography`
presets** — `FontWeight` alone does not select the matching Inter family, which is why some text
renders in a different weight than intended.

The `-0.96` / `-0.32` `letterSpacing` values above are now canonical **in the code, not just in
this table** — `mechanic` and `admin` set both to `0` until Phase 4's theme extraction adopted
`oficina`'s values platform-wide (`D-AL`). One file now enforces what this section always
documented as correct.

### 3.5 Shadows

`shadow.light` — offset `(0,4)`, opacity `.05`, radius 6, elevation 2
`shadow.medium` — offset `(0,10)`, opacity `.10`, radius 15, elevation 5
`shadow.coral` — coral-tinted glow for the secondary button: offset `(0,8)`, opacity `.5`, radius 14

`Shadow` alias: `sm → light`, `md → medium`, `lg → medium` (**`lg` is not actually larger than
`md`**).

### 3.6 `LayoutMetrics`

`tabBarHeight: 80 · tabBarBottomPadding: 0 · ctaHeight: 56 · ctaGapFromTabs: 12`
Use these when positioning a floating CTA above the bottom tab bar, so it never collides.

---

## 4. The two-generation problem

Two overlapping component sets exist side by side:

| | Generation 1 — `components/ui/` | Generation 2 — `components/app/` |
|---|---|---|
| Token style | raw lowercase: `colors`, `spacing`, `radius`, `typography`, `shadow` | aliases via hook: `useAppTheme()`, `Spacing`, `BorderRadius`, `FontSize`, `FontWeight` |
| Base element | `Pressable` with `android_ripple` + press animation | `TouchableOpacity` with `activeOpacity` |
| Examples | `PrimaryButton`, `TopAppBar`, `BottomNavBar`, `TimeSlotButton`, `DateChip`, `InputField`, `StatusBanner`, `AppointmentCard`, `Card`, `Badge`, `Avatar`, `EmptyState`, `Button`, `Input` | `AppButton`, `AppCard`, `AppInput`, `Avatar`, `Badge`, `ScreenContainer` |
| Adoption | **what the screens actually import** | partial |

Concretely: `ui/PrimaryButton` is the orange, uppercase, full-width, 56px-min CTA used across the
booking flow. `app/AppButton` is a different button (54px, `BorderRadius.md`, non-uppercase,
`colors.primary` fill). They do not look the same.

**Guidance:** for a visual change, edit **generation 1** — that is what users see. Do not
"consolidate" the two sets as a side effect of an unrelated task; that is its own project and it
will move pixels on every screen.

---

## 5. The admin app is a separate design system

`admin/` renders its own palette inline. The most frequent literals:

| Hex | Count | Role |
|---|---|---|
| `#101828` | 42 | primary text / active nav |
| `#667085` | 36 | secondary text / inactive icons |
| `#ffffff` | 30 | surfaces |
| `#344054` | 23 | body text |
| `#eaecf0` | 14 | borders |
| `#d0d5dd` | 14 | stronger borders |
| `#98a2b3` | 13 | muted text |
| `#b42318` | 10 | destructive |

This is a Untitled-UI/Tailwind-style neutral ramp — a **cool grey enterprise dashboard look**,
deliberately different from the warm off-white + safety-orange consumer apps.

**If you are asked to restyle the admin app,** you have two options; pick one explicitly and say
which:
1. **Token migration (recommended, larger):** add the grey ramp to `admin/constants/theme.ts` as
   named tokens (e.g. `adminText`, `adminTextMuted`, `adminBorder`…), then replace the literals
   file by file. After that, admin re-skinning becomes a one-file edit like the other apps.
2. **Literal sweep (smaller, fragile):** find/replace the hexes. Fast, but the next change costs
   the same again.

`AdminShell.tsx` also holds the desktop breakpoint: **`desktop = width >= 900`**, sidebar above,
compact nav below. The nav item list (Painel / Mecânicos / Agendamentos / Financeiro / Relatórios /
Configurações) is defined there as a `navItems` array with `lucide-react-native` icons.

---

## 6. Component inventory

### 6.1 `components/ui/` (generation 1) — present in `oficina` and `mechanic`

| Component | What it renders | Key visual decisions |
|---|---|---|
| `PrimaryButton` | The main CTA | variants `filled` (safetyOrange) · `outlined` (white fill, primary border+text) · `whatsapp` (green) · `secondary` (coral + coral glow). Full width, `minHeight 56`, `radius.lg`, label `typography.labelMd` **uppercase**, spring press-scale to 0.98, `ActivityIndicator` when `loading`, opacity `.55` when disabled |
| `Button` | Older generic button | superseded by `PrimaryButton` |
| `Card` | Surface container | variants `elevated` (surface + `Shadow.md`) · `outlined` (border `gray200`) · `filled` (`gray100`); `BorderRadius.lg`; `padding` prop keyed to `Spacing` |
| `Badge` / `StatusBadge` | Pill labels | `Badge` variants default/success/warning/error/info; background = color + `'1A'` (10% alpha hex suffix). `StatusBadge` takes an appointment status, resolves via `getStatusColor()` + `StatusLabels`, and prepends a 6px dot |
| `TopAppBar` | Screen header | back/leading icon · centered single-line title · trailing profile icon. Default title `'Mechanic Pro'` (⚠️ stale brand name) |
| `BottomNavBar` | Custom tab bar | maps route → `{label, icon}` (`browse→Explorar/build`, `bookings→Reservas/calendar-today`, `notifications→Avisos/notifications`, `profile→Perfil/person`); reads the unread count from `useNotificationStore` for the badge; respects `useSafeAreaInsets()` |
| `TimeSlotButton` | Selectable time chip | booking flow |
| `DateChip` | Horizontal day selector chip | 7-day strip |
| `InputField` / `Input` | Labeled text input | |
| `StatusBanner` | Inline status/message banner | |
| `AppointmentCard` | Appointment list row | also exists at `components/AppointmentCard.tsx` (older duplicate) |
| `Avatar` | Circle with initials (`utils/format.getInitials`) or image | |
| `EmptyState` | Empty-list illustration + copy | |
| `icon-symbol(.ios).tsx`, `collapsible.tsx` | Expo-template leftovers | |

Also at `components/` root: `AppointmentCard.tsx`, `MechanicCard.tsx`, `TimeSlotPicker.tsx`,
`themed-text.tsx`, `themed-view.tsx` — older/duplicated variants. Check which one a screen imports
before editing.

### 6.2 `components/app/` (generation 2)

`AppButton` · `AppCard` · `AppInput` · `Avatar` · `Badge` · `ScreenContainer` — token-alias based,
`useAppTheme()`-driven, partially adopted (`mechanic/app/(mechanic)/availability.tsx` uses
`AppInput`, for instance).

---

## 7. Layout, navigation and screen anatomy

**Client & mechanic (mobile-first):**

```
SafeAreaView (edges: ['top'])
  └─ TopAppBar            (back · title · profile)
     └─ ScrollView / FlatList
          section title   (typography.headlineMd)
          content cards   (Card / AppointmentCard, gap spacing.sm–md)
  └─ BottomNavBar         (custom tab bar, 80px + safe-area bottom inset)
```
Screen background is always `colors.background` (`#f9f9f9`), set both in each screen's
`SafeAreaView` and in `_layout.tsx` `screenOptions.contentStyle`.

Detail routes are hidden from the tab bar with `options={{ href: null, tabBarItemStyle: { display:
'none' } }}` — that is how `booking-success` and `appointment/[id]` stay out of the nav.

**Admin (desktop-first):** `AdminShell(title, children)` — left sidebar with brand block, nav list,
account block and logout at ≥900px; compact header below. Content is a scrolling column of cards,
tables and filter rows.

**Navigation transition:** root `Stack` uses `animation: 'fade'`, `headerShown: false`
everywhere — headers are the app's own `TopAppBar`/`AdminShell`, never React Navigation's.

**Splash:** configured in `app.json` (`expo-splash-screen`: `splash-icon.png`, width 200,
`contain`, white background, black in dark). Held manually until Inter loads.

---

## 8. Status colors and semantics

Appointment status drives color in lists, badges and detail headers. Two parallel mappings exist:

`statusTheme` (background / text / MaterialIcon name):

| Status | Background | Text | Icon |
|---|---|---|---|
| `confirmado` | `colors.primary` `#181f21` | `onPrimary` white | `schedule` |
| `nao_finalizado` | `#fffaeb` (hard-coded amber tint) | `#b54708` (hard-coded amber) | `pending-actions` |
| `acabado` | `surfaceContainerHigh` `#e8e8e8` | `onSurface` | `check-circle` |
| `cancelado` | `errorContainer` `#ffdad6` | `error` `#ba1a1a` | `cancel` |

`getStatusColor(status, palette)` (single accent color, used by `StatusBadge`):
`confirmado → primary` · `nao_finalizado → safetyOrange` · `acabado → surfaceContainerHigh` ·
`cancelado → error` · default → `gray500`.

`StatusLabels` gives the PT-BR display strings: `Confirmado`, `Nao finalizado`, `Acabado`,
`Cancelado`.

⚠️ Two issues to know before changing status colors: the amber pair in `statusTheme` is
**hard-coded**, not tokenized; and `acabado` resolves to a light grey that, used as a
`StatusBadge` *text* color, is nearly invisible on a light background.

⚠️ `StatusLabels` is missing accents (`Nao finalizado` should be `Não finalizado`). Several PT-BR
strings across the apps are unaccented — fix them together, in one deliberate pass, so the tone
stays consistent.

---

## 9. Dark mode: currently disabled

- `Colors` exports **`light` and `dark` keys with byte-identical values** — there is no real dark
  palette, only the shape of one.
- `hooks/use-theme.ts` hard-codes `const scheme = 'light'`. Every component using `useAppTheme()`
  is therefore permanently light.
- `hooks/use-theme-color.ts` *does* respect `useColorScheme()`, but almost nothing uses it.
- `app.json` declares `"userInterfaceStyle": "automatic"` — a promise the code does not keep.
- `Card` already contains dark-mode handling (swaps shadow for a border when `theme === 'dark'`),
  so the seam exists.

**To actually enable dark mode** (a real project, not a tweak):
1. Author genuine dark values in `Colors.dark` (invert surfaces, keep `safetyOrange` as accent,
   raise text contrast).
2. Change `use-theme.ts` to `const scheme = useColorScheme() ?? 'light'`.
3. Convert generation-1 components from module-scope `StyleSheet.create` with literal `colors.*` to
   runtime styles from `useAppTheme()` — **this is the bulk of the work**, since `StyleSheet` blocks
   are evaluated once at import and cannot react to a theme change.
4. Fix the `StatusBar` style (`app/_layout.tsx` already switches on `theme`).
5. Re-check every hard-coded hex (all 208 in `admin/`, the amber pair in `statusTheme`).

---

## 10. Icons, fonts and assets

- **Icons:** two libraries in use. `@expo/vector-icons` **MaterialIcons** (generation-1 components,
  `oficina`/`mechanic`) and **`lucide-react-native`** (`admin` nav, newer mechanic screens). Match
  whichever the file already uses; do not mix both inside one component.
- **Fonts:** Inter, five weights, loaded once in each app's `app/_layout.tsx`. Adding a weight
  means adding it to the `useFonts` call **and** to `fontFamilies` in `theme.ts`.
- **Assets:** `assets/images/` — `icon.png`, `splash-icon.png`, `favicon.png`,
  `android-icon-foreground/background/monochrome.png`. Android adaptive-icon background is
  `#E6F4FE` in `app.json` (a pale blue that matches nothing in the palette — ⚠️ likely a leftover
  from the Expo template).

---

## 11. Accessibility rules

Each app repo has a `.Jules/` folder with recorded learnings: `palette.md` (the accessibility rule
below — treat it as binding) and `sentinel.md` (not design-related; out of scope for this guide —
read it directly if a task touches whatever it covers).

From `oficina/.Jules/palette.md`:

> `TouchableOpacity` does not inherit screen-reader roles or announce loading/disabled state. A
> central `Button` without a11y props makes the **whole app** inaccessible.

Required on every custom interactive component:
`accessibilityRole="button"` · `accessibilityState={{ disabled, busy }}` · a meaningful
`accessibilityLabel`.

Already correct in `TopAppBar` (`accessibilityLabel="Voltar"` / `"Perfil"`) and `BottomNavBar`
(`accessibilityState={{ selected }}`). ⚠️ `PrimaryButton` and `AppButton` currently **lack** these
props — worth fixing in any button-touching change.

Other rules: keep tap targets ≥44×44 (the 54–56px button heights already comply); never signal
state by color alone — `StatusBadge`'s dot + label pattern is the house solution; keep contrast at
WCAG AA (`outline #747879` on `background #f9f9f9` is ~4.0:1, **borderline** — do not use it for
small body text).

---

## 12. Recipes: how to make specific changes

**Change the brand accent color (e.g. orange → blue).**
Edit `colors.safetyOrange` in `constants/theme.ts` — in **all three** repos. That single token
drives the primary CTA fill and the `nao_finalizado` status accent. If the two should no longer
share a color, split the token first (`accent` vs `statusPending`), then update `getStatusColor`.
Rename the token too — `safetyOrange` holding a blue is how a codebase starts lying.
⚠️ **In `admin/` this token edit changes almost nothing visible** — its screens use literal hexes
(§5). Do not report a cross-app color change as complete on the strength of the token edit alone:
either restyle admin per §5, or state explicitly that admin was left on the old palette. Verify
with the grep in §14.

**Change corner rounding.** `radius` + `BorderRadius` in `theme.ts`. Both, or buttons and cards
will disagree.

**Change the type scale.** Edit the `typography` presets. Do not edit `FontSize` alone — it does
not carry the font family, so text will change size without changing weight.

**Restyle the primary button.** `components/ui/PrimaryButton.tsx` — `variantStyles`,
`variantTextStyles`, and the `styles.button` block. Remember it is uppercase via
`textTransform: 'uppercase'` on the title.

**Change screen background.** `colors.background` **and** each screen's `SafeAreaView` style, plus
`contentStyle` in `app/_layout.tsx` and `sceneStyle` in the group `_layout.tsx`.

**Change the tab bar.** `components/ui/BottomNavBar.tsx` (labels, icons, colors, badge) and
`LayoutMetrics.tabBarHeight`. Labels also appear in `app/(client)/_layout.tsx` `Tabs.Screen
options.title` — **they are duplicated and can disagree** (today: `notifications` is "Notificacoes"
in the layout but "Avisos" in the nav bar).

**Change the admin look.** See §5 — decide token-migration vs literal-sweep first.

**Add a new component.** Put it in `components/ui/`, style it with the raw lowercase tokens
(`colors`/`spacing`/`radius`/`typography`/`shadow`), use `Pressable` with `android_ripple`, and add
the a11y props from §11. Match generation 1, since that is what the screens use.

**Change a user-facing string.** All UI copy is **Brazilian Portuguese**, inline in the screens
(no i18n library). Keep the terse, direct tone; check §19 of `PROJECT_CONTEXT.md` for the accepted
term for each domain concept.

---

## 13. Rules for agents changing design

1. **Change tokens, not literals.** If you find yourself typing a hex in a screen, add a token
   instead (`admin/` excepted only until it is migrated).
2. **One package, one edit.** `packages/theme` is the single token source for all three apps
   (§2) — there is no per-app copy left to keep in sync.
3. **Know which generation you are in** before editing a component (§4). `spacing.md = 24` but
   `Spacing.md = 16`; getting this wrong silently changes every gap in the file.
4. **`StyleSheet.create` at module scope is evaluated once.** Anything that must react to state or
   theme has to be an inline style or come from `useAppTheme()`.
5. **Do not consolidate the two component generations, unify the admin palette, or enable dark mode
   as a side effect** of another task. Each is a standalone project. Flag it, do not do it.
6. **Preserve `testID`s.** All four Playwright suites select on them
   (`PROJECT_CONTEXT.md` §15.2) — e.g. `availability-slot-<date>-<start>-<end>`, produced by
   `getSlotTestId()` in `mechanic/app/(mechanic)/availability.tsx` and consumed by
   `mechanic/tests/e2e/availability.spec.ts` (**not** by `tests-e2e/`, which selects on
   `availability-start-input`, `availability-create-slot-button`, `service-*-input`).
   Changing markup can break e2e even when the behavior is correct.
7. **Keep accessibility props** when refactoring a component; do not drop `accessibilityRole` or
   `accessibilityLabel` to simplify a diff.
8. **Verify on all three targets** — iOS, Android and web — for anything touching shadows
   (`elevation` is Android-only, `shadow*` props are iOS/web), safe areas, or hover states.
9. **Do not add a styling library.** The house style is React Native `StyleSheet` + tokens.
10. **PT-BR for user-facing text, English for code.**

---

## 14. Change checklist

- [ ] Token edited in `constants/theme.ts` (not a literal in a screen)
- [ ] Same edit applied in **all three** repos, and the files still match
- [ ] Correct token generation used (`spacing`/`typography` vs `Spacing`/`FontSize`)
- [ ] Both status mappings updated if a status color changed (`statusTheme` **and**
      `getStatusColor`)
- [ ] Accessibility props present on any interactive component touched
- [ ] `testID`s preserved
- [ ] Checked on web (`npm run web`) and at least one native target
- [ ] Checked the small-width layout (`admin`: below the 900px breakpoint)
- [ ] Contrast still ≥ AA for body text
- [ ] No new hard-coded hex outside `admin/`
- [ ] If a color changed, the old hex is gone — verify in all three repos:
      `grep -rn "<old-hex>" oficina mechanic admin --include=*.ts --include=*.tsx --exclude-dir=node_modules --exclude-dir=dist`
      returns nothing (or only intended survivors)

---

## 15. Known design debt

| # | Issue | Impact | Fix size |
|---|---|---|---|
| 1 | 219 hard-coded hexes in `admin/` | Admin cannot be re-skinned from tokens | large |
| 2 | Two component generations (`ui/` vs `app/`) with different tokens and base elements | Inconsistent buttons/cards; every change needs a "which one?" decision | large |
| 3 | ~~Three copy-pasted `theme.ts` files, already drifting (letterSpacing)~~ **Closed by Phase 4.** `@main-mechanic/theme` is the one file now; the letterSpacing drift this row described is the same instance §3.4 records as resolved (`D-AL`). | — | — |
| 4 | `Colors.dark` is a copy of `Colors.light`; `useAppTheme` hard-locked to `'light'` while `app.json` says `"automatic"` | Dark mode is advertised but not delivered | large — **deliberately deferred by Phase 4 (`D-AW`, `D-AM`).** The file moved into `packages/theme` untouched; this row's premise did not change |
| 5 | `spacing.sm (12) > spacing.base (8)` — non-monotonic scale | Easy to pick the wrong value | small in isolation, but the rename touches **201 occurrences in 29 files** — **deliberately deferred by Phase 4**, which named this exact number as the reason the extraction diff would become unreviewable if bundled with a fix |
| 6 | `Shadow.lg === Shadow.md` | "large" shadow does nothing | trivial — **deliberately deferred by Phase 4 (`D-AM`).** Cosmetic, out of scope for the same reason as #4 and #8 |
| 7 | ~~`secondary` (`#a83639`, a red) is aliased to `success` in `Colors`~~ **Closed by Phase 4 (`D-AX`).** A new green entered the raw palette; `Colors.success` now points at it. No other pixel moved. | — | — |
| 8 | Amber `nao_finalizado` pair hard-coded inside `statusTheme` | Escapes the token system | trivial — **deliberately deferred by Phase 4 (`D-AM`).** Cosmetic, out of scope for the same reason as #4 and #6 |
| 9 | `acabado` status color is a light grey used as *text* color | Poor contrast / near-invisible | small |
| 10 | `TopAppBar` default title is `'Mechanic Pro'` | Wrong brand leaks into any screen that omits `title` | trivial |
| 11 | Tab labels duplicated between `BottomNavBar` and `_layout.tsx`, already inconsistent ("Avisos" vs "Notificacoes") | Confusing labels | trivial |
| 12 | Unaccented PT-BR strings (`Nao finalizado`, `Notificacoes`, `Configuracao`) | Looks unpolished to Brazilian users | small |
| 13 | Duplicate components (`components/AppointmentCard.tsx` vs `components/ui/AppointmentCard.tsx`) | Edit the wrong one, see no change | small |
| 14 | `PrimaryButton` / `AppButton` missing a11y props | Screen readers announce nothing useful | small |
| 15 | Android adaptive-icon background `#E6F4FE` matches no palette color | Off-brand launcher icon | trivial |
| 16 | ~~Expo-template leftovers (`themed-text`, `themed-view`, `icon-symbol`, `collapsible`)~~ **Closed by Phase 4**, as a side effect of `D-AO` (only `useAppTheme` travelled into the theme package; everything else on that seam, including these four, was deleted rather than moved). | — | — |
| 17 | **Newly identified by Phase 4, nothing deleted here.** Tracing importers across both consumer apps while building `D-AO`'s 22-file deletion list found a much larger unreachable region than the theme seam exposed: **10 component files in `oficina`, 15 in `mechanic`**, unreachable from any screen. Shared by both apps: `AppointmentCard.tsx`, `MechanicCard.tsx`, `TimeSlotPicker.tsx`, `components/app/AppButton.tsx`, `components/app/ScreenContainer.tsx`, `components/ui/Avatar.tsx`, `components/ui/Button.tsx`, `components/ui/EmptyState.tsx`, `components/ui/Input.tsx` (9). `mechanic` additionally: `components/ui/AppointmentCard.tsx`, `components/ui/StatusBanner.tsx`, `components/ui/DateChip.tsx`, `components/ui/TimeSlotButton.tsx`, `components/ui/TopAppBar.tsx` (5). `components/ui/Badge` is transitively dead on top of those in both apps (imported only by the dead `AppointmentCard.tsx`). Only `ui/collapsible` (already counted in #16 / `D-AO`) was on the theme seam this phase touched — the rest is untouched. | Dead code inflates the two-generation confusion (#2) and the bundle | large — a component-inventory project of its own; sizing it is this row's contribution |

---

*Maintenance: when a token, component or breakpoint changes, update this file in the same change.
If this document and `packages/theme`'s `src/theme.ts` disagree, the code wins — and this document
has a bug.*
