export const MAX_PROJECT_NOTE_LENGTH = 5000;

export type ProjectNote = {
  id: string;
  project_id: string;
  job_id: string | null;
  author_id: string;
  body: string;
  created_at: string;
};
