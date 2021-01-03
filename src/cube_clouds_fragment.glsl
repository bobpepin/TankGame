#version 300 es

precision highp float;

uniform vec3 color;

in vec2 texcoord;
in vec3 direction;

uniform samplerCube sampler1;
uniform mat3 rotation1;
uniform samplerCube sampler2;
uniform mat3 rotation2;
uniform samplerCube sampler3;
uniform mat3 rotation3;
uniform samplerCube sampler4;
uniform mat3 rotation4;

uniform bool lighting;
uniform float threshold;

uniform vec3 lightPosition;
uniform float radius;

out vec4 fragColor;

vec4 computeClouds(vec3 direction) {
//     return texture(sampler1, rotation1*direction);
    vec4 cloudColor = vec4(0.0, 0.0, 0.0, 1.0);
    cloudColor += pow(0.5, 1.0)*texture(sampler1, rotation1*direction);
    cloudColor += pow(0.5, 2.0)*texture(sampler2, rotation2*direction);
    cloudColor += pow(0.5, 3.0)*texture(sampler3, rotation3*direction);
    cloudColor += pow(0.5, 4.0)*texture(sampler4, rotation4*direction);
    cloudColor /= (pow(0.5, 1.0) + pow(0.5, 2.0) + pow(0.5, 3.0) + pow(0.5, 4.0));
//    cloudColor = pow(cloudColor, vec4(1.0, 1.0, 1.0, 1.0) * 0.5);
    cloudColor = cloudColor*clamp((cloudColor - threshold)/(0.05), 0.0, 1.0);
    return cloudColor;
//     return threshold > 0.0 ? step(threshold, cloudColor) : cloudColor;
}

void main() {
    vec4 bgColor = vec4(color.r, color.g, color.b, 1.0);
    vec4 fgColor = vec4(0.85, 0.85, 0.85, 1.0);
    vec4 lightColor = vec4(1.2, 1.2, 0.95, 1.0);
    vec4 cloudColor = computeClouds(direction);
    vec3 eyePosition = normalize(direction) * radius;
    int N = 4;
    float marchingStep = 0.05;
    float absorptionTerm = 0.25;
    float transmission = 1.0;
    vec3 sampleDirection;
    float cloud;
    float offset = 0.0;
    float height;
#pragma unroll_loop_start
    for ( int i = 0; i < 4; i ++ ) {
        sampleDirection = mix(eyePosition, lightPosition, offset);
        cloud = computeClouds(sampleDirection).r;
//         transmission -= absorptionTerm*max(0.0, cloud - (length(sampleDirection) - radius));
        height = length(sampleDirection) - radius;
//         transmission -= mix(absorptionTerm, cloud*absorptionTerm*step(0.0, 1.0*cloud - height), height >= 1.0e-3);
         transmission -= max(0.0, cloud*absorptionTerm*step(0.0, cloud - height));
        offset += marchingStep;
    }
    transmission = pow(max(0.0, transmission), 2.0);
#pragma unroll_loop_end
    transmission = mix(0.0, transmission, lighting);
    vec4 transmissionColor = mix(fgColor, lightColor, transmission);
    vec4 thresholdColor = vec4(1.0, 0.0, 0.0, 1.0);
//     bgColor = cloudColor.r < 1e-3 ? thresholdColor : bgColor;
    fragColor = mix(bgColor, transmissionColor, cloudColor);
//     fragColor = cloudColor;
//     fragColor.r = mix(fragColor.r, transmission, lighting);
//     fragColor = transmissionColor;
    fragColor.a = 1.0;
}