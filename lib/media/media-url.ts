export function resolveLessonImageUrl(src?: string | null) {
  if (!src) {
    return null;
  }

  if (src.startsWith('/')) {
    return src;
  }

  if (/^https?:\/\//i.test(src)) {
    const encoded = encodeURIComponent(src);
    return `/api/media/proxy?url=${encoded}`;
  }

  return src;
}
