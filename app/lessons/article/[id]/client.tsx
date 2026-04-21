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
    <div className="min-h-screen bg-zinc-50 dark:bg-zinc-900">
      <header className="bg-white dark:bg-zinc-800 border-b border-zinc-200 dark:border-zinc-700">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
          <Link
            href="/lessons/history"
            className="inline-flex items-center gap-2 text-sm text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-50 transition-colors"
          >
            <ArrowLeft className="w-4 h-4" />
            Back to Lesson History
          </Link>
        </div>
      </header>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="grid grid-cols-1 lg:grid-cols-4 gap-8">
          <div className="lg:col-span-3">
            <article
              id="article-content"
              className="bg-white dark:bg-zinc-800 rounded-lg border border-zinc-200 dark:border-zinc-700 p-8"
            >
              <h1 className="text-3xl font-bold text-zinc-900 dark:text-zinc-50 mb-6">
                {article.title}
              </h1>

              <div className="flex gap-3 mb-6">
                <button
                  onClick={handleDownloadPDF}
                  disabled={isDownloading}
                  className="inline-flex items-center gap-2 px-4 py-2 text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 disabled:bg-blue-400 disabled:cursor-not-allowed rounded-lg transition-colors"
                >
                  <Download className="w-4 h-4" />
                  {isDownloading ? 'Generating PDF...' : 'Download as PDF'}
                </button>

                <button
                  onClick={handleShareLink}
                  className="inline-flex items-center gap-2 px-4 py-2 text-sm font-medium text-zinc-700 dark:text-zinc-300 bg-zinc-100 dark:bg-zinc-700 hover:bg-zinc-200 dark:hover:bg-zinc-600 rounded-lg transition-colors"
                >
                  {isCopied ? (
                    <>
                      <Check className="w-4 h-4" />
                      Link Copied!
                    </>
                  ) : (
                    <>
                      <Share2 className="w-4 h-4" />
                      Share Link
                    </>
                  )}
                </button>
              </div>

              <div className="prose dark:prose-invert max-w-none">
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
                        className="rounded-lg max-w-full h-auto"
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

          <aside className="lg:col-span-1">
            <div className="bg-white dark:bg-zinc-800 rounded-lg border border-zinc-200 dark:border-zinc-700 p-6 sticky top-8">
              <h2 className="text-lg font-semibold text-zinc-900 dark:text-zinc-50 mb-4">
                Lesson Details
              </h2>

              <div className="space-y-4">
                {metadata?.topic && (
                  <div>
                    <div className="flex items-center gap-2 text-sm text-zinc-600 dark:text-zinc-400 mb-1">
                      <Target className="w-4 h-4" />
                      <span className="font-medium">Topic</span>
                    </div>
                    <p className="text-sm text-zinc-900 dark:text-zinc-50 ml-6">
                      {metadata.topic}
                    </p>
                  </div>
                )}

                <div>
                  <div className="flex items-center gap-2 text-sm text-zinc-600 dark:text-zinc-400 mb-1">
                    <Calendar className="w-4 h-4" />
                    <span className="font-medium">Date</span>
                  </div>
                  <p className="text-sm text-zinc-900 dark:text-zinc-50 ml-6">
                    {formatDate(metadata?.date)}
                  </p>
                </div>

                <div>
                  <div className="flex items-center gap-2 text-sm text-zinc-600 dark:text-zinc-400 mb-1">
                    <Clock className="w-4 h-4" />
                    <span className="font-medium">Duration</span>
                  </div>
                  <p className="text-sm text-zinc-900 dark:text-zinc-50 ml-6">
                    {formatDuration(metadata?.duration)}
                  </p>
                </div>

                <div>
                  <div className="flex items-center gap-2 text-sm text-zinc-600 dark:text-zinc-400 mb-1">
                    <CheckCircle2 className="w-4 h-4" />
                    <span className="font-medium">Milestones</span>
                  </div>
                  <p className="text-sm text-zinc-900 dark:text-zinc-50 ml-6">
                    {metadata?.milestones_covered ?? 0} / {metadata?.total_milestones ?? 0} completed
                  </p>
                </div>

                {metadata?.completion_percentage !== undefined && (
                  <div>
                    <div className="text-sm text-zinc-600 dark:text-zinc-400 mb-2">
                      Completion
                    </div>
                    <div className="ml-6">
                      <div className="flex items-center justify-between text-sm mb-1">
                        <span className="text-zinc-900 dark:text-zinc-50 font-medium">
                          {Math.round(metadata.completion_percentage)}%
                        </span>
                      </div>
                      <div className="w-full bg-zinc-200 dark:bg-zinc-700 rounded-full h-2">
                        <div
                          className="bg-blue-600 h-2 rounded-full transition-all"
                          style={{ width: `${metadata.completion_percentage}%` }}
                        />
                      </div>
                    </div>
                  </div>
                )}
              </div>

              <div className="mt-6 pt-6 border-t border-zinc-200 dark:border-zinc-700">
                <Link
                  href="/lessons/history"
                  className="flex items-center justify-center gap-2 w-full px-4 py-2 text-sm font-medium text-zinc-700 dark:text-zinc-300 bg-zinc-100 dark:bg-zinc-700 hover:bg-zinc-200 dark:hover:bg-zinc-600 rounded-lg transition-colors"
                >
                  <ArrowLeft className="w-4 h-4" />
                  All Lessons
                </Link>
              </div>
            </div>
          </aside>
        </div>
      </div>
    </div>
  );
}

export function GuestArticlePage({ articleId }: { articleId: string }) {
  const article = useMemo(() => getGuestArticle(articleId), [articleId]);

  if (!article) {
    return (
      <div className="min-h-screen bg-zinc-50 dark:bg-zinc-900 flex items-center justify-center px-4">
        <div className="max-w-md text-center space-y-4">
          <h1 className="text-2xl font-bold text-zinc-900 dark:text-zinc-50">
            Lesson article not found
          </h1>
          <p className="text-zinc-600 dark:text-zinc-400">
            This browser does not have a saved article with that id yet.
          </p>
          <Link
            href="/lessons/history"
            className="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
          >
            <ArrowLeft className="w-4 h-4" />
            Back to Lesson History
          </Link>
        </div>
      </div>
    );
  }

  return <ArticleViewer article={article} />;
}
