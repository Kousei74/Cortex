import React from 'react';

/**
 * CortexLoader
 * Pulsing orb — shown full-screen while analysis is in-flight.
 * No deps beyond React. Pure CSS @keyframes injected via <style>.
 */
export function CortexLoader({ status }) {
    const isError = status === 'FAILED' || status === 'TIMEOUT';

    return (
        <>
            <style>{`
                @keyframes cortex-pulse {
                    0% {
                        transform: scale(1);
                        box-shadow: 0 0 80px 16px rgba(0, 55, 71, 0.9);
                    }
                    100% {
                        transform: scale(1.45);
                        box-shadow: 0 0 120px 24px rgba(0, 0, 0, 0.6);
                    }
                }

                @keyframes cortex-pulse-error {
                    0% {
                        transform: scale(1);
                        box-shadow: 0 0 80px 16px rgba(80, 10, 10, 0.9);
                    }
                    100% {
                        transform: scale(1.45);
                        box-shadow: 0 0 120px 24px rgba(0, 0, 0, 0.6);
                    }
                }

                .cortex-orb {
                    width: 48px;
                    height: 48px;
                    border-radius: 100%;
                    background-color: ${isError ? '#ff3b30' : '#00bfff'};
                    display: grid;
                    place-items: center;
                    animation: ${isError ? 'cortex-pulse-error' : 'cortex-pulse'} 1.6s infinite alternate-reverse ease-in-out;
                }

                .cortex-orb-inner {
                    background-color: #1a1c20;
                    width: 80%;
                    height: 80%;
                    border-radius: 100%;
                }
            `}</style>

            <div className="cortex-orb">
                <div className="cortex-orb-inner" />
            </div>
        </>
    );
}
