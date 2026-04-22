const FILLER_ONLY_PATTERN =
  /^(?:um+|uh+|erm+|er+|ah+|mm+|hmm+|mhm+|uh-huh|huh)[-\s,.;:!?…—]*$/i;
const GREETING_ONLY_PATTERN =
  /^(?:hi|hey|hello|yo|good\s+(?:morning|afternoon|evening))[-\s,.;:!?…—]*$/i;
const TRAILING_CONTINUATION_PATTERN = /(?:-|—|–|…)\s*$/;
const DIRECT_QUESTION_PATTERN =
  /^(?:how|what|why|when|where|who|which|can|could|would|should|is|are|do|does|did|explain|tell me|show me|walk me through|help me understand)\b/i;

export const TUTOR_BARGE_IN_LEVEL = 0.055;

function normalizeTranscript(text: string) {
  return text.trim();
}

export function isMeaningfulTutorTranscript(text: string) {
  const normalized = normalizeTranscript(text);
  if (!normalized) {
    return false;
  }

  if (FILLER_ONLY_PATTERN.test(normalized)) {
    return false;
  }

  if (GREETING_ONLY_PATTERN.test(normalized)) {
    return false;
  }

  if (TRAILING_CONTINUATION_PATTERN.test(normalized)) {
    return false;
  }

  return true;
}

export function looksLikeDirectLearningQuestion(text: string) {
  const normalized = normalizeTranscript(text);
  if (!isMeaningfulTutorTranscript(normalized)) {
    return false;
  }

  if (normalized.includes('?')) {
    return true;
  }

  return DIRECT_QUESTION_PATTERN.test(normalized);
}

export function shouldAutoStartTutorLesson(input: {
  topic: string | null;
  learnerLevel: string | null;
  latestUserMessage?: string | null;
}) {
  if (!input.topic) {
    return false;
  }

  if (input.learnerLevel) {
    return true;
  }

  return looksLikeDirectLearningQuestion(input.latestUserMessage || '');
}

export function shouldTriggerTutorBargeIn(input: {
  teacherSpeaking: boolean;
  voiceLevel: number;
}) {
  return input.teacherSpeaking && input.voiceLevel >= TUTOR_BARGE_IN_LEVEL;
}
