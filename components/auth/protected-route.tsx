import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';

interface ProtectedRouteProps {
  children: React.ReactNode;
}

/**
 * Server component that protects routes by checking authentication.
 * Redirects to login if user is not authenticated.
 */
export async function ProtectedRoute({ children }: ProtectedRouteProps) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    redirect('/login');
  }

  return <>{children}</>;
}
