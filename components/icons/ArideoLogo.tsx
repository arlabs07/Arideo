import React from 'react';

export const ArideoLogo: React.FC<React.SVGProps<SVGSVGElement>> = (props) => (
  <svg viewBox="0 0 140 40" fill="none" xmlns="http://www.w3.org/2000/svg" {...props}>
    <g clipPath="url(#clip0_101_2)">
      <path d="M23.1111 33H16.1111L9.11111 33H2.11111L14.3333 12.8L15.3333 11L15.4444 10.7H17.1111L29.7778 33H23.1111Z" fill="url(#paint0_linear_101_2)"/>
      <text x="38" y="30" fontFamily="Inter, sans-serif" fontSize="28" fontWeight="bold" fill="url(#paint1_linear_101_2)">
        Arideo
      </text>
    </g>
    <defs>
      <linearGradient id="paint0_linear_101_2" x1="15.9444" y1="10.7" x2="15.9444" y2="33" gradientUnits="userSpaceOnUse">
        <stop stopColor="#A855F7"/>
        <stop offset="1" stopColor="#6366F1"/>
      </linearGradient>
      <linearGradient id="paint1_linear_101_2" x1="88" y1="2" x2="88" y2="33" gradientUnits="userSpaceOnUse">
        <stop stopColor="#A855F7"/>
        <stop offset="1" stopColor="#6366F1"/>
      </linearGradient>
      <clipPath id="clip0_101_2">
        <rect width="140" height="40" fill="white"/>
      </clipPath>
    </defs>
  </svg>
);