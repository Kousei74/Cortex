"use client"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"

interface AuthFlowProps {
  onAuthenticated: () => void
}

type AuthStep = "initial" | "form" | "otp"

export default function AuthFlow({ onAuthenticated }: AuthFlowProps) {
  const [step, setStep] = useState<AuthStep>("initial")
  const [otpCode, setOtpCode] = useState(["", "", "", "", "", ""])
  const [email, setEmail] = useState("")

  const handleOtpChange = (index: number, value: string) => {
    if (value.length <= 1) {
      const newOtp = [...otpCode]
      newOtp[index] = value
      setOtpCode(newOtp)

      // Auto-focus next input
      if (value && index < 5) {
        const nextInput = document.getElementById(`otp-${index + 1}`)
        nextInput?.focus()
      }
    }
  }

  const handleVerify = () => {
    // Simulate verification
    setTimeout(() => {
      setStep("form")
      setOtpCode(["", "", "", "", "", ""])
    }, 1000)
  }

  const handleSignup = () => {
    setStep("otp")
  }

  return (
    <div className="min-h-screen bg-primary-custom flex items-center justify-center p-4">
      {step === "initial" && (
        <div className="text-center space-y-8 animate-in fade-in duration-500">
          <div className="space-y-4">
            <h1 className="text-6xl font-mono font-bold text-primary-custom tracking-wider">CORTEX</h1>
            <p className="text-secondary-custom text-lg max-w-md mx-auto">
              Translate customer chaos into actionable clarity.
            </p>
          </div>
          <Button
            onClick={() => setStep("form")}
            className="gradient-button text-white font-mono uppercase tracking-wider px-12 py-4 rounded-full hover:opacity-90 transition-all duration-500 soft-shadow-lg"
          >
            INITIATE CONNECTION
          </Button>
        </div>
      )}

      {step === "form" && (
        <div className="w-full max-w-md animate-in fade-in duration-500">
          <div className="frosted-glass soft-shadow-lg border border-subtle-custom fluid-rounded-xl p-8">
            <Tabs defaultValue="login" className="w-full">
              <TabsList className="grid w-full grid-cols-2 bg-transparent border-b border-subtle-custom rounded-none mb-2">
                <TabsTrigger
                  value="login"
                  className="text-primary-custom data-[state=active]:text-[var(--accent-blue-bright)] data-[state=active]:border-b-2 data-[state=active]:border-[var(--accent-blue-bright)] rounded-none bg-transparent pb-3 transition-all duration-300 font-medium border-b-2 border-transparent hover:border-[var(--accent-blue-bright)] hover:border-opacity-50"
                >
                  Login
                </TabsTrigger>
                <TabsTrigger
                  value="signup"
                  className="text-primary-custom data-[state=active]:text-[var(--accent-blue-bright)] data-[state=active]:border-b-2 data-[state=active]:border-[var(--accent-blue-bright)] rounded-none bg-transparent pb-3 transition-all duration-300 font-medium border-b-2 border-transparent hover:border-[var(--accent-blue-bright)] hover:border-opacity-50"
                >
                  Sign Up
                </TabsTrigger>
              </TabsList>

              <TabsContent value="login" className="space-y-6 mt-8">
                <h2 className="text-2xl font-mono font-bold text-primary-custom text-center">LOGIN</h2>
                <div className="space-y-4">
                  <div className="relative">
                    <svg
                      className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-secondary-custom"
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z"
                      />
                    </svg>
                    <Input
                      type="email"
                      placeholder="Email Address"
                      className="bg-surface-custom border-subtle-custom text-primary-custom placeholder:text-secondary-custom fluid-rounded focus:border-[var(--accent-blue-bright)] soft-glow-hover soft-focus transition-all duration-300 pl-10"
                    />
                  </div>
                  <div className="relative">
                    <svg
                      className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-secondary-custom"
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z"
                      />
                    </svg>
                    <Input
                      type="password"
                      placeholder="Password"
                      className="bg-surface-custom border-subtle-custom text-primary-custom placeholder:text-secondary-custom fluid-rounded focus:border-[var(--accent-blue-bright)] soft-glow-hover soft-focus transition-all duration-300 pl-10"
                    />
                  </div>
                </div>
                <Button
                  onClick={onAuthenticated}
                  className="w-full gradient-button text-white font-mono uppercase tracking-wider py-3 fluid-rounded hover:opacity-90 transition-all duration-300 soft-shadow"
                >
                  AUTHENTICATE
                </Button>
                <Button
                  variant="outline"
                  className="w-full bg-transparent border-subtle-custom text-primary-custom hover:bg-surface-custom fluid-rounded font-mono transition-all duration-300"
                >
                  <svg className="w-5 h-5 mr-2" viewBox="0 0 24 24">
                    <path
                      fill="currentColor"
                      d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                    />
                    <path
                      fill="currentColor"
                      d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77C17.45 20.53 14.97 23 12 23 7.7 23 3.99 20.53 2.18 17.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
                    />
                    <path
                      fill="currentColor"
                      d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
                    />
                    <path
                      fill="currentColor"
                      d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
                    />
                  </svg>
                  Sign in with Google
                </Button>
              </TabsContent>

              <TabsContent value="signup" className="space-y-6 mt-8">
                <h2 className="text-2xl font-mono font-bold text-primary-custom text-center">CREATE ACCOUNT</h2>
                <div className="space-y-4">
                  <Input
                    type="text"
                    placeholder="Full Name"
                    className="bg-surface-custom border-subtle-custom text-primary-custom placeholder:text-secondary-custom fluid-rounded focus:border-[var(--accent-blue-bright)] soft-glow-hover soft-focus transition-all duration-300"
                  />
                  <Input
                    type="email"
                    placeholder="Email Address"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="bg-surface-custom border-subtle-custom text-primary-custom placeholder:text-secondary-custom fluid-rounded focus:border-[var(--accent-blue-bright)] soft-glow-hover soft-focus transition-all duration-300"
                  />
                  <Input
                    type="password"
                    placeholder="Password"
                    className="bg-surface-custom border-subtle-custom text-primary-custom placeholder:text-secondary-custom fluid-rounded focus:border-[var(--accent-blue-bright)] soft-glow-hover soft-focus transition-all duration-300"
                  />
                  <Input
                    type="password"
                    placeholder="Confirm Password"
                    className="bg-surface-custom border-subtle-custom text-primary-custom placeholder:text-secondary-custom fluid-rounded focus:border-[var(--accent-blue-bright)] soft-glow-hover soft-focus transition-all duration-300"
                  />
                </div>
                <Button
                  onClick={handleSignup}
                  className="w-full gradient-button text-white font-mono uppercase tracking-wider py-3 fluid-rounded hover:opacity-90 transition-all duration-300 soft-shadow"
                >
                  REGISTER
                </Button>
              </TabsContent>
            </Tabs>
          </div>
        </div>
      )}

      {step === "otp" && (
        <div className="w-full max-w-md animate-in fade-in duration-500">
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
              <Button
                onClick={handleVerify}
                className="w-full gradient-button text-white font-mono uppercase tracking-wider py-3 fluid-rounded hover:opacity-90 transition-all duration-300 soft-shadow"
              >
                VERIFY
              </Button>
              <button className="text-[var(--accent-blue-bright)] text-sm font-mono hover:underline transition-all duration-300">
                Resend Code
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
