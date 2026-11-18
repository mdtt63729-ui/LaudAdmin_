import React from 'react';

interface LaudaLogoProps {
  size?: number;
  className?: string;
}

export const LaudaLogo: React.FC<LaudaLogoProps> = ({ size = 36, className = '' }) => {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 48 48"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
      aria-hidden="true"
    >
      <rect
        x="3"
        y="3"
        width="42"
        height="42"
        rx="12"
        fill="var(--m3-primary-container)"
        stroke="var(--m3-primary)"
        strokeWidth="2"
      />
      <path
        d="M16 15V31H28"
        stroke="var(--m3-primary)"
        strokeWidth="3.2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <circle cx="31" cy="18" r="3.5" fill="var(--m3-primary)" />
      <path
        d="M28 24H33"
        stroke="var(--m3-on-primary-container)"
        strokeWidth="2.6"
        strokeLinecap="round"
      />
    </svg>
  );
};
