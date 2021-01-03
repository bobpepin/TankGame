// 01234567890123456789012345678901234567890123456789012345678901234567890123456789
// DONE
// Port to WebGL1, test on mobile
// Network multiplayer
// Terrain
// Make computer tanks drive around randomly
// Terrain texture
// Split into multiple files

// TOFIX
// Sometimes projectiles are not created when shooting
// Audio permissions
// Sort out tank orientation, all orientations in 3D

// TODO
// Share lights across shaders
// Network control panel for parameters
// Tank life
// When driving, reversal requires to pass through the center
// Bump maps & shadows
// Sky texture
// Different tanks
// Different weapons
// Show active tank
// Make camera focus in front of tank, according to current tank trajectory
// Put joystick indicators
// Support for gamepads and multiple tanks
// Change controls when driving in mud
// Obstacles
// Destroy environment
// Tank tracks
// Create mud
// Upgrades & new weapons
// Mission goals (rescue/destroy/...)
// Build environment


import * as GT from "./gameTools.js";
import {Identity4x4, twoTriangles} from "./geometry.js";
import {matmul, crossProduct, createLinesNode} from "./gameTools.js";
import {PointerJoystick, InputButton} from "./input.js";
import {CameraDynamicsTopDown, CameraDynamicsShoulder, updateDirectorCamera, createFrustumBox} from "./camera.js";
import {Terrain, TerrainDrawing, createGroundDrawing} from "./terrain.js";
import {GLTFDrawing} from "./gltf.js";
import {SpriteDrawing} from "./sprite.js";
import {TankGLTFDrawing, testGLTFTanks, TankSoundscape, TankDrawing, TankState, initTanks} from "./tanks.js";
import {ProjectileGLTFDrawing, testGLTFProjectiles, initProjectiles, ProjectileState} from "./projectiles.js";
import {initObstacles, updateObjectDrawing, updateObstacles} from "./obstacles.js";
import {initSound, Jukebox, loadSoundData} from "./audio.js";

async function init() {
    const controlCanvas = document.querySelector("#control-canvas");
    const joystick = new PointerJoystick(controlCanvas);
//     const fireButton = new InputButton(document.querySelector("#fire-button"));
//     const pointer = new PointerDown(controlCanvas);
    const canvas = document.querySelector("#game-canvas");
    const gl = canvas.getContext("webgl");
    if (!gl)
        throw "Unable to obtain WebGL Context";

    gl.enable(gl.DEPTH_TEST);
    gl.depthFunc(gl.LEQUAL);
//     gl.enable(gl.CULL_FACE);
//     gl.enable(gl.SCISSOR_TEST);
    gl.enable(gl.BLEND);
    gl.blendFunc(gl.ONE, gl.ONE_MINUS_SRC_ALPHA);

    const shaders = await initShaders(gl);
    const framebuffers = initFramebuffers(gl);
    
    const terrain = new Terrain(
        "assets/perlin12.png", 
//         "square mountain.png",
//         "gradient bilinear.png",
        {xmin: -20, xmax: 20, ymin: -20, ymax: 20, zmin: 0, zmax: 3, 
         xres: 10e-1, yres: 10e-1}
    );
    await terrain.load();
    const terrainDrawing = new TerrainDrawing(
        gl, terrain, 
        {
            position: gl.getAttribLocation(shaders.terrain.program, "position"),
            normal: gl.getAttribLocation(shaders.terrain.program, "normal"),
            texcoords: gl.getAttribLocation(shaders.terrain.program, "texcoord")
        },
        [
            await GT.loadImage("assets/tileGrass1.png"), 
            await GT.loadImage("assets/tileSand1.png")
        ]
    );
    const tanks = await initTanks(gl, shaders);
    const projectiles = await initProjectiles(gl, shaders);
    
    const cameraDynamics = new CameraDynamicsShoulder();
    
    const state = {
        gameId: Math.random(),
        shaders,
        framebuffers,
        time: 0,
        bufferIndex: 0,
        terrain,
        terrainDrawing,
        tanks,
        projectiles,
        cameraDynamics,
        collisions: {projectileTanks: []},
        cameras: {
            director: new Float32Array(Identity4x4),
            player: new Float32Array(Identity4x4)
        },
        drawings: [],
        inputDevices: {
            joysticks: [joystick],
            pointers: [],
//             fireButtons: [fireButton]
            fireButtons: []
        },
        obstacles: await initObstacles(gl, shaders),
        controllers: [{steering: [0, 0], fire: 0}],
        deadReckoning: {incoming: [], outgoing: []},
        network: {incoming: [], outgoing: []},
        networkMessages: [],
        projectionMatrix: new Float32Array(Identity4x4),
        
        gltfDrawingTanks: await testGLTFTanks(gl, shaders.gltf.program),
        gltfDrawingProjectiles: await testGLTFProjectiles(gl, shaders.gltf.program),        
    }

    state.frustumBox = createFrustumBox(gl, state);
    
    const ground = await createGroundDrawing(gl, state);
    state.drawings.push(ground);
    
    const hostname = document.location.hostname;
    const websocket = new WebSocket(`ws://${hostname}:8080`);
    websocket.onmessage = async function (event) {
        let text;
        try {
            text = await event.data.text();
        } catch(e) {
            text = event.data;
        }
        state.networkMessages.push(text);
//         console.log("received network message", text);
    }
    
    const jukebox = await initSound({
        shot: "assets/shot.flac", 
        hit: "assets/hit.flac"
    });
    
    console.log(state);
    requestAnimationFrame(time => animate(gl, state, time, websocket, jukebox));
}

function animate(gl, state, time, websocket, jukebox) {
    render(gl, state, time, websocket, jukebox);
    requestAnimationFrame(time => animate(gl, state, time, websocket, jukebox));
}

function render(gl, state, timeMs, websocket, jukebox) {
//     document.getElementById("msglog-1").innerHTML = "";
//     document.getElementById("msglog-2").innerHTML = "";
    const time = timeMs * 1e-3;
    state.dt = (time - state.time);
    state.time = time;

    const nextBufferIndex = (state.bufferIndex+1)%2;
    state.bufferIndex = nextBufferIndex;
    
    updateInput(state);
    processNetworkMessages(state);
    updateObstacles(state);
    
    state.collisions.projectileTanks = detectProjectileTankCollisions(state);

    const tankState = state.tanks.nextState;
    tankState.setEvolve(state);
    const projectileState = state.projectiles.nextState;
    projectileState.setEvolve(state);
    
    swapStateBuffers(state.tanks);
    swapStateBuffers(state.projectiles);
    
    state.outgoingNetworkMessages = [
        ...state.tanks.state.deadReckoningUpdates,
        ...state.projectiles.state.deadReckoningUpdates
    ];
    sendNetworkMessages(websocket, state);
    
    state.projectiles.state.updateWorldMatrices(state.projectiles.matrices);
    state.projectiles.drawing.spriteCount = state.projectiles.state.count;
    
    gl.canvas.width = gl.canvas.clientWidth;
    gl.canvas.height = gl.canvas.clientHeight;
    
//     GT.updateGeometryTree(state.tanks.tankTree, {matrix: Identity4x4});
    state.gltfDrawingTanks.update(state);
    state.gltfDrawingProjectiles.update(state);    
    state.tanks.drawing.update(gl, state);
    state.tanks.soundscape.play(jukebox, state);
    if(state.controllers[0].fire) {
        jukebox.play("shot");
    }
    
    renderTankTexture(gl, state);
    
    gl.clearColor(153/255, 203/255, 238/255, 1);
    gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);
    const directorCameraEnabled = true;
    {
        const width = directorCameraEnabled ? 
              gl.drawingBufferWidth/2 : gl.drawingBufferWidth;
        const viewport = [0, 0, width, gl.drawingBufferHeight];
        gl.viewport(...viewport);
        state.cameraDynamics.update(state, width/gl.drawingBufferHeight);
        state.cameraDynamics.updateCameraMatrix(state.cameras.player);
        state.projectionMatrix.set(state.cameras.player);
        state.drawings.map(({drawing}) => GT.draw(gl, drawing));
        for(const type in state.obstacles) {
            state.obstacles[type].drawing.draw(gl, state);
        }
//         state.tanks.drawing.draw(gl, state);
//         state.projectiles.drawing.draw(gl, state);
        state.terrainDrawing.draw(gl, state.shaders.terrain, state);
        state.gltfDrawingTanks.draw(gl, state.shaders.gltf.program, state);
        state.gltfDrawingProjectiles.draw(gl, state.shaders.gltf.program, state);        
    }
    if(directorCameraEnabled) {
        const viewport = [gl.drawingBufferWidth/2, 0, gl.drawingBufferWidth/2, gl.drawingBufferHeight];
        gl.viewport(...viewport);
        updateDirectorCamera(gl, state);
        state.projectionMatrix.set(state.cameras.director);
        state.drawings.map(({drawing}) => GT.draw(gl, drawing));
//         state.tanks.drawing.draw(gl, state);
//         state.projectiles.drawing.draw(gl, state);
        GT.invert4x4Matrix(state.cameras.player, state.frustumBox.worldMatrix);
        GT.draw(gl, state.frustumBox.drawing); 
        state.terrainDrawing.draw(gl, state.shaders.terrain, state);        
        state.gltfDrawingTanks.draw(gl, state.shaders.gltf.program, state);
        state.gltfDrawingProjectiles.draw(gl, state.shaders.gltf.program, state);       }
}

function swapStateBuffers(x) {
    const tmp = x.state;
    x.state = x.nextState;
    x.nextState = tmp;
}

function updateInput(state) {
    const input = [0, 0];
    if(state.inputDevices.pointers[0] && state.inputDevices.pointers[0].active) {
        const pointer = state.inputDevices.pointers[0];
        const tankPos = [state.tanks.state.positions[2*tank_index],
                         state.tanks.state.positions[2*tank_index+1]];
        input[0] = 2*pointer.position[0] - 1 - tankPos[0];
        input[1] = 2*pointer.position[1] - 1 - tankPos[1];
    }
    if(state.inputDevices.joysticks && state.inputDevices.joysticks[0]) {
        input[0] = state.inputDevices.joysticks[0].axes[0];
        input[1] = state.inputDevices.joysticks[0].axes[1];
    }
    state.controllers[0].steering = input;
    state.controllers[0].fire = 0;
    if(state.inputDevices.fireButtons[0]) {
        state.controllers[0].fire += state.inputDevices.fireButtons[0].count;
    }
    if(state.inputDevices.joysticks[0].tap) {
        state.controllers[0].fire += 1;
    }
    state.inputDevices.joysticks[0].reset();
    if(state.inputDevices.fireButtons[0]) {
        state.inputDevices.fireButtons[0].reset();
    }
}


function processNetworkMessages(state) {
    state.deadReckoning.incoming = [];
    state.network.incoming = [];
    for(const text of state.networkMessages) {
        try {
            const msg = JSON.parse(text);
            if(msg.sender == state.gameId)
                continue;
            if(msg.type == "deadReckoning") {
//                 console.log("received deadReckoning", msg);
                state.deadReckoning.incoming.push(msg);
            } else {
                state.network.incoming.push(msg);
            }
        } catch(e) {
            console.log("Error processing network input", text, e);
            continue;
        }
    }
    state.networkMessages = [];
}

function sendNetworkMessages(websocket, state) {
    for(const msg of state.outgoingNetworkMessages) {
        websocket.send(JSON.stringify({sender: state.gameId, ...msg}));
    }
    state.outgoingNetworkMessages = [];
}

async function initShaders(gl) {
    const shaderSources = {
        "ground": {
            vertexShaderUrl: "src/ground_vertex.glsl",
            fragmentShaderUrl: "src/ground_fragment.glsl"
        },
        "gltf": {
            vertexShaderUrl: "src/gltf.vert.glsl",
            fragmentShaderUrl: "src/gltf.frag.glsl"
        },        
        "sprite": {
            vertexShaderUrl: "src/sprite_vertex.glsl",
            fragmentShaderUrl: "src/sprite_fragment.glsl"
        },
        "tank": {
            vertexShaderUrl: "src/tank.vert.glsl",
            fragmentShaderUrl: "src/tank.frag.glsl"
        },        
        "lines": {
            vertexShaderUrl: "src/lines_vertex.glsl",
            fragmentShaderUrl: "src/lines_fragment.glsl"
        },
        "terrain": {
            vertexShaderUrl: "src/terrain.vert.glsl",
            fragmentShaderUrl: "src/terrain.frag.glsl"            
        }
    }
    return await GT.loadShaders(gl, shaderSources);
}

class Logger {
    constructor() {
        this.lastLogTime = 0;
    }
    
    log(time, ...args) {
        if(time - this.lastLogTime > 10 || time == this.lastLogTime) {
            console.log(...args);
            this.lastLogTime = time;
        }
    }
}

const logger = new Logger();
// logger.log(0, "Logger in itialized");


function detectProjectileTankCollisions(state) {
    const projectileRadius = 0.035;
    const tankRadius = 0.1;
    const maxD2 = (projectileRadius + tankRadius)**2;
    const collisions = [];
    const tankState = state.tanks.state;
    const projectileState = state.projectiles.state;
    for(let i=0; i < projectileState.count; i++) {
        for(let j=0; j < tankState.length; j++) {
            if(tankState.life[j] <= 0)
                continue;
            if(tankState.ids[j] == projectileState.sources[i]) // avoid self-fire
                continue;
            const d2 = 
                  (projectileState.positions[2*i] - tankState.positions[2*j])**2 + 
                  (projectileState.positions[2*i+1] - tankState.positions[2*j+1])**2;
            if(d2 < maxD2) {
                collisions.push([i, j]);
            }
        }
    }
    return collisions;
}


function initFramebuffers(gl) {
    const width = 512;
    const height = 512;
    const originalFramebuffer = gl.getParameter(gl.FRAMEBUFFER_BINDING);
    const framebuffer = gl.createFramebuffer();
    gl.bindFramebuffer(gl.FRAMEBUFFER, framebuffer);
    const texture = gl.createTexture();
    gl.bindTexture(gl.TEXTURE_2D, texture);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, width, height, 0, gl.RGBA, gl.UNSIGNED_BYTE, null);
    gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, texture, 0);
    gl.bindFramebuffer(gl.FRAMEBUFFER, originalFramebuffer);
    const canvas = document.querySelector("#texture-canvas");
    const ctx = canvas.getContext("2d");
    const imagedata = ctx.createImageData(width, height);
    const pixelbuffer = new Uint8Array(imagedata.data.buffer);
    return {texture, framebuffer, pixelbuffer, imagedata, canvasContext: ctx, width, height};
}

function renderTankTexture(gl, state) {
    const {framebuffer, texture, width, height, pixelbuffer, canvasContext, imagedata} = state.framebuffers;
    const originalFramebuffer = gl.getParameter(gl.FRAMEBUFFER_BINDING);
    gl.bindFramebuffer(gl.FRAMEBUFFER, framebuffer);
    gl.clearColor(255, 0, 0, 0);
    gl.clear(gl.COLOR_BUFFER_BIT);
    const viewport = [0, 0, width, height];
    gl.viewport(...viewport);
    state.cameraDynamics.update(state, width/height);
    state.cameraDynamics.updateCameraMatrix(state.cameras.player);
    state.projectionMatrix.set(state.cameras.player);
//     state.drawings.map(({drawing}) => GT.draw(gl, drawing));
//     for(const type in state.obstacles) {
//         state.obstacles[type].drawing.draw(gl, state);
//     }
    state.tanks.drawing.draw(gl, state);
//     state.projectiles.drawing.draw(gl, state);
//     gl.readPixels(0, 0, width, height, gl.RGBA, gl.UNSIGNED_BYTE, pixelbuffer);
//     canvasContext.putImageData(imagedata, 0, 0);
    gl.bindFramebuffer(gl.FRAMEBUFFER, originalFramebuffer);
}


init();