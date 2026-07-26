import React from 'react';

/**
 * AnchorContainer
 * Wraps the main visual in a semi-translucent flexbox, flush with sidebars.
 * Aesthetics: Glassmorphism, nominal border/padding, full width.
 */
export function AnchorContainer({ children }) {
    return (
        <div
            className="
                relative w-full 
                flex flex-col items-center justify-center
                p-6
                bg-surface-custom/30 backdrop-blur-md
                fluid-rounded-lg
                min-h-[300px]
            "
            style={{
                border: '1px solid rgba(0, 191, 255, 0.25)',
                boxShadow: 'inset 0 0 40px rgba(0, 191, 255, 0.05), inset 0 0 2px rgba(0, 191, 255, 0.15)',
            }}
        >
            <div className="w-full h-full flex-grow">
                {children}
            </div>
        </div>
    );
}
