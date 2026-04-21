import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MainLayout } from './main-layout';

vi.mock('next/link', () => ({
  default: ({ children, href }: { children: React.ReactNode; href: string }) => (
    <a href={href}>{children}</a>
  ),
}));

describe('MainLayout', () => {
  it('renders the layout with guest navigation and children', () => {
    render(<MainLayout><div>Test Content</div></MainLayout>);

    expect(screen.getByText('AI Teaching Platform')).toBeTruthy();
    expect(screen.getByText('Start Lesson')).toBeTruthy();
    expect(screen.getByText('History')).toBeTruthy();
    expect(screen.getByText('Guest Mode')).toBeTruthy();
    expect(screen.getByText('Test Content')).toBeTruthy();
  });

  it('does not render a sign in button anymore', () => {
    render(<MainLayout><div>Test Content</div></MainLayout>);

    expect(screen.queryByText('Sign In')).not.toBeInTheDocument();
  });
});
