import React from 'react';
import styles from './Skeleton.module.css';

interface SkeletonStackProps {
  children: React.ReactNode;
  direction?: 'vertical' | 'horizontal';
  gap?: number;
  className?: string;
}

export function SkeletonStack({
  children,
  direction = 'vertical',
  gap = 12,
  className,
}: SkeletonStackProps) {
  const classNames = [styles.stack, className, direction === 'horizontal' ? styles.inline : '']
    .filter(Boolean)
    .join(' ');

  return (
    <div className={classNames} style={{ gap }} aria-hidden="true">
      {children}
    </div>
  );
}
