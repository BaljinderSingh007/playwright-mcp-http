import express, { Express, Request, Response } from "express";
import { toolRegistry } from "./mcp/registry";
import { toolExecutor } from "./mcp/tools";
import { browserManager } from "./playwright/browser";
import { ToolCallRequest } from "./types";

const app: Express = express();
const PORT = process.env.PORT || 3000;

app.use(express.json());

app.get("/", (req: Request, res: Response) => {
  res.json({
    name: "Playwright MCP HTTP Server",
    version: "1.0.0",
    description: "Browser automation via MCP over HTTP",
    endpoints: {
      "GET /mcp/tools": "List all available tools",
      "POST /mcp/call": "Execute a tool",
      "POST /api/:toolName": "Execute a tool via REST API",
      "GET /health": "Server health check",
      "POST /cleanup": "Force cleanup all sessions and processes",
      "GET /sessions": "List all active sessions",
    },
  });
});

app.get("/health", (req: Request, res: Response) => {
  try {
    const sessionCount = (browserManager as any).getSessionCount?.() || 0;
    const sessionIds = (browserManager as any).getAllSessionIds?.() || [];
    res.json({
      status: "healthy",
      timestamp: new Date().toISOString(),
      sessions: {
        count: sessionCount,
        ids: sessionIds,
      },
    });
  } catch (error) {
    const errorMessage =
      error instanceof Error ? error.message : "Unknown error";
    res.status(500).json({ error: errorMessage });
  }
});

app.get("/sessions", (req: Request, res: Response) => {
  try {
    const sessionCount = (browserManager as any).getSessionCount?.() || 0;
    const sessionIds = (browserManager as any).getAllSessionIds?.() || [];
    res.json({
      count: sessionCount,
      sessionIds: sessionIds,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    const errorMessage =
      error instanceof Error ? error.message : "Unknown error";
    res.status(500).json({ error: errorMessage });
  }
});

app.post("/cleanup", async (req: Request, res: Response) => {
  try {
    console.log("[API] Cleanup request received");
    await (browserManager as any).forceCleanupAll?.();
    res.json({
      success: true,
      message: "All sessions and processes cleaned up",
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    const errorMessage =
      error instanceof Error ? error.message : "Unknown error";
    console.error("[API] Cleanup error:", errorMessage);
    res.status(500).json({ error: errorMessage });
  }
});

app.get("/mcp/tools", (req: Request, res: Response) => {
  try {
    const tools = toolRegistry.getAllTools();
    res.json({ tools });
  } catch (error) {
    const errorMessage =
      error instanceof Error ? error.message : "Unknown error";
    res.status(500).json({ error: errorMessage });
  }
});

app.post("/mcp/call", async (req: Request, res: Response) => {
  try {
    const request: ToolCallRequest = req.body;
    const callId = `${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

    console.log(`\n${"=".repeat(70)}`);
    console.log(`[MCP-CALL-${callId}] REQUEST`);
    console.log(`Tool: ${request.tool}`);
    console.log(`Arguments: ${JSON.stringify(request.arguments, null, 2)}`);
    console.log(`${"=".repeat(70)}`);

    if (!request.tool) {
      return res.status(400).json({ error: "Missing required field: tool" });
    }

    if (!request.arguments) {
      return res.status(400).json({
        error: "Missing required field: arguments",
      });
    }

    if (!toolRegistry.isValidTool(request.tool)) {
      return res.status(400).json({
        error: `Unknown tool: ${request.tool}`,
      });
    }

    const startTime = Date.now();
    const response = await toolExecutor.execute(request);
    const duration = Date.now() - startTime;

    console.log(`\n${"=".repeat(70)}`);
    console.log(`[MCP-CALL-${callId}] RESPONSE (${duration}ms)`);
    console.log(`Success: ${response.success}`);
    if (response.error) {
      console.log(`Error: ${response.error}`);
    } else {
      console.log(`Data: ${JSON.stringify(response.data, null, 2).substring(0, 500)}${JSON.stringify(response.data, null, 2).length > 500 ? '...<truncated>' : ''}`);
    }
    console.log(`${"=".repeat(70)}\n`);

    res.json(response);
  } catch (error) {
    const errorMessage =
      error instanceof Error ? error.message : "Unknown error";
    console.error(`[MCP-CALL] ERROR: ${errorMessage}`);
    res.status(500).json({ error: errorMessage });
  }
});

app.post("/api/:toolName", async (req: Request, res: Response) => {
  try {
    const { toolName } = req.params;
    const arguments_ = req.body;
    const callId = `${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

    console.log(`\n${"=".repeat(70)}`);
    console.log(`[API-CALL-${callId}] REQUEST via /api/${toolName}`);
    console.log(`Tool: ${toolName}`);
    console.log(`Arguments: ${JSON.stringify(arguments_, null, 2)}`);
    console.log(`${"=".repeat(70)}`);

    if (!toolRegistry.isValidTool(toolName)) {
      return res.status(404).json({
        error: `Tool "${toolName}" not found`,
      });
    }

    const request: ToolCallRequest = {
      tool: toolName,
      arguments: arguments_,
      sessionId: (req.query.sessionId as string) || undefined,
    };

    const startTime = Date.now();
    const response = await toolExecutor.execute(request);
    const duration = Date.now() - startTime;

    console.log(`\n${"=".repeat(70)}`);
    console.log(`[API-CALL-${callId}] RESPONSE (${duration}ms)`);
    console.log(`Success: ${response.success}`);
    if (response.error) {
      console.log(`Error: ${response.error}`);
    } else {
      console.log(`Data: ${JSON.stringify(response.data, null, 2).substring(0, 500)}${JSON.stringify(response.data, null, 2).length > 500 ? '...<truncated>' : ''}`);
    }
    console.log(`${"=".repeat(70)}\n`);

    res.json(response);
  } catch (error) {
    const errorMessage =
      error instanceof Error ? error.message : "Unknown error";
    console.error(`[API-CALL] ERROR: ${errorMessage}`);
    res.status(500).json({ error: errorMessage });
  }
});

app.all("*", (req: Request, res: Response) => {
  res.status(404).json({ error: "Endpoint not found" });
});

const server = app.listen(PORT, async () => {
  console.log(`\n${"=".repeat(70)}`);
  console.log(`🎭 Playwright MCP HTTP Server`);
  console.log(`${"=".repeat(70)}`);
  console.log(`✅ Running on http://localhost:${PORT}`);
  console.log(`📋 Tool discovery: GET http://localhost:${PORT}/mcp/tools`);
  console.log(`🚀 Tool execution: POST http://localhost:${PORT}/mcp/call`);
  console.log(`🧹 Cleanup: POST http://localhost:${PORT}/cleanup`);
  console.log(`📊 Health check: GET http://localhost:${PORT}/health`);
  console.log(`${"=".repeat(70)}\n`);
  
  // Initialize browser manager and cleanup orphaned processes on startup
  try {
    await (browserManager as any).initialize?.();
  } catch (error) {
    console.error("Error initializing browser manager:", error);
  }
});

process.on("SIGINT", async () => {
  console.log("\n[SHUTDOWN] Shutting down gracefully...");
  try {
    await (browserManager as any).forceCleanupAll?.();
  } catch (error) {
    console.error("[SHUTDOWN] Error during cleanup:", error);
  }
  server.close(() => {
    console.log("[SHUTDOWN] Server closed");
    process.exit(0);
  });
});

process.on("SIGTERM", async () => {
  console.log("\n[SHUTDOWN] Shutting down gracefully...");
  try {
    await (browserManager as any).forceCleanupAll?.();
  } catch (error) {
    console.error("[SHUTDOWN] Error during cleanup:", error);
  }
  server.close(() => {
    console.log("[SHUTDOWN] Server closed");
    process.exit(0);
  });
});
