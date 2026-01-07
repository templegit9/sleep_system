'use client';

import { useMemo } from 'react';
import { Moon, Clock, BedDouble, Sun } from 'lucide-react';

interface SleepScoreCardProps {
    score?: number | null;
    duration?: number;
    bedTime?: string;
    wakeTime?: string;
}

export default function SleepScoreCard({
    score,
    duration,
    bedTime,
    wakeTime
}: SleepScoreCardProps) {
    const scoreColor = useMemo(() => {
        if (!score) return 'text-night-400';
        if (score >= 85) return 'text-green-400';
        if (score >= 70) return 'text-yellow-400';
        if (score >= 50) return 'text-orange-400';
        return 'text-red-400';
    }, [score]);

    const strokeColor = useMemo(() => {
        if (!score) return '#475569';
        if (score >= 85) return '#4ade80';
        if (score >= 70) return '#facc15';
        if (score >= 50) return '#fb923c';
        return '#f87171';
    }, [score]);

    const scoreOffset = score ? 283 - (283 * score) / 100 : 283;

    const formatDuration = (minutes?: number) => {
        if (!minutes) return '—';
        const hours = Math.floor(minutes / 60);
        const mins = minutes % 60;
        return `${hours}h ${mins}m`;
    };

    const formatTime = (timeStr?: string) => {
        if (!timeStr) return '—';
        const date = new Date(timeStr);
        return date.toLocaleTimeString('en-US', {
            hour: 'numeric',
            minute: '2-digit',
            hour12: true
        });
    };

    return (
        <div className="glass-card p-6 gradient-border">
            <div className="relative">
                <h3 className="text-lg font-semibold text-white mb-6 flex items-center gap-2">
                    <Moon className="w-5 h-5 text-sleep-400" />
                    Sleep Efficiency
                </h3>

                {/* Score Ring */}
                <div className="flex justify-center mb-6">
                    <div className="relative w-48 h-48">
                        <svg className="w-full h-full transform -rotate-90" viewBox="0 0 100 100">
                            {/* Background ring */}
                            <circle
                                cx="50"
                                cy="50"
                                r="45"
                                fill="none"
                                stroke="#1e293b"
                                strokeWidth="8"
                            />
                            {/* Score ring */}
                            <circle
                                cx="50"
                                cy="50"
                                r="45"
                                fill="none"
                                stroke={strokeColor}
                                strokeWidth="8"
                                strokeLinecap="round"
                                className="score-ring"
                                style={{
                                    '--score-offset': scoreOffset,
                                    strokeDasharray: 283,
                                    strokeDashoffset: scoreOffset,
                                    transition: 'stroke-dashoffset 1.5s ease-out'
                                } as React.CSSProperties}
                            />
                        </svg>

                        {/* Score text */}
                        <div className="absolute inset-0 flex flex-col items-center justify-center">
                            <span className={`text-5xl font-bold ${scoreColor}`}>
                                {score != null ? Math.round(score) : '—'}
                            </span>
                            {score != null && (
                                <span className="text-night-400 text-sm mt-1">/ 100</span>
                            )}
                        </div>
                    </div>
                </div>

                {/* Sleep Stats */}
                <div className="grid grid-cols-3 gap-4">
                    <div className="text-center p-3 rounded-lg bg-night-800/50">
                        <Clock className="w-4 h-4 text-sleep-400 mx-auto mb-1" />
                        <p className="text-xs text-night-400">Duration</p>
                        <p className="text-sm font-semibold text-white">{formatDuration(duration)}</p>
                    </div>

                    <div className="text-center p-3 rounded-lg bg-night-800/50">
                        <BedDouble className="w-4 h-4 text-indigo-400 mx-auto mb-1" />
                        <p className="text-xs text-night-400">Bed Time</p>
                        <p className="text-sm font-semibold text-white">{formatTime(bedTime)}</p>
                    </div>

                    <div className="text-center p-3 rounded-lg bg-night-800/50">
                        <Sun className="w-4 h-4 text-amber-400 mx-auto mb-1" />
                        <p className="text-xs text-night-400">Wake Time</p>
                        <p className="text-sm font-semibold text-white">{formatTime(wakeTime)}</p>
                    </div>
                </div>
            </div>
        </div>
    );
}
