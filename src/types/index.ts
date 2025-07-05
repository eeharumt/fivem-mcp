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
  /** 
   * Path to the FiveM client logs directory
   * Example: '/home/user/.local/share/CitizenFX' (Linux/WSL2)
   * Example: 'C:\\Users\\user\\AppData\\Local\\FiveM\\FiveM.app\\logs' (Windows)
   */
  clientLogsDir?: string;
}

/**
 * Log filter options
 */
export interface LogFilterOptions {
  lines?: number;
  filter?: string;
  logType?: string;
}

/**
 * Standardized response format for all MCP operations
 */
export interface MCPResponse {
  success: boolean;
  message: string;
  data?: any;
  error?: {
    code: string;
    message: string;
    details?: any;
  };
}

/**
 * Error codes for standardized error handling
 */
export enum ErrorCodes {
  CONNECTION_FAILED = 'CONNECTION_FAILED',
  COMMAND_FAILED = 'COMMAND_FAILED',
  PLUGIN_NOT_FOUND = 'PLUGIN_NOT_FOUND',
  INVALID_COMMAND = 'INVALID_COMMAND',
  TIMEOUT = 'TIMEOUT',
  PERMISSION_DENIED = 'PERMISSION_DENIED',
  RESOURCE_NOT_FOUND = 'RESOURCE_NOT_FOUND',
  INVALID_ARGUMENTS = 'INVALID_ARGUMENTS',
  UNKNOWN_ERROR = 'UNKNOWN_ERROR'
} 