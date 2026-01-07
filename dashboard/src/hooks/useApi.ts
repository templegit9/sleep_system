'use client';

import { useState, useEffect, useCallback } from 'react';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001/api';

interface Session {
    id: string;
    date: string;
    bed_time: string | null;
    wake_time: string | null;
    duration_minutes: number | null;
    efficiency_score: number | null;
}

interface Stats {
    total_sessions: number;
    total_audio_events: number;
    average_efficiency: number | null;
}

export function useApi() {
    const [todaySession, setTodaySession] = useState<Session | null>(null);
    const [stats, setStats] = useState<Stats | null>(null);
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    // Fetch today's session
    const fetchTodaySession = useCallback(async () => {
        try {
            const response = await fetch(`${API_URL}/sessions/today/current`);
            if (!response.ok) throw new Error('Failed to fetch session');
            const data = await response.json();
            setTodaySession(data.session);
        } catch (err) {
            console.error('Error fetching today session:', err);
            setError(err instanceof Error ? err.message : 'Unknown error');
        }
    }, []);

    // Fetch stats
    const fetchStats = useCallback(async () => {
        try {
            const response = await fetch(`${API_URL}/health/stats`);
            if (!response.ok) throw new Error('Failed to fetch stats');
            const data = await response.json();
            setStats(data);
        } catch (err) {
            console.error('Error fetching stats:', err);
        }
    }, []);

    // Fetch recent sessions
    const fetchSessions = useCallback(async (limit: number = 30): Promise<Session[]> => {
        try {
            const response = await fetch(`${API_URL}/sessions?limit=${limit}`);
            if (!response.ok) throw new Error('Failed to fetch sessions');
            return await response.json();
        } catch (err) {
            console.error('Error fetching sessions:', err);
            return [];
        }
    }, []);

    // Start a new session
    const startSession = useCallback(async () => {
        setIsLoading(true);
        try {
            const response = await fetch(`${API_URL}/sessions/start`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
            });
            if (!response.ok) throw new Error('Failed to start session');
            const session = await response.json();
            setTodaySession(session);
            return session;
        } catch (err) {
            console.error('Error starting session:', err);
            throw err;
        } finally {
            setIsLoading(false);
        }
    }, []);

    // End a session
    const endSession = useCallback(async (sessionId: string) => {
        setIsLoading(true);
        try {
            const response = await fetch(`${API_URL}/sessions/${sessionId}/end`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
            });
            if (!response.ok) throw new Error('Failed to end session');
            const session = await response.json();
            setTodaySession(session);

            // Calculate efficiency score
            await fetch(`${API_URL}/sessions/${sessionId}/calculate-score`, {
                method: 'POST',
            });

            // Refresh session data
            await fetchTodaySession();
            await fetchStats();

            return session;
        } catch (err) {
            console.error('Error ending session:', err);
            throw err;
        } finally {
            setIsLoading(false);
        }
    }, [fetchTodaySession, fetchStats]);

    // Import Fitbit data
    const importFitbitData = useCallback(async (file: File) => {
        setIsLoading(true);
        try {
            const formData = new FormData();
            formData.append('fitbitData', file);

            const response = await fetch(`${API_URL}/fitbit/import`, {
                method: 'POST',
                body: formData,
            });

            if (!response.ok) throw new Error('Failed to import Fitbit data');
            return await response.json();
        } catch (err) {
            console.error('Error importing Fitbit data:', err);
            throw err;
        } finally {
            setIsLoading(false);
        }
    }, []);

    // Initial data fetch
    useEffect(() => {
        fetchTodaySession();
        fetchStats();

        // Listen for session updates from WebSocket
        const handleSessionUpdate = () => {
            fetchTodaySession();
            fetchStats();
        };

        window.addEventListener('session-update', handleSessionUpdate);
        return () => window.removeEventListener('session-update', handleSessionUpdate);
    }, [fetchTodaySession, fetchStats]);

    // Periodic refresh
    useEffect(() => {
        const interval = setInterval(() => {
            fetchTodaySession();
        }, 30000); // Refresh every 30 seconds

        return () => clearInterval(interval);
    }, [fetchTodaySession]);

    return {
        todaySession,
        stats,
        isLoading,
        error,
        startSession,
        endSession,
        fetchSessions,
        importFitbitData,
        refreshData: () => {
            fetchTodaySession();
            fetchStats();
        },
    };
}
