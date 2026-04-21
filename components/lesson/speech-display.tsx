'use client';

type SpeechDisplayProps = {
  text: string;
  helperText?: string | null;
  isLoading?: boolean;
};

export function SpeechDisplay({
  text,
  helperText,
  isLoading = false,
}: SpeechDisplayProps) {
  const displayText = text.trim() || (isLoading ? 'Thinking...' : '');

  if (!displayText) {
    return <div className="h-8" />;
  }

  return (
    <div className="px-6 pb-3 pt-1">
      <div className="mx-auto max-w-4xl">
        <p className={`text-left text-[1.6rem] leading-[1.22] tracking-[-0.04em] md:text-[1.9rem] ${
          isLoading && !text.trim() ? 'text-slate-400' : 'text-slate-950'
        }`}>
          {displayText}
        </p>
        {helperText ? (
          <p className="mt-2 text-sm font-medium text-slate-500">
            {helperText}
          </p>
        ) : null}
      </div>
    </div>
  );
}
