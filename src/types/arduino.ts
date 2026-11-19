export type ProjectId =
  | 'plant-watering'
  | 'ultrasonic-radar'
  | 'dht11-fan'
  | 'ldr-streetlamp'
  | 'pir-alarm'
  | 'blink-button';

export type WorkspaceTab = 'lab' | 'plant-project' | 'sensors' | 'basics';

export type ComparatorOp = '<' | '>' | '<=' | '>=';

export type ExecutionPhase =
  | 'idle'
  | 'setup'
  | 'read'
  | 'condition'
  | 'branch-true'
  | 'branch-false'
  | 'serial'
  | 'delay';

export interface CodeBlockConfig {
  sensorPin: string;
  actuatorPin: number;
  secondaryLedPin: number;
  comparator: ComparatorOp;
  threshold: number;
  delayMs: number;
  serialEnabled: boolean;
  pumpInvertRelay: boolean; // false = HIGH turns on actuator
  pwmValue: number;
}

export interface EnvironmentState {
  // Soil moisture project
  soilMoisturePct: number; // 0 (kering) to 100 (basah)
  evaporationRate: number; // 0 to 5
  tankWaterPct: number; // 0 to 100
  // Ultrasonic
  distanceCm: number; // 2 to 400
  // DHT11
  temperatureC: number; // 0 to 50
  humidityPct: number; // 10 to 95
  // LDR
  lightLux: number; // 0 to 1000
  // PIR
  motionDetected: boolean;
  // Button
  buttonPressed: boolean;
}

export interface WireConnection {
  id: string;
  fromLabel: string;
  fromPin: string;
  toPin: string;
  color: string;
  signalType: 'power' | 'ground' | 'analog' | 'digital';
  connected: boolean;
}

export interface SerialLogEntry {
  id: number;
  timestamp: string;
  message: string;
  sensorValue: number;
  actuatorActive: boolean;
}

export interface PinReading {
  pin: string;
  mode: 'INPUT' | 'OUTPUT' | 'ANALOG IN' | 'PWM OUT' | 'POWER';
  voltage: number;
  rawValue: number;
  description: string;
}

export interface SimulationSnapshot {
  projectId: ProjectId;
  codeConfig: CodeBlockConfig;
  env: EnvironmentState;
  wires: WireConnection[];
  isRunning: boolean;
  actuatorActive: boolean;
  sensorRawValue: number;
  sensorDisplayValue: number;
  hasTestedAction: boolean;
  hasObservedTrueBranch: boolean;
  hasObservedFalseBranch: boolean;
}

export interface TutorialStep {
  id: string;
  stepNumber: number;
  title: string;
  concept: string;
  instruction: string;
  hint: string;
  focusBlock?: ExecutionPhase;
  verify: (snapshot: SimulationSnapshot) => boolean;
  applySolution: (snapshot: SimulationSnapshot) => Partial<SimulationSnapshot>;
}

export interface ArduinoProjectMeta {
  id: ProjectId;
  title: string;
  shortTitle: string;
  subtitle: string;
  difficulty: 'Pemula' | 'Menengah';
  durationLabel: string;
  sensorName: string;
  actuatorName: string;
  unitLabel: string;
  minVal: number;
  maxVal: number;
  defaultConfig: CodeBlockConfig;
  defaultEnv: Partial<EnvironmentState>;
  defaultWires: WireConnection[];
  steps: TutorialStep[];
}
