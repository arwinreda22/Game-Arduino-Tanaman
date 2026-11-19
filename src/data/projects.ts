import {
  ArduinoProjectMeta,
  CodeBlockConfig,
  ComparatorOp,
  EnvironmentState,
  ExecutionPhase,
  ProjectId,
  WireConnection,
} from '../types/arduino';

export interface CodeLine {
  lineNumber: number;
  text: string;
  phase?: ExecutionPhase;
  explanation: string;
}

export const DEFAULT_ENV: EnvironmentState = {
  soilMoisturePct: 24,
  evaporationRate: 1.5,
  tankWaterPct: 82,
  distanceCm: 48,
  temperatureC: 31,
  humidityPct: 62,
  lightLux: 280,
  motionDetected: false,
  buttonPressed: false,
};

export function evaluateCondition(
  value: number,
  op: ComparatorOp,
  threshold: number
): boolean {
  switch (op) {
    case '<':
      return value < threshold;
    case '>':
      return value > threshold;
    case '<=':
      return value <= threshold;
    case '>=':
      return value >= threshold;
  }
}

export function isCircuitPowered(wires: WireConnection[]): {
  hasPower: boolean;
  hasGround: boolean;
  hasSensorSignal: boolean;
  hasActuatorSignal: boolean;
} {
  const hasPower = wires.some((w) => w.signalType === 'power' && w.connected);
  const hasGround = wires.some((w) => w.signalType === 'ground' && w.connected);
  const hasSensorSignal = wires.some(
    (w) => (w.signalType === 'analog' || w.id.includes('sig') || w.id.includes('trig') || w.id.includes('echo')) && w.connected
  );
  const hasActuatorSignal = wires.some(
    (w) => (w.id.includes('pump') || w.id.includes('led') || w.id.includes('fan') || w.id.includes('relay') || w.id.includes('buzzer')) && w.connected
  );
  return { hasPower, hasGround, hasSensorSignal, hasActuatorSignal };
}

export function computeSensorMetrics(
  projectId: ProjectId,
  env: EnvironmentState,
  wires: WireConnection[]
): {
  rawAdc: number;
  displayValue: number;
  voltage: number;
  unit: string;
  signalConnected: boolean;
} {
  const power = isCircuitPowered(wires);
  const signalWire = wires.find(
    (w) =>
      w.connected &&
      (w.signalType === 'analog' ||
        w.id.includes('sensor') ||
        w.id.includes('echo') ||
        w.id.includes('data') ||
        w.id.includes('pir') ||
        w.id.includes('btn'))
  );

  if (!power.hasPower || !power.hasGround || !signalWire) {
    return {
      rawAdc: 0,
      displayValue: 0,
      voltage: 0,
      unit: getProjectUnit(projectId),
      signalConnected: false,
    };
  }

  switch (projectId) {
    case 'plant-watering': {
      // Capacitive / resistive soil moisture mapped cleanly to % (0-100%) and ADC (1023 dry -> 220 wet, or mapped %)
      // To make it super intuitive for beginners, we map ADC linearly: 0% dry -> ~150? Wait: standard capacitive sensor gives higher voltage when dry (~3.8V / 780) and lower when wet (~1.4V / 280), OR mapped 0-100% kelembapan.
      // Let's provide BOTH real ADC (0-1023) AND mapped percentage (0-100%) in code via map()!
      // Let's represent displayValue as Kelembapan (%) 0..100 so beginners intuitively compare `kelembapan < 40`, while rawAdc follows capacitive sensor physics (dry = ~860, wet = ~260)!
      const rawAdc = Math.round(860 - (env.soilMoisturePct / 100) * 600);
      const voltage = Number(((rawAdc / 1023) * 5).toFixed(2));
      return {
        rawAdc,
        displayValue: Math.round(env.soilMoisturePct),
        voltage,
        unit: '%',
        signalConnected: true,
      };
    }
    case 'ultrasonic-radar': {
      const dist = Math.round(env.distanceCm);
      const voltage = Number((Math.min(5, (dist / 400) * 5)).toFixed(2));
      return {
        rawAdc: dist * 58, // pulseIn microseconds
        displayValue: dist,
        voltage,
        unit: 'cm',
        signalConnected: true,
      };
    }
    case 'dht11-fan': {
      const temp = Math.round(env.temperatureC);
      const voltage = Number((2.5 + (temp / 50) * 2.0).toFixed(2));
      return {
        rawAdc: temp,
        displayValue: temp,
        voltage,
        unit: '°C',
        signalConnected: true,
      };
    }
    case 'ldr-streetlamp': {
      const lux = Math.round(env.lightLux);
      const rawAdc = Math.round((lux / 1000) * 1023);
      const voltage = Number(((rawAdc / 1023) * 5).toFixed(2));
      return {
        rawAdc,
        displayValue: lux,
        voltage,
        unit: 'Lux',
        signalConnected: true,
      };
    }
    case 'pir-alarm': {
      const val = env.motionDetected ? 1 : 0;
      return {
        rawAdc: val,
        displayValue: val,
        voltage: val ? 3.3 : 0,
        unit: val ? 'HIGH' : 'LOW',
        signalConnected: true,
      };
    }
    case 'blink-button': {
      const val = env.buttonPressed ? 1 : 0;
      return {
        rawAdc: val,
        displayValue: val,
        voltage: val ? 5.0 : 0,
        unit: val ? 'DITEKAN' : 'LEPAS',
        signalConnected: true,
      };
    }
  }
}

export function getProjectUnit(projectId: ProjectId): string {
  switch (projectId) {
    case 'plant-watering':
      return '%';
    case 'ultrasonic-radar':
      return 'cm';
    case 'dht11-fan':
      return '°C';
    case 'ldr-streetlamp':
      return 'Lux';
    case 'pir-alarm':
      return 'Logic';
    case 'blink-button':
      return 'Logic';
  }
}

export function generateArduinoCode(
  projectId: ProjectId,
  config: CodeBlockConfig
): CodeLine[] {
  const {
    sensorPin,
    actuatorPin,
    secondaryLedPin,
    comparator,
    threshold,
    delayMs,
    serialEnabled,
  } = config;

  if (projectId === 'plant-watering') {
    const lines: Omit<CodeLine, 'lineNumber'>[] = [
      {
        text: `const int PIN_SENSOR = ${sensorPin};`,
        phase: 'setup',
        explanation:
          'Menetapkan pin Analog untuk membaca sinyal tegangan dari sensor kelembapan tanah.',
      },
      {
        text: `const int PIN_POMPA = ${actuatorPin};`,
        phase: 'setup',
        explanation:
          'Pin Digital untuk mengendalikan modul Relay yang menyalakan pompa air 5V.',
      },
      {
        text: `const int PIN_LED_STATUS = ${secondaryLedPin};`,
        phase: 'setup',
        explanation:
          'Pin LED indikator untuk menampilkan status tanah kering atau lembap.',
      },
      {
        text: `const int AMBANG_KELEMBAPAN = ${threshold}; // (%)`,
        phase: 'condition',
        explanation:
          'Batas persentase kelembapan tanah yang memicu penyiraman otomatis.',
      },
      {
        text: ``,
        explanation: 'Baris kosong pemisah deklarasi variabel dan fungsi setup.',
      },
      {
        text: `void setup() {`,
        phase: 'setup',
        explanation:
          'Fungsi setup() berjalan satu kali saat Arduino dinyalakan.',
      },
      {
        text: `  pinMode(PIN_POMPA, OUTPUT);`,
        phase: 'setup',
        explanation:
          'Mengatur pin pompa sebagai OUTPUT agar bisa mengirim sinyal 5V ke relay.',
      },
      {
        text: `  pinMode(PIN_LED_STATUS, OUTPUT);`,
        phase: 'setup',
        explanation: 'Mengatur pin LED status sebagai OUTPUT.',
      },
      ...(serialEnabled
        ? [
            {
              text: `  Serial.begin(9600);`,
              phase: 'setup' as ExecutionPhase,
              explanation:
                'Memulai komunikasi Serial Monitor dengan kecepatan 9600 baud.',
            },
          ]
        : []),
      {
        text: `}`,
        phase: 'setup',
        explanation: 'Akhir dari blok setup().',
      },
      {
        text: ``,
        explanation: 'Pemisah menuju fungsi utama loop().',
      },
      {
        text: `void loop() {`,
        phase: 'read',
        explanation:
          'Fungsi loop() berjalan berulang-ulang terus menerus selama Arduino menyala.',
      },
      {
        text: `  int nilaiADC = analogRead(PIN_SENSOR);`,
        phase: 'read',
        explanation:
          'Membaca tegangan 0–5V dari sensor dan mengubahnya menjadi angka 0–1023.',
      },
      {
        text: `  int kelembapan = map(nilaiADC, 860, 260, 0, 100);`,
        phase: 'read',
        explanation:
          'Mengonversi angka mentah ADC menjadi persentase kelembapan 0% hingga 100%.',
      },
      {
        text: `  kelembapan = constrain(kelembapan, 0, 100);`,
        phase: 'read',
        explanation:
          'Membatasi nilai agar tetap berada di rentang 0% sampai 100%.',
      },
      ...(serialEnabled
        ? [
            {
              text: `  Serial.print("Kelembapan: "); Serial.println(kelembapan);`,
              phase: 'serial' as ExecutionPhase,
              explanation:
                'Mengirim data persentase kelembapan ke Serial Monitor dan Plotter.',
            },
          ]
        : []),
      {
        text: `  if (kelembapan ${comparator} AMBANG_KELEMBAPAN) {`,
        phase: 'condition',
        explanation: `Memeriksa apakah kelembapan tanah memenuhi kondisi (${comparator} ${threshold}%).`,
      },
      {
        text: `    digitalWrite(PIN_POMPA, HIGH);`,
        phase: 'branch-true',
        explanation:
          'Mengirim tegangan 5V (HIGH) ke Relay untuk menyalakan pompa air.',
      },
      {
        text: `    digitalWrite(PIN_LED_STATUS, HIGH);`,
        phase: 'branch-true',
        explanation: 'Menyalakan LED indikator merah bahwa pompa sedang aktif.',
      },
      {
        text: `  } else {`,
        phase: 'branch-false',
        explanation:
          'Cabang alternatif jika tanah sudah cukup lembap (kondisi tidak terpenuhi).',
      },
      {
        text: `    digitalWrite(PIN_POMPA, LOW);`,
        phase: 'branch-false',
        explanation:
          'Memutus sinyal (0V / LOW) ke Relay sehingga pompa air berhenti.',
      },
      {
        text: `    digitalWrite(PIN_LED_STATUS, LOW);`,
        phase: 'branch-false',
        explanation: 'Mematikan LED peringatan saat kelembapan sudah ideal.',
      },
      {
        text: `  }`,
        phase: 'branch-false',
        explanation: 'Akhir dari blok kondisi if-else.',
      },
      {
        text: `  delay(${delayMs});`,
        phase: 'delay',
        explanation: `Menjeda program selama ${delayMs} milidetik sebelum pembacaan berikutnya.`,
      },
      {
        text: `}`,
        phase: 'delay',
        explanation: 'Akhir dari satu siklus loop(), akan mengulang ke baris awal loop().',
      },
    ];
    return lines.map((l, idx) => ({ ...l, lineNumber: idx + 1 }));
  }

  if (projectId === 'ultrasonic-radar') {
    const lines: Omit<CodeLine, 'lineNumber'>[] = [
      {
        text: `const int PIN_TRIG = 9;`,
        phase: 'setup',
        explanation: 'Pin digital untuk memancarkan gelombang ultrasonik 40kHz.',
      },
      {
        text: `const int PIN_ECHO = 10;`,
        phase: 'setup',
        explanation: 'Pin digital yang menerima pantulan gelombang suara.',
      },
      {
        text: `const int PIN_ALARM = ${actuatorPin};`,
        phase: 'setup',
        explanation: 'Pin output untuk LED & Buzzer peringatan jarak dekat.',
      },
      {
        text: `const int BATAS_JARAK_CM = ${threshold};`,
        phase: 'condition',
        explanation: 'Jarak ambang batas objek dalam satuan sentimeter (cm).',
      },
      {
        text: `void setup() {`,
        phase: 'setup',
        explanation: 'Inisialisasi arah pin INPUT/OUTPUT saat mulai.',
      },
      {
        text: `  pinMode(PIN_TRIG, OUTPUT);`,
        phase: 'setup',
        explanation: 'TRIG bertindak sebagai pemancar sinyal (OUTPUT).',
      },
      {
        text: `  pinMode(PIN_ECHO, INPUT);`,
        phase: 'setup',
        explanation: 'ECHO membaca durasi pantulan suara (INPUT).',
      },
      {
        text: `  pinMode(PIN_ALARM, OUTPUT);`,
        phase: 'setup',
        explanation: 'Pin alarm diatur sebagai OUTPUT.',
      },
      ...(serialEnabled
        ? [
            {
              text: `  Serial.begin(9600);`,
              phase: 'setup' as ExecutionPhase,
              explanation: 'Membuka koneksi Serial Monitor 9600 bps.',
            },
          ]
        : []),
      {
        text: `}`,
        phase: 'setup',
        explanation: 'Akhir fungsi setup().',
      },
      {
        text: `void loop() {`,
        phase: 'read',
        explanation: 'Siklus pengukuran jarak berkelanjutan.',
      },
      {
        text: `  digitalWrite(PIN_TRIG, HIGH); delayMicroseconds(10);`,
        phase: 'read',
        explanation: 'Memicu gelombang ultrasonik selama 10 mikrodetik.',
      },
      {
        text: `  long durasi = pulseIn(PIN_ECHO, HIGH);`,
        phase: 'read',
        explanation: 'Mengukur waktu tempuh bolak-balik gelombang suara.',
      },
      {
        text: `  int jarakCm = durasi * 0.034 / 2;`,
        phase: 'read',
        explanation:
          'Menghitung jarak: waktu × kecepatan suara (0.034 cm/µs) dibagi 2.',
      },
      ...(serialEnabled
        ? [
            {
              text: `  Serial.print("Jarak (cm): "); Serial.println(jarakCm);`,
              phase: 'serial' as ExecutionPhase,
              explanation: 'Menampilkan hasil pengukuran jarak ke Serial Monitor.',
            },
          ]
        : []),
      {
        text: `  if (jarakCm ${comparator} BATAS_JARAK_CM) {`,
        phase: 'condition',
        explanation: `Mengevaluasi jarak terhadap ambang ${threshold} cm.`,
      },
      {
        text: `    digitalWrite(PIN_ALARM, HIGH);`,
        phase: 'branch-true',
        explanation: 'Menyalakan Buzzer & LED peringatan bahaya.',
      },
      {
        text: `  } else {`,
        phase: 'branch-false',
        explanation: 'Jika jarak berada di zona aman.',
      },
      {
        text: `    digitalWrite(PIN_ALARM, LOW);`,
        phase: 'branch-false',
        explanation: 'Mematikan alarm.',
      },
      {
        text: `  }`,
        phase: 'branch-false',
        explanation: 'Akhir percabangan logika.',
      },
      {
        text: `  delay(${delayMs});`,
        phase: 'delay',
        explanation: `Menunggu ${delayMs} ms sebelum pengukuran berikutnya.`,
      },
      {
        text: `}`,
        phase: 'delay',
        explanation: 'Mengulang fungsi loop().',
      },
    ];
    return lines.map((l, idx) => ({ ...l, lineNumber: idx + 1 }));
  }

  if (projectId === 'dht11-fan') {
    const lines: Omit<CodeLine, 'lineNumber'>[] = [
      {
        text: `#include <DHT.h>`,
        phase: 'setup',
        explanation: 'Memuat pustaka resmi untuk sensor suhu & kelembapan DHT11.',
      },
      {
        text: `DHT dht(2, DHT11);`,
        phase: 'setup',
        explanation: 'Menghubungkan pin DATA sensor DHT11 pada pin Digital 2.',
      },
      {
        text: `const int PIN_KIPAS = ${actuatorPin};`,
        phase: 'setup',
        explanation: 'Pin PWM/Digital untuk mengendalikan kipas pendingin DC.',
      },
      {
        text: `const int BATAS_SUHU = ${threshold}; // (°C)`,
        phase: 'condition',
        explanation: 'Batas suhu ruangan dalam derajat Celsius.',
      },
      {
        text: `void setup() {`,
        phase: 'setup',
        explanation: 'Menjalankan konfigurasi awal satu kali.',
      },
      {
        text: `  dht.begin();`,
        phase: 'setup',
        explanation: 'Mengaktifkan protokol pembacaan sensor DHT11.',
      },
      {
        text: `  pinMode(PIN_KIPAS, OUTPUT);`,
        phase: 'setup',
        explanation: 'Mengatur pin kipas sebagai OUTPUT.',
      },
      ...(serialEnabled
        ? [
            {
              text: `  Serial.begin(9600);`,
              phase: 'setup' as ExecutionPhase,
              explanation: 'Membuka Serial Monitor pada 9600 baud.',
            },
          ]
        : []),
      {
        text: `}`,
        phase: 'setup',
        explanation: 'Akhir setup().',
      },
      {
        text: `void loop() {`,
        phase: 'read',
        explanation: 'Memantau suhu ruangan secara terus-menerus.',
      },
      {
        text: `  float suhu = dht.readTemperature();`,
        phase: 'read',
        explanation: 'Membaca suhu udara dalam °C dari sensor DHT11.',
      },
      ...(serialEnabled
        ? [
            {
              text: `  Serial.print("Suhu (°C): "); Serial.println(suhu);`,
              phase: 'serial' as ExecutionPhase,
              explanation: 'Mencetak pembacaan suhu ke Serial Monitor.',
            },
          ]
        : []),
      {
        text: `  if (suhu ${comparator} BATAS_SUHU) {`,
        phase: 'condition',
        explanation: `Memeriksa apakah suhu ${comparator} ${threshold}°C.`,
      },
      {
        text: `    digitalWrite(PIN_KIPAS, HIGH);`,
        phase: 'branch-true',
        explanation: 'Menyalakan kipas pendingin karena suhu memenuhi kondisi.',
      },
      {
        text: `  } else {`,
        phase: 'branch-false',
        explanation: 'Jika suhu kembali normal.',
      },
      {
        text: `    digitalWrite(PIN_KIPAS, LOW);`,
        phase: 'branch-false',
        explanation: 'Mematikan kipas untuk hemat daya.',
      },
      {
        text: `  }`,
        phase: 'branch-false',
        explanation: 'Akhir blok if-else.',
      },
      {
        text: `  delay(${delayMs});`,
        phase: 'delay',
        explanation: `Jeda ${delayMs} ms (DHT11 butuh minimal 1 detik antar baca).`,
      },
      {
        text: `}`,
        phase: 'delay',
        explanation: 'Kembali ke awal loop().',
      },
    ];
    return lines.map((l, idx) => ({ ...l, lineNumber: idx + 1 }));
  }

  if (projectId === 'ldr-streetlamp') {
    const lines: Omit<CodeLine, 'lineNumber'>[] = [
      {
        text: `const int PIN_LDR = ${sensorPin};`,
        phase: 'setup',
        explanation: 'Pin Analog pembaca pembagi tegangan sensor cahaya LDR.',
      },
      {
        text: `const int PIN_LAMPU = ${actuatorPin};`,
        phase: 'setup',
        explanation: 'Pin Output menuju LED Lampu Jalan Otomatis.',
      },
      {
        text: `const int AMBANG_CAHAYA = ${threshold}; // (Lux)`,
        phase: 'condition',
        explanation: 'Batas intensitas cahaya untuk menyalakan lampu.',
      },
      {
        text: `void setup() {`,
        phase: 'setup',
        explanation: 'Konfigurasi awal pin Arduino.',
      },
      {
        text: `  pinMode(PIN_LAMPU, OUTPUT);`,
        phase: 'setup',
        explanation: 'Mengatur pin lampu sebagai OUTPUT.',
      },
      ...(serialEnabled
        ? [
            {
              text: `  Serial.begin(9600);`,
              phase: 'setup' as ExecutionPhase,
              explanation: 'Membuka komunikasi Serial Monitor.',
            },
          ]
        : []),
      {
        text: `}`,
        phase: 'setup',
        explanation: 'Akhir setup().',
      },
      {
        text: `void loop() {`,
        phase: 'read',
        explanation: 'Loop pembacaan intensitas cahaya lingkungan.',
      },
      {
        text: `  int nilaiADC = analogRead(PIN_LDR);`,
        phase: 'read',
        explanation: 'Membaca sinyal analog 0–1023 dari rangkaian pembagi tegangan LDR.',
      },
      {
        text: `  int lux = map(nilaiADC, 0, 1023, 0, 1000);`,
        phase: 'read',
        explanation: 'Mengubah skala ADC ke estimasi satuan Lux (0–1000).',
      },
      ...(serialEnabled
        ? [
            {
              text: `  Serial.print("Cahaya (Lux): "); Serial.println(lux);`,
              phase: 'serial' as ExecutionPhase,
              explanation: 'Menampilkan intensitas cahaya di Serial Monitor.',
            },
          ]
        : []),
      {
        text: `  if (lux ${comparator} AMBANG_CAHAYA) {`,
        phase: 'condition',
        explanation: `Memeriksa apakah cahaya lingkungan ${comparator} ${threshold} Lux.`,
      },
      {
        text: `    analogWrite(PIN_LAMPU, 255);`,
        phase: 'branch-true',
        explanation: 'Menyalakan lampu dengan sinyal PWM maksimal (255).',
      },
      {
        text: `  } else {`,
        phase: 'branch-false',
        explanation: 'Jika lingkungan sudah cukup terang.',
      },
      {
        text: `    analogWrite(PIN_LAMPU, 0);`,
        phase: 'branch-false',
        explanation: 'Mematikan lampu jalan (PWM = 0).',
      },
      {
        text: `  }`,
        phase: 'branch-false',
        explanation: 'Akhir blok kondisional.',
      },
      {
        text: `  delay(${delayMs});`,
        phase: 'delay',
        explanation: `Menunda ${delayMs} ms sebelum siklus pembacaan berikutnya.`,
      },
      {
        text: `}`,
        phase: 'delay',
        explanation: 'Akhir loop().',
      },
    ];
    return lines.map((l, idx) => ({ ...l, lineNumber: idx + 1 }));
  }

  if (projectId === 'pir-alarm') {
    const lines: Omit<CodeLine, 'lineNumber'>[] = [
      {
        text: `const int PIN_PIR = 2;`,
        phase: 'setup',
        explanation: 'Pin Digital untuk membaca sinyal gerak dari sensor PIR HC-SR501.',
      },
      {
        text: `const int PIN_BUZZER = ${actuatorPin};`,
        phase: 'setup',
        explanation: 'Pin Output untuk membunyikan alarm & lampu keamanan.',
      },
      {
        text: `void setup() {`,
        phase: 'setup',
        explanation: 'Inisialisasi awal pin INPUT dan OUTPUT.',
      },
      {
        text: `  pinMode(PIN_PIR, INPUT);`,
        phase: 'setup',
        explanation: 'Sensor PIR mengirim logika HIGH (1) jika ada gerakan inframerah.',
      },
      {
        text: `  pinMode(PIN_BUZZER, OUTPUT);`,
        phase: 'setup',
        explanation: 'Pin alarm disiapkan sebagai OUTPUT.',
      },
      ...(serialEnabled
        ? [
            {
              text: `  Serial.begin(9600);`,
              phase: 'setup' as ExecutionPhase,
              explanation: 'Membuka Serial Monitor untuk mencatat deteksi gerak.',
            },
          ]
        : []),
      {
        text: `}`,
        phase: 'setup',
        explanation: 'Akhir setup().',
      },
      {
        text: `void loop() {`,
        phase: 'read',
        explanation: 'Memeriksa sensor gerak secara terus-menerus.',
      },
      {
        text: `  int gerakan = digitalRead(PIN_PIR);`,
        phase: 'read',
        explanation: 'Membaca sinyal digital (HIGH = 1 atau LOW = 0) dari PIR.',
      },
      ...(serialEnabled
        ? [
            {
              text: `  Serial.print("Deteksi Gerak: "); Serial.println(gerakan);`,
              phase: 'serial' as ExecutionPhase,
              explanation: 'Mencetak status deteksi (1/0) di Serial Monitor.',
            },
          ]
        : []),
      {
        text: `  if (gerakan == ${threshold >= 1 ? 'HIGH' : 'LOW'}) {`,
        phase: 'condition',
        explanation: 'Mengecek apakah ada gerakan manusia di area jangkauan sensor.',
      },
      {
        text: `    digitalWrite(PIN_BUZZER, HIGH);`,
        phase: 'branch-true',
        explanation: 'Mengaktifkan sirine buzzer dan lampu peringatan.',
      },
      {
        text: `  } else {`,
        phase: 'branch-false',
        explanation: 'Jika area aman tanpa gerakan.',
      },
      {
        text: `    digitalWrite(PIN_BUZZER, LOW);`,
        phase: 'branch-false',
        explanation: 'Mematikan buzzer dan lampu peringatan.',
      },
      {
        text: `  }`,
        phase: 'branch-false',
        explanation: 'Akhir blok if-else.',
      },
      {
        text: `  delay(${delayMs});`,
        phase: 'delay',
        explanation: `Menunggu ${delayMs} ms.`,
      },
      {
        text: `}`,
        phase: 'delay',
        explanation: 'Mengulang loop().',
      },
    ];
    return lines.map((l, idx) => ({ ...l, lineNumber: idx + 1 }));
  }

  // blink-button
  const lines: Omit<CodeLine, 'lineNumber'>[] = [
    {
      text: `const int PIN_TOMBOL = 2;`,
      phase: 'setup',
      explanation: 'Pin Digital untuk membaca status tombol tekan (Push Button).',
    },
    {
      text: `const int PIN_LED = ${actuatorPin};`,
      phase: 'setup',
      explanation: 'Pin Output LED utama pada breadboard dan LED internal (L).',
    },
    {
      text: `void setup() {`,
      phase: 'setup',
      explanation: 'Konfigurasi pin saat Arduino dinyalakan.',
    },
    {
      text: `  pinMode(PIN_TOMBOL, INPUT);`,
      phase: 'setup',
      explanation: 'Mengatur pin tombol sebagai INPUT digital.',
    },
    {
      text: `  pinMode(PIN_LED, OUTPUT);`,
      phase: 'setup',
      explanation: 'Mengatur pin LED sebagai OUTPUT digital.',
    },
    ...(serialEnabled
      ? [
          {
            text: `  Serial.begin(9600);`,
            phase: 'setup' as ExecutionPhase,
            explanation: 'Memulai Serial Monitor pada 9600 bps.',
          },
        ]
      : []),
    {
      text: `}`,
      phase: 'setup',
      explanation: 'Akhir setup().',
    },
    {
      text: `void loop() {`,
      phase: 'read',
      explanation: 'Membaca tombol secara real-time.',
    },
    {
      text: `  int statusTombol = digitalRead(PIN_TOMBOL);`,
      phase: 'read',
      explanation: 'Membaca logika HIGH (5V) saat ditekan atau LOW (0V) saat dilepas.',
    },
    ...(serialEnabled
      ? [
          {
            text: `  Serial.print("Tombol: "); Serial.println(statusTombol);`,
            phase: 'serial' as ExecutionPhase,
            explanation: 'Mengirim status tombol ke Serial Monitor.',
          },
        ]
      : []),
    {
      text: `  if (statusTombol == HIGH) {`,
      phase: 'condition',
      explanation: 'Memeriksa apakah tombol sedang ditekan.',
    },
    {
      text: `    digitalWrite(PIN_LED, HIGH);`,
      phase: 'branch-true',
      explanation: 'Mengalirkan 5V ke LED sehingga menyala terang.',
    },
    {
      text: `  } else {`,
      phase: 'branch-false',
      explanation: 'Jika tombol tidak ditekan.',
    },
    {
      text: `    digitalWrite(PIN_LED, LOW);`,
      phase: 'branch-false',
      explanation: 'Memutus tegangan LED (0V) agar padam.',
    },
    {
      text: `  }`,
      phase: 'branch-false',
      explanation: 'Akhir kondisi if-else.',
    },
    {
      text: `  delay(${delayMs});`,
      phase: 'delay',
      explanation: `Jeda ${delayMs} ms untuk stabilitas pembacaan (debounce).`,
    },
    {
      text: `}`,
      phase: 'delay',
      explanation: 'Kembali ke baris pertama loop().',
    },
  ];
  return lines.map((l, idx) => ({ ...l, lineNumber: idx + 1 }));
}

export const ARDUINO_PROJECTS: Record<ProjectId, ArduinoProjectMeta> = {
  'plant-watering': {
    id: 'plant-watering',
    title: 'Sistem Siram Tanaman Otomatis',
    shortTitle: 'Siram Tanaman',
    subtitle: 'Sensor Kelembapan Tanah · Relay 5V · Pompa Air Mini',
    difficulty: 'Pemula',
    durationLabel: '5 Langkah · 10 Menit',
    sensorName: 'Sensor Kelembapan Tanah',
    actuatorName: 'Pompa Air & Relay 5V',
    unitLabel: '%',
    minVal: 0,
    maxVal: 100,
    defaultConfig: {
      sensorPin: 'A0',
      actuatorPin: 7,
      secondaryLedPin: 13,
      comparator: '<',
      threshold: 40,
      delayMs: 800,
      serialEnabled: true,
      pumpInvertRelay: false,
      pwmValue: 255,
    },
    defaultEnv: {
      soilMoisturePct: 24,
      evaporationRate: 1.5,
      tankWaterPct: 82,
    },
    defaultWires: [
      {
        id: 'w-soil-vcc',
        fromLabel: 'Sensor Tanah VCC',
        fromPin: 'VCC',
        toPin: '5V',
        color: '#dc2626',
        signalType: 'power',
        connected: true,
      },
      {
        id: 'w-soil-gnd',
        fromLabel: 'Sensor Tanah GND',
        fromPin: 'GND',
        toPin: 'GND',
        color: '#1e293b',
        signalType: 'ground',
        connected: true,
      },
      {
        id: 'w-soil-ao',
        fromLabel: 'Sensor Tanah AO',
        fromPin: 'AO',
        toPin: 'A0',
        color: '#0284c7',
        signalType: 'analog',
        connected: true,
      },
      {
        id: 'w-relay-in',
        fromLabel: 'Relay IN (Pompa)',
        fromPin: 'IN',
        toPin: 'D7',
        color: '#059669',
        signalType: 'digital',
        connected: true,
      },
    ],
    steps: [
      {
        id: 'pw-1',
        stepNumber: 1,
        title: 'Pahami Rangkaian Daya & Pin Analog A0',
        concept: 'Sensor analog membutuhkan catu daya 5V, referensi GND, dan kabel sinyal ke pin Analog (A0) agar Arduino dapat membaca tegangan bervariasi dari 0V hingga 5V.',
        instruction:
          'Pastikan semua 4 kabel jumper (5V, GND, AO → A0, dan Relay IN → D7) terpasang. Coba klik salah satu kabel di diagram sirkuit untuk melihat perannya, lalu pastikan semuanya tersambung.',
        hint: 'Periksa daftar kabel pada papan sirkuit atau klik "Terapkan Contoh" jika ada kabel yang terlepas.',
        focusBlock: 'setup',
        verify: (snap) => snap.wires.every((w) => w.connected),
        applySolution: (snap) => ({
          wires: snap.wires.map((w) => ({ ...w, connected: true })),
        }),
      },
      {
        id: 'pw-2',
        stepNumber: 2,
        title: 'Aktifkan Serial Monitor untuk Kalibrasi',
        concept: 'Serial.begin(9600) memungkinkan kita melihat angka pembacaan sensor secara langsung sebelum menentukan batas penyiraman.',
        instruction:
          'Aktifkan opsi Serial Monitor pada blok "Konfigurasi" dan atur jeda pembacaan (delay) maksimal 1000 ms agar grafik responsif.',
        hint: 'Centang "Cetak ke Serial Monitor" dan pastikan nilai delay ≤ 1000 ms.',
        focusBlock: 'serial',
        verify: (snap) =>
          snap.codeConfig.serialEnabled && snap.codeConfig.delayMs <= 1000,
        applySolution: (snap) => ({
          codeConfig: {
            ...snap.codeConfig,
            serialEnabled: true,
            delayMs: 800,
          },
        }),
      },
      {
        id: 'pw-3',
        stepNumber: 3,
        title: 'Tentukan Logika & Ambang Batas Kering',
        concept: 'Tanaman sehat membutuhkan kelembapan tanah yang cukup. Kita menggunakan operator "<" (kurang dari) agar pompa menyala ketika kelembapan turun di bawah batas ideal (misalnya 35%–55%).',
        instruction:
          'Pada Blok Logika Kondisi (If-Else), pilih operator "<" dan atur ambang batas kelembapan antara 35% sampai 55%.',
        hint: 'Ubah operator perbandingan menjadi "<" dan geser ambang batas ke 40% atau 45%.',
        focusBlock: 'condition',
        verify: (snap) =>
          (snap.codeConfig.comparator === '<' ||
            snap.codeConfig.comparator === '<=') &&
          snap.codeConfig.threshold >= 35 &&
          snap.codeConfig.threshold <= 55,
        applySolution: (snap) => ({
          codeConfig: {
            ...snap.codeConfig,
            comparator: '<',
            threshold: 45,
          },
        }),
      },
      {
        id: 'pw-4',
        stepNumber: 4,
        title: 'Uji Kondisi Tanah Kering (Pompa Menyala)',
        concept: 'Saat analogRead() mendeteksi tanah kering di bawah ambang batas, blok "if" bernilai BENAR sehingga digitalWrite(D7, HIGH) mengaktifkan Relay dan memompa air.',
        instruction:
          'Jalankan simulasi ("Jalankan"), lalu atur kelembapan tanah di bawah ambang batas (misal 20%) dan amati air mengalir menyirami pot.',
        hint: 'Klik tombol "Jalankan" dan gunakan tombol "Keringkan Tanah" atau geser slider kelembapan ke 20%.',
        focusBlock: 'branch-true',
        verify: (snap) => snap.isRunning && snap.hasObservedTrueBranch,
        applySolution: (snap) => ({
          isRunning: true,
          env: { ...snap.env, soilMoisturePct: 20 },
        }),
      },
      {
        id: 'pw-5',
        stepNumber: 5,
        title: 'Verifikasi Otomatis Berhenti Saat Lembap',
        concept: 'Sistem kendali loop tertutup (closed-loop) mencegah tanaman kebanjiran: begitu air membasahi tanah melewati ambang batas, cabang "else" mematikan pompa otomatis.',
        instruction:
          'Biarkan pompa menyirami pot hingga kelembapan melewati ambang batas (atau geser kelembapan ke 70%) saat simulasi berjalan agar pompa otomatis mati.',
        hint: 'Tunggu pompa menyiram sampai angka kelembapan melebihi ambang batas, atau geser slider ke 70%.',
        focusBlock: 'branch-false',
        verify: (snap) =>
          snap.hasObservedTrueBranch && snap.hasObservedFalseBranch,
        applySolution: (snap) => ({
          isRunning: true,
          env: { ...snap.env, soilMoisturePct: 68 },
        }),
      },
    ],
  },

  'ultrasonic-radar': {
    id: 'ultrasonic-radar',
    title: 'Radar Jarak Sensor Ultrasonik',
    shortTitle: 'Ultrasonik HC-SR04',
    subtitle: 'Gelombang Suara 40kHz · Pengukuran Jarak · Alarm Parkir',
    difficulty: 'Pemula',
    durationLabel: '3 Langkah · 7 Menit',
    sensorName: 'Sensor Ultrasonik HC-SR04',
    actuatorName: 'Buzzer & LED Peringatan',
    unitLabel: 'cm',
    minVal: 2,
    maxVal: 300,
    defaultConfig: {
      sensorPin: 'D9/D10',
      actuatorPin: 8,
      secondaryLedPin: 13,
      comparator: '<',
      threshold: 50,
      delayMs: 500,
      serialEnabled: true,
      pumpInvertRelay: false,
      pwmValue: 255,
    },
    defaultEnv: {
      distanceCm: 48,
    },
    defaultWires: [
      {
        id: 'w-us-vcc',
        fromLabel: 'HC-SR04 VCC',
        fromPin: 'VCC',
        toPin: '5V',
        color: '#dc2626',
        signalType: 'power',
        connected: true,
      },
      {
        id: 'w-us-gnd',
        fromLabel: 'HC-SR04 GND',
        fromPin: 'GND',
        toPin: 'GND',
        color: '#1e293b',
        signalType: 'ground',
        connected: true,
      },
      {
        id: 'w-us-echo',
        fromLabel: 'HC-SR04 ECHO',
        fromPin: 'ECHO',
        toPin: 'D10',
        color: '#0284c7',
        signalType: 'digital',
        connected: true,
      },
      {
        id: 'w-us-buzzer',
        fromLabel: 'Buzzer +',
        fromPin: 'IN',
        toPin: 'D8',
        color: '#d97706',
        signalType: 'digital',
        connected: true,
      },
    ],
    steps: [
      {
        id: 'us-1',
        stepNumber: 1,
        title: 'Periksa Kabel Trig, Echo, dan Buzzer',
        concept: 'HC-SR04 memancarkan suara melalui TRIG dan menangkap pantulannya di ECHO.',
        instruction: 'Pastikan seluruh kabel VCC, GND, ECHO, dan Buzzer terpasang.',
        hint: 'Semua kabel harus berstatus tersambung pada papan sirkuit.',
        focusBlock: 'setup',
        verify: (snap) => snap.wires.every((w) => w.connected),
        applySolution: (snap) => ({
          wires: snap.wires.map((w) => ({ ...w, connected: true })),
        }),
      },
      {
        id: 'us-2',
        stepNumber: 2,
        title: 'Atur Jarak Peringatan < 40 cm',
        concept: 'Sensor parkir mobil menyalakan alarm saat jarak objek lebih kecil (<) dari batas aman.',
        instruction: 'Ubah operator ke "<" dan atur ambang jarak menjadi antara 25 hingga 60 cm.',
        hint: 'Set ambang batas ke 40 cm dengan operator "<".',
        focusBlock: 'condition',
        verify: (snap) =>
          snap.codeConfig.comparator === '<' &&
          snap.codeConfig.threshold >= 25 &&
          snap.codeConfig.threshold <= 60,
        applySolution: (snap) => ({
          codeConfig: { ...snap.codeConfig, comparator: '<', threshold: 40 },
        }),
      },
      {
        id: 'us-3',
        stepNumber: 3,
        title: 'Uji Deteksi Objek Dekat & Jauh',
        concept: 'Amati bagaimana durasi pantulan pulseIn() berubah seiring jarak objek.',
        instruction: 'Jalankan simulasi dan geser jarak objek mendekat (<40 cm) lalu menjauh (>80 cm).',
        hint: 'Jalankan simulasi dan ubah slider Jarak Objek di bawah batas dan di atas batas.',
        focusBlock: 'branch-true',
        verify: (snap) =>
          snap.hasObservedTrueBranch && snap.hasObservedFalseBranch,
        applySolution: (snap) => ({
          isRunning: true,
          env: { ...snap.env, distanceCm: 25 },
        }),
      },
    ],
  },

  'dht11-fan': {
    id: 'dht11-fan',
    title: 'Kontrol Kipas Suhu DHT11',
    shortTitle: 'Suhu DHT11',
    subtitle: 'Sensor Suhu Digital · Logika Pendingin · Kipas DC',
    difficulty: 'Pemula',
    durationLabel: '3 Langkah · 7 Menit',
    sensorName: 'Sensor Suhu & Kelembapan DHT11',
    actuatorName: 'Kipas Pendingin DC',
    unitLabel: '°C',
    minVal: 10,
    maxVal: 50,
    defaultConfig: {
      sensorPin: 'D2',
      actuatorPin: 6,
      secondaryLedPin: 13,
      comparator: '>',
      threshold: 30,
      delayMs: 1000,
      serialEnabled: true,
      pumpInvertRelay: false,
      pwmValue: 255,
    },
    defaultEnv: {
      temperatureC: 33,
      humidityPct: 58,
    },
    defaultWires: [
      {
        id: 'w-dht-vcc',
        fromLabel: 'DHT11 VCC',
        fromPin: 'VCC',
        toPin: '5V',
        color: '#dc2626',
        signalType: 'power',
        connected: true,
      },
      {
        id: 'w-dht-gnd',
        fromLabel: 'DHT11 GND',
        fromPin: 'GND',
        toPin: 'GND',
        color: '#1e293b',
        signalType: 'ground',
        connected: true,
      },
      {
        id: 'w-dht-data',
        fromLabel: 'DHT11 DATA',
        fromPin: 'DATA',
        toPin: 'D2',
        color: '#0284c7',
        signalType: 'digital',
        connected: true,
      },
      {
        id: 'w-dht-fan',
        fromLabel: 'Kipas DC +',
        fromPin: 'IN',
        toPin: 'D6',
        color: '#059669',
        signalType: 'digital',
        connected: true,
      },
    ],
    steps: [
      {
        id: 'dht-1',
        stepNumber: 1,
        title: 'Siapkan Rangkaian DHT11 & Kipas',
        concept: 'DHT11 mengirimkan data digital terkalibrasi melalui satu kabel DATA.',
        instruction: 'Pastikan kabel daya 5V, GND, DATA (D2), dan Kipas (D6) tersambung.',
        hint: 'Periksa konektor pada papan sirkuit.',
        focusBlock: 'setup',
        verify: (snap) => snap.wires.every((w) => w.connected),
        applySolution: (snap) => ({
          wires: snap.wires.map((w) => ({ ...w, connected: true })),
        }),
      },
      {
        id: 'dht-2',
        stepNumber: 2,
        title: 'Atur Kondisi Panas (> 28°C)',
        concept: 'Kipas pendingin menyala ketika suhu melebihi (>) titik nyaman ruangan.',
        instruction: 'Pilih operator ">" dan set batas suhu antara 26°C hingga 32°C.',
        hint: 'Pilih ">" dan masukkan angka 29 atau 30.',
        focusBlock: 'condition',
        verify: (snap) =>
          snap.codeConfig.comparator === '>' &&
          snap.codeConfig.threshold >= 26 &&
          snap.codeConfig.threshold <= 32,
        applySolution: (snap) => ({
          codeConfig: { ...snap.codeConfig, comparator: '>', threshold: 29 },
        }),
      },
      {
        id: 'dht-3',
        stepNumber: 3,
        title: 'Simulasikan Perubahan Suhu',
        concept: 'Uji kipas berputar saat suhu panas dan berhenti saat ruangan dingin.',
        instruction: 'Jalankan simulasi dan uji suhu di atas serta di bawah batas.',
        hint: 'Geser suhu ke 35°C lalu ke 24°C saat simulasi aktif.',
        focusBlock: 'branch-true',
        verify: (snap) =>
          snap.hasObservedTrueBranch && snap.hasObservedFalseBranch,
        applySolution: (snap) => ({
          isRunning: true,
          env: { ...snap.env, temperatureC: 35 },
        }),
      },
    ],
  },

  'ldr-streetlamp': {
    id: 'ldr-streetlamp',
    title: 'Lampu Jalan Otomatis LDR',
    shortTitle: 'Cahaya LDR',
    subtitle: 'Photoresistor · Pembagi Tegangan · PWM LED',
    difficulty: 'Pemula',
    durationLabel: '3 Langkah · 6 Menit',
    sensorName: 'Sensor Cahaya LDR',
    actuatorName: 'Lampu Jalan LED',
    unitLabel: 'Lux',
    minVal: 0,
    maxVal: 1000,
    defaultConfig: {
      sensorPin: 'A1',
      actuatorPin: 9,
      secondaryLedPin: 13,
      comparator: '<',
      threshold: 350,
      delayMs: 600,
      serialEnabled: true,
      pumpInvertRelay: false,
      pwmValue: 255,
    },
    defaultEnv: {
      lightLux: 180,
    },
    defaultWires: [
      {
        id: 'w-ldr-vcc',
        fromLabel: 'LDR VCC',
        fromPin: 'VCC',
        toPin: '5V',
        color: '#dc2626',
        signalType: 'power',
        connected: true,
      },
      {
        id: 'w-ldr-gnd',
        fromLabel: 'LDR GND',
        fromPin: 'GND',
        toPin: 'GND',
        color: '#1e293b',
        signalType: 'ground',
        connected: true,
      },
      {
        id: 'w-ldr-ao',
        fromLabel: 'LDR AO',
        fromPin: 'AO',
        toPin: 'A1',
        color: '#0284c7',
        signalType: 'analog',
        connected: true,
      },
      {
        id: 'w-ldr-led',
        fromLabel: 'Lampu LED',
        fromPin: 'IN',
        toPin: 'D9',
        color: '#eab308',
        signalType: 'digital',
        connected: true,
      },
    ],
    steps: [
      {
        id: 'ldr-1',
        stepNumber: 1,
        title: 'Koneksi LDR & Pin PWM (~9)',
        concept: 'Pin bertanda tilde (~) mendukung analogWrite() untuk mengatur kecerahan lampu.',
        instruction: 'Pastikan kabel sensor LDR ke A1 dan Lampu LED ke D9 terhubung.',
        hint: 'Periksa sambungan kabel pada sirkuit.',
        focusBlock: 'setup',
        verify: (snap) => snap.wires.every((w) => w.connected),
        applySolution: (snap) => ({
          wires: snap.wires.map((w) => ({ ...w, connected: true })),
        }),
      },
      {
        id: 'ldr-2',
        stepNumber: 2,
        title: 'Set Ambang Gelap (< 400 Lux)',
        concept: 'Lampu jalan harus menyala ketika intensitas cahaya matahari turun di bawah ambang senja.',
        instruction: 'Pilih operator "<" dan atur batas cahaya antara 250–450 Lux.',
        hint: 'Gunakan "<" dan nilai ambang 350 Lux.',
        focusBlock: 'condition',
        verify: (snap) =>
          snap.codeConfig.comparator === '<' &&
          snap.codeConfig.threshold >= 250 &&
          snap.codeConfig.threshold <= 450,
        applySolution: (snap) => ({
          codeConfig: { ...snap.codeConfig, comparator: '<', threshold: 350 },
        }),
      },
      {
        id: 'ldr-3',
        stepNumber: 3,
        title: 'Uji Kondisi Siang & Malam',
        concept: 'Uji transisi otomatis dari gelap (lampu menyala) ke terang (lampu padam).',
        instruction: 'Jalankan simulasi dan geser slider Cahaya ke kondisi gelap dan terang.',
        hint: 'Set cahaya ke 100 Lux lalu ke 800 Lux saat simulasi berjalan.',
        focusBlock: 'branch-true',
        verify: (snap) =>
          snap.hasObservedTrueBranch && snap.hasObservedFalseBranch,
        applySolution: (snap) => ({
          isRunning: true,
          env: { ...snap.env, lightLux: 120 },
        }),
      },
    ],
  },

  'pir-alarm': {
    id: 'pir-alarm',
    title: 'Alarm Keamanan Sensor Gerak PIR',
    shortTitle: 'Gerak PIR',
    subtitle: 'Deteksi Inframerah Pasif · Input Digital · Buzzer',
    difficulty: 'Pemula',
    durationLabel: '2 Langkah · 5 Menit',
    sensorName: 'Sensor Gerak PIR HC-SR501',
    actuatorName: 'Sirine Buzzer & Suar',
    unitLabel: 'Logic',
    minVal: 0,
    maxVal: 1,
    defaultConfig: {
      sensorPin: 'D2',
      actuatorPin: 8,
      secondaryLedPin: 13,
      comparator: '>=',
      threshold: 1,
      delayMs: 500,
      serialEnabled: true,
      pumpInvertRelay: false,
      pwmValue: 255,
    },
    defaultEnv: {
      motionDetected: false,
    },
    defaultWires: [
      {
        id: 'w-pir-vcc',
        fromLabel: 'PIR VCC',
        fromPin: 'VCC',
        toPin: '5V',
        color: '#dc2626',
        signalType: 'power',
        connected: true,
      },
      {
        id: 'w-pir-gnd',
        fromLabel: 'PIR GND',
        fromPin: 'GND',
        toPin: 'GND',
        color: '#1e293b',
        signalType: 'ground',
        connected: true,
      },
      {
        id: 'w-pir-out',
        fromLabel: 'PIR OUT',
        fromPin: 'OUT',
        toPin: 'D2',
        color: '#0284c7',
        signalType: 'digital',
        connected: true,
      },
      {
        id: 'w-pir-buzzer',
        fromLabel: 'Buzzer',
        fromPin: 'IN',
        toPin: 'D8',
        color: '#dc2626',
        signalType: 'digital',
        connected: true,
      },
    ],
    steps: [
      {
        id: 'pir-1',
        stepNumber: 1,
        title: 'Rangkai Sensor PIR ke D2',
        concept: 'Sensor PIR mendeteksi perubahan radiasi inframerah tubuh manusia dan mengirim sinyal HIGH.',
        instruction: 'Pastikan seluruh kabel terpasang dengan benar.',
        hint: 'Periksa keempat kabel daya dan sinyal.',
        focusBlock: 'setup',
        verify: (snap) => snap.wires.every((w) => w.connected),
        applySolution: (snap) => ({
          wires: snap.wires.map((w) => ({ ...w, connected: true })),
        }),
      },
      {
        id: 'pir-2',
        stepNumber: 2,
        title: 'Picu Gerakan di Depan Sensor',
        concept: 'Saat objek bergerak masuk ke zona sensor, digitalRead(2) bernilai HIGH (1).',
        instruction: 'Jalankan simulasi dan klik tombol "Simulasikan Gerakan" untuk memicu & mematikan alarm.',
        hint: 'Aktifkan dan nonaktifkan gerakan saat simulasi berjalan.',
        focusBlock: 'branch-true',
        verify: (snap) =>
          snap.hasObservedTrueBranch && snap.hasObservedFalseBranch,
        applySolution: (snap) => ({
          isRunning: true,
          env: { ...snap.env, motionDetected: true },
        }),
      },
    ],
  },

  'blink-button': {
    id: 'blink-button',
    title: 'Kontrol LED dengan Push Button',
    shortTitle: 'Tombol & LED',
    subtitle: 'Input Digital · Resistor Pull-Down · Kendali Dasar',
    difficulty: 'Pemula',
    durationLabel: '2 Langkah · 5 Menit',
    sensorName: 'Push Button + Resistor 10kΩ',
    actuatorName: 'LED Merah & LED Internal (L)',
    unitLabel: 'Logic',
    minVal: 0,
    maxVal: 1,
    defaultConfig: {
      sensorPin: 'D2',
      actuatorPin: 13,
      secondaryLedPin: 13,
      comparator: '>=',
      threshold: 1,
      delayMs: 250,
      serialEnabled: true,
      pumpInvertRelay: false,
      pwmValue: 255,
    },
    defaultEnv: {
      buttonPressed: false,
    },
    defaultWires: [
      {
        id: 'w-btn-vcc',
        fromLabel: 'Tombol 5V',
        fromPin: 'VCC',
        toPin: '5V',
        color: '#dc2626',
        signalType: 'power',
        connected: true,
      },
      {
        id: 'w-btn-gnd',
        fromLabel: 'Resistor Pull-Down GND',
        fromPin: 'GND',
        toPin: 'GND',
        color: '#1e293b',
        signalType: 'ground',
        connected: true,
      },
      {
        id: 'w-btn-sig',
        fromLabel: 'Tombol Sinyal',
        fromPin: 'OUT',
        toPin: 'D2',
        color: '#0284c7',
        signalType: 'digital',
        connected: true,
      },
      {
        id: 'w-btn-led',
        fromLabel: 'LED Eksternal',
        fromPin: 'IN',
        toPin: 'D13',
        color: '#059669',
        signalType: 'digital',
        connected: true,
      },
    ],
    steps: [
      {
        id: 'bb-1',
        stepNumber: 1,
        title: 'Verifikasi Resistor Pull-Down & Kabel',
        concept: 'Resistor 10kΩ ke GND mencegah pin input "mengambang" (floating) saat tombol tidak ditekan.',
        instruction: 'Pastikan seluruh sambungan tombol dan LED terhubung.',
        hint: 'Pastikan keempat kabel tersambung.',
        focusBlock: 'setup',
        verify: (snap) => snap.wires.every((w) => w.connected),
        applySolution: (snap) => ({
          wires: snap.wires.map((w) => ({ ...w, connected: true })),
        }),
      },
      {
        id: 'bb-2',
        stepNumber: 2,
        title: 'Tekan & Lepas Tombol Secara Langsung',
        concept: 'Logika digital hanya mengenal dua kondisi tegas: HIGH (5V) dan LOW (0V).',
        instruction: 'Jalankan simulasi, lalu tekan dan lepas tombol pada panel kontrol atau langsung di sirkuit.',
        hint: 'Klik "Tekan Tombol" lalu lepaskan saat simulasi berjalan.',
        focusBlock: 'branch-true',
        verify: (snap) =>
          snap.hasObservedTrueBranch && snap.hasObservedFalseBranch,
        applySolution: (snap) => ({
          isRunning: true,
          env: { ...snap.env, buttonPressed: true },
        }),
      },
    ],
  },
};

export interface SensorCatalogItem {
  id: ProjectId;
  name: string;
  model: string;
  signalType: 'Analog' | 'Digital' | 'Digital Pulse';
  operatingVoltage: string;
  pins: string[];
  howItWorks: string;
  formulaOrRange: string;
  realWorldUse: string;
}

export const SENSOR_CATALOG: SensorCatalogItem[] = [
  {
    id: 'plant-watering',
    name: 'Sensor Kelembapan Tanah',
    model: 'YL-69 / Capacitive v1.2',
    signalType: 'Analog',
    operatingVoltage: '3.3V – 5V DC',
    pins: ['VCC (5V)', 'GND', 'AO (Analog Out)', 'DO (Digital Out)'],
    howItWorks:
      'Mengukur perubahan konduktivitas atau kapasitansi dielektrik tanah. Semakin basah tanah, semakin mudah arus/medan listrik mengalir sehingga tegangan keluaran berubah.',
    formulaOrRange: 'ADC 260 (Basah 100%) – 860 (Kering 0%)',
    realWorldUse: 'Irigasi kebun otomatis, hidroponik pintar, pemantau pot rumah.',
  },
  {
    id: 'ultrasonic-radar',
    name: 'Sensor Jarak Ultrasonik',
    model: 'HC-SR04',
    signalType: 'Digital Pulse',
    operatingVoltage: '5V DC',
    pins: ['VCC (5V)', 'TRIG (Output)', 'ECHO (Input)', 'GND'],
    howItWorks:
      'Memancarkan gelombang suara ultrasonik 40 kHz melalui pemancar TRIG dan mengukur waktu pantulannya kembali ke penerima ECHO.',
    formulaOrRange: 'Jarak (cm) = (Durasi µs × 0.034) / 2 · Rentang 2–400 cm',
    realWorldUse: 'Sensor parkir mundur, robot penghindar rintangan, pengukur tinggi air.',
  },
  {
    id: 'dht11-fan',
    name: 'Sensor Suhu & Kelembapan',
    model: 'DHT11',
    signalType: 'Digital',
    operatingVoltage: '3.3V – 5V DC',
    pins: ['VCC (5V)', 'DATA (Single-Wire)', 'GND'],
    howItWorks:
      'Memiliki termistor NTC dan sensor kelembapan kapasitif di dalamnya dengan chip pengubah sinyal ke paket data digital terkalibrasi.',
    formulaOrRange: 'Suhu 0–50°C (±2°C) · Kelembapan 20–90% RH',
    realWorldUse: 'Termostat pintar, inkubator telur, stasiun cuaca mini.',
  },
  {
    id: 'ldr-streetlamp',
    name: 'Sensor Cahaya (Photoresistor)',
    model: 'LDR GL5528 + Resistor 10kΩ',
    signalType: 'Analog',
    operatingVoltage: '5V DC',
    pins: ['VCC (5V)', 'GND', 'AO (Pembagi Tegangan)'],
    howItWorks:
      'Nilai hambatannya menurun drastis saat terkena cahaya terang. Dipasang bersama resistor 10kΩ sebagai pembagi tegangan untuk dibaca pin Analog.',
    formulaOrRange: '0 Lux (Gelap Gulita) – 1000+ Lux (Terang Siang)',
    realWorldUse: 'Lampu jalan otomatis, pelacak matahari panel surya, tirai otomatis.',
  },
  {
    id: 'pir-alarm',
    name: 'Sensor Gerak Inframerah',
    model: 'PIR HC-SR501',
    signalType: 'Digital',
    operatingVoltage: '5V DC (Logika 3.3V)',
    pins: ['VCC (5V)', 'OUT (Digital)', 'GND'],
    howItWorks:
      'Lensa Fresnel memfokuskan radiasi inframerah tubuh manusia/hewan ke elemen piroelektrik. Saat ada pergerakan panas, pin OUT berubah menjadi HIGH.',
    formulaOrRange: 'HIGH (1) saat ada gerak · LOW (0) saat diam · Jarak ≤ 7 meter',
    realWorldUse: 'Alarm rumah anti-maling, lampu lorong otomatis, pintu otomatis.',
  },
  {
    id: 'blink-button',
    name: 'Tombol Tekan & Resistor Pull-Down',
    model: 'Tactile Push Button 6mm',
    signalType: 'Digital',
    operatingVoltage: '5V DC',
    pins: ['Kaki 1 (5V)', 'Kaki 2 (Ke Pin Digital + Resistor 10kΩ ke GND)'],
    howItWorks:
      'Menghubungkan jalur 5V ke pin digital hanya saat ditekan. Resistor 10kΩ ke GND memastikan pin membaca 0V yang stabil saat tombol dilepas.',
    formulaOrRange: 'HIGH (5V / 1) saat ditekan · LOW (0V / 0) saat dilepas',
    realWorldUse: 'Tombol reset, kendali manual mesin, papan kendali kuis.',
  },
];
