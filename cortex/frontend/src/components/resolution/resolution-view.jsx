import { useEffect, useState } from 'react';
import { useResolution } from '@/hooks/use-resolution';
import { Card } from '@/components/ui/card';
import { CheckCircle, AlertOctagon } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';

export function ResolutionView({ jobId, lastUpdated }) {
    const { fetchClusterRows, resolveItems } = useResolution(jobId);
    const [rows, setRows] = useState([]);
    const [isLoading, setIsLoading] = useState(true);

    useEffect(() => {
        let mounted = true;
        const load = async () => {
            setIsLoading(true);
            const data = await fetchClusterRows('all');
            if (mounted) {
                if (data.error) {
                    // toast.error(`Sync Error: ${data.error}`);
                    setRows([]);
                } else {
                    setRows(data);
                }
                setIsLoading(false);
            }
        };
        load();
        return () => { mounted = false; };
    }, [jobId, lastUpdated]);

    const handleResolve = async (id) => {
        await resolveItems([id]);
        setRows(prev => prev.map(r => r.id === id ? { ...r, status: 'RESOLVED' } : r));
    };

    if (isLoading) return <div className="p-8 text-center text-gray-500 font-mono">Loading data stream...</div>;

    if (rows.length === 0) {
        return (
            <div className="p-12 text-center border-2 border-dashed border-subtle-custom rounded-lg bg-gray-50/50">
                <p className="text-secondary-custom font-mono">NO ACTIVE RESOLUTION LINKS DETECTED.</p>
            </div>
        )
    }

    return (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 pb-20">
            {rows.map((row) => {
                const isResolved = row.status === 'RESOLVED';
                return (
                    <Card
                        key={row.id}
                        className={cn(
                            "p-4 border-l-4 transition-all duration-300",
                            isResolved
                                ? "bg-gray-50 border-l-green-500 opacity-60"
                                : "bg-white border-l-[var(--accent-blue-bright)] soft-shadow hover:shadow-md"
                        )}
                    >
                        <div className="flex justify-between items-start mb-2">
                            <span className="text-xs font-mono text-secondary-custom uppercase tracking-wider bg-surface-custom px-2 py-0.5 rounded">
                                {row.cluster}
                            </span>
                            {isResolved ? (
                                <CheckCircle className="w-5 h-5 text-green-500" />
                            ) : (
                                <AlertOctagon className="w-5 h-5 text-[var(--semantic-error)]" />
                            )}
                        </div>

                        <h4 className={cn("font-medium mb-3", isResolved && "text-gray-500 line-through")}>
                            {row.title}
                        </h4>

                        <div className="flex justify-between items-center text-xs font-mono text-secondary-custom mb-4">
                            <span>CONF: {(row.confidence * 100).toFixed(0)}%</span>
                            <span>SENT: {row.sentiment?.toFixed(2)}</span>
                        </div>

                        {!isResolved && (
                            <Button
                                size="sm"
                                className="w-full bg-white border border-subtle-custom hover:bg-gray-50 text-primary-custom"
                                onClick={() => handleResolve(row.id)}
                            >
                                RESOLVE ISSUE
                            </Button>
                        )}
                    </Card>
                );
            })}
        </div>
    );
}
