-- MCP Bridge - Server-side player control (RCON dispatch + poll; no Wait in RCON)

local rateLimitBuckets = {}
local pendingPlayerControl = {}

local VALID_ACTIONS = {
    get_state = true,
    teleport = true,
    freeze = true,
    unfreeze = true,
    input_pulse = true,
    input_sequence = true,
    input_tap = true,
    screenshot = true,
    set_health = true,
    set_armor = true,
    give_weapon = true,
    set_heading = true,
    spawn_vehicle = true,
    enter_vehicle = true,
    repair_vehicle = true,
    look_at = true,
}

local function decodeBase64(data)
    local b = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/'
    data = string.gsub(data, '[^' .. b .. '=]', '')

    return (data:gsub('.', function(x)
        if x == '=' then
            return ''
        end
        local r, f = '', (b:find(x, 1, true) - 1)
        for i = 6, 1, -1 do
            r = r .. (((f % (2 ^ i)) - (f % (2 ^ (i - 1))) > 0) and '1' or '0')
        end
        return r
    end):gsub('%d%d%d?%d?%d?%d?%d?%d?', function(x)
        if #x ~= 8 then
            return ''
        end
        local c = 0
        for i = 1, 8 do
            c = c + ((x:sub(i, i) == '1') and (2 ^ (8 - i)) or 0)
        end
        return string.char(c)
    end))
end

local function ensureRateLimit(playerId)
    local now = GetGameTimer()
    local bucket = rateLimitBuckets[playerId]

    if not bucket or (now - bucket.windowStart) > 1000 then
        rateLimitBuckets[playerId] = {
            windowStart = now,
            count = 1,
        }
        return true
    end

    if bucket.count >= 5 then
        return false
    end

    bucket.count = bucket.count + 1
    return true
end

RegisterNetEvent('mcp-bridge:playerControlResult', function(requestId, success, data, message)
    local entry = pendingPlayerControl[requestId]
    if not entry or entry.state ~= 'pending' then
        return
    end

    entry.state = 'done'
    entry.success = success
    entry.data = data or {}
    entry.message = message or ''
end)

local function saveScreenshot(playerId, base64Data)
    if not base64Data or base64Data == '' then
        return nil, 'Screenshot data was empty'
    end

    local binaryData = decodeBase64(base64Data)
    if not binaryData or #binaryData == 0 then
        return nil, 'Failed to decode screenshot data'
    end

    local filename = string.format('%d_%d.jpg', playerId, os.time())
    local relativePath = 'screenshots/' .. filename
    local saved = SaveResourceFile(GetCurrentResourceName(), relativePath, binaryData, #binaryData)

    if not saved then
        return nil, 'Failed to save screenshot file'
    end

    local resourcePath = GetResourcePath(GetCurrentResourceName())
    local absolutePath = resourcePath .. '/' .. relativePath

    return absolutePath, nil
end

local function isFiniteNumber(value)
    return type(value) == 'number' and value == value and value ~= math.huge and value ~= -math.huge
end

local function hasValidCoordsPayload(coords)
    return type(coords) == 'table'
        and isFiniteNumber(coords.x)
        and isFiniteNumber(coords.y)
        and isFiniteNumber(coords.z)
end

local function finalizePlayerControl(playerId, action, response)
    local data = response.data or {}
    local message = response.message or 'Player control action completed'

    if not response.success then
        return formatError(message, data)
    end

    if (action == 'teleport' or action == 'get_state') and not hasValidCoordsPayload(data.coords) then
        return formatError('Player control returned invalid coordinates', {
            player_id = playerId,
            action = action,
            coords = data.coords,
        })
    end

    if action == 'screenshot' and data.image_data then
        local filePath, saveError = saveScreenshot(playerId, data.image_data)
        data.image_data = nil

        if filePath then
            data.file_path = filePath
            data.filename = filePath:match('([^/\\]+)$')
        else
            return formatError(saveError or 'Failed to save screenshot', data)
        end
    end

    return formatSuccess(data, message)
end

function executePlayerControlDispatch(playerId, action, argsJson)
    if not isPlayerControlAllowed() then
        return formatError('Player control is disabled. Set mcp_bridge_enabled=1 and mcp_bridge_allow_player_control=1 in dev-local.cfg')
    end

    playerId = tonumber(playerId)
    if not playerId then
        return formatError('Player ID is required')
    end

    if not VALID_ACTIONS[action] then
        return formatError('Invalid player control action', { action = action })
    end

    if not isPlayerOnline(playerId) then
        return formatError('Player is not online', { player_id = playerId })
    end

    if not ensureRateLimit(playerId) then
        return formatError('Rate limit exceeded for player control', { player_id = playerId })
    end

    local args = {}
    if argsJson and argsJson ~= '' then
        args = decodeJsonSafe(argsJson) or {}
    end

    local requestId = ('%d_%s_%d'):format(playerId, action, GetGameTimer())

    pendingPlayerControl[requestId] = {
        state = 'pending',
        playerId = playerId,
        action = action,
        createdAt = os.time(),
    }

    auditMcpOperation('player_control_dispatch', {
        player_id = playerId,
        action = action,
        request_id = requestId,
    })

    TriggerClientEvent('mcp-bridge:playerControl', playerId, requestId, action, args)

    return formatSuccess({
        request_id = requestId,
        status = 'pending',
        player_id = playerId,
        action = action,
    }, 'Player control dispatched')
end

function executePlayerControlPoll(requestId)
    if not requestId or requestId == '' then
        return formatError('Request ID is required')
    end

    local entry = pendingPlayerControl[requestId]
    if not entry then
        return formatError('Unknown or expired player control request', { request_id = requestId })
    end

    if entry.state == 'pending' then
        return formatSuccess({
            request_id = requestId,
            status = 'pending',
            player_id = entry.playerId,
            action = entry.action,
        }, 'Player control pending')
    end

    pendingPlayerControl[requestId] = nil

    return finalizePlayerControl(entry.playerId, entry.action, {
        success = entry.success,
        data = entry.data,
        message = entry.message,
    })
end

RegisterCommand('mcp_player_control', function(source, args, rawCommand)
    if source ~= 0 then
        return
    end

    local playerId = tonumber(args[1])
    local action = args[2]

    if not playerId then
        print(formatError('Player ID is required'))
        return
    end

    if not action then
        print(formatError('Action is required'))
        return
    end

    local jsonArgs = ''
    if args[3] then
        jsonArgs = table.concat(args, ' ', 3)
    end

    print(executePlayerControlDispatch(playerId, action, jsonArgs))
end, true)

RegisterCommand('mcp_player_control_poll', function(source, args, rawCommand)
    if source ~= 0 then
        return
    end

    print(executePlayerControlPoll(args[1]))
end, true)

CreateThread(function()
    while true do
        Wait(60000)
        local now = os.time()
        for requestId, entry in pairs(pendingPlayerControl) do
            if entry.createdAt and (now - entry.createdAt) > 120 then
                pendingPlayerControl[requestId] = nil
            end
        end
    end
end)

-- Legacy export name used by other bridge code paths
function executePlayerControl(playerId, action, argsJson)
    return executePlayerControlDispatch(playerId, action, argsJson)
end

_G.executePlayerControlDispatch = executePlayerControlDispatch
_G.executePlayerControlPoll = executePlayerControlPoll
