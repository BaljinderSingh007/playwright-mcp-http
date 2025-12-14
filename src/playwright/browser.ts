import { chromium, Browser, BrowserContext, Page } from "playwright";
import { BrowserSession } from "../types";

class BrowserManager {
  private sessions: Map<string, BrowserSession> = new Map();
  private browserInstance: Browser | null = null;
  private sessionTimeout: number = 30 * 60 * 1000;
  private lastSessionId: string | null = null;

  async getOrCreateSession(sessionId: string): Promise<BrowserSession> {
    let session = this.sessions.get(sessionId);

    if (session) {
      return session;
    }

    if (!this.browserInstance) {
      console.log("Launching browser...");
      this.browserInstance = await chromium.launch({
        headless: false,
        slowMo: 0,
        args: ["--disable-blink-features=AutomationControlled"],
      });
      console.log("Browser launched successfully");
    }

    console.log(`Creating new context for session ${sessionId}`);
    const context = await this.browserInstance.newContext();
    const page = await context.newPage();
    console.log(`Page created for session ${sessionId}`);

    session = {
      browser: this.browserInstance,
      context,
      page,
      createdAt: Date.now(),
    };

    this.sessions.set(sessionId, session);
    this.lastSessionId = sessionId;

    this.scheduleSessionCleanup(sessionId);

    return session;
  }

  getSession(sessionId: string | null): BrowserSession | undefined {
    const actualSessionId = sessionId || this.lastSessionId;
    if (!actualSessionId) {
      return undefined;
    }
    return this.sessions.get(actualSessionId);
  }

  getLastSessionId(): string | null {
    return this.lastSessionId;
  }

  async closeSession(sessionId: string): Promise<void> {
    const session = this.sessions.get(sessionId);

    if (session) {
      try {
        await session.page.close();
        await session.context.close();
      } catch (error) {
        console.error(`Error closing session ${sessionId}:`, error);
      }

      this.sessions.delete(sessionId);
    }

    if (this.sessions.size === 0) {
      await this.closeBrowser();
    }
  }

  private async closeBrowser(): Promise<void> {
    if (this.browserInstance) {
      try {
        await this.browserInstance.close();
      } catch (error) {
        console.error("Error closing browser:", error);
      }
      this.browserInstance = null;
    }
  }

  private scheduleSessionCleanup(sessionId: string): void {
    setTimeout(async () => {
      const session = this.sessions.get(sessionId);
      if (session) {
        const age = Date.now() - session.createdAt;
        if (age > this.sessionTimeout) {
          console.log(`Cleaning up expired session: ${sessionId}`);
          await this.closeSession(sessionId);
        }
      }
    }, this.sessionTimeout);
  }

  async closeAllSessions(): Promise<void> {
    const sessionIds = Array.from(this.sessions.keys());
    for (const sessionId of sessionIds) {
      await this.closeSession(sessionId);
    }
  }
}

export const browserManager = new BrowserManager();
