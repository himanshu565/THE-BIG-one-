export type View =
  | "Overview"
  | "Ask your data"
  | "Documents"
  | "Projects"
  | "Evaluations"
  | "Activity"
  | "Settings";

export interface ActivityItem {
  id: string;
  title: string;
  detail: string;
  type: "query" | "setting" | "document" | "project";
  status: string;
  timestamp: string;
}
