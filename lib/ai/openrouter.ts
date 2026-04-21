type OpenRouterContentPart =
  | {
      type: 'text';
      text: string;
    }
  | {
      type: 'image_url';
      image_url: {
        url: string;
        detail?: 'auto' | 'low' | 'high';
      };
    };

type OpenRouterMessage = {
  role: 'system' | 'user' | 'assistant';
  content: string | OpenRouterContentPart[];
};

export type OpenRouterChatRequest = {
  model?: string;
  messages: OpenRouterMessage[];
  temperature?: number;
  max_tokens?: number;
  response_format?: { type: 'json_object' };
};

export function getOpenRouterConfig() {
  const apiKey = process.env.OPENROUTER_API_KEY;

  if (!apiKey) {
    throw new Error('OPENROUTER_API_KEY is not configured');
  }

  return {
    apiKey,
    model: process.env.OPENROUTER_MODEL || 'openai/gpt-4o-mini',
    baseUrl: process.env.OPENROUTER_BASE_URL || 'https://openrouter.ai/api/v1',
    referer: process.env.OPENROUTER_HTTP_REFERER,
    appName: process.env.OPENROUTER_APP_NAME || 'AI Teaching Platform',
  };
}

export function buildOpenRouterRequest(body: OpenRouterChatRequest) {
  const config = getOpenRouterConfig();

  return {
    url: `${config.baseUrl}/chat/completions`,
    headers: {
      Authorization: `Bearer ${config.apiKey}`,
      'Content-Type': 'application/json',
      ...(config.referer ? { 'HTTP-Referer': config.referer } : {}),
      ...(config.appName ? { 'X-OpenRouter-Title': config.appName } : {}),
    },
    body: {
      model: body.model || config.model,
      messages: body.messages,
      temperature: body.temperature ?? 0.3,
      max_tokens: body.max_tokens ?? 1200,
      ...(body.response_format ? { response_format: body.response_format } : {}),
    },
  };
}

export type { OpenRouterMessage, OpenRouterContentPart };
