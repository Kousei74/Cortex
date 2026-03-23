import { Outlet } from "react-router-dom"
import Sidebar from "@/components/sidebar"
import RightPanel from "@/components/right-panel"
import { useNetworkStatus } from "@/hooks/use-network-status"

export default function MainLayout() {
    useNetworkStatus(); // Initialize global network listeners

    return (
        <div className="h-screen bg-primary-custom flex overflow-hidden">
            {/* Fixed Left Sidebar */}
            <div className="w-64 flex-shrink-0 z-20">
                <Sidebar />
            </div>

            {/* DEMO MODE Badge */}
            {localStorage.getItem("cortex_demo_mode") === "true" && (
                <div className="absolute top-4 left-1/2 -translate-x-1/2 z-50 bg-surface-custom border border-subtle-custom text-primary-custom shadow-[0_0_15px_rgba(0,191,255,0.15)] font-mono font-bold text-xs px-5 py-2 rounded-full tracking-widest uppercase flex items-center justify-center text-center pointer-events-none">
                    Demo Mode (Read-Only)
                </div>
            )}

            {/* Main Content Area - Renders the dynamic route content */}
            <div className="flex-1 overflow-hidden relative flex flex-col">
                <div className="flex-1 overflow-y-auto custom-scrollbar relative">
                    <Outlet />
                </div>
            </div>

            {/* Fixed Right Panel */}
            <div className="w-80 flex-shrink-0 z-20 border-l border-subtle-custom">
                <RightPanel />
            </div>
        </div>
    )
}
