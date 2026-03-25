import { useState, useRef, useEffect } from "react"
import { motion, AnimatePresence } from "framer-motion"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { FADE_IN } from "@/lib/animations"
import { useAuth } from "@/context/AuthContext"
import { Eye, EyeOff, CheckCircle2 } from "lucide-react"
import { api } from "@/lib/api"
import { useNavigate, useLocation } from "react-router-dom"
import { CortexLoader } from "@/components/cortex-loader"

export default function AuthFlow() {
    const { login } = useAuth()
    const navigate = useNavigate()
    const location = useLocation()
    
    // Check invite token from URL
    const params = new URLSearchParams(location.search)
    const tokenFromUrl = params.get("token")

    const [step, setStep] = useState(tokenFromUrl ? "form" : "initial")
    const [activeTab, setActiveTab] = useState(tokenFromUrl ? "signup" : "login")
    
    // Invite State
    const [isVerifyingInvite, setIsVerifyingInvite] = useState(!!tokenFromUrl)
    const [inviteError, setInviteError] = useState(null)

    // Form State
    const [email, setEmail] = useState("")
    const [password, setPassword] = useState("")
    const [confirmPassword, setConfirmPassword] = useState("")
    const [fullName, setFullName] = useState("")
    const [deptId, setDeptId] = useState("")

    const [isLoading, setIsLoading] = useState(false)
    const [error, setError] = useState(null)
    const [showPassword, setShowPassword] = useState(false)
    
    // Request Access State
    const [requestSuccess, setRequestSuccess] = useState(false)

    const passwordInputRef = useRef(null)

    // Verify Invite Token on load
    useEffect(() => {
        if (tokenFromUrl) {
            const verify = async () => {
                try {
                    const data = await api.verifyInvite(tokenFromUrl)
                    setEmail(data.email)
                    setDeptId(data.dept_id)
                } catch (err) {
                    setInviteError(err.message || "Invalid or expired invite token.")
                } finally {
                    setIsVerifyingInvite(false)
                }
            }
            verify()
        }
    }, [tokenFromUrl])

    const handleDemoLogin = () => {
        localStorage.setItem("cortex_demo_mode", "true");
        window.location.href = "/";
    };

    const handleLogin = async () => {
        setIsLoading(true);
        setError(null);

        if (!email || !password) {
            setError("Email and Password are required.");
            setIsLoading(false);
            return;
        }

        try {
            await login(email, password);
        } catch (err) {
            setError(err.message);
            setIsLoading(false);
        }
    }

    const handleRequestAccess = async () => {
        setIsLoading(true);
        setError(null);

        if (!fullName || !email) {
            setError("Full Name and Email are required.");
            setIsLoading(false);
            return;
        }

        try {
            await api.requestAccess(fullName, email);
            setRequestSuccess(true);
            setTimeout(() => {
                setRequestSuccess(false);
                setFullName("");
                setEmail("");
                setActiveTab("login");
            }, 10000);
        } catch (err) {
            setError(err.message);
        } finally {
            setIsLoading(false);
        }
    }

    const handleCompleteInvite = async () => {
        setIsLoading(true);
        setError(null);

        if (!fullName || !password) {
            setError("All fields are required.");
            setIsLoading(false);
            return;
        }
        if (password !== confirmPassword) {
            setError("Passwords do not match");
            setIsLoading(false);
            return;
        }

        try {
            await api.completeInvite(tokenFromUrl, fullName, password);
            navigate("/login");
            setActiveTab("login");
            setStep("initial");
            setPassword("");
            setConfirmPassword("");
        } catch (err) {
            setError(err.message);
            setIsLoading(false);
        }
    }

    // Render Invite Verification State
    if (tokenFromUrl && isVerifyingInvite) {
        return (
            <div className="min-h-screen bg-primary-custom flex items-center justify-center p-4">
                <div className="flex flex-col items-center p-12 bg-surface-custom border border-subtle-custom fluid-rounded-xl frosted-glass soft-shadow-lg w-full max-w-md">
                    <CortexLoader />
                    <p className="mt-6 text-[var(--accent-blue-bright)] font-mono uppercase tracking-widest text-sm animate-pulse [text-shadow:0_0_8px_rgba(0,191,255,0.4)]">Verifying Secure Invite...</p>
                </div>
            </div>
        )
    }

    // Render Invite Error State
    if (tokenFromUrl && inviteError) {
        return (
            <div className="min-h-screen bg-primary-custom flex items-center justify-center p-4">
                <div className="p-8 bg-surface-custom border border-[var(--semantic-error)] fluid-rounded-xl frosted-glass text-center space-y-6 soft-shadow-lg w-full max-w-md">
                    <div className="flex justify-center mb-4">
                        <div className="w-16 h-16 rounded-full bg-[var(--semantic-error)]/10 flex items-center justify-center">
                            <span className="text-[var(--semantic-error)] text-3xl font-bold">!</span>
                        </div>
                    </div>
                    <h2 className="text-[var(--semantic-error)] font-mono font-bold text-2xl uppercase tracking-wider">Access Denied</h2>
                    <p className="text-secondary-custom font-mono text-sm leading-relaxed">{inviteError}</p>
                    <Button onClick={() => { navigate("/login"); setStep("initial") }} className="w-full mt-4 h-12 uppercase tracking-widest font-mono text-[10px] sm:text-xs">
                        RETURN TO LOGIN
                    </Button>
                </div>
            </div>
        )
    }

    return (
        <div className="min-h-screen bg-primary-custom flex items-center justify-center p-4">
            <AnimatePresence mode="wait">
                {step === "initial" && !tokenFromUrl && (
                    <motion.div
                        key="initial"
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0, scale: 1.05, filter: "blur(10px)" }}
                        transition={{ duration: 0.5, ease: [0.22, 1, 0.36, 1] }}
                        className="flex flex-col items-center justify-center text-center"
                    >
                        {/* Logo */}
                        <motion.div
                            initial={{ opacity: 0, scale: 0.6, filter: "blur(12px)" }}
                            animate={{ opacity: 1, scale: 1, filter: "blur(0px)" }}
                            transition={{ duration: 0.8, ease: [0.22, 1, 0.36, 1], delay: 0.1 }}
                            className="mb-3"
                        >
                            <img
                                src="/src/assets/Logo.svg"
                                alt="Cortex Logo"
                                className="w-32 h-32 mx-auto"
                                style={{ filter: "brightness(0) invert(0.92)" }}
                            />
                        </motion.div>

                        {/* App Name */}
                        <motion.h1
                            initial={{ opacity: 0, y: 20 }}
                            animate={{ opacity: 1, y: 0 }}
                            transition={{ duration: 0.6, ease: [0.22, 1, 0.36, 1], delay: 0.35 }}
                            className="text-6xl font-bold text-primary-custom tracking-[0.15em] mb-3"
                            style={{ fontFamily: "'League Spartan', sans-serif" }}
                        >
                            CORTEX
                        </motion.h1>

                        {/* Subtitle */}
                        <motion.p
                            initial={{ opacity: 0, y: 10 }}
                            animate={{ opacity: 1, y: 0 }}
                            transition={{ duration: 0.5, ease: [0.22, 1, 0.36, 1], delay: 0.55 }}
                            className="text-secondary-custom text-lg max-w-md mx-auto mb-10"
                        >
                            Translate customer chaos into actionable clarity.
                        </motion.p>

                        {/* Buttons */}
                        <motion.div
                            initial={{ opacity: 0, y: 15 }}
                            animate={{ opacity: 1, y: 0 }}
                            transition={{ duration: 0.5, ease: [0.22, 1, 0.36, 1], delay: 0.7 }}
                            className="flex flex-col items-center gap-4"
                        >
                            <motion.div whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.95 }} className="w-full max-w-[280px]">
                                <Button
                                    onClick={() => setStep("form")}
                                    className="w-full gradient-button text-white font-mono uppercase tracking-wider px-12 py-4 rounded-full hover:opacity-90 transition-all duration-300 soft-shadow-lg"
                                >
                                    INITIATE CONNECTION
                                </Button>
                            </motion.div>
                            <motion.div whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.95 }}>
                                <Button
                                    onClick={handleDemoLogin}
                                    className="bg-surface-custom/50 border border-subtle-custom text-primary-custom font-mono uppercase tracking-wider px-12 py-4 rounded-full hover:bg-[var(--accent-blue-bright)]/10 hover:border-[var(--accent-blue-bright)] hover:shadow-[0_0_15px_rgba(0,191,255,0.4)] transition-all duration-300 soft-shadow-lg"
                                >
                                    TRY DEMO
                                </Button>
                            </motion.div>
                        </motion.div>
                    </motion.div>
                )}

                {step === "form" && (
                    <motion.div
                        key="form"
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: -20, filter: "blur(10px)" }}
                        transition={{ duration: 0.4 }}
                        className="w-full max-w-md relative"
                    >
                        <motion.div
                            layout
                            transition={{ type: "spring", stiffness: 300, damping: 30 }}
                            className="frosted-glass soft-shadow-lg border border-subtle-custom fluid-rounded-xl p-8 overflow-hidden"
                        >
                            {/* IF TOKEN IS PRESENT => RENDER ISOLATED SIGNUP ONLY */}
                            {tokenFromUrl ? (
                                <div className="space-y-6">
                                    <div className="mb-8 text-center">
                                        <h2 className="text-2xl font-mono font-bold text-[var(--accent-blue-bright)] uppercase tracking-widest [text-shadow:0_0_10px_rgba(0,191,255,0.5)]">
                                            SECURE SIGNUP
                                        </h2>
                                        <p className="text-secondary-custom font-mono text-xs mt-2 uppercase tracking-widest opacity-70">Complete your profile</p>
                                    </div>
                                    <AnimatePresence>
                                        {error && (
                                            <motion.div
                                                initial={{ opacity: 0, height: 0, marginBottom: 0 }}
                                                animate={{ opacity: 1, height: "auto", marginBottom: 24 }}
                                                exit={{ opacity: 0, height: 0, marginBottom: 0 }}
                                                className="overflow-hidden"
                                            >
                                                <div className="p-3 bg-[var(--semantic-error)]/10 border border-[var(--semantic-error)] rounded-md text-[var(--semantic-error)] text-sm text-center font-mono shadow-[0_0_10px_rgba(255,59,48,0.2)]">
                                                    {error}
                                                </div>
                                            </motion.div>
                                        )}
                                    </AnimatePresence>
                                    <div className="space-y-4">
                                        <Input
                                            type="text"
                                            placeholder="Full Name"
                                            value={fullName}
                                            onChange={(e) => setFullName(e.target.value)}
                                            className="bg-surface-custom border-subtle-custom text-primary-custom placeholder:text-secondary-custom/50 fluid-rounded focus:border-[var(--accent-blue-bright)] soft-glow-hover soft-focus transition-all duration-300 h-12"
                                        />
                                        <Input
                                            type="email"
                                            value={email}
                                            disabled
                                            className="bg-surface-custom/30 border-subtle-custom text-secondary-custom fluid-rounded cursor-not-allowed h-12"
                                        />
                                        <Input
                                            type="text"
                                            value={deptId ? `Authorized Department: ${deptId}` : "No Department Assigned"}
                                            disabled
                                            className="bg-surface-custom/30 border-subtle-custom text-secondary-custom fluid-rounded cursor-not-allowed h-12 text-xs uppercase tracking-wider"
                                        />
                                        <Input
                                            type="password"
                                            placeholder="Password"
                                            value={password}
                                            onChange={(e) => setPassword(e.target.value)}
                                            className="bg-surface-custom border-subtle-custom text-primary-custom placeholder:text-secondary-custom/50 fluid-rounded focus:border-[var(--accent-blue-bright)] soft-glow-hover soft-focus transition-all duration-300 h-12"
                                        />
                                        <Input
                                            type="password"
                                            placeholder="Confirm Password"
                                            value={confirmPassword}
                                            onChange={(e) => setConfirmPassword(e.target.value)}
                                            className="bg-surface-custom border-subtle-custom text-primary-custom placeholder:text-secondary-custom/50 fluid-rounded focus:border-[var(--accent-blue-bright)] soft-glow-hover soft-focus transition-all duration-300 h-12"
                                        />
                                    </div>
                                    <motion.div whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }}>
                                        <Button
                                            onClick={handleCompleteInvite}
                                            disabled={isLoading}
                                            className="w-full gradient-button text-white font-mono uppercase tracking-wider py-6 fluid-rounded soft-shadow text-lg"
                                        >
                                            {isLoading ? "CREATING ACCOUNT..." : "CREATE ACCOUNT"}
                                        </Button>
                                    </motion.div>
                                </div>
                            ) : (
                                /* NORMAL TABS FOR PUBLIC ACCESS */
                                <Tabs
                                    defaultValue="login"
                                    className="w-full"
                                    value={activeTab}
                                    onValueChange={(val) => {
                                        if (requestSuccess) return; // Prevent tab switch during success state
                                        setActiveTab(val);
                                        setError(null);
                                    }}
                                >
                                    <TabsList className="flex w-full bg-transparent p-0 mb-8 border-b border-subtle-custom/20 gap-8 h-auto relative">
                                        <TabsTrigger
                                            value="login"
                                            disabled={requestSuccess}
                                            className="
                                                flex-1 pb-4 rounded-none bg-transparent shadow-none border-b-2 border-transparent
                                                font-mono text-lg font-bold uppercase tracking-widest
                                                text-secondary-custom transition-all duration-300
                                                data-[state=active]:bg-transparent data-[state=active]:shadow-none
                                                data-[state=active]:text-[var(--accent-blue-bright)]
                                                data-[state=active]:border-[var(--accent-blue-bright)]
                                                data-[state=active]:[text-shadow:0_0_10px_rgba(0,191,255,0.5)]
                                                hover:text-primary-custom disabled:opacity-50
                                                "
                                        >
                                            Login
                                        </TabsTrigger>
                                        <TabsTrigger
                                            value="signup"
                                            disabled={requestSuccess}
                                            className="
                                                flex-1 pb-4 rounded-none bg-transparent shadow-none border-b-2 border-transparent
                                                font-mono text-lg font-bold uppercase tracking-widest
                                                text-secondary-custom transition-all duration-300
                                                data-[state=active]:bg-transparent data-[state=active]:shadow-none
                                                data-[state=active]:text-[var(--accent-blue-bright)]
                                                data-[state=active]:border-[var(--accent-blue-bright)]
                                                data-[state=active]:[text-shadow:0_0_10px_rgba(0,191,255,0.5)]
                                                hover:text-primary-custom disabled:opacity-50
                                                "
                                        >
                                            Request Access
                                        </TabsTrigger>
                                    </TabsList>

                                    <AnimatePresence>
                                        {error && (
                                            <motion.div
                                                initial={{ opacity: 0, height: 0, marginBottom: 0 }}
                                                animate={{ opacity: 1, height: "auto", marginBottom: 24 }}
                                                exit={{ opacity: 0, height: 0, marginBottom: 0 }}
                                                className="overflow-hidden"
                                            >
                                                <div className="p-3 bg-[var(--semantic-error)]/10 border border-[var(--semantic-error)] rounded-md text-[var(--semantic-error)] text-sm text-center font-mono shadow-[0_0_10px_rgba(255,59,48,0.2)]">
                                                    {error}
                                                </div>
                                            </motion.div>
                                        )}
                                    </AnimatePresence>

                                    <div className="mt-4">
                                        <AnimatePresence mode="wait">
                                            {activeTab === "login" ? (
                                                <motion.div key="login-form" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }} transition={{ duration: 0.3 }} className="space-y-6 outline-none">
                                                    <div className="space-y-4">
                                                        <Input
                                                            type="email"
                                                            placeholder="Email Address"
                                                            value={email}
                                                            onChange={(e) => setEmail(e.target.value)}
                                                            onKeyDown={(e) => {
                                                                if (e.key === "Enter") {
                                                                    e.preventDefault()
                                                                    passwordInputRef.current?.focus()
                                                                }
                                                            }}
                                                            className="bg-surface-custom border-subtle-custom text-primary-custom placeholder:text-secondary-custom/50 fluid-rounded focus:border-[var(--accent-blue-bright)] soft-glow-hover soft-focus transition-all duration-300 h-12"
                                                        />
                                                        <div className="relative group">
                                                            <Input
                                                                ref={passwordInputRef}
                                                                type={showPassword ? "text" : "password"}
                                                                placeholder="Password"
                                                                value={password}
                                                                onChange={(e) => setPassword(e.target.value)}
                                                                onKeyDown={(e) => {
                                                                    if (e.key === "Enter") {
                                                                        e.preventDefault()
                                                                        handleLogin()
                                                                    }
                                                                }}
                                                                className="bg-surface-custom border-subtle-custom text-primary-custom placeholder:text-secondary-custom/50 fluid-rounded focus:border-[var(--accent-blue-bright)] soft-glow-hover soft-focus transition-all duration-300 pr-12 h-12"
                                                            />
                                                            <button
                                                                type="button"
                                                                className="absolute right-3 top-1/2 transform -translate-y-1/2 text-secondary-custom hover:text-[var(--accent-blue-bright)] transition-colors cursor-pointer select-none focus:outline-none"
                                                                onMouseDown={() => setShowPassword(true)}
                                                                onMouseUp={() => setShowPassword(false)}
                                                                onMouseLeave={() => setShowPassword(false)}
                                                                onTouchStart={(e) => { e.preventDefault(); setShowPassword(true) }}
                                                                onTouchEnd={() => setShowPassword(false)}
                                                                tabIndex={-1}
                                                            >
                                                                <AnimatePresence mode="wait">
                                                                    <motion.div
                                                                        key={showPassword ? "show" : "hide"}
                                                                        initial={{ opacity: 0, scale: 0.8, rotate: -30 }}
                                                                        animate={{ opacity: 1, scale: 1, rotate: 0 }}
                                                                        exit={{ opacity: 0, scale: 0.8, rotate: 30 }}
                                                                        transition={{ duration: 0.15 }}
                                                                    >
                                                                        {showPassword ? <Eye className="w-5 h-5" /> : <EyeOff className="w-5 h-5" />}
                                                                    </motion.div>
                                                                </AnimatePresence>
                                                            </button>
                                                        </div>
                                                    </div>
                                                    <motion.div whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }}>
                                                        <Button
                                                            onClick={handleLogin}
                                                            disabled={isLoading}
                                                            className="w-full gradient-button text-white font-mono uppercase tracking-wider py-6 fluid-rounded soft-shadow text-lg"
                                                        >
                                                            {isLoading ? "AUTHENTICATING..." : "AUTHENTICATE"}
                                                        </Button>
                                                    </motion.div>
                                                </motion.div>
                                            ) : (
                                                <motion.div key="signup-form" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }} transition={{ duration: 0.3 }} className="outline-none">
                                                    <AnimatePresence mode="wait">
                                                        {requestSuccess ? (
                                                            <motion.div 
                                                                key="success"
                                                                {...FADE_IN} 
                                                                className="flex flex-col items-center justify-center py-6 text-center space-y-5"
                                                            >
                                                                <div className="w-16 h-16 rounded-full bg-[var(--accent-blue-bright)]/10 border border-[var(--accent-blue-bright)]/30 flex items-center justify-center soft-shadow">
                                                                    <CheckCircle2 className="w-8 h-8 text-[var(--accent-blue-bright)]" />
                                                                </div>
                                                                <h3 className="text-[var(--accent-blue-bright)] font-mono font-bold text-xl uppercase tracking-wider [text-shadow:0_0_10px_rgba(0,191,255,0.3)]">
                                                                    Access Requested
                                                                </h3>
                                                                <p className="text-secondary-custom font-mono text-sm leading-relaxed max-w-xs">
                                                                    Your access request has been securely logged. Once approved by an administrator, you will receive an exclusive invite link via email.
                                                                </p>
                                                            </motion.div>
                                                        ) : (
                                                            <motion.div key="form" {...FADE_IN} className="space-y-6">
                                                                <div className="space-y-4">
                                                                    <Input
                                                                        type="text"
                                                                        placeholder="Full Name"
                                                                        value={fullName}
                                                                        onChange={(e) => setFullName(e.target.value)}
                                                                        className="bg-surface-custom border-subtle-custom text-primary-custom placeholder:text-secondary-custom/50 fluid-rounded focus:border-[var(--accent-blue-bright)] soft-glow-hover soft-focus transition-all duration-300 h-12"
                                                                    />
                                                                    <Input
                                                                        type="email"
                                                                        placeholder="Corporate Email Address"
                                                                        value={email}
                                                                        onChange={(e) => setEmail(e.target.value)}
                                                                        className="bg-surface-custom border-subtle-custom text-primary-custom placeholder:text-secondary-custom/50 fluid-rounded focus:border-[var(--accent-blue-bright)] soft-glow-hover soft-focus transition-all duration-300 h-12"
                                                                    />
                                                                </div>
                                                                <motion.div whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }}>
                                                                    <Button
                                                                        onClick={handleRequestAccess}
                                                                        disabled={isLoading}
                                                                        className="w-full gradient-button text-white font-mono uppercase tracking-wider py-6 fluid-rounded soft-shadow text-lg border border-[var(--accent-blue-bright)]/50"
                                                                    >
                                                                        {isLoading ? "SUBMITTING..." : "REQUEST ACCESS"}
                                                                    </Button>
                                                                </motion.div>
                                                            </motion.div>
                                                        )}
                                                    </AnimatePresence>
                                                </motion.div>
                                            )}
                                        </AnimatePresence>
                                    </div>
                                </Tabs>
                            )}
                        </motion.div>
                    </motion.div>
                )}
            </AnimatePresence>
        </div>
    )
}
