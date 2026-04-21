'use client';

import { useState, useCallback, useEffect, useMemo } from 'react';
import { InputModeSelector, InputMode } from './input-mode-selector';
import { TextInput } from './text-input';
import { VoiceInput } from './voice-input';
import { CanvasContainer } from './canvas-container';

interface LessonInputProps {
  sessionId: string;
  onVoiceInput: (text: string) => void;
  onTextInput: (text: string) => void;
  onCanvasSnapshot: (url: string, interpretation: unknown) => void;
  disabled?: boolean;
  defaultMode?: InputMode;
}

const TERMINATION_PHRASES = [
  'end lesson',
  'finish lesson',
  'i am done',
  'i\'m done',
  'quit lesson',
  'stop lesson',
];

/**
 * Unified input component for the lesson interface
 * Manages mode switching and delegates to specific input components
 */
export function LessonInput({
  sessionId,
  onVoiceInput,
  onTextInput,
  onCanvasSnapshot,
  disabled = false,
  defaultMode = 'voice',
}: LessonInputProps) {
  const [mode, setMode] = useState<InputMode>(defaultMode);
  const [isLessonTerminated, setIsLessonTerminated] = useState(false);
  const [voiceEnabled, setVoiceEnabled] = useState(false);

  useEffect(() => {
    let active = true;

    fetch('/api/runtime/config')
      .then((response) => response.json())
      .then((config: { voiceEnabled?: boolean }) => {
        if (!active) {
          return;
        }

        const nextVoiceEnabled = Boolean(config.voiceEnabled);
        setVoiceEnabled(nextVoiceEnabled);
        if (!nextVoiceEnabled && mode === 'voice') {
          setMode('text');
        }
      })
      .catch(() => {
        if (active) {
          setVoiceEnabled(false);
          if (mode === 'voice') {
            setMode('text');
          }
        }
      });

    return () => {
      active = false;
    };
  }, [mode]);

  const handleVoiceTranscript = useCallback(
    (text: string) => {
      const lowerText = text.toLowerCase().trim();
      
      // Detect termination phrases
      const shouldTerminate = TERMINATION_PHRASES.some((phrase) =>
        lowerText.includes(phrase)
      );

      if (shouldTerminate) {
        setIsLessonTerminated(true);
      }

      onVoiceInput(text);
    },
    [onVoiceInput]
  );

  const renderInput = useMemo(() => {
    if (isLessonTerminated) {
      return (
        <div className="p-8 text-center bg-gray-50 rounded-xl border-2 border-dashed border-gray-200">
          <p className="text-gray-600 font-medium">Lesson termination requested.</p>
          <p className="text-sm text-gray-400 mt-2">
            The session is being finalized. Thank you for learning!
          </p>
        </div>
      );
    }

    switch (mode) {
      case 'voice':
        return (
          <div className="flex justify-center p-8 bg-white rounded-xl shadow-sm border border-gray-100">
            <VoiceInput
              onTranscript={handleVoiceTranscript}
              disabled={disabled}
            />
          </div>
        );
      case 'text':
        return (
          <div className="p-4 bg-white rounded-xl shadow-sm border border-gray-100">
            <TextInput
              onSubmit={onTextInput}
              disabled={disabled}
              placeholder="Tell me more or ask a question..."
            />
          </div>
        );
      case 'canvas':
      case 'annotation':
        return (
          <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
            <CanvasContainer
              sessionId={sessionId}
              onSnapshotCaptured={onCanvasSnapshot}
              disabled={disabled}
              mode={mode === 'canvas' ? 'draw' : 'annotate'}
            />
          </div>
        );
      default:
        return null;
    }
  }, [
    mode,
    isLessonTerminated,
    sessionId,
    handleVoiceTranscript,
    onTextInput,
    onCanvasSnapshot,
    disabled,
  ]);

  return (
    <div className="flex flex-col space-y-4 w-full max-w-4xl mx-auto p-4">
      <div className="flex justify-center">
        <InputModeSelector
          currentMode={mode}
          onModeChange={setMode}
          disabled={disabled || isLessonTerminated}
          availableModes={
            voiceEnabled
              ? ['voice', 'text', 'canvas', 'annotation']
              : ['text', 'canvas', 'annotation']
          }
        />
      </div>
      
      <div className="transition-all duration-300 ease-in-out">
        {renderInput}
      </div>

      {isLessonTerminated && (
        <div className="flex justify-center mt-4">
          <button
            onClick={() => setIsLessonTerminated(false)}
            className="text-indigo-600 text-sm hover:underline"
          >
            Resume lesson
          </button>
        </div>
      )}
    </div>
  );
}
