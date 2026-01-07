'use client';

import { useState, useEffect } from 'react';
import { Calendar, ChevronRight, Moon } from 'lucide-react';
import { useApi } from '@/hooks/useApi';

interface Session {
    id: string;
    date: string;
    duration_minutes: number;
    efficiency_score: number | null;
}

export default function RecentSessions() {
    const { fetchSessions } = useApi();
    const [sessions, setSessions] = useState<Session[]>([]);
    const [isLoading, setIsLoading] = useState(true);

    useEffect(() => {
        const loadSessions = async () => {
            try {
                const data = await fetchSessions(7);
                setSessions(data);
            } catch (error) {
                console.error('Failed to load sessions:', error);
            } finally {
                setIsLoading(false);
            }
        };

        loadSessions();
    }, [fetchSessions]);

    const formatDate = (dateStr: string) => {
        const date = new Date(dateStr);
        const today = new Date();
        const yesterday = new Date(today);
        yesterday.setDate(yesterday.getDate() - 1);

        if (date.toDateString() === today.toDateString()) {
            return 'Today';
        }
        if (date.toDateString() === yesterday.toDateString()) {
            return 'Yesterday';
        }
        return date.toLocaleDateString('en-US', {
            weekday: 'short',
            month: 'short',
            day: 'numeric'
        });
    };

    const formatDuration = (minutes: number) => {
        const hours = Math.floor(minutes / 60);
        const mins = minutes % 60;
        return `${hours}h ${mins}m`;
    };

    const getScoreColor = (score: number | null) => {
        if (!score) return 'text-night-400';
        if (score >= 85) return 'text-green-400';
        if (score >= 70) return 'text-yellow-400';
        if (score >= 50) return 'text-orange-400';
        return 'text-red-400';
    };

    return (
        <div className="glass-card p-6">
            <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-semibold text-white flex items-center gap-2">
                    <Calendar className="w-5 h-5 text-sleep-400" />
                    History
                </h3>
                <button className="text-sleep-400 hover:text-sleep-300 text-sm flex items-center gap-1">
                    View all
                    <ChevronRight className="w-4 h-4" />
                </button>
            </div>

            {isLoading ? (
                <div className="space-y-3">
                    {[...Array(3)].map((_, i) => (
                        <div key={i} className="p-3 rounded-lg bg-night-800/30 animate-pulse">
                            <div className="h-4 bg-night-700 rounded w-1/3 mb-2" />
                            <div className="h-3 bg-night-700 rounded w-1/2" />
                        </div>
                    ))}
                </div>
            ) : sessions.length === 0 ? (
                <div className="text-center py-8">
                    <Moon className="w-10 h-10 text-night-600 mx-auto mb-3" />
                    <p className="text-night-400">No sleep data yet</p>
                    <p className="text-night-500 text-sm">Start tracking tonight!</p>
                </div>
            ) : (
                <div className="space-y-2">
                    {sessions.map((session) => (
                        <button
                            key={session.id}
                            className="w-full p-3 rounded-lg bg-night-800/30 hover:bg-night-800/50 transition-colors text-left group"
                        >
                            <div className="flex items-center justify-between mb-1">
                                <span className="text-white font-medium">
                                    {formatDate(session.date)}
                                </span>
                                <span className={`text-lg font-bold ${getScoreColor(session.efficiency_score)}`}>
                                    {session.efficiency_score ? `${Math.round(session.efficiency_score)}%` : '—'}
                                </span>
                            </div>
                            <div className="flex items-center justify-between text-sm">
                                <span className="text-night-400">
                                    {formatDuration(session.duration_minutes)}
                                </span>
                                <ChevronRight className="w-4 h-4 text-night-600 group-hover:text-night-400 transition-colors" />
                            </div>
                        </button>
                    ))}
                </div>
            )}
        </div>
    );
}
