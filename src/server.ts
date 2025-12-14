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
    },
  });
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

    const response = await toolExecutor.execute(request);
    res.json(response);
  } catch (error) {
    const errorMessage =
      error instanceof Error ? error.message : "Unknown error";
    res.status(500).json({ error: errorMessage });
  }
});

app.post("/api/:toolName", async (req: Request, res: Response) => {
  try {
    const { toolName } = req.params;
    const arguments_ = req.body;

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

    const response = await toolExecutor.execute(request);
    res.json(response);
  } catch (error) {
    const errorMessage =
      error instanceof Error ? error.message : "Unknown error";
    res.status(500).json({ error: errorMessage });
  }
});

app.all("*", (req: Request, res: Response) => {
  res.status(404).json({ error: "Endpoint not found" });
});

const server = app.listen(PORT, () => {
  console.log(`Playwright MCP HTTP Server running on http://localhost:${PORT}`);
  console.log(`Tool discovery: GET http://localhost:${PORT}/mcp/tools`);
  console.log(`Tool execution: POST http://localhost:${PORT}/mcp/call`);
});

process.on("SIGINT", async () => {
  console.log("\nShutting down gracefully...");
  await browserManager.closeAllSessions();
  server.close(() => {
    console.log("Server closed");
    process.exit(0);
  });
});

process.on("SIGTERM", async () => {
  console.log("\nShutting down gracefully...");
  await browserManager.closeAllSessions();
  server.close(() => {
    console.log("Server closed");
    process.exit(0);
  });
});
