import { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';

const CHANNEL_NAME = 'cortex_session_lock';
const MESSAGE_NEW_INSTANCE = 'NEW_INSTANCE';
const MESSAGE_CLAIM_LOCK = 'CLAIM_LOCK';

export default function SingleInstanceLock() {
    const [isLocked, setIsLocked] = useState(false);
    const [channel, setChannel] = useState(null);

    useEffect(() => {
        const bc = new BroadcastChannel(CHANNEL_NAME);
        setChannel(bc);

        // Listen for messages
        bc.onmessage = (event) => {
            if (event.data === MESSAGE_NEW_INSTANCE) {
                // A new instance has opened, lock this one
                setIsLocked(true);
            } else if (event.data === MESSAGE_CLAIM_LOCK) {
                // Another instance claimed the lock, this one must lock
                setIsLocked(true);
            }
        };

        // Announce presence to lock other tabs
        bc.postMessage(MESSAGE_NEW_INSTANCE);

        return () => {
            bc.close();
        };
    }, []);

    const handleResumeHere = () => {
        if (channel) {
            // Tell others to lock
            channel.postMessage(MESSAGE_CLAIM_LOCK);
            setIsLocked(false);
        }
    };

    return (
        <AnimatePresence>
            {isLocked && (
                <motion.div
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    transition={{ duration: 0.3 }}
                    className="fixed inset-0 z-50 flex items-center justify-center bg-background/80 backdrop-blur-md p-4"
                >
                    <div className="max-w-md w-full bg-card border border-border rounded-xl shadow-2xl p-8 text-center space-y-6 relative overflow-hidden">
                        {/* Decorative background element */}
                        <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-transparent via-primary-custom to-transparent" />

                        <div className="space-y-2">
                            <h2 className="text-2xl font-bold tracking-tight text-foreground">Cortex Active Elsewhere</h2>
                            <p className="text-muted-foreground">
                                To prevent data corruption, Cortex allows only one active tab at a time.
                            </p>
                        </div>

                        <div className="py-4">
                            <div className="w-16 h-16 mx-auto rounded-full bg-secondary-custom/20 flex items-center justify-center animate-pulse">
                                <span className="text-3xl">🔒</span>
                            </div>
                        </div>

                        <button
                            onClick={handleResumeHere}
                            className="w-full py-3 px-4 bg-primary-custom hover:bg-primary-custom/90 text-white font-medium rounded-lg transition-colors focus:outline-none focus:ring-2 focus:ring-primary-custom/50 focus:ring-offset-2 flex items-center justify-center gap-2"
                        >
                            <span>Resume Here</span>
                            <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                <path d="M5 12h14" />
                                <path d="m12 5 7 7-7 7" />
                            </svg>
                        </button>
                    </div>
                </motion.div>
            )}
        </AnimatePresence>
    );
}
