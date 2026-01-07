'use client';

import { Play, Square, RefreshCw } from 'lucide-react';
import { useApi } from '@/hooks/useApi';

interface SessionControlsProps {
    session: any;
    isRecording: boolean;
}

export default function SessionControls({
    session,
    isRecording
}: SessionControlsProps) {
    const { startSession, endSession, isLoading } = useApi();

    const handleStartSession = async () => {
        try {
            await startSession();
        } catch (error) {
            console.error('Failed to start session:', error);
        }
    };

    const handleEndSession = async () => {
        if (!session?.id) return;

        try {
            await endSession(session.id);
        } catch (error) {
            console.error('Failed to end session:', error);
        }
    };

    return (
        <div className="glass-card p-6">
            <h3 className="text-lg font-semibold text-white mb-4">Session Control</h3>

            <div className="space-y-4">
                {isRecording ? (
                    <>
                        <div className="flex items-center gap-3 p-3 rounded-lg bg-green-500/10 border border-green-500/30">
                            <div className="w-3 h-3 rounded-full bg-green-400 animate-pulse" />
                            <div>
                                <p className="text-green-400 font-medium">Recording in progress</p>
                                <p className="text-night-400 text-sm">Audio is being captured</p>
                            </div>
                        </div>

                        <button
                            onClick={handleEndSession}
                            disabled={isLoading}
                            className="w-full flex items-center justify-center gap-2 px-4 py-3 rounded-lg bg-red-500/20 hover:bg-red-500/30 text-red-400 font-medium transition-colors disabled:opacity-50"
                        >
                            <Square className="w-5 h-5" />
                            {isLoading ? 'Stopping...' : 'End Sleep Session'}
                        </button>
                    </>
                ) : (
                    <>
                        <div className="flex items-center gap-3 p-3 rounded-lg bg-night-800/50">
                            <div className="w-3 h-3 rounded-full bg-night-500" />
                            <div>
                                <p className="text-night-300">No active session</p>
                                <p className="text-night-500 text-sm">Start when going to bed</p>
                            </div>
                        </div>

                        <button
                            onClick={handleStartSession}
                            disabled={isLoading}
                            className="w-full flex items-center justify-center gap-2 px-4 py-3 rounded-lg bg-sleep-600 hover:bg-sleep-500 text-white font-medium transition-colors disabled:opacity-50 glow"
                        >
                            <Play className="w-5 h-5" />
                            {isLoading ? 'Starting...' : 'Start Sleep Session'}
                        </button>
                    </>
                )}

                {session && !isRecording && (
                    <button
                        onClick={() => window.location.reload()}
                        className="w-full flex items-center justify-center gap-2 px-4 py-2 rounded-lg bg-night-700 hover:bg-night-600 text-night-300 text-sm transition-colors"
                    >
                        <RefreshCw className="w-4 h-4" />
                        Refresh Data
                    </button>
                )}
            </div>
        </div>
    );
}
