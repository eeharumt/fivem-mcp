import { MCPResponse, ErrorCodes } from '../types/index.js';

/**
 * Response parser for FiveM RCON commands
 */
export class ResponseParser {
  
  /**
   * Parse RCON response and determine if it was successful
   */
  static parseRCONResponse(response: string, command: string): MCPResponse {
    const trimmedResponse = response.trim();
    
    console.log(`[DEBUG] Parsing response for command: ${command}`);
    console.log(`[DEBUG] Response: ${trimmedResponse}`);
    
    // Check for common error patterns
    if (this.isErrorResponse(trimmedResponse)) {
      console.log(`[DEBUG] Detected error response`);
      return this.createErrorResponse(trimmedResponse, command);
    }
    
    // Check for plugin-specific responses
    if (this.isPluginResponse(trimmedResponse)) {
      console.log(`[DEBUG] Detected plugin response`);
      return this.parsePluginResponse(trimmedResponse, command);
    }
    
    console.log(`[DEBUG] Using default success case`);
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
      /^false$/i
    ];
    
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
   * Parse plugin-specific responses
   */
  private static parsePluginResponse(response: string, command: string): MCPResponse {
    try {
      console.log(`[DEBUG] Parsing plugin response`);
      
      // Remove "print" prefix from response for cleaner parsing
      const cleanResponse = response.replace(/^print\s+/i, '').trim();
      
      // Check for command execution failures before JSON parsing
      if (cleanResponse.includes('No such command') || 
          cleanResponse.includes('Unknown command') ||
          cleanResponse.includes('Command not found')) {
        console.log(`[DEBUG] Found command failure pattern in plugin response`);
        return this.createErrorResponse(response, command);
      }
      
      // Try to extract JSON from response
      const jsonMatch = cleanResponse.match(/\{.*\}/);
      if (jsonMatch) {
        console.log(`[DEBUG] Found JSON in plugin response: ${jsonMatch[0]}`);
        try {
          const jsonData = JSON.parse(jsonMatch[0]);
          
          // For plugin responses with JSON, trust the plugin's success field
          // Only check for explicit command failure messages
          const hasCommandFailure = cleanResponse.includes('No such command') || 
                                   cleanResponse.includes('Unknown command') ||
                                   cleanResponse.includes('Command not found');
          
          console.log(`[DEBUG] Plugin JSON success: ${jsonData.success}, Has command failure: ${hasCommandFailure}`);
          
          // Use plugin's success field unless there's an explicit command failure
          const actualSuccess = !hasCommandFailure && (jsonData.success !== false);
          console.log(`[DEBUG] Actual success determined: ${actualSuccess}`);
          
          return {
            success: actualSuccess,
            message: actualSuccess ? (jsonData.message || 'Plugin command executed successfully') : 'Command execution failed',
            data: jsonData.data || { response, command },
            error: !actualSuccess ? {
              code: this.determineErrorCode(response),
              message: this.extractErrorMessage(response),
              details: { response, command }
            } : undefined
          };
        } catch (parseError) {
          console.log(`[DEBUG] JSON parse error: ${parseError}`);
          // If JSON parsing fails but we found JSON-like content, assume success
          return {
            success: true,
            message: 'Plugin command executed (JSON parse error)',
            data: { response, command }
          };
        }
      }
      
      // Check for plugin error indicators
      if (response.includes('[ERROR]') || response.includes('ERROR:')) {
        console.log(`[DEBUG] Found ERROR indicator in plugin response`);
        return this.createErrorResponse(response, command);
      }
      
      // Check for command failures in the output
      if (this.isErrorResponse(response)) {
        console.log(`[DEBUG] Error response detected in plugin output`);
        return this.createErrorResponse(response, command);
      }
      
      console.log(`[DEBUG] Default plugin success`);
      // Default plugin success
      return {
        success: true,
        message: 'Plugin command executed successfully',
        data: { response, command }
      };
    } catch (error) {
      console.log(`[DEBUG] Exception in plugin parsing: ${error}`);
      // If JSON parsing fails, check for errors in raw response
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
    if (/No such command|Unknown command|Command not found/i.test(response)) {
      return ErrorCodes.INVALID_COMMAND;
    }
    if (/Permission denied|Access denied/i.test(response)) {
      return ErrorCodes.PERMISSION_DENIED;
    }
    if (/Timeout/i.test(response)) {
      return ErrorCodes.TIMEOUT;
    }
    if (/Connection failed/i.test(response)) {
      return ErrorCodes.CONNECTION_FAILED;
    }
    if (/Resource.*not found|Plugin.*not found/i.test(response)) {
      return ErrorCodes.RESOURCE_NOT_FOUND;
    }
    if (/Invalid|argument.*null/i.test(response)) {
      return ErrorCodes.INVALID_ARGUMENTS;
    }
    if (/script error|Failed to/i.test(response)) {
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
    
    return null; // Valid command
  }
}