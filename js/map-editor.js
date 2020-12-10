let mapState;
let websocket;

function init() {
    try {
        mapState = JSON.parse(localStorage.getItem("mapState"));
    } catch {
    }
    if(!mapState) {
        mapState = {objects: {}}
    }
    console.log("map state", mapState, localStorage.getItem("mapState"));
    const elts = document.querySelectorAll(".toolbar img");
    for(const tool of elts) {
        const type = tool.getAttribute("data-type");
        tool.addEventListener("dragstart", ev => handleObjectDragStart(ev, {type: type}));
        if(!mapState.objects[type])
            mapState.objects[type] = [];
    }
    const map = document.querySelector("#map");
    map.addEventListener("dragover", ev => ev.preventDefault());
    map.addEventListener("drop", handleMapDrop);
    document.querySelector("#delete").addEventListener("dragover", ev => ev.preventDefault());    
    document.querySelector("#delete").addEventListener("drop", handleDeleteDrop);
    const hostname = document.location.hostname;
    websocket = new WebSocket(`ws://${hostname}:8080`);    
    drawMap(mapState);
}

function drawMap(state) {
    const mapElt = document.querySelector("#map");
    const mapObjectElt = document.querySelector("#map-objects");
    mapObjectElt.innerHTML = "";
    const {width, height} = mapElt.getBoundingClientRect();
    for(const type in state.objects) {
        const imgsrc = document.querySelector(`[data-type=${type}]`).src;
        for(const obj of state.objects[type]) {
            const elt = document.createElement("img");
            elt.src = imgsrc;
            elt.setAttribute("data-type", type);
            elt.setAttribute("draggable", "true");
            elt.addEventListener("dragstart", ev => handleObjectDragStart(ev, {id: obj.id, type}));
            elt.style = `
                position: absolute; 
                left: ${obj.x*width}px; 
                top: ${obj.y*height}px`;
            mapObjectElt.appendChild(elt);
        }
    }
    console.log(state);
}

function handleObjectDragStart(ev, data) {
    const str = JSON.stringify(data);
    ev.dataTransfer.setData("application/json", str);
    ev.dataTransfer.setDragImage(ev.target, 0, 0);
    ev.dataTransfer.dropEffect = "move";    
}

function saveState() {
    localStorage.setItem("mapState", JSON.stringify(mapState));
    const msg = {
        type: "mapUpdate",
        mapState: mapState
    };
    websocket.send(JSON.stringify(msg));
}

function handleMapDrop(ev) {
    ev.preventDefault();
    const map = document.querySelector("#map");
    const {x, y, width, height} = map.getBoundingClientRect();
    const offset = {x: ev.clientX - x, y: ev.clientY - y};
    const reloffset = {x: offset.x/width, y: offset.y/height};
    const data = JSON.parse(ev.dataTransfer.getData("application/json"));
    let object;
    if(data.id) {
        object = mapState.objects[data.type].find(x => x.id == data.id);
    } else {
        object = {id: Math.random(), type: data.type};
        mapState.objects[data.type].push(object);
    }
    object.x = reloffset.x;
    object.y = reloffset.y;
    saveState();
    drawMap(mapState);
}

function handleDeleteDrop(ev) {
    ev.preventDefault();
    const data = JSON.parse(ev.dataTransfer.getData("application/json"));
    if(data.id === undefined) return;
    mapState.objects[data.type] = mapState.objects[data.type].filter(x => x.id != data.id);
    saveState();
    drawMap(mapState);
}
init()