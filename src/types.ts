import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls';

// Setup interfaces
export interface SimulationSetup {
    canvasId: string;
    scene?: THREE.Scene;
    camera?: THREE.PerspectiveCamera;
    renderer?: THREE.WebGLRenderer;
    controls?: OrbitControls;
    animate?: (time: number) => void;
}

export interface Setups {
    [key: string]: SimulationSetup;
}

// Phenomena interfaces
export interface WaveReference {
    mesh: THREE.Mesh;
    uniforms: {
        time: { value: number };
        amplitude: { value: number };
        frequency: { value: number };
        color: { value: THREE.Color };
    };
}

export interface FluidReference {
    channel: THREE.Mesh;
    uniforms: {
        time: { value: number };
        color1: { value: THREE.Color };
        color2: { value: THREE.Color };
    };
    edges: THREE.Mesh[];
}

export interface Phenomena {
    light: () => void;
    wave: () => void;
    fluid: () => void;
    waveRef?: WaveReference;
    fluidRef?: FluidReference;
}
