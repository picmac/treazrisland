import Image from 'next/image';
import { PixellabNavigation } from '@/components/chrome';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { SignOutButton } from '@/components/ui/SignOutButton';
import { StatusPill } from '@/components/ui/StatusPill';
import { PIXELLAB_TOKENS } from '@/theme/tokens';
import styles from './page.module.css';

const docsUrl = 'https://github.com/treazrisland/treazrisland/blob/main/docs/ui/theme.md';
const navLinks = [
  { href: '/library', label: 'Library' },
  { href: '/onboarding', label: 'Onboarding' },
  { href: '/login', label: 'Crew login' },
  { href: '/admin/roms/upload', label: 'ROM upload' },
  { href: docsUrl, label: 'Docs' },
];

const readinessSignals = [
  {
    id: 'manifest',
    title: 'Theme manifest',
    status: 'Ready to ship',
    copy: 'Pixellab palette, typography, and assets live in /public/pixellab with hot-swap guidance.',
  },
  {
    id: 'grid',
    title: 'Navigation grid',
    status: 'Live',
    copy: 'Sticky chrome, skip links, and visible focus affordances stay WCAG AA-compliant.',
  },
  {
    id: 'emulator',
    title: 'Emulator shell',
    status: 'Playable',
    copy: 'Session prep overlays, save indicators, and touch controls reuse the shared design tokens.',
  },
];

const systemSignals = [
  {
    label: 'Health checks',
    detail: 'API · Redis · MinIO · EmulatorJS',
    tone: 'success' as const,
    aria: 'All services responding',
  },
  {
    label: 'First-play goal',
    detail: 'Upload → play within 60 minutes',
    tone: 'warning' as const,
    aria: 'Keep onboarding crisp',
  },
  {
    label: 'MVP guardrails',
    detail: 'Rate limits, input validation, structured errors',
    tone: 'info' as const,
    aria: 'Safety systems enabled',
  },
];

const touchpoints = [
  {
    id: 'docs',
    title: 'Theme documentation',
    copy: 'Request new Pixellab renders and wire them into the assets pipeline without visual drift.',
    href: docsUrl,
  },
  {
    id: 'onboarding',
    title: 'Crew onboarding',
    copy: 'Follow the guided checklist to verify health checks, admin profile, and emulator endpoint.',
    href: '/onboarding',
  },
  {
    id: 'playtest',
    title: 'Playtest cadence',
    copy: 'Trace the end-to-end dry run from invite to save-state, including EmulatorJS cues.',
    href: 'https://github.com/treazrisland/treazrisland/blob/main/docs/playtest-script.md',
  },
];

export default function HomePage() {
  return (
    <div className="page-shell">
      <PixellabNavigation
        links={navLinks}
        eyebrow="Treazr Ops Console"
        description="Retro mission control with accessible defaults and EmulatorJS-ready scaffolding."
        actions={<SignOutButton />}
        style={{
          background: 'rgba(6, 8, 22, 0.85)',
          borderBottom: '1px solid rgba(255, 255, 255, 0.08)',
        }}
      />

      <main className="page-content" id="main-content" tabIndex={-1}>
        <section className={styles.hero} aria-labelledby="hero-title">
          <div className={styles.heroHighlight}>
            <p className="eyebrow">Pixellab visual system</p>
            <h1 id="hero-title">Treazr Island mission control</h1>
            <p className="lede">
              Guided onboarding, a curated ROM library, and EmulatorJS overlays live in one place.
              Every flow below is wired to show status, recovery steps, and a clear next action.
            </p>
            <div className={styles.badgeRow} aria-label="System signals">
              {systemSignals.map((signal) => (
                <StatusPill key={signal.label} tone={signal.tone} aria-label={signal.aria}>
                  {signal.label}: {signal.detail}
                </StatusPill>
              ))}
            </div>
            <div className={styles.actionRow}>
              <Button href="/library" size="lg">
                Browse library
              </Button>
              <Button href="/onboarding" variant="secondary" size="lg">
                Complete onboarding
              </Button>
              <Button href="/login" variant="ghost">
                Resume session
              </Button>
            </div>
            <div className={styles.heroMeta}>
              <div className={styles.heroStat}>
                <strong>Visibility</strong>
                <span>Realtime health cards and inline status banners</span>
              </div>
              <div className={styles.heroStat}>
                <strong>Error recovery</strong>
                <span>Actionable alerts for uploads, invites, and favorites</span>
              </div>
            </div>
          </div>
          <div className={styles.heroMedia} aria-hidden="true">
            <Image src={PIXELLAB_TOKENS.assets.grid} alt="" width={960} height={540} priority />
          </div>
        </section>

        <section aria-labelledby="readiness-title">
          <div className="status-banner">
            <strong id="readiness-title">Readiness signals</strong>
            <span>
              Progress cards track the NN usability heuristics: status visibility, consistency,
              error prevention, and recovery steps.
            </span>
          </div>
          <div className={styles.grid} role="list">
            {readinessSignals.map((signal) => (
              <Card key={signal.id} title={signal.title} description={signal.copy} glow>
                <div className={styles.statContent}>
                  <StatusPill tone="info">{signal.status}</StatusPill>
                  <p className={styles.statLabel}>
                    {signal.id === 'manifest'
                      ? 'Swap assets without touching code.'
                      : signal.id === 'grid'
                        ? 'Keyboard-first navigation with focus rings.'
                        : 'Session prep mirrors the library chrome.'}
                  </p>
                </div>
              </Card>
            ))}
          </div>
        </section>

        <section aria-labelledby="touchpoints-title">
          <div className="status-banner">
            <strong id="touchpoints-title">Touchpoints</strong>
            <span>
              Jump to docs, onboarding, or playtest scripts without leaving mission control.
            </span>
          </div>
          <div className={styles.touchpoints}>
            {touchpoints.map((touchpoint) => {
              const isExternal = touchpoint.href.startsWith('http');
              return (
                <Card
                  as="article"
                  key={touchpoint.id}
                  title={touchpoint.title}
                  description={touchpoint.copy}
                >
                  <div className={styles.touchpointBody}>
                    <ul className={styles.list}>
                      <li>
                        Status: <StatusPill tone="info">Ready</StatusPill>
                      </li>
                      <li>Outcome: contextual hints + screenshots.</li>
                    </ul>
                    <Button
                      href={touchpoint.href}
                      variant="secondary"
                      target={isExternal ? '_blank' : undefined}
                      rel={isExternal ? 'noreferrer' : undefined}
                    >
                      Open
                    </Button>
                  </div>
                </Card>
              );
            })}
          </div>
        </section>
      </main>
    </div>
  );
}
