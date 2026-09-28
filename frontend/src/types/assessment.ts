/**
 * Two shapes for the same quiz. The taking shape has no `isCorrect` anywhere,
 * because the server never sends it before an attempt is submitted — grading
 * happens there, not here.
 */

export interface AssessmentOptionForEditing {
  id: string;
  text: string;
  isCorrect: boolean;
}

export interface AssessmentQuestionForEditing {
  id: string;
  prompt: string;
  options: AssessmentOptionForEditing[];
}

export interface AssessmentForEditing {
  id: string;
  moduleId: string;
  title: string;
  passScore: number;
  questions: AssessmentQuestionForEditing[];
}

/** What gets sent when saving: no ids, since a save replaces the questions whole. */
export interface AssessmentDraft {
  title: string;
  passScore: number;
  questions: { prompt: string; options: { text: string; isCorrect: boolean }[] }[];
}

export interface AssessmentOption {
  id: string;
  text: string;
}

export interface AssessmentQuestion {
  id: string;
  prompt: string;
  options: AssessmentOption[];
  /** More than one correct answer, so the UI offers checkboxes rather than radios. */
  multiple: boolean;
}

export interface AttemptSummary {
  id: string;
  score: number;
  passed: boolean;
  createdAt: string;
}

export interface AssessmentForTaking {
  id: string;
  moduleId: string;
  title: string;
  passScore: number;
  questions: AssessmentQuestion[];
  /** Newest first. */
  attempts: AttemptSummary[];
  bestScore: number | null;
}

export interface GradedQuestion {
  questionId: string;
  correct: boolean;
  selectedOptionIds: string[];
  correctOptionIds: string[];
}

export interface AttemptResult {
  attemptId: string;
  score: number;
  passed: boolean;
  passScore: number;
  correctCount: number;
  totalQuestions: number;
  bestScore: number;
  questions: GradedQuestion[];
}
