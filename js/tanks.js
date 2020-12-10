// DONE
// Port to WebGL1, test on mobile
// Network multiplayer

// TODO
// Tank life
// When driving, reversal requires to pass through the center
// Different tanks
// Different weapons
// Show active tank
// Make camera focus in front of tank, according to current tank trajectory
// Put joystick indicators
// Support for gamepads and multiple tanks
// Make computer tanks drive around randomly
// Change controls when driving in mud
// Obstacles
// Destroy environment
// Tank tracks
// Create mud
// Upgrades & new weapons
// Mission goals (rescue/destroy/...)
// Build environment
// Bump maps & shadows

import * as GT from "./gameTools.js"
import {matmul} from "./gameTools.js"

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
        this.radius = radius || 16;
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
        this.axes = [0, 0];
    }
    
    handleDown(event) {
        console.log("down", event);
        event.preventDefault();
        event.stopPropagation();
        this.start(event.offsetX, event.offsetY);
    }
    
    getTouchOffset(event) {
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
    
    start(offsetX, offsetY) {
//         console.log("start", offsetX, offsetY);
        if(this.active) return;
        this.origin = [offsetX, offsetY];
        this.active = true;
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
    }
    
    handleMove(event) {
        event.preventDefault();
        event.stopPropagation();
        this.move(event.offsetX, event.offsetY);
    }
    
    handleTouchMove(event) {
        event.preventDefault();
        event.stopPropagation();
        if(event.changedTouches.length == 0)
            return;
        const [offsetX, offsetY] = this.getTouchOffset(event);
        this.move(offsetX, offsetY);
    }
    
    move(offsetX, offsetY) {
        if(!this.active) return;
        const {context, canvas} = this;
        context.clearRect(0, 0, canvas.width, canvas.height);
        const [x0, y0] = this.origin;
        const [x, y] = [offsetX, offsetY];
        this.axes = [x-x0, y0-y].map(a => Math.max(Math.min(a, this.radius), -this.radius)/this.radius);
        context.beginPath();
        context.strokeStyle = 'black';
        context.lineWidth = 1;
        context.moveTo(x0, y0);
        context.lineTo(x, y);
        context.stroke();
        context.closePath();
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
        console.log("play", source, buffer);        
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
    const p = initSound();
    await p;
    const controlCanvas = document.querySelector("#control-canvas");
    const joystick = new PointerJoystick(controlCanvas);
    const fireButton = new InputButton(document.querySelector("#fire-button"));
//     const pointer = new PointerDown(controlCanvas);
    const canvas = document.querySelector("#game-canvas");
    const gl = canvas.getContext("webgl");
    if (!gl)
        throw "Unable to obtain WebGL Context";

//     gl.enable(gl.DEPTH_TEST);
//     gl.enable(gl.CULL_FACE);
//     gl.enable(gl.SCISSOR_TEST);
    gl.enable(gl.BLEND);
    gl.blendFunc(gl.ONE, gl.ONE_MINUS_SRC_ALPHA);

    const shaders = await initShaders(gl);
    const framebuffers = initFramebuffers(gl);
    const tanks = await initTanks(gl, shaders);

    const projectiles = await initProjectiles(gl, shaders);
    
    const cameraDynamics = new CameraDynamics();
    
    const state = {
        gameId: Math.random(),
        shaders,
        framebuffers,
        time: [0],
        bufferIndex: 0,
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
    state.dt = (time - state.time[0]);
    state.time[0] = time;

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
    
    updateTankTree(gl, state);
    state.projectiles.state.updateWorldMatrices(state.projectiles.matrices);
    state.projectiles.drawing.spriteCount = state.projectiles.state.count;
    
    gl.canvas.width = gl.canvas.clientWidth;
    gl.canvas.height = gl.canvas.clientHeight;
    
    GT.updateGeometryTree(state.tanks.tankTree, {matrix: Identity4x4});
    
    state.tanks.soundscape.play(jukebox, state);
    
    renderTankTexture(gl, state);
    
    gl.clearColor(0, 255, 0, 1);
    gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);
    const directorCameraEnabled = false;
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
        state.tanks.drawings.slice(0, state.tanks.state.count).map(({drawing}) => drawing.draw(gl, state));
        state.projectiles.drawing.draw(gl, state);
    }
    if(directorCameraEnabled) {
        const viewport = [gl.drawingBufferWidth/2, 0, gl.drawingBufferWidth/2, gl.drawingBufferHeight];
        gl.viewport(...viewport);
        updateDirectorCamera(gl, state);
        state.projectionMatrix.set(state.cameras.director);
        state.drawings.map(({drawing}) => GT.draw(gl, drawing));        
        state.tanks.drawings.slice(0, state.tanks.state.count).map(({drawing}) => drawing.draw(gl, state));        
        state.projectiles.drawing.draw(gl, state);
        GT.invert4x4Matrix(state.cameras.player, state.frustumBox.worldMatrix);
        GT.draw(gl, state.frustumBox.drawing);        
    }
}

function swapStateBuffers(x) {
    const tmp = x.state;
    x.state = x.nextState;
    x.nextState = tmp;
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
    state.tanks.drawings.slice(0, state.tanks.state.count).map(({drawing}) => drawing.draw(gl, state));
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

class CameraDynamics {
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
            0, 0, 1, 0,
            -this.center[0]*sx, -this.center[1]*sy, 0, 1
        ]);
    }
}


async function initShaders(gl) {
    const shaderSources = {
        "ground": {
            vertexShaderUrl: "js/ground_vertex.glsl",
            fragmentShaderUrl: "js/ground_fragment.glsl"
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
        }
    }
    return await GT.loadShaders(gl, shaderSources);
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
                type: "uniform1f", 
                location: timeUniform,
                values: state.time
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
        textures: [],
        mode: gl.LINES,
        offset: 0,
        count: index ? index.length : positions.length / 3,
        indexed: index ? true : false
    }
    return {drawing, worldMatrix};
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
                type: "uniform1f", 
                location: timeUniform,
                values: state.time
            },
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
    console.log(drawing);
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
    const tanks = [];
    const tankTree = {
        matrix: new Float32Array(Identity4x4),
        translation: new Float32Array([0, 0, 0]),
        scale: new Float32Array([1, 1, 1]),
        rotation: new Float32Array([1, 0, 0, 0]),
        children: []
    }
    const baseurl = "kenney_topdownTanksRedux/PNG/Retina";
    const img = await GT.loadImage(baseurl + "/tank_red.png");
//     const img = await GT.loadImage("tank_bigRedGreen.png");

    for(let i=0; i < 10; i++) {
        const drawing = new TankDrawing(gl, shaders, img);
//        await drawing.init(gl, shaders);
//        const [x, z] = [0, 0];
        const node = {
            matrix: drawing.worldMatrix,
            translation: new Float32Array([0, 0, 0]),
            scale: new Float32Array([0.1, 0.1, 0.1]),
            rotation: new Float32Array([1, 0, 0, 0]),
            children: []
        }
        tankTree.children.push(node);
        const tank = {drawing, node}
        tanks.push(tank);
    }
    const tankState = new TankState(tankTree.children);
    const tankState1 = new TankState(tankTree.children);
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
    return {tankTree, state: tankState, nextState: tankState1, drawings: tanks, soundscape};
}

class TankState {
    constructor(tankNodes) {
        this.activeTank = 0;
        this.tankNodes = tankNodes;
        const N = tankNodes.length;
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
        this.tankNodes = tankState.tankNodes;
        this.ids.set(tankState.ids);
        this.positions.set(tankState.positions);
        this.orientations.set(tankState.orientations);
        this.velocities.set(tankState.velocities);
        this.accelerations.set(tankState.accelerations);
        this.torques.set(tankState.torques);
        this.angularAccelerations.set(tankState.angularAccelerations);
        this.updateTimes.set(tankState.updateTimes);        
        this.hitTimes.set(tankState.hitTimes);
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
        nextTankState(state, this);
    }
}

let nanMsg = "";

function nextTankState(state, nextState) {
    nextState.set(state.tanks.state);
   
    const collisions = state.collisions.projectileTanks;

    const collidedTanks = new Set(collisions.map(([_, i]) => i));
    for(const i of collidedTanks) {
        nextState.hitTimes[i] = state.time[0];
    }

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
        nextState.accelerations[tank_index] = accel;
        nextState.angularAccelerations[tank_index] = turn;
    }
// {"type": "deadReckoning", "object": "tank", "index": 1, "position": [0, 0], "velocity": 1, "acceleration": 1}
    
    for(const dr of state.deadReckoning.incoming) {
        if(dr.object != "tank")
            continue;
        let i = dr.index !== undefined ? dr.index : nextState.getIndex(dr.id);
        if(i == -1) 
            i = nextState.add(dr.id);
        if(i == 0)
            continue;
        nextState.setPosition(i, dr.position);
        nextState.velocities[i] = dr.velocity;
        nextState.accelerations[i] = dr.acceleration;
        nextState.orientations[i] = dr.orientation;
        nextState.angularAccelerations[i] = dr.angularAcceleration;
        nextState.torques[i] = dr.torque;
//         console.log("velocities after DR", state.time[0], nextState.velocities);
    }
    const friction = 5;
    nextState.deadReckoningUpdates = [];
    for(let i=0; i < nextState.length; i++) {
        const dt = state.time - nextState.updateTimes[i];
        const tank_angle = state.tanks.state.orientations[i];
        const direction = [Math.cos(tank_angle-Math.PI/2), Math.sin(tank_angle-Math.PI/2)];
        const accel = nextState.accelerations[i];
        const v0 = nextState.velocities[i];
        const v1 = Math.max(-1.0, Math.min(1.0, v0 + accel * dt - friction * v0 * dt));
        nextState.velocities[i] = v1;
        const turn = state.tanks.state.angularAccelerations[i];
        nextState.torques[i] += turn * dt - nextState.torques[i] * dt;

                if(Math.abs(v1 - nextState.deadReckoningVelocities[i]) > 1e-2
          || Math.abs(nextState.torques[i] - nextState.deadReckoningTorques[i]) > 1e-2) {
            nextState.deadReckoningUpdates.push({
                type: "deadReckoning",
                time: state.time[0],
                id: nextState.ids[i],
                position: nextState.getPosition(i),
                orientation: nextState.orientations[i],
                velocity: v1,
                acceleration: accel,
                angularAcceleration: nextState.angularAccelerations[i],
                torque: nextState.torques[i],
                object: "tank"
            });
            nextState.deadReckoningVelocities[i] = v1;
            nextState.deadReckoningTorques[i] = nextState.torques[i];            
        }
        
        nextState.positions[2*i] += direction[0] * nextState.velocities[i] * dt;
        nextState.positions[2*i+1] += direction[1] * nextState.velocities[i] * dt;
        nextState.orientations[i] += nextState.torques[i] * dt;
    }
    nextState.updateTimes.fill(state.time);    
}

function updateTankTree(gl, state) {
    const tankState = state.tanks.state;
    for(let i=0; i < tankState.length; i++) {
        const node = state.tanks.state.tankNodes[i];
        node.translation[0] = tankState.positions[2*i];
        node.translation[1] = tankState.positions[2*i+1];
        node.rotation[0] = Math.cos((tankState.orientations[i])/2);
        node.rotation[3] = Math.sin((tankState.orientations[i])/2);
        state.tanks.drawings[i].drawing.hitTimes[0] = state.tanks.state.hitTimes[i];
    }
}

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
        
        this.worldMatrix = new Float32Array(Identity4x4);
        this.worldMatrices.push(this.worldMatrix);
        this.hitTimes.push(0);
        this.spriteCount = 1;        
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
            if(Math.abs(hitTimes[i] - state.time[0]) < 1e-3) {
                console.log("hit", jukebox);
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
                pos[2*i], pos[2*i+1], 0, 1
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
