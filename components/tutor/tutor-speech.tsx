'use client';

interface TutorSpeechProps {
  speech: string;
  thinking?: boolean;
  loadingLabel?: string;
}

export function TutorSpeech({
  speech,
  thinking = false,
  loadingLabel = 'Thinking...',
}: TutorSpeechProps) {
  const text = speech.trim() || (thinking ? loadingLabel : '');

  return (
    <div className="animate-in fade-in duration-500">
      <p
        className={`text-2xl md:text-[2rem] font-light leading-[1.3] tracking-tight ${
          thinking ? 'text-zinc-400' : 'text-zinc-900'
        }`}
      >
        {thinking && speech.trim() ? loadingLabel : text}
      </p>
      {thinking && (
        <div className="mt-6 flex items-center gap-3">
          <span className="inline-block h-2 w-2 rounded-full bg-zinc-400 animate-pulse" />
          <span className="inline-block h-2 w-2 rounded-full bg-zinc-300 animate-pulse [animation-delay:150ms]" />
          <span className="inline-block h-2 w-2 rounded-full bg-zinc-200 animate-pulse [animation-delay:300ms]" />
        </div>
      )}
    </div>
  );
}
