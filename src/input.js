class PointerJoystick {
    constructor(elt, radius) {
        this.radius = radius || 64;
//         elt.addEventListener("pointerdown", e => this.handleDown(e));
        elt.addEventListener("mousedown", e => this.handleDown(e));        
//         elt.addEventListener("pointerup", e => this.handleUp(e));
        elt.addEventListener("mouseup", e => this.handleUp(e));        
//        elt.addEventListener("pointerout", e => this.handleUp(e));        
//         elt.addEventListener("pointermove", e => this.handleMove(e));
        elt.addEventListener("mousemove", e => this.handleMove(e));        
        
        elt.addEventListener("touchstart", e => this.handleTouchStart(e));
        elt.addEventListener("touchend", e => this.handleTouchEnd(e));
        elt.addEventListener("touchcancel", e => this.handleTouchEnd(e));        
        elt.addEventListener("touchmove", e => this.handleTouchMove(e));        
        this.canvas = elt;
        this.context = elt.getContext("2d");
        this.active = false;
        this.tap = false;
        this.moved = false;
        this.startTime = -Infinity;
        this.stopTime = -Infinity;
        this.axes = [0, 0];
        this.lastOffset = [0, 0];
    }
    
    handleDown(event) {
        console.log("down", event);
        event.preventDefault();
        event.stopPropagation();
//         this.start(event.offsetX, event.offsetY);
        this.start(event.clientX, event.clientY);
    }
    
    getTouchOffset(event) {
        return [touch.clientX, touch.clientY];
        const touch = event.changedTouches[0];
        const eltRect = this.canvas.getBoundingClientRect();
        const offsetX = touch.clientX - eltRect.left;
        const offsetY = touch.clientY - eltRect.top;
        return [offsetX, offsetY];
    }
                
    handleTouchStart(event) {
//         console.log("touchstart");
        event.preventDefault();
        event.stopPropagation();
        if(event.changedTouches.length == 0)
            return;
        const [offsetX, offsetY] = this.getTouchOffset(event);
        this.start(offsetX, offsetY);
    }   
    
    start(clientX, clientY) {
//         console.log("start", offsetX, offsetY);
        if(this.active) return;
        this.startTime = performance.now();
        if(this.startTime - this.stopTime > 1000) {
            const eltRect = this.canvas.getBoundingClientRect();
            const offsetX = clientX - eltRect.left;
            const offsetY = clientY - eltRect.top;        
            this.origin = [offsetX, offsetY];
            this.lastOffset[0] = offsetX;
            this.lastOffset[1] = offsetY;
            this.moved = false;
        } else {
            this.tap = true;
        }
        this.active = true;
        this.move(clientX, clientY);
    }
    
    handleUp(event) {
        event.preventDefault();
        event.stopPropagation();
        this.stop();
    }
    
    handleTouchEnd(event) {
        event.preventDefault();
        event.stopPropagation();
        if(event.targetTouches.length == 0)
            this.stop();
    }
    
    stop() {
        this.active = false;
        this.axes = [0, 0];
        const {context, canvas} = this;
        context.clearRect(0, 0, canvas.width, canvas.height);        
        this.stopTime = performance.now()
        if(this.stopTime - this.startTime < 1000 && !this.moved) {
            this.tap = true;
        }
    }
    
    handleMove(event) {
        event.preventDefault();
        event.stopPropagation();
//         this.move(event.offsetX, event.offsetY);
        this.move(event.clientX, event.clientY);
    }
    
    handleTouchMove(event) {
        event.preventDefault();
        event.stopPropagation();
        if(event.changedTouches.length == 0)
            return;
        const [offsetX, offsetY] = this.getTouchOffset(event);
        this.move(offsetX, offsetY);
    }
    
    move(clientX, clientY) {
        if(!this.active) return;
        const {context, canvas} = this;
        context.clearRect(0, 0, canvas.width, canvas.height);
        const eltRect = this.canvas.getBoundingClientRect();
        const offsetX = clientX - eltRect.left;
        const offsetY = clientY - eltRect.top; 
        // TODO: Stay on a circle of radius "radius"
        const deltaX = offsetX - this.lastOffset[0];
        const deltaY = offsetY - this.lastOffset[1];
        const [x0, y0] = this.origin;
        const [x, y] = [offsetX, offsetY];
        this.axes = [x-x0, y0-y].map(a => Math.max(Math.min(a, this.radius), -this.radius)/this.radius);
        if(this.axes[0]**2 + this.axes[1]**2 > 1) {
            this.moved = true;
        }
        context.beginPath();
        context.strokeStyle = "black";
        context.lineWidth = 1;
        context.moveTo(x0, y0);
        context.lineTo(x, y);
        context.stroke();
        context.closePath();
    }
    
    reset() {
        this.tap = false;
    }
}

class PointerDown {
    constructor(elt) {
        elt.addEventListener("mousedown", e => this.handleDown(e));
        elt.addEventListener("mouseup", e => this.handleUp(e));
        elt.addEventListener("mousemove", e => this.handleMove(e));
        this.canvas = elt;
        this.context = elt.getContext("2d");
        this.active = false;
        this.position = null;
    }
    
    handleDown(event) {
        if(this.active) return;
        this.active = true;
        this.handleMove(event);
    }
    
    handleUp(event) {
        this.active = false;
        this.position = null;
        const {context, canvas} = this;
        context.clearRect(0, 0, canvas.width, canvas.height);        
    }
    
    handleMove(event) {
        if(!this.active) return;
        const {context, canvas} = this;
        context.clearRect(0, 0, canvas.width, canvas.height);
        const [x, y] = [event.offsetX, event.offsetY];
        this.position = [x / canvas.width, 1 - (y / canvas.height)];
    }
}

class InputButton {
    constructor(elt) {
        elt.addEventListener("mousedown", e => this.handleDown(e));
        elt.addEventListener("touchdown", e => this.handleDown(e));        
        this.count = 0;
    }
    
    handleDown(event) {
        event.preventDefault();
        this.count++;
    }
    
    reset() {
        this.count = 0;
    }
}

export {PointerJoystick, InputButton}