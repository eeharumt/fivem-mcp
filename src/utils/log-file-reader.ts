import * as fs from 'fs';
import * as path from 'path';

/**
 * Log file reading utilities for FiveM server logs
 */
export class LogFileReader {

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
      results.push(`=== LIVE CONSOLE LOGS ===\n`);

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
      results.push(`=== PLUGIN LOGS ===\n`);

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
              results.push(`--- ${fileName} (Plugin Logs) ---\n${filteredLines.join('\n')}\n`);
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
} 