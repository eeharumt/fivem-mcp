-- MCP Bridge - Security gates, allowlists, and audit logging

local function splitCsv(value)
    local items = {}
    if not value or value == '' then
        return items
    end

    for item in string.gmatch(value, '([^,]+)') do
        local trimmed = item:match('^%s*(.-)%s*$')
        if trimmed ~= '' then
            table.insert(items, trimmed)
        end
    end

    return items
end

local function matchesAllowlist(value, allowlistCsv)
    local allowlist = splitCsv(allowlistCsv)
    if #allowlist == 0 then
        return true
    end

    for _, allowed in ipairs(allowlist) do
        if value == allowed or string.match(value, '^' .. allowed) then
            return true
        end
    end

    return false
end

function isMcpBridgeEnabled()
    return GetConvar('mcp_bridge_enabled', '0') == '1'
end

function isMcpBridgeDevOnly()
    return GetConvar('mcp_bridge_dev_only', '1') == '1'
end

function isPlayerControlAllowed()
    if not isMcpBridgeEnabled() then
        return false
    end

    return GetConvar('mcp_bridge_allow_player_control', '1') == '1'
end

function shouldIncludePlayerTokens()
    return GetConvar('mcp_bridge_include_tokens', '0') == '1'
end

function assertMcpBridgeEnabled(actionLabel)
    if not isMcpBridgeEnabled() then
        return false, formatError('MCP bridge is disabled. Set mcp_bridge_enabled to 1 in dev-local.cfg', {
            action = actionLabel,
        })
    end

    return true
end

function assertBridgeOperationAllowed(actionLabel)
    local enabled, err = assertMcpBridgeEnabled(actionLabel)
    if not enabled then
        return false, err
    end

    if isMcpBridgeDevOnly() and GetConvar('sv_environment', 'prod') == 'prod' then
        return false, formatError('MCP bridge dev-only mode blocked this operation on production-like server', {
            action = actionLabel,
        })
    end

    return true
end

function isCommandAllowed(command)
    local denylist = splitCsv(GetConvar('mcp_bridge_command_denylist', 'quit,stop mcp-bridge,restart mcp-bridge'))
    local commandPart = string.match(command or '', '^(%S+)') or ''

    for _, denied in ipairs(denylist) do
        if commandPart == denied or string.match(command, '^' .. denied) then
            return false, 'Command is denied by MCP bridge security policy'
        end
    end

    local allowlistCsv = GetConvar('mcp_bridge_command_allowlist', '')
    if allowlistCsv ~= '' and not matchesAllowlist(commandPart, allowlistCsv) then
        return false, 'Command is not in MCP bridge command allowlist'
    end

    return true
end

function isEventAllowed(eventName)
    local denylist = splitCsv(GetConvar('mcp_bridge_event_denylist', ''))
    for _, denied in ipairs(denylist) do
        if eventName == denied then
            return false, 'Event is denied by MCP bridge security policy'
        end
    end

    local allowlistCsv = GetConvar('mcp_bridge_event_allowlist', '')
    if allowlistCsv ~= '' and not matchesAllowlist(eventName, allowlistCsv) then
        return false, 'Event is not in MCP bridge event allowlist'
    end

    return true
end

function auditMcpOperation(operation, details)
    mcpLog('info', '[AUDIT] ' .. operation, details or {})
end

function unpackEventArgs(decoded)
    if decoded == nil then
        return {}
    end

    if type(decoded) ~= 'table' then
        return { decoded }
    end

    if #decoded > 0 then
        return decoded
    end

    return { decoded }
end

function buildPlayerInfo(playerId, includeTokens)
    local playerInfo = {
        id = playerId,
        name = GetPlayerName(playerId),
        ping = GetPlayerPing(playerId),
        endpoint = GetPlayerEndpoint(playerId),
        identifiers = GetPlayerIdentifiers(playerId),
        last_msg = GetPlayerLastMsg(playerId),
    }

    if includeTokens then
        playerInfo.tokens = GetPlayerTokens(playerId)
    end

    return playerInfo
end

-- Ensure cross-file visibility under lua54 script environments.
_G.isMcpBridgeEnabled = isMcpBridgeEnabled
_G.isMcpBridgeDevOnly = isMcpBridgeDevOnly
_G.isPlayerControlAllowed = isPlayerControlAllowed
_G.shouldIncludePlayerTokens = shouldIncludePlayerTokens
_G.assertMcpBridgeEnabled = assertMcpBridgeEnabled
_G.assertBridgeOperationAllowed = assertBridgeOperationAllowed
_G.isCommandAllowed = isCommandAllowed
_G.isEventAllowed = isEventAllowed
_G.auditMcpOperation = auditMcpOperation
_G.unpackEventArgs = unpackEventArgs
_G.buildPlayerInfo = buildPlayerInfo
