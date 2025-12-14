import { browserManager } from "../playwright/browser";
import { BrowserSession, ToolCallRequest, ToolCallResponse } from "../types";
import { toolRegistry } from "./registry";
import * as fs from "fs";
import * as path from "path";

export class ToolExecutor {
  async execute(request: ToolCallRequest): Promise<ToolCallResponse> {
    // For execute_workflow, always generate a new session ID to avoid issues with manually closed browsers
    const sessionId =
      request.tool === "execute_workflow"
        ? this.generateSessionId()
        : request.sessionId ||
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
        case "execute_workflow":
          result = await this.handleExecuteWorkflow(
            sessionId,
            request.arguments.workflow
          );
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

  private async handleExecuteWorkflow(
    sessionId: string,
    workflowName: string
  ): Promise<{ 
    message: string; 
    stepsExecuted: number; 
    results: any[]; 
    sessionId: string 
  }> {
    if (!workflowName || typeof workflowName !== "string") {
      throw new Error("Workflow name must be a non-empty string");
    }

    // Load workflow file
    const workflowPath = path.join(__dirname, "../../workflows", `${workflowName}.json`);
    
    if (!fs.existsSync(workflowPath)) {
      throw new Error(`Workflow "${workflowName}" not found. Available workflows: bim-login-only, bim-login-and-create`);
    }

    console.log(`[${sessionId}] Loading workflow from: ${workflowPath}`);
    const workflowContent = fs.readFileSync(workflowPath, "utf-8");
    const workflow = JSON.parse(workflowContent);

    console.log(`[${sessionId}] Executing workflow: ${workflow.name}`);
    console.log(`[${sessionId}] Description: ${workflow.description}`);
    console.log(`[${sessionId}] Total steps: ${workflow.steps.length}`);

    const results: any[] = [];
    let session = await browserManager.getOrCreateSession(sessionId);
    const GLOBAL_TIMEOUT = 30000; // 30 seconds global timeout

    for (let i = 0; i < workflow.steps.length; i++) {
      const step = workflow.steps[i];
      console.log(`[${sessionId}] Step ${i + 1}/${workflow.steps.length}: ${step.description}`);

      let stepStartTime = 0;
      try {
        // Replace {timestamp} placeholder in text fields
        const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, -5);
        if (step.arguments.text) {
          step.arguments.text = step.arguments.text.replace('{timestamp}', timestamp);
        }

        let stepResult: any;
        stepStartTime = Date.now();
        
        // Execute the step based on action type with global timeout protection
        const stepPromise = (async () => {
          switch (step.action) {
            case "open_page":
              await session.page.goto(step.arguments.url, { 
                waitUntil: "networkidle", 
                timeout: 60000 
              });
              return { url: session.page.url(), title: await session.page.title() };
            
            case "click":
              await session.page.click(step.arguments.selector, { timeout: GLOBAL_TIMEOUT });
              return { clicked: step.arguments.selector };
            
            case "fill":
              await session.page.fill(step.arguments.selector, step.arguments.text, { timeout: GLOBAL_TIMEOUT });
              return { filled: step.arguments.selector, text: step.arguments.text };
            
            case "wait_for_selector":
              const timeout = Math.min(step.arguments.timeout || 30000, GLOBAL_TIMEOUT);
              await session.page.waitForSelector(step.arguments.selector, { timeout });
              return { appeared: step.arguments.selector };
            
            case "wait_for_enabled":
              const waitTimeout = Math.min(step.arguments.timeout || 30000, GLOBAL_TIMEOUT);
              const selector = step.arguments.selector;
              const checkInterval = 500;
              const startTime = Date.now();
              
              while (Date.now() - startTime < waitTimeout) {
                try {
                  const isDisabled = await session.page.evaluate((sel: string) => {
                    const elem = document.querySelector(sel);
                    return (elem as HTMLElement)?.getAttribute('data-disabled') === 'true' || elem?.hasAttribute('disabled');
                  }, selector);
                  
                  if (!isDisabled) {
                    return { enabled: selector };
                  }
                } catch (evalError) {
                  console.log(`[${sessionId}] Still waiting for element ${selector} to be available...`);
                }
                await new Promise(r => setTimeout(r, checkInterval));
              }
              throw new Error(`Element ${selector} did not become enabled within ${waitTimeout}ms`);
            
            case "screenshot":
              const buffer = await session.page.screenshot();
              const base64 = buffer.toString("base64");
              return { screenshot: `${base64.substring(0, 50)}... (${base64.length} chars)` };
            
            default:
              throw new Error(`Unknown action: ${step.action}`);
          }
        })();

        // Wrap with timeout protection
        stepResult = await Promise.race([
          stepPromise,
          new Promise((_, reject) => 
            setTimeout(() => reject(new Error(`STEP TIMEOUT: Operation exceeded 30 seconds - ${step.action} on ${step.arguments.selector || 'N/A'}`)), GLOBAL_TIMEOUT)
          )
        ]);

        const stepDuration = Date.now() - stepStartTime;
        console.log(`[${sessionId}] Step ${i + 1} completed in ${stepDuration}ms`);

        results.push({
          step: i + 1,
          action: step.action,
          description: step.description,
          success: true,
          result: stepResult,
          duration: stepDuration
        });

        // Wait after step if specified
        if (step.waitAfter && step.waitAfter > 0) {
          console.log(`[${sessionId}] Waiting ${step.waitAfter}ms...`);
          await new Promise(resolve => setTimeout(resolve, step.waitAfter));
        }

      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : String(error);
        const stepDuration = Date.now() - stepStartTime;
        console.error(`[${sessionId}] Step ${i + 1} FAILED after ${stepDuration}ms: ${errorMessage}`);
        
        results.push({
          step: i + 1,
          action: step.action,
          description: step.description,
          success: false,
          error: errorMessage,
          duration: stepDuration
        });

        // Stop workflow if step fails (GLOBAL CONDITION)
        throw new Error(`WORKFLOW STOPPED: Step ${i + 1} (${step.description}) failed after ${stepDuration}ms - ${errorMessage}`);
      }
    }

    console.log(`[${sessionId}] Workflow completed successfully`);

    return {
      message: `Workflow "${workflow.name}" completed successfully. Executed ${workflow.steps.length} steps.`,
      stepsExecuted: workflow.steps.length,
      results,
      sessionId
    };
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
