import { ResponsiveContainer } from 'recharts';
import { cn } from "@/lib/utils";

/**
 * BaseChart Component (Trust Boundary)
 * 
 * Responsibilities:
 * 1. Validates that 'data' and 'widget' exist.
 * 2. Wraps content in Recharts ResponsiveContainer.
 * 3. Renders DEV-ONLY warning if validation fails.
 */
export function BaseChart({ widget, data, children, className, aspect = 1.6 }) {
    // Validation
    if (!widget || !data) {
        return (
            <div className="w-full h-64 flex items-center justify-center bg-red-50 border-2 border-red-200 rounded-lg p-4 text-red-600">
                <div className="text-center">
                    <h4 className="font-bold text-sm">DEV WARNING: BaseChart Invalid Props</h4>
                    <p className="text-xs mt-1">Missing 'widget' or 'data' prop.</p>
                </div>
            </div>
        );
    }

    // Check data length (Optional: Don't render empty charts)
    if (Array.isArray(data) && data.length === 0) {
        return (
            <div className="w-full h-64 flex items-center justify-center bg-gray-50 border-2 border-dashed border-gray-200 rounded-lg text-gray-400">
                <p className="text-sm">No data available for this chart.</p>
            </div>
        );
    }

    return (
        <div className={cn("w-full", className)}>
            <h3 className="text-lg font-semibold mb-4 text-gray-100 tracking-wide">{widget.title}</h3>
            <div style={{ width: '100%', height: 400 }}>
                {/* Note: height fixed or aspect ratio controlled? Recharts aspect only works if height is not fixed... 
              But ResponsiveContainer needs a known parent height or it collapses to 0.
              Let's use a standard height for V1 or use standard aspect via padding-hack if needed.
              For simplicity, fixed height 400px + ResponsiveContainer is strict and reliable.
          */}
                <ResponsiveContainer width="100%" height="100%">
                    {children}
                </ResponsiveContainer>
            </div>
        </div>
    );
}
