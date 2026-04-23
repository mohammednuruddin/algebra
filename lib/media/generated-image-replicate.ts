import { createHmac, timingSafeEqual } from 'node:crypto';

export type ReplicatePredictionStatus = 'starting' | 'processing' | 'succeeded' | 'failed' | 'canceled';

export type CreateReplicatePredictionBaseInput = {
  prompt: string;
  webhookUrl: string;
  aspectRatio?: '1:1' | '3:2' | '2:3';
  outputFormat?: 'webp' | 'png' | 'jpeg';
};

export type CreateReplicateGeneratePredictionInput = CreateReplicatePredictionBaseInput & {
  mode: 'generate';
  inputImages?: never;
};

export type CreateReplicateEditPredictionInput = CreateReplicatePredictionBaseInput & {
  mode: 'edit';
  inputImages: string[];
};

export type CreateReplicatePredictionInput =
  | CreateReplicateGeneratePredictionInput
  | CreateReplicateEditPredictionInput;

export type CreateReplicatePredictionResponse = {
  id: string;
  [key: string]: unknown;
};

export type ReplicateWebhookPayload = {
  id: string;
  status: ReplicatePredictionStatus;
  output?: unknown;
  error?: string | null;
  [key: string]: unknown;
};

const REPLICATE_PREDICTION_URL = 'https://api.replicate.com/v1/models/openai/gpt-image-2/predictions';
const REPLICATE_WEBHOOK_TOLERANCE_SECONDS = 5 * 60;

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

function decodeReplicateWebhookSecret(secret: string) {
  const prefix = 'whsec_';

  if (!secret.startsWith(prefix)) {
    throw new Error('REPLICATE_WEBHOOK_SECRET must start with whsec_');
  }

  const decoded = secret.slice(prefix.length);

  if (!decoded) {
    throw new Error('REPLICATE_WEBHOOK_SECRET is empty');
  }

  return decoded;
}

function normalizeWebhookSignatureCandidates(signatureHeader: string) {
  return signatureHeader
    .trim()
    .split(/\s+/)
    .map((candidate) => candidate.split(',', 2)[1] ?? candidate)
    .filter((candidate) => candidate.length > 0);
}

function constantTimeEquals(left: string, right: string) {
  const leftBytes = Buffer.from(left);
  const rightBytes = Buffer.from(right);

  if (leftBytes.length !== rightBytes.length) {
    return false;
  }

  return timingSafeEqual(leftBytes, rightBytes);
}

function isLikelyUrl(value: string) {
  return /^https?:\/\//i.test(value);
}

function extractOutputUrl(value: unknown): string | null {
  if (typeof value === 'string') {
    return isLikelyUrl(value) ? value : null;
  }

  if (Array.isArray(value)) {
    for (const item of value) {
      const url = extractOutputUrl(item);
      if (url) {
        return url;
      }
    }

    return null;
  }

  if (!isRecord(value)) {
    return null;
  }

  for (const key of ['url', 'output', 'image', 'image_url', 'href'] as const) {
    const url = extractOutputUrl(value[key]);
    if (url) {
      return url;
    }
  }

  return null;
}

export function isTerminalReplicatePredictionStatus(
  status: unknown
): status is 'succeeded' | 'failed' | 'canceled' {
  return status === 'succeeded' || status === 'failed' || status === 'canceled';
}

export function getReplicatePredictionOutputUrl(payload: ReplicateWebhookPayload) {
  return extractOutputUrl(payload.output);
}

export function verifyReplicateWebhookSignature(args: {
  rawBody: string;
  webhookId: string;
  webhookTimestamp: string;
  webhookSignature: string;
  secret: string;
  toleranceSeconds?: number;
  now?: number;
}) {
  const toleranceSeconds = args.toleranceSeconds ?? REPLICATE_WEBHOOK_TOLERANCE_SECONDS;
  if (!/^\d+$/.test(args.webhookTimestamp)) {
    return false;
  }

  const timestamp = Number.parseInt(args.webhookTimestamp, 10);

  if (!Number.isFinite(timestamp) || timestamp <= 0) {
    return false;
  }

  const nowSeconds = Math.floor((args.now ?? Date.now()) / 1000);
  if (Math.abs(nowSeconds - timestamp) > toleranceSeconds) {
    return false;
  }

  const signingSecret = decodeReplicateWebhookSecret(args.secret);
  const signedContent = `${args.webhookId}.${args.webhookTimestamp}.${args.rawBody}`;
  const expectedSignature = createHmac('sha256', signingSecret)
    .update(signedContent)
    .digest('base64');

  return normalizeWebhookSignatureCandidates(args.webhookSignature).some((candidate) =>
    constantTimeEquals(candidate, expectedSignature)
  );
}

export async function createReplicatePrediction(args: CreateReplicatePredictionInput) {
  const token = process.env.REPLICATE_API_TOKEN;

  if (!token) {
    throw new Error('REPLICATE_API_TOKEN is not configured');
  }

  if (args.mode === 'generate' && 'inputImages' in args) {
    throw new Error('inputImages can only be used with edit mode');
  }

  const response = await fetch(REPLICATE_PREDICTION_URL, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      input: {
        prompt: args.prompt,
        quality: 'low',
        number_of_images: 1,
        output_format: args.outputFormat ?? 'webp',
        ...(args.mode === 'edit' ? { input_images: args.inputImages } : {}),
        ...(args.aspectRatio ? { aspect_ratio: args.aspectRatio } : {}),
      },
      webhook: args.webhookUrl,
      webhook_events_filter: ['completed'],
    }),
  });

  if (!response.ok) {
    throw new Error(`Replicate prediction failed with status ${response.status}`);
  }

  return (await response.json()) as CreateReplicatePredictionResponse;
}
