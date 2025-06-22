import { FiveMConfig } from '../types/index.js';
import * as path from 'path';

/**
 * Get FiveM server configuration from environment variables
 */
export function getFiveMConfig(): Partial<FiveMConfig> {
  // デフォルトのログディレクトリパスを設定
  const defaultLogsDir = process.env.PWD ? 
    path.join(process.env.PWD, 'local/txData/default/logs') : 
    'local/txData/default/logs';
    
  return {
    host: process.env.RCON_ADDRESS,
    port: process.env.RCON_PORT ? parseInt(process.env.RCON_PORT, 10) : undefined,
    password: process.env.RCON_PASSWORD,
    logsDir: process.env.FIVEM_LOGS_DIR || defaultLogsDir
  };
}

/**
 * Check if environment variables are configured for auto-connection
 */
export function hasAutoConnectConfig(): boolean {
  const config = getFiveMConfig();
  return !!(config.host && config.port && config.password);
} 