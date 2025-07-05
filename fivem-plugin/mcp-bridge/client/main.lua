-- MCP Bridge Client - Client-side Command Execution
-- Handles client-side commands sent from the server

local resourceName = GetCurrentResourceName()

-- Client initialization
Citizen.CreateThread(function()
    print(string.format('[%s] MCP Bridge Client started', resourceName))
end)

-- Handle client-side command execution
RegisterNetEvent('mcp:executeClientCommand')
AddEventHandler('mcp:executeClientCommand', function(command, args)
    if not command then
        print('[MCP Bridge] Error: No command provided')
        return
    end
    
    print(string.format('[MCP Bridge] Executing client command: %s', command))
    
    -- Parse arguments if provided
    local cmdArgs = {}
    if args then
        if type(args) == 'string' then
            -- Split string arguments by spaces
            for arg in args:gmatch("%S+") do
                table.insert(cmdArgs, arg)
            end
        elseif type(args) == 'table' then
            cmdArgs = args
        end
    end
    
    -- Execute the command with proper error handling
    local success = pcall(function()
        if #cmdArgs > 0 then
            ExecuteCommand(command .. ' ' .. table.concat(cmdArgs, ' '))
        else
            ExecuteCommand(command)
        end
    end)
    
    if success then
        print(string.format('[MCP Bridge] Successfully executed client command: %s', command))
        -- Send confirmation back to server
        TriggerServerEvent('mcp:clientCommandExecuted', command, true)
    else
        print(string.format('[MCP Bridge] Failed to execute client command: %s', command))
        -- Send error back to server
        TriggerServerEvent('mcp:clientCommandExecuted', command, false)
    end
end)

-- Handle specific client commands that need special treatment
RegisterNetEvent('mcp:executeSpecificClientCommand')
AddEventHandler('mcp:executeSpecificClientCommand', function(commandType, params)
    local playerId = GetPlayerServerId(PlayerId())
    
    local success = false
    local message = ''
    
    if commandType == 'me' then
        -- Execute /me command
        if params and params.message then
            ExecuteCommand('me ' .. params.message)
            success = true
            message = 'Me command executed'
        else
            message = 'No message provided for me command'
        end
    elseif commandType == 'do' then
        -- Execute /do command
        if params and params.message then
            ExecuteCommand('do ' .. params.message)
            success = true
            message = 'Do command executed'
        else
            message = 'No message provided for do command'
        end
    elseif commandType == 'ooc' then
        -- Execute /ooc command
        if params and params.message then
            ExecuteCommand('ooc ' .. params.message)
            success = true
            message = 'OOC command executed'
        else
            message = 'No message provided for ooc command'
        end
    elseif commandType == 'dv' then
        -- Delete nearby vehicles
        ExecuteCommand('dv')
        success = true
        message = 'Nearby vehicles deleted'
    elseif commandType == 'dvall' then
        -- Delete all vehicles
        ExecuteCommand('dvall')
        success = true
        message = 'All vehicles deleted'
    elseif commandType == 'fix' then
        -- Fix current vehicle
        ExecuteCommand('fix')
        success = true
        message = 'Vehicle fixed'
    elseif commandType == 'engine' then
        -- Toggle engine
        ExecuteCommand('engine')
        success = true
        message = 'Engine toggled'
    else
        message = 'Unknown client command type: ' .. tostring(commandType)
    end
    
    -- Send result back to server
    TriggerServerEvent('mcp:specificClientCommandExecuted', playerId, commandType, success, message)
end)

-- Handle custom chat commands
RegisterNetEvent('mcp:executeChatCommand')
AddEventHandler('mcp:executeChatCommand', function(command, message)
    if not command or not message then
        print('[MCP Bridge] Error: Missing command or message')
        return
    end
    
    local success = pcall(function()
        ExecuteCommand(command .. ' ' .. message)
    end)
    
    if success then
        print(string.format('[MCP Bridge] Chat command executed: %s %s', command, message))
    else
        print(string.format('[MCP Bridge] Failed to execute chat command: %s', command))
    end
end)

-- Debug function to list available commands
RegisterNetEvent('mcp:listClientCommands')
AddEventHandler('mcp:listClientCommands', function()
    print('[MCP Bridge] Available client commands:')
    print('- me <message>: Display character action')
    print('- do <message>: Display environment description')
    print('- ooc <message>: Out of character chat')
    print('- dv: Delete nearby vehicles')
    print('- dvall: Delete all vehicles')
    print('- fix: Fix current vehicle')
    print('- engine: Toggle engine')
end)

-- Test event handlers for client-side event verification
RegisterNetEvent('mcp_test:client_event')
AddEventHandler('mcp_test:client_event', function(...)
    local args = {...}
    local playerId = GetPlayerServerId(PlayerId())
    
    print(string.format('[MCP Bridge] Test client event received by player %d', playerId))
    print(string.format('[MCP Bridge] Arguments received: %s', json.encode(args)))
    
    -- Send confirmation back to server
    TriggerServerEvent('mcp_test:client_event_response', playerId, args)
end)

RegisterNetEvent('mcp_test:client_event_complex')
AddEventHandler('mcp_test:client_event_complex', function(messageData, actionType, playerInfo)
    local playerId = GetPlayerServerId(PlayerId())
    
    print(string.format('[MCP Bridge] Complex test client event received by player %d', playerId))
    print(string.format('[MCP Bridge] MessageData: %s', json.encode(messageData)))
    print(string.format('[MCP Bridge] ActionType: %s', tostring(actionType)))
    print(string.format('[MCP Bridge] PlayerInfo: %s', json.encode(playerInfo)))
    
    -- Send confirmation back to server
    TriggerServerEvent('mcp_test:client_event_complex_response', playerId, messageData, actionType, playerInfo)
end)

RegisterNetEvent('mcp_test:client_event_simple')
AddEventHandler('mcp_test:client_event_simple', function()
    local playerId = GetPlayerServerId(PlayerId())
    
    print(string.format('[MCP Bridge] Simple test client event received by player %d (no args)', playerId))
    
    -- Send confirmation back to server
    TriggerServerEvent('mcp_test:client_event_simple_response', playerId)
end) 