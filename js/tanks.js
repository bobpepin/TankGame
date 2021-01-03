// 01234567890123456789012345678901234567890123456789012345678901234567890123456789
// DONE
// Port to WebGL1, test on mobile
// Network multiplayer
// Terrain
// Make computer tanks drive around randomly
// Terrain texture

// TOFIX
// Sort out tank orientation, all orientations in 3D

// TODO
// Split into multiple files
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


import * as GT from "./gameTools.js"
import {matmul, crossProduct} from "./gameTools.js"

const Identity4x4 = new Float32Array([
        1, 0, 0, 0,
        0, 1, 0, 0,
        0, 0, 1, 0,
        0, 0, 0, 1
]);

const twoTriangles = {
    positions: new Float32Array([
        -1.0, -1.0,  0.0,
         1.0, -1.0,  0.0,
        -1.0,  1.0,  0.0,
        -1.0,  1.0,  0.0,
         1.0, -1.0,  0.0,
         1.0,  1.0,  0.0
    ]),
    texcoords: new Float32Array([
        0, 1,
        1, 1,
        0, 0,
        0, 0,
        1, 1,
        1, 0
    ])
}

class PointerJoystick {
    constructor(elt, radius) {
        this.radius = radius || 64;
//         elt.addEventListener("pointerdown", e => this.handleDown(e));
        elt.addEventListener("mousedown", e => this.handleDown(e));        
//         elt.addEventListener("pointerup", e => this.handleUp(e));
        elt.addEventListener("mouseup", e => this.handleUp(e));        
//        elt.addEventListener("pointerout", e => this.handleUp(e));        
//         elt.addEventListener("pointermove", e => this.handleMove(e));
        elt.addEventListener("mousemove", e => this.handleMove(e));        
        
        elt.addEventListener("touchstart", e => this.handleTouchStart(e));
        elt.addEventListener("touchend", e => this.handleTouchEnd(e));
        elt.addEventListener("touchcancel", e => this.handleTouchEnd(e));        
        elt.addEventListener("touchmove", e => this.handleTouchMove(e));        
        this.canvas = elt;
        this.context = elt.getContext("2d");
        this.active = false;
        this.tap = false;
        this.moved = false;
        this.startTime = -Infinity;
        this.stopTime = -Infinity;
        this.axes = [0, 0];
        this.lastOffset = [0, 0];
    }
    
    handleDown(event) {
        console.log("down", event);
        event.preventDefault();
        event.stopPropagation();
//         this.start(event.offsetX, event.offsetY);
        this.start(event.clientX, event.clientY);
    }
    
    getTouchOffset(event) {
        return [touch.clientX, touch.clientY];
        const touch = event.changedTouches[0];
        const eltRect = this.canvas.getBoundingClientRect();
        const offsetX = touch.clientX - eltRect.left;
        const offsetY = touch.clientY - eltRect.top;
        return [offsetX, offsetY];
    }
                
    handleTouchStart(event) {
//         console.log("touchstart");
        event.preventDefault();
        event.stopPropagation();
        if(event.changedTouches.length == 0)
            return;
        const [offsetX, offsetY] = this.getTouchOffset(event);
        this.start(offsetX, offsetY);
    }   
    
    start(clientX, clientY) {
//         console.log("start", offsetX, offsetY);
        if(this.active) return;
        this.startTime = performance.now();
        if(this.startTime - this.stopTime > 1000) {
            const eltRect = this.canvas.getBoundingClientRect();
            const offsetX = clientX - eltRect.left;
            const offsetY = clientY - eltRect.top;        
            this.origin = [offsetX, offsetY];
            this.lastOffset[0] = offsetX;
            this.lastOffset[1] = offsetY;
            this.moved = false;
        } else {
            this.tap = true;
        }
        this.active = true;
        this.move(clientX, clientY);
    }
    
    handleUp(event) {
        event.preventDefault();
        event.stopPropagation();
        this.stop();
    }
    
    handleTouchEnd(event) {
        event.preventDefault();
        event.stopPropagation();
        if(event.targetTouches.length == 0)
            this.stop();
    }
    
    stop() {
        this.active = false;
        this.axes = [0, 0];
        const {context, canvas} = this;
        context.clearRect(0, 0, canvas.width, canvas.height);        
        this.stopTime = performance.now()
        if(this.stopTime - this.startTime < 1000 && !this.moved) {
            this.tap = true;
        }
    }
    
    handleMove(event) {
        event.preventDefault();
        event.stopPropagation();
//         this.move(event.offsetX, event.offsetY);
        this.move(event.clientX, event.clientY);
    }
    
    handleTouchMove(event) {
        event.preventDefault();
        event.stopPropagation();
        if(event.changedTouches.length == 0)
            return;
        const [offsetX, offsetY] = this.getTouchOffset(event);
        this.move(offsetX, offsetY);
    }
    
    move(clientX, clientY) {
        if(!this.active) return;
        const {context, canvas} = this;
        context.clearRect(0, 0, canvas.width, canvas.height);
        const eltRect = this.canvas.getBoundingClientRect();
        const offsetX = clientX - eltRect.left;
        const offsetY = clientY - eltRect.top; 
        // TODO: Stay on a circle of radius "radius"
        const deltaX = offsetX - this.lastOffset[0];
        const deltaY = offsetY - this.lastOffset[1];
        const [x0, y0] = this.origin;
        const [x, y] = [offsetX, offsetY];
        this.axes = [x-x0, y0-y].map(a => Math.max(Math.min(a, this.radius), -this.radius)/this.radius);
        if(this.axes[0]**2 + this.axes[1]**2 > 1) {
            this.moved = true;
        }
        context.beginPath();
        context.strokeStyle = "black";
        context.lineWidth = 1;
        context.moveTo(x0, y0);
        context.lineTo(x, y);
        context.stroke();
        context.closePath();
    }
    
    reset() {
        this.tap = false;
    }
}

class PointerDown {
    constructor(elt) {
        elt.addEventListener("mousedown", e => this.handleDown(e));
        elt.addEventListener("mouseup", e => this.handleUp(e));
        elt.addEventListener("mousemove", e => this.handleMove(e));
        this.canvas = elt;
        this.context = elt.getContext("2d");
        this.active = false;
        this.position = null;
    }
    
    handleDown(event) {
        if(this.active) return;
        this.active = true;
        this.handleMove(event);
    }
    
    handleUp(event) {
        this.active = false;
        this.position = null;
        const {context, canvas} = this;
        context.clearRect(0, 0, canvas.width, canvas.height);        
    }
    
    handleMove(event) {
        if(!this.active) return;
        const {context, canvas} = this;
        context.clearRect(0, 0, canvas.width, canvas.height);
        const [x, y] = [event.offsetX, event.offsetY];
        this.position = [x / canvas.width, 1 - (y / canvas.height)];
    }
}

class InputButton {
    constructor(elt) {
        elt.addEventListener("mousedown", e => this.handleDown(e));
        elt.addEventListener("touchdown", e => this.handleDown(e));        
        this.count = 0;
    }
    
    handleDown(event) {
        event.preventDefault();
        this.count++;
    }
    
    reset() {
        this.count = 0;
    }
}

const audioContext = new AudioContext();

async function loadSoundData(ctx, url) {
    const response = await fetch(url);
    const data = await response.arrayBuffer();
//     const ctx = new AudioContext();
//     console.log(response);
    return await new Promise((resolve, reject) => {
        ctx.decodeAudioData(data, resolve, reject);
    });
}

class Jukebox {
    constructor() {
        this.buffers = {};
    }
    
    async load(sources) {
        for(const name in sources) {
            this.buffers[name] = await loadSoundData(audioContext, sources[name]);
        }
    }
    
    play(name) {
        const ctx = audioContext;
        const buffer = this.buffers[name];
        const source = ctx.createBufferSource();
        source.buffer = buffer;
        source.connect(ctx.destination);
//         console.log("play", source, buffer);        
        source.start();
    }
}

const jukebox = new Jukebox();
async function initSound() {
//    const jukebox = new Jukebox();
    await jukebox.load({shot: "sounds/shot.flac", hit: "sounds/hit.flac"});
    document.querySelector("#fire-button").addEventListener("mousedown", e => {
        jukebox.play("shot");
    });
}
        

async function init() {
    await initSound();
    const controlCanvas = document.querySelector("#control-canvas");
    const joystick = new PointerJoystick(controlCanvas);
    const fireButton = new InputButton(document.querySelector("#fire-button"));
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
        "perlin12.png", 
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
            fireButtons: [fireButton]
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
    
    console.log(state);
    requestAnimationFrame(time => animate(gl, state, time, websocket));
}

function animate(gl, state, time, websocket) {
    render(gl, state, time, websocket);
    requestAnimationFrame(time => animate(gl, state, time, websocket));
}

function render(gl, state, timeMs, websocket) {
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
    state.controllers[0].fire = state.inputDevices.fireButtons[0].count;
    if(state.inputDevices.joysticks[0].tap) {
        state.controllers[0].fire += 1;
    }
    state.inputDevices.joysticks[0].reset();    
    state.inputDevices.fireButtons[0].reset();
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

class CameraDynamicsTopDown {
    constructor(scale) {
        this.scale = scale || 0.5;        
        this.center = [0, 0];
        // xmin ymin xmax ymax, relative to center
        this.focusField = [-0.25, -0.25, 0.25, 0.25]; //.map(x => x/this.scale);
        this.acceleration = [0.0, 0.0];
        this.velocity = [0.0, 0.0];
        this.ratio = 1;
    }
    
    // ratio = width / height
    update(state, ratio) {
        const tankPos = state.tanks.state.getPosition(state.tanks.state.activeTank);
        const fovPos = [tankPos[0]-this.center[0], tankPos[1]-this.center[1]];
        let stop = 0;
        if(fovPos[0] < this.focusField[0]) {
            this.acceleration[0] = -0.1;
        } else if(fovPos[0] > this.focusField[2]) {
            this.acceleration[0] = 0.1;
        } else {
            this.acceleration[0] = -10*this.velocity[0];
        }
        if(fovPos[1] < this.focusField[1]) {
            this.acceleration[1] = -0.1;
        } else if(fovPos[1] > this.focusField[3]) {
            this.acceleration[1] = 0.1;
        } else {
            this.acceleration[1] = -10*this.velocity[1];
        }
        this.velocity[0] = Math.max(-1.0, Math.min(1.0, this.velocity[0] + this.acceleration[0] * state.dt));
        this.velocity[1] = Math.max(-1.0, Math.min(1.0, this.velocity[1] + this.acceleration[1] * state.dt));
//         if(stop == 2) {
//             this.velocity = [0, 0];
//         }
//         document.querySelector("#msglog-1").innerHTML = `${tankPos[0]},${tankPos[1]} ${fovPos[0]},${fovPos[1]} ${this.center[0]},${this.center[1]} ${stop}`;
        this.center[0] += this.velocity[0] * state.dt;
        this.center[1] += this.velocity[1] * state.dt;
        
        this.ratio = ratio;
        
    }
    
    updateCameraMatrix(matrix) {
        const s = this.scale;
        const r = this.ratio;
        const sx = s/Math.max(r, 1);
        const sy = s/Math.min(r, 1)
        matrix.set([
            sx, 0, 0, 0,
            0, sy, 0, 0,
            0, 0, -s, 0,
            -this.center[0]*sx, -this.center[1]*sy, 0, 1
        ]);
    }
}

class CameraDynamicsShoulder {
    constructor(offset, angle) {
        this.offset = offset || [-2.0, 0.0, 1.0];
        this.angle = angle || Math.PI/6;
        this.center = [0, 0, 0];
        this.gamma = null;
        this.focal = null;
    }
    
    // ratio = width / height
    update(state, ratio) {
        function getParam(name) {
            return parseFloat(document.querySelector(`#camera-${name}`).value);
        }
        this.offset[0] = getParam("x");
        this.offset[1] = getParam("y");
        this.offset[2] = getParam("z");
        this.angle = getParam("angle");
        this.focal = parseFloat(document.querySelector("#camera-focal").value);
        const tankPos = state.tanks.state.getPosition(state.tanks.state.activeTank);
        const dt = state.dt;
        this.gamma = parseFloat(document.querySelector("#camera-gamma").value);
        const gamma = this.gamma * dt;
        this.center[0] = (1-gamma)*this.center[0] + gamma*tankPos[0];
        this.center[1] = (1-gamma)*this.center[1] + gamma*tankPos[1];
        this.center[2] = (1-gamma)*this.center[2] +
            gamma*state.terrain.getElevation(tankPos[0], tankPos[1]);
        const currentFrame = state.tanks.state.getFrame(state.tanks.state.activeTank);
        if(!this.frame) {
            this.frame = currentFrame
        } else {
            for(let i=0; i < currentFrame.length; i++) {
                this.frame[i] = (1-gamma)*this.frame[i] + gamma*currentFrame[i];
            }
        }
        this.ratio = ratio;
    }
    
    updateCameraMatrix(matrix) {
        const s = 1;
        const r = this.ratio;
        const sx = s/Math.max(r, 1);
        const sy = s/Math.min(r, 1);
        // e_x, e_y and e_z are the screen space vectors in world coordinates
        // +Z is up in view coordinates
        // e_1 and e_2 is the basis of the tank moving frame in world coordinates
        const e_1 = [this.frame[0], this.frame[1], 0];
        const e_2 = [this.frame[2], this.frame[3], 0];
        const e_3 = [0, 0, 1];
        const frameBasis = new Float32Array([
            e_1[0], e_1[1], e_1[2],
            e_2[0], e_2[1], e_2[2],
            e_3[0], e_3[1], e_3[2]
        ]);
        const cameraCenter = new Float32Array([
            this.center[0] + this.offset[0]*e_1[0] + this.offset[1]*e_2[0] + this.offset[2] * e_3[0],
            this.center[1] + this.offset[0]*e_1[1] + this.offset[1]*e_2[1] + this.offset[2] * e_3[1],
            this.center[2] + this.offset[0]*e_1[2] + this.offset[1]*e_2[2] + this.offset[2] * e_3[2]
        ]);
        const e_y = new Float32Array([
            Math.sin(this.angle) * e_1[0] + Math.cos(this.angle) * e_3[0],
            Math.sin(this.angle) * e_1[1] + Math.cos(this.angle) * e_3[1],
            Math.sin(this.angle) * e_1[2] + Math.cos(this.angle) * e_3[2],
        ]);        
        const e_z = new Float32Array([
            -Math.cos(this.angle) * e_1[0] + Math.sin(this.angle) * e_3[0], 
            -Math.cos(this.angle) * e_1[1] + Math.sin(this.angle) * e_3[1], 
            -Math.cos(this.angle) * e_1[2] + Math.sin(this.angle) * e_3[2]
        ]);
        const e_x = crossProduct(e_y, e_z);
        const b = new Float32Array([
            -matmul(e_x, cameraCenter, 1, 1)[0],
            -matmul(e_y, cameraCenter, 1, 1)[0],
            -matmul(e_z, cameraCenter, 1, 1)[0]
        ]);
        const cameraMatrix = new Float32Array([
            e_x[0], e_y[0], e_z[0], 0,
            e_x[1], e_y[1], e_z[1], 0,
            e_x[2], e_y[2], e_z[2], 0,
            b[0], b[1], b[2], 1
        ]);
        
        const d = this.focal;
        
        const perspectiveMatrix = new Float32Array([
            d, 0, 0, 0,
            0, d, 0, 0,
            0, 0, -1, -1,
            0, 0, -d, 0
        ]);
        /*
        const perspectiveMatrix = new Float32Array([
            1, 0, 0, 0,
            0, 1, 0, 0,
            0, 0, -1, 0,
            0, 0, 0, 1
        ]);
        */
        matmul(perspectiveMatrix, cameraMatrix, 4, 4, matrix);
//         matrix.set(cameraMatrix);
    }
}

async function initShaders(gl) {
    const shaderSources = {
        "ground": {
            vertexShaderUrl: "js/ground_vertex.glsl",
            fragmentShaderUrl: "js/ground_fragment.glsl"
        },
        "gltf": {
            vertexShaderUrl: "js/gltf.vert.glsl",
            fragmentShaderUrl: "js/gltf.frag.glsl"
        },        
        "sprite": {
            vertexShaderUrl: "js/sprite_vertex.glsl",
            fragmentShaderUrl: "js/sprite_fragment.glsl"
        },
        "tank": {
            vertexShaderUrl: "js/tank.vert.glsl",
            fragmentShaderUrl: "js/tank.frag.glsl"
        },        
        "lines": {
            vertexShaderUrl: "js/lines_vertex.glsl",
            fragmentShaderUrl: "js/lines_fragment.glsl"
        },
        "terrain": {
            vertexShaderUrl: "js/terrain.vert.glsl",
            fragmentShaderUrl: "js/terrain.frag.glsl"            
        }
    }
    return await GT.loadShaders(gl, shaderSources);
}

function createLinesNode(gl, state, positions, index) {
    const program = state.shaders.lines.program;
    const positionLocation = gl.getAttribLocation(program, "position"); 
    const vao = GT.createBasicVAO(gl, positionLocation, positions, null, null, index);

    const timeUniform = gl.getUniformLocation(program, "time");
        
    const projectionLocation = gl.getUniformLocation(program, "projectionMatrix");

    const worldMatrixLocation = gl.getUniformLocation(program, "worldMatrix");
    const worldMatrix = new Float32Array(Identity4x4);

    const drawing = {
        program,
        vao,
        uniforms: [
            {
                type: "uniformMatrix4fv",
                location: projectionLocation,
                values: [false, state.projectionMatrix]
            },
            {
                type: "uniformMatrix4fv",
                location: worldMatrixLocation,
                values: [false, worldMatrix]
            }
        ],
        textures: [],
        mode: gl.LINES,
        offset: 0,
        count: index ? index.length : positions.length / 3,
        indexed: index ? true : false
    }
    return {drawing, worldMatrix};
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

class Terrain {
    // region: {xmin, xmax, ymin, ymax}
    constructor(url, region) {
        this.url = url;
        this.region = region;
    }
    async load() {
        const img = this.img = await GT.loadImage(this.url);
        const canvas = document.createElement("canvas");
        const ctx = canvas.getContext("2d");
        canvas.width = img.width;
        canvas.height = img.height;
        ctx.drawImage(img, 0, 0);
//         console.log(canvas.width, canvas.height);
        this.imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
//         console.log(this.imageData);
        this.buildMesh(this.region.xres, this.region.yres);
    }
    getElevation(x, y, time) {
        const {xmin, xmax, ymin, ymax, zmin, zmax} = this.region;
        const u = (y - ymin)/(ymax - ymin);
        const v = (x - xmin)/(xmax - xmin);
        let i = this.imageData.height - Math.floor(u*this.imageData.height);
        let j = Math.floor(v*this.imageData.width);
        i = Math.max(0, Math.min(i, this.imageData.height-1));
        j = Math.max(0, Math.min(j, this.imageData.width-1));        
        const val = this.imageData.data[4*(i*this.imageData.width+j)];
        const elevation = zmin + val/255*(zmax-zmin);
        if(time) {
//             logger.log(time, "getElevation", x, y, u, v, i, j, val, elevation);
        }
        return elevation;
    }
    
    getDerivative(x, y, dx, dy, time) {
        const norm = Math.sqrt(dx**2+dy**2);
        const h = Math.max(
            this.region.xmax-this.region.xmin,
            this.region.ymax-this.region.ymin
        ) / Math.min(this.imageData.width, this.imageData.height);
        const dx1 = dx/norm;
        const dy1 = dy/norm;
        let de = 0;
        for(let i=1; i < 10; i++) {
            const e1 = this.getElevation(x, y, time);
            const e2 = this.getElevation(x+dx1*i*h, y+dy1*i*h, time);
            de += (e2-e1)/(i*h);
//             logger.log(time, "getDerivative", x, y, dx, dy, norm, h, dx1, dy1, e1, e2, de);        
        }
        de /= 10;
        return de;
    }
    
    buildMesh(resolutionX, resolutionY) {
        const n = Math.floor((this.region.xmax-this.region.xmin)/resolutionX) + 1;
        const m = Math.floor((this.region.ymax-this.region.ymin)/resolutionY) + 1;
        const texcoords = new Float32Array(n*m*2);
        const vertices = new Float32Array(n*m*3);
        const normals = new Float32Array(n*m*3);
        const triangles = new Uint16Array(2*(n-1)*(m-1)*3);
        console.log(n, m);
        for(let i=0; i < n; i++) {
            for(let j=0; j < m; j++) {
                const x = this.region.xmin+i*resolutionX;
                const y = this.region.ymin+j*resolutionY;
                vertices[3*(j*n+i)] = x
                vertices[3*(j*n+i)+1] = y;
                vertices[3*(j*n+i)+2] = this.getElevation(x, y);
                texcoords[2*(j*n+i)] = i/n;
                texcoords[2*(j*n+i)+1] = j/m;
            }
        }
        for(let i=0; i < n-1; i++) {
            for(let j=0; j < m-1; j++) {
                const ofs = 2*(j*(n-1)+i)*3;
                triangles[ofs] = j*n+i; 
                triangles[ofs+1] = j*n+(i+1);
                triangles[ofs+2] = (j+1)*n+i;
                triangles[ofs+3] = (j+1)*n+i;
                triangles[ofs+4] = j*n+i+1;
                triangles[ofs+5] = (j+1)*n+(i+1);
            }
        }
        const a = new Float32Array(3);
        const b = new Float32Array(3);
        /*
        for(let i=0; i < n-1; i++) {
            for(let j=0; j < m-1; j++) {
                // use the triangle with this vertex in the lower 
                // left for computing the normal
                const k1 = 3*(i*n+j);
                const k2 = 3*((i+1)*n+j);
                const k3 = 3*(i*n+(j+1));
                const v = vertices;
                a[0] = v[k2] - v[k1];
                a[1] = v[k2+1] - v[k1+1];
                a[2] = v[k2+2] - v[k1+2];
                b[0] = v[k3] - v[k1];
                b[1] = v[k3+1] - v[k1+1];
                b[2] = v[k3+2] - v[k1+2];
                const c = normals.subarray(3*(j*n+i), 3*(j*n+i+1));
                crossProduct(b, a, c);
                const norm = Math.sqrt(c[0]**2+c[1]**2+c[2]**2);
                c[0] /= norm; c[1] /= norm; c[2] /= norm;
            }
        }
        */
        const normalCounts = new Uint32Array(vertices.length/3);
        const c = new Float32Array(3);
        for(let i=0; i < triangles.length/3; i++) {
            const k1 = 3*triangles[3*i];
            const k2 = 3*triangles[3*i+1];
            const k3 = 3*triangles[3*i+2];
            const v = vertices;
            a[0] = v[k2] - v[k1];
            a[1] = v[k2+1] - v[k1+1];
            a[2] = v[k2+2] - v[k1+2];
            b[0] = v[k3] - v[k1];
            b[1] = v[k3+1] - v[k1+1];
            b[2] = v[k3+2] - v[k1+2];
            crossProduct(a, b, c);
            const norm = Math.sqrt(c[0]**2+c[1]**2+c[2]**2);
//             const norm = 1.0;
            c[0] /= norm; c[1] /= norm; c[2] /= norm;
            normals[k1] += c[0]; normals[k2] += c[0]; normals[k3] += c[0];
            normals[k1+1] += c[1]; normals[k2+1] += c[1]; normals[k3+1] += c[1];
            normals[k1+2] += c[2]; normals[k2+2] += c[2]; normals[k3+2] += c[2];
            normalCounts[triangles[3*i]]++; 
            normalCounts[triangles[3*i+1]]++; 
            normalCounts[triangles[3*i+2]]++;
        }
        /*
        for(let i=0; i < normalCounts.length; i++) {
            if(normalCounts[i] != 0) {
                normals[3*i] /= normalCounts[i];
                normals[3*i+1] /= normalCounts[i];
                normals[3*i+2] /= normalCounts[i];
            }
        }
        */
        for(let i=0; i < normalCounts.length; i++) {
            const norm = Math.sqrt(
                normals[3*i]**2 + normals[3*i+1]**2 + normals[3*i+2]**2
            );
            if(norm > 1e-12) {
                normals[3*i] /= norm;
                normals[3*i+1] /= norm;
                normals[3*i+2] /= norm;
            }
        }
        this.vertices = vertices;
        this.normals = normals;
        this.triangles = triangles;
        this.texcoords = texcoords;
        console.log(vertices, normals, texcoords, normalCounts, triangles);
    }
}

class TerrainDrawing {
    constructor(gl, terrain, attributeLocations, imgs) {
        this.triangleCount = terrain.triangles.length;
        this.attributeLocations = attributeLocations;
        this.vertexArray = gl.createVertexArray();
        gl.bindVertexArray(this.vertexArray);
        this.vertexBuffer = gl.createBuffer();
        gl.bindBuffer(gl.ARRAY_BUFFER, this.vertexBuffer);
        gl.bufferData(gl.ARRAY_BUFFER, terrain.vertices, gl.STATIC_DRAW);
        gl.enableVertexAttribArray(attributeLocations.position);
        gl.vertexAttribPointer(
            attributeLocations.position, 3, gl.FLOAT, false, 0, 0
        );
        this.normalBuffer = gl.createBuffer();
        gl.bindBuffer(gl.ARRAY_BUFFER, this.normalBuffer);
        gl.bufferData(gl.ARRAY_BUFFER, terrain.normals, gl.STATIC_DRAW);
        gl.enableVertexAttribArray(attributeLocations.normal);
        gl.vertexAttribPointer(
            attributeLocations.normal, 3, gl.FLOAT, false, 0, 0
        );
        this.texcoordBuffer = gl.createBuffer();
        gl.bindBuffer(gl.ARRAY_BUFFER, this.texcoordBuffer);
        gl.bufferData(gl.ARRAY_BUFFER, terrain.texcoords, gl.STATIC_DRAW);
        gl.enableVertexAttribArray(attributeLocations.texcoords);
        gl.vertexAttribPointer(
            attributeLocations.texcoords, 2, gl.FLOAT, false, 0, 0
        );
        this.triangleBuffer = gl.createBuffer();
        gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, this.triangleBuffer);
        gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, terrain.triangles, gl.STATIC_DRAW);
        gl.bindVertexArray(null);

        const groundTexture = gl.createTexture();
        {
            const {width, height} = imgs[0];
            const N = imgs.length;
            gl.bindTexture(gl.TEXTURE_2D, groundTexture);   
            gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.NEAREST);
            gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.NEAREST);
            gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
            gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);        
            const data = new Uint8Array(4*N*width*height);
            gl.texImage2D(
                gl.TEXTURE_2D, 0, gl.RGBA, N*width, height, 0, 
                gl.RGBA, gl.UNSIGNED_BYTE, data);          

            for(let i=0; i < imgs.length; i++) {
                gl.texSubImage2D(
                    gl.TEXTURE_2D, 0, i*width, 0, 
                    gl.RGBA, gl.UNSIGNED_BYTE, imgs[i]);
                console.log("texSubImage2D", gl.TEXTURE_2D, 0, i*width, 0, gl.RGBA, gl.UNSIGNED_BYTE, imgs[i]);
            }
        }
        this.groundTexture = groundTexture;
    }
    
    draw(gl, shader, state) {
        gl.useProgram(shader.program);
        gl.bindVertexArray(this.vertexArray);
        const projectionMatrixLocation = gl.getUniformLocation(
            shader.program, "projectionMatrix"
        );
        gl.uniformMatrix4fv(
            projectionMatrixLocation, false, state.projectionMatrix
        );
        gl.uniform1f(
            gl.getUniformLocation(shader.program, "time"), state.time
        );
        gl.uniform1i(
            gl.getUniformLocation(shader.program, "groundSampler"), 0
        );
        gl.activeTexture(gl.TEXTURE0);
        gl.bindTexture(gl.TEXTURE_2D, this.groundTexture);
        gl.drawElements(gl.TRIANGLES, this.triangleCount, gl.UNSIGNED_SHORT, 0);
    }
}

async function createGroundDrawing(gl, state) {
    const program = state.shaders.ground.program;

    const texcoords = twoTriangles.texcoords;
    const positions = new Float32Array(twoTriangles.positions);
    for(let i=0; i < positions.length; i++) {
        positions[i] *= 5;
    }

    const positionLocation = gl.getAttribLocation(program, "position");
    const texcoordLocation = gl.getAttribLocation(program, "texcoord");
    
    const vao = GT.createBasicVAO(
        gl, positionLocation, positions, texcoordLocation, texcoords);
    const timeUniform = gl.getUniformLocation(program, "time");
        
    const projectionLocation = gl.getUniformLocation(program, "projectionMatrix");

    const worldMatrixLocation = gl.getUniformLocation(program, "worldMatrix");
    const worldMatrix = new Float32Array(Identity4x4);

    const img = await GT.loadImage("perlin12.png");

    const mapTexture = gl.createTexture();
    gl.bindTexture(gl.TEXTURE_2D, mapTexture);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);

    
    //     gl.texStorage2D(gl.TEXTURE_2D, 1, gl.RGBA8, 512, 512);
    //     gl.texSubImage2D(gl.TEXTURE_2D, 0, 0, 0, 512, 512, gl.RGBA, gl.UNSIGNED_BYTE, img);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, img.width, img.height, 0, gl.RGBA, gl.UNSIGNED_BYTE, null);          
    gl.texSubImage2D(gl.TEXTURE_2D, 0, 0, 0, gl.RGBA, gl.UNSIGNED_BYTE, img);       
    const mapTextureLocation = gl.getUniformLocation(program, "mapSampler");
    
    const groundTexture = gl.createTexture();
    {
        const baseurl = "kenney_topdownTanksRedux/PNG/Retina";
        const srcs = ["tileGrass1.png", "tileSand1.png"];
        const imgs = [];
        for(const src of srcs) {
            imgs.push(await GT.loadImage(baseurl + "/" + src));
        }
        console.log(imgs);
        const {width, height} = imgs[0];
        const N = imgs.length;
//         gl.bindTexture(gl.TEXTURE_2D_ARRAY, groundTexture);
//         gl.texStorage3D(
//             gl.TEXTURE_2D_ARRAY, 1, gl.RGBA8, 
//             width, height, imgs.length);
        gl.bindTexture(gl.TEXTURE_2D, groundTexture);   
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.NEAREST);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.NEAREST);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);        
        const data = new Uint8Array(4*N*width*height);
        gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, N*width, height, 0, gl.RGBA, gl.UNSIGNED_BYTE, data);          
        
        for(let i=0; i < imgs.length; i++) {
            gl.texSubImage2D(gl.TEXTURE_2D, 0, i*width, 0, gl.RGBA, gl.UNSIGNED_BYTE, imgs[i]);
            console.log("texSubImage2D", gl.TEXTURE_2D, 0, i*width, 0, gl.RGBA, gl.UNSIGNED_BYTE, imgs[i]);
//             gl.texSubImage3D(gl.TEXTURE_2D_ARRAY, 0, 
//                              0, 0, i, 
//                              width, height, 1,
//                              gl.RGBA, gl.UNSIGNED_BYTE,
//                              imgs[i]);
        }
    }
    const groundTextureLocation = gl.getUniformLocation(program, "groundSampler");    
    const drawing = {
        program,
        vao,
        uniforms: [
            {
                type: "uniform1i",
                location: mapTextureLocation,
                values: [0]
            },            
            {
                type: "uniform1i",
                location: groundTextureLocation,
                values: [1]
            },                        
            {
                type: "uniformMatrix4fv",
                location: projectionLocation,
                values: [false, state.projectionMatrix]
            },
            {
                type: "uniformMatrix4fv",
                location: worldMatrixLocation,
                values: [false, worldMatrix]
            }
        ],
        textures: [
            {
                unit: gl.TEXTURE0,
                target: gl.TEXTURE_2D,
                texture: mapTexture
            },
            {
                unit: gl.TEXTURE1,
//                 target: gl.TEXTURE_2D_ARRAY,
                target: gl.TEXTURE_2D,                
                texture: groundTexture
            }
        ],
        mode: gl.TRIANGLES,
        offset: 0,
        count: positions.length / 3,
        indexed: false
    }    
    return {worldMatrix, drawing};
}


class SpriteDrawing {
    constructor(gl, shader, img) {
        const program = shader.program;

        const ratio = img.height / img.width;
        const positionMatrix = new Float32Array([
            1, 0, 0,
            0, ratio, 0,
            0, 0, 1
        ]);
        const positions = matmul(positionMatrix, twoTriangles.positions, 
                                 3, twoTriangles.positions.length/3);

        const texcoords = new Float32Array(twoTriangles.texcoords);
        
        const attribLocations = {};
        attribLocations.position = gl.getAttribLocation(program, "position");
        attribLocations.texcoord = gl.getAttribLocation(program, "texcoord");
    
        const vao = GT.createBasicVAO(
            gl, 
            attribLocations.position, positions, 
            attribLocations.texcoord, texcoords);

        const uniformLocations = {};
        uniformLocations.time = gl.getUniformLocation(program, "time");
        uniformLocations.projectionMatrix = gl.getUniformLocation(
            program, "projectionMatrix");
        uniformLocations.worldMatrix = gl.getUniformLocation(program, "worldMatrix");

        const worldMatrices = [];
        const spriteCount = 0;
    
        const textures = {};

        textures.sprite = gl.createTexture();
        gl.bindTexture(gl.TEXTURE_2D, textures.sprite);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
//         gl.texStorage2D(gl.TEXTURE_2D, 1, gl.RGBA8, img.width, img.height);
//         gl.texSubImage2D(gl.TEXTURE_2D, 0, 0, 0, img.width, img.height, gl.RGBA, gl.UNSIGNED_BYTE, img);
        gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, img.width, img.height, 0, gl.RGBA, gl.UNSIGNED_BYTE, null);          
        gl.texSubImage2D(gl.TEXTURE_2D, 0, 0, 0, gl.RGBA, gl.UNSIGNED_BYTE, img);           
        uniformLocations.spriteSampler = gl.getUniformLocation(
            program, "spriteSampler");
        
        Object.assign(
            this, 
            {program, vao, count: positions.length / 3,
             attribLocations, uniformLocations, textures, 
             worldMatrices, spriteCount});
    }
            
    draw(gl, state) {
        const {program, vao, count,
               attribLocations, uniformLocations, textures,
               worldMatrices, spriteCount} = this;
        gl.useProgram(program);
        gl.bindVertexArray(vao);
        
        gl.uniform1f(uniformLocations.time, state.time);
        gl.uniformMatrix4fv(
            uniformLocations.projectionMatrix, false, state.projectionMatrix);
        
        gl.uniform1i(uniformLocations.spriteSampler, 0);
        gl.activeTexture(gl.TEXTURE0);
        gl.bindTexture(gl.TEXTURE_2D, textures.sprite);
        for(let i=0; i < spriteCount; i++) {
            const matrix = worldMatrices[i];
            gl.uniformMatrix4fv(uniformLocations.worldMatrix, false, matrix);
            gl.drawArrays(gl.TRIANGLES, 0, count);
//             document.querySelector("#msglog-1").innerHTML += matrix;
        }
    }
}

// Drawing from a GLTF/GLB file
class GLTFDrawing {
    constructor(url, alignmentMatrix) {
        this.url = url;
        this.alignmentMatrix = alignmentMatrix || Identity4x4;
        this.primitiveVertexArrays = {};
        this.bufferViewBuffers = [];
        this.nodeMatrices = [];
        this.worldMatrices = [];
        this.hitTimes = [];
    }
    
    async loadBufferViewGLBuffer(gl, data, bufferPromises, index, target) {
        if(this.bufferViewBuffers[index]) {
            return this.bufferViewBuffers[index];
        }
        const bufferView = data.bufferViews[index];
        const bufferData = await bufferPromises[bufferView.buffer];
        const bufferViewData = new Uint8Array(
            bufferData, bufferView.byteOffset || 0, bufferView.byteLength
        );
        const glBuffer = gl.createBuffer();
        gl.bindBuffer(target, glBuffer);
        gl.bufferData(target, bufferViewData, gl.STATIC_DRAW);
        this.bufferViewBuffers[index] = glBuffer;
        return glBuffer;
    }

        
    async loadPrimitiveVertexArray(gl, attributeIndices, data, bufferPromises, meshIndex, primitiveIndex) {
        const key = `${meshIndex}.${primitiveIndex}`;
        if(this.primitiveVertexArrays[key]) {
            return this.primitiveVertexArrays[key];
        }
        const accessorTypeToNumComponentsMap = {
            "SCALAR": 1,
            "VEC2": 2,
            "VEC3": 3,
            "VEC4": 4
        };
        const primitive = data.meshes[meshIndex].primitives[primitiveIndex];
        const vertexArray = gl.createVertexArray();
        gl.bindVertexArray(vertexArray);
        for(const attribute in primitive.attributes) {
            const attributeIndex = attributeIndices[attribute];
            if(attributeIndex == -1) continue;            
            const accessor = data.accessors[primitive.attributes[attribute]];
            // TODO: accessor.bufferView can be undefined, defaults to all zeros
            const bufferView = data.bufferViews[accessor.bufferView];
            const buffer = await this.loadBufferViewGLBuffer(
                gl, data, bufferPromises, accessor.bufferView, gl.ARRAY_BUFFER
            );
            gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
            // TODO: catch case where accessor.type is a matrix
            const size = accessorTypeToNumComponentsMap[accessor.type];
            gl.enableVertexAttribArray(attributeIndex);
            gl.vertexAttribPointer(
                attributeIndex, size, accessor.componentType, 
                accessor.normalized == true, bufferView.byteStride,
                accessor.byteOffset
            );
        }
        if(primitive.indices) {
            const accessor = data.accessors[primitive.indices];
            // TODO: accessor.bufferView can be undefined, defaults to all zeros
            const bufferView = data.bufferViews[accessor.bufferView];
            const buffer = await this.loadBufferViewGLBuffer(
                gl, data, bufferPromises, accessor.bufferView, 
                gl.ELEMENT_ARRAY_BUFFER
            );
            gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, buffer);
        }
        this.primitiveVertexArrays[key] = vertexArray;
        gl.bindVertexArray(null);
        return vertexArray;
    }
    
    buildGeometryTree(nodeIndex) {
        const node = this.data.nodes[nodeIndex];
        if(!this.nodeMatrices[nodeIndex]) {
            this.nodeMatrices[nodeIndex] = new Float32Array(Identity4x4);
        }
        const children = node.children || [];
        const geometryNode = {
            translation: node.translation || [0, 0, 0],
            rotation: node.rotation || [1, 0, 0, 0],
            scale: node.scale || [1, 1, 1],
            matrix: this.nodeMatrices[nodeIndex],
            children: children.map(c => this.buildGeometryTree(c))
        }
        return geometryNode;
    }
    // data is parsed json from gltf file
    async load(gl, attributeIndices) {
        const response = await fetch(this.url);
        const data = this.data = await response.json();
        const bufferPromises = data.buffers.map(
            async buf => await (await fetch("models/" + buf.uri)).arrayBuffer()
        );
        for(let i=0; i < data.meshes.length; i++) {
            const mesh = data.meshes[i];
            for(let j=0; j < mesh.primitives.length; j++) {
                await this.loadPrimitiveVertexArray(
                    gl, attributeIndices, data, bufferPromises, i, j
                )
            }
        }
        for(const scene of data.scenes) {
            const sceneTree = {
                scale: [1, 1, 1],
                translation: [0, 0, 0],
                rotation: [1, 0, 0, 0],
                matrix: new Float32Array(Identity4x4),
                children: []
            }
            for(const nodeIndex of scene.nodes) {
                const tree = this.buildGeometryTree(nodeIndex);
                sceneTree.children.push(tree);
            }
            GT.updateGeometryTree(sceneTree, {matrix: this.alignmentMatrix});
            console.log(sceneTree);
        }
    }
    
    draw(gl, program, state) {
        gl.useProgram(program);
        const uniformLocations = {};
        uniformLocations.time = gl.getUniformLocation(program, "time");
        uniformLocations.projectionMatrix = gl.getUniformLocation(
            program, "projectionMatrix"
        );
        uniformLocations.nodeMatrix = gl.getUniformLocation(
            program, "nodeMatrix"
        );        
        uniformLocations.worldMatrix = gl.getUniformLocation(
            program, "worldMatrix"
        );
        uniformLocations.color = gl.getUniformLocation(program, "color");

        gl.uniform1f(uniformLocations.time, state.time);
        gl.uniformMatrix4fv(
            uniformLocations.projectionMatrix, false, state.projectionMatrix
        );

        const data = this.data;
        let enableLog = false;
//         if(!this.lastLogTime || (state.time - this.lastLogTime) > 5) {
//             this.lastLogTime = state.time;
//             enableLog = true;
//         }
        for(const worldMatrix of this.worldMatrices) {
            gl.uniformMatrix4fv(
                uniformLocations.worldMatrix, false, worldMatrix
            );            
            for(let k=0; k < data.nodes.length; k++) {
                const i = data.nodes[k].mesh;
                if(i === undefined)
                    continue;
                const mesh = data.meshes[i];
                const nodeMatrix = this.nodeMatrices[k];
                gl.uniformMatrix4fv(
                    uniformLocations.nodeMatrix, false, nodeMatrix);
                for(let j=0; j < mesh.primitives.length; j++) {
                    const primitive = mesh.primitives[j];
                    if(primitive.material !== undefined) {
                        const material = data.materials[primitive.material];
                        const color = material.pbrMetallicRoughness.baseColorFactor;
                        gl.uniform4fv(uniformLocations.color, color);
                    } else {
                        gl.uniform4fv(uniformLocations.color, [1, 1, 1, 1]);
                    }
                    const vertexArray = this.primitiveVertexArrays[`${i}.${j}`];
                    gl.bindVertexArray(vertexArray);
                    if(primitive.indices) {
                        const accessor = data.accessors[primitive.indices];
                        gl.drawElements(
                            primitive.mode || 4, accessor.count, accessor.componentType,
                            accessor.byteOffset || 0
                        );
                        if(enableLog) {
                            console.log("drawElements", primitive.mode || 4, accessor.count, accessor.componentType,
                            accessor.byteOffset || 0);
                        }
                    } else {
                        const accessor = data.accessors[primitive.attributes.POSITION];
                        gl.draw(primitive.mode || 4, 0, accessor.count);
                    }
                }
            }
        }        
    }
        
    update(state) {}
}

class TankGLTFDrawing extends GLTFDrawing {
    update(state) {
        const tankState = state.tanks.state;
        while(this.worldMatrices.length < tankState.count) {
            this.hitTimes.push(0);
            this.worldMatrices.push(new Float32Array(Identity4x4));
        }
        if(this.worldMatrices.length > tankState.count) {
            this.worldMatrices.splice(tankState.count);
        }
        for(let i=0; i < this.worldMatrices.length; i++) {
            this.hitTimes[i] = tankState.hitTimes[i];
            const tank_angle = tankState.orientations[i];
            let e0_0 = Math.cos(tank_angle-Math.PI/2);
            let e0_1 = Math.sin(tank_angle-Math.PI/2);
            let e1_0 = -e0_1;
            let e1_1 = e0_0;
            const xpos = tankState.positions[2*i];
            const ypos = tankState.positions[2*i+1];
            let zpos = state.terrain.getElevation(xpos, ypos, state);
            let e0_2 = state.terrain.getDerivative(xpos, ypos, e0_0, e0_1, state.time);
            {
                const e0_norm = Math.sqrt(e0_0**2+e0_1**2+e0_2**2);
                e0_0 /= e0_norm;
                e0_1 /= e0_norm;
                e0_2 /= e0_norm;
            }
            let e1_2 = state.terrain.getDerivative(xpos, ypos, e1_0, e1_1, state.time);
            {
                const e1_norm = Math.sqrt(e1_0**2+e1_1**2+e1_2**2);
                e1_0 /= e1_norm;
                e1_1 /= e1_norm;
                e1_2 /= e1_norm;
            }            
//             logger.log(state.time, "dz", xpos, ypos, e0_0, e0_1, dz);
            if(tankState.life[i] <= 0) {
                zpos = -1;
            }
            this.worldMatrices[i].set([
                e0_0, e0_1, e0_2, 0,
                e1_0, e1_1, e1_2, 0,
                0, 0, 1, 0,                                
                xpos, ypos, zpos, 1
            ]);
        }        
    }
}


class ProjectileGLTFDrawing extends GLTFDrawing {
    update(state) {
        const projectileState = state.projectiles.state;
        while(this.worldMatrices.length < projectileState.count) {
            this.worldMatrices.push(new Float32Array(Identity4x4));
        }
        if(this.worldMatrices.length > projectileState.count) {
            this.worldMatrices.splice(projectileState.count);
        }        
        const count = this.count;
        const pos = projectileState.positions;
        const frames = projectileState.frames;
        for(let i=0; i < projectileState.count; i++) {
            const e0_0 = frames[4*i];
            const e0_1 = frames[4*i+1];
            const e1_0 = frames[4*i+2];
            const e1_1 = frames[4*i+3];
            const z = projectileState.elevations[i];            
            this.worldMatrices[i].set([
                e1_0, e1_1, 0, 0,
                e0_0, e0_1, 0, 0,
                0, 0, 1, 0,
                pos[2*i], pos[2*i+1], z, 1
            ]);
        }
    }
}



async function testGLTFTanks(gl, program) {
//     console.log(program);
    const s = 0.1;
    const alignmentMatrix = new Float32Array([
        s, 0, 0, 0,
        0, 0, s, 0,
        0, s, 0, 0,
        0, 0, 0, 1,
    ]);
    const attributeIndices = {
        "POSITION" : gl.getAttribLocation(program, "position"),
        "NORMAL" : gl.getAttribLocation(program, "normal"),
        "TEXCOORD_0" : gl.getAttribLocation(program, "texcoord")
    }
//     console.log(attributeIndices);
    const drawing = new TankGLTFDrawing(
        "models/tank geometry.gltf", alignmentMatrix
    );
    await drawing.load(gl, attributeIndices);
//     console.log(drawing);
    return drawing;
}

async function testGLTFProjectiles(gl, program) {
//     console.log(program);
    const s = 0.1;
    const alignmentMatrix = new Float32Array([
        0, s, 0, 0,
        0, 0, s, 0,
        s, 0, 0, 0,
        0, 0, 1.88*s, 1,
    ]);
    const attributeIndices = {
        "POSITION" : gl.getAttribLocation(program, "position"),
        "NORMAL" : gl.getAttribLocation(program, "normal"),
        "TEXCOORD_0" : gl.getAttribLocation(program, "texcoord")
    }
//     console.log(attributeIndices);
    const drawing = new ProjectileGLTFDrawing(
        "models/bullet.gltf", alignmentMatrix
    );
    await drawing.load(gl, attributeIndices);
//     console.log(drawing);
    return drawing;
}



async function initObstacles(gl, shaders) {
    const images = {
        barrel: "kenney_topdownTanksRedux/PNG/Retina/barrelBlack_side.png",
        barricade: "kenney_topdownTanksRedux/PNG/Retina/barricadeWood.png"
    }
    const objects = {}
    for(const type in images) {
        const image = await GT.loadImage(images[type]);
        const drawing = new SpriteDrawing(gl, shaders.sprite, image);
        objects[type] = {
            drawing
        }
    }
    return objects;
}

function updateObjectDrawing(drawing, objects) {
    drawing.worldMatrices = [];
    const min = -4;
    const max = 4;
    for(const obj of objects) {
        const x = (obj.x - 0.5)*(max-min);
        const y = -(obj.y - 0.5)*(max-min);        
        const s = 0.1;
        const mat = new Float32Array([
            s, 0, 0, 0,
            0, s, 0, 0,
            0, 0, 1, 0,
            x, y, 0, 1
        ]);
        drawing.worldMatrices.push(mat);
    }
    drawing.spriteCount = drawing.worldMatrices.length;
//     console.log(drawing);
}

function updateObstacles(state) {
    for(const msg of state.network.incoming) {
        if(msg.type != "mapUpdate")
            continue;
        console.log(msg);
//         continue;
        for(const type in msg.mapState.objects) {
            updateObjectDrawing(state.obstacles[type].drawing, msg.mapState.objects[type]);
        }
    }   
}

async function initTanks(gl, shaders) {
    const baseurl = "kenney_topdownTanksRedux/PNG/Retina";
    const img = await GT.loadImage(baseurl + "/tank_red.png");
//     const img = await GT.loadImage("tank_bigRedGreen.png");

    const drawing = new TankDrawing(gl, shaders, img);
    const N = 10;
    const Nmax = 100;
    for(let i=0; i < N; i++) {
        const worldMatrix = new Float32Array(Identity4x4);
//        await drawing.init(gl, shaders);
//        const [x, z] = [0, 0];
        drawing.worldMatrices.push(worldMatrix);
        drawing.hitTimes.push(0);
        drawing.spriteCount++;
    }
    const tankState = new TankState(Nmax);
    const tankState1 = new TankState(Nmax);
    for(let i=0; i < 10; i++) {
        const [x, y] = [5*(2*Math.random()-1), 5*(2*Math.random()-1)];
        tankState.positions[2*i] = x;
        tankState.positions[2*i+1] = y;
        tankState.orientations[i] = y <= 0 ? -Math.PI : 0;
    }
    tankState.positions[0] = 0.0;
    tankState.positions[1] = 0.0;
    tankState.orientations[0] = -Math.PI;
    tankState.positions[2] = 0.0;
    tankState.positions[3] = 0.5;
    tankState.orientations[1] = 0;
    tankState.ids[0] = Math.floor(Math.random() * 1e6);
    tankState.count = 10;
    const soundscape = new TankSoundscape();
    return {state: tankState, nextState: tankState1, drawing, soundscape};
}

class TankState {
    constructor(N) {
        this.activeTank = 0;
        this.count = 0;
        this.maxCount = N;
        this.ids = new Uint32Array(N);
        this.positions = new Float32Array(N*2);
        this.orientations = new Float32Array(N);
        this.velocities = new Float32Array(N);
        this.accelerations = new Float32Array(N);
        this.torques = new Float32Array(N);
        this.angularAccelerations = new Float32Array(N);
        this.updateTimes = new Float32Array(N);
        this.hitTimes = new Float32Array(N);        
        this.hitTimes.fill(-1e6);
        this.life = new Float32Array(N);
        this.life.fill(5);
        this.worldMatrices = [];
        for(let i=0; i < N; i++) {
            this.worldMatrices.push(new Float32Array(Identity4x4));
        }
        this.deadReckoningVelocities = new Float32Array(N);
        this.deadReckoningTorques = new Float32Array(N);
        this.deadReckoningUpdates = [];
    }
    
    get length() {
        return this.count;
    }
    
    set length(n) {
        this.count = n;
    }
    
    set(tankState) {
        this.count = tankState.count;
        this.ids.set(tankState.ids);
        this.positions.set(tankState.positions);
        this.orientations.set(tankState.orientations);
        this.velocities.set(tankState.velocities);
        this.accelerations.set(tankState.accelerations);
        this.torques.set(tankState.torques);
        this.angularAccelerations.set(tankState.angularAccelerations);
        this.updateTimes.set(tankState.updateTimes);        
        this.hitTimes.set(tankState.hitTimes);
        this.life.set(tankState.life);
        for(let i=0; i < this.count; i++) {
            this.worldMatrices[i].set(tankState.worldMatrices[i]);
        }
        this.deadReckoningVelocities.set(tankState.deadReckoningVelocities);
        this.deadReckoningTorques.set(tankState.deadReckoningTorques);        
        this.deadReckoningUpdates = tankState.deadReckoningUpdates.slice();
    }
    
    getIndex(id) {
        return this.ids.indexOf(id);
    }
    
    add(id) {
        const i = this.count;
        this.ids[i] = id;
        this.updateTimes[i] = 0;
        this.worldMatrices.push(new Float32Array(Identity4x4));
        this.count++;
        return i;
    }
    
    setPosition(i, [x, y]) {
        this.positions[2*i] = x;
        this.positions[2*i+1] = y;
    }
    
    getPosition(i) {
        return [this.positions[2*i], this.positions[2*i+1]];
    }
    
    getFrame(i) {
        const tank_angle = this.orientations[i];
        const tank_e0 = 
              [Math.cos(tank_angle-Math.PI/2), Math.sin(tank_angle-Math.PI/2)];
        const tank_e1 = [-tank_e0[1], tank_e0[0]];
        return new Float32Array([tank_e0[0], tank_e0[1], tank_e1[0], tank_e1[1]]);
    }
    
    setEvolve(state) {
        this.set(state.tanks.state);

        const collisions = state.collisions.projectileTanks;

        const collidedTanks = new Set(collisions.map(([_, i]) => i));
        for(const i of collidedTanks) {
            this.hitTimes[i] = state.time;
            this.life[i]--;
        }
/* 2D Control
        {
            const input = state.controllers[0].steering;
            const tank_index = state.tanks.state.activeTank;
            const dt = state.dt;
            const tank_angle = state.tanks.state.orientations[tank_index];    
            // e0, e1 -> Tank moving frame
            const tank_e0 = [Math.cos(tank_angle-Math.PI/2), Math.sin(tank_angle-Math.PI/2)];
            const tank_e1 = [-tank_e0[1], tank_e0[0]];
            const input_x = tank_e0[0]*input[0] + tank_e0[1]*input[1];
            const input_y = tank_e1[0]*input[0] + tank_e1[1]*input[1];
            const accel = input_x;
            const turn = input_x > 0 ? input_y : -input_y;
            this.accelerations[tank_index] = accel;
            this.angularAccelerations[tank_index] = turn;
        }
        */
        {
            const input = state.controllers[0].steering;
            const tank_index = state.tanks.state.activeTank;
            this.accelerations[tank_index] = input[1];
            const turn = Math.abs(input[0]) >= 0.5 ? input[0] : 0;
            this.angularAccelerations[tank_index] = -turn*Math.sign(this.velocities[tank_index]);
        }
        /* AI for enemy tanks */
        for(let i=0; i < this.count; i++) {
            if(i == state.tanks.state.activeTank)
                continue;
            if(Math.random() < 1/60/5) {
                this.accelerations[i] = 1;
            }
            if(Math.random() < 1/60/15) {
                this.accelerations[i] = 0;
            }            
            if(Math.random() < 1/60/10) {
                this.angularAccelerations[i] = 1;
            }
            if(Math.random() < 1/60/2) {
                this.angularAccelerations[i] = 0;
            }            
        }
    // {"type": "deadReckoning", "object": "tank", "index": 1, "position": [0, 0], "velocity": 1, "acceleration": 1}

        for(const dr of state.deadReckoning.incoming) {
            if(dr.object != "tank")
                continue;
            let i = dr.index !== undefined ? dr.index : this.getIndex(dr.id);
            if(i == -1) 
                i = this.add(dr.id);
            if(i == 0)
                continue;
            this.setPosition(i, dr.position);
            this.velocities[i] = dr.velocity;
            this.accelerations[i] = dr.acceleration;
            this.orientations[i] = dr.orientation;
            this.angularAccelerations[i] = dr.angularAcceleration;
            this.torques[i] = dr.torque;
    //         console.log("velocities after DR", state.time[0], this.velocities);
        }
        const friction = 1;
        this.deadReckoningUpdates = [];
        for(let i=0; i < this.length; i++) {
            const dt = state.time - this.updateTimes[i];
            const tank_angle = state.tanks.state.orientations[i];
            const direction = [Math.cos(tank_angle-Math.PI/2), Math.sin(tank_angle-Math.PI/2)];
            const accel = this.accelerations[i];
            const v0 = this.velocities[i];
            const v1 = Math.max(-5.0, Math.min(5.0, v0 + accel * dt - friction * v0 * dt));
            this.velocities[i] = v1;
            const turn = state.tanks.state.angularAccelerations[i];
            this.torques[i] += turn * dt - 2.0*this.torques[i] * dt;

                    if(Math.abs(v1 - this.deadReckoningVelocities[i]) > 1e-2
              || Math.abs(this.torques[i] - this.deadReckoningTorques[i]) > 1e-2) {
                this.deadReckoningUpdates.push({
                    type: "deadReckoning",
                    time: state.time,
                    id: this.ids[i],
                    position: this.getPosition(i),
                    orientation: this.orientations[i],
                    velocity: v1,
                    acceleration: accel,
                    angularAcceleration: this.angularAccelerations[i],
                    torque: this.torques[i],
                    object: "tank"
                });
                this.deadReckoningVelocities[i] = v1;
                this.deadReckoningTorques[i] = this.torques[i];            
            }

            this.positions[2*i] += direction[0] * this.velocities[i] * dt;
            this.positions[2*i+1] += direction[1] * this.velocities[i] * dt;
            this.orientations[i] += this.torques[i] * dt;
        }
        this.updateTimes.fill(state.time);   
    }
}

let nanMsg = "";

class TankDrawing {
    constructor(gl, shaders, img) {
        const program = shaders.tank.program;

        const ratio = img.height / img.width;
        const positionMatrix = new Float32Array([
            1, 0, 0,
            0, ratio, 0,
            0, 0, 1
        ]);
        const positions = matmul(positionMatrix, twoTriangles.positions, 
                                 3, twoTriangles.positions.length/3);

        const texcoords = new Float32Array(twoTriangles.texcoords);
        
        const attribLocations = {};
        attribLocations.position = gl.getAttribLocation(program, "position");
        attribLocations.texcoord = gl.getAttribLocation(program, "texcoord");
    
        const vao = GT.createBasicVAO(
            gl, 
            attribLocations.position, positions, 
            attribLocations.texcoord, texcoords);

        const uniformLocations = {};
        uniformLocations.time = gl.getUniformLocation(program, "time");
        uniformLocations.hitTime = gl.getUniformLocation(program, "hitTime");
        uniformLocations.projectionMatrix = gl.getUniformLocation(
            program, "projectionMatrix");
        uniformLocations.worldMatrix = gl.getUniformLocation(program, "worldMatrix");

        const worldMatrices = [];
        const hitTimes = [];
        const spriteCount = 0;
    
        const textures = {};

        textures.sprite = gl.createTexture();
        gl.bindTexture(gl.TEXTURE_2D, textures.sprite);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
//        gl.texStorage2D(gl.TEXTURE_2D, 1, gl.RGBA8, img.width, img.height);
//         gl.texSubImage2D(gl.TEXTURE_2D, 0, 0, 0, img.width, img.height, gl.RGBA, gl.UNSIGNED_BYTE, img);
        gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, img.width, img.height, 0, gl.RGBA, gl.UNSIGNED_BYTE, null);          
        gl.texSubImage2D(gl.TEXTURE_2D, 0, 0, 0, gl.RGBA, gl.UNSIGNED_BYTE, img);
        
        uniformLocations.spriteSampler = gl.getUniformLocation(
            program, "spriteSampler");
        Object.assign(
            this, 
            {program, vao, count: positions.length / 3,
             attribLocations, uniformLocations, textures, 
             worldMatrices, hitTimes, spriteCount});
        
//         this.worldMatrix = new Float32Array(Identity4x4);
//         this.worldMatrices.push(this.worldMatrix);
        this.worldMatrices = [];
//         this.hitTimes.push(0);
        this.spriteCount = 0;        
    }
    
    update(gl, state) {
        const tankState = state.tanks.state;
        while(this.spriteCount < tankState.count) {
            this.hitTimes.push(0);
            this.worldMatrices.push(new Float32Array(Identity4x4));
            this.spriteCount++;
        }
        for(let i=0; i < this.spriteCount; i++) {
            this.hitTimes[i] = tankState.hitTimes[i];
            const tank_angle = tankState.orientations[i];
            const e0_0 = Math.cos(tank_angle);
            const e0_1 = Math.sin(tank_angle);
            const e1_0 = -e0_1;
            const e1_1 = e0_0;
            const s = 0.1;
            this.worldMatrices[i].set([
                s*e0_0, s*e0_1, 0, 0,
                s*e1_0, s*e1_1, 0, 0,
                0, 0, s, 0,
                tankState.positions[2*i], tankState.positions[2*i+1], 0, 1
            ]);
        }        
    }
            
    draw(gl, state) {
        const {program, vao, count,
               attribLocations, uniformLocations, textures,
               worldMatrices, hitTimes, spriteCount} = this;
        gl.useProgram(program);
        gl.bindVertexArray(vao);
        
        gl.uniform1f(uniformLocations.time, state.time);
        gl.uniformMatrix4fv(
            uniformLocations.projectionMatrix, false, state.projectionMatrix);
        
        gl.uniform1i(uniformLocations.spriteSampler, 0);
        gl.activeTexture(gl.TEXTURE0);
        gl.bindTexture(gl.TEXTURE_2D, textures.sprite);
        for(let i=0; i < spriteCount; i++) {
            const matrix = worldMatrices[i];
            const hitTime = hitTimes[i];
            gl.uniformMatrix4fv(uniformLocations.worldMatrix, false, matrix);
            gl.uniform1f(uniformLocations.hitTime, hitTime);         
            gl.drawArrays(gl.TRIANGLES, 0, count);
        }
    }
}

class TankSoundscape {
    play(jukebox, state) {
        const hitTimes = state.tanks.state.hitTimes;
//         document.querySelector("#msglog-1").innerHTML = `${state.time} ${hitTimes}`;
        for(let i=0; i < state.tanks.state.count; i++) {
            if(Math.abs(hitTimes[i] - state.time) < 1e-3) {
//                 console.log("hit", jukebox);
                jukebox.play("hit");
            }
        }
    }
}

async function initProjectiles(gl, shaders) {
    const maxProjectiles = 1024;
    const projectileState0 = new ProjectileState(maxProjectiles);
    const projectileState1 = new ProjectileState(maxProjectiles);    
    const projectileMatrices = new Array(maxProjectiles);
    for(let i=0; i < maxProjectiles; i++) {
        projectileMatrices[i] = new Float32Array(Identity4x4);
    }
    const projectileImage = await GT.loadImage("kenney_topdownTanksRedux/PNG/Retina/bulletRed1_outline.png")
    const projectileDrawing = new SpriteDrawing(gl, shaders.sprite, projectileImage);
    projectileDrawing.worldMatrices = projectileMatrices;
    
    const projectiles = {
        state: projectileState0,
        nextState: projectileState1,
        drawing: projectileDrawing,
        matrices: projectileMatrices,
    };
    
    return projectiles;
}

class ProjectileState {
    constructor(maxProjectiles) {
        this.count = 0;
        this.maxCount = maxProjectiles;
        const N = maxProjectiles;
        this.positions = new Float32Array(2*N);
        this.elevations = new Float32Array(N);
        this.velocities = new Float32Array(2*N);
        this.frames = new Float32Array(4*N);
        this.sources = new Float32Array(N);
        this.ids = new Uint32Array(N);
        this.deadReckoningUpdates = [];
    }
    
    add(position, velocity, frame, source) {
        const i = this.count;
        this.positions[2*i] = position[0];
        this.positions[2*i+1] = position[1];
        this.elevations[i] = position[2];
//         console.log("add", position);
        this.velocities[2*i] = velocity[0];
        this.velocities[2*i+1] = velocity[1];
        this.frames.set(frame, 4*i);
        this.sources[i] = source;
        this.ids[i] = Math.floor(Math.random()*(2**32-1));
        this.count++;
        return i;
    }
    
    remove(i) {
        this.positions.copyWithin(2*i, 2*(i+1));
        this.elevations.copyWithin(i, i+1);
        this.velocities.copyWithin(2*i, 2*(i+1));
        this.frames.copyWithin(4*i, 4*(i+1));
        this.sources.copyWithin(i, (i+1));        
        this.ids.copyWithin(i, (i+1));        
        this.count--;
    }
        
    setEvolve(state) {
        const prevState = state.projectiles.state;
        const prevCount = prevState.count;
        const tankState = state.tanks.state;
        const collisions = state.collisions.projectileTanks;
//         if(collisions.length > 0)
//             console.log(collisions, prevState.sources, tankState);
        const collidedProjectiles = new Set(collisions.map(([i, _]) => i));
        let j=0;
        for(let i=0; i < prevCount; i++) {
            if(collidedProjectiles.has(i))
                continue;
            if(Math.abs(this.positions[2*i]) > 10)
                continue;
            if(Math.abs(this.positions[2*i+1]) > 10)
                continue;
            this.positions[2*j] = prevState.positions[2*i];
            this.positions[2*j+1] = prevState.positions[2*i+1];
            this.elevations[j] = prevState.elevations[i];
            this.velocities[2*j] = prevState.velocities[2*i];
            this.velocities[2*j+1] = prevState.velocities[2*i+1];
            this.frames[4*j] = prevState.frames[4*i];
            this.frames[4*j+1] = prevState.frames[4*i+1];
            this.frames[4*j+2] = prevState.frames[4*i+2];
            this.frames[4*j+3] = prevState.frames[4*i+3];
            this.sources[j] = prevState.sources[i];
            this.ids[j] = prevState.ids[i];            
            j++;
        }
        this.count = j;
        this.deadReckoningUpdates = [];

        for(const msg of state.deadReckoning.incoming) {
            if(msg.object != "projectile")
                continue;
            let i = this.ids.indexOf(msg.id);
            console.log(msg, i, this.ids);            
            if(i == -1) {
                i = this.add(msg.position, msg.velocity, msg.frame, msg.source);
                this.ids[i] = msg.id;
            } else {
                this.positions[2*i] = msg.position[0];
                this.positions[2*i+1] = msg.position[1];
                this.velocities[2*i] = msg.velocity[0];
                this.velocities[2*i+1] = msg.velocity[1];
                this.frames[4*i] = msg.frame[0];
                this.frames[4*i+1] = msg.frame[1];
                this.frames[4*i+2] = msg.frame[2];
                this.frames[4*i+3] = msg.frame[3];
                this.sources[i] = msg.source;
            }
        }
        const N = this.count;
        const dt = state.dt;
        for(let i=0; i < N; i++) {
            this.positions[2*i] += 
                (this.velocities[2*i] * this.frames[4*i] + 
                 this.velocities[2*i+1] * this.frames[4*i+2]) * dt;
            this.positions[2*i+1] += 
                (this.velocities[2*i] * this.frames[4*i+1] +
                 this.velocities[2*i+1] * this.frames[4*i+3]) * dt;
        }
        /*
        if(state.controllers[0].fire) {
            const activeTank = state.tanks.state.activeTank;
            const activeTankId = state.tanks.state.ids[activeTank];
            const tankPos = state.tanks.state.getPosition(activeTank);
            const frame = state.tanks.state.getFrame(activeTank);
            // document.querySelector("#msglog-2").innerHTML = frame;
            const i = this.add(tankPos, [1, 0], frame, activeTankId);
            this.deadReckoningUpdates.push({
                type: "deadReckoning",
                object: "projectile",
                id: this.ids[i],
                position: tankPos, velocity: [1, 0], 
                frame: Array.from(frame), source: activeTankId
            });
            console.log("fire", activeTankId, this.ids[i]);
        }
        */
        for(let i=0; i < state.tanks.state.count; i++) {
            if((i == state.tanks.state.activeTank && state.controllers[0].fire) ||
               (i != state.tanks.state.activeTank && Math.random() < 1/60/5 && state.tanks.state.life[i] > 0)) {
                const activeTank = i;
                const activeTankId = state.tanks.state.ids[activeTank];
                const tankPos = state.tanks.state.getPosition(activeTank);
                const pos = [
                    tankPos[0], 
                    tankPos[1], 
                    state.terrain.getElevation(tankPos[0], tankPos[1])
                ];
                const frame = state.tanks.state.getFrame(activeTank);
                // document.querySelector("#msglog-2").innerHTML = frame;
                const j = this.add(
                    pos,
                    [1, 0], frame, activeTankId);
                this.deadReckoningUpdates.push({
                    type: "deadReckoning",
                    object: "projectile",
                    id: this.ids[j],
                    position: pos, velocity: [1, 0], 
                    frame: Array.from(frame), source: activeTankId
                });
            }
        }
    }
    
    updateWorldMatrices(worldMatrices) {
        const count = this.count;
        const pos = this.positions;
        const frames = this.frames;
        const s = 0.035;
        for(let i=0; i < count; i++) {
            const e0_0 = frames[4*i];
            const e0_1 = frames[4*i+1];
            const e1_0 = frames[4*i+2];
            const e1_1 = frames[4*i+3];
            worldMatrices[i].set([
                s*e1_0, s*e1_1, 0, 0,
                s*e0_0, s*e0_1, 0, 0,
                0, 0, 1, 0,
                pos[2*i], pos[2*i+1], this.elevations[i]+0.1, 1
            ]);
        }
    }
}

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

function createFrustumBox(gl, state) {
    const cameraOutline = createLinesNode(gl, state, new Float32Array([
         0.0,  0.0,  0.0,
         1.0,  0.0,  0.0,
         0.0,  0.0,  0.0,
         0.0,  1.0,  0.0,
         0.0,  0.0,  0.0,
         0.0,  0.0,  1.0
    ]));
    // z goes from -1 to 0 to handle perspective projections where 
    // \infty maps to +1
    const vertices = new Float32Array([
            -1.0, -1.0, -1.0,
             1.0, -1.0, -1.0,
             1.0,  1.0, -1.0,
            -1.0,  1.0, -1.0,
            -1.0, -1.0,  0.0,
             1.0, -1.0,  0.0,
             1.0,  1.0,  0.0,
            -1.0,  1.0,  0.0,
    ]);
    const edges = new Uint16Array([
            0, 1,
            1, 2,
            2, 3,
            3, 0,
            4, 5,
            5, 6,
            6, 7,
            7, 4,
            0, 4,
            1, 5,
            2, 6,
            3, 7
    ]);
    const frustum = createLinesNode(gl, state, vertices, edges);
    return frustum;
}    


function updateDirectorCamera(gl, state) {
    const numericFields = [
        "distance",
        "theta",
        "phi",
        "focal"
    ];
    const v = Object.fromEntries(numericFields.map(
        id => [id,
               parseFloat(document.getElementById("director-" + id).value)]));
    const directorCamera = GT.orbitCamera(
        [0, 0, 0], 
        v.theta * Math.PI, v.phi*Math.PI,
        v.distance);
    const d = v.focal;
    const perspectiveMatrix = new Float32Array([
        d, 0, 0, 0,
        0, d, 0, 0,
        0, 0, -1, -1,
        0, 0, -d, 0
    ]);
    matmul(perspectiveMatrix, directorCamera, 4, 4, state.cameras.director);
//     console.log(numericValues);
}

init();
