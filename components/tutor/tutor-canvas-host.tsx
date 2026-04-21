'use client';

import type { TutorCanvasState } from '@/lib/types/tutor';

interface TutorCanvasHostProps {
  canvas: TutorCanvasState;
  disabled?: boolean;
  onMoveToken: (tokenId: string, zoneId: string | null) => void;
  onChooseEquationAnswer: (choiceId: string) => void;
}

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
      onDragOver={(event) => event.preventDefault()}
      onDrop={(event) => {
        event.preventDefault();
        const tokenId = event.dataTransfer.getData('text/plain');
        if (tokenId) {
          onDropToken(tokenId);
        }
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

function TutorToken({
  token,
  disabled,
}: {
  token: TutorCanvasState['tokens'][number];
  disabled: boolean;
}) {
  const isDot = token.label.trim().length === 0;

  return (
    <button
      type="button"
      draggable={!disabled}
      onDragStart={(event) => event.dataTransfer.setData('text/plain', token.id)}
      disabled={disabled}
      aria-label={isDot ? 'dot token' : token.label}
      className={`transition hover:opacity-90 active:scale-95 disabled:opacity-50 shadow-sm ${
        isDot
          ? 'h-8 w-8 rounded-full'
          : 'rounded-sm px-5 py-2.5 text-xs font-semibold tracking-wider uppercase text-white'
      }`}
      style={{ backgroundColor: token.color }}
    >
      {isDot ? <span className="sr-only">token</span> : token.label}
    </button>
  );
}

export function TutorCanvasHost({
  canvas,
  disabled = false,
  onMoveToken,
  onChooseEquationAnswer,
}: TutorCanvasHostProps) {
  if (canvas.mode === 'equation' && canvas.equation) {
    return (
      <section className="flex min-h-[60dvh] flex-col border border-zinc-200 bg-white p-8 md:p-14 shadow-lg animate-in fade-in duration-700">
        <div className="mb-12">
          <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-zinc-400">
            {canvas.headline}
          </p>
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
                    selected
                      ? 'border-zinc-900 bg-zinc-900 text-white shadow-md'
                      : 'border-zinc-200 bg-white text-zinc-900 hover:border-zinc-400 hover:shadow-sm'
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

  const looseTokens = canvas.tokens.filter((token) => !token.zoneId);

  return (
    <section className="flex min-h-[60dvh] w-full flex-col p-8 md:p-14 bg-white border border-zinc-200 shadow-lg animate-in fade-in duration-700">
      <div className="mb-10 flex items-start justify-between gap-6">
        <div>
          <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-zinc-400">
            {canvas.headline}
          </p>
          <p className="mt-4 max-w-2xl text-2xl md:text-3xl font-light text-zinc-900 leading-relaxed">{canvas.instruction}</p>
        </div>
      </div>

      <div className="grid flex-1 gap-6 lg:grid-cols-[minmax(0,0.78fr)_minmax(0,1.22fr)]">
        <ZoneCard label="Bench" hint="Drag items to the zones." onDropToken={(tokenId) => onMoveToken(tokenId, null)}>
          {looseTokens.map((token) => (
            <TutorToken
              key={token.id}
              token={token}
              disabled={disabled}
            />
          ))}
        </ZoneCard>

        <div className="grid gap-6 md:grid-cols-2">
          {canvas.zones.map((zone) => (
            <ZoneCard
              key={zone.id}
              label={zone.label}
              hint={zone.hint}
              accent={zone.accent}
              onDropToken={(tokenId) => onMoveToken(tokenId, zone.id)}
            >
              {canvas.tokens
                .filter((token) => token.zoneId === zone.id)
                .map((token) => (
                  <TutorToken
                    key={token.id}
                    token={token}
                    disabled={disabled}
                  />
                ))}
            </ZoneCard>
          ))}
        </div>
      </div>
    </section>
  );
}
