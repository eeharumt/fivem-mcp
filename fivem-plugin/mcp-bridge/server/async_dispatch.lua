-- MCP Bridge - Shared async dispatch/poll helpers for RCON operations

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
_G.createPendingRequest = createPendingRequest

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

function getPendingRequest(requestId)
    return pendingRequests[requestId]
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
_G.pollPendingRequest = pollPendingRequest
_G.setPendingResult = setPendingResult
_G.clearPendingRequest = clearPendingRequest

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
