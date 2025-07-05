-- MCP Bridge - RCON Custom Commands
-- These commands can be called via RCON from the MCP Server

-- Command: mcp_execute <command>
-- Execute a FiveM console command
RegisterCommand('mcp_execute', function(source, args, rawCommand)
    if source ~= 0 then -- Only allow from console/RCON
        return
    end
    
    local command = table.concat(args, ' ')
    if not command or command == '' then
        print(formatError('Command is required'))
        return
    end
    
    mcpLog('info', 'Executing command via RCON', { command = command })
    
    -- Check if command exists by attempting to validate it first
    local commandPart = string.match(command, "^(%S+)")
    local commandExists = false
    
    -- Check against known FiveM commands
    local knownCommands = {
        'version', 'refresh', 'start', 'stop', 'restart', 'ensure', 
        'quit', 'exec', 'set', 'sets', 'setr', 'sv_maxclients',
        'rcon_password', 'endpoint_add_tcp', 'endpoint_add_udp',
        'load_server_icon', 'sv_hostname', 'sv_projectname',
        'sv_projectdesc', 'sv_tags', 'sv_master1', 'gamemode',
        'mapname', 'onesync', 'steam_webApiKey', 'sv_licensekey'
    }
    
    for _, knownCmd in ipairs(knownCommands) do
        if commandPart == knownCmd then
            commandExists = true
            break
        end
    end
    
    -- Also check if it's a resource-related command
    if string.match(commandPart, "^(start|stop|restart|ensure)$") then
        commandExists = true
    end
    
    local success, result = pcall(function()
        ExecuteCommand(command)
        return true
    end)
    
    if success then
        -- For unknown commands, we assume they might still be valid
        -- The actual command execution will determine success
        if not commandExists and not string.match(command, "^(start|stop|restart|ensure)%s+%S+") then
            mcpLog('warn', 'Executed potentially unknown command', { command = command })
        end
        print(formatSuccess({ command = command }, 'Command executed successfully'))
    else
        print(formatError('Failed to execute command', { command = command, error = tostring(result) }))
    end
end, true) -- Restricted to console

-- Command: mcp_event_server <event_name> [json_args]
-- Trigger a server-side event
RegisterCommand('mcp_event_server', function(source, args, rawCommand)
    if source ~= 0 then -- Only allow from console/RCON
        return
    end
    
    local eventName = args[1]
    if not eventName then
        print(formatError('Event name is required'))
        return
    end
    
    local eventArgs = {}
    if args[2] then
        -- Reconstruct the JSON string from all remaining arguments
        local jsonString = table.concat(args, ' ', 2)
        
        -- Debug: Log the raw JSON string for server event
        mcpLog('debug', 'Server event raw JSON string', { raw_json = jsonString })
        
        eventArgs = decodeJsonSafe(jsonString)
        if not eventArgs then
            mcpLog('warn', 'Failed to decode server event JSON arguments, using empty args', { raw_json = jsonString })
            eventArgs = {}
        else
            mcpLog('debug', 'Successfully decoded server event JSON arguments', { decoded_args = eventArgs })
        end
    end
    
    mcpLog('info', 'Triggering server event via RCON', { 
        event = eventName, 
        args = eventArgs 
    })
    
    local success = pcall(function()
        if #eventArgs > 0 then
            TriggerEvent(eventName, table.unpack(eventArgs))
        else
            TriggerEvent(eventName)
        end
    end)
    
    if success then
        print(formatSuccess({ 
            event_name = eventName, 
            args = eventArgs 
        }, 'Server event triggered successfully'))
    else
        print(formatError('Failed to trigger server event', { event = eventName }))
    end
end, true) -- Restricted to console

-- Command: mcp_event_client <player_id> <event_name> [json_args]
-- Trigger a client-side event
RegisterCommand('mcp_event_client', function(source, args, rawCommand)
    if source ~= 0 then -- Only allow from console/RCON
        return
    end
    
    local playerId = tonumber(args[1])
    local eventName = args[2]
    
    if not playerId then
        print(formatError('Player ID is required'))
        return
    end
    
    if not eventName then
        print(formatError('Event name is required'))
        return
    end
    
    if not isPlayerOnline(playerId) then
        print(formatError('Player is not online', { player_id = playerId }))
        return
    end
    
    local eventArgs = {}
    if args[3] then
        -- Reconstruct the JSON string from all remaining arguments
        local jsonString = table.concat(args, ' ', 3)
        
        -- Debug: Log the raw JSON string
        mcpLog('debug', 'Raw JSON string content', { raw_json = jsonString })
        
        eventArgs = decodeJsonSafe(jsonString)
        if not eventArgs then
            mcpLog('warn', 'Failed to decode JSON arguments, using empty args', { raw_json = jsonString })
            eventArgs = {}
        else
            mcpLog('debug', 'Successfully decoded JSON arguments', { decoded_args = eventArgs })
        end
    end
    
    mcpLog('info', 'Triggering client event via RCON', { 
        event = eventName, 
        player_id = playerId,
        args = eventArgs 
    })
    
    local success = pcall(function()
        if #eventArgs > 0 then
            TriggerClientEvent(eventName, playerId, table.unpack(eventArgs))
        else
            TriggerClientEvent(eventName, playerId)
        end
    end)
    
    if success then
        print(formatSuccess({ 
            event_name = eventName, 
            player_id = playerId,
            args = eventArgs 
        }, 'Client event triggered successfully'))
    else
        print(formatError('Failed to trigger client event', { 
            event = eventName, 
            player_id = playerId 
        }))
    end
end, true) -- Restricted to console

-- Command: mcp_client_command <player_id> <command>
-- Execute a command on a specific client
RegisterCommand('mcp_client_command', function(source, args, rawCommand)
    if source ~= 0 then -- Only allow from console/RCON
        return
    end
    
    local playerId = tonumber(args[1])
    if not playerId then
        print(formatError('Player ID is required'))
        return
    end
    
    if not isPlayerOnline(playerId) then
        print(formatError('Player is not online', { player_id = playerId }))
        return
    end
    
    local command = table.concat(args, ' ', 2)
    if not command or command == '' then
        print(formatError('Command is required'))
        return
    end
    
    mcpLog('info', 'Executing client command via RCON', { 
        player_id = playerId, 
        command = command 
    })
    
    -- Trigger client-side command execution
    TriggerClientEvent('mcp:executeClientCommand', playerId, command)
    
    print(formatSuccess({ 
        player_id = playerId, 
        command = command 
    }, 'Client command sent successfully'))
end, true) -- Restricted to console

-- Command: mcp_client_command_all <command>
-- Execute a command on all connected clients
RegisterCommand('mcp_client_command_all', function(source, args, rawCommand)
    if source ~= 0 then -- Only allow from console/RCON
        return
    end
    
    local command = table.concat(args, ' ')
    if not command or command == '' then
        print(formatError('Command is required'))
        return
    end
    
    local players = GetPlayers()
    local onlineCount = 0
    
    for _, playerId in ipairs(players) do
        local id = tonumber(playerId)
        if isPlayerOnline(id) then
            onlineCount = onlineCount + 1
            TriggerClientEvent('mcp:executeClientCommand', id, command)
        end
    end
    
    mcpLog('info', 'Executing client command on all players via RCON', { 
        command = command,
        players_count = onlineCount
    })
    
    print(formatSuccess({ 
        command = command,
        players_affected = onlineCount 
    }, 'Client command sent to all players successfully'))
end, true) -- Restricted to console

-- Command: mcp_players
-- Get list of online players
RegisterCommand('mcp_players', function(source, args, rawCommand)
    if source ~= 0 then -- Only allow from console/RCON
        return
    end
    
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
    
    mcpLog('info', 'Retrieved players via RCON', { count = #playerList })
    
    print(formatSuccess({
        players = playerList,
        count = #playerList
    }, string.format('Retrieved %d online players', #playerList)))
end, true) -- Restricted to console

-- Command: mcp_player_info <player_id>
-- Get detailed information about a specific player
RegisterCommand('mcp_player_info', function(source, args, rawCommand)
    if source ~= 0 then -- Only allow from console/RCON
        return
    end
    
    local playerId = tonumber(args[1])
    
    if not playerId then
        print(formatError('Player ID is required'))
        return
    end
    
    if not isPlayerOnline(playerId) then
        print(formatError('Player is not online', { player_id = playerId }))
        return
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
    
    mcpLog('info', 'Retrieved player info via RCON', { 
        player_id = playerId,
        player_name = playerInfo.name
    })
    
    print(formatSuccess(playerInfo, 'Player information retrieved'))
end, true) -- Restricted to console

-- Command: mcp_health
-- Health check for the plugin
RegisterCommand('mcp_health', function(source, args, rawCommand)
    if source ~= 0 then -- Only allow from console/RCON
        return
    end
    
    local healthInfo = {
        status = 'healthy',
        uptime = GetGameTimer(),
        players_online = #GetPlayers(),
        resource_name = GetCurrentResourceName(),
        version = '2.0.0',
        method = 'RCON Commands'
    }
    
    print(formatSuccess(healthInfo, 'MCP Bridge is running'))
end, true) -- Restricted to console

-- Command: mcp_client_execute <player_id> <command> [args]
-- Execute a client-side command on a specific player's client
RegisterCommand('mcp_client_execute', function(source, args, rawCommand)
    if source ~= 0 then -- Only allow from console/RCON
        return
    end
    
    local playerId = tonumber(args[1])
    local command = args[2]
    
    if not playerId then
        print(formatError('Player ID is required'))
        return
    end
    
    if not command then
        print(formatError('Command is required'))
        return
    end
    
    if not isPlayerOnline(playerId) then
        print(formatError('Player is not online', { player_id = playerId }))
        return
    end
    
    -- Get additional arguments if provided
    local cmdArgs = {}
    for i = 3, #args do
        table.insert(cmdArgs, args[i])
    end
    
    mcpLog('info', 'Executing client command via RCON', { 
        player_id = playerId,
        command = command,
        args = cmdArgs
    })
    
    local success = pcall(function()
        TriggerClientEvent('mcp:executeClientCommand', playerId, command, cmdArgs)
    end)
    
    if success then
        print(formatSuccess({ 
            player_id = playerId,
            command = command,
            args = cmdArgs
        }, 'Client command sent successfully'))
    else
        print(formatError('Failed to send client command', { 
            player_id = playerId,
            command = command 
        }))
    end
end, true) -- Restricted to console

-- Command: mcp_client_command <player_id> <command_type> [message]
-- Execute specific client-side commands (me, do, ooc, dv, dvall, fix, engine)
RegisterCommand('mcp_client_command', function(source, args, rawCommand)
    if source ~= 0 then -- Only allow from console/RCON
        return
    end
    
    local playerId = tonumber(args[1])
    local commandType = args[2]
    
    if not playerId then
        print(formatError('Player ID is required'))
        return
    end
    
    if not commandType then
        print(formatError('Command type is required'))
        return
    end
    
    if not isPlayerOnline(playerId) then
        print(formatError('Player is not online', { player_id = playerId }))
        return
    end
    
    -- Valid command types
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
        print(formatError('Invalid command type', { 
            command_type = commandType,
            valid_commands = validCommands
        }))
        return
    end
    
    -- Prepare parameters
    local params = {}
    
    -- Commands that need a message
    if commandType == 'me' or commandType == 'do' or commandType == 'ooc' then
        local message = ''
        for i = 3, #args do
            if i > 3 then
                message = message .. ' '
            end
            message = message .. args[i]
        end
        
        if message == '' then
            print(formatError('Message is required for ' .. commandType .. ' command'))
            return
        end
        
        params.message = message
    end
    
    mcpLog('info', 'Executing specific client command via RCON', { 
        player_id = playerId,
        command_type = commandType,
        params = params
    })
    
    local success = pcall(function()
        TriggerClientEvent('mcp:executeSpecificClientCommand', playerId, commandType, params)
    end)
    
    if success then
        print(formatSuccess({ 
            player_id = playerId,
            command_type = commandType,
            params = params
        }, 'Specific client command sent successfully'))
    else
        print(formatError('Failed to send specific client command', { 
            player_id = playerId,
            command_type = commandType 
        }))
    end
end, true) -- Restricted to console

-- Event handlers for client command feedback
RegisterServerEvent('mcp:clientCommandExecuted')
AddEventHandler('mcp:clientCommandExecuted', function(command, success)
    local playerId = source
    
    mcpLog('info', 'Client command execution result', {
        player_id = playerId,
        command = command,
        success = success
    })
end)

RegisterServerEvent('mcp:specificClientCommandExecuted')
AddEventHandler('mcp:specificClientCommandExecuted', function(playerId, commandType, success, message)
    mcpLog('info', 'Specific client command execution result', {
        player_id = playerId,
        command_type = commandType,
        success = success,
        message = message
    })
end) 