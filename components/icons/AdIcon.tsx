import React from 'react';

export const AdIcon: React.FC<React.SVGProps<SVGSVGElement>> = (props) => (
    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" {...props}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M7.5 8.25h9m-9 3H12m2.25 1.5-2.25 2.25-2.25-2.25M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
        <path d="M10 15v.01M14 15v.01" />
    </svg>
);
