-- MCP Bridge Utils - Simplified for RCON Commands

-- Logging function
function mcpLog(level, message, data)
    local timestamp = os.date('%Y-%m-%d %H:%M:%S')
    local logMessage = string.format('[%s] [MCP-Bridge] [%s] %s', timestamp, level:upper(), message)
    
    if data then
        logMessage = logMessage .. ' | ' .. json.encode(data)
    end
    
    print(logMessage)
end

-- JSON utilities
function encodeJson(data)
    return json.encode(data)
end

function decodeJson(jsonString)
    local success, result = pcall(json.decode, jsonString)
    if success then
        return result
    else
        return nil
    end
end

-- Fix broken JSON string by restoring quotes
function fixJsonString(brokenJson)
    if not brokenJson or brokenJson == "" then
        return brokenJson
    end
    
    -- Basic JSON quote restoration
    local fixed = brokenJson
    
    -- Replace unquoted keys and string values with quoted ones
    -- This is a simplified approach for common cases
    fixed = string.gsub(fixed, "([{,]%s*)([%w_]+)(%s*:)", "%1\"%2\"%3")  -- Quote keys
    fixed = string.gsub(fixed, ":%s*([%w_]+)(%s*[,}])", ": \"%1\"%2")    -- Quote string values
    fixed = string.gsub(fixed, ":%s*([%w_]+)(%s*$)", ": \"%1\"")         -- Quote string values at end
    
    -- Fix numbers that got quoted
    fixed = string.gsub(fixed, "\"(%d+)\"", "%1")
    fixed = string.gsub(fixed, "\"(%d+%.%d+)\"", "%1")
    
    return fixed
end

function decodeJsonSafe(jsonString)
    -- First try normal decode
    local success, result = pcall(json.decode, jsonString)
    if success then
        return result
    end
    
    -- If that fails, try to fix the JSON string
    local fixedJson = fixJsonString(jsonString)
    mcpLog('debug', 'Attempting to fix broken JSON', { 
        original = jsonString,
        fixed = fixedJson
    })
    
    success, result = pcall(json.decode, fixedJson)
    if success then
        return result
    else
        return nil
    end
end

-- Player utilities
function getPlayerIdentifier(playerId)
    local identifiers = GetPlayerIdentifiers(playerId)
    for _, id in ipairs(identifiers) do
        if string.match(id, 'license:') then
            return id
        end
    end
    return nil
end

function isPlayerOnline(playerId)
    return GetPlayerName(playerId) ~= nil
end

-- Response formatting for RCON output
function formatResponse(success, data, message)
    local response = {
        success = success,
        message = message or (success and 'OK' or 'Error'),
        data = data or {},
        timestamp = os.time()
    }
    return encodeJson(response)
end

function formatSuccess(data, message)
    return formatResponse(true, data, message)
end

function formatError(message, data)
    return formatResponse(false, data, message)
end

-- Security gates, allowlists, and audit logging
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
    local summary = operation
    if details and details.player_id then
        summary = summary .. (' player=%s'):format(tostring(details.player_id))
    end
    if details and details.action then
        summary = summary .. (' action=%s'):format(tostring(details.action))
    end
    if details and details.request_id then
        summary = summary .. (' request=%s'):format(tostring(details.request_id))
    end
    mcpLog('info', '[AUDIT] ' .. summary)
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

-- Async dispatch/poll helpers
local pendingRequests = {}

function createPendingRequest(kind, metadata)
    local requestId = string.format('%s_%d_%d', kind, os.time(), GetGameTimer())
    pendingRequests[requestId] = {
        state = 'pending',
        kind = kind,
        createdAt = os.time(),
        metadata = metadata or {},
    }
    return requestId
end

function setPendingResult(requestId, success, data, message)
    local entry = pendingRequests[requestId]
    if not entry or entry.state ~= 'pending' then
        return false
    end

    entry.state = 'done'
    entry.success = success
    entry.data = data or {}
    entry.message = message or ''
    return true
end

function clearPendingRequest(requestId)
    pendingRequests[requestId] = nil
end

function pollPendingRequest(requestId)
    if not requestId or requestId == '' then
        return formatError('Request ID is required')
    end

    local entry = pendingRequests[requestId]
    if not entry then
        return formatError('Unknown or expired request', { request_id = requestId })
    end

    if entry.state == 'pending' then
        return formatSuccess({
            request_id = requestId,
            status = 'pending',
            kind = entry.kind,
            metadata = entry.metadata,
        }, 'Request pending')
    end

    pendingRequests[requestId] = nil

    if entry.success then
        return formatSuccess(entry.data, entry.message)
    end

    return formatError(entry.message, entry.data)
end

function dispatchClientCommand(playerId, command, commandType, params, commandArgs)
    local allowed, errMessage = assertBridgeOperationAllowed('client_command')
    if not allowed then
        return errMessage
    end

    playerId = tonumber(playerId)
    if not playerId then
        return formatError('Player ID is required')
    end

    if not isPlayerOnline(playerId) then
        return formatError('Player is not online', { player_id = playerId })
    end

    local cmdAllowed, cmdErr = isCommandAllowed(command)
    if command and cmdAllowed == false then
        return formatError(cmdErr or 'Command is not allowed', { command = command })
    end

    local requestId = createPendingRequest('client_command', {
        player_id = playerId,
        command = command,
        command_type = commandType,
    })

    auditMcpOperation('client_command_dispatch', {
        player_id = playerId,
        command = command,
        command_type = commandType,
        request_id = requestId,
    })

    if commandType then
        TriggerClientEvent('mcp:executeSpecificClientCommandAsync', playerId, requestId, commandType, params or {})
    else
        TriggerClientEvent('mcp:executeClientCommandAsync', playerId, requestId, command, commandArgs)
    end

    return formatSuccess({
        request_id = requestId,
        status = 'pending',
        player_id = playerId,
        command = command,
        command_type = commandType,
    }, 'Client command dispatched')
end

function dispatchClientEventAck(playerId, eventName, eventArgs)
    local allowed, errMessage = assertBridgeOperationAllowed('event_client_ack')
    if not allowed then
        return errMessage
    end

    local eventAllowed, eventErr = isEventAllowed(eventName)
    if not eventAllowed then
        return formatError(eventErr or 'Event is not allowed', { event_name = eventName })
    end

    playerId = tonumber(playerId)
    if not playerId then
        return formatError('Player ID is required')
    end

    if not isPlayerOnline(playerId) then
        return formatError('Player is not online', { player_id = playerId })
    end

    local args = unpackEventArgs(eventArgs)
    local requestId = createPendingRequest('event_ack', {
        player_id = playerId,
        event_name = eventName,
    })

    auditMcpOperation('event_client_ack_dispatch', {
        player_id = playerId,
        event_name = eventName,
        request_id = requestId,
    })

    local success = pcall(function()
        if #args > 0 then
            TriggerClientEvent(eventName, playerId, table.unpack(args))
        else
            TriggerClientEvent(eventName, playerId)
        end
    end)

    if not success then
        clearPendingRequest(requestId)
        return formatError('Failed to trigger client event', { event_name = eventName, player_id = playerId })
    end

    TriggerClientEvent('mcp-bridge:confirmEventDelivery', playerId, requestId, eventName)

    return formatSuccess({
        request_id = requestId,
        status = 'pending',
        event_name = eventName,
        player_id = playerId,
        args = args,
    }, 'Client event dispatched with ack tracking')
end

RegisterNetEvent('mcp-bridge:asyncResult', function(requestId, success, data, message)
    setPendingResult(requestId, success, data, message)
end)

CreateThread(function()
    while true do
        Wait(60000)
        local now = os.time()
        for requestId, entry in pairs(pendingRequests) do
            if entry.createdAt and (now - entry.createdAt) > 120 then
                pendingRequests[requestId] = nil
            end
        end
    end
end)

-- RegisterCommand callbacks resolve globals via _G, not the shared loader env.
_G.formatSuccess = formatSuccess
_G.formatError = formatError
_G.mcpLog = mcpLog
_G.decodeJsonSafe = decodeJsonSafe
_G.isMcpBridgeEnabled = isMcpBridgeEnabled
_G.isPlayerControlAllowed = isPlayerControlAllowed
_G.assertBridgeOperationAllowed = assertBridgeOperationAllowed
_G.isCommandAllowed = isCommandAllowed
_G.isEventAllowed = isEventAllowed
_G.auditMcpOperation = auditMcpOperation
_G.unpackEventArgs = unpackEventArgs
_G.buildPlayerInfo = buildPlayerInfo
_G.createPendingRequest = createPendingRequest
_G.setPendingResult = setPendingResult
_G.pollPendingRequest = pollPendingRequest
_G.dispatchClientCommand = dispatchClientCommand
_G.dispatchClientEventAck = dispatchClientEventAck
_G.isPlayerOnline = isPlayerOnline
_G.getPlayerIdentifier = getPlayerIdentifier