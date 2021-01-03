function init() {
    const canvas = document.querySelector("#canvas");
    const ctx = canvas.getContext("2d");
    const img = document.querySelector("#image");
    img.onload = () => {
        ctx.drawImage(img, 0, 0);
    }
    return;
    const w = canvas.width;
    const h = canvas.height;
    const image = ctx.createImageData(w, h);
    //     gradient(image);
    perlin(image, {fx: 4, fy: 4});
//     gaussian_points(image);
//     poisson_points(image, 10);
    
    ctx.putImageData(image, 0, 0);
}

function gaussianize() {
    const src_canvas = document.querySelector("#canvas");
    const src_ctx = src_canvas.getContext("2d");   
    const canvas = document.querySelector("#gaussian-canvas");
    const ctx = canvas.getContext("2d");        
    const w = src_canvas.width;
    const h = src_canvas.height;
    canvas.width = w;
    canvas.height = h;
    const gaussian = ctx.createImageData(w, h);
    const input = src_ctx.getImageData(0, 0, w, h);
    to_gaussian(gaussian, input);    
    ctx.putImageData(gaussian, 0, 0);    
}




function smoothstep(x) {
    return x * x * (3 - 2 * x);
}
    

function gradient({width: w, height: h, data}) {
    for(let i=0; i < h; i++) {
        for(let j=0; j < w; j++) {
            const k = 4*(i*w+j);
            data[k] = data[k+1] = data[k+2] = (j / w)*255;
            data[k+3] = 255;
        }
    }
}

function perlin({width: w, height: h, data}, {fx, fy}) {
    const gradients = new Float32Array(fx*fy);
    for(let k=0; k < gradients.length; k++) {
        gradients[k] = 2*Math.PI*Math.random();
//         gradients[k] = 0;
    }
    console.log(gradients);
    const dx = w / fx;
    const dy = h / fy;
    function dot_corner(x, y, ofs_x, ofs_y) {
        const grad_i = (Math.floor(y / dy) + ofs_y);
        const grad_j = (Math.floor(x / dx) + ofs_x);
        const k = (grad_i % fy * fx + grad_j % fx);
        const u_x = (x - grad_j * dx)/dx;
        const u_y = (y - grad_i * dy)/dy;
        const val = 
              u_x * Math.cos(gradients[k]) +
              u_y * Math.sin(gradients[k]);
        return val;
    }
   
    for(let y=0; y < h; y++) {
        for(let x=0; x < w; x++) {
            const val00 = dot_corner(x, y, 0, 0);
            const val01 = dot_corner(x, y, 0, 1);
            const val10 = dot_corner(x, y, 1, 0);
            const val11 = dot_corner(x, y, 1, 1);
            const grad_i = (Math.floor(y / dy));
            const grad_j = (Math.floor(x / dx));
            const u_x = (x - grad_j * dx)/dx;
            const u_y = (y - grad_i * dy)/dy;
            const sx = smoothstep(u_x);
            const sy = smoothstep(u_y);
            const val0 = (1-sx) * val00 + sx*val10;
            const val1 = (1-sx) * val01 + sx*val11;
            const val = (1-sy) * val0 + sy * val1;
            const o = 4*(y*w+x);
            data[o] = data[o+1] = data[o+2] = (1+val)/2*255;
            data[o+3] = 255;
        }
    }
}

function boxmuller(out) {
    const u1 = Math.random();
    const u2 = Math.random();
    const r = Math.sqrt(-2*Math.log(u1))
    const theta = 2*Math.PI*u2;
    out[0] = r*Math.cos(theta);
    out[1] = r*Math.sin(theta);
}

function poisson2(lambda, out) {
    boxmuller(out);
    out[0] = Math.floor(lambda + Math.sqrt(lambda)*out[0] + 1/2)
    out[1] = Math.floor(lambda + Math.sqrt(lambda)*out[1] + 1/2)
}

function poisson(lambda) {
    const out = [0.0, 0.0];
    poisson2(lambda, out);
    return out[0];
}

function gaussian({width, height, data}) {
    const out = [0.0, 0.0];
    for(let i=0; i < width*height; i+=2) {
        boxmuller(out);
        data[i] = out[0];
        data[i+1] = out[1];
    }
}

function to_gaussian(output, input) {
    output.data.fill(255);
    const {width, height, data} = input;
    const gaussian_field = new Float32Array(width*height);
    {
        const out = [0.0, 0.0];
        for(let i=0; i < width*height; i+=2) {
            boxmuller(out);
            gaussian_field[i] = out[0];
            gaussian_field[i+1] = out[1];
        }
    }
//     console.log(data);

//     const channel = 0;
    for(let channel=0; channel < 4; channel++) {
    let mean_u = 0;
    for(let k=0; k < width*height; k++) {
        mean_u += data[4*k+channel]/(width*height);
    }
//     console.log("mean_u", mean_u);
    const norm_factor = 1/Math.sqrt(width*height);
//     console.log(data);
    for(let i=0; i < height; i++) {
        for(let j=0; j < width; j++) {
            let val = 0.0;
            for(let k=0; k < height; k++) {
                for(let l=0; l < width; l++) {
                    let i_minus_k = (i-k);
                    if(i_minus_k < 0) i_minus_k += height;
                    let j_minus_l = (j-l);
                    if(j_minus_l < 0) j_minus_l += width;
                    val += (data[4*(k*width+l)+channel]-mean_u)*norm_factor * gaussian_field[i_minus_k*width+j_minus_l];
//                     console.log(i_minus_k, j_minus_l);
//                     val += gaussian_field[i_minus_k*width+j_minus_l];
//                     val += gaussian_field[i*width+j];
                }
            }
//             console.log(i, j, val, data[4*(i*width+j)]);
            output.data[4*(i*output.width+j)+channel] = val + mean_u// + 128;
//             output.data[4*(i*output.width+j)+1] = val + mean_u// + 128;
//             output.data[4*(i*output.width+j)+2] = val + mean_u// + 128;
        }
    }
    }
}

function gaussian_points({width: w, height: h, data}) {
    data.fill(0);
    const N = 2**9;
    const points = new Float32Array(N);
    for(let i=0; i < N; i+=2) {
        boxmuller(points.subarray(i));
    }
//     console.log(points);
    for(let i=0; i < N; i+=2) {
        const x = 0.25*points[i];
        const y = 0.25*points[i+1];
        const ix = Math.floor((1+x)/2*w);
        const iy = Math.floor((1+y)/2*h);
        if(ix < 0 || ix >= w || iy < 0 || iy >= h)
            continue;
        const k = 4*(iy*w+ix);
//         console.log(x, y, ix, iy, k);
        data[k] = data[k+1] = data[k+2] = 0;
        data[k+3] = 255;
    }
}

function poisson_points({width: w, height: h, data}, lambda) {
    data.fill(0);
    for(let i=0; i < w*h; i++) {
        data[4*i+3] = 255;
    }
    const N = poisson(lambda);
    const points = new Float32Array(2*N);
    for(let i=0; i < N; i++) {
        points[2*i] = Math.random();
        points[2*i+1] = Math.random();
    }
//     console.log(points);
    for(let i=0; i < N; i++) {
        const x = points[2*i];
        const y = points[2*i+1];
        const ix = Math.floor(x*w);
        const iy = Math.floor(y*h);
        if(ix < 0 || ix >= w || iy < 0 || iy >= h)
            continue;
        const k = 4*(iy*w+ix);
//         console.log(x, y, ix, iy, k);
        data[k] = data[k+1] = data[k+2] = 255;
    }
}



init();