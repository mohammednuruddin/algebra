import { cookies } from 'next/headers';

import { TutorExperience } from '@/components/tutor/tutor-experience';
import { SESSION_SIDEBAR_COLLAPSED_COOKIE } from '@/lib/tutor/session-sidebar-preference';

export default async function Home({
  searchParams,
}: {
  searchParams?: Promise<{ continue?: string }>;
}) {
  const cookieStore = await cookies();
  const params = (await searchParams) || {};
  const initialSidebarCollapsed =
    cookieStore.get(SESSION_SIDEBAR_COLLAPSED_COOKIE)?.value === '1';

  return (
    <main>
      <TutorExperience
        initialSidebarCollapsed={initialSidebarCollapsed}
        initialContinuationArticleId={params.continue ?? null}
      />
    </main>
  );
}
