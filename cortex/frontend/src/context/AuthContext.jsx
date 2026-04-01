import { createContext, useContext, useState, useEffect } from "react";
import { api } from "@/lib/api";
import { CortexLoader } from '@/components/cortex-loader';
import { useAnalysisStore } from "@/store/analysisStore";
import demoDashboard from "@/lib/mock_data/dashboard_payload.json";

const AuthContext = createContext(null);

export const AuthProvider = ({ children }) => {
    const [user, setUser] = useState(null);
    const [token, setToken] = useState(localStorage.getItem("cortex_token"));
    const [loading, setLoading] = useState(true);

    const clearSession = () => {
        localStorage.removeItem("cortex_token");
        localStorage.removeItem("cortex_demo_mode");
        setToken(null);
        setUser(null);
    };

    // Load user profile on mount if token exists
    useEffect(() => {
        const loadUser = async () => {
            const isDemo = localStorage.getItem("cortex_demo_mode") === "true";
            
            if (isDemo) {
                // Mock a Senior user for demo mode
                setUser({
                    emp_id: "DEMO-01",
                    full_name: "Demo Presenter",
                    role: "senior",
                    dept_id: "D01",
                    email: "demo@cortex.local"
                });

                // Hydrate dashboard payload
                if (demoDashboard && demoDashboard.payload) {
                    useAnalysisStore.getState().setJobId(demoDashboard.job_id || "demo-job");
                    useAnalysisStore.getState().setPayload(demoDashboard.payload);
                }

                setLoading(false);
                return;
            }

            if (token) {
                try {
                    const userData = await api.getMe();
                    setUser(userData);
                } catch (error) {
                    console.error("Failed to load user", error);
                    clearSession(); // Invalid token
                }
            }
            setLoading(false);
        };

        loadUser();
    }, [token]);

    useEffect(() => {
        const handleSessionExpired = () => {
            clearSession();
            setLoading(false);
        };

        const handleStorageChange = (event) => {
            if (event.key === "cortex_token" && !event.newValue) {
                handleSessionExpired();
            }
        };

        window.addEventListener("cortex:session-expired", handleSessionExpired);
        window.addEventListener("storage", handleStorageChange);

        return () => {
            window.removeEventListener("cortex:session-expired", handleSessionExpired);
            window.removeEventListener("storage", handleStorageChange);
        };
    }, []);

    const login = async (email, password) => {
        const data = await api.login(email, password);
        localStorage.setItem("cortex_token", data.access_token);
        setToken(data.access_token);
        // User will be fetched by the effect
    };

    const signup = async () => {
        throw new Error("Direct signup is disabled. Use the invite-based signup flow.");
    };

    const logout = () => {
        clearSession();
    };

    return (
        <AuthContext.Provider value={{ user, setUser, isAuthenticated: !!user, login, signup, logout, loading }}>
            {loading ? (
                <div className="min-h-screen bg-[var(--bg-root)] flex items-center justify-center">
                    <CortexLoader />
                </div>
            ) : (
                children
            )}
        </AuthContext.Provider>
    );
};

export const useAuth = () => {
    const context = useContext(AuthContext);
    if (context === undefined || context === null) {
        throw new Error("useAuth must be used within an AuthProvider");
    }
    return context;
};

export { AuthContext };
