fx_version 'cerulean'
game 'gta5'

name 'mcp-bridge'
description 'MCP Server Bridge Plugin for FiveM (RCON Commands)'
author 'MCP-FiveM Team'
version '2.0.0'

server_scripts {
    'server/main.lua',
    'server/commands.lua',
    'server/utils.lua'
}

client_scripts {
    'client/main.lua'
}

-- Export functions for other resources
server_exports {
    'executeCommand',
    'triggerServerEvent',
    'triggerClientEvent',
    'getPlayersInfo',
    'getPlayerInfo',
    'executeClientCommand',
    'executeSpecificClientCommand'
} 