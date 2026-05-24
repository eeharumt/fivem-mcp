import { FiveMServerManager } from '../managers/server-manager.js';
import { getFiveMConfig } from '../config/environment.js';
import { Validators } from '../utils/validators.js';
import { ResponseParser } from '../utils/response-parser.js';
import { BatchExecuteArgs, CommandExecuteArgs, LogsWatchArgs, CommandValidateArgs, PlayerControlArgs } from '../types/index.js';
import * as fs from 'fs';
import * as path from 'path';

/**
 * Tool handler functions for MCP server
 */
export class ToolHandlers {
  private static cleanupOldScreenshots(screenshotsDir: string): void {
    if (!fs.existsSync(screenshotsDir)) {
      return;
    }

    const maxAgeMs = 24 * 60 * 60 * 1000;
    const now = Date.now();

    for (const entry of fs.readdirSync(screenshotsDir)) {
      const filePath = path.join(screenshotsDir, entry);
      try {
        const stats = fs.statSync(filePath);
        if (stats.isFile() && (now - stats.mtimeMs) > maxAgeMs) {
          fs.unlinkSync(filePath);
        }
      } catch {
        // Ignore cleanup failures for individual files
      }
    }
  }

  static buildPlayerControlPayload(args: PlayerControlArgs): Record<string, unknown> {
    switch (args.action) {
      case 'teleport':
        return { coords: args.coords };
      case 'input_pulse':
      case 'input_tap':
        return { input: args.input };
      case 'input_sequence':
        return { sequence: args.sequence };
      case 'screenshot':
        return { screenshot: args.screenshot ?? {} };
      case 'set_health':
        return { health: args.health };
      case 'set_armor':
        return { armor: args.armor };
      case 'give_weapon':
        return { weapon: args.weapon, ammo: args.ammo };
      case 'set_heading':
        return { heading: args.heading };
      case 'spawn_vehicle':
        return { model: args.model };
      case 'enter_vehicle':
        return { seat: args.seat };
      case 'look_at':
        return { x: args.x, y: args.y, z: args.z, duration_ms: args.duration_ms };
      default:
        return {};
    }
  }

  private static formatPlayerControlText(action: string, playerId: number, data: unknown, message: string): string {
    return `Player control (${action}) for player ${playerId}:\n${message}\n\n${JSON.stringify(data, null, 2)}`;
  }
  
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
    const waitForResult = args?.wait_for_result !== false;
    
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
          response = await serverManager.executeClientCommand(command, playerId, waitForResult);
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
      
      const responseText = JSON.stringify(response.data ?? response.message, null, 2);
      
      return {
        content: [{
          type: "text",
          text: `${mode.charAt(0).toUpperCase() + mode.slice(1)} command executed${target}: ${command}\nResponse: ${responseText}`
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
      
      const responseText = (response.data && typeof response.data === 'object' && 'response' in response.data)
        ? (response.data as { response: string }).response
        : response.message;
      
      return {
        content: [{
          type: "text",
          text: `RCON command executed: ${command}\nResponse: ${responseText}`
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
    const waitForAck = args?.wait_for_ack === true;
    
    if (!type || !eventName) {
      throw new Error("Type and event name are required");
    }

    if (type === "client" && !playerId) {
      throw new Error("Player ID is required for client events");
    }

    try {
      let response: any;
      
      switch (type) {
        case "server":
          response = await serverManager.triggerServerEventViaPlugin(
            eventName,
            Array.isArray(eventArgs) ? eventArgs : eventArgs !== undefined ? [eventArgs] : undefined,
            waitForAck
          );
          break;
        case "client":
          response = await serverManager.triggerClientEventViaPlugin(
            eventName,
            playerId!,
            Array.isArray(eventArgs) ? eventArgs : eventArgs !== undefined ? [eventArgs] : undefined,
            waitForAck
          );
          break;
        default:
          throw new Error(`Unknown event type: ${type}`);
      }

      if (!response.success) {
        throw new Error(`Event trigger failed: ${response.message}`);
      }
      
      const playerInfo = type === "client" ? ` (Player: ${playerId})` : "";
      return {
        content: [{
          type: "text",
          text: `${type.charAt(0).toUpperCase() + type.slice(1)} event triggered via plugin: ${eventName}${playerInfo}\nArguments: ${JSON.stringify(eventArgs ?? [])}\nWait for ack: ${waitForAck}\nResponse: ${JSON.stringify(response.data ?? response.message, null, 2)}`
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

  static async playerControl(args: any, serverManager: FiveMServerManager) {
    if (!Validators.validatePlayerControlArgs(args)) {
      const validationError = Validators.createValidationError('Invalid player control arguments');
      return {
        content: [{
          type: "text",
          text: validationError.message
        }]
      };
    }

    const controlArgs = args as PlayerControlArgs;
    const payload = ToolHandlers.buildPlayerControlPayload(controlArgs);

    try {
      const response = await serverManager.playerControlViaPlugin(
        controlArgs.player_id,
        controlArgs.action,
        payload
      );

      if (!response.success) {
        throw new Error(response.message);
      }

      const responseData = (response.data && typeof response.data === 'object')
        ? response.data as Record<string, unknown>
        : { response: response.data };

      const content: Array<{ type: 'text'; text: string } | { type: 'image'; data: string; mimeType: string }> = [{
        type: 'text',
        text: ToolHandlers.formatPlayerControlText(
          controlArgs.action,
          controlArgs.player_id,
          responseData,
          response.message
        ),
      }];

      if (controlArgs.action === 'screenshot') {
        const config = getFiveMConfig();
        const screenshotsDir = config.screenshotsDir;
        if (screenshotsDir) {
          ToolHandlers.cleanupOldScreenshots(screenshotsDir);
        }

        const filePath = typeof responseData.file_path === 'string'
          ? responseData.file_path
          : (typeof responseData.filename === 'string' && screenshotsDir
            ? path.join(screenshotsDir, responseData.filename)
            : undefined);

        if (filePath && fs.existsSync(filePath)) {
          const imageBuffer = fs.readFileSync(filePath);
          content.push({
            type: 'image',
            data: imageBuffer.toString('base64'),
            mimeType: 'image/jpeg',
          });
        }
      }

      return { content };
    } catch (error) {
      throw new Error(`Failed to execute player control (${controlArgs.action}): ${error instanceof Error ? error.message : 'Unknown error'}`);
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

  static async serverInfo(args: any, serverManager: FiveMServerManager) {
    const infoType = String(args?.info_type);
    
    if (!infoType) {
      throw new Error("Info type is required");
    }

    try {
      let response: string;
      let title: string;
      
      switch (infoType) {
        case "status": {
          // Get player count via mcp-bridge plugin
          const playersResponse = await serverManager.getPlayersViaPlugin();
          response = `Server Status:\n${playersResponse}`;
          title = "SERVER STATUS";
          break;
        }
        case "config": {
          const hostname = await serverManager.sendCommand('sv_hostname');
          const maxClients = await serverManager.sendCommand('sv_maxClients');
          const oneSync = await serverManager.sendCommand('onesync');
          response = `Hostname:\n${hostname}\n\nMax Clients:\n${maxClients}\n\nOneSync:\n${oneSync}`;
          title = "SERVER CONFIGURATION";
          break;
        }
        case "resources": {
          response = await serverManager.sendCommand('refresh');
          title = "RESOURCE REFRESH";
          break;
        }
        case "performance": {
          const version = await serverManager.sendCommand('version');
          response = `Version:\n${version}`;
          title = "PERFORMANCE INFO";
          break;
        }
        default:
          throw new Error(`Unknown info type: ${infoType}`);
      }
      
      return {
        content: [{
          type: "text",
          text: `=== ${title} ===\n${response}`
        }]
      };
    } catch (error) {
      throw new Error(`Failed to get server info (${infoType}): ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  static async resourceAnalyze(args: any, serverManager: FiveMServerManager) {
    const resourceName = args?.resource_name ? String(args.resource_name) : undefined;

    try {
      let response: string;
      let title: string;
      
      if (resourceName) {
        // Check if specific resource exists by trying to start it
        try {
          const startResponse = await serverManager.sendCommand(`ensure ${resourceName}`);
          response = `Resource Ensure:\n${startResponse}`;
          title = `RESOURCE ANALYSIS: ${resourceName}`;
        } catch (error) {
          response = `Resource '${resourceName}' not found or failed to ensure`;
          title = `RESOURCE ANALYSIS: ${resourceName}`;
        }
      } else {
        // Refresh all resources to get current state
        const refreshResponse = await serverManager.sendCommand('refresh');
        response = `Resource Refresh:\n${refreshResponse}`;
        title = "ALL RESOURCES ANALYSIS";
      }
      
      return {
        content: [{
          type: "text",
          text: `=== ${title} ===\n${response}`
        }]
      };
    } catch (error) {
      const target = resourceName ? `resource ${resourceName}` : 'all resources';
      throw new Error(`Failed to analyze ${target}: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  static async batchExecute(args: any, serverManager: FiveMServerManager) {
    if (!Validators.validateBatchExecuteArgs(args)) {
      const validationError = Validators.createValidationError('Invalid batch execute arguments');
      return {
        content: [{
          type: "text",
          text: validationError.message
        }]
      };
    }

    const batchArgs = args as BatchExecuteArgs;
    const commands = batchArgs.commands;
    const executionMode = batchArgs.execution_mode || 'sequential';
    const stopOnError = batchArgs.stop_on_error !== false; // Default to true

    try {
      const results: Array<{ command: CommandExecuteArgs; success: boolean; response: any; error?: string }> = [];
      
      if (executionMode === 'parallel') {
        // Execute all commands in parallel
        const promises = commands.map(async (cmd) => {
          try {
            let response: any;
            
            switch (cmd.mode) {
              case 'server':
                response = await serverManager.executePluginCommand(cmd.command);
                break;
              case 'client':
                response = await serverManager.executeClientCommand(cmd.command, cmd.player_id);
                break;
              case 'rcon':
                response = await serverManager.executeCommand(cmd.command);
                break;
            }
            
            const responseText = (response.data && typeof response.data === 'object' && 'response' in response.data)
              ? (response.data as { response: string }).response
              : response.message;
            
            return {
              command: cmd,
              success: response.success,
              response: responseText,
              error: response.success ? undefined : response.message
            };
          } catch (error) {
            return {
              command: cmd,
              success: false,
              response: null,
              error: error instanceof Error ? error.message : 'Unknown error'
            };
          }
        });
        
        const parallelResults = await Promise.all(promises);
        results.push(...parallelResults);
      } else {
        // Execute commands sequentially
        for (const cmd of commands) {
          try {
            let response: any;
            
            switch (cmd.mode) {
              case 'server':
                response = await serverManager.executePluginCommand(cmd.command);
                break;
              case 'client':
                response = await serverManager.executeClientCommand(cmd.command, cmd.player_id);
                break;
              case 'rcon':
                response = await serverManager.executeCommand(cmd.command);
                break;
            }
            
            const responseText = (response.data && typeof response.data === 'object' && 'response' in response.data)
              ? (response.data as { response: string }).response
              : response.message;
            
            const result = {
              command: cmd,
              success: response.success,
              response: responseText,
              error: response.success ? undefined : response.message
            };
            
            results.push(result);
            
            // Stop on error if configured
            if (stopOnError && !response.success) {
              break;
            }
          } catch (error) {
            const result = {
              command: cmd,
              success: false,
              response: null,
              error: error instanceof Error ? error.message : 'Unknown error'
            };
            
            results.push(result);
            
            if (stopOnError) {
              break;
            }
          }
        }
      }
      
      const successCount = results.filter(r => r.success).length;
      const failureCount = results.filter(r => !r.success).length;
      
      const summary = `Batch execution completed: ${successCount} succeeded, ${failureCount} failed out of ${commands.length} commands`;
      
      const details = results.map((r, idx) => {
        const status = r.success ? '✓' : '✗';
        const cmdStr = `${r.command.mode}: ${r.command.command}`;
        const resultStr = r.success ? r.response : `Error: ${r.error}`;
        return `${idx + 1}. ${status} ${cmdStr}\n   ${resultStr}`;
      }).join('\n\n');
      
      return {
        content: [{
          type: "text",
          text: `=== BATCH EXECUTION RESULTS ===\n${summary}\n\n${details}`
        }]
      };
    } catch (error) {
      throw new Error(`Failed to execute batch commands: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  static async logsWatch(args: any, serverManager: FiveMServerManager) {
    if (!Validators.validateLogsWatchArgs(args)) {
      const validationError = Validators.createValidationError('Invalid logs watch arguments');
      return {
        content: [{
          type: "text",
          text: validationError.message
        }]
      };
    }

    const watchArgs = args as LogsWatchArgs;
    const source = watchArgs.source;
    const pluginName = watchArgs.plugin_name;
    const filterPattern = watchArgs.filter_pattern;
    const durationSeconds = watchArgs.duration_seconds || 30;

    try {
      // For now, we'll simulate watching by getting logs multiple times
      // In a real implementation, this would use fs.watch or similar
      const watchInterval = 2000; // Check every 2 seconds
      const iterations = Math.ceil(durationSeconds * 1000 / watchInterval);
      const collectedLogs: string[] = [];
      const seenLines = new Set<string>();

      for (let i = 0; i < iterations; i++) {
        let content: string;
        
        switch (source) {
          case 'server':
            content = await serverManager.getConsoleLogs(50);
            break;
          case 'server_plugin':
            content = await serverManager.getPluginLogs(50, pluginName);
            break;
          case 'client':
            content = await serverManager.getClientLogs(50);
            break;
          case 'client_plugin':
            content = await serverManager.getClientPluginLogs(50, pluginName);
            break;
          default:
            throw new Error(`Unknown log source: ${source}`);
        }

        // Filter logs by pattern if provided
        const lines = content.split('\n');
        for (const line of lines) {
          const lineKey = line.trim();
          if (lineKey && !seenLines.has(lineKey)) {
            seenLines.add(lineKey);
            
            // Apply filter pattern if provided
            if (!filterPattern || new RegExp(filterPattern, 'i').test(line)) {
              collectedLogs.push(line);
            }
          }
        }

        // Wait before next iteration (except for last one)
        if (i < iterations - 1) {
          await new Promise(resolve => setTimeout(resolve, watchInterval));
        }
      }

      const logContent = collectedLogs.length > 0 
        ? collectedLogs.join('\n')
        : 'No matching log entries found during watch period.';

      return {
        content: [{
          type: "text",
          text: `=== LOG WATCH RESULTS (${durationSeconds}s) ===\nSource: ${source}${pluginName ? ` (${pluginName})` : ''}${filterPattern ? `\nFilter: ${filterPattern}` : ''}\n\nFound ${collectedLogs.length} new log entries:\n\n${logContent}`
        }]
      };
    } catch (error) {
      throw new Error(`Failed to watch logs: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  static async commandValidate(args: any, serverManager: FiveMServerManager) {
    if (!Validators.validateCommandValidateArgs(args)) {
      const validationError = Validators.createValidationError('Invalid command validate arguments');
      return {
        content: [{
          type: "text",
          text: validationError.message
        }]
      };
    }

    const validateArgs = args as CommandValidateArgs;
    const command = validateArgs.command;
    const mode = validateArgs.mode;

    try {
      // Basic validation using ResponseParser
      const validationResult = ResponseParser.validateCommand(command);
      if (validationResult && !validationResult.success) {
        const suggestedCommands = Array.isArray(validationResult.error?.details?.suggested_commands)
          ? (validationResult.error?.details?.suggested_commands as string[])
          : [];
        const suggestionText = suggestedCommands.length > 0
          ? `\n\nSuggestions:\n${suggestedCommands.map((s) => `- ${s}`).join('\n')}`
          : '';

        return {
          content: [{
            type: "text",
            text: `Command validation failed: ${validationResult.message}${suggestionText}`
          }]
        };
      }

      // Check command structure
      const commandParts = command.trim().split(/\s+/);
      const commandName = commandParts[0];

      // Known FiveM commands
      const knownCommands = [
        'start', 'stop', 'ensure', 'restart', 'refresh',
        'say', 'clientkick', 'sv_hostname', 'sv_maxClients', 'onesync',
        'version', 'quit', 'add_ace', 'add_principal'
      ];

      const isKnownCommand = knownCommands.includes(commandName.toLowerCase()) || commandName.startsWith('mcp_');

      const warnings: string[] = [];
      const suggestions: string[] = [];

      if (!knownCommands.includes(commandName.toLowerCase()) && !commandName.startsWith('mcp_')) {
        warnings.push(`Command "${commandName}" is not in the list of known FiveM commands`);
        suggestions.push('Verify the command exists in FiveM documentation');
      }

      if (mode === 'client' && !commandName.startsWith('/')) {
        warnings.push('Client commands typically start with "/"');
        suggestions.push('Consider using "/" prefix for client commands');
      }

      const validationStatus = isKnownCommand ? 'VALID' : 'UNKNOWN';
      const warningText = warnings.length > 0 ? `\n\nWarnings:\n${warnings.map(w => `- ${w}`).join('\n')}` : '';
      const suggestionText = suggestions.length > 0 ? `\n\nSuggestions:\n${suggestions.map(s => `- ${s}`).join('\n')}` : '';

      return {
        content: [{
          type: "text",
          text: `=== COMMAND VALIDATION ===\nCommand: ${command}\nMode: ${mode}\nStatus: ${validationStatus}${warningText}${suggestionText}\n\nNote: Validation is based on command structure. Actual execution may still fail if the command is invalid or permissions are insufficient.`
        }]
      };
    } catch (error) {
      throw new Error(`Failed to validate command: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }
} 
