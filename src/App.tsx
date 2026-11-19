import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ARDUINO_PROJECTS,
  DEFAULT_ENV,
  computeSensorMetrics,
  evaluateCondition,
  isCircuitPowered,
} from './data/projects';
import {
  CodeBlockConfig,
  EnvironmentState,
  ExecutionPhase,
  PinReading,
  ProjectId,
  SerialLogEntry,
  SimulationSnapshot,
  WireConnection,
  WorkspaceTab,
} from './types/arduino';
import { Header } from './components/Header';
import { CircuitStage } from './components/CircuitStage';
import { VisualCodePanel } from './components/VisualCodePanel';
import { SerialAndTelemetryPanel } from './components/SerialAndTelemetryPanel';
import { GuidedTutorialPanel } from './components/GuidedTutorialPanel';
import { SensorCatalogView } from './components/SensorCatalogView';
import { ElectronicsBasicsView } from './components/ElectronicsBasicsView';

const STEP_SEQUENCE: ExecutionPhase[] = [
  'setup',
  'read',
  'serial',
  'condition',
  'branch-true',
  'delay',
];

function formatNowTime(): string {
  const d = new Date();
  return d.toLocaleTimeString('id-ID', {
    hour12: false,
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  });
}

export default function App() {
  const [activeTab, setActiveTab] = useState<WorkspaceTab>('lab');
  const [projectId, setProjectId] = useState<ProjectId>('plant-watering');
  const [showTutorial, setShowTutorial] = useState<boolean>(true);
  const [currentStepIndex, setCurrentStepIndex] = useState<number>(0);

  const initialProject = ARDUINO_PROJECTS['plant-watering'];
  const [codeConfig, setCodeConfig] = useState<CodeBlockConfig>(
    initialProject.defaultConfig
  );
  const [env, setEnv] = useState<EnvironmentState>({
    ...DEFAULT_ENV,
    ...initialProject.defaultEnv,
  });
  const [wires, setWires] = useState<WireConnection[]>(
    initialProject.defaultWires
  );

  const [isRunning, setIsRunning] = useState<boolean>(false);
  const [simSpeed, setSimSpeed] = useState<1 | 2>(1);
  const [executionPhase, setExecutionPhase] = useState<ExecutionPhase>('idle');
  const [logs, setLogs] = useState<SerialLogEntry[]>([]);

  const [hasObservedTrueBranch, setHasObservedTrueBranch] = useState(false);
  const [hasObservedFalseBranch, setHasObservedFalseBranch] = useState(false);

  const logCounterRef = useRef(1);
  const stepCursorRef = useRef(0);
  const tutorialPanelRef = useRef<HTMLDivElement | null>(null);

  // Switch project and load its clean defaults
  const handleSelectProject = useCallback((nextId: ProjectId) => {
    const meta = ARDUINO_PROJECTS[nextId];
    setProjectId(nextId);
    setCodeConfig({ ...meta.defaultConfig });
    setEnv({ ...DEFAULT_ENV, ...meta.defaultEnv });
    setWires(meta.defaultWires.map((w) => ({ ...w })));
    setIsRunning(false);
    setExecutionPhase('idle');
    setLogs([]);
    setCurrentStepIndex(0);
    setHasObservedTrueBranch(false);
    setHasObservedFalseBranch(false);
    stepCursorRef.current = 0;
  }, []);

  const handleSelectTab = useCallback(
    (tab: WorkspaceTab) => {
      setActiveTab(tab);
      if (tab === 'plant-project' && projectId !== 'plant-watering') {
        handleSelectProject('plant-watering');
      }
    },
    [projectId, handleSelectProject]
  );

  const handleStartGuidedPractice = useCallback(() => {
    if (activeTab === 'sensors' || activeTab === 'basics') {
      setActiveTab('lab');
    }
    setShowTutorial(true);
    setTimeout(() => {
      tutorialPanelRef.current?.scrollIntoView({
        behavior: 'smooth',
        block: 'nearest',
      });
    }, 60);
  }, [activeTab]);

  // Compute live electrical metrics
  const metrics = useMemo(
    () => computeSensorMetrics(projectId, env, wires),
    [projectId, env, wires]
  );

  const powerState = useMemo(() => isCircuitPowered(wires), [wires]);

  const conditionMet = useMemo(() => {
    if (!metrics.signalConnected) return false;
    if (projectId === 'pir-alarm' || projectId === 'blink-button') {
      return codeConfig.threshold >= 1
        ? metrics.displayValue === 1
        : metrics.displayValue === 0;
    }
    return evaluateCondition(
      metrics.displayValue,
      codeConfig.comparator,
      codeConfig.threshold
    );
  }, [
    metrics.signalConnected,
    metrics.displayValue,
    projectId,
    codeConfig.comparator,
    codeConfig.threshold,
  ]);

  const actuatorActive =
    powerState.hasPower &&
    powerState.hasGround &&
    powerState.hasActuatorSignal &&
    metrics.signalConnected &&
    conditionMet;

  // Record observation flags whenever running or stepping
  useEffect(() => {
    if (!isRunning && executionPhase === 'idle') return;
    if (!powerState.hasPower || !powerState.hasGround || !metrics.signalConnected) {
      return;
    }
    if (conditionMet) {
      setHasObservedTrueBranch(true);
    } else {
      setHasObservedFalseBranch(true);
    }
  }, [
    isRunning,
    executionPhase,
    conditionMet,
    powerState.hasPower,
    powerState.hasGround,
    metrics.signalConnected,
  ]);

  // Append serial log helper
  const pushSerialLog = useCallback(
    (sensorVal: number, active: boolean) => {
      if (!codeConfig.serialEnabled) return;
      const meta = ARDUINO_PROJECTS[projectId];
      const msg =
        projectId === 'plant-watering'
          ? `Kelembapan Tanah: ${sensorVal}%`
          : projectId === 'ultrasonic-radar'
            ? `Jarak Objek: ${sensorVal} cm`
            : projectId === 'dht11-fan'
              ? `Suhu Udara: ${sensorVal}°C`
              : projectId === 'ldr-streetlamp'
                ? `Intensitas Cahaya: ${sensorVal} Lux`
                : projectId === 'pir-alarm'
                  ? `Deteksi Gerak: ${sensorVal === 1 ? 'HIGH (1)' : 'LOW (0)'}`
                  : `Status Tombol: ${sensorVal === 1 ? 'DITEKAN (1)' : 'LEPAS (0)'}`;

      const entry: SerialLogEntry = {
        id: logCounterRef.current++,
        timestamp: formatNowTime(),
        message: `${msg} · ${meta.actuatorName} ${active ? 'ON' : 'OFF'}`,
        sensorValue: sensorVal,
        actuatorActive: active,
      };
      setLogs((prev) => [...prev.slice(-49), entry]);
    },
    [codeConfig.serialEnabled, projectId]
  );

  // Continuous Simulation Loop
  useEffect(() => {
    if (!isRunning) return;

    const tickMs = Math.max(
      240,
      Math.round((codeConfig.delayMs / 2) / simSpeed)
    );

    const timer = setInterval(() => {
      const phases: ExecutionPhase[] = [
        'read',
        'serial',
        'condition',
        conditionMet ? 'branch-true' : 'branch-false',
        'delay',
      ];
      stepCursorRef.current = (stepCursorRef.current + 1) % phases.length;
      const nextPhase = phases[stepCursorRef.current];
      setExecutionPhase(nextPhase);

      if (nextPhase === 'serial') {
        pushSerialLog(metrics.displayValue, actuatorActive);
      }

      // Closed-loop physical dynamics for Plant Watering
      if (projectId === 'plant-watering' && nextPhase === 'delay') {
        setEnv((prev) => {
          let nextMoisture = prev.soilMoisturePct;
          let nextTank = prev.tankWaterPct;

          // Natural gentle evaporation
          nextMoisture = Math.max(
            0,
            nextMoisture - prev.evaporationRate * 0.45
          );

          // Active pumping adds water if tank has water
          if (actuatorActive && prev.tankWaterPct > 0) {
            nextMoisture = Math.min(100, nextMoisture + 4.8);
            nextTank = Math.max(0, nextTank - 0.8);
          }

          return {
            ...prev,
            soilMoisturePct: Number(nextMoisture.toFixed(1)),
            tankWaterPct: Number(nextTank.toFixed(1)),
          };
        });
      }
    }, tickMs);

    return () => clearInterval(timer);
  }, [
    isRunning,
    simSpeed,
    codeConfig.delayMs,
    conditionMet,
    actuatorActive,
    metrics.displayValue,
    projectId,
    pushSerialLog,
  ]);

  // Manual Step-by-Step Execution
  const handleStepExecution = useCallback(() => {
    setIsRunning(false);
    const idx = stepCursorRef.current % STEP_SEQUENCE.length;
    let phase = STEP_SEQUENCE[idx];
    if (phase === 'branch-true' && !conditionMet) {
      phase = 'branch-false';
    }
    setExecutionPhase(phase);

    if (phase === 'serial') {
      pushSerialLog(metrics.displayValue, actuatorActive);
    }

    if (phase === 'delay' && projectId === 'plant-watering') {
      setEnv((prev) => {
        let nextMoisture = prev.soilMoisturePct;
        let nextTank = prev.tankWaterPct;
        if (actuatorActive && prev.tankWaterPct > 0) {
          nextMoisture = Math.min(100, nextMoisture + 6);
          nextTank = Math.max(0, nextTank - 1);
        }
        return {
          ...prev,
          soilMoisturePct: nextMoisture,
          tankWaterPct: nextTank,
        };
      });
    }

    stepCursorRef.current = (idx + 1) % STEP_SEQUENCE.length;
  }, [conditionMet, pushSerialLog, metrics.displayValue, actuatorActive, projectId]);

  const handleResetSimulation = useCallback(() => {
    handleSelectProject(projectId);
  }, [handleSelectProject, projectId]);

  const handleToggleWire = useCallback((wireId: string) => {
    setWires((prev) =>
      prev.map((w) =>
        w.id === wireId ? { ...w, connected: !w.connected } : w
      )
    );
  }, []);

  const handleUpdateEnv = useCallback((patch: Partial<EnvironmentState>) => {
    setEnv((prev) => ({ ...prev, ...patch }));
  }, []);

  const handleUpdateConfig = useCallback((patch: Partial<CodeBlockConfig>) => {
    setCodeConfig((prev) => ({ ...prev, ...patch }));
  }, []);

  const handleApplyStepSolution = useCallback(
    (patch: Partial<SimulationSnapshot>) => {
      if (patch.wires) setWires(patch.wires);
      if (patch.codeConfig) setCodeConfig(patch.codeConfig);
      if (patch.env) setEnv(patch.env);
      if (typeof patch.isRunning === 'boolean') setIsRunning(patch.isRunning);
    },
    []
  );

  // Pin voltage table readings
  const pinReadings: PinReading[] = useMemo(() => {
    const has5v = wires.some((w) => w.signalType === 'power' && w.connected);
    const hasGnd = wires.some((w) => w.signalType === 'ground' && w.connected);
    return [
      {
        pin: '5V',
        mode: 'POWER',
        voltage: has5v ? 5.0 : 0.0,
        rawValue: has5v ? 1 : 0,
        description: 'Catu daya utama sensor & modul',
      },
      {
        pin: 'GND',
        mode: 'POWER',
        voltage: 0.0,
        rawValue: hasGnd ? 0 : -1,
        description: hasGnd ? 'Terhubung ke Ground 0V' : 'Kabel GND terputus!',
      },
      {
        pin: codeConfig.sensorPin,
        mode:
          projectId === 'plant-watering' || projectId === 'ldr-streetlamp'
            ? 'ANALOG IN'
            : 'INPUT',
        voltage: metrics.voltage,
        rawValue: metrics.rawAdc,
        description: `Masukan ${ARDUINO_PROJECTS[projectId].sensorName}`,
      },
      {
        pin: `D${codeConfig.actuatorPin}`,
        mode: projectId === 'ldr-streetlamp' ? 'PWM OUT' : 'OUTPUT',
        voltage: actuatorActive && isRunning ? 5.0 : 0.0,
        rawValue:
          actuatorActive && isRunning
            ? projectId === 'ldr-streetlamp'
              ? 255
              : 1
            : 0,
        description: `Kendali ${ARDUINO_PROJECTS[projectId].actuatorName}`,
      },
    ];
  }, [wires, codeConfig, projectId, metrics, actuatorActive, isRunning]);

  const snapshot: SimulationSnapshot = {
    projectId,
    codeConfig,
    env,
    wires,
    isRunning,
    actuatorActive,
    sensorRawValue: metrics.rawAdc,
    sensorDisplayValue: metrics.displayValue,
    hasTestedAction: actuatorActive,
    hasObservedTrueBranch,
    hasObservedFalseBranch,
  };

  const isWorkbenchView =
    activeTab === 'lab' || activeTab === 'plant-project';

  return (
    <div className="min-h-screen flex flex-col bg-slate-50 text-slate-900">
      <Header
        activeTab={activeTab}
        onSelectTab={handleSelectTab}
        onStartGuidedPractice={handleStartGuidedPractice}
      />

      <main className="flex-1">
        {isWorkbenchView && (
          <div className="max-w-[1440px] mx-auto px-4 sm:px-6 py-6 space-y-5">
            {/* Compact Hero / Context & Project Selector Row */}
            <div className="flex flex-col lg:flex-row lg:items-end justify-between gap-4 border-b border-slate-200 pb-4">
              <div className="space-y-1 max-w-2xl">
                <h1 className="font-display text-2xl sm:text-3xl font-bold text-slate-900 text-balance">
                  {activeTab === 'plant-project'
                    ? 'Proyek Utama: Sistem Siram Tanaman Otomatis'
                    : 'Laboratorium Sirkuit & Pemrograman Arduino'}
                </h1>
                <p className="text-sm text-slate-600">
                  {activeTab === 'plant-project'
                    ? 'Amati bagaimana sensor kelembapan tanah membaca kadar air pot, mengirim tegangan analog ke Arduino, dan memicu relay pompa air secara otomatis.'
                    : 'Pilih proyek sensor, ubah kondisi lingkungan atau kabel jumper secara langsung, dan lihat blok logika serta kode C++ berjalan serempak.'}
                </p>
              </div>

              {/* Project Presets Selector */}
              {activeTab === 'lab' && (
                <div
                  role="tablist"
                  aria-label="Pilih Proyek Sensor Arduino"
                  className="flex items-center gap-1 p-1 bg-slate-200/70 rounded-lg overflow-x-auto max-w-full"
                >
                  {(Object.keys(ARDUINO_PROJECTS) as ProjectId[]).map((id) => {
                    const meta = ARDUINO_PROJECTS[id];
                    const selected = projectId === id;
                    return (
                      <button
                        key={id}
                        role="tab"
                        aria-selected={selected}
                        type="button"
                        onClick={() => handleSelectProject(id)}
                        className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                          selected
                            ? 'bg-white text-slate-900 shadow-xs'
                            : 'text-slate-600 hover:text-slate-900'
                        }`}
                      >
                        {meta.shortTitle}
                      </button>
                    );
                  })}
                </div>
              )}
            </div>

            {/* Two-Zone Educational Sandbox Grid */}
            <div className="grid grid-cols-1 xl:grid-cols-12 gap-6 items-start">
              {/* LEFT / TOP STAGE (7/12): Circuit Canvas + Serial Plotter */}
              <div className="xl:col-span-7 space-y-6">
                <CircuitStage
                  projectId={projectId}
                  codeConfig={codeConfig}
                  env={env}
                  wires={wires}
                  isRunning={isRunning}
                  executionPhase={executionPhase}
                  actuatorActive={actuatorActive}
                  sensorDisplayValue={metrics.displayValue}
                  sensorRawValue={metrics.rawAdc}
                  sensorVoltage={metrics.voltage}
                  signalConnected={metrics.signalConnected}
                  simSpeed={simSpeed}
                  onToggleRun={() => setIsRunning((r) => !r)}
                  onStepExecution={handleStepExecution}
                  onResetSimulation={handleResetSimulation}
                  onToggleSpeed={() =>
                    setSimSpeed((s) => (s === 1 ? 2 : 1))
                  }
                  onToggleWire={handleToggleWire}
                  onUpdateEnv={handleUpdateEnv}
                  onSelectPhaseHighlight={setExecutionPhase}
                />

                <SerialAndTelemetryPanel
                  projectId={projectId}
                  config={codeConfig}
                  logs={logs}
                  pinReadings={pinReadings}
                  onClearLogs={() => setLogs([])}
                />
              </div>

              {/* RIGHT / CONCEPT DECK (5/12): Guided Practice + Visual Code Integration */}
              <div className="xl:col-span-5 space-y-6">
                {showTutorial && (
                  <div ref={tutorialPanelRef}>
                    <GuidedTutorialPanel
                      projectId={projectId}
                      snapshot={snapshot}
                      currentStepIndex={currentStepIndex}
                      onSelectStep={setCurrentStepIndex}
                      onApplyStepSolution={handleApplyStepSolution}
                      onSwitchProject={handleSelectProject}
                    />
                  </div>
                )}

                <VisualCodePanel
                  projectId={projectId}
                  config={codeConfig}
                  executionPhase={executionPhase}
                  isRunning={isRunning}
                  sensorDisplayValue={metrics.displayValue}
                  sensorRawValue={metrics.rawAdc}
                  signalConnected={metrics.signalConnected}
                  onUpdateConfig={handleUpdateConfig}
                  onFocusPhase={setExecutionPhase}
                />
              </div>
            </div>
          </div>
        )}

        {activeTab === 'sensors' && (
          <SensorCatalogView
            onOpenProjectInLab={(id) => {
              handleSelectProject(id);
              setActiveTab('lab');
            }}
          />
        )}

        {activeTab === 'basics' && <ElectronicsBasicsView />}
      </main>

      <footer className="border-t border-slate-200 bg-white mt-12">
        <div className="max-w-[1440px] mx-auto px-4 sm:px-6 py-4 flex flex-col sm:flex-row items-center justify-between gap-2 text-xs text-slate-500">
          <span>
            ArduLab · Media Pembelajaran Arduino & Elektronika Dasar Interaktif
          </span>
          <span>
            Simulasi Sirkuit · Sensor Populer · Integrasi Blok & Kode C++ Langsung
          </span>
        </div>
      </footer>
    </div>
  );
}
