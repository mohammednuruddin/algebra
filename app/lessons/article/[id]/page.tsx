import { GuestArticlePage } from './client';

export const metadata = {
  title: 'Lesson Article - AI Teaching Platform',
  description: 'View your completed lesson article',
};

export default async function ArticlePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  return <GuestArticlePage articleId={id} />;
}
