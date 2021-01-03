
async function loadSoundData(ctx, url) {
    const response = await fetch(url);
    const data = await response.arrayBuffer();
//     const ctx = new AudioContext();
//     console.log(response);
    return await new Promise((resolve, reject) => {
        ctx.decodeAudioData(data, resolve, reject);
    });
}

class Jukebox {
    constructor(audioContext) {
        this.audioContext = audioContext;
        this.buffers = {};
    }
    
    async load(sources) {
        for(const name in sources) {
            this.buffers[name] = await loadSoundData(
                this.audioContext, sources[name]
            );
        }
    }
    
    play(name) {
        const ctx = this.audioContext;
        const buffer = this.buffers[name];
        const source = ctx.createBufferSource();
        source.buffer = buffer;
        source.connect(ctx.destination);
        console.log("play", source, buffer);        
        source.start();
    }
}

async function initSound(effects) {
    const audioContext = new AudioContext();
    const jukebox = new Jukebox(audioContext);
    await jukebox.load(effects);
    return jukebox;
//     document.querySelector("#fire-button").addEventListener("mousedown", e => {
//         jukebox.play("shot");
//     });
}

export {initSound, Jukebox, loadSoundData};