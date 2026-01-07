'use client';

import { useMemo } from 'react';
import { Thermometer, Droplets, Wind, AlertTriangle, CheckCircle } from 'lucide-react';

interface EnvironmentCardProps {
    co2?: number;
    temperature?: number;
    humidity?: number;
}

export default function EnvironmentCard({
    co2,
    temperature,
    humidity
}: EnvironmentCardProps) {
    const co2Status = useMemo(() => {
        if (!co2) return { color: 'text-night-400', bg: 'bg-night-700', status: 'No data' };
        if (co2 < 800) return { color: 'text-green-400', bg: 'bg-green-500/20', status: 'Excellent' };
        if (co2 < 1000) return { color: 'text-yellow-400', bg: 'bg-yellow-500/20', status: 'Good' };
        if (co2 < 1500) return { color: 'text-orange-400', bg: 'bg-orange-500/20', status: 'Fair' };
        return { color: 'text-red-400', bg: 'bg-red-500/20', status: 'Poor' };
    }, [co2]);

    const tempStatus = useMemo(() => {
        if (!temperature) return { color: 'text-night-400', status: 'optimal' };
        if (temperature >= 16 && temperature <= 19) return { color: 'text-green-400', status: 'optimal' };
        if (temperature >= 14 && temperature <= 22) return { color: 'text-yellow-400', status: 'acceptable' };
        return { color: 'text-red-400', status: 'not ideal' };
    }, [temperature]);

    const humidityStatus = useMemo(() => {
        if (!humidity) return { color: 'text-night-400', status: 'optimal' };
        if (humidity >= 40 && humidity <= 60) return { color: 'text-green-400', status: 'optimal' };
        if (humidity >= 30 && humidity <= 70) return { color: 'text-yellow-400', status: 'acceptable' };
        return { color: 'text-red-400', status: 'not ideal' };
    }, [humidity]);

    const overallStatus = useMemo(() => {
        if (!co2 && !temperature && !humidity) return null;

        const issues = [];
        if (co2 && co2 > 1000) issues.push('High CO₂');
        if (temperature && (temperature < 16 || temperature > 19)) issues.push('Temperature');
        if (humidity && (humidity < 40 || humidity > 60)) issues.push('Humidity');

        return issues.length === 0;
    }, [co2, temperature, humidity]);

    return (
        <div className="glass-card p-6">
            <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-semibold text-white">Environment</h3>
                {overallStatus !== null && (
                    <div className={`flex items-center gap-1 px-2 py-1 rounded text-xs ${overallStatus ? 'bg-green-500/20 text-green-400' : 'bg-yellow-500/20 text-yellow-400'
                        }`}>
                        {overallStatus ? (
                            <CheckCircle className="w-3 h-3" />
                        ) : (
                            <AlertTriangle className="w-3 h-3" />
                        )}
                        {overallStatus ? 'Optimal' : 'Check'}
                    </div>
                )}
            </div>

            <div className="space-y-4">
                {/* CO2 */}
                <div className={`p-4 rounded-lg ${co2Status.bg}`}>
                    <div className="flex items-center justify-between mb-2">
                        <div className="flex items-center gap-2">
                            <Wind className={`w-5 h-5 ${co2Status.color}`} />
                            <span className="text-night-300">CO₂</span>
                        </div>
                        <span className={`text-xs ${co2Status.color}`}>{co2Status.status}</span>
                    </div>
                    <div className="flex items-baseline gap-1">
                        <span className={`text-2xl font-bold ${co2Status.color}`}>
                            {co2 ?? '—'}
                        </span>
                        <span className="text-night-400 text-sm">ppm</span>
                    </div>
                    {/* Progress bar */}
                    <div className="mt-2 h-1.5 bg-night-800 rounded-full overflow-hidden">
                        <div
                            className={`h-full rounded-full transition-all duration-500 ${co2Status.color.replace('text-', 'bg-')
                                }`}
                            style={{ width: `${Math.min((co2 || 0) / 2000 * 100, 100)}%` }}
                        />
                    </div>
                </div>

                {/* Temperature */}
                <div className="p-4 rounded-lg bg-night-800/50">
                    <div className="flex items-center justify-between mb-2">
                        <div className="flex items-center gap-2">
                            <Thermometer className={`w-5 h-5 ${tempStatus.color}`} />
                            <span className="text-night-300">Temperature</span>
                        </div>
                        <span className={`text-xs ${tempStatus.color}`}>{tempStatus.status}</span>
                    </div>
                    <div className="flex items-baseline gap-1">
                        <span className={`text-2xl font-bold ${tempStatus.color}`}>
                            {temperature?.toFixed(1) ?? '—'}
                        </span>
                        <span className="text-night-400 text-sm">°C</span>
                    </div>
                    <p className="text-xs text-night-500 mt-1">Ideal: 16-19°C</p>
                </div>

                {/* Humidity */}
                <div className="p-4 rounded-lg bg-night-800/50">
                    <div className="flex items-center justify-between mb-2">
                        <div className="flex items-center gap-2">
                            <Droplets className={`w-5 h-5 ${humidityStatus.color}`} />
                            <span className="text-night-300">Humidity</span>
                        </div>
                        <span className={`text-xs ${humidityStatus.color}`}>{humidityStatus.status}</span>
                    </div>
                    <div className="flex items-baseline gap-1">
                        <span className={`text-2xl font-bold ${humidityStatus.color}`}>
                            {humidity?.toFixed(0) ?? '—'}
                        </span>
                        <span className="text-night-400 text-sm">%</span>
                    </div>
                    <p className="text-xs text-night-500 mt-1">Ideal: 40-60%</p>
                </div>
            </div>
        </div>
    );
}
