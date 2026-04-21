'use client';

import { useState, useCallback, KeyboardEvent } from 'react';
import { Send } from 'lucide-react';

interface TextInputProps {
  onSubmit: (text: string) => void;
  disabled?: boolean;
  placeholder?: string;
}

/**
 * Text input component for text-based interaction in the lesson
 * Supports multiline input and Cmd+Enter shortcut
 */
export function TextInput({
  onSubmit,
  disabled = false,
  placeholder = 'Type your message...',
}: TextInputProps) {
  const [text, setText] = useState('');

  const handleSubmit = useCallback(() => {
    const trimmedText = text.trim();
    if (trimmedText && !disabled) {
      onSubmit(trimmedText);
      setText('');
    }
  }, [text, disabled, onSubmit]);

  const handleKeyDown = useCallback(
    (e: KeyboardEvent<HTMLTextAreaElement>) => {
      // Handle Cmd+Enter (Mac) or Ctrl+Enter (Windows/Linux)
      if ((e.metaKey || e.ctrlKey) && e.key === 'Enter') {
        e.preventDefault();
        handleSubmit();
      }
    },
    [handleSubmit]
  );

  return (
    <div className="flex flex-col space-y-3 w-full">
      <div className="relative group">
        <textarea
          value={text}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder={placeholder}
          disabled={disabled}
          rows={3}
          className={`
            w-full p-4 pr-14 rounded-2xl border bg-white shadow-sm
            transition-all outline-none text-sm font-medium leading-relaxed
            ${disabled 
              ? 'border-slate-100 bg-slate-50 text-slate-400 cursor-not-allowed' 
              : 'border-slate-200 text-slate-900 focus:border-cyan-500 focus:ring-4 focus:ring-cyan-500/5 group-hover:border-slate-300'}
          `}
        />
        <button
          onClick={handleSubmit}
          disabled={disabled || !text.trim()}
          className={`
            absolute bottom-3 right-3 p-2.5 rounded-xl transition-all
            ${
              text.trim() && !disabled
                ? 'bg-slate-950 text-white hover:bg-slate-800 shadow-lg shadow-slate-950/20'
                : 'bg-slate-100 text-slate-300 cursor-not-allowed'
            }
          `}
          title="Send message (Cmd+Enter)"
          aria-label="Send message"
        >
          <Send className="w-4.5 h-4.5" />
        </button>
      </div>
      <div className="flex justify-between items-center px-1">
        <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
          <kbd className="font-sans">⌘</kbd> + <kbd className="font-sans">Enter</kbd> to send
        </p>
        <p className={`text-[10px] font-bold ${text.length > 500 ? 'text-rose-500' : 'text-slate-400'}`}>
          {text.length} / 500
        </p>
      </div>
    </div>
  );
}
