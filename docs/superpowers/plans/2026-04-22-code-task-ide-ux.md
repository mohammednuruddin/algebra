# Code Task IDE UX Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Upgrade tutor code tasks from a plain textarea into a beginner-friendly mini IDE with clean task resets, honest submitted-code feedback, and core editor affordances.

**Architecture:** Keep the change contained to the `code_block` canvas path. Add a focused CodeMirror-backed editor component, derive a client-side code-task identity key for reset semantics, and update the host UI/tests around submit labels and submitted-code feedback.

**Tech Stack:** Next.js, React 19, TypeScript, Vitest, Testing Library, CodeMirror 6

---

## File Map

- Modify: `components/tutor/tutor-canvas-host.tsx`
- Modify: `components/tutor/tutor-canvas-host.test.tsx`
- Modify: `package.json`
- Modify: `package-lock.json`
- Doc: `docs/superpowers/specs/2026-04-22-code-task-ide-ux-design.md`

### Task 1: Lock in failing coverage for code-task reset semantics

**Files:**
- Modify: `components/tutor/tutor-canvas-host.test.tsx`
- Test: `components/tutor/tutor-canvas-host.test.tsx`

- [ ] **Step 1: Write the failing test for sticky submit state**

```tsx
it('resets a new code task back to run code and clears the submitted panel', () => {
  const onCodeSubmit = vi.fn();
  const { rerender } = render(
    <TutorCanvasHost
      canvas={buildCanvas({
        mode: 'code_block',
        codeBlock: {
          prompt: 'Write a print statement.',
          language: 'python',
          starterCode: 'print("hi")',
          userCode: 'print("hi")',
          expectedOutput: 'hi',
          submitted: false,
        },
      })}
      onMoveToken={vi.fn()}
      onChooseEquationAnswer={vi.fn()}
      onCodeSubmit={onCodeSubmit}
    />
  );

  fireEvent.click(screen.getByRole('button', { name: /run code/i }));

  expect(screen.getByRole('button', { name: /run again/i })).toBeInTheDocument();
  expect(screen.getByText(/submitted code/i)).toBeInTheDocument();

  rerender(
    <TutorCanvasHost
      canvas={buildCanvas({
        mode: 'code_block',
        codeBlock: {
          prompt: 'Write a different print statement.',
          language: 'python',
          starterCode: 'print("bye")',
          userCode: 'print("bye")',
          expectedOutput: 'bye',
          submitted: false,
        },
      })}
      onMoveToken={vi.fn()}
      onChooseEquationAnswer={vi.fn()}
      onCodeSubmit={onCodeSubmit}
    />
  );

  expect(screen.getByRole('button', { name: /run code/i })).toBeInTheDocument();
  expect(screen.queryByText(/submitted code/i)).not.toBeInTheDocument();
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- components/tutor/tutor-canvas-host.test.tsx`
Expected: FAIL because the old code-task UI keeps the stale submitted state and has no submitted-code panel.

- [ ] **Step 3: Write the failing test for same-task persistence**

```tsx
it('keeps edited learner code on the same task and submits it again', () => {
  const onCodeSubmit = vi.fn();

  render(
    <TutorCanvasHost
      canvas={buildCanvas({
        mode: 'code_block',
        codeBlock: {
          prompt: 'Square the number.',
          language: 'python',
          starterCode: 'n = 4',
          userCode: 'n = 4',
          expectedOutput: '16',
          submitted: false,
        },
      })}
      onMoveToken={vi.fn()}
      onChooseEquationAnswer={vi.fn()}
      onCodeSubmit={onCodeSubmit}
    />
  );

  const editor = screen.getByTestId('code-editor');
  fireEvent.input(editor, { target: { textContent: 'n = 4\nprint(n * n)' } });
  fireEvent.click(screen.getByRole('button', { name: /run code/i }));
  fireEvent.click(screen.getByRole('button', { name: /run again/i }));

  expect(onCodeSubmit).toHaveBeenLastCalledWith('n = 4\nprint(n * n)');
});
```

- [ ] **Step 4: Run test to verify it fails**

Run: `npm test -- components/tutor/tutor-canvas-host.test.tsx`
Expected: FAIL because the current textarea path does not expose the new editor surface or same-task `Run again` semantics.

### Task 2: Add the focused editor and reset logic

**Files:**
- Modify: `components/tutor/tutor-canvas-host.tsx`
- Modify: `package.json`
- Modify: `package-lock.json`
- Test: `components/tutor/tutor-canvas-host.test.tsx`

- [ ] **Step 1: Add CodeMirror dependencies**

```bash
npm install @uiw/react-codemirror @codemirror/lang-python @codemirror/theme-one-dark
```

- [ ] **Step 2: Implement minimal editor wrapper and task key reset**

```tsx
const taskKey = JSON.stringify({
  prompt: codeBlock.prompt,
  language: codeBlock.language,
  starterCode: codeBlock.starterCode,
  expectedOutput: codeBlock.expectedOutput ?? null,
});

useEffect(() => {
  setCode(codeBlock.starterCode || '');
  setSubmitted(false);
  setSubmittedCode(null);
}, [taskKey, codeBlock.starterCode]);
```

- [ ] **Step 3: Replace textarea footer UX with IDE-like labels and submitted-code panel**

```tsx
<button>{submitted ? 'Run again' : 'Run code'}</button>

{submittedCode ? (
  <div>
    <p>Submitted code</p>
    <pre>{submittedCode}</pre>
    {codeBlock.expectedOutput ? <p>Expected output: {codeBlock.expectedOutput}</p> : null}
  </div>
) : null}
```

- [ ] **Step 4: Run the focused test file**

Run: `npm test -- components/tutor/tutor-canvas-host.test.tsx`
Expected: PASS

### Task 3: Finish UX coverage and docs alignment

**Files:**
- Modify: `components/tutor/tutor-canvas-host.test.tsx`
- Doc: `docs/superpowers/specs/2026-04-22-code-task-ide-ux-design.md`

- [ ] **Step 1: Add the failing test for prompt placement**

```tsx
it('renders instructional prompt outside the editor surface', () => {
  render(
    <TutorCanvasHost
      canvas={buildCanvas({
        mode: 'code_block',
        codeBlock: {
          prompt: 'Type your math below.',
          language: 'python',
          starterCode: '',
          userCode: '',
          submitted: false,
        },
      })}
      onMoveToken={vi.fn()}
      onChooseEquationAnswer={vi.fn()}
      onCodeSubmit={vi.fn()}
    />
  );

  expect(screen.getByText('Type your math below.')).toBeInTheDocument();
  expect(screen.queryByDisplayValue(/Type your math below\./i)).not.toBeInTheDocument();
});
```

- [ ] **Step 2: Run test to verify it fails or protects against regression**

Run: `npm test -- components/tutor/tutor-canvas-host.test.tsx`
Expected: FAIL before implementation if instruction text leaks into editor content; PASS after fix.

- [ ] **Step 3: Keep the spec language aligned with the final shipped labels**

```md
- `Run code`
- `Run again`
- `Submitted code`
- optional `Expected output`
```

- [ ] **Step 4: Re-run the focused test file**

Run: `npm test -- components/tutor/tutor-canvas-host.test.tsx`
Expected: PASS

### Task 4: Verify the touched surface before handoff

**Files:**
- Modify: `components/tutor/tutor-canvas-host.tsx`
- Modify: `components/tutor/tutor-canvas-host.test.tsx`
- Modify: `package.json`
- Modify: `package-lock.json`

- [ ] **Step 1: Run lint on the touched files**

Run: `npx eslint components/tutor/tutor-canvas-host.tsx components/tutor/tutor-canvas-host.test.tsx`
Expected: exit 0

- [ ] **Step 2: Run typecheck**

Run: `npx tsc --noEmit`
Expected: exit 0

- [ ] **Step 3: Run the full test suite**

Run: `npm test`
Expected: exit 0

## Self-Review

- Spec coverage:
  - task reset boundary: covered in Task 1 and Task 2
  - stale submit label: covered in Task 1 and Task 2
  - editor upgrade: covered in Task 2
  - prompt outside editor: covered in Task 3
  - verification: covered in Task 4
- Placeholder scan:
  - no `TODO`, `TBD`, or unnamed commands remain
- Type consistency:
  - plan uses `codeBlock`, `starterCode`, `expectedOutput`, `onCodeSubmit`, and `TutorCanvasHost`, matching the current codebase
