import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls';
import { SimulationSetup, Setups, Phenomena, WaveReference, FluidReference } from './types';
import { shaders } from './shaders';

// Global type declaration for runDiagnostics
declare global {
    interface Window {
        runDiagnostics: () => void;
    }
}

// Add these interfaces after the existing imports
interface Mirror extends THREE.Mesh {
    userData: {
        active: boolean;
    };
}

interface DMDSetup extends SimulationSetup {
    mirrors?: Mirror[];
}

// Add these interfaces after the existing ones
interface OpticalSetup extends SimulationSetup {
    mirrors?: Mirror[];
    laserUniforms?: {
        color: { value: THREE.Color };
        time: { value: number };
        intensity: { value: number };
    };
}

interface OpticalControls {
    colorSelect?: HTMLSelectElement;
    intensitySlider?: HTMLInputElement;
    patternButtons?: {
        random: HTMLButtonElement;
        checker: HTMLButtonElement;
        line: HTMLButtonElement;
    };
}

// Add this interface after the existing ones
interface ReconstructionSetup extends SimulationSetup {
    uniforms?: {
        time: { value: number };
        resolution: { value: number };
    };
    temporalSequence?: THREE.Mesh[];
}

// Interface for physical phenomena setup
interface PhysicalSetup extends SimulationSetup {
    currentPhenomenon?: keyof Phenomena;
    particleSystem?: THREE.Points;
    waveRef?: WaveReference;
    fluidRef?: FluidReference;
}

// Setups dictionary to store simulation configurations
const setups: Setups & { 
    dmd: DMDSetup;
    optical: OpticalSetup;
    reconstruction: ReconstructionSetup;
    physical: PhysicalSetup;
} = {
  dmd: { canvasId: 'dmdSimulation' },
  optical: { canvasId: 'opticalEncoding' },
  reconstruction: { canvasId: 'reconstruction' },
  physical: { canvasId: 'physicalPhenomena' }
};

// Initialize the phenomena object to be used by the physical simulation
const phenomena: Phenomena = {
  light: () => {},
  wave: () => {},
  fluid: () => {},
  waveRef: undefined,
  fluidRef: undefined
};

// Global variables for physical simulation
let lightSpeed = 1.0;
let fluidSpeed = 0.5;
let fluidDirection = 1;

// Initialize each scene
Object.keys(setups).forEach(key => {
  const canvas = document.getElementById(setups[key].canvasId) as HTMLCanvasElement;
  setups[key].scene = new THREE.Scene();
  setups[key].camera = new THREE.PerspectiveCamera(75, canvas.clientWidth / canvas.clientHeight, 0.1, 1000);
  setups[key].renderer = new THREE.WebGLRenderer({ canvas: canvas, antialias: true });
  setups[key].renderer.setSize(canvas.clientWidth, canvas.clientHeight);
  setups[key].controls = new OrbitControls(setups[key].camera!, setups[key].renderer.domElement);
  setups[key].camera.position.z = 5;
  
  setups[key].controls.enableDamping = true;
  setups[key].controls.dampingFactor = 0.05;
});

// Function to animate all scenes
function animateScenes() {
  requestAnimationFrame(animateScenes);
  const time = performance.now();

  Object.keys(setups).forEach(key => {
    if (setups[key].animate) {
      setups[key].animate!(time);
    }
    setups[key].controls!.update();
    setups[key].renderer!.render(setups[key].scene!, setups[key].camera!);
  });
}

// Initialize specific scenes
function setupDMDScene() {
    const { scene, camera } = setups.dmd;
    if (!scene || !camera) return;

    // Grid parameters
    const gridWidth = 10;
    const gridHeight = 10;
    const mirrorSize = 0.2;
    
    // Material for mirrors
    const mirrorMaterial = new THREE.MeshStandardMaterial({ 
        color: 0x888888, 
        metalness: 0.8, 
        roughness: 0.1 
    });
    
    // Create a grid of interactive micromirrors
    const mirrors: Mirror[] = [];
    for (let i = 0; i < gridWidth; i++) {
        for (let j = 0; j < gridHeight; j++) {
            const geometry = new THREE.PlaneGeometry(mirrorSize, mirrorSize);
            const mirror = new THREE.Mesh(geometry, mirrorMaterial) as unknown as Mirror;
            mirror.position.set(
                i * mirrorSize - (gridWidth * mirrorSize) / 2,
                j * mirrorSize - (gridHeight * mirrorSize) / 2,
                0
            );
            mirror.rotation.x = -Math.PI / 4; // Initial tilt
            mirror.userData = { active: false };
            scene.add(mirror);
            mirrors.push(mirror);
        }
    }
    
    setups.dmd.mirrors = mirrors;

    // Click handling for micromirror toggle
    window.addEventListener('click', (event: MouseEvent) => {
        const canvas = setups.dmd.renderer?.domElement;
        if (!canvas) return;

        const rect = canvas.getBoundingClientRect();
        const mouse = new THREE.Vector2(
            ((event.clientX - rect.left) / canvas.clientWidth) * 2 - 1,
            -((event.clientY - rect.top) / canvas.clientHeight) * 2 + 1
        );

        const raycaster = new THREE.Raycaster();
        raycaster.setFromCamera(mouse, camera);

        const intersects = raycaster.intersectObjects(mirrors);
        if (intersects.length > 0) {
            const mirror = intersects[0].object as Mirror;
            mirror.userData.active = !mirror.userData.active;
            mirror.rotation.x += mirror.userData.active ? Math.PI / 4 : -Math.PI / 4;
        }
    });

    // Visualize laser beam
    const laserMaterial = new THREE.LineBasicMaterial({ color: 0xff0000 });
    const laserGeometry = new THREE.BufferGeometry().setFromPoints([
        new THREE.Vector3(0, 0, 0),
        new THREE.Vector3(0, 0, -5)
    ]);
    const laser = new THREE.Line(laserGeometry, laserMaterial);
    scene.add(laser);

    // Lighting setup
    const ambientLight = new THREE.AmbientLight(0x404040);
    const pointLight = new THREE.PointLight(0xFFFFFF, 1);
    pointLight.position.set(5, 5, 5);
    scene.add(ambientLight, pointLight);

    // Loading indicator
    const canvas = setups.dmd.renderer?.domElement;
    if (canvas) {
        const loader = document.createElement('div');
        loader.className = 'loader';
        canvas.parentElement?.appendChild(loader);
        
        setTimeout(() => {
            loader.remove();
        }, 1500);
    }
}

function setupOpticalScene() {
    try {
        const { scene, camera, renderer } = setups.optical;
        if (!scene || !camera || !renderer) {
            console.error("Optical scene setup failed: missing scene, camera, or renderer");
            return;
        }

        const canvas = renderer.domElement;
        debugLog("Setting up optical scene with canvas dimensions: " + canvas.clientWidth + "x" + canvas.clientHeight);
        
        // Ensure canvas has proper dimensions
        if (canvas.clientWidth === 0 || canvas.clientHeight === 0) {
            canvas.style.width = '100%';
            canvas.style.height = '300px';
            renderer.setSize(canvas.clientWidth || 500, canvas.clientHeight || 300);
            debugLog("Canvas resized to: " + (canvas.clientWidth || 500) + "x" + (canvas.clientHeight || 300));
        }
    
    // Create loading indicator
    const loader = document.createElement('div');
    loader.className = 'loader';
    canvas.parentElement?.appendChild(loader);
    
    // Create DMD model for reference
    const dmdPlane = new THREE.Mesh(
        new THREE.PlaneGeometry(4, 4),
        new THREE.MeshPhongMaterial({ color: 0x333333, side: THREE.DoubleSide })
    );
    dmdPlane.position.set(0, 0, 0);
    scene.add(dmdPlane);
    
    // Create micromirrors array
    const gridSize = 8;
    const mirrorSize = 0.3;
    const mirrorGap = 0.05;
    const mirrors: Mirror[] = [];
    
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
            ) as unknown as Mirror;
            
            mirror.position.set(x, y, 0.05);
            mirror.rotation.x = Math.random() > 0.5 ? Math.PI/4 : -Math.PI/4;
            mirror.userData = { active: Math.random() > 0.5 };
            scene.add(mirror);
            mirrors.push(mirror);
        }
    }
    
    setups.optical.mirrors = mirrors;
    
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
    
    setups.optical.laserUniforms = laserUniforms;
    
    // Create laser material with proper error handling
    let laserMaterial: THREE.Material;
    
    try {
        if (!shaders.laser || !shaders.laser.vertex || !shaders.laser.fragment) {
            console.error("Laser shader code missing");
            debugLog("ERROR: Laser shader missing or incomplete");
            // Fallback to basic material
            laserMaterial = new THREE.MeshBasicMaterial({ 
                color: 0xff0000, 
                transparent: true,
                opacity: 0.5,
                side: THREE.DoubleSide
            });
            debugLog("Using fallback basic material for laser");
        } else {
            laserMaterial = new THREE.ShaderMaterial({
                uniforms: laserUniforms,
                vertexShader: shaders.laser.vertex,
                fragmentShader: shaders.laser.fragment,
                transparent: true,
                depthWrite: false,
                side: THREE.DoubleSide,
                blending: THREE.AdditiveBlending
            });
            debugLog("Using shader material for laser");
        }
        
        // Create laser beam geometry
        const laserBeam = new THREE.Mesh(
            new THREE.CylinderGeometry(0.03, 0.03, 3, 16, 1, true),
            laserMaterial
        );
        
        // Set initial position and orientation
        laserBeam.position.set(0, 0, 1.5);
        laserBeam.rotation.x = Math.PI/2;
        scene.add(laserBeam);
        debugLog("Laser beam added to scene");
    } catch (error) {
        console.error("Error creating laser beam:", error);
        debugLog("ERROR: Failed to create laser beam: " + (error as Error).message);
    }
    
    // Create controls
    createOpticalControls(canvas, mirrors, gridSize);
    
    // Add animation
    setups.optical.animate = (time: number) => {
        try {
            if (setups.optical.laserUniforms) {
                setups.optical.laserUniforms.time.value = time / 1000;
            }
            
            // Animate subtle mirror movements - add safety check
            if (mirrors && mirrors.length > 0) {
                mirrors.forEach(mirror => {
                    if (!mirror || !mirror.position) return;
                    
                    const vibration = Math.sin(time / 1000 * 2 + mirror.position.x * 10) * 0.01;
                    mirror.rotation.x += vibration;
                    
                    // Make sure userData exists
                    if (mirror.userData) {
                        mirror.rotation.x = THREE.MathUtils.clamp(
                            mirror.rotation.x,
                            mirror.userData.active ? Math.PI/4 - 0.1 : -Math.PI/4 - 0.1,
                            mirror.userData.active ? Math.PI/4 + 0.1 : -Math.PI/4 + 0.1
                        );
                    }
                });
            }
        } catch (error) {
            console.error("Error in optical animation:", error);
            debugLog("Error in optical animation: " + (error as Error).message);
        }
    };
    
    // Add debug info about optical setup
    debugLog("Optical scene setup complete");
    debugLog(`Mirrors created: ${mirrors ? mirrors.length : 0}`);
    debugLog(`Using shader material: ${!(!shaders.laser || !shaders.laser.vertex || !shaders.laser.fragment)}`);
    
    // Remove loader after setup
    setTimeout(() => {
        loader.remove();
    }, 1500);
}

// Helper function to create optical controls
function createOpticalControls(canvas: HTMLCanvasElement, mirrors: Mirror[], gridSize: number) {
    try {
        if (!canvas) {
            console.error("Cannot create optical controls: canvas is null");
            debugLog("ERROR: Cannot create optical controls (null canvas)");
            return;
        }
        
        if (!mirrors || mirrors.length === 0) {
            console.error("Cannot create optical controls: mirrors array is empty");
            debugLog("ERROR: Cannot create optical controls (empty mirrors)");
            return;
        }
        
        const controlPanel = document.createElement('div');
        controlPanel.className = 'simulation-controls';
    
    // Create controls HTML
    controlPanel.innerHTML = `
        <div>
            <label for="laserColor">Laser Color:</label>
            <select id="laserColor">
                <option value="red">Red</option>
                <option value="green">Green</option>
                <option value="blue">Blue</option>
            </select>
        </div>
        <div>
            <label for="laserIntensity">Intensity:</label>
            <input type="range" id="laserIntensity" min="0.1" max="2" step="0.1" value="1">
        </div>
        <div>
            <button id="randomPattern">Random Pattern</button>
            <button id="checkerPattern">Checker Pattern</button>
            <button id="linePattern">Line Pattern</button>
        </div>
    `;
    
    // Ensure parent element exists
    if (!canvas.parentElement) {
        console.error("Cannot append controls: canvas parent is null");
        debugLog("ERROR: Cannot append controls (null canvas parent)");
        return;
    }
    
    canvas.parentElement.appendChild(controlPanel);
    
    // Add event listeners
    const controls: OpticalControls = {};
    
    // Function to safely attach event listeners
    const setupControlListeners = () => {
        try {
            controls.colorSelect = document.getElementById('laserColor') as HTMLSelectElement;
            controls.intensitySlider = document.getElementById('laserIntensity') as HTMLInputElement;
            controls.patternButtons = {
                random: document.getElementById('randomPattern') as HTMLButtonElement,
                checker: document.getElementById('checkerPattern') as HTMLButtonElement,
                line: document.getElementById('linePattern') as HTMLButtonElement
            };
            
            // Check if elements were found before adding listeners
            if (!controls.colorSelect || !controls.intensitySlider || 
                !controls.patternButtons.random || !controls.patternButtons.checker || !controls.patternButtons.line) {
                console.warn('Some optical simulation controls not found, retrying in 100ms');
                setTimeout(setupControlListeners, 100);
                return;
            }
        
	        if (controls.colorSelect) {
	            controls.colorSelect.addEventListener('change', (e: Event) => {
	                const target = e.target as HTMLSelectElement;
	                const colorMap: { [key: string]: number } = {
	                    'red': 0xff0000,
	                    'green': 0x00ff00,
	                    'blue': 0x0000ff
	                };
	                if (setups.optical.laserUniforms) {
	                    setups.optical.laserUniforms.color.value = new THREE.Color(colorMap[target.value]);
	                }
	            });
	        }
	        
	        if (controls.intensitySlider) {
	            controls.intensitySlider.addEventListener('input', (e: Event) => {
	                const target = e.target as HTMLInputElement;
	                if (setups.optical.laserUniforms) {
	                    setups.optical.laserUniforms.intensity.value = parseFloat(target.value);
	                }
	            });
	        }
	        
	        // Pattern controls
	        if (controls.patternButtons) {
	            controls.patternButtons.random.addEventListener('click', () => {
	                mirrors.forEach(mirror => {
	                    if (!mirror) return;
	                    mirror.userData.active = Math.random() > 0.5;
	                    mirror.rotation.x = mirror.userData.active ? Math.PI/4 : -Math.PI/4;
	                });
	                debugLog("Random pattern applied to mirrors");
	            });
	            
	            controls.patternButtons.checker.addEventListener('click', () => {
	                mirrors.forEach((mirror, index) => {
	                    if (!mirror) return;
	                    const i = Math.floor(index / gridSize);
	                    const j = index % gridSize;
	                    mirror.userData.active = (i + j) % 2 === 0;
	                    mirror.rotation.x = mirror.userData.active ? Math.PI/4 : -Math.PI/4;
	                });
	                debugLog("Checker pattern applied to mirrors");
	            });
	            
	            controls.patternButtons.line.addEventListener('click', () => {
	                mirrors.forEach((mirror, index) => {
	                    if (!mirror) return;
	                    const j = index % gridSize;
	                    mirror.userData.active = j % 2 === 0;
	                    mirror.rotation.x = mirror.userData.active ? Math.PI/4 : -Math.PI/4;
	                });
	                debugLog("Line pattern applied to mirrors");
	            });
	        } 
        } catch (error) {
            console.error('Error setting up optical controls:', error);
            setTimeout(setupControlListeners, 100);
        }
    };
    
    // Start setting up controls - use a more reliable approach
    if (document.readyState === 'complete') {
        setupControlListeners();
    } else {
        window.addEventListener('load', setupControlListeners);
        // Fallback timeout
        setTimeout(setupControlListeners, 500);
    }
    
} catch (error) {
        console.error("Error creating optical controls:", error);
        debugLog("Error creating optical controls: " + (error as Error).message);
    }
}

function setupReconstructionScene() {
    const { scene, camera, renderer } = setups.reconstruction;
    if (!scene || !camera || !renderer) return;
    const canvas = renderer.domElement;

    // Create loading indicator
    const loader = document.createElement('div');
    loader.className = 'loader';
    canvas.parentElement?.appendChild(loader);

    // Create a basic encoded frame representation
    const encodedFrameMaterial = new THREE.MeshBasicMaterial({ color: 0x5555ff });
    const encodedFrame = new THREE.Mesh(
        new THREE.PlaneGeometry(4, 4),
        encodedFrameMaterial
    );
    encodedFrame.position.set(0, 0, 0);
    scene.add(encodedFrame);

    // Create uniforms for reconstruction shader
    const reconstructionUniforms = {
        time: { value: 0 },
        resolution: { value: 1.0 }
    };

    setups.reconstruction.uniforms = reconstructionUniforms;

    // Create material with shader for reconstructed frames
    const reconstructedMaterial = new THREE.ShaderMaterial({
        uniforms: reconstructionUniforms,
        vertexShader: shaders.reconstruction.vertex,
        fragmentShader: shaders.reconstruction.fragment
    });

    // Create display for the temporal reconstruction sequence
    const temporalSequence: THREE.Mesh[] = [];
    const numFrames = 5;
    
    for (let i = 0; i < numFrames; i++) {
        const frame = new THREE.Mesh(
            new THREE.PlaneGeometry(0.7, 0.7),
            reconstructedMaterial.clone()
        );
        frame.position.set(i - numFrames / 2 + 0.5, -3, 0);
        temporalSequence.push(frame);
        scene.add(frame);
    }

    setups.reconstruction.temporalSequence = temporalSequence;

    // Add controls for temporal resolution
    const controlPanel = document.createElement('div');
    controlPanel.className = 'simulation-controls';

    controlPanel.innerHTML = `
        <div>
            <label for="resolutionSlider">Temporal Resolution:</label>
            <input type="range" id="resolutionSlider" min="1" max="5" step="1" value="1">
        </div>
        <div>
            <label for="reconstructionProgress">Progress:</label>
            <progress id="reconstructionProgress" value="0" max="100"></progress>
        </div>
    `;

    canvas.parentElement?.appendChild(controlPanel);

    // Add control event listeners
    setTimeout(() => {
        const resolutionSlider = document.getElementById('resolutionSlider') as HTMLInputElement;
        const progressBar = document.getElementById('reconstructionProgress') as HTMLProgressElement;

        if (resolutionSlider) {
            resolutionSlider.addEventListener('input', (e: Event) => {
                const target = e.target as HTMLInputElement;
                if (reconstructionUniforms) {
                    reconstructionUniforms.resolution.value = parseFloat(target.value);
                }
            });
        }

        if (progressBar) {
            setInterval(() => {
                progressBar.value = (progressBar.value + 1) % 100;
            }, 100);
        }
    }, 100);

    // Add help overlay
    const helpInfo = document.createElement('div');
    helpInfo.className = 'info-overlay';
    helpInfo.textContent = 'This visualization shows how a single encoded frame is transformed into multiple temporal frames in CUP.';
    canvas.parentElement?.appendChild(helpInfo);

    // Add animation
    setups.reconstruction.animate = (time: number) => {
        if (reconstructionUniforms) {
            reconstructionUniforms.time.value = time / 1000;
        }

        // Add any additional frame-specific animations here
        temporalSequence.forEach((frame, index) => {
            const phase = (time / 1000 + index * 0.5) % (2 * Math.PI);
            frame.position.y = -3 + Math.sin(phase) * 0.1;
        });
    };

    // Remove loader after setup
    setTimeout(() => {
        loader.remove();
    }, 1500);
}

function setupPhysicalPhenomenaScene() {
    const { scene, camera, renderer } = setups.physical;
    if (!scene || !camera || !renderer) return;
    const canvas = renderer.domElement;
    
    // Create loading indicator
    const loader = document.createElement('div');
    loader.className = 'loader';
    canvas.parentElement?.appendChild(loader);
    
    // Shared global variables for all phenomena
    setups.physical.currentPhenomenon = 'light';

    // Set up lighting
    const ambientLight = new THREE.AmbientLight(0x404040);
    const directionalLight = new THREE.DirectionalLight(0xffffff, 0.8);
    directionalLight.position.set(1, 1, 1);
    scene.add(ambientLight, directionalLight);

    // Initialize first phenomenon
    setupPhenomenonFunctions();
    setups.physical.currentPhenomenon = 'light';
    phenomena.light();
    updateControlVisibility('lightControls');

    // Create controls for switching between phenomena
    const controlPanel = document.createElement('div');
    controlPanel.className = 'simulation-controls';

    controlPanel.innerHTML = `
        <div>
            <label>Physical Phenomenon:</label>
            <button id="lightProp" class="control-button active">Light Propagation</button>
            <button id="waveInt" class="control-button">Wave Interaction</button>
            <button id="microfluid" class="control-button">Microfluidic Flow</button>
        </div>
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
    canvas.parentElement?.appendChild(controlPanel);

    // Initialize control event listeners
    setTimeout(() => {
        setupPhenomenonControls();
    }, 100);

    // Helper functions for phenomena
    function setupPhenomenonFunctions() {
        // Light propagation phenomenon
        phenomena.light = function() {
            clearScene();
            // Implementation for light propagation
            const particleCount = 1000;
            const particleGeometry = new THREE.BufferGeometry();
            const positions = new Float32Array(particleCount * 3);
            const colors = new Float32Array(particleCount * 3);
            const sizes = new Float32Array(particleCount);

            for (let i = 0; i < particleCount; i++) {
                const i3 = i * 3;
                positions[i3] = (Math.random() - 0.5) * 2; // x
                positions[i3 + 1] = (Math.random() - 0.5) * 2; // y
                positions[i3 + 2] = (Math.random() - 0.5) * 2; // z

                const ratio = i / particleCount;
                colors[i3] = 1;
                colors[i3 + 1] = 0.5 * ratio;
                colors[i3 + 2] = 0;

                sizes[i] = Math.random() * 10 + 5;
            }

            particleGeometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
            particleGeometry.setAttribute('customColor', new THREE.BufferAttribute(colors, 3));
            particleGeometry.setAttribute('size', new THREE.BufferAttribute(sizes, 1));

            const particleMaterial = new THREE.ShaderMaterial({
                uniforms: {
                    pointTexture: { value: new THREE.TextureLoader().load('data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII=') }
                },
                vertexShader: shaders.particle.vertex,
                fragmentShader: shaders.particle.fragment,
                blending: THREE.AdditiveBlending,
                depthTest: false,
                transparent: true,
                vertexColors: true
            });

            const particleSystem = new THREE.Points(particleGeometry, particleMaterial);
            setups.physical.particleSystem = particleSystem;
            scene?.add(particleSystem);
        };

        // Wave interaction phenomenon
        phenomena.wave = function() {
            clearScene();
            // Implementation for wave interaction
            const waveGeometry = new THREE.PlaneGeometry(5, 5, 128, 128);
            const waveUniforms = {
                time: { value: 0 },
                amplitude: { value: 0.2 },
                frequency: { value: 5.0 },
                color: { value: new THREE.Color(0x3498db) }
            };

            const waveMaterial = new THREE.ShaderMaterial({
                uniforms: waveUniforms,
                vertexShader: shaders.wave.vertex,
                fragmentShader: shaders.wave.fragment,
                side: THREE.DoubleSide
            });

            const waveMesh = new THREE.Mesh(waveGeometry, waveMaterial);
            waveMesh.rotation.x = -Math.PI / 2;
            setups.physical.waveRef = { mesh: waveMesh, uniforms: waveUniforms };
            scene?.add(waveMesh);
        };

        // Microfluidic flow simulation
        phenomena.fluid = function() {
            clearScene();
            // Implementation for microfluidic flow
            const fluidGeometry = new THREE.PlaneGeometry(4, 4, 1, 1);
            const fluidUniforms = {
                time: { value: 0 },
                color1: { value: new THREE.Color(0x1abc9c) },
                color2: { value: new THREE.Color(0x3498db) }
            };

            const fluidMaterial = new THREE.ShaderMaterial({
                uniforms: fluidUniforms,
                vertexShader: shaders.fluid.vertex,
                fragmentShader: shaders.fluid.fragment,
                side: THREE.DoubleSide
            });

            const fluidChannel = new THREE.Mesh(fluidGeometry, fluidMaterial);
            setups.physical.fluidRef = { channel: fluidChannel, uniforms: fluidUniforms, edges: [] };
            scene?.add(fluidChannel);

            const channelEdges = createChannelEdges();
            setups.physical.fluidRef.edges = channelEdges;
            channelEdges.forEach(edge => scene?.add(edge));
        };
    }

    // Setup controls for phenomena
    function setupPhenomenonControls() {
        // Phenomenon selection
        document.getElementById('lightProp')?.addEventListener('click', () => {
            setups.physical.currentPhenomenon = 'light';
            phenomena.light();
            updateActiveButtons('lightProp');
            updateControlVisibility('lightControls');
        });

        document.getElementById('waveInt')?.addEventListener('click', () => {
            setups.physical.currentPhenomenon = 'wave';
            phenomena.wave();
            updateActiveButtons('waveInt');
            updateControlVisibility('waveControls');
        });

        document.getElementById('microfluid')?.addEventListener('click', () => {
            setups.physical.currentPhenomenon = 'fluid';
            phenomena.fluid();
            updateActiveButtons('microfluid');
            updateControlVisibility('fluidControls');
        });

        // Light controls
        const lightSpeedSlider = document.getElementById('lightSpeed') as HTMLInputElement;
        if (lightSpeedSlider) {
            lightSpeedSlider.addEventListener('input', (e: Event) => {
                const target = e.target as HTMLInputElement;
                lightSpeed = parseFloat(target.value);
            });
        }

        const lightSizeSlider = document.getElementById('lightSize') as HTMLInputElement;
        if (lightSizeSlider) {
            lightSizeSlider.addEventListener('input', (e: Event) => {
                if (setups.physical.particleSystem) {
                    const sizes = setups.physical.particleSystem.geometry.attributes.size.array as Float32Array;
                    const sizeValue = parseFloat((e.target as HTMLInputElement).value);
                    const particleCount = sizes.length;
                    
                    for (let i = 0; i < particleCount; i++) {
                        sizes[i] = (Math.random() * 5 + 1) * sizeValue;
                    }
                    
                    (setups.physical.particleSystem.geometry.attributes.size as THREE.BufferAttribute).needsUpdate = true;
                }
            });
        }

        // Wave controls
        const waveAmplitudeSlider = document.getElementById('waveAmplitude') as HTMLInputElement;
        if (waveAmplitudeSlider) {
            waveAmplitudeSlider.addEventListener('input', (e: Event) => {
                if (setups.physical.waveRef) {
                    setups.physical.waveRef.uniforms.amplitude.value = parseFloat((e.target as HTMLInputElement).value);
                }
            });
        }

        const waveFrequencySlider = document.getElementById('waveFrequency') as HTMLInputElement;
        if (waveFrequencySlider) {
            waveFrequencySlider.addEventListener('input', (e: Event) => {
                if (setups.physical.waveRef) {
                    setups.physical.waveRef.uniforms.frequency.value = parseFloat((e.target as HTMLInputElement).value);
                }
            });
        }

        // Fluid controls
        const fluidSpeedSlider = document.getElementById('fluidSpeed') as HTMLInputElement;
        if (fluidSpeedSlider) {
            fluidSpeedSlider.addEventListener('input', (e: Event) => {
                fluidSpeed = parseFloat((e.target as HTMLInputElement).value);
            });
        }

        const toggleFlowButton = document.getElementById('toggleFlow') as HTMLButtonElement;
        if (toggleFlowButton) {
            toggleFlowButton.addEventListener('click', () => {
                fluidDirection *= -1;
            });
        }
    }

    // Utility functions
    function updateActiveButtons(activeId: string) {
        ['lightProp', 'waveInt', 'microfluid'].forEach(id => {
            const button = document.getElementById(id);
            button?.classList.toggle('active', id === activeId);
        });
    }

    function updateControlVisibility(visibleId: string) {
        ['lightControls', 'waveControls', 'fluidControls'].forEach(id => {
            const control = document.getElementById(id);
            if (control) {
                control.style.display = id === visibleId ? 'block' : 'none';
            }
        });
    }

    function clearScene() {
        if (setups.physical.particleSystem && scene) scene.remove(setups.physical.particleSystem);
        if (setups.physical.waveRef && scene) scene.remove(setups.physical.waveRef.mesh);
        if (setups.physical.fluidRef && scene) {
            scene.remove(setups.physical.fluidRef.channel);
            setups.physical.fluidRef.edges.forEach(edge => scene.remove(edge));
        }
    }

    function createChannelEdges() {
        const channelEdgeGeometry = new THREE.BoxGeometry(4.2, 0.1, 0.1);
        const channelEdgeMaterial = new THREE.MeshStandardMaterial({ color: 0x555555 });
    
        const topEdge = new THREE.Mesh(channelEdgeGeometry, channelEdgeMaterial);
        topEdge.position.y = 2.05;
    
        const bottomEdge = new THREE.Mesh(channelEdgeGeometry, channelEdgeMaterial);
        bottomEdge.position.y = -2.05;
    
        return [topEdge, bottomEdge];
    }

    // Add help overlay
    const helpInfo = document.createElement('div');
    helpInfo.className = 'info-overlay';
    helpInfo.textContent = 'This simulation shows various physical phenomena that can be captured using CUP technology.';
    canvas.parentElement?.appendChild(helpInfo);
    
    // Remove loader after setup
    setTimeout(() => {
        loader.remove();
    }, 1500);

    // Add animation
    let time = 0;
    // Use the global lightSpeed, fluidSpeed, and fluidDirection variables

    setups.physical.animate = (timestamp: number) => {
        time = timestamp / 1000;

        switch (setups.physical.currentPhenomenon) {
            case 'light':
                animateLightProp(time, lightSpeed);
                break;
            case 'wave':
                animateWave(time);
                break;
            case 'fluid':
                animateFluidFlow(time, fluidSpeed, fluidDirection);
                break;
            default:
                break;
        }
    };

    function animateLightProp(time: number, speed: number) {
        if (!setups.physical.particleSystem) return;
        const positions = setups.physical.particleSystem.geometry.attributes.position.array as Float32Array;
        const particleCount = positions.length / 3;
        
        for (let i = 0; i < particleCount; i++) {
            const i3 = i * 3;
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
                positions[i3] += normX * 0.03 * speed;
                positions[i3 + 1] += normY * 0.03 * speed;
                positions[i3 + 2] += normZ * 0.03 * speed;
            }
        }
        (setups.physical.particleSystem.geometry.attributes.position as THREE.BufferAttribute).needsUpdate = true;
    }

    function animateWave(time: number) {
        if (setups.physical.waveRef) {
            setups.physical.waveRef.uniforms.time.value = time;
        }
    }

    function animateFluidFlow(time: number, speed: number, direction: number) {
        if (setups.physical.fluidRef) {
            setups.physical.fluidRef.uniforms.time.value = time * speed * direction;
        }
    }
}

// Run setup functions
setupDMDScene();
setupOpticalScene();
setupReconstructionScene();
setupPhysicalPhenomenaScene();

// Handle window resize
window.addEventListener('resize', function () {
  Object.keys(setups).forEach(key => {
    const canvas = setups[key].renderer!.domElement;
    setups[key].camera!.aspect = canvas.clientWidth / canvas.clientHeight;
    setups[key].camera!.updateProjectionMatrix();
    setups[key].renderer!.setSize(canvas.clientWidth, canvas.clientHeight, false);
  });
});

// Start animation loop
requestAnimationFrame(animateScenes);

// Debug helper function
function debugLog(message: string) {
    console.log(message);
    const debugOutput = document.getElementById('debug-output');
    if (debugOutput && debugOutput.textContent !== null) {
        debugOutput.textContent += message + '\n';
        if (debugOutput.textContent && debugOutput.textContent.split('\n').length > 10) {
            const lines = debugOutput.textContent.split('\n');
            debugOutput.textContent = lines.slice(lines.length - 10).join('\n');
        }
    }
}

// Show debug panel if there are errors
window.addEventListener('error', function(event) {
    const debugInfo = document.getElementById('debug-info');
    if (debugInfo) {
        debugInfo.style.display = 'block';
        debugLog(`Error: ${event.message} at ${event.filename}:${event.lineno}`);
    }
});

// Add diagnostic function
window.runDiagnostics = function(): void {
    try {
        debugLog("Running diagnostics...");
        debugLog("Checking optical scene setup:");
        
        // Check optical scene components
        const { scene, camera, renderer, laserUniforms } = setups.optical;
        debugLog(`- Scene: ${scene ? 'OK' : 'MISSING'}`);
        debugLog(`- Camera: ${camera ? 'OK' : 'MISSING'}`);
        debugLog(`- Renderer: ${renderer ? 'OK' : 'MISSING'}`);
        debugLog(`- Laser uniforms: ${laserUniforms ? 'OK' : 'MISSING'}`);
        
        if (laserUniforms) {
            debugLog(`  - Color: ${laserUniforms.color ? 'OK' : 'MISSING'}`);
            debugLog(`  - Time: ${laserUniforms.time ? 'OK' : 'MISSING'}`);
            debugLog(`  - Intensity: ${laserUniforms.intensity ? 'OK' : 'MISSING'}`);
        }
        
        // Check control elements
        debugLog("Checking optical controls:");
        const laserColor = document.getElementById('laserColor');
        const laserIntensity = document.getElementById('laserIntensity');
        const randomPattern = document.getElementById('randomPattern');
        debugLog(`- Color select: ${laserColor ? 'OK' : 'MISSING'}`);
        debugLog(`- Intensity slider: ${laserIntensity ? 'OK' : 'MISSING'}`);
        debugLog(`- Random pattern: ${randomPattern ? 'OK' : 'MISSING'}`);
        
        // Check shader availability
        debugLog("Checking shader code:");
        debugLog(`- Laser vertex: ${shaders.laser?.vertex ? 'OK' : 'MISSING'}`);
        debugLog(`- Laser fragment: ${shaders.laser?.fragment ? 'OK' : 'MISSING'}`);
        
        debugLog("Diagnostics complete.");
    } catch (error) {
        debugLog(`Diagnostic error: ${(error as Error).message}`);
    }
};

