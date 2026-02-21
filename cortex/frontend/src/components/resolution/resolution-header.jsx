import React, { useState, useEffect } from 'react';
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";

export function ResolutionHeader({ context, onResolveAll }) {
    if (!context) return null;

    const [isVisible, setIsVisible] = useState(true);

    useEffect(() => {
        const timer = setTimeout(() => {
            setIsVisible(false);
        }, 5000); // Wait 5 seconds before hiding
        return () => clearTimeout(timer);
    }, []);

    const { items_remaining, items_total, items_resolved } = context;
    const progress = items_total > 0 ? (items_resolved / items_total) * 100 : 0;

    if (!isVisible) return null;

    return (
        <div
            className={`sticky top-0 z-30 bg-primary-custom/95 backdrop-blur-sm border-b border-subtle-custom py-4 mb-6 -mx-8 px-8 flex justify-between items-center shadow-sm transition-all duration-1000 ease-in-out opacity-100 translate-y-0`}
        >
            <div>
                <h2 className="text-lg font-mono font-bold text-primary-custom flex items-center">
                    <span className="bg-[var(--accent-blue-bright)] text-white text-xs px-2 py-1 rounded mr-3">
                        {items_remaining} REMAINING
                    </span>
                    RESOLUTION WORKSPACE
                </h2>
                {/* REMOVED REDUNDANT SUBHEADER */}
            </div>

            <div className="flex items-center space-x-6 flex-1 justify-end max-w-xl">
                {/* Global Resolution Progress */}
                <div className="flex-1">
                    <div className="flex justify-between text-xs font-mono text-secondary-custom mb-1">
                        <span>PROGRESS</span>
                        <span>{Math.floor(progress)}% | {items_resolved}/{items_total}</span>
                    </div>
                    <div className="h-2 w-full bg-gray-200 rounded-full overflow-hidden">
                        <div
                            className="h-full bg-[var(--semantic-success)] transition-all duration-500"
                            style={{ width: `${progress}%` }}
                        />
                    </div>
                </div>

                {/* Actions */}
                <Button
                    onClick={onResolveAll}
                    disabled={items_remaining === 0}
                    size="sm"
                    className="gradient-button text-white font-mono shadow-md"
                >
                    RESOLVE ALL
                </Button>
            </div>
        </div>
    );
}
