import { motion } from "framer-motion";
import { cn } from "@/lib/utils";

/**
 * ZenoProgress Component
 * 
 * Rules:
 * - PROCESSING: Animate 0% -> 90% asymptotically.
 * - COMPLETED: Snap to 100% immediately.
 * - FAILED: Freeze and turn Red.
 * - UNSUPPORTED_DATASET: Do not render.
 */
export function ZenoProgress({ status, progress, className }) {
    // 4. Do not render if UNSUPPORTED (or IDLE/PENDING if desired, but PENDING usually shows 0%)
    // "UNSUPPORTED_DATASET" is a layout_strategy inside payload, not a status.
    // But caller might pass derived status? No, status passed is 'PENDING', 'PROCESSING', 'COMPLETED', 'FAILED'.
    // Caller handles hiding/showing based on `isUnsupported`.
    // If status is COMPLETED and we are here, we show 100%. 

    if (status === 'IDLE') return null;

    // Determine Target Width
    let targetWidth = 0;
    let transition = {};

    if (status === 'PROCESSING' || status === 'PENDING') {
        // 1. Asymptotic to 90%
        targetWidth = 90;
        // Slow, asymptotic transition
        transition = {
            duration: 10,
            ease: [0.2, 0, 0, 1] // Custom cubic bezier for "Zeno" feel (fast start, infinite tail)
        };
    } else if (status === 'COMPLETED') {
        // 2. Snap to 100%
        targetWidth = 100;
        transition = { duration: 0.3, ease: "easeOut" };
    } else if (status === 'FAILED' || status === 'TIMEOUT') {
        // 3. Freeze (Keep current width? Or jump to error state?)
        // Usually invalidating the progress bar or turning it red at current width is good.
        // Framer motion will keep current visual state if we stop updating target? 
        // Or we can just set it to current progress (which comes from backend).
        // Backend progress clamps at 99.
        targetWidth = progress || 10; // Minimum visibility
        transition = { duration: 0 };
    }

    const isError = status === 'FAILED' || status === 'TIMEOUT';

    return (
        <div className={cn("w-full h-2 bg-secondary rounded-full overflow-hidden", className)}>
            <motion.div
                className={cn(
                    "h-full rounded-full",
                    isError ? "bg-red-500" : "bg-primary"
                )}
                initial={{ width: "0%" }}
                animate={{ width: `${targetWidth}%` }}
                transition={transition}
            />
        </div>
    );
}
