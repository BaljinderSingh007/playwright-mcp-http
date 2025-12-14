# Playwright MCP HTTP Server

Standalone HTTP server for Playwright browser automation via MCP protocol.

## Setup

```bash
npm install
npm run dev
```

## HTTP Endpoints

### GET /mcp/tools
Discover available tools.

```bash
curl http://localhost:3000/mcp/tools
```

### POST /mcp/call
Execute a tool.

```bash
curl -X POST http://localhost:3000/mcp/call \
  -H "Content-Type: application/json" \
  -d '{
    "tool": "open_page",
    "arguments": { "url": "https://example.com" },
    "sessionId": "optional-session-id"
  }'
```

## Tools

- `open_page(url)` - Navigate to URL
- `click(selector)` - Click element
- `fill(selector, text)` - Fill input
- `get_title()` - Get page title
- `screenshot()` - Get screenshot as base64
- `close_browser()` - Close session

## Session Management

Sessions are isolated browser contexts. Provide `sessionId` to reuse context, or omit for auto-generation.
