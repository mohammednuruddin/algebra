'use client';

import { useState, useCallback, useRef, useEffect } from 'react';
import type { TutorCanvasState } from '@/lib/types/tutor';

interface TutorCanvasHostProps {
  canvas: TutorCanvasState;
  disabled?: boolean;
  onMoveToken: (tokenId: string, zoneId: string | null) => void;
  onChooseEquationAnswer: (choiceId: string) => void;
  onFillBlankSubmit?: (answers: Record<string, string>) => void;
  onCodeSubmit?: (code: string) => void;
  onCanvasSubmit?: (mode: string, data: unknown) => void;
}

/* ── Shared section wrapper ─────────────────────────────────────────── */

function CanvasSection({
  headline,
  children,
}: {
  headline: string;
  children: React.ReactNode;
}) {
  return (
    <section className="flex min-h-[40dvh] flex-col border border-zinc-200 bg-white p-8 md:p-14 shadow-lg animate-in fade-in duration-700">
      <div className="mb-6">
        <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-zinc-400">
          {headline}
        </p>
      </div>
      {children}
    </section>
  );
}

function SubmitButton({
  onClick,
  disabled,
  label = 'Submit',
}: {
  onClick: () => void;
  disabled: boolean;
  label?: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className="rounded-lg bg-zinc-900 px-8 py-3 text-sm font-medium text-white transition hover:bg-zinc-800 disabled:opacity-40"
    >
      {label}
    </button>
  );
}

/* ── Distribution helpers ───────────────────────────────────────────── */

function ZoneCard({
  label,
  hint,
  accent,
  onDropToken,
  children,
}: {
  label: string;
  hint?: string;
  accent?: string;
  onDropToken: (tokenId: string) => void;
  children: React.ReactNode;
}) {
  return (
    <div
      onDragOver={(e) => e.preventDefault()}
      onDrop={(e) => {
        e.preventDefault();
        const tokenId = e.dataTransfer.getData('text/plain');
        if (tokenId) onDropToken(tokenId);
      }}
      className="flex min-h-[14rem] flex-col border border-zinc-200 bg-white p-6 shadow-[0_2px_12px_rgba(0,0,0,0.03)] transition-colors hover:border-zinc-300"
    >
      <div className="mb-6 flex items-start justify-between gap-3 border-b border-zinc-100 pb-4">
        <div>
          <p className="text-sm font-semibold uppercase tracking-widest text-zinc-900">{label}</p>
          {hint ? <p className="mt-2 text-xs font-light text-zinc-500">{hint}</p> : null}
        </div>
        {accent ? <span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: accent }} /> : null}
      </div>
      <div className="flex flex-1 flex-wrap gap-3 content-start">{children}</div>
    </div>
  );
}

function TutorToken({ token, disabled }: { token: TutorCanvasState['tokens'][number]; disabled: boolean }) {
  const isDot = token.label.trim().length === 0;
  return (
    <button
      type="button"
      draggable={!disabled}
      onDragStart={(e) => e.dataTransfer.setData('text/plain', token.id)}
      disabled={disabled}
      aria-label={isDot ? 'dot token' : token.label}
      className={`transition hover:opacity-90 active:scale-95 disabled:opacity-50 shadow-sm ${
        isDot ? 'h-8 w-8 rounded-full' : 'rounded-sm px-5 py-2.5 text-xs font-semibold tracking-wider uppercase text-white'
      }`}
      style={{ backgroundColor: token.color }}
    >
      {isDot ? <span className="sr-only">token</span> : token.label}
    </button>
  );
}

/* ── Fill-in-the-blank ──────────────────────────────────────────────── */

function FillBlankMode({
  canvas,
  disabled,
  onSubmit,
}: {
  canvas: TutorCanvasState;
  disabled: boolean;
  onSubmit?: (answers: Record<string, string>) => void;
}) {
  const fillBlank = canvas.fillBlank;
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [submitted, setSubmitted] = useState(false);

  const handleChange = useCallback((slotId: string, value: string) => {
    setAnswers((prev) => ({ ...prev, [slotId]: value }));
  }, []);

  const handleSubmit = useCallback(() => {
    setSubmitted(true);
    onSubmit?.(answers);
  }, [answers, onSubmit]);

  if (!fillBlank) return null;
  const allFilled = fillBlank.slots.every((s) => (answers[s.id] || '').trim().length > 0);

  return (
    <CanvasSection headline={canvas.headline}>
      <p className="text-xl md:text-2xl font-light text-zinc-900 leading-relaxed mb-8">{fillBlank.prompt}</p>
      <div className="flex-1 flex flex-col justify-center">
        <div className="text-lg md:text-xl leading-relaxed text-zinc-800 flex flex-wrap items-baseline gap-1">
          {fillBlank.beforeText && <span>{fillBlank.beforeText}</span>}
          {fillBlank.slots.map((slot) => {
            const value = answers[slot.id] || '';
            const isCorrect = submitted && slot.correctAnswer && value.trim().toLowerCase() === slot.correctAnswer.trim().toLowerCase();
            const isWrong = submitted && slot.correctAnswer && !isCorrect;
            return (
              <span key={slot.id} className="inline-flex mx-1">
                <input
                  type="text"
                  value={value}
                  onChange={(e) => handleChange(slot.id, e.target.value)}
                  placeholder={slot.placeholder}
                  disabled={disabled || (submitted && fillBlank.submitted)}
                  className={`w-32 border-b-2 bg-transparent px-2 py-1 text-center text-lg font-medium outline-none transition-colors ${
                    isCorrect ? 'border-emerald-500 text-emerald-700' : isWrong ? 'border-rose-500 text-rose-700' : 'border-zinc-300 text-zinc-900 focus:border-zinc-600'
                  }`}
                />
              </span>
            );
          })}
          {fillBlank.afterText && <span>{fillBlank.afterText}</span>}
        </div>
        {!submitted && (
          <div className="mt-8 flex justify-center">
            <SubmitButton onClick={handleSubmit} disabled={disabled || !allFilled} label="Check Answer" />
          </div>
        )}
      </div>
    </CanvasSection>
  );
}

/* ── Code editor ────────────────────────────────────────────────────── */

function CodeBlockMode({
  canvas,
  disabled,
  onSubmit,
}: {
  canvas: TutorCanvasState;
  disabled: boolean;
  onSubmit?: (code: string) => void;
}) {
  const codeBlock = canvas.codeBlock;
  const [code, setCode] = useState(codeBlock?.starterCode || '');
  const [submitted, setSubmitted] = useState(false);

  const handleSubmit = useCallback(() => {
    setSubmitted(true);
    onSubmit?.(code);
  }, [code, onSubmit]);

  if (!codeBlock) return null;

  return (
    <CanvasSection headline={canvas.headline}>
      <p className="text-xl md:text-2xl font-light text-zinc-900 leading-relaxed">{codeBlock.prompt}</p>
      <p className="mt-2 text-xs text-zinc-400 font-mono uppercase tracking-wider">{codeBlock.language}</p>
      <div className="flex-1 flex flex-col mt-4">
        <div className="flex-1 rounded-lg border border-zinc-200 bg-zinc-950 overflow-hidden">
          <textarea
            value={code}
            onChange={(e) => setCode(e.target.value)}
            disabled={disabled || (submitted && codeBlock.submitted)}
            spellCheck={false}
            className="h-full w-full resize-none bg-transparent p-6 font-mono text-sm text-emerald-400 outline-none placeholder-zinc-600"
            placeholder={`Write your ${codeBlock.language} code here...`}
            style={{ tabSize: 4, minHeight: '200px' }}
            onKeyDown={(e) => {
              if (e.key === 'Tab') {
                e.preventDefault();
                const target = e.currentTarget;
                const start = target.selectionStart;
                const end = target.selectionEnd;
                const newValue = code.substring(0, start) + '    ' + code.substring(end);
                setCode(newValue);
                requestAnimationFrame(() => { target.selectionStart = target.selectionEnd = start + 4; });
              }
            }}
          />
        </div>
        <div className="mt-4 flex items-center justify-between">
          {codeBlock.expectedOutput && (
            <p className="text-xs text-zinc-500">
              Expected: <code className="rounded bg-zinc-100 px-2 py-0.5 font-mono text-zinc-700">{codeBlock.expectedOutput}</code>
            </p>
          )}
          <SubmitButton onClick={handleSubmit} disabled={disabled || !code.trim()} label={submitted ? 'Resubmit' : 'Submit Code'} />
        </div>
      </div>
    </CanvasSection>
  );
}

/* ── Multiple choice ────────────────────────────────────────────────── */

function MultipleChoiceMode({
  canvas,
  disabled,
  onSubmit,
}: {
  canvas: TutorCanvasState;
  disabled: boolean;
  onSubmit?: (mode: string, data: unknown) => void;
}) {
  const mc = canvas.multipleChoice;
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [submitted, setSubmitted] = useState(false);

  if (!mc) return null;

  const toggle = (id: string) => {
    if (mc.allowMultiple) {
      setSelectedIds((prev) => prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]);
    } else {
      setSelectedIds([id]);
    }
  };

  const handleSubmit = () => {
    setSubmitted(true);
    onSubmit?.('multiple_choice', { selectedIds });
  };

  return (
    <CanvasSection headline={canvas.headline}>
      <p className="text-xl md:text-2xl font-light text-zinc-900 leading-relaxed mb-8">{mc.prompt}</p>
      <div className="flex-1 flex flex-col justify-center">
        <div className="grid gap-3 max-w-2xl mx-auto w-full">
          {mc.options.map((opt) => {
            const sel = selectedIds.includes(opt.id);
            const correct = submitted && opt.isCorrect;
            const wrong = submitted && sel && !opt.isCorrect;
            return (
              <button
                key={opt.id}
                type="button"
                disabled={disabled || submitted}
                onClick={() => toggle(opt.id)}
                className={`border p-5 text-left transition-colors duration-200 rounded-lg ${
                  correct ? 'border-emerald-500 bg-emerald-50 text-emerald-800' :
                  wrong ? 'border-rose-500 bg-rose-50 text-rose-800' :
                  sel ? 'border-zinc-900 bg-zinc-900 text-white shadow-md' :
                  'border-zinc-200 bg-white text-zinc-900 hover:border-zinc-400'
                } disabled:cursor-not-allowed`}
              >
                <span className="text-base font-medium">{opt.label}</span>
              </button>
            );
          })}
        </div>
        {!submitted && (
          <div className="mt-8 flex justify-center">
            <SubmitButton onClick={handleSubmit} disabled={disabled || selectedIds.length === 0} label="Check Answer" />
          </div>
        )}
      </div>
    </CanvasSection>
  );
}

/* ── Number line ────────────────────────────────────────────────────── */

function NumberLineMode({
  canvas,
  disabled,
  onSubmit,
}: {
  canvas: TutorCanvasState;
  disabled: boolean;
  onSubmit?: (mode: string, data: unknown) => void;
}) {
  const nl = canvas.numberLine;
  const [value, setValue] = useState<number | null>(null);
  const [submitted, setSubmitted] = useState(false);
  const trackRef = useRef<HTMLDivElement>(null);

  if (!nl) return null;

  const range = nl.max - nl.min;
  const ticks: number[] = [];
  for (let v = nl.min; v <= nl.max; v += nl.step) ticks.push(v);

  const pct = (v: number) => ((v - nl.min) / range) * 100;

  const handleClick = (e: React.MouseEvent<HTMLDivElement>) => {
    if (disabled || submitted) return;
    const rect = e.currentTarget.getBoundingClientRect();
    const x = (e.clientX - rect.left) / rect.width;
    const raw = nl.min + x * range;
    const snapped = Math.round(raw / nl.step) * nl.step;
    setValue(Math.max(nl.min, Math.min(nl.max, snapped)));
  };

  const handleSubmit = () => {
    setSubmitted(true);
    onSubmit?.('number_line', { value });
  };

  const isCorrect = submitted && nl.correctValue !== undefined && value === nl.correctValue;
  const isWrong = submitted && nl.correctValue !== undefined && !isCorrect;

  return (
    <CanvasSection headline={canvas.headline}>
      <p className="text-xl md:text-2xl font-light text-zinc-900 leading-relaxed mb-12">{nl.prompt}</p>
      <div className="flex-1 flex flex-col justify-center px-4">
        <div ref={trackRef} className="relative h-16 cursor-pointer" onClick={handleClick}>
          <div className="absolute top-1/2 left-0 right-0 h-1 bg-zinc-300 -translate-y-1/2 rounded" />
          {nl.showTicks && ticks.map((t) => (
            <div key={t} className="absolute top-1/2 -translate-y-1/2" style={{ left: `${pct(t)}%` }}>
              <div className="w-px h-4 bg-zinc-400 -translate-x-1/2" />
              <span className="absolute top-6 left-1/2 -translate-x-1/2 text-xs text-zinc-500 whitespace-nowrap">{t}</span>
            </div>
          ))}
          {value !== null && (
            <div
              className={`absolute top-1/2 -translate-y-1/2 -translate-x-1/2 w-5 h-5 rounded-full border-2 shadow-md transition-all ${
                isCorrect ? 'bg-emerald-500 border-emerald-600' : isWrong ? 'bg-rose-500 border-rose-600' : 'bg-zinc-900 border-zinc-700'
              }`}
              style={{ left: `${pct(value)}%` }}
            />
          )}
          {submitted && nl.correctValue !== undefined && isWrong && (
            <div
              className="absolute top-1/2 -translate-y-1/2 -translate-x-1/2 w-5 h-5 rounded-full bg-emerald-400 border-2 border-emerald-600 opacity-60"
              style={{ left: `${pct(nl.correctValue)}%` }}
            />
          )}
        </div>
        {value !== null && <p className="mt-8 text-center text-lg font-medium text-zinc-900">Selected: {value}</p>}
        {!submitted && (
          <div className="mt-8 flex justify-center">
            <SubmitButton onClick={handleSubmit} disabled={disabled || value === null} />
          </div>
        )}
      </div>
    </CanvasSection>
  );
}

/* ── Table / grid ───────────────────────────────────────────────────── */

function TableGridMode({
  canvas,
  disabled,
  onSubmit,
}: {
  canvas: TutorCanvasState;
  disabled: boolean;
  onSubmit?: (mode: string, data: unknown) => void;
}) {
  const tg = canvas.tableGrid;
  const [cells, setCells] = useState<Record<string, string>>({});
  const [submitted, setSubmitted] = useState(false);

  if (!tg) return null;

  const cellKey = (r: number, c: number) => `${r}_${c}`;
  const getCell = (r: number, c: number) => tg.cells.find((cell) => cell.row === r && cell.col === c);

  const handleSubmit = () => {
    setSubmitted(true);
    onSubmit?.('table_grid', { cells });
  };

  return (
    <CanvasSection headline={canvas.headline}>
      <p className="text-xl md:text-2xl font-light text-zinc-900 leading-relaxed mb-8">{tg.prompt}</p>
      <div className="flex-1 flex flex-col justify-center overflow-x-auto">
        <table className="w-full border-collapse max-w-3xl mx-auto">
          <thead>
            <tr>
              {tg.headers.map((h, i) => (
                <th key={i} className="border border-zinc-200 bg-zinc-50 px-4 py-3 text-xs font-bold uppercase tracking-wider text-zinc-600">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {Array.from({ length: tg.rows }, (_, r) => (
              <tr key={r}>
                {Array.from({ length: tg.cols }, (_, c) => {
                  const cell = getCell(r, c);
                  const editable = cell ? cell.editable : true;
                  const val = cells[cellKey(r, c)] ?? cell?.value ?? '';
                  const correct = submitted && cell?.correctAnswer && val.trim().toLowerCase() === cell.correctAnswer.trim().toLowerCase();
                  const wrong = submitted && cell?.correctAnswer && !correct;
                  return (
                    <td key={c} className={`border border-zinc-200 px-2 py-1 ${correct ? 'bg-emerald-50' : wrong ? 'bg-rose-50' : ''}`}>
                      {editable ? (
                        <input
                          type="text"
                          value={val}
                          onChange={(e) => setCells((prev) => ({ ...prev, [cellKey(r, c)]: e.target.value }))}
                          disabled={disabled || submitted}
                          className="w-full bg-transparent px-2 py-2 text-center text-sm outline-none"
                        />
                      ) : (
                        <span className="block px-2 py-2 text-center text-sm text-zinc-700">{val}</span>
                      )}
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
        {!submitted && (
          <div className="mt-8 flex justify-center">
            <SubmitButton onClick={handleSubmit} disabled={disabled} />
          </div>
        )}
      </div>
    </CanvasSection>
  );
}

/* ── Graph / coordinate plot ────────────────────────────────────────── */

function GraphPlotMode({
  canvas,
  disabled,
  onSubmit,
}: {
  canvas: TutorCanvasState;
  disabled: boolean;
  onSubmit?: (mode: string, data: unknown) => void;
}) {
  const gp = canvas.graphPlot;
  const [userPoints, setUserPoints] = useState<Array<{ x: number; y: number }>>([]);
  const [submitted, setSubmitted] = useState(false);

  if (!gp) return null;

  const width = 400;
  const height = 400;
  const pad = 40;
  const xRange = gp.xMax - gp.xMin;
  const yRange = gp.yMax - gp.yMin;
  const toSvgX = (x: number) => pad + ((x - gp.xMin) / xRange) * (width - 2 * pad);
  const toSvgY = (y: number) => pad + ((gp.yMax - y) / yRange) * (height - 2 * pad);

  const handleClick = (e: React.MouseEvent<SVGSVGElement>) => {
    if (disabled || submitted) return;
    const rect = e.currentTarget.getBoundingClientRect();
    const svgX = (e.clientX - rect.left) * (width / rect.width);
    const svgY = (e.clientY - rect.top) * (height / rect.height);
    const x = Math.round(gp.xMin + ((svgX - pad) / (width - 2 * pad)) * xRange);
    const y = Math.round(gp.yMax - ((svgY - pad) / (height - 2 * pad)) * yRange);
    if (x >= gp.xMin && x <= gp.xMax && y >= gp.yMin && y <= gp.yMax) {
      setUserPoints((prev) => [...prev, { x, y }]);
    }
  };

  const handleSubmit = () => {
    setSubmitted(true);
    onSubmit?.('graph_plot', { userPoints });
  };

  return (
    <CanvasSection headline={canvas.headline}>
      <p className="text-xl md:text-2xl font-light text-zinc-900 leading-relaxed mb-6">{gp.prompt}</p>
      <div className="flex-1 flex flex-col items-center justify-center">
        <svg viewBox={`0 0 ${width} ${height}`} className="w-full max-w-md border border-zinc-200 bg-white rounded" onClick={handleClick}>
          {gp.gridLines && Array.from({ length: Math.floor(xRange) + 1 }, (_, i) => gp.xMin + i).map((x) => (
            <line key={`gx${x}`} x1={toSvgX(x)} y1={pad} x2={toSvgX(x)} y2={height - pad} stroke="#e5e7eb" strokeWidth={x === 0 ? 1.5 : 0.5} />
          ))}
          {gp.gridLines && Array.from({ length: Math.floor(yRange) + 1 }, (_, i) => gp.yMin + i).map((y) => (
            <line key={`gy${y}`} x1={pad} y1={toSvgY(y)} x2={width - pad} y2={toSvgY(y)} stroke="#e5e7eb" strokeWidth={y === 0 ? 1.5 : 0.5} />
          ))}
          <line x1={toSvgX(gp.xMin)} y1={toSvgY(0)} x2={toSvgX(gp.xMax)} y2={toSvgY(0)} stroke="#71717a" strokeWidth={1.5} />
          <line x1={toSvgX(0)} y1={toSvgY(gp.yMin)} x2={toSvgX(0)} y2={toSvgY(gp.yMax)} stroke="#71717a" strokeWidth={1.5} />
          <text x={width - pad + 5} y={toSvgY(0) + 4} className="text-[10px] fill-zinc-500">{gp.xLabel}</text>
          <text x={toSvgX(0) + 5} y={pad - 5} className="text-[10px] fill-zinc-500">{gp.yLabel}</text>
          {gp.presetPoints.map((pt) => (
            <circle key={pt.id} cx={toSvgX(pt.x)} cy={toSvgY(pt.y)} r={5} fill="#2563eb" />
          ))}
          {userPoints.map((pt, i) => (
            <circle key={i} cx={toSvgX(pt.x)} cy={toSvgY(pt.y)} r={5} fill="#0f172a" stroke="#fff" strokeWidth={1.5} />
          ))}
          {submitted && gp.expectedPoints?.map((pt, i) => (
            <circle key={`exp${i}`} cx={toSvgX(pt.x)} cy={toSvgY(pt.y)} r={7} fill="none" stroke="#10b981" strokeWidth={2} strokeDasharray="3,3" />
          ))}
        </svg>
        <p className="mt-3 text-xs text-zinc-500">Click on the graph to place points. {userPoints.length} placed.</p>
        {!submitted && (
          <div className="mt-6 flex gap-3">
            {userPoints.length > 0 && (
              <button type="button" onClick={() => setUserPoints((p) => p.slice(0, -1))} className="rounded-lg border border-zinc-300 px-4 py-2 text-sm text-zinc-600 hover:bg-zinc-50">
                Undo
              </button>
            )}
            <SubmitButton onClick={handleSubmit} disabled={disabled || userPoints.length === 0} />
          </div>
        )}
      </div>
    </CanvasSection>
  );
}

/* ── Matching pairs ─────────────────────────────────────────────────── */

function MatchingPairsMode({
  canvas,
  disabled,
  onSubmit,
}: {
  canvas: TutorCanvasState;
  disabled: boolean;
  onSubmit?: (mode: string, data: unknown) => void;
}) {
  const mp = canvas.matchingPairs;
  const [selectedLeft, setSelectedLeft] = useState<string | null>(null);
  const [pairs, setPairs] = useState<Array<{ leftId: string; rightId: string }>>([]);
  const [submitted, setSubmitted] = useState(false);

  if (!mp) return null;

  const pairedLeftIds = new Set(pairs.map((p) => p.leftId));
  const pairedRightIds = new Set(pairs.map((p) => p.rightId));

  const handleLeftClick = (id: string) => {
    if (disabled || submitted || pairedLeftIds.has(id)) return;
    setSelectedLeft(id);
  };

  const handleRightClick = (id: string) => {
    if (disabled || submitted || pairedRightIds.has(id) || !selectedLeft) return;
    setPairs((prev) => [...prev, { leftId: selectedLeft, rightId: id }]);
    setSelectedLeft(null);
  };

  const handleSubmit = () => {
    setSubmitted(true);
    onSubmit?.('matching_pairs', { pairs });
  };

  const pairColors = ['#2563eb', '#0f766e', '#c2410c', '#7c3aed', '#be123c', '#ca8a04'];

  return (
    <CanvasSection headline={canvas.headline}>
      <p className="text-xl md:text-2xl font-light text-zinc-900 leading-relaxed mb-8">{mp.prompt}</p>
      <div className="flex-1 flex justify-center gap-12">
        <div className="flex flex-col gap-3">
          {mp.leftItems.map((item) => {
            const pairIndex = pairs.findIndex((p) => p.leftId === item.id);
            const isPaired = pairIndex >= 0;
            const isSelected = selectedLeft === item.id;
            return (
              <button
                key={item.id}
                type="button"
                disabled={disabled || submitted || isPaired}
                onClick={() => handleLeftClick(item.id)}
                className={`border rounded-lg px-6 py-4 text-left text-sm font-medium transition-colors ${
                  isSelected ? 'border-zinc-900 bg-zinc-900 text-white' :
                  isPaired ? 'border-zinc-300 bg-zinc-50 text-zinc-500' :
                  'border-zinc-200 bg-white text-zinc-900 hover:border-zinc-400'
                }`}
                style={isPaired ? { borderLeftColor: pairColors[pairIndex % pairColors.length], borderLeftWidth: 4 } : undefined}
              >
                {item.label}
              </button>
            );
          })}
        </div>
        <div className="flex flex-col gap-3">
          {mp.rightItems.map((item) => {
            const pairIndex = pairs.findIndex((p) => p.rightId === item.id);
            const isPaired = pairIndex >= 0;
            return (
              <button
                key={item.id}
                type="button"
                disabled={disabled || submitted || isPaired || !selectedLeft}
                onClick={() => handleRightClick(item.id)}
                className={`border rounded-lg px-6 py-4 text-left text-sm font-medium transition-colors ${
                  isPaired ? 'border-zinc-300 bg-zinc-50 text-zinc-500' :
                  selectedLeft ? 'border-zinc-200 bg-white text-zinc-900 hover:border-zinc-400 hover:bg-zinc-50' :
                  'border-zinc-100 bg-zinc-50 text-zinc-400 cursor-not-allowed'
                }`}
                style={isPaired ? { borderRightColor: pairColors[pairIndex % pairColors.length], borderRightWidth: 4 } : undefined}
              >
                {item.label}
              </button>
            );
          })}
        </div>
      </div>
      {!submitted && (
        <div className="mt-8 flex justify-center">
          <SubmitButton onClick={handleSubmit} disabled={disabled || pairs.length === 0} label="Check Matches" />
        </div>
      )}
    </CanvasSection>
  );
}

/* ── Ordering / sorting ─────────────────────────────────────────────── */

function OrderingMode({
  canvas,
  disabled,
  onSubmit,
}: {
  canvas: TutorCanvasState;
  disabled: boolean;
  onSubmit?: (mode: string, data: unknown) => void;
}) {
  const ord = canvas.ordering;
  const [order, setOrder] = useState<string[]>(ord?.items.map((i) => i.id) || []);
  const [dragIndex, setDragIndex] = useState<number | null>(null);
  const [submitted, setSubmitted] = useState(false);

  if (!ord) return null;

  const handleDragStart = (idx: number) => setDragIndex(idx);
  const handleDragOver = (e: React.DragEvent, idx: number) => {
    e.preventDefault();
    if (dragIndex === null || dragIndex === idx) return;
    const newOrder = [...order];
    const [item] = newOrder.splice(dragIndex, 1);
    newOrder.splice(idx, 0, item);
    setOrder(newOrder);
    setDragIndex(idx);
  };

  const handleSubmit = () => {
    setSubmitted(true);
    onSubmit?.('ordering', { order });
  };

  return (
    <CanvasSection headline={canvas.headline}>
      <p className="text-xl md:text-2xl font-light text-zinc-900 leading-relaxed mb-8">{ord.prompt}</p>
      <div className="flex-1 flex flex-col justify-center max-w-lg mx-auto w-full">
        {order.map((id, idx) => {
          const item = ord.items.find((i) => i.id === id);
          if (!item) return null;
          const isCorrectPos = submitted && item.correctPosition !== undefined && item.correctPosition === idx;
          const isWrongPos = submitted && item.correctPosition !== undefined && !isCorrectPos;
          return (
            <div
              key={id}
              draggable={!disabled && !submitted}
              onDragStart={() => handleDragStart(idx)}
              onDragOver={(e) => handleDragOver(e, idx)}
              className={`mb-2 flex items-center gap-3 border rounded-lg px-5 py-4 cursor-grab active:cursor-grabbing transition-colors ${
                isCorrectPos ? 'border-emerald-400 bg-emerald-50' :
                isWrongPos ? 'border-rose-400 bg-rose-50' :
                'border-zinc-200 bg-white hover:border-zinc-300'
              }`}
            >
              <span className="text-xs font-bold text-zinc-400 w-6">{idx + 1}.</span>
              <span className="text-sm font-medium text-zinc-900">{item.label}</span>
              {!submitted && <span className="ml-auto text-zinc-300">⋮⋮</span>}
            </div>
          );
        })}
        {!submitted && (
          <div className="mt-6 flex justify-center">
            <SubmitButton onClick={handleSubmit} disabled={disabled} label="Check Order" />
          </div>
        )}
      </div>
    </CanvasSection>
  );
}

/* ── Text response ──────────────────────────────────────────────────── */

function TextResponseMode({
  canvas,
  disabled,
  onSubmit,
}: {
  canvas: TutorCanvasState;
  disabled: boolean;
  onSubmit?: (mode: string, data: unknown) => void;
}) {
  const tr = canvas.textResponse;
  const [text, setText] = useState('');
  const [submitted, setSubmitted] = useState(false);

  if (!tr) return null;

  const handleSubmit = () => {
    setSubmitted(true);
    onSubmit?.('text_response', { text });
  };

  return (
    <CanvasSection headline={canvas.headline}>
      <p className="text-xl md:text-2xl font-light text-zinc-900 leading-relaxed mb-8">{tr.prompt}</p>
      <div className="flex-1 flex flex-col justify-center max-w-2xl mx-auto w-full">
        <textarea
          value={text}
          onChange={(e) => setText(e.target.value)}
          disabled={disabled || submitted}
          placeholder={tr.placeholder}
          maxLength={tr.maxLength}
          className="w-full min-h-[150px] rounded-lg border border-zinc-200 bg-white p-6 text-base text-zinc-900 outline-none focus:border-zinc-400 resize-y"
        />
        {tr.maxLength && (
          <p className="mt-2 text-xs text-zinc-400 text-right">{text.length}/{tr.maxLength}</p>
        )}
        {!submitted && (
          <div className="mt-6 flex justify-center">
            <SubmitButton onClick={handleSubmit} disabled={disabled || !text.trim()} />
          </div>
        )}
      </div>
    </CanvasSection>
  );
}

/* ── Drawing canvas ─────────────────────────────────────────────────── */

function DrawingMode({
  canvas,
  disabled,
  onSubmit,
}: {
  canvas: TutorCanvasState;
  disabled: boolean;
  onSubmit?: (mode: string, data: unknown) => void;
}) {
  const dw = canvas.drawing;
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const drawingRef = useRef(false);
  const [submitted, setSubmitted] = useState(false);

  useEffect(() => {
    const c = canvasRef.current;
    if (!c || !dw) return;
    const ctx = c.getContext('2d');
    if (!ctx) return;
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, c.width, c.height);
    if (dw.backgroundImageUrl) {
      const img = new Image();
      img.crossOrigin = 'anonymous';
      img.onload = () => ctx.drawImage(img, 0, 0, c.width, c.height);
      img.src = dw.backgroundImageUrl;
    }
  }, [dw]);

  if (!dw) return null;

  const getPos = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    return {
      x: (e.clientX - rect.left) * (dw.canvasWidth / rect.width),
      y: (e.clientY - rect.top) * (dw.canvasHeight / rect.height),
    };
  };

  const startDraw = (e: React.MouseEvent<HTMLCanvasElement>) => {
    if (disabled || submitted) return;
    drawingRef.current = true;
    const ctx = canvasRef.current?.getContext('2d');
    if (!ctx) return;
    const pos = getPos(e);
    ctx.beginPath();
    ctx.moveTo(pos.x, pos.y);
    ctx.strokeStyle = dw.brushColor;
    ctx.lineWidth = dw.brushSize;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
  };

  const draw = (e: React.MouseEvent<HTMLCanvasElement>) => {
    if (!drawingRef.current) return;
    const ctx = canvasRef.current?.getContext('2d');
    if (!ctx) return;
    const pos = getPos(e);
    ctx.lineTo(pos.x, pos.y);
    ctx.stroke();
  };

  const endDraw = () => { drawingRef.current = false; };

  const clearCanvas = () => {
    const c = canvasRef.current;
    if (!c) return;
    const ctx = c.getContext('2d');
    if (!ctx) return;
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, c.width, c.height);
  };

  const handleSubmit = () => {
    setSubmitted(true);
    const dataUrl = canvasRef.current?.toDataURL('image/png');
    onSubmit?.('drawing', { dataUrl });
  };

  return (
    <CanvasSection headline={canvas.headline}>
      <p className="text-xl md:text-2xl font-light text-zinc-900 leading-relaxed mb-6">{dw.prompt}</p>
      <div className="flex-1 flex flex-col items-center justify-center">
        <canvas
          ref={canvasRef}
          width={dw.canvasWidth}
          height={dw.canvasHeight}
          onMouseDown={startDraw}
          onMouseMove={draw}
          onMouseUp={endDraw}
          onMouseLeave={endDraw}
          className="border border-zinc-200 rounded-lg cursor-crosshair max-w-full"
          style={{ maxHeight: '400px', aspectRatio: `${dw.canvasWidth}/${dw.canvasHeight}` }}
        />
        {!submitted && (
          <div className="mt-6 flex gap-3">
            <button type="button" onClick={clearCanvas} disabled={disabled} className="rounded-lg border border-zinc-300 px-4 py-2 text-sm text-zinc-600 hover:bg-zinc-50">
              Clear
            </button>
            <SubmitButton onClick={handleSubmit} disabled={disabled} label="Submit Drawing" />
          </div>
        )}
      </div>
    </CanvasSection>
  );
}

/* ── Main host ──────────────────────────────────────────────────────── */

export function TutorCanvasHost({
  canvas,
  disabled = false,
  onMoveToken,
  onChooseEquationAnswer,
  onFillBlankSubmit,
  onCodeSubmit,
  onCanvasSubmit,
}: TutorCanvasHostProps) {
  if (canvas.mode === 'fill_blank' && canvas.fillBlank) {
    return <FillBlankMode canvas={canvas} disabled={disabled} onSubmit={onFillBlankSubmit} />;
  }

  if (canvas.mode === 'code_block' && canvas.codeBlock) {
    return <CodeBlockMode canvas={canvas} disabled={disabled} onSubmit={onCodeSubmit} />;
  }

  if (canvas.mode === 'multiple_choice' && canvas.multipleChoice) {
    return <MultipleChoiceMode canvas={canvas} disabled={disabled} onSubmit={onCanvasSubmit} />;
  }

  if (canvas.mode === 'number_line' && canvas.numberLine) {
    return <NumberLineMode canvas={canvas} disabled={disabled} onSubmit={onCanvasSubmit} />;
  }

  if (canvas.mode === 'table_grid' && canvas.tableGrid) {
    return <TableGridMode canvas={canvas} disabled={disabled} onSubmit={onCanvasSubmit} />;
  }

  if (canvas.mode === 'graph_plot' && canvas.graphPlot) {
    return <GraphPlotMode canvas={canvas} disabled={disabled} onSubmit={onCanvasSubmit} />;
  }

  if (canvas.mode === 'matching_pairs' && canvas.matchingPairs) {
    return <MatchingPairsMode canvas={canvas} disabled={disabled} onSubmit={onCanvasSubmit} />;
  }

  if (canvas.mode === 'ordering' && canvas.ordering) {
    return <OrderingMode canvas={canvas} disabled={disabled} onSubmit={onCanvasSubmit} />;
  }

  if (canvas.mode === 'text_response' && canvas.textResponse) {
    return <TextResponseMode canvas={canvas} disabled={disabled} onSubmit={onCanvasSubmit} />;
  }

  if (canvas.mode === 'drawing' && canvas.drawing) {
    return <DrawingMode canvas={canvas} disabled={disabled} onSubmit={onCanvasSubmit} />;
  }

  if (canvas.mode === 'equation' && canvas.equation) {
    return (
      <section className="flex min-h-[60dvh] flex-col border border-zinc-200 bg-white p-8 md:p-14 shadow-lg animate-in fade-in duration-700">
        <div className="mb-12">
          <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-zinc-400">{canvas.headline}</p>
          <p className="mt-4 text-2xl md:text-3xl font-light text-zinc-900 leading-relaxed">{canvas.equation.prompt}</p>
        </div>
        <div className="flex flex-1 flex-col justify-center items-center">
          <p className="text-5xl md:text-7xl font-light tracking-tight text-zinc-900 mb-16">{canvas.equation.expression}</p>
          <div className="mt-8 grid w-full max-w-2xl gap-4 md:grid-cols-2">
            {canvas.equation.choices.map((choice) => {
              const selected = choice.id === canvas.equation?.selectedChoiceId;
              return (
                <button
                  key={choice.id}
                  type="button"
                  disabled={disabled}
                  onClick={() => onChooseEquationAnswer(choice.id)}
                  className={`border p-6 text-left transition-colors duration-200 ${
                    selected ? 'border-zinc-900 bg-zinc-900 text-white shadow-md' : 'border-zinc-200 bg-white text-zinc-900 hover:border-zinc-400 hover:shadow-sm'
                  } disabled:cursor-not-allowed disabled:opacity-50`}
                >
                  <span className="text-lg font-medium tracking-wide">{choice.label}</span>
                </button>
              );
            })}
          </div>
        </div>
      </section>
    );
  }

  /* Distribution (default) mode */
  const looseTokens = canvas.tokens.filter((token) => !token.zoneId);

  return (
    <section className="flex min-h-[60dvh] w-full flex-col p-8 md:p-14 bg-white border border-zinc-200 shadow-lg animate-in fade-in duration-700">
      <div className="mb-10 flex items-start justify-between gap-6">
        <div>
          <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-zinc-400">{canvas.headline}</p>
          <p className="mt-4 max-w-2xl text-2xl md:text-3xl font-light text-zinc-900 leading-relaxed">{canvas.instruction}</p>
        </div>
      </div>
      <div className="grid flex-1 gap-6 lg:grid-cols-[minmax(0,0.78fr)_minmax(0,1.22fr)]">
        <ZoneCard label="Bench" hint="Drag items to the zones." onDropToken={(tokenId) => onMoveToken(tokenId, null)}>
          {looseTokens.map((token) => (
            <TutorToken key={token.id} token={token} disabled={disabled} />
          ))}
        </ZoneCard>
        <div className="grid gap-6 md:grid-cols-2">
          {canvas.zones.map((zone) => (
            <ZoneCard key={zone.id} label={zone.label} hint={zone.hint} accent={zone.accent} onDropToken={(tokenId) => onMoveToken(tokenId, zone.id)}>
              {canvas.tokens.filter((token) => token.zoneId === zone.id).map((token) => (
                <TutorToken key={token.id} token={token} disabled={disabled} />
              ))}
            </ZoneCard>
          ))}
        </div>
      </div>
    </section>
  );
}
