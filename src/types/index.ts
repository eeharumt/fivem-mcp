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
  /**
   * Path to MCP bridge screenshot output directory
   */
  screenshotsDir?: string;
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
export interface MCPResponse<T = unknown> {
  success: boolean;
  message: string;
  data?: T;
  error?: {
    code: string;
    message: string;
    details?: Record<string, unknown>;
  };
}

/**
 * Success response helper type
 */
export type MCPSuccessResponse<T = unknown> = Required<Pick<MCPResponse<T>, 'success' | 'message' | 'data'>> & {
  success: true;
};

/**
 * Error response helper type
 */
export type MCPErrorResponse = Required<Pick<MCPResponse, 'success' | 'message' | 'error'>> & {
  success: false;
};

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

/**
 * Tool argument types
 */
export type PluginManageAction = 'ensure' | 'stop' | 'restart' | 'refresh';
export type CommandMode = 'server' | 'client' | 'rcon';
export type EventType = 'server' | 'client';
export type PlayerAction = 'list' | 'info';
export type LogSource = 'server' | 'server_plugin' | 'client' | 'client_plugin';
export type SystemAction = 'health' | 'clear';
export type ServerInfoType = 'status' | 'config' | 'resources' | 'performance';
export type ExecutionMode = 'sequential' | 'parallel';

/**
 * Plugin management arguments
 */
export interface PluginManageArgs {
  action: PluginManageAction;
  plugin_name?: string;
}

/**
 * Command execution arguments
 */
export interface CommandExecuteArgs {
  mode: CommandMode;
  command: string;
  player_id?: number;
  wait_for_result?: boolean;
}

/**
 * Batch command item
 */
export interface BatchCommandItem {
  mode: CommandMode;
  command: string;
  player_id?: number;
}

/**
 * Batch execute arguments
 */
export interface BatchExecuteArgs {
  commands: BatchCommandItem[];
  execution_mode?: ExecutionMode;
  stop_on_error?: boolean;
}

/**
 * Event trigger arguments
 */
export interface EventTriggerArgs {
  type: EventType;
  event_name: string;
  player_id?: number;
  args?: string;
  wait_for_ack?: boolean;
}

/**
 * Player get arguments
 */
export interface PlayerGetArgs {
  action: PlayerAction;
  player_id?: number;
  include_tokens?: boolean;
}

/**
 * Logs get arguments
 */
export interface LogsGetArgs {
  source: LogSource;
  lines?: number;
  plugin_name?: string;
}

/**
 * Logs watch arguments
 */
export interface LogsWatchArgs {
  source: LogSource;
  plugin_name?: string;
  filter_pattern?: string;
  duration_seconds?: number;
}

/**
 * System manage arguments
 */
export interface SystemManageArgs {
  action: SystemAction;
}

/**
 * Server info arguments
 */
export interface ServerInfoArgs {
  info_type: ServerInfoType;
}

/**
 * Resource analyze arguments
 */
export interface ResourceAnalyzeArgs {
  resource_name?: string;
}

/**
 * Command validate arguments
 */
export interface CommandValidateArgs {
  command: string;
  mode: CommandMode;
}

export type PlayerControlAction =
  | 'get_state'
  | 'teleport'
  | 'freeze'
  | 'unfreeze'
  | 'input_pulse'
  | 'input_sequence'
  | 'input_tap'
  | 'screenshot'
  | 'set_health'
  | 'set_armor'
  | 'give_weapon'
  | 'set_heading'
  | 'spawn_vehicle'
  | 'enter_vehicle'
  | 'repair_vehicle'
  | 'look_at';

export interface PlayerControlCoords {
  x: number;
  y: number;
  z: number;
  heading?: number;
}

export interface PlayerControlInput {
  keys: string[];
  duration_ms?: number;
}

export interface PlayerControlSequenceStep {
  keys: string[];
  duration_ms: number;
  delay_ms?: number;
}

export interface PlayerControlScreenshotOptions {
  quality?: number;
}

export interface PlayerControlArgs {
  action: PlayerControlAction;
  player_id: number;
  coords?: PlayerControlCoords;
  input?: PlayerControlInput;
  sequence?: PlayerControlSequenceStep[];
  screenshot?: PlayerControlScreenshotOptions;
  health?: number;
  armor?: number;
  weapon?: string;
  ammo?: number;
  heading?: number;
  model?: string;
  seat?: number;
  x?: number;
  y?: number;
  z?: number;
  duration_ms?: number;
}