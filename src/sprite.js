import {twoTriangles} from "./geometry.js";
import {matmul} from "./gameTools.js";
import * as GT from "./gameTools.js";

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

export {SpriteDrawing};