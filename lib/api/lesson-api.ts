import type { LessonArticleRecord } from '../types/database';
import type {
  LearnerInput,
  LessonPreparationStage,
  LessonPlan,
  MediaAsset,
  SessionStatus,
  SessionSummary,
  TeacherResponse,
} from '../types/lesson';
import {
  appendGuestLessonTurn,
  createGuestLesson,
  getGuestLesson,
  saveGuestLesson,
} from '@/lib/guest/guest-lesson-store';

export interface CreateSessionResponse {
  sessionId: string;
  status: SessionStatus;
  initialResponse: TeacherResponse;
}

export interface SubmitTurnResponse {
  response: TeacherResponse;
  status: SessionStatus;
  isSessionComplete: boolean;
  summary?: SessionSummary;
}

export interface EndSessionResponse {
  summary: SessionSummary;
  status: 'completed';
}

class ApiError extends Error {
  constructor(public status: number, message: string) {
    super(message);
    this.name = 'ApiError';
  }
}

type OpenRouterResponse = {
  choices?: Array<{
    message?: {
      content?: string;
    };
  }>;
  error?: {
    message?: string;
  };
};

type GeneratedTurnResponse = TeacherResponse & {
  nextMilestoneId?: string;
  shouldCompleteLesson?: boolean;
};

type MediaSearchResponse = {
  assets?: MediaAsset[];
};

type PreparationProgressHandler = (stage: LessonPreparationStage) => void;

function normaliseContent(content: string) {
  return content.replace(/^```json\s*/i, '').replace(/\s*```$/, '').trim();
}

function previewJsonForLogs(content: string, limit = 1200) {
  return content.length > limit ? `${content.slice(0, limit)}...` : content;
}

async function fetchChatContent(
  label: string,
  messages: Array<{ role: 'system' | 'user' | 'assistant'; content: string }>
) {
  const response = await fetch('/api/ai/chat', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      messages,
      response_format: { type: 'json_object' },
      temperature: 0.3,
      max_tokens: 1600,
    }),
  });

  const rawBody = await response.text();
  let payload: OpenRouterResponse = {};

  try {
    payload = JSON.parse(rawBody) as OpenRouterResponse;
  } catch (error) {
    console.error(`[lesson-api:${label}] AI gateway returned invalid JSON`, {
      error: error instanceof Error ? error.message : String(error),
      rawBodyPreview: previewJsonForLogs(rawBody),
    });
    throw new ApiError(502, `AI gateway returned invalid JSON during ${label}`);
  }

  if (!response.ok) {
    console.error(`[lesson-api:${label}] AI request failed`, {
      status: response.status,
      errorMessage: payload.error?.message || null,
      rawBodyPreview: previewJsonForLogs(rawBody),
    });
    throw new ApiError(
      response.status,
      payload.error?.message || 'AI request failed'
    );
  }

  const content = payload.choices?.[0]?.message?.content;

  if (!content) {
    console.error(`[lesson-api:${label}] AI returned no content`, {
      rawBodyPreview: previewJsonForLogs(rawBody),
    });
    throw new ApiError(500, 'AI returned no content');
  }

  return content;
}

async function chatJson<T>(
  label: string,
  messages: Array<{ role: 'system' | 'user' | 'assistant'; content: string }>
) {
  const content = await fetchChatContent(label, messages);
  const normalised = normaliseContent(content);

  try {
    return JSON.parse(normalised) as T;
  } catch (error) {
    console.error(`[lesson-api:${label}] Failed to parse AI JSON`, {
      error: error instanceof Error ? error.message : String(error),
      contentLength: content.length,
      normalisedPreview: previewJsonForLogs(normalised),
    });

    const repairedContent = await fetchChatContent(`${label}:repair`, [
      ...messages,
      { role: 'assistant', content },
      {
        role: 'user',
        content:
          'Your previous response was invalid JSON. Return ONLY corrected valid JSON matching the required schema. No markdown fences. No explanation.',
      },
    ]);

    const repairedNormalised = normaliseContent(repairedContent);

    try {
      return JSON.parse(repairedNormalised) as T;
    } catch (repairError) {
      console.error(`[lesson-api:${label}] Failed to parse repaired AI JSON`, {
        error: repairError instanceof Error ? repairError.message : String(repairError),
        contentLength: repairedContent.length,
        repairedPreview: previewJsonForLogs(repairedNormalised),
      });
      throw new ApiError(500, `AI returned invalid JSON during ${label}`);
    }
  }
}

function buildInitialTeacherResponse(
  plan: LessonPlan,
  mediaAssets: MediaAsset[]
): TeacherResponse {
  const firstMilestone = plan.milestones[0];
  const firstImage = mediaAssets[0];

  return {
    speech: `We are learning ${plan.topic}. We will start with ${firstMilestone?.title || 'the first concept'}. ${firstMilestone?.description || ''}${firstImage ? ' I have a visual ready on the board for us to use.' : ''}`.trim(),
    displayText: `Let's begin with ${firstMilestone?.title || plan.topic}.`,
    actions: [
      {
        type: 'speak',
        params: {
          text: `We are learning ${plan.topic}.`,
        },
        sequenceOrder: 1,
      },
      {
        type: 'display_text',
        params: {
          text: `Goal: ${plan.objective}`,
        },
        sequenceOrder: 2,
      },
      ...(firstImage
        ? [
            {
              type: 'show_media' as const,
              params: {
                mediaId: firstImage.id,
                title: firstImage.altText,
              },
              sequenceOrder: 3,
            },
          ]
        : []),
    ],
    awaitedInputMode: 'voice',
    currentMilestoneId: firstMilestone?.id || 'm1',
    feedback: {
      type: 'neutral',
      message: 'Lesson started',
    },
  };
}

async function gatherLessonMedia(
  topicPrompt: string,
  plan: LessonPlan,
  onProgress?: PreparationProgressHandler
): Promise<MediaAsset[]> {
  if (!plan.visualsNeeded) {
    onProgress?.({
      id: 'media_search',
      label: 'Media search',
      detail: 'This lesson does not need a prepared visual.',
      status: 'completed',
    });
    return [];
  }

  onProgress?.({
    id: 'media_search',
    label: 'Media search',
    detail: `Searching for visuals for ${plan.topic}.`,
    status: 'active',
  });

  const response = await fetch('/api/lesson/media/search', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      topic: plan.topic,
      searchQuery: topicPrompt,
      lessonObjective: plan.objective,
      milestoneIds: plan.milestones.slice(0, 2).map((milestone) => milestone.id),
      desiredCount:
        plan.difficulty === 'advanced'
          ? 3
          : plan.topic.toLowerCase().includes('photosynthesis')
          ? 2
          : 1,
    }),
  });

  if (!response.ok) {
    onProgress?.({
      id: 'media_search',
      label: 'Media search',
      detail: 'Visual search failed, so the lesson will continue without prepared images.',
      status: 'error',
    });
    return [];
  }

  const payload = (await response.json()) as MediaSearchResponse;
  const assets = payload.assets || [];
  onProgress?.({
    id: 'media_analysis',
    label: 'Media analysis',
    detail:
      assets.length > 0
        ? `Prepared ${assets.length} visual${assets.length === 1 ? '' : 's'} for the board.`
        : 'No strong visuals were selected for this lesson.',
    status: 'completed',
  });
  return assets;
}

async function generateLessonPlan(topicPrompt: string) {
  return chatJson<LessonPlan>('lesson-plan', [
    {
      role: 'system',
      content:
        'You are an expert lesson planner. Return valid JSON only. Create a lesson plan with keys topic, normalizedTopic, objective, milestones, concepts, estimatedDuration, difficulty, visualsNeeded, interactiveMoments. Milestones need id, title, description, required, successCriteria, estimatedDuration. Concepts need id, name, description, relatedMilestones, misconceptions. interactiveMoments need id, type, milestoneId, prompt, expectedResponseType.',
    },
    {
      role: 'user',
      content: `Create a beginner-friendly lesson plan for this topic: ${topicPrompt}`,
    },
  ]);
}

function findCurrentMilestoneIndex(plan: LessonPlan, milestoneId: string | null) {
  if (!milestoneId) {
    return 0;
  }

  const index = plan.milestones.findIndex((milestone) => milestone.id === milestoneId);
  return index >= 0 ? index : 0;
}

function formatLearnerInput(input: LearnerInput) {
  if (input.raw.text) {
    return input.raw.text;
  }

  if (input.interpreted?.text) {
    return input.interpreted.text;
  }

  if (input.interpreted?.markings?.length) {
    return JSON.stringify(input.interpreted.markings);
  }

  return `Learner submitted ${input.mode}`;
}

async function generateTeacherTurn(
  plan: LessonPlan,
  currentMilestoneId: string,
  turns: Array<{ actor: 'learner' | 'teacher'; payload: unknown }>,
  mediaAssets: MediaAsset[],
  learnerInput: LearnerInput
): Promise<GeneratedTurnResponse> {
  const currentMilestone =
    plan.milestones.find((milestone) => milestone.id === currentMilestoneId) ??
    plan.milestones[0];

  const recentTurns = turns
    .slice(-6)
    .map((turn) => `${turn.actor}: ${JSON.stringify(turn.payload)}`)
    .join('\n');

  const mediaContext = mediaAssets
    .map((asset) =>
      `${asset.id}: ${asset.altText} | ${asset.description} | source=${asset.source || 'unknown'} | metadata=${JSON.stringify(asset.metadata || {})}`
    )
    .join('\n');

  return chatJson<GeneratedTurnResponse>('teacher-turn', [
    {
      role: 'system',
      content:
        'You are an interactive teacher. Return valid JSON only with keys speech, displayText, actions, awaitedInputMode, currentMilestoneId, isCorrectAnswer, feedback, nextMilestoneId, shouldCompleteLesson. actions must be an array of { type, params, sequenceOrder }. Keep tone encouraging and concise. Use only these action types: speak, display_text, provide_feedback, advance_milestone, highlight_concept, show_media.',
    },
    {
      role: 'user',
      content: `Lesson topic: ${plan.topic}
Objective: ${plan.objective}
Current milestone: ${currentMilestone.id} - ${currentMilestone.title}
Milestone description: ${currentMilestone.description}
Milestone success criteria: ${currentMilestone.successCriteria.join('; ')}
All milestones: ${plan.milestones.map((milestone) => `${milestone.id}:${milestone.title}`).join(', ')}
Available media:
${mediaContext || 'none'}
Current learner input:
${JSON.stringify(learnerInput)}
Recent turns:
${recentTurns || 'none'}

Respond with the next teacher turn. If the learner has demonstrated enough understanding, set nextMilestoneId to the next milestone id. Only set shouldCompleteLesson true when the lesson should end now. If a visual is useful, use a show_media action referencing a real mediaId from the available media list.`,
    },
  ]);
}

function buildSummary(sessionId: string) {
  const lesson = getGuestLesson(sessionId);
  if (!lesson || !lesson.lessonPlan) {
    throw new ApiError(404, 'Lesson session not found');
  }

  const totalMilestones = lesson.lessonPlan.milestones.length;
  const currentIndex = findCurrentMilestoneIndex(
    lesson.lessonPlan,
    lesson.currentMilestoneId
  );
  const completedMilestones =
    lesson.status === 'complete'
      ? totalMilestones
      : Math.min(currentIndex + 1, totalMilestones);
  const duration = Math.max(
    1,
    Math.round(
      (new Date().getTime() - new Date(lesson.createdAt).getTime()) / 60000
    )
  );

  const keyTakeaways = lesson.lessonPlan.milestones
    .slice(0, completedMilestones)
    .map((milestone) => milestone.title);

  const summary: SessionSummary = {
    topic: lesson.lessonPlan.topic,
    duration,
    milestonesCompleted: completedMilestones,
    milestonesTotal: totalMilestones,
    accuracy: 100,
    strengths: ['Stayed engaged with the lesson'],
    areasForImprovement:
      completedMilestones < totalMilestones
        ? ['Continue the remaining milestones for full coverage']
        : [],
    nextSteps: ['Review the summary article and try another topic'],
    keyTakeaways,
  };

  return summary;
}

function buildArticle(sessionId: string, summary: SessionSummary) {
  const lesson = getGuestLesson(sessionId);
  if (!lesson || !lesson.lessonPlan) {
    throw new ApiError(404, 'Lesson session not found');
  }

  const articleId = lesson.article?.id || lesson.id;
  const keyTakeaways = summary.keyTakeaways.map((item) => `- ${item}`).join('\n');
  const milestones = lesson.lessonPlan.milestones
    .map(
      (milestone, index) =>
        `## ${index + 1}. ${milestone.title}\n\n${milestone.description}\n\nSuccess criteria:\n${milestone.successCriteria.map((criterion) => `- ${criterion}`).join('\n')}`
    )
    .join('\n\n');

  const recentDialogue = lesson.turns
    .slice(-6)
    .map((turn) => `- **${turn.actor}**: ${JSON.stringify(turn.payload)}`)
    .join('\n');

  const article: LessonArticleRecord = {
    id: articleId,
    session_id: lesson.id,
    user_id: lesson.guestId,
    title: `Lesson Notes: ${lesson.lessonPlan.topic}`,
    article_markdown: `# ${lesson.lessonPlan.topic}

## Objective

${lesson.lessonPlan.objective}

## Key Takeaways

${keyTakeaways || '- Lesson completed'}

## Milestones

${milestones}

## Recent Dialogue

${recentDialogue || '- No dialogue recorded'}
`,
    article_storage_path: `guest/${lesson.guestId}/${lesson.id}/article.md`,
    metadata_json: {
      topic: lesson.lessonPlan.topic,
      duration: summary.duration * 60,
      milestones_covered: summary.milestonesCompleted,
      total_milestones: summary.milestonesTotal,
      completion_percentage: Math.round(
        (summary.milestonesCompleted / Math.max(summary.milestonesTotal, 1)) * 100
      ),
      difficulty: lesson.lessonPlan.difficulty,
      date: new Date().toISOString(),
      first_image_url: lesson.mediaAssets[0]?.url,
    },
    created_at: lesson.article?.created_at || new Date().toISOString(),
    updated_at: new Date().toISOString(),
  };

  return article;
}

/**
 * Creates a new lesson session for a given topic or prompt.
 */
export async function createSession(
  topicPrompt: string,
  onProgress?: PreparationProgressHandler
): Promise<CreateSessionResponse> {
  onProgress?.({
    id: 'session',
    label: 'Session',
    detail: 'Opening a fresh guest lesson session.',
    status: 'active',
  });
  const session = createGuestLesson(topicPrompt);
  saveGuestLesson(session);
  onProgress?.({
    id: 'session',
    label: 'Session',
    detail: 'Guest lesson session created.',
    status: 'completed',
  });

  onProgress?.({
    id: 'planning',
    label: 'Lesson planning',
    detail: `Building a lesson plan for "${topicPrompt}".`,
    status: 'active',
  });
  const lessonPlan = await generateLessonPlan(topicPrompt);
  onProgress?.({
    id: 'planning',
    label: 'Lesson planning',
    detail: `Plan ready: ${lessonPlan.milestones.length} milestones for ${lessonPlan.topic}.`,
    status: 'completed',
  });

  const mediaAssets = await gatherLessonMedia(topicPrompt, lessonPlan, onProgress);

  onProgress?.({
    id: 'initializing',
    label: 'Tutor initialization',
    detail: 'Preparing the first teacher turn and board state.',
    status: 'active',
  });
  const initialResponse = buildInitialTeacherResponse(lessonPlan, mediaAssets);

  saveGuestLesson({
    ...session,
    title: lessonPlan.topic,
    status: 'active',
    lessonPlan,
    mediaAssets,
    activeImageId: mediaAssets[0]?.id || null,
    currentMilestoneId: initialResponse.currentMilestoneId,
    lastResponse: initialResponse,
    turns: [
      {
        actor: 'teacher',
        createdAt: new Date().toISOString(),
        payload: initialResponse,
      },
    ],
  });

  onProgress?.({
    id: 'ready',
    label: 'Ready',
    detail: 'Lesson prepared. Opening the tutor.',
    status: 'completed',
  });

  return {
    sessionId: session.id,
    status: 'active',
    initialResponse,
  };
}

/**
 * Submits a learner's input turn to the active session.
 */
export async function submitTurn(
  sessionId: string,
  input: LearnerInput
): Promise<SubmitTurnResponse> {
  const lesson = getGuestLesson(sessionId);

  if (!lesson || !lesson.lessonPlan) {
    throw new ApiError(404, 'No active session');
  }

  const learnerTurn = {
    actor: 'learner' as const,
    createdAt: new Date().toISOString(),
    payload: {
      mode: input.mode,
      content: formatLearnerInput(input),
    },
  };

  const updatedLesson = appendGuestLessonTurn(sessionId, learnerTurn);

  if (!updatedLesson || !updatedLesson.lessonPlan) {
    throw new ApiError(404, 'No active session');
  }

  const aiResponse = await generateTeacherTurn(
    updatedLesson.lessonPlan,
    updatedLesson.currentMilestoneId || updatedLesson.lessonPlan.milestones[0]?.id || 'm1',
    updatedLesson.turns.map((turn) => ({
      actor: turn.actor,
      payload: turn.payload,
    })),
    updatedLesson.mediaAssets,
    input
  );

  const nextMilestoneId =
    aiResponse.nextMilestoneId || aiResponse.currentMilestoneId || updatedLesson.currentMilestoneId;
  const isComplete = Boolean(aiResponse.shouldCompleteLesson);
  const nextStatus: 'active' | 'complete' = isComplete ? 'complete' : 'active';
  const showMediaAction = aiResponse.actions.find((action) => action.type === 'show_media');
  const nextActiveImageId =
    typeof showMediaAction?.params?.mediaId === 'string'
      ? (showMediaAction.params.mediaId as string)
      : updatedLesson.activeImageId;

  const nextLessonState = {
    ...updatedLesson,
    activeImageId: nextActiveImageId,
    currentMilestoneId: nextMilestoneId || updatedLesson.currentMilestoneId,
    lastResponse: aiResponse,
    status: nextStatus,
    turns: [
      ...updatedLesson.turns,
      {
        actor: 'teacher' as const,
        createdAt: new Date().toISOString(),
        payload: aiResponse,
      },
    ],
  };

  let summary: SessionSummary | undefined;

  if (isComplete) {
    summary = buildSummary(sessionId);
    nextLessonState.summary = summary;
    nextLessonState.article = buildArticle(sessionId, summary);
  }

  saveGuestLesson(nextLessonState);

  return {
    response: aiResponse,
    status: isComplete ? 'completed' : 'active',
    isSessionComplete: isComplete,
    ...(summary ? { summary } : {}),
  };
}

/**
 * Ends the lesson session and retrieves the final summary.
 */
export async function endSession(sessionId: string): Promise<EndSessionResponse> {
  const lesson = getGuestLesson(sessionId);

  if (!lesson || !lesson.lessonPlan) {
    throw new ApiError(404, 'Lesson session not found');
  }

  const summary = buildSummary(sessionId);
  const article = buildArticle(sessionId, summary);

  saveGuestLesson({
    ...lesson,
    status: 'complete',
    summary,
    article,
  });

  return {
    summary,
    status: 'completed',
  };
}
