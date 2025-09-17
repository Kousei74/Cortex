"use client"

import { useState } from "react"
import { Button } from "@/components/ui/button"

const menuItems = [
  {
    id: "command",
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
    active: true,
  },
  {
    id: "product",
    label: "PRODUCT PULSE",
    icon: (
      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
      </svg>
    ),
    active: false,
  },
  {
    id: "service",
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
    active: false,
  },
  {
    id: "integrations",
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
    active: false,
  },
]

export default function Sidebar() {
  const [activeItem, setActiveItem] = useState("command")

  return (
    <div className="h-full bg-surface-custom border-r border-subtle-custom flex flex-col">
      {/* Header */}
      <div className="p-6 border-b border-subtle-custom">
        <h1 className="text-2xl font-mono font-bold text-primary-custom tracking-wider">CORTEX</h1>
        <p className="text-xs text-secondary-custom mt-1 font-mono">Customer Insights OS</p>
      </div>

      <nav className="flex-1 p-4 space-y-6">
        {menuItems.map((item) => (
          <Button
            key={item.id}
            variant="ghost"
            onClick={() => setActiveItem(item.id)}
            className={`w-full justify-start text-left font-mono text-sm fluid-rounded p-4 transition-all duration-300 ${
              activeItem === item.id
                ? "bg-[var(--accent-blue-dark)] text-[var(--accent-blue-bright)] border-l-4 border-[var(--accent-blue-bright)] soft-glow"
                : "text-secondary-custom hover:text-primary-custom hover:bg-surface-custom hover:soft-shadow"
            }`}
          >
            <span className="mr-4">{item.icon}</span>
            {item.label}
          </Button>
        ))}
      </nav>

      <div className="p-4 border-t border-subtle-custom">
        <div className="flex items-center space-x-3 p-3 fluid-rounded bg-surface-custom soft-shadow">
          <div className="w-10 h-10 bg-[var(--accent-blue-dark)] fluid-rounded flex items-center justify-center">
            <span className="text-[var(--accent-blue-bright)] font-mono font-bold text-sm">AD</span>
          </div>
          <div className="flex-1">
            <div className="text-sm font-mono font-bold text-primary-custom">Ankit Deepansh</div>
            <div className="text-xs text-secondary-custom font-mono">Data Analyst</div>
          </div>
          <svg
            className="w-4 h-4 text-secondary-custom hover:text-primary-custom cursor-pointer transition-colors"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z"
            />
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
          </svg>
        </div>
      </div>
    </div>
  )
}
