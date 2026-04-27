precision highp float;

varying vec2 texelCoord;

uniform float dt;
uniform float dragCoefficient;
uniform vec2  flowScale;
uniform sampler2D particleData;
uniform sampler2D flowVelocityField;
uniform sampler2D bodyMask;

void main(){
    vec2 p = texture2D(particleData, texelCoord).xy;
    vec2 v = texture2D(particleData, texelCoord).zw;

    // Advect through velocity field
    vec2 vf = texture2D(flowVelocityField, (p + 1.0) * 0.5).xy * flowScale;
    v += (vf - v) * dragCoefficient;

    p += dt * v;

    // Body obstacle repulsion
    // p is clip-space (-1..1). Map to mask UV (mirror X, UNPACK_FLIP_Y matches Y).
    vec2 maskUV = vec2((1.0 - p.x) * 0.5, (p.y + 1.0) * 0.5);
    float body  = texture2D(bodyMask, maskUV).r;

    if (body > 0.1) {
        // Estimate outward normal via central differences on body mask
        float d  = 0.007;
        float gx = texture2D(bodyMask, maskUV + vec2(d, 0.0)).r
                 - texture2D(bodyMask, maskUV - vec2(d, 0.0)).r;
        float gy = texture2D(bodyMask, maskUV + vec2(0.0, d)).r
                 - texture2D(bodyMask, maskUV - vec2(0.0, d)).r;
        float gl = length(vec2(gx, gy));

        if (gl > 0.03) {
            // Gradient points INTO body; negate = outward surface normal
            vec2 outward = -vec2(gx, gy) / gl;
            // Redirect velocity component pointing into body
            float into = dot(v, -outward);
            if (into > 0.0) v -= (1.8 * into) * (-outward); // reflect
            // Gentle outward push proportional to penetration depth
            v += outward * (body - 0.1) * 0.4;
        }

        // Damp velocity inside body (friction)
        v *= (1.0 - body * 0.7);
    }

    gl_FragColor = vec4(p, v);
}
