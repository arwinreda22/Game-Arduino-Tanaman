import React, { useState } from 'react';
import { Terminal, Activity, Cpu, Trash2 } from 'lucide-react';
import {
  CodeBlockConfig,
  PinReading,
  ProjectId,
  SerialLogEntry,
} from '../types/arduino';
import { ARDUINO_PROJECTS } from '../data/projects';

interface SerialAndTelemetryPanelProps {
  projectId: ProjectId;
  config: CodeBlockConfig;
  logs: SerialLogEntry[];
  pinReadings: PinReading[];
  onClearLogs: () => void;
}

export const SerialAndTelemetryPanel: React.FC<SerialAndTelemetryPanelProps> = ({
  projectId,
  config,
  logs,
  pinReadings,
  onClearLogs,
}) => {
  const [activeTab, setActiveTab] = useState<'plotter' | 'monitor' | 'pins'>(
    'plotter'
  );
  const project = ARDUINO_PROJECTS[projectId];

  // Prepare SVG polyline points for Serial Plotter
  const chartWidth = 460;
  const chartHeight = 140;
  const padX = 36;
  const padY = 14;
  const plotW = chartWidth - padX - 12;
  const plotH = chartHeight - padY * 2;

  const recentLogs = logs.slice(-30);
  const rangeSpan = Math.max(1, project.maxVal - project.minVal);

  const toY = (val: number) => {
    const norm = Math.max(
      0,
      Math.min(1, (val - project.minVal) / rangeSpan)
    );
    return padY + plotH - norm * plotH;
  };

  const points = recentLogs
    .map((entry, idx) => {
      const x =
        recentLogs.length === 1
          ? padX + plotW / 2
          : padX + (idx / (recentLogs.length - 1)) * plotW;
      const y = toY(entry.sensorValue);
      return `${x.toFixed(1)},${y.toFixed(1)}`;
    })
    .join(' ');

  const thresholdY = toY(config.threshold);

  return (
    <div className="bg-white border border-slate-200 rounded-xl overflow-hidden flex flex-col">
      {/* Header Tabs */}
      <div className="px-4 py-2.5 border-b border-slate-200 bg-slate-50/70 flex items-center justify-between gap-2 flex-wrap">
        <div className="flex items-center gap-1 p-0.5 bg-slate-200/70 rounded-lg">
          <button
            type="button"
            onClick={() => setActiveTab('plotter')}
            className={`inline-flex items-center gap-1.5 px-2.5 py-1 text-xs font-medium rounded-md transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
              activeTab === 'plotter'
                ? 'bg-white text-slate-900 shadow-xs'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <Activity className="w-3.5 h-3.5 text-teal-700" />
            <span>Serial Plotter</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('monitor')}
            className={`inline-flex items-center gap-1.5 px-2.5 py-1 text-xs font-medium rounded-md transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
              activeTab === 'monitor'
                ? 'bg-white text-slate-900 shadow-xs'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <Terminal className="w-3.5 h-3.5 text-sky-700" />
            <span>Serial Monitor</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('pins')}
            className={`inline-flex items-center gap-1.5 px-2.5 py-1 text-xs font-medium rounded-md transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
              activeTab === 'pins'
                ? 'bg-white text-slate-900 shadow-xs'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <Cpu className="w-3.5 h-3.5 text-slate-700" />
            <span>Tegangan Pin</span>
          </button>
        </div>

        {activeTab !== 'pins' && (
          <button
            type="button"
            onClick={onClearLogs}
            className="inline-flex items-center gap-1 px-2 py-1 text-xs text-slate-500 hover:text-slate-800 rounded transition-colors cursor-pointer"
          >
            <Trash2 className="w-3.5 h-3.5" />
            <span>Bersihkan</span>
          </button>
        )}
      </div>

      {/* Tab Body */}
      <div className="p-4 flex-1">
        {activeTab === 'plotter' && (
          <div className="space-y-2">
            <div className="flex items-center justify-between text-xs text-slate-600">
              <span>
                Grafik Pembacaan {project.sensorName} ({project.unitLabel})
              </span>
              <span className="font-mono text-amber-700 tabular-nums">
                Garis Putus: Ambang {config.threshold} {project.unitLabel}
              </span>
            </div>

            {recentLogs.length === 0 ? (
              <div className="h-[150px] flex items-center justify-center border border-dashed border-slate-200 rounded-lg text-xs text-slate-500">
                Tekan "Jalankan" atau "Langkah Kode" untuk mulai merekam grafik sensor.
              </div>
            ) : (
              <svg
                viewBox={`0 0 ${chartWidth} ${chartHeight}`}
                className="w-full h-[156px] bg-slate-50 border border-slate-200 rounded-lg"
                role="img"
                aria-label="Grafik Serial Plotter"
              >
                {/* Y-axis gridlines */}
                {[0, 0.5, 1].map((frac) => {
                  const y = padY + plotH - frac * plotH;
                  const val = Math.round(project.minVal + frac * rangeSpan);
                  return (
                    <g key={frac}>
                      <line
                        x1={padX}
                        y1={y}
                        x2={chartWidth - 12}
                        y2={y}
                        stroke="#e2e8f0"
                        strokeWidth={1}
                      />
                      <text
                        x={padX - 6}
                        y={y + 3}
                        textAnchor="end"
                        fontSize={9}
                        fill="#64748b"
                        fontFamily="JetBrains Mono"
                      >
                        {val}
                      </text>
                    </g>
                  );
                })}

                {/* Threshold reference line */}
                <line
                  x1={padX}
                  y1={thresholdY}
                  x2={chartWidth - 12}
                  y2={thresholdY}
                  stroke="#d97706"
                  strokeWidth={1.5}
                  strokeDasharray="4 4"
                />

                {/* Sensor line */}
                {recentLogs.length > 1 && (
                  <polyline
                    fill="none"
                    stroke="#0f766e"
                    strokeWidth={2.5}
                    strokeLinejoin="round"
                    strokeLinecap="round"
                    points={points}
                  />
                )}

                {/* Latest point marker */}
                {recentLogs.length > 0 && (() => {
                  const last = recentLogs[recentLogs.length - 1];
                  const lx =
                    recentLogs.length === 1
                      ? padX + plotW / 2
                      : padX + plotW;
                  const ly = toY(last.sensorValue);
                  return (
                    <circle
                      cx={lx}
                      cy={ly}
                      r={4}
                      fill={last.actuatorActive ? '#059669' : '#0284c7'}
                      stroke="#ffffff"
                      strokeWidth={1.5}
                    />
                  );
                })()}
              </svg>
            )}
          </div>
        )}

        {activeTab === 'monitor' && (
          <div className="bg-slate-950 text-slate-200 rounded-lg p-3 font-mono text-xs h-[175px] overflow-y-auto space-y-1">
            {!config.serialEnabled ? (
              <p className="text-amber-400">
                Serial Monitor dinonaktifkan pada Blok 1 (Serial.begin dimatikan).
              </p>
            ) : logs.length === 0 ? (
              <p className="text-slate-500">
                Menunggu data Serial.println() pada 9600 baud...
              </p>
            ) : (
              logs
                .slice()
                .reverse()
                .map((log) => (
                  <div
                    key={log.id}
                    className="flex items-start justify-between gap-3 border-b border-slate-900 pb-1"
                  >
                    <span className="text-slate-500 shrink-0 tabular-nums">
                      [{log.timestamp}]
                    </span>
                    <span className="text-teal-300 flex-1">{log.message}</span>
                    <span
                      className={`shrink-0 ${
                        log.actuatorActive ? 'text-emerald-400' : 'text-slate-500'
                      }`}
                    >
                      {log.actuatorActive ? 'AKTUATOR ON' : 'OFF'}
                    </span>
                  </div>
                ))
            )}
          </div>
        )}

        {activeTab === 'pins' && (
          <div className="overflow-x-auto">
            <table className="w-full text-xs text-left">
              <thead>
                <tr className="border-b border-slate-200 text-slate-500">
                  <th className="py-1.5 font-medium">Pin</th>
                  <th className="py-1.5 font-medium">Mode</th>
                  <th className="py-1.5 font-medium text-right">Tegangan</th>
                  <th className="py-1.5 font-medium text-right">Nilai</th>
                  <th className="py-1.5 pl-3 font-medium">Fungsi</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 font-mono tabular-nums">
                {pinReadings.map((pin) => (
                  <tr key={pin.pin}>
                    <td className="py-1.5 font-semibold text-slate-900">
                      {pin.pin}
                    </td>
                    <td className="py-1.5 text-slate-600">{pin.mode}</td>
                    <td className="py-1.5 text-right text-teal-700 font-medium">
                      {pin.voltage.toFixed(2)} V
                    </td>
                    <td className="py-1.5 text-right text-slate-800">
                      {pin.rawValue}
                    </td>
                    <td className="py-1.5 pl-3 font-sans text-slate-600">
                      {pin.description}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
};
