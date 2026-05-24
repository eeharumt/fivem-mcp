import { MCPResponse, ErrorCodes } from '../types/index.js';

/**
 * Response parser for FiveM RCON commands
 */
export class ResponseParser {
  private static readonly DEBUG_ENABLED = process.env.MCP_FIVEM_DEBUG === 'true';
  private static readonly KNOWN_UNSUPPORTED_COMMANDS = new Set([
    'status',
    'list',
    'resmon',
    'resource',
    'uptime'
  ]);
  
  /**
   * Log debug message if debugging is enabled
   */
  private static debugLog(message: string): void {
    if (this.DEBUG_ENABLED) {
      console.error(`[MCP-FiveM DEBUG] ${message}`);
    }
  }
  
  /**
   * Parse RCON response and determine if it was successful
   */
  static parseRCONResponse(response: string, command: string): MCPResponse {
    const trimmedResponse = response.trim();
    
    this.debugLog(`Parsing response for command: ${command}`);
    this.debugLog(`Response: ${trimmedResponse}`);
    
    // Check for common error patterns
    if (this.isErrorResponse(trimmedResponse)) {
      this.debugLog(`Detected error response`);
      return this.createErrorResponse(trimmedResponse, command);
    }
    
    // Check for plugin-specific responses
    if (this.isPluginResponse(trimmedResponse)) {
      this.debugLog(`Detected plugin response`);
      return this.parsePluginResponse(trimmedResponse, command);
    }
    
    this.debugLog(`Using default success case`);
    // Default success case
    return {
      success: true,
      message: 'Command executed successfully',
      data: { response: trimmedResponse, command }
    };
  }
  
  /**
   * Check if response indicates an error
   */
  private static isErrorResponse(response: string): boolean {
    const errorPatterns = [
      /^No such command/i,
      /^Unknown command/i,
      /^Command not found/i,
      /^Error:/i,
      /^script error/i,
      /^Failed to/i,
      /^Cannot/i,
      /^Invalid/i,
      /^Permission denied/i,
      /^Access denied/i,
      /^Timeout/i,
      /^Connection failed/i,
      /^Resource .* not found/i,
      /^Plugin .* not found/i,
      /argument.*null/i,
      /^nil$/i,
      /^false$/i,
      /^usage:/i,
      /^Syntax error/i,
      /^Missing argument/i,
      /^Invalid argument/i,
      /^Bad rcon/i
    ];
    
    // Check for empty or whitespace-only responses (often indicate failure)
    if (!response || response.trim().length === 0) {
      return false; // Empty responses are not necessarily errors
    }
    
    return errorPatterns.some(pattern => pattern.test(response));
  }
  
  /**
   * Check if response is from a plugin (mcp-bridge)
   */
  private static isPluginResponse(response: string): boolean {
    // Check for JSON response format or plugin-specific patterns
    return response.includes('{"data":') || 
           response.includes('[MCP-Bridge]') ||
           response.includes('"success":');
  }
  
  /**
   * Extract the plugin's structured JSON payload from mixed RCON output.
   */
  static extractPluginJson(response: string): Record<string, unknown> | null {
    const cleanResponse = response.replace(/^print\s+/i, '').trim();
    const candidates: Record<string, unknown>[] = [];

    for (let i = 0; i < cleanResponse.length; i += 1) {
      if (cleanResponse[i] !== '{') {
        continue;
      }

      let depth = 0;
      for (let j = i; j < cleanResponse.length; j += 1) {
        const ch = cleanResponse[j];
        if (ch === '{') {
          depth += 1;
        }
        if (ch === '}') {
          depth -= 1;
        }

        if (depth === 0) {
          const snippet = cleanResponse.slice(i, j + 1);
          try {
            candidates.push(JSON.parse(snippet) as Record<string, unknown>);
          } catch {
            // Ignore malformed fragments.
          }
          break;
        }
      }
    }

    for (let i = candidates.length - 1; i >= 0; i -= 1) {
      if (typeof candidates[i].success === 'boolean') {
        return candidates[i];
      }
    }

    return null;
  }

  /**
   * Parse plugin-specific responses
   */
  private static parsePluginResponse(response: string, command: string): MCPResponse {
    try {
      this.debugLog(`Parsing plugin response`);
      
      const cleanResponse = response.replace(/^print\s+/i, '').trim();
      
      if (cleanResponse.includes('No such command') || 
          cleanResponse.includes('Unknown command') ||
          cleanResponse.includes('Command not found')) {
        this.debugLog(`Found command failure pattern in plugin response`);
        return this.createErrorResponse(response, command);
      }

      const jsonData = this.extractPluginJson(response);
      if (jsonData) {
        this.debugLog(`Found JSON in plugin response`);
        const hasCommandFailure = cleanResponse.includes('No such command') || 
                                 cleanResponse.includes('Unknown command') ||
                                 cleanResponse.includes('Command not found');
        
        const hasErrorField = jsonData.error !== undefined && jsonData.error !== null;
        const actualSuccess = !hasCommandFailure && !hasErrorField && (jsonData.success !== false);
        
        const errorField = jsonData.error as { code?: string; message?: string; details?: Record<string, unknown> } | undefined;

        return {
          success: actualSuccess,
          message: actualSuccess 
            ? (String(jsonData.message || 'Plugin command executed successfully'))
            : (errorField?.message || String(jsonData.message || 'Command execution failed')),
          data: (jsonData.data as Record<string, unknown> | undefined) || { response, command },
          error: !actualSuccess ? {
            code: errorField?.code || this.determineErrorCode(response),
            message: errorField?.message || this.extractErrorMessage(response),
            details: { response, command, ...errorField?.details }
          } : undefined
        };
      }
      
      // Check for plugin error indicators
      if (response.includes('[ERROR]') || response.includes('ERROR:') || response.includes('[MCP-Bridge ERROR]')) {
        this.debugLog(`Found ERROR indicator in plugin response`);
        return this.createErrorResponse(response, command);
      }
      
      // Check for command failures in the output
      if (this.isErrorResponse(response)) {
        this.debugLog(`Error response detected in plugin output`);
        return this.createErrorResponse(response, command);
      }
      
      this.debugLog(`Default plugin success`);
      // Default plugin success
      return {
        success: true,
        message: 'Plugin command executed successfully',
        data: { response, command }
      };
    } catch (error) {
      this.debugLog(`Exception in plugin parsing: ${error}`);
      // If parsing fails, check for errors in raw response
      if (this.isErrorResponse(response)) {
        return this.createErrorResponse(response, command);
      }
      
      return {
        success: true,
        message: 'Plugin command executed (non-JSON response)',
        data: { response, command }
      };
    }
  }
  
  /**
   * Create standardized error response
   */
  private static createErrorResponse(response: string, command: string): MCPResponse {
    const errorCode = this.determineErrorCode(response);
    const errorMessage = this.extractErrorMessage(response);
    
    return {
      success: false,
      message: errorMessage,
      error: {
        code: errorCode,
        message: errorMessage,
        details: { response, command }
      }
    };
  }
  
  /**
   * Determine error code based on response
   */
  private static determineErrorCode(response: string): string {
    const lowerResponse = response.toLowerCase();
    
    if (/No such command|Unknown command|Command not found|usage:/i.test(response)) {
      return ErrorCodes.INVALID_COMMAND;
    }
    if (/Permission denied|Access denied|Bad rcon/i.test(response)) {
      return ErrorCodes.PERMISSION_DENIED;
    }
    if (/Timeout|timed out/i.test(response)) {
      return ErrorCodes.TIMEOUT;
    }
    if (/Connection failed|Connection refused|Connection reset/i.test(response)) {
      return ErrorCodes.CONNECTION_FAILED;
    }
    if (/Resource .* not found|Plugin .* not found|Resource .* does not exist/i.test(response)) {
      return ErrorCodes.RESOURCE_NOT_FOUND;
    }
    if (/Invalid|argument.*null|Missing argument|Syntax error/i.test(response)) {
      return ErrorCodes.INVALID_ARGUMENTS;
    }
    if (/script error|Failed to|Error:/i.test(response)) {
      return ErrorCodes.COMMAND_FAILED;
    }
    
    return ErrorCodes.UNKNOWN_ERROR;
  }
  
  /**
   * Extract meaningful error message from response
   */
  private static extractErrorMessage(response: string): string {
    // Clean up common FiveM error prefixes
    let message = response
      .replace(/^print\s+/i, '')
      .replace(/^script error in native [0-9a-f]+:\s*/i, '')
      .trim();
    
    // Capitalize first letter
    if (message.length > 0) {
      message = message.charAt(0).toUpperCase() + message.slice(1);
    }
    
    return message || 'Unknown error occurred';
  }
  
  /**
   * Validate command before execution
   */
  static validateCommand(command: string): MCPResponse | null {
    if (!command || command.trim().length === 0) {
      return {
        success: false,
        message: 'Command cannot be empty',
        error: {
          code: ErrorCodes.INVALID_ARGUMENTS,
          message: 'Command cannot be empty'
        }
      };
    }
    
    // Check for potentially dangerous commands (basic security)
    const dangerousPatterns = [
      /rm\s+-rf/i,
      /del\s+\/[sq]/i,
      /format\s+/i,
      /shutdown/i,
      /reboot/i
    ];
    
    if (dangerousPatterns.some(pattern => pattern.test(command))) {
      return {
        success: false,
        message: 'Command contains potentially dangerous operations',
        error: {
          code: ErrorCodes.PERMISSION_DENIED,
          message: 'Command contains potentially dangerous operations'
        }
      };
    }

    const trimmedCommand = command.trim();
    const commandName = trimmedCommand.split(/\s+/)[0]?.toLowerCase() || '';
    if (this.KNOWN_UNSUPPORTED_COMMANDS.has(commandName)) {
      const suggestions = this.getUnsupportedCommandSuggestions(commandName);
      const suggestionText = suggestions.length > 0
        ? ` Suggested alternatives: ${suggestions.join(' | ')}`
        : '';

      return {
        success: false,
        message: `Unsupported FiveM command "${commandName}".${suggestionText}`,
        error: {
          code: ErrorCodes.INVALID_COMMAND,
          message: `Unsupported FiveM command "${commandName}".`,
          details: {
            command,
            command_name: commandName,
            suggested_commands: suggestions
          }
        }
      };
    }
    
    return null; // Valid command
  }

  private static getUnsupportedCommandSuggestions(commandName: string): string[] {
    switch (commandName) {
      case 'status':
      case 'list':
        return [
          'fivem_system_manage action=health',
          'fivem_player_get action=list'
        ];
      case 'resmon':
        return [
          'fivem_resource_analyze',
          'fivem_server_info info_type=performance'
        ];
      case 'resource':
        return [
          'start <resource>',
          'stop <resource>',
          'ensure <resource>',
          'restart <resource>',
          'refresh'
        ];
      case 'uptime':
        return [
          'version',
          'fivem_server_info info_type=performance'
        ];
      default:
        return ['fivem_system_manage action=health'];
    }
  }
}