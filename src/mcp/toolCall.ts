import axios from "axios";
import { PORT } from "..";
import { CallLLMProps } from "../types/types";

export async function toolCall({
  functionName,
  parameters,
}: Pick<CallLLMProps, "functionName" | "parameters">) {
  try {
    const mcpResponse = await axios.post(
      `http://localhost:${PORT}/api/mcp/execute`,
      {
        functionName,
        parameters,
      }
    );

    return mcpResponse.data;
  } catch (error) {
    console.error("Error calling MCP server:", error);
    throw new Error("Error calling MCP server");
  }
}
