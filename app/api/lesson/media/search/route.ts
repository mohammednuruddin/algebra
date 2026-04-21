import { NextRequest, NextResponse } from 'next/server';
import { searchLessonImages } from '@/lib/media/lesson-image-search';

export async function POST(request: NextRequest) {
  try {
    const body = (await request.json()) as {
      topic: string;
      searchQuery?: string;
      lessonObjective?: string;
      milestoneIds?: string[];
      desiredCount?: number;
    };

    if (!body.topic?.trim()) {
      return NextResponse.json(
        { error: 'topic is required' },
        { status: 400 }
      );
    }

    const result = await searchLessonImages({
      topic: body.topic,
      searchQuery: body.searchQuery,
      desiredCount: body.desiredCount,
    });

    return NextResponse.json({
      assets: result.assets.map((asset) => ({
        ...asset,
        type: 'image',
        storagePath: asset.url,
        relatedMilestones: body.milestoneIds || [],
      })),
      candidatesConsidered: result.candidatesConsidered,
    });
  } catch (error) {
    return NextResponse.json(
      {
        error:
          error instanceof Error ? error.message : 'Failed to gather lesson images',
      },
      { status: 500 }
    );
  }
}
