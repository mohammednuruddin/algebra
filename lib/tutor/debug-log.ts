import type { OpenRouterContentPart } from '@/lib/ai/openrouter';
import type { TutorLlmDebugTrace } from '@/lib/types/tutor';

function truncateUrl(value: string) {
  if (value.startsWith('data:')) {
    const prefix = value.slice(0, 48);
    return `${prefix}… [${value.length} chars]`;
  }

  if (value.length > 240) {
    return `${value.slice(0, 240)}…`;
  }

  return value;
}

function formatContentPart(part: OpenRouterContentPart) {
  if (part.type === 'text') {
    return {
      type: 'text',
      text: part.text,
    };
  }

  return {
    type: 'image_url',
    image_url: {
      url: truncateUrl(part.image_url.url),
      detail: part.image_url.detail ?? null,
    },
  };
}

export function formatTutorDebugMessages(
  messages: TutorLlmDebugTrace['messages']
) {
  return messages.map((message) => ({
    role: message.role,
    content:
      typeof message.content === 'string'
        ? message.content
        : message.content.map(formatContentPart),
  }));
}

export function formatTutorDebugValue(value: unknown) {
  if (typeof value === 'string') {
    return value;
  }

  if (value == null) {
    return value;
  }

  return JSON.stringify(value, null, 2);
}
