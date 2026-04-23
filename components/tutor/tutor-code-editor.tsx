'use client';

import { useMemo } from 'react';
import CodeMirror from '@uiw/react-codemirror';
import { indentWithTab } from '@codemirror/commands';
import { python } from '@codemirror/lang-python';
import { oneDark } from '@codemirror/theme-one-dark';
import { keymap, EditorView } from '@codemirror/view';

interface TutorCodeEditorProps {
  language: string;
  value: string;
  disabled?: boolean;
  onChange: (value: string) => void;
}

function resolveLanguageExtensions(language: string) {
  const normalizedLanguage = language.trim().toLowerCase();
  const extensions = [EditorView.lineWrapping, keymap.of([indentWithTab])];

  if (normalizedLanguage === 'python') {
    extensions.push(python());
  }

  return extensions;
}

export function TutorCodeEditor({
  language,
  value,
  disabled = false,
  onChange,
}: TutorCodeEditorProps) {
  const extensions = useMemo(
    () => resolveLanguageExtensions(language),
    [language]
  );

  return (
    <div
      data-testid="code-editor"
      className="min-h-[240px] w-full min-w-0 overflow-hidden rounded-lg border border-zinc-800 bg-zinc-950 shadow-inner [&_.cm-editor]:h-full [&_.cm-editor]:max-w-full [&_.cm-editor]:bg-zinc-950 [&_.cm-editor]:font-mono [&_.cm-editor]:text-sm [&_.cm-focused]:outline-none [&_.cm-gutters]:border-r [&_.cm-gutters]:border-zinc-800 [&_.cm-gutters]:bg-zinc-950 [&_.cm-gutters]:text-zinc-500 [&_.cm-line]:px-1 [&_.cm-scroller]:font-mono [&_.cm-scroller]:leading-6 [&_.cm-content]:py-4 [&_.cm-content]:text-emerald-300 [&_.cm-activeLine]:bg-zinc-900/70 [&_.cm-activeLineGutter]:bg-zinc-900/70 [&_.cm-selectionBackground]:bg-emerald-400/30"
    >
      <CodeMirror
        value={value}
        height="240px"
        theme={oneDark}
        extensions={extensions}
        editable={!disabled}
        basicSetup={{
          autocompletion: false,
          foldGutter: false,
          highlightActiveLine: true,
          highlightActiveLineGutter: true,
          lineNumbers: true,
        }}
        onChange={onChange}
      />
    </div>
  );
}
