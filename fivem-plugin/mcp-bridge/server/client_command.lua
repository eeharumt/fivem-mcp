-- MCP Bridge - client command result handler

RegisterNetEvent('mcp:clientCommandResult')
AddEventHandler('mcp:clientCommandResult', function(requestId, success, data, message)
    setPendingResult(requestId, success, data, message)
end)
