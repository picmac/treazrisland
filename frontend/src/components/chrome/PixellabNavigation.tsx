import type { Route } from '@/types/route';
import Image from 'next/image';
import Link from 'next/link';
import type { HTMLAttributes, ReactNode } from 'react';
import { PIXELLAB_TOKENS } from '@/theme/tokens';

type NavLink = {
  href: Route | string;
  label: string;
};

type PixellabNavigationProps = {
  links: NavLink[];
  eyebrow?: string;
  description?: string;
  actions?: ReactNode;
} & HTMLAttributes<HTMLElement>;

export function PixellabNavigation({
  links,
  eyebrow = 'Pixellab drop 07',
  description = 'Retro operating frame rendered with Pixellab.ai tokens.',
  actions,
  style,
  ...rest
}: PixellabNavigationProps) {
  const { colors, spacing, layout } = PIXELLAB_TOKENS;

  return (
    <header
      role="banner"
      {...rest}
      style={{
        borderBottom: `1px solid ${colors.border.subtle}`,
        backdropFilter: `blur(${PIXELLAB_TOKENS.effects.panelBlur})`,
        backgroundColor: 'rgba(6, 0, 20, 0.7)',
        boxShadow: PIXELLAB_TOKENS.effects.panelShadow,
        position: 'sticky',
        top: 0,
        zIndex: 2,
        ...style,
      }}
    >
      <nav
        aria-label="Primary"
        style={{
          maxWidth: layout.contentMaxWidth,
          margin: '0 auto',
          padding: `${spacing.sm} ${layout.pagePadding}`,
          display: 'flex',
          alignItems: 'center',
          gap: spacing.md,
          minHeight: layout.navHeight,
        }}
      >
        <div style={{ flex: 1, minWidth: 0 }}>
          <p
            style={{
              textTransform: 'uppercase',
              letterSpacing: '0.35rem',
              color: colors.accent.secondary,
              fontSize: '0.6rem',
              margin: '0 0 0.35rem',
              whiteSpace: 'nowrap',
            }}
          >
            {eyebrow}
          </p>
          <div
            style={{
              display: 'flex',
              flexDirection: 'column',
              gap: spacing.xs,
            }}
          >
            <Link
              href="/"
              aria-label="Treazr Island home"
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: spacing.xs,
                color: colors.accent.primary,
                textDecoration: 'none',
                fontSize: '0.85rem',
              }}
            >
              <Image
                src={PIXELLAB_TOKENS.assets.wordmark}
                alt="Treazr Island wordmark"
                width={200}
                height={60}
                style={{
                  width: 'auto',
                  height: '2rem',
                  objectFit: 'contain',
                }}
              />
            </Link>
            <p
              style={{ margin: 0, color: colors.text.muted, fontSize: '0.65rem', maxWidth: '40ch' }}
            >
              {description}
            </p>
          </div>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: spacing.md }}>
          <ul
            style={{
              listStyle: 'none',
              margin: 0,
              padding: 0,
              display: 'flex',
              gap: spacing.md,
              flexWrap: 'wrap',
              justifyContent: 'flex-end',
            }}
          >
            {links.map((link) => {
              const isExternal = typeof link.href === 'string' && link.href.startsWith('http');
              const commonProps = {
                style: {
                  color: colors.text.primary,
                  textDecoration: 'none',
                  fontSize: '0.65rem',
                  letterSpacing: '0.15rem',
                  textTransform: 'uppercase',
                },
                target: isExternal ? '_blank' : undefined,
                rel: isExternal ? 'noreferrer' : undefined,
              } as const;

              return (
                <li key={link.href}>
                  {isExternal ? (
                    <a href={link.href} {...commonProps}>
                      {link.label}
                    </a>
                  ) : (
                    <Link href={link.href as Route} {...commonProps}>
                      {link.label}
                    </Link>
                  )}
                </li>
              );
            })}
          </ul>
          {actions ? <div>{actions}</div> : null}
        </div>
      </nav>
    </header>
  );
}
