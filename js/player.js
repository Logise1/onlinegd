/* ── Player Controller ────────────────────────────── */

const GRAVITY = 0.9;
const JUMP_FORCE = -13;
const SHIP_LIFT = -0.6;
const SHIP_GRAVITY = 0.4;

const Player = {
    settings: {
        selected: { cube: 1, ship: 1, ball: 1, ufo: 1, wave: 1, robot: 1, spider: 1, swing: 1, jetpack: 1 },
        colors: { c1: '#00ff88', c2: '#ffffff' }
    },
    processedSprites: {}, // Cache for colored canvases

    init() {
        const stored = JSON.parse(localStorage.getItem('gd_icon_settings') || '{}');
        if (stored.colors) this.settings.colors = stored.colors;

        const allIcons = JSON.parse(localStorage.getItem('gd_all_icons') || '{}');
        Object.assign(this.settings.selected, allIcons);

        // Load the main selected one too
        if (stored.selected) {
            this.settings.selected[stored.selected.type] = stored.selected.id;
        }
    },

    async getProcessedSprite(mode) {
        if (this.processedSprites[mode] && this.processedSprites[mode] !== 'loading') return this.processedSprites[mode];

        // Mode mapping for gdbrowser names (ensure consistency with icons.json)
        const gMode = mode; // We now use the same names everywhere
        const id = this.settings.selected[gMode] || 1;
        const url = `https://gdbrowser.com/iconkit/premade/${gMode}_${id}.png`;

        if (this.processedSprites[url] === 'loading') return null;
        this.processedSprites[url] = 'loading';

        return new Promise((resolve) => {
            const img = new Image();
            img.crossOrigin = "Anonymous";
            img.src = url;
            img.onload = () => {
                const canvas = document.createElement('canvas');
                canvas.width = img.width;
                canvas.height = img.height;
                const ctx = canvas.getContext('2d');
                ctx.drawImage(img, 0, 0);

                const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
                const data = imageData.data;
                const c1 = this.hexToRgb(this.settings.colors.c1);
                const c2 = this.hexToRgb(this.settings.colors.c2);
                const black = { r: 0, g: 0, b: 0 };

                for (let i = 0; i < data.length; i += 4) {
                    const a = data[i + 3];
                    if (a === 0) continue;

                    const gray = (data[i] + data[i + 1] + data[i + 2]) / 3;

                    let targetR, targetG, targetB;

                    if (gray >= 255) {
                        targetR = c1.r; targetG = c1.g; targetB = c1.b;
                    } else if (gray <= 124) {
                        targetR = 0; targetG = 0; targetB = 0;
                    } else if (gray >= 175) {
                        const t = (gray - 175) / (255 - 175);
                        targetR = c2.r + (c1.r - c2.r) * t;
                        targetG = c2.g + (c1.g - c2.g) * t;
                        targetB = c2.b + (c1.b - c2.b) * t;
                    } else {
                        const t = (gray - 124) / (175 - 124);
                        targetR = black.r + (c2.r - black.r) * t;
                        targetG = black.g + (c2.g - black.g) * t;
                        targetB = black.b + (c2.b - black.b) * t;
                    }

                    data[i] = targetR;
                    data[i + 1] = targetG;
                    data[i + 2] = targetB;
                }
                ctx.putImageData(imageData, 0, 0);
                this.processedSprites[mode] = canvas;
                resolve(canvas);
            };
            img.onerror = () => {
                this.processedSprites[mode] = null;
                resolve(null);
            };
        });
    },

    hexToRgb(hex) {
        const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
        return result ? {
            r: parseInt(result[1], 16),
            g: parseInt(result[2], 16),
            b: parseInt(result[3], 16)
        } : { r: 255, g: 255, b: 255 };
    },

    create(x, y) {
        this.init(); // Refresh settings
        return {
            x, y,
            vx: 0, vy: 0,
            mode: 'cube',        // cube | ship
            gravityDir: 1,       // 1 normal, -1 flipped
            mini: false,
            onGround: false,
            canJump: true,
            rotation: 0,
            targetRotation: 0,
            trail: [],
            trailTimer: 0,
        };
    },

    update(p, engine) {
        const grav = GRAVITY * p.gravityDir;

        switch (p.mode) {
            case 'cube': this.updateCube(p, engine, grav); break;
            case 'ship': this.updateShip(p, engine, grav); break;
            case 'ball': this.updateBall(p, engine, grav); break;
            case 'ufo': this.updateUfo(p, engine, grav); break;
            case 'wave': this.updateWave(p, engine, grav); break;
            default: this.updateCube(p, engine, grav); break;
        }

        // Trail
        p.trailTimer++;
        if (p.trailTimer % 2 === 0) {
            const pSize = p.mini ? BLOCK_SIZE * 0.5 : BLOCK_SIZE;
            p.trail.push({ x: p.x + pSize / 2, y: p.y + pSize / 2, life: 1 });
            if (p.trail.length > 30) p.trail.shift();
        }
        for (let i = p.trail.length - 1; i >= 0; i--) {
            p.trail[i].life -= 0.04;
            if (p.trail[i].life <= 0) p.trail.splice(i, 1);
        }
    },

    /* ── Cube Mode ── */
    updateCube(p, engine, grav) {
        // *** Jump BEFORE physics so checkBoundaries won't cancel it ***
        if (engine.input.pressed && p.onGround && p.canJump) {
            p.vy = JUMP_FORCE * p.gravityDir;
            p.onGround = false;
            p.canJump = false;
            engine.jumps++;
        }

        // Apply gravity & move
        p.vy += grav;
        p.y += p.vy;

        // Rotation logic
        if (!p.onGround) {
            p.targetRotation += 6.5 * p.gravityDir; // Slightly faster for cleaner visual
        } else {
            // Snap rotation to nearest 90°
            p.targetRotation = Math.round(p.targetRotation / 90) * 90;
        }

        // Smoothly interpolate current rotation to target
        let diff = (p.targetRotation - p.rotation);
        p.rotation += diff * 0.35;

        p.onGround = false;
    },

    /* ── Ship Mode ── */
    updateShip(p, engine, grav) {
        if (engine.input.pressed) {
            p.vy += SHIP_LIFT * p.gravityDir;
        } else {
            p.vy += SHIP_GRAVITY * p.gravityDir;
        }

        // Clamp velocity
        p.vy = Math.max(-12, Math.min(12, p.vy));
        p.y += p.vy;

        // Rotation follows velocity
        p.rotation = p.vy * 2;

        p.onGround = false;
        p.onGround = false;
    },

    /* ── Ball Mode ── */
    updateBall(p, engine, grav) {
        // Toggle gravity on click when on ground
        if (engine.input.justPressed && p.onGround) {
            p.gravityDir *= -1;
            p.onGround = false;
            engine.jumps++;
        }

        p.vy += grav;
        p.y += p.vy;

        // Rotation
        p.rotation += 10 * p.gravityDir;
        p.onGround = false;
    },

    /* ── UFO Mode ── */
    updateUfo(p, engine, grav) {
        // Flappy bird jump
        if (engine.input.justPressed) {
            p.vy = JUMP_FORCE * 0.8 * p.gravityDir;
            engine.jumps++;
        }

        p.vy += grav;
        p.y += p.vy;

        // Visual tilt
        p.rotation = p.vy * 2;
        p.onGround = false;
    },

    /* ── Wave Mode ── */
    updateWave(p, engine, grav) {
        const waveSpeed = 10 * p.gravityDir;
        if (engine.input.pressed) {
            p.vy = -waveSpeed;
        } else {
            p.vy = waveSpeed;
        }

        p.y += p.vy;
        p.rotation = p.vy * 4; // Angle follows direction
        p.onGround = false;

        // Wave Trail (Solid line)
        if (!p.waveTrail) p.waveTrail = [];
        p.waveTrail.push({ x: p.x + (p.mini ? 10 : 20), y: p.y + (p.mini ? 10 : 20) });
        if (p.waveTrail.length > 200) p.waveTrail.shift();
    },

    /* ── Mode Change ── */
    onModeChange(p, engine) {
        // Reset rotation
        p.targetRotation = 0;
        p.rotation = 0;

        // Spawn mode-change particles
        const pSize = p.mini ? BLOCK_SIZE * 0.5 : BLOCK_SIZE;
        engine.spawnParticles(p.x + pSize / 2, p.y + pSize / 2, '#aa66ff', 12);
    },

    /* ── Render ── */
    render(p, ctx, engine) {
        const pSize = p.mini ? BLOCK_SIZE * 0.5 : BLOCK_SIZE;

        // Trail
        if (p.mode === 'wave' && p.waveTrail && p.waveTrail.length > 1) {
            ctx.beginPath();
            ctx.strokeStyle = '#ffcc00';
            ctx.lineWidth = p.mini ? 2 : 4;
            ctx.lineJoin = 'round';
            ctx.lineCap = 'round';
            ctx.moveTo(p.waveTrail[0].x, p.waveTrail[0].y);
            for (let i = 1; i < p.waveTrail.length; i++) {
                ctx.lineTo(p.waveTrail[i].x, p.waveTrail[i].y);
            }
            ctx.stroke();
        } else {
            for (const t of p.trail) {
                ctx.globalAlpha = t.life * 0.4;
                ctx.fillStyle = '#ffcc00';
                const s = pSize * 0.3 * t.life;
                ctx.fillRect(t.x - s / 2, t.y - s / 2, s, s);
            }
        }
        ctx.globalAlpha = 1;

        // Player sprite
        const sprite = this.processedSprites[p.mode];
        if (sprite && sprite !== 'loading') {
            ctx.save();
            ctx.translate(p.x + pSize / 2, p.y + pSize / 2);
            ctx.rotate(p.rotation * Math.PI / 180);

            // Gravity flip
            if (p.gravityDir === -1) ctx.scale(1, -1);

            const ratio = (sprite.width && sprite.height) ? (sprite.width / sprite.height) : 1;
            let sw = pSize * ratio;
            let sh = pSize;

            // For ship and wave, sometimes they might need slight scale adjust if they feel too small height-wise, 
            // but preserving ratio ensures no squashing.
            ctx.drawImage(sprite, -sw / 2, -sh / 2, sw, sh);
            ctx.restore();
        } else {
            // Trigger load if not already loading
            if (sprite !== 'loading') this.getProcessedSprite(p.mode);

            // Fallback while loading
            const colors = {
                cube: '#00ff88', ship: '#ff8800', ball: '#cc0000', ufo: '#aa00aa', wave: '#00aaff'
            };
            ctx.save();
            ctx.translate(p.x + pSize / 2, p.y + pSize / 2);
            ctx.rotate(p.rotation * Math.PI / 180);
            ctx.fillStyle = colors[p.mode] || '#00ff88';
            ctx.fillRect(-pSize / 2, -pSize / 2, pSize, pSize);
            ctx.restore();
        }
    }
};
