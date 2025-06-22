import { FiveMRconClient } from '../clients/rcon-client.js';
import { LogFileReader } from '../utils/log-file-reader.js';

/**
 * FiveM Server Manager
 */
export class FiveMServerManager {
  private rconClient: FiveMRconClient;
  private logs: string[] = [];
  private logsDir?: string;

  constructor(host: string = 'localhost', port: number = 30120, password: string = '', logsDir?: string) {
    if (!password) {
      throw new Error('RCON password is required');
    }
    this.rconClient = new FiveMRconClient(host, port, password);
    if(logsDir) {
      this.logsDir = logsDir;
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

  async executeCommand(command: string): Promise<string> {
    try {
      const response = await this.rconClient.sendCommand(command);
      this.logs.push(`[${new Date().toISOString()}] COMMAND: ${command} - ${response}`);
      return response;
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : 'Unknown error';
      this.logs.push(`[${new Date().toISOString()}] ERROR: Failed to execute ${command} - ${errorMsg}`);
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
} 