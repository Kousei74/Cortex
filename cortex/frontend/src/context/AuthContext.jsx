import { createContext, useContext, useState, useEffect } from "react";
import { api } from "@/lib/api";

const AuthContext = createContext(null);

export const AuthProvider = ({ children }) => {
    const [user, setUser] = useState(null);
    const [token, setToken] = useState(localStorage.getItem("cortex_token"));
    const [loading, setLoading] = useState(true);

    // Load user profile on mount if token exists
    useEffect(() => {
        const loadUser = async () => {
            if (token) {
                try {
                    const userData = await api.getMe();
                    setUser(userData);
                } catch (error) {
                    console.error("Failed to load user", error);
                    logout(); // Invalid token
                }
            }
            setLoading(false);
        };

        loadUser();
    }, [token]);

    const login = async (email, password) => {
        const data = await api.login(email, password);
        localStorage.setItem("cortex_token", data.access_token);
        setToken(data.access_token);
        // User will be fetched by the effect
    };

    const signup = async (email, password, fullName) => {
        await api.signup(email, password, fullName);
        // Auto-login after signup? Or require explicit login. 
        // Let's implement explicit login for security, but for flow fluidity we could auto-login.
        // Standard flow: Signup -> Login automatically.
        await login(email, password);
    };

    const logout = () => {
        localStorage.removeItem("cortex_token");
        setToken(null);
        setUser(null);
    };

    return (
        <AuthContext.Provider value={{ user, isAuthenticated: !!user, login, signup, logout, loading }}>
            {!loading && children}
        </AuthContext.Provider>
    );
};

export const useAuth = () => useContext(AuthContext);
