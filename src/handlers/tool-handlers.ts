import { FiveMServerManager } from '../managers/server-manager.js';
import { getFiveMConfig } from '../config/environment.js';

/**
 * Tool handler functions for MCP server
 */
export class ToolHandlers {
  
  static async connectServer(
    args: any,
    setServerManager: (manager: FiveMServerManager) => void
  ) {
    const envConfig = getFiveMConfig();
    
    const host = String(args?.host || envConfig.host || "localhost");
    const port = Number(args?.port || envConfig.port || 30120);
    const password = String(args?.password || envConfig.password || "");
    const logsDir = String(args?.logs_dir || envConfig.logsDir || "");
    
    if (!password) {
      throw new Error("RCON password is required. Provide it as a parameter or set RCON_PASSWORD environment variable.");
    }

    try {
      const newServerManager = new FiveMServerManager(host, port, password, logsDir);
      await newServerManager.connect();
      setServerManager(newServerManager);
      
      const sourceInfo = envConfig.host && envConfig.port && envConfig.password ? 
        " (using environment variables)" : "";
      const pathInfo = logsDir ? ` with logs dir: ${logsDir}` : "";
      
      return {
        content: [{
          type: "text",
          text: `Successfully connected to FiveM server at ${host}:${port}${sourceInfo}${pathInfo}`
        }]
      };
    } catch (error) {
      throw new Error(`Failed to connect: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  static async pluginManage(args: any, serverManager: FiveMServerManager) {
    const action = String(args?.action);
    const pluginName = args?.plugin_name ? String(args.plugin_name) : undefined;
    
    if (!action) {
      throw new Error("Action is required");
    }

    if ((action === "ensure" || action === "stop" || action === "restart") && !pluginName) {
      throw new Error("Plugin name is required for ensure/stop/restart actions");
    }

    try {
      let response: string;
      
      switch (action) {
        case "ensure":
          response = await serverManager.ensurePlugin(pluginName!);
          break;
        case "stop":
          response = await serverManager.stopPlugin(pluginName!);
          break;
        case "restart":
          response = await serverManager.restartPlugin(pluginName!);
          break;
        case "refresh":
          response = await serverManager.refreshResources();
          return {
            content: [{
              type: "text",
              text: `Resources refreshed: ${response}`
            }]
          };
        default:
          throw new Error(`Unknown action: ${action}`);
      }
      
      return {
        content: [{
          type: "text",
          text: `Plugin ${pluginName} ${action}: ${response}`
        }]
      };
    } catch (error) {
      throw new Error(`Failed to ${action} ${action === "refresh" ? "resources" : "plugin"}: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  static async commandExecute(args: any, serverManager: FiveMServerManager) {
    const mode = String(args?.mode);
    const command = String(args?.command);
    const playerId = args?.player_id ? Number(args.player_id) : undefined;
    
    if (!mode || !command) {
      throw new Error("Mode and command are required");
    }

    try {
      let response: any;
      
      switch (mode) {
        case "server":
          response = await serverManager.executePluginCommand(command);
          break;
        case "client":
          response = await serverManager.executeClientCommand(command, playerId);
          break;
        default:
          throw new Error(`Unknown mode: ${mode}`);
      }
      
      if (!response.success) {
        throw new Error(`Command failed: ${response.message}`);
      }
      
      const target = mode === "client" ? 
        (playerId ? ` on player ${playerId}` : ' on all clients') : 
        ' on server';
      
      return {
        content: [{
          type: "text",
          text: `${mode.charAt(0).toUpperCase() + mode.slice(1)} command executed${target}: ${command}\nResponse: ${response.data?.response || response.message}`
        }]
      };
    } catch (error) {
      throw new Error(`Failed to execute ${mode} command: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  static async rconExecute(args: any, serverManager: FiveMServerManager) {
    const command = String(args?.command);
    
    if (!command) {
      throw new Error("Command is required");
    }

    try {
      const response = await serverManager.executeCommand(command);
      
      if (!response.success) {
        throw new Error(`RCON command failed: ${response.message}`);
      }
      
      return {
        content: [{
          type: "text",
          text: `RCON command executed: ${command}\nResponse: ${response.data?.response || response.message}`
        }]
      };
    } catch (error) {
      throw new Error(`Failed to execute RCON command: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  static async eventTrigger(args: any, serverManager: FiveMServerManager) {
    const type = String(args?.type);
    const eventName = String(args?.event_name);
    const playerId = args?.player_id ? Number(args.player_id) : undefined;
    const eventArgs = args?.args ? JSON.parse(String(args.args)) : undefined;
    
    if (!type || !eventName) {
      throw new Error("Type and event name are required");
    }

    if (type === "client" && !playerId) {
      throw new Error("Player ID is required for client events");
    }

    try {
      let response: string;
      
      switch (type) {
        case "server":
          response = await serverManager.triggerServerEventViaPlugin(eventName, eventArgs);
          break;
        case "client":
          response = await serverManager.triggerClientEventViaPlugin(eventName, playerId!, eventArgs);
          break;
        default:
          throw new Error(`Unknown event type: ${type}`);
      }
      
      const playerInfo = type === "client" ? ` (Player: ${playerId})` : "";
      return {
        content: [{
          type: "text",
          text: `${type.charAt(0).toUpperCase() + type.slice(1)} Event triggered via plugin: ${eventName}${playerInfo}\nArguments: ${JSON.stringify(eventArgs || [])}\nResponse: ${response}`
        }]
      };
    } catch (error) {
      throw new Error(`Failed to trigger ${type} event via plugin: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  static async playerGet(args: any, serverManager: FiveMServerManager) {
    const action = String(args?.action);
    const playerId = args?.player_id ? Number(args.player_id) : undefined;
    
    if (!action) {
      throw new Error("Action is required");
    }

    if (action === "info" && !playerId) {
      throw new Error("Player ID is required for info action");
    }

    try {
      let response: string;
      
      switch (action) {
        case "list":
          response = await serverManager.getPlayersViaPlugin();
          break;
        case "info":
          response = await serverManager.getPlayerInfoViaPlugin(playerId!);
          break;
        default:
          throw new Error(`Unknown action: ${action}`);
      }
      
      const title = action === "info" ? `Player info retrieved via plugin (Player: ${playerId})` : "Players retrieved via plugin";
      return {
        content: [{
          type: "text",
          text: `${title}:\n${response}`
        }]
      };
    } catch (error) {
      throw new Error(`Failed to get player ${action} via plugin: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  static async logsGet(args: any, serverManager: FiveMServerManager) {
    const source = String(args?.source);
    const lines = args?.lines ? Number(args.lines) : undefined;
    const pluginName = args?.plugin_name ? String(args.plugin_name) : undefined;
    
    if (!source) {
      throw new Error("Source is required");
    }

    try {
      let content: string;
      let defaultLines: number;
      let title: string;
      
      switch (source) {
        case "server":
          defaultLines = 100;
          content = await serverManager.getConsoleLogs(lines || defaultLines);
          title = "FIVEM SERVER CONSOLE LOGS";
          break;
        case "server_plugin":
          defaultLines = 50;
          content = await serverManager.getPluginLogs(lines || defaultLines, pluginName);
          title = pluginName ? `FIVEM SERVER PLUGIN '${pluginName}' LOGS` : 'FIVEM SERVER PLUGIN LOGS';
          break;
        case "client":
          defaultLines = 100;
          content = await serverManager.getClientLogs(lines || defaultLines);
          title = "FIVEM CLIENT LOGS";
          break;
        case "client_plugin":
          defaultLines = 50;
          content = await serverManager.getClientPluginLogs(lines || defaultLines, pluginName);
          title = pluginName ? `FIVEM CLIENT PLUGIN '${pluginName}' LOGS` : 'FIVEM CLIENT PLUGIN LOGS';
          break;
        default:
          throw new Error(`Unknown source: ${source}`);
      }
      
      return {
        content: [{
          type: "text",
          text: `=== ${title} ===\n${content}`
        }]
      };
    } catch (error) {
      throw new Error(`Failed to get ${source} logs: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  static async systemManage(args: any, serverManager: FiveMServerManager) {
    const action = String(args?.action);
    
    if (!action) {
      throw new Error("Action is required");
    }

    try {
      let response: string;
      
      switch (action) {
        case "health":
          response = await serverManager.checkPluginHealth();
          return {
            content: [{
              type: "text",
              text: `Plugin health check:\n${response}`
            }]
          };
        case "clear":
          serverManager.clearLogs();
          return {
            content: [{
              type: "text",
              text: "Operation logs cleared"
            }]
          };
        default:
          throw new Error(`Unknown action: ${action}`);
      }
    } catch (error) {
      throw new Error(`Failed to ${action} system: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  static async ensurePlugin(args: any, serverManager: FiveMServerManager) {
    const pluginName = String(args?.plugin_name);
    if (!pluginName) {
      throw new Error("Plugin name is required");
    }

    try {
      const response = await serverManager.ensurePlugin(pluginName);
      return {
        content: [{
          type: "text",
          text: `Plugin ${pluginName} ensured: ${response}`
        }]
      };
    } catch (error) {
      throw new Error(`Failed to ensure plugin: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  static async stopPlugin(args: any, serverManager: FiveMServerManager) {
    const pluginName = String(args?.plugin_name);
    if (!pluginName) {
      throw new Error("Plugin name is required");
    }

    try {
      const response = await serverManager.stopPlugin(pluginName);
      return {
        content: [{
          type: "text",
          text: `Plugin ${pluginName} stopped: ${response}`
        }]
      };
    } catch (error) {
      throw new Error(`Failed to stop plugin: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  static async restartPlugin(args: any, serverManager: FiveMServerManager) {
    const pluginName = String(args?.plugin_name);
    if (!pluginName) {
      throw new Error("Plugin name is required");
    }

    try {
      const response = await serverManager.restartPlugin(pluginName);
      return {
        content: [{
          type: "text",
          text: `Plugin ${pluginName} restarted: ${response}`
        }]
      };
    } catch (error) {
      throw new Error(`Failed to restart plugin: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  static async executeCommand(args: any, serverManager: FiveMServerManager) {
    const command = String(args?.command);
    if (!command) {
      throw new Error("Command is required");
    }

    try {
      const response = await serverManager.executeCommand(command);
      
      if (!response.success) {
        throw new Error(`Command failed: ${response.message}`);
      }
      
      return {
        content: [{
          type: "text",
          text: `RCON Command executed: ${command}\nResponse: ${response.data?.response || response.message}`
        }]
      };
    } catch (error) {
      throw new Error(`Failed to execute RCON command: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  static async executePluginCommand(args: any, serverManager: FiveMServerManager) {
    const command = String(args?.command);
    if (!command) {
      throw new Error("Command is required");
    }

    try {
      const response = await serverManager.executePluginCommand(command);
      
      if (!response.success) {
        throw new Error(`Plugin command failed: ${response.message}`);
      }
      
      return {
        content: [{
          type: "text",
          text: `Plugin Command executed: ${command}\nResponse: ${response.data?.response || response.message}`
        }]
      };
    } catch (error) {
      throw new Error(`Failed to execute plugin command: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  static async triggerServerEventViaPlugin(args: any, serverManager: FiveMServerManager) {
    const eventName = String(args?.event_name);
    const eventArgs = args?.args ? JSON.parse(String(args.args)) : undefined;
    
    if (!eventName) {
      throw new Error("Event name is required");
    }

    try {
      const response = await serverManager.triggerServerEventViaPlugin(eventName, eventArgs);
      return {
        content: [{
          type: "text",
          text: `Server Event triggered via plugin: ${eventName}\nArguments: ${JSON.stringify(eventArgs || [])}\nResponse: ${response}`
        }]
      };
    } catch (error) {
      throw new Error(`Failed to trigger server event via plugin: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  static async triggerClientEventViaPlugin(args: any, serverManager: FiveMServerManager) {
    const eventName = String(args?.event_name);
    const playerId = Number(args?.player_id);
    const eventArgs = args?.args ? JSON.parse(String(args.args)) : undefined;
    
    if (!eventName) {
      throw new Error("Event name is required");
    }
    
    if (!playerId) {
      throw new Error("Player ID is required");
    }

    try {
      const response = await serverManager.triggerClientEventViaPlugin(eventName, playerId, eventArgs);
      return {
        content: [{
          type: "text",
          text: `Client Event triggered via plugin: ${eventName} (Player: ${playerId})\nArguments: ${JSON.stringify(eventArgs || [])}\nResponse: ${response}`
        }]
      };
    } catch (error) {
      throw new Error(`Failed to trigger client event via plugin: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  static async getPlayersViaPlugin(args: any, serverManager: FiveMServerManager) {
    try {
      const response = await serverManager.getPlayersViaPlugin();
      return {
        content: [{
          type: "text",
          text: `Players retrieved via plugin:\n${response}`
        }]
      };
    } catch (error) {
      throw new Error(`Failed to get players via plugin: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  static async getPlayerInfoViaPlugin(args: any, serverManager: FiveMServerManager) {
    const playerId = Number(args?.player_id);
    
    if (!playerId) {
      throw new Error("Player ID is required");
    }

    try {
      const response = await serverManager.getPlayerInfoViaPlugin(playerId);
      return {
        content: [{
          type: "text",
          text: `Player info retrieved via plugin (Player: ${playerId}):\n${response}`
        }]
      };
    } catch (error) {
      throw new Error(`Failed to get player info via plugin: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  static async checkPluginHealth(args: any, serverManager: FiveMServerManager) {
    try {
      const response = await serverManager.checkPluginHealth();
      return {
        content: [{
          type: "text",
          text: `Plugin health check:\n${response}`
        }]
      };
    } catch (error) {
      throw new Error(`Failed to check plugin health: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  static async refreshResources(args: any, serverManager: FiveMServerManager) {
    try {
      const response = await serverManager.refreshResources();
      return {
        content: [{
          type: "text",
          text: `Resources refreshed: ${response}`
        }]
      };
    } catch (error) {
      throw new Error(`Failed to refresh resources: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  static async clearLogs(args: any, serverManager: FiveMServerManager) {
    serverManager.clearLogs();
    return {
      content: [{
        type: "text",
        text: "Operation logs cleared"
      }]
    };
  }

  static async getServerLogs(args: any, serverManager: FiveMServerManager) {
    const lines = Number(args?.lines || 100);

    try {
      const content = await serverManager.getConsoleLogs(lines);
      return {
        content: [{
          type: "text",
          text: `=== FIVEM SERVER CONSOLE LOGS ===\n${content}`
        }]
      };
    } catch (error) {
      throw new Error(`Failed to get server console logs: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  static async getPluginLogs(args: any, serverManager: FiveMServerManager) {
    const lines = Number(args?.lines || 50);
    const pluginName = args?.plugin_name ? String(args.plugin_name) : undefined;

    try {
      const content = await serverManager.getPluginLogs(lines, pluginName);
      const title = pluginName ? `FIVEM SERVER PLUGIN '${pluginName}' LOGS` : 'FIVEM SERVER PLUGIN LOGS';
      return {
        content: [{
          type: "text",
          text: `=== ${title} ===\n${content}`
        }]
      };
    } catch (error) {
      throw new Error(`Failed to get server plugin logs: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  static async getServerPluginLogs(args: any, serverManager: FiveMServerManager) {
    const lines = Number(args?.lines || 50);
    const pluginName = args?.plugin_name ? String(args.plugin_name) : undefined;

    try {
      const content = await serverManager.getPluginLogs(lines, pluginName);
      const title = pluginName ? `FIVEM SERVER PLUGIN '${pluginName}' LOGS` : 'FIVEM SERVER PLUGIN LOGS';
      return {
        content: [{
          type: "text",
          text: `=== ${title} ===\n${content}`
        }]
      };
    } catch (error) {
      throw new Error(`Failed to get server plugin logs: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  static async getClientLogs(args: any, serverManager: FiveMServerManager) {
    const lines = Number(args?.lines || 100);

    try {
      const content = await serverManager.getClientLogs(lines);
      return {
        content: [{
          type: "text",
          text: `=== FIVEM CLIENT LOGS ===\n${content}`
        }]
      };
    } catch (error) {
      throw new Error(`Failed to get client logs: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  static async getClientPluginLogs(args: any, serverManager: FiveMServerManager) {
    const lines = Number(args?.lines || 50);
    const pluginName = args?.plugin_name ? String(args.plugin_name) : undefined;

    try {
      const content = await serverManager.getClientPluginLogs(lines, pluginName);
      const title = pluginName ? `FIVEM CLIENT PLUGIN '${pluginName}' LOGS` : 'FIVEM CLIENT PLUGIN LOGS';
      return {
        content: [{
          type: "text",
          text: `=== ${title} ===\n${content}`
        }]
      };
    } catch (error) {
      throw new Error(`Failed to get client plugin logs: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  static async getRealtimeServerLogs(args: any, serverManager: FiveMServerManager) {
    const lines = Number(args?.lines || 50);

    try {
      const content = await serverManager.getRealtimeServerLogs(lines);
      return {
        content: [{
          type: "text",
          text: content
        }]
      };
    } catch (error) {
      throw new Error(`Failed to get real-time server logs: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }
} 