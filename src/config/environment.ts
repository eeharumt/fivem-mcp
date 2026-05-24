import { FiveMConfig } from '../types/index.js';
import * as path from 'path';
import * as os from 'os';

/**
 * Get FiveM server configuration from environment variables
 */
export function getFiveMConfig(): Partial<FiveMConfig> {
  const defaultLogsDir = process.env.PWD
    ? path.join(process.env.PWD, 'local/txData/default/logs')
    : 'local/txData/default/logs';

  let defaultClientLogsDir: string;
  if (process.platform === 'win32') {
    defaultClientLogsDir = path.join(os.homedir(), 'AppData', 'Local', 'FiveM', 'FiveM.app', 'logs');
  } else {
    defaultClientLogsDir = path.join(os.homedir(), '.local', 'share', 'CitizenFX');
  }

  const defaultBridgePath = process.env.FIVEM_MCP_BRIDGE_PATH
    || '/home/eeharumt/NeoLumina/fivem-server/local/txData/lumina/resources/[plugins]/[others]/mcp-bridge';
  const defaultScreenshotsDir = path.join(defaultBridgePath, 'screenshots');

  return {
    host: process.env.RCON_ADDRESS,
    port: process.env.RCON_PORT ? parseInt(process.env.RCON_PORT, 10) : undefined,
    password: process.env.RCON_PASSWORD,
    logsDir: process.env.FIVEM_LOGS_DIR || defaultLogsDir,
    clientLogsDir: process.env.FIVEM_CLIENT_LOGS_DIR || defaultClientLogsDir,
    screenshotsDir: process.env.FIVEM_SCREENSHOTS_DIR || defaultScreenshotsDir,
  };
}

/**
 * Check if environment variables are configured for auto-connection
 */
export function hasAutoConnectConfig(): boolean {
  const config = getFiveMConfig();
  return !!(config.host && config.port && config.password);
}

export function getSyncTargetPath(): string {
  return process.env.FIVEM_MCP_SYNC_TARGET
    || '/home/eeharumt/NeoLumina/fivem-server/local/txData/lumina/resources/[plugins]/[others]/mcp-bridge/';
}
