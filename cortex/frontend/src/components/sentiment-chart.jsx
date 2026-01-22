import { XAxis, YAxis, ResponsiveContainer, Area, AreaChart } from "recharts"

const data = [
    { name: "Jan", value: 400 },
    { name: "Feb", value: 600 },
    { name: "Mar", value: 800 },
    { name: "Apr", value: 1200 },
    { name: "May", value: 1600 },
    { name: "Jun", value: 2200 },
    { name: "Jul", value: 2800 },
    { name: "Aug", value: 3400 },
    { name: "Sep", value: 4200 },
    { name: "Oct", value: 5000 },
]

export default function SentimentChart() {
    return (
        <div className="h-64 w-full">
            <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={data}>
                    <defs>
                        <linearGradient id="sentimentGradient" x1="0" y1="0" x2="0" y2="1">
                            <stop offset="5%" stopColor="var(--accent-blue-bright)" stopOpacity={0.3} />
                            <stop offset="95%" stopColor="var(--accent-blue-dark)" stopOpacity={0.1} />
                        </linearGradient>
                    </defs>
                    <XAxis
                        dataKey="name"
                        axisLine={false}
                        tickLine={false}
                        tick={{ fill: "var(--text-secondary)", fontSize: 12, fontFamily: "monospace" }}
                    />
                    <YAxis
                        axisLine={false}
                        tickLine={false}
                        tick={{ fill: "var(--text-secondary)", fontSize: 12, fontFamily: "monospace" }}
                    />
                    <Area
                        type="monotone"
                        dataKey="value"
                        stroke="var(--accent-blue-bright)"
                        strokeWidth={2}
                        fill="url(#sentimentGradient)"
                    />
                </AreaChart>
            </ResponsiveContainer>
        </div>
    )
}
