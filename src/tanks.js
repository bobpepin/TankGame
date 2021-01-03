import * as GT from "./gameTools.js";
import {matmul} from "./gameTools.js";
import {twoTriangles, Identity4x4} from "./geometry.js";
import {GLTFDrawing} from "./gltf.js";

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
        "assets/tank geometry.gltf", alignmentMatrix
    );
    await drawing.load(gl, attributeIndices);
//     console.log(drawing);
    return drawing;
}


async function initTanks(gl, shaders) {
    const baseurl = "assets";
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


export {TankGLTFDrawing, testGLTFTanks, TankSoundscape, TankDrawing, TankState, initTanks};