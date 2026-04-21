'use client';

interface TutorSpeechProps {
  speech: string;
  helperText?: string | null;
  thinking?: boolean;
}

export function TutorSpeech({ speech, helperText, thinking = false }: TutorSpeechProps) {
  const text = speech.trim() || (thinking ? 'Listening & processing...' : '');

  return (
    <div className="space-y-6 animate-in fade-in duration-500">
      <p
        className={`text-2xl md:text-[2rem] font-light leading-[1.3] tracking-tight ${
          thinking && !speech.trim() ? 'text-zinc-400' : 'text-zinc-900'
        }`}
      >
        {text}
      </p>
      {helperText ? (
        <div className="flex items-start gap-4">
          <div className="w-[1px] h-full min-h-[1.5rem] bg-zinc-300 mt-1"></div>
          <p className="text-xs font-semibold tracking-widest uppercase text-zinc-500 pt-1">{helperText}</p> 
        </div>
      ) : null}
    </div>
  );
}
