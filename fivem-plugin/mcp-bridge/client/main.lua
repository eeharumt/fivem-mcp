-- MCP Bridge Client - Client-side Command Execution
-- Handles client-side commands sent from the server

local resourceName = GetCurrentResourceName()

local function reportClientCommandResult(requestId, command, success, message, extraData)
    if not requestId then
        return
    end

    local data = extraData or {}
    data.command = command

    TriggerServerEvent('mcp:clientCommandResult', requestId, success, data, message or '')
end

local function executeClientCommandInternal(command, args)
    local cmdArgs = {}
    if args then
        if type(args) == 'string' then
            for arg in args:gmatch('%S+') do
                table.insert(cmdArgs, arg)
            end
        elseif type(args) == 'table' then
            cmdArgs = args
        end
    end

    local success, err = pcall(function()
        if #cmdArgs > 0 then
            ExecuteCommand(command .. ' ' .. table.concat(cmdArgs, ' '))
        else
            ExecuteCommand(command)
        end
    end)

    return success, err and tostring(err) or nil
end

Citizen.CreateThread(function()
    print(string.format('[%s] MCP Bridge Client started', resourceName))
end)

RegisterNetEvent('mcp:executeClientCommandAsync')
AddEventHandler('mcp:executeClientCommandAsync', function(requestId, command, args)
    if not command then
        reportClientCommandResult(requestId, nil, false, 'No command provided')
        return
    end

    local success, err = executeClientCommandInternal(command, args)
    if success then
        reportClientCommandResult(requestId, command, true, 'Client command executed successfully')
    else
        reportClientCommandResult(requestId, command, false, err or 'Client command execution failed')
    end
end)

RegisterNetEvent('mcp:executeSpecificClientCommandAsync')
AddEventHandler('mcp:executeSpecificClientCommandAsync', function(requestId, commandType, params)
    local success = false
    local message = ''

    if commandType == 'me' then
        if params and params.message then
            ExecuteCommand('me ' .. params.message)
            success = true
            message = 'Me command executed'
        else
            message = 'No message provided for me command'
        end
    elseif commandType == 'do' then
        if params and params.message then
            ExecuteCommand('do ' .. params.message)
            success = true
            message = 'Do command executed'
        else
            message = 'No message provided for do command'
        end
    elseif commandType == 'ooc' then
        if params and params.message then
            ExecuteCommand('ooc ' .. params.message)
            success = true
            message = 'OOC command executed'
        else
            message = 'No message provided for ooc command'
        end
    elseif commandType == 'dv' then
        ExecuteCommand('dv')
        success = true
        message = 'Nearby vehicles deleted'
    elseif commandType == 'dvall' then
        ExecuteCommand('dvall')
        success = true
        message = 'All vehicles deleted'
    elseif commandType == 'fix' then
        ExecuteCommand('fix')
        success = true
        message = 'Vehicle fixed'
    elseif commandType == 'engine' then
        ExecuteCommand('engine')
        success = true
        message = 'Engine toggled'
    else
        message = 'Unknown client command type: ' .. tostring(commandType)
    end

    reportClientCommandResult(requestId, commandType, success, message, params or {})
end)

RegisterNetEvent('mcp-bridge:confirmEventDelivery')
AddEventHandler('mcp-bridge:confirmEventDelivery', function(requestId, eventName)
    TriggerServerEvent('mcp-bridge:asyncResult', requestId, true, {
        event_name = eventName,
        player_id = GetPlayerServerId(PlayerId()),
    }, 'Client received event trigger')
end)

-- Legacy fire-and-forget handlers kept for backward compatibility
RegisterNetEvent('mcp:executeClientCommand')
AddEventHandler('mcp:executeClientCommand', function(command, args)
    if not command then
        print('[MCP Bridge] Error: No command provided')
        return
    end

    local success = executeClientCommandInternal(command, args)
    if success then
        TriggerServerEvent('mcp:clientCommandExecuted', command, true)
    else
        TriggerServerEvent('mcp:clientCommandExecuted', command, false)
    end
end)

RegisterNetEvent('mcp:executeSpecificClientCommand')
AddEventHandler('mcp:executeSpecificClientCommand', function(commandType, params)
    local playerId = GetPlayerServerId(PlayerId())
    local success = false
    local message = ''

    if commandType == 'me' and params and params.message then
        ExecuteCommand('me ' .. params.message)
        success = true
        message = 'Me command executed'
    elseif commandType == 'do' and params and params.message then
        ExecuteCommand('do ' .. params.message)
        success = true
        message = 'Do command executed'
    elseif commandType == 'ooc' and params and params.message then
        ExecuteCommand('ooc ' .. params.message)
        success = true
        message = 'OOC command executed'
    elseif commandType == 'dv' then
        ExecuteCommand('dv')
        success = true
        message = 'Nearby vehicles deleted'
    elseif commandType == 'dvall' then
        ExecuteCommand('dvall')
        success = true
        message = 'All vehicles deleted'
    elseif commandType == 'fix' then
        ExecuteCommand('fix')
        success = true
        message = 'Vehicle fixed'
    elseif commandType == 'engine' then
        ExecuteCommand('engine')
        success = true
        message = 'Engine toggled'
    else
        message = 'Unknown client command type: ' .. tostring(commandType)
    end

    TriggerServerEvent('mcp:specificClientCommandExecuted', playerId, commandType, success, message)
end)

RegisterNetEvent('mcp:executeChatCommand')
AddEventHandler('mcp:executeChatCommand', function(command, message)
    if not command or not message then
        print('[MCP Bridge] Error: Missing command or message')
        return
    end

    local success = pcall(function()
        ExecuteCommand(command .. ' ' .. message)
    end)

    if not success then
        print(string.format('[MCP Bridge] Failed to execute chat command: %s', command))
    end
end)

RegisterNetEvent('mcp:listClientCommands')
AddEventHandler('mcp:listClientCommands', function()
    print('[MCP Bridge] Available client commands: me, do, ooc, dv, dvall, fix, engine')
end)

RegisterNetEvent('mcp_test:client_event')
AddEventHandler('mcp_test:client_event', function(...)
    local args = {...}
    local playerId = GetPlayerServerId(PlayerId())
    TriggerServerEvent('mcp_test:client_event_response', playerId, args)
end)

RegisterNetEvent('mcp_test:client_event_complex')
AddEventHandler('mcp_test:client_event_complex', function(messageData, actionType, playerInfo)
    local playerId = GetPlayerServerId(PlayerId())
    TriggerServerEvent('mcp_test:client_event_complex_response', playerId, messageData, actionType, playerInfo)
end)

RegisterNetEvent('mcp_test:client_event_simple')
AddEventHandler('mcp_test:client_event_simple', function()
    local playerId = GetPlayerServerId(PlayerId())
    TriggerServerEvent('mcp_test:client_event_simple_response', playerId)
end)
