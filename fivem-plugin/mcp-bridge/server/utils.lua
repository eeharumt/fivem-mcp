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