import type { TutorIntakeState } from '@/lib/types/tutor';

export function getTutorIntakeNextReplyAction(args: {
  topic: string | null;
  learnerLevel: string | null;
}): NonNullable<TutorIntakeState['nextReplyAction']> {
  const hasTopic = Boolean(args.topic?.trim());
  const hasLearnerLevel = Boolean(args.learnerLevel?.trim());

  if (hasTopic && !hasLearnerLevel) {
    return 'prepare_lesson';
  }

  return 'continue_intake';
}
