---
name: Terminal Protocol
colors:
  surface: '#121415'
  surface-dim: '#121415'
  surface-bright: '#38393a'
  surface-container-lowest: '#0c0e0f'
  surface-container-low: '#1a1c1d'
  surface-container: '#1e2021'
  surface-container-high: '#282a2b'
  surface-container-highest: '#333536'
  on-surface: '#e2e2e3'
  on-surface-variant: '#baccaf'
  inverse-surface: '#e2e2e3'
  inverse-on-surface: '#2f3132'
  outline: '#85967c'
  outline-variant: '#3b4b35'
  surface-tint: '#25e500'
  primary: '#edffe0'
  on-primary: '#043900'
  primary-container: '#2aff00'
  on-primary-container: '#0e7100'
  inverse-primary: '#0d6e00'
  secondary: '#ffdb9d'
  on-secondary: '#412d00'
  secondary-container: '#feb700'
  on-secondary-container: '#6b4b00'
  tertiary: '#fff7f6'
  on-tertiary: '#680008'
  tertiary-container: '#ffd2ce'
  on-tertiary-container: '#c3051b'
  error: '#ffb4ab'
  on-error: '#690005'
  error-container: '#93000a'
  on-error-container: '#ffdad6'
  primary-fixed: '#78ff5c'
  primary-fixed-dim: '#25e500'
  on-primary-fixed: '#012200'
  on-primary-fixed-variant: '#085300'
  secondary-fixed: '#ffdea8'
  secondary-fixed-dim: '#ffba20'
  on-secondary-fixed: '#271900'
  on-secondary-fixed-variant: '#5e4200'
  tertiary-fixed: '#ffdad6'
  tertiary-fixed-dim: '#ffb3ad'
  on-tertiary-fixed: '#410003'
  on-tertiary-fixed-variant: '#930010'
  background: '#121415'
  on-background: '#e2e2e3'
  surface-variant: '#333536'
typography:
  headline-xl:
    fontFamily: Space Grotesk
    fontSize: 48px
    fontWeight: '700'
    lineHeight: '1.1'
    letterSpacing: -0.02em
  headline-md:
    fontFamily: Space Grotesk
    fontSize: 24px
    fontWeight: '700'
    lineHeight: '1.2'
    letterSpacing: 0.05em
  body-lg:
    fontFamily: Inter
    fontSize: 18px
    fontWeight: '500'
    lineHeight: '1.5'
    letterSpacing: 0.01em
  body-sm:
    fontFamily: Inter
    fontSize: 14px
    fontWeight: '400'
    lineHeight: '1.4'
    letterSpacing: 0em
  label-bold:
    fontFamily: Space Grotesk
    fontSize: 12px
    fontWeight: '700'
    lineHeight: '1'
    letterSpacing: 0.15em
  data-num:
    fontFamily: Space Grotesk
    fontSize: 32px
    fontWeight: '700'
    lineHeight: '1'
    letterSpacing: 0.02em
spacing:
  unit: 4px
  gutter: 16px
  margin: 32px
  hud-safe-zone: 48px
---

## Brand & Style

This design system is engineered for high-stress, fast-paced combat environments where split-second information processing is the difference between survival and infection. The brand personality is aggressive, utilitarian, and oppressive, reflecting a world where resources are scarce and the environment is hostile.

The design style is a hybrid of **Brutalism** and **Tactile Industrialism**. It utilizes heavy strokes, raw angularity, and a "low-tech/high-spec" aesthetic. Elements should feel like they were machined from military-grade hardware, featuring subtle weathering effects and digital noise to ground the UI in a gritty, post-apocalyptic reality. The emotional response is one of urgency, tension, and tactical readiness.

## Colors

The palette is rooted in a deep, oppressive neutral base to ensure maximum contrast for critical gameplay data. 

- **Primary (Toxic Green):** Reserved exclusively for vital signs—health, stamina, and biological status. It must "glow" against the dark background.
- **Secondary (Amber):** Used for kinetic information—ammo counts, weapon heat, and mechanical warnings. 
- **Tertiary (Hazard Red):** Critical alerts, low-health states, and enemy detection.
- **Neutrals:** A range of desaturated, cold charcoals and gunmetal grays provide the structural scaffolding for the HUD.

Use scanlines and slight chromatic aberration on bright elements to simulate a degrading tactical visor.

## Typography

This design system utilizes **Space Grotesk** for all mission-critical data and headings due to its technical, geometric precision and high legibility at large scales. It provides the "tactical" feel required for a military HUD. 

**Inter** is used for secondary information and flavor text to maintain readability during chaotic movement. All labels should be set in uppercase with increased letter spacing to mimic industrial stenciling. Numeric data—such as ammo and health percentages—should always use the `data-num` style to ensure they are the most prominent elements on the screen.

## Layout & Spacing

The layout follows a **Fixed HUD Frame** model. Vital information is anchored to the corners of the screen to keep the center clear for top-down action. 

A 4px base unit governs all internal component spacing, while a 16px gutter separates distinct HUD modules. All primary UI elements must respect a 48px "Safe Zone" from the screen edge to prevent occlusion. Use asymmetrical layouts (e.g., health on the left, ammo on the right) to create a dynamic, "unbalanced" feel that mirrors the chaos of a zombie outbreak.

## Elevation & Depth

Depth is achieved through **Tonal Layering** and **Industrial Framing** rather than traditional shadows. 

1.  **Background Layer:** The deepest level, often semi-transparent dark charcoal (80% opacity) with a blurred backdrop to separate the UI from the game world.
2.  **Structural Layer:** Use 1px or 2px solid borders in mid-tone grays to define the boundaries of "modules."
3.  **Active Layer:** Elements that require interaction or immediate attention use high-contrast fills and neon inner glows (1-2px) to appear as if they are light-emitting diodes.

Avoid soft ambient shadows; use "hard" offsets (2px down/right) in solid black if additional separation is required.

## Shapes

The shape language is strictly **Sharp (0px roundedness)**. Every element should feature 45-degree clipped corners or "dog-eared" edges to reinforce the industrial, machined aesthetic. 

Rectangles should be interrupted by notches or structural cutouts. Progress bars (health/stamina) should be segmented into discrete blocks rather than a smooth continuous fill, suggesting a digital readout of a mechanical sensor.

## Components

- **Action Buttons:** Large, rectangular blocks with a "clipped" top-right corner. Default state uses a hollow border; active/hover state uses a solid Primary Green fill with black text.
- **Status Bars (Health/Stamina):** Thick, segmented bars. As health depletes, segments flicker and disappear. Low health triggers a rapid Red pulse on the entire module.
- **Tactical Chips:** Small, square icons for equipment (grenades, medkits) with a bold number badge in the corner. Icons must be minimalist, white-on-dark, with no gradients.
- **Ammo Counter:** Features a large numeric readout and a secondary "magazine" visualization using vertical tally marks.
- **Inventory Cards:** Heavy borders with a subtle "noise" texture. Selected items are highlighted with a high-contrast Neon Amber stroke..
- **Notification Toast:** Sharp, narrow banners that slide in from the right, featuring a "Caution" chevron pattern on the leading edge.