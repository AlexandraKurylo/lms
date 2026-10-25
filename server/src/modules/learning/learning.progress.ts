export interface ProgressSummary {
  completed: number;
  total: number;
  percent: number;
}

export const toSummary = (completed: number, total: number): ProgressSummary => ({
  completed,
  total,
  percent: total === 0 ? 0 : Math.round((completed / total) * 100),
});
