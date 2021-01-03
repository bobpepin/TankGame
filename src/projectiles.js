import * as GT from "./gameTools.js";
import {matmul} from "./gameTools.js";
import {twoTriangles, Identity4x4} from "./geometry.js";
import {GLTFDrawing} from "./gltf.js";
import {SpriteDrawing} from "./sprite.js";

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
        "assets/bullet.gltf", alignmentMatrix
    );
    await drawing.load(gl, attributeIndices);
//     console.log(drawing);
    return drawing;
}


async function initProjectiles(gl, shaders) {
    const maxProjectiles = 1024;
    const projectileState0 = new ProjectileState(maxProjectiles);
    const projectileState1 = new ProjectileState(maxProjectiles);    
    const projectileMatrices = new Array(maxProjectiles);
    for(let i=0; i < maxProjectiles; i++) {
        projectileMatrices[i] = new Float32Array(Identity4x4);
    }
    const projectileImage = await GT.loadImage("assets/bulletRed1_outline.png")
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



export {ProjectileGLTFDrawing, testGLTFProjectiles, initProjectiles, ProjectileState};