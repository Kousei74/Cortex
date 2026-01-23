import { useState } from "react"
import { motion, AnimatePresence } from "framer-motion"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { FADE_IN } from "@/lib/animations"
import { useAuth } from "@/context/AuthContext"

export default function AuthFlow() {
    const { login, signup } = useAuth()
    const [step, setStep] = useState("initial")
    const [activeTab, setActiveTab] = useState("login")
    const [otpCode, setOtpCode] = useState(["", "", "", "", "", ""])

    // Form State
    const [email, setEmail] = useState("")
    const [password, setPassword] = useState("")
    const [confirmPassword, setConfirmPassword] = useState("")
    const [fullName, setFullName] = useState("")

    const [isLoading, setIsLoading] = useState(false)
    const [error, setError] = useState(null)

    const handleLogin = async () => {
        setIsLoading(true);
        setError(null);

        if (!email) {
            setError("Email can't be empty");
            setIsLoading(false);
            return;
        }
        if (!password) {
            setError("Password can't be empty");
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

    const handleSignup = async () => {
        setIsLoading(true);
        setError(null);

        if (!fullName) {
            setError("Full Name can't be empty");
            setIsLoading(false);
            return;
        }
        if (!email) {
            setError("Email can't be empty");
            setIsLoading(false);
            return;
        }
        if (!password) {
            setError("Password can't be empty");
            setIsLoading(false);
            return;
        }
        if (password !== confirmPassword) {
            setError("Passwords do not match");
            setIsLoading(false); // Ensure loading is reset here too
            return;
        }

        try {
            await signup(email, password, fullName);
        } catch (err) {
            setError(err.message);
            setIsLoading(false);
        }
    }

    const handleOtpChange = (index, value) => {
        if (value.length <= 1) {
            const newOtp = [...otpCode]
            newOtp[index] = value
            setOtpCode(newOtp)
            if (value && index < 5) {
                document.getElementById(`otp-${index + 1}`)?.focus()
            }
        }
    }

    const handleVerify = () => {
        setTimeout(() => { }, 800)
    }

    return (
        <div className="min-h-screen bg-primary-custom flex items-center justify-center p-4">
            <AnimatePresence mode="wait">
                {step === "initial" && (
                    <motion.div
                        key="initial"
                        initial={{ opacity: 0, scale: 0.95 }}
                        animate={{ opacity: 1, scale: 1 }}
                        exit={{ opacity: 0, scale: 1.05, filter: "blur(10px)" }}
                        transition={{ duration: 0.5, ease: [0.22, 1, 0.36, 1] }}
                        className="text-center space-y-8"
                    >
                        <div className="space-y-4">
                            <h1 className="text-6xl font-mono font-bold text-primary-custom tracking-wider">CORTEX</h1>
                            <p className="text-secondary-custom text-lg max-w-md mx-auto">
                                Translate customer chaos into actionable clarity.
                            </p>
                        </div>
                        <motion.div whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.95 }}>
                            <Button
                                onClick={() => setStep("form")}
                                className="gradient-button text-white font-mono uppercase tracking-wider px-12 py-4 rounded-full hover:opacity-90 transition-all duration-300 soft-shadow-lg"
                            >
                                INITIATE CONNECTION
                            </Button>
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
                        {/* Main Card Container with Layout Animation */}
                        <motion.div
                            layout
                            transition={{ type: "spring", stiffness: 300, damping: 30 }}
                            className="frosted-glass soft-shadow-lg border border-subtle-custom fluid-rounded-xl p-8 overflow-hidden"
                        >
                            <Tabs
                                defaultValue="login"
                                className="w-full"
                                value={activeTab}
                                onValueChange={(val) => {
                                    setActiveTab(val);
                                    setError(null);
                                }}
                            >
                                {/* 
                   CUSTOM TAB TRIGGER STYLING 
                   - Removed legacy 'switch' backgrounds
                   - Added clean underline via border-b-2
                   - Added Text Glow
                */}
                                <TabsList className="flex w-full bg-transparent p-0 mb-8 border-b border-subtle-custom/20 gap-8 h-auto">
                                    <TabsTrigger
                                        value="login"
                                        className="
                      flex-1 pb-4 rounded-none bg-transparent shadow-none border-b-2 border-transparent
                      font-mono text-lg font-bold uppercase tracking-widest
                      text-secondary-custom transition-all duration-300
                      data-[state=active]:bg-transparent data-[state=active]:shadow-none
                      data-[state=active]:text-[var(--accent-blue-bright)]
                      data-[state=active]:border-[var(--accent-blue-bright)]
                      data-[state=active]:[text-shadow:0_0_10px_rgba(0,191,255,0.5)]
                      hover:text-primary-custom
                    "
                                    >
                                        Login
                                    </TabsTrigger>
                                    <TabsTrigger
                                        value="signup"
                                        className="
                      flex-1 pb-4 rounded-none bg-transparent shadow-none border-b-2 border-transparent
                      font-mono text-lg font-bold uppercase tracking-widest
                      text-secondary-custom transition-all duration-300
                      data-[state=active]:bg-transparent data-[state=active]:shadow-none
                      data-[state=active]:text-[var(--accent-blue-bright)]
                      data-[state=active]:border-[var(--accent-blue-bright)]
                      data-[state=active]:[text-shadow:0_0_10px_rgba(0,191,255,0.5)]
                      hover:text-primary-custom
                    "
                                    >
                                        Sign Up
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

                                <TabsContent value="login" className="mt-0 focus-visible:ring-0 outline-none">
                                    <motion.div {...FADE_IN} className="space-y-6">
                                        <div className="space-y-4">
                                            <div className="relative group">
                                                <svg className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-secondary-custom group-focus-within:text-[var(--accent-blue-bright)] transition-colors" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                                                </svg>
                                                <Input
                                                    type="email"
                                                    placeholder="Email Address"
                                                    value={email}
                                                    onChange={(e) => setEmail(e.target.value)}
                                                    className="bg-surface-custom border-subtle-custom text-primary-custom placeholder:text-secondary-custom/50 fluid-rounded focus:border-[var(--accent-blue-bright)] soft-glow-hover soft-focus transition-all duration-300 pl-10 h-12"
                                                />
                                            </div>
                                            <div className="relative group">
                                                <svg className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-secondary-custom group-focus-within:text-[var(--accent-blue-bright)] transition-colors" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                                                </svg>
                                                <Input
                                                    type="password"
                                                    placeholder="Password"
                                                    value={password}
                                                    onChange={(e) => setPassword(e.target.value)}
                                                    className="bg-surface-custom border-subtle-custom text-primary-custom placeholder:text-secondary-custom/50 fluid-rounded focus:border-[var(--accent-blue-bright)] soft-glow-hover soft-focus transition-all duration-300 pl-10 h-12"
                                                />
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
                                </TabsContent>

                                <TabsContent value="signup" className="mt-0 focus-visible:ring-0 outline-none">
                                    <motion.div {...FADE_IN} className="space-y-6">
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
                                                placeholder="Email Address"
                                                value={email}
                                                onChange={(e) => setEmail(e.target.value)}
                                                className="bg-surface-custom border-subtle-custom text-primary-custom placeholder:text-secondary-custom/50 fluid-rounded focus:border-[var(--accent-blue-bright)] soft-glow-hover soft-focus transition-all duration-300 h-12"
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
                                                onClick={handleSignup}
                                                disabled={isLoading}
                                                className="w-full gradient-button text-white font-mono uppercase tracking-wider py-6 fluid-rounded soft-shadow text-lg"
                                            >
                                                {isLoading ? "REGISTERING..." : "REGISTER"}
                                            </Button>
                                        </motion.div>
                                    </motion.div>
                                </TabsContent>
                            </Tabs>
                        </motion.div>
                    </motion.div>
                )}

                {step === "otp" && (
                    <motion.div
                        key="otp"
                        layout
                        initial={{ opacity: 0, x: 50 }}
                        animate={{ opacity: 1, x: 0 }}
                        exit={{ opacity: 0, x: -50 }}
                        transition={{ duration: 0.4 }}
                        className="w-full max-w-md"
                    >
                        {/* OTP Form Content (Unchanged) */}
                        <div className="frosted-glass soft-shadow-lg border border-subtle-custom fluid-rounded-xl p-8 text-center space-y-6">
                            <h2 className="text-2xl font-mono font-bold text-primary-custom">VERIFY YOUR IDENTITY</h2>
                            <p className="text-secondary-custom">A 6-digit code has been sent to your email.</p>
                            <div className="flex justify-center space-x-3">
                                {otpCode.map((digit, index) => (
                                    <Input
                                        key={index}
                                        id={`otp-${index}`}
                                        type="text"
                                        maxLength={1}
                                        value={digit}
                                        onChange={(e) => handleOtpChange(index, e.target.value)}
                                        className="w-12 h-12 text-center bg-surface-custom border-subtle-custom text-primary-custom fluid-rounded focus:border-[var(--accent-blue-bright)] soft-glow-hover soft-focus text-lg font-mono transition-all duration-300"
                                    />
                                ))}
                            </div>
                            <div className="space-y-4">
                                <motion.div whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }}>
                                    <Button
                                        onClick={handleVerify}
                                        className="w-full gradient-button text-white font-mono uppercase tracking-wider py-3 fluid-rounded soft-shadow"
                                    >
                                        VERIFY
                                    </Button>
                                </motion.div>
                                <button className="text-[var(--accent-blue-bright)] text-sm font-mono hover:underline transition-all duration-300">
                                    Resend Code
                                </button>
                            </div>
                        </div>
                    </motion.div>
                )}
            </AnimatePresence>
        </div>
    )
}
