import { MCPTool } from "../types";

export const toolSchemas: Record<string, MCPTool> = {
  open_page: {
    name: "open_page",
    description: "Open a URL in a browser and navigate to it",
    inputSchema: {
      type: "object",
      properties: {
        url: {
          type: "string",
          description: "The URL to navigate to",
        },
      },
      required: ["url"],
    },
  },
  click: {
    name: "click",
    description: "Click on an element matching the selector",
    inputSchema: {
      type: "object",
      properties: {
        selector: {
          type: "string",
          description: "CSS selector of the element to click",
        },
      },
      required: ["selector"],
    },
  },
  fill: {
    name: "fill",
    description: "Fill an input field with text",
    inputSchema: {
      type: "object",
      properties: {
        selector: {
          type: "string",
          description: "CSS selector of the input element",
        },
        text: {
          type: "string",
          description: "Text to fill in the input",
        },
      },
      required: ["selector", "text"],
    },
  },
  wait_for_selector: {
    name: "wait_for_selector",
    description: "Wait for an element to appear on the page (up to 30 seconds)",
    inputSchema: {
      type: "object",
      properties: {
        selector: {
          type: "string",
          description: "CSS selector of the element to wait for",
        },
        timeout: {
          type: "number",
          description: "Maximum time to wait in milliseconds (default: 30000)",
        },
      },
      required: ["selector"],
    },
  },
  fill_and_wait: {
    name: "fill_and_wait",
    description: "Fill an input field and wait for next element to appear",
    inputSchema: {
      type: "object",
      properties: {
        selector: {
          type: "string",
          description: "CSS selector of the input element",
        },
        text: {
          type: "string",
          description: "Text to fill in the input",
        },
        waitFor: {
          type: "string",
          description: "CSS selector of element to wait for after filling",
        },
        timeout: {
          type: "number",
          description: "Maximum time to wait in milliseconds (default: 30000)",
        },
      },
      required: ["selector", "text", "waitFor"],
    },
  },
  get_title: {
    name: "get_title",
    description: "Get the title of the current page",
    inputSchema: {
      type: "object",
      properties: {},
      required: [],
    },
  },
  screenshot: {
    name: "screenshot",
    description: "Take a screenshot of the current page and return base64",
    inputSchema: {
      type: "object",
      properties: {},
      required: [],
    },
  },
  close_browser: {
    name: "close_browser",
    description: "Close the browser and end the session",
    inputSchema: {
      type: "object",
      properties: {},
      required: [],
    },
  },
};
