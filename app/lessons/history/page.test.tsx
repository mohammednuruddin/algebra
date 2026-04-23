import { describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';

vi.mock('./client', () => ({
  LessonHistoryClient: () => <div data-testid="lesson-history-client">history</div>,
}));

describe('LessonHistoryPage', () => {
  it('renders the current guest history shell without auth gates', async () => {
    const LessonHistoryPage = (await import('./page')).default;
    const result = await LessonHistoryPage();

    render(result);

    expect(screen.getByText('Lesson Library')).toBeInTheDocument();
    expect(screen.getByText('Guest Mode')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /home/i })).toHaveAttribute('href', '/');
    expect(screen.getByTestId('lesson-history-client')).toBeInTheDocument();
  });
});
