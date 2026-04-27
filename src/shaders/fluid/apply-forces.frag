// Prepended at runtime: fluid-base.frag + geom.glsl

uniform sampler2D velocity;
uniform float dt;
uniform float dx;

uniform bool isActive;
uniform vec2 pointClipSpace;
uniform vec2 lastPointClipSpace;

varying vec2 texelCoord;
varying vec2 p;

void main(){
    vec2 v = texture2D(velocity, texelCoord).xy;

    if(isActive){
        vec2 pt  = clipToSimSpace(pointClipSpace);
        vec2 lpt = clipToSimSpace(lastPointClipSpace);
        vec2 ptV = -(lpt - pt) / dt;

        float speed = length(ptV);
        if(speed > 0.3){
            float fp;
            float l = distanceToSegment(pt, lpt, p, fp);
            float projectedFraction = 1.0 - clamp(fp, 0.0, 1.0) * 0.6;

            float R = 0.015;
            float m = exp(-l / R) * projectedFraction * projectedFraction;

            vec2 targetVelocity = ptV * dx;
            v += (targetVelocity - v) * m;
        }
    }

    gl_FragColor = vec4(v, 0.0, 1.0);
}
