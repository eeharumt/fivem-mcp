-- MCP Bridge Plugin - RCON Command Bridge
-- Provides custom RCON commands for MCP Server communication

local resourceName = GetCurrentResourceName()

-- Initialize the plugin
Citizen.CreateThread(function()
    mcpLog('info', 'MCP Bridge Plugin (RCON) starting...', {
        resource = resourceName,
        version = '2.0.0',
        method = 'RCON Commands'
    })
    
    -- Wait for server to be ready
    while GetGameTimer() < 3000 do
        Citizen.Wait(100)
    end
    
    mcpLog('info', 'MCP Bridge Plugin started successfully')
    mcpLog('info', 'Available commands: mcp_execute, mcp_event_server, mcp_event_client, mcp_players, mcp_player_info, mcp_client_command, mcp_client_command_all')
end)

-- Resource stop handler
AddEventHandler('onResourceStop', function(resource)
    if resource == resourceName then
        mcpLog('info', 'MCP Bridge Plugin stopping...')
    end
end)

-- Export functions for other resources
exports('executeCommand', function(command)
    mcpLog('info', 'Executing command via export', { command = command })
    
    local success = pcall(function()
        ExecuteCommand(command)
    end)
    
    if success then
        return formatSuccess({ command = command }, 'Command executed successfully')
    else
        return formatError('Failed to execute command', { command = command })
    end
end)

exports('triggerServerEvent', function(eventName, args)
    mcpLog('info', 'Triggering server event via export', { event = eventName })
    
    local success = pcall(function()
        if args and type(args) == 'table' then
            TriggerEvent(eventName, table.unpack(args))
        else
            TriggerEvent(eventName)
        end
    end)
    
    if success then
        return formatSuccess({ event_name = eventName }, 'Server event triggered successfully')
    else
        return formatError('Failed to trigger server event', { event = eventName })
    end
end)

exports('triggerClientEvent', function(eventName, playerId, args)
    mcpLog('info', 'Triggering client event via export', { 
        event = eventName, 
        player_id = playerId 
    })
    
    if not isPlayerOnline(playerId) then
        return formatError('Player is not online', { player_id = playerId })
    end
    
    local success = pcall(function()
        if args and type(args) == 'table' then
            TriggerClientEvent(eventName, playerId, table.unpack(args))
        else
            TriggerClientEvent(eventName, playerId)
        end
    end)
    
    if success then
        return formatSuccess({ 
            event_name = eventName, 
            player_id = playerId 
        }, 'Client event triggered successfully')
    else
        return formatError('Failed to trigger client event', { 
            event = eventName, 
            player_id = playerId 
        })
    end
end)

exports('getPlayersInfo', function()
    local players = GetPlayers()
    local playerList = {}
    
    for _, playerId in ipairs(players) do
        local id = tonumber(playerId)
        if isPlayerOnline(id) then
            table.insert(playerList, {
                id = id,
                name = GetPlayerName(id),
                ping = GetPlayerPing(id),
                endpoint = GetPlayerEndpoint(id),
                identifier = getPlayerIdentifier(id)
            })
        end
    end
    
    mcpLog('info', 'Retrieved players info via export', { count = #playerList })
    
    return formatSuccess({
        players = playerList,
        count = #playerList
    }, string.format('Retrieved %d online players', #playerList))
end)

exports('getPlayerInfo', function(playerId)
    playerId = tonumber(playerId)
    
    if not playerId or not isPlayerOnline(playerId) then
        return formatError('Player is not online', { player_id = playerId })
    end
    
    local playerInfo = {
        id = playerId,
        name = GetPlayerName(playerId),
        ping = GetPlayerPing(playerId),
        endpoint = GetPlayerEndpoint(playerId),
        identifiers = GetPlayerIdentifiers(playerId),
        tokens = GetPlayerTokens(playerId),
        last_msg = GetPlayerLastMsg(playerId)
    }
    
    mcpLog('info', 'Retrieved player info via export', { 
        player_id = playerId,
        player_name = playerInfo.name
    })
    
    return formatSuccess(playerInfo, 'Player information retrieved')
end)

-- Export function to execute client-side commands
exports('executeClientCommand', function(playerId, command, args)
    playerId = tonumber(playerId)
    
    if not playerId or not isPlayerOnline(playerId) then
        return formatError('Player is not online', { player_id = playerId })
    end
    
    if not command then
        return formatError('Command is required')
    end
    
    mcpLog('info', 'Executing client command via export', { 
        player_id = playerId,
        command = command,
        args = args
    })
    
    local success = pcall(function()
        TriggerClientEvent('mcp:executeClientCommand', playerId, command, args)
    end)
    
    if success then
        return formatSuccess({ 
            player_id = playerId,
            command = command,
            args = args
        }, 'Client command sent successfully')
    else
        return formatError('Failed to send client command', { 
            player_id = playerId,
            command = command 
        })
    end
end)

-- Export function to execute specific client-side commands
exports('executeSpecificClientCommand', function(playerId, commandType, params)
    playerId = tonumber(playerId)
    
    if not playerId or not isPlayerOnline(playerId) then
        return formatError('Player is not online', { player_id = playerId })
    end
    
    if not commandType then
        return formatError('Command type is required')
    end
    
    local validCommands = {
        'me', 'do', 'ooc', 'dv', 'dvall', 'fix', 'engine'
    }
    
    local isValidCommand = false
    for _, cmd in ipairs(validCommands) do
        if cmd == commandType then
            isValidCommand = true
            break
        end
    end
    
    if not isValidCommand then
        return formatError('Invalid command type', { 
            command_type = commandType,
            valid_commands = validCommands
        })
    end
    
    mcpLog('info', 'Executing specific client command via export', { 
        player_id = playerId,
        command_type = commandType,
        params = params
    })
    
    local success = pcall(function()
        TriggerClientEvent('mcp:executeSpecificClientCommand', playerId, commandType, params)
    end)
    
    if success then
        return formatSuccess({ 
            player_id = playerId,
            command_type = commandType,
            params = params
        }, 'Specific client command sent successfully')
    else
        return formatError('Failed to send specific client command', { 
            player_id = playerId,
            command_type = commandType 
        })
    end
end)

-- Test event handlers for MCP event triggering verification
AddEventHandler('mcp_test:server_event', function(...)
    local args = {...}
    mcpLog('info', 'Test server event received', {
        args_count = #args,
        args = args
    })
    
    print(formatSuccess({
        event = 'mcp_test:server_event',
        args_received = args,
        args_count = #args
    }, 'Test server event handler executed successfully'))
end)

AddEventHandler('mcp_test:server_event_complex', function(playerData, actionType, metadata)
    mcpLog('info', 'Complex test server event received', {
        playerData = playerData,
        actionType = actionType,
        metadata = metadata
    })
    
    print(formatSuccess({
        event = 'mcp_test:server_event_complex',
        playerData = playerData,
        actionType = actionType,
        metadata = metadata
    }, 'Complex test server event handler executed successfully'))
end)

AddEventHandler('mcp_test:server_event_simple', function()
    mcpLog('info', 'Simple test server event received (no args)')
    
    print(formatSuccess({
        event = 'mcp_test:server_event_simple'
    }, 'Simple test server event handler executed successfully'))
end)

-- Server event handlers for client event responses
RegisterServerEvent('mcp_test:client_event_response')
AddEventHandler('mcp_test:client_event_response', function(playerId, args)
    mcpLog('info', 'Client event response received', {
        player_id = playerId,
        args = args
    })
    
    print(formatSuccess({
        event_response = 'mcp_test:client_event_response',
        player_id = playerId,
        args = args
    }, 'Client confirmed event was received and processed'))
end)

RegisterServerEvent('mcp_test:client_event_complex_response')
AddEventHandler('mcp_test:client_event_complex_response', function(playerId, messageData, actionType, playerInfo)
    mcpLog('info', 'Complex client event response received', {
        player_id = playerId,
        messageData = messageData,
        actionType = actionType,
        playerInfo = playerInfo
    })
    
    print(formatSuccess({
        event_response = 'mcp_test:client_event_complex_response',
        player_id = playerId,
        messageData = messageData,
        actionType = actionType,
        playerInfo = playerInfo
    }, 'Client confirmed complex event was received and processed'))
end)

RegisterServerEvent('mcp_test:client_event_simple_response')
AddEventHandler('mcp_test:client_event_simple_response', function(playerId)
    mcpLog('info', 'Simple client event response received', {
        player_id = playerId
    })
    
    print(formatSuccess({
        event_response = 'mcp_test:client_event_simple_response',
        player_id = playerId
    }, 'Client confirmed simple event was received and processed'))
end) 