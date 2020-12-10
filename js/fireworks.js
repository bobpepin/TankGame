export class Fireworks {
    constructor(canvas) {
        this.canvas = canvas;
        this.ctx = canvas.getContext("2d");
        this.salvos = [];
        this.running = false;
        this.particleCount = 20;
    }
    
    drawSalvo(time, salvo) {
        const {width, height} = this.canvas;
        if(!salvo.startTime) {
            salvo.startTime = time;
        }
        const t = (time - salvo.startTime)/4;
        const g = 9.81;
        for(let i=0; i < salvo.initialVelocities.length/2; i++) {
            const x = salvo.initialVelocities[2*i]*t;
            const y = - g*t*t + salvo.initialVelocities[2*i+1]*t;
            const hsl = salvo.colors[i];
            const color = `hsla(${hsl}, ${1-4*t})`;
            this.ctx.fillStyle = color;
            const s = Math.min(width, height) * 0.5;
//             console.log(salvo.x0 + x*s, salvo.y0 + (1-y)*s, 5, 5);
//             this.ctx.fillRect(salvo.x0 + x*s, salvo.y0 + (1-y)*s, 5, 5);
            this.ctx.fillRect(salvo.x0 + x*s, height-(salvo.y0 + y*s), 5, 5);
        }
    }
    
    draw(t) {
        const {width, height} = this.canvas.getBoundingClientRect();
        this.canvas.width = width;
        this.canvas.height = height;
        this.ctx.fillStyle = "black";
        this.ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);
        for(const salvo of this.salvos) {
            this.drawSalvo(t, salvo);
        }
    }
    
    addSalvo() {
        const N = this.particleCount;
//         const N = 16;
        const initialVelocities = new Float32Array(2*N);
        const dTheta = 2*Math.PI / N;
        const v0 = 2.8;
        const colors = new Array(N);
        for(let i=0; i < N; i++) {
            const v = v0;
            initialVelocities[2*i] = v*Math.cos(i*dTheta);
            initialVelocities[2*i+1] = v*Math.sin(i*dTheta);
            const hue = randint(360);
            colors[i] = `${hue}, 100%, 50%`;
        }
        const salvo = {
            x0: (.2+Math.random()*.6)*this.canvas.width, 
            y0: (.5+Math.random()*.4)*this.canvas.height,
            initialVelocities,
            colors
        };
//         console.log(salvo);
        this.salvos.push(salvo);
    }
    
    animate(time_ms) {
        this.draw(time_ms/1000);
        this.salvos = this.salvos.filter(x => time_ms/1000 - x.startTime < 5);
        if(this.running)
            requestAnimationFrame(t => this.animate(t));
    }
    
    startSalvos(interval) {
        const _this = this;
        function nextSalvo() {
            if(!_this.running)
                return;
            _this.addSalvo();
            const delay = randint(interval);
            window.setTimeout(() => nextSalvo(), delay)
        }
        this.start();
        nextSalvo();
    }
    
    start() {
        this.running = true;
        requestAnimationFrame(t => this.animate(t));
    }
    
    stop() {
        this.running = false;
    }
}

function randint(n) {
    return Math.random()*n|0;
}

