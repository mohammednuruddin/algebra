import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';

vi.mock('./client', () => ({
  GuestArticlePage: ({ articleId }: { articleId: string }) => (
    <div data-testid="guest-article-page">{articleId}</div>
  ),
}));

describe('ArticlePage', () => {
  it('renders guest article wrapper without auth redirects', async () => {
    const { default: ArticlePage } = await import('./page');

    const result = await ArticlePage({ params: Promise.resolve({ id: 'article-1' }) });
    render(result);

    expect(screen.getByTestId('guest-article-page')).toHaveTextContent('article-1');
  });
});
