import * as GT from "./gameTools.js";


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

const Identity4x4 = new Float32Array([
        1, 0, 0, 0,
        0, 1, 0, 0,
        0, 0, 1, 0,
        0, 0, 0, 1
]);

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
                GT.crossProduct(b, a, c);
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
            GT.crossProduct(a, b, c);
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

    const img = await GT.loadImage("assets/perlin12.png");

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
        const baseurl = "assets";
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

export {Terrain, TerrainDrawing, createGroundDrawing}
