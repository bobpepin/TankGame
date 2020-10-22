// Show active tank
// Make camera focus in front of tank, according to current tank trajectory
// When driving, reversal requires to pass through the center
// Put joystick indicators
// Support for gamepads and multiple tanks
// Make computer tanks drive around randomly
// Port to WebGL1, test on mobile
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
        elt.addEventListener("pointerdown", e => this.handleDown(e));
        elt.addEventListener("pointerup", e => this.handleUp(e));
        elt.addEventListener("pointerout", e => this.handleUp(e));        
        elt.addEventListener("pointermove", e => this.handleMove(e));
        this.canvas = elt;
        this.context = elt.getContext("2d");
        this.active = false;
        this.axes = [0, 0];
    }
    
    handleDown(event) {
        event.preventDefault();
        if(this.active) return;
        this.origin = [event.offsetX, event.offsetY];
        this.active = true;
    }
    
    handleUp(event) {
        event.preventDefault();
        this.active = false;
        this.axes = [0, 0];
        const {context, canvas} = this;
        context.clearRect(0, 0, canvas.width, canvas.height);        
    }
    
    handleMove(event) {
        event.preventDefault();
        if(!this.active) return;
        const {context, canvas} = this;
        context.clearRect(0, 0, canvas.width, canvas.height);
        const [x0, y0] = this.origin;
        const [x, y] = [event.offsetX, event.offsetY];
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
        elt.addEventListener("pointerdown", e => this.handleDown(e));
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

async function init() {
    const controlCanvas = document.querySelector("#control-canvas");
    const joystick = new PointerJoystick(controlCanvas);
    const fireButton = new InputButton(document.querySelector("#fire-button"));
//     const pointer = new PointerDown(controlCanvas);
    const canvas = document.querySelector("#game-canvas");
    const gl = canvas.getContext("webgl");
    if (!gl)
        throw "Unable to obtain WebGL2 Context";

//     gl.enable(gl.DEPTH_TEST);
//     gl.enable(gl.CULL_FACE);
    gl.enable(gl.SCISSOR_TEST);
    gl.enable(gl.BLEND);
    gl.blendFunc(gl.ONE, gl.ONE_MINUS_SRC_ALPHA);

    const shaders = await initShaders(gl);
    
    const {tankState, tanks, tankTree} = await initTanks(gl, shaders);

    const projectiles = await initProjectiles(gl, shaders);
    
    const cameraDynamics = new CameraDynamics();
    
    const state = {
        shaders,
        time: [0],
        tanks,
        tankTree,
        tankState,
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
        controllers: [{steering: [0, 0], fire: 0}],
        projectionMatrix: new Float32Array(Identity4x4)
    }

    state.frustumBox = createFrustumBox(gl, state);
    
    const ground = await createGroundDrawing(gl, state);
    state.drawings.push(ground);
    
    console.log(state);
    requestAnimationFrame(time => animate(gl, state, time));
}

function animate(gl, state, time) {
    render(gl, state, time);
    requestAnimationFrame(time => animate(gl, state, time));
}

function render(gl, state, timeMs) {
    document.getElementById("msglog-1").innerHTML = "";
//     document.getElementById("msglog-2").innerHTML = "";
    const time = timeMs * 1e-3;
    state.dt = (time - state.time[0]);
    state.time[0] = time;
    updateDirectorCamera(gl, state);

    updateInput(state);
    
    state.collisions.projectileTanks = detectProjectileTankCollisions(state);

    const tankState = new TankState(state.tankState.tankNodes);
    nextTankState(state, tankState);
    const projectileState = 
          state.projectiles.buffers[(state.projectiles.bufferIndex+1)%2];
    projectileState.evolve(state);
    
    state.tankState = tankState;
    state.projectiles.state = projectileState;
    state.projectiles.bufferIndex = (state.projectiles.bufferIndex+1)%2;
    
    updateTankTree(gl, state);
    state.projectiles.state.updateWorldMatrices(state.projectiles.matrices);
    state.projectiles.drawing.spriteCount = state.projectiles.state.count;
    
    state.cameraDynamics.update(state);
    state.cameraDynamics.updateCameraMatrix(state.cameras.player);
    
    GT.updateGeometryTree(state.tankTree, {matrix: Identity4x4});
    
    GT.invert4x4Matrix(state.cameras.player, state.frustumBox.worldMatrix);    

    gl.clearColor(0, 255, 0, 1);
    gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);
    {
        const viewport = [0, 0, gl.drawingBufferWidth/2, gl.drawingBufferHeight];
        gl.viewport(...viewport);
        state.projectionMatrix.set(state.cameras.player);
        state.drawings.map(({drawing}) => GT.draw(gl, drawing));
        state.tanks.map(({drawing}) => drawing.draw(gl, state));
        state.projectiles.drawing.draw(gl, state);
    }
    {
        const viewport = [gl.drawingBufferWidth/2, 0, gl.drawingBufferWidth/2, gl.drawingBufferHeight];
        gl.viewport(...viewport);
        state.projectionMatrix.set(state.cameras.director);
        state.drawings.map(({drawing}) => GT.draw(gl, drawing));        
        state.tanks.map(({drawing}) => drawing.draw(gl, state));        
        state.projectiles.drawing.draw(gl, state);
        GT.draw(gl, state.frustumBox.drawing);        
    }
}

function updateInput(state) {
    const input = [0, 0];
    if(state.inputDevices.pointers[0] && state.inputDevices.pointers[0].active) {
        const pointer = state.inputDevices.pointers[0];
        const tankPos = [state.tankState.positions[2*tank_index],
                         state.tankState.positions[2*tank_index+1]];
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

class CameraDynamics {
    constructor(scale) {
        this.scale = scale || 0.5;
        this.center = [0, 0];
        // xmin ymin xmax ymax, relative to center
        this.focusField = [-0.25, -0.25, 0.25, 0.25]; //.map(x => x/this.scale);
        this.acceleration = [0.0, 0.0];
        this.velocity = [0.0, 0.0];
    }
    
    update(state) {
        const tankPos = state.tankState.getPosition(state.tankState.activeTank);
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
        document.querySelector("#msglog-1").innerHTML = `${tankPos[0]},${tankPos[1]} ${fovPos[0]},${fovPos[1]} ${this.center[0]},${this.center[1]} ${stop}`;
        this.center[0] += this.velocity[0] * state.dt;
        this.center[1] += this.velocity[1] * state.dt;
    }
    
    updateCameraMatrix(matrix) {
        const s = this.scale;
        matrix.set([
            s, 0, 0, 0,
            0, s, 0, 0,
            0, 0, 1, 0,
            -this.center[0]*s, -this.center[1]*s, 0, 1
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
    return {tankTree, tankState, tanks};
}

class TankState {
    constructor(tankNodes) {
        this.activeTank = 0;
        this.tankNodes = tankNodes;
        const N = tankNodes.length;
        this.length = N;
        this.positions = new Float32Array(N*2);
        this.orientations = new Float32Array(N);
        this.velocities = new Float32Array(N);
        this.torques = new Float32Array(N);
        this.hitTimes = new Float32Array(N);
        this.hitTimes.fill(-1e6);
    }
    
    set(tankState) {
        this.positions.set(tankState.positions);
        this.orientations.set(tankState.orientations);
        this.velocities.set(tankState.velocities);
        this.torques.set(tankState.torques);
        this.hitTimes.set(tankState.hitTimes);
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
}

let nanMsg = "";

function nextTankState(state, nextState) {
//     const input = state.controllers[0].axes;
    const input = state.controllers[0].steering;
    const tank_index = state.tankState.activeTank;
    const dt = state.dt;
    nextState.set(state.tankState);
//     document.querySelector("#msglog-1").innerHTML = 
//             `${state.controllers.pointers[0].position} ${input[0]}, ${input[1]}`;    
    const collisions = state.collisions.projectileTanks;
    const collidedTanks = new Set(collisions.map(([_, i]) => i));
    for(const i of collidedTanks) {
        nextState.hitTimes[i] = state.time;
        document.querySelector("#msglog-2").innerHTML = `hit ${i} ${nextState.hitTimes[i]}`;
    }
    
    const tank_angle = state.tankState.orientations[tank_index];    
    // e0, e1 -> Tank moving frame
    const tank_e0 = [Math.cos(tank_angle-Math.PI/2), Math.sin(tank_angle-Math.PI/2)];
    const tank_e1 = [-tank_e0[1], tank_e0[0]];
    const input_x = tank_e0[0]*input[0] + tank_e0[1]*input[1];
    const input_y = tank_e1[0]*input[0] + tank_e1[1]*input[1];
    const accel = input_x;
    const turn = input_x > 0 ? input_y : -input_y;
    const friction = 5;
    const v0 = nextState.velocities[tank_index];
    const v1 = Math.max(-1.0, Math.min(1.0, v0 + accel * dt - friction * v0 * dt));
    nextState.velocities[tank_index] = v1;
//     document.querySelector("#msglog-1").innerHTML = 
//             `${nextState.torques[tank_index]}, ${turn} ${input[0]}, ${input[1]}`;
    if(turn != turn) {
        nanMsg = `${nextState.torques[tank_index]}, ${turn}, (${input[0]}, ${input[1]}) (${tank_e0[0]}, ${tank_e0[1]}) (${input_x}, ${input_y})`;        
    } else {
        nextState.torques[tank_index] += turn * dt -         nextState.torques[tank_index] * dt;
    }
//     document.querySelector("#msglog-2").innerHTML = nanMsg;

    for(let i=0; i < nextState.length; i++) {
        const tank_angle = state.tankState.orientations[i];
        const direction = [Math.cos(tank_angle-Math.PI/2), Math.sin(tank_angle-Math.PI/2)];
        nextState.positions[2*i] += direction[0] * nextState.velocities[i] * dt;
        nextState.positions[2*i+1] += direction[1] * nextState.velocities[i] * dt;
        nextState.orientations[i] += nextState.torques[i] * dt;
    }
}

function updateTankTree(gl, state) {
    const tankState = state.tankState;
    for(let i=0; i < tankState.length; i++) {
        const node = tankState.tankNodes[i];
        node.translation[0] = tankState.positions[2*i];
        node.translation[1] = tankState.positions[2*i+1];
        node.rotation[0] = Math.cos((tankState.orientations[i])/2);
        node.rotation[3] = Math.sin((tankState.orientations[i])/2);
        state.tanks[i].drawing.hitTimes[0] = state.tankState.hitTimes[i];
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

class TankDrawing1 extends SpriteDrawing {
    constructor(gl, shaders, img) {
        super(gl, shaders.tank, img);
        this.worldMatrix = new Float32Array(Identity4x4);
        this.worldMatrices.push(this.worldMatrix);
        this.spriteCount = 1;
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
        drawing: projectileDrawing,
        matrices: projectileMatrices,
        bufferIndex: 0,
        buffers: [projectileState0, projectileState1]
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
    }
    
    add(position, velocity, frame, source) {
        const i = this.count;
        this.positions[2*i] = position[0];
        this.positions[2*i+1] = position[1];
        this.velocities[2*i] = velocity[0];
        this.velocities[2*i+1] = velocity[1];
        this.frames.set(frame, 4*i);
        this.sources[i] = source;
        this.count++;
    }
    
    remove(i) {
        this.positions.copyWithin(2*i, 2*(i+1));
        this.velocities.copyWithin(2*i, 2*(i+1));
        this.frames.copyWithin(4*i, 4*(i+1));
        this.sources.copyWithin(i, (i+1));        
        this.count--;
    }
        
    evolve(state) {
        const prevState = state.projectiles.state;
        const prevCount = prevState.count;

        const collisions = state.collisions.projectileTanks.filter(([_, j]) => state.tankState.activeTank != j);
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
            j++;
        }
        this.count = j;

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
            const activeTank = state.tankState.activeTank;
            const tankPos = state.tankState.getPosition(activeTank);
            const frame = state.tankState.getFrame(activeTank);
            // document.querySelector("#msglog-2").innerHTML = frame;
            this.add(tankPos, [1, 0], frame, activeTank);
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
    const tankState = state.tankState;
    const projectileState = state.projectiles.state;
    for(let i=0; i < projectileState.count; i++) {
        for(let j=0; j < tankState.length; j++) {
            if(j == projectileState.sources[i]) // avoid self-fire
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
