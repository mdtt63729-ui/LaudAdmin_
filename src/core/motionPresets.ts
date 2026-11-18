import type { Transition } from 'motion/react';

export const M3_EXPRESSIVE_SPRING: Transition = {
  type: 'spring',
  stiffness: 420,
  damping: 24,
  mass: 0.85,
};

export const M3_CHIP_SPRING: Transition = {
  type: 'spring',
  stiffness: 480,
  damping: 26,
  mass: 0.78,
};

export const M3_SHEET_SPRING: Transition = {
  type: 'spring',
  stiffness: 360,
  damping: 26,
  mass: 0.9,
};

export const NO_MOTION_TRANSITION: Transition = {
  duration: 0.01,
};

export function getSpring(reducedMotion: boolean, preset: Transition = M3_EXPRESSIVE_SPRING): Transition {
  return reducedMotion ? NO_MOTION_TRANSITION : preset;
}
