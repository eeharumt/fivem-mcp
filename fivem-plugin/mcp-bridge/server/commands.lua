-- MCP Bridge - RCON Custom Commands
-- These commands can be called via RCON from the MCP Server

-- Command: mcp_execute <command>
-- Execute a FiveM console command
RegisterCommand('mcp_execute', function(source, args, rawCommand)
    if source ~= 0 then
        return
    end

    local allowed, errMessage = assertBridgeOperationAllowed('execute')
    if not allowed then
        print(errMessage)
        return
    end
    
    local command = table.concat(args, ' ')
    if not command or command == '' then
        print(formatError('Command is required'))
        return
    end

    local cmdAllowed, cmdErr = isCommandAllowed(command)
    if not cmdAllowed then
        print(formatError(cmdErr or 'Command is not allowed', { command = command }))
        return
    end
    
    auditMcpOperation('execute_command', { command = command })
    
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
    if source ~= 0 then
        return
    end

    local allowed, errMessage = assertBridgeOperationAllowed('event_server')
    if not allowed then
        print(errMessage)
        return
    end
    
    local eventName = args[1]
    if not eventName then
        print(formatError('Event name is required'))
        return
    end

    local eventAllowed, eventErr = isEventAllowed(eventName)
    if not eventAllowed then
        print(formatError(eventErr or 'Event is not allowed', { event_name = eventName }))
        return
    end
    
    local eventArgs = {}
    if args[2] then
        local jsonString = table.concat(args, ' ', 2)
        eventArgs = unpackEventArgs(decodeJsonSafe(jsonString))
    end
    
    auditMcpOperation('event_server', { event = eventName, args = eventArgs })
    
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
    if source ~= 0 then
        return
    end

    local allowed, errMessage = assertBridgeOperationAllowed('event_client')
    if not allowed then
        print(errMessage)
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

    local eventAllowed, eventErr = isEventAllowed(eventName)
    if not eventAllowed then
        print(formatError(eventErr or 'Event is not allowed', { event_name = eventName }))
        return
    end
    
    if not isPlayerOnline(playerId) then
        print(formatError('Player is not online', { player_id = playerId }))
        return
    end
    
    local eventArgs = {}
    if args[3] then
        local jsonString = table.concat(args, ' ', 3)
        eventArgs = unpackEventArgs(decodeJsonSafe(jsonString))
    end
    
    auditMcpOperation('event_client', {
        event = eventName,
        player_id = playerId,
        args = eventArgs,
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

-- mcp_client_command, mcp_client_command_all, mcp_event_client_ack, mcp_async_poll
-- are registered in server/client_command.lua

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
    
    local playerInfo = buildPlayerInfo(playerId, shouldIncludePlayerTokens())
    
    auditMcpOperation('player_info', {
        player_id = playerId,
        player_name = playerInfo.name,
        include_tokens = shouldIncludePlayerTokens(),
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
        version = '2.2.0',
        method = 'RCON Commands',
        bridge_enabled = isMcpBridgeEnabled(),
        player_control_allowed = isPlayerControlAllowed(),
    }
    
    print(formatSuccess(healthInfo, 'MCP Bridge is running'))
end, true) -- Restricted to console

-- mcp_client_execute and async client commands are registered in server/register_async_commands.lua

-- Legacy feedback handlers retained for older clients
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

-- mcp_player_control is registered in server/player_control.lua

local function wireAsyncClientCommandHandlers()
    local dispatchFn = dispatchClientCommand
    local dispatchEventAckFn = dispatchClientEventAck
    local pollFn = pollPendingRequest

    if type(dispatchFn) ~= 'function' then
        error('dispatchClientCommand is unavailable while wiring async RCON handlers')
    end

    RegisterCommand('mcp_client_execute', function(source, args, rawCommand)
        if source ~= 0 then
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

        local cmdArgs = {}
        for i = 3, #args do
            table.insert(cmdArgs, args[i])
        end

        print(dispatchFn(playerId, command, nil, nil, cmdArgs))
    end, true)

    RegisterCommand('mcp_client_command', function(source, args, rawCommand)
        if source ~= 0 then
            return
        end

        local playerId = tonumber(args[1])
        if not playerId then
            print(formatError('Player ID is required'))
            return
        end

        local command = table.concat(args, ' ', 2)
        if not command or command == '' then
            print(formatError('Command is required'))
            return
        end

        local commandType = string.match(command, '^(%S+)')
        local specialCommands = {
            me = true,
            ['do'] = true,
            ooc = true,
            dv = true,
            dvall = true,
            fix = true,
            engine = true,
        }

        if specialCommands[commandType] then
            local params = {}
            if commandType == 'me' or commandType == 'do' or commandType == 'ooc' then
                local message = string.match(command, '^%S+%s+(.+)')
                if message then
                    params.message = message
                end
            end

            print(dispatchFn(playerId, command, commandType, params))
            return
        end

        print(dispatchFn(playerId, command, nil, nil))
    end, true)

    RegisterCommand('mcp_client_command_all', function(source, args, rawCommand)
        if source ~= 0 then
            return
        end

        local allowed, errMessage = assertBridgeOperationAllowed('client_command_all')
        if not allowed then
            print(errMessage)
            return
        end

        local command = table.concat(args, ' ')
        if not command or command == '' then
            print(formatError('Command is required'))
            return
        end

        local cmdAllowed, cmdErr = isCommandAllowed(command)
        if not cmdAllowed then
            print(formatError(cmdErr or 'Command is not allowed', { command = command }))
            return
        end

        local players = GetPlayers()
        local dispatched = {}

        for _, playerId in ipairs(players) do
            local id = tonumber(playerId)
            if isPlayerOnline(id) then
                local responseJson = dispatchFn(id, command, nil, nil)
                table.insert(dispatched, { player_id = id, response = decodeJsonSafe(responseJson) })
            end
        end

        auditMcpOperation('client_command_all_dispatch', {
            command = command,
            players_count = #dispatched,
        })

        print(formatSuccess({
            command = command,
            players_affected = #dispatched,
            dispatched = dispatched,
        }, 'Client command dispatched to all players'))
    end, true)

    RegisterCommand('mcp_event_client_ack', function(source, args, rawCommand)
        if source ~= 0 then
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

        local eventArgs = nil
        if args[3] then
            eventArgs = decodeJsonSafe(table.concat(args, ' ', 3))
        end

        print(dispatchEventAckFn(playerId, eventName, eventArgs))
    end, true)

    RegisterCommand('mcp_async_poll', function(source, args, rawCommand)
        if source ~= 0 then
            return
        end

        print(pollFn(args[1]))
    end, true)
end

wireAsyncClientCommandHandlers()