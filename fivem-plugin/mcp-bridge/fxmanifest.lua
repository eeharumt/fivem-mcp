fx_version 'cerulean'
game 'gta5'
lua54 'yes'

name 'mcp-bridge'
description 'MCP Server Bridge Plugin for FiveM (RCON Commands + Dev QA player control)'
author 'MCP-FiveM Team'
version '2.2.0'

dependency 'screenshot-basic'

server_scripts {
    'server/_init.lua',
}

client_scripts {
    'client/main.lua',
    'client/player_control.lua',
}

server_exports {
    'executeCommand',
    'triggerServerEvent',
    'triggerClientEvent',
    'getPlayersInfo',
    'getPlayerInfo',
    'executeClientCommand',
    'executeSpecificClientCommand'
}
