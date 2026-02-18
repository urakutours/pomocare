export interface PomodoroSession {
  date: string;
  duration: number;
  label?: string; // optional label for time tracking (e.g. 'Language', 'Study')
}

export interface LabelDefinition {
  id: string;
  name: string;
  color: string;
}
