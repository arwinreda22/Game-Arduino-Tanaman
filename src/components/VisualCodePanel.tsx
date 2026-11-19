import React, { useMemo, useState } from 'react';
import {
  Copy,
  Check,
  Code2,
  Blocks,
  ChevronRight,
  Info,
} from 'lucide-react';
import {
  CodeBlockConfig,
  ComparatorOp,
  ExecutionPhase,
  ProjectId,
} from '../types/arduino';
import {
  ARDUINO_PROJECTS,
  CodeLine,
  evaluateCondition,
  generateArduinoCode,
} from '../data/projects';

interface VisualCodePanelProps {
  projectId: ProjectId;
  config: CodeBlockConfig;
  executionPhase: ExecutionPhase;
  isRunning: boolean;
  sensorDisplayValue: number;
  sensorRawValue: number;
  signalConnected: boolean;
  onUpdateConfig: (patch: Partial<CodeBlockConfig>) => void;
  onFocusPhase?: (phase: ExecutionPhase) => void;
}

export const VisualCodePanel: React.FC<VisualCodePanelProps> = ({
  projectId,
  config,
  executionPhase,
  isRunning,
  sensorDisplayValue,
  sensorRawValue,
  signalConnected,
  onUpdateConfig,
  onFocusPhase,
}) => {
  const [viewMode, setViewMode] = useState<'both' | 'blocks' | 'code'>('both');
  const [selectedLine, setSelectedLine] = useState<number | null>(null);
  const [hoveredPhase, setHoveredPhase] = useState<ExecutionPhase | null>(null);
  const [copied, setCopied] = useState(false);

  const project = ARDUINO_PROJECTS[projectId];
  const codeLines: CodeLine[] = useMemo(
    () => generateArduinoCode(projectId, config),
    [projectId, config]
  );

  const conditionResult = evaluateCondition(
    sensorDisplayValue,
    config.comparator,
    config.threshold
  );

  const activeExplanation = useMemo(() => {
    if (selectedLine !== null) {
      return codeLines.find((l) => l.lineNumber === selectedLine);
    }
    if (executionPhase !== 'idle') {
      return codeLines.find((l) => l.phase === executionPhase);
    }
    return codeLines[0];
  }, [selectedLine, executionPhase, codeLines]);

  const handleCopyCode = async () => {
    const raw = codeLines.map((l) => l.text).join('\n');
    try {
      await navigator.clipboard.writeText(raw);
      setCopied(true);
      setTimeout(() => setCopied(false), 1800);
    } catch {
      // Fallback ignored in restricted frames
    }
  };

  const isBinarySensor =
    projectId === 'pir-alarm' || projectId === 'blink-button';
  const isAnalogPinSelectable =
    projectId === 'plant-watering' || projectId === 'ldr-streetlamp';

  return (
    <div className="bg-white border border-slate-200 rounded-xl overflow-hidden flex flex-col">
      {/* Header Bar */}
      <div className="px-4 py-3 border-b border-slate-200 bg-slate-50/70 flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <Code2 className="w-4 h-4 text-teal-700" />
          <h3 className="font-display text-sm font-semibold text-slate-900">
            Integrasi Visual & Kode Arduino
          </h3>
        </div>

        <div className="flex items-center gap-2">
          {/* Segmented View Toggle */}
          <div className="flex items-center gap-1 p-0.5 bg-slate-200/70 rounded-lg">
            {[
              { id: 'both' as const, label: 'Blok + Kode' },
              { id: 'blocks' as const, label: 'Blok Visual' },
              { id: 'code' as const, label: 'Kode .ino' },
            ].map((tab) => (
              <button
                key={tab.id}
                type="button"
                onClick={() => setViewMode(tab.id)}
                className={`px-2.5 py-1 text-xs font-medium rounded-md transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                  viewMode === tab.id
                    ? 'bg-white text-slate-900 shadow-xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>

          <button
            type="button"
            onClick={handleCopyCode}
            className="inline-flex items-center gap-1 px-2.5 py-1.5 text-xs font-medium text-slate-700 bg-white border border-slate-200 hover:bg-slate-100 rounded-lg transition-colors whitespace-nowrap shrink-0 cursor-pointer"
          >
            {copied ? (
              <>
                <Check className="w-3.5 h-3.5 text-emerald-600" />
                <span>Tersalin</span>
              </>
            ) : (
              <>
                <Copy className="w-3.5 h-3.5" />
                <span>Salin .ino</span>
              </>
            )}
          </button>
        </div>
      </div>

      {/* Main Content Area */}
      <div
        className={`grid grid-cols-1 ${
          viewMode === 'both' ? 'xl:grid-cols-2' : ''
        } divide-y xl:divide-y-0 ${
          viewMode === 'both' ? 'xl:divide-x divide-slate-200' : ''
        }`}
      >
        {/* LEFT: VISUAL LOGIC BLOCKS */}
        {viewMode !== 'code' && (
          <div className="p-4 space-y-3 bg-slate-50/40">
            <div className="flex items-center justify-between text-xs text-slate-500 mb-1">
              <span className="inline-flex items-center gap-1.5 font-medium text-slate-700">
                <Blocks className="w-3.5 h-3.5 text-teal-700" />
                Blok Logika Interaktif
              </span>
              <span>Ubah blok untuk memperbarui kode langsung</span>
            </div>

            {/* Block 1: Pin & Setup */}
            <div
              onMouseEnter={() => setHoveredPhase('setup')}
              onMouseLeave={() => setHoveredPhase(null)}
              onClick={() => onFocusPhase?.('setup')}
              className={`p-3 rounded-lg border transition-colors ${
                executionPhase === 'setup'
                  ? 'bg-teal-50/70 border-teal-400'
                  : 'bg-white border-slate-200 hover:border-slate-300'
              }`}
            >
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs font-semibold text-slate-900">
                  1. Konfigurasi Pin & Serial (setup)
                </span>
                <span className="text-[11px] font-mono text-slate-500">
                  1× di awal
                </span>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 text-xs">
                {isAnalogPinSelectable ? (
                  <label className="flex items-center justify-between gap-2 bg-slate-50 px-2.5 py-1.5 rounded border border-slate-200">
                    <span className="text-slate-600">Pin Sensor:</span>
                    <select
                      value={config.sensorPin}
                      onChange={(e) =>
                        onUpdateConfig({ sensorPin: e.target.value })
                      }
                      className="font-mono font-semibold text-teal-800 bg-transparent focus:outline-none cursor-pointer"
                    >
                      <option value="A0">A0</option>
                      <option value="A1">A1</option>
                      <option value="A2">A2</option>
                    </select>
                  </label>
                ) : (
                  <div className="flex items-center justify-between bg-slate-50 px-2.5 py-1.5 rounded border border-slate-200">
                    <span className="text-slate-600">Pin Sensor:</span>
                    <span className="font-mono font-semibold text-slate-800">
                      {config.sensorPin}
                    </span>
                  </div>
                )}

                <label className="flex items-center justify-between gap-2 bg-slate-50 px-2.5 py-1.5 rounded border border-slate-200">
                  <span className="text-slate-600">Pin Aktuator:</span>
                  <select
                    value={config.actuatorPin}
                    onChange={(e) =>
                      onUpdateConfig({ actuatorPin: Number(e.target.value) })
                    }
                    className="font-mono font-semibold text-teal-800 bg-transparent focus:outline-none cursor-pointer"
                  >
                    <option value={6}>D6 (~)</option>
                    <option value={7}>D7</option>
                    <option value={8}>D8</option>
                    <option value={9}>D9 (~)</option>
                    <option value={13}>D13</option>
                  </select>
                </label>
              </div>
              <label className="mt-2.5 inline-flex items-center gap-2 text-xs text-slate-700 cursor-pointer">
                <input
                  type="checkbox"
                  checked={config.serialEnabled}
                  onChange={(e) =>
                    onUpdateConfig({ serialEnabled: e.target.checked })
                  }
                  className="rounded accent-teal-700 cursor-pointer"
                />
                <span>Cetak ke Serial Monitor (9600 bps)</span>
              </label>
            </div>

            {/* Block 2: Read Sensor */}
            <div
              onMouseEnter={() => setHoveredPhase('read')}
              onMouseLeave={() => setHoveredPhase(null)}
              onClick={() => onFocusPhase?.('read')}
              className={`p-3 rounded-lg border transition-colors ${
                executionPhase === 'read'
                  ? 'bg-sky-50/80 border-sky-400'
                  : 'bg-white border-slate-200 hover:border-slate-300'
              }`}
            >
              <div className="flex items-center justify-between gap-2">
                <span className="text-xs font-semibold text-slate-900">
                  2. Baca Nilai Sensor (loop)
                </span>
                <span className="font-mono text-xs font-semibold text-sky-700 tabular-nums">
                  {signalConnected
                    ? `${sensorDisplayValue} ${project.unitLabel}`
                    : 'Terputus'}
                  {projectId === 'plant-watering' && signalConnected
                    ? ` · ADC ${sensorRawValue}`
                    : ''}
                </span>
              </div>
              <p className="text-[11px] text-slate-500 mt-1">
                {projectId === 'plant-watering'
                  ? 'analogRead() membaca tegangan probe tanah (0–1023) lalu map() mengubahnya ke 0–100%.'
                  : `Membaca masukan langsung dari ${project.sensorName}.`}
              </p>
            </div>

            {/* Block 3: Conditional Logic (If/Else) */}
            <div
              onMouseEnter={() => setHoveredPhase('condition')}
              onMouseLeave={() => setHoveredPhase(null)}
              onClick={() => onFocusPhase?.('condition')}
              className={`p-3 rounded-lg border transition-colors ${
                executionPhase === 'condition'
                  ? 'bg-amber-50/80 border-amber-400'
                  : 'bg-white border-slate-200 hover:border-slate-300'
              }`}
            >
              <div className="flex items-center justify-between gap-2 mb-2">
                <span className="text-xs font-semibold text-slate-900">
                  3. Keputusan Logika (Jika / Maka)
                </span>
                <span
                  className={`text-[11px] font-mono font-semibold ${
                    !signalConnected
                      ? 'text-slate-400'
                      : conditionResult
                        ? 'text-emerald-700'
                        : 'text-slate-600'
                  }`}
                >
                  {signalConnected
                    ? conditionResult
                      ? 'BENAR (Jalankan IF)'
                      : 'SALAH (Jalankan ELSE)'
                    : 'Menunggu Sinyal'}
                </span>
              </div>

              {!isBinarySensor ? (
                <div className="space-y-2">
                  <div className="flex flex-wrap items-center gap-2 text-xs">
                    <span className="font-mono text-slate-700">JIKA nilai</span>
                    <select
                      aria-label="Operator perbandingan"
                      value={config.comparator}
                      onChange={(e) =>
                        onUpdateConfig({
                          comparator: e.target.value as ComparatorOp,
                        })
                      }
                      className="px-2 py-1 font-mono font-bold text-teal-800 bg-slate-50 border border-slate-300 rounded cursor-pointer"
                    >
                      <option value="<">&lt; (kurang dari)</option>
                      <option value="<=">&le; (maksimal)</option>
                      <option value=">">&gt; (lebih dari)</option>
                      <option value=">=">&ge; (minimal)</option>
                    </select>
                    <input
                      aria-label="Nilai ambang batas"
                      type="number"
                      min={project.minVal}
                      max={project.maxVal}
                      value={config.threshold}
                      onChange={(e) =>
                        onUpdateConfig({
                          threshold: Math.max(
                            project.minVal,
                            Math.min(project.maxVal, Number(e.target.value))
                          ),
                        })
                      }
                      className="w-20 px-2 py-1 font-mono font-bold text-slate-900 bg-slate-50 border border-slate-300 rounded tabular-nums"
                    />
                    <span className="font-mono text-slate-600">
                      {project.unitLabel}
                    </span>
                  </div>
                  <input
                    type="range"
                    min={project.minVal}
                    max={project.maxVal}
                    value={config.threshold}
                    onChange={(e) =>
                      onUpdateConfig({ threshold: Number(e.target.value) })
                    }
                    className="w-full accent-teal-700 cursor-pointer"
                  />
                </div>
              ) : (
                <div className="flex items-center justify-between text-xs bg-slate-50 px-2.5 py-2 rounded border border-slate-200">
                  <span className="font-mono text-slate-700">
                    JIKA Sinyal Input ==
                  </span>
                  <select
                    value={config.threshold >= 1 ? 1 : 0}
                    onChange={(e) =>
                      onUpdateConfig({ threshold: Number(e.target.value) })
                    }
                    className="font-mono font-bold text-teal-800 bg-white border border-slate-300 rounded px-2 py-1 cursor-pointer"
                  >
                    <option value={1}>HIGH (1)</option>
                    <option value={0}>LOW (0)</option>
                  </select>
                </div>
              )}

              {/* Branch summary */}
              <div className="mt-2.5 grid grid-cols-2 gap-2 text-[11px]">
                <div
                  className={`px-2.5 py-1.5 rounded border ${
                    executionPhase === 'branch-true' ||
                    (isRunning && conditionResult && signalConnected)
                      ? 'bg-emerald-50 border-emerald-300 text-emerald-900 font-medium'
                      : 'bg-slate-50 border-slate-200 text-slate-600'
                  }`}
                >
                  Jika Benar: Aktuator ON
                </div>
                <div
                  className={`px-2.5 py-1.5 rounded border ${
                    executionPhase === 'branch-false' ||
                    (isRunning && !conditionResult && signalConnected)
                      ? 'bg-slate-100 border-slate-300 text-slate-900 font-medium'
                      : 'bg-slate-50 border-slate-200 text-slate-600'
                  }`}
                >
                  Jika Salah: Aktuator OFF
                </div>
              </div>
            </div>

            {/* Block 4: Delay */}
            <div
              onMouseEnter={() => setHoveredPhase('delay')}
              onMouseLeave={() => setHoveredPhase(null)}
              onClick={() => onFocusPhase?.('delay')}
              className={`p-3 rounded-lg border transition-colors ${
                executionPhase === 'delay'
                  ? 'bg-indigo-50/70 border-indigo-300'
                  : 'bg-white border-slate-200 hover:border-slate-300'
              }`}
            >
              <div className="flex items-center justify-between gap-2 text-xs">
                <span className="font-semibold text-slate-900">
                  4. Jeda Siklus (delay)
                </span>
                <select
                  aria-label="Jeda waktu loop"
                  value={config.delayMs}
                  onChange={(e) =>
                    onUpdateConfig({ delayMs: Number(e.target.value) })
                  }
                  className="font-mono font-semibold text-slate-800 bg-slate-50 border border-slate-300 rounded px-2 py-1 cursor-pointer tabular-nums"
                >
                  <option value={250}>250 ms</option>
                  <option value={500}>500 ms</option>
                  <option value={800}>800 ms</option>
                  <option value={1000}>1000 ms (1 dtk)</option>
                  <option value={1500}>1500 ms</option>
                </select>
              </div>
            </div>
          </div>
        )}

        {/* RIGHT: LIVE ARDUINO C++ CODE EDITOR */}
        {viewMode !== 'blocks' && (
          <div className="flex flex-col bg-slate-950 text-slate-100">
            <div className="px-3.5 py-2 border-b border-slate-800 flex items-center justify-between text-[11px] font-mono text-slate-400">
              <span>sketch_{projectId.replace('-', '_')}.ino</span>
              <span>Klik baris kode untuk penjelasan</span>
            </div>

            <div className="p-3 overflow-x-auto text-xs font-mono leading-relaxed max-h-[420px] overflow-y-auto">
              {codeLines.map((line) => {
                const isExecActive =
                  executionPhase !== 'idle' && line.phase === executionPhase;
                const isHoverHighlight =
                  hoveredPhase !== null && line.phase === hoveredPhase;
                const isSelected = selectedLine === line.lineNumber;

                return (
                  <button
                    key={line.lineNumber}
                    type="button"
                    onClick={() =>
                      setSelectedLine(
                        isSelected ? null : line.lineNumber
                      )
                    }
                    className={`w-full text-left flex items-start gap-2.5 px-2 py-0.5 rounded transition-colors cursor-pointer ${
                      isExecActive
                        ? 'bg-teal-500/25 text-teal-100'
                        : isSelected
                          ? 'bg-sky-500/20 text-sky-100'
                          : isHoverHighlight
                            ? 'bg-slate-800/90'
                            : 'hover:bg-slate-900'
                    }`}
                  >
                    <span className="w-6 shrink-0 text-right text-slate-500 select-none tabular-nums">
                      {isExecActive ? (
                        <ChevronRight className="w-3.5 h-3.5 inline text-teal-400" />
                      ) : (
                        line.lineNumber
                      )}
                    </span>
                    <span className="whitespace-pre text-slate-200">
                      {line.text || ' '}
                    </span>
                  </button>
                );
              })}
            </div>

            {/* Line Explanation Callout */}
            <div className="mt-auto px-3.5 py-2.5 bg-slate-900 border-t border-slate-800 flex items-start gap-2 text-xs text-slate-300">
              <Info className="w-4 h-4 text-teal-400 shrink-0 mt-0.5" />
              <div className="min-w-0">
                <span className="font-mono text-teal-300 mr-1.5">
                  Baris {activeExplanation?.lineNumber ?? 1}:
                </span>
                <span>
                  {activeExplanation?.explanation ??
                    'Klik baris mana saja untuk memahami cara kerja perintah Arduino.'}
                </span>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
