
import React from 'react';
import { Button } from '@/components/ui/button';
import { clear } from 'idb-keyval';

export class GlobalErrorBoundary extends React.Component {
    constructor(props) {
        super(props);
        this.state = { hasError: false, error: null, errorInfo: null };
    }

    static getDerivedStateFromError(error) {
        return { hasError: true, error };
    }

    componentDidCatch(error, errorInfo) {
        console.error("Uncaught error:", error, errorInfo);
        this.setState({ errorInfo });
    }

    handleReset = async () => {
        // Aggressive cleanup
        localStorage.clear();
        try {
            await clear(); // Clear IndexedDB
        } catch (e) {
            console.error("Failed to clear IDB", e);
        }
        window.location.reload();
    }

    render() {
        if (this.state.hasError) {
            return (
                <div className="min-h-screen bg-[#111317] text-[#ff3b30] p-10 font-mono flex flex-col items-center justify-center text-center">
                    <h1 className="text-4xl font-bold mb-4">SYSTEM CRITICAL FAILURE</h1>
                    <div className="bg-[#1a1c20] p-6 rounded-lg border border-[#ff3b30]/30 max-w-3xl w-full text-left overflow-auto max-h-[60vh] custom-scrollbar mb-8">
                        <h2 className="text-xl mb-2 text-[#eaeaea]">Error Log:</h2>
                        <pre className="text-sm break-words whitespace-pre-wrap mb-4">
                            {this.state.error && this.state.error.toString()}
                        </pre>
                        <h3 className="text-lg mb-2 text-[#eaeaea]">Component Stack:</h3>
                        <pre className="text-xs text-[#8a8a8e] break-words whitespace-pre-wrap">
                            {this.state.errorInfo && this.state.errorInfo.componentStack}
                        </pre>
                    </div>

                    <div className="flex gap-4">
                        <Button
                            onClick={this.handleReset}
                            className="bg-[#ff3b30] text-white hover:bg-[#ff3b30]/80"
                        >
                            EMERGENCY RESET (CLEAR STORAGE)
                        </Button>
                        <Button
                            onClick={() => window.location.reload()}
                            variant="outline"
                            className="border-[#eaeaea] text-[#eaeaea] hover:bg-[#eaeaea]/10"
                        >
                            ATTEMPT RELOAD
                        </Button>
                    </div>
                </div>
            );
        }

        return this.props.children;
    }
}
