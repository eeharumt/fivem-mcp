local resource = GetCurrentResourceName()

local sharedEnv = {}
setmetatable(sharedEnv, { __index = _G })

-- RegisterCommand callbacks run in real _G, not the load() env.
_G.__mcpBridgeEnv = sharedEnv

local function loadServerScript(path)
    local code = LoadResourceFile(resource, path)
    if not code then
        error(('Failed to read %s'):format(path))
    end

    local fn, err = load(code, '@' .. resource .. '/' .. path, 't', sharedEnv)
    if not fn then
        error(err)
    end

    fn()
end

for _, path in ipairs({
    'server/utils.lua',
    'server/player_control.lua',
    'server/client_command.lua',
    'server/commands.lua',
    'server/main.lua',
}) do
    loadServerScript(path)
end

for key, value in pairs(sharedEnv) do
    if type(value) == 'function' then
        _G[key] = value
    end
end
