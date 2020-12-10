import {Star} from "./star.js";
import {Fireworks} from "./fireworks.js";

function shuffleArray(array) {
    for (let i = array.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [array[i], array[j]] = [array[j], array[i]];
    }
}

class GameScreen {
    constructor(container) {
        this.container = container;
        this.currentScreen = null;
        const options = {onComplete: () => { this.puzzle.close(); this.startFireworks(); }}
        this.puzzle = new Puzzle(this.container.querySelector("#puzzle"), options);
        this.fireworks = new Fireworks(container.querySelector("#fireworks-canvas"));
        container.querySelector("#fireworks-canvas").addEventListener("click", e => { this.fireworks.stop(); this.switch("title"); });
        container.querySelector("#start-button").addEventListener("click", e => this.startGame());
        this.switch("title");
//         this.startFireworks();
    }
    
    switch(screen) {
        if(this.currentScreen) {
            this.container.classList.remove(`show-${this.currentScreen}`);
        }
        this.container.classList.add(`show-${screen}`);
        this.currentScreen = screen;
    }
    
    async startGame() {
        this.switch("game");
        this.puzzle.reset();
        await this.puzzle.init();
    }
    
    startFireworks() {
        this.container.querySelector("#final-score").textContent = String(this.puzzle.moves);
        this.switch("fireworks");
        this.fireworks.start();
        this.fireworks.startSalvos(800);
    }
}


class Puzzle {
    constructor(containerDiv, options) {
        this.containerDiv = containerDiv;  
        this.options = options;
        this.progress = 0;
        this.moves = 0;
        this.environmentCamera = false;
//         this.sliceCount = sliceCount || 8;
//         this.offset = offset;
        this.activeDrags = {};   
        this.progress = 0;
        this.starContainer = document.querySelector("#star");
        this.starContainer.addEventListener("click", e => this.nextLevel());
        this.star = new Star(this.starContainer);
        this.star.load().then(() => this.star.fill(0));
        document.querySelector("#pause-button").addEventListener("click", e => this.pauseVideo());
        document.querySelector("#play-button").addEventListener("click", e => this.playVideo());
        document.querySelector("#flip-button").addEventListener("click", e => { this.environmentCamera = !this.environmentCamera; this.init()});                
        document.querySelector("#restart-button").addEventListener("click", e => this.init());                
        this.reset();
    }

    async init() {
        const n = this.sliceCount = parseInt(document.querySelector("#puzzle-range").value);
        this.offset = randint(2*n);
        this.starContainer.style.display = "none";
        const containerDiv = this.containerDiv;
//         const n = this.sliceCount;

        const mediaStream = await navigator.mediaDevices.getUserMedia({video: { facingMode: this.environmentCamera ? "environment" : "user" }});
        this.mediaStream = mediaStream;
        const {width: totalWidth, height} = containerDiv.getBoundingClientRect();
        const width = totalWidth / n;
        this.sliceWidth = width;
        this.order = new Array(n).fill(0).map((x, i) => i);
        shuffleArray(this.order);
        this.slices = [];
        const fontSize = Math.max(12, Math.min(42, Math.floor(42-n/1.5)));
        const fontHeight = width/3*1.5;
        const stroke = width > 50 ? "stroke: white;" : "";
        for(let i=0; i < n; i++) {
            const k = i;
            const slice = document.createElement("div");
//             slice.innerHTML = `<svg>
//                                   <text x="0" y="${fontHeight}" style="fill: black; ${stroke} font-weight: bold; font-size: ${fontHeight}px">${this.offset+i}</text>
//                                </svg>`;
            slice.textContent = `${this.offset+i}`;
            slice.style = `position: relative; overflow: hidden; width: ${width}px; color: black; font-size: ${width/3*1.5}px; font-weight: bold; text-align: center; padding-top: 5px;`;
//             slice.style = `display: grid; overflow: hidden; width: ${width}px; color: black; font-size: ${width/3*1.5}px; font-weight: bold; text-align: center; padding-top: 5px;`;
            slice.setAttribute("class", "slice");
            const outline = document.createElement("div");
            outline.style = "z-index: 1; width: 100%; height: 100%; position: absolute; left: 0px; top: 0px;";
//             outline.style = "z-index: 1; width: 100%; grid-row: 1; grid-column: 1;";            
            outline.setAttribute("class", "slice-outline");
            slice.appendChild(outline);
            const video = document.createElement("video");
            video.srcObject = mediaStream;
//             const video = document.createElement("img");
//             video.src = "swans-blur.png";
            video.style = `z-index: 0; position: absolute; top: 0px; left: 0px; object-position: ${-i*width}px 0px; z-index: -1;`;
//             video.style = `z-index: 0; grid-row: 1; grid-column: 1; object-position: ${-i*width}px 0px; z-index: -1;`;            
            video.width = totalWidth;
            video.setAttribute("playsinline", "");
            video.setAttribute("muted", true);
            video.onloadedmetadata = function(e) {
                video.play();
            };
            slice.appendChild(video);
            slice.addEventListener("mousedown", e => this.handleMouseDown(e, k))
            slice.addEventListener("mouseup", e => this.handleMouseUp(e))
            slice.addEventListener("mousemove", e => this.handleMouseMove(e))
            slice.addEventListener("touchstart", e => this.handleTouchStart(e, k));
            slice.addEventListener("touchend", e => this.handleTouchEnd(e));
            slice.addEventListener("touchcancel", e => this.handleTouchEnd(e));
            slice.addEventListener("touchmove", e => this.handleTouchMove(e));
            this.slices.push(slice);
        }
        this.redraw();
//         window.setTimeout(() => this.checkSolution(), 1000);
    }
    
    redraw() {
        this.containerDiv.innerHTML = "";
        console.log(this.order);        
        for(const k of this.order) {
            this.containerDiv.appendChild(this.slices[k]);
        }
    }

    reset() {
        this.progress = 0;
        this.moves = 0;
    }
    
    close() {
        for(const slice of this.slices) {
            slice.innerHTML = "";
        }
        for(const track of this.mediaStream.getTracks()) {
            track.stop();
        };
    }
    
    
    nextLevel() {
        if(this.progress == 5 && this.options && this.options.onComplete) {
            this.options.onComplete();
            return;
        }
        document.querySelector("#puzzle-range").value = Math.ceil(this.sliceCount*1.15); 
        this.init();
    }
    
    checkSolution() {
        let next = 0;
        for(const k of this.order) {
            if(k != next) {
                return false;
            }
            next++;
        }
        console.log("solved!");
        for(const slice of this.slices) {
            slice.setAttribute("class", "slice completed-slice");
        }
        this.star.fill(this.progress);
        this.progress++;
        window.setTimeout(() => this.starContainer.style.display = "grid", 1500);
        window.setTimeout(() => this.star.fill(this.progress), 2000);
        return true;
    }
    
    pauseVideo() {
        const videos = this.containerDiv.querySelectorAll("video");
        for(const video of videos) {
            video.pause();
        }
    }

    playVideo() {
        const videos = this.containerDiv.querySelectorAll("video");
        for(const video of videos) {
            video.play();
        }
    }
        
    handleMouseDown(e, sliceIndex) {
        this.startDrag(e, e, sliceIndex, "mouse");
    }
    
    handleTouchStart(e, sliceIndex) {
        const touch = e.changedTouches[0];        
        this.startDrag(e, touch, sliceIndex, "touch");
    }
    
    startDrag(e, coords, sliceIndex, id) {
        if(this.activeDrags[id]) return;
        e.preventDefault();
        e.stopPropagation();
        const slice = this.slices[sliceIndex];
        const containerRect = this.containerDiv.getBoundingClientRect();        
        const boundingRect = slice.getBoundingClientRect();
        const ofs = {
            x: coords.clientX - boundingRect.x, 
            y: coords.clientY - boundingRect.y
        };
        const placeholder = this.createPlaceholder(slice);
        slice.replaceWith(placeholder);
        const origPosition = slice.style.position;
        slice.style.position = "absolute";
        slice.style.top = boundingRect.y - containerRect.y + "px";
        slice.style.left = boundingRect.x - containerRect.x + "px";
        slice.style.height = boundingRect.height + "px";
        slice.style.zIndex = 1;
        this.containerDiv.appendChild(slice);
        this.activeDrags[id] = {slice, sliceIndex, 
                                hoverPosition: this.order.indexOf(sliceIndex), 
                                placeholder,
                                mouseOffset: ofs};
//         this.updatePlaceholders();
    }
    
    handleMouseMove(e) {
        this.updateDrag(e, e, "mouse");
    }
    
    handleTouchMove(e) {
        const touch = e.changedTouches[0];
        this.updateDrag(e, touch, "touch");
    }        
    
    updateDrag(e, coords, id) {
        const drag = this.activeDrags[id];
        if(!drag) return;
        e.preventDefault();
        e.stopPropagation();
        const {slice, mouseOffset} = drag;
        const containerRect = this.containerDiv.getBoundingClientRect();
        const ofs = {
            x: coords.clientX - mouseOffset.x - containerRect.x , 
            y: coords.clientY - mouseOffset.y - containerRect.y
        };
        slice.style.left = ofs.x + "px";
        slice.style.top = ofs.y + "px";
        const hoverPosition = Math.max(0, Math.min(this.order.length-1, Math.floor(ofs.x / this.sliceWidth + 1/2)));
        if(hoverPosition != drag.hoverPosition) {
            const placeholder = drag.placeholder;
//             console.log(drag.hoverPosition, hoverPosition)            
            this.containerDiv.removeChild(placeholder);
            if(hoverPosition >= this.containerDiv.children.length) {
                this.containerDiv.appendChild(placeholder);
            } else {
                const elt = this.containerDiv.children[hoverPosition];
                this.containerDiv.insertBefore(placeholder, elt);
            }
            drag.hoverPosition = hoverPosition;            
        }
    }
    
    handleMouseUp(e) {
        this.stopDrag(e, "mouse");
    }
    
    handleTouchEnd(e) {
        this.stopDrag(e, "touch");
    }
    
    stopDrag(e, id) {
        const drag = this.activeDrags[id];
        if(!drag) return;
        const {slice, sliceIndex, placeholder, hoverPosition} = drag;
        e.preventDefault();
        e.stopPropagation();
        slice.style.position = "relative";
        slice.style.height = "";
        slice.style.left = "0px";
        slice.style.top = "0px";
        slice.style.zIndex = 1;        
        placeholder.replaceWith(slice);
        const order = this.order.filter(i => i != sliceIndex);
        order.splice(hoverPosition, 0, sliceIndex);
        this.moves++;
        this.order = order;
//         console.log(order);
        this.checkSolution();
//         this.containerDiv.removeChild(placeholder);
//  ?       this.containerDiv.appendChild(drag.slice);
        this.activeDrags[id] = undefined;
    }
    
    createPlaceholder(slice) {
        const placeholder = document.createElement("div");
        placeholder.style.width = this.sliceWidth + "px";
//         placeholder.style = slice.style;
        placeholder.innerHTML = "&nbsp;";
        return placeholder;
//         placeholder.textContent = "";
    }
    


}

function randint(n) {
    return Math.random()*n|0;
}

const screen = new GameScreen(document.querySelector("#screen-container"));