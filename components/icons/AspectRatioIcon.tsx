import React from 'react';

export const AspectRatioIcon: React.FC<React.SVGProps<SVGSVGElement>> = (props) => (
    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" {...props}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M3 3h18v18H3z" />
        <path strokeLinecap="round" strokeLinejoin="round" d="M3 12h18" />
        <path strokeLinecap="round" strokeLinejoin="round" d="M12 3v18" />
        <path strokeLinecap="round" strokeLinejoin="round" d="M6 18l-3 -3" />
        <path strokeLinecap="round" strokeLinejoin="round" d="M18 6l3 -3" />
        <path strokeLinecap="round" strokeLinejoin="round" d="M6 6l-3 3" />
        <path strokeLinecap="round" strokeLinejoin="round" d="M18 18l3 3" />
    </svg>
);