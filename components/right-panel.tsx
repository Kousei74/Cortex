"use client"

import { Card } from "@/components/ui/card"

// Mock data remains the same
const reviewData = [
  {
    type: "NEG",
    text: "The new update is a disaster. It's slow and constantly crashes.",
    time: "2 MIN AGO",
  },
  {
    type: "NEG",
    text: "I've been a customer for years, but the recent changes are making me consider switching.",
    time: "5 MIN AGO",
  },
  {
    type: "NEG",
    text: "Customer support was not helpful at all with my issue.",
    time: "8 MIN AGO",
  },
]

const slackAlerts = [
  {
    type: "critical",
    text: "Spike in 500 errors detected on the main server.",
    channel: "#alerts",
  },
  {
    type: "feedback",
    text: "User mentioned a potential security vulnerability.",
    channel: "#security",
  },
  {
    type: "general",
    text: "Reminder to review the latest product roadmap document.",
    channel: "#product",
  },
]

export default function RightPanel() {
  return (
    // The main container is a flex column that fills the entire height.
    <div className="h-full bg-surface-custom border-l border-subtle-custom flex flex-col">
      
      {/* CLOCK: This section remains as a non-flexible part of the layout. */}
      <div className="p-6 border-b border-subtle-custom flex flex-col items-center justify-center text-center">
        <div className="text-5xl font-mono font-bold text-primary-custom">4:22 AM</div>
        <div className="text-secondary-custom text-sm font-mono mt-2 space-y-1">
          <div>SEPTEMBER 17, 2025</div>
          <div>MANIPAL, INDIA</div>
          <div className="text-xs opacity-70">UTC+5:30</div>
        </div>
      </div>

      {/* CARDS CONTAINER: This new container will grow to fill the remaining vertical space. */}
      {/* Spacing is controlled here: p-4 for outside padding, gap-4 for between cards. */}
      {/* pt-0 removes the extra space at the top, right below the clock's border. */}
      <div className="flex-1 flex flex-col p-4 pt-0 gap-4 overflow-hidden">
        
        {/* REVIEW EXPLORER CARD: flex-1 allows it to take up half of the available space. */}
        {/* Added overflow-hidden to ensure it respects the parent's boundaries. */}
        <Card className="bg-primary-custom border-subtle-custom flex-1 flex flex-col overflow-hidden fluid-rounded-lg soft-shadow">
          <div className="px-4 py-3 border-b border-subtle-custom">
            <h3 className="text-lg font-mono font-bold text-primary-custom uppercase">REVIEW EXPLORER</h3>
          </div>
          {/* SCROLLABLE CONTENT: This div handles internal scrolling. */}
          {/* Increased space-y to 4 for better visual separation inside the card. */}
          <div className="flex-1 overflow-auto p-4 space-y-4 custom-scrollbar">
            {reviewData.map((review, index) => (
              <div key={index} className="space-y-2">
                <div className="flex items-center space-x-2">
                  <div className="w-6 h-6 bg-[var(--semantic-error)] fluid-rounded flex items-center justify-center flex-shrink-0">
                    <span className="text-white text-[8px] font-bold font-mono">NEW</span>
                  </div>
                  <span className="text-[var(--semantic-error)] font-mono text-xs font-bold">{review.type}</span>
                  <span className="text-secondary-custom text-xs font-mono">{review.time}</span>
                </div>
                <p className="text-primary-custom text-sm leading-relaxed">{review.text}</p>
              </div>
            ))}
          </div>
        </Card>

        {/* SLACK ALERTS CARD: flex-1 allows it to take up the other half of the available space. */}
        <Card className="bg-primary-custom border-subtle-custom flex-1 flex flex-col overflow-hidden fluid-rounded-lg soft-shadow">
          <div className="px-4 py-3 border-b border-subtle-custom">
            <h3 className="text-lg font-mono font-bold text-primary-custom uppercase">SLACK ALERTS</h3>
          </div>
          <div className="flex-1 overflow-auto p-4 space-y-4 custom-scrollbar">
            {slackAlerts.map((alert, index) => (
              <div key={index} className="space-y-2">
                <div className="flex items-center space-x-2">
                  <span className="text-[var(--accent-blue-bright)]">#</span>
                  <span className="text-secondary-custom text-xs font-mono">{alert.channel}</span>
                </div>
                <p className="text-primary-custom text-sm leading-relaxed">
                  <span className="font-mono font-bold text-secondary-custom">#{alert.type}:</span> {alert.text}
                </p>
              </div>
            ))}
          </div>
        </Card>
      </div>
    </div>
  )
}
