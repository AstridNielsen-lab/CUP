// JavaScript for 3D Simulations using Three.js

// Check Three.js version compatibility
if (THREE.REVISION !== '128') {
    console.warn(`This code was tested with Three.js r128. Current version: ${THREE.REVISION}`);
}

// General setup for Three.js scenes
const setups = {
    dmd: { canvasId: 'dmdSimulation' },
    optical: { canvasId: 'opticalEncoding' },
    reconstruction: { canvasId: 'reconstruction' },
    physical: { canvasId: 'physicalPhenomena' }
};

Object.keys(setups).forEach(key => {
    const canvas = document.getElementById(setups[key].canvasId);
    setups[key].scene = new THREE.Scene();
    setups[key].camera = new THREE.PerspectiveCamera(75, canvas.clientWidth / canvas.clientHeight, 0.1, 1000);
    setups[key].renderer = new THREE.WebGLRenderer({ canvas: canvas, antialias: true });
    setups[key].renderer.setSize(canvas.clientWidth, canvas.clientHeight);
    setups[key].controls = new THREE.OrbitControls(setups[key].camera, setups[key].renderer.domElement);
    setups[key].camera.position.z = 5;
    
    // Configure controls with r128 compatible settings
    setups[key].controls.enableDamping = true;
    setups[key].controls.dampingFactor = 0.05;
});

// Function to animate the scenes
function animateScenes() {
    requestAnimationFrame(animateScenes);
    const time = performance.now();
    
    Object.keys(setups).forEach(key => {
        // Update any scene-specific animations
        if (setups[key].animate) {
            setups[key].animate(time);
        }
        
        setups[key].controls.update();
        setups[key].renderer.render(setups[key].scene, setups[key].camera);
    });
}

// DMD Simulation Setup
function setupDMDScene() {
    const { scene, camera } = setups.dmd;
    
    // Grid parameters
    const gridWidth = 10;
    const gridHeight = 10;
    const mirrorSize = 0.2;
    
    // Material for mirrors
    const mirrorMaterial = new THREE.MeshStandardMaterial({ color: 0x888888, metalness: 0.8, roughness: 0.1 });
    
    // Create a grid of interactive micromirrors
    const mirrors = [];
    for (let i = 0; i < gridWidth; i++) {
        for (let j = 0; j < gridHeight; j++) {
            const geometry = new THREE.PlaneGeometry(mirrorSize, mirrorSize);
            const mirror = new THREE.Mesh(geometry, mirrorMaterial);
            mirror.position.set(i * mirrorSize - (gridWidth * mirrorSize) / 2, j * mirrorSize - (gridHeight * mirrorSize) / 2, 0);
            mirror.rotation.x = -Math.PI / 4; // Initial tilt
            mirror.userData = { active: false };
            scene.add(mirror);
            mirrors.push(mirror);
        }
    }

    // Click handling for micromirror toggle
    window.addEventListener('click', (event) => {
        const mouse = new THREE.Vector2(
            (event.clientX / window.innerWidth) * 2 - 1,
            -(event.clientY / window.innerHeight) * 2 + 1
        );

        const raycaster = new THREE.Raycaster();
        raycaster.setFromCamera(mouse, camera);

        const intersects = raycaster.intersectObjects(mirrors);
        if (intersects.length > 0) {
            const mirror = intersects[0].object;
            mirror.userData.active = !mirror.userData.active;
            mirror.rotation.x += mirror.userData.active ? Math.PI / 4 : -Math.PI / 4;
        }
    });

    // Visualize laser beam
    const laserMaterial = new THREE.LineBasicMaterial({ color: 0xff0000 });
    const laserGeometry = new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(0, 0, 0), new THREE.Vector3(0, 0, -5)]);
    const laser = new THREE.Line(laserGeometry, laserMaterial);
    scene.add(laser);

    // Lighting setup
    const ambientLight = new THREE.AmbientLight(0x404040);
    const pointLight = new THREE.PointLight(0xFFFFFF, 1);
    pointLight.position.set(5, 5, 5);
    scene.add(ambientLight, pointLight);

    // Loading indicator (if necessary)
    const loader = document.createElement('div');
    loader.className = 'loader';
    canvas.parentElement.appendChild(loader);
    
    setTimeout(() => {
        loader.remove(); // Simulating loading completion
    }, 1500);
}

// Optical Encoding Simulation Setup
function setupOpticalScene() {
    const { scene, camera, renderer } = setups.optical;
    const canvas = renderer.domElement;
    
    // Create loading indicator
    const loader = document.createElement('div');
    loader.className = 'loader';
    canvas.parentElement.appendChild(loader);
    
    // Define GLSL vertex shader for laser beam
    const laserVertexShader = `
        varying vec3 vPosition;
        varying vec2 vUv;
        
        void main() {
            vPosition = position;
            vUv = uv;
            gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
        }
    `;
    
    // Define GLSL fragment shader for laser beam
    const laserFragmentShader = `
        uniform vec3 color;
        uniform float time;
        uniform float intensity;
        varying vec3 vPosition;
        varying vec2 vUv;
        
        void main() {
            // Create laser beam effect with pulsing intensity
            float pulse = sin(time * 5.0) * 0.1 + 0.9;
            float beam = pow(1.0 - abs(vUv.y - 0.5) * 2.0, 4.0);
            
            // Add some noise for realism
            float noise = fract(sin(vUv.x * 100.0 + time) * 10000.0) * 0.05;
            
            vec3 finalColor = color * (beam + noise) * pulse * intensity;
            gl_FragColor = vec4(finalColor, beam * pulse);
        }
    `;
    
    // Create DMD model for reference
    const dmdPlane = new THREE.Mesh(
        new THREE.PlaneGeometry(4, 4),
        new THREE.MeshPhongMaterial({ color: 0x333333, side: THREE.DoubleSide })
    );
    dmdPlane.position.set(0, 0, 0);
    scene.add(dmdPlane);
    
    // Create micromirrors array for the optical simulation
    const gridSize = 8;
    const mirrorSize = 0.3;
    const mirrorGap = 0.05;
    const mirrors = [];
    
    for (let i = 0; i < gridSize; i++) {
        for (let j = 0; j < gridSize; j++) {
            const x = (i - gridSize/2) * (mirrorSize + mirrorGap) + mirrorSize/2;
            const y = (j - gridSize/2) * (mirrorSize + mirrorGap) + mirrorSize/2;
            
            const mirror = new THREE.Mesh(
                new THREE.PlaneGeometry(mirrorSize, mirrorSize),
                new THREE.MeshStandardMaterial({ 
                    color: 0xCCCCCC, 
                    metalness: 0.9, 
                    roughness: 0.1,
                    side: THREE.DoubleSide
                })
            );
            
            mirror.position.set(x, y, 0.05);
            // Random initial rotation to create pattern
            mirror.rotation.x = Math.random() > 0.5 ? Math.PI/4 : -Math.PI/4;
            mirror.userData = { active: Math.random() > 0.5 };
            scene.add(mirror);
            mirrors.push(mirror);
        }
    }
    
    // Create laser source
    const laserSource = new THREE.Mesh(
        new THREE.CylinderGeometry(0.1, 0.1, 0.3, 16),
        new THREE.MeshStandardMaterial({ color: 0x333333 })
    );
    laserSource.position.set(0, 0, 3);
    laserSource.rotation.x = Math.PI/2;
    scene.add(laserSource);
    
    // Create laser beam using custom shader material
    const laserUniforms = {
        color: { value: new THREE.Color(0xff0000) },
        time: { value: 0 },
        intensity: { value: 1.0 }
    };
    
    const laserMaterial = new THREE.ShaderMaterial({
        uniforms: laserUniforms,
        vertexShader: laserVertexShader,
        fragmentShader: laserFragmentShader,
        transparent: true,
        depthWrite: false,
        side: THREE.DoubleSide
    });
    
    // Create laser beam geometry
    const laserGeometry = new THREE.CylinderGeometry(0.03, 0.03, 3, 16, 1, true);
    const laserBeam = new THREE.Mesh(laserGeometry, laserMaterial);
    laserBeam.position.set(0, 0, 1.5);
    laserBeam.rotation.x = Math.PI/2;
    scene.add(laserBeam);
    
    // Create reflection visualizations - one for each active mirror
    const reflections = [];
    
    function updateReflections() {
        // Clear old reflections
        reflections.forEach(reflection => scene.remove(reflection));
        reflections.length = 0;
        
        // Create new reflections based on active mirrors
        mirrors.forEach(mirror => {
            if (mirror.userData.active) {
                const reflection = new THREE.Mesh(
                    new THREE.CylinderGeometry(0.01, 0.01, 2, 8),
                    new THREE.MeshBasicMaterial({ 
                        color: 0xff3333,
                        transparent: true,
                        opacity: 0.7
                    })
                );
                
                // Position based on mirror position and angle
                const direction = new THREE.Vector3(
                    Math.sin(mirror.rotation.x) * (mirror.rotation.x > 0 ? 1 : -1),
                    0,
                    Math.cos(mirror.rotation.x) * (mirror.rotation.x > 0 ? -1 : 1)
                );
                
                reflection.position.copy(mirror.position);
                reflection.position.z -= 0.5;
                reflection.lookAt(mirror.position.clone().add(direction));
                scene.add(reflection);
                reflections.push(reflection);
            }
        });
    }
    
    // Create control panel for laser parameters
    const controlPanel = document.createElement('div');
    controlPanel.className = 'simulation-controls';
    
    // Laser color control
    const colorControl = document.createElement('div');
    colorControl.innerHTML = `
        <label for="laserColor">Laser Color:</label>
        <select id="laserColor">
            <option value="red">Red</option>
            <option value="green">Green</option>
            <option value="blue">Blue</option>
        </select>
    `;
    
    // Laser intensity control
    const intensityControl = document.createElement('div');
    intensityControl.innerHTML = `
        <label for="laserIntensity">Intensity:</label>
        <input type="range" id="laserIntensity" min="0.1" max="2" step="0.1" value="1">
    `;
    
    // Pattern selector
    const patternControl = document.createElement('div');
    patternControl.innerHTML = `
        <button id="randomPattern">Random Pattern</button>
        <button id="checkerPattern">Checker Pattern</button>
        <button id="linePattern">Line Pattern</button>
    `;
    
    controlPanel.appendChild(colorControl);
    controlPanel.appendChild(intensityControl);
    controlPanel.appendChild(patternControl);
    canvas.parentElement.appendChild(controlPanel);
    
    // Add event listeners for controls
    setTimeout(() => {
        const colorSelect = document.getElementById('laserColor');
        colorSelect.addEventListener('change', (e) => {
            const colorMap = {
                'red': 0xff0000,
                'green': 0x00ff00,
                'blue': 0x0000ff
            };
            laserUniforms.color.value = new THREE.Color(colorMap[e.target.value]);
        });
        
        const intensitySlider = document.getElementById('laserIntensity');
        intensitySlider.addEventListener('input', (e) => {
            laserUniforms.intensity.value = parseFloat(e.target.value);
        });
        
        // Pattern buttons
        document.getElementById('randomPattern').addEventListener('click', () => {
            mirrors.forEach(mirror => {
                mirror.userData.active = Math.random() > 0.5;
                mirror.rotation.x = mirror.userData.active ? Math.PI/4 : -Math.PI/4;
            });
            updateReflections();
        });
        
        document.getElementById('checkerPattern').addEventListener('click', () => {
            mirrors.forEach((mirror, index) => {
                const i = Math.floor(index / gridSize);
                const j = index % gridSize;
                mirror.userData.active = (i + j) % 2 === 0;
                mirror.rotation.x = mirror.userData.active ? Math.PI/4 : -Math.PI/4;
            });
            updateReflections();
        });
        
        document.getElementById('linePattern').addEventListener('click', () => {
            mirrors.forEach((mirror, index) => {
                const j = index % gridSize;
                mirror.userData.active = j % 2 === 0;
                mirror.rotation.x = mirror.userData.active ? Math.PI/4 : -Math.PI/4;
            });
            updateReflections();
        });
    }, 100);
    
    // Add help tooltip
    const helpInfo = document.createElement('div');
    helpInfo.className = 'info-overlay';
    helpInfo.textContent = 'This simulation shows how laser light reflects off the DMD mirrors to create encoded patterns.';
    canvas.parentElement.appendChild(helpInfo);
    
    // Add animation to the scene update
    setups.optical.animate = (time) => {
        laserUniforms.time.value = time / 1000;
        
        // Animate subtle mirror movements
        mirrors.forEach(mirror => {
            const vibration = Math.sin(time / 1000 * 2 + mirror.position.x * 10) * 0.01;
            mirror.rotation.x += vibration;
            // Use Math.clamp for compatibility with r128
            mirror.rotation.x = THREE.MathUtils.clamp(
                mirror.rotation.x,
                mirror.userData.active ? Math.PI/4 - 0.1 : -Math.PI/4 - 0.1,
                mirror.userData.active ? Math.PI/4 + 0.1 : -Math.PI/4 + 0.1
            );
        });
    };
    
    // Initial reflection setup
    updateReflections();
    
    // Remove loader after setup
    setTimeout(() => {
        loader.remove();
    }, 1500);
}

// Reconstruction Simulation Setup
function setupReconstructionScene() {
    const { scene, camera, renderer } = setups.reconstruction;
    const canvas = renderer.domElement;

    // Create loading indicator
    const loader = document.createElement('div');
    loader.className = 'loader';
    canvas.parentElement.appendChild(loader);

    // Create a basic encoded frame representation
    const encodedFrameMaterial = new THREE.MeshBasicMaterial({ color: 0x5555ff });
    const encodedFrame = new THREE.Mesh(new THREE.PlaneGeometry(4, 4), encodedFrameMaterial);
    encodedFrame.position.set(0, 0, 0);
    scene.add(encodedFrame);

    // Define shader to reconstruct frames
    const reconstructVertexShader = `
        varying vec3 vPosition;
        varying vec2 vUv;

        void main() {
            vPosition = position;
            vUv = uv;
            gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
        }
    `;

    const reconstructFragmentShader = `
        uniform float time;
        uniform float resolution;
        varying vec3 vPosition;
        varying vec2 vUv;
        
        void main() {
            // Simulate coded pattern transformation
            float pattern = sin(vUv.x * 10.0 * resolution + time) * 0.5 + 0.5;
            gl_FragColor = vec4(vec3(pattern), 1.0);
        }
    `;

    // Material with shader for reconstructed frames
    const reconstructionUniforms = {
        time: { value: 0 },
        resolution: { value: 1.0 }
    };

    const reconstructedMaterial = new THREE.ShaderMaterial({
        uniforms: reconstructionUniforms,
        vertexShader: reconstructVertexShader,
        fragmentShader: reconstructFragmentShader
    });

    // Create display for the temporal reconstruction sequence
    const temporalSequence = [];
    const numFrames = 5;
    for (let i = 0; i < numFrames; i++) {
        const frame = new THREE.Mesh(new THREE.PlaneGeometry(0.7, 0.7), reconstructedMaterial);
        frame.position.set(i - numFrames / 2 + 0.5, -3, 0);
        temporalSequence.push(frame);
        scene.add(frame);
    }

    // Add slider for temporal resolution
    const controlPanel = document.createElement('div');
    controlPanel.className = 'simulation-controls';

    const resolutionControl = document.createElement('div');
    resolutionControl.innerHTML = `
        <label for="resolutionSlider">Temporal Resolution:</label>
        <input type="range" id="resolutionSlider" min="1" max="5" step="1" value="1">
    `;

    const progressControl = document.createElement('div');
    progressControl.innerHTML = `
        <label for="reconstructionProgress">Progress:</label>
        <progress id="reconstructionProgress" value="0" max="100"></progress>
    `;

    controlPanel.appendChild(resolutionControl);
    controlPanel.appendChild(progressControl);
    canvas.parentElement.appendChild(controlPanel);

    // Update uniforms and progress visualization
    setTimeout(() => {
        const resolutionSlider = document.getElementById('resolutionSlider');
        resolutionSlider.addEventListener('input', e => {
            reconstructionUniforms.resolution.value = parseFloat(e.target.value);
        });

        const progressBar = document.getElementById('reconstructionProgress');
        setInterval(() => {
            progressBar.value = (progressBar.value + 1) % 100;
        }, 100);
    }, 100);

    // Add animation to update frame transformation over time
    setups.reconstruction.animate = (time) => {
        reconstructionUniforms.time.value = time / 1000;
    };

    // Add explanatory overlay
    const helpInfo = document.createElement('div');
    helpInfo.className = 'info-overlay';
    helpInfo.textContent = 'This visualization shows how a single encoded frame is transformed into multiple temporal frames in CUP.';
    canvas.parentElement.appendChild(helpInfo);

    // Remove loader after setup
    setTimeout(() => {
        loader.remove();
    }, 1500);
}

// Physical Phenomena Simulation Setup
function setupPhysicalPhenomenaScene() {
    const { scene, camera, renderer } = setups.physical;
    const canvas = renderer.domElement;
    
    // Create loading indicator
    const loader = document.createElement('div');
    loader.className = 'loader';
    canvas.parentElement.appendChild(loader);
    
    // Shared global variables for all phenomena
    let currentPhenomenon = 'light';
    let particleSystem, particleGeometry, particleCount;
    const phenomena = {};
    
    // Set up lighting
    const ambientLight = new THREE.AmbientLight(0x404040);
    const directionalLight = new THREE.DirectionalLight(0xffffff, 0.8);
    directionalLight.position.set(1, 1, 1);
    scene.add(ambientLight, directionalLight);
    
    // Vertex shader for particles
    const particleVertexShader = `
        attribute float size;
        attribute vec3 customColor;
        varying vec3 vColor;
        
        void main() {
            vColor = customColor;
            vec4 mvPosition = modelViewMatrix * vec4(position, 1.0);
            gl_PointSize = size * (300.0 / -mvPosition.z);
            gl_Position = projectionMatrix * mvPosition;
        }
    `;
    
    // Fragment shader for particles
    const particleFragmentShader = `
        uniform sampler2D pointTexture;
        varying vec3 vColor;
        
        void main() {
            gl_FragColor = vec4(vColor, 1.0) * texture2D(pointTexture, gl_PointCoord);
            if (gl_FragColor.a < 0.3) discard;
        }
    `;
    
    // Vertex shader for wave interaction
    const waveVertexShader = `
        uniform float time;
        uniform float amplitude;
        uniform float frequency;
        varying vec2 vUv;
        
        void main() {
            vUv = uv;
            // Create wave effect
            vec3 newPosition = position;
            float distance = length(position.xy);
            newPosition.z = sin(distance * frequency - time) * amplitude * (1.0 - distance * 0.5);
            gl_Position = projectionMatrix * modelViewMatrix * vec4(newPosition, 1.0);
        }
    `;
    
    // Fragment shader for wave interaction
    const waveFragmentShader = `
        uniform float time;
        uniform vec3 color;
        varying vec2 vUv;
        
        void main() {
            float intensity = abs(sin(vUv.y * 20.0 + time * 2.0)) * 0.5 + 0.5;
            gl_FragColor = vec4(color * intensity, 1.0);
        }
    `;
    
    // Shader for microfluidic flow
    const fluidVertexShader = `
        uniform float time;
        varying vec2 vUv;
        
        void main() {
            vUv = uv;
            gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
        }
    `;
    
    const fluidFragmentShader = `
        uniform float time;
        uniform vec3 color1;
        uniform vec3 color2;
        varying vec2 vUv;
        
        // Simplex noise function
        vec3 mod289(vec3 x) { return x - floor(x * (1.0 / 289.0)) * 289.0; }
        vec2 mod289(vec2 x) { return x - floor(x * (1.0 / 289.0)) * 289.0; }
        vec3 permute(vec3 x) { return mod289(((x*34.0)+1.0)*x); }
        
        float snoise(vec2 v) {
            const vec4 C = vec4(0.211324865405187,  // (3.0-sqrt(3.0))/6.0
                                0.366025403784439,  // 0.5*(sqrt(3.0)-1.0)
                                -0.577350269189626,  // -1.0 + 2.0 * C.x
                                0.024390243902439); // 1.0 / 41.0
            vec2 i  = floor(v + dot(v, C.yy) );
            vec2 x0 = v -   i + dot(i, C.xx);
            vec2 i1;
            i1 = (x0.x > x0.y) ? vec2(1.0, 0.0) : vec2(0.0, 1.0);
            vec4 x12 = x0.xyxy + C.xxzz;
            x12.xy -= i1;
            i = mod289(i);
            vec3 p = permute( permute( i.y + vec3(0.0, i1.y, 1.0 ))
            + i.x + vec3(0.0, i1.x, 1.0 ));
            vec3 m = max(0.5 - vec3(dot(x0,x0), dot(x12.xy,x12.xy), dot(x12.zw,x12.zw)), 0.0);
            m = m*m ;
            m = m*m ;
            vec3 x = 2.0 * fract(p * C.www) - 1.0;
            vec3 h = abs(x) - 0.5;
            vec3 ox = floor(x + 0.5);
            vec3 a0 = x - ox;
            m *= 1.79284291400159 - 0.85373472095314 * ( a0*a0 + h*h );
            vec3 g;
            g.x  = a0.x  * x0.x  + h.x  * x0.y;
            g.yz = a0.yz * x12.xz + h.yz * x12.yw;
            return 130.0 * dot(m, g);
        }
        
        void main() {
            // Create fluid flow pattern using noise
            float noise1 = snoise(vec2(vUv.x * 3.0, vUv.y * 3.0 + time * 0.2)) * 0.5 + 0.5;
            float noise2 = snoise(vec2(vUv.x * 5.0 - time * 0.1, vUv.y * 5.0)) * 0.5 + 0.5;
            
            // Mix colors based on noise
            vec3 finalColor = mix(color1, color2, noise1 * noise2);
            
            // Add flow lines
            float flowLine = abs(sin(vUv.y * 50.0 + noise1 * 10.0 + time));
            flowLine = smoothstep(0.9, 1.0, flowLine);
            
            finalColor = mix(finalColor, vec3(1.0), flowLine * 0.3);
            
            gl_FragColor = vec4(finalColor, 1.0);
        }
    `;
    
    // 1. Light propagation phenomenon using particle system
    phenomena.light = function() {
        // Create particle texture
        const textureLoader = new THREE.TextureLoader();
        const particleTexture = textureLoader.load('data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAACAAAAAgCAYAAABzenr0AAAABGdBTUEAALGPC/xhBQAAAAlwSFlzAAAOwgAADsIBFShKgAAAABl0RVh0U29mdHdhcmUAcGFpbnQubmV0IDQuMC4xOdTWsmQAAAD7SURBVFhH7ZRBDoMgEEU5UDfeoEcynsNLcAZv4anqUjtQEocqFruw+Mki8J/w+dBt2ww1TXPc9/1Tky5TSiGttTAIhpQv5GqLpmlaWg1i4SQoyHQSmGHGFLYQe8BWkeb3YT3HjHEBDcaB3w/3GRG4EB7g/dAbEYMiQMgOZnszIiQCLsTCWcSbkAksuHYz5oRCgFUG8Cc0Apy7mRAKgegkLnwJrYAkfAlEQCJwIUIIYg7THtZ7rJs3igALp3/5ykLkR4A7Lb+8dNonAY8Z4JoJMH6ERVh/lCzC+rNsEcbP8x/iDfF/xSRoPxJzX0yCzocYRUxOoh5F/J1EPYmxewG1Qg3q3XP5yQAAAABJRU5ErkJggg==', true);
        
        // Create particle material
        const particleMaterial = new THREE.ShaderMaterial({
            uniforms: {
                pointTexture: { value: particleTexture }
            },
            vertexShader: particleVertexShader,
            fragmentShader: particleFragmentShader,
            blending: THREE.AdditiveBlending,
            depthTest: false,
            transparent: true,
            vertexColors: true
        });
        
        // Create particle geometry and attributes
        particleCount = 1000;
        particleGeometry = new THREE.BufferGeometry();
        
        const positions = new Float32Array(particleCount * 3);
        const colors = new Float32Array(particleCount * 3);
        const sizes = new Float32Array(particleCount);
        
        // Set initial particle positions in a pulse shape
        for (let i = 0; i < particleCount; i++) {
            const i3 = i * 3;
            
            // Position particles along a line
            positions[i3] = (Math.random() - 0.5) * 2;
            positions[i3 + 1] = (Math.random() - 0.5) * 2;
            positions[i3 + 2] = (Math.random() - 0.5) * 2;
            
            // Color gradient from red to yellow
            const ratio = i / particleCount;
            colors[i3] = 1;
            colors[i3 + 1] = 0.5 * ratio;
            colors[i3 + 2] = 0;
            
            // Random sizes
            sizes[i] = Math.random() * 10 + 5;
        }
        
        particleGeometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
        particleGeometry.setAttribute('customColor', new THREE.BufferAttribute(colors, 3));
        particleGeometry.setAttribute('size', new THREE.BufferAttribute(sizes, 1));
        
        // Create particle system
        particleSystem = new THREE.Points(particleGeometry, particleMaterial);
        scene.add(particleSystem);
    };
    
    // 2. Wave interaction phenomenon
    phenomena.wave = function() {
        // Remove particle system if it exists
        if (particleSystem) scene.remove(particleSystem);
        
        // Create plane for wave visualization
        const waveGeometry = new THREE.PlaneGeometry(5, 5, 128, 128);
        
        // Create material with custom shader
        const waveUniforms = {
            time: { value: 0 },
            amplitude: { value: 0.2 },
            frequency: { value: 5.0 },
            color: { value: new THREE.Color(0x3498db) }
        };
        
        const waveMaterial = new THREE.ShaderMaterial({
            uniforms: waveUniforms,
            vertexShader: waveVertexShader,
            fragmentShader: waveFragmentShader,
            side: THREE.DoubleSide
        });
        
        // Create mesh and add to scene
        const waveMesh = new THREE.Mesh(waveGeometry, waveMaterial);
        waveMesh.rotation.x = -Math.PI / 2;
        scene.add(waveMesh);
        
        // Store reference for animation
        phenomena.waveRef = {
            mesh: waveMesh,
            uniforms: waveUniforms
        };
    };
    
    // 3. Microfluidic flow simulation
    phenomena.fluid = function() {
        // Remove previous objects
        if (particleSystem) scene.remove(particleSystem);
        if (phenomena.waveRef) scene.remove(phenomena.waveRef.mesh);
        
        // Create fluid visualization
        const fluidGeometry = new THREE.PlaneGeometry(4, 4, 1, 1);
        
        const fluidUniforms = {
            time: { value: 0 },
            color1: { value: new THREE.Color(0x1abc9c) },
            color2: { value: new THREE.Color(0x3498db) }
        };
        
        const fluidMaterial = new THREE.ShaderMaterial({
            uniforms: fluidUniforms,
            vertexShader: fluidVertexShader,
            fragmentShader: fluidFragmentShader,
            side: THREE.DoubleSide
        });
        
        // Create channel shape for fluid
        const fluidChannel = new THREE.Mesh(fluidGeometry, fluidMaterial);
        scene.add(fluidChannel);
        
        // Create channel boundaries
        const channelEdgeGeometry = new THREE.BoxGeometry(4.2, 0.1, 0.1);
        const channelEdgeMaterial = new THREE.MeshStandardMaterial({ color: 0x555555 });
        
        const topEdge = new THREE.Mesh(channelEdgeGeometry, channelEdgeMaterial);
        topEdge.position.y = 2.05;
        scene.add(topEdge);
        
        const bottomEdge = new THREE.Mesh(channelEdgeGeometry, channelEdgeMaterial);
        bottomEdge.position.y = -2.05;
        scene.add(bottomEdge);
        
        // Store references for animation
        phenomena.fluidRef = {
            channel: fluidChannel,
            uniforms: fluidUniforms,
            edges: [topEdge, bottomEdge]
        };
    };
    
    // Create controls for switching between phenomena
    const controlPanel = document.createElement('div');
    controlPanel.className = 'simulation-controls';
    
    // Create phenomenon selectors
    const phenomenaControl = document.createElement('div');
    phenomenaControl.innerHTML = `
        <label>Physical Phenomenon:</label>
        <button id="lightProp" class="control-button active">Light Propagation</button>
        <button id="waveInt" class="control-button">Wave Interaction</button>
        <button id="microfluid" class="control-button">Microfluidic Flow</button>
    `;
    
    // Parameter controls for each phenomenon
    const paramControls = document.createElement('div');
    paramControls.innerHTML = `
        <div id="lightControls">
            <label for="lightSpeed">Pulse Speed:</label>
            <input type="range" id="lightSpeed" min="0.1" max="5" step="0.1" value="1">
            
            <label for="lightSize">Particle Size:</label>
            <input type="range" id="lightSize" min="1" max="20" step="0.5" value="5">
        </div>
        
        <div id="waveControls" style="display:none">
            <label for="waveAmplitude">Amplitude:</label>
            <input type="range" id="waveAmplitude" min="0.05" max="0.5" step="0.05" value="0.2">
            
            <label for="waveFrequency">Frequency:</label>
            <input type="range" id="waveFrequency" min="1" max="10" step="0.5" value="5">
        </div>
        
        <div id="fluidControls" style="display:none">
            <label for="fluidSpeed">Flow Speed:</label>
            <input type="range" id="fluidSpeed" min="0.1" max="2" step="0.1" value="0.5">
            
            <button id="toggleFlow">Toggle Flow Direction</button>
        </div>
    `;
    
    controlPanel.appendChild(phenomenaControl);
    controlPanel.appendChild(paramControls);
    canvas.parentElement.appendChild(controlPanel);
    
    // Add help overlay
    const helpInfo = document.createElement('div');
    helpInfo.className = 'info-overlay';
    helpInfo.textContent = 'This simulation shows various physical phenomena that can be captured using CUP technology.';
    canvas.parentElement.appendChild(helpInfo);
    
    // Initialize first phenomenon
    phenomena.light();
    
    // Handle control events
    setTimeout(() => {
        // Phenomenon selection
        document.getElementById('lightProp').addEventListener('click', () => {
            currentPhenomenon = 'light';
            updateActiveButtons('lightProp');
            updateControlVisibility('lightControls');
            
            // Clear scene and initialize light propagation
            clearScene();
            phenomena.light();
        });
        
        document.getElementById('waveInt').addEventListener('click', () => {
            currentPhenomenon = 'wave';
            updateActiveButtons('waveInt');
            updateControlVisibility('waveControls');
            
            // Clear scene and initialize wave interaction
            clearScene();
            phenomena.wave();
        });
        
        document.getElementById('microfluid').addEventListener('click', () => {
            currentPhenomenon = 'fluid';
            updateActiveButtons('microfluid');
            updateControlVisibility('fluidControls');
            
            // Clear scene and initialize microfluid simulation
            clearScene();
            phenomena.fluid();
        });
        
        // Light controls
        const lightSpeedSlider = document.getElementById('lightSpeed');
        lightSpeedSlider.addEventListener('input', (e) => {
            lightSpeed = parseFloat(e.target.value);
        });
        
        const lightSizeSlider = document.getElementById('lightSize');
        lightSizeSlider.addEventListener('input', (e) => {
            if (particleSystem) {
                const sizes = particleGeometry.attributes.size.array;
                const sizeValue = parseFloat(e.target.value);
                
                for (let i = 0; i < particleCount; i++) {
                    sizes[i] = (Math.random() * 5 + 1) * sizeValue;
                }
                
                particleGeometry.attributes.size.needsUpdate = true;
            }
        });
        
        // Wave controls
        const waveAmplitudeSlider = document.getElementById('waveAmplitude');
        waveAmplitudeSlider.addEventListener('input', (e) => {
            if (phenomena.waveRef) {
                phenomena.waveRef.uniforms.amplitude.value = parseFloat(e.target.value);
            }
        });
        
        const waveFrequencySlider = document.getElementById('waveFrequency');
        waveFrequencySlider.addEventListener('input', (e) => {
            if (phenomena.waveRef) {
                phenomena.waveRef.uniforms.frequency.value = parseFloat(e.target.value);
            }
        });
        
        // Fluid controls
        const fluidSpeedSlider = document.getElementById('fluidSpeed');
        let fluidSpeed = 0.5;
        let fluidDirection = 1;
        
        fluidSpeedSlider.addEventListener('input', (e) => {
            fluidSpeed = parseFloat(e.target.value);
        });
        
        document.getElementById('toggleFlow').addEventListener('click', () => {
            fluidDirection *= -1;
        });
        
        // Helper functions
        function updateActiveButtons(activeId) {
            ['lightProp', 'waveInt', 'microfluid'].forEach(id => {
                document.getElementById(id).classList.toggle('active', id === activeId);
            });
        }
        
        function updateControlVisibility(visibleId) {
            ['lightControls', 'waveControls', 'fluidControls'].forEach(id => {
                document.getElementById(id).style.display = id === visibleId ? 'block' : 'none';
            });
        }
        
        function clearScene() {
            if (particleSystem) scene.remove(particleSystem);
            if (phenomena.waveRef) scene.remove(phenomena.waveRef.mesh);
            if (phenomena.fluidRef) {
                scene.remove(phenomena.fluidRef.channel);
                phenomena.fluidRef.edges.forEach(edge => scene.remove(edge));
            }
        }
    }, 100);
    
    // Animation variables
    let lightSpeed = 1.0;
    let time = 0;
    
    // Add animation loop
    setups.physical.animate = (timestamp) => {
        time = timestamp / 1000;
        
        if (currentPhenomenon === 'light' && particleSystem) {
            // Animate light pulse
            const positions = particleGeometry.attributes.position.array;
            
            for (let i = 0; i < particleCount; i++) {
                const i3 = i * 3;
                
                // Move particles in a pulse-like pattern
                const distance = Math.sqrt(
                    positions[i3] * positions[i3] + 
                    positions[i3 + 1] * positions[i3 + 1] + 
                    positions[i3 + 2] * positions[i3 + 2]
                );
                
                if (distance > 3) {
                    // Reset particles that move too far
                    positions[i3] = (Math.random() - 0.5) * 0.2;
                    positions[i3 + 1] = (Math.random() - 0.5) * 0.2;
                    positions[i3 + 2] = (Math.random() - 0.5) * 0.2;
                } else {
                    // Move particles outward
                    const normX = positions[i3] / distance || 0;
                    const normY = positions[i3 + 1] / distance || 0;
                    const normZ = positions[i3 + 2] / distance || 0;
                    
                    positions[i3] += normX * 0.03 * lightSpeed;
                    positions[i3 + 1] += normY * 0.03 * lightSpeed;
                    positions[i3 + 2] += normZ * 0.03 * lightSpeed;
                }
            }
            
            particleGeometry.attributes.position.needsUpdate = true;
            
        } else if (currentPhenomenon === 'wave' && phenomena.waveRef) {
            // Animate wave pattern
            phenomena.waveRef.uniforms.time.value = time;
            
        } else if (currentPhenomenon === 'fluid' && phenomena.fluidRef) {
            // Animate fluid flow
            phenomena.fluidRef.uniforms.time.value = time * fluidSpeed * fluidDirection;
        }
    };
    
    // Remove loader after setup
    setTimeout(() => {
        loader.remove();
    }, 1500);
}

// Window resize handling for responsive 3D rendering
window.addEventListener('resize', function () {
    Object.keys(setups).forEach(key => {
        const canvas = setups[key].renderer.domElement;
        setups[key].camera.aspect = canvas.clientWidth / canvas.clientHeight;
        setups[key].camera.updateProjectionMatrix();
        setups[key].renderer.setSize(canvas.clientWidth, canvas.clientHeight, false); // false preserves pixel ratio
    });
});

// Initializing all scenes
setupDMDScene();
setupOpticalScene();
setupReconstructionScene();
setupPhysicalPhenomenaScene();
// Use requestAnimationFrame to start the animation loop
requestAnimationFrame(animateScenes);
