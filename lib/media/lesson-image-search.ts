import type { TutorMediaAsset } from '@/lib/types/tutor';

import {
  describeTeachingImage,
  type TeachingImageDescription,
} from './image-analysis';

type SerperImageResult = {
  title?: string;
  imageUrl?: string;
  imageWidth?: number;
  imageHeight?: number;
  thumbnailUrl?: string;
  source?: string;
  domain?: string;
  link?: string;
  position?: number;
};

type SerperResponse = {
  images?: SerperImageResult[];
};

function supportsVisionDescription(imageUrl: string) {
  return !/\.svg(\?|$)/i.test(imageUrl);
}

function buildFallbackDescription(
  candidate: SerperImageResult,
  topic: string
): TeachingImageDescription {
  const title = candidate.title || `${topic} diagram`;

  return {
    summary: `${title} relevant to ${topic}.`,
    imageKind: 'diagram',
    showsProcess: /process|cycle|flow|system|diagram/i.test(title),
    keyObjects: [topic],
    keyRegions: [],
    teachingValueScore: 6,
    childFriendlinessScore: 6,
    clutterScore: 3,
    suggestedUse: 'Use as a visual reference while explaining the main parts.',
    tutorGuidance: ['Point out the main labeled parts on the image.'],
  };
}

async function fetchSerperImages(query: string) {
  const apiKey = process.env.SERPER_API_KEY;

  if (!apiKey) {
    throw new Error('SERPER_API_KEY is not configured');
  }

  const response = await fetch('https://google.serper.dev/images', {
    method: 'POST',
    headers: {
      'X-API-KEY': apiKey,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ q: query }),
  });

  if (!response.ok) {
    throw new Error(`Serper image search failed with status ${response.status}`);
  }

  return (await response.json()) as SerperResponse;
}

function filterImageCandidates(images: SerperImageResult[]) {
  return images
    .filter((image) => image.imageUrl && image.title && image.domain)
    .filter((image) => (image.imageWidth || 0) >= 300 && (image.imageHeight || 0) >= 300)
    .filter((image) => !/pinterest|facebook|instagram|tiktok/i.test(image.domain || ''))
    .slice(0, 6);
}

export async function searchLessonImages(input: {
  topic: string;
  searchQuery?: string;
  desiredCount?: number;
}) {
  const topic = input.topic.trim();
  if (!topic) {
    throw new Error('topic is required');
  }

  const desiredCount = Math.max(0, Math.min(input.desiredCount || 0, 4));
  if (desiredCount === 0) {
    return { assets: [] as TutorMediaAsset[], candidatesConsidered: 0 };
  }

  const searchQuery = input.searchQuery?.trim() || topic;
  const serper = await fetchSerperImages(searchQuery);
  const candidates = filterImageCandidates(serper.images || []);
  const described: Array<{ candidate: SerperImageResult; description: TeachingImageDescription }> =
    [];

  for (const candidate of candidates) {
    if (!supportsVisionDescription(candidate.imageUrl!)) {
      described.push({
        candidate,
        description: buildFallbackDescription(candidate, topic),
      });
      continue;
    }

    try {
      const description = await describeTeachingImage({
        imageUrl: candidate.imageUrl!,
        topic,
      });
      described.push({ candidate, description });
    } catch (error) {
      console.warn('[lesson/image-search] Image description failed', {
        imageUrl: candidate.imageUrl,
        title: candidate.title,
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }

  const assets = described
    .sort((left, right) => {
      const leftScore =
        (left.description.teachingValueScore || 0) -
        (left.description.clutterScore || 0) * 0.5;
      const rightScore =
        (right.description.teachingValueScore || 0) -
        (right.description.clutterScore || 0) * 0.5;
      return rightScore - leftScore;
    })
    .slice(0, desiredCount)
    .map(({ candidate, description }, index): TutorMediaAsset => ({
      id: `media_${index + 1}_${Date.now()}`,
      url: candidate.imageUrl!,
      altText: candidate.title || description.summary,
      description: description.summary,
      thumbnailUrl: candidate.thumbnailUrl,
      source: candidate.source,
      domain: candidate.domain,
      metadata: {
        imageKind: description.imageKind,
        showsProcess: description.showsProcess,
        keyObjects: description.keyObjects,
        keyRegions: description.keyRegions,
        suggestedUse: description.suggestedUse,
        tutorGuidance: description.tutorGuidance,
        teachingValueScore: description.teachingValueScore,
        childFriendlinessScore: description.childFriendlinessScore,
        clutterScore: description.clutterScore,
      },
    }));

  return {
    assets,
    candidatesConsidered: candidates.length,
  };
}
