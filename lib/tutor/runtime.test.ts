import { describe, expect, it } from 'vitest';

import { applyTutorCommands, createEmptyTutorCanvasState } from './runtime';

describe('applyTutorCommands', () => {
  it('keeps the current canvas scene when canvasAction is keep', () => {
    const base = {
      ...createEmptyTutorCanvasState(),
      mode: 'fill_blank' as const,
      fillBlank: {
        prompt: 'Fill this in.',
        beforeText: '',
        afterText: '',
        slots: [
          {
            id: 'slot-1',
            placeholder: 'answer',
            correctAnswer: 'leaf',
            userAnswer: '',
          },
        ],
        submitted: false,
      },
    };

    const result = applyTutorCommands(base, [], { canvasAction: 'keep' });

    expect(result.canvas.fillBlank?.prompt).toBe('Fill this in.');
    expect(result.canvas.mode).toBe('fill_blank');
  });

  it('clears the current canvas scene when canvasAction is clear', () => {
    const base = {
      ...createEmptyTutorCanvasState(),
      mode: 'multiple_choice' as const,
      multipleChoice: {
        prompt: 'Pick one.',
        options: [{ id: 'a', label: 'A', isCorrect: true }],
        selectedId: null,
        allowMultiple: false,
        selectedIds: [],
        submitted: false,
      },
    };

    const result = applyTutorCommands(base, [], { canvasAction: 'clear' });

    expect(result.canvas.multipleChoice).toBeNull();
    expect(result.canvas.fillBlank).toBeNull();
    expect(result.canvas.mode).toBe('distribution');
  });

  it('resolves drawing backgrounds from imageId during replacement', () => {
    const result = applyTutorCommands(
      createEmptyTutorCanvasState(),
      [
        {
          type: 'set_drawing',
          prompt: 'Mark the anther.',
          imageId: 'img-1',
        },
      ],
      {
        canvasAction: 'replace',
        mediaAssets: [
          {
            id: 'img-1',
            url: 'https://example.com/flower.png',
            altText: 'Flower diagram',
            description: 'Flower anatomy',
          },
        ],
      }
    );

    expect(result.canvas.mode).toBe('drawing');
    expect(result.canvas.drawing?.backgroundImageUrl).toBe(
      'https://example.com/flower.png'
    );
  });

  it('resolves drawing backgrounds when the model wrongly sends an asset id as backgroundImageUrl', () => {
    const result = applyTutorCommands(
      createEmptyTutorCanvasState(),
      [
        {
          type: 'set_drawing',
          prompt: 'Trace the esophagus.',
          backgroundImageUrl: 'img-2',
        },
      ],
      {
        canvasAction: 'replace',
        mediaAssets: [
          {
            id: 'img-2',
            url: 'https://example.com/digestion.png',
            altText: 'Digestive diagram',
            description: 'Digestive system',
          },
        ],
      }
    );

    expect(result.canvas.drawing?.backgroundImageUrl).toBe(
      'https://example.com/digestion.png'
    );
  });

  it('increments drawing scene revision for each fresh drawing task even when prompt and image repeat', () => {
    const first = applyTutorCommands(
      createEmptyTutorCanvasState(),
      [
        {
          type: 'set_drawing',
          prompt: 'Circle the shoot.',
          backgroundImageUrl: 'https://example.com/seed.png',
        },
      ],
      {
        canvasAction: 'replace',
      }
    );

    const second = applyTutorCommands(
      first.canvas,
      [
        {
          type: 'set_drawing',
          prompt: 'Circle the shoot.',
          backgroundImageUrl: 'https://example.com/seed.png',
        },
      ],
      {
        canvasAction: 'replace',
      }
    );

    expect(first.canvas.drawing?.sceneRevision).toBe(1);
    expect(second.canvas.drawing?.sceneRevision).toBe(2);
  });
});
