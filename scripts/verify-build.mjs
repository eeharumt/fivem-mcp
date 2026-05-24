import fs from 'node:fs';
import path from 'node:path';

const root = process.cwd();
const requiredFiles = [
  'build/index.js',
  'fivem-plugin/mcp-bridge/fxmanifest.lua',
  'fivem-plugin/mcp-bridge/server/security.lua',
  'fivem-plugin/mcp-bridge/server/async_dispatch.lua',
  'fivem-plugin/mcp-bridge/server/client_command.lua',
];

const requiredSnippets = [
  ['src/index.ts', 'fivem_player_control'],
  ['src/managers/server-manager.ts', 'dispatchAndPoll'],
  ['fivem-plugin/mcp-bridge/server/client_command.lua', 'mcp_async_poll'],
  ['fivem-plugin/mcp-bridge/client/player_control.lua', 'set_health'],
];

let failed = false;

for (const file of requiredFiles) {
  const fullPath = path.join(root, file);
  if (!fs.existsSync(fullPath)) {
    console.error(`Missing required file: ${file}`);
    failed = true;
  }
}

for (const [file, snippet] of requiredSnippets) {
  const fullPath = path.join(root, file);
  const content = fs.readFileSync(fullPath, 'utf8');
  if (!content.includes(snippet)) {
    console.error(`Missing expected snippet "${snippet}" in ${file}`);
    failed = true;
  }
}

if (failed) {
  process.exit(1);
}

console.log('verify-build: OK');
