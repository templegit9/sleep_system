'use client';

import { useEffect, useRef, useState } from 'react';
import { Mic, MicOff, Volume2 } from 'lucide-react';

interface AudioVisualizationProps {
    audioLevel: number;
    isActive: boolean;
}

export default function AudioVisualization({
    audioLevel,
    isActive
}: AudioVisualizationProps) {
    const canvasRef = useRef<HTMLCanvasElement>(null);
    const [history, setHistory] = useState<number[]>(new Array(60).fill(0));

    useEffect(() => {
        setHistory(prev => {
            const newHistory = [...prev.slice(1), audioLevel];
            return newHistory;
        });
    }, [audioLevel]);

    useEffect(() => {
        const canvas = canvasRef.current;
        if (!canvas) return;

        const ctx = canvas.getContext('2d');
        if (!ctx) return;

        const draw = () => {
            const width = canvas.width;
            const height = canvas.height;
            const barWidth = width / history.length;
            const maxHeight = height - 20;

            // Clear canvas
            ctx.clearRect(0, 0, width, height);

            // Draw bars
            history.forEach((level, i) => {
                const barHeight = (level / 100) * maxHeight;
                const x = i * barWidth;
                const y = height - barHeight;

                // Create gradient
                const gradient = ctx.createLinearGradient(x, height, x, y);
                gradient.addColorStop(0, 'rgba(99, 102, 241, 0.3)');
                gradient.addColorStop(0.5, 'rgba(139, 92, 246, 0.6)');
                gradient.addColorStop(1, 'rgba(168, 85, 247, 0.9)');

                ctx.fillStyle = gradient;
                ctx.fillRect(x + 1, y, barWidth - 2, barHeight);

                // Add glow effect for high levels
                if (level > 60) {
                    ctx.shadowColor = '#8b5cf6';
                    ctx.shadowBlur = 10;
                    ctx.fillRect(x + 1, y, barWidth - 2, barHeight);
                    ctx.shadowBlur = 0;
                }
            });

            // Draw threshold line
            const thresholdY = height - (30 / 100) * maxHeight;
            ctx.strokeStyle = 'rgba(250, 204, 21, 0.5)';
            ctx.setLineDash([5, 5]);
            ctx.beginPath();
            ctx.moveTo(0, thresholdY);
            ctx.lineTo(width, thresholdY);
            ctx.stroke();
            ctx.setLineDash([]);
        };

        draw();
    }, [history]);

    return (
        <div className="glass-card p-6">
            <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-semibold text-white flex items-center gap-2">
                    {isActive ? (
                        <Mic className="w-5 h-5 text-green-400 animate-pulse" />
                    ) : (
                        <MicOff className="w-5 h-5 text-night-400" />
                    )}
                    Live Audio
                </h3>

                <div className="flex items-center gap-3">
                    <div className="flex items-center gap-2 text-sm">
                        <Volume2 className="w-4 h-4 text-sleep-400" />
                        <span className="text-white font-mono">{audioLevel.toFixed(1)}</span>
                    </div>

                    <span className={`px-2 py-1 rounded text-xs ${isActive
                            ? 'bg-green-500/20 text-green-400'
                            : 'bg-night-700 text-night-400'
                        }`}>
                        {isActive ? 'Recording' : 'Paused'}
                    </span>
                </div>
            </div>

            {/* Waveform Canvas */}
            <div className="relative bg-night-900/50 rounded-lg p-4">
                <canvas
                    ref={canvasRef}
                    width={600}
                    height={150}
                    className="w-full h-[150px]"
                />

                {/* Legend */}
                <div className="absolute bottom-2 right-2 flex items-center gap-4 text-xs">
                    <div className="flex items-center gap-1">
                        <div className="w-3 h-0.5 bg-yellow-400/50" style={{
                            borderStyle: 'dashed',
                            borderWidth: '1px',
                            borderColor: 'rgba(250, 204, 21, 0.5)'
                        }} />
                        <span className="text-night-400">Snore threshold</span>
                    </div>
                </div>
            </div>

            {/* Quick Stats */}
            <div className="grid grid-cols-3 gap-4 mt-4">
                <div className="p-3 rounded-lg bg-night-800/50 text-center">
                    <p className="text-xs text-night-400">Current</p>
                    <p className="text-lg font-semibold text-white">{audioLevel.toFixed(0)}%</p>
                </div>
                <div className="p-3 rounded-lg bg-night-800/50 text-center">
                    <p className="text-xs text-night-400">Peak</p>
                    <p className="text-lg font-semibold text-purple-400">
                        {Math.max(...history).toFixed(0)}%
                    </p>
                </div>
                <div className="p-3 rounded-lg bg-night-800/50 text-center">
                    <p className="text-xs text-night-400">Average</p>
                    <p className="text-lg font-semibold text-sleep-400">
                        {(history.reduce((a, b) => a + b, 0) / history.length).toFixed(0)}%
                    </p>
                </div>
            </div>
        </div>
    );
}
