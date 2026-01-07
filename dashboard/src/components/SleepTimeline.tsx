'use client';

import { useMemo } from 'react';
import { Clock, Volume2, VolumeX, MessageSquare, Activity } from 'lucide-react';

interface AudioEvent {
    id: string;
    event_type: string;
    timestamp: string;
    duration_seconds: number;
    confidence: number;
}

interface SleepTimelineProps {
    sessionId?: string;
    events: AudioEvent[];
}

const eventIcons: Record<string, any> = {
    snore: Volume2,
    cough: VolumeX,
    talk: MessageSquare,
    movement: Activity,
};

const eventColors: Record<string, string> = {
    snore: 'bg-orange-500',
    cough: 'bg-red-500',
    talk: 'bg-blue-500',
    movement: 'bg-purple-500',
};

export default function SleepTimeline({
    sessionId,
    events
}: SleepTimelineProps) {
    const sortedEvents = useMemo(() => {
        return [...events].sort((a, b) =>
            new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime()
        );
    }, [events]);

    const eventCounts = useMemo(() => {
        const counts: Record<string, number> = {};
        events.forEach(e => {
            counts[e.event_type] = (counts[e.event_type] || 0) + 1;
        });
        return counts;
    }, [events]);

    const formatTime = (timestamp: string) => {
        return new Date(timestamp).toLocaleTimeString('en-US', {
            hour: 'numeric',
            minute: '2-digit',
            hour12: true
        });
    };

    if (!sessionId) {
        return (
            <div className="glass-card p-6">
                <h3 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
                    <Clock className="w-5 h-5 text-sleep-400" />
                    Sleep Timeline
                </h3>
                <div className="flex flex-col items-center justify-center py-12 text-center">
                    <div className="w-16 h-16 rounded-full bg-night-800 flex items-center justify-center mb-4">
                        <Clock className="w-8 h-8 text-night-500" />
                    </div>
                    <p className="text-night-400">No active session</p>
                    <p className="text-night-500 text-sm mt-1">Start a session to see timeline</p>
                </div>
            </div>
        );
    }

    return (
        <div className="glass-card p-6">
            <h3 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
                <Clock className="w-5 h-5 text-sleep-400" />
                Sleep Timeline
            </h3>

            {/* Event Summary */}
            <div className="flex gap-3 mb-6 flex-wrap">
                {Object.entries(eventCounts).map(([type, count]) => {
                    const Icon = eventIcons[type] || Activity;
                    return (
                        <div
                            key={type}
                            className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-night-800/50 text-sm"
                        >
                            <div className={`w-2 h-2 rounded-full ${eventColors[type] || 'bg-night-500'}`} />
                            <Icon className="w-3.5 h-3.5 text-night-400" />
                            <span className="text-night-300 capitalize">{type}</span>
                            <span className="text-white font-semibold">{count}</span>
                        </div>
                    );
                })}

                {Object.keys(eventCounts).length === 0 && (
                    <p className="text-night-500 text-sm">No events detected yet</p>
                )}
            </div>

            {/* Timeline */}
            <div className="relative">
                {/* Timeline line */}
                <div className="absolute left-4 top-0 bottom-0 w-0.5 bg-night-700" />

                {/* Events */}
                <div className="space-y-4 max-h-[300px] overflow-y-auto pr-2">
                    {sortedEvents.length === 0 ? (
                        <div className="ml-10 p-4 rounded-lg bg-night-800/30 text-center">
                            <p className="text-night-400">Listening for sleep sounds...</p>
                            <p className="text-night-500 text-sm mt-1">Events will appear here</p>
                        </div>
                    ) : (
                        sortedEvents.map((event) => {
                            const Icon = eventIcons[event.event_type] || Activity;
                            return (
                                <div key={event.id} className="relative flex items-start gap-4">
                                    {/* Dot */}
                                    <div className={`relative z-10 w-8 h-8 rounded-full flex items-center justify-center ${eventColors[event.event_type] || 'bg-night-600'
                                        }/20`}>
                                        <Icon className={`w-4 h-4 ${eventColors[event.event_type]?.replace('bg-', 'text-') || 'text-night-400'
                                            }`} />
                                    </div>

                                    {/* Content */}
                                    <div className="flex-1 p-3 rounded-lg bg-night-800/30 hover:bg-night-800/50 transition-colors">
                                        <div className="flex items-center justify-between mb-1">
                                            <span className="text-white capitalize font-medium">
                                                {event.event_type}
                                            </span>
                                            <span className="text-night-400 text-xs">
                                                {formatTime(event.timestamp)}
                                            </span>
                                        </div>
                                        <div className="flex items-center gap-3 text-xs text-night-500">
                                            <span>{event.duration_seconds.toFixed(1)}s</span>
                                            <span>•</span>
                                            <span>{(event.confidence * 100).toFixed(0)}% confidence</span>
                                        </div>
                                    </div>
                                </div>
                            );
                        })
                    )}
                </div>
            </div>
        </div>
    );
}
