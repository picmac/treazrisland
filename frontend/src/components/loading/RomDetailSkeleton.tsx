import React from 'react';
import { SkeletonBlock } from './SkeletonBlock';
import { SkeletonStack } from './SkeletonStack';
import styles from './RomDetailSkeleton.module.css';

export function RomDetailSkeleton() {
  return (
    <div className={styles.layout} aria-busy="true" aria-label="Loading ROM details">
      <div className={styles.media}>
        <SkeletonBlock width="100%" height={320} />
      </div>
      <div className={styles.content}>
        <SkeletonStack gap={16}>
          <SkeletonBlock width="35%" height={18} />
          <SkeletonBlock width="60%" height={32} />
          <SkeletonBlock width="45%" height={18} />
          <SkeletonStack gap={10}>
            <SkeletonBlock width="90%" height={14} />
            <SkeletonBlock width="80%" height={14} />
            <SkeletonBlock width="75%" height={14} />
          </SkeletonStack>
          <SkeletonStack direction="horizontal" gap={12}>
            <SkeletonBlock width={140} height={44} />
            <SkeletonBlock width={120} height={44} />
          </SkeletonStack>
        </SkeletonStack>
      </div>
    </div>
  );
}
