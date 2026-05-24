import { FiveMServerManager } from '../build/managers/server-manager.js';
import { getFiveMConfig } from '../build/config/environment.js';

const config = getFiveMConfig();
const manager = new FiveMServerManager(
  config.host || 'localhost',
  config.port || 30120,
  config.password || '',
  config.logsDir,
  config.clientLogsDir
);

const startedAt = Date.now();
const logStep = (label) => {
  const elapsed = ((Date.now() - startedAt) / 1000).toFixed(1);
  console.log(`[${elapsed}s] ${label}...`);
};

let failed = false;

try {
  logStep('connect');
  await manager.connect();

  logStep('health');
  const health = await manager.checkPluginHealth();
  console.log('HEALTH', health);

  logStep('get_state');
  const state = await manager.playerControlViaPlugin(1, 'get_state', {});
  console.log('GET_STATE', JSON.stringify(state, null, 2));
  if (!state.success) failed = true;

  logStep('client_command (wait_for_result)');
  const clientCmd = await manager.executeClientCommand('me MCP smoke test', 1, true);
  console.log('CLIENT_CMD', JSON.stringify(clientCmd, null, 2));
  if (!clientCmd.success) failed = true;

  logStep('event_ack (wait_for_ack)');
  const eventAck = await manager.triggerClientEventViaPlugin('mcp_test:client_event_simple', 1, undefined, true);
  console.log('EVENT_ACK', JSON.stringify(eventAck, null, 2));
  if (!eventAck.success) failed = true;

  console.log(`DONE in ${((Date.now() - startedAt) / 1000).toFixed(1)}s`);
  process.exit(failed ? 1 : 0);
} catch (error) {
  console.error('SMOKE_FAILED', error);
  process.exit(1);
}
