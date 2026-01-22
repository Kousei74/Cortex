import { Routes, Route, useLocation } from "react-router-dom"
import { AnimatePresence, motion } from "framer-motion"
import Sidebar from "@/components/sidebar"
import MainContent from "@/components/main-content"
import RightPanel from "@/components/right-panel"
import { PAGE_TRANSITION } from "@/lib/animations"

// Placeholder components for other routes
const PlaceholderPage = ({ title }) => (
    <div className="p-6">
        <h1 className="text-3xl font-mono font-bold text-primary-custom tracking-wider mb-4">{title}</h1>
        <p className="text-secondary-custom font-mono">Module initialized. Awaiting data stream...</p>
    </div>
)

export default function Dashboard() {
    const location = useLocation()

    return (
        <div className="h-screen bg-primary-custom flex overflow-hidden">
            {/* Fixed Left Sidebar */}
            <div className="w-64 flex-shrink-0 z-20">
                <Sidebar />
            </div>

            {/* Main Content Area - Animates on route change */}
            <div className="flex-1 overflow-hidden relative flex flex-col">
                <div className="flex-1 overflow-y-auto custom-scrollbar relative">
                    <AnimatePresence mode="wait">
                        <Routes location={location} key={location.pathname}>
                            <Route
                                path="/"
                                element={
                                    <motion.div {...PAGE_TRANSITION} className="min-h-full">
                                        <MainContent />
                                    </motion.div>
                                }
                            />
                            <Route
                                path="/product"
                                element={
                                    <motion.div {...PAGE_TRANSITION} className="min-h-full">
                                        <PlaceholderPage title="PRODUCT PULSE" />
                                    </motion.div>
                                }
                            />
                            <Route
                                path="/service"
                                element={
                                    <motion.div {...PAGE_TRANSITION} className="min-h-full">
                                        <PlaceholderPage title="SERVICE HUB" />
                                    </motion.div>
                                }
                            />
                            <Route
                                path="/integrations"
                                element={
                                    <motion.div {...PAGE_TRANSITION} className="min-h-full">
                                        <PlaceholderPage title="INTEGRATIONS" />
                                    </motion.div>
                                }
                            />
                        </Routes>
                    </AnimatePresence>
                </div>
            </div>

            {/* Fixed Right Panel */}
            <div className="w-80 flex-shrink-0 z-20 border-l border-subtle-custom">
                <RightPanel />
            </div>
        </div>
    )
}
