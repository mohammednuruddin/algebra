import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';

vi.mock('./client', () => ({
  LessonHistoryClient: () => <div data-testid="lesson-history-client">history</div>,
}));

describe('LessonHistoryPage', () => {
  it('renders guest history without authentication checks', async () => {
    const LessonHistoryPage = (await import('./page')).default;
    const result = await LessonHistoryPage();

    render(result);

    expect(screen.getByText('Lesson History')).toBeInTheDocument();
    expect(screen.getByText("This browser's learning archive")).toBeInTheDocument();
    expect(screen.getByText('Guest Mode')).toBeInTheDocument();
    expect(screen.getByTestId('lesson-history-client')).toBeInTheDocument();
  });
});
