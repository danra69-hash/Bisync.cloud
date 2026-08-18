# Pulse design system

Locked for all Pulse surfaces. Do not improvise mid-render.

## Context

- Audience: fitness center staff (Management, Admin, Accounting, Fitness Coach, Sales)
- Use case: operate membership CRM, trainer bookings, equipment & training
- Tone: utilitarian athletic / instrument-panel
- Genre: modern-minimal
- Theme: Cobalt
- Macrostructure (marketing/login): Workbench
- Nav: bordered full-width bar (Cobalt signature)
- Footer: Ft2 inline rule (login only)

## Tokens

```css
--color-paper: oklch(98.5% 0.004 250);
--color-ink: oklch(24% 0.02 258);
--color-ink-2: oklch(34% 0.018 257);
--color-muted: oklch(55% 0.02 257);
--color-rule: oklch(90% 0.01 250);
--color-accent: oklch(58% 0.20 256);
--color-graphite: oklch(22% 0.016 260);
--color-ok: oklch(62% 0.14 155);
--color-warn: oklch(70% 0.14 75);
--color-danger: oklch(55% 0.18 25);
--radius-control: 6px;
--radius-panel: 10px;
--font-display: "Space Grotesk", sans-serif;
--font-body: "Space Grotesk", sans-serif;
--font-mono: "JetBrains Mono", monospace;
```

## Rules

- No Inter / Roboto / Arial / system-ui as primary.
- No purple gradients, cream+terracotta, newspaper mastheads.
- No card-for-decoration; bordered panels only when they group interaction.
- Accent < 5% of viewport; hairlines carry structure.
- Headings roman only (no italic display).
