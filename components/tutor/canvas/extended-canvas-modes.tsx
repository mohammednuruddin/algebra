'use client';

import { useMemo, useState } from 'react';
import Image from 'next/image';

import { resolveLessonImageUrl } from '@/lib/media/media-url';
import type { TutorCanvasState, TutorVennRegion } from '@/lib/types/tutor';

function CanvasSection({ children }: { children: React.ReactNode }) {
  return (
    <section className="flex min-h-[40dvh] flex-col border border-zinc-200 bg-white p-8 shadow-lg">
      {children}
    </section>
  );
}

function SubmitButton({
  onClick,
  disabled,
  label,
}: {
  onClick: () => void;
  disabled: boolean;
  label: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className="rounded-lg bg-zinc-900 px-6 py-3 text-sm font-medium text-white disabled:opacity-40"
    >
      {label}
    </button>
  );
}

export function ImageHotspotMode({
  canvas,
  disabled,
  onSubmit,
}: {
  canvas: NonNullable<TutorCanvasState['imageHotspot']>;
  disabled: boolean;
  onSubmit?: (mode: string, data: unknown) => void;
}) {
  const [selected, setSelected] = useState<string[]>(canvas.selectedHotspotIds);
  const resolvedImageUrl = resolveLessonImageUrl(canvas.backgroundImageUrl);
  const toggle = (id: string) =>
    setSelected((prev) =>
      canvas.allowMultiple ? (prev.includes(id) ? prev.filter((value) => value !== id) : [...prev, id]) : [id]
    );

  return (
    <CanvasSection>
      <p className="mb-6 text-xl font-light text-zinc-900">{canvas.prompt}</p>
      <div className="relative mx-auto w-full max-w-4xl overflow-hidden rounded-2xl border border-zinc-200 bg-zinc-50">
        {resolvedImageUrl ? (
          <Image
            src={resolvedImageUrl}
            alt={canvas.prompt}
            width={1200}
            height={800}
            unoptimized
            className="block h-auto w-full"
          />
        ) : (
          <div className="aspect-[16/10] w-full bg-zinc-100" />
        )}
        {canvas.hotspots.map((hotspot) => {
          const size = Math.max(20, hotspot.radius * 2);
          const isSelected = selected.includes(hotspot.id);
          return (
            <button
              key={hotspot.id}
              type="button"
              disabled={disabled}
              aria-label={hotspot.label}
              aria-pressed={isSelected}
              onClick={() => toggle(hotspot.id)}
              className={`absolute -translate-x-1/2 -translate-y-1/2 rounded-full border-2 shadow-md transition focus:outline-none focus:ring-2 focus:ring-zinc-900/40 ${
                isSelected
                  ? 'border-zinc-950 bg-zinc-900/70'
                  : 'border-white bg-white/30 hover:bg-white/45'
              }`}
              style={{
                left: `${hotspot.x}%`,
                top: `${hotspot.y}%`,
                width: `${size}px`,
                height: `${size}px`,
              }}
            >
              <span className="sr-only">{hotspot.label}</span>
            </button>
          );
        })}
      </div>
      <p className="mt-4 text-sm text-zinc-500">
        Tap the image directly. Selected: {selected.length}
      </p>
      <div className="mt-6 flex justify-center">
        <SubmitButton
          onClick={() => onSubmit?.('image_hotspot', { selectedHotspotIds: selected })}
          disabled={disabled || selected.length === 0}
          label="Submit Hotspot"
        />
      </div>
    </CanvasSection>
  );
}

export function TimelineMode({
  canvas,
  disabled,
  onSubmit,
}: {
  canvas: NonNullable<TutorCanvasState['timeline']>;
  disabled: boolean;
  onSubmit?: (mode: string, data: unknown) => void;
}) {
  const [order, setOrder] = useState<string[]>(canvas.userOrder);
  const move = (index: number, direction: -1 | 1) => {
    const nextIndex = index + direction;
    if (nextIndex < 0 || nextIndex >= order.length) return;
    setOrder((prev) => {
      const next = [...prev];
      const [item] = next.splice(index, 1);
      next.splice(nextIndex, 0, item);
      return next;
    });
  };

  return (
    <CanvasSection>
      <p className="mb-6 text-xl font-light text-zinc-900">{canvas.prompt}</p>
      <div className="space-y-3">
        {order.map((id, index) => {
          const item = canvas.items.find((value) => value.id === id);
          if (!item) return null;
          return (
            <div key={id} className="flex items-center gap-3 rounded-lg border border-zinc-200 px-4 py-3">
              <span className="text-xs font-semibold text-zinc-500">{index + 1}</span>
              <span className="flex-1 text-sm text-zinc-900">{item.label}</span>
              <button type="button" disabled={disabled || index === 0} onClick={() => move(index, -1)} className="text-xs text-zinc-600">
                Up
              </button>
              <button type="button" disabled={disabled || index === order.length - 1} onClick={() => move(index, 1)} className="text-xs text-zinc-600">
                Down
              </button>
            </div>
          );
        })}
      </div>
      <div className="mt-6 flex justify-center">
        <SubmitButton
          onClick={() => onSubmit?.('timeline', { userOrder: order })}
          disabled={disabled}
          label="Check Timeline"
        />
      </div>
    </CanvasSection>
  );
}

export function ContinuousAxisMode({
  canvas,
  disabled,
  onSubmit,
}: {
  canvas: NonNullable<TutorCanvasState['continuousAxis']>;
  disabled: boolean;
  onSubmit?: (mode: string, data: unknown) => void;
}) {
  const [value, setValue] = useState<number | null>(canvas.userValue);

  return (
    <CanvasSection>
      <p className="mb-6 text-xl font-light text-zinc-900">{canvas.prompt}</p>
      <input
        type="range"
        min={canvas.min}
        max={canvas.max}
        step={canvas.step}
        value={value ?? canvas.min}
        disabled={disabled}
        onChange={(event) => setValue(Number(event.target.value))}
      />
      <p className="mt-4 text-sm text-zinc-600">
        {canvas.leftLabel || String(canvas.min)} to {canvas.rightLabel || String(canvas.max)} | Selected: {value ?? canvas.min}
      </p>
      <div className="mt-6 flex justify-center">
        <SubmitButton
          onClick={() => onSubmit?.('continuous_axis', { value })}
          disabled={disabled || value === null}
          label="Check Axis"
        />
      </div>
    </CanvasSection>
  );
}

export function VennDiagramMode({
  canvas,
  disabled,
  onSubmit,
}: {
  canvas: NonNullable<TutorCanvasState['vennDiagram']>;
  disabled: boolean;
  onSubmit?: (mode: string, data: unknown) => void;
}) {
  const [placements, setPlacements] = useState<Record<string, TutorVennRegion | null>>(canvas.placements);
  const cycle = (id: string) => {
    const next: Array<TutorVennRegion | null> = [null, 'left', 'overlap', 'right'];
    const current = placements[id] ?? null;
    const nextIndex = (next.indexOf(current) + 1) % next.length;
    setPlacements((prev) => ({ ...prev, [id]: next[nextIndex] }));
  };

  return (
    <CanvasSection>
      <p className="mb-6 text-xl font-light text-zinc-900">{canvas.prompt}</p>
      <div className="grid gap-3 md:grid-cols-2">
        {canvas.items.map((item) => (
          <button key={item.id} type="button" disabled={disabled} onClick={() => cycle(item.id)} className="rounded-lg border border-zinc-200 px-4 py-3 text-left">
            <span className="block text-sm text-zinc-900">{item.label}</span>
            <span className="mt-1 block text-xs text-zinc-500">
              {placements[item.id] === 'left'
                ? canvas.leftLabel
                : placements[item.id] === 'overlap'
                  ? 'Overlap'
                  : placements[item.id] === 'right'
                    ? canvas.rightLabel
                    : 'Unplaced'}
            </span>
          </button>
        ))}
      </div>
      <div className="mt-6 flex justify-center">
        <SubmitButton onClick={() => onSubmit?.('venn_diagram', { placements })} disabled={disabled} label="Check Regions" />
      </div>
    </CanvasSection>
  );
}

export function TokenBuilderMode({
  canvas,
  disabled,
  onSubmit,
}: {
  canvas: NonNullable<TutorCanvasState['tokenBuilder']>;
  disabled: boolean;
  onSubmit?: (mode: string, data: unknown) => void;
}) {
  const [userTokenIds, setUserTokenIds] = useState<string[]>(canvas.userTokenIds);
  const placed = useMemo(() => new Set(userTokenIds), [userTokenIds]);

  return (
    <CanvasSection>
      <p className="mb-6 text-xl font-light text-zinc-900">{canvas.prompt}</p>
      <div className="mb-4 flex flex-wrap gap-2">
        {canvas.tokens.map((token) => (
          <button
            key={token.id}
            type="button"
            disabled={disabled || placed.has(token.id) || userTokenIds.length >= canvas.slots}
            onClick={() => setUserTokenIds((prev) => [...prev, token.id])}
            className="rounded border px-3 py-2 text-sm"
            style={{ borderColor: token.color || '#27272a' }}
          >
            {token.label}
          </button>
        ))}
      </div>
      <div className="mb-6 flex min-h-16 flex-wrap gap-2 rounded-lg border border-dashed border-zinc-300 p-4">
        {userTokenIds.map((id) => {
          const token = canvas.tokens.find((value) => value.id === id);
          if (!token) return null;
          return (
            <button key={id} type="button" disabled={disabled} onClick={() => setUserTokenIds((prev) => prev.filter((value) => value !== id))} className="rounded bg-zinc-900 px-3 py-2 text-sm text-white">
              {token.label}
            </button>
          );
        })}
      </div>
      <div className="flex justify-center">
        <SubmitButton onClick={() => onSubmit?.('token_builder', { userTokenIds })} disabled={disabled || userTokenIds.length === 0} label="Build Expression" />
      </div>
    </CanvasSection>
  );
}

export function ProcessFlowMode({
  canvas,
  disabled,
  onSubmit,
}: {
  canvas: NonNullable<TutorCanvasState['processFlow']>;
  disabled: boolean;
  onSubmit?: (mode: string, data: unknown) => void;
}) {
  return (
    <TimelineMode
      canvas={{ prompt: canvas.prompt, items: canvas.nodes, userOrder: canvas.userOrder, submitted: canvas.submitted }}
      disabled={disabled}
      onSubmit={(mode, data) => onSubmit?.('process_flow', mode === 'timeline' ? data : data)}
    />
  );
}

export function PartWholeBuilderMode({
  canvas,
  tokens,
  disabled,
  onSubmit,
}: {
  canvas: NonNullable<TutorCanvasState['partWholeBuilder']>;
  tokens?: TutorCanvasState['tokens'];
  disabled: boolean;
  onSubmit?: (mode: string, data: unknown) => void;
}) {
  const [filledParts, setFilledParts] = useState<number>(canvas.filledParts);

  return (
    <CanvasSection>
      <p className="mb-6 text-xl font-light text-zinc-900">{canvas.prompt}</p>
      {tokens?.length ? (
        <div className="mb-5 flex flex-wrap gap-2" aria-label="available tokens">
          {tokens.map((token) => (
            <span
              key={token.id}
              className="rounded-sm px-3 py-1.5 text-xs font-semibold uppercase tracking-wider text-white shadow-sm"
              style={{ backgroundColor: token.color }}
            >
              {token.label || 'Token'}
            </span>
          ))}
        </div>
      ) : null}
      <div className="flex gap-2">
        {Array.from({ length: canvas.totalParts }, (_, index) => (
          <button
            key={index}
            type="button"
            disabled={disabled}
            onClick={() => setFilledParts(index + 1)}
            className={`h-12 flex-1 rounded ${index < filledParts ? 'bg-zinc-900' : 'bg-zinc-200'}`}
            aria-label={`part ${index + 1}`}
          />
        ))}
      </div>
      <p className="mt-4 text-sm text-zinc-600">
        {filledParts}/{canvas.totalParts}{canvas.label ? ` ${canvas.label}` : ''}
      </p>
      <div className="mt-6 flex justify-center">
        <SubmitButton onClick={() => onSubmit?.('part_whole_builder', { filledParts })} disabled={disabled} label="Check Share" />
      </div>
    </CanvasSection>
  );
}

export function MapCanvasMode({
  canvas,
  disabled,
  onSubmit,
}: {
  canvas: NonNullable<TutorCanvasState['mapCanvas']>;
  disabled: boolean;
  onSubmit?: (mode: string, data: unknown) => void;
}) {
  const [selected, setSelected] = useState<string[]>(canvas.selectedPinIds);
  const toggle = (id: string) =>
    setSelected((prev) =>
      canvas.allowMultiple ? (prev.includes(id) ? prev.filter((value) => value !== id) : [...prev, id]) : [id]
    );

  return (
    <CanvasSection>
      <p className="mb-6 text-xl font-light text-zinc-900">{canvas.prompt}</p>
      <div className="grid gap-3 md:grid-cols-2">
        {canvas.pins.map((pin) => (
          <button key={pin.id} type="button" disabled={disabled} onClick={() => toggle(pin.id)} className={`rounded-lg border px-4 py-3 text-left ${selected.includes(pin.id) ? 'border-zinc-900 bg-zinc-900 text-white' : 'border-zinc-200 bg-white text-zinc-900'}`}>
            {pin.label}
          </button>
        ))}
      </div>
      <div className="mt-6 flex justify-center">
        <SubmitButton onClick={() => onSubmit?.('map_canvas', { selectedPinIds: selected })} disabled={disabled || selected.length === 0} label="Submit Map" />
      </div>
    </CanvasSection>
  );
}

export function ClaimEvidenceBuilderMode({
  canvas,
  disabled,
  onSubmit,
}: {
  canvas: NonNullable<TutorCanvasState['claimEvidenceBuilder']>;
  disabled: boolean;
  onSubmit?: (mode: string, data: unknown) => void;
}) {
  const [selectedClaimId, setSelectedClaimId] = useState<string | null>(canvas.selectedClaimId);
  const [linkedEvidenceIds, setLinkedEvidenceIds] = useState<string[]>(canvas.linkedEvidenceIds);
  const toggleEvidence = (id: string) =>
    setLinkedEvidenceIds((prev) => (prev.includes(id) ? prev.filter((value) => value !== id) : [...prev, id]));

  return (
    <CanvasSection>
      <p className="mb-6 text-xl font-light text-zinc-900">{canvas.prompt}</p>
      <div className="grid gap-6 md:grid-cols-2">
        <div className="space-y-3">
          {canvas.claims.map((claim) => (
            <button key={claim.id} type="button" disabled={disabled} onClick={() => setSelectedClaimId(claim.id)} className={`w-full rounded-lg border px-4 py-3 text-left ${selectedClaimId === claim.id ? 'border-zinc-900 bg-zinc-900 text-white' : 'border-zinc-200 bg-white text-zinc-900'}`}>
              {claim.label}
            </button>
          ))}
        </div>
        <div className="space-y-3">
          {canvas.evidenceItems.map((item) => (
            <button key={item.id} type="button" disabled={disabled} onClick={() => toggleEvidence(item.id)} className={`w-full rounded-lg border px-4 py-3 text-left ${linkedEvidenceIds.includes(item.id) ? 'border-zinc-900 bg-zinc-900 text-white' : 'border-zinc-200 bg-white text-zinc-900'}`}>
              {item.label}
            </button>
          ))}
        </div>
      </div>
      <div className="mt-6 flex justify-center">
        <SubmitButton onClick={() => onSubmit?.('claim_evidence_builder', { selectedClaimId, linkedEvidenceIds })} disabled={disabled || !selectedClaimId} label="Check Evidence" />
      </div>
    </CanvasSection>
  );
}

export function CompareMatrixMode({
  canvas,
  disabled,
  onSubmit,
}: {
  canvas: NonNullable<TutorCanvasState['compareMatrix']>;
  disabled: boolean;
  onSubmit?: (mode: string, data: unknown) => void;
}) {
  const [selectedCells, setSelectedCells] = useState<string[]>(canvas.selectedCells);
  const toggle = (cellId: string) =>
    setSelectedCells((prev) => (prev.includes(cellId) ? prev.filter((value) => value !== cellId) : [...prev, cellId]));

  return (
    <CanvasSection>
      <p className="mb-6 text-xl font-light text-zinc-900">{canvas.prompt}</p>
      <div className="overflow-x-auto">
        <table className="w-full border-collapse">
          <thead>
            <tr>
              <th className="border border-zinc-200 bg-zinc-50 px-3 py-2" />
              {canvas.columns.map((column) => (
                <th key={column.id} className="border border-zinc-200 bg-zinc-50 px-3 py-2 text-xs uppercase tracking-wide text-zinc-500">{column.label}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {canvas.rows.map((row) => (
              <tr key={row.id}>
                <td className="border border-zinc-200 px-3 py-2 text-sm text-zinc-900">{row.label}</td>
                {canvas.columns.map((column) => {
                  const cellId = `${row.id}:${column.id}`;
                  return (
                    <td key={cellId} className="border border-zinc-200 px-3 py-2 text-center">
                      <input type="checkbox" checked={selectedCells.includes(cellId)} disabled={disabled} onChange={() => toggle(cellId)} />
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div className="mt-6 flex justify-center">
        <SubmitButton onClick={() => onSubmit?.('compare_matrix', { selectedCells })} disabled={disabled} label="Check Matrix" />
      </div>
    </CanvasSection>
  );
}

export function FlashcardMode({
  canvas,
  disabled,
  onSubmit,
}: {
  canvas: NonNullable<TutorCanvasState['flashcard']>;
  disabled: boolean;
  onSubmit?: (mode: string, data: unknown) => void;
}) {
  const [revealed, setRevealed] = useState(canvas.revealed);

  return (
    <CanvasSection>
      <p className="mb-6 text-xl font-light text-zinc-900">{canvas.prompt}</p>
      <div className="rounded-2xl border border-zinc-200 p-8 text-center">
        <p className="text-lg text-zinc-900">{revealed ? canvas.back : canvas.front}</p>
      </div>
      <div className="mt-6 flex justify-center gap-3">
        <button type="button" disabled={disabled} onClick={() => setRevealed((value) => !value)} className="rounded-lg border border-zinc-300 px-4 py-3 text-sm text-zinc-700">
          {revealed ? 'Show front' : 'Flip card'}
        </button>
        <SubmitButton onClick={() => onSubmit?.('flashcard', { revealed })} disabled={disabled} label="Continue" />
      </div>
    </CanvasSection>
  );
}

export function TrueFalseMode({
  canvas,
  disabled,
  onSubmit,
}: {
  canvas: NonNullable<TutorCanvasState['trueFalse']>;
  disabled: boolean;
  onSubmit?: (mode: string, data: unknown) => void;
}) {
  const [answer, setAnswer] = useState<boolean | null>(canvas.userAnswer);

  return (
    <CanvasSection>
      <p className="mb-4 text-xl font-light text-zinc-900">{canvas.prompt}</p>
      <p className="mb-6 text-base text-zinc-700">{canvas.statement}</p>
      <div className="flex gap-3">
        <button type="button" disabled={disabled} onClick={() => setAnswer(true)} className={`rounded-lg border px-4 py-3 ${answer === true ? 'border-zinc-900 bg-zinc-900 text-white' : 'border-zinc-200 bg-white text-zinc-900'}`}>
          True
        </button>
        <button type="button" disabled={disabled} onClick={() => setAnswer(false)} className={`rounded-lg border px-4 py-3 ${answer === false ? 'border-zinc-900 bg-zinc-900 text-white' : 'border-zinc-200 bg-white text-zinc-900'}`}>
          False
        </button>
      </div>
      <div className="mt-6 flex justify-center">
        <SubmitButton onClick={() => onSubmit?.('true_false', { answer })} disabled={disabled || answer === null} label="Check Statement" />
      </div>
    </CanvasSection>
  );
}
