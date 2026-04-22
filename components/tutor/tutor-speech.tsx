'use client';

interface TutorSpeechProps {
  speech: string;
  thinking?: boolean;
}

export function TutorSpeech({ speech, thinking = false }: TutorSpeechProps) {
  const text = speech.trim() || (thinking ? 'Listening & processing...' : '');

  return (
    <div className="animate-in fade-in duration-500">
      <p
        className={`text-2xl md:text-[2rem] font-light leading-[1.3] tracking-tight ${
          thinking && !speech.trim() ? 'text-zinc-400' : 'text-zinc-900'
        }`}
      >
        {text}
      </p>
    </div>
  );
}
