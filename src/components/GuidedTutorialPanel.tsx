import React, { useState } from 'react';
import {
  CheckCircle2,
  Circle,
  Lightbulb,
  Sparkles,
  ChevronLeft,
  ChevronRight,
  BookOpen,
} from 'lucide-react';
import { ProjectId, SimulationSnapshot } from '../types/arduino';
import { ARDUINO_PROJECTS } from '../data/projects';

interface GuidedTutorialPanelProps {
  projectId: ProjectId;
  snapshot: SimulationSnapshot;
  currentStepIndex: number;
  onSelectStep: (idx: number) => void;
  onApplyStepSolution: (patch: Partial<SimulationSnapshot>) => void;
  onSwitchProject: (id: ProjectId) => void;
}

export const GuidedTutorialPanel: React.FC<GuidedTutorialPanelProps> = ({
  projectId,
  snapshot,
  currentStepIndex,
  onSelectStep,
  onApplyStepSolution,
  onSwitchProject,
}) => {
  const [showHint, setShowHint] = useState(false);
  const project = ARDUINO_PROJECTS[projectId];
  const steps = project.steps;
  const safeIdx = Math.min(currentStepIndex, steps.length - 1);
  const activeStep = steps[safeIdx];

  const completedFlags = steps.map((s) => s.verify(snapshot));
  const completedCount = completedFlags.filter(Boolean).length;
  const isCurrentPassed = completedFlags[safeIdx];
  const allCompleted = completedCount === steps.length;

  return (
    <div className="bg-white border border-slate-200 rounded-xl overflow-hidden">
      {/* Header */}
      <div className="px-4 py-3 border-b border-slate-200 bg-slate-50/70 flex items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <BookOpen className="w-4 h-4 text-teal-700" />
          <h3 className="font-display text-sm font-semibold text-slate-900">
            Latihan Langkah demi Langkah
          </h3>
        </div>
        <span className="text-xs font-mono text-slate-600 tabular-nums">
          {completedCount}/{steps.length} Selesai
        </span>
      </div>

      {/* Step Stepper Bar */}
      <div className="px-4 py-2.5 border-b border-slate-100 flex items-center gap-1.5 overflow-x-auto">
        {steps.map((step, idx) => {
          const passed = completedFlags[idx];
          const isCurrent = idx === safeIdx;
          return (
            <button
              key={step.id}
              type="button"
              onClick={() => {
                onSelectStep(idx);
                setShowHint(false);
              }}
              className={`inline-flex items-center gap-1.5 px-2.5 py-1.5 text-xs font-medium rounded-lg border transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                isCurrent
                  ? 'bg-teal-50 border-teal-300 text-teal-900'
                  : passed
                    ? 'bg-emerald-50/60 border-emerald-200 text-emerald-800'
                    : 'bg-white border-slate-200 text-slate-600 hover:bg-slate-50'
              }`}
            >
              {passed ? (
                <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
              ) : (
                <Circle className="w-3.5 h-3.5 text-slate-400 shrink-0" />
              )}
              <span>Langkah {step.stepNumber}</span>
            </button>
          );
        })}
      </div>

      {/* Active Step Body */}
      <div className="p-4 space-y-3.5">
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="text-xs font-medium text-teal-700">
              {project.shortTitle} · {project.difficulty}
            </p>
            <h4 className="font-display text-base font-semibold text-slate-900 mt-0.5">
              {activeStep.stepNumber}. {activeStep.title}
            </h4>
          </div>
          <span
            className={`text-xs font-medium inline-flex items-center gap-1 shrink-0 ${
              isCurrentPassed ? 'text-emerald-700' : 'text-slate-500'
            }`}
          >
            {isCurrentPassed ? (
              <>
                <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                <span>Terpenuhi</span>
              </>
            ) : (
              <span>Belum Selesai</span>
            )}
          </span>
        </div>

        {/* Concept Box */}
        <div className="p-3 rounded-lg bg-slate-50 border border-slate-200 text-xs leading-relaxed text-slate-700">
          <span className="font-semibold text-slate-900 block mb-0.5">
            Konsep Elektronika & Kode:
          </span>
          {activeStep.concept}
        </div>

        {/* Practical Instruction */}
        <div className="text-sm text-slate-800 leading-relaxed">
          <span className="font-semibold text-slate-900">Tugas Anda: </span>
          {activeStep.instruction}
        </div>

        {/* Hint toggle */}
        {showHint && (
          <div className="p-3 rounded-lg bg-amber-50 border border-amber-200 text-xs text-amber-900">
            <span className="font-semibold">Petunjuk: </span>
            {activeStep.hint}
          </div>
        )}

        {/* Action Buttons */}
        <div className="flex flex-wrap items-center justify-between gap-2 pt-1">
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setShowHint((v) => !v)}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-slate-700 bg-white border border-slate-200 hover:bg-slate-50 rounded-lg transition-colors cursor-pointer"
            >
              <Lightbulb className="w-3.5 h-3.5 text-amber-600" />
              <span>{showHint ? 'Tutup Petunjuk' : 'Petunjuk'}</span>
            </button>

            {!isCurrentPassed && (
              <button
                type="button"
                onClick={() =>
                  onApplyStepSolution(activeStep.applySolution(snapshot))
                }
                className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-teal-800 bg-teal-50 border border-teal-200 hover:bg-teal-100 rounded-lg transition-colors cursor-pointer"
              >
                <Sparkles className="w-3.5 h-3.5 text-teal-700" />
                <span>Terapkan Contoh</span>
              </button>
            )}
          </div>

          <div className="flex items-center gap-1.5">
            <button
              type="button"
              disabled={safeIdx === 0}
              onClick={() => {
                onSelectStep(Math.max(0, safeIdx - 1));
                setShowHint(false);
              }}
              className="p-1.5 rounded-lg border border-slate-200 text-slate-700 hover:bg-slate-50 disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer"
              aria-label="Langkah sebelumnya"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>
            <button
              type="button"
              disabled={safeIdx >= steps.length - 1}
              onClick={() => {
                onSelectStep(Math.min(steps.length - 1, safeIdx + 1));
                setShowHint(false);
              }}
              className="inline-flex items-center gap-1 px-3 py-1.5 text-xs font-semibold rounded-lg bg-slate-900 text-white hover:bg-slate-800 disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer"
            >
              <span>Lanjut</span>
              <ChevronRight className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>

        {/* Module Completion Callout */}
        {allCompleted && (
          <div className="p-3 rounded-lg bg-emerald-50 border border-emerald-200 flex flex-wrap items-center justify-between gap-3">
            <div className="text-xs text-emerald-900">
              <strong className="font-semibold block">
                Modul {project.shortTitle} Selesai!
              </strong>
              Anda telah menguasai rangkaian dan logika pemrograman proyek ini.
            </div>
            {projectId === 'plant-watering' && (
              <button
                type="button"
                onClick={() => onSwitchProject('ultrasonic-radar')}
                className="px-3 py-1.5 text-xs font-semibold text-white bg-emerald-700 hover:bg-emerald-800 rounded-lg transition-colors cursor-pointer"
              >
                Coba Sensor Ultrasonik
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  );
};
