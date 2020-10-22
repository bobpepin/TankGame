import * as THREE from "https://unpkg.com/three@0.119.1/build/three.module.js";
import { GLTFLoader } from "https://unpkg.com/three@0.119.1/examples/jsm/loaders/GLTFLoader.js";
import { OrbitControls } from "https://unpkg.com/three@0.119.1/examples/jsm/controls/OrbitControls.js";
import Stats from "https://unpkg.com/three@0.119.1/examples/jsm/libs/stats.module.js";

let container;
let camera;
let controls;
let renderer;
let scene;

let platformMeshes;
let target;

let externalMesh;


function SceneState() {
    this.tick = 0;
    this.projectileLaunched = {};
    this.projectiles = [];
    this.players = {}
}

let sceneState = new SceneState();

let projectileLaunched = {};

let projectiles = [];


async function init() {
    target = new THREE.Vector2(0.0, 0.0);
    container = document.querySelector("#scene-container");

    scene = new THREE.Scene();
//    scene.background = new THREE.Color(0x87CEFA);
    scene.background = new THREE.Color(0xff0000);

    createCamera();
    createControls();
    createLights();
    createMeshes();
    createRenderer();
//    await createClouds();
    await createSkydome();
    await loadExternalModels(["gun.glb", "gun2.glb"]);

    const stats = new Stats();
    stats.showPanel(1);
    container.appendChild(stats.dom);    
    
    renderer.setAnimationLoop((time) => {
//        stats.begin()
        update(time);
        render();
//        stats.end();        
    });
}

async function loadExternalModels(sources) {
//     const gltf = await loader.loadAsync("duck.gltf");
    for(let i=0; i < sources.length; i++) {
        console.log(sources[i]);
        const player = new THREE.Group();
        player.name = `model_${i}`;
        const loader = new GLTFLoader();
        const gltf = await loader.loadAsync(sources[i]);
        const gltfScene = gltf.scene;
        gltfScene.position.y = 1;
        gltfScene.position.x = i;
        gltfScene.name = "player";
    //    gltfScene.scale.divideScalar(1000);
    //     gltfScene.position.set(0.0, 0.5, 0.0);
        player.add(gltfScene);
        {
            const geometry = new THREE.CircleBufferGeometry(0.2);
            const material = new THREE.MeshBasicMaterial({color: 0x808080, transparent: true, opacity: 0.3});
            const shadow = new THREE.Mesh(geometry, material);
            shadow.name = "shadow";
            player.add(shadow);
        }
        scene.add(player);
        sceneState.players[i] = {position: gltfScene.position.clone(), rotation: gltfScene.rotation.clone()};
        console.log(gltf);
        console.log(scene);
        console.log(sceneState);
    }
}

function createCamera() {
  camera = new THREE.PerspectiveCamera(
    35,
    container.clientWidth / container.clientHeight,
    0.1,
    100
  );
  camera.position.set(-5, 5, 7);
}

function createControls() {
  controls = new OrbitControls(camera, container);
}

function createLights() {
//   const ambientLight = new THREE.HemisphereLight(0xddeeff, 0x0f0e0d, 5);
  const ambientLight = new THREE.HemisphereLight(0xffffff, 0xffffff, 3);    
  scene.add(ambientLight)
//  const mainLight = new THREE.DirectionalLight(0xffffff, 5);
//  mainLight.position.set(10, 10, 10);
//  scene.add(mainLight);

}

function createMaterials() {
  const platform = new THREE.MeshBasicMaterial({
    color: 0x000000,
    flatShading: false
  });
  platform.color.convertSRGBToLinear();

  const platformLine = new THREE.LineBasicMaterial({
    color: 0xffffff,
    linewidth: 2
  });
  platformLine.color.convertSRGBToLinear();

  const characterLine = new THREE.LineBasicMaterial({
    color: 0xffff00,
    linewidth: 2
  });
  platformLine.color.convertSRGBToLinear();

  return {
    platform,
    character: platform,
    platformLine,
    characterLine
  };
}

function createGeometries() {
  const platform = new THREE.CylinderBufferGeometry(0.5, 0.5, 0.1, 6);

  const character = new THREE.BoxBufferGeometry(0.4, 1.2, 0.2);

  return {
    platform,
    character
  };
}

async function createMeshes() {
  const centers = [
    [-1, -1],
    [ 0,  0],
    [ 1,  0],
    [ 2,  0]
  ];
  const environ = new THREE.Group();
  scene.add(environ);

  const materials = createMaterials();
  const geometries = createGeometries();

  const platform = new THREE.Group();
  {
    const surface = new THREE.Mesh(geometries.platform, materials.platform);
    surface.name = "mesh";
    const wireframe = new THREE.WireframeGeometry(geometries.platform);
    const line = new THREE.LineSegments(wireframe, materials.platformLine);
    platform.add(surface);
    platform.add(line);
  }

  platformMeshes = [];
  for(const [x, z] of centers) {
    const p = platform.clone();
    p.position.y = -0.05;
    p.position.x = x;
    p.position.z = z;
    environ.add(p);
    platformMeshes.push(p.getObjectByName("mesh"))
  }

  const character = new THREE.Group();
  character.name = "character";
  {
    const surface = new THREE.Mesh(geometries.character, materials.character);
    const wireframe = new THREE.WireframeGeometry(geometries.character);
    const line = new THREE.LineSegments(wireframe, materials.characterLine);
    character.add(surface);
    character.add(line);
    character.position.y = 0.6 + 0.01;
  }
  scene.add(character);

  const ground = new THREE.Group();
  {
    const textureSources = {
       aoMap: "Ground037_2K-JPG/Ground037_2K_AmbientOcclusion.jpg",
       displacementMap: "Ground037_2K-JPG/Ground037_2K_Displacement.jpg",
        map: "Ground037_2K-JPG/Ground037_2K_Color.jpg",
       normalMap: "Ground037_2K-JPG/Ground037_2K_Normal.jpg",
       roughnessMap: "Ground037_2K-JPG/Ground037_2K_Roughness.jpg",
    };
    const materialData = {};
    for(const k in textureSources) {
        const loader = new THREE.TextureLoader();
        const texture = await loader.loadAsync(textureSources[k]);
        materialData[k] = texture;
    }
    materialData.side = THREE.DoubleSide;
    const pbrMaterial = new THREE.MeshStandardMaterial(materialData);
    const geometry = new THREE.PlaneBufferGeometry();
    const loader = new THREE.TextureLoader();
    const texture = loader.load('Ground034_2K-JPG/Ground034_2K_Color.jpg');
    const material = new THREE.MeshBasicMaterial( { map: texture, side: THREE.DoubleSide } );      
//     const material = new THREE.MeshBasicMaterial( {color: 0x03C03C, side: THREE.DoubleSide} );
//     const plane = new THREE.Mesh( geometry, pbrMaterial );
    const plane = new THREE.Mesh( geometry, material );      
    ground.add(plane);
    ground.rotation.x = Math.PI/2;
    ground.position.y = -0.1;
    ground.scale.x = 20;
    ground.scale.y = 20;
  }
  scene.add(ground);
    
  const flag = new THREE.Group();
  {
    const geometry = new THREE.PlaneBufferGeometry();
    const loader = new THREE.TextureLoader();
    const texture = loader.load('flag1.png');
    const material = new THREE.MeshBasicMaterial( { map: texture, side: THREE.DoubleSide } );      
//    const material = new THREE.MeshBasicMaterial( {color: 0x03C03C, side: THREE.DoubleSide} );
    const plane = new THREE.Mesh( geometry, material );
    flag.add(plane);
    flag.position.z = -10;
    flag.scale.y = 0.75;
  }
  scene.add(flag);
    
  //environ.add(line);
}

let cloudUniforms;

async function createClouds() {
    const vertexSource = await (await fetch("js/cloud_vertex.glsl")).text();
    const fragmentSource = await (await fetch("js/cloud_fragment.glsl")).text();    
    console.log(vertexSource, fragmentSource);
    const loader = new THREE.TextureLoader();
//     const images = ["perlin1.png", "perlin2.png", "perlin3.png", "perlin4.png"];
    const images = ["perlin4.png", "perlin3.png", "perlin2.png", "perlin1.png"];    
//     const textures = [await loader.load("perlin1.png"), await loader.load("perlin2.png")];
    const textures = [];
    for(const url of images) {
        textures.push(await loader.load(url));
    }
    for(const texture of textures) {
        texture.wrapS = THREE.MirroredRepeatWrapping;
        texture.wrapT = THREE.MirroredRepeatWrapping;
    }
    const uniforms = {
        color: { value: new THREE.Color(0x00aaff) },
        time: { value: 0.0 },
        sampler1: { value: textures[0] },
        sampler2: { value: textures[1] },
        sampler3: { value: textures[2] },
        sampler4: { value: textures[3] },        
    };
    cloudUniforms = uniforms;
    const material = new THREE.RawShaderMaterial({ 
        uniforms: uniforms,
        vertexShader: vertexSource, 
        fragmentShader: fragmentSource 
    });
//     const material = new THREE.MeshBasicMaterial( { map: texture, side: THREE.DoubleSide } );          
//     const material = new THREE.MeshBasicMaterial( {color: 0x03C03C, side: THREE.DoubleSide} );    
    const geometry = new THREE.PlaneBufferGeometry();
    const clouds = new THREE.Mesh( geometry, material );
    clouds.rotation.x = -Math.PI/2;
    clouds.position.y = 0;
    clouds.scale.x = 20;
    clouds.scale.y = 20;
//     clouds.position.z = -12;
    scene.add(clouds);
}

let skyUniforms;
async function createSkydome() {
    const vertexSource = await (await fetch("js/sky_vertex.glsl")).text();
    const fragmentSource = await (await fetch("js/sky_fragment.glsl")).text();    
    console.log(vertexSource, fragmentSource);
    const loader = new THREE.TextureLoader();
//     const images = ["perlin1.png", "perlin2.png", "perlin3.png", "perlin4.png"];
    const images = ["perlin4.png", "perlin3.png", "perlin2.png", "perlin1.png"];    
//     const textures = [await loader.load("perlin1.png"), await loader.load("perlin2.png")];
    const textures = [];
    for(const url of images) {
        textures.push(await loader.load(url));
    }
    for(const texture of textures) {
        texture.wrapS = THREE.MirroredRepeatWrapping;
        texture.wrapT = THREE.MirroredRepeatWrapping;
    }
    const uniforms = {
        color: { value: new THREE.Color(0x00aaff) },
        time: { value: 0.0 },
        sampler1: { value: textures[0] },
        sampler2: { value: textures[1] },
        sampler3: { value: textures[2] },
        sampler4: { value: textures[3] },        
    };
    skyUniforms = uniforms;
    const material = new THREE.RawShaderMaterial({ 
        uniforms: uniforms,
        vertexShader: vertexSource, 
        fragmentShader: fragmentSource,
        transparent: true,
        side: THREE.DoubleSide,
//        blending: THREE.AdditiveBlending
    });
//     const material = new THREE.MeshBasicMaterial( { map: texture, side: THREE.DoubleSide } );          
//     const material = new THREE.MeshBasicMaterial( {color: 0x03C03C, side: THREE.DoubleSide} );    
    const geometry = new THREE.BufferGeometry();
    const vertices = new Float32Array([
        -1.0, -1.0,  1.0,
         1.0, -1.0,  1.0,
        -1.0,  1.0,  1.0,

        -1.0,  1.0,  1.0,
         1.0, -1.0,  1.0,
         1.0,  1.0,  1.0
    ]);
    const uv = new Float32Array([
        0, 0,
        1, 0,
        0, 1,
        0, 1,
        1, 0,
        1, 1
    ]);
    geometry.setAttribute('position', new THREE.BufferAttribute(vertices, 3));
    geometry.setAttribute('uv', new THREE.BufferAttribute(uv, 2));    
    const sky = new THREE.Mesh( geometry, material );
    scene.add(sky);
}

function createRenderer() {
  renderer = new THREE.WebGLRenderer({ antialias: true });
  renderer.setSize(container.clientWidth, container.clientHeight);

  renderer.setPixelRatio(window.devicePixelRatio);

//   renderer.physicallyCorrectLights = true;

  container.appendChild(renderer.domElement);
}

function update(time) {
    skyUniforms.time.value = time;
    const currentState = sceneState;
    const nextState = new SceneState();
    
    updateModel(currentState, nextState);
    updateProjectiles(currentState, nextState);

    nextState.tick = currentState.tick + 1;
    sceneState = nextState;
    
    const character = scene.getObjectByName("character");
    if(!character) {
        return;
    }
    const eps = 0.01;

    const pos = new THREE.Vector2(character.position.x, character.position.z);
    //const pos = new THREE.Vector2(0, 0);
    //console.log(character.position.x);
    if(pos.distanceTo(target) < eps) {
        return;
    }
    //console.log(velocity);
    const speed = 0.01;
    const direction = new THREE.Vector2();
    direction.subVectors(target, pos);
    direction.normalize();
    character.position.x += speed * direction.x;
    character.position.z += speed * direction.y;
}

function updateModel(current, next) {
    Object.assign(next.players, current.players);
    const gamepads = navigator.getGamepads();
    for(let i=0; i < gamepads.length; i++) {
        if(!gamepads[i]) {
            continue;
        }

        const position = current.players[i].position.clone();
        const rotation = current.players[i].rotation.clone();

        
        if(gamepads[i].buttons[2].pressed) {
            position.x = 0;
            position.z = 0;
            next.players[i] = {position, rotation};
            continue;
        }


        const axes = new Array(gamepads[i].axes.length);
        const epsilon = 0.1;
        for(let k=0; k < axes.length; k++) {
            if(Math.abs(gamepads[i].axes[k]) > epsilon) {
                axes[k] = gamepads[i].axes[k];
            } else {
                axes[k] = 0;
            }
        }

        let hit = false;
        for(const projectile of current.projectiles) {
            const d2 = position.distanceTo(projectile.position);
            if(d2 < 0.7*0.7) {
                hit = true;
            }
        }
        
        position.x += axes[0] * 1e-1;
        position.z += axes[1] * 1e-1;
        rotation.y -= axes[2] * 1e-1;
        rotation.z += axes[3] * 1e-1;
        if(hit) { 
            position.x += Math.random();
            position.z += Math.random();
        }
        next.players[i] = {position, rotation};
        const model = scene.getObjectByName(`model_${i}`);
        const playerMesh = model.getObjectByName("player");
        playerMesh.position.copy(position);
        playerMesh.rotation.copy(rotation);
        const shadow = model.getObjectByName("shadow");
        shadow.position.copy(position);
        shadow.position.y = 0;
    }
//    console.log(gamepads[0].axes);
}

function getRandomInt(max) {
  return Math.floor(Math.random() * Math.floor(max));
}

function createProjectileObject() {
    const projectile = new THREE.Group();
    {
        const geometry = new THREE.SphereBufferGeometry(0.1);
        const color = getRandomInt(0xFFFFFF);
        const material = new THREE.MeshBasicMaterial({color: color});
        const sphere = new THREE.Mesh( geometry, material );
        sphere.name = "sphere";
        projectile.add(sphere);
    }
    {
        const geometry = new THREE.CircleBufferGeometry(0.1);
        const material = new THREE.MeshBasicMaterial({color: 0x808080, transparent: true, opacity: 0.3});
        const shadow = new THREE.Mesh(geometry, material);
        shadow.name = "shadow";
        projectile.add(shadow);
    }
    return projectile;
}

function updateProjectiles(current, next) {
    const accel = new THREE.Vector3(0.0, -9.81, 0.0);
//     const accel = new THREE.Vector3(0.0, 0.0, 0.0);    
    const dt = 1/60;
    for(const projectile of current.projectiles) {
        if(!projectile.sceneObject) {
            projectile.sceneObject = createProjectileObject();
            scene.add(projectile.sceneObject);
        }
        const dv = accel.clone();
        const speed = projectile.speed.clone()
        const position = projectile.position.clone();
        dv.multiplyScalar(dt);
        speed.add(dv);
        // Collision with ground
        {
            const r = 0.1;
            const d = 0.1;
            const t = (r - d - position.y)/speed.y;
            if(t >= 0 && t <= dt) {
                const dx = speed.clone();
                dx.multiplyScalar(t);
                position.add(dx);
                speed.y = -speed.y * 0.8; // bounce and dampen by 0.8
                const dx1 = speed.clone();
                dx1.multiplyScalar(dt - t);
                position.add(dx1);
            } else {
                const dx = speed.clone();
                dx.multiplyScalar(dt);
                position.add(dx);
            }
        }
        projectile.sceneObject.getObjectByName("sphere").position.copy(position);
        const shadow = projectile.sceneObject.getObjectByName("shadow");
        shadow.position.copy(position);
        shadow.position.y = 1e-6;
        shadow.scale.x = shadow.scale.z = Math.max((5.0 - position.y) / 5.0, 0.0);
        if(position.lengthSq() > 100*100) {
            scene.remove(projectile.sceneObject);
        } else {
            next.projectiles.push({position, speed, sceneObject: projectile.sceneObject});
        }
    }
    const gamepads = navigator.getGamepads();
    for(let i=0; i < gamepads.length; i++) {
        next.projectileLaunched[i] = current.projectileLaunched[i];
        if(!gamepads[i]) continue;
        if(gamepads[i].buttons[7].pressed) {
            if(!current.projectileLaunched[i]) {
                const projectile = launchProjectile(`model_${i}`);
                next.projectiles.push(projectile);
                next.projectileLaunched[i] = true;
//                console.log(current, next);
            }
        } else {
            next.projectileLaunched[i] = false;
        }
    }
}

function launchProjectile(modelName) {
    const player = scene.getObjectByName(modelName);
    const model = player.getObjectByName("player");
    const speed = new THREE.Vector3(0.0, 1.0, 0.0);
    speed.transformDirection(model.matrixWorld);
    const offset = speed.clone();
    offset.multiplyScalar(0.71);
    speed.multiplyScalar(10.0);
    const projectile = {
        position: model.position.clone(),
        speed: speed,
        sceneObject: null
    }
    projectile.position.add(offset);
    return projectile;
}

function render() {
  renderer.render(scene, camera);
}

function onWindowResize() {
  camera.aspect = container.clientWidth / container.clientHeight;

  // update the camera's frustum
  camera.updateProjectionMatrix();

  renderer.setSize(container.clientWidth, container.clientHeight);
}

window.addEventListener("resize", onWindowResize);

function onMouseDown(event) { 
  const raycaster = new THREE.Raycaster(); 
  const mouse = new THREE.Vector2(); 
  // calculate mouse position in normalized device coordinates 
  // (-1 to +1) for both components 
  mouse.x = ( event.clientX / window.innerWidth ) * 2 - 1; 
  mouse.y = - ( event.clientY / window.innerHeight ) * 2 + 1; 
  // update the picking ray with the camera and mouse position 
  raycaster.setFromCamera( mouse, camera ); // calculate objects intersecting the picking ray 
  var intersects = raycaster.intersectObjects( platformMeshes, false ); 
  //console.log(intersects);
  for(const inter of intersects) {
    target = new THREE.Vector2(inter.point.x, inter.point.z)
  } 
}
window.addEventListener( 'mousedown', onMouseDown, false ); 

window.addEventListener("load", init);
//init();

