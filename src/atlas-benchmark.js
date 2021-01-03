function sphericalChart(width, height, uvToCart) {
    const chart = new Float32Array(width*height*2);
    for(let i=0; i < width; i++) {
        const u = 2*(i/width)-1;
        for(let j=0; j < height; j++) {
            const v = 2*(j/height)-1;            
            const [x, y, z] = uvToCart(u, v);
	    // const [x, y, z] = [1, -v, -u];
	    /*
	    const uv = uvToCart(u, v);
	    const x = uv[0];
	    const y = uv[1];
	    const z = uv[2];
	    */
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

for(let i=0; i < 8; i++) {
    const atlas = sphericalAtlas(1024, 1024);
}
