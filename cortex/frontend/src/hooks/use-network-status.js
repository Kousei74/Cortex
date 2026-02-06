
import { useState, useEffect } from 'react';
import { toast } from 'sonner';

export function useNetworkStatus() {
    const [isOnline, setIsOnline] = useState(navigator.onLine);

    useEffect(() => {
        const handleOnline = () => {
            setIsOnline(true);
            toast.success("Connection Restored", {
                description: "Resuming background synchronization..."
            });
        };

        const handleOffline = () => {
            setIsOnline(false);
            toast.warning("Connection Lost", {
                description: "Changes will be queued locally.",
                duration: Infinity, // Keep distinct until back
                id: 'offline-toast' // prevent duplicates
            });
        };

        window.addEventListener('online', handleOnline);
        window.addEventListener('offline', handleOffline);

        return () => {
            window.removeEventListener('online', handleOnline);
            window.removeEventListener('offline', handleOffline);
        };
    }, []);

    return isOnline;
}
