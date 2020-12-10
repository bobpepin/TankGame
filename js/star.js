// import {Fireworks} from "./fireworks.js"

class Star1 {
    constructor(canvas) {
        this.canvas = canvas;
    }
    
    draw(k) {
        const canvas = this.canvas;
        const ctx = canvas.getContext("2d");
        const {width, height} = canvas.getBoundingClientRect();
        canvas.width = width;
        canvas.height = height;
    //     console.log(width/2);
        const s = Math.min(width, height)/2;
        const mat = new DOMMatrix([s, 0, 0, -s, width/2, height/2]);
        ctx.setTransform(mat);
        const angle1 = Math.PI/2 + 2*Math.PI/10;
        const angle2 = angle1 - k*2*Math.PI/5;
        const r = 2;
        const center = {x: -1+2*256/512, y: 1-2*279/512};
        const p1 = {x: center.x + r*Math.cos(angle1), y: center.y + r*Math.sin(angle1)};
        const p2 = {x: center.x + r*Math.cos(angle2), y: center.y + r*Math.sin(angle2)};
        ctx.fillStyle = `rgba(255, 255, 255, 0.7)`;
        ctx.beginPath();
        ctx.moveTo(center.x, center.y);
        ctx.lineTo(p1.x, p1.y);
        ctx.arc(center.x, center.y, r, angle1, angle2, false);
        ctx.lineTo(p2.x, p2.y);
        ctx.fill();
    //     console.log(ctx);
    }

}


export class Star {
    constructor(container) {
        this.container = container;
    }
    
    async load() {
        const response = await fetch("star.svg");
        const source = await response.text();
    //     console.log(source);
        this.container.innerHTML = source;
        const svg = this.container.querySelector("svg");
        svg.style = "width: 50%; height: 50%";
        this.fill(0);
    }

    fill(k) {
        for(let i=1; i <= 5; i++) {
            const arm = this.container.querySelector(`#arm-${i}`);
            if(i <= k) {
                arm.setAttribute("class", "opaque");
            } else {
                arm.setAttribute("class", "transparent");
            }
//             arm.style.opacity = i <= k ? "100%" : "0%";
        }
    }
}

// const star = new Star(document.querySelector("#star"));
// star.draw(1);
/*
function randint(n) {
    return Math.random()*n|0;
}

const fireworks = new Fireworks(document.querySelector("#fireworks"));
fireworks.startSalvos(1000);

const star = new Star(document.querySelector("#star"));
star.load();

let starK = 0;
document.querySelector("#star").addEventListener("click", e => star.fill(++starK % 6));
*/