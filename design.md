---
name: 'Mission Control: Hydro-Infrastructure'
colors:
  surface: '#131313'
  surface-dim: '#131313'
  surface-bright: '#393939'
  surface-container-lowest: '#0e0e0e'
  surface-container-low: '#1c1b1b'
  surface-container: '#201f1f'
  surface-container-high: '#2a2a2a'
  surface-container-highest: '#353534'
  on-surface: '#e5e2e1'
  on-surface-variant: '#bac9cc'
  inverse-surface: '#e5e2e1'
  inverse-on-surface: '#313030'
  outline: '#849396'
  outline-variant: '#3b494c'
  surface-tint: '#00daf3'
  primary: '#c3f5ff'
  on-primary: '#00363d'
  primary-container: '#00e5ff'
  on-primary-container: '#00626e'
  inverse-primary: '#006875'
  secondary: '#ffb778'
  on-secondary: '#4c2700'
  secondary-container: '#fd9000'
  on-secondary-container: '#613400'
  tertiary: '#ffe7e6'
  on-tertiary: '#680014'
  tertiary-container: '#ffc1c0'
  on-tertiary-container: '#b4002b'
  error: '#ffb4ab'
  on-error: '#690005'
  error-container: '#93000a'
  on-error-container: '#ffdad6'
  primary-fixed: '#9cf0ff'
  primary-fixed-dim: '#00daf3'
  on-primary-fixed: '#001f24'
  on-primary-fixed-variant: '#004f58'
  secondary-fixed: '#ffdcc1'
  secondary-fixed-dim: '#ffb778'
  on-secondary-fixed: '#2e1500'
  on-secondary-fixed-variant: '#6c3a00'
  tertiary-fixed: '#ffdad9'
  tertiary-fixed-dim: '#ffb3b3'
  on-tertiary-fixed: '#400009'
  on-tertiary-fixed-variant: '#920021'
  background: '#131313'
  on-background: '#e5e2e1'
  surface-variant: '#353534'
typography:
  display-lg:
    fontFamily: Inter
    fontSize: 48px
    fontWeight: '700'
    lineHeight: 56px
    letterSpacing: -0.02em
  headline-lg:
    fontFamily: Inter
    fontSize: 32px
    fontWeight: '600'
    lineHeight: 40px
    letterSpacing: -0.01em
  headline-md:
    fontFamily: Inter
    fontSize: 24px
    fontWeight: '600'
    lineHeight: 32px
  headline-sm:
    fontFamily: Inter
    fontSize: 20px
    fontWeight: '600'
    lineHeight: 28px
  body-lg:
    fontFamily: Inter
    fontSize: 16px
    fontWeight: '400'
    lineHeight: 24px
  body-md:
    fontFamily: Inter
    fontSize: 14px
    fontWeight: '400'
    lineHeight: 20px
  label-md:
    fontFamily: Inter
    fontSize: 12px
    fontWeight: '500'
    lineHeight: 16px
    letterSpacing: 0.05em
  mono-data:
    fontFamily: Inter
    fontSize: 14px
    fontWeight: '500'
    lineHeight: 20px
rounded:
  sm: 0.125rem
  DEFAULT: 0.25rem
  md: 0.375rem
  lg: 0.5rem
  xl: 0.75rem
  full: 9999px
spacing:
  base: 8px
  xs: 4px
  sm: 12px
  md: 24px
  lg: 32px
  xl: 48px
  container-margin: 24px
  gutter: 16px
---

## Brand & Style
The design system is engineered for high-stakes, real-time civil engineering and emergency response. It evokes an atmosphere of "Mission Control"—authoritative, precise, and technically advanced. The primary objective is to manage cognitive load while maintaining a sense of urgency through high-contrast visual cues.

The aesthetic blends **Modern Corporate** structure with **Glassmorphism** and high-intensity accents. It prioritizes data density and scannability, ensuring that critical infrastructure failures are instantly distinguishable from routine flow monitoring. The interface feels like a digital twin of the city's subterranean life: dark, structured, and illuminated by glowing telemetry.

## Colors
The palette is rooted in a "Deep Space" dark mode to maximize the luminance of status indicators.

- **Background & Surface:** The core foundation uses a deep charcoal (#121212) for the base, with slightly elevated card surfaces at #1E1E1E.
- **Neon Blue (Flow):** Used for active telemetry, normal water movement, and system-healthy states.
- **Neon Orange (Warning):** Reserved for capacity thresholds, minor blockages, and predicted weather impacts.
- **Neon Red (Critical):** Used exclusively for flooding, overflows, and hardware failures. 
- **Functional Grays:** Borders use low-opacity white (8-12%) to create structure without visual noise.

## Typography
This design system utilizes **Inter** for its exceptional legibility in data-heavy environments. The hierarchy is strictly enforced to ensure that sensor readouts and status labels are never confused with navigational elements.

For technical data and sensor values, the system employs `tnum` (tabular numbers) to ensure columns of figures align perfectly in tables and dashboard widgets. Headlines are tight and bold to command attention, while labels use slightly increased letter spacing and uppercase styling to denote metadata and secondary status info.

## Layout & Spacing
The layout uses a **12-column fluid grid** for the main dashboard area, allowing widgets to reflow based on the operator's screen (from ultra-wide control room monitors to field tablets).

- **Grid:** 24px outer margins with 16px gutters between cards.
- **Density:** The system defaults to a high-density spacing model. Vertical rhythm is controlled by an 8px base unit.
- **Mobile/Tablet:** On smaller viewports, the grid collapses to 1-2 columns, and card padding reduces from 24px to 16px to maximize data visibility.
- **GIS Integration:** Map views should occupy the full background or a dedicated primary-span container (8-10 columns) to provide maximum spatial context.

## Elevation & Depth
Depth is created through a combination of **Tonal Layering** and **Glassmorphism**, rather than traditional heavy shadows which can feel muddy in dark interfaces.

1.  **Level 0 (Floor):** Deep charcoal (#121212) - the application canvas.
2.  **Level 1 (Cards/Widgets):** Surface (#1E1E1E) with a 1px stroke (rgba(255,255,255,0.08)).
3.  **Level 2 (Overlays/Popovers):** Semi-transparent glass (rgba(30, 30, 30, 0.8)) with a 20px backdrop blur and a more prominent white inner border.
4.  **Critical Alerts:** Elements in a danger state use a subtle outer glow (0px 0px 12px) utilizing the Neon Red or Neon Orange accent colors at 30% opacity to "lift" the alert off the screen.

## Shapes
The shape language is **Soft (0.25rem / 4px)**. This maintains a professional, industrial-efficiency feel while softening the "harshness" of the dark, technical interface.

- **Input Fields & Buttons:** 4px radius.
- **Dashboard Cards:** 8px (rounded-lg) to provide clear container separation.
- **Status Pills:** Fully rounded (pill-shaped) to distinguish them from actionable buttons and static labels.

## Components
- **Actionable Buttons:** Primary buttons use a solid Neon Blue fill with black text for maximum contrast. Secondary actions use outlined styles with 1px borders.
- **Status Badges:** These include a 6px "glowing" dot indicator next to the text. For critical alerts, the entire badge background should pulse subtly.
- **Data Tables:** High-density rows (32px-40px height). Header rows are sticky with a distinct background-tint and bottom border. Use subtle horizontal dividers only; no vertical borders.
- **Input Fields:** Darker than the card surface (#161616) with an "active" state indicated by a 1px Neon Blue border and glow.
- **GIS Map Markers:** Minimalist vector icons with high-contrast halos. Flow direction is indicated by animated dashed lines using the Neon Blue accent.
- **Interactive Gauges:** Use circular or linear progress bars to show capacity. The bar color should dynamically transition from Blue to Orange to Red based on the real-time sensor value.