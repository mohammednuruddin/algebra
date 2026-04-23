'use client';

import { fireEvent, render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { SESSION_SIDEBAR_COLLAPSED_COOKIE } from '@/lib/tutor/session-sidebar-preference';

import { SessionSidebar } from './session-sidebar';

vi.mock('@/lib/guest/guest-lesson-store', () => ({
  listGuestHistoryItems: vi.fn(() => []),
}));

describe('SessionSidebar', () => {
  beforeEach(() => {
    window.localStorage.clear();
  });

  it('persists the learner sidebar collapse state across remounts', () => {
    const { unmount } = render(<SessionSidebar />);

    fireEvent.click(screen.getByRole('button', { name: /collapse sidebar/i }));

    expect(window.localStorage.getItem('tutor:session-sidebar-collapsed')).toBe('true');
    expect(document.cookie).toContain(`${SESSION_SIDEBAR_COLLAPSED_COOKIE}=1`);
    expect(screen.getByRole('button', { name: /expand sidebar/i })).toBeInTheDocument();

    unmount();

    render(<SessionSidebar />);

    expect(screen.getByRole('button', { name: /expand sidebar/i })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /collapse sidebar/i })).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: /expand sidebar/i }));

    expect(window.localStorage.getItem('tutor:session-sidebar-collapsed')).toBe('false');
    expect(document.cookie).toContain(`${SESSION_SIDEBAR_COLLAPSED_COOKIE}=0`);
    expect(screen.getByRole('button', { name: /collapse sidebar/i })).toBeInTheDocument();
  });

  it('renders collapsed immediately when the server passes a collapsed initial state', () => {
    render(<SessionSidebar initialCollapsed />);

    expect(screen.getByRole('button', { name: /expand sidebar/i })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /collapse sidebar/i })).not.toBeInTheDocument();
  });
});
