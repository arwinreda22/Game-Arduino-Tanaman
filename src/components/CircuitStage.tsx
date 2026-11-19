import React, { useState } from 'react';
import {
  Droplets,
  Play,
  Pause,
  StepForward,
  RotateCcw,
  Cable,
  AlertTriangle,
  CheckCircle2,
  Zap,
  Sun,
  Moon,
  UserCheck,
  Hand,
} from 'lucide-react';
import {
  CodeBlockConfig,
  EnvironmentState,
  ExecutionPhase,
  ProjectId,
  WireConnection,
} from '../types/arduino';
import { ARDUINO_PROJECTS } from '../data/projects';

interface CircuitStageProps {
  projectId: ProjectId;
  codeConfig: CodeBlockConfig;
  env: EnvironmentState;
  wires: WireConnection[];
  isRunning: boolean;
  executionPhase: ExecutionPhase;
  actuatorActive: boolean;
  sensorDisplayValue: number;
  sensorRawValue: number;
  sensorVoltage: number;
  signalConnected: boolean;
  simSpeed: 1 | 2;
  onToggleRun: () => void;
  onStepExecution: () => void;
  onResetSimulation: () => void;
  onToggleSpeed: () => void;
  onToggleWire: (wireId: string) => void;
  onUpdateEnv: (patch: Partial<EnvironmentState>) => void;
  onSelectPhaseHighlight?: (phase: ExecutionPhase) => void;
}

const ARDUINO_PIN_COORDS: Record<string, { x: number; y: number }> = {
  '5V': { x: 122, y: 312 },
  GND: { x: 146, y: 312 },
  A0: { x: 186, y: 312 },
  A1: { x: 204, y: 312 },
  A2: { x: 222, y: 312 },
  D13: { x: 112, y: 124 },
  D10: { x: 148, y: 124 },
  D9: { x: 164, y: 124 },
  D8: { x: 180, y: 124 },
  D7: { x: 196, y: 124 },
  D6: { x: 212, y: 124 },
  D2: { x: 260, y: 124 },
};

function interpolateSoilColor(moisturePct: number): string {
  // 0% dry sandy #c6925d -> 100% rich wet loam #3d2817
  const t = Math.max(0, Math.min(1, moisturePct / 100));
  const r = Math.round(198 + (61 - 198) * t);
  const g = Math.round(146 + (40 - 146) * t);
  const b = Math.round(93 + (23 - 93) * t);
  return `rgb(${r}, ${g}, ${b})`;
}

function getWireTargetCoord(
  projectId: ProjectId,
  wire: WireConnection
): { x: number; y: number } {
  if (projectId === 'plant-watering') {
    if (wire.fromPin === 'VCC') return { x: 465, y: 270 };
    if (wire.fromPin === 'GND') return { x: 465, y: 294 };
    if (wire.fromPin === 'AO') return { x: 465, y: 318 };
    return { x: 488, y: 132 }; // Relay IN
  }
  if (projectId === 'ultrasonic-radar') {
    if (wire.fromPin === 'VCC') return { x: 455, y: 260 };
    if (wire.fromPin === 'GND') return { x: 455, y: 300 };
    if (wire.fromPin === 'ECHO') return { x: 455, y: 280 };
    return { x: 488, y: 138 }; // Buzzer
  }
  if (projectId === 'dht11-fan') {
    if (wire.fromPin === 'VCC') return { x: 460, y: 264 };
    if (wire.fromPin === 'GND') return { x: 460, y: 304 };
    if (wire.fromPin === 'DATA') return { x: 460, y: 284 };
    return { x: 495, y: 138 }; // Fan
  }
  if (projectId === 'ldr-streetlamp') {
    if (wire.fromPin === 'VCC') return { x: 460, y: 264 };
    if (wire.fromPin === 'GND') return { x: 460, y: 304 };
    if (wire.fromPin === 'AO') return { x: 460, y: 284 };
    return { x: 500, y: 138 }; // Streetlamp
  }
  if (projectId === 'pir-alarm') {
    if (wire.fromPin === 'VCC') return { x: 460, y: 264 };
    if (wire.fromPin === 'GND') return { x: 460, y: 304 };
    if (wire.fromPin === 'OUT') return { x: 460, y: 284 };
    return { x: 495, y: 138 }; // Siren
  }
  // blink-button
  if (wire.fromPin === 'VCC') return { x: 460, y: 264 };
  if (wire.fromPin === 'GND') return { x: 460, y: 304 };
  if (wire.fromPin === 'OUT') return { x: 460, y: 284 };
  return { x: 495, y: 138 };
}

export const CircuitStage: React.FC<CircuitStageProps> = ({
  projectId,
  codeConfig,
  env,
  wires,
  isRunning,
  executionPhase,
  actuatorActive,
  sensorDisplayValue,
  sensorRawValue,
  sensorVoltage,
  signalConnected,
  simSpeed,
  onToggleRun,
  onStepExecution,
  onResetSimulation,
  onToggleSpeed,
  onToggleWire,
  onUpdateEnv,
  onSelectPhaseHighlight,
}) => {
  const [hoveredPin, setHoveredPin] = useState<string | null>(null);
  const project = ARDUINO_PROJECTS[projectId];
  const hasPower =
    wires.some((w) => w.signalType === 'power' && w.connected) &&
    wires.some((w) => w.signalType === 'ground' && w.connected);

  const txActive = isRunning && executionPhase === 'serial';
  const pin13Active =
    isRunning &&
    ((projectId === 'blink-button' && actuatorActive) ||
      (projectId === 'plant-watering' && actuatorActive));

  const renderWirePath = (wire: WireConnection) => {
    // Resolve dynamic target Arduino pin from codeConfig if applicable
    let arduinoPinKey = wire.toPin;
    if (wire.id === 'w-soil-ao' || wire.id === 'w-ldr-ao') {
      arduinoPinKey = codeConfig.sensorPin;
    } else if (
      wire.id === 'w-relay-in' ||
      wire.id === 'w-us-buzzer' ||
      wire.id === 'w-dht-fan' ||
      wire.id === 'w-ldr-led' ||
      wire.id === 'w-pir-buzzer' ||
      wire.id === 'w-btn-led'
    ) {
      arduinoPinKey = `D${codeConfig.actuatorPin}`;
    }

    const start = ARDUINO_PIN_COORDS[arduinoPinKey] ?? { x: 200, y: 124 };
    const end = getWireTargetCoord(projectId, wire);
    const midX = (start.x + end.x) / 2;
    const isTopPin = start.y < 200;
    const cp1y = isTopPin ? start.y - 48 : start.y + 48;
    const cp2y = end.y;
    const d = `M ${start.x} ${start.y} C ${midX} ${cp1y}, ${midX - 20} ${cp2y}, ${end.x} ${end.y}`;

    const isSignalFlowing =
      isRunning &&
      wire.connected &&
      hasPower &&
      (wire.signalType === 'power' ||
        wire.signalType === 'ground' ||
        (wire.signalType === 'analog' && signalConnected) ||
        (wire.signalType === 'digital' &&
          (actuatorActive || wire.fromPin === 'DATA' || wire.fromPin === 'OUT' || wire.fromPin === 'ECHO')));

    return (
      <g
        key={wire.id}
        onClick={() => onToggleWire(wire.id)}
        className="cursor-pointer group"
      >
        {/* Invisible wider click target */}
        <path d={d} fill="none" stroke="transparent" strokeWidth={14} />
        {/* Base wire */}
        <path
          d={d}
          fill="none"
          stroke={wire.connected ? wire.color : '#cbd5e1'}
          strokeWidth={wire.connected ? 3.5 : 2}
          strokeDasharray={wire.connected ? undefined : '5 5'}
          strokeLinecap="round"
          className="transition-all duration-150 group-hover:opacity-80"
        />
        {/* Animated electron/current flow */}
        {isSignalFlowing && (
          <path
            d={d}
            fill="none"
            stroke="#ffffff"
            strokeOpacity={0.75}
            strokeWidth={2}
            strokeLinecap="round"
            className="wire-flow-active pointer-events-none"
          />
        )}
        {/* Pin terminal dots */}
        <circle
          cx={start.x}
          cy={start.y}
          r={4.5}
          fill={wire.connected ? wire.color : '#94a3b8'}
          stroke="#ffffff"
          strokeWidth={1.5}
        />
        <circle
          cx={end.x}
          cy={end.y}
          r={4.5}
          fill={wire.connected ? wire.color : '#94a3b8'}
          stroke="#ffffff"
          strokeWidth={1.5}
        />
      </g>
    );
  };

  return (
    <div className="bg-white border border-slate-200 rounded-xl overflow-hidden">
      {/* Workbench Control Toolbar */}
      <div className="px-4 py-3 border-b border-slate-200 bg-slate-50/70 flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3 min-w-0">
          <div className="min-w-0">
            <h2 className="font-display text-base font-semibold text-slate-900 truncate">
              {project.title}
            </h2>
            <p className="text-xs text-slate-500 truncate">{project.subtitle}</p>
          </div>
        </div>

        {/* Playback & Step Controls */}
        <div className="flex items-center gap-2 flex-wrap">
          <button
            type="button"
            onClick={onToggleRun}
            className={`inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-semibold rounded-lg transition-colors whitespace-nowrap shrink-0 cursor-pointer focus-visible:outline-2 focus-visible:outline-teal-600 ${
              isRunning
                ? 'bg-amber-600 hover:bg-amber-700 text-white'
                : 'bg-teal-700 hover:bg-teal-800 text-white'
            }`}
          >
            {isRunning ? (
              <>
                <Pause className="w-3.5 h-3.5" />
                <span>Jeda Simulasi</span>
              </>
            ) : (
              <>
                <Play className="w-3.5 h-3.5" />
                <span>Jalankan</span>
              </>
            )}
          </button>

          <button
            type="button"
            onClick={onStepExecution}
            title="Jalankan kode langkah demi langkah"
            className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-medium text-slate-700 bg-white border border-slate-200 hover:bg-slate-100 rounded-lg transition-colors whitespace-nowrap shrink-0 cursor-pointer"
          >
            <StepForward className="w-3.5 h-3.5 text-teal-700" />
            <span>Langkah Kode</span>
          </button>

          <button
            type="button"
            onClick={onToggleSpeed}
            className="px-2.5 py-2 text-xs font-mono font-medium text-slate-700 bg-white border border-slate-200 hover:bg-slate-100 rounded-lg transition-colors whitespace-nowrap shrink-0 cursor-pointer tabular-nums"
          >
            {simSpeed}x
          </button>

          <button
            type="button"
            onClick={onResetSimulation}
            title="Reset simulasi ke kondisi awal"
            className="inline-flex items-center gap-1 px-2.5 py-2 text-xs font-medium text-slate-600 bg-white border border-slate-200 hover:bg-slate-100 rounded-lg transition-colors whitespace-nowrap shrink-0 cursor-pointer"
          >
            <RotateCcw className="w-3.5 h-3.5" />
            <span>Reset</span>
          </button>
        </div>
      </div>

      {/* Live Status Strip (Dual-coded icon + text, zero-pill clean layout) */}
      <div className="px-4 py-2 border-b border-slate-100 bg-white flex flex-wrap items-center justify-between gap-4 text-xs">
        <div className="flex items-center gap-4 flex-wrap">
          <span
            className={`inline-flex items-center gap-1.5 font-medium ${
              !hasPower || !signalConnected
                ? 'text-red-700'
                : isRunning
                  ? 'text-emerald-700'
                  : 'text-slate-600'
            }`}
          >
            {!hasPower || !signalConnected ? (
              <AlertTriangle className="w-3.5 h-3.5" />
            ) : (
              <CheckCircle2 className="w-3.5 h-3.5" />
            )}
            <span>
              {!hasPower
                ? 'Daya Terputus (Periksa 5V / GND)'
                : !signalConnected
                  ? 'Kabel Sinyal Terlepas'
                  : isRunning
                    ? 'Simulasi Aktif'
                    : 'Siap Dijalankan'}
            </span>
          </span>

          <span className="text-slate-300" aria-hidden="true">
            |
          </span>

          <span className="text-slate-600 font-mono tabular-nums">
            Pembacaan:{' '}
            <strong className="text-slate-900">
              {signalConnected
                ? `${sensorDisplayValue} ${project.unitLabel}`
                : '---'}
            </strong>
          </span>

          <span className="text-slate-300 hidden sm:inline" aria-hidden="true">
            |
          </span>

          <span className="text-slate-600 font-mono tabular-nums hidden sm:inline">
            Tegangan Pin:{' '}
            <strong className="text-slate-900">{sensorVoltage.toFixed(2)} V</strong>
            {projectId === 'plant-watering' || projectId === 'ldr-streetlamp'
              ? ` (ADC ${sensorRawValue})`
              : ''}
          </span>
        </div>

        <div className="flex items-center gap-2 font-mono">
          <Zap
            className={`w-3.5 h-3.5 ${
              actuatorActive && isRunning ? 'text-emerald-600' : 'text-slate-400'
            }`}
          />
          <span
            className={
              actuatorActive && isRunning
                ? 'font-semibold text-emerald-700'
                : 'text-slate-500'
            }
          >
            {project.actuatorName}: {actuatorActive && isRunning ? 'AKTIF (5V)' : 'MATI (0V)'}
          </span>
        </div>
      </div>

      {/* Main Interactive SVG Circuit Canvas */}
      <div className="relative lab-grid-bg overflow-x-auto">
        <svg
          viewBox="0 0 920 420"
          className="w-full min-w-[720px] h-auto select-none block"
          role="img"
          aria-label={`Simulasi sirkuit Arduino untuk ${project.title}`}
        >
          <defs>
            <linearGradient id="arduinoBoardGrad" x1="0" y1="0" x2="1" y2="1">
              <stop offset="0%" stopColor="#00878f" />
              <stop offset="100%" stopColor="#00666d" />
            </linearGradient>
            <linearGradient id="waterGrad" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#38bdf8" stopOpacity="0.85" />
              <stop offset="100%" stopColor="#0284c7" stopOpacity="0.95" />
            </linearGradient>
            <linearGradient id="potGrad" x1="0" y1="0" x2="1" y2="0">
              <stop offset="0%" stopColor="#b45309" />
              <stop offset="50%" stopColor="#d97706" />
              <stop offset="100%" stopColor="#92400e" />
            </linearGradient>
          </defs>

          {/* ================= ARDUINO UNO R3 BOARD (LEFT) ================= */}
          <g transform="translate(30, 88)">
            {/* Shadow */}
            <rect
              x={4}
              y={6}
              width={260}
              height={240}
              rx={10}
              fill="#0f172a"
              fillOpacity={0.08}
            />
            {/* Main Teal PCB */}
            <rect
              x={0}
              y={0}
              width={260}
              height={240}
              rx={10}
              fill="url(#arduinoBoardGrad)"
              stroke="#004d52"
              strokeWidth={1.5}
            />
            {/* USB-B Port */}
            <rect
              x={-12}
              y={32}
              width={44}
              height={46}
              rx={3}
              fill="#cbd5e1"
              stroke="#64748b"
              strokeWidth={1.5}
            />
            <rect x={-8} y={38} width={16} height={34} fill="#94a3b8" />
            {/* DC Barrel Jack */}
            <rect
              x={-8}
              y={172}
              width={40}
              height={36}
              rx={3}
              fill="#1e293b"
              stroke="#0f172a"
            />
            {/* Reset Button */}
            <rect x={14} y={10} width={20} height={16} rx={3} fill="#e2e8f0" />
            <circle cx={24} cy={18} r={4.5} fill="#dc2626" />
            <text x={10} y={24} fontSize={7} fill="#e2e8f0" fontFamily="JetBrains Mono">
              RST
            </text>

            {/* Board Title */}
            <text
              x={95}
              y={88}
              fontSize={13}
              fontWeight="700"
              fill="#ffffff"
              fontFamily="Plus Jakarta Sans"
              letterSpacing={0.5}
            >
              ARDUINO UNO R3
            </text>
            <text
              x={95}
              y={102}
              fontSize={8}
              fill="#99f6e4"
              fontFamily="JetBrains Mono"
            >
              ATmega328P · 5V Logic
            </text>

            {/* ATmega328P Microcontroller IC */}
            <rect
              x={76}
              y={128}
              width={148}
              height={42}
              rx={3}
              fill="#1e293b"
              stroke="#0f172a"
            />
            <circle cx={85} cy={149} r={3.5} fill="#475569" />
            <text
              x={110}
              y={153}
              fontSize={8.5}
              fill="#cbd5e1"
              fontFamily="JetBrains Mono"
            >
              ATMEGA328P-PU
            </text>

            {/* IC Pins */}
            {Array.from({ length: 14 }).map((_, i) => (
              <React.Fragment key={i}>
                <rect
                  x={82 + i * 10}
                  y={123}
                  width={4}
                  height={5}
                  fill="#cbd5e1"
                />
                <rect
                  x={82 + i * 10}
                  y={170}
                  width={4}
                  height={5}
                  fill="#cbd5e1"
                />
              </React.Fragment>
            ))}

            {/* Hardware Status LEDs on Board */}
            {/* ON LED */}
            <g transform="translate(218, 66)">
              <circle
                cx={0}
                cy={0}
                r={4.5}
                fill={isRunning ? '#22c55e' : '#14532d'}
              />
              {isRunning && (
                <circle
                  cx={0}
                  cy={0}
                  r={8}
                  fill="#22c55e"
                  fillOpacity={0.28}
                />
              )}
              <text
                x={8}
                y={3}
                fontSize={7.5}
                fill="#ffffff"
                fontFamily="JetBrains Mono"
              >
                ON
              </text>
            </g>
            {/* L (Pin 13) LED */}
            <g transform="translate(170, 66)">
              <circle
                cx={0}
                cy={0}
                r={4}
                fill={pin13Active ? '#f59e0b' : '#451a03'}
              />
              {pin13Active && (
                <circle
                  cx={0}
                  cy={0}
                  r={8}
                  fill="#f59e0b"
                  fillOpacity={0.35}
                />
              )}
              <text
                x={7}
                y={3}
                fontSize={7.5}
                fill="#ffffff"
                fontFamily="JetBrains Mono"
              >
                L
              </text>
            </g>
            {/* TX LED */}
            <g transform="translate(128, 66)">
              <circle
                cx={0}
                cy={0}
                r={3.5}
                fill={txActive ? '#f97316' : '#431407'}
              />
              <text
                x={7}
                y={3}
                fontSize={7.5}
                fill="#ffffff"
                fontFamily="JetBrains Mono"
              >
                TX
              </text>
            </g>

            {/* TOP HEADER: DIGITAL PINS (D13 .. D2) */}
            <rect
              x={68}
              y={8}
              width={182}
              height={32}
              rx={3}
              fill="#0f172a"
            />
            {[
              { label: '13', x: 82, key: 'D13' },
              { label: '10~', x: 118, key: 'D10' },
              { label: '9~', x: 134, key: 'D9' },
              { label: '8', x: 150, key: 'D8' },
              { label: '7', x: 166, key: 'D7' },
              { label: '6~', x: 182, key: 'D6' },
              { label: '2', x: 230, key: 'D2' },
            ].map((p) => {
              const isActuatorPin = `D${codeConfig.actuatorPin}` === p.key;
              return (
                <g
                  key={p.key}
                  onMouseEnter={() => setHoveredPin(p.key)}
                  onMouseLeave={() => setHoveredPin(null)}
                  className="cursor-pointer"
                >
                  <rect
                    x={p.x - 5}
                    y={30}
                    width={10}
                    height={10}
                    rx={1.5}
                    fill={
                      isActuatorPin && actuatorActive && isRunning
                        ? '#22c55e'
                        : '#334155'
                    }
                    stroke="#94a3b8"
                    strokeWidth={0.8}
                  />
                  <text
                    x={p.x}
                    y={22}
                    textAnchor="middle"
                    fontSize={7}
                    fill="#e2e8f0"
                    fontFamily="JetBrains Mono"
                  >
                    {p.label}
                  </text>
                </g>
              );
            })}
            <text
              x={156}
              y={49}
              textAnchor="middle"
              fontSize={7}
              fill="#ccfbf1"
              fontFamily="JetBrains Mono"
            >
              DIGITAL (PWM ~)
            </text>

            {/* BOTTOM HEADER: POWER & ANALOG IN */}
            <rect
              x={68}
              y={202}
              width={182}
              height={32}
              rx={3}
              fill="#0f172a"
            />
            {[
              { label: '5V', x: 92, key: '5V', color: '#dc2626' },
              { label: 'GND', x: 116, key: 'GND', color: '#475569' },
              { label: 'A0', x: 156, key: 'A0', color: '#0284c7' },
              { label: 'A1', x: 174, key: 'A1', color: '#0284c7' },
              { label: 'A2', x: 192, key: 'A2', color: '#0284c7' },
            ].map((p) => (
              <g
                key={p.key}
                onMouseEnter={() => setHoveredPin(p.key)}
                onMouseLeave={() => setHoveredPin(null)}
                className="cursor-pointer"
              >
                <rect
                  x={p.x - 5}
                  y={218}
                  width={10}
                  height={10}
                  rx={1.5}
                  fill="#334155"
                  stroke={p.color}
                  strokeWidth={1}
                />
                <text
                  x={p.x}
                  y={213}
                  textAnchor="middle"
                  fontSize={7}
                  fill="#e2e8f0"
                  fontFamily="JetBrains Mono"
                >
                  {p.label}
                </text>
              </g>
            ))}
            <text
              x={104}
              y={197}
              textAnchor="middle"
              fontSize={6.5}
              fill="#ccfbf1"
              fontFamily="JetBrains Mono"
            >
              POWER
            </text>
            <text
              x={186}
              y={197}
              textAnchor="middle"
              fontSize={6.5}
              fill="#ccfbf1"
              fontFamily="JetBrains Mono"
            >
              ANALOG IN
            </text>
          </g>

          {/* ================= JUMPER WIRES ================= */}
          <g>{wires.map((wire) => renderWirePath(wire))}</g>

          {/* ================= PROJECT STAGE (RIGHT HALF) ================= */}
          {projectId === 'plant-watering' && (
            <g>
              {/* 5V RELAY MODULE */}
              <g transform="translate(480, 92)">
                <rect
                  x={0}
                  y={0}
                  width={118}
                  height={84}
                  rx={8}
                  fill="#1e3a8a"
                  stroke="#172554"
                  strokeWidth={1.5}
                />
                <text
                  x={59}
                  y={18}
                  textAnchor="middle"
                  fontSize={9.5}
                  fontWeight="700"
                  fill="#ffffff"
                  fontFamily="Plus Jakarta Sans"
                >
                  MODUL RELAY 5V
                </text>
                {/* Relay Cube */}
                <rect
                  x={42}
                  y={26}
                  width={56}
                  height={42}
                  rx={3}
                  fill="#0284c7"
                  stroke="#0369a1"
                />
                {/* Internal Contact Symbol */}
                <line
                  x1={52}
                  y1={48}
                  x2={65}
                  y2={48}
                  stroke="#ffffff"
                  strokeWidth={2}
                />
                <line
                  x1={65}
                  y1={48}
                  x2={80}
                  y2={actuatorActive && isRunning ? 48 : 37}
                  stroke="#fef08a"
                  strokeWidth={2.5}
                  strokeLinecap="round"
                />
                <circle cx={82} cy={48} r={2.5} fill="#ffffff" />
                <text
                  x={70}
                  y={62}
                  textAnchor="middle"
                  fontSize={7}
                  fill="#e0f2fe"
                  fontFamily="JetBrains Mono"
                >
                  {actuatorActive && isRunning ? 'TERTUTUP (ON)' : 'TERBUKA (OFF)'}
                </text>
                {/* Relay Input Pin */}
                <rect x={4} y={34} width={16} height={14} rx={2} fill="#0f172a" />
                <text
                  x={24}
                  y={44}
                  fontSize={8}
                  fill="#bfdbfe"
                  fontFamily="JetBrains Mono"
                >
                  IN
                </text>
                {/* Relay LED */}
                <circle
                  cx={24}
                  cy={64}
                  r={4.5}
                  fill={actuatorActive && isRunning ? '#22c55e' : '#334155'}
                />
                <text
                  x={32}
                  y={67}
                  fontSize={7}
                  fill="#cbd5e1"
                  fontFamily="JetBrains Mono"
                >
                  AKTIF
                </text>
              </g>

              {/* SOIL MOISTURE SENSOR PCB MODULE */}
              <g transform="translate(460, 245)">
                <rect
                  x={0}
                  y={0}
                  width={94}
                  height={92}
                  rx={7}
                  fill="#0f172a"
                  stroke="#334155"
                  strokeWidth={1.5}
                />
                <text
                  x={47}
                  y={16}
                  textAnchor="middle"
                  fontSize={8}
                  fontWeight="600"
                  fill="#f8fafc"
                  fontFamily="Plus Jakarta Sans"
                >
                  SENSOR TANAH
                </text>
                {/* Pin labels */}
                <text x={14} y={29} fontSize={8} fill="#fca5a5" fontFamily="JetBrains Mono">
                  VCC
                </text>
                <text x={14} y={53} fontSize={8} fill="#cbd5e1" fontFamily="JetBrains Mono">
                  GND
                </text>
                <text x={14} y={77} fontSize={8} fill="#7dd3fc" fontFamily="JetBrains Mono">
                  AO
                </text>
                {/* Trimpot */}
                <rect x={54} y={28} width={24} height={24} rx={2} fill="#0284c7" />
                <circle cx={66} cy={40} r={6} fill="#e2e8f0" />
                <line x1={62} y1={40} x2={70} y2={40} stroke="#475569" strokeWidth={1.5} />
                {/* Status LED on module */}
                <circle
                  cx={66}
                  cy={68}
                  r={4}
                  fill={
                    hasPower && env.soilMoisturePct < codeConfig.threshold
                      ? '#ef4444'
                      : hasPower
                        ? '#22c55e'
                        : '#334155'
                  }
                />
                <text
                  x={66}
                  y={82}
                  textAnchor="middle"
                  fontSize={6.5}
                  fill="#94a3b8"
                  fontFamily="JetBrains Mono"
                >
                  {env.soilMoisturePct < codeConfig.threshold ? 'KERING' : 'LEMBAP'}
                </text>
              </g>

              {/* Cable from Sensor Module to Probe in Pot */}
              <path
                d="M 554 292 C 588 292, 595 256, 622 256"
                fill="none"
                stroke="#334155"
                strokeWidth={3}
              />

              {/* WATER RESERVOIR TANK & PUMP */}
              <g transform="translate(792, 224)">
                <text
                  x={48}
                  y={-10}
                  textAnchor="middle"
                  fontSize={10}
                  fontWeight="600"
                  fill="#0f172a"
                  fontFamily="Plus Jakarta Sans"
                >
                  Tangki Air
                </text>
                {/* Tank outer glass */}
                <rect
                  x={0}
                  y={0}
                  width={96}
                  height={136}
                  rx={8}
                  fill="#e0f2fe"
                  fillOpacity={0.45}
                  stroke="#0284c7"
                  strokeWidth={2}
                />
                {/* Water level fill */}
                {env.tankWaterPct > 0 && (
                  <rect
                    x={3}
                    y={133 - (env.tankWaterPct / 100) * 124}
                    width={90}
                    height={(env.tankWaterPct / 100) * 124}
                    rx={5}
                    fill="url(#waterGrad)"
                  />
                )}
                {/* Submersible Mini Pump */}
                <rect
                  x={24}
                  y={96}
                  width={48}
                  height={32}
                  rx={4}
                  fill="#1e293b"
                  stroke="#0f172a"
                />
                <text
                  x={48}
                  y={115}
                  textAnchor="middle"
                  fontSize={7.5}
                  fill="#f8fafc"
                  fontFamily="JetBrains Mono"
                >
                  POMPA
                </text>
                <text
                  x={48}
                  y={152}
                  textAnchor="middle"
                  fontSize={10}
                  fontWeight="600"
                  fill="#0369a1"
                  fontFamily="JetBrains Mono"
                >
                  {Math.round(env.tankWaterPct)}%
                </text>
              </g>

              {/* Power wire from Relay to Pump */}
              <path
                d="M 598 134 C 700 134, 840 160, 840 224"
                fill="none"
                stroke={actuatorActive && isRunning ? '#ef4444' : '#94a3b8'}
                strokeWidth={2.5}
              />
              {actuatorActive && isRunning && (
                <path
                  d="M 598 134 C 700 134, 840 160, 840 224"
                  fill="none"
                  stroke="#ffffff"
                  strokeWidth={1.8}
                  className="wire-flow-active"
                />
              )}

              {/* Silicone Water Tube from Pump to Pot Nozzle */}
              <path
                d="M 840 320 L 840 168 C 840 112, 748 112, 718 164"
                fill="none"
                stroke={
                  actuatorActive && isRunning && env.tankWaterPct > 0
                    ? '#0ea5e9'
                    : '#cbd5e1'
                }
                strokeWidth={7}
                strokeLinecap="round"
              />
              <path
                d="M 840 320 L 840 168 C 840 112, 748 112, 718 164"
                fill="none"
                stroke={
                  actuatorActive && isRunning && env.tankWaterPct > 0
                    ? '#bae6fd'
                    : '#f1f5f9'
                }
                strokeWidth={3}
                strokeLinecap="round"
                className={
                  actuatorActive && isRunning && env.tankWaterPct > 0
                    ? 'wire-flow-active'
                    : undefined
                }
              />

              {/* Animated Water Spray Droplets */}
              {actuatorActive && isRunning && env.tankWaterPct > 0 && (
                <g transform="translate(718, 168)">
                  <circle
                    cx={-6}
                    cy={4}
                    r={3.5}
                    fill="#0ea5e9"
                    className="water-droplet"
                  />
                  <circle
                    cx={2}
                    cy={10}
                    r={3}
                    fill="#38bdf8"
                    className="water-droplet"
                    style={{ animationDelay: '0.25s' }}
                  />
                  <circle
                    cx={-10}
                    cy={14}
                    r={2.8}
                    fill="#0284c7"
                    className="water-droplet"
                    style={{ animationDelay: '0.5s' }}
                  />
                </g>
              )}

              {/* POTTED PLANT & SOIL CROSS-SECTION */}
              <g transform="translate(595, 130)">
                {/* Plant Stem & Leaves */}
                {(() => {
                  const isDry = env.soilMoisturePct < 25;
                  const leafColor = isDry ? '#84a93c' : '#16a34a';
                  const droopY = isDry ? 14 : 0;
                  return (
                    <g transform="translate(80, 88)">
                      {/* Main Stem */}
                      <path
                        d={`M 0 22 Q ${isDry ? 8 : 2} -18, ${isDry ? 12 : 0} ${-56 + droopY}`}
                        fill="none"
                        stroke="#15803d"
                        strokeWidth={5}
                        strokeLinecap="round"
                      />
                      {/* Left Leaf */}
                      <path
                        d={`M 0 -16 C -26 ${-38 + droopY}, -44 ${-26 + droopY}, -38 ${-8 + droopY} C -28 ${-4 + droopY}, -10 ${-8 + droopY}, 0 -16 Z`}
                        fill={leafColor}
                      />
                      {/* Right Leaf */}
                      <path
                        d={`M 2 -28 C 28 ${-50 + droopY}, 46 ${-36 + droopY}, 38 ${-16 + droopY} C 28 ${-12 + droopY}, 12 ${-18 + droopY}, 2 -28 Z`}
                        fill={leafColor}
                      />
                      {/* Top Sprout Leaf */}
                      <path
                        d={`M ${isDry ? 10 : 0} ${-52 + droopY} C -10 ${-82 + droopY}, 16 ${-92 + droopY}, 22 ${-64 + droopY} C 16 ${-52 + droopY}, 8 ${-50 + droopY}, ${isDry ? 10 : 0} ${-52 + droopY} Z`}
                        fill="#22c55e"
                      />
                    </g>
                  );
                })()}

                {/* Terracotta Pot */}
                <polygon
                  points="18,112 142,112 126,232 34,232"
                  fill="url(#potGrad)"
                  stroke="#78350f"
                  strokeWidth={1.5}
                />
                {/* Pot Rim */}
                <rect
                  x={10}
                  y={98}
                  width={140}
                  height={18}
                  rx={4}
                  fill="#d97706"
                  stroke="#78350f"
                  strokeWidth={1.5}
                />

                {/* Soil Cutaway Window */}
                <polygon
                  points="28,120 132,120 120,218 40,218"
                  fill={interpolateSoilColor(env.soilMoisturePct)}
                  stroke="#451a03"
                  strokeWidth={1}
                />

                {/* Soil Moisture Probe Inserted in Soil */}
                <g transform="translate(36, 102)">
                  <rect
                    x={0}
                    y={0}
                    width={16}
                    height={16}
                    rx={2}
                    fill="#1e293b"
                  />
                  {/* Two conductive fork prongs */}
                  <rect x={3} y={16} width={3.5} height={66} rx={1} fill="#eab308" />
                  <rect x={9.5} y={16} width={3.5} height={66} rx={1} fill="#eab308" />
                </g>

                {/* Live Moisture Readout Label inside Pot */}
                <text
                  x={84}
                  y={178}
                  textAnchor="middle"
                  fontSize={16}
                  fontWeight="700"
                  fill="#ffffff"
                  fontFamily="JetBrains Mono"
                >
                  {Math.round(env.soilMoisturePct)}%
                </text>
                <text
                  x={84}
                  y={195}
                  textAnchor="middle"
                  fontSize={8.5}
                  fill="#fef3c7"
                  fontFamily="Plus Jakarta Sans"
                >
                  {env.soilMoisturePct < codeConfig.threshold
                    ? 'Tanah Kering'
                    : 'Tanah Lembap'}
                </text>
              </g>

              {/* BREADBOARD LED INDICATOR */}
              <g transform="translate(462, 362)">
                <circle
                  cx={14}
                  cy={14}
                  r={8}
                  fill={
                    actuatorActive && isRunning
                      ? '#ef4444'
                      : isRunning && hasPower
                        ? '#22c55e'
                        : '#cbd5e1'
                  }
                />
                <text
                  x={28}
                  y={18}
                  fontSize={11}
                  fontWeight="600"
                  fill="#334155"
                  fontFamily="Plus Jakarta Sans"
                >
                  {actuatorActive && isRunning
                    ? 'LED Status: Menyala (Menyiram)'
                    : isRunning && hasPower
                      ? 'LED Status: Siaga (Lembap Cukup)'
                      : 'LED Status: Mati'}
                </text>
              </g>
            </g>
          )}

          {/* ================= ULTRASONIC HC-SR04 STAGE ================= */}
          {projectId === 'ultrasonic-radar' && (
            <g>
              {/* Buzzer / Alarm */}
              <g transform="translate(480, 96)">
                <rect x={0} y={0} width={110} height={74} rx={8} fill="#1e293b" />
                <circle
                  cx={55}
                  cy={37}
                  r={20}
                  fill={actuatorActive && isRunning ? '#dc2626' : '#334155'}
                  stroke="#94a3b8"
                  strokeWidth={2}
                />
                <circle cx={55} cy={37} r={6} fill="#0f172a" />
                <text
                  x={55}
                  y={67}
                  textAnchor="middle"
                  fontSize={8.5}
                  fill="#f8fafc"
                  fontFamily="JetBrains Mono"
                >
                  BUZZER {actuatorActive && isRunning ? 'BUNYI!' : 'DIAM'}
                </text>
              </g>

              {/* HC-SR04 Module */}
              <g transform="translate(450, 232)">
                <rect x={0} y={0} width={120} height={84} rx={6} fill="#0284c7" stroke="#0369a1" strokeWidth={1.5} />
                <circle cx={34} cy={42} r={22} fill="#cbd5e1" stroke="#475569" strokeWidth={2} />
                <circle cx={34} cy={42} r={14} fill="#334155" />
                <circle cx={86} cy={42} r={22} fill="#cbd5e1" stroke="#475569" strokeWidth={2} />
                <circle cx={86} cy={42} r={14} fill="#334155" />
                <text x={60} y={14} textAnchor="middle" fontSize={8.5} fontWeight="700" fill="#ffffff" fontFamily="JetBrains Mono">
                  HC-SR04
                </text>
              </g>

              {/* Sonar Waves */}
              {isRunning && signalConnected && (
                <g transform="translate(578, 274)">
                  <path
                    d="M 0 -18 Q 14 0, 0 18"
                    fill="none"
                    stroke="#0284c7"
                    strokeWidth={2.5}
                    className="sonar-wave"
                  />
                  <path
                    d="M 10 -24 Q 26 0, 10 24"
                    fill="none"
                    stroke="#38bdf8"
                    strokeWidth={2}
                    className="sonar-wave"
                    style={{ animationDelay: '0.35s' }}
                  />
                </g>
              )}

              {/* Distance Ruler & Movable Obstacle */}
              <line x1={575} y1={336} x2={880} y2={336} stroke="#94a3b8" strokeWidth={1.5} strokeDasharray="4 4" />
              {(() => {
                const clampedX = 610 + Math.min(220, (env.distanceCm / 300) * 220);
                return (
                  <g transform={`translate(${clampedX}, 220)`}>
                    <rect
                      x={0}
                      y={0}
                      width={44}
                      height={108}
                      rx={6}
                      fill={actuatorActive && isRunning ? '#ef4444' : '#475569'}
                      stroke="#1e293b"
                      strokeWidth={1.5}
                    />
                    <text
                      x={22}
                      y={58}
                      textAnchor="middle"
                      fontSize={10}
                      fontWeight="700"
                      fill="#ffffff"
                      fontFamily="JetBrains Mono"
                    >
                      OBJEK
                    </text>
                    <text
                      x={22}
                      y={128}
                      textAnchor="middle"
                      fontSize={11}
                      fontWeight="700"
                      fill="#0f172a"
                      fontFamily="JetBrains Mono"
                    >
                      {Math.round(env.distanceCm)} cm
                    </text>
                  </g>
                );
              })()}
            </g>
          )}

          {/* ================= DHT11 FAN STAGE ================= */}
          {projectId === 'dht11-fan' && (
            <g>
              {/* Cooling Fan */}
              <g transform="translate(650, 96)">
                <rect x={0} y={0} width={150} height={150} rx={12} fill="#1e293b" stroke="#0f172a" strokeWidth={2} />
                <circle cx={75} cy={75} r={58} fill="#334155" />
                <g
                  transform={`translate(75, 75)`}
                  style={{
                    transformOrigin: '0px 0px',
                  }}
                >
                  <g className={actuatorActive && isRunning ? 'animate-spin' : ''}>
                    <ellipse cx={0} cy={-26} rx={10} ry={24} fill="#38bdf8" />
                    <ellipse cx={0} cy={26} rx={10} ry={24} fill="#38bdf8" />
                    <ellipse cx={-26} cy={0} rx={24} ry={10} fill="#0ea5e9" />
                    <ellipse cx={26} cy={0} rx={24} ry={10} fill="#0ea5e9" />
                  </g>
                  <circle cx={0} cy={0} r={10} fill="#f8fafc" />
                </g>
                <text x={75} y={170} textAnchor="middle" fontSize={11} fontWeight="600" fill="#0f172a" fontFamily="Plus Jakarta Sans">
                  Kipas DC: {actuatorActive && isRunning ? 'Berputar' : 'Berhenti'}
                </text>
              </g>

              {/* DHT11 Sensor */}
              <g transform="translate(456, 232)">
                <rect x={0} y={0} width={96} height={102} rx={6} fill="#0ea5e9" stroke="#0369a1" strokeWidth={1.5} />
                {/* Lattice grid */}
                {Array.from({ length: 4 }).map((_, r) =>
                  Array.from({ length: 4 }).map((__, c) => (
                    <rect key={`${r}-${c}`} x={18 + c * 16} y={24 + r * 14} width={10} height={8} rx={1.5} fill="#0369a1" />
                  ))
                )}
                <text x={48} y={16} textAnchor="middle" fontSize={9.5} fontWeight="700" fill="#ffffff" fontFamily="JetBrains Mono">
                  DHT11
                </text>
                <text x={48} y={94} textAnchor="middle" fontSize={10} fontWeight="700" fill="#ffffff" fontFamily="JetBrains Mono">
                  {env.temperatureC}°C
                </text>
              </g>
            </g>
          )}

          {/* ================= LDR STREETLAMP STAGE ================= */}
          {projectId === 'ldr-streetlamp' && (
            <g>
              {/* Streetlamp LED */}
              <g transform="translate(680, 96)">
                {actuatorActive && isRunning && (
                  <circle cx={60} cy={52} r={54} fill="#fde047" fillOpacity={0.38} />
                )}
                <rect x={54} y={56} width={12} height={120} rx={3} fill="#334155" />
                <circle
                  cx={60}
                  cy={52}
                  r={24}
                  fill={actuatorActive && isRunning ? '#facc15' : '#cbd5e1'}
                  stroke="#475569"
                  strokeWidth={2}
                />
                <text x={60} y={196} textAnchor="middle" fontSize={11} fontWeight="600" fill="#0f172a" fontFamily="Plus Jakarta Sans">
                  Lampu Jalan: {actuatorActive && isRunning ? 'Menyala' : 'Padam'}
                </text>
              </g>

              {/* LDR Photoresistor Module */}
              <g transform="translate(456, 232)">
                <rect x={0} y={0} width={104} height={96} rx={8} fill="#1e293b" />
                <circle cx={52} cy={46} r={24} fill="#f8fafc" stroke="#94a3b8" strokeWidth={2} />
                <path
                  d="M 36 38 Q 52 30, 68 38 Q 52 46, 36 46 Q 52 54, 68 54"
                  fill="none"
                  stroke="#b45309"
                  strokeWidth={3}
                />
                <text x={52} y={84} textAnchor="middle" fontSize={9.5} fontWeight="600" fill="#f8fafc" fontFamily="JetBrains Mono">
                  LDR · {env.lightLux} Lux
                </text>
              </g>
            </g>
          )}

          {/* ================= PIR MOTION ALARM STAGE ================= */}
          {projectId === 'pir-alarm' && (
            <g>
              {/* Siren */}
              <g transform="translate(500, 96)">
                <rect x={0} y={0} width={120} height={74} rx={8} fill="#1e293b" />
                <circle
                  cx={60}
                  cy={32}
                  r={18}
                  fill={actuatorActive && isRunning ? '#ef4444' : '#475569'}
                />
                <text x={60} y={64} textAnchor="middle" fontSize={9} fontWeight="700" fill="#ffffff" fontFamily="JetBrains Mono">
                  ALARM: {actuatorActive && isRunning ? 'AKTIF' : 'AMAN'}
                </text>
              </g>

              {/* PIR Sensor */}
              <g transform="translate(456, 232)">
                <rect x={0} y={0} width={104} height={96} rx={8} fill="#065f46" />
                <circle cx={52} cy={48} r={28} fill="#f1f5f9" stroke="#cbd5e1" strokeWidth={2} />
                <text x={52} y={89} textAnchor="middle" fontSize={8.5} fontWeight="700" fill="#ffffff" fontFamily="JetBrains Mono">
                  PIR HC-SR501
                </text>
              </g>

              {/* Interactive Detection Cone & Visitor */}
              <polygon
                points="560,280 790,190 790,370"
                fill={env.motionDetected ? '#ef4444' : '#94a3b8'}
                fillOpacity={env.motionDetected ? 0.16 : 0.1}
              />
              <g
                transform="translate(740, 230)"
                onClick={() =>
                  onUpdateEnv({ motionDetected: !env.motionDetected })
                }
                className="cursor-pointer"
              >
                <rect
                  x={-10}
                  y={-10}
                  width={90}
                  height={110}
                  rx={10}
                  fill={env.motionDetected ? '#fee2e2' : '#f1f5f9'}
                  stroke={env.motionDetected ? '#dc2626' : '#cbd5e1'}
                  strokeWidth={1.5}
                />
                <circle
                  cx={35}
                  cy={24}
                  r={14}
                  fill={env.motionDetected ? '#dc2626' : '#64748b'}
                />
                <path
                  d="M 14 76 C 14 46, 56 46, 56 76 Z"
                  fill={env.motionDetected ? '#dc2626' : '#64748b'}
                />
                <text
                  x={35}
                  y={92}
                  textAnchor="middle"
                  fontSize={9}
                  fontWeight="700"
                  fill="#0f172a"
                  fontFamily="Plus Jakarta Sans"
                >
                  {env.motionDetected ? 'Ada Gerak!' : 'Klik: Uji Gerak'}
                </text>
              </g>
            </g>
          )}

          {/* ================= PUSH BUTTON & LED STAGE ================= */}
          {projectId === 'blink-button' && (
            <g>
              {/* External Breadboard LED */}
              <g transform="translate(500, 96)">
                <rect x={0} y={0} width={140} height={80} rx={8} fill="#f8fafc" stroke="#cbd5e1" strokeWidth={1.5} />
                {actuatorActive && isRunning && (
                  <circle cx={46} cy={38} r={28} fill="#ef4444" fillOpacity={0.25} />
                )}
                <circle
                  cx={46}
                  cy={38}
                  r={14}
                  fill={actuatorActive && isRunning ? '#ef4444' : '#94a3b8'}
                  stroke="#475569"
                  strokeWidth={1.5}
                />
                <text x={72} y={42} fontSize={10} fontWeight="700" fill="#0f172a" fontFamily="Plus Jakarta Sans">
                  LED {actuatorActive && isRunning ? 'NYALA' : 'MATI'}
                </text>
              </g>

              {/* Clickable Push Button */}
              <g
                transform="translate(456, 232)"
                onClick={() =>
                  onUpdateEnv({ buttonPressed: !env.buttonPressed })
                }
                className="cursor-pointer"
              >
                <rect
                  x={0}
                  y={0}
                  width={140}
                  height={102}
                  rx={8}
                  fill="#f8fafc"
                  stroke="#94a3b8"
                  strokeWidth={1.5}
                />
                <rect x={40} y={20} width={60} height={60} rx={6} fill="#334155" />
                <circle
                  cx={70}
                  cy={50}
                  r={18}
                  fill={env.buttonPressed ? '#0d9488' : '#0f172a'}
                  stroke="#cbd5e1"
                  strokeWidth={2}
                />
                <text
                  x={70}
                  y={94}
                  textAnchor="middle"
                  fontSize={9.5}
                  fontWeight="700"
                  fill="#0f172a"
                  fontFamily="Plus Jakarta Sans"
                >
                  {env.buttonPressed ? 'DITEKAN (HIGH)' : 'Klik: Tekan Tombol'}
                </text>
              </g>
            </g>
          )}

          {/* Pin Hover Tooltip */}
          {hoveredPin && (
            <g transform="translate(30, 16)">
              <rect x={0} y={0} width={260} height={32} rx={6} fill="#0f172a" />
              <text
                x={12}
                y={20}
                fontSize={11}
                fill="#f8fafc"
                fontFamily="JetBrains Mono"
              >
                Pin {hoveredPin}:{' '}
                {hoveredPin === '5V'
                  ? 'Catu Daya 5.0V Stabil'
                  : hoveredPin === 'GND'
                    ? 'Ground (0V Referensi)'
                    : hoveredPin.startsWith('A')
                      ? 'Input Analog (ADC 0–1023)'
                      : 'Pin Digital I/O (0V / 5V)'}
              </text>
            </g>
          )}
        </svg>
      </div>

      {/* Bottom Interactive Physical Environment & Wiring Strip */}
      <div className="p-4 bg-white border-t border-slate-200 grid grid-cols-1 lg:grid-cols-12 gap-4 items-center">
        {/* Left: Live Environment Controls */}
        <div className="lg:col-span-7 space-y-3">
          {projectId === 'plant-watering' && (
            <>
              <div className="flex flex-wrap items-center justify-between gap-2">
                <label
                  htmlFor="soil-slider"
                  className="text-xs font-semibold text-slate-800 flex items-center gap-1.5"
                >
                  <Droplets className="w-4 h-4 text-sky-600" />
                  <span>
                    Kelembapan Tanah Saat Ini:{' '}
                    <span className="font-mono text-teal-700 tabular-nums">
                      {Math.round(env.soilMoisturePct)}%
                    </span>
                  </span>
                </label>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => onUpdateEnv({ soilMoisturePct: 18 })}
                    className="px-2.5 py-1 text-xs font-medium text-amber-800 bg-amber-50 border border-amber-200 hover:bg-amber-100 rounded-md transition-colors cursor-pointer"
                  >
                    Keringkan Tanah (18%)
                  </button>
                  <button
                    type="button"
                    onClick={() =>
                      onUpdateEnv({
                        soilMoisturePct: Math.min(100, env.soilMoisturePct + 25),
                      })
                    }
                    className="px-2.5 py-1 text-xs font-medium text-sky-800 bg-sky-50 border border-sky-200 hover:bg-sky-100 rounded-md transition-colors cursor-pointer"
                  >
                    Siram Manual (+25%)
                  </button>
                  <button
                    type="button"
                    onClick={() => onUpdateEnv({ tankWaterPct: 100 })}
                    className="px-2.5 py-1 text-xs font-medium text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-md transition-colors cursor-pointer"
                  >
                    Isi Tangki
                  </button>
                </div>
              </div>
              <input
                id="soil-slider"
                type="range"
                min={0}
                max={100}
                value={Math.round(env.soilMoisturePct)}
                onChange={(e) =>
                  onUpdateEnv({ soilMoisturePct: Number(e.target.value) })
                }
                className="w-full accent-teal-700 cursor-pointer"
              />
              <div className="flex items-center justify-between text-[11px] text-slate-500">
                <span>0% (Sangat Kering)</span>
                <span className="font-mono">
                  Penguapan Alami: {env.evaporationRate.toFixed(1)}%/dtk
                </span>
                <span>100% (Jenuh Air)</span>
              </div>
            </>
          )}

          {projectId === 'ultrasonic-radar' && (
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <label
                  htmlFor="dist-slider"
                  className="text-xs font-semibold text-slate-800"
                >
                  Jarak Objek dari Sensor HC-SR04:{' '}
                  <span className="font-mono text-teal-700 tabular-nums">
                    {Math.round(env.distanceCm)} cm
                  </span>
                </label>
              </div>
              <input
                id="dist-slider"
                type="range"
                min={2}
                max={300}
                value={Math.round(env.distanceCm)}
                onChange={(e) =>
                  onUpdateEnv({ distanceCm: Number(e.target.value) })
                }
                className="w-full accent-teal-700 cursor-pointer"
              />
            </div>
          )}

          {projectId === 'dht11-fan' && (
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <label
                  htmlFor="temp-slider"
                  className="text-xs font-semibold text-slate-800"
                >
                  Suhu Ruangan:{' '}
                  <span className="font-mono text-teal-700 tabular-nums">
                    {env.temperatureC}°C
                  </span>
                </label>
              </div>
              <input
                id="temp-slider"
                type="range"
                min={10}
                max={50}
                value={env.temperatureC}
                onChange={(e) =>
                  onUpdateEnv({ temperatureC: Number(e.target.value) })
                }
                className="w-full accent-teal-700 cursor-pointer"
              />
            </div>
          )}

          {projectId === 'ldr-streetlamp' && (
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <label
                  htmlFor="lux-slider"
                  className="text-xs font-semibold text-slate-800 flex items-center gap-1.5"
                >
                  {env.lightLux < 350 ? (
                    <Moon className="w-3.5 h-3.5 text-slate-600" />
                  ) : (
                    <Sun className="w-3.5 h-3.5 text-amber-500" />
                  )}
                  <span>
                    Intensitas Cahaya Sekitar:{' '}
                    <span className="font-mono text-teal-700 tabular-nums">
                      {env.lightLux} Lux
                    </span>
                  </span>
                </label>
              </div>
              <input
                id="lux-slider"
                type="range"
                min={0}
                max={1000}
                step={10}
                value={env.lightLux}
                onChange={(e) =>
                  onUpdateEnv({ lightLux: Number(e.target.value) })
                }
                className="w-full accent-teal-700 cursor-pointer"
              />
            </div>
          )}

          {projectId === 'pir-alarm' && (
            <div className="flex items-center justify-between gap-3">
              <span className="text-xs font-semibold text-slate-800">
                Uji Deteksi Sensor Gerak Inframerah (PIR):
              </span>
              <button
                type="button"
                onClick={() =>
                  onUpdateEnv({ motionDetected: !env.motionDetected })
                }
                className={`inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-semibold rounded-lg transition-colors cursor-pointer ${
                  env.motionDetected
                    ? 'bg-red-600 text-white hover:bg-red-700'
                    : 'bg-slate-900 text-white hover:bg-slate-800'
                }`}
              >
                <UserCheck className="w-4 h-4" />
                <span>
                  {env.motionDetected
                    ? 'Hentikan Gerakan (LOW)'
                    : 'Simulasikan Gerakan (HIGH)'}
                </span>
              </button>
            </div>
          )}

          {projectId === 'blink-button' && (
            <div className="flex items-center justify-between gap-3">
              <span className="text-xs font-semibold text-slate-800">
                Kontrol Push Button (Pin D2):
              </span>
              <button
                type="button"
                onClick={() =>
                  onUpdateEnv({ buttonPressed: !env.buttonPressed })
                }
                className={`inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-semibold rounded-lg transition-colors cursor-pointer ${
                  env.buttonPressed
                    ? 'bg-teal-700 text-white hover:bg-teal-800'
                    : 'bg-slate-900 text-white hover:bg-slate-800'
                }`}
              >
                <Hand className="w-4 h-4" />
                <span>
                  {env.buttonPressed
                    ? 'Lepas Tombol (LOW)'
                    : 'Tekan Tombol (HIGH)'}
                </span>
              </button>
            </div>
          )}
        </div>

        {/* Right: Clickable Jumper Wire Toggle Panel */}
        <div className="lg:col-span-5 lg:border-l lg:border-slate-200 lg:pl-4">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-semibold text-slate-700 flex items-center gap-1.5">
              <Cable className="w-3.5 h-3.5 text-slate-500" />
              <span>Koneksi Kabel Jumper (Klik untuk Cabut/Pasang)</span>
            </span>
          </div>
          <div className="grid grid-cols-2 gap-1.5">
            {wires.map((wire) => (
              <button
                key={wire.id}
                type="button"
                onClick={() => {
                  onToggleWire(wire.id);
                  onSelectPhaseHighlight?.('setup');
                }}
                className={`flex items-center justify-between px-2.5 py-1.5 text-[11px] font-mono rounded-md border transition-colors cursor-pointer ${
                  wire.connected
                    ? 'bg-slate-50 border-slate-200 text-slate-800 hover:bg-slate-100'
                    : 'bg-red-50 border-red-200 text-red-700 hover:bg-red-100'
                }`}
              >
                <span className="truncate">{wire.fromLabel}</span>
                <span className="font-semibold ml-1 shrink-0">
                  {wire.connected ? 'ON' : 'PUTUS'}
                </span>
              </button>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};
