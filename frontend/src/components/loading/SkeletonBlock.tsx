import React from 'react';
import styles from './Skeleton.module.css';

interface SkeletonBlockProps {
  width?: number | string;
  height?: number | string;
  className?: string;
  rounded?: boolean;
}

export function SkeletonBlock({ width, height, className, rounded = true }: SkeletonBlockProps) {
  const style: React.CSSProperties = {
    width,
    height,
    borderRadius: rounded ? undefined : 0,
  };

  const classNames = [styles.skeleton, className].filter(Boolean).join(' ');

  return <span className={classNames} style={style} aria-hidden="true" />;
}
