# MCP-FiveM Verification Guide

## Build Verification

```bash
npm run verify
```

This runs TypeScript compilation and checks that required MCP / mcp-bridge files and symbols exist.

## FiveM Server Smoke Test

Prerequisites:

- Development server running with RCON enabled
- `mcp-bridge` deployed (`npm run sync`)
- `dev-local.cfg` includes:

```cfg
setr mcp_bridge_enabled 1
setr mcp_bridge_allow_player_control 1
setr mcp_bridge_include_tokens 0
ensure mcp-bridge
ensure screencapture
```

### 1. Health Check

Use MCP tool `fivem_system_manage` with `action: "health"`.

Expected: JSON response with `version: "2.2.0"` and bridge flags.

### 2. Plugin Lifecycle

1. `fivem_plugin_manage` → `ensure mcp-bridge`
2. `fivem_logs_get` → `source: "server_plugin"`, `plugin_name: "mcp-bridge"`

Expected: bridge startup logs without Lua errors.

### 3. Player Control

With one player online (`player_id: 1`):

1. `fivem_player_control` → `action: "get_state"`
2. `fivem_player_control` → `action: "teleport"` with coords
3. `fivem_player_control` → `action: "input_pulse"` with `W` key
4. `fivem_player_control` → `action: "screenshot"`

Expected: each call returns `success: true` and state includes `health`, `armor`, `ped_model`.

### 4. Client Command Result Polling

1. `fivem_command_execute` → `mode: "client"`, `command: "me test"`, `player_id: 1`, `wait_for_result: true`

Expected: MCP response includes executed command result, not just dispatch success.

### 5. Event Ack

1. `fivem_event_trigger` → `type: "client"`, `event_name: "mcp_test:client_event_simple"`, `player_id: 1`, `wait_for_ack: true`

Expected: ack response with client delivery confirmation.

### 6. Security Gate

Set `setr mcp_bridge_enabled 0` and retry `fivem_player_control`.

Expected: explicit error indicating bridge/player control is disabled.

## Environment Variables

| Variable | Purpose |
|---|---|
| `RCON_ADDRESS` | FiveM host |
| `RCON_PORT` | RCON port |
| `RCON_PASSWORD` | RCON password |
| `FIVEM_LOGS_DIR` | Server logs directory |
| `FIVEM_CLIENT_LOGS_DIR` | Client logs directory |
| `FIVEM_SCREENSHOTS_DIR` | Screenshot read path (defaults to mcp-bridge resource) |
| `FIVEM_MCP_SYNC_TARGET` | rsync destination for `npm run sync` |
| `FIVEM_MCP_BRIDGE_PATH` | Base path for default screenshot directory |
