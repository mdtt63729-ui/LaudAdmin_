import React, { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { M3_EXPRESSIVE_SPRING, getSpring } from '../../core/motionPresets';

/**
 * Material 3 Expressive ContainedLoadingIndicator shapes (48x48 viewBox).
 * Cycles smoothly through organic scalloped/clover/rounded-polygon silhouettes
 * inside a circular primaryContainer surface, matching M3 Expressive specs.
 */
const M3_SHAPES = [
  // 1. Soft 8-lobe flower / starburst
  'M24 8 C27.2 8 28.4 11.4 31.1 12.6 C33.8 13.8 37.1 11.9 39.2 14.1 C41.3 16.3 39.4 19.6 40.5 22.3 C41.6 25 45 26.2 45 29.4 C45 32.6 41.6 33.8 40.5 36.5 C39.4 39.2 41.3 42.5 39.2 44.7 C37.1 46.9 33.8 45 31.1 46.1 C28.4 47.2 27.2 50.6 24 50.6 C20.8 50.6 19.6 47.2 16.9 46.1 C14.2 45 10.9 46.9 8.8 44.7 C6.7 42.5 8.6 39.2 7.5 36.5 C6.4 33.8 3 32.6 3 29.4 C3 26.2 6.4 25 7.5 22.3 C8.6 19.6 6.7 16.3 8.8 14.1 C10.9 11.9 14.2 13.8 16.9 12.6 C19.6 11.4 20.8 8 24 8 Z',
  // 2. 4-leaf rounded clover
  'M24 9 C30 9 32.5 14 35 16.5 C37.5 19 42.5 21.5 42.5 27.5 C42.5 33.5 37.5 36 35 38.5 C32.5 41 30 46 24 46 C18 46 15.5 41 13 38.5 C10.5 36 5.5 33.5 5.5 27.5 C5.5 21.5 10.5 19 13 16.5 C15.5 14 18 9 24 9 Z',
  // 3. Rounded squircle / pill-diamond
  'M24 10 C32.5 10 38 15.5 38 24 C38 32.5 32.5 38 24 38 C15.5 38 10 32.5 10 24 C10 15.5 15.5 10 24 10 Z',
  // 4. Scalloped 6-petal blossom
  'M24 9.5 C27.8 9.5 30.2 12.8 33.5 14.7 C36.8 16.6 40.5 17.2 42 20.6 C43.5 24 41.2 27.5 41.2 31.3 C41.2 35.1 43.5 38.6 42 42 C40.5 45.4 36.8 46 33.5 47.9 C30.2 49.8 27.8 53.1 24 53.1 C20.2 53.1 17.8 49.8 14.5 47.9 C11.2 46 7.5 45.4 6 42 C4.5 38.6 6.8 35.1 6.8 31.3 C6.8 27.5 4.5 24 6 20.6 C7.5 17.2 11.2 16.6 14.5 14.7 C17.8 12.8 20.2 9.5 24 9.5 Z',
];

// Normalized 48x48 centered M3 expressive polygon paths
const CENTERED_M3_PATHS = [
  // Rounded 4-lobe clover
  'M24 10C28.8 10 30.2 13.8 32.6 15.4C34.9 17 38 18.2 38 24C38 29.8 34.9 31 32.6 32.6C30.2 34.2 28.8 38 24 38C19.2 38 17.8 34.2 15.4 32.6C13.1 31 10 29.8 10 24C10 18.2 13.1 17 15.4 15.4C17.8 13.8 19.2 10 24 10Z',
  // Soft rounded octagon / burst
  'M24 9.5C27.4 9.5 28.9 12.4 31.6 13.6C34.3 14.8 37.5 13.9 39.2 16.5C40.9 19.1 38.7 21.8 38.7 24.8C38.7 27.8 40.9 30.5 39.2 33.1C37.5 35.7 34.3 34.8 31.6 36C28.9 37.2 27.4 40.1 24 40.1C20.6 40.1 19.1 37.2 16.4 36C13.7 34.8 10.5 35.7 8.8 33.1C7.1 30.5 9.3 27.8 9.3 24.8C9.3 21.8 7.1 19.1 8.8 16.5C10.5 13.9 13.7 14.8 16.4 13.6C19.1 12.4 20.6 9.5 24 9.5Z',
  // Organic rounded pill-triangle / soft shield
  'M24 10.5C31.5 10.5 37.5 15.8 37.5 23.5C37.5 31.2 32.2 37.5 24 37.5C15.8 37.5 10.5 31.2 10.5 23.5C10.5 15.8 16.5 10.5 24 10.5Z',
  // 5-petal rounded flower
  'M24 9.5C28.2 9.5 30.6 13.1 34.2 15.1C37.8 17.1 39.5 20.9 38.2 24.8C36.9 28.7 37.7 32.8 34.3 35.2C30.9 37.6 27.3 36.2 24 38.2C20.7 36.2 17.1 37.6 13.7 35.2C10.3 32.8 11.1 28.7 9.8 24.8C8.5 20.9 10.2 17.1 13.8 15.1C17.4 13.1 19.8 9.5 24 9.5Z',
];

void M3_SHAPES;

interface ContainedLoadingIndicatorProps {
  size?: number;
  reducedMotion?: boolean;
  label?: string;
}

export const ContainedLoadingIndicator: React.FC<ContainedLoadingIndicatorProps> = ({
  size = 56,
  reducedMotion = false,
  label = 'Loading',
}) => {
  const [shapeIdx, setShapeIdx] = useState(0);

  useEffect(() => {
    if (reducedMotion) return;
    const interval = setInterval(() => {
      setShapeIdx((prev) => (prev + 1) % CENTERED_M3_PATHS.length);
    }, 620);
    return () => clearInterval(interval);
  }, [reducedMotion]);

  return (
    <div
      role="progressbar"
      aria-label={label}
      className="relative inline-flex items-center justify-center rounded-full shadow-sm select-none"
      style={{
        width: size,
        height: size,
        backgroundColor: 'var(--m3-primary-container)',
        color: 'var(--m3-on-primary-container)',
      }}
    >
      <motion.svg
        width={size * 0.72}
        height={size * 0.72}
        viewBox="0 0 48 48"
        fill="currentColor"
        animate={reducedMotion ? undefined : { rotate: 360 }}
        transition={
          reducedMotion
            ? undefined
            : {
                repeat: Infinity,
                duration: 2.6,
                ease: 'linear',
              }
        }
        style={{ willChange: 'transform' }}
      >
        <motion.path
          d={CENTERED_M3_PATHS[shapeIdx]}
          animate={{
            d: CENTERED_M3_PATHS[shapeIdx],
            scale: reducedMotion ? 1 : [0.92, 1.04, 0.96],
          }}
          transition={
            reducedMotion
              ? { duration: 0.01 }
              : {
                  d: { duration: 0.52, ease: [0.2, 0, 0, 1] },
                  scale: {
                    repeat: Infinity,
                    duration: 1.24,
                    ease: 'easeInOut',
                  },
                }
          }
          style={{ transformOrigin: '24px 24px' }}
        />
      </motion.svg>
    </div>
  );
};

interface FileOpeningOverlayProps {
  visible: boolean;
  fileName: string | null;
  reducedMotion: boolean;
}

export const FileOpeningOverlay: React.FC<FileOpeningOverlayProps> = ({
  visible,
  fileName,
  reducedMotion,
}) => {
  const enterSpring = getSpring(reducedMotion, M3_EXPRESSIVE_SPRING);

  return (
    <AnimatePresence>
      {visible && (
        <motion.div
          key="m3-file-loading-overlay"
          initial={reducedMotion ? { opacity: 1 } : { opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={reducedMotion ? { opacity: 0 } : { opacity: 0 }}
          transition={{ duration: reducedMotion ? 0.01 : 0.22, ease: [0.2, 0, 0, 1] }}
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 backdrop-blur-[3px] px-4"
          role="status"
          aria-live="polite"
        >
          <motion.div
            initial={
              reducedMotion
                ? false
                : { opacity: 0, scale: 0.82, y: 18 }
            }
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={
              reducedMotion
                ? { opacity: 0, transition: { duration: 0.01 } }
                : {
                    opacity: 0,
                    scale: 0.88,
                    y: -12,
                    transition: { duration: 0.2, ease: [0.4, 0, 1, 1] },
                  }
            }
            transition={enterSpring}
            className="px-7 py-6 rounded-3xl border shadow-2xl flex flex-col items-center gap-3.5 min-w-[230px] max-w-xs text-center"
            style={{
              backgroundColor: 'var(--m3-surface-container-low)',
              borderColor: 'var(--m3-outline)',
              color: 'var(--m3-on-surface)',
              willChange: 'transform, opacity',
            }}
          >
            <ContainedLoadingIndicator
              size={60}
              reducedMotion={reducedMotion}
              label={`Loading ${fileName || 'configuration'}`}
            />
            <div className="space-y-0.5 w-full">
              <p className="font-display text-sm font-semibold truncate">
                {fileName || 'Configuration'}
              </p>
              <p
                className="text-xs"
                style={{ color: 'var(--m3-on-surface-variant)' }}
              >
                Fetching latest snapshot...
              </p>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
};
