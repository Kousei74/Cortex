import { useLocation, Link } from "react-router-dom"
import { motion } from "framer-motion"
import { cn } from "@/lib/utils"
import { useAuth } from "@/context/AuthContext"

const menuItems = [
    {
        id: "staging",
        path: "/",
        label: "DATA INGESTION",
        icon: (
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 7v10c0 2.21 3.582 4 8 4s8-1.79 8-4V7M4 7c0 2.21 3.582 4 8 4s8-1.79 8-4M4 7c0-2.21 3.582-4 8-4s8 1.79 8 4m0 5c0 2.21-3.582 4-8 4s-8-1.79-8-4" />
            </svg>
        ),
    },
    {
        id: "dashboard",
        path: "/dashboard",
        label: "COMMAND CENTER",
        icon: (
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z"
                />
            </svg>
        ),
    },
    {
        id: "service",
        path: "/service",
        label: "SERVICE HUB",
        icon: (
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10"
                />
            </svg>
        ),
    },
    {
        id: "integrations",
        path: "/integrations",
        label: "INTEGRATIONS",
        icon: (
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1"
                />
            </svg>
        ),
    },
]

export default function Sidebar() {
    const location = useLocation()
    const { logout, user } = useAuth()

    // Basic active check logic - assuming exact match for root and startsWith for others
    const isActive = (path) => {
        if (path === "/") return location.pathname === "/"
        return location.pathname.startsWith(path)
    }

    return (
        <div className="h-full bg-surface-custom border-r border-subtle-custom flex flex-col">
            {/* Header */}
            <div className="p-6 border-b border-subtle-custom">
                <h1 className="text-2xl font-mono font-bold text-primary-custom tracking-wider">CORTEX</h1>
                <p className="text-xs text-secondary-custom mt-1 font-mono">Customer Insights OS</p>
            </div>

            <nav className="flex-1 p-4 space-y-2">
                {menuItems.map((item) => {
                    const active = isActive(item.path)
                    return (
                        <Link
                            key={item.id}
                            to={item.path}
                            className="relative block"
                        >
                            {active && (
                                <motion.div
                                    layoutId="activeSidebarBase"
                                    className="absolute inset-0 bg-[var(--accent-blue-dark)] border-l-4 border-[var(--accent-blue-bright)] soft-glow fluid-rounded"
                                    initial={false}
                                    transition={{ type: "spring", stiffness: 300, damping: 30 }}
                                />
                            )}

                            <div
                                className={cn(
                                    "relative z-10 flex items-center w-full p-4 font-mono text-sm transition-colors duration-200",
                                    active
                                        ? "text-[var(--accent-blue-bright)]"
                                        : "text-secondary-custom hover:text-primary-custom"
                                )}
                            >
                                <span className="mr-4">{item.icon}</span>
                                {item.label}
                            </div>
                        </Link>
                    )
                })}
            </nav>

            <div className="p-4 border-t border-subtle-custom">
                <div className="flex items-center space-x-3 p-3 fluid-rounded bg-surface-custom soft-shadow">
                    <div className="w-10 h-10 bg-[var(--accent-blue-dark)] fluid-rounded flex items-center justify-center">
                        <span className="text-[var(--accent-blue-bright)] font-mono font-bold text-sm">
                            {user?.full_name ? user.full_name.charAt(0).toUpperCase() : "U"}
                        </span>
                    </div>
                    <div className="flex-1 overflow-hidden">
                        <div className="text-sm font-mono font-bold text-primary-custom truncate">
                            {user?.full_name || "User"}
                        </div>
                        <div className="text-xs text-secondary-custom font-mono truncate">
                            {user?.email || "Analyst"}
                        </div>
                    </div>
                    <button
                        onClick={logout}
                        className="text-secondary-custom hover:text-[var(--semantic-error)] cursor-pointer transition-colors p-1"
                        title="Logout"
                    >
                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
                        </svg>
                    </button>
                </div>
            </div>
        </div>
    )
}
