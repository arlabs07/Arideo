import React from 'react';

export const VeoIcon: React.FC<React.SVGProps<SVGSVGElement>> = (props) => (
    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" {...props}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M6.5 21L12 17.5L17.5 21" />
        <path strokeLinecap="round" strokeLinejoin="round" d="M3 3h18v11a2 2 0 0 1 -2 2h-14a2 2 0 0 1 -2 -2v-11z" />
        <path strokeLinecap="round" strokeLinejoin="round" d="M12 7l-2 4h4l-2 4" />
    </svg>
);