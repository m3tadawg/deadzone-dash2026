import * as THREE from "three";

/**
 * A high-performance, modular particle system for DeadZone Dash.
 * Uses ShaderMaterial and THREE.Points to render thousands of particles efficiently.
 */
export class ParticleSystem {
    constructor(scene) {
        this.scene = scene;
        this.pools = new Map();
        this.textureLoader = new THREE.TextureLoader();
        this.textures = {};
        
        // Load common textures
        this.loadTexture("particle", "./assets/fx/particle_white.png");
        this.loadTexture("smoke", "./assets/fx/smoke_puff.png");
        this.loadTexture("fire", "./assets/fx/fireball.png");
        this.loadTexture("muzzle", "./assets/fx/muzzle_flash.png");
    }

    loadTexture(name, path) {
        this.textures[name] = this.textureLoader.load(path);
    }

    /**
     * Get or create a pool for a specific texture and blending mode.
     */
    getPool(textureName, blending) {
        const poolKey = `${textureName}_${blending}`;
        if (!this.pools.has(poolKey)) {
            const texture = this.textures[textureName] || this.textures["particle"];
            const pool = new ParticlePool(this.scene, texture, 2000, blending);
            this.pools.set(poolKey, pool);
        }
        return this.pools.get(poolKey);
    }

    /**
     * Emit a burst of particles.
     * @param {string} effectType - Profile name
     * @param {THREE.Vector3} position - Origin
     * @param {Object} options - Optional overrides (count, size, life, color, etc.)
     */
    emit(effectType, position, options = {}) {
        const profile = EFFECT_PROFILES[effectType] || EFFECT_PROFILES.blood_red;
        const pool = this.getPool(profile.texture, profile.blending || THREE.AdditiveBlending);
        
        // Merge profile with options
        const config = { ...profile, ...options };
        
        // Handle 'count' override if provided
        if (options.count !== undefined) {
            config.countMin = options.count;
            config.countMax = options.count;
        }

        pool.emit(config, position);
    }

    update(dt) {
        for (const pool of this.pools.values()) {
            pool.update(dt);
        }
    }
}

class ParticlePool {
    constructor(scene, texture, capacity, blending) {
        this.scene = scene;
        this.capacity = capacity;
        this.nextIndex = 0;

        // Particle logic state
        this.particles = Array.from({ length: capacity }, () => ({
            active: false,
            position: new THREE.Vector3(),
            velocity: new THREE.Vector3(),
            color: new THREE.Color(),
            size: 1,
            life: 0,
            maxLife: 1,
            gravity: 0,
            opacity: 1.0
        }));

        // GPU Attributes
        this.geometry = new THREE.BufferGeometry();
        this.positions = new Float32Array(capacity * 3);
        this.colors = new Float32Array(capacity * 3);
        this.sizes = new Float32Array(capacity);
        this.opacities = new Float32Array(capacity);

        this.geometry.setAttribute("position", new THREE.BufferAttribute(this.positions, 3));
        this.geometry.setAttribute("customColor", new THREE.BufferAttribute(this.colors, 3));
        this.geometry.setAttribute("size", new THREE.BufferAttribute(this.sizes, 1));
        this.geometry.setAttribute("opacity", new THREE.BufferAttribute(this.opacities, 1));

        const vertexShader = `
            attribute float size;
            attribute vec3 customColor;
            attribute float opacity;
            varying vec3 vColor;
            varying float vOpacity;
            void main() {
                vColor = customColor;
                vOpacity = opacity;
                vec4 mvPosition = modelViewMatrix * vec4(position, 1.0);
                // Enhanced distance-based sizing for better visibility
                gl_PointSize = size * (450.0 / -mvPosition.z);
                gl_Position = projectionMatrix * mvPosition;
            }
        `;

        const fragmentShader = `
            uniform sampler2D pointTexture;
            varying vec3 vColor;
            varying float vOpacity;
            void main() {
                vec4 texColor = texture2D(pointTexture, gl_PointCoord);
                gl_FragColor = vec4(vColor, vOpacity) * texColor;
                // Discard pixels with very low alpha to avoid Z-sorting artifacts and 'boxy' edges
                if (gl_FragColor.a < 0.05) discard;
            }
        `;

        this.material = new THREE.ShaderMaterial({
            uniforms: {
                pointTexture: { value: texture }
            },
            vertexShader,
            fragmentShader,
            blending: blending,
            depthWrite: false,
            transparent: true
        });

        this.points = new THREE.Points(this.geometry, this.material);
        this.points.frustumCulled = false;
        this.scene.add(this.points);
    }

    emit(config, position) {
        const count = Math.floor(Math.random() * (config.countMax - config.countMin + 1) + config.countMin);
        for (let i = 0; i < count; i++) {
            const p = this.particles[this.nextIndex];
            p.active = true;
            p.life = config.life;
            p.maxLife = config.life;
            
            p.position.copy(position);
            if (config.spread) {
                p.position.x += (Math.random() - 0.5) * config.spread;
                p.position.y += (Math.random() - 0.5) * config.spread;
                p.position.z += (Math.random() - 0.5) * config.spread;
            }

            const vel = config.velocity || 1;
            p.velocity.set(
                (Math.random() - 0.5) * vel,
                (Math.random() * 0.5 + 0.5) * vel,
                (Math.random() - 0.5) * vel
            );

            p.color.set(config.color);
            p.size = config.size;
            p.gravity = config.gravity || 0;
            p.opacity = config.opacity !== undefined ? config.opacity : 1.0;

            this.nextIndex = (this.nextIndex + 1) % this.capacity;
        }
    }

    update(dt) {
        let anyActive = false;
        for (let i = 0; i < this.capacity; i++) {
            const p = this.particles[i];
            if (!p.active) {
                this.sizes[i] = 0;
                this.opacities[i] = 0;
                continue;
            }

            anyActive = true;
            p.life -= dt;
            if (p.life <= 0) {
                p.active = false;
                this.sizes[i] = 0;
                this.opacities[i] = 0;
                continue;
            }

            p.velocity.y -= p.gravity * dt;
            p.position.addScaledVector(p.velocity, dt);

            const lifeRatio = p.life / p.maxLife;
            
            this.positions[i * 3] = p.position.x;
            this.positions[i * 3 + 1] = p.position.y;
            this.positions[i * 3 + 2] = p.position.z;

            this.colors[i * 3] = p.color.r;
            this.colors[i * 3 + 1] = p.color.g;
            this.colors[i * 3 + 2] = p.color.b;

            this.sizes[i] = p.size * (0.7 + 0.3 * lifeRatio); 
            this.opacities[i] = p.opacity * lifeRatio;
        }

        this.geometry.attributes.position.needsUpdate = true;
        this.geometry.attributes.customColor.needsUpdate = true;
        this.geometry.attributes.size.needsUpdate = true;
        this.geometry.attributes.opacity.needsUpdate = true;
    }
}

const EFFECT_PROFILES = {
    blood_red: {
        texture: "particle",
        countMin: 20,
        countMax: 35,
        life: 0.8,
        velocity: 3.5,
        spread: 0.3,
        size: 1.8,
        color: 0xaa0000,
        gravity: 15.0,
        blending: THREE.NormalBlending
    },
    blood_green: {
        texture: "particle",
        countMin: 25,
        countMax: 45,
        life: 0.8,
        velocity: 4.5,
        spread: 0.4,
        size: 2.2,
        color: 0x44aa00,
        gravity: 18.0,
        blending: THREE.NormalBlending
    },
    muzzle_flash: {
        texture: "muzzle",
        countMin: 1,
        countMax: 2,
        life: 0.1,
        velocity: 0.5,
        spread: 0.1,
        size: 4.0,
        color: 0xffcc33,
        blending: THREE.AdditiveBlending
    },
    fire: {
        texture: "fire",
        countMin: 3,
        countMax: 8,
        life: 0.6,
        velocity: 2.5,
        spread: 0.4,
        size: 2.5,
        color: 0xff6600,
        gravity: -4.0,
        blending: THREE.AdditiveBlending
    },
    smoke: {
        texture: "smoke",
        countMin: 2,
        countMax: 5,
        life: 2.5,
        velocity: 0.8,
        spread: 0.8,
        size: 6.0,
        color: 0x666666,
        gravity: -0.3,
        blending: THREE.NormalBlending
    },
    rain: {
        texture: "particle",
        countMin: 1,
        countMax: 1,
        life: 1.2,
        velocity: 0.1,
        spread: 0,
        size: 0.4,
        color: 0x88ccff,
        gravity: 60.0,
        blending: THREE.AdditiveBlending
    }
};
