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
  ListPromptsRequestSchema,
  GetPromptRequestSchema,
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
    version: "0.4.0",
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
            },
            wait_for_result: {
              type: "boolean",
              description: "For client mode: wait for execution result via async poll (default: true)"
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
            },
            wait_for_ack: {
              type: "boolean",
              description: "Wait for client delivery ack (client events) or synchronous server handler completion note (default: false)"
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
        name: "fivem_player_control",
        description: "Control a player for dev QA (teleport, state, input pulses, screenshot)",
        inputSchema: {
          type: "object",
          properties: {
            action: {
              type: "string",
              enum: ["get_state", "teleport", "freeze", "unfreeze", "input_pulse", "input_sequence", "input_tap", "screenshot", "set_health", "set_armor", "give_weapon", "set_heading", "spawn_vehicle", "enter_vehicle", "repair_vehicle", "look_at"],
              description: "Player control action"
            },
            player_id: {
              type: "number",
              description: "Target player server ID"
            },
            coords: {
              type: "object",
              properties: {
                x: { type: "number" },
                y: { type: "number" },
                z: { type: "number" },
                heading: { type: "number" }
              },
              required: ["x", "y", "z"],
              description: "Teleport destination (required for teleport)"
            },
            input: {
              type: "object",
              properties: {
                keys: {
                  type: "array",
                  items: { type: "string" },
                  description: "Keys such as W, A, S, D, E, SHIFT, SPACE, F"
                },
                duration_ms: {
                  type: "number",
                  description: "Duration in milliseconds for input_pulse/input_tap"
                }
              },
              required: ["keys"],
              description: "Input pulse/tap definition"
            },
            sequence: {
              type: "array",
              items: {
                type: "object",
                properties: {
                  keys: {
                    type: "array",
                    items: { type: "string" }
                  },
                  duration_ms: { type: "number" },
                  delay_ms: { type: "number" }
                },
                required: ["keys", "duration_ms"]
              },
              description: "Ordered input steps for input_sequence"
            },
            screenshot: {
              type: "object",
              properties: {
                quality: {
                  type: "number",
                  description: "JPEG quality from 0.1 to 1.0"
                }
              },
              description: "Screenshot options"
            },
            health: { type: "number", description: "Health value for set_health" },
            armor: { type: "number", description: "Armor value for set_armor" },
            weapon: { type: "string", description: "Weapon name for give_weapon" },
            ammo: { type: "number", description: "Ammo count for give_weapon" },
            heading: { type: "number", description: "Heading for set_heading or teleport" },
            model: { type: "string", description: "Vehicle model for spawn_vehicle" },
            seat: { type: "number", description: "Vehicle seat for enter_vehicle" },
            x: { type: "number", description: "Look-at X coordinate" },
            y: { type: "number", description: "Look-at Y coordinate" },
            z: { type: "number", description: "Look-at Z coordinate" },
            duration_ms: { type: "number", description: "Duration for look_at or input actions" }
          },
          required: ["action", "player_id"]
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
      },
      {
        name: "fivem_server_info",
        description: "Get detailed server information and configuration",
        inputSchema: {
          type: "object",
          properties: {
            info_type: {
              type: "string",
              enum: ["status", "config", "resources", "performance"],
              description: "Type of information to retrieve"
            }
          },
          required: ["info_type"]
        }
      },
      {
        name: "fivem_resource_analyze",
        description: "Analyze resource usage and performance",
        inputSchema: {
          type: "object",
          properties: {
            resource_name: {
              type: "string",
              description: "Name of the resource to analyze (optional for all resources)"
            }
          }
        }
      },
      {
        name: "fivem_batch_execute",
        description: "Execute multiple commands in batch (sequential or parallel)",
        inputSchema: {
          type: "object",
          properties: {
            commands: {
              type: "array",
              items: {
                type: "object",
                properties: {
                  mode: {
                    type: "string",
                    enum: ["server", "client", "rcon"],
                    description: "Execution mode"
                  },
                  command: {
                    type: "string",
                    description: "Command to execute"
                  },
                  player_id: {
                    type: "number",
                    description: "Player ID (for client mode)"
                  }
                },
                required: ["mode", "command"]
              },
              description: "Array of commands to execute"
            },
            execution_mode: {
              type: "string",
              enum: ["sequential", "parallel"],
              description: "Execution mode: sequential (one after another) or parallel (all at once)",
              default: "sequential"
            },
            stop_on_error: {
              type: "boolean",
              description: "Stop execution if any command fails (only for sequential mode)",
              default: true
            }
          },
          required: ["commands"]
        }
      },
      {
        name: "fivem_logs_watch",
        description: "Watch logs in real-time with filtering options",
        inputSchema: {
          type: "object",
          properties: {
            source: {
              type: "string",
              enum: ["server", "server_plugin", "client", "client_plugin"],
              description: "Log source to watch"
            },
            plugin_name: {
              type: "string",
              description: "Plugin name (for plugin logs)"
            },
            filter_pattern: {
              type: "string",
              description: "Regex pattern to filter log lines"
            },
            duration_seconds: {
              type: "number",
              description: "Duration to watch logs (default: 30 seconds)",
              default: 30
            }
          },
          required: ["source"]
        }
      },
      {
        name: "fivem_command_validate",
        description: "Validate FiveM command before execution",
        inputSchema: {
          type: "object",
          properties: {
            command: {
              type: "string",
              description: "Command to validate"
            },
            mode: {
              type: "string",
              enum: ["server", "client", "rcon"],
              description: "Execution mode"
            }
          },
          required: ["command", "mode"]
        }
      }
    ],
  };
});

/**
 * Handler for listing available prompts
 */
server.setRequestHandler(ListPromptsRequestSchema, async () => {
  return {
    prompts: [
      {
        name: "debug_plugin_issue",
        description: "Debug a FiveM plugin issue by checking logs, status, and configuration",
        arguments: [
          {
            name: "plugin_name",
            description: "Name of the plugin to debug",
            required: true
          }
        ]
      },
      {
        name: "develop_plugin_workflow",
        description: "Complete workflow for developing and testing a FiveM plugin",
        arguments: [
          {
            name: "plugin_name",
            description: "Name of the plugin to develop",
            required: true
          },
          {
            name: "action",
            description: "Action to perform: start, test, debug, or deploy",
            required: false
          }
        ]
      },
      {
        name: "server_health_check",
        description: "Perform comprehensive server health check including players, resources, and logs",
        arguments: []
      },
      {
        name: "monitor_server_logs",
        description: "Monitor server logs with filtering for specific issues or patterns",
        arguments: [
          {
            name: "filter_pattern",
            description: "Pattern to filter logs (e.g., 'error', 'warning', plugin name)",
            required: false
          },
          {
            name: "duration_minutes",
            description: "Duration to monitor in minutes",
            required: false
          }
        ]
      }
    ]
  };
});

/**
 * Handler for getting prompt content
 */
server.setRequestHandler(GetPromptRequestSchema, async (request) => {
  const { name, arguments: args } = request.params;
  
  if (!serverManager) {
    throw new Error("Server manager not initialized. Please connect to server first.");
  }

  switch (name) {
    case "debug_plugin_issue": {
      const pluginName = args?.plugin_name as string;
      if (!pluginName) {
        throw new Error("plugin_name is required");
      }
      
      return {
        messages: [
          {
            role: "user",
            content: {
              type: "text",
              text: `Debug the FiveM plugin "${pluginName}". Follow these steps:
1. Check plugin health status
2. Get recent plugin logs (server and client)
3. Verify plugin is loaded and running
4. Check for errors in server logs
5. Provide recommendations for fixing any issues found`
            }
          }
        ]
      };
    }
    
    case "develop_plugin_workflow": {
      const pluginName = args?.plugin_name as string;
      const action = args?.action as string | undefined;
      
      if (!pluginName) {
        throw new Error("plugin_name is required");
      }
      
      let workflowText = `Complete development workflow for plugin "${pluginName}":\n\n`;
      
      switch (action) {
        case "start":
          workflowText += `1. Ensure plugin is started\n2. Check plugin status\n3. Monitor initial logs`;
          break;
        case "test":
          workflowText += `1. Restart plugin to apply changes\n2. Monitor logs for errors\n3. Test plugin functionality\n4. Check client-side logs if applicable`;
          break;
        case "debug":
          workflowText += `1. Get plugin health status\n2. Retrieve server plugin logs\n3. Retrieve client plugin logs\n4. Analyze errors and provide fixes`;
          break;
        case "deploy":
          workflowText += `1. Stop plugin\n2. Refresh resources\n3. Ensure plugin\n4. Verify deployment success\n5. Monitor logs for issues`;
          break;
        default:
          workflowText += `1. Check current plugin status\n2. Restart plugin if needed\n3. Monitor logs\n4. Test functionality\n5. Debug any issues`;
      }
      
      return {
        messages: [
          {
            role: "user",
            content: {
              type: "text",
              text: workflowText
            }
          }
        ]
      };
    }
    
    case "server_health_check": {
      return {
        messages: [
          {
            role: "user",
            content: {
              type: "text",
              text: `Perform comprehensive FiveM server health check:
1. Get server status (connected players)
2. Check server configuration (hostname, max clients, OneSync)
3. Analyze resource performance
4. Get recent server logs (last 50 lines)
5. Check for any errors or warnings
6. Provide health summary and recommendations`
            }
          }
        ]
      };
    }
    
    case "monitor_server_logs": {
      const filterPattern = args?.filter_pattern as string | undefined;
      const durationMinutes = args?.duration_minutes as number | undefined;
      
      let monitorText = "Monitor FiveM server logs";
      if (filterPattern) {
        monitorText += ` filtered by pattern: "${filterPattern}"`;
      }
      if (durationMinutes) {
        monitorText += ` for ${durationMinutes} minutes`;
      }
      monitorText += ".\n\n";
      monitorText += "1. Start log monitoring\n";
      monitorText += "2. Watch for errors, warnings, or specified patterns\n";
      monitorText += "3. Provide summary of findings\n";
      monitorText += "4. Alert on critical issues";
      
      return {
        messages: [
          {
            role: "user",
            content: {
              type: "text",
              text: monitorText
            }
          }
        ]
      };
    }
    
    default:
      throw new Error(`Unknown prompt: ${name}`);
  }
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
      case "fivem_player_control":
        if (!serverManager) {
          throw new Error("Server manager not initialized. Server connection failed during startup.");
        }
        return await ToolHandlers.playerControl(request.params.arguments, serverManager);
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
      case "fivem_server_info":
        if (!serverManager) {
          throw new Error("Server manager not initialized. Server connection failed during startup.");
        }
        return await ToolHandlers.serverInfo(request.params.arguments, serverManager);
      case "fivem_resource_analyze":
        if (!serverManager) {
          throw new Error("Server manager not initialized. Server connection failed during startup.");
        }
        return await ToolHandlers.resourceAnalyze(request.params.arguments, serverManager);
      case "fivem_batch_execute":
        if (!serverManager) {
          throw new Error("Server manager not initialized. Server connection failed during startup.");
        }
        return await ToolHandlers.batchExecute(request.params.arguments, serverManager);
      case "fivem_logs_watch":
        if (!serverManager) {
          throw new Error("Server manager not initialized. Server connection failed during startup.");
        }
        return await ToolHandlers.logsWatch(request.params.arguments, serverManager);
      case "fivem_command_validate":
        if (!serverManager) {
          throw new Error("Server manager not initialized. Server connection failed during startup.");
        }
        return await ToolHandlers.commandValidate(request.params.arguments, serverManager);
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