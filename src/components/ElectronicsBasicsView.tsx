import React, { useState } from 'react';
import { AlertTriangle, CheckCircle2, Zap, Activity, Grid } from 'lucide-react';

export const ElectronicsBasicsView: React.FC = () => {
  // Lab 1: Ohm's Law & LED Safety
  const [voltage, setVoltage] = useState<number>(5);
  const [resistance, setResistance] = useState<number>(220);
  const ledForwardDrop = 2.0; // Red LED ~2.0V
  const effectiveVoltage = Math.max(0, voltage - ledForwardDrop);
  const currentMa = (effectiveVoltage / resistance) * 1000;
  const isOverload = currentMa > 25;
  const isTooDim = currentMa < 2;

  // Lab 2: Signal Visualizer (Digital, Analog, PWM)
  const [signalMode, setSignalMode] = useState<'digital' | 'analog' | 'pwm'>(
    'pwm'
  );
  const [digitalHigh, setDigitalHigh] = useState(true);
  const [analogVoltage, setAnalogVoltage] = useState(3.2);
  const [pwmDuty, setPwmDuty] = useState(140); // 0..255

  // Lab 3: Breadboard Interactive Explorer
  const [selectedRail, setSelectedRail] = useState<string>('row-5-top');

  // Generate SVG waveform path
  const renderWaveformPath = () => {
    if (signalMode === 'digital') {
      const y = digitalHigh ? 24 : 96;
      return `M 16 ${y} L 384 ${y}`;
    }
    if (signalMode === 'analog') {
      const baseY = 96 - (analogVoltage / 5) * 72;
      const pts: string[] = [];
      for (let x = 16; x <= 384; x += 8) {
        const wave = Math.sin((x - 16) * 0.04) * 10;
        const clamped = Math.max(16, Math.min(104, baseY + wave));
        pts.push(`${x === 16 ? 'M' : 'L'} ${x} ${clamped.toFixed(1)}`);
      }
      return pts.join(' ');
    }
    // PWM square wave (5 periods)
    const dutyFrac = pwmDuty / 255;
    const period = 72;
    let d = 'M 16 96';
    for (let i = 0; i < 5; i++) {
      const startX = 16 + i * period;
      const highW = Math.max(2, period * dutyFrac);
      const endX = startX + period;
      if (dutyFrac <= 0.02) {
        d += ` L ${endX} 96`;
      } else if (dutyFrac >= 0.98) {
        d += ` L ${startX} 24 L ${endX} 24`;
      } else {
        d += ` L ${startX} 24 L ${(startX + highW).toFixed(1)} 24 L ${(startX + highW).toFixed(1)} 96 L ${endX} 96`;
      }
    }
    return d;
  };

  return (
    <section className="max-w-[1440px] mx-auto px-4 sm:px-6 py-8 space-y-8">
      <div className="max-w-2xl space-y-1.5 border-b border-slate-200 pb-6">
        <h1 className="font-display text-2xl sm:text-3xl font-bold text-slate-900 text-balance">
          Dasar Elektronika & Logika Sinyal Arduino
        </h1>
        <p className="text-sm sm:text-base text-slate-600 leading-relaxed">
          Pahami tiga fondasi penting sebelum merakit sirkuit nyata: Hukum Ohm untuk melindungi komponen, perbedaan sinyal Digital/Analog/PWM, serta jalur konduktor di dalam breadboard.
        </p>
      </div>

      {/* LAB 1 & LAB 2 */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* LAB 1: OHM'S LAW */}
        <div className="bg-white border border-slate-200 rounded-xl p-6 space-y-5">
          <div className="flex items-start justify-between gap-3">
            <div>
              <span className="text-xs font-medium text-teal-700 inline-flex items-center gap-1.5">
                <Zap className="w-3.5 h-3.5" />
                <span>Lab 01 · Hukum Ohm (I = V / R)</span>
              </span>
              <h2 className="font-display text-lg font-semibold text-slate-900 mt-1">
                Mengapa LED Membutuhkan Resistor?
              </h2>
            </div>
            <div className="text-right font-mono tabular-nums">
              <div className="text-xl font-bold text-slate-900">
                {currentMa.toFixed(1)} mA
              </div>
              <div className="text-[11px] text-slate-500">Arus Mengalir</div>
            </div>
          </div>

          {/* Interactive LED + Resistor Visual */}
          <div className="bg-slate-50 border border-slate-200 rounded-lg p-4 flex items-center justify-between gap-4">
            <svg viewBox="0 0 320 96" className="w-full h-24">
              {/* Battery / Source */}
              <rect
                x={14}
                y={22}
                width={54}
                height={52}
                rx={6}
                fill="#0f172a"
              />
              <text
                x={41}
                y={52}
                textAnchor="middle"
                fontSize={12}
                fontWeight="700"
                fill="#f8fafc"
                fontFamily="JetBrains Mono"
              >
                {voltage}V
              </text>
              {/* Wire to resistor */}
              <line
                x1={68}
                y1={48}
                x2={115}
                y2={48}
                stroke="#dc2626"
                strokeWidth={3}
              />
              {/* Resistor body */}
              <rect
                x={115}
                y={36}
                width={66}
                height={24}
                rx={5}
                fill="#fde68a"
                stroke="#b45309"
                strokeWidth={1.5}
              />
              <rect x={127} y={36} width={6} height={24} fill="#dc2626" />
              <rect x={141} y={36} width={6} height={24} fill="#78350f" />
              <rect x={155} y={36} width={6} height={24} fill="#0f172a" />
              <text
                x={148}
                y={78}
                textAnchor="middle"
                fontSize={10}
                fill="#475569"
                fontFamily="JetBrains Mono"
              >
                {resistance} Ω
              </text>
              {/* Wire to LED */}
              <line
                x1={181}
                y1={48}
                x2={232}
                y2={48}
                stroke="#0284c7"
                strokeWidth={3}
              />
              {/* LED Glow */}
              {!isOverload && !isTooDim && (
                <circle
                  cx={256}
                  cy={48}
                  r={Math.min(34, 14 + currentMa * 0.7)}
                  fill="#ef4444"
                  fillOpacity={Math.min(0.45, 0.1 + currentMa / 40)}
                />
              )}
              <circle
                cx={256}
                cy={48}
                r={15}
                fill={
                  isOverload
                    ? '#450a0a'
                    : isTooDim
                      ? '#fca5a5'
                      : '#ef4444'
                }
                stroke="#7f1d1d"
                strokeWidth={2}
              />
              {isOverload && (
                <text
                  x={256}
                  y={52}
                  textAnchor="middle"
                  fontSize={12}
                  fontWeight="700"
                  fill="#fef08a"
                >
                  !
                </text>
              )}
              <text
                x={256}
                y={78}
                textAnchor="middle"
                fontSize={10}
                fill="#475569"
                fontFamily="JetBrains Mono"
              >
                LED (2.0V)
              </text>
            </svg>
          </div>

          {/* Sliders */}
          <div className="space-y-4">
            <div>
              <div className="flex justify-between text-xs font-medium text-slate-700 mb-1">
                <span>Tegangan Sumber (V)</span>
                <span className="font-mono font-semibold tabular-nums">
                  {voltage.toFixed(1)} V
                </span>
              </div>
              <input
                type="range"
                min={3.3}
                max={12}
                step={0.1}
                value={voltage}
                onChange={(e) => setVoltage(Number(e.target.value))}
                className="w-full accent-teal-700 cursor-pointer"
              />
            </div>

            <div>
              <div className="flex justify-between text-xs font-medium text-slate-700 mb-1">
                <span>Nilai Resistor Pembatas (R)</span>
                <span className="font-mono font-semibold tabular-nums">
                  {resistance} Ω
                </span>
              </div>
              <input
                type="range"
                min={33}
                max={2200}
                step={10}
                value={resistance}
                onChange={(e) => setResistance(Number(e.target.value))}
                className="w-full accent-teal-700 cursor-pointer"
              />
            </div>
          </div>

          {/* Explicit Icon + Text Status */}
          <div
            className={`p-3 rounded-lg border text-xs flex items-start gap-2 ${
              isOverload
                ? 'bg-red-50 border-red-200 text-red-900'
                : isTooDim
                  ? 'bg-amber-50 border-amber-200 text-amber-900'
                  : 'bg-emerald-50 border-emerald-200 text-emerald-900'
            }`}
          >
            {isOverload ? (
              <AlertTriangle className="w-4 h-4 text-red-600 shrink-0 mt-0.5" />
            ) : (
              <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
            )}
            <div>
              {isOverload
                ? `Bahaya Arus Berlebih (${currentMa.toFixed(1)} mA > 25 mA)! LED dapat terbakar dan pin Arduino berisiko rusak. Perbesar nilai resistor ke minimal 220 Ω.`
                : isTooDim
                  ? `Arus sangat kecil (${currentMa.toFixed(1)} mA). LED menyala sangat redup.`
                  : `Arus Aman & Optimal (${currentMa.toFixed(1)} mA). Resistor 220 Ω–330 Ω pada 5V Arduino menjaga LED terang dan awet.`}
            </div>
          </div>
        </div>

        {/* LAB 2: DIGITAL vs ANALOG vs PWM */}
        <div className="bg-white border border-slate-200 rounded-xl p-6 space-y-5">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <span className="text-xs font-medium text-sky-700 inline-flex items-center gap-1.5">
                <Activity className="w-3.5 h-3.5" />
                <span>Lab 02 · Sinyal Mikrokontroler</span>
              </span>
              <h2 className="font-display text-lg font-semibold text-slate-900 mt-1">
                Digital, Analog (ADC) & PWM
              </h2>
            </div>

            <div className="flex items-center gap-1 p-0.5 bg-slate-100 rounded-lg">
              {[
                { id: 'digital' as const, label: 'Digital' },
                { id: 'analog' as const, label: 'Analog ADC' },
                { id: 'pwm' as const, label: 'PWM (~)' },
              ].map((m) => (
                <button
                  key={m.id}
                  type="button"
                  onClick={() => setSignalMode(m.id)}
                  className={`px-2.5 py-1 text-xs font-medium rounded-md transition-colors cursor-pointer ${
                    signalMode === m.id
                      ? 'bg-white text-slate-900 shadow-xs'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  {m.label}
                </button>
              ))}
            </div>
          </div>

          {/* Oscilloscope SVG */}
          <div className="bg-slate-950 rounded-lg p-3">
            <svg viewBox="0 0 400 120" className="w-full h-32">
              <line x1={16} y1={24} x2={384} y2={24} stroke="#1e293b" strokeDasharray="3 3" />
              <line x1={16} y1={60} x2={384} y2={60} stroke="#1e293b" strokeDasharray="3 3" />
              <line x1={16} y1={96} x2={384} y2={96} stroke="#1e293b" />
              <text x={4} y={28} fontSize={8} fill="#64748b" fontFamily="JetBrains Mono">
                5V
              </text>
              <text x={4} y={99} fontSize={8} fill="#64748b" fontFamily="JetBrains Mono">
                0V
              </text>
              <path
                d={renderWaveformPath()}
                fill="none"
                stroke="#14b8a6"
                strokeWidth={2.5}
                strokeLinejoin="round"
              />
            </svg>
          </div>

          {/* Interactive Controls per Mode */}
          {signalMode === 'digital' && (
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-xs font-medium text-slate-700">
                  Status Logika Pin Digital:
                </span>
                <button
                  type="button"
                  onClick={() => setDigitalHigh((v) => !v)}
                  className={`px-3 py-1.5 text-xs font-mono font-semibold rounded-lg cursor-pointer ${
                    digitalHigh
                      ? 'bg-teal-700 text-white'
                      : 'bg-slate-200 text-slate-800'
                  }`}
                >
                  {digitalHigh ? 'HIGH (5V / 1)' : 'LOW (0V / 0)'}
                </button>
              </div>
              <p className="text-xs text-slate-600 leading-relaxed">
                Pin Digital hanya memiliki dua keadaan tegas: <strong>HIGH (5V)</strong> atau <strong>LOW (0V)</strong>. Cocok untuk menyalakan/mematikan relay pompa atau membaca tombol tekan.
              </p>
            </div>
          )}

          {signalMode === 'analog' && (
            <div className="space-y-3">
              <div className="flex justify-between text-xs font-medium text-slate-700">
                <span>Tegangan Input Sensor (0–5V)</span>
                <span className="font-mono font-semibold text-teal-700 tabular-nums">
                  {analogVoltage.toFixed(2)} V → ADC{' '}
                  {Math.round((analogVoltage / 5) * 1023)}
                </span>
              </div>
              <input
                type="range"
                min={0}
                max={5}
                step={0.1}
                value={analogVoltage}
                onChange={(e) => setAnalogVoltage(Number(e.target.value))}
                className="w-full accent-teal-700 cursor-pointer"
              />
              <p className="text-xs text-slate-600 leading-relaxed">
                Pin Analog (A0–A5) menggunakan ADC 10-bit untuk mengubah tegangan kontinu 0–5V menjadi angka bulat <strong>0 hingga 1023</strong>. Inilah cara Arduino membaca tingkat kelembapan tanah!
              </p>
            </div>
          )}

          {signalMode === 'pwm' && (
            <div className="space-y-3">
              <div className="flex justify-between text-xs font-medium text-slate-700">
                <span>analogWrite(pin, nilai)</span>
                <span className="font-mono font-semibold text-teal-700 tabular-nums">
                  {pwmDuty} / 255 ({Math.round((pwmDuty / 255) * 100)}% Duty Cycle)
                </span>
              </div>
              <input
                type="range"
                min={0}
                max={255}
                value={pwmDuty}
                onChange={(e) => setPwmDuty(Number(e.target.value))}
                className="w-full accent-teal-700 cursor-pointer"
              />
              <p className="text-xs text-slate-600 leading-relaxed">
                Pulse Width Modulation (PWM) menyalakan dan mematikan pin bertanda <code className="font-mono bg-slate-100 px-1 rounded">~</code> ratusan kali per detik. Mengubah lebar pulsa (Duty Cycle) mengatur kecerahan LED atau kecepatan kipas DC.
              </p>
            </div>
          )}
        </div>
      </div>

      {/* LAB 3: BREADBOARD INTERACTIVE MAP */}
      <div className="bg-white border border-slate-200 rounded-xl p-6 space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
          <div>
            <span className="text-xs font-medium text-teal-700 inline-flex items-center gap-1.5">
              <Grid className="w-3.5 h-3.5" />
              <span>Lab 03 · Peta Jalur Logam Internal Breadboard</span>
            </span>
            <h2 className="font-display text-lg font-semibold text-slate-900 mt-1">
              Bagaimana Lubang Breadboard Saling Terhubung?
            </h2>
          </div>
          <span className="text-xs font-mono text-slate-600">
            Klik jalur pada gambar untuk melihat koneksi logam di dalamnya
          </span>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-center">
          <div className="lg:col-span-8 bg-slate-50 border border-slate-200 rounded-lg p-4 overflow-x-auto">
            <svg viewBox="0 0 640 190" className="w-full min-w-[500px] h-auto select-none">
              <rect x={10} y={10} width={620} height={170} rx={10} fill="#ffffff" stroke="#cbd5e1" strokeWidth={1.5} />

              {/* Top Power Rail (+) */}
              <g
                onClick={() => setSelectedRail('power-plus')}
                className="cursor-pointer"
              >
                <line x1={30} y1={24} x2={610} y2={24} stroke="#ef4444" strokeWidth={2} />
                {selectedRail === 'power-plus' && (
                  <rect x={28} y={26} width={584} height={16} rx={4} fill="#fecaca" />
                )}
                {Array.from({ length: 24 }).map((_, i) => (
                  <rect key={i} x={36 + i * 24} y={31} width={6} height={6} rx={1} fill="#334155" />
                ))}
              </g>

              {/* Top Power Rail (-) */}
              <g
                onClick={() => setSelectedRail('power-minus')}
                className="cursor-pointer"
              >
                <line x1={30} y1={56} x2={610} y2={56} stroke="#2563eb" strokeWidth={2} />
                {selectedRail === 'power-minus' && (
                  <rect x={28} y={40} width={584} height={14} rx={4} fill="#bfdbfe" />
                )}
                {Array.from({ length: 24 }).map((_, i) => (
                  <rect key={i} x={36 + i * 24} y={44} width={6} height={6} rx={1} fill="#334155" />
                ))}
              </g>

              {/* Center IC Divider Gap */}
              <rect x={20} y={108} width={600} height={10} rx={2} fill="#e2e8f0" />

              {/* Vertical Terminal Columns (Top half a-e) */}
              {Array.from({ length: 20 }).map((_, col) => {
                const key = `row-${col}-top`;
                const isActive = selectedRail === key;
                return (
                  <g
                    key={key}
                    onClick={() => setSelectedRail(key)}
                    className="cursor-pointer"
                  >
                    <rect
                      x={46 + col * 28}
                      y={66}
                      width={16}
                      height={38}
                      rx={3}
                      fill={isActive ? '#99f6e4' : 'transparent'}
                      stroke={isActive ? '#0d9488' : 'transparent'}
                    />
                    {[0, 1, 2, 3].map((r) => (
                      <rect
                        key={r}
                        x={51 + col * 28}
                        y={70 + r * 9}
                        width={6}
                        height={5}
                        rx={1}
                        fill="#334155"
                      />
                    ))}
                  </g>
                );
              })}

              {/* Vertical Terminal Columns (Bottom half f-j) */}
              {Array.from({ length: 20 }).map((_, col) => {
                const key = `row-${col}-bot`;
                const isActive = selectedRail === key;
                return (
                  <g
                    key={key}
                    onClick={() => setSelectedRail(key)}
                    className="cursor-pointer"
                  >
                    <rect
                      x={46 + col * 28}
                      y={122}
                      width={16}
                      height={38}
                      rx={3}
                      fill={isActive ? '#99f6e4' : 'transparent'}
                      stroke={isActive ? '#0d9488' : 'transparent'}
                    />
                    {[0, 1, 2, 3].map((r) => (
                      <rect
                        key={r}
                        x={51 + col * 28}
                        y={126 + r * 9}
                        width={6}
                        height={5}
                        rx={1}
                        fill="#334155"
                      />
                    ))}
                  </g>
                );
              })}
            </svg>
          </div>

          <div className="lg:col-span-4 space-y-3 text-sm text-slate-700 leading-relaxed">
            <h3 className="font-display font-semibold text-slate-900">
              {selectedRail.startsWith('power')
                ? 'Jalur Daya Horizontal (+ / -)'
                : 'Jalur Terminal Vertikal (5 Lubang)'}
            </h3>
            <p className="text-xs text-slate-600">
              {selectedRail === 'power-plus'
                ? 'Baris merah paling atas terhubung memanjang secara horizontal dari kiri ke kanan. Umumnya disambungkan ke pin 5V Arduino sebagai sumber tegangan bersama.'
                : selectedRail === 'power-minus'
                  ? 'Baris biru terhubung memanjang secara horizontal. Disambungkan ke pin GND (Ground 0V) Arduino agar semua sensor berbagi referensi negatif yang sama.'
                  : 'Setiap kolom kecil berisi lubang yang terhubung secara vertikal, namun terputus oleh parit tengah. Parit tengah dipakai untuk meletakkan IC atau tombol agar kakinya tidak korsleting.'}
            </p>
          </div>
        </div>
      </div>
    </section>
  );
};
