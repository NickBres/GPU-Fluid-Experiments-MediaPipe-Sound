// Prepended at runtime: fluid-base.frag + geom.glsl

uniform sampler2D dye;
uniform float dt;
uniform float dx;

uniform bool isActive;
uniform vec2 pointClipSpace;
uniform vec2 lastPointClipSpace;

uniform vec3 uDyeSlow;
uniform vec3 uDyeFast;

varying vec2 texelCoord;
varying vec2 p;

void main(){
    vec4 color = texture2D(dye, texelCoord);

    if(isActive){
        vec2 pt  = clipToSimSpace(pointClipSpace);
        vec2 lpt = clipToSimSpace(lastPointClipSpace);
        vec2 ptV = -(lpt - pt) / dt;

        float fp;
        float l = distanceToSegment(pt, lpt, p, fp);
        float projectedFraction = 1.0 - clamp(fp, 0.0, 1.0) * 0.6;

        float R = 0.025;
        float m = exp(-l / R);

        float speed = length(ptV);
        float x = clamp((speed * speed * 0.02 - l * 5.0) * projectedFraction, 0.0, 1.0);

        color.rgb += m * (
            mix(uDyeSlow, uDyeFast, x)
            + vec3(1.0) * pow(x, 9.0)
        );
    }

    gl_FragColor = vec4(color.rgb, 1.0);
}
