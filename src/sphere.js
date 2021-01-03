import * as THREE from "https://unpkg.com/three@0.119.1/build/three.module.js";
import { GLTFLoader } from "https://unpkg.com/three@0.119.1/examples/jsm/loaders/GLTFLoader.js";
import { OrbitControls } from "https://unpkg.com/three@0.119.1/examples/jsm/controls/OrbitControls.js";
import Stats from "https://unpkg.com/three@0.119.1/examples/jsm/libs/stats.module.js";

let scene, renderer, controls, camera;

async function init() {
    await initThree();
}

async function initThree() {
    const container = document.querySelector("#scene");    
    camera = new THREE.PerspectiveCamera(
        35,
        container.clientWidth / container.clientHeight,
        0.1,
        100
    );
    camera.position.set(-5, 5, 7);
    controls = new OrbitControls(camera, container);

    scene = new THREE.Scene();
    scene.background = new THREE.Color(0x000080);
    const ambientLight = new THREE.HemisphereLight(0xffffff, 0xffffff, 3);    
    scene.add(ambientLight);
    const mainLight = new THREE.DirectionalLight(0xffffff, 0);
    mainLight.position.set(2, 2, 2);
    scene.add(mainLight);
    

//     const sphere = await createSphere();
    const sphere = await createPerlinSphere();    
    scene.add(sphere);    
    
    {
        const material = new THREE.MeshBasicMaterial({color: 0xffff00});
        const geometry = new THREE.SphereBufferGeometry();
        const sun = new THREE.Mesh(geometry, material);
        sun.position.copy(cloudUniforms.lightPosition.value);
        scene.add(sun);
    }

    renderer = new THREE.WebGLRenderer({ antialias: true });
    renderer.setSize(container.clientWidth, container.clientHeight);
    renderer.setPixelRatio(window.devicePixelRatio);
    container.appendChild(renderer.domElement);
    
    renderer.setAnimationLoop((time) => {
        updateClouds(time);
        renderer.render(scene, camera);
    });
}

async function createSphere() {
    const uvToCart = [
        (u, v) => [1, -v, -u],
        (u, v) => [-1, -v, u],
        (u, v) => [u, 1, v],
        (u, v) => [u, -1, -v],
        (u, v) => [u, -v, 1],
        (u, v) => [-u, -v, -1],
    ];
    const sources = uvToCart.map(drawTexture);
    const textureCube = new THREE.CubeTexture();
    textureCube.format = THREE.RGBAFormat;
    for(let i=0; i < sources.length; i++) {
        const imageData = sources[i];
        const data = new Uint8Array(imageData.data);
        const dataTexture = new THREE.DataTexture(
            data,
            imageData.width, 
            imageData.height, 
            THREE.RGBAFormat, 
            THREE.UnsignedByteType);
        console.log(imageData, data, dataTexture);
        dataTexture.generateMipmaps = true;
        dataTexture.needsUpdate = true;
        textureCube.images[i] = dataTexture;
//         textureCube.images[i] = sources[i];        
    }
    textureCube.needsUpdate = true;
    
//     const loader = new THREE.CubeTextureLoader();
//     const textureCube = loader.load(sources);    
    const vertexSource = await (await fetch("js/cube_vertex.glsl")).text();
    const fragmentSource = await (await fetch("js/cube_fragment.glsl")).text();    
    const uniforms = {
        color: { value: new THREE.Color(0x00aaff) },
        time: { value: 0.0 },
        sampler: { value: textureCube },
    };

    const material = new THREE.RawShaderMaterial({ 
        uniforms: uniforms,
        vertexShader: vertexSource, 
        fragmentShader: fragmentSource,
        side: THREE.DoubleSide
    });

    const geometry = new THREE.SphereBufferGeometry(10, 32, 24);
    const sphere = new THREE.Mesh(geometry, material);
    return sphere;
}


function createCube(imageData, width, height, atlas) {
    const sides = atlas.map(chart => fetchTexture(chart, imageData));
//    console.log(sides[0]);
    if(1)
    {
        const canvas = document.createElement("canvas");
        canvas.height = height;
        canvas.width = width;
        document.getElementById("cubemaps").appendChild(canvas);
        const ctx = canvas.getContext("2d");
        const texImageData = ctx.createImageData(width, height);
        const source = sides[2];
        for(let i=0; i < source.length; i++) {
            texImageData.data[i] = source[i];
        }
        ctx.putImageData(texImageData, 0, 0);
        console.log(texImageData);
    }
    const textureCube = new THREE.CubeTexture();
    textureCube.format = THREE.RGBAFormat;
    for(let i=0; i < atlas.length; i++) {
        const data = sides[i];
        const dataTexture = new THREE.DataTexture(
            data,
            width,
            height, 
            THREE.RGBAFormat, 
            THREE.UnsignedByteType);
        dataTexture.needsUpdate = true;
        textureCube.images[i] = dataTexture;
    }
    textureCube.needsUpdate = true;    
    return textureCube;
}

let cloudUniforms;

function updateClouds(time) {
//    return;
//     const speeds = [0.1, -0.2, -0.25, 0.3];
    const speeds = [0.5, -0.2, -0.25, 0.3];
    for(let i=0; i < 4; i++) {
        const theta = (speeds[i] * time/1000) % (2*Math.PI);
        const mat = new THREE.Matrix3();
        if(i % 2 == 1) {
            mat.set(1, 0, 0,
                    0, Math.cos(theta), -Math.sin(theta),
                    0, Math.sin(theta), Math.cos(theta));
        } else {
            mat.set(Math.cos(theta), 0, Math.sin(theta),
                    0, 1, 0,
                    -Math.sin(theta), 0, Math.cos(theta));
        }
        cloudUniforms[`rotation${i+1}`] = {value: mat};
    }
}

async function createPerlinSphere() {
    const [width, height] = [512, 512];    
    const imageSources = ["perlin4.png", "perlin3.png", "perlin2.png", "perlin1.png"];
//     const imageSources = ["circle.png", "circle.png", "circle.png", "circle.png"];    
    const sourceData = [];
    for(const source of imageSources) {
        const imageData = await loadImage(source);
        sourceData.push(imageData);
    }
    const atlas = sphericalAtlas(width, height);    
    const textureCubes = sourceData.map(imageData => createCube(imageData, width, height, atlas));
//     const textureCube = loader.load([src, src, src, src, src, src]);
//     const textureCube = new THREE.CubeTexture([imageData, imageData, imageData, imageData, imageData, imageData]);
    const vertexSource = await (await fetch("js/cube_clouds_vertex.glsl")).text();
    const fragmentSource = await (await fetch("js/cube_clouds_fragment.glsl")).text();    
    const uniforms = {
        lighting: { value: true },
        threshold: { value: 0.0 },
        color: { value: new THREE.Color(0x00aaff) },
        radius: { value: 10.0 },
        lightPosition: { value: new THREE.Vector3(15.0, 0.0, 0.0) },
        time: { value: 0.0 },
//        sampler: { value: textureCube },
    };
    for(let i=0; i < 4; i++) {
        uniforms[`sampler${i+1}`] = {value: textureCubes[i]};
        const mat = new THREE.Matrix3();
        mat.identity();
        uniforms[`rotation${i+1}`] = {value: mat};
    }
    cloudUniforms = uniforms;
    const material = new THREE.RawShaderMaterial({ 
        uniforms: uniforms,
        vertexShader: vertexSource, 
        fragmentShader: fragmentSource,
        side: THREE.DoubleSide
    });

    const geometry = new THREE.SphereBufferGeometry(10, 32, 24);
    const sphere = new THREE.Mesh(geometry, material);
    return sphere;
}

let thresholdLevel = 0;

document.addEventListener('keydown', (e) => {
    if(event.key == 'l') {
        cloudUniforms.lighting.value = !cloudUniforms.lighting.value;
    } else if(event.key == 't') {
        thresholdLevel = (thresholdLevel + 1) % 10
        cloudUniforms.threshold.value = 0.1 * thresholdLevel;
    }
});


function loadImage(url) {
    const img = new Image();
    img.src = url;
    var canvas = document.getElementById("source");
    var ctx = canvas.getContext("2d");
    const r = new Promise((resolve, reject) => {
        img.onload = function() {
            ctx.drawImage(img, 0, 0);
            img.style.display = "none";
            const data = ctx.getImageData(0, 0, img.width, img.height);
            resolve(data);
        }
    });
    return r;
}


function sphericalChart(width, height, uvToCart) {
    const chart = new Float32Array(width*height*2);
    for(let i=0; i < width; i++) {
        const u = 2*(i/width)-1;
        for(let j=0; j < height; j++) {
            const v = 2*(j/height)-1;            
            const [x, y, z] = uvToCart(u, v);
            const theta = Math.atan2(x, z);
            const phi = Math.atan2(y, Math.sqrt(z**2 + x**2))
            chart[2*(i + j*width)] = theta;
            chart[2*(i + j*width)+1] = phi;
        }
    }
    return chart;
}

function sphericalAtlas(width, height) {
    const uvToCart = [
        (u, v) => [1, -v, -u],
        (u, v) => [-1, -v, u],
        (u, v) => [u, 1, v],
        (u, v) => [u, -1, -v],
        (u, v) => [u, -v, 1],
        (u, v) => [-u, -v, -1],
    ];
    const atlas = uvToCart.map(uv => sphericalChart(width, height, uv));
    return atlas;
}   
    
function fetchTexture(chart, image) {
    const {width, height, data} = image;
    const result = new Uint8Array(chart.length*2);
    const logmsg = [];
    for(let n=0; n < chart.length/2; n++) {
        const [u, v] = [chart[2*n], chart[2*n+1]];
        const i = Math.min(Math.abs(Math.round((u/(Math.PI))*(width-1))), width-1);
        const j = Math.min(Math.abs(Math.round((v/(Math.PI/2))*height)), height-1);
        for(let k=0; k < 4; k++) {
            result[4*n+k] = data[4*(width*j+i)+k];
        }
        if(Math.abs(u - Math.PI) < 0.01) {
//             result[4*n] = 0;
            logmsg.push([u, v, i, j]);
        }
    }
    console.log(logmsg);
//    console.log(chart, image, result);
    return result;
}

function drawTexture(uvToCart) {
    const canvas = document.getElementById("tex");
    const [width, height] = [canvas.width, canvas.height];    
    const ctx = canvas.getContext('2d');
    const imageData = ctx.createImageData(width, height);
    const data = imageData.data;
    const tau = 0.1;
    const omega = 4*8;
    for(let i=0; i < width; i++) {
        const u = 2*(i/width)-1;
//         const theta = 2*(u/width)-1;
//         const theta = Math.atan(u);
        for(let j=0; j < height; j++) {
            const v = 2*(j/height)-1;            
            const [x, y, z] = uvToCart(u, v);
            const theta = Math.atan2(x, z);
            const phi = Math.atan2(y, Math.sqrt(z**2 + x**2))
//             const phi = Math.atan(v/Math.sqrt(u**2 + 1));
//             const phi = 2*(v/height)-1;
            const f = Math.max(Math.exp(-tau*(Math.sin(omega*theta)**2)), 
                               Math.exp(-tau*(Math.sin(omega*phi)**2)));
//             const f = 0.5 + phi / Math.PI;
//             const f = 0;
//             const g = 0.5 + theta / (2*Math.PI);
            const g = f;
            const h = f;
            const red = Math.floor(f * 255);
            const green = Math.floor(g * 255);            
            const blue = Math.floor(h * 255);
//             const val = (Math.abs(Math.cos(8*4*theta)) < 0.1 || Math.abs(Math.cos(8*4*phi)) < 0.1) ? 0 : 255;
//            const val = Math.floor((theta / (Math.PI/2) + 1/2) * 255);
            data[4*(i + j*width)] = 0; //0*red;
            data[4*(i + j*width)+1] = 0; //0*green; //Math.floor(phi*255);
            data[4*(i + j*width)+2] = blue; //Math.floor(phi*255);
            data[4*(i + j*width)+3] = 255;
        }
    }
    ctx.putImageData(imageData, 0, 0);
//    return ctx.getImageData(0, 0, width, height);
//     return canvas.toDataURL("image/png");
    return imageData;
}

initThree();
//document.addEventListener("load", init);