export type SourceLanguage = "python" | "javascript" | "typescript" | "tsx" | "website" | "page" | "script" | "stylesheet" | "image" | "external" | "technology";

export interface GraphNode {
  id: string;
  label: string;
  size: number;
  type: SourceLanguage;
  size_bytes: number;
  functions: string[];
  classes: string[];
  imports: string[];
  description?: string;
  url?: string;
  status?: number;
}

export interface GraphEdge {
  source: string;
  target: string;
}

export interface GraphData {
  root: string;
  mode?: "repository" | "website";
  nodes: GraphNode[];
  edges: GraphEdge[];
  meta?: {
    technologies?: string[];
    pages?: number;
    assets?: number;
    warnings?: string[];
    crawled_at?: string;
  };
}
