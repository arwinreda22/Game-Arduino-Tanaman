import React, { useState } from 'react';
import { ArrowRight, Cpu } from 'lucide-react';
import { SENSOR_CATALOG } from '../data/projects';
import { ProjectId } from '../types/arduino';

interface SensorCatalogViewProps {
  onOpenProjectInLab: (projectId: ProjectId) => void;
}

export const SensorCatalogView: React.FC<SensorCatalogViewProps> = ({
  onOpenProjectInLab,
}) => {
  const [filter, setFilter] = useState<'all' | 'Analog' | 'Digital'>('all');

  const filtered = SENSOR_CATALOG.filter((item) => {
    if (filter === 'all') return true;
    if (filter === 'Analog') return item.signalType === 'Analog';
    return item.signalType !== 'Analog';
  });

  return (
    <section className="max-w-[1440px] mx-auto px-4 sm:px-6 py-8 space-y-6">
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-4 border-b border-slate-200 pb-6">
        <div className="max-w-2xl space-y-1.5">
          <h1 className="font-display text-2xl sm:text-3xl font-bold text-slate-900 text-balance">
            Katalog Sensor & Modul Populer Arduino
          </h1>
          <p className="text-sm sm:text-base text-slate-600 leading-relaxed">
            Pelajari pinout, prinsip kerja kelistrikan, serta rentang pembacaan sensor yang sering dipakai dalam proyek otomasi. Klik salah satu modul untuk langsung mencobanya di simulator sirkuit.
          </p>
        </div>

        {/* Interactive filter bar */}
        <div className="flex items-center gap-1 p-1 bg-slate-200/70 rounded-lg self-start shrink-0">
          {[
            { id: 'all' as const, label: 'Semua Sensor' },
            { id: 'Analog' as const, label: 'Sinyal Analog' },
            { id: 'Digital' as const, label: 'Sinyal Digital' },
          ].map((tab) => (
            <button
              key={tab.id}
              type="button"
              onClick={() => setFilter(tab.id)}
              className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                filter === tab.id
                  ? 'bg-white text-slate-900 shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      {/* Sensor Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {filtered.map((sensor) => (
          <article
            key={sensor.id}
            className="bg-white border border-slate-200 rounded-xl p-5 flex flex-col justify-between gap-4"
          >
            <div className="space-y-3">
              {/* Quiet unboxed metadata line */}
              <div className="flex items-center gap-2 text-xs text-slate-500 font-mono">
                <Cpu className="w-3.5 h-3.5 text-teal-700 shrink-0" />
                <span>{sensor.signalType}</span>
                <span aria-hidden="true">·</span>
                <span>{sensor.operatingVoltage}</span>
              </div>

              <div>
                <h2 className="font-display text-lg font-semibold text-slate-900">
                  {sensor.name}
                </h2>
                <p className="text-xs font-mono text-slate-500 mt-0.5">
                  Model: {sensor.model}
                </p>
              </div>

              <p className="text-sm text-slate-600 leading-relaxed">
                {sensor.howItWorks}
              </p>

              <div className="pt-2 border-t border-slate-100 space-y-2 text-xs">
                <div>
                  <span className="font-semibold text-slate-800 block">
                    Susunan Pin:
                  </span>
                  <span className="font-mono text-slate-600">
                    {sensor.pins.join(' · ')}
                  </span>
                </div>
                <div>
                  <span className="font-semibold text-slate-800 block">
                    Skala / Rumus:
                  </span>
                  <span className="font-mono text-teal-800">
                    {sensor.formulaOrRange}
                  </span>
                </div>
                <div>
                  <span className="font-semibold text-slate-800 block">
                    Contoh Penerapan:
                  </span>
                  <span className="text-slate-600">{sensor.realWorldUse}</span>
                </div>
              </div>
            </div>

            <button
              type="button"
              onClick={() => onOpenProjectInLab(sensor.id)}
              className="w-full inline-flex items-center justify-center gap-2 px-4 py-2.5 text-xs font-semibold text-white bg-slate-900 hover:bg-teal-700 rounded-lg transition-colors cursor-pointer"
            >
              <span>Buka di Simulator Sirkuit</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </button>
          </article>
        ))}
      </div>
    </section>
  );
};
