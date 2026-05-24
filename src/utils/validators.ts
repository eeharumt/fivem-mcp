import {
  PluginManageArgs,
  CommandExecuteArgs,
  BatchExecuteArgs,
  EventTriggerArgs,
  PlayerGetArgs,
  LogsGetArgs,
  LogsWatchArgs,
  SystemManageArgs,
  ServerInfoArgs,
  ResourceAnalyzeArgs,
  CommandValidateArgs,
  PlayerControlArgs,
  PluginManageAction,
  CommandMode,
  EventType,
  PlayerAction,
  LogSource,
  SystemAction,
  ServerInfoType,
  ExecutionMode,
  MCPResponse,
  ErrorCodes
} from '../types/index.js';

/**
 * Validation utilities for tool arguments
 */
export class Validators {
  private static isFiniteNumber(value: unknown): value is number {
    return typeof value === 'number' && Number.isFinite(value);
  }

  /**
   * Validate plugin manage arguments
   */
  static validatePluginManageArgs(args: unknown): args is PluginManageArgs {
    if (!args || typeof args !== 'object') {
      return false;
    }
    const a = args as Record<string, unknown>;
    
    if (typeof a.action !== 'string' || !['ensure', 'stop', 'restart', 'refresh'].includes(a.action)) {
      return false;
    }
    
    if ((a.action === 'ensure' || a.action === 'stop' || a.action === 'restart') && !a.plugin_name) {
      return false;
    }
    
    if (a.plugin_name !== undefined && typeof a.plugin_name !== 'string') {
      return false;
    }
    
    return true;
  }

  /**
   * Validate command execute arguments
   */
  static validateCommandExecuteArgs(args: unknown): args is CommandExecuteArgs {
    if (!args || typeof args !== 'object') {
      return false;
    }
    const a = args as Record<string, unknown>;
    
    if (typeof a.mode !== 'string' || !['server', 'client', 'rcon'].includes(a.mode)) {
      return false;
    }
    
    if (typeof a.command !== 'string' || a.command.trim().length === 0) {
      return false;
    }
    
    if (a.player_id !== undefined && (typeof a.player_id !== 'number' || a.player_id < 0)) {
      return false;
    }

    if (a.wait_for_result !== undefined && typeof a.wait_for_result !== 'boolean') {
      return false;
    }
    
    return true;
  }

  /**
   * Validate batch execute arguments
   */
  static validateBatchExecuteArgs(args: unknown): args is BatchExecuteArgs {
    if (!args || typeof args !== 'object') {
      return false;
    }
    const a = args as Record<string, unknown>;
    
    if (!Array.isArray(a.commands) || a.commands.length === 0) {
      return false;
    }
    
    for (const cmd of a.commands) {
      if (!this.validateCommandExecuteArgs(cmd)) {
        return false;
      }
    }
    
    if (a.execution_mode !== undefined && !['sequential', 'parallel'].includes(a.execution_mode as string)) {
      return false;
    }
    
    if (a.stop_on_error !== undefined && typeof a.stop_on_error !== 'boolean') {
      return false;
    }
    
    return true;
  }

  /**
   * Validate event trigger arguments
   */
  static validateEventTriggerArgs(args: unknown): args is EventTriggerArgs {
    if (!args || typeof args !== 'object') {
      return false;
    }
    const a = args as Record<string, unknown>;
    
    if (typeof a.type !== 'string' || !['server', 'client'].includes(a.type)) {
      return false;
    }
    
    if (typeof a.event_name !== 'string' || a.event_name.trim().length === 0) {
      return false;
    }
    
    if (a.type === 'client' && (a.player_id === undefined || typeof a.player_id !== 'number' || a.player_id < 0)) {
      return false;
    }
    
    if (a.player_id !== undefined && (typeof a.player_id !== 'number' || a.player_id < 0)) {
      return false;
    }
    
    if (a.args !== undefined && typeof a.args !== 'string') {
      return false;
    }

    if (a.wait_for_ack !== undefined && typeof a.wait_for_ack !== 'boolean') {
      return false;
    }
    
    return true;
  }

  /**
   * Validate player get arguments
   */
  static validatePlayerGetArgs(args: unknown): args is PlayerGetArgs {
    if (!args || typeof args !== 'object') {
      return false;
    }
    const a = args as Record<string, unknown>;
    
    if (typeof a.action !== 'string' || !['list', 'info'].includes(a.action)) {
      return false;
    }
    
    if (a.action === 'info' && (a.player_id === undefined || typeof a.player_id !== 'number' || a.player_id < 0)) {
      return false;
    }
    
    if (a.player_id !== undefined && (typeof a.player_id !== 'number' || a.player_id < 0)) {
      return false;
    }
    
    return true;
  }

  /**
   * Validate logs get arguments
   */
  static validateLogsGetArgs(args: unknown): args is LogsGetArgs {
    if (!args || typeof args !== 'object') {
      return false;
    }
    const a = args as Record<string, unknown>;
    
    if (typeof a.source !== 'string' || !['server', 'server_plugin', 'client', 'client_plugin'].includes(a.source)) {
      return false;
    }
    
    if (a.lines !== undefined && (typeof a.lines !== 'number' || a.lines < 1 || a.lines > 10000)) {
      return false;
    }
    
    if (a.plugin_name !== undefined && typeof a.plugin_name !== 'string') {
      return false;
    }
    
    return true;
  }

  /**
   * Validate logs watch arguments
   */
  static validateLogsWatchArgs(args: unknown): args is LogsWatchArgs {
    if (!args || typeof args !== 'object') {
      return false;
    }
    const a = args as Record<string, unknown>;
    
    if (typeof a.source !== 'string' || !['server', 'server_plugin', 'client', 'client_plugin'].includes(a.source)) {
      return false;
    }
    
    if (a.plugin_name !== undefined && typeof a.plugin_name !== 'string') {
      return false;
    }
    
    if (a.filter_pattern !== undefined && typeof a.filter_pattern !== 'string') {
      return false;
    }
    
    if (a.duration_seconds !== undefined && (typeof a.duration_seconds !== 'number' || a.duration_seconds < 1 || a.duration_seconds > 3600)) {
      return false;
    }
    
    return true;
  }

  /**
   * Validate system manage arguments
   */
  static validateSystemManageArgs(args: unknown): args is SystemManageArgs {
    if (!args || typeof args !== 'object') {
      return false;
    }
    const a = args as Record<string, unknown>;
    
    if (typeof a.action !== 'string' || !['health', 'clear'].includes(a.action)) {
      return false;
    }
    
    return true;
  }

  /**
   * Validate server info arguments
   */
  static validateServerInfoArgs(args: unknown): args is ServerInfoArgs {
    if (!args || typeof args !== 'object') {
      return false;
    }
    const a = args as Record<string, unknown>;
    
    if (typeof a.info_type !== 'string' || !['status', 'config', 'resources', 'performance'].includes(a.info_type)) {
      return false;
    }
    
    return true;
  }

  /**
   * Validate resource analyze arguments
   */
  static validateResourceAnalyzeArgs(args: unknown): args is ResourceAnalyzeArgs {
    if (!args || typeof args !== 'object') {
      return true; // All fields are optional
    }
    const a = args as Record<string, unknown>;
    
    if (a.resource_name !== undefined && typeof a.resource_name !== 'string') {
      return false;
    }
    
    return true;
  }

  /**
   * Validate command validate arguments
   */
  static validateCommandValidateArgs(args: unknown): args is CommandValidateArgs {
    if (!args || typeof args !== 'object') {
      return false;
    }
    const a = args as Record<string, unknown>;
    
    if (typeof a.command !== 'string' || a.command.trim().length === 0) {
      return false;
    }
    
    if (typeof a.mode !== 'string' || !['server', 'client', 'rcon'].includes(a.mode)) {
      return false;
    }
    
    return true;
  }

  /**
   * Validate player control arguments
   */
  static validatePlayerControlArgs(args: unknown): args is PlayerControlArgs {
    if (!args || typeof args !== 'object') {
      return false;
    }

    const a = args as Record<string, unknown>;
    const validActions = [
      'get_state',
      'teleport',
      'freeze',
      'unfreeze',
      'input_pulse',
      'input_sequence',
      'input_tap',
      'screenshot',
      'set_health',
      'set_armor',
      'give_weapon',
      'set_heading',
      'spawn_vehicle',
      'enter_vehicle',
      'repair_vehicle',
      'look_at',
    ];

    if (typeof a.action !== 'string' || !validActions.includes(a.action)) {
      return false;
    }

    if (typeof a.player_id !== 'number' || a.player_id < 0) {
      return false;
    }

    if (a.action === 'teleport') {
      const coords = a.coords as Record<string, unknown> | undefined;
      if (
        !coords ||
        !this.isFiniteNumber(coords.x) ||
        !this.isFiniteNumber(coords.y) ||
        !this.isFiniteNumber(coords.z)
      ) {
        return false;
      }
      if (coords.heading !== undefined && !this.isFiniteNumber(coords.heading)) {
        return false;
      }
    }

    if (a.action === 'input_pulse' || a.action === 'input_tap') {
      const input = a.input as Record<string, unknown> | undefined;
      if (!input || !Array.isArray(input.keys) || input.keys.length === 0) {
        return false;
      }
    }

    if (a.action === 'input_sequence') {
      if (!Array.isArray(a.sequence) || a.sequence.length === 0) {
        return false;
      }
    }

    if (a.action === 'set_health' && !this.isFiniteNumber(a.health)) {
      return false;
    }

    if (a.action === 'set_armor' && !this.isFiniteNumber(a.armor)) {
      return false;
    }

    if (a.action === 'give_weapon' && typeof a.weapon !== 'string') {
      return false;
    }

    if (a.action === 'set_heading' && !this.isFiniteNumber(a.heading)) {
      return false;
    }

    if (a.action === 'spawn_vehicle' && typeof a.model !== 'string') {
      return false;
    }

    if (a.action === 'look_at') {
      if (!this.isFiniteNumber(a.x) || !this.isFiniteNumber(a.y) || !this.isFiniteNumber(a.z)) {
        return false;
      }
    }

    return true;
  }

  /**
   * Create validation error response
   */
  static createValidationError(message: string): MCPResponse {
    return {
      success: false,
      message: `Validation error: ${message}`,
      error: {
        code: ErrorCodes.INVALID_ARGUMENTS,
        message: `Validation error: ${message}`,
        details: {}
      }
    };
  }
}

