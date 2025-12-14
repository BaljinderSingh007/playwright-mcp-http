import { Browser, BrowserContext, Page } from "playwright";

export interface MCPTool {
  name: string;
  description: string;
  inputSchema: {
    type: string;
    properties: Record<string, any>;
    required: string[];
  };
}

export interface ToolCallRequest {
  tool: string;
  arguments: Record<string, any>;
  sessionId?: string;
}

export interface ToolCallResponse {
  success: boolean;
  data?: any;
  error?: string;
  sessionId: string;
}

export interface BrowserSession {
  browser: Browser;
  context: BrowserContext;
  page: Page;
  createdAt: number;
}

export interface ToolRegistry {
  [toolName: string]: MCPTool;
}
