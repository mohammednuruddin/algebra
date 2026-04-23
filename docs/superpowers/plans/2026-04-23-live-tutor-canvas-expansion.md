# Live Tutor Canvas Expansion Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Expand the live tutor into a multi-subject board system with new core canvas modes, lightweight tutor skins, and a stronger tutor system prompt that uses the board well.

**Architecture:** Keep the tutor as one live experience. Extend the existing generic tutor runtime with new mode-specific state and commands, but reuse current primitives where that keeps the system lean: `timeline` over ordering-like mechanics, `continuous_axis` over number-line-like mechanics, `compare_matrix` over grid-like mechanics, and `true_false` over a thin multiple-choice-like surface. Split the UI into focused canvas components instead of growing one giant host file, and keep learner submissions structured so the tutor can inspect exact evidence.

**Tech Stack:** Next.js 16, React 19, TypeScript, Vitest, Testing Library, Tailwind CSS, existing tutor runtime/model pipeline

---

## File Map

- Modify: `lib/types/tutor.ts`
- Modify: `lib/tutor/runtime.ts`
- Modify: `lib/tutor/runtime.test.ts`
- Modify: `lib/tutor/model.ts`
- Modify: `lib/tutor/model.test.ts`
- Modify: `components/tutor/tutor-canvas-host.tsx`
- Modify: `components/tutor/tutor-canvas-host.test.tsx`
- Modify: `components/tutor/tutor-experience.tsx`
- Modify: `components/tutor/tutor-experience.test.tsx`
- Modify: `app/api/tutor/turn/route.ts`
- Modify: `app/api/tutor/turn/route.test.ts`
- Create: `components/tutor/canvas/image-hotspot-mode.tsx`
- Create: `components/tutor/canvas/timeline-mode.tsx`
- Create: `components/tutor/canvas/continuous-axis-mode.tsx`
- Create: `components/tutor/canvas/venn-diagram-mode.tsx`
- Create: `components/tutor/canvas/token-builder-mode.tsx`
- Create: `components/tutor/canvas/process-flow-mode.tsx`
- Create: `components/tutor/canvas/part-whole-builder-mode.tsx`
- Create: `components/tutor/canvas/map-canvas-mode.tsx`
- Create: `components/tutor/canvas/claim-evidence-builder-mode.tsx`
- Create: `components/tutor/canvas/compare-matrix-mode.tsx`
- Create: `components/tutor/canvas/flashcard-mode.tsx`
- Create: `components/tutor/canvas/true-false-mode.tsx`

### Task 1: Lock in failing runtime and prompt coverage for the new mode surface

**Files:**
- Modify: `lib/tutor/runtime.test.ts`
- Modify: `lib/tutor/model.test.ts`

- [ ] **Step 1: Add the failing runtime test for a new image hotspot task**

```ts
it('applies an image_hotspot task and keeps hotspot evidence-ready state', () => {
  const result = applyTutorCommands(createEmptyTutorCanvasState(), [
    {
      type: 'set_image_hotspot',
      prompt: 'Tap the nucleus.',
      imageId: 'img-1',
      hotspots: [{ id: 'nucleus', label: 'Nucleus', x: 42, y: 38, radius: 10 }],
    },
  ], {
    canvasAction: 'replace',
    mediaAssets: [{ id: 'img-1', url: 'https://example.com/cell.png', altText: 'Cell', description: 'Cell diagram' }],
  });

  expect(result.canvas.mode).toBe('image_hotspot');
  expect(result.canvas.imageHotspot?.backgroundImageUrl).toBe('https://example.com/cell.png');
  expect(result.canvas.imageHotspot?.hotspots).toHaveLength(1);
});
```

- [ ] **Step 2: Add the failing prompt-contract test for new board selection guidance**

```ts
it('teaches the live tutor which canvas to pick and to avoid pushy hype', async () => {
  await generateTutorTurn({
    topic: 'photosynthesis',
    learnerLevel: 'beginner',
    outline: ['Identify leaf structures'],
    imageAssets: [],
    activeImageId: null,
    transcript: 'I am ready.',
    canvasSummary: '',
    canvasStateContext: '',
    latestLearnerTurnContext: '',
    recentTurnFrames: [],
    recentTurns: '',
    canvasTaskPrompt: null,
    canvasReferenceImageUrl: null,
    canvasBrushColor: null,
    canvasEvidence: null,
  });

  const outbound = vi.mocked(buildOpenRouterRequest).mock.calls.at(-1)?.[0];
  const systemPrompt = String(outbound?.messages?.[0]?.content ?? '');

  expect(systemPrompt).toMatch(/image_hotspot|timeline|continuous_axis|venn_diagram|token_builder|process_flow/i);
  expect(systemPrompt).toMatch(/avoid repetitive hype|let's go/i);
});
```

- [ ] **Step 3: Run the focused runtime and model tests to verify RED**

Run: `npm test -- lib/tutor/runtime.test.ts lib/tutor/model.test.ts`
Expected: FAIL because the new mode types/commands/prompt contract do not exist yet.

### Task 2: Extend tutor types, commands, interactions, and runtime state

**Files:**
- Modify: `lib/types/tutor.ts`
- Modify: `lib/tutor/runtime.ts`
- Modify: `lib/tutor/runtime.test.ts`

- [ ] **Step 1: Add new canvas modes, state interfaces, interaction payloads, and command types**

```ts
export type TutorCanvasMode =
  | 'distribution'
  | 'equation'
  | 'fill_blank'
  | 'code_block'
  | 'multiple_choice'
  | 'number_line'
  | 'table_grid'
  | 'graph_plot'
  | 'matching_pairs'
  | 'ordering'
  | 'text_response'
  | 'drawing'
  | 'image_hotspot'
  | 'timeline'
  | 'continuous_axis'
  | 'venn_diagram'
  | 'token_builder'
  | 'process_flow'
  | 'part_whole_builder'
  | 'map_canvas'
  | 'claim_evidence_builder'
  | 'compare_matrix'
  | 'flashcard'
  | 'true_false';
```

- [ ] **Step 2: Add minimal runtime handling for the new `set_*` and `clear_*` commands**

```ts
case 'set_image_hotspot':
  nextState.imageHotspot = {
    prompt: asTrimmedString(command.prompt, 'Tap the correct region.'),
    backgroundImageUrl: resolveCanvasBackgroundUrl({
      backgroundImageUrl: command.backgroundImageUrl,
      mediaAssets: options?.mediaAssets,
      imageId: command.imageId,
      imageIndex: command.imageIndex,
      defaultImageId: options?.defaultImageId,
    }),
    hotspots: normalizeHotspots(command.hotspots),
    selectedHotspotIds: [],
    submitted: false,
  };
  nextState.mode = 'image_hotspot';
  break;
```

- [ ] **Step 3: Add concise `summarizeTutorCanvas()` branches for every new mode**

```ts
if (canvas.mode === 'timeline' && canvas.timeline) {
  return `Timeline: ${canvas.timeline.prompt}. Ordered items: ${canvas.timeline.userOrder.join(', ')}.`;
}
```

- [ ] **Step 4: Re-run the focused runtime test file**

Run: `npm test -- lib/tutor/runtime.test.ts`
Expected: PASS for the new runtime branches.

### Task 3: Expand tutor system prompt and command sanitization

**Files:**
- Modify: `lib/tutor/model.ts`
- Modify: `lib/tutor/model.test.ts`

- [ ] **Step 1: Extend `sanitizeCommands()` so the model can emit the new `set_*` commands**

```ts
case 'set_timeline': {
  commands.push({
    type: 'set_timeline',
    prompt: trimmed(command.prompt, 'Place the events in order.'),
    items: Array.isArray(command.items) ? command.items.map((item) => ({
      id: trimmed((item as Record<string, unknown>).id),
      label: trimmed((item as Record<string, unknown>).label, 'Item'),
      correctPosition: typeof (item as Record<string, unknown>).correctPosition === 'number'
        ? Number((item as Record<string, unknown>).correctPosition)
        : undefined,
    })) : [],
  });
  break;
}
```

- [ ] **Step 2: Rewrite the live-tutor system prompt block to include the canvas-selection rubric, evidence-use rules, and the warm-not-pushy tone rule**

```ts
'Use image_hotspot for identifying a precise region on an image or diagram, timeline for sequence and chronology, continuous_axis for values or degrees on a continuum, venn_diagram for overlap/distinction, token_builder for assembling valid structures, process_flow for chains/cycles/causes, part_whole_builder for fractions/shares, map_canvas for regions/routes in space, claim_evidence_builder for connecting claims to support, and compare_matrix for multi-trait comparison.',
'Do not open a canvas when voice alone is clearer.',
'Inspect the learner submission directly. Name what is correct, what is misplaced, and what to do next.',
'Be warm and human. Avoid repetitive hype language such as constant \"let\\'s go\" phrasing.'
```

- [ ] **Step 3: Run the focused model test file**

Run: `npm test -- lib/tutor/model.test.ts`
Expected: PASS with the new prompt-contract and sanitization coverage.

### Task 4: Build the new canvas UI components with focused tests first

**Files:**
- Modify: `components/tutor/tutor-canvas-host.test.tsx`
- Create: `components/tutor/canvas/*.tsx`
- Modify: `components/tutor/tutor-canvas-host.tsx`

- [ ] **Step 1: Add failing host tests for one representative mode per interaction family**

```tsx
it('submits hotspot selections from image_hotspot mode', async () => {
  const onCanvasSubmit = vi.fn();
  render(
    <TutorCanvasHost
      canvas={buildCanvas({
        mode: 'image_hotspot',
        imageHotspot: {
          prompt: 'Tap the nucleus.',
          backgroundImageUrl: 'https://example.com/cell.png',
          hotspots: [{ id: 'nucleus', label: 'Nucleus', x: 40, y: 40, radius: 12 }],
          selectedHotspotIds: [],
          submitted: false,
        },
      })}
      onMoveToken={vi.fn()}
      onChooseEquationAnswer={vi.fn()}
      onCanvasSubmit={onCanvasSubmit}
    />
  );

  fireEvent.click(screen.getByRole('button', { name: /nucleus/i }));
  fireEvent.click(screen.getByRole('button', { name: /submit/i }));

  expect(onCanvasSubmit).toHaveBeenCalledWith('image_hotspot', expect.objectContaining({
    selectedHotspotIds: ['nucleus'],
  }));
});
```

- [ ] **Step 2: Implement focused components for each new mode, keeping each file under one responsibility**

```tsx
export function TimelineMode({ timeline, disabled, onSubmit }: TimelineModeProps) {
  const [order, setOrder] = useState(timeline.userOrder.length ? timeline.userOrder : timeline.items.map((item) => item.id));
  return (
    <CanvasSection>
      <p className="text-xl md:text-2xl font-light text-zinc-900 leading-relaxed mb-8">{timeline.prompt}</p>
      {/* render draggable cards on a horizontal axis */}
      <SubmitButton onClick={() => onSubmit?.('timeline', { userOrder: order })} disabled={disabled} label="Check Timeline" />
    </CanvasSection>
  );
}
```

- [ ] **Step 3: Integrate the new components into `TutorCanvasHost`**

```tsx
if (canvas.mode === 'image_hotspot' && canvas.imageHotspot) {
  return <ImageHotspotMode canvas={canvas} disabled={disabled} onSubmit={onCanvasSubmit} />;
}
```

- [ ] **Step 4: Run the focused host test file**

Run: `npm test -- components/tutor/tutor-canvas-host.test.tsx`
Expected: PASS for the new host render/submission paths.

### Task 5: Wire learner submissions and route forwarding for the new evidence types

**Files:**
- Modify: `components/tutor/tutor-experience.tsx`
- Modify: `components/tutor/tutor-experience.test.tsx`
- Modify: `app/api/tutor/turn/route.ts`
- Modify: `app/api/tutor/turn/route.test.ts`

- [ ] **Step 1: Add failing `TutorExperience` coverage for one new structured mode**

```tsx
it('forwards structured timeline submissions instead of flattening them to prose only', () => {
  const submitTranscript = vi.fn();
  mockUseTutorSession.mockReturnValue({
    snapshot: buildSnapshot(),
    phase: 'live',
    error: null,
    isSubmittingTurn: false,
    startSession: mockStartSession,
    submitTranscript,
    moveToken: vi.fn(),
    chooseEquationAnswer: vi.fn(),
  });

  render(<TutorExperience />);

  const props = mockTutorShell.mock.calls.at(-1)?.[0] as { onCanvasSubmit?: (mode: string, data: unknown) => void };
  props.onCanvasSubmit?.('timeline', { userOrder: ['event-2', 'event-1'] });

  expect(submitTranscript).toHaveBeenCalledWith(
    '[Canvas interaction: timeline] {"userOrder":["event-2","event-1"]}',
    expect.objectContaining({
      canvasInteraction: { mode: 'timeline', userOrder: ['event-2', 'event-1'] },
    })
  );
});
```

- [ ] **Step 2: Extend `handleCanvasSubmit` and route plumbing for the new interaction payloads**

```ts
case 'timeline':
  canvasInteraction = {
    mode: 'timeline',
    userOrder: Array.isArray(payload.userOrder) ? payload.userOrder.filter((value): value is string => typeof value === 'string') : [],
  };
  break;
```

- [ ] **Step 3: Run the focused interaction tests**

Run: `npm test -- components/tutor/tutor-experience.test.tsx app/api/tutor/turn/route.test.ts`
Expected: PASS for new structured evidence forwarding.

### Task 6: Full verification for the touched surfaces

**Files:**
- Modify: touched files above

- [ ] **Step 1: Run lint on the touched tutor files**

Run: `npx eslint lib/types/tutor.ts lib/tutor/runtime.ts lib/tutor/model.ts components/tutor/tutor-canvas-host.tsx components/tutor/canvas/*.tsx components/tutor/tutor-experience.tsx app/api/tutor/turn/route.ts`
Expected: exit 0

- [ ] **Step 2: Run typecheck**

Run: `npx tsc --noEmit`
Expected: exit 0

- [ ] **Step 3: Run the focused tutor suite**

Run: `npm test -- lib/tutor/runtime.test.ts lib/tutor/model.test.ts components/tutor/tutor-canvas-host.test.tsx components/tutor/tutor-experience.test.tsx app/api/tutor/turn/route.test.ts`
Expected: exit 0

- [ ] **Step 4: Run the full test suite**

Run: `npm test`
Expected: exit 0

## Self-Review

- Spec coverage:
  - live-tutor-only shape: covered by Task 3 and Task 5
  - new core modes + lightweight skins: covered by Task 2 and Task 4
  - tutor prompt contract: covered by Task 3
  - structured evidence: covered by Task 2 and Task 5
  - phased implementation: this plan collapses the phases into one execution pass because the user explicitly asked for all phases now, but the tasks still preserve the foundational-first order
- Placeholder scan:
  - no `TODO`, `TBD`, or "similar to above" shortcuts remain
- Type consistency:
  - the plan uses `image_hotspot`, `timeline`, `continuous_axis`, `venn_diagram`, `token_builder`, `process_flow`, `part_whole_builder`, `map_canvas`, `claim_evidence_builder`, `compare_matrix`, `flashcard`, and `true_false` consistently across mode names, commands, and interaction payloads
