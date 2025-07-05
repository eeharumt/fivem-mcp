import { FiveMRconClient } from '../clients/rcon-client.js';
import { LogFileReader } from '../utils/log-file-reader.js';
import { ResponseParser } from '../utils/response-parser.js';
import { MCPResponse } from '../types/index.js';

/**
 * FiveM Server Manager
 */
export class FiveMServerManager {
  private rconClient: FiveMRconClient;
  private logs: string[] = [];
  private logsDir?: string;
  private clientLogsDir?: string;

  constructor(host: string = 'localhost', port: number = 30120, password: string = '', logsDir?: string, clientLogsDir?: string) {
    if (!password) {
      throw new Error('RCON password is required');
    }
    this.rconClient = new FiveMRconClient(host, port, password);
    if(logsDir) {
      this.logsDir = logsDir;
    }
    if(clientLogsDir) {
      this.clientLogsDir = clientLogsDir;
    }
  }

  async connect(): Promise<void> {
    await this.rconClient.connect();
  }

  async ensurePlugin(pluginName: string): Promise<string> {
    try {
      const response = await this.rconClient.sendCommand(`ensure ${pluginName}`);
      this.logs.push(`[${new Date().toISOString()}] ENSURE: ${pluginName} - ${response}`);
      return response;
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : 'Unknown error';
      this.logs.push(`[${new Date().toISOString()}] ERROR: Failed to ensure ${pluginName} - ${errorMsg}`);
      throw error;
    }
  }

  async stopPlugin(pluginName: string): Promise<string> {
    try {
      const response = await this.rconClient.sendCommand(`stop ${pluginName}`);
      this.logs.push(`[${new Date().toISOString()}] STOP: ${pluginName} - ${response}`);
      return response;
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : 'Unknown error';
      this.logs.push(`[${new Date().toISOString()}] ERROR: Failed to stop ${pluginName} - ${errorMsg}`);
      throw error;
    }
  }

  async restartPlugin(pluginName: string): Promise<string> {
    try {
      const response = await this.rconClient.sendCommand(`restart ${pluginName}`);
      this.logs.push(`[${new Date().toISOString()}] RESTART: ${pluginName} - ${response}`);
      return response;
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : 'Unknown error';
      this.logs.push(`[${new Date().toISOString()}] ERROR: Failed to restart ${pluginName} - ${errorMsg}`);
      throw error;
    }
  }

  async executeCommand(command: string): Promise<MCPResponse> {
    // Validate command before execution
    const validationResult = ResponseParser.validateCommand(command);
    if (validationResult) {
      this.logs.push(`[${new Date().toISOString()}] VALIDATION_ERROR: ${command} - ${validationResult.message}`);
      return validationResult;
    }

    try {
      const response = await this.rconClient.sendCommand(command);
      const parsedResponse = ResponseParser.parseRCONResponse(response, command);
      
      if (parsedResponse.success) {
        this.logs.push(`[${new Date().toISOString()}] COMMAND: ${command} - SUCCESS`);
      } else {
        this.logs.push(`[${new Date().toISOString()}] COMMAND: ${command} - FAILED: ${parsedResponse.message}`);
      }
      
      return parsedResponse;
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : 'Unknown error';
      this.logs.push(`[${new Date().toISOString()}] ERROR: Failed to execute ${command} - ${errorMsg}`);
      
      return {
        success: false,
        message: `Failed to execute command: ${errorMsg}`,
        error: {
          code: 'COMMAND_FAILED',
          message: errorMsg,
          details: { command }
        }
      };
    }
  }

  async executePluginCommand(command: string): Promise<MCPResponse> {
    // Validate command before execution
    const validationResult = ResponseParser.validateCommand(command);
    if (validationResult) {
      this.logs.push(`[${new Date().toISOString()}] PLUGIN_VALIDATION_ERROR: ${command} - ${validationResult.message}`);
      return validationResult;
    }

    try {
      const response = await this.rconClient.sendCommand(`mcp_execute ${command}`);
      const parsedResponse = ResponseParser.parseRCONResponse(response, `mcp_execute ${command}`);
      
      if (parsedResponse.success) {
        this.logs.push(`[${new Date().toISOString()}] PLUGIN_COMMAND: ${command} - SUCCESS`);
      } else {
        this.logs.push(`[${new Date().toISOString()}] PLUGIN_COMMAND: ${command} - FAILED: ${parsedResponse.message}`);
      }
      
      return parsedResponse;
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : 'Unknown error';
      this.logs.push(`[${new Date().toISOString()}] ERROR: Failed to execute plugin command ${command} - ${errorMsg}`);
      
      return {
        success: false,
        message: `Failed to execute plugin command: ${errorMsg}`,
        error: {
          code: 'COMMAND_FAILED',
          message: errorMsg,
          details: { command: `mcp_execute ${command}` }
        }
      };
    }
  }

  async triggerServerEventViaPlugin(eventName: string, args?: any[]): Promise<string> {
    try {
      const argsJson = args && args.length > 0 ? JSON.stringify(args) : '';
      const command = argsJson ? `mcp_event_server ${eventName} ${argsJson}` : `mcp_event_server ${eventName}`;
      const response = await this.rconClient.sendCommand(command);
      this.logs.push(`[${new Date().toISOString()}] PLUGIN_SERVER_EVENT: ${eventName} - ${response}`);
      return response;
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : 'Unknown error';
      this.logs.push(`[${new Date().toISOString()}] ERROR: Failed to trigger server event ${eventName} - ${errorMsg}`);
      throw error;
    }
  }

  async triggerClientEventViaPlugin(eventName: string, playerId: number, args?: any[]): Promise<string> {
    try {
      const argsJson = args && args.length > 0 ? JSON.stringify(args) : '';
      const command = argsJson ? 
        `mcp_event_client ${playerId} ${eventName} ${argsJson}` : 
        `mcp_event_client ${playerId} ${eventName}`;
      const response = await this.rconClient.sendCommand(command);
      this.logs.push(`[${new Date().toISOString()}] PLUGIN_CLIENT_EVENT: ${eventName} (Player: ${playerId}) - ${response}`);
      return response;
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : 'Unknown error';
      this.logs.push(`[${new Date().toISOString()}] ERROR: Failed to trigger client event ${eventName} - ${errorMsg}`);
      throw error;
    }
  }

  async getPlayersViaPlugin(): Promise<string> {
    try {
      const response = await this.rconClient.sendCommand('mcp_players');
      this.logs.push(`[${new Date().toISOString()}] PLUGIN_PLAYERS: Retrieved players list`);
      return response;
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : 'Unknown error';
      this.logs.push(`[${new Date().toISOString()}] ERROR: Failed to get players via plugin - ${errorMsg}`);
      throw error;
    }
  }

  async getPlayerInfoViaPlugin(playerId: number): Promise<string> {
    try {
      const response = await this.rconClient.sendCommand(`mcp_player_info ${playerId}`);
      this.logs.push(`[${new Date().toISOString()}] PLUGIN_PLAYER_INFO: Retrieved info for player ${playerId}`);
      return response;
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : 'Unknown error';
      this.logs.push(`[${new Date().toISOString()}] ERROR: Failed to get player info via plugin - ${errorMsg}`);
      throw error;
    }
  }

  async executeClientCommand(command: string, playerId?: number): Promise<MCPResponse> {
    // Validate command before execution
    const validationResult = ResponseParser.validateCommand(command);
    if (validationResult) {
      this.logs.push(`[${new Date().toISOString()}] CLIENT_VALIDATION_ERROR: ${command} - ${validationResult.message}`);
      return validationResult;
    }

    try {
      let rconCommand: string;
      if (playerId) {
        // Execute command for specific client
        rconCommand = `mcp_client_command ${playerId} ${command}`;
      } else {
        // Execute command for all clients
        rconCommand = `mcp_client_command_all ${command}`;
      }
      
      const response = await this.rconClient.sendCommand(rconCommand);
      const parsedResponse = ResponseParser.parseRCONResponse(response, rconCommand);
      
      if (parsedResponse.success) {
        const target = playerId ? `player ${playerId}` : 'all clients';
        this.logs.push(`[${new Date().toISOString()}] CLIENT_COMMAND: ${command} (${target}) - SUCCESS`);
      } else {
        this.logs.push(`[${new Date().toISOString()}] CLIENT_COMMAND: ${command} - FAILED: ${parsedResponse.message}`);
      }
      
      return parsedResponse;
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : 'Unknown error';
      this.logs.push(`[${new Date().toISOString()}] ERROR: Failed to execute client command ${command} - ${errorMsg}`);
      
      return {
        success: false,
        message: `Failed to execute client command: ${errorMsg}`,
        error: {
          code: 'COMMAND_FAILED',
          message: errorMsg,
          details: { command, playerId }
        }
      };
    }
  }

  async checkPluginHealth(): Promise<string> {
    try {
      const response = await this.rconClient.sendCommand('mcp_health');
      this.logs.push(`[${new Date().toISOString()}] PLUGIN_HEALTH: Health check completed`);
      return response;
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : 'Unknown error';
      this.logs.push(`[${new Date().toISOString()}] ERROR: Failed to check plugin health - ${errorMsg}`);
      throw error;
    }
  }

  async refreshResources(): Promise<string> {
    try {
      const response = await this.rconClient.sendCommand('refresh');
      this.logs.push(`[${new Date().toISOString()}] REFRESH: Resources refreshed - ${response}`);
      return response;
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : 'Unknown error';
      this.logs.push(`[${new Date().toISOString()}] ERROR: Failed to refresh resources - ${errorMsg}`);
      throw error;
    }
  }

  async getConsoleLogs(lines: number = 100): Promise<string> {
    try {
      // Try to get logs from actual log files (txAdmin style)
      const logContent = await LogFileReader.readLogFiles(lines, this.logsDir);
      if (logContent) {
        this.logs.push(`[${new Date().toISOString()}] LOG_ACCESS: Successfully read ${lines} lines from log files`);
        return logContent;
      }
      
      // Return message when log files are not accessible
      const message = "Log files not accessible. Please ensure logs directory path is configured correctly.";
      this.logs.push(`[${new Date().toISOString()}] LOG_ACCESS: ${message}`);
      return message;
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : 'Unknown error';
      this.logs.push(`[${new Date().toISOString()}] ERROR: Failed to get server information - ${errorMsg}`);
      throw error;
    }
  }

  async getPluginLogs(lines: number = 50, pluginName?: string): Promise<string> {
    try {
      // Try to get plugin logs from log files
      const logContent = await LogFileReader.readPluginLogs(lines, this.logsDir, pluginName);
      if (logContent) {
        this.logs.push(`[${new Date().toISOString()}] PLUGIN_LOG_ACCESS: Successfully read ${lines} plugin log lines`);
        return logContent;
      }
      
      // Return message when plugin logs are not found
      const message = pluginName 
        ? `No logs found for plugin '${pluginName}'. Plugin may not be running or generating logs.`
        : "No plugin logs found. Plugins may not be running or generating logs.";
      this.logs.push(`[${new Date().toISOString()}] PLUGIN_LOG_ACCESS: ${message}`);
      return message;
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : 'Unknown error';
      this.logs.push(`[${new Date().toISOString()}] ERROR: Failed to get plugin logs - ${errorMsg}`);
      throw error;
    }
  }

  async getClientLogs(lines: number = 100): Promise<string> {
    try {
      // Try to get client logs from log files
      const logContent = await LogFileReader.readClientLogs(lines, this.clientLogsDir);
      if (logContent) {
        this.logs.push(`[${new Date().toISOString()}] CLIENT_LOG_ACCESS: Successfully read ${lines} client log lines`);
        return logContent;
      }
      
      // Return message when client logs are not found
      const message = "FiveM client logs not found. Please ensure the client logs directory is configured correctly and FiveM has been run.";
      this.logs.push(`[${new Date().toISOString()}] CLIENT_LOG_ACCESS: ${message}`);
      return message;
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : 'Unknown error';
      this.logs.push(`[${new Date().toISOString()}] ERROR: Failed to get client logs - ${errorMsg}`);
      throw error;
    }
  }

  async getClientPluginLogs(lines: number = 50, pluginName?: string): Promise<string> {
    try {
      // Try to get client plugin logs from log files
      const logContent = await LogFileReader.readClientPluginLogs(lines, this.clientLogsDir, pluginName);
      if (logContent) {
        this.logs.push(`[${new Date().toISOString()}] CLIENT_PLUGIN_LOG_ACCESS: Successfully read ${lines} client plugin log lines`);
        return logContent;
      }
      
      // Return message when client plugin logs are not found
      const message = pluginName 
        ? `No client logs found for plugin '${pluginName}'. Plugin may not be running on client side or generating logs.`
        : "No client plugin logs found. Plugins may not be running on client side or generating logs.";
      this.logs.push(`[${new Date().toISOString()}] CLIENT_PLUGIN_LOG_ACCESS: ${message}`);
      return message;
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : 'Unknown error';
      this.logs.push(`[${new Date().toISOString()}] ERROR: Failed to get client plugin logs - ${errorMsg}`);
      throw error;
    }
  }

  getLogs(limit: number = 100): string[] {
    return this.logs.slice(-limit);
  }

  clearLogs(): void {
    this.logs = [];
  }

  /**
   * Read specific log file based on log type
   */
  private async readSpecificLogFile(logType: string): Promise<string | null> {
    try {
      let targetFiles: string[] = [];
      const logsDir = this.logsDir;
      
      switch (logType.toLowerCase()) {
        case 'server':
          targetFiles = [
            ...LogFileReader.findLogsByPattern('server.log', logsDir),
            ...LogFileReader.findLatestFXServerLogs(logsDir),
          ];
          break;
        case 'console':
          targetFiles = [
            ...LogFileReader.findLogsByPattern('server.log', logsDir),
            ...LogFileReader.findLatestFXServerLogs(logsDir),
          ];
          break;
        case 'script':
          targetFiles = LogFileReader.findLatestFXServerLogs(logsDir);
          break;
        default:
          targetFiles = [
            ...LogFileReader.findLogsByPattern('server.log', logsDir),
            ...LogFileReader.findLatestFXServerLogs(logsDir),
          ];
      }

      if (targetFiles.length === 0) {
        return null;
      }

      const results: string[] = [];
      results.push(`=== ${logType.toUpperCase()} LOGS ===\n`);

      for (const filePath of targetFiles.slice(0, 2)) {
        try {
          const content = await LogFileReader.readLogFileLines(filePath, 100);
          if (content) {
            const fileName = filePath.split('/').pop() || filePath;
            results.push(`--- ${fileName} ---\n${content}\n`);
          }
        } catch (fileError) {
          const fileName = filePath.split('/').pop() || filePath;
          results.push(`--- ${fileName} ---\nError reading file: ${fileError instanceof Error ? fileError.message : 'Unknown error'}\n`);
        }
      }

      return results.length > 1 ? results.join('\n') : null;
    } catch (error) {
      return null;
    }
  }

  /**
   * Get real-time server logs from the most current active log file
   */
  async getRealtimeServerLogs(lines: number = 50): Promise<string> {
    try {
      const result = await LogFileReader.getLatestLogLines(lines, this.logsDir);
      this.logs.push(`[${new Date().toISOString()}] REALTIME_LOG_ACCESS: Retrieved ${lines} lines from current active log`);
      
      if (!result) {
        const message = "No active server log file found or file is empty.";
        this.logs.push(`[${new Date().toISOString()}] REALTIME_LOG_ACCESS: ${message}`);
        return message;
      }
      
      return result;
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : 'Unknown error';
      this.logs.push(`[${new Date().toISOString()}] ERROR: Failed to get real-time server logs - ${errorMsg}`);
      throw error;
    }
  }
} 