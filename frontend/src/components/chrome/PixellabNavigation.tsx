import type { Route } from '@/types/route';
import Image from 'next/image';
import Link from 'next/link';
import type { HTMLAttributes, ReactNode } from 'react';
import styles from './PixellabNavigation.module.css';

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
  ...rest
}: PixellabNavigationProps) {
  return (
    <header role="banner" className={styles.shell} {...rest}>
      <nav aria-label="Primary" className={styles.nav}>
        <div className={styles.brand}>
          <p className={styles.eyebrow}>{eyebrow}</p>
          <div className={styles.brandMeta}>
            <Link href="/" aria-label="Treazr Island home" className={styles.wordmark}>
              <Image
                src="/pixellab/wordmark.svg"
                alt="Treazr Island wordmark"
                width={200}
                height={60}
                className={styles.wordmarkImage}
              />
            </Link>
            <p className={styles.description}>{description}</p>
          </div>
        </div>
        <div className={styles.actions}>
          <ul className={styles.links}>
            {links.map((link) => {
              const isExternal = typeof link.href === 'string' && link.href.startsWith('http');
              const target = isExternal ? '_blank' : undefined;
              const rel = isExternal ? 'noreferrer' : undefined;

              return (
                <li key={link.href}>
                  {isExternal ? (
                    <a href={link.href} className={styles.link} target={target} rel={rel}>
                      {link.label}
                    </a>
                  ) : (
                    <Link
                      href={link.href as Route}
                      className={styles.link}
                      target={target}
                      rel={rel}
                    >
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
