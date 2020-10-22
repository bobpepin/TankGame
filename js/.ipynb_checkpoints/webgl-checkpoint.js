//XXXXXXX0XXXXXXXXX1XXXXXXXXX2XXXXXXXXX3XXXXXXXXX4XXXXXXXXX5XXXXXXXXX6XXXXXXXXX7XXXXXXXXX8

async function fetchSource(url) {
    const response = await fetch(url);
    if(!response.ok) {
        throw `Fetch of ${url} failed with status code ${response.statusCode}: ${response.statusText}`;
    }
    return await response.text();
}

async function loadProgram(gl, {vertexShaderUrl, fragmentShaderUrl}) {
    const vertexShader = gl.createShader(gl.VERTEX_SHADER);    
    const fragmentShader = gl.createShader(gl.FRAGMENT_SHADER);
    const program = gl.createProgram();    
    const [vertexSource, fragmentSource] = await Promise.all(
        [fetchSource(vertexShaderUrl), fetchSource(fragmentShaderUrl)]
    );
    gl.shaderSource(vertexShader, vertexSource);
    gl.shaderSource(fragmentShader, fragmentSource);
    gl.attachShader(program, vertexShader);
    gl.attachShader(program, fragmentShader);
    return {vertexShader, fragmentShader, program};
}

async function loadShaders(gl, sources) {
    const programs = Object.fromEntries(
        await Promise.all(
            Object.entries(sources).map(
                async ([k, v]) => [k, await loadProgram(gl, v)])));
    
    for (const {vertexShader, fragmentShader} of Object.values(programs)) {
        gl.compileShader(vertexShader);
        gl.compileShader(fragmentShader);
    }
    for (const {program} of Object.values(programs)) {
        gl.linkProgram(program);
    }
    let error = false;
    for (const [name, program] of Object.entries(programs)) {
        if (!gl.getProgramParameter(program.program, gl.LINK_STATUS)) {
            const vsUrl = sources[name].vertexShaderUrl;
            const fsUrl = sources[name].fragmentShaderUrl;
            console.error(`Link failed: ${name}: ` + 
                          gl.getProgramInfoLog(program.program));
            console.error(`Vertex shader info-log: ${name}: ${vsUrl}:` + 
                          gl.getShaderInfoLog(program.vertexShader));
            console.error(`Fragment shader info-log: ${name}: ${vsUrl}:` + 
                          gl.getShaderInfoLog(program.fragmentShader));
            error = true;
        }
    }
    if(error) {
        throw "Failed to load shader programs.";
    }
    return programs;
}

async function init() {
    const canvas = document.querySelector("#webgl");
    const gl = canvas.getContext("webgl2");
    if (!gl)
        throw "Unable to obtain WebGL2 Context";
    const shaderSources = {
        "swirl": {
            vertexShaderUrl: "js/swirl_vertex.glsl",
            fragmentShaderUrl: "js/swirl_fragment.glsl"
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
    state.shaders = await loadShaders(gl, shaderSources);
    state.swirl = await initSwirl(gl, state);
    console.log(state);
    requestAnimationFrame(time => animate(gl, state, time));
}

function animate(gl, state, time) {
    render(gl, state, time);
    requestAnimationFrame(time => animate(gl, state, time));
}

function render(gl, state, time) {
    gl.viewport(0, 0, gl.drawingBufferWidth, gl.drawingBufferHeight);
    gl.clearColor(0, 255, 0, 1);
    gl.clear(gl.COLOR_BUFFER_BIT);
    state.time[0] = time;
   updateRotation(gl, state);
    drawNode(gl, state.swirl);
//    renderSwirl(gl, state.shaders, state.swirl, time);
}

function updateRotation(gl, state) {
    const {sin, cos, PI} = Math;
    const theta = (state.time[0] / 1000) % (8*Math.PI);
//     const theta = Math.PI+0.1;
    const C = cos(theta/2);
    const S = sin(theta/2);
    const rotationQuaternion = new Float32Array([C, 0, S, 0]);
    const rotationMatrix = quaternionRotationMatrix(rotationQuaternion);
    state.projectionMatrix.set(rotationMatrix);
}

function drawNode(gl, node) {
    gl.useProgram(node.program);
    gl.bindVertexArray(node.vao);
    for(const uniform of node.uniforms) {
        const uniformFn = gl[uniform.type];
        uniformFn.apply(gl, [uniform.location, ...uniform.values]);
    }
    for(const texture of node.textures) {
        gl.activeTexture(texture.unit);
        gl.bindTexture(texture.target, texture.texture);
    }
    gl.drawArrays(node.mode, node.start, node.count);    
}

function loadImage(url) {
    const img = new Image();
    img.src = url;
    return new Promise((resolve, reject) => {
        img.onload = (() => resolve(img));
    });
}

async function initSwirl(gl, state) {
    const program = state.shaders.swirl.program;
    const positions = new Float32Array([
        -1.0, -1.0,  0.0,
         1.0, -1.0,  0.0,
        -1.0,  1.0,  0.0,

        -1.0,  1.0,  0.0,
         1.0, -1.0,  0.0,
         1.0,  1.0,  0.0
    ]);
    const uv = new Float32Array([
        0, 0,
        1, 0,
        0, 1,
        0, 1,
        1, 0,
        1, 1
    ]);
    const positionLocation = gl.getAttribLocation(program, "position"); 
    const uvLocation = gl.getAttribLocation(program, "uv"); 
    const vao = createBasicVAO(gl, positionLocation, positions, uvLocation, uv);
    const timeUniform = gl.getUniformLocation(program, "time");
    
    const texture = gl.createTexture();
    gl.bindTexture(gl.TEXTURE_2D, texture);
    gl.texStorage2D(gl.TEXTURE_2D, 1, gl.RGBA8, 512, 512);
    const img = await loadImage("perlin1.png");
    gl.texSubImage2D(gl.TEXTURE_2D, 0, 0, 0, 512, 512, gl.RGBA, gl.UNSIGNED_BYTE, img);
    const textureLocation = gl.getUniformLocation(program, "sampler");
    
    const projectionLocation = gl.getUniformLocation(program, "projectionMatrix");
    
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
        count: 6
    }
    return node;
}

function matmul(A, B, nA, mB, C) {
    const [mA, nB] = [A.length / nA, B.length / mB];
    if(C == undefined) {
        C = new Float32Array(nA*mB);
    }
    for(let i=0; i < nA; i++) {
        for(let j=0; j < mB; j++) {
            C[i+j*nA] = 0;
            for(let k=0; k < mA; k++) {
                C[i+j*nA] += A[i+k*nA]*B[k+j*nB];
            }
        }
    }
    return C;
}

function quaternionRotationMatrix(q) {
    const s = 1;
    const [qr, qi, qj, qk]  = q;
    const [qi2, qj2, qk2] = [qi**2, qj**2, qk**2];
    const R = new Float32Array([
        1-2*s*(qj2+qk2), 2*s*(qi*qj+qk*qr), 2*s*(qi*qk-qj*qr), 0,
        2*s*(qi*qj-qk*qr), 1-2*s*(qi2+qk2), 2*(qj*qk+qi*qr), 0,
        2*s*(qi*qk+qj*qr), 2*s*(qj*qk-qi*qr), 1-2*s*(qi2+qj2), 0,
        0, 0, 0, 1]);
    return R;
}


function createBasicVAO(gl, positionLocation, positions, uvLocation, uv) {
    const vao = gl.createVertexArray();
    gl.bindVertexArray(vao);
    
    const positionBuffer = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, positionBuffer);
    gl.bufferData(gl.ARRAY_BUFFER, positions, gl.STATIC_DRAW);
    gl.enableVertexAttribArray(positionLocation);
    gl.vertexAttribPointer(positionLocation, 3, gl.FLOAT, false, 0, 0);

    if(uvLocation != -1 && uvLocation !== undefined) {
        const uvBuffer = gl.createBuffer();
        gl.bindBuffer(gl.ARRAY_BUFFER, uvBuffer);
        gl.bufferData(gl.ARRAY_BUFFER, uv, gl.STATIC_DRAW);
        gl.enableVertexAttribArray(uvLocation);
        gl.vertexAttribPointer(uvLocation, 2, gl.FLOAT, false, 0, 0);
    }
        
    gl.bindVertexArray(null);
    return vao;
}

init();