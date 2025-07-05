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
    version: "0.3.0",
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
        name: "fivem_plugin_manage",
        description: "Manage FiveM plugins (ensure/stop/restart/refresh)",
        inputSchema: {
          type: "object",
          properties: {
            action: {
              type: "string",
              enum: ["ensure", "stop", "restart", "refresh"],
              description: "Action to perform: ensure/stop/restart plugin, or refresh resources"
            },
            plugin_name: {
              type: "string",
              description: "Name of the plugin (required for ensure/stop/restart, not required for refresh)"
            }
          },
          required: ["action"]
        }
      },
      {
        name: "fivem_command_execute",
        description: "Execute FiveM commands on server or client side",
        inputSchema: {
          type: "object",
          properties: {
            mode: {
              type: "string",
              enum: ["server", "client"],
              description: "Execution mode: 'server' for server-side command execution, 'client' for client-side command execution"
            },
            command: {
              type: "string",
              description: "Command to execute"
            },
            player_id: {
              type: "number",
              description: "Target player ID (optional for client mode - if not provided, executes on all clients)"
            }
          },
          required: ["mode", "command"]
        }
      },
      {
        name: "fivem_rcon_execute",
        description: "Execute direct RCON commands (low-level server management)",
        inputSchema: {
          type: "object",
          properties: {
            command: {
              type: "string",
              description: "RCON command to execute directly"
            }
          },
          required: ["command"]
        }
      },
      {
        name: "fivem_event_trigger",
        description: "Trigger FiveM events (server/client) via mcp-bridge plugin",
        inputSchema: {
          type: "object",
          properties: {
            type: {
              type: "string",
              enum: ["server", "client"],
              description: "Event type: server or client"
            },
            event_name: {
              type: "string",
              description: "Name of the event to trigger"
            },
            player_id: {
              type: "number",
              description: "Target player ID (required for client events)"
            },
            args: {
              type: "string",
              description: "JSON string of arguments to pass to the event (optional)"
            }
          },
          required: ["type", "event_name"]
        }
      },
      {
        name: "fivem_player_get",
        description: "Get player information (list/info) via mcp-bridge plugin",
        inputSchema: {
          type: "object",
          properties: {
            action: {
              type: "string",
              enum: ["list", "info"],
              description: "Action: list for all players, info for specific player"
            },
            player_id: {
              type: "number",
              description: "Player ID (required for info action)"
            }
          },
          required: ["action"]
        }
      },
      {
        name: "fivem_logs_get",
        description: "Get FiveM logs from various sources",
        inputSchema: {
          type: "object",
          properties: {
            source: {
              type: "string",
              enum: ["server", "server_plugin", "client", "client_plugin"],
              description: "Log source: server, server_plugin, client, or client_plugin"
            },
            lines: {
              type: "number",
              description: "Number of lines to retrieve (default varies by source)"
            },
            plugin_name: {
              type: "string",
              description: "Specific plugin name to filter logs for (optional, for plugin logs)"
            }
          },
          required: ["source"]
        }
      },
      {
        name: "fivem_system_manage",
        description: "Manage FiveM system operations (health/clear)",
        inputSchema: {
          type: "object",
          properties: {
            action: {
              type: "string",
              enum: ["health", "clear"],
              description: "System action: health check or clear logs"
            }
          },
          required: ["action"]
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
      case "fivem_plugin_manage":
        if (!serverManager) {
          throw new Error("Server manager not initialized. Server connection failed during startup.");
        }
        return await ToolHandlers.pluginManage(request.params.arguments, serverManager);
      case "fivem_command_execute":
        if (!serverManager) {
          throw new Error("Server manager not initialized. Server connection failed during startup.");
        }
        return await ToolHandlers.commandExecute(request.params.arguments, serverManager);
      case "fivem_rcon_execute":
        if (!serverManager) {
          throw new Error("Server manager not initialized. Server connection failed during startup.");
        }
        return await ToolHandlers.rconExecute(request.params.arguments, serverManager);
      case "fivem_event_trigger":
        if (!serverManager) {
          throw new Error("Server manager not initialized. Server connection failed during startup.");
        }
        return await ToolHandlers.eventTrigger(request.params.arguments, serverManager);
      case "fivem_player_get":
        if (!serverManager) {
          throw new Error("Server manager not initialized. Server connection failed during startup.");
        }
        return await ToolHandlers.playerGet(request.params.arguments, serverManager);
      case "fivem_logs_get":
        if (!serverManager) {
          throw new Error("Server manager not initialized. Server connection failed during startup.");
        }
        return await ToolHandlers.logsGet(request.params.arguments, serverManager);
      case "fivem_system_manage":
        if (!serverManager) {
          throw new Error("Server manager not initialized. Server connection failed during startup.");
        }
        return await ToolHandlers.systemManage(request.params.arguments, serverManager);
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
        envConfig.logsDir,
        envConfig.clientLogsDir
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