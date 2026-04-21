'use client';

import { useState } from 'react';
import { VoiceInput } from './voice-input';
import { VoiceOutput } from './voice-output';

interface VoiceInterfaceProps {
  onUserSpeech: (text: string) => void;
  teacherResponse?: string;
  autoPlayResponse?: boolean;
  disabled?: boolean;
  voiceId?: string;
}

/**
 * Combined voice interface component that handles both input (speech-to-text)
 * and output (text-to-speech) for interactive teaching sessions
 */
export function VoiceInterface({
  onUserSpeech,
  teacherResponse,
  autoPlayResponse = true,
  disabled = false,
  voiceId,
}: VoiceInterfaceProps) {
  const [transcript, setTranscript] = useState('');
  const [partialTranscript, setPartialTranscript] = useState('');

  const handleTranscript = (text: string) => {
    setTranscript(text);
    onUserSpeech(text);
  };

  const handlePartialTranscript = (text: string) => {
    setPartialTranscript(text);
  };

  return (
    <div className="flex flex-col gap-6 p-6 bg-white rounded-lg shadow-md">
      {/* Voice Input Section */}
      <div className="flex flex-col gap-2">
        <h3 className="text-lg font-semibold text-gray-800">Your Response</h3>
        <VoiceInput
          onTranscript={handleTranscript}
          onPartialTranscript={handlePartialTranscript}
          disabled={disabled}
        />
        
        {partialTranscript && (
          <div className="p-3 bg-gray-50 rounded-md">
            <p className="text-sm text-gray-600 italic">
              Listening: {partialTranscript}
            </p>
          </div>
        )}
        
        {transcript && (
          <div className="p-3 bg-blue-50 rounded-md">
            <p className="text-sm text-gray-800">
              You said: {transcript}
            </p>
          </div>
        )}
      </div>

      {/* Voice Output Section */}
      {teacherResponse && (
        <div className="flex flex-col gap-2">
          <h3 className="text-lg font-semibold text-gray-800">Teacher Response</h3>
          <div className="p-3 bg-green-50 rounded-md">
            <p className="text-sm text-gray-800 mb-2">{teacherResponse}</p>
            <VoiceOutput
              text={teacherResponse}
              voiceId={voiceId}
              autoPlay={autoPlayResponse}
            />
          </div>
        </div>
      )}
    </div>
  );
}
