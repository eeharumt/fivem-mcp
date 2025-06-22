#!/usr/bin/env node

/**
 * FiveM Plugin Development MCP Server
 * 
 * This MCP server provides tools for FiveM plugin development including:
 * - Plugin management (ensure, stop, restart)
 * - Server log monitoring
 * - RCON command execution
 */

import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import {
  CallToolRequestSchema,
  ListResourcesRequestSchema,
  ListToolsRequestSchema,
  ReadResourceRequestSchema,
} from "@modelcontextprotocol/sdk/types.js";

import { FiveMServerManager } from './managers/server-manager.js';
import { getFiveMConfig, hasAutoConnectConfig } from './config/environment.js';
import { ToolHandlers } from './handlers/tool-handlers.js';

// Global server manager instance
let serverManager: FiveMServerManager | null = null;

/**
 * Create an MCP server with capabilities for FiveM plugin development
 */
const server = new Server(
  {
    name: "mcp-fivem",
    version: "0.1.0",
  },
  {
    capabilities: {
      resources: {},
      tools: {},
      prompts: {},
    },
  }
);

/**
 * Handler for listing available resources
 */
server.setRequestHandler(ListResourcesRequestSchema, async () => {
  const resources = [
    {
      uri: "fivem://logs/recent",
      mimeType: "text/plain",
      name: "Recent Logs",
      description: "Recent server operation logs"
    },
    {
      uri: "fivem://console/info",
      mimeType: "text/plain",
      name: "Console Information",
      description: "Server console information via log files"
    }
  ];

  return { resources };
});

/**
 * Handler for reading resource contents
 */
server.setRequestHandler(ReadResourceRequestSchema, async (request) => {
  if (!serverManager) {
    throw new Error("Server manager not initialized. Please connect to server first.");
  }

  const url = new URL(request.params.uri);
  
  try {
    let content = "";
    
    switch (url.pathname) {
      case "/logs/recent":
        content = serverManager.getLogs().join('\n');
        break;
      case "/console/info":
        content = await serverManager.getConsoleLogs();
        break;
      default:
        throw new Error(`Unknown resource: ${url.pathname}`);
    }

    return {
      contents: [{
        uri: request.params.uri,
        mimeType: "text/plain",
        text: content
      }]
    };
  } catch (error) {
    throw new Error(`Failed to read resource: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
});

/**
 * Handler that lists available tools
 */
server.setRequestHandler(ListToolsRequestSchema, async () => {
  return {
    tools: [
      {
        name: "ensure_plugin",
        description: "Start/ensure a FiveM plugin",
        inputSchema: {
          type: "object",
          properties: {
            plugin_name: {
              type: "string",
              description: "Name of the plugin to ensure"
            }
          },
          required: ["plugin_name"]
        }
      },
      {
        name: "stop_plugin",
        description: "Stop a FiveM plugin",
        inputSchema: {
          type: "object",
          properties: {
            plugin_name: {
              type: "string",
              description: "Name of the plugin to stop"
            }
          },
          required: ["plugin_name"]
        }
      },
      {
        name: "restart_plugin",
        description: "Restart a FiveM plugin",
        inputSchema: {
          type: "object",
          properties: {
            plugin_name: {
              type: "string",
              description: "Name of the plugin to restart"
            }
          },
          required: ["plugin_name"]
        }
      },
      {
        name: "execute_command",
        description: "Execute a raw RCON command on the server",
        inputSchema: {
          type: "object",
          properties: {
            command: {
              type: "string",
              description: "RCON command to execute"
            }
          },
          required: ["command"]
        }
      },
      {
        name: "refresh_resources",
        description: "Refresh the FiveM server resource list",
        inputSchema: {
          type: "object",
          properties: {
            random_string: {
              type: "string",
              description: "Dummy parameter for no-parameter tools"
            }
          }
        }
      },
      {
        name: "get_server_logs",
        description: "Get FiveM server logs",
        inputSchema: {
          type: "object",
          properties: {
            lines: {
              type: "number",
              description: "Number of lines to retrieve (default: 100)"
            }
          }
        }
      },
      {
        name: "get_plugin_logs",
        description: "Get FiveM plugin/script logs",
        inputSchema: {
          type: "object",
          properties: {
            lines: {
              type: "number",
              description: "Number of lines to retrieve (default: 50)"
            },
            plugin_name: {
              type: "string",
              description: "Specific plugin name to filter logs for (optional)"
            }
          }
        }
      },
      {
        name: "clear_logs",
        description: "Clear the local operation logs",
        inputSchema: {
          type: "object",
          properties: {
            random_string: {
              type: "string",
              description: "Dummy parameter for no-parameter tools"
            }
          }
        }
      }
    ],
  };
});

/**
 * Handler that executes a tool
 */
server.setRequestHandler(CallToolRequestSchema, async (request) => {
  try {
    switch (request.params.name) {
      case "ensure_plugin":
        if (!serverManager) {
          throw new Error("Server manager not initialized. Server connection failed during startup.");
        }
        return await ToolHandlers.ensurePlugin(request.params.arguments, serverManager);
      case "stop_plugin":
        if (!serverManager) {
          throw new Error("Server manager not initialized. Server connection failed during startup.");
        }
        return await ToolHandlers.stopPlugin(request.params.arguments, serverManager);
      case "restart_plugin":
        if (!serverManager) {
          throw new Error("Server manager not initialized. Server connection failed during startup.");
        }
        return await ToolHandlers.restartPlugin(request.params.arguments, serverManager);
      case "execute_command":
        if (!serverManager) {
          throw new Error("Server manager not initialized. Server connection failed during startup.");
        }
        return await ToolHandlers.executeCommand(request.params.arguments, serverManager);
      case "refresh_resources":
        if (!serverManager) {
          throw new Error("Server manager not initialized. Server connection failed during startup.");
        }
        return await ToolHandlers.refreshResources(request.params.arguments, serverManager);
      case "get_server_logs":
        if (!serverManager) {
          throw new Error("Server manager not initialized. Server connection failed during startup.");
        }
        return await ToolHandlers.getServerLogs(request.params.arguments, serverManager);
      case "get_plugin_logs":
        if (!serverManager) {
          throw new Error("Server manager not initialized. Server connection failed during startup.");
        }
        return await ToolHandlers.getPluginLogs(request.params.arguments, serverManager);
      case "clear_logs":
        if (!serverManager) {
          throw new Error("Server manager not initialized. Server connection failed during startup.");
        }
        return await ToolHandlers.clearLogs(request.params.arguments, serverManager);
      default:
        throw new Error(`Tool not found: ${request.params.name}`);
    }
  } catch (error) {
    const errorContent = `Tool execution failed: ${error instanceof Error ? error.message : 'Unknown error'}`;
    return {
      content: [{
        type: "text",
        text: errorContent
      }]
    };
  }
});

/**
 * Initializes the server manager with auto-connect configuration if available.
 */
async function autoConnect(): Promise<void> {
  if (hasAutoConnectConfig()) {
    const envConfig = getFiveMConfig();
    console.error("Auto-connecting to server using environment variables...");
    try {
      const newServerManager = new FiveMServerManager(
        envConfig.host,
        envConfig.port,
        envConfig.password,
        envConfig.logsDir
      );
      await newServerManager.connect();
      serverManager = newServerManager;
      console.error(`Successfully connected to FiveM server at ${envConfig.host}:${envConfig.port}`);
      
      // Simple startup confirmation
      console.error(`MCP FiveM server connected to ${envConfig.host}:${envConfig.port}`);

    } catch (error) {
      const errorMsg = `Auto-connect failed: ${error instanceof Error ? error.message : 'Unknown error'}`;
      console.error(errorMsg);
      throw new Error(`Failed to connect to FiveM server during startup: ${errorMsg}`);
    }
  } else {
    console.error("MCP FiveM server requires environment variables for auto-connection.");
    console.error("Please set RCON_ADDRESS, RCON_PORT, and RCON_PASSWORD environment variables.");
    throw new Error("Required environment variables not found. Cannot start without server connection.");
  }
}

/**
 * Main function
 */
async function main() {
  await autoConnect();
  const transport = new StdioServerTransport();
  await server.connect(transport);
  console.error("MCP server started and listening on stdio");
}

main().catch(err => {
  console.error(err);
  process.exit(1);
}); 