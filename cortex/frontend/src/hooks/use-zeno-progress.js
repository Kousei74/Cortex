
import { useState, useEffect, useRef } from 'react';

/**
 * useZenoProgress maps real progress to specific user-psychology-friendly progress.
 * 
 * Rules:
 * 1. Never stop moving completely (stalls = anxiety).
 * 2. Asymptote at 90% until strict 100% is received.
 * 3. 0% -> 10% happens quickly (Instant feedback).
 * 
 * @param {number} realProgress - 0 to 100
 * @param {string} status - 'staged', 'uploading', 'complete', 'error'
 */
export function useZenoProgress(realProgress, status) {
    const [visualProgress, setVisualProgress] = useState(0);
    const frameRef = useRef();

    useEffect(() => {
        if (status === 'staged') {
            setVisualProgress(0);
            return;
        }

        if (status === 'complete') {
            setVisualProgress(100);
            return;
        }

        if (status === 'error') {
            // Maybe stop? or keep it where it is?
            // Usually we stop or turn red. Logic handled by component color.
            return;
        }

        // Status is 'uploading'
        const animate = () => {
            setVisualProgress(current => {
                let target = realProgress;

                // Rule 2: Asymptote at 90% unless real is 100
                if (realProgress < 100) {
                    // Maximum allowed visual is 90%, OR realProgress + 10% (whichever is lower, but usually we prefer always being ahead)
                    // Actually, we want to be ahead of real progress if real is low.
                    // But limited to 90%.
                    const ceiling = 90;

                    // If real progress is stuck, we creep up to ceiling.
                    target = Math.min(Math.max(realProgress, current + 0.05), ceiling);
                }

                // Smooth approach (Lerp)
                // If we are far behind target, move fast. If close, move slow.
                const dist = target - current;

                // Base speed
                let step = dist * 0.05;

                // Rule 1: Minimum crawl speed (The "It's working" illusion)
                // If distance is positive but small, ensuring non-zero step
                if (dist > 0 && step < 0.02) step = 0.02;

                let next = current + step;

                // Clamp
                if (next > 100) next = 100;

                // Don't overshoot target if it's the ceiling
                if (target === 90 && next > 90) next = 90;

                return next;
            });

            frameRef.current = requestAnimationFrame(animate);
        };

        frameRef.current = requestAnimationFrame(animate);

        return () => cancelAnimationFrame(frameRef.current);
    }, [realProgress, status]);

    return visualProgress;
}
