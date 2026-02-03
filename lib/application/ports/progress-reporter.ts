export interface ProgressReporter {
  updateProgress(details: { step: string; progress: number }): Promise<void>;
}
