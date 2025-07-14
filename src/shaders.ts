import * as THREE from 'three';

// Define shader code as TypeScript exports
export const shaders = {
    // Laser beam shader
    laser: {
        vertex: `
            uniform float time;
            varying vec2 vUv;
            
            void main() {
                vUv = uv;
                gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
            }
        `,
        fragment: `
            uniform vec3 color;
            uniform float time;
            uniform float intensity;
            varying vec2 vUv;
            
            void main() {
                float radial = length(vUv - vec2(0.5, 0.5)) * 2.0;
                float glow = 0.5 * exp(-radial * 5.0) * intensity;
                float pulse = sin(time * 5.0) * 0.1 + 0.9;
                
                vec3 finalColor = color * glow * pulse;
                gl_FragColor = vec4(finalColor, glow);
            }
        `
    },
    
    // Reconstruction shader
    reconstruction: {
        vertex: `
            uniform float time;
            varying vec2 vUv;
            
            void main() {
                vUv = uv;
                gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
            }
        `,
        fragment: `
            uniform float time;
            uniform float resolution;
            varying vec2 vUv;
            
            // Function to generate a pseudo-random value from a 2D point
            float random(vec2 st) {
                return fract(sin(dot(st.xy, vec2(12.9898, 78.233))) * 43758.5453123);
            }
            
            void main() {
                // Create a grid pattern based on resolution
                vec2 grid = floor(vUv * resolution * 10.0) / (resolution * 10.0);
                float r = random(grid + time * 0.1);
                float g = random(grid + time * 0.1 + 1.0);
                float b = random(grid + time * 0.1 + 2.0);
                
                // Animated wave pattern
                float wave = sin(vUv.x * 20.0 + time * 3.0) * sin(vUv.y * 20.0 + time * 2.0) * 0.1;
                
                // Time-dependent color shift
                float timeShift = sin(time) * 0.5 + 0.5;
                vec3 color = mix(
                    vec3(r, g, b),
                    vec3(0.3, 0.6, 1.0),
                    wave + timeShift
                );
                
                gl_FragColor = vec4(color, 1.0);
            }
        `
    },
    
    // Particle shader for light propagation
    particle: {
        vertex: `
            attribute float size;
            attribute vec3 customColor;
            varying vec3 vColor;
            
            void main() {
                vColor = customColor;
                vec4 mvPosition = modelViewMatrix * vec4(position, 1.0);
                gl_PointSize = size * (300.0 / -mvPosition.z);
                gl_Position = projectionMatrix * mvPosition;
            }
        `,
        fragment: `
            uniform sampler2D pointTexture;
            varying vec3 vColor;
            
            void main() {
                // Calculate distance from center of point
                vec2 uv = gl_PointCoord;
                float distance = length(uv - vec2(0.5, 0.5)) * 2.0;
                
                // Create a circular point with soft edges
                float strength = 1.0 - distance;
                strength = pow(strength, 2.0);
                
                // Apply color
                vec3 color = vColor * strength;
                gl_FragColor = vec4(color, strength);
            }
        `
    },
    
    // Wave shader for interference patterns
    wave: {
        vertex: `
            uniform float time;
            uniform float amplitude;
            uniform float frequency;
            varying vec2 vUv;
            varying float displacement;
            
            void main() {
                vUv = uv;
                
                // Calculate wave displacement
                float wave1 = sin((position.x + time) * frequency) * amplitude;
                float wave2 = sin((position.y + time * 0.8) * frequency * 0.8) * amplitude;
                
                // Interference pattern
                displacement = wave1 + wave2;
                
                // Apply displacement to the vertex
                vec3 newPosition = position;
                newPosition.z += displacement;
                
                gl_Position = projectionMatrix * modelViewMatrix * vec4(newPosition, 1.0);
            }
        `,
        fragment: `
            uniform vec3 color;
            uniform float time;
            varying vec2 vUv;
            varying float displacement;
            
            void main() {
                // Convert displacement to color intensity
                float intensity = (displacement + 0.4) * 0.5;
                
                // Create ripple effect
                float ripple = sin(length(vUv - 0.5) * 20.0 - time * 2.0) * 0.5 + 0.5;
                
                // Mix colors based on displacement and ripple
                vec3 finalColor = mix(
                    color,
                    vec3(0.9, 0.9, 1.0),
                    intensity * ripple
                );
                
                gl_FragColor = vec4(finalColor, 1.0);
            }
        `
    },
    
    // Fluid shader for microfluidic flow
    fluid: {
        vertex: `
            varying vec2 vUv;
            
            void main() {
                vUv = uv;
                gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
            }
        `,
        fragment: `
            uniform float time;
            uniform vec3 color1;
            uniform vec3 color2;
            varying vec2 vUv;
            
            // Simplex noise functions
            vec3 mod289(vec3 x) { return x - floor(x * (1.0 / 289.0)) * 289.0; }
            vec2 mod289(vec2 x) { return x - floor(x * (1.0 / 289.0)) * 289.0; }
            vec3 permute(vec3 x) { return mod289(((x*34.0)+1.0)*x); }
            
            float snoise(vec2 v) {
                const vec4 C = vec4(0.211324865405187, 0.366025403784439,
                        -0.577350269189626, 0.024390243902439);
                vec2 i  = floor(v + dot(v, C.yy));
                vec2 x0 = v -   i + dot(i, C.xx);
                vec2 i1;
                i1 = (x0.x > x0.y) ? vec2(1.0, 0.0) : vec2(0.0, 1.0);
                vec4 x12 = x0.xyxy + C.xxzz;
                x12.xy -= i1;
                i = mod289(i);
                vec3 p = permute(permute(i.y + vec3(0.0, i1.y, 1.0)) + i.x + vec3(0.0, i1.x, 1.0));
                vec3 m = max(0.5 - vec3(dot(x0, x0), dot(x12.xy, x12.xy), dot(x12.zw, x12.zw)), 0.0);
                m = m*m;
                m = m*m;
                vec3 x = 2.0 * fract(p * C.www) - 1.0;
                vec3 h = abs(x) - 0.5;
                vec3 ox = floor(x + 0.5);
                vec3 a0 = x - ox;
                m *= 1.79284291400159 - 0.85373472095314 * (a0*a0 + h*h);
                vec3 g;
                g.x  = a0.x  * x0.x  + h.x  * x0.y;
                g.yz = a0.yz * x12.xz + h.yz * x12.yw;
                return 130.0 * dot(m, g);
            }
            
            void main() {
                // Scale UVs for fluid simulation
                vec2 scaledUv = vUv * 3.0;
                
                // Create flow field using noise
                float flow = snoise(vec2(scaledUv.x, scaledUv.y + time)) * 0.5 + 0.5;
                
                // Add some turbulence
                float turbulence = snoise(scaledUv * 2.0 + time * 0.3) * 0.1;
                flow += turbulence;
                
                // Create streaks for fluid visualization
                float streak = sin(scaledUv.x * 20.0 + flow * 10.0) * 0.5 + 0.5;
                streak = pow(streak, 3.0);
                
                // Mix colors based on flow patterns
                vec3 finalColor = mix(color1, color2, flow);
                finalColor = mix(finalColor, vec3(1.0), streak * 0.3);
                
                gl_FragColor = vec4(finalColor, 1.0);
            }
        `
    }
};
