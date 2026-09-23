---
version: alpha
name: Project Workbench
description: A bright, rearrangeable workspace for personal projects.
colors:
  primary: "#3689ff"
  ink: "#0b1730"
  secondary-ink: "#405678"
  canvas: "#f5f9ff"
  surface: "#ffffff"
  status-active: "#18b95b"
  status-paused: "#ff9138"
  status-planned: "#f2c914"
  status-completed: "#8368e8"
  error: "#ef4b4b"
typography:
  project-title:
    fontFamily: "-apple-system, BlinkMacSystemFont, \"SF Pro Display\", \"SF Pro Text\", \"Helvetica Neue\", Arial, sans-serif"
    fontSize: 28px
    fontWeight: 700
    lineHeight: 1.15
  description:
    fontFamily: "-apple-system, BlinkMacSystemFont, \"SF Pro Display\", \"SF Pro Text\", \"Helvetica Neue\", Arial, sans-serif"
    fontSize: 17px
    fontWeight: 400
    lineHeight: 1.42
spacing:
  compact: 8px
  control: 16px
  card: 28px
  card-wide: 46px
rounded:
  card: 22px
  toolbar: 999px
---

## Overview

Think of a well-lit drafting table holding movable project sheets. The cool blue canvas recedes; the white cards carry the work; a small floating toolbar identifies the page and reports whether edits are saved. Project titles, descriptions, and status should be understandable at a glance and editable in place. The character comes from the arrangement of real project content, crisp type, narrow status marks, and responsive movement. Build a personal web workspace rather than an imitation of a desktop operating system.

## Colors

Use {colors.ink} for primary text, {colors.secondary-ink} for supporting text, and {colors.canvas} behind bright {colors.surface} cards. Use {colors.primary} for focus, active interaction, and saving feedback. Mark active, paused, planned, and completed projects with their corresponding status colors; reserve {colors.error} for failed actions. Pair every colored status mark with a text label, which carries the meaning when color is unavailable. Keep large content surfaces neutral so the projects remain the focus.

## Typography

Use the existing system sans-serif stack. The title and description tokens give representative sizes; adapt them fluidly to the available card width, as the current CSS does. Keep status and save labels smaller but plainly legible. Let size, weight, and spacing establish hierarchy before adding another font, icon, or color.

## Layout

On wide screens, use an intentionally asymmetric arrangement of movable cards; on tablet widths, retain a balanced grid; on narrow screens, stack cards in a clear reading order. Use the compact and control spacing tokens for nearby elements; let card padding vary from {spacing.card} to {spacing.card-wide} as room allows. Keep generous space around the grid while giving each card enough room for its real title and description. The toolbar should orient the user without competing with the projects. Preserve usable editing and drag targets across mouse, keyboard, and touch.

## Elevation & Depth

Make project cards feel like solid sheets slightly above the canvas, with soft shadows and a restrained hint of status color at one edge. Reserve translucency and blur for the toolbar or brief overlays. Background light and motion may add depth, but text and controls must remain clear over them.

## Shapes

Use softly rounded cards ({rounded.card}) and a pill-shaped toolbar ({rounded.toolbar}). Keep smaller controls shaped for their function instead of repeating the large card radius everywhere. Rounded forms should support the movable-sheet metaphor, not become decoration on every element.

## Components

- **Project card:** Put the title and description first; keep status and move/resize actions close to the card they affect. Editing should feel like working directly on the sheet.
- **Status mark:** Pair a colored edge or dot with a readable status name. Use color as a quick cue, not as the sole explanation.
- **Save feedback:** Show saved, saving, unsaved, and failed states in the toolbar with short text. Make failure unmistakable and keep feedback near the work.
- **Motion:** Use short transitions to explain hover, focus, drag, resize, and save changes. Respect reduced-motion preferences; avoid animation that delays editing.

## Do's and Don'ts

- Do let real projects provide the visual variety and keep the canvas calm.
- Do make important controls discoverable on touch as well as on hover or focus.
- Do preserve clear focus indication and readable text on every surface.
- Don't spread glass, glow, or colored shadows across every component.
- Don't copy macOS window controls or use an unrelated design system's branding as the product identity.
- Don't add decorative illustrations, badges, or motion that distract from reading and editing projects.
