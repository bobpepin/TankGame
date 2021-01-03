import * as GT from "./gameTools.js";
import {SpriteDrawing} from "./sprite.js";

async function initObstacles(gl, shaders) {
    const images = {
        barrel: "assets/barrelBlack_side.png",
        barricade: "assets/barricadeWood.png"
    }
    const objects = {}
    for(const type in images) {
        const image = await GT.loadImage(images[type]);
        const drawing = new SpriteDrawing(gl, shaders.sprite, image);
        objects[type] = {
            drawing
        }
    }
    return objects;
}

function updateObjectDrawing(drawing, objects) {
    drawing.worldMatrices = [];
    const min = -4;
    const max = 4;
    for(const obj of objects) {
        const x = (obj.x - 0.5)*(max-min);
        const y = -(obj.y - 0.5)*(max-min);        
        const s = 0.1;
        const mat = new Float32Array([
            s, 0, 0, 0,
            0, s, 0, 0,
            0, 0, 1, 0,
            x, y, 0, 1
        ]);
        drawing.worldMatrices.push(mat);
    }
    drawing.spriteCount = drawing.worldMatrices.length;
//     console.log(drawing);
}

function updateObstacles(state) {
    for(const msg of state.network.incoming) {
        if(msg.type != "mapUpdate")
            continue;
        console.log(msg);
//         continue;
        for(const type in msg.mapState.objects) {
            updateObjectDrawing(state.obstacles[type].drawing, msg.mapState.objects[type]);
        }
    }   
}

export {initObstacles, updateObjectDrawing, updateObstacles}