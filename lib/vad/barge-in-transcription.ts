import { utils as vadUtils } from '@ricky0123/vad-web';

const SHORT_TRANSCRIPT_WORD_LIMIT = 2;
const INTERRUPT_CUES = new Set([
  'actually',
  'again',
  'but',
  'can',
  'could',
  'hold',
  'how',
  'i',
  'no',
  'ok',
  'okay',
  'pause',
  'question',
  'repeat',
  'sorry',
  'stop',
  'wait',
  'what',
  'why',
  'yes',
]);

function normalizeText(value: string) {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function levenshteinDistance(left: string, right: string) {
  if (left === right) {
    return 0;
  }

  if (!left) {
    return right.length;
  }

  if (!right) {
    return left.length;
  }

  const previous = new Array(right.length + 1).fill(0);
  const current = new Array(right.length + 1).fill(0);

  for (let column = 0; column <= right.length; column += 1) {
    previous[column] = column;
  }

  for (let row = 1; row <= left.length; row += 1) {
    current[0] = row;
    for (let column = 1; column <= right.length; column += 1) {
      const substitutionCost = left[row - 1] === right[column - 1] ? 0 : 1;
      current[column] = Math.min(
        previous[column] + 1,
        current[column - 1] + 1,
        previous[column - 1] + substitutionCost
      );
    }

    for (let column = 0; column <= right.length; column += 1) {
      previous[column] = current[column];
    }
  }

  return previous[right.length] ?? 0;
}

function similarityScore(left: string, right: string) {
  if (!left || !right) {
    return 0;
  }

  const maxLength = Math.max(left.length, right.length);
  if (maxLength === 0) {
    return 1;
  }

  return 1 - levenshteinDistance(left, right) / maxLength;
}

function bestTeacherWindowSimilarity(transcriptWords: string[], teacherWords: string[]) {
  if (!transcriptWords.length || !teacherWords.length) {
    return 0;
  }

  const transcript = transcriptWords.join(' ');
  const minWindowLength = Math.max(1, transcriptWords.length - 1);
  const maxWindowLength = Math.min(teacherWords.length, transcriptWords.length + 2);
  let best = 0;

  for (let windowLength = minWindowLength; windowLength <= maxWindowLength; windowLength += 1) {
    for (let start = 0; start <= teacherWords.length - windowLength; start += 1) {
      const windowText = teacherWords.slice(start, start + windowLength).join(' ');
      best = Math.max(best, similarityScore(transcript, windowText));
    }
  }

  return best;
}

function hasInterruptCue(words: string[]) {
  const joined = words.join(' ');
  if (joined.includes('hold on')) {
    return true;
  }

  return words.some((word) => INTERRUPT_CUES.has(word));
}

export function isLikelyTeacherEcho(transcript: string, teacherSpeech: string) {
  const normalizedTranscript = normalizeText(transcript);
  const normalizedTeacherSpeech = normalizeText(teacherSpeech);

  if (!normalizedTranscript || !normalizedTeacherSpeech) {
    return false;
  }

  if (
    normalizedTeacherSpeech.includes(normalizedTranscript) ||
    normalizedTranscript.includes(normalizedTeacherSpeech)
  ) {
    return true;
  }

  const transcriptWords = normalizedTranscript.split(' ');
  const teacherWords = normalizedTeacherSpeech.split(' ');
  const teacherWordSet = new Set(teacherWords);
  const overlapCount = transcriptWords.filter((word) => teacherWordSet.has(word)).length;

  if (overlapCount / transcriptWords.length >= 0.75) {
    return true;
  }

  return bestTeacherWindowSimilarity(transcriptWords, teacherWords) >= 0.72;
}

export function shouldAcceptBargeInTranscript(transcript: string, teacherSpeech: string) {
  const normalizedTranscript = normalizeText(transcript);
  const normalizedTeacherSpeech = normalizeText(teacherSpeech);

  if (!normalizedTranscript || !normalizedTeacherSpeech) {
    return false;
  }

  if (isLikelyTeacherEcho(normalizedTranscript, normalizedTeacherSpeech)) {
    return false;
  }

  const transcriptWords = normalizedTranscript.split(' ');
  if (transcriptWords.length <= SHORT_TRANSCRIPT_WORD_LIMIT && !hasInterruptCue(transcriptWords)) {
    return false;
  }

  return true;
}

export async function transcribeVadAudio(audio: Float32Array) {
  const wav = vadUtils.encodeWAV(audio, 1, 16000, 1, 16);
  const blob = new Blob([wav], { type: 'audio/wav' });
  const formData = new FormData();
  formData.append('audio', blob, 'barge-in.wav');

  const response = await fetch('/api/assemblyai/transcribe', {
    method: 'POST',
    body: formData,
  });

  const payload = (await response.json()) as {
    transcript?: string;
    error?: string;
  };

  if (!response.ok) {
    throw new Error(payload.error || 'Barge-in transcription failed');
  }

  return payload.transcript?.trim() || '';
}
