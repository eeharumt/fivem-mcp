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

    const validDirs = [...new Set(possibleDirs.filter(dir => {
      try {
        const exists = fs.existsSync(dir) && fs.statSync(dir).isDirectory();
        if (!exists) {
          console.error(`[LogFileReader] Directory not found or not accessible: ${dir}`);
        }
        return exists;
      } catch (error) {
        console.error(`[LogFileReader] Error accessing directory ${dir}:`, error);
        return false;
      }
    }))];

    if (validDirs.length === 0) {
      console.error(`[LogFileReader] No valid log directories found. Searched: ${possibleDirs.join(', ')}`);
    } else {
      console.log(`[LogFileReader] Found valid log directories: ${validDirs.join(', ')}`);
    }

    return validDirs;
  }

  /**
   * Read actual log files from logs directory with retry mechanism
   */
  static async readLogFiles(lines: number = 100, logsDir?: string): Promise<string | null> {
    try {
      const logPaths = LogFileReader.findLogFiles(logsDir);
      
      if (logPaths.length === 0) {
        const logDirs = LogFileReader.findLogDirs(logsDir);
        const errorMsg = `No log files found. Searched directories: ${logDirs.length > 0 ? logDirs.join(', ') : 'none found'}`;
        console.error(`[LogFileReader] ${errorMsg}`);
        return `=== LOG READ ERROR ===\n${errorMsg}\n\nPlease ensure:\n1. FiveM server is running\n2. Log directory exists\n3. Log files are being generated\n4. Read permissions are correct`;
      }

      const results: string[] = [];
      results.push(`=== LIVE CONSOLE LOGS ===\n`);
      let successCount = 0;
      let errorCount = 0;

      for (const logPath of logPaths) {
        try {
          const logContent = await LogFileReader.readLogFileLinesWithRetry(logPath, lines);
          if (logContent) {
            const fileName = path.basename(logPath);
            results.push(`--- ${fileName} ---\n${logContent}\n`);
            successCount++;
            console.log(`[LogFileReader] Successfully read ${fileName}`);
          } else {
            console.warn(`[LogFileReader] Empty content from ${path.basename(logPath)}`);
          }
        } catch (fileError) {
          const fileName = path.basename(logPath);
          const errorMessage = fileError instanceof Error ? fileError.message : 'Unknown error';
          results.push(`--- ${fileName} ---\nError reading file: ${errorMessage}\n`);
          console.error(`[LogFileReader] Failed to read ${fileName}:`, errorMessage);
          errorCount++;
        }
      }

      console.log(`[LogFileReader] Read operation completed: ${successCount} successful, ${errorCount} failed`);
      return results.join('\n');
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      console.error(`[LogFileReader] Critical error in readLogFiles:`, errorMessage);
      return `=== CRITICAL LOG READ ERROR ===\n${errorMessage}`;
    }
  }

  /**
   * Find available log files in order of priority with better diagnostics
   */
  static findLogFiles(logsDir?: string): string[] {
    const logDirs = this.findLogDirs(logsDir);
    const logFiles: string[] = [];
    const searchResults: string[] = [];

    for (const dir of logDirs) {
        searchResults.push(`Searching directory: ${dir}`);
        
        // 現在のアクティブなログファイルを最優先で追加
        const currentServerLog = path.join(dir, 'server.log');
        const currentFxserverLog = path.join(dir, 'fxserver.log');
        
        // 最新のfxserver.logを最優先
        if (fs.existsSync(currentFxserverLog)) {
            logFiles.push(currentFxserverLog);
            searchResults.push(`✓ Found current fxserver.log: ${currentFxserverLog}`);
        } else {
            searchResults.push(`✗ Current fxserver.log not found: ${currentFxserverLog}`);
        }
        
        // server.logも追加
        if (fs.existsSync(currentServerLog)) {
            logFiles.push(currentServerLog);
            searchResults.push(`✓ Found server.log: ${currentServerLog}`);
        } else {
            searchResults.push(`✗ server.log not found: ${currentServerLog}`);
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
          
          searchResults.push(`Found ${files.length} dated log files: ${files.join(', ')}`);
          
          // 最新の日付付きログファイルのみ1つ追加（現在のfxserver.logが無い場合のバックアップ）
          if (files.length > 0 && !fs.existsSync(currentFxserverLog)) {
            const latestDateFile = path.join(dir, files[0]);
            logFiles.push(latestDateFile);
            searchResults.push(`✓ Using latest dated log as backup: ${latestDateFile}`);
          }
        } catch (error) {
            searchResults.push(`✗ Error scanning for dated logs: ${error instanceof Error ? error.message : 'Unknown error'}`);
        }
    }
    
    // Log search results for debugging
    console.log(`[LogFileReader] Log file search results:\n${searchResults.join('\n')}`);
    
    // 重複を除去して最新順で返す
    const uniqueFiles = [...new Set(logFiles)];
    console.log(`[LogFileReader] Final log files list: ${uniqueFiles.length > 0 ? uniqueFiles.join(', ') : 'none'}`);
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
            console.log(`[LogFileReader] Found latest FXServer log: ${path.join(dir, files[0])}`);
            if (logsDir) break;
          }
        }
      } catch (error) {
        console.error(`[LogFileReader] Error scanning FXServer logs in ${dir}:`, error);
      }
    }

    return [...new Set(fxserverLogs)];
  }

  /**
   * Read last N lines from a log file with retry mechanism
   */
  static async readLogFileLinesWithRetry(filePath: string, lines: number, filter?: string, maxRetries: number = 3): Promise<string | null> {
    let lastError: Error | null = null;
    
    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        return await LogFileReader.readLogFileLines(filePath, lines, filter);
      } catch (error) {
        lastError = error instanceof Error ? error : new Error('Unknown error');
        console.warn(`[LogFileReader] Attempt ${attempt}/${maxRetries} failed for ${path.basename(filePath)}: ${lastError.message}`);
        
        if (attempt < maxRetries) {
          // Wait 100ms before retry
          await new Promise(resolve => setTimeout(resolve, 100));
        }
      }
    }
    
    throw lastError || new Error('All retry attempts failed');
  }

  /**
   * Read last N lines from a log file (like tail -n)
   */
  static async readLogFileLines(filePath: string, lines: number, filter?: string): Promise<string | null> {
    try {
      const stats = fs.statSync(filePath);
      if (stats.size === 0) {
        console.warn(`[LogFileReader] File is empty: ${filePath}`);
        return null;
      }

      console.log(`[LogFileReader] Reading ${lines} lines from ${path.basename(filePath)} (${stats.size} bytes)`);
      const data = fs.readFileSync(filePath, 'utf8');
      let allLines = data.split('\n').filter(line => line.trim() !== '');
      
      // Apply filter if provided
      if (filter) {
        const filterLower = filter.toLowerCase();
        const originalCount = allLines.length;
        allLines = allLines.filter(line => 
          line.toLowerCase().includes(filterLower)
        );
        console.log(`[LogFileReader] Filter '${filter}' reduced lines from ${originalCount} to ${allLines.length}`);
      }
      
      // Get last N lines
      const lastLines = allLines.slice(-lines);
      
      if (lastLines.length === 0) {
        console.warn(`[LogFileReader] No matching lines found in ${path.basename(filePath)}`);
        return null;
      }

      console.log(`[LogFileReader] Successfully read ${lastLines.length} lines from ${path.basename(filePath)}`);
      return lastLines.join('\n');
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      console.error(`[LogFileReader] Error reading ${path.basename(filePath)}: ${errorMessage}`);
      throw error;
    }
  }

  /**
   * Find log files by specific pattern
   */
  static findLogsByPattern(pattern: string, logsDir?: string): string[] {
    const matchingFiles: string[] = [];
    const logDirs = this.findLogDirs(logsDir);

    console.log(`[LogFileReader] Searching for logs matching pattern: ${pattern}`);

    for (const dir of logDirs) {
      try {
        if (fs.existsSync(dir)) {
          const files = fs.readdirSync(dir)
            .filter(file => file.includes(pattern))
            .map(file => path.join(dir, file));
          
          matchingFiles.push(...files);
          console.log(`[LogFileReader] Found ${files.length} files matching '${pattern}' in ${dir}`);
        }
      } catch (error) {
        console.error(`[LogFileReader] Error searching pattern '${pattern}' in ${dir}:`, error);
      }
    }

    const uniqueFiles = [...new Set(matchingFiles)];
    console.log(`[LogFileReader] Total unique files found for pattern '${pattern}': ${uniqueFiles.length}`);
    return uniqueFiles;
  }

  /**
   * Read plugin/script logs only with improved error handling
   */
  static async readPluginLogs(lines: number = 100, logsDir?: string, pluginName?: string): Promise<string | null> {
    try {
      const logPaths = LogFileReader.findLogFiles(logsDir);
      if (logPaths.length === 0) {
        const errorMsg = "No log files found for plugin log reading";
        console.error(`[LogFileReader] ${errorMsg}`);
        return `=== PLUGIN LOG READ ERROR ===\n${errorMsg}`;
      }

      const results: string[] = [];
      results.push(`=== PLUGIN LOGS ===\n`);
      let foundPluginLogs = false;

      for (const logPath of logPaths) {
        try {
          const searchPattern = pluginName ? `script:${pluginName}` : 'script:';
          const pluginContent = await LogFileReader.readLogFileLinesWithRetry(logPath, lines * 3, searchPattern);
          
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
              foundPluginLogs = true;
              console.log(`[LogFileReader] Found ${filteredLines.length} plugin log lines in ${fileName}`);
            }
          }
        } catch (fileError) {
          const errorMessage = fileError instanceof Error ? fileError.message : 'Unknown error';
          console.error(`[LogFileReader] Error reading plugin logs from ${path.basename(logPath)}:`, errorMessage);
          results.push(`--- ${path.basename(logPath)} ---\nError reading plugin logs: ${errorMessage}\n`);
        }
      }

      if (!foundPluginLogs) {
        const message = pluginName 
          ? `No logs found for plugin '${pluginName}'. Plugin may not be running or generating logs.`
          : "No plugin logs found. Plugins may not be running or generating logs.";
        console.warn(`[LogFileReader] ${message}`);
        results.push(message);
      }

      return results.length > 1 ? results.join('\n') : null;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      console.error(`[LogFileReader] Critical error in readPluginLogs:`, errorMessage);
      return `=== CRITICAL PLUGIN LOG READ ERROR ===\n${errorMessage}`;
    }
  }
} 