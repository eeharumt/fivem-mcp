/**
 * FiveM Server configuration interface
 */
export interface FiveMConfig {
  host: string;
  port: number;
  password: string;
  /** 
   * Path to the logs directory (where log files are stored)
   * Example: '/path/to/server/txData/default/logs' 
   * Log files (fxserver.log, server.log) should be directly in this directory
   */
  logsDir?: string;
}

/**
 * Log filter options
 */
export interface LogFilterOptions {
  lines?: number;
  filter?: string;
  logType?: string;
} 