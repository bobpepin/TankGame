//XXXXXXX0XXXXXXXXX1XXXXXXXXX2XXXXXXXXX3XXXXXXXXX4XXXXXXXXX5XXXXXXXXX6XXXXXXXXX7XXXXXXXXX8

import { GLTFLoader } from "https://unpkg.com/three@0.119.1/examples/jsm/loaders/GLTFLoader.js";

import * as GT from "./gameTools.js"
import {matmul} from "./gameTools.js"

async function loadDuck() {
    function* findGeometry(group) {
//        console.log(group.uuid, group.geometry);
        if(group.geometry != undefined) {
            yield group;
        }
        for(const child of group.children) {
            yield* findGeometry(child);
        }
    }
    const loader = new GLTFLoader();
    const gltf = await loader.loadAsync("Duck.gltf");
    console.log(gltf);
    const geometries = Array.from(findGeometry(gltf.scene));
    console.log(geometries);
    return geometries;
}
    
async function init() {
    const canvas = document.querySelector("#webgl");
    const gl = canvas.getContext("webgl2");
    if (!gl)
        throw "Unable to obtain WebGL2 Context";

    gl.enable(gl.DEPTH_TEST);
//    gl.enable(gl.CULL_FACE);
    gl.enable(gl.SCISSOR_TEST);
    
    const shaderSources = {
        "swirl": {
            vertexShaderUrl: "js/swirl_vertex.glsl",
            fragmentShaderUrl: "js/swirl_fragment.glsl"
        },
        "lines": {
            vertexShaderUrl: "js/lines_vertex.glsl",
            fragmentShaderUrl: "js/lines_fragment.glsl"
        }
    }
    const state = {
        time: [0]
    }
    state.projectionMatrix = new Float32Array([
        1, 0, 0, 0,
        0, 1, 0, 0,
        0, 0, 1, 0,
        0, 0, 0, 1
    ]);
    
//     state.cameraMatrix = computeOrbitCameraMatrix(
//         [0, 0, 0], 
//         -Math.PI*7/8, 0,
//         4);

    state.cameraMatrix = GT.lookAtCamera(
        new Float32Array([10.0, 10.0, 5.0]),
        new Float32Array([0, 0, 0]));
    
    {
        const d = 1.5;
        state.perspectiveMatrix = new Float32Array([
            d, 0, 0, 0,
            0, d, 0, 0,
            0, 0, -1, -1,
            0, 0, -d, 0
        ]);
    }
    state.viewerCameraMatrix = matmul(
        state.perspectiveMatrix, 
        state.cameraMatrix, 
        4, 4);

    {
        const directorCamera = GT.orbitCamera(
            [0, 0, 0], 
            Math.PI/2, 0,
            10);
        const d = 0.3;
        const perspectiveMatrix = new Float32Array([
            d, 0, 0, 0,
            0, d, 0, 0,
            0, 0, -1, -1,
            0, 0, -d, 0
        ]);
        state.directorCameraMatrix = matmul(
            perspectiveMatrix, directorCamera, 4, 4);
    }
    
//    state.projectionMatrix.set(state.perspectiveMatrix);
    state.shaders = await GT.loadShaders(gl, shaderSources);
    
    const [duckGeometry] = await loadDuck();
    const duckAttributes = duckGeometry.geometry.attributes;
    const duckData = await initSwirl(
            gl, state, 
            duckAttributes.position.array, 
            duckAttributes.uv.array,
            duckAttributes.position.count,
            duckGeometry.geometry.index.array
    );
    state.duck = duckData;
    state.swirl = [
        await initSwirl(gl, state),
        await initSwirl(gl, state),
    ];
    const cameraOutline = await createLinesNode(gl, state, new Float32Array([
         0.0,  0.0,  0.0,
         1.0,  0.0,  0.0,
         0.0,  0.0,  0.0,
         0.0,  1.0,  0.0,
         0.0,  0.0,  0.0,
         0.0,  0.0,  1.0
    ]));
    const frustum = await createLinesNode(
        gl, state, 
        new Float32Array([
            -1.0, -1.0, -1.0,
             1.0, -1.0, -1.0,
             1.0,  1.0, -1.0,
            -1.0,  1.0, -1.0,
            -1.0, -1.0,  0.0,
             1.0, -1.0,  0.0,
             1.0,  1.0,  0.0,
            -1.0,  1.0,  0.0,
        ]),
        new Uint16Array([
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
        ]));
    state.frustum = frustum;
    GT.invert4x4Matrix(state.viewerCameraMatrix, frustum.worldMatrix);
    state.nodes = [duckData, cameraOutline, frustum];
    state.duckParameters = {
        rotation: new Float32Array([1, 0, 0, 0]),
        translation: new Float32Array([0, 0, 0])
    }
    const duckTree = {
        matrix: new Float32Array(Identity4x4),
        rotation: state.duckParameters.rotation,
        translation: state.duckParameters.translation,
        scale: new Float32Array([1, 1, 1]),
        children: [
            {
                matrix: duckData.worldMatrix,
                rotation: new Float32Array([1, 0, 0, 0]),
                translation: new Float32Array([0, -1, 5]),
                scale: new Float32Array([0.01, 0.01, 0.01]),
                children: []
            }
        ]
    };
    state.duckTree = duckTree;
    const swirlTree = {
        matrix: state.swirl[1].worldMatrix,
        rotation: GT.eulerQuaternion(Math.PI/4, [1, 0, 0]),
        translation: new Float32Array([0, 0, -1]),
        scale: new Float32Array([0.5, 0.5, 0.5]),
        children: [
            {
                matrix: state.swirl[0].worldMatrix,
                rotation: GT.eulerQuaternion(Math.PI/4, [0, 1, 0]),
                translation: new Float32Array([0, 0, 0]),
                scale: new Float32Array([1, 0.5, 1]),
                children: []
            }
        ]
    };
//    state.swirl[1].worldMatrix[0] = 0.5;
    state.geometryTree = {
        matrix: new Float32Array(Identity4x4),
        rotation: new Float32Array([1, 0, 0, 0]),
        translation: new Float32Array([0, 0, 0]),
        scale: new Float32Array([1, 1, 1]),
        children: [swirlTree, duckTree]
    }
    
    GT.updateGeometryTree(state.geometryTree, {matrix: Identity4x4})
    console.log(state);
    requestAnimationFrame(time => animate(gl, state, time));
}

function animate(gl, state, time) {
    render(gl, state, time);
    requestAnimationFrame(time => animate(gl, state, time));
}

function render(gl, state, time) {
    document.getElementById("frustum-log").innerHTML = "";
    document.getElementById("camera-log").innerHTML = "";
    state.time[0] = time;
//     updateDistance(gl, state);
//     updateRotation(gl, state);
//    updateDuckRotation(gl, state);
//     updateDuck(gl, state);
    updateFixedDuck(gl, state);    
    GT.updateGeometryTree(state.geometryTree, {matrix: Identity4x4});
    updateDuckCamera(gl, state);
    updateDirectorCamera(gl, state);
    GT.invert4x4Matrix(state.viewerCameraMatrix, state.frustum.worldMatrix);
//     verifyFrustum(gl, state);
    gl.clearColor(0, 255, 0, 1);
    gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);
    {
        const viewport = [0, 0, gl.drawingBufferWidth/2, gl.drawingBufferHeight];
        gl.viewport(...viewport);
        state.projectionMatrix.set(state.viewerCameraMatrix);
        state.nodes.map(({node}) => GT.drawNode(gl, node));
    }
    {
        const viewport = [gl.drawingBufferWidth/2, 0, gl.drawingBufferWidth/2, gl.drawingBufferHeight];
        gl.viewport(...viewport);
        state.projectionMatrix.set(state.directorCameraMatrix);
        state.nodes.map(({node}) => GT.drawNode(gl, node));
    }
//    drawNode(gl, state.swirl);
//    renderSwirl(gl, state.shaders, state.swirl, time);
}

function verifyFrustum(gl, state) {
    const span = document.getElementById("frustum-log");
    const approxIdentity = matmul(state.viewerCameraMatrix, state.frustum.worldMatrix, 4, 4);
    let maxError = 0;
    for(let i=0; i < approxIdentity.length; i++) {
        const error = Math.abs(approxIdentity[i] - Identity4x4[i]);
        if(error > maxError) maxError = error;
    }
    span.innerHTML = String(maxError.toExponential(2));
}

function updateDirectorCamera(gl, state) {
    const numericFields = [
        "director-distance",
        "director-theta",
        "director-phi",
        "director-focal"
    ];
    const v = Object.fromEntries(numericFields.map(
        id => [id.replace("director-", ""),
               parseFloat(document.getElementById(id).value)]));
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
    state.directorCameraMatrix = matmul(
        perspectiveMatrix, directorCamera, 4, 4);

    
//     console.log(numericValues);
}

function updateDuckCamera(gl, state) {
    const duckPosition = matmul(
        state.duck.worldMatrix, 
        new Float32Array([0, 0, 0, 1]),
        4, 1);
    state.cameraMatrix.set(GT.lookAtCamera(
        new Float32Array([0.0, 0.0, 0.0]),
        duckPosition));
//     document.getElementById("camera-log").innerHTML = duckPosition;
    state.viewerCameraMatrix.set(matmul(
        state.perspectiveMatrix, 
        state.cameraMatrix, 
        4, 4));
}

function updateFixedDuck(gl, state) {
    const numericFields = [
        "x",
        "y",
        "z",
    ];
    const v = Object.fromEntries(numericFields.map(
        id => [id,
               parseFloat(document.getElementById("duck-" + id).value)]));
    state.duckParameters.translation.set([v.x, v.y, v.z]);
}

function updateDuck(gl, state) {
    const theta = (state.time[0] / 1000) % (8*Math.PI);
    state.duckParameters.rotation.set(GT.eulerQuaternion(theta, [0, 1, 0]));
    state.duckParameters.translation[1] = 2*Math.sin(theta);
}

function updateDuckRotation(gl, state) {
    const theta = (state.time[0] / 1000) % (8*Math.PI);
    state.duckTree.rotation = GT.eulerQuaternion(theta, [0, 1, 0]);   
}


function updateDistance(gl, state) {
    const d = Math.sin(state.time[0] / 1500)**2;
    const P = state.perspectiveMatrix;
    P[0] = P[5] = d;
    P[14] = -d;
    state.projectionMatrix.set(state.perspectiveMatrix);
}

function updateRotation(gl, state) {
    const {sin, cos, PI} = Math;
    const theta = (state.time[0] / 1000) % (8*Math.PI);
//     const theta = Math.PI+0.1;
    const C = cos(theta/2);
    const S = sin(theta/2);
    const rotationQuaternion = new Float32Array([C, 0, S, 0]);
    const rotationMatrix = GT.quaternionRotationMatrix(rotationQuaternion);
    matmul(state.perspectiveMatrix, rotationMatrix, 4, 4, state.projectionMatrix);
//     state.projectionMatrix.set(rotationMatrix);
}

const Identity4x4 = new Float32Array([
    1, 0, 0, 0,
    0, 1, 0, 0,
    0, 0, 1, 0,
    0, 0, 0, 1
]);

async function createLinesNode(gl, state, positions, index) {
    const program = state.shaders.lines.program;
    const positionLocation = gl.getAttribLocation(program, "position"); 
    const vao = GT.createBasicVAO(gl, positionLocation, positions, null, null, index);

    const timeUniform = gl.getUniformLocation(program, "time");
        
    const projectionLocation = gl.getUniformLocation(program, "projectionMatrix");

    const worldMatrixLocation = gl.getUniformLocation(program, "worldMatrix");
    const worldMatrix = new Float32Array(Identity4x4);

    const node = {
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
    return {node, worldMatrix};
}



async function initSwirl(gl, state, positions, uv, count, index) {
    const program = state.shaders.swirl.program;
    if(positions == undefined) {
        positions = new Float32Array([
            -1.0, -1.0,  0.0,
             1.0, -1.0,  0.0,
            -1.0,  1.0,  0.0,

            -1.0,  1.0,  0.0,
             1.0, -1.0,  0.0,
             1.0,  1.0,  0.0
        ]);
    }
    if(uv == undefined) {
        uv = new Float32Array([
            0, 0,
            1, 0,
            0, 1,
            0, 1,
            1, 0,
            1, 1
        ]);
    }
    if(count == undefined) {
        count = positions.length / 3;
    }
    const positionLocation = gl.getAttribLocation(program, "position"); 
    const uvLocation = gl.getAttribLocation(program, "uv"); 
    const vao = GT.createBasicVAO(gl, positionLocation, positions, uvLocation, uv, index);
    const timeUniform = gl.getUniformLocation(program, "time");
    
    const texture = gl.createTexture();
    gl.bindTexture(gl.TEXTURE_2D, texture);
    gl.texStorage2D(gl.TEXTURE_2D, 1, gl.RGBA8, 512, 512);
    const img = await GT.loadImage("perlin1.png");
    gl.texSubImage2D(gl.TEXTURE_2D, 0, 0, 0, 512, 512, gl.RGBA, gl.UNSIGNED_BYTE, img);
    const textureLocation = gl.getUniformLocation(program, "sampler");
    
    const projectionLocation = gl.getUniformLocation(program, "projectionMatrix");

    const worldMatrixLocation = gl.getUniformLocation(program, "worldMatrix");
    const worldMatrix = new Float32Array(Identity4x4);

    const node = {
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
                location: textureLocation,
                values: [0]
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
                target: gl.TEXTURE_2D,
                unit: gl.TEXTURE0,
                texture
            }
        ],
        mode: gl.TRIANGLES,
        offset: 0,
        count: index ? index.length : count,
        indexed: index ? true : false
    }
    return {node, worldMatrix};
}

init();