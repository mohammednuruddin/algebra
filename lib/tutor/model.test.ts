import { beforeEach, describe, expect, it, vi } from 'vitest';

import { buildOpenRouterRequest } from '@/lib/ai/openrouter';
import {
  generateInitialTutorResponse,
  generateLessonPreparation,
  generateTutorIntakeTurn,
  generateTutorTurn,
} from './model';

vi.mock('@/lib/ai/openrouter', () => ({
  buildOpenRouterRequest: vi.fn(() => ({
    url: 'https://example.com/chat/completions',
    headers: {
      'Content-Type': 'application/json',
    },
    body: {},
  })),
}));

describe('generateTutorIntakeTurn', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.stubGlobal('fetch', vi.fn());
  });

  it('parses fenced JSON model content with leading whitespace', async () => {
    vi.mocked(fetch).mockResolvedValue(
      new Response(
        JSON.stringify({
          choices: [
            {
              message: {
                content: `
\`\`\`json
{
  "title": "Live tutor",
  "speech": "What would you like to learn today?",
  "helperText": "Answer naturally.",
  "awaitMode": "voice",
  "readyToStartLesson": false,
  "topic": null,
  "learnerLevel": null
}
\`\`\`
`,
              },
            },
          ],
        }),
        {
          status: 200,
          headers: {
            'Content-Type': 'application/json',
          },
        }
      )
    );

    const result = await generateTutorIntakeTurn({
      stage: 'session_create',
      history: [],
      latestUserMessage: null,
      topic: null,
      learnerLevel: null,
    });

    expect(result.response.speech).toBe('What would you like to learn today?');
    expect(result.response.readyToStartLesson).toBe(false);
    expect(result.response).not.toHaveProperty('helperText');
    expect(result.response).not.toHaveProperty('title');
  });

  it('flags invalid awaitMode values instead of treating them as clean output', async () => {
    vi.mocked(fetch).mockResolvedValue(
      new Response(
        JSON.stringify({
          choices: [
            {
              message: {
                content: JSON.stringify({
                  speech: 'What would you like to learn today?',
                  awaitMode: 'open',
                  readyToStartLesson: false,
                  topic: null,
                  learnerLevel: null,
                }),
              },
            },
          ],
        }),
        {
          status: 200,
          headers: {
            'Content-Type': 'application/json',
          },
        }
      )
    );

    const result = await generateTutorIntakeTurn({
      stage: 'turn',
      history: [],
      latestUserMessage: 'Hi.',
      topic: null,
      learnerLevel: null,
    });

    expect(result.response.awaitMode).toBe('voice');
    expect(result.debug.usedFallback).toBe(true);
    expect(result.debug.fallbackReason).toMatch(/awaitmode/i);
  });

  it('does not secretly promote intake readiness when the model itself returned false', async () => {
    vi.mocked(fetch).mockResolvedValue(
      new Response(
        JSON.stringify({
          choices: [
            {
              message: {
                content: JSON.stringify({
                  speech: "Are you learning this for a class or just curiosity?",
                  awaitMode: 'voice',
                  readyToStartLesson: false,
                  topic: 'pollination',
                  learnerLevel: 'beginner',
                }),
              },
            },
          ],
        }),
        {
          status: 200,
          headers: {
            'Content-Type': 'application/json',
          },
        }
      )
    );

    const result = await generateTutorIntakeTurn({
      stage: 'turn',
      history: [],
      latestUserMessage: "I'm new.",
      topic: 'pollination',
      learnerLevel: 'beginner',
    });

    expect(result.response.readyToStartLesson).toBe(false);
  });

  it('tells the intake model to stay brief and avoid motivation interviews', async () => {
    vi.mocked(fetch).mockResolvedValue(
      new Response(
        JSON.stringify({
          choices: [
            {
              message: {
                content: JSON.stringify({
                  speech: 'What would you like to learn today?',
                  awaitMode: 'voice',
                  readyToStartLesson: false,
                  topic: null,
                  learnerLevel: null,
                }),
              },
            },
          ],
        }),
        {
          status: 200,
          headers: {
            'Content-Type': 'application/json',
          },
        }
      )
    );

    await generateTutorIntakeTurn({
      stage: 'session_create',
      history: [],
      latestUserMessage: null,
      topic: null,
      learnerLevel: null,
    });

    const outbound = vi.mocked(buildOpenRouterRequest).mock.calls[0]?.[0];
    const systemPrompt = outbound?.messages?.[0]?.content ?? '';

    expect(systemPrompt).toMatch(/brief|short/i);
    expect(systemPrompt).toMatch(/motivation|class|curiosity/i);
  });

  it('falls back to a usable intake turn when the provider returns no content', async () => {
    vi.mocked(fetch).mockResolvedValue(
      new Response(
        JSON.stringify({
          choices: [
            {
              message: {},
            },
          ],
        }),
        {
          status: 200,
          headers: {
            'Content-Type': 'application/json',
          },
        }
      )
    );

    const result = await generateTutorIntakeTurn({
      stage: 'session_create',
      history: [],
      latestUserMessage: null,
      topic: null,
      learnerLevel: null,
    });

    expect(result.response.speech).toBe('What would you like to learn today?');
    expect(result.response.awaitMode).toBe('voice');
    expect(result.response.readyToStartLesson).toBe(false);
    expect(result.debug.usedFallback).toBe(true);
    expect(result.debug.fallbackReason).toMatch(/no content/i);
  });
});

describe('generateTutorTurn', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.stubGlobal('fetch', vi.fn());
  });

  it('teaches the live tutor which canvas to pick and to avoid pushy hype', async () => {
    vi.mocked(fetch).mockResolvedValue(
      new Response(
        JSON.stringify({
          choices: [
            {
              message: {
                content: JSON.stringify({
                  speech: 'Tap the nucleus on the diagram.',
                  awaitMode: 'voice_or_canvas',
                  sessionComplete: false,
                  canvasAction: 'replace',
                  commands: [],
                }),
              },
            },
          ],
        }),
        {
          status: 200,
          headers: {
            'Content-Type': 'application/json',
          },
        }
      )
    );

    await generateTutorTurn({
      topic: 'photosynthesis',
      learnerLevel: 'beginner',
      outline: ['Identify the chloroplast'],
      imageAssets: [],
      activeImageId: null,
      transcript: 'I am ready.',
      canvasSummary: '',
      canvasStateContext: '',
      latestLearnerTurnContext: '',
      recentTurnFrames: '',
      recentTurns: '',
      canvasTaskPrompt: null,
      canvasReferenceImageUrl: null,
      canvasBrushColor: null,
      canvasEvidence: null,
    });

    const outbound = vi.mocked(buildOpenRouterRequest).mock.calls.at(-1)?.[0];
    const systemPrompt = String(outbound?.messages?.[0]?.content ?? '');

    expect(systemPrompt).toMatch(
      /image_hotspot|timeline|continuous_axis|venn_diagram|token_builder|process_flow/i
    );
    expect(systemPrompt).toMatch(/avoid repetitive hype|let's go/i);
  });

  it('tells the live tutor model to end immediately when the learner explicitly wants to stop', async () => {
    vi.mocked(fetch).mockResolvedValue(
      new Response(
        JSON.stringify({
          choices: [
            {
              message: {
                content: JSON.stringify({
                  speech: 'Alright, we can stop here for today.',
                  awaitMode: 'voice',
                  sessionComplete: true,
                  commands: [{ type: 'complete_session' }],
                }),
              },
            },
          ],
        }),
        {
          status: 200,
          headers: {
            'Content-Type': 'application/json',
          },
        }
      )
    );

    await generateTutorTurn({
      topic: 'Python programming',
      learnerLevel: 'beginner',
      outline: ['Use one concrete example.'],
      imageAssets: [],
      activeImageId: null,
      transcript: "Let's end the lesson.",
      canvasSummary: 'Text response prompt active.',
      recentTurns: 'user: Let us stop now.',
    });

    const outbound = vi.mocked(buildOpenRouterRequest).mock.calls.at(-1)?.[0];
    const systemPrompt = outbound?.messages?.[0]?.content ?? '';

    expect(systemPrompt).toMatch(/if the learner clearly wants to stop|end the lesson|call it a day|be done/i);
    expect(systemPrompt).toMatch(/sessionComplete\s*=\s*true|set sessionComplete true/i);
    expect(systemPrompt).toMatch(/complete_session/i);
  });

  it('tells the live tutor model to offer a one-more-or-call-it-a-day choice after enough progress', async () => {
    vi.mocked(fetch).mockResolvedValue(
      new Response(
        JSON.stringify({
          choices: [
            {
              message: {
                content: JSON.stringify({
                  speech: 'You are getting this. Want one more example or should we call it a day?',
                  awaitMode: 'voice',
                  sessionComplete: false,
                  commands: [],
                }),
              },
            },
          ],
        }),
        {
          status: 200,
          headers: {
            'Content-Type': 'application/json',
          },
        }
      )
    );

    await generateTutorTurn({
      topic: 'Python programming',
      learnerLevel: 'beginner',
      outline: ['Check understanding out loud.'],
      imageAssets: [],
      activeImageId: null,
      transcript: 'I think I get it now.',
      canvasSummary: 'Fill-in-the-blank answered correctly.',
      recentTurns: 'user: big\ntutor: Correct, because 7 is greater than 5.',
    });

    const outbound = vi.mocked(buildOpenRouterRequest).mock.calls.at(-1)?.[0];
    const systemPrompt = outbound?.messages?.[0]?.content ?? '';

    expect(systemPrompt).toMatch(/one more example|call it a day|continue or stop/i);
    expect(systemPrompt).toMatch(/sessionComplete=false|sessionComplete should stay false/i);
  });

  it('tells the live tutor model that image-only or speech-only turns are valid and must not spawn unrelated tasks', async () => {
    vi.mocked(fetch).mockResolvedValue(
      new Response(
        JSON.stringify({
          choices: [
            {
              message: {
                content: JSON.stringify({
                  speech: 'Look at this diagram with me.',
                  awaitMode: 'voice_or_canvas',
                  sessionComplete: false,
                  commands: [{ type: 'show_image', imageId: 'media_1' }],
                }),
              },
            },
          ],
        }),
        {
          status: 200,
          headers: {
            'Content-Type': 'application/json',
          },
        }
      )
    );

    await generateTutorTurn({
      topic: 'photosynthesis',
      learnerLevel: 'beginner',
      outline: ['Use one concrete example.'],
      imageAssets: [],
      activeImageId: null,
      transcript: 'Okay.',
      canvasSummary: 'No active canvas.',
      recentTurns: 'tutor: Look at the arrows in the diagram.',
    });

    const outbound = vi.mocked(buildOpenRouterRequest).mock.calls.at(-1)?.[0];
    const systemPrompt = outbound?.messages?.[0]?.content ?? '';

    expect(systemPrompt).toMatch(/not compulsory to always show something|just be talking|commands can be empty/i);
    expect(systemPrompt).toMatch(/if you ask the learner to look at an image|do not spawn an unrelated/i);
    expect(systemPrompt).toMatch(/canvasAction/i);
    expect(systemPrompt).toMatch(/keep|replace|clear/i);
    expect(systemPrompt).toMatch(/which color to use|brushcolor|red pen/i);
    expect(systemPrompt).not.toMatch(/set_headline|set_instruction/i);
  });

  it('tells the live tutor model to judge the learner exact answer and direct attention to already shown visuals', async () => {
    vi.mocked(fetch).mockResolvedValue(
      new Response(
        JSON.stringify({
          choices: [
            {
              message: {
                content: JSON.stringify({
                  speech: 'Blue is less likely here, so look at the board with me.',
                  awaitMode: 'voice_or_canvas',
                  sessionComplete: false,
                  commands: [],
                }),
              },
            },
          ],
        }),
        {
          status: 200,
          headers: {
            'Content-Type': 'application/json',
          },
        }
      )
    );

    await generateTutorTurn({
      topic: 'probability',
      learnerLevel: 'beginner',
      outline: ['Use one concrete example.', 'Check understanding out loud.'],
      imageAssets: [],
      activeImageId: null,
      transcript: 'Blue',
      canvasSummary: 'Part-whole board active.',
      recentTurns:
        'tutor: There are 3 red marbles and 2 blue marbles. Which color is more likely?\nuser: Blue',
    });

    const outbound = vi.mocked(buildOpenRouterRequest).mock.calls.at(-1)?.[0];
    const systemPrompt = String(outbound?.messages?.[0]?.content ?? '');

    expect(systemPrompt).toMatch(/judge the exact answer they gave|do not rewrite/i);
    expect(systemPrompt).toMatch(/blue.*red|red.*blue/i);
    expect(systemPrompt).toMatch(/already on screen|tell them where to look|do not ask whether they want to see/i);
    expect(systemPrompt).toMatch(/set_tokens.*distribution|set_tokens.*token_builder/i);
    expect(systemPrompt).toMatch(/part_whole_builder.*filled segments|part_whole_builder.*not.*drag/i);
  });

  it('sends marked-image evidence back to the tutor model as a multimodal message', async () => {
    vi.mocked(fetch).mockResolvedValue(
      new Response(
        JSON.stringify({
          choices: [
            {
              message: {
                content: JSON.stringify({
                  speech: 'Nice. You marked the anther correctly.',
                  awaitMode: 'voice',
                  sessionComplete: false,
                  commands: [],
                }),
              },
            },
          ],
        }),
        {
          status: 200,
          headers: {
            'Content-Type': 'application/json',
          },
        }
      )
    );

    await generateTutorTurn({
      topic: 'pollination',
      learnerLevel: 'beginner',
      outline: ['Use one concrete example.'],
      imageAssets: [
        {
          id: 'img-1',
          url: 'https://example.com/flower.png',
          altText: 'Flower diagram',
          description: 'Pollination diagram',
        },
      ],
      activeImageId: 'img-1',
      transcript: 'I marked the anther.',
      canvasSummary: 'Drawing canvas submitted.',
      recentTurns: 'tutor: Point to the anther on the flower.',
      canvasTaskPrompt: 'Use the red pen to circle the anther.',
      canvasReferenceImageUrl: 'https://example.com/flower.png',
      canvasBrushColor: '#FF3B30',
      canvasEvidence: {
        mode: 'drawing',
        summary: 'Learner submitted a marked flower diagram.',
        dataUrl: 'data:image/png;base64,abc123',
        overlayDataUrl: 'data:image/png;base64,overlay123',
        strokeColors: ['#FF3B30'],
        strokeCount: 1,
      },
    });

    const outbound = vi.mocked(buildOpenRouterRequest).mock.calls.at(-1)?.[0];
    const userMessage = outbound?.messages?.[1];
    const textPart = Array.isArray(userMessage?.content)
      ? userMessage?.content.find((part) => part.type === 'text')
      : null;

    expect(Array.isArray(userMessage?.content)).toBe(true);
    expect(textPart).toEqual(
      expect.objectContaining({
        type: 'text',
        text: expect.stringMatching(/learner's marked-up composite answer image|Current drawing task|Expected learner markup color|markup-only overlay/i),
      })
    );
    expect(userMessage?.content).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ type: 'text' }),
        expect.objectContaining({
          type: 'image_url',
          image_url: expect.objectContaining({
            url: 'https://example.com/flower.png',
          }),
        }),
        expect.objectContaining({
          type: 'image_url',
          image_url: expect.objectContaining({
            url: 'data:image/png;base64,abc123',
          }),
        }),
        expect.objectContaining({
          type: 'image_url',
          image_url: expect.objectContaining({
            url: 'data:image/png;base64,overlay123',
          }),
        }),
      ])
    );
  });

  it('ignores invalid set_mode commands instead of forcing distribution mode', async () => {
    vi.mocked(fetch).mockResolvedValue(
      new Response(
        JSON.stringify({
          choices: [
            {
              message: {
                content: JSON.stringify({
                  speech: 'Trace the path on the image.',
                  awaitMode: 'voice_or_canvas',
                  sessionComplete: false,
                  canvasAction: 'keep',
                  commands: [{ type: 'set_mode', value: 'voice_or_canvas' }],
                }),
              },
            },
          ],
        }),
        {
          status: 200,
          headers: {
            'Content-Type': 'application/json',
          },
        }
      )
    );

    const result = await generateTutorTurn({
      topic: 'digestion',
      learnerLevel: 'beginner',
      outline: ['Use one concrete example.'],
      imageAssets: [],
      activeImageId: null,
      transcript: 'Okay.',
      canvasSummary: 'Drawing canvas submitted.',
      recentTurns: 'tutor: Trace the path on the image.',
    });

    expect(result.response.commands).toEqual([]);
  });

  it('includes structured canvas state and structured turn history for learner submissions', async () => {
    vi.mocked(fetch).mockResolvedValue(
      new Response(
        JSON.stringify({
          choices: [
            {
              message: {
                content: JSON.stringify({
                  speech: 'Pollen travels down the style toward the ovary.',
                  awaitMode: 'voice_or_canvas',
                  sessionComplete: false,
                  commands: [],
                }),
              },
            },
          ],
        }),
        {
          status: 200,
          headers: {
            'Content-Type': 'application/json',
          },
        }
      )
    );

    await generateTutorTurn({
      topic: 'Pollination',
      learnerLevel: 'beginner',
      outline: ['Check understanding out loud.'],
      imageAssets: [],
      activeImageId: null,
      transcript: '[Canvas interaction: text_response] {"text":"i dont know"}',
      canvasSummary: 'Text response: What happens next?. Answer: i dont know. Submitted: true.',
      canvasStateContext: JSON.stringify({
        mode: 'text_response',
        prompt: 'What happens next?',
        learnerText: 'i dont know',
        submitted: true,
      }),
      latestLearnerTurnContext: JSON.stringify({
        actor: 'user',
        text: '[Canvas interaction: text_response] {"text":"i dont know"}',
        canvasInteraction: {
          mode: 'text_response',
          text: 'i dont know',
        },
      }),
      recentTurnFrames: JSON.stringify([
        {
          actor: 'user',
          text: 'So it just travels down there so it can reach the ovary.',
        },
        {
          actor: 'tutor',
          text: 'Good question—after pollen lands on the stigma, it travels down the style.',
        },
      ]),
      recentTurns:
        'user: So it just travels down there so it can reach the ovary.\ntutor: Good question—after pollen lands on the stigma, it travels down the style.',
    });

    const outbound = vi.mocked(buildOpenRouterRequest).mock.calls.at(-1)?.[0];
    const userPrompt = outbound?.messages?.[1]?.content;
    const promptText =
      typeof userPrompt === 'string'
        ? userPrompt
        : userPrompt?.find((part) => part.type === 'text')?.text || '';

    expect(promptText).toMatch(/Latest learner turn \(structured JSON\)/i);
    expect(promptText).toMatch(/Current canvas state \(structured JSON\)/i);
    expect(promptText).toMatch(/Recent turn history \(structured JSON, chronological oldest first, newest last\)/i);
    expect(promptText).toMatch(/"learnerText":"i dont know"|"learnerText": "i dont know"/i);
    expect(promptText).toMatch(/"canvasInteraction":\s*\{\s*"mode":\s*"text_response"/i);
  });

  it('tells the live tutor model to sound warm, encouraging, empathetic, and lightly playful', async () => {
    vi.mocked(fetch).mockResolvedValue(
      new Response(
        JSON.stringify({
          choices: [
            {
              message: {
                content: JSON.stringify({
                  speech: 'No worries, we can take it one small step at a time.',
                  awaitMode: 'voice_or_canvas',
                  sessionComplete: false,
                  commands: [],
                }),
              },
            },
          ],
        }),
        {
          status: 200,
          headers: {
            'Content-Type': 'application/json',
          },
        }
      )
    );

    await generateTutorTurn({
      topic: 'Pollination',
      learnerLevel: 'beginner',
      outline: ['Use one concrete example.'],
      imageAssets: [],
      activeImageId: null,
      transcript: 'I do not get it.',
      canvasSummary: 'No active canvas.',
      recentTurns: 'user: I do not get it.',
    });

    const outbound = vi.mocked(buildOpenRouterRequest).mock.calls.at(-1)?.[0];
    const systemPrompt = outbound?.messages?.[0]?.content ?? '';

    expect(systemPrompt).toMatch(/warm, encouraging, emotionally aware/i);
    expect(systemPrompt).toMatch(/kind human coach|lightly playful/i);
    expect(systemPrompt).toMatch(/validate that feeling|lower the pressure/i);
    expect(systemPrompt).toMatch(/avoid robotic|worksheet/i);
  });
});

describe('lesson personality prompts', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.stubGlobal('fetch', vi.fn());
  });

  it('asks lesson preparation to produce a warm, human opening speech', async () => {
    vi.mocked(fetch).mockResolvedValue(
      new Response(
        JSON.stringify({
          choices: [
            {
              message: {
                content: JSON.stringify({
                  openingSpeech: 'Let’s make this feel simple.',
                  outline: ['Start from what the learner already knows.'],
                  imageSearchQuery: 'pollination diagram',
                  desiredImageCount: 1,
                }),
              },
            },
          ],
        }),
        {
          status: 200,
          headers: {
            'Content-Type': 'application/json',
          },
        }
      )
    );

    await generateLessonPreparation({
      topic: 'pollination',
      learnerLevel: 'beginner',
    });

    const outbound = vi.mocked(buildOpenRouterRequest).mock.calls.at(-1)?.[0];
    const systemPrompt = outbound?.messages?.[0]?.content ?? '';

    expect(systemPrompt).toMatch(/warm, encouraging, emotionally aware/i);
    expect(systemPrompt).toMatch(/openingSpeech should already sound warm, welcoming, and human/i);
  });

  it('passes prior lesson continuation context into lesson preparation prompts', async () => {
    vi.mocked(fetch).mockResolvedValue(
      new Response(
        JSON.stringify({
          choices: [
            {
              message: {
                content: JSON.stringify({
                  openingSpeech: 'We are picking up from the tricky part.',
                  outline: ['Resume with one labeling rep.'],
                  imageSearchQuery: 'pollination flower diagram',
                  desiredImageCount: 1,
                }),
              },
            },
          ],
        }),
        {
          status: 200,
          headers: {
            'Content-Type': 'application/json',
          },
        }
      )
    );

    await generateLessonPreparation({
      topic: 'pollination',
      learnerLevel: 'beginner',
      continuationContext: {
        sourceSessionId: 'session-old',
        sourceArticleId: 'article-1',
        topic: 'pollination',
        learnerLevel: 'beginner',
        outline: ['Review the flower parts.'],
        turns: [
          {
            actor: 'user',
            text: 'I still mix up anther and stigma.',
            createdAt: '2026-04-22T10:00:00.000Z',
          },
        ],
        mediaAssets: [],
        activeImageId: null,
        canvasSummary: 'No board task remained active.',
        canvas: {
          mode: 'distribution',
          headline: 'Tutor workspace',
          instruction: 'Listen and respond.',
          tokens: [],
          zones: [],
          equation: null,
          fillBlank: null,
          codeBlock: null,
          multipleChoice: null,
          numberLine: null,
          tableGrid: null,
          graphPlot: null,
          matchingPairs: null,
          ordering: null,
          textResponse: null,
          drawing: null,
        },
        strengths: ['Understands the big picture.'],
        weaknesses: ['Still mixes up anther and stigma.'],
        recommendedNextSteps: ['Resume with flower-part labeling.'],
        resumeHint: 'Do not restart from zero; resume from flower-part labeling.',
        completedAt: '2026-04-22T10:05:00.000Z',
      },
    });

    const outbound = vi.mocked(buildOpenRouterRequest).mock.calls.at(-1)?.[0];
    const userPrompt = outbound?.messages?.[1]?.content ?? '';

    expect(userPrompt).toMatch(/continuation|prior lesson|resume/i);
    expect(userPrompt).toMatch(/strengths/i);
    expect(userPrompt).toMatch(/weaknesses/i);
    expect(userPrompt).toMatch(/anther and stigma/i);
  });

  it('gives the opening live tutor turn the same warm Zo-like personality contract', async () => {
    vi.mocked(fetch).mockResolvedValue(
      new Response(
        JSON.stringify({
          choices: [
            {
              message: {
                content: JSON.stringify({
                  speech: 'Let’s figure this out together.',
                  awaitMode: 'voice_or_canvas',
                  sessionComplete: false,
                  canvasAction: 'keep',
                  commands: [],
                }),
              },
            },
          ],
        }),
        {
          status: 200,
          headers: {
            'Content-Type': 'application/json',
          },
        }
      )
    );

    await generateInitialTutorResponse({
      topic: 'pollination',
      learnerLevel: 'beginner',
      outline: ['Use one concrete example.'],
      imageAssets: [],
      openingSpeech: 'Let’s explore pollination together.',
    });

    const outbound = vi.mocked(buildOpenRouterRequest).mock.calls.at(-1)?.[0];
    const systemPrompt = outbound?.messages?.[0]?.content ?? '';

    expect(systemPrompt).toMatch(/warm, encouraging, emotionally aware/i);
    expect(systemPrompt).toMatch(/kind human coach|lightly playful/i);
    expect(systemPrompt).toMatch(/avoid robotic|worksheet/i);
  });
});
