import { BrowserRouter as Router, Routes, Route, useLocation, Navigate } from "react-router-dom"
import { AnimatePresence, motion } from "framer-motion"
import { AuthProvider, useAuth } from "@/context/AuthContext"
import AuthFlow from "@/components/auth-flow"
import { PAGE_TRANSITION } from "@/lib/animations"

import StagingArea from "@/components/staging-area"
import MainLayout from "@/components/layout/main-layout"
import MainContent from "@/components/main-content"
import SingleInstanceLock from "@/components/single-instance-lock"

// Placeholder components for other routes (moved from Dashboard.jsx)
const PlaceholderPage = ({ title }) => (
    <div className="p-6">
        <h1 className="text-3xl font-mono font-bold text-primary-custom tracking-wider mb-4">{title}</h1>
        <p className="text-secondary-custom font-mono">Module initialized. Awaiting data stream...</p>
    </div>
)

function AnimatedRoutes() {
    const location = useLocation()
    const { isAuthenticated } = useAuth()

    return (
        <AnimatePresence mode="wait">
            <Routes location={location} key={location.pathname}>
                {/* Public Route */}
                <Route
                    path="/login"
                    element={
                        !isAuthenticated ? (
                            <AuthFlow />
                        ) : (
                            <Navigate to="/" replace />
                        )
                    }
                />

                {/* Protected Routes Wrapper */}
                <Route
                    element={
                        isAuthenticated ? (
                            <MainLayout />
                        ) : (
                            <Navigate to="/login" replace />
                        )
                    }
                >
                    {/* Option 1: Data Ingestion (Staging) */}
                    <Route
                        path="/"
                        element={
                            <motion.div {...PAGE_TRANSITION} className="min-h-full">
                                <StagingArea />
                            </motion.div>
                        }
                    />

                    {/* Option 2: Command Center (Dashboard) */}
                    <Route
                        path="/dashboard"
                        element={
                            <motion.div {...PAGE_TRANSITION} className="min-h-full">
                                <MainContent />
                            </motion.div>
                        }
                    />

                    {/* Other Routes */}
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
                </Route>
            </Routes>
        </AnimatePresence>
    )
}

import { Toaster } from "@/components/ui/sonner"
import { BackgroundPoller } from "@/components/background-poller"

function App() {
    return (
        <AuthProvider>
            <Router>
                <div className="min-h-screen bg-primary-custom text-foreground font-sans">
                    <SingleInstanceLock />
                    <BackgroundPoller />
                    <AnimatedRoutes />
                    <Toaster />
                </div>
            </Router>
        </AuthProvider>
    )
}

export default App
