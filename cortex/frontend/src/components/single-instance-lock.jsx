import { useEffect, useRef, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useTabLockStore } from '@/store/tabLockStore';
import { useAuth } from '@/context/AuthContext';

const CHANNEL_NAME = 'cortex_session_lock';
const MESSAGE_CLAIM_LOCK = 'CLAIM_LOCK';
const ACTIVE_TAB_STORAGE_KEY_PREFIX = 'cortex_active_tab_id';

export default function SingleInstanceLock() {
    const [isLocked, setIsLocked] = useState(false);
    const channelRef = useRef(null);
    const tabIdRef = useRef(crypto.randomUUID());
    const setGlobalLocked = useTabLockStore(state => state.setLocked);
    const { user, isAuthenticated } = useAuth();

    const userLockScope = user?.emp_id || user?.email || null;
    const activeTabStorageKey = userLockScope ? `${ACTIVE_TAB_STORAGE_KEY_PREFIX}:${userLockScope}` : null;

    const applyLockState = (locked) => {
        setIsLocked(locked);
        setGlobalLocked(locked);
    };

    const claimActiveTab = () => {
        if (!activeTabStorageKey) {
            applyLockState(false);
            return;
        }
        const tabId = tabIdRef.current;
        localStorage.setItem(activeTabStorageKey, tabId);
        channelRef.current?.postMessage({ type: MESSAGE_CLAIM_LOCK, tabId, scope: activeTabStorageKey });
        applyLockState(false);
    };

    useEffect(() => {
        if (!isAuthenticated || !activeTabStorageKey) {
            applyLockState(false);
            return undefined;
        }

        const bc = new BroadcastChannel(CHANNEL_NAME);
        channelRef.current = bc;

        bc.onmessage = (event) => {
            if (
                event.data?.type === MESSAGE_CLAIM_LOCK &&
                event.data?.scope === activeTabStorageKey &&
                event.data.tabId !== tabIdRef.current
            ) {
                applyLockState(true);
            }
        };

        const handleStorage = (event) => {
            if (event.key !== activeTabStorageKey) {
                return;
            }

            if (!event.newValue) {
                applyLockState(false);
                return;
            }

            applyLockState(event.newValue !== tabIdRef.current);
        };

        window.addEventListener('storage', handleStorage);

        claimActiveTab();

        return () => {
            window.removeEventListener('storage', handleStorage);
            if (localStorage.getItem(activeTabStorageKey) === tabIdRef.current) {
                localStorage.removeItem(activeTabStorageKey);
            }
            bc.close();
        };
    }, [activeTabStorageKey, isAuthenticated]);

    const handleResumeHere = () => {
        claimActiveTab();
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
                                This account is already active in another tab. Resume here only if you want this session to take over.
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
