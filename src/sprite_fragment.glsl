#version 100

precision highp float;

varying vec2 uv;

uniform highp sampler2D spriteSampler;

// out vec4 fragColor;

void main() {
    vec4 fragColor;
    fragColor = texture2D(spriteSampler, uv);
    fragColor.rgb *= fragColor.a;
    gl_FragColor = fragColor;
}