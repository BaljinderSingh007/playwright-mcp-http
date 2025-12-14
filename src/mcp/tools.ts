import { browserManager } from "../playwright/browser";
import { BrowserSession, ToolCallRequest, ToolCallResponse } from "../types";
import { toolRegistry } from "./registry";

export class ToolExecutor {
  async execute(request: ToolCallRequest): Promise<ToolCallResponse> {
    const sessionId = request.sessionId || this.generateSessionId();

    try {
      const validation = toolRegistry.validateInput(
        request.tool,
        request.arguments
      );
      if (!validation.valid) {
        return {
          success: false,
          error: validation.error,
          sessionId,
        };
      }

      let result: any;

      switch (request.tool) {
        case "open_page":
          result = await this.handleOpenPage(
            sessionId,
            request.arguments.url
          );
          break;
        case "click":
          result = await this.handleClick(sessionId, request.arguments.selector);
          break;
        case "fill":
          result = await this.handleFill(
            sessionId,
            request.arguments.selector,
            request.arguments.text
          );
          break;
        case "get_title":
          result = await this.handleGetTitle(sessionId);
          break;
        case "screenshot":
          result = await this.handleScreenshot(sessionId);
          break;
        case "close_browser":
          result = await this.handleCloseBrowser(sessionId);
          break;
        default:
          return {
            success: false,
            error: `Unknown tool: ${request.tool}`,
            sessionId,
          };
      }

      return {
        success: true,
        data: result,
        sessionId,
      };
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : String(error);
      return {
        success: false,
        error: errorMessage,
        sessionId,
      };
    }
  }

  private async handleOpenPage(
    sessionId: string,
    url: string
  ): Promise<{ url: string; title: string }> {
    if (!this.isValidUrl(url)) {
      throw new Error(`Invalid URL: ${url}`);
    }

    console.log(`[${sessionId}] Opening URL: ${url}`);
    const session = await browserManager.getOrCreateSession(sessionId);
    console.log(`[${sessionId}] Session ready, navigating to page...`);
    await session.page.goto(url, { waitUntil: "load" });
    console.log(`[${sessionId}] Navigation complete`);

    return {
      url: session.page.url(),
      title: await session.page.title(),
    };
  }

  private async handleClick(
    sessionId: string,
    selector: string
  ): Promise<{ message: string }> {
    if (!selector || typeof selector !== "string") {
      throw new Error("Selector must be a non-empty string");
    }

    const session = await browserManager.getSession(sessionId);
    if (!session) {
      throw new Error(`Session ${sessionId} not found`);
    }

    await session.page.click(selector);

    return { message: `Clicked element: ${selector}` };
  }

  private async handleFill(
    sessionId: string,
    selector: string,
    text: string
  ): Promise<{ message: string }> {
    if (!selector || typeof selector !== "string") {
      throw new Error("Selector must be a non-empty string");
    }
    if (typeof text !== "string") {
      throw new Error("Text must be a string");
    }

    const session = await browserManager.getSession(sessionId);
    if (!session) {
      throw new Error(`Session ${sessionId} not found`);
    }

    await session.page.fill(selector, text);

    return { message: `Filled ${selector} with text` };
  }

  private async handleGetTitle(sessionId: string): Promise<{ title: string }> {
    const session = await browserManager.getSession(sessionId);
    if (!session) {
      throw new Error(`Session ${sessionId} not found`);
    }

    const title = await session.page.title();

    return { title };
  }

  private async handleScreenshot(
    sessionId: string
  ): Promise<{ screenshot: string }> {
    const session = await browserManager.getSession(sessionId);
    if (!session) {
      throw new Error(`Session ${sessionId} not found`);
    }

    const buffer = await session.page.screenshot();
    const base64 = buffer.toString("base64");

    return { screenshot: base64 };
  }

  private async handleCloseBrowser(
    sessionId: string
  ): Promise<{ message: string }> {
    await browserManager.closeSession(sessionId);

    return { message: `Session ${sessionId} closed` };
  }

  private generateSessionId(): string {
    return `session_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  private isValidUrl(url: string): boolean {
    try {
      new URL(url);
      return true;
    } catch {
      return false;
    }
  }
}

export const toolExecutor = new ToolExecutor();
