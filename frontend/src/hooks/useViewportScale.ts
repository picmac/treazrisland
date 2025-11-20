import { useEffect } from 'react';

type ViewportScaleOptions = {
  baseWidth?: number;
  baseHeight?: number;
  enabled?: boolean;
};

/**
 * Watches the emulator container size and applies a CSS scale transform
 * similar to ROMM's responsive emulator viewport strategy.
 */
export function useViewportScale(
  targetRef: React.RefObject<HTMLElement | null>,
  options: ViewportScaleOptions = {},
) {
  const { baseWidth = 960, baseHeight = 720, enabled = true } = options;

  useEffect(() => {
    const target = targetRef.current;

    if (!enabled || !target) {
      if (target) {
        target.style.removeProperty('--emulator-scale');
      }
      return;
    }

    const host = target.parentElement ?? target;

    const updateScale = () => {
      const parentRect = host.getBoundingClientRect();
      const availableWidth = parentRect.width || baseWidth;
      const availableHeight = parentRect.height || window.innerHeight || baseHeight;
      const widthScale = availableWidth / baseWidth;
      const heightScale = availableHeight / baseHeight;
      const nextScale = Math.max(Math.min(widthScale, heightScale), 0.1);

      target.style.setProperty('--emulator-base-width', `${baseWidth}px`);
      target.style.setProperty('--emulator-base-height', `${baseHeight}px`);
      target.style.setProperty('--emulator-scale', nextScale.toString());
    };

    updateScale();

    const resizeObserver = new ResizeObserver(() => updateScale());
    resizeObserver.observe(host);

    window.addEventListener('resize', updateScale);
    window.addEventListener('orientationchange', updateScale);

    return () => {
      resizeObserver.disconnect();
      window.removeEventListener('resize', updateScale);
      window.removeEventListener('orientationchange', updateScale);
    };
  }, [targetRef, baseWidth, baseHeight, enabled]);
}
