import { browserManager } from "../playwright/browser";
import { BrowserSession, ToolCallRequest, ToolCallResponse } from "../types";
import { toolRegistry } from "./registry";

export class ToolExecutor {
  async execute(request: ToolCallRequest): Promise<ToolCallResponse> {
    const sessionId =
      request.sessionId ||
      browserManager.getLastSessionId() ||
      this.generateSessionId();

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
        case "wait_for_selector":
          result = await this.handleWaitForSelector(
            sessionId,
            request.arguments.selector,
            request.arguments.timeout
          );
          break;
        case "fill_and_wait":
          result = await this.handleFillAndWait(
            sessionId,
            request.arguments.selector,
            request.arguments.text,
            request.arguments.waitFor,
            request.arguments.timeout
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
  ): Promise<{ url: string; title: string; sessionId: string }> {
    if (!this.isValidUrl(url)) {
      throw new Error(`Invalid URL: ${url}`);
    }

    console.log(`[${sessionId}] Opening URL: ${url}`);
    const session = await browserManager.getOrCreateSession(sessionId);
    console.log(`[${sessionId}] Session ready, navigating to page...`);
    await session.page.goto(url, { waitUntil: "networkidle", timeout: 60000 });
    console.log(`[${sessionId}] Navigation complete`);

    return {
      url: session.page.url(),
      title: await session.page.title(),
      sessionId: sessionId,
    };
  }

  private async handleClick(
    sessionId: string,
    selector: string
  ): Promise<{ message: string; sessionId: string }> {
    if (!selector || typeof selector !== "string") {
      throw new Error("Selector must be a non-empty string");
    }

    console.log(`[${sessionId}] Clicking selector: ${selector}`);
    let session = await browserManager.getSession(sessionId);
    if (!session) {
      console.log(`[${sessionId}] Session not found, creating new session`);
      session = await browserManager.getOrCreateSession(sessionId);
    }

    await session.page.click(selector);
    console.log(`[${sessionId}] Click complete`);

    return { message: `Clicked element: ${selector}`, sessionId };
  }

  private async handleFill(
    sessionId: string,
    selector: string,
    text: string
  ): Promise<{ message: string; sessionId: string }> {
    if (!selector || typeof selector !== "string") {
      throw new Error("Selector must be a non-empty string");
    }
    if (typeof text !== "string") {
      throw new Error("Text must be a string");
    }

    console.log(`[${sessionId}] Filling selector: ${selector}`);
    let session = await browserManager.getSession(sessionId);
    if (!session) {
      console.log(`[${sessionId}] Session not found, creating new session`);
      session = await browserManager.getOrCreateSession(sessionId);
    }

    await session.page.fill(selector, text);
    console.log(`[${sessionId}] Fill complete`);

    return { message: `Filled ${selector} with text`, sessionId };
  }

  private async handleGetTitle(sessionId: string): Promise<{ title: string; sessionId: string }> {
    console.log(`[${sessionId}] Getting title`);
    let session = await browserManager.getSession(sessionId);
    if (!session) {
      console.log(`[${sessionId}] Session not found, creating new session`);
      session = await browserManager.getOrCreateSession(sessionId);
    }

    const title = await session.page.title();

    return { title, sessionId };
  }

  private async handleScreenshot(
    sessionId: string
  ): Promise<{ screenshot: string; sessionId: string }> {
    console.log(`[${sessionId}] Taking screenshot`);
    let session = await browserManager.getSession(sessionId);
    if (!session) {
      console.log(`[${sessionId}] Session not found, creating new session`);
      session = await browserManager.getOrCreateSession(sessionId);
    }

    const buffer = await session.page.screenshot();
    const base64 = buffer.toString("base64");
    console.log(`[${sessionId}] Screenshot captured`);

    return { screenshot: base64, sessionId };
  }

  private async handleWaitForSelector(
    sessionId: string,
    selector: string,
    timeout?: number
  ): Promise<{ message: string; appeared: boolean; sessionId: string }> {
    if (!selector || typeof selector !== "string") {
      throw new Error("Selector must be a non-empty string");
    }

    let session = await browserManager.getSession(sessionId);
    if (!session) {
      console.log(`[${sessionId}] Session not found, creating new session`);
      session = await browserManager.getOrCreateSession(sessionId);
    }

    const waitTimeout = timeout || 30000;
    console.log(
      `[${sessionId}] Waiting for selector "${selector}" (timeout: ${waitTimeout}ms)`
    );

    try {
      await session.page.waitForSelector(selector, { timeout: waitTimeout });
      console.log(`[${sessionId}] Selector "${selector}" appeared`);
      return {
        message: `Element appeared: ${selector}`,
        appeared: true,
        sessionId,
      };
    } catch {
      console.log(`[${sessionId}] Selector "${selector}" did not appear`);
      return {
        message: `Element did not appear: ${selector}`,
        appeared: false,
        sessionId,
      };
    }
  }

  private async handleFillAndWait(
    sessionId: string,
    selector: string,
    text: string,
    waitFor: string,
    timeout?: number
  ): Promise<{
    message: string;
    filled: boolean;
    appeared: boolean;
    sessionId: string;
  }> {
    if (!selector || typeof selector !== "string") {
      throw new Error("Selector must be a non-empty string");
    }
    if (typeof text !== "string") {
      throw new Error("Text must be a string");
    }
    if (!waitFor || typeof waitFor !== "string") {
      throw new Error("waitFor must be a non-empty string");
    }

    let session = await browserManager.getSession(sessionId);
    if (!session) {
      console.log(`[${sessionId}] Session not found, creating new session`);
      session = await browserManager.getOrCreateSession(sessionId);
    }

    const waitTimeout = timeout || 30000;

    console.log(`[${sessionId}] Filling selector "${selector}" with text`);
    await session.page.fill(selector, text);
    console.log(`[${sessionId}] Text filled, waiting for "${waitFor}"`);

    try {
      await session.page.waitForSelector(waitFor, { timeout: waitTimeout });
      console.log(`[${sessionId}] Element "${waitFor}" appeared`);
      return {
        message: `Filled and next element appeared`,
        filled: true,
        appeared: true,
        sessionId,
      };
    } catch {
      console.log(`[${sessionId}] Element "${waitFor}" did not appear`);
      return {
        message: `Filled but next element did not appear`,
        filled: true,
        appeared: false,
        sessionId,
      };
    }
  }

  private async handleCloseBrowser(
    sessionId: string
  ): Promise<{ message: string; sessionId: string }> {
    await browserManager.closeSession(sessionId);

    return { message: `Session ${sessionId} closed`, sessionId };
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
