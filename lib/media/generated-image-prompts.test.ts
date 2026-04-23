import { describe, expect, it } from 'vitest';

import {
  buildQuizVariantPrompt,
  formatTutorImageContextLine,
} from './generated-image-prompts';

describe('buildQuizVariantPrompt', () => {
  it('includes only remove actions for remove-only variants', () => {
    const prompt = buildQuizVariantPrompt({
      remove: ['nucleus'],
      swap: [],
    });

    expect(prompt).toContain('Remove label {"label":"nucleus"}');
    expect(prompt).not.toContain('Swap label');
    expect(prompt).toContain('Do not change anything else.');
  });

  it('includes only swap actions for swap-only variants', () => {
    const prompt = buildQuizVariantPrompt({
      remove: [],
      swap: [{ from: 'evaporation', to: 'condensation' }],
    });

    expect(prompt).toContain('Swap label {"from":"evaporation","to":"condensation"}');
    expect(prompt).not.toContain('Remove label');
  });

  it('includes remove and swap actions together when both are requested', () => {
    const prompt = buildQuizVariantPrompt({
      remove: ['nucleus'],
      swap: [{ from: 'evaporation', to: 'condensation' }],
    });

    expect(prompt).toContain('Remove label {"label":"nucleus"}');
    expect(prompt).toContain('Swap label {"from":"evaporation","to":"condensation"}');
  });

  it('normalizes quotes, pipes, and newlines in edit labels', () => {
    const prompt = buildQuizVariantPrompt({
      remove: ["nucleus |\n'core'"],
      swap: [{ from: 'evaporation\nzone', to: 'condensation | area' }],
    });

    expect(prompt).toContain('Remove label {"label":"nucleus | \'core\'"}');
    expect(prompt).toContain(
      'Swap label {"from":"evaporation zone","to":"condensation | area"}'
    );
    expect(prompt).not.toContain("Remove label 'nucleus |\n'core''");
  });
});

describe('formatTutorImageContextLine', () => {
  it('includes requested and verified edit metadata for quiz variants', () => {
    const line = formatTutorImageContextLine({
      id: 'generated_1',
      altText: 'Plant diagram quiz variant',
      description: 'Same diagram with one removed label and one swapped label.',
      url: 'https://example.com/generated.webp',
      metadata: {
        assetKind: 'generated',
        generationKind: 'edit',
        variantKind: 'quiz_swap',
        requestedEdits: {
          remove: ['nucleus'],
          swap: [{ from: 'evaporation', to: 'condensation' }],
        },
        verifiedEdits: {
          removedLabelsVerified: ['nucleus'],
          swappedLabelsVerified: [{ from: 'evaporation', to: 'condensation' }],
        },
        suggestedUse: 'Ask the learner what is missing and what is wrong.',
      },
    });

    expect(line).toContain('generated');
    expect(line).toContain('quiz_swap');
    expect(line).toContain(
      'requested edits: {"remove":["nucleus"],"swap":[{"from":"evaporation","to":"condensation"}]}'
    );
    expect(line).toContain(
      'verified edits: {"remove":["nucleus"],"swap":[{"from":"evaporation","to":"condensation"}]}'
    );
  });

  it('escapes delimiter-breaking strings in tutor image context', () => {
    const line = formatTutorImageContextLine({
      id: 'generated_2',
      altText: 'Plant | "diagram"\nvariant',
      description: "Same |\n'diagram'",
      url: 'https://example.com/generated-2.webp',
      metadata: {
        assetKind: 'generated',
        generationKind: 'edit',
        variantKind: 'quiz_swap',
        requestedEdits: {
          remove: ['nucleus |\nzone'],
          swap: [{ from: '"evaporation"', to: "condensation\n'area'" }],
        },
        verifiedEdits: {
          removedLabelsVerified: ['nucleus |\nzone'],
          swappedLabelsVerified: [{ from: '"evaporation"', to: "condensation\n'area'" }],
        },
        suggestedUse: 'Ask |\n"what changed"',
      },
    });
    const expectedStructuredEdits = JSON.stringify({
      remove: ['nucleus \\| zone'],
      swap: [{ from: '"evaporation"', to: "condensation 'area'" }],
    });

    expect(line).toContain('Plant \\| \\"diagram\\" variant');
    expect(line).toContain("Same \\| \\'diagram\\'");
    expect(line).toContain(`requested edits: ${expectedStructuredEdits}`);
    expect(line).toContain(`verified edits: ${expectedStructuredEdits}`);
    expect(line).not.toContain(' |\n');
  });

  it('does not throw when nested edit arrays are missing at runtime', () => {
    expect(() =>
      formatTutorImageContextLine({
        id: 'generated_3',
        altText: 'Broken payload',
        description: 'Malformed metadata from runtime JSON.',
        url: 'https://example.com/generated-3.webp',
        metadata: {
          assetKind: 'generated',
          generationKind: 'edit',
          variantKind: 'quiz_swap',
          requestedEdits: {} as never,
          verifiedEdits: {} as never,
        },
      })
    ).not.toThrow();
  });
});
