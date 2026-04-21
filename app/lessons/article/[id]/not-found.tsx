import Link from 'next/link';
import { ArrowLeft } from 'lucide-react';

export default function NotFound() {
  return (
    <div className="min-h-screen bg-zinc-50 dark:bg-zinc-900 flex items-center justify-center px-4">
      <div className="max-w-md w-full text-center">
        <h1 className="text-4xl font-bold text-zinc-900 dark:text-zinc-50 mb-4">
          Article Not Found
        </h1>
        <p className="text-zinc-600 dark:text-zinc-400 mb-8">
          The lesson article you&apos;re looking for doesn&apos;t exist or you
          don&apos;t have permission to view it.
        </p>
        <Link
          href="/lessons/history"
          className="inline-flex items-center gap-2 px-6 py-3 bg-blue-600 hover:bg-blue-700 text-white font-medium rounded-lg transition-colors"
        >
          <ArrowLeft className="w-4 h-4" />
          Back to Lesson History
        </Link>
      </div>
    </div>
  );
}
