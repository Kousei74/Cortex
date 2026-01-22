import { useState, useEffect } from "react"
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
    const [time, setTime] = useState(new Date())
    const [locationData, setLocationData] = useState({
        city: "LOCATING...",
        state: "",
        country: "",
        offset: ""
    })

    // Clock Timer
    useEffect(() => {
        const timer = setInterval(() => setTime(new Date()), 1000)
        return () => clearInterval(timer)
    }, [])

    // Geolocation and Timezone Offset
    useEffect(() => {
        // Calculate Offset
        const offsetMinutes = new Date().getTimezoneOffset()
        const sign = offsetMinutes > 0 ? "-" : "+"
        const absOffset = Math.abs(offsetMinutes)
        const hours = Math.floor(absOffset / 60).toString().padStart(2, '0')
        const minutes = (absOffset % 60).toString().padStart(2, '0')
        const offsetString = `UTC${sign}${hours}:${minutes}`

        setLocationData(prev => ({ ...prev, offset: offsetString }))

        // Get Location
        if ("geolocation" in navigator) {
            navigator.geolocation.getCurrentPosition(async (position) => {
                const { latitude, longitude } = position.coords
                try {
                    const response = await fetch(
                        `https://api.bigdatacloud.net/data/reverse-geocode-client?latitude=${latitude}&longitude=${longitude}&localityLanguage=en`
                    )
                    const data = await response.json()

                    setLocationData(prev => ({
                        ...prev,
                        city: data.locality || data.city || "UNKNOWN",
                        state: data.principalSubdivision || "",
                        country: data.countryName || ""
                    }))
                } catch (error) {
                    console.error("Error fetching location:", error)
                    setLocationData(prev => ({ ...prev, city: "UNAVAILABLE" }))
                }
            }, (error) => {
                console.error("Geolocation error:", error)
                setLocationData(prev => ({ ...prev, city: "PERMISSION DENIED" }))
            })
        } else {
            setLocationData(prev => ({ ...prev, city: "NOT SUPPORTED" }))
        }
    }, [])

    const formattedTime = time.toLocaleTimeString('en-US', {
        hour12: false,
        hour: '2-digit',
        minute: '2-digit'
    })

    return (
        <div className="h-full bg-surface-custom border-l border-subtle-custom flex flex-col">

            {/* CLOCK */}
            <div className="p-6 border-b border-subtle-custom flex flex-col items-center justify-center text-center">
                <div className="text-5xl font-mono font-bold text-primary-custom">{formattedTime}</div>
                <div className="text-secondary-custom text-sm font-mono mt-2 space-y-1">
                    <div>{locationData.offset}</div>
                    <div>
                        {locationData.city.toUpperCase()}
                        {locationData.state ? `, ${locationData.state.toUpperCase()}` : ''}
                    </div>
                    <div>{locationData.country.toUpperCase()}</div>
                </div>
            </div>

            {/* CARDS CONTAINER */}
            <div className="flex-1 flex flex-col p-4 pt-0 gap-4 overflow-hidden">

                {/* REVIEW EXPLORER CARD */}
                <Card className="bg-primary-custom border-subtle-custom flex-1 flex flex-col overflow-hidden fluid-rounded-lg soft-shadow">
                    <div className="px-4 py-3 border-b border-subtle-custom">
                        <h3 className="text-lg font-mono font-bold text-primary-custom uppercase">REVIEW EXPLORER</h3>
                    </div>
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

                {/* SLACK ALERTS CARD */}
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
