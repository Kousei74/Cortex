"use client"
import Sidebar from "@/components/sidebar"
import MainContent from "@/components/main-content"
import RightPanel from "@/components/right-panel"

export default function Dashboard() {
  return (
    <div className="h-screen bg-primary-custom flex overflow-hidden">
      {/* Fixed Left Sidebar */}
      <div className="w-64 flex-shrink-0">
        <Sidebar />
      </div>

      <div className="flex-1 overflow-y-auto custom-scrollbar">
        <MainContent />
      </div>

      {/* Fixed Right Panel */}
      <div className="w-80 flex-shrink-0">
        <RightPanel />
      </div>
    </div>
  )
}
