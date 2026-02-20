/* ── Geometry Dash Engine ─────────────────────────── */

const Engine = {
    canvas: null,
    ctx: null,
    width: 0,
    height: 0,

    /* Game state */
    state: 'menu', // menu | playing | paused | dead | complete
    level: null,
    player: null,
    camera: { x: 0, y: 0, shake: 0 },
    particles: [],
    attempts: 0,
    jumps: 0,
    startTime: 0,
    bestProgress: {},
    activeAnimations: [],
    groupModifications: {},

    /* Timing */
    lastTime: 0,
    dt: 0,
    accumulator: 0,
    fixedDt: 1000 / 60,

    /* Input */
    input: { pressed: false, justPressed: false, _down: false },

    /* Practice mode */
    practiceMode: false,
    checkpoints: [],
    lastCheckpointX: 0,

    /* Speed settings */
    speeds: {
        slow: 4.5,    // antes 3.6
        normal: 6.5,  // antes 5.4
        fast: 8.5,    // antes 7.0
        vfast: 10.0,  // antes 8.8
        vvfast: 12.0  // antes 10.6
    },

    currentSpeed: 'normal',

    /* Ground level (Y where ground starts, from top) */
    groundY: 0,
    ceilingY: 0,

    /* Grid row that represents the ground line.
       Objects at y = GROUND_ROW - 1 (i.e. 10) sit right on
       top of the ground, y = 9 is one block higher, etc. */
    GROUND_ROW: 11,

    /* ── Init ── */
    init(canvas) {
        this.canvas = canvas;
        this.ctx = canvas.getContext('2d');
        this.resize();
        window.addEventListener('resize', () => this.resize());

        // Input: mouse, touch, keyboard
        const onDown = () => { this.input._down = true; this.input.justPressed = true; };
        const onUp = () => { this.input._down = false; };

        window.addEventListener('mousedown', onDown);
        window.addEventListener('mouseup', onUp);
        window.addEventListener('touchstart', (e) => { e.preventDefault(); onDown(); }, { passive: false });
        window.addEventListener('touchend', onUp);
        window.addEventListener('keydown', (e) => {
            if (e.code === 'Space' || e.code === 'ArrowUp' || e.code === 'KeyW') { e.preventDefault(); onDown(); }
            // R = restart
            if (e.code === 'KeyR' && (this.state === 'playing' || this.state === 'dead')) {
                e.preventDefault();
                this.restart();
            }
        });
        window.addEventListener('keyup', (e) => { if (e.code === 'Space' || e.code === 'ArrowUp' || e.code === 'KeyW') onUp(); });

        preloadAllSprites();
    },

    resize() {
        const dpr = window.devicePixelRatio || 1;
        this.width = window.innerWidth;
        this.height = window.innerHeight;
        this.canvas.width = this.width * dpr;
        this.canvas.height = this.height * dpr;
        this.canvas.style.width = this.width + 'px';
        this.canvas.style.height = this.height + 'px';
        this.ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

        // Define logical space (always 10 blocks high)
        this.logicalHeight = 10 * BLOCK_SIZE;
        this.viewScale = this.height / this.logicalHeight;
        this.logicalWidth = this.width / this.viewScale;

        // Ground and ceiling in logical units
        this.groundY = 11 * BLOCK_SIZE; // Matches GROUND_ROW
        this.ceilingY = 2 * BLOCK_SIZE;
    },

    /* ── Load Level ── */
    loadLevel(levelData) {
        this.level = levelData;
        this.currentSpeed = levelData.speed || 'normal';
        this.state = 'playing';
        this.attempts++;
        this.jumps = 0;
        this.startTime = performance.now();
        this.particles = [];
        this.checkpoints = [];
        this.lastCheckpointX = 0;
        this.camera = { x: 0, y: 0, shake: 0 };
        this.activeAnimations = [];
        this.groupModifications = {};
        this.lastPortalY = undefined;

        // Reset triggered flags on ALL objects
        if (levelData.objects) {
            levelData.objects.forEach(obj => { delete obj._triggered; });
        }

        // Create player
        let startX = BLOCK_SIZE * 3;
        let startY = this.groundY - BLOCK_SIZE;

        // Check for StartPos object
        if (levelData.objects) {
            const startPosObj = levelData.objects.find(o => o.type === 'start_pos');
            if (startPosObj) {
                startX = startPosObj.x * BLOCK_SIZE;
                startY = (startPosObj.y !== undefined
                    ? this.groundY - (this.GROUND_ROW - startPosObj.y) * BLOCK_SIZE
                    : this.groundY - BLOCK_SIZE);
                // Adjust for bottom alignment
                const type = getObjectType('start_pos');
                const oh = (type.h || 1) * BLOCK_SIZE * (startPosObj.scale || 1);
                startY += BLOCK_SIZE - oh;
            }
        }

        this.player = Player.create(startX, startY);

        // Calculate level length for progress
        this.levelLength = 0;
        if (levelData.objects) {
            levelData.objects.forEach(o => {
                const endX = (o.x + (o.w || 1)) * BLOCK_SIZE;
                if (endX > this.levelLength) this.levelLength = endX;
            });
        }
        this.levelLength += this.width; // extra screen of space

        // Update HUD
        this.updateProgress(0);
        if (typeof UI !== 'undefined') UI.hideAll();

        // Music
        this.loadingMusic = true;
        const songToPlay = levelData.song || 'StereoMadness.mp3';
        if (typeof AudioManager !== 'undefined') {
            AudioManager.loadMusic('level_music', `music/${songToPlay}`);
            const bgAudio = AudioManager.sounds['level_music'];
            if (bgAudio) {
                if (bgAudio.readyState >= 3) {
                    this.loadingMusic = false;
                } else {
                    const onReady = () => {
                        bgAudio.removeEventListener('canplay', onReady);
                        this.loadingMusic = false;
                        if (this.state === 'playing') AudioManager.playMusic('level_music');
                    };
                    bgAudio.addEventListener('canplay', onReady);
                    // timeout fallback
                    setTimeout(() => {
                        if (this.loadingMusic) {
                            bgAudio.removeEventListener('canplay', onReady);
                            this.loadingMusic = false;
                            if (this.state === 'playing') AudioManager.playMusic('level_music');
                        }
                    }, 2000);
                }
            } else {
                this.loadingMusic = false;
            }
        } else {
            this.loadingMusic = false;
        }
    },

    /* ── Restart ── */
    restart() {
        if (this.level) {
            if (this.practiceMode && this.checkpoints.length > 0) {
                const cp = this.checkpoints[this.checkpoints.length - 1];
                this.player = Player.create(cp.x, cp.y);
                this.player.mode = cp.mode;
                this.player.gravityDir = cp.gravityDir;
                this.player.mini = cp.mini;
                this.currentSpeed = cp.speed;
                this.state = 'playing';
                this.camera.shake = 0;
                this.particles = [];
                if (typeof UI !== 'undefined') UI.hideAll();

                if (typeof AudioManager !== 'undefined') {
                    // Start music roughly from checkpoint position (naive sync)
                    const musicFile = this.level.song || 'StereoMadness.mp3';
                    AudioManager.loadMusic('level_music', `music/${musicFile}`);
                    setTimeout(() => {
                        if (this.state === 'playing') {
                            AudioManager.playMusic('level_music');
                            if (AudioManager.music) {
                                // Calculate time based on X offset and avg speed. (Rough approx for practice mode)
                                const avgSpeed = this.speeds[this.currentSpeed] * 60; // blocks per second approx
                                AudioManager.music.currentTime = Math.max((cp.x / avgSpeed), 0);
                            }
                        }
                    }, 100);
                }
            } else {
                this.loadLevel(this.level);
            }
        }
    },

    /* ── Main Loop ── */
    start() {
        if (!this.loadingMusic && typeof AudioManager !== 'undefined') {
            AudioManager.playMusic('level_music');
        } else if (this.loadingMusic && this.state === 'playing') {
            // it will play once the event listener resolves in `loadLevel`
        }
        this.lastTime = performance.now();
        this.loop(this.lastTime);
    },

    loop(now) {
        requestAnimationFrame(t => this.loop(t));

        this.dt = Math.min(now - this.lastTime, 50);
        this.lastTime = now;

        if (this.state === 'playing') {
            this.accumulator += this.dt;
            while (this.accumulator >= this.fixedDt) {
                this.fixedUpdate();
                this.accumulator -= this.fixedDt;
            }
        }

        this.render();

        // Reset justPressed
        this.input.justPressed = false;
        this.input.pressed = this.input._down;
    },

    /* ── Physics Tick ── */
    fixedUpdate() {
        const p = this.player;
        if (!p || this.state !== 'playing') return;

        const speed = this.speeds[this.currentSpeed];

        // Move player forward
        p.x += speed;

        // Update player physics based on mode
        Player.update(p, this);

        // Camera follow
        this.camera.x = p.x - this.logicalWidth * 0.35;

        // Vertical camera logic
        const targetCamYCube = this.groundY - this.logicalHeight * 0.8;
        if (p.mode === 'ship' || p.mode === 'ufo' || p.mode === 'wave') {
            let targetCamY = p.y - this.logicalHeight * 0.5;

            // If not free fly, lock camera to a fixed offset relative to ground
            if (!p.freeFly) {
                targetCamY = (this.lastPortalY !== undefined) ? (this.lastPortalY - this.logicalHeight * 0.5) : targetCamYCube;
            } else {
                // Clamp targetCamY so the camera doesn't show far below the ground
                const groundLimit = this.groundY - this.logicalHeight * 0.8;
                if (targetCamY > groundLimit) targetCamY = groundLimit;
            }

            this.camera.y += (targetCamY - this.camera.y) * 0.1;
        } else {
            // Cube/Ball/Robot/Spider:
            // Smoother Y follow: Center on player but pull towards ground
            let targetCamY = p.y - this.logicalHeight * 0.6;

            // Pull towards ground-relative height (targetCamYCube) when closer to it
            const groundInfluence = 0.5;
            targetCamY = (targetCamY * (1 - groundInfluence)) + (targetCamYCube * groundInfluence);

            // Clamp so we don't see below ground level
            const groundLimit = this.groundY - this.logicalHeight * 0.8;
            if (targetCamY > groundLimit) targetCamY = groundLimit;

            // Smoother interpolation (0.06 instead of 0.1)
            this.camera.y += (targetCamY - this.camera.y) * 0.06;
        }

        // Camera shake decay
        if (this.camera.shake > 0) this.camera.shake *= 0.5;  // fast decay (~0.1s)

        // Collision detection
        this.checkCollisions();

        // Ground / ceiling
        this.checkBoundaries();

        // Progress
        const progress = Math.min(p.x / this.levelLength, 1);
        this.updateProgress(progress);

        // Level complete
        if (progress >= 0.98) {
            this.completeLevel();
        }

        // Update particles
        this.updateParticles();

        // Practice checkpoint
        if (this.practiceMode) {
            if (p.x - this.lastCheckpointX > BLOCK_SIZE * 20) {
                this.checkpoints.push({
                    x: p.x, y: p.y,
                    mode: p.mode,
                    gravityDir: p.gravityDir,
                    mini: p.mini,
                    speed: this.currentSpeed
                });
                this.lastCheckpointX = p.x;
            }
        }

        // Update animations
        this.updateAnimations();
    },

    activateTrigger(obj) {
        if (obj._triggered) return;
        obj._triggered = true;

        const type = getObjectType(obj.type);
        const targetID = obj.targetGroupID || 0;
        if (targetID === 0 && type.triggerType !== 'color') return; // 0 usually means no group

        const now = performance.now();

        if (type.triggerType === 'move') {
            const duration = (obj.moveDuration || 0.5) * 1000;
            this.activeAnimations.push({
                type: 'move',
                groupID: targetID,
                startTime: now,
                endTime: now + duration,
                startX: this.groupModifications[targetID]?.x || 0,
                startY: this.groupModifications[targetID]?.y || 0,
                targetX: (this.groupModifications[targetID]?.x || 0) + (obj.moveX || 0) * BLOCK_SIZE,
                targetY: (this.groupModifications[targetID]?.y || 0) + (obj.moveY || 0) * BLOCK_SIZE
            });
        } else if (type.triggerType === 'color') {
            const duration = (obj.fadeTime || 0.5) * 1000;
            let startColor = '#ffffff';
            if (targetID === 0) startColor = this.level.bgColor || '#000000';
            else if (targetID === 999) startColor = this.level.groundColor || '#000000';
            else if (this.groupModifications[targetID]?.color) startColor = this.groupModifications[targetID].color;

            this.activeAnimations.push({
                type: 'color',
                groupID: targetID,
                startTime: now,
                endTime: now + duration,
                startColor: startColor,
                targetColor: obj.color || '#ffffff'
            });
        } else if (type.triggerType === 'alpha') {
            const duration = (obj.fadeTime || 0.5) * 1000;
            this.activeAnimations.push({
                type: 'alpha',
                groupID: targetID,
                startTime: now,
                endTime: now + duration,
                startAlpha: this.groupModifications[targetID]?.alpha !== undefined ? this.groupModifications[targetID].alpha : 1,
                targetAlpha: obj.opacity !== undefined ? obj.opacity : 1
            });
        }
    },

    updateAnimations() {
        const now = performance.now();

        // Reset base modifications for groups that have objects but no active animations? 
        // No, modifications should persist.

        for (let i = this.activeAnimations.length - 1; i >= 0; i--) {
            const anim = this.activeAnimations[i];
            const progress = Math.min(1, (now - anim.startTime) / (anim.endTime - anim.startTime));

            if (!this.groupModifications[anim.groupID]) {
                this.groupModifications[anim.groupID] = { x: 0, y: 0, alpha: 1, color: null };
            }
            const mod = this.groupModifications[anim.groupID];

            if (anim.type === 'move') {
                mod.x = anim.startX + (anim.targetX - anim.startX) * progress;
                mod.y = anim.startY + (anim.targetY - anim.startY) * progress;
            } else if (anim.type === 'alpha') {
                mod.alpha = anim.startAlpha + (anim.targetAlpha - anim.startAlpha) * progress;
            } else if (anim.type === 'color') {
                const c = this.lerpColor(anim.startColor, anim.targetColor, progress);
                if (anim.groupID === 0) {
                    this.level.bgColor = c;
                } else if (anim.groupID === 999) {
                    this.level.groundColor = c;
                } else {
                    mod.color = c;
                }
            }

            if (progress >= 1) {
                this.activeAnimations.splice(i, 1);
            }
        }
    },

    lerpColor(a, b, amount) {
        const ah = parseInt(a.replace(/#/g, ''), 16),
            ar = ah >> 16, ag = ah >> 8 & 0xff, ab = ah & 0xff,
            bh = parseInt(b.replace(/#/g, ''), 16),
            br = bh >> 16, bg = bh >> 8 & 0xff, bb = bh & 0xff,
            rr = ar + amount * (br - ar),
            rg = ag + amount * (bg - ag),
            rb = ab + amount * (bb - ab);

        return '#' + ((1 << 24) + (rr << 16) + (rg << 8) + rb | 0).toString(16).slice(1);
    },

    /* ── Collision ── */
    checkCollisions() {
        const p = Engine.player;
        if (!this.level || !this.level.objects) return;

        const pSize = p.mini ? BLOCK_SIZE * 0.5 : BLOCK_SIZE;
        const px = p.x;
        const py = p.y;
        const pRight = px + pSize;
        const pBottom = py + pSize;

        // Check nearby objects only
        const startCol = Math.floor((px - BLOCK_SIZE) / BLOCK_SIZE);
        const endCol = Math.ceil(pRight / BLOCK_SIZE) + 1;

        for (const obj of this.level.objects) {
            if (obj.x < startCol - 2 || obj.x > endCol + 2) continue;

            const type = getObjectType(obj.type);
            if (!type) continue;

            let ox = obj.x * BLOCK_SIZE;
            let oy = (obj.y !== undefined
                ? this.groundY - (this.GROUND_ROW - obj.y) * BLOCK_SIZE
                : this.groundY - BLOCK_SIZE);

            // Apply Group Modifications (for moving blocks hitbox)
            if (obj.groupID && this.groupModifications[obj.groupID]) {
                const mod = this.groupModifications[obj.groupID];
                ox += mod.x || 0;
                oy += mod.y || 0;
            }

            const scale = obj.scale || 1;
            const ow = (type.w || 1) * BLOCK_SIZE * scale;
            const oh = (type.h || 1) * BLOCK_SIZE * scale;
            oy += BLOCK_SIZE - oh;

            // AABB overlap check — default hitbox covers full object bounds
            let hb = type.hitbox || { x: 0, y: 0, w: type.w || 1, h: type.h || 1 };

            // Hitbox scaled relative to object origin
            const hx = ox + hb.x * BLOCK_SIZE * scale;
            const hy = oy + hb.y * BLOCK_SIZE * scale;
            const hw = hb.w * BLOCK_SIZE * scale;
            const hh = hb.h * BLOCK_SIZE * scale;

            if (px + pSize <= hx || px >= hx + hw || py + pSize <= hy || py >= hy + hh) continue;

            // ── Lethal
            if (type.lethal) {
                this.die();
                return;
            }

            // ── Solid
            if (type.solid) {
                this.resolveSolid(p, px, py, pSize, ox, oy, ow, oh);
                continue;
            }

            // ── Slope
            if (type.isSlope) {
                // Right-triangle ramp: left side is flat, right side is top
                const relX = (px + pSize / 2) - ox;  // player center relative to slope left
                const frac = Math.max(0, Math.min(1, relX / ow));
                const slopeY = oy + oh - frac * oh;   // surface Y at player's X
                if (py + pSize > slopeY && py + pSize < oy + oh + pSize * 0.5) {
                    p.y = slopeY - pSize;
                    if (p.vy > 0) p.vy = 0;
                    p.onGround = true;
                    p.canJump = true;
                }
                continue;
            }

            // ── Portals (only trigger once)
            // ── Portals (consolidated)
            if (type.category === 'portal') {
                if (obj._triggered) continue;
                obj._triggered = true;

                if (type.portalMode) {
                    Engine.changeMode(type.portalMode);
                    // Update freeFly from portal object property on the player
                    p.freeFly = !!obj.freeFly;
                    if (!p.freeFly) {
                        Engine.lastPortalY = oy;
                    }
                }
                if (type.portalGravity) Engine.flipGravity();
                if (type.portalSpeed) Engine.changeSpeed(type.portalSpeed);
                if (type.portalSize) Engine.changeSize(type.portalSize);

                AudioManager.play('portal');
                continue;
            }

            // ── Pads (automatic)
            if (type.padForce !== undefined && !obj._triggered) {
                obj._triggered = true;
                p.vy = type.padForce * p.gravityDir;
                p.onGround = false;
                if (type.flipGravity) p.gravityDir *= -1;
                continue;
            }

            // ── Orbs (require tap)
            if (type.orbForce !== undefined && !obj._triggered && this.input.justPressed) {
                obj._triggered = true;
                if (type.negateVelocity) {
                    p.vy = -p.vy;
                } else if (type.toggleGravity) {
                    // Green orb logic: flip gravity AND apply a jump force to compensate
                    p.gravityDir *= -1;
                    p.vy = type.orbForce * p.gravityDir;
                } else {
                    p.vy = type.orbForce * p.gravityDir;
                }

                if (type.flipGravity) p.gravityDir *= -1;
                p.onGround = false;
                AudioManager.play('orb');
                // Glow particle
                this.spawnParticles(px + pSize / 2, py + pSize / 2, type.orbGlow || '#fff', 8);
                continue;
            }

            // ── Triggers
            if (type.category === 'trigger') {
                if (obj.touchTriggered) {
                    this.activateTrigger(obj);
                }
                continue;
            }
        }

        // ── Non-Touch Triggers ──
        // Check ALL triggers in the level (or a optimized subset) to see if player passed them
        for (const obj of this.level.objects) {
            const type = getObjectType(obj.type);
            if (!type || type.category !== 'trigger' || obj.touchTriggered) continue;
            if (obj._triggered) continue;

            const ox = obj.x * BLOCK_SIZE;
            if (px >= ox) {
                this.activateTrigger(obj);
            }
        }
    },

    /* Resolve solid collision */
    resolveSolid(p, px, py, pSize, ox, oy, ow, oh) {
        const overlapLeft = (px + pSize) - ox;
        const overlapRight = (ox + ow) - px;
        const overlapTop = (py + pSize) - oy;
        const overlapBottom = (oy + oh) - py;

        const minOverlap = Math.min(overlapLeft, overlapRight, overlapTop, overlapBottom);

        if (minOverlap === overlapTop && p.vy >= 0 && p.gravityDir === 1) {
            // Landing on top
            p.y = oy - pSize;
            p.vy = 0;
            p.onGround = true;
            p.canJump = true;
        } else if (minOverlap === overlapBottom && p.vy <= 0 && p.gravityDir === -1) {
            // Upside-down landing
            p.y = oy + oh;
            p.vy = 0;
            p.onGround = true;
            p.canJump = true;
        } else if (minOverlap === overlapBottom && p.gravityDir === 1) {
            // Hit ceiling
            p.y = oy + oh;
            p.vy = Math.max(0, p.vy); // Stop upward movement
        } else if (minOverlap === overlapTop && p.gravityDir === -1) {
            // Hit floor (upside-down)
            p.y = oy - pSize;
            p.vy = Math.min(0, p.vy); // Stop downward movement (which is upward for inverted)
        } else if (minOverlap === overlapLeft || minOverlap === overlapRight) {
            // Side collision (Wall)
            // Forgiveness: if top of player is very close to top of block, slide up instead of dying
            const verticalForgiveness = 12;
            if (p.gravityDir === 1 && overlapTop < verticalForgiveness) {
                p.y = oy - pSize;
                p.vy = 0;
                p.onGround = true;
                p.canJump = true;
            } else if (p.gravityDir === -1 && overlapBottom < verticalForgiveness) {
                p.y = oy + oh;
                p.vy = 0;
                p.onGround = true;
                p.canJump = true;
            } else {
                this.die();
            }
        }
    },

    /* ── Boundaries ── */
    checkBoundaries() {
        const p = this.player;
        const pSize = p.mini ? BLOCK_SIZE * 0.5 : BLOCK_SIZE;

        if (p.gravityDir === 1) {
            // Normal gravity
            if (p.y + pSize >= this.groundY) {
                p.y = this.groundY - pSize;
                p.vy = 0;
                p.onGround = true;
                p.canJump = true;
            }
            if (p.y <= this.ceilingY && !p.freeFly) {
                p.y = this.ceilingY;
                p.vy = 0;
            }
        } else {
            // Reversed gravity
            if (p.y <= this.ceilingY && !p.freeFly) {
                p.y = this.ceilingY;
                p.vy = 0;
                p.onGround = true;
                p.canJump = true;
            }
            if (p.y + pSize >= this.groundY) {
                p.y = this.groundY - pSize;
                p.vy = 0;
            }
        }

        // Fell off screen
        const hitCeilingOffscreen = p.y < -BLOCK_SIZE * 20;
        const hitBottomOffscreen = p.y > this.groundY + BLOCK_SIZE * 5;

        // Wave mode dies if hitting ground/ceiling
        if (p.mode === 'wave' && (p.onGround || p.y <= this.ceilingY)) {
            this.die();
            return;
        }

        if (hitBottomOffscreen || (hitCeilingOffscreen && !p.freeFly)) {
            this.die();
        }
    },

    /* ── Portal Effects ── */
    changeMode(mode) {
        if (this.player && (mode === 'cube' || mode === 'ship' || mode === 'ball' || mode === 'ufo' || mode === 'wave' || mode === 'robot' || mode === 'spider')) {
            this.player.mode = mode;
        }
    },

    changeSpeed(speed) {
        if (speed === 'slow' || speed === 'normal' || speed === 'fast' || speed === 'vfast' || speed === 'vvfast') {
            this.currentSpeed = speed;
        }
    },

    changeSize(size) {
        if (this.player) {
            if (size === 'mini') {
                this.player.mini = true;
            } else if (size === 'normal') {
                this.player.mini = false;
            }
        }
    },

    flipGravity() {
        if (this.player) {
            this.player.gravityDir *= -1;
        }
    },

    /* ── Death ── */
    die() {
        if (this.state !== 'playing') return;
        this.state = 'dead';
        this.camera.shake = 8;

        // Save Progress on Death
        const levelId = this.level?.id || 'custom';
        const progress = Math.floor(Math.min((this.player.x / this.levelLength) * 100, 100)) || 0;

        if (this.practiceMode) {
            const bestPractice = JSON.parse(localStorage.getItem('gd_best_practice_progress') || '{}');
            const prev = bestPractice[levelId] || 0;
            if (progress > prev) {
                bestPractice[levelId] = progress;
                try {
                    localStorage.setItem('gd_best_practice_progress', JSON.stringify(bestPractice));
                } catch (e) { }
            }
        } else {
            const best = JSON.parse(localStorage.getItem('gd_best_progress') || '{}');
            const prev = best[levelId] || 0;
            if (progress > prev) {
                best[levelId] = progress;
                try {
                    localStorage.setItem('gd_best_progress', JSON.stringify(best));
                } catch (e) { }
            }
        }

        // Death particles
        const pSize = this.player.mini ? BLOCK_SIZE * 0.5 : BLOCK_SIZE;
        this.spawnParticles(
            this.player.x + pSize / 2,
            this.player.y + pSize / 2,
            '#ff4444', 20
        );

        AudioManager.play('death');
        if (typeof AudioManager !== 'undefined') AudioManager.stopMusic();

        // Auto-retry after brief shake (0.1s)
        setTimeout(() => {
            this.restart();
        }, 100);
    },

    /* ── Level Complete ── */
    completeLevel() {
        if (this.state !== 'playing') return;
        this.state = 'complete';

        const elapsed = ((performance.now() - this.startTime) / 1000).toFixed(1);
        const levelId = this.level?.id || 'custom';
        let isNewBest = false;

        if (this.practiceMode) {
            const bestPractice = JSON.parse(localStorage.getItem('gd_best_practice_progress') || '{}');
            const prev = bestPractice[levelId] || 0;
            isNewBest = prev < 100;
            bestPractice[levelId] = 100;
            try {
                localStorage.setItem('gd_best_practice_progress', JSON.stringify(bestPractice));
            } catch (e) { }
        } else {
            const best = JSON.parse(localStorage.getItem('gd_best_progress') || '{}');
            const prev = best[levelId] || 0;
            isNewBest = prev < 100;
            best[levelId] = 100;
            try {
                localStorage.setItem('gd_best_progress', JSON.stringify(best));
            } catch (e) { }
        }

        AudioManager.play('complete');

        // Custom hook for cloud rewards
        window.dispatchEvent(new CustomEvent('levelComplete', {
            detail: { level: this.level, currentCloudLevel: this.currentCloudLevel }
        }));

        setTimeout(() => {
            if (typeof UI !== 'undefined') UI.showComplete({
                attempts: this.attempts,
                jumps: this.jumps,
                time: elapsed,
                newBest: isNewBest,
                level: this.currentCloudLevel || this.level,
                starsAwarded: this.starsAwarded
            });
        }, 1000); // give it a bit more time for the cloud event to finish
    },

    /* ── Particles ── */
    spawnParticles(x, y, color, count) {
        for (let i = 0; i < count; i++) {
            this.particles.push({
                x, y,
                vx: (Math.random() - 0.5) * 8,
                vy: (Math.random() - 0.5) * 8,
                life: 1,
                decay: 0.02 + Math.random() * 0.03,
                size: 2 + Math.random() * 4,
                color
            });
        }
    },

    updateParticles() {
        for (let i = this.particles.length - 1; i >= 0; i--) {
            const pt = this.particles[i];
            pt.x += pt.vx;
            pt.y += pt.vy;
            pt.life -= pt.decay;
            if (pt.life <= 0) this.particles.splice(i, 1);
        }
    },

    /* ── Progress Bar ── */
    updateProgress(progress) {
        const pct = Math.floor(progress * 100);
        const fill = document.getElementById('progress-bar-fill');
        const text = document.getElementById('progress-text');
        if (fill) fill.style.width = pct + '%';
        if (text) text.textContent = pct + '%';
    },

    /* ── Render ── */
    render() {
        const ctx = this.ctx;
        const W = this.width;
        const H = this.height;

        ctx.clearRect(0, 0, W, H);

        // Camera shake offset
        const shakeX = this.camera.shake * (Math.random() - 0.5) * 2;
        const shakeY = this.camera.shake * (Math.random() - 0.5) * 2;

        // Apply View Scaling (Zoom Invariant)
        this.viewScale = this.height / this.logicalHeight;
        this.logicalWidth = this.width / this.viewScale;

        ctx.save();
        ctx.scale(this.viewScale, this.viewScale);
        ctx.translate(-this.camera.x + shakeX, -this.camera.y + shakeY);

        if (this.state !== 'menu') {
            this.renderBackground(ctx);
            this.renderGround(ctx);
            this.renderObjects(ctx);
            this.renderParticlesWorld(ctx);
            if (this.player && this.state !== 'dead') {
                Player.render(this.player, ctx, this);
            }
        }

        ctx.restore();
    },

    /* ── Background ── */
    renderBackground(ctx) {
        const camX = this.camera.x;
        const bgSprite = SpriteCache.get('sprites/ui/game_bg_01_001-hd.png');
        const viewW = this.logicalWidth;
        const viewH = this.logicalHeight;

        const bgColor = this.level?.bgColor || '#0033aa';
        ctx.fillStyle = bgColor;
        ctx.fillRect(camX, this.camera.y, viewW, viewH);

        if (bgSprite) {
            // Scale background to match logical height while maintaining aspect ratio
            const spriteH = bgSprite.height || 512;
            const spriteW = bgSprite.width || 512;
            const drawH = viewH;
            const drawW = (spriteW / spriteH) * drawH;

            const parallax = camX * 0.2;
            const startX = Math.floor(parallax / drawW) * drawW;
            const endX = camX + viewW + drawW;

            for (let x = startX - drawW; x < endX; x += drawW) {
                ctx.globalAlpha = 0.3;
                ctx.drawImage(bgSprite, x, this.camera.y, drawW, drawH);
                ctx.globalAlpha = 1;
            }
        }
    },

    /* ── Ground ── */
    renderGround(ctx) {
        const camX = this.camera.x;
        const viewW = this.logicalWidth;
        const viewH = this.logicalHeight;
        const groundSprite = SpriteCache.get('sprites/ui/ground.png');
        const startX = Math.floor(camX / BLOCK_SIZE) * BLOCK_SIZE;
        const endX = camX + viewW + BLOCK_SIZE;

        ctx.fillStyle = this.level?.groundColor || '#1a0a3e';
        ctx.fillRect(startX, this.groundY, endX - startX, viewH + 400);

        // Ground texture tiles
        for (let x = startX; x < endX; x += BLOCK_SIZE) {
            if (groundSprite) {
                ctx.drawImage(groundSprite, x, this.groundY, BLOCK_SIZE, BLOCK_SIZE);
            } else {
                ctx.fillStyle = '#2a1870';
                ctx.fillRect(x, this.groundY, BLOCK_SIZE - 1, BLOCK_SIZE);
            }
        }

        // Ground line
        ctx.strokeStyle = '#fff';
        ctx.lineWidth = 2;
        ctx.globalAlpha = 0.3;
        ctx.beginPath();
        ctx.moveTo(startX, this.groundY);
        ctx.lineTo(endX, this.groundY);
        ctx.stroke();
        ctx.globalAlpha = 1;

        // Ceiling line
        ctx.strokeStyle = '#fff';
        ctx.globalAlpha = 0.15;
        ctx.beginPath();
        ctx.moveTo(startX, this.ceilingY);
        ctx.lineTo(endX, this.ceilingY);
        ctx.stroke();
        ctx.globalAlpha = 1;
    },

    /* ── Objects ── */
    renderObjects(ctx) {
        if (!this.level || !this.level.objects) return;

        const camX = this.camera.x;
        const viewW = this.width / this.viewScale;
        const viewLeft = camX - BLOCK_SIZE * 2;
        const viewRight = camX + viewW + BLOCK_SIZE * 2;

        for (const obj of this.level.objects) {
            const type = getObjectType(obj.type);
            if (!type) continue;

            const ox = obj.x * BLOCK_SIZE;
            if (ox < viewLeft || ox > viewRight) continue;

            let oy = (obj.y !== undefined
                ? this.groundY - (this.GROUND_ROW - obj.y) * BLOCK_SIZE
                : this.groundY - BLOCK_SIZE);
            const scale = obj.scale || 1;
            const ow = (type.w || 1) * BLOCK_SIZE * scale;
            const oh = (type.h || 1) * BLOCK_SIZE * scale;
            oy += BLOCK_SIZE - oh;

            // Apply Group Modifications
            let tx = 0;
            let ty = 0;
            let alpha = 1;
            if (obj.groupID && this.groupModifications[obj.groupID]) {
                const mod = this.groupModifications[obj.groupID];
                tx = mod.x || 0;
                ty = mod.y || 0;
                alpha = mod.alpha !== undefined ? mod.alpha : 1;
            }

            const sprite = SpriteCache.get(type.sprite);

            ctx.save();
            ctx.globalAlpha = alpha;
            ctx.translate(tx, ty);

            // Rotation for sawblades only
            if (type.rotates) {
                const cx = ox + ow / 2;
                const cy = oy + oh / 2;
                ctx.translate(cx, cy);
                ctx.rotate(performance.now() / 300);
                ctx.translate(-cx, -cy);
            }

            // Object rotation from editor
            if (obj.rotation) {
                const cx = ox + ow / 2;
                const cy = oy + oh / 2;
                ctx.translate(cx, cy);
                ctx.rotate(obj.rotation * Math.PI / 180);
                ctx.translate(-cx, -cy);
            }

            let drawX = ox;
            let drawY = oy;
            let drawW = ow;
            let drawH = oh;

            if (sprite) {
                // Fix portal squashing
                if (type.category === 'portal' && sprite.width && sprite.height) {
                    const ratio = sprite.width / sprite.height;
                    drawW = drawH * ratio;
                    drawX = ox + (ow - drawW) / 2;
                }
                ctx.drawImage(sprite, drawX, drawY, drawW, drawH);
            } else {
                // Fallback colored rect
                ctx.fillStyle = this.getFallbackColor(type);
                ctx.fillRect(ox, oy, ow, oh);

                // Label
                ctx.fillStyle = '#fff';
                ctx.font = '9px monospace';
                ctx.textAlign = 'center';
                ctx.fillText(type.id.substring(0, 6), ox + ow / 2, oy + oh / 2 + 3);
            }

            // Orb glow
            if (type.orbGlow) {
                ctx.globalAlpha = 0.15 + Math.sin(performance.now() / 200) * 0.1;
                ctx.fillStyle = type.orbGlow;
                ctx.beginPath();
                ctx.arc(ox + ow / 2, oy + oh / 2, ow * 0.7, 0, Math.PI * 2);
                ctx.fill();
                ctx.globalAlpha = 1;
            }

            ctx.restore();
        }
    },

    getFallbackColor(type) {
        const colors = {
            solid: '#555577',
            hazard: '#cc3333',
            portal: '#8833ff',
            interactive: '#ffaa00',
            trigger: '#00ff88',
            deco: '#336699'
        };
        return colors[type.category] || '#666';
    },

    /* ── Particles (world space) ── */
    renderParticlesWorld(ctx) {
        for (const pt of this.particles) {
            ctx.globalAlpha = pt.life;
            ctx.fillStyle = pt.color;
            ctx.fillRect(pt.x - pt.size / 2, pt.y - pt.size / 2, pt.size, pt.size);
        }
        ctx.globalAlpha = 1;
    }
};
