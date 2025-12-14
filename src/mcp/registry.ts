import { toolSchemas } from "./schemas";
import { MCPTool } from "../types";

class ToolRegistry {
  private tools: Record<string, MCPTool> = {};

  constructor() {
    this.registerTools();
  }

  private registerTools(): void {
    Object.entries(toolSchemas).forEach(([name, schema]) => {
      this.tools[name] = schema;
    });
  }

  public getTool(name: string): MCPTool | undefined {
    return this.tools[name];
  }

  public getAllTools(): MCPTool[] {
    return Object.values(this.tools);
  }

  public isValidTool(name: string): boolean {
    return name in this.tools;
  }

  public validateInput(
    toolName: string,
    input: Record<string, any>
  ): { valid: boolean; error?: string } {
    const tool = this.getTool(toolName);
    if (!tool) {
      return { valid: false, error: `Tool "${toolName}" not found` };
    }

    const { properties, required } = tool.inputSchema;

    for (const requiredKey of required) {
      if (!(requiredKey in input)) {
        return {
          valid: false,
          error: `Missing required parameter: "${requiredKey}"`,
        };
      }
    }

    for (const [key, value] of Object.entries(input)) {
      if (key in properties) {
        const expectedType = properties[key].type;
        const actualType = Array.isArray(value) ? "array" : typeof value;

        if (expectedType !== actualType && value !== null) {
          return {
            valid: false,
            error: `Parameter "${key}" must be of type "${expectedType}", got "${actualType}"`,
          };
        }
      }
    }

    return { valid: true };
  }
}

export const toolRegistry = new ToolRegistry();
