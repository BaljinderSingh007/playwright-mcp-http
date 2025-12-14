import { chromium, Browser, BrowserContext, Page } from "playwright";
import { BrowserSession } from "../types";
import { exec } from "child_process";
import { promisify } from "util";

const execAsync = promisify(exec);

class BrowserManager {
  private sessions: Map<string, BrowserSession> = new Map();
  private browserInstance: Browser | null = null;
  private sessionTimeout: number = 30 * 60 * 1000;
  private lastSessionId: string | null = null;
  private initializationComplete: boolean = false;

  async initialize(): Promise<void> {
    if (this.initializationComplete) {
      return;
    }

    console.log("\n[INITIALIZATION] Starting browser manager cleanup...");
    
    try {
      // Clean up orphaned Chrome processes
      await this.cleanupOrphanedProcesses();
    } catch (error) {
      console.warn("Warning: Could not clean up orphaned processes", error);
    }
    
    this.initializationComplete = true;
    console.log("[INITIALIZATION] Browser manager ready\n");
  }

  private async cleanupOrphanedProcesses(): Promise<void> {
    try {
      if (process.platform === "win32") {
        // Windows: Kill orphaned Chrome processes
        await execAsync(
          'taskkill /F /IM chrome.exe /T 2>nul || exit /b 0',
          { shell: "cmd.exe" }
        );
        console.log("[CLEANUP] Orphaned Chrome processes cleaned up");
      } else {
        // Unix/Linux: Kill orphaned Chrome processes
        await execAsync('pkill -9 chrome || true');
        console.log("[CLEANUP] Orphaned Chrome processes cleaned up");
      }
    } catch (error) {
      // Silently fail if no processes to kill
      console.debug("[CLEANUP] No orphaned processes found");
    }
  }

  async getOrCreateSession(sessionId: string): Promise<BrowserSession> {
    // Ensure initialization is complete
    if (!this.initializationComplete) {
      await this.initialize();
    }

    let session = this.sessions.get(sessionId);

    if (session) {
      // Verify the session is still valid
      try {
        await session.page.evaluate(() => true);
        console.log(`[SESSION] Reusing existing session: ${sessionId}`);
        return session;
      } catch (error) {
        // Session is invalid (browser was closed manually), remove it
        console.log(`[SESSION] Session ${sessionId} is invalid (browser closed), creating new one`);
        this.sessions.delete(sessionId);
        this.browserInstance = null;
      }
    }

    // Check if browser instance is still connected
    if (this.browserInstance) {
      try {
        await this.browserInstance.version();
      } catch (error) {
        // Browser was closed manually, clear the instance
        console.log("[SESSION] Browser instance is disconnected, creating new one");
        this.browserInstance = null;
        this.sessions.clear();
      }
    }

    if (!this.browserInstance) {
      console.log("[SESSION] Launching browser...");
      this.browserInstance = await chromium.launch({
        headless: false,
        slowMo: 0,
        args: ["--disable-blink-features=AutomationControlled"],
      });
      console.log("[SESSION] Browser launched successfully");
    }

    console.log(`[SESSION] Creating new context for session ${sessionId}`);
    const context = await this.browserInstance.newContext();
    const page = await context.newPage();
    console.log(`[SESSION] Page created for session ${sessionId}`);

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

  async forceCleanupAll(): Promise<void> {
    console.log("[CLEANUP] Force cleaning all sessions and browser instance...");
    const sessionIds = Array.from(this.sessions.keys());
    
    for (const sessionId of sessionIds) {
      try {
        await this.closeSession(sessionId);
      } catch (error) {
        console.error(`[CLEANUP] Error closing session ${sessionId}:`, error);
      }
    }
    
    try {
      await this.cleanupOrphanedProcesses();
    } catch (error) {
      console.error("[CLEANUP] Error cleaning up processes:", error);
    }
    
    this.sessions.clear();
    this.browserInstance = null;
    this.lastSessionId = null;
    this.initializationComplete = false;
    console.log("[CLEANUP] All sessions and browser cleaned up");
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
        console.log(`[SESSION] Closed session ${sessionId}`);
      } catch (error) {
        console.error(`[SESSION] Error closing session ${sessionId}:`, error);
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
        console.log("[BROWSER] Browser closed");
      } catch (error) {
        console.error("[BROWSER] Error closing browser:", error);
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

  getSessionCount(): number {
    return this.sessions.size;
  }

  getAllSessionIds(): string[] {
    return Array.from(this.sessions.keys());
  }
}

export const browserManager = new BrowserManager();
