'use client';

import { useState, useEffect } from 'react';
import { Moon, TrendingUp, Settings } from 'lucide-react';
import SleepScoreCard from '@/components/SleepScoreCard';
import AudioVisualization from '@/components/AudioVisualization';
import EnvironmentCard from '@/components/EnvironmentCard';
import SleepTimeline from '@/components/SleepTimeline';
import SessionControls from '@/components/SessionControls';
import RecentSessions from '@/components/RecentSessions';
import { useWebSocket } from '@/hooks/useWebSocket';
import { useApi } from '@/hooks/useApi';

export default function Home() {
    const { isConnected, audioLevel, environmentData } = useWebSocket();
    const { todaySession, stats } = useApi();
    const [currentTime, setCurrentTime] = useState(new Date());

    useEffect(() => {
        const timer = setInterval(() => setCurrentTime(new Date()), 1000);
        return () => clearInterval(timer);
    }, []);

    const formatTime = (date: Date) => {
        return date.toLocaleTimeString('en-US', {
            hour: '2-digit',
            minute: '2-digit',
            hour12: true
        });
    };

    return (
        <main className="min-h-screen p-6">
            {/* Header */}
            <header className="flex items-center justify-between mb-8">
                <div className="flex items-center gap-4">
                    <div className="p-3 rounded-xl bg-sleep-600/20 animate-breathe">
                        <Moon className="w-8 h-8 text-sleep-400" />
                    </div>
                    <div>
                        <h1 className="text-2xl font-bold text-white">Sleep Tracker</h1>
                        <p className="text-night-400">{currentTime.toLocaleDateString('en-US', {
                            weekday: 'long',
                            month: 'long',
                            day: 'numeric'
                        })}</p>
                    </div>
                </div>

                <div className="flex items-center gap-4">
                    <div className={`flex items-center gap-2 px-3 py-1.5 rounded-full text-sm ${isConnected ? 'bg-green-500/20 text-green-400' : 'bg-red-500/20 text-red-400'
                        }`}>
                        <span className={`w-2 h-2 rounded-full ${isConnected ? 'bg-green-400 animate-pulse' : 'bg-red-400'
                            }`} />
                        {isConnected ? 'Live' : 'Offline'}
                    </div>

                    <span className="text-3xl font-light text-white">{formatTime(currentTime)}</span>

                    <button className="p-2 rounded-lg hover:bg-white/10 transition-colors">
                        <Settings className="w-6 h-6 text-night-400" />
                    </button>
                </div>
            </header>

            {/* Main Grid */}
            <div className="grid grid-cols-12 gap-6">
                {/* Left Column - Sleep Score & Controls */}
                <div className="col-span-12 lg:col-span-4 space-y-6">
                    <SleepScoreCard
                        score={todaySession?.efficiency_score ?? undefined}
                        duration={todaySession?.duration_minutes ?? undefined}
                        bedTime={todaySession?.bed_time ?? undefined}
                        wakeTime={todaySession?.wake_time ?? undefined}
                    />

                    <SessionControls
                        session={todaySession}
                        isRecording={!!todaySession && !todaySession.wake_time}
                    />

                    {/* Stats Overview */}
                    <div className="glass-card p-6">
                        <h3 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
                            <TrendingUp className="w-5 h-5 text-sleep-400" />
                            Statistics
                        </h3>
                        <div className="grid grid-cols-2 gap-4">
                            <div className="p-4 rounded-lg bg-night-800/50">
                                <p className="text-night-400 text-sm">Total Sessions</p>
                                <p className="text-2xl font-bold text-white">{stats?.total_sessions || 0}</p>
                            </div>
                            <div className="p-4 rounded-lg bg-night-800/50">
                                <p className="text-night-400 text-sm">Avg Efficiency</p>
                                <p className="text-2xl font-bold text-sleep-400">
                                    {stats?.average_efficiency ? `${stats.average_efficiency}%` : '—'}
                                </p>
                            </div>
                        </div>
                    </div>
                </div>

                {/* Center Column - Audio & Timeline */}
                <div className="col-span-12 lg:col-span-5 space-y-6">
                    <AudioVisualization
                        audioLevel={audioLevel}
                        isActive={!!todaySession && !todaySession.wake_time}
                    />

                    <SleepTimeline
                        sessionId={todaySession?.id}
                        events={[]}
                    />
                </div>

                {/* Right Column - Environment & History */}
                <div className="col-span-12 lg:col-span-3 space-y-6">
                    <EnvironmentCard
                        co2={environmentData?.co2_ppm}
                        temperature={environmentData?.temperature_c}
                        humidity={environmentData?.humidity_percent}
                    />

                    <RecentSessions />
                </div>
            </div>
        </main>
    );
}
