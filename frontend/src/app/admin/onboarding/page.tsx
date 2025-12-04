import Link from 'next/link';
import ProgressSteps, { type ProgressStep } from '@/components/ProgressSteps';
import { Alert } from '@/components/ui/Alert';
import { Grid, Section, Stack } from '@/components/ui/layout';
import styles from './page.module.css';

const onboardingSteps: ProgressStep[] = [
  {
    title: 'Profile setup',
    description: 'Secure your display name, avatar, and timezone so future invites feel official.',
    status: 'current',
  },
  {
    title: 'Upload first ROM',
    description: 'Drop in a clean ROM build to unlock emulator previews and QA tools.',
    status: 'pending',
  },
  {
    title: 'Invite first players',
    description: 'Generate a private invite code once content is staged.',
    status: 'pending',
  },
];

const profileChecklist = [
  'Confirm your studio or admin display name — this labels every invite email and dashboard notification.',
  'Choose a timezone so maintenance windows and go-live countdowns display correctly for you.',
  'Add a short bio, pronouns, and a support contact channel to humanise moderation prompts.',
];

const romChecklist = [
  'Collect a legally cleared ROM (NES, SNES, or Genesis) and compress optional assets into a single zip.',
  'Fill in metadata: title, release year, publisher, ESRB guidance, and any controller quirks.',
  'Use the checksum preview to ensure the build matches your archival hash before hitting upload.',
];

const emulatorChecklist = [
  'Point to the live EmulatorJS embed.js URL so the player shell boots the right runtime.',
  'Confirm the backend can reach your embed URL before it saves to the environment store.',
  'Re-verify settings whenever infrastructure shifts between staging and production.',
];

export default function AdminOnboardingPage() {
  return (
    <Section className={styles.wrapper}>
      <Grid as="section" className={styles.heroCard} aria-labelledby="onboarding-title" gap="sm">
        <p className="eyebrow">Admin onboarding</p>
        <Stack gap="xs">
          <h1 id="onboarding-title">Boot up your command deck</h1>
          <p>
            You are the first steward of Treazr Island&apos;s retro vault. Follow the steps below to
            introduce yourself, upload a flagship ROM, and unlock invite tools for collaborators and
            early players.
          </p>
        </Stack>
      </Grid>

      <Section as="section" className={styles.progressCard} aria-labelledby="onboarding-progress">
        <p id="onboarding-progress" className={styles.progressHeading}>
          Progress tracker
        </p>
        <ProgressSteps steps={onboardingSteps} />
      </Section>

      <Grid as="section" className={styles.actionsGrid} aria-label="Guided onboarding tasks" gap="md">
        <article className={styles.actionCard} aria-labelledby="profile-setup-heading">
          <div className={styles.actionHeader}>
            <h2 id="profile-setup-heading">Profile setup</h2>
            <span>Introduce yourself to every invitee before they see a single ROM.</span>
          </div>
          <ul className={styles.checklist}>
            {profileChecklist.map((item) => (
              <li key={item}>{item}</li>
            ))}
          </ul>
          <Alert tone="info" dense className={styles.callout}>
            Pro tip: drag in a square PNG avatar (512px min) so invites match your studio style
            guide.
          </Alert>
          <Grid as="div" className={styles.ctaRow} gap="xs" columns={2}>
            <Link href="/settings/profile">Open profile editor</Link>
            <Link href="/docs" className={styles.secondaryAction}>
              Download brand kit template
            </Link>
          </Grid>
        </article>

        <article className={styles.actionCard} aria-labelledby="rom-upload-heading">
          <div className={styles.actionHeader}>
            <h2 id="rom-upload-heading">Upload your first ROM</h2>
            <span>Stage a hero build so EmulatorJS diagnostics can run.</span>
          </div>
          <ul className={styles.checklist}>
            {romChecklist.map((item) => (
              <li key={item}>{item}</li>
            ))}
          </ul>
          <Alert tone="warning" dense className={styles.callout}>
            EmulatorJS ingests .zip, .nes, .sfc, and .bin files up to 50 MB. We auto-scan for known
            header issues before publishing.
          </Alert>
          <Grid as="div" className={styles.ctaRow} gap="xs" columns={2}>
            <Link href="/admin/roms/upload">Launch ROM uploader</Link>
            <Link href="#rom-guide" className={styles.secondaryAction}>
              Read ROM prep guide
            </Link>
          </Grid>
        </article>

        <article className={styles.actionCard} aria-labelledby="emulator-config-heading">
          <div className={styles.actionHeader}>
            <h2 id="emulator-config-heading">Configure EmulatorJS</h2>
            <span>Wire the dashboard to the correct embed endpoint for your environment.</span>
          </div>
          <ul className={styles.checklist}>
            {emulatorChecklist.map((item) => (
              <li key={item}>{item}</li>
            ))}
          </ul>
          <Alert tone="success" dense className={styles.callout}>
            Keep this URL in sync with your deploys so admin diagnostics and player sessions stay
            aligned.
          </Alert>
          <Grid as="div" className={styles.ctaRow} gap="xs" columns={2}>
            <Link href="/admin/emulator-config">Open EmulatorJS settings</Link>
            <Link href="/onboarding#emulator-config" className={styles.secondaryAction}>
              View setup checklist
            </Link>
          </Grid>
        </article>
      </Grid>
    </Section>
  );
}
