import React, { useEffect, useState } from 'react';
import { LaudaLogo } from './LaudaLogo';

interface SplashViewProps {
  onComplete: () => void;
  reducedMotion: boolean;
}

export const SplashView: React.FC<SplashViewProps> = ({ onComplete, reducedMotion }) => {
  const [entered, setEntered] = useState(false);

  useEffect(() => {
    const frame = requestAnimationFrame(() => setEntered(true));
    const timer = setTimeout(() => {
      onComplete();
    }, reducedMotion ? 220 : 580);
    return () => {
      cancelAnimationFrame(frame);
      clearTimeout(timer);
    };
  }, [onComplete, reducedMotion]);

  return (
    <div
      className="min-h-screen w-full flex flex-col items-center justify-center px-6"
      style={{ backgroundColor: 'var(--m3-surface)', color: 'var(--m3-on-surface)' }}
    >
      <div
        className="flex flex-col items-center gap-5 transition-all duration-500 m3-ease"
        style={{
          opacity: entered ? 1 : 0,
          transform: entered ? 'scale(1)' : 'scale(0.90)',
        }}
      >
        <LaudaLogo size={64} />
        <div className="text-center space-y-1.5">
          <h1 className="font-display text-2xl font-bold tracking-tight">LAUDA Admin</h1>
          <p
            className="text-sm"
            style={{ color: 'var(--m3-on-surface-variant)' }}
          >
            GitHub Configuration Administration
          </p>
        </div>
        <div
          className="w-40 h-1 rounded-full overflow-hidden mt-2"
          style={{ backgroundColor: 'var(--m3-surface-container-high)' }}
        >
          <div
            className="h-full rounded-full transition-all duration-500 m3-ease"
            style={{
              width: entered ? '100%' : '18%',
              backgroundColor: 'var(--m3-primary)',
            }}
          />
        </div>
      </div>
    </div>
  );
};
