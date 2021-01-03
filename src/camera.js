import {matmul, crossProduct, createLinesNode} from "./gameTools.js";
import * as GT from "./gameTools.js";

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


export {
    CameraDynamicsTopDown, CameraDynamicsShoulder,
    updateDirectorCamera, createFrustumBox
}