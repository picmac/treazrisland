import type { Route } from '@/types/route';
import Image from 'next/image';
import Link from 'next/link';
import { PixellabGrid, PixellabNavigation, PixellabTexture } from '@/components/chrome';
import { PIXELLAB_TOKENS } from '@/theme/tokens';

const docsUrl = 'https://github.com/treazrisland/treazrisland/blob/main/docs/ui/theme.md';
const featuredRomRoute = '/roms/favorite-rom' as Route;

const navLinks = [
  { href: featuredRomRoute, label: 'ROM dossier' },
  { href: '/login', label: 'Crew login' },
  { href: docsUrl, label: 'Docs' },
];

const readinessSignals = [
  {
    id: 'manifest',
    title: 'Theme manifest',
    status: 'Ready',
    copy: 'Palette + typography delivered by Pixellab.ai. Assets mapped to /pixellab for quick swaps when drops arrive.',
  },
  {
    id: 'grid',
    title: 'Navigation grid',
    status: 'Live',
    copy: 'Sticky chrome, skip links, and focus rings ship with WCAG AA-compliant contrast.',
  },
  {
    id: 'emulator',
    title: 'Emulator view',
    status: 'Next',
    copy: 'Landing page exposes layout primitives so EmulatorJS scenes can inherit the same scaffolding.',
  },
];

const touchpoints = [
  {
    id: 'docs',
    title: 'Theme documentation',
    copy: 'MDX notes outline how to request new Pixellab renders and wire them into the public assets directory.',
    href: docsUrl,
  },
  {
    id: 'onboarding',
    title: 'Crew onboarding',
    copy: 'Step-by-step checklist for confirming health checks, creating admins, and wiring EmulatorJS.',
    href: '/onboarding',
  },
  {
    id: 'playtest',
    title: 'Playtest cadence',
    copy: 'Greyscale placeholders highlight the beats that still need EmulatorJS wiring + ROM metadata.',
    href: 'https://github.com/treazrisland/treazrisland/blob/main/docs/playtest-script.md',
  },
];

export default function HomePage() {
  const { colors, spacing, layout, effects, assets } = PIXELLAB_TOKENS;
  const panelStyle = {
    backgroundColor: colors.background.panel,
    border: `1px solid ${colors.border.subtle}`,
    borderRadius: '1.25rem',
    boxShadow: effects.panelShadow,
    backdropFilter: `blur(${effects.panelBlur})`,
  } as const;

  return (
    <PixellabTexture>
      <PixellabNavigation links={navLinks} />
      <main
        id="main-content"
        tabIndex={-1}
        style={{
          flex: 1,
          width: '100%',
          padding: spacing.xl,
          paddingInline: layout.pagePadding,
          margin: '0 auto',
          maxWidth: layout.contentMaxWidth,
          display: 'flex',
          flexDirection: 'column',
          gap: spacing.xl,
        }}
      >
        <section
          aria-labelledby="hero-title"
          style={{
            ...panelStyle,
            display: 'grid',
            gap: spacing.lg,
            padding: spacing.xl,
            gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))',
            alignItems: 'center',
          }}
        >
          <div>
            <p
              style={{
                textTransform: 'uppercase',
                letterSpacing: '0.35rem',
                color: colors.accent.secondary,
                fontSize: '0.65rem',
                margin: '0 0 0.75rem',
              }}
            >
              Pixellab visual pass
            </p>
            <h1 id="hero-title" style={{ margin: 0, fontSize: '1.5rem', lineHeight: 1.4 }}>
              Treazr Island boot screen
            </h1>
            <p style={{ marginTop: spacing.md, color: colors.text.muted, lineHeight: 1.8 }}>
              The hero grid, neon palette, and monospace type stack were recorded from the latest
              Pixellab.ai prompt pack. Every card below reuses those tokens to keep EmulatorJS
              overlays consistent with the marketing story.
            </p>
            <div
              style={{
                display: 'flex',
                flexWrap: 'wrap',
                gap: spacing.md,
                marginTop: spacing.lg,
              }}
            >
              <Link
                href={featuredRomRoute}
                style={{
                  background: `linear-gradient(120deg, ${colors.accent.primary}, ${colors.accent.secondary})`,
                  color: '#060014',
                  padding: '0.85rem 1.25rem',
                  borderRadius: '0.85rem',
                  textDecoration: 'none',
                  letterSpacing: '0.15rem',
                  textTransform: 'uppercase',
                  fontSize: '0.7rem',
                }}
              >
                Review ROM list
              </Link>
              <Link
                href={docsUrl}
                target="_blank"
                rel="noreferrer"
                style={{
                  border: `1px dashed ${colors.border.bold}`,
                  color: colors.text.primary,
                  padding: '0.85rem 1.25rem',
                  borderRadius: '0.85rem',
                  textDecoration: 'none',
                  letterSpacing: '0.15rem',
                  textTransform: 'uppercase',
                  fontSize: '0.7rem',
                }}
              >
                Theme MDX notes
              </Link>
            </div>
          </div>
          <figure
            style={{
              margin: 0,
              textAlign: 'center',
              padding: spacing.md,
              borderRadius: '1rem',
              background: 'rgba(6, 0, 20, 0.45)',
              border: `1px dashed ${colors.border.subtle}`,
            }}
          >
            <Image
              src={assets.grid}
              alt="Pixellab grid preview"
              width={480}
              height={320}
              style={{ width: '100%', height: 'auto', borderRadius: '0.75rem' }}
              priority
            />
            <figcaption
              style={{ marginTop: spacing.sm, color: colors.text.muted, fontSize: '0.7rem' }}
            >
              Stored under {assets.grid}. Replace with the next Pixellab export when it drops.
            </figcaption>
          </figure>
        </section>

        <section
          aria-labelledby="readiness-title"
          style={{ display: 'flex', flexDirection: 'column', gap: spacing.md }}
        >
          <div style={{ display: 'flex', flexDirection: 'column', gap: spacing.xs }}>
            <h2
              id="readiness-title"
              style={{ margin: 0, fontSize: '1rem', color: colors.accent.primary }}
            >
              Readiness signals
            </h2>
            <p style={{ margin: 0, color: colors.text.muted }}>
              Each tile stays within the same responsive grid component so the EmulatorJS canvas can
              drop in without brand drift.
            </p>
          </div>
          <PixellabGrid aria-describedby="readiness-title">
            {readinessSignals.map((signal) => (
              <article
                key={signal.id}
                style={{
                  ...panelStyle,
                  padding: spacing.lg,
                  borderTop: `3px solid ${colors.accent.secondary}`,
                }}
              >
                <div
                  style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'baseline',
                  }}
                >
                  <h3 style={{ margin: 0, fontSize: '0.95rem' }}>{signal.title}</h3>
                  <span
                    style={{
                      color: colors.accent.primary,
                      fontSize: '0.65rem',
                      letterSpacing: '0.15rem',
                    }}
                  >
                    {signal.status}
                  </span>
                </div>
                <p style={{ marginTop: spacing.sm, lineHeight: 1.6, color: colors.text.muted }}>
                  {signal.copy}
                </p>
              </article>
            ))}
          </PixellabGrid>
        </section>

        <section
          aria-labelledby="touchpoints-title"
          style={{ display: 'flex', flexDirection: 'column', gap: spacing.md }}
        >
          <h2
            id="touchpoints-title"
            style={{ margin: 0, fontSize: '1rem', color: colors.accent.primary }}
          >
            Pixellab touchpoints
          </h2>
          <PixellabGrid as="div" minColumnWidth="320px">
            {touchpoints.map((touchpoint) => (
              <article key={touchpoint.id} style={{ ...panelStyle, padding: spacing.lg }}>
                <h3 style={{ marginTop: 0, marginBottom: spacing.sm }}>{touchpoint.title}</h3>
                <p style={{ margin: 0, color: colors.text.muted, lineHeight: 1.6 }}>
                  {touchpoint.copy}
                </p>
                <a
                  href={touchpoint.href}
                  target={touchpoint.href.startsWith('http') ? '_blank' : undefined}
                  rel={touchpoint.href.startsWith('http') ? 'noreferrer' : undefined}
                  style={{
                    marginTop: spacing.md,
                    display: 'inline-block',
                    color: colors.accent.primary,
                    textDecoration: 'none',
                    letterSpacing: '0.15rem',
                    fontSize: '0.65rem',
                  }}
                >
                  Open
                </a>
              </article>
            ))}
          </PixellabGrid>
        </section>
      </main>
      <footer
        role="contentinfo"
        style={{
          borderTop: `1px solid ${colors.border.subtle}`,
          padding: `${spacing.md} ${layout.pagePadding} ${spacing.lg}`,
          color: colors.text.muted,
          fontSize: '0.7rem',
          textAlign: 'center',
        }}
      >
        Pixellab assets live in{' '}
        <code style={{ color: colors.accent.primary }}>/frontend/public/pixellab</code>. Swap files
        there and the layout updates instantly.
      </footer>
    </PixellabTexture>
  );
}
