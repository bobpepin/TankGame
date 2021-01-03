import {Identity4x4} from "./geometry.js";
import * as GT from "./gameTools.js";

// Drawing from a GLTF/GLB file
class GLTFDrawing {
    constructor(url, alignmentMatrix) {
        this.url = url;
        this.alignmentMatrix = alignmentMatrix || Identity4x4;
        this.primitiveVertexArrays = {};
        this.bufferViewBuffers = [];
        this.nodeMatrices = [];
        this.worldMatrices = [];
        this.hitTimes = [];
    }
    
    async loadBufferViewGLBuffer(gl, data, bufferPromises, index, target) {
        if(this.bufferViewBuffers[index]) {
            return this.bufferViewBuffers[index];
        }
        const bufferView = data.bufferViews[index];
        const bufferData = await bufferPromises[bufferView.buffer];
        const bufferViewData = new Uint8Array(
            bufferData, bufferView.byteOffset || 0, bufferView.byteLength
        );
        const glBuffer = gl.createBuffer();
        gl.bindBuffer(target, glBuffer);
        gl.bufferData(target, bufferViewData, gl.STATIC_DRAW);
        this.bufferViewBuffers[index] = glBuffer;
        return glBuffer;
    }

        
    async loadPrimitiveVertexArray(gl, attributeIndices, data, bufferPromises, meshIndex, primitiveIndex) {
        const key = `${meshIndex}.${primitiveIndex}`;
        if(this.primitiveVertexArrays[key]) {
            return this.primitiveVertexArrays[key];
        }
        const accessorTypeToNumComponentsMap = {
            "SCALAR": 1,
            "VEC2": 2,
            "VEC3": 3,
            "VEC4": 4
        };
        const primitive = data.meshes[meshIndex].primitives[primitiveIndex];
        const vertexArray = gl.createVertexArray();
        gl.bindVertexArray(vertexArray);
        for(const attribute in primitive.attributes) {
            const attributeIndex = attributeIndices[attribute];
            if(attributeIndex == -1) continue;            
            const accessor = data.accessors[primitive.attributes[attribute]];
            // TODO: accessor.bufferView can be undefined, defaults to all zeros
            const bufferView = data.bufferViews[accessor.bufferView];
            const buffer = await this.loadBufferViewGLBuffer(
                gl, data, bufferPromises, accessor.bufferView, gl.ARRAY_BUFFER
            );
            gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
            // TODO: catch case where accessor.type is a matrix
            const size = accessorTypeToNumComponentsMap[accessor.type];
            gl.enableVertexAttribArray(attributeIndex);
            gl.vertexAttribPointer(
                attributeIndex, size, accessor.componentType, 
                accessor.normalized == true, bufferView.byteStride,
                accessor.byteOffset
            );
        }
        if(primitive.indices) {
            const accessor = data.accessors[primitive.indices];
            // TODO: accessor.bufferView can be undefined, defaults to all zeros
            const bufferView = data.bufferViews[accessor.bufferView];
            const buffer = await this.loadBufferViewGLBuffer(
                gl, data, bufferPromises, accessor.bufferView, 
                gl.ELEMENT_ARRAY_BUFFER
            );
            gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, buffer);
        }
        this.primitiveVertexArrays[key] = vertexArray;
        gl.bindVertexArray(null);
        return vertexArray;
    }
    
    buildGeometryTree(nodeIndex) {
        const node = this.data.nodes[nodeIndex];
        if(!this.nodeMatrices[nodeIndex]) {
            this.nodeMatrices[nodeIndex] = new Float32Array(Identity4x4);
        }
        const children = node.children || [];
        const geometryNode = {
            translation: node.translation || [0, 0, 0],
            rotation: node.rotation || [1, 0, 0, 0],
            scale: node.scale || [1, 1, 1],
            matrix: this.nodeMatrices[nodeIndex],
            children: children.map(c => this.buildGeometryTree(c))
        }
        return geometryNode;
    }
    // data is parsed json from gltf file
    async load(gl, attributeIndices) {
        const response = await fetch(this.url);
        const data = this.data = await response.json();
        const bufferPromises = data.buffers.map(
            async buf => await (await fetch("assets/" + buf.uri)).arrayBuffer()
        );
        for(let i=0; i < data.meshes.length; i++) {
            const mesh = data.meshes[i];
            for(let j=0; j < mesh.primitives.length; j++) {
                await this.loadPrimitiveVertexArray(
                    gl, attributeIndices, data, bufferPromises, i, j
                )
            }
        }
        for(const scene of data.scenes) {
            const sceneTree = {
                scale: [1, 1, 1],
                translation: [0, 0, 0],
                rotation: [1, 0, 0, 0],
                matrix: new Float32Array(Identity4x4),
                children: []
            }
            for(const nodeIndex of scene.nodes) {
                const tree = this.buildGeometryTree(nodeIndex);
                sceneTree.children.push(tree);
            }
            GT.updateGeometryTree(sceneTree, {matrix: this.alignmentMatrix});
            console.log(sceneTree);
        }
    }
    
    draw(gl, program, state) {
        gl.useProgram(program);
        const uniformLocations = {};
        uniformLocations.time = gl.getUniformLocation(program, "time");
        uniformLocations.projectionMatrix = gl.getUniformLocation(
            program, "projectionMatrix"
        );
        uniformLocations.nodeMatrix = gl.getUniformLocation(
            program, "nodeMatrix"
        );        
        uniformLocations.worldMatrix = gl.getUniformLocation(
            program, "worldMatrix"
        );
        uniformLocations.color = gl.getUniformLocation(program, "color");

        gl.uniform1f(uniformLocations.time, state.time);
        gl.uniformMatrix4fv(
            uniformLocations.projectionMatrix, false, state.projectionMatrix
        );

        const data = this.data;
        let enableLog = false;
//         if(!this.lastLogTime || (state.time - this.lastLogTime) > 5) {
//             this.lastLogTime = state.time;
//             enableLog = true;
//         }
        for(const worldMatrix of this.worldMatrices) {
            gl.uniformMatrix4fv(
                uniformLocations.worldMatrix, false, worldMatrix
            );            
            for(let k=0; k < data.nodes.length; k++) {
                const i = data.nodes[k].mesh;
                if(i === undefined)
                    continue;
                const mesh = data.meshes[i];
                const nodeMatrix = this.nodeMatrices[k];
                gl.uniformMatrix4fv(
                    uniformLocations.nodeMatrix, false, nodeMatrix);
                for(let j=0; j < mesh.primitives.length; j++) {
                    const primitive = mesh.primitives[j];
                    if(primitive.material !== undefined) {
                        const material = data.materials[primitive.material];
                        const color = material.pbrMetallicRoughness.baseColorFactor;
                        gl.uniform4fv(uniformLocations.color, color);
                    } else {
                        gl.uniform4fv(uniformLocations.color, [1, 1, 1, 1]);
                    }
                    const vertexArray = this.primitiveVertexArrays[`${i}.${j}`];
                    gl.bindVertexArray(vertexArray);
                    if(primitive.indices) {
                        const accessor = data.accessors[primitive.indices];
                        gl.drawElements(
                            primitive.mode || 4, accessor.count, accessor.componentType,
                            accessor.byteOffset || 0
                        );
                        if(enableLog) {
                            console.log("drawElements", primitive.mode || 4, accessor.count, accessor.componentType,
                            accessor.byteOffset || 0);
                        }
                    } else {
                        const accessor = data.accessors[primitive.attributes.POSITION];
                        gl.draw(primitive.mode || 4, 0, accessor.count);
                    }
                }
            }
        }        
    }
        
    update(state) {}
}

export {GLTFDrawing};