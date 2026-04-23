'use client';

import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { TutorSpeech } from './tutor-speech';

describe('TutorSpeech', () => {
  it('does not render helper text', () => {
    render(
      <TutorSpeech
        speech="Let us work through this together."
      />
    );

    expect(screen.getByText('Let us work through this together.')).toBeInTheDocument();
    expect(screen.queryByText('Move the cards, then speak naturally.')).not.toBeInTheDocument();
  });

  it('shows a thinking label instead of lesson preparation copy while waiting for a reply', () => {
    render(
      <TutorSpeech
        speech="Let me check your answer."
        thinking
      />
    );

    expect(screen.getByText('Thinking...')).toBeInTheDocument();
    expect(screen.queryByText('Preparing your lesson...')).not.toBeInTheDocument();
  });
});
