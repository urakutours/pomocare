export interface PomodoroSession {
  date: string;
  duration: number;
  label?: string; // optional label for time tracking (e.g. 'Language', 'Study')
  note?: string;  // optional task memo for the session
}

export interface LabelDefinition {
  id: string;
  name: string;
  color: string;
  /** Optional custom timer duration in minutes. When set, selecting this
   *  label temporarily overrides the global workTime setting. */
  duration?: number;
}
