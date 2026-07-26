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

    // 1. Define Candidates (Fixed Types)
    const candidates = [
        {
            id: 'total_items',
            label: "Total Reviews",
            value: kpis.total_items || "0",
            isValid: true, // Always show
            color: "text-primary-custom"
        },
        {
            id: 'top_cluster',
            label: "Top Cluster",
            value: toTitleCase(kpis.top_cluster),
            context: "Most Frequent Issue",
            isValid: kpis.top_cluster && kpis.top_cluster !== "N/A",
            color: "text-[var(--accent-blue-bright)]"
        },
        {
            id: 'top_class',
            label: "Top Sentiment",
            value: toTitleCase(kpis.top_class),
            context: "Dominant Sentiment",
            isValid: kpis.top_class && kpis.top_class !== "N/A",
            color: "text-purple-400"
        },
        {
            id: 'avg_sentiment',
            label: "Average Polarity",
            value: kpis.avg_sentiment,
            context: "Sentiment Score",
            isValid: kpis.avg_sentiment !== null && kpis.avg_sentiment !== undefined && kpis.avg_sentiment !== "N/A",
            color: kpis.avg_sentiment < 0 ? "text-[var(--semantic-error)]" : "text-[var(--semantic-success)]"
        }
    ];

    // 2. Filter Valid
    let displayItems = candidates.filter(c => c.isValid);

    // 3. Enforce Minimum 2 (Padding)
    if (displayItems.length < 2) {
        const missing = candidates.filter(c => !c.isValid);
        for (const item of missing) {
            displayItems.push({ ...item, value: "N/A" }); // Force add back as N/A
            if (displayItems.length >= 2) break;
        }
    }

    // 4. Enforce Maximum 4 (Slice)
    displayItems = displayItems.slice(0, 4);

    // 5. Dynamic Grid Layout
    // "Card dimensions should be adjusted automatically and should sit flush"
    // We use grid-cols-N to force equal width filling the container.
    const gridCols = {
        2: "grid-cols-1 md:grid-cols-2",
        3: "grid-cols-1 md:grid-cols-3",
        4: "grid-cols-1 md:grid-cols-2 lg:grid-cols-4"
    }[displayItems.length] || "grid-cols-1 md:grid-cols-2 lg:grid-cols-4";

    return (
        <div className={`grid ${gridCols} gap-6 mb-6 w-full`}>
            {displayItems.map((item, i) => (
                <Card
                    key={i}
                    className="bg-surface-custom p-6 fluid-rounded-lg flex flex-col justify-between h-32"
                    style={{
                        border: '1px solid rgba(0, 191, 255, 0.25)',
                        boxShadow: 'inset 0 0 40px rgba(0, 191, 255, 0.05), inset 0 0 2px rgba(0, 191, 255, 0.15)',
                    }}
                >
                    <div>
                        <p className="text-secondary-custom text-xs font-mono uppercase tracking-wider mb-2">{item.label}</p>
                        <div className={cn("text-2xl font-mono font-bold truncate", item.color)}>
                            {item.value}
                        </div>
                    </div>
                    {item.context && (
                        <p className="text-secondary-custom text-xs font-mono mt-1 opacity-70">{item.context}</p>
                    )}
                </Card>
            ))}
        </div>
    );
}
