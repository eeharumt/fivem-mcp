import { FiveMRconClient } from '../clients/rcon-client.js';
import { LogFileReader } from '../utils/log-file-reader.js';
import * as fs from 'fs';

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
      console.log(`[ServerManager] Configured logs directory: ${logsDir}`);
    } else {
      console.log('[ServerManager] Using default logs directory search');
    }
  }

  async connect(): Promise<void> {
    try {
      await this.rconClient.connect();
      this.logs.push(`[${new Date().toISOString()}] SERVER_CONNECT: Successfully connected to FiveM server`);
      console.log('[ServerManager] RCON connection established');
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : 'Unknown error';
      this.logs.push(`[${new Date().toISOString()}] SERVER_CONNECT_ERROR: ${errorMsg}`);
      console.error('[ServerManager] Failed to connect to RCON:', errorMsg);
      throw error;
    }
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
    const startTime = Date.now();
    try {
      console.log(`[ServerManager] Attempting to read ${lines} lines from console logs`);
      
      // Try to get logs from actual log files (txAdmin style)
      const logContent = await LogFileReader.readLogFiles(lines, this.logsDir);
      const duration = Date.now() - startTime;
      
      if (logContent && !logContent.includes('LOG READ ERROR')) {
        this.logs.push(`[${new Date().toISOString()}] LOG_ACCESS: Successfully read ${lines} lines from log files (${duration}ms)`);
        console.log(`[ServerManager] Successfully read console logs in ${duration}ms`);
        return logContent;
             } else {
         // Return detailed error information
         const diagnostics = this.getLogDiagnostics();
         const errorInfo = logContent || "Log files not accessible";
         const fullMessage = `${errorInfo}\n\n=== DIAGNOSTICS ===\n${diagnostics}`;
         
         this.logs.push(`[${new Date().toISOString()}] LOG_ACCESS_FAILED: ${errorInfo} (${duration}ms)`);
         console.error(`[ServerManager] Failed to read console logs in ${duration}ms`);
         return fullMessage;
       }
    } catch (error) {
      const duration = Date.now() - startTime;
      const errorMsg = error instanceof Error ? error.message : 'Unknown error';
      this.logs.push(`[${new Date().toISOString()}] ERROR: Failed to get server logs - ${errorMsg} (${duration}ms)`);
      console.error(`[ServerManager] Error getting console logs in ${duration}ms:`, errorMsg);
      
             // Provide detailed error information
       const diagnostics = this.getLogDiagnostics();
       return `=== CONSOLE LOG READ ERROR ===\n${errorMsg}\n\n=== DIAGNOSTICS ===\n${diagnostics}`;
    }
  }

  async getPluginLogs(lines: number = 50, pluginName?: string): Promise<string> {
    const startTime = Date.now();
    try {
      console.log(`[ServerManager] Attempting to read ${lines} plugin log lines${pluginName ? ` for '${pluginName}'` : ''}`);
      
      // Try to get plugin logs from log files
      const logContent = await LogFileReader.readPluginLogs(lines, this.logsDir, pluginName);
      const duration = Date.now() - startTime;
      
      if (logContent && !logContent.includes('PLUGIN LOG READ ERROR')) {
        this.logs.push(`[${new Date().toISOString()}] PLUGIN_LOG_ACCESS: Successfully read ${lines} plugin log lines (${duration}ms)`);
        console.log(`[ServerManager] Successfully read plugin logs in ${duration}ms`);
        return logContent;
             } else {
         // Return detailed error information for plugin logs
         const diagnostics = this.getLogDiagnostics();
         const errorInfo = logContent || (pluginName 
           ? `No logs found for plugin '${pluginName}'. Plugin may not be running or generating logs.`
           : "No plugin logs found. Plugins may not be running or generating logs.");
         const fullMessage = `${errorInfo}\n\n=== DIAGNOSTICS ===\n${diagnostics}`;
         
         this.logs.push(`[${new Date().toISOString()}] PLUGIN_LOG_ACCESS_FAILED: ${errorInfo} (${duration}ms)`);
         console.warn(`[ServerManager] Plugin logs not found in ${duration}ms`);
         return fullMessage;
       }
    } catch (error) {
      const duration = Date.now() - startTime;
      const errorMsg = error instanceof Error ? error.message : 'Unknown error';
      this.logs.push(`[${new Date().toISOString()}] ERROR: Failed to get plugin logs - ${errorMsg} (${duration}ms)`);
      console.error(`[ServerManager] Error getting plugin logs in ${duration}ms:`, errorMsg);
      
             // Provide detailed error information
       const diagnostics = this.getLogDiagnostics();
       return `=== PLUGIN LOG READ ERROR ===\n${errorMsg}\n\n=== DIAGNOSTICS ===\n${diagnostics}`;
    }
  }

  /**
   * Get comprehensive diagnostics for log reading issues
   */
  private getLogDiagnostics(): string {
    const diagnostics: string[] = [];
    
    // Server Manager Configuration
    diagnostics.push(`Server Manager Configuration:`);
    diagnostics.push(`- Configured logs directory: ${this.logsDir || 'default search'}`);
    
    // Log file search results
    diagnostics.push(`\nLog File Search:`);
    try {
      const logFiles = LogFileReader.findLogFiles(this.logsDir);
      if (logFiles.length > 0) {
        diagnostics.push(`- Found ${logFiles.length} log files:`);
        for (const file of logFiles) {
          try {
            const stats = fs.statSync(file);
            diagnostics.push(`  • ${file} (${stats.size} bytes, modified: ${stats.mtime.toISOString()})`);
          } catch (err) {
            diagnostics.push(`  • ${file} (error accessing: ${err instanceof Error ? err.message : 'unknown'})`);
          }
        }
      } else {
        diagnostics.push(`- No log files found`);
      }
    } catch (error) {
      diagnostics.push(`- Error during log file search: ${error instanceof Error ? error.message : 'unknown'}`);
    }
    
    // Recent operation logs
    diagnostics.push(`\nRecent Operations:`);
    const recentLogs = this.logs.slice(-5);
    if (recentLogs.length > 0) {
      for (const log of recentLogs) {
        diagnostics.push(`- ${log}`);
      }
    } else {
      diagnostics.push(`- No recent operations logged`);
    }
    
    // Timestamp
    diagnostics.push(`\nDiagnostic timestamp: ${new Date().toISOString()}`);
    
    return diagnostics.join('\n');
  }

  getLogs(limit: number = 100): string[] {
    return this.logs.slice(-limit);
  }

  clearLogs(): void {
    const clearedCount = this.logs.length;
    this.logs = [];
    console.log(`[ServerManager] Cleared ${clearedCount} operation logs`);
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
        console.warn(`[ServerManager] No log files found for type: ${logType}`);
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
            console.log(`[ServerManager] Successfully read ${fileName} for ${logType} logs`);
          }
        } catch (fileError) {
          const fileName = filePath.split('/').pop() || filePath;
          const errorMessage = fileError instanceof Error ? fileError.message : 'Unknown error';
          results.push(`--- ${fileName} ---\nError reading file: ${errorMessage}\n`);
          console.error(`[ServerManager] Failed to read ${fileName} for ${logType} logs:`, errorMessage);
        }
      }

      return results.length > 1 ? results.join('\n') : null;
    } catch (error) {
      console.error(`[ServerManager] Error in readSpecificLogFile for ${logType}:`, error);
      return null;
    }
  }
} 