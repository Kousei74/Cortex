import { Card } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import SentimentChart from "@/components/sentiment-chart"

const topicsData = [
    { topic: "UI/UX Feedback", count: 1245 },
    { topic: "Feature Requests", count: 987 },
    { topic: "Performance Issues", count: 654 },
    { topic: "Billing Questions", count: 321 },
    { topic: "Mobile App", count: 189 },
]

const platformStatus = [
    { name: "Internal Database", status: "ONLINE" },
    { name: "Social Media API", status: "ONLINE" },
    { name: "Review Site Scraper", status: "ONLINE" },
    { name: "Support Tickets Feed", status: "ONLINE" },
]

export default function MainContent() {
    return (
        <div className="p-6 space-y-6 custom-scrollbar">
            {/* Header */}
            <div className="flex justify-between items-center">
                <div>
                    <h1 className="text-3xl font-mono font-bold text-primary-custom tracking-wider">COMMAND CENTER</h1>
                    <p className="text-secondary-custom text-sm font-mono mt-1">Last updated: 12:05</p>
                </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <Card className="bg-surface-custom border-subtle-custom border-t-4 border-t-[var(--accent-blue-bright)] p-6 fluid-rounded-lg soft-shadow">
                    <div className="space-y-2">
                        <p className="text-secondary-custom text-sm font-mono uppercase">OVERALL SENTIMENT</p>
                        <div className="flex items-center space-x-2">
                            <span className="text-3xl font-mono font-bold text-[var(--semantic-success)]">+0.68</span>
                            <span className="text-[var(--semantic-success)]">↗</span>
                        </div>
                    </div>
                </Card>

                <Card className="bg-surface-custom border-subtle-custom border-t-4 border-t-[var(--semantic-error)] p-6 fluid-rounded-lg soft-shadow">
                    <div className="space-y-2">
                        <p className="text-secondary-custom text-sm font-mono uppercase">NEGATIVE REVIEWS</p>
                        <div className="flex items-center space-x-2">
                            <span className="text-3xl font-mono font-bold text-primary-custom">642</span>
                            <span className="text-[var(--semantic-error)]">↘</span>
                        </div>
                    </div>
                </Card>

                <Card className="bg-surface-custom border-subtle-custom border-t-4 border-t-[var(--semantic-warning)] p-6 fluid-rounded-lg soft-shadow">
                    <div className="space-y-2">
                        <p className="text-secondary-custom text-sm font-mono uppercase">CRITICAL ALERTS</p>
                        <div className="flex items-center space-x-2">
                            <span className="text-3xl font-mono font-bold text-primary-custom">4</span>
                            <span className="text-secondary-custom text-sm">THIS WEEK</span>
                            <span className="text-[var(--semantic-warning)]">⚠</span>
                        </div>
                    </div>
                </Card>
            </div>

            <Card className="bg-surface-custom border-subtle-custom p-6 fluid-rounded-lg soft-shadow">
                <div className="flex justify-between items-center mb-6">
                    <h2 className="text-xl font-mono font-bold text-primary-custom uppercase">SENTIMENT OVER TIME</h2>
                    <div className="flex space-x-2">
                        <Button
                            variant="ghost"
                            size="sm"
                            className="text-secondary-custom font-mono fluid-rounded hover:bg-surface-custom transition-all duration-300"
                        >
                            WEEK
                        </Button>
                        <Button
                            size="sm"
                            className="gradient-button text-white font-mono fluid-rounded soft-shadow transition-all duration-300"
                        >
                            MONTH
                        </Button>
                        <Button
                            variant="ghost"
                            size="sm"
                            className="text-secondary-custom font-mono fluid-rounded hover:bg-surface-custom transition-all duration-300"
                        >
                            YEAR
                        </Button>
                    </div>
                </div>
                <SentimentChart />
            </Card>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {/* Top Discussed Topics */}
                <Card className="bg-surface-custom border-subtle-custom p-6 fluid-rounded-lg soft-shadow">
                    <h2 className="text-xl font-mono font-bold text-primary-custom uppercase mb-6">TOP DISCUSSED TOPICS</h2>
                    <div className="space-y-4">
                        {topicsData.map((item, index) => (
                            <div key={index} className="flex justify-between items-center">
                                <div className="flex items-center space-x-3">
                                    <span className="text-secondary-custom font-mono text-sm">{index + 1}.</span>
                                    <span className="text-primary-custom font-mono">{item.topic}</span>
                                </div>
                                <span className="text-secondary-custom font-mono text-sm">{item.count}</span>
                            </div>
                        ))}
                    </div>
                </Card>

                {/* Platform Status */}
                <Card className="bg-surface-custom border-subtle-custom p-6 fluid-rounded-lg soft-shadow">
                    <h2 className="text-xl font-mono font-bold text-primary-custom uppercase mb-6">PLATFORM STATUS</h2>
                    <div className="space-y-4">
                        {platformStatus.map((item, index) => (
                            <div key={index} className="flex justify-between items-center">
                                <span className="text-primary-custom font-mono">{item.name}</span>
                                <span className="text-[var(--semantic-success)] font-mono text-sm bg-[var(--semantic-success)] bg-opacity-20 px-2 py-1 fluid-rounded">
                                    {item.status}
                                </span>
                            </div>
                        ))}
                    </div>
                </Card>
            </div>
        </div>
    )
}
