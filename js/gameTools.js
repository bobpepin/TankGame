export function updateGeometryTree(node, parent) {
    const nodeMatrix = quaternionRotationMatrix(node.rotation);
    nodeMatrix.set(node.translation, 12);
    const scaleMatrix = new Float32Array([
        node.scale[0], 0, 0, 0,
        0, node.scale[1], 0, 0,
        0, 0, node.scale[2], 0,
        0, 0, 0, 1
        ]);
    const scaledNodeMatrix = matmul(nodeMatrix, scaleMatrix, 4, 4);
    matmul(parent.matrix, scaledNodeMatrix, 4, 4, node.matrix);
    for(const child of node.children) {
        updateGeometryTree(child, node);
    }
}

export function draw(gl, node) {
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
    if(node.indexed) {
        gl.drawElements(node.mode, node.count, gl.UNSIGNED_SHORT, 0);
    } else {
        gl.drawArrays(node.mode, node.start, node.count);            
    }
}

export const drawNode = draw;

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

export async function loadShaders(gl, sources) {
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
            console.error(`Fragment shader info-log: ${name}: ${fsUrl}:` + 
                          gl.getShaderInfoLog(program.fragmentShader));
            error = true;
        }
    }
    if(error) {
        throw "Failed to load shader programs.";
    }
    return programs;
}

export function loadImage(url) {
    const img = new Image();
    img.src = url;
    return new Promise((resolve, reject) => {
        img.onload = (() => resolve(img));
    });
}


export function createBasicVAO(gl, positionLocation, positions, uvLocation, uv, index) {
    const vao = gl.createVertexArray();
    gl.bindVertexArray(vao);
    
    const positionBuffer = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, positionBuffer);
    gl.bufferData(gl.ARRAY_BUFFER, positions, gl.STATIC_DRAW);
    gl.enableVertexAttribArray(positionLocation);
    gl.vertexAttribPointer(positionLocation, 3, gl.FLOAT, false, 0, 0);

    if(uvLocation != -1 && uvLocation != undefined) {
        const uvBuffer = gl.createBuffer();
        gl.bindBuffer(gl.ARRAY_BUFFER, uvBuffer);
        gl.bufferData(gl.ARRAY_BUFFER, uv, gl.STATIC_DRAW);
        gl.enableVertexAttribArray(uvLocation);
        gl.vertexAttribPointer(uvLocation, 2, gl.FLOAT, false, 0, 0);
    }
    
    if(index != undefined) {
        const indexBuffer = gl.createBuffer();
        gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, indexBuffer);
        gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, index, gl.STATIC_DRAW);
    }
        
    gl.bindVertexArray(null);
    return vao;
}

export function matmul(A, B, nA, mB, C) {
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

export function crossProduct(a, b, c) {
    if(c == undefined) {
        c = new Float32Array(3);
    }
    c[0] = a[1]*b[2] - a[2]*b[1];
    c[1] = a[2]*b[0] - a[0]*b[2];
    c[2] = a[0]*b[1] - a[1]*b[0];
    return c;
}

export function positionDirectionCamera(position, direction) {
    const e_y = new Float32Array([0, 1, 0]);
    const d_z = new Float32Array([-direction[0], -direction[1], -direction[2]]);
    const d_x = crossProduct(e_y, d_z);
    const norm_x = Math.sqrt(matmul(d_x, d_x, 1, 1)[0]);
    d_x[0] /= norm_x; d_x[1] /= norm_x; d_x[2] /= norm_x;
    const d_y = crossProduct(d_z, d_x);
    const b = new Float32Array([
        -matmul(d_x, position, 1, 1)[0],
        -matmul(d_y, position, 1, 1)[0],
        -matmul(d_z, position, 1, 1)[0]
    ]);
    const matrix = new Float32Array([
        d_x[0], d_y[0], d_z[0], 0,
        d_x[1], d_y[1], d_z[1], 0,
        d_x[2], d_y[2], d_z[2], 0,
        b[0], b[1], b[2], 1
    ]);
    
//     const norms = {
//           x: Math.sqrt(matmul(d_x, d_x, 1, 1)[0]),
//           y: Math.sqrt(matmul(d_y, d_y, 1, 1)[0]),
//           z: Math.sqrt(matmul(d_z, d_z, 1, 1)[0])
//     }
//     document.getElementById("camera-log").innerHTML = `${norms.x} ${norms.y} ${norms.z}`;
//     console.log(position, direction, b, matrix);
    return matrix;
}

export function lookAtCamera(position, target) {
    const direction = new Float32Array([
        target[0] - position[0],
        target[1] - position[1],
        target[2] - position[2],
    ]);
    const norm = Math.sqrt(matmul(direction, direction, 1, 1)[0]);
    direction[0] /= norm;
    direction[1] /= norm;
    direction[2] /= norm;
    const c0 = positionDirectionCamera(position, direction);
    return c0;
}

export function orbitCamera(center, latitude, longitude, distance) {
    const [x, y, z] = center;
    const T_c = new Float32Array([
        1, 0, 0, 0,
        0, 1, 0, 0,
        0, 0, 1, 0,
        -x, -y, -z, 1]);
    const q_lat = eulerQuaternion(-latitude, [-1, 0, 0]);
    // Y up
//     const q_long = eulerQuaternion(-longitude, [0, 1, 0]);
    // Z up
    const q_long = eulerQuaternion(-longitude, [0, 0, 1]);    
    const T_d = new Float32Array([
        1, 0, 0, 0,
        0, 1, 0, 0,
        0, 0, 1, 0,
        0, 0, -distance, 1]);
    const R = matmul(quaternionRotationMatrix(q_lat), 
                     quaternionRotationMatrix(q_long),
                     4, 4);
    const T_d_R = matmul(T_d, R, 4, 4);
    const T_d_R_T_c = matmul(T_d_R, T_c, 4, 4);
    return T_d_R_T_c;
}

export function eulerQuaternion(theta, v) {
    const [norm2] = matmul(v, v, 1, 1);
    if(norm2 == 0) {
        return new Float32Array([1, 0, 0, 0]);
    }
    const norm = Math.sqrt(norm2);
    const C = Math.cos(theta/2);
    const S = Math.sin(theta/2);    
    const rotationQuaternion = new Float32Array([
        C, v[0]*S/norm, v[1]*S/norm, v[2]*S/norm
    ]);
    return rotationQuaternion;
}

export function quaternionRotationMatrix(q) {
    const [qr, qi, qj, qk] = q;
    const [qr2, qi2, qj2, qk2] = [qr**2, qi**2, qj**2, qk**2];
    const s = 1.0/(qr2 + qi2 + qj2 + qk2);
    const R = new Float32Array([
        1-2*s*(qj2+qk2), 2*s*(qi*qj+qk*qr), 2*s*(qi*qk-qj*qr), 0,
        2*s*(qi*qj-qk*qr), 1-2*s*(qi2+qk2), 2*(qj*qk+qi*qr), 0,
        2*s*(qi*qk+qj*qr), 2*s*(qj*qk-qi*qr), 1-2*s*(qi2+qj2), 0,
        0, 0, 0, 1]);
    return R;
}


// copied from m4 library (twgl)
export function invert4x4Matrix(m, dst) {
  dst = dst || new Float32Array(16);

  const m00 = m[0 * 4 + 0];
  const m01 = m[0 * 4 + 1];
  const m02 = m[0 * 4 + 2];
  const m03 = m[0 * 4 + 3];
  const m10 = m[1 * 4 + 0];
  const m11 = m[1 * 4 + 1];
  const m12 = m[1 * 4 + 2];
  const m13 = m[1 * 4 + 3];
  const m20 = m[2 * 4 + 0];
  const m21 = m[2 * 4 + 1];
  const m22 = m[2 * 4 + 2];
  const m23 = m[2 * 4 + 3];
  const m30 = m[3 * 4 + 0];
  const m31 = m[3 * 4 + 1];
  const m32 = m[3 * 4 + 2];
  const m33 = m[3 * 4 + 3];
  const tmp_0  = m22 * m33;
  const tmp_1  = m32 * m23;
  const tmp_2  = m12 * m33;
  const tmp_3  = m32 * m13;
  const tmp_4  = m12 * m23;
  const tmp_5  = m22 * m13;
  const tmp_6  = m02 * m33;
  const tmp_7  = m32 * m03;
  const tmp_8  = m02 * m23;
  const tmp_9  = m22 * m03;
  const tmp_10 = m02 * m13;
  const tmp_11 = m12 * m03;
  const tmp_12 = m20 * m31;
  const tmp_13 = m30 * m21;
  const tmp_14 = m10 * m31;
  const tmp_15 = m30 * m11;
  const tmp_16 = m10 * m21;
  const tmp_17 = m20 * m11;
  const tmp_18 = m00 * m31;
  const tmp_19 = m30 * m01;
  const tmp_20 = m00 * m21;
  const tmp_21 = m20 * m01;
  const tmp_22 = m00 * m11;
  const tmp_23 = m10 * m01;

  const t0 = (tmp_0 * m11 + tmp_3 * m21 + tmp_4 * m31) -
      (tmp_1 * m11 + tmp_2 * m21 + tmp_5 * m31);
  const t1 = (tmp_1 * m01 + tmp_6 * m21 + tmp_9 * m31) -
      (tmp_0 * m01 + tmp_7 * m21 + tmp_8 * m31);
  const t2 = (tmp_2 * m01 + tmp_7 * m11 + tmp_10 * m31) -
      (tmp_3 * m01 + tmp_6 * m11 + tmp_11 * m31);
  const t3 = (tmp_5 * m01 + tmp_8 * m11 + tmp_11 * m21) -
      (tmp_4 * m01 + tmp_9 * m11 + tmp_10 * m21);

  const d = 1.0 / (m00 * t0 + m10 * t1 + m20 * t2 + m30 * t3);

  dst[ 0] = d * t0;
  dst[ 1] = d * t1;
  dst[ 2] = d * t2;
  dst[ 3] = d * t3;
  dst[ 4] = d * ((tmp_1 * m10 + tmp_2 * m20 + tmp_5 * m30) -
          (tmp_0 * m10 + tmp_3 * m20 + tmp_4 * m30));
  dst[ 5] = d * ((tmp_0 * m00 + tmp_7 * m20 + tmp_8 * m30) -
          (tmp_1 * m00 + tmp_6 * m20 + tmp_9 * m30));
  dst[ 6] = d * ((tmp_3 * m00 + tmp_6 * m10 + tmp_11 * m30) -
          (tmp_2 * m00 + tmp_7 * m10 + tmp_10 * m30));
  dst[ 7] = d * ((tmp_4 * m00 + tmp_9 * m10 + tmp_10 * m20) -
          (tmp_5 * m00 + tmp_8 * m10 + tmp_11 * m20));
  dst[ 8] = d * ((tmp_12 * m13 + tmp_15 * m23 + tmp_16 * m33) -
          (tmp_13 * m13 + tmp_14 * m23 + tmp_17 * m33));
  dst[ 9] = d * ((tmp_13 * m03 + tmp_18 * m23 + tmp_21 * m33) -
          (tmp_12 * m03 + tmp_19 * m23 + tmp_20 * m33));
  dst[10] = d * ((tmp_14 * m03 + tmp_19 * m13 + tmp_22 * m33) -
          (tmp_15 * m03 + tmp_18 * m13 + tmp_23 * m33));
  dst[11] = d * ((tmp_17 * m03 + tmp_20 * m13 + tmp_23 * m23) -
          (tmp_16 * m03 + tmp_21 * m13 + tmp_22 * m23));
  dst[12] = d * ((tmp_14 * m22 + tmp_17 * m32 + tmp_13 * m12) -
          (tmp_16 * m32 + tmp_12 * m12 + tmp_15 * m22));
  dst[13] = d * ((tmp_20 * m32 + tmp_12 * m02 + tmp_19 * m22) -
          (tmp_18 * m22 + tmp_21 * m32 + tmp_13 * m02));
  dst[14] = d * ((tmp_18 * m12 + tmp_23 * m32 + tmp_15 * m02) -
          (tmp_22 * m32 + tmp_14 * m02 + tmp_19 * m12));
  dst[15] = d * ((tmp_22 * m22 + tmp_16 * m02 + tmp_21 * m12) -
          (tmp_20 * m12 + tmp_23 * m22 + tmp_17 * m02));

  return dst;
}

