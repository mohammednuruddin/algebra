import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { LoginForm } from './login-form';

// Mock Next.js router
const mockPush = vi.fn();
const mockRefresh = vi.fn();
vi.mock('next/navigation', () => ({
  useRouter: () => ({
    push: mockPush,
    refresh: mockRefresh,
  }),
}));

// Mock Supabase client
const mockSignIn = vi.fn();
const mockSignUp = vi.fn();
vi.mock('@/lib/supabase/client', () => ({
  createClient: () => ({
    auth: {
      signInWithPassword: mockSignIn,
      signUp: mockSignUp,
    },
  }),
}));

describe('LoginForm', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should render sign in form by default', () => {
    render(<LoginForm />);
    
    expect(screen.getByLabelText(/email/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/password/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /sign in/i })).toBeInTheDocument();
  });

  it('should toggle between sign in and sign up modes', () => {
    render(<LoginForm />);
    
    const toggleButton = screen.getByText(/don't have an account\? sign up/i);
    fireEvent.click(toggleButton);
    
    expect(screen.getByRole('button', { name: /sign up/i })).toBeInTheDocument();
    
    const toggleBackButton = screen.getByText(/already have an account\? sign in/i);
    fireEvent.click(toggleBackButton);
    
    expect(screen.getByRole('button', { name: /sign in/i })).toBeInTheDocument();
  });

  it('should handle successful sign in', async () => {
    mockSignIn.mockResolvedValue({ error: null });
    
    render(<LoginForm />);
    
    const emailInput = screen.getByLabelText(/email/i);
    const passwordInput = screen.getByLabelText(/password/i);
    const submitButton = screen.getByRole('button', { name: /sign in/i });
    
    fireEvent.change(emailInput, { target: { value: 'test@example.com' } });
    fireEvent.change(passwordInput, { target: { value: 'password123' } });
    fireEvent.click(submitButton);
    
    await waitFor(() => {
      expect(mockSignIn).toHaveBeenCalledWith({
        email: 'test@example.com',
        password: 'password123',
      });
      expect(mockPush).toHaveBeenCalledWith('/');
      expect(mockRefresh).toHaveBeenCalled();
    });
  });

  it('should handle sign in error', async () => {
    const errorMessage = 'Invalid credentials';
    mockSignIn.mockResolvedValue({ error: { message: errorMessage } });
    
    render(<LoginForm />);
    
    const emailInput = screen.getByLabelText(/email/i);
    const passwordInput = screen.getByLabelText(/password/i);
    const submitButton = screen.getByRole('button', { name: /sign in/i });
    
    fireEvent.change(emailInput, { target: { value: 'test@example.com' } });
    fireEvent.change(passwordInput, { target: { value: 'wrongpassword' } });
    fireEvent.click(submitButton);
    
    await waitFor(() => {
      expect(screen.getByText(errorMessage)).toBeInTheDocument();
    });
  });

  it('should handle successful sign up', async () => {
    mockSignUp.mockResolvedValue({ error: null });
    
    render(<LoginForm />);
    
    // Switch to sign up mode
    const toggleButton = screen.getByText(/don't have an account\? sign up/i);
    fireEvent.click(toggleButton);
    
    const emailInput = screen.getByLabelText(/email/i);
    const passwordInput = screen.getByLabelText(/password/i);
    const submitButton = screen.getByRole('button', { name: /sign up/i });
    
    fireEvent.change(emailInput, { target: { value: 'newuser@example.com' } });
    fireEvent.change(passwordInput, { target: { value: 'password123' } });
    fireEvent.click(submitButton);
    
    await waitFor(() => {
      expect(mockSignUp).toHaveBeenCalledWith({
        email: 'newuser@example.com',
        password: 'password123',
        options: {
          emailRedirectTo: expect.stringContaining('/auth/callback'),
        },
      });
      expect(screen.getByText(/check your email for the confirmation link/i)).toBeInTheDocument();
    });
  });

  it('should disable submit button while loading', async () => {
    mockSignIn.mockImplementation(() => new Promise(resolve => setTimeout(resolve, 100)));
    
    render(<LoginForm />);
    
    const emailInput = screen.getByLabelText(/email/i);
    const passwordInput = screen.getByLabelText(/password/i);
    const submitButton = screen.getByRole('button', { name: /sign in/i });
    
    fireEvent.change(emailInput, { target: { value: 'test@example.com' } });
    fireEvent.change(passwordInput, { target: { value: 'password123' } });
    fireEvent.click(submitButton);
    
    expect(submitButton).toBeDisabled();
    expect(screen.getByText(/loading\.\.\./i)).toBeInTheDocument();
  });

  it('should require email and password fields', () => {
    render(<LoginForm />);
    
    const emailInput = screen.getByLabelText(/email/i) as HTMLInputElement;
    const passwordInput = screen.getByLabelText(/password/i) as HTMLInputElement;
    
    expect(emailInput.required).toBe(true);
    expect(passwordInput.required).toBe(true);
    expect(passwordInput.minLength).toBe(6);
  });
});
