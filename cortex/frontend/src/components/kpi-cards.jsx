import { Card } from "@/components/ui/card";
import { cn } from "@/lib/utils";

// Helper
const toTitleCase = (str) => {
    if (!str) return '';
    return String(str).toLowerCase().replace(/(?:^|\s|-)\S/g, match => match.toUpperCase());
};

export function KpiCardsRow({ meta }) {
    if (!meta || !meta.kpis) return null;

    const { kpis } = meta;

    // Default structure if keys missing? Backend guarantees presence in theory, but safety first.
    const items = [
        {
            label: kpis.top_metric_label || "Total Items",
            value: kpis.total_items || kpis.top_metric_value || "0",
            trend: kpis.velocity_trend || "N/A", // "UP", "DOWN" or null
            color: "text-primary-custom"
        },
        {
            label: "Top Cluster",
            value: toTitleCase(kpis.top_cluster || "N/A"),
            subtext: "Most Frequent Issue",
            color: "text-[var(--accent-blue-bright)]"
        },
        {
            label: "Top Class",
            value: toTitleCase(kpis.top_class || "N/A"),
            subtext: "Dominant Sentiment",
            color: "text-purple-400"
        },
        {
            label: "Avg Sentiment",
            value: kpis.avg_sentiment || "N/A",
            subtext: "Sentiment Score",
            color: kpis.avg_sentiment < 0 ? "text-[var(--semantic-error)]" : "text-[var(--semantic-success)]"
        }
    ];

    return (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-6">
            {items.map((item, i) => (
                <Card key={i} className="bg-surface-custom border-subtle-custom p-6 fluid-rounded-lg soft-shadow flex flex-col justify-between">
                    <div>
                        <p className="text-secondary-custom text-xs font-mono uppercase tracking-wider mb-2">{item.label}</p>
                        <div className={cn("text-2xl font-mono font-bold truncate", item.color)}>
                            {item.value}
                        </div>
                    </div>
                    {item.subtext && (
                        <p className="text-secondary-custom text-xs font-mono mt-2">{item.subtext}</p>
                    )}
                    {item.trend && item.trend !== "N/A" && (
                        <div className="flex items-center mt-2">
                            <span className={cn(
                                "text-xs font-bold mr-1",
                                item.trend === "UP" ? "text-green-500" : "text-red-500"
                            )}>
                                {item.trend === "UP" ? "↗" : "↘"}
                            </span>
                            <span className="text-xs text-secondary-custom font-mono">TRENDING {item.trend}</span>
                        </div>
                    )}
                </Card>
            ))}
        </div>
    );
}
