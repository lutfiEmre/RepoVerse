import type { GraphData, GraphNode } from "./types";

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000";

async function parseResponse<T>(response: Response): Promise<T> {
  const payload = (await response.json()) as T & { detail?: string };
  if (!response.ok) {
    throw new Error(payload.detail ?? "Backend isteği başarısız oldu.");
  }
  return payload;
}

export async function scanRepository(path: string): Promise<GraphData> {
  const response = await fetch(`${API_URL}/api/scan`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ path }),
  });
  return parseResponse<GraphData>(response);
}

export async function scanWebsite(url: string): Promise<GraphData> {
  const response = await fetch(`${API_URL}/api/scan-url`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ url, max_pages: 8, include_assets: true }),
  });
  return parseResponse<GraphData>(response);
}

export async function summarizeFile(root: string, node: GraphNode): Promise<string> {
  const response = await fetch(`${API_URL}/api/summary`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      root,
      file_id: node.id,
      functions: node.functions,
      classes: node.classes,
    }),
  });
  const payload = await parseResponse<{ summary: string }>(response);
  return payload.summary;
}
