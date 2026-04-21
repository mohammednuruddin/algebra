'use client';

import { Mic, Type, Pencil, Image } from 'lucide-react';

export type InputMode = 'voice' | 'text' | 'canvas' | 'annotation';

interface InputModeSelectorProps {
  currentMode: InputMode;
  onModeChange: (mode: InputMode) => void;
  disabled?: boolean;
  availableModes?: InputMode[];
}

const modes: { mode: InputMode; icon: typeof Mic; label: string }[] = [
  { mode: 'voice', icon: Mic, label: 'Voice' },
  { mode: 'text', icon: Type, label: 'Text' },
  { mode: 'canvas', icon: Pencil, label: 'Canvas' },
  { mode: 'annotation', icon: Image, label: 'Annotate' },
];

/**
 * Component to switch between different input modes in the lesson
 */
export function InputModeSelector({
  currentMode,
  onModeChange,
  disabled = false,
  availableModes,
}: InputModeSelectorProps) {
  const visibleModes = availableModes
    ? modes.filter(({ mode }) => availableModes.includes(mode))
    : modes;

  return (
    <div className="flex items-center space-x-2 bg-gray-100 p-1 rounded-lg">
      {visibleModes.map(({ mode, icon: Icon, label }) => {
        const isActive = currentMode === mode;
        return (
          <button
            key={mode}
            onClick={() => onModeChange(mode)}
            disabled={disabled}
            className={`
              flex items-center space-x-2 px-3 py-1.5 rounded-md transition-all
              ${
                isActive
                  ? 'bg-indigo-600 text-white shadow-sm'
                  : 'text-gray-600 hover:bg-gray-200'
              }
              ${disabled ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}
            `}
            title={label}
            aria-label={label}
            aria-pressed={isActive}
          >
            <Icon className="w-4 h-4" />
            <span className="text-sm font-medium hidden sm:inline">{label}</span>
          </button>
        );
      })}
    </div>
  );
}
