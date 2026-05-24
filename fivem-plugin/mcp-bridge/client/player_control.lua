-- MCP Bridge - Client-side player control for dev QA

local KEY_BINDINGS = {
    W = { { 32, 1.0 }, { 31, -1.0 } },
    S = { { 33, 1.0 }, { 31, 1.0 } },
    A = { { 34, 1.0 }, { 30, -1.0 } },
    D = { { 35, 1.0 }, { 30, 1.0 } },
    SHIFT = { { 21, 1.0 } },
    SPACE = { { 22, 1.0 } },
    E = { { 38, 1.0 } },
    F = { { 23, 1.0 } },
}

local function resolveControls(keys)
    local controls = {}

    if type(keys) ~= 'table' then
        return controls
    end

    for _, key in ipairs(keys) do
        local bindings = KEY_BINDINGS[string.upper(tostring(key))]
        if bindings then
            for _, binding in ipairs(bindings) do
                table.insert(controls, binding)
            end
        end
    end

    return controls
end

local function notifyInput(label)
    BeginTextCommandThefeedPost('STRING')
    AddTextComponentSubstringPlayerName('[MCP QA] ' .. label)
    EndTextCommandThefeedPostTicker(false, true)
end

local function getPlayerState()
    local ped = PlayerPedId()
    local coords = GetEntityCoords(ped)
    local velocity = GetEntityVelocity(ped)
    local _, currentWeapon = GetCurrentPedWeapon(ped, true)
    local vehicle = 0
    local vehicleInfo = nil

    if IsPedInAnyVehicle(ped, false) then
        vehicle = GetVehiclePedIsIn(ped, false)
        vehicleInfo = {
            model = GetEntityModel(vehicle),
            plate = GetVehicleNumberPlateText(vehicle),
            engine_health = GetVehicleEngineHealth(vehicle),
            body_health = GetVehicleBodyHealth(vehicle),
        }
    end

    return {
        coords = {
            x = coords.x,
            y = coords.y,
            z = coords.z,
        },
        heading = GetEntityHeading(ped),
        health = GetEntityHealth(ped),
        armor = GetPedArmour(ped),
        ped_model = GetEntityModel(ped),
        weapon = currentWeapon,
        in_vehicle = vehicle ~= 0,
        vehicle = vehicleInfo,
        speed = math.sqrt((velocity.x * velocity.x) + (velocity.y * velocity.y) + (velocity.z * velocity.z)),
        frozen = IsEntityPositionFrozen(ped),
    }
end

local function waitForCollisionAt(x, y, z)
    RequestCollisionAtCoord(x, y, z)
    local deadline = GetGameTimer() + 2000

    while GetGameTimer() < deadline do
        if HasCollisionLoadedAroundEntity(PlayerPedId()) then
            return true
        end
        Wait(0)
    end

    return false
end

local function isFiniteNumber(value)
    return type(value) == 'number' and value == value and value ~= math.huge and value ~= -math.huge
end

local function hasFiniteCoords(coords)
    return coords
        and isFiniteNumber(coords.x)
        and isFiniteNumber(coords.y)
        and isFiniteNumber(coords.z)
end

local function isSafeTeleportBounds(x, y, z)
    -- Broad guard rails to avoid invalid-world teleports that can destabilize client physics.
    if math.abs(x) > 10000.0 or math.abs(y) > 10000.0 then
        return false
    end
    if z < -500.0 or z > 2000.0 then
        return false
    end
    return true
end

local function unfreezeTeleportTarget(ped, vehicle)
    if vehicle ~= 0 then
        FreezeEntityPosition(vehicle, false)
    else
        FreezeEntityPosition(ped, false)
    end
end

local function teleportPlayer(coords)
    local ped = PlayerPedId()
    local x = tonumber(coords.x)
    local y = tonumber(coords.y)
    local z = tonumber(coords.z)

    if not isFiniteNumber(x) or not isFiniteNumber(y) or not isFiniteNumber(z) then
        return false, 'coords.x, coords.y, and coords.z are required'
    end

    local heading = coords.heading ~= nil and (tonumber(coords.heading) or 0.0) or nil
    if heading ~= nil and not isFiniteNumber(heading) then
        return false, 'coords.heading must be a finite number'
    end

    if not isSafeTeleportBounds(x, y, z) then
        return false, 'Teleport target is outside safe world bounds'
    end

    local originalCoords = GetEntityCoords(ped)

    -- Use /tp command path explicitly as requested.
    ExecuteCommand(('tp %.3f %.3f %.3f'):format(x, y, z))

    waitForCollisionAt(x, y, z)

    local teleportedCoords = nil
    local retries = 0
    repeat
        Wait(75)
        teleportedCoords = GetEntityCoords(ped)
        retries = retries + 1
    until hasFiniteCoords(teleportedCoords) or retries >= 10

    if not hasFiniteCoords(teleportedCoords) then
        -- Last resort rollback when tp produced invalid coordinates.
        SetEntityCoords(ped, originalCoords.x, originalCoords.y, originalCoords.z, false, false, false, false)
        return false, 'Teleport failed: invalid coordinates after tp command'
    end

    if heading then
        SetEntityHeading(ped, heading)
    end

    return true
end

local function runInputPulse(keys, durationMs)
    local controls = resolveControls(keys)
    if #controls == 0 then
        return false, 'No valid keys provided', nil
    end

    durationMs = tonumber(durationMs) or 2000
    if durationMs < 100 then
        durationMs = 100
    end
    if durationMs > 5000 then
        durationMs = 5000
    end

    local ped = PlayerPedId()
    local startCoords = GetEntityCoords(ped)
    local keyLabel = table.concat(keys, '+')

    notifyInput(('入力開始: %s (%dms)'):format(keyLabel, durationMs))

    local endTime = GetGameTimer() + durationMs
    local maxFrames = math.max(30, math.ceil(durationMs / 16) + 5)
    local frames = 0

    while frames < maxFrames and GetGameTimer() < endTime do
        for _, control in ipairs(controls) do
            local controlId = control[1]
            local value = control[2]

            EnableControlAction(0, controlId, true)
            EnableControlAction(1, controlId, true)
            EnableControlAction(2, controlId, true)
            SetControlNormal(0, controlId, value)
            SetControlNormal(1, controlId, value)
            SetControlNormal(2, controlId, value)
        end
        Wait(0)
        frames = frames + 1
    end

    local endCoords = GetEntityCoords(ped)
    local distanceMoved = #(startCoords - endCoords)

    notifyInput(('入力完了: %s (移動 %.2fm)'):format(keyLabel, distanceMoved))

    return true, nil, {
        keys = keys,
        duration_ms = durationMs,
        distance_moved = distanceMoved,
        started_coords = { x = startCoords.x, y = startCoords.y, z = startCoords.z },
        ended_coords = { x = endCoords.x, y = endCoords.y, z = endCoords.z },
    }
end

local function runInputSequence(sequence)
    if type(sequence) ~= 'table' or #sequence == 0 then
        return false, 'sequence must be a non-empty array'
    end

    for _, step in ipairs(sequence) do
        local keys = step.keys or {}
        local durationMs = tonumber(step.duration_ms) or 1000
        local delayMs = tonumber(step.delay_ms) or 0

        local ok, err = runInputPulse(keys, durationMs)
        if not ok then
            return false, err, nil
        end

        if delayMs > 0 then
            Wait(delayMs)
        end
    end

    return true, nil, nil
end

local function buildInputResponse(metrics)
    local state = getPlayerState()
    if metrics then
        state.input = metrics
    end
    return state
end

local function captureScreenshot(quality)
    local screenshotQuality = tonumber(quality) or 0.6
    if screenshotQuality < 0.1 then
        screenshotQuality = 0.1
    end
    if screenshotQuality > 1.0 then
        screenshotQuality = 1.0
    end

    if GetResourceState('screenshot-basic') ~= 'started' and GetResourceState('screencapture') ~= 'started' then
        return nil, 'screenshot-basic/screencapture resource is not started'
    end

    local p = promise and promise.new() or nil
    local done = false
    local result

    local screenshotExport = exports.screencapture or exports['screenshot-basic']
    if not screenshotExport or not screenshotExport.requestScreenshot then
        return nil, 'screenshot export is unavailable (ensure screencapture is started)'
    end

    screenshotExport:requestScreenshot({
        encoding = 'jpg',
        quality = screenshotQuality,
    }, function(data)
        result = {
            image_data = data,
            state = getPlayerState(),
        }
        done = true
        if p then
            p:resolve(result)
        end
    end)

    if p then
        return Citizen.Await(p)
    end

    local deadline = GetGameTimer() + 15000
    while not done and GetGameTimer() < deadline do
        Wait(0)
    end

    return result, done and nil or 'Screenshot capture timed out'
end

local function handlePlayerControl(action, args)
    args = args or {}

    if action == 'get_state' then
        return true, getPlayerState(), 'Player state retrieved'
    end

    if action == 'teleport' then
        local ok, err = teleportPlayer(args.coords or args)
        if not ok then
            return false, {}, err
        end
        local state = getPlayerState()
        if not hasFiniteCoords(state.coords) then
            return false, {}, 'Player state invalid after teleport'
        end
        return true, state, 'Player teleported'
    end

    if action == 'freeze' then
        FreezeEntityPosition(PlayerPedId(), true)
        return true, getPlayerState(), 'Player frozen'
    end

    if action == 'unfreeze' then
        FreezeEntityPosition(PlayerPedId(), false)
        return true, getPlayerState(), 'Player unfrozen'
    end

    if action == 'input_pulse' then
        local input = args.input or args
        local ok, err, metrics = runInputPulse(input.keys or {}, input.duration_ms or args.duration_ms)
        if not ok then
            return false, {}, err
        end
        return true, buildInputResponse(metrics), 'Input pulse completed'
    end

    if action == 'input_tap' then
        local input = args.input or args
        local durationMs = input.duration_ms or args.duration_ms or 200
        local ok, err, metrics = runInputPulse(input.keys or {}, durationMs)
        if not ok then
            return false, {}, err
        end
        return true, buildInputResponse(metrics), 'Input tap completed'
    end

    if action == 'input_sequence' then
        local ok, err = runInputSequence(args.sequence or {})
        if not ok then
            return false, {}, err
        end
        return true, getPlayerState(), 'Input sequence completed'
    end

    if action == 'screenshot' then
        local screenshotArgs = args.screenshot or args
        local data, err = captureScreenshot(screenshotArgs.quality or args.quality)
        if not data then
            return false, {}, err or 'Screenshot capture failed'
        end
        return true, data, 'Screenshot captured'
    end

    if action == 'set_health' then
        local ped = PlayerPedId()
        local health = tonumber(args.health or args.value) or 200
        SetEntityHealth(ped, health)
        return true, getPlayerState(), 'Health updated'
    end

    if action == 'set_armor' then
        local ped = PlayerPedId()
        local armor = tonumber(args.armor or args.value) or 100
        SetPedArmour(ped, armor)
        return true, getPlayerState(), 'Armor updated'
    end

    if action == 'give_weapon' then
        local ped = PlayerPedId()
        local weaponName = args.weapon or args.weapon_name
        if not weaponName then
            return false, {}, 'weapon is required'
        end

        local weaponHash = joaat(weaponName)
        local ammo = tonumber(args.ammo) or 250
        GiveWeaponToPed(ped, weaponHash, ammo, false, true)
        return true, getPlayerState(), 'Weapon granted'
    end

    if action == 'set_heading' then
        local ped = PlayerPedId()
        local heading = tonumber(args.heading or args.value)
        if not heading then
            return false, {}, 'heading is required'
        end

        SetEntityHeading(ped, heading)
        return true, getPlayerState(), 'Heading updated'
    end

    if action == 'spawn_vehicle' then
        local modelName = args.model or args.vehicle_model
        if not modelName then
            return false, {}, 'model is required'
        end

        local model = joaat(modelName)
        RequestModel(model)
        local deadline = GetGameTimer() + 5000
        while not HasModelLoaded(model) and GetGameTimer() < deadline do
            Wait(0)
        end

        if not HasModelLoaded(model) then
            return false, {}, 'Failed to load vehicle model'
        end

        local ped = PlayerPedId()
        local coords = GetEntityCoords(ped)
        local heading = GetEntityHeading(ped)
        local vehicle = CreateVehicle(model, coords.x, coords.y, coords.z, heading, true, false)
        SetPedIntoVehicle(ped, vehicle, -1)
        SetModelAsNoLongerNeeded(model)
        return true, getPlayerState(), 'Vehicle spawned'
    end

    if action == 'enter_vehicle' then
        local ped = PlayerPedId()
        local vehicle = GetClosestVehicle(GetEntityCoords(ped), 8.0, 0, 70)
        if vehicle == 0 then
            return false, {}, 'No nearby vehicle found'
        end

        SetPedIntoVehicle(ped, vehicle, tonumber(args.seat) or -1)
        return true, getPlayerState(), 'Entered nearby vehicle'
    end

    if action == 'repair_vehicle' then
        local ped = PlayerPedId()
        if not IsPedInAnyVehicle(ped, false) then
            return false, {}, 'Player is not in a vehicle'
        end

        local vehicle = GetVehiclePedIsIn(ped, false)
        SetVehicleFixed(vehicle)
        SetVehicleEngineHealth(vehicle, 1000.0)
        SetVehicleBodyHealth(vehicle, 1000.0)
        SetVehicleDirtLevel(vehicle, 0.0)
        return true, getPlayerState(), 'Vehicle repaired'
    end

    if action == 'look_at' then
        local ped = PlayerPedId()
        local x = tonumber(args.x)
        local y = tonumber(args.y)
        local z = tonumber(args.z)
        if not x or not y or not z then
            return false, {}, 'x, y, and z are required'
        end

        TaskLookAtCoord(ped, x, y, z, tonumber(args.duration_ms) or 3000, 0, 2)
        return true, getPlayerState(), 'Look-at task started'
    end

    return false, {}, 'Unknown player control action: ' .. tostring(action)
end

RegisterNetEvent('mcp-bridge:playerControl', function(requestId, action, args)
    CreateThread(function()
        local ok, success, data, message = pcall(handlePlayerControl, action, args or {})

        if not ok then
            TriggerServerEvent('mcp-bridge:playerControlResult', requestId, false, {}, tostring(success))
            return
        end

        TriggerServerEvent('mcp-bridge:playerControlResult', requestId, success, data, message)
    end)
end)
