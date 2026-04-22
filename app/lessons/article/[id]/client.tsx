'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import ReactMarkdown from 'react-markdown';
import remarkMath from 'remark-math';
import remarkGfm from 'remark-gfm';
import rehypeKatex from 'rehype-katex';
import 'katex/dist/katex.min.css';
import {
  ArrowLeft,
  Calendar,
  Clock,
  Target,
  CheckCircle2,
  Download,
  Share2,
  Check,
} from 'lucide-react';
import type { LessonArticleRecord } from '@/lib/types/database';
import { getGuestArticle } from '@/lib/guest/guest-lesson-store';

interface ArticleViewerProps {
  article: LessonArticleRecord;
}

function resolveImageSrc(src?: string) {
  if (!src) return '';
  if (src.startsWith('http://') || src.startsWith('https://')) {
    const prefix = '/storage/v1/object/public/';
    if (src.includes(prefix) && !src.includes(`${prefix}media-assets/`)) {
      return src.replace(prefix, `${prefix}media-assets/`);
    }
    return src;
  }
  if (src.startsWith('/')) return src;

  const cleanPath = src.startsWith('media-assets/')
    ? src.replace('media-assets/', '')
    : src;
  return `/storage/v1/object/public/media-assets/${cleanPath}`;
}

export function ArticleViewer({ article }: ArticleViewerProps) {
  const [isDownloading, setIsDownloading] = useState(false);
  const [isCopied, setIsCopied] = useState(false);
  const copyFeedbackTimeoutRef = useRef<number | null>(null);

  const metadata = article.metadata_json as {
    topic?: string;
    duration?: number;
    milestones_covered?: number;
    total_milestones?: number;
    completion_percentage?: number;
    date?: string;
  } | null;

  useEffect(() => {
    return () => {
      if (copyFeedbackTimeoutRef.current !== null) {
        window.clearTimeout(copyFeedbackTimeoutRef.current);
      }
    };
  }, []);

  const formatDuration = (seconds?: number) => {
    if (!seconds) return 'N/A';
    const minutes = Math.floor(seconds / 60);
    if (minutes < 60) return `${minutes} min`;
    const hours = Math.floor(minutes / 60);
    const remainingMinutes = minutes % 60;
    return `${hours}h ${remainingMinutes}m`;
  };

  const formatDate = (dateString?: string) => {
    if (!dateString) return new Date(article.created_at).toLocaleDateString();
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    });
  };

  const handleDownloadPDF = async () => {
    setIsDownloading(true);
    try {
      const jsPDF = (await import('jspdf')).default;
      const html2canvas = (await import('html2canvas')).default;

      const articleElement = document.getElementById('article-content');
      if (!articleElement) {
        throw new Error('Article content not found');
      }

      const canvas = await html2canvas(articleElement, {
        scale: 2,
        useCORS: true,
        logging: false,
      });

      const imgData = canvas.toDataURL('image/png');
      const pdf = new jsPDF({
        orientation: 'portrait',
        unit: 'mm',
        format: 'a4',
      });

      const imgWidth = 210;
      const pageHeight = 297;
      const imgHeight = (canvas.height * imgWidth) / canvas.width;
      let heightLeft = imgHeight;
      let position = 0;

      pdf.addImage(imgData, 'PNG', 0, position, imgWidth, imgHeight);
      heightLeft -= pageHeight;

      while (heightLeft > 0) {
        position = heightLeft - imgHeight;
        pdf.addPage();
        pdf.addImage(imgData, 'PNG', 0, position, imgWidth, imgHeight);
        heightLeft -= pageHeight;
      }

      const filename = `${article.title.replace(/[^a-z0-9]/gi, '_').toLowerCase()}.pdf`;
      pdf.save(filename);
    } catch (error) {
      console.error('Error generating PDF:', error);
    } finally {
      setIsDownloading(false);
    }
  };

  const handleShareLink = async () => {
    try {
      const shareUrl = `${window.location.origin}/lessons/article/${article.id}`;
      await navigator.clipboard.writeText(shareUrl);
      setIsCopied(true);
      if (copyFeedbackTimeoutRef.current !== null) {
        window.clearTimeout(copyFeedbackTimeoutRef.current);
      }
      copyFeedbackTimeoutRef.current = window.setTimeout(() => {
        setIsCopied(false);
        copyFeedbackTimeoutRef.current = null;
      }, 2000);
    } catch (error) {
      console.error('Error copying to clipboard:', error);
    }
  };

  return (
    <div className="min-h-screen bg-zinc-50 dark:bg-zinc-950 font-sans selection:bg-indigo-100 dark:selection:bg-indigo-900/30">
      <header className="bg-white/80 dark:bg-zinc-900/80 backdrop-blur-md border-b border-zinc-200 dark:border-zinc-800 sticky top-0 z-10">
        <div className="max-w-screen-xl mx-auto px-4 sm:px-6 lg:px-8 py-4 flex items-center justify-between">
          <Link
            href="/lessons/history"
            className="inline-flex items-center gap-2 text-sm font-medium text-zinc-500 hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-zinc-50 transition-colors"
          >
            <ArrowLeft className="w-4 h-4" />
            Library
          </Link>
          
          <div className="flex gap-2">
            <button
              onClick={handleShareLink}
              className="inline-flex items-center gap-2 px-3 py-1.5 text-sm font-medium text-zinc-600 dark:text-zinc-300 bg-zinc-100 dark:bg-zinc-800 hover:bg-zinc-200 dark:hover:bg-zinc-700 rounded-full transition-colors"
            >
              {isCopied ? <Check className="w-4 h-4" /> : <Share2 className="w-4 h-4" />}
              {isCopied ? 'Copied' : 'Share'}
            </button>
            <button
              onClick={handleDownloadPDF}
              disabled={isDownloading}
              className="inline-flex items-center gap-2 px-3 py-1.5 text-sm font-medium text-white bg-zinc-900 dark:bg-zinc-50 dark:text-zinc-900 hover:bg-zinc-800 dark:hover:bg-zinc-200 disabled:opacity-50 disabled:cursor-not-allowed rounded-full transition-colors"
            >
              <Download className="w-4 h-4" />
              {isDownloading ? 'Downloading...' : 'Save PDF'}
            </button>
          </div>
        </div>
      </header>

      <main className="max-w-screen-xl mx-auto px-4 sm:px-6 lg:px-8 py-12 lg:py-20">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-12 lg:gap-16">
          
          {/* Main Article Content */}
          <div className="lg:col-span-8 lg:col-start-1">
            <article id="article-content" className="bg-white dark:bg-zinc-900 rounded-2xl shadow-sm border border-zinc-200/60 dark:border-zinc-800/60 p-8 sm:p-12 lg:p-16">
              <header className="mb-12 border-b border-zinc-100 dark:border-zinc-800 pb-10">
                <div className="flex items-center gap-3 text-sm text-zinc-500 dark:text-zinc-400 mb-6">
                  {metadata?.topic && (
                    <span className="uppercase tracking-wider font-semibold text-indigo-600 dark:text-indigo-400">
                      {metadata.topic}
                    </span>
                  )}
                  {metadata?.topic && <span>•</span>}
                  <time dateTime={metadata?.date || article.created_at}>
                    {formatDate(metadata?.date)}
                  </time>
                </div>
                <h1 className="text-4xl sm:text-5xl lg:text-6xl font-serif font-medium text-zinc-900 dark:text-zinc-50 tracking-tight leading-tight mb-6">
                  {article.title}
                </h1>
                {metadata?.duration && (
                  <div className="flex items-center gap-2 text-zinc-500 dark:text-zinc-400">
                    <Clock className="w-4 h-4" />
                    <span>{formatDuration(metadata.duration)} read</span>
                  </div>
                )}
              </header>

              <div className="prose prose-zinc dark:prose-invert prose-lg max-w-none prose-headings:font-serif prose-headings:font-medium prose-p:leading-relaxed prose-p:text-zinc-600 dark:prose-p:text-zinc-300 prose-a:text-indigo-600 dark:prose-a:text-indigo-400 hover:prose-a:text-indigo-500 prose-img:rounded-2xl prose-img:shadow-md">
                <ReactMarkdown
                  remarkPlugins={[remarkMath, remarkGfm]}
                  rehypePlugins={[rehypeKatex]}
                  components={{
                    img: ({ src, ...props }) => (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        {...props}
                        src={resolveImageSrc(
                          typeof src === 'string' ? src : undefined
                        )}
                        className="rounded-2xl max-w-full h-auto object-cover"
                        loading="lazy"
                        alt={props.alt || 'Article image'}
                      />
                    ),
                  }}
                >
                  {article.article_markdown}
                </ReactMarkdown>
              </div>
            </article>
          </div>

          {/* Sidebar / Metadata */}
          <aside className="lg:col-span-4">
            <div className="sticky top-24 space-y-8">
              <div className="bg-white dark:bg-zinc-900 rounded-2xl border border-zinc-200/60 dark:border-zinc-800/60 p-8 shadow-sm">
                <h3 className="text-sm font-semibold uppercase tracking-wider text-zinc-400 dark:text-zinc-500 mb-6">
                  Lesson Details
                </h3>

              <div className="space-y-6">
                {metadata?.topic && (
                  <div>
                    <div className="flex items-center gap-2 text-sm text-zinc-500 dark:text-zinc-400 mb-1.5">
                      <Target className="w-4 h-4" />
                      <span className="font-medium">Topic</span>
                    </div>
                    <p className="text-base text-zinc-900 dark:text-zinc-50 ml-6">
                      {metadata.topic}
                    </p>
                  </div>
                )}

                <div>
                  <div className="flex items-center gap-2 text-sm text-zinc-500 dark:text-zinc-400 mb-1.5">
                    <Calendar className="w-4 h-4" />
                    <span className="font-medium">Date</span>
                  </div>
                  <p className="text-base text-zinc-900 dark:text-zinc-50 ml-6">
                    {formatDate(metadata?.date)}
                  </p>
                </div>

                <div>
                  <div className="flex items-center gap-2 text-sm text-zinc-500 dark:text-zinc-400 mb-1.5">
                    <Clock className="w-4 h-4" />
                    <span className="font-medium">Duration</span>
                  </div>
                  <p className="text-base text-zinc-900 dark:text-zinc-50 ml-6">
                    {formatDuration(metadata?.duration)}
                  </p>
                </div>

                <div>
                  <div className="flex items-center gap-2 text-sm text-zinc-500 dark:text-zinc-400 mb-1.5">
                    <CheckCircle2 className="w-4 h-4" />
                    <span className="font-medium">Milestones</span>
                  </div>
                  <p className="text-base text-zinc-900 dark:text-zinc-50 ml-6">
                    {metadata?.milestones_covered ?? 0} / {metadata?.total_milestones ?? 0} completed
                  </p>
                </div>

                {metadata?.completion_percentage !== undefined && (
                  <div className="pt-2">
                    <div className="flex items-center justify-between text-sm mb-2">
                      <span className="text-zinc-500 dark:text-zinc-400 font-medium">Completion</span>
                      <span className="text-zinc-900 dark:text-zinc-50 font-semibold">
                        {Math.round(metadata.completion_percentage)}%
                      </span>
                    </div>
                    <div className="w-full bg-zinc-100 dark:bg-zinc-800 rounded-full h-2.5 overflow-hidden">
                      <div
                        className="bg-indigo-600 dark:bg-indigo-500 h-full rounded-full transition-all duration-500 ease-out"
                        style={{ width: `${metadata.completion_percentage}%` }}
                      />
                    </div>
                  </div>
                )}
              </div>

              <div className="mt-8 pt-6 border-t border-zinc-100 dark:border-zinc-800">
                <Link
                  href="/lessons/history"
                  className="flex items-center justify-center gap-2 w-full px-4 py-2.5 text-sm font-medium text-zinc-600 dark:text-zinc-300 bg-zinc-50 dark:bg-zinc-800 hover:bg-zinc-100 dark:hover:bg-zinc-700 rounded-xl transition-colors"
                >
                  <ArrowLeft className="w-4 h-4" />
                  View All Lessons
                </Link>
              </div>
            </div>
            </div>
          </aside>
        </div>
      </main>
    </div>
  );
}

export function GuestArticlePage({ articleId }: { articleId: string }) {
  const article = useMemo(() => getGuestArticle(articleId), [articleId]);

  if (!article) {
    return (
      <div className="min-h-screen bg-zinc-50 dark:bg-zinc-950 flex items-center justify-center px-4 font-sans">
        <div className="max-w-md text-center space-y-6">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-zinc-100 dark:bg-zinc-900 mb-2">
            <svg
              className="w-8 h-8 text-zinc-400 dark:text-zinc-500"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253"
              />
            </svg>
          </div>
          <div>
            <h1 className="text-2xl font-serif font-medium text-zinc-900 dark:text-zinc-50 mb-3">
              Article not found
            </h1>
            <p className="text-zinc-500 dark:text-zinc-400">
              We couldn't find the lesson article you're looking for. It might have been deleted or the ID is incorrect.
            </p>
          </div>
          <Link
            href="/lessons/history"
            className="inline-flex items-center gap-2 px-6 py-3 bg-zinc-900 text-white dark:bg-zinc-50 dark:text-zinc-900 rounded-full font-medium hover:bg-zinc-800 dark:hover:bg-zinc-200 transition-colors"
          >
            <ArrowLeft className="w-4 h-4" />
            Return to Library
          </Link>
        </div>
      </div>
    );
  }

  return <ArticleViewer article={article} />;
}
