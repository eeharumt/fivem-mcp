import * as fs from 'fs';
import * as path from 'path';

/**
 * Log file reading utilities for FiveM server logs
 */
export class LogFileReader {

  /**
   * Get the current active log file (newest file being written to)
   */
  static getCurrentActiveLogFile(logsDir?: string): string | null {
    const logDirs = this.findLogDirs(logsDir);
    
    for (const dir of logDirs) {
      // Check for current active log files
      const currentServerLog = path.join(dir, 'server.log');
      const currentFxserverLog = path.join(dir, 'fxserver.log');
      
      // Prioritize the most recently modified file
      let newestFile: string | null = null;
      let newestTime = 0;
      
      for (const filePath of [currentFxserverLog, currentServerLog]) {
        if (fs.existsSync(filePath)) {
          try {
            const stat = fs.statSync(filePath);
            if (stat.mtime.getTime() > newestTime) {
              newestTime = stat.mtime.getTime();
              newestFile = filePath;
            }
          } catch (error) {
            // Ignore file access errors
          }
        }
      }
      
      if (newestFile) {
        return newestFile;
      }
    }
    
    return null;
  }

  /**
   * Read the latest lines from the most current log file (real-time tail)
   */
  static async getLatestLogLines(lines = 50, logsDir?: string): Promise<string | null> {
    try {
      const activeLogFile = this.getCurrentActiveLogFile(logsDir);
      if (!activeLogFile) {
        return null;
      }

      const logContent = await this.readLogFileLines(activeLogFile, lines);
      if (!logContent) {
        return null;
      }

      const fileName = path.basename(activeLogFile);
      const fileStats = fs.statSync(activeLogFile);
      const fileSize = (fileStats.size / 1024).toFixed(2);
      const lastModified = fileStats.mtime.toISOString();

      return [
        `=== REAL-TIME FIVEM SERVER LOGS ===`,
        `File: ${fileName} (${fileSize} KB, last modified: ${lastModified})`,
        `Latest ${lines} lines:`,
        ``,
        logContent
      ].join('\n');
    } catch (error) {
      return `Error reading real-time logs: ${error instanceof Error ? error.message : 'Unknown error'}`;
    }
  }

  private static findLogDirs(logsDir?: string): string[] {
    const possibleDirs = [
        logsDir, // 直接ログディレクトリを指定
        'local/txData/default/logs',
        'txData/default/logs',
        // 現在の作業ディレクトリベースのパス
        process.cwd() ? path.join(process.cwd(), 'local/txData/default/logs') : undefined,
    ].filter((p): p is string => !!p);

    return [...new Set(possibleDirs.filter(dir => {
      try {
        const exists = fs.existsSync(dir) && fs.statSync(dir).isDirectory();
        return exists;
      } catch (error) {
        return false;
      }
    }))];
  }

  /**
   * Read actual log files from logs directory
   */
  static async readLogFiles(lines: number = 100, logsDir?: string): Promise<string | null> {
    try {
      const logPaths = LogFileReader.findLogFiles(logsDir);
      
      if (logPaths.length === 0) {
        const logDirs = LogFileReader.findLogDirs(logsDir);
        return null;
      }

      const results: string[] = [];
      results.push(`=== FIVEM SERVER CONSOLE LOGS ===\n`);

      for (const logPath of logPaths) {
        try {
          const logContent = await LogFileReader.readLogFileLines(logPath, lines);
          if (logContent) {
            const fileName = path.basename(logPath);
            results.push(`--- ${fileName} ---\n${logContent}\n`);
          }
        } catch (fileError) {
          const fileName = path.basename(logPath);
          results.push(`--- ${fileName} ---\nError reading file: ${fileError instanceof Error ? fileError.message : 'Unknown error'}\n`);
        }
      }

      return results.join('\n');
    } catch (error) {
      return null;
    }
  }

  /**
   * Find available log files in order of priority
   */
  static findLogFiles(logsDir?: string): string[] {
    const logDirs = this.findLogDirs(logsDir);
    const logFiles: string[] = [];

    for (const dir of logDirs) {
        // 現在のアクティブなログファイルを最優先で追加
        const currentServerLog = path.join(dir, 'server.log');
        const currentFxserverLog = path.join(dir, 'fxserver.log');
        
        // 最新のfxserver.logを最優先
        if (fs.existsSync(currentFxserverLog)) {
            logFiles.push(currentFxserverLog);
        }
        
        // server.logも追加
        if (fs.existsSync(currentServerLog)) {
            logFiles.push(currentServerLog);
        }

        // 日付付きのログファイルも検索（バックアップとして）
        try {
          const files = fs.readdirSync(dir)
            .filter(file => file.startsWith('fxserver_') && file.endsWith('.log'))
            .sort((a, b) => {
              try {
                const statA = fs.statSync(path.join(dir, a));
                const statB = fs.statSync(path.join(dir, b));
                return statB.mtime.getTime() - statA.mtime.getTime();
              } catch {
                return 0;
              }
            });
          
          // 最新の日付付きログファイルのみ1つ追加（現在のfxserver.logが無い場合のバックアップ）
          if (files.length > 0 && !fs.existsSync(currentFxserverLog)) {
            const latestDateFile = path.join(dir, files[0]);
            logFiles.push(latestDateFile);
          }
        } catch (error) {
            // Ignore directory access errors
        }
    }
    
    // 重複を除去して最新順で返す
    const uniqueFiles = [...new Set(logFiles)];
    return uniqueFiles;
  }

  /**
   * Find the latest fxserver log files
   */
  static findLatestFXServerLogs(logsDir?: string): string[] {
    const logDirs = this.findLogDirs(logsDir);
    const fxserverLogs: string[] = [];
    
    for (const dir of logDirs) {
      try {
        if (fs.existsSync(dir)) {
          const files = fs.readdirSync(dir)
            .filter(file => file.startsWith('fxserver_') && file.endsWith('.log'))
            .sort((a, b) => {
              const statA = fs.statSync(path.join(dir, a));
              const statB = fs.statSync(path.join(dir, b));
              return statB.mtime.getTime() - statA.mtime.getTime();
            });
          
          if (files.length > 0) {
            fxserverLogs.push(path.join(dir, files[0]));
            if (logsDir) break;
          }
        }
      } catch (error) {
        // Ignore directory access errors
      }
    }

    return [...new Set(fxserverLogs)];
  }

  /**
   * Read last N lines from a log file (like tail -n)
   */
  static async readLogFileLines(filePath: string, lines: number, filter?: string): Promise<string | null> {
    try {
      const stats = fs.statSync(filePath);
      if (stats.size === 0) {
        return null;
      }

      const data = fs.readFileSync(filePath, 'utf8');
      let allLines = data.split('\n').filter(line => line.trim() !== '');
      
      // Apply filter if provided
      if (filter) {
        const filterLower = filter.toLowerCase();
        allLines = allLines.filter(line => 
          line.toLowerCase().includes(filterLower)
        );
      }
      
      // Get last N lines
      const lastLines = allLines.slice(-lines);
      
      if (lastLines.length === 0) {
        return null;
      }

      return lastLines.join('\n');
    } catch (error) {
      throw error;
    }
  }

  /**
   * Find log files by specific pattern
   */
  static findLogsByPattern(pattern: string, logsDir?: string): string[] {
    const matchingFiles: string[] = [];
    const logDirs = this.findLogDirs(logsDir);

    for (const dir of logDirs) {
      try {
        if (fs.existsSync(dir)) {
          const files = fs.readdirSync(dir)
            .filter(file => file.includes(pattern))
            .map(file => path.join(dir, file));
          
          matchingFiles.push(...files);
        }
      } catch (error) {
        // Ignore directory access errors
      }
    }

    return [...new Set(matchingFiles)];
  }

  /**
   * Read plugin/script logs only
   */
  static async readPluginLogs(lines: number = 100, logsDir?: string, pluginName?: string): Promise<string | null> {
    try {
      const logPaths = LogFileReader.findLogFiles(logsDir);
      if (logPaths.length === 0) {
        return null;
      }

      const results: string[] = [];
      results.push(`=== FIVEM SERVER PLUGIN LOGS ===\n`);

      for (const logPath of logPaths) {
        try {
          const pluginContent = await LogFileReader.readLogFileLines(logPath, lines * 3, pluginName ? `script:${pluginName}` : 'script:');
          if (pluginContent) {
            const fileName = path.basename(logPath);
            const filteredLines = pluginContent.split('\n').filter(line => {
              if (pluginName) {
                return line.includes(`script:${pluginName}`);
              }
              return line.includes('script:');
            }).slice(-lines); // 最新のlines行数だけ取得
            
            if (filteredLines.length > 0) {
              results.push(`--- ${fileName} (Server Plugin Logs) ---\n${filteredLines.join('\n')}\n`);
            }
          }
        } catch (fileError) {
          // Silent error handling for plugin log reading
        }
      }

      return results.length > 1 ? results.join('\n') : null;
    } catch (error) {
      // Silent error handling for plugin logs
      return null;
    }
  }

  /**
   * Find FiveM client log directories
   */
  private static findClientLogDirs(clientLogsDir?: string): string[] {
    const possibleDirs = [
      clientLogsDir, // 直接クライアントログディレクトリを指定
      // Windows paths
      path.join(process.env.USERPROFILE || '', 'AppData', 'Local', 'FiveM', 'FiveM.app', 'logs'),
      path.join(process.env.LOCALAPPDATA || '', 'FiveM', 'FiveM.app', 'logs'),
      path.join(process.env.USERPROFILE || '', 'AppData', 'Local', 'FiveM', 'logs'),
      path.join(process.env.LOCALAPPDATA || '', 'FiveM', 'logs'),
      // Linux/WSL2 paths
      path.join(process.env.HOME || '', '.local', 'share', 'CitizenFX'),
      path.join(process.env.HOME || '', '.fivem'),
      path.join(process.env.HOME || '', '.local', 'share', 'fivem'),
      // Alternative paths
      path.join(process.env.HOME || '', 'Documents', 'Rockstar Games', 'GTA V', 'logs'),
      // Steam paths
      path.join(process.env.USERPROFILE || '', 'Documents', 'Rockstar Games', 'GTA V', 'logs'),
      // Additional common locations
      path.join(process.env.APPDATA || '', 'CitizenFX'),
      path.join(process.env.TEMP || '', 'CitizenFX'),
    ].filter((p): p is string => !!p);

    return [...new Set(possibleDirs.filter(dir => {
      try {
        const exists = fs.existsSync(dir) && fs.statSync(dir).isDirectory();
        if (exists) {
          // Check if directory contains any log files
          const files = fs.readdirSync(dir);
          const hasLogFiles = files.some(file => 
            file.toLowerCase().endsWith('.log') || 
            file.toLowerCase().endsWith('.txt')
          );
          return hasLogFiles;
        }
        return false;
      } catch (error) {
        return false;
      }
    }))];
  }

  /**
   * Find FiveM client log files
   */
  static findClientLogFiles(clientLogsDir?: string): string[] {
    const logDirs = this.findClientLogDirs(clientLogsDir);
    const logFiles: string[] = [];

    for (const dir of logDirs) {
      try {
        if (fs.existsSync(dir)) {
          // Get all files in the directory
          const files = fs.readdirSync(dir);
          
          // Filter and sort FiveM client log files
          const clientLogFiles = files
            .filter(file => {
              const lowerFile = file.toLowerCase();
              return (
                // Standard log files
                (lowerFile.endsWith('.log') || lowerFile.endsWith('.txt')) &&
                (
                  // CitizenFX log files (including timestamped ones)
                  lowerFile.startsWith('citizenfx') ||
                  // Other common FiveM client log patterns
                  lowerFile.includes('fivem') ||
                  lowerFile.includes('client') ||
                  lowerFile.includes('launcher') ||
                  lowerFile.includes('crash')
                )
              );
            })
            .map(file => ({
              name: file,
              path: path.join(dir, file),
              stat: (() => {
                try {
                  return fs.statSync(path.join(dir, file));
                } catch {
                  return null;
                }
              })()
            }))
            .filter(item => item.stat !== null)
            .sort((a, b) => {
              // Sort by modification time (newest first)
              if (a.stat && b.stat) {
                return b.stat.mtime.getTime() - a.stat.mtime.getTime();
              }
              
              // If stats are not available, try to sort by filename timestamp
              const aMatch = a.name.match(/(\d{4}-\d{2}-\d{2}T\d{6})/);
              const bMatch = b.name.match(/(\d{4}-\d{2}-\d{2}T\d{6})/);
              
              if (aMatch && bMatch) {
                return bMatch[1].localeCompare(aMatch[1]);
              }
              
              // Fallback to alphabetical sort (reversed for newer files first)
              return b.name.localeCompare(a.name);
            })
            .map(item => item.path);

          logFiles.push(...clientLogFiles);
        }
      } catch (error) {
        // Ignore directory access errors
      }
    }

    return [...new Set(logFiles)];
  }

  /**
   * Read FiveM client logs
   */
  static async readClientLogs(lines: number = 100, clientLogsDir?: string): Promise<string | null> {
    try {
      const searchedDirs = this.findClientLogDirs(clientLogsDir);
      const logPaths = LogFileReader.findClientLogFiles(clientLogsDir);
      
      if (logPaths.length === 0) {
        // Provide helpful debug information when no logs are found
        const debugInfo = [
          "=== FIVEM CLIENT LOGS DEBUG INFO ===",
          `Searched directories (${searchedDirs.length}):`,
          ...searchedDirs.map(dir => `  - ${dir}`),
          "",
          "No FiveM client log files found.",
          "Expected file patterns: CitizenFX_log_*.log, CitizenFX.log, fivem.log, client.log, launcher.log",
          "",
          "Please ensure:",
          "1. FiveM has been run at least once",
          "2. The client logs directory path is correct",
          "3. Log files exist in the expected location"
        ].join('\n');
        
        return debugInfo;
      }

      const results: string[] = [];
      results.push(`=== FIVEM CLIENT LOGS ===`);
      results.push(`Found ${logPaths.length} log file(s) in ${searchedDirs.length} searched directory(ies)`);
      results.push("");

      // 最新の1つのログファイルのみを読み込み
      const latestLogPath = logPaths[0];
      try {
        const logContent = await LogFileReader.readLogFileLines(latestLogPath, lines);
        if (logContent) {
          const fileName = path.basename(latestLogPath);
          const fileStats = fs.statSync(latestLogPath);
          const fileSize = (fileStats.size / 1024).toFixed(2);
          const lastModified = fileStats.mtime.toISOString();
          
          results.push(`--- ${fileName} (${fileSize} KB, modified: ${lastModified}) ---`);
          results.push(logContent);
          results.push("");
        }
      } catch (fileError) {
        const fileName = path.basename(latestLogPath);
        results.push(`--- ${fileName} ---`);
        results.push(`Error reading file: ${fileError instanceof Error ? fileError.message : 'Unknown error'}`);
        results.push("");
      }

      // Show additional available files for reference
      if (logPaths.length > 1) {
        results.push(`... and ${logPaths.length - 1} more log file(s) available`);
        results.push("Additional files:");
        for (const logPath of logPaths.slice(1, 10)) { // 最大10個まで表示
          const fileName = path.basename(logPath);
          results.push(`  - ${fileName}`);
        }
        if (logPaths.length > 10) {
          results.push(`  ... and ${logPaths.length - 10} more files`);
        }
      }

      return results.join('\n');
    } catch (error) {
      return `Error reading client logs: ${error instanceof Error ? error.message : 'Unknown error'}`;
    }
  }

  /**
   * Read FiveM client plugin logs only
   */
  static async readClientPluginLogs(lines: number = 100, clientLogsDir?: string, pluginName?: string): Promise<string | null> {
    try {
      const logPaths = LogFileReader.findClientLogFiles(clientLogsDir);
      if (logPaths.length === 0) {
        return null;
      }

      const results: string[] = [];
      results.push(`=== FIVEM CLIENT PLUGIN LOGS ===\n`);

      // 最新の1つのログファイルのみを読み込み
      const latestLogPath = logPaths[0];
      try {
        // クライアント側プラグインログのパターン
        const pluginPatterns = [
          // Lua script patterns
          pluginName ? `[${pluginName}]` : '[',
          pluginName ? `(${pluginName})` : '(',
          // JavaScript/TypeScript patterns
          pluginName ? `${pluginName}:` : ':',
          // Error patterns
          pluginName ? `Error in ${pluginName}` : 'Error in',
          // Warning patterns
          pluginName ? `Warning in ${pluginName}` : 'Warning in',
          // Common client script patterns
          'script:',
          'resource:',
          'client:',
          'ui:',
          'nui:'
        ];

        let pluginContent = await LogFileReader.readLogFileLines(latestLogPath, lines * 3);
        if (pluginContent) {
          const fileName = path.basename(latestLogPath);
          const filteredLines = pluginContent.split('\n').filter(line => {
            const lowerLine = line.toLowerCase();
            
            if (pluginName) {
              const lowerPluginName = pluginName.toLowerCase();
              return lowerLine.includes(lowerPluginName) || 
                     lowerLine.includes(`[${lowerPluginName}]`) ||
                     lowerLine.includes(`(${lowerPluginName})`) ||
                     lowerLine.includes(`${lowerPluginName}:`) ||
                     lowerLine.includes(`script:${lowerPluginName}`) ||
                     lowerLine.includes(`resource:${lowerPluginName}`);
            }
            
            // General plugin/script patterns
            return pluginPatterns.some(pattern => 
              lowerLine.includes(pattern.toLowerCase())
            );
          }).slice(-lines); // 最新のlines行数だけ取得
          
          if (filteredLines.length > 0) {
            results.push(`--- ${fileName} (Client Plugin Logs) ---\n${filteredLines.join('\n')}\n`);
          }
        }
      } catch (fileError) {
        // Silent error handling for plugin log reading
      }

      return results.length > 1 ? results.join('\n') : null;
    } catch (error) {
      // Silent error handling for plugin logs
      return null;
    }
  }
} 