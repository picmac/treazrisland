---
title: Pixellab UI system
description: Storybook-style notes for Treazr Island chrome primitives
authors:
  - Design Systems Crew
status: draft
date: 2024-11-21
---

import { Tabs, Tab } from '@storybook/blocks';

# Pixellab chrome kit

The landing layout for Treazr Island now mirrors the **Pixellab.ai** drop we received in Week 07. The goal is to have
pixel-perfect parity between the static marketing splash and the EmulatorJS runtime so our ROM experiences feel like a
single product.

## Tokens & assets

```
File: frontend/src/theme/tokens.ts
Font: Press Start 2P (Next Font API)
Palette: #060014 / #12052b / #f7b733 / #b958f6 / #fefae0
Assets: frontend/public/pixellab/grid.svg, frontend/public/pixellab/wordmark.svg
```

The tokens file exports both the font instance (`pixellabFont`) and helper CSS variables so any component can hydrate the
same palette. Assets are checked into `frontend/public/pixellab/*` to mimic how Pixellab drops would land from the API.
Swapping those files updates the hero image and any other reference automatically.

## Canvas primitives

<Tabs>
  <Tab title="PixellabTexture">

**Path**: `frontend/src/components/chrome/PixellabTexture.tsx`

- Wraps the entire viewport in a noise + grid texture using the `PIXELLAB_TOKENS.effects` values.
- Establishes a column flex layout so headers, main content, and footers align without extra wrappers.

  </Tab>
  <Tab title="PixellabNavigation">

**Path**: `frontend/src/components/chrome/PixellabNavigation.tsx`

- Sticky banner with `<nav aria-label="Primary">` for accessibility.
- Eyebrow copy + description reuse token spacing/typography and surface the `/pixellab/wordmark.svg` slot.

  </Tab>
  <Tab title="PixellabGrid">

**Path**: `frontend/src/components/chrome/PixellabGrid.tsx`

- Responsive grid with `minmax` columns that collapse gracefully down to 260px.
- Accepts `aria-*` attributes so sections/cards render like Storybook stories while staying semantic.

  </Tab>
</Tabs>

## Layout example

`frontend/src/app/page.tsx` demonstrates how to combine the primitives:

1. `<PixellabTexture>` adds the neon background and contrast-aware text color.
2. `<PixellabNavigation>` pins the header and exposes the skip link target.
3. `<PixellabGrid>` renders readiness cards + touchpoints with consistent padding and borders.

The hero figure references `/pixellab/grid.svg`, while the footer copy reminds contributors to drop any new Pixellab
renders under `frontend/public/pixellab`. Update those assets or extend the token file when we get the API hooked up.
