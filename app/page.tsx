"use client"

import { useState } from "react"
import AuthFlow from "@/components/auth-flow"
import Dashboard from "@/components/dashboard"

export default function Home() {
  const [isAuthenticated, setIsAuthenticated] = useState(false)

  return (
    <main className="min-h-screen bg-primary-custom">
      {!isAuthenticated ? <AuthFlow onAuthenticated={() => setIsAuthenticated(true)} /> : <Dashboard />}
    </main>
  )
}
