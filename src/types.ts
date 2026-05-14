export interface DocumentRecord {
  id: string;
  filename: string;
  title: string;
  text: string;
  html: string;
}

export interface SearchResult {
  id: string;
  title: string;
  snippet: string;
  score: number;
}

export interface ToolCall {
  tool: string;
  args: Record<string, string>;
  observation: string;
}

export interface AgentResponse {
  answer: string;
  toolCalls: ToolCall[];
  sources: string[];
}
