precision highp float;

uniform sampler2D velocity;
uniform sampler2D bodyMask;

varying vec2 texelCoord;

void main() {
    vec2 v = texture2D(velocity, texelCoord).xy;

    // maskUV: flip X for mirror display; Y matches screen (UNPACK_FLIP_Y was set on upload)
    vec2 maskUV = vec2(1.0 - texelCoord.x, texelCoord.y);
    float body  = texture2D(bodyMask, maskUV).r;

    // Body acts as solid obstacle — zero velocity inside
    v *= (1.0 - body);

    gl_FragColor = vec4(v, 0.0, 1.0);
}
