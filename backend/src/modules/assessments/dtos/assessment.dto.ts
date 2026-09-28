/**
 * Two shapes for the same quiz, and the difference is the whole point: the
 * editing shape says which options are correct, the taking shape does not.
 * Nothing that reaches a student before they submit carries `isCorrect`.
 */

export interface AssessmentOptionForEditingDto {
  id: string;
  text: string;
  isCorrect: boolean;
}

export interface AssessmentQuestionForEditingDto {
  id: string;
  prompt: string;
  options: AssessmentOptionForEditingDto[];
}

/** What the instructor who owns the course sees. */
export interface AssessmentForEditingDto {
  id: string;
  moduleId: string;
  title: string;
  passScore: number;
  questions: AssessmentQuestionForEditingDto[];
}

export interface AssessmentOptionDto {
  id: string;
  text: string;
}

export interface AssessmentQuestionDto {
  id: string;
  prompt: string;
  options: AssessmentOptionDto[];
  /** True when more than one option is correct, so the UI offers checkboxes rather than radios. */
  multiple: boolean;
}

export interface AttemptSummaryDto {
  id: string;
  score: number;
  passed: boolean;
  createdAt: Date;
}

/** What a student sees before answering. */
export interface AssessmentForTakingDto {
  id: string;
  moduleId: string;
  title: string;
  passScore: number;
  questions: AssessmentQuestionDto[];
  /** Newest first. Empty on a first sitting. */
  attempts: AttemptSummaryDto[];
  /** Highest score across every attempt, or null if there are none. */
  bestScore: number | null;
}

/** Per-question verdict, returned only once an attempt has been submitted. */
export interface GradedQuestionDto {
  questionId: string;
  correct: boolean;
  selectedOptionIds: string[];
  /** Revealed now that the answer is in, so the student can see what they missed. */
  correctOptionIds: string[];
}

export interface AttemptResultDto {
  attemptId: string;
  score: number;
  passed: boolean;
  passScore: number;
  correctCount: number;
  totalQuestions: number;
  bestScore: number;
  questions: GradedQuestionDto[];
}
