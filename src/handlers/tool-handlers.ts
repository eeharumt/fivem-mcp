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
      return {
        content: [{
          type: "text",
          text: `Command executed: ${command}\nResponse: ${response}`
        }]
      };
    } catch (error) {
      throw new Error(`Failed to execute command: ${error instanceof Error ? error.message : 'Unknown error'}`);
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
          text: `CONSOLE LOGS:\n${content}`
        }]
      };
    } catch (error) {
      throw new Error(`Failed to get console logs: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  static async getPluginLogs(args: any, serverManager: FiveMServerManager) {
    const lines = Number(args?.lines || 50);
    const pluginName = args?.plugin_name ? String(args.plugin_name) : undefined;

    try {
      const content = await serverManager.getPluginLogs(lines, pluginName);
      const title = pluginName ? `PLUGIN '${pluginName}' LOGS` : 'ALL PLUGIN LOGS';
      return {
        content: [{
          type: "text",
          text: `${title}:\n${content}`
        }]
      };
    } catch (error) {
      throw new Error(`Failed to get plugin logs: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }
} 