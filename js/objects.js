/* ── Game Objects ─────────────────────────────────── */

const BLOCK_SIZE = 40;

/* Object type registry */
const ObjectTypes = {
    // ── Solid ──
    BLOCK: { id: 'block', category: 'solid', sprite: 'sprites/blocks/block.png', solid: true, lethal: false, w: 1, h: 1 },
    HALF_BLOCK: { id: 'half_block', category: 'solid', sprite: 'sprites/blocks/half_block.png', solid: true, lethal: false, w: 1, h: 0.5 },
    SLOPE: { id: 'slope', category: 'solid', sprite: 'sprites/blocks/slope.png', solid: false, lethal: false, w: 1, h: 1, isSlope: true },

    // ── Hazards ──
    SPIKE: { id: 'spike', category: 'hazard', sprite: 'sprites/hazards/spike.png', solid: false, lethal: true, w: 1, h: 1, hitbox: { x: 0.15, y: 0.3, w: 0.7, h: 0.7 } },
    SPIKE_UP: { id: 'spike_up', category: 'hazard', sprite: 'sprites/hazards/spike_up.png', solid: false, lethal: true, w: 1, h: 1, hitbox: { x: 0.15, y: 0, w: 0.7, h: 0.7 } },
    SAWBLADE: { id: 'sawblade', category: 'hazard', sprite: 'sprites/hazards/sawblade.png', solid: false, lethal: true, w: 2, h: 2, hitbox: { x: 0.1, y: 0.1, w: 0.8, h: 0.8 }, rotates: true },

    // ── Portals (game mode) ──
    PORTAL_CUBE: { id: 'portal_cube', category: 'portal', sprite: 'sprites/portals/portal_cube.png', solid: false, lethal: false, w: 1, h: 3, portalMode: 'cube' },
    PORTAL_SHIP: { id: 'portal_ship', category: 'portal', sprite: 'sprites/portals/portal_ship.png', solid: false, lethal: false, w: 1, h: 3, portalMode: 'ship' },
    PORTAL_BALL: { id: 'portal_ball', category: 'portal', sprite: 'sprites/portals/portal_ball.png', solid: false, lethal: false, w: 1, h: 3, portalMode: 'ball' },
    PORTAL_UFO: { id: 'portal_ufo', category: 'portal', sprite: 'sprites/portals/portal_ufo.png', solid: false, lethal: false, w: 1, h: 3, portalMode: 'ufo' },
    PORTAL_WAVE: { id: 'portal_wave', category: 'portal', sprite: 'sprites/portals/portal_wave.png', solid: false, lethal: false, w: 1, h: 3, portalMode: 'wave' },
    PORTAL_ROBOT: { id: 'portal_robot', category: 'portal', sprite: 'sprites/portals/portal_robot.png', solid: false, lethal: false, w: 1, h: 3, portalMode: 'robot' },
    PORTAL_SPIDER: { id: 'portal_spider', category: 'portal', sprite: 'sprites/portals/portal_spider.png', solid: false, lethal: false, w: 1, h: 3, portalMode: 'spider' },

    // ── Portals (gravity) ──
    PORTAL_GRAVITY: { id: 'portal_gravity', category: 'portal', sprite: 'sprites/portals/portal_gravity.png', solid: false, lethal: false, w: 1, h: 3, portalGravity: 'flip' },

    // ── Portals (speed) ──
    PORTAL_SPEED_SLOW: { id: 'portal_speed_slow', category: 'portal', sprite: 'sprites/portals/portal_speed_slow.png', solid: false, lethal: false, w: 1, h: 2, portalSpeed: 'slow' },
    PORTAL_SPEED_NORMAL: { id: 'portal_speed_normal', category: 'portal', sprite: 'sprites/portals/portal_speed_normal.png', solid: false, lethal: false, w: 1, h: 2, portalSpeed: 'normal' },
    PORTAL_SPEED_FAST: { id: 'portal_speed_fast', category: 'portal', sprite: 'sprites/portals/portal_speed_fast.png', solid: false, lethal: false, w: 1, h: 2, portalSpeed: 'fast' },
    PORTAL_SPEED_VFAST: { id: 'portal_speed_vfast', category: 'portal', sprite: 'sprites/portals/portal_speed_vfast.png', solid: false, lethal: false, w: 1, h: 2, portalSpeed: 'vfast' },
    PORTAL_SPEED_VVFAST: { id: 'portal_speed_vvfast', category: 'portal', sprite: 'sprites/portals/portal_speed_vvfast.png', solid: false, lethal: false, w: 1, h: 2, portalSpeed: 'vvfast' },

    // ── Portals (size) ──
    PORTAL_SIZE_MINI: { id: 'portal_size_mini', category: 'portal', sprite: 'sprites/portals/portal_size_mini.png', solid: false, lethal: false, w: 1, h: 2, portalSize: 'mini' },
    PORTAL_SIZE_NORMAL: { id: 'portal_size_normal', category: 'portal', sprite: 'sprites/portals/portal_size_normal.png', solid: false, lethal: false, w: 1, h: 2, portalSize: 'normal' },

    // ── Pads ──
    PAD_YELLOW: { id: 'pad_yellow', category: 'interactive', sprite: 'sprites/interactive/pad_yellow.png', solid: false, lethal: false, w: 1, h: 0.5, padForce: -14 },
    PAD_PINK: { id: 'pad_pink', category: 'interactive', sprite: 'sprites/interactive/pad_pink.png', solid: false, lethal: false, w: 1, h: 0.5, padForce: -16 },
    PAD_RED: { id: 'pad_red', category: 'interactive', sprite: 'sprites/interactive/pad_red.png', solid: false, lethal: false, w: 1, h: 0.5, padForce: -18 },
    PAD_BLUE: { id: 'pad_blue', category: 'interactive', sprite: 'sprites/interactive/pad_blue.png', solid: false, lethal: false, w: 1, h: 0.5, padForce: -10, flipGravity: true },

    // ── Orbs ──
    ORB_YELLOW: { id: 'orb_yellow', category: 'interactive', sprite: 'sprites/interactive/orb_yellow.png', solid: false, lethal: false, w: 1, h: 1, orbForce: -12, orbGlow: '#ffff00' },
    ORB_PINK: { id: 'orb_pink', category: 'interactive', sprite: 'sprites/interactive/orb_pink.png', solid: false, lethal: false, w: 1, h: 1, orbForce: -14, orbGlow: '#ff66cc' },
    ORB_RED: { id: 'orb_red', category: 'interactive', sprite: 'sprites/interactive/orb_red.png', solid: false, lethal: false, w: 1, h: 1, orbForce: -16, orbGlow: '#ff3333' },
    ORB_BLUE: { id: 'orb_blue', category: 'interactive', sprite: 'sprites/interactive/orb_blue.png', solid: false, lethal: false, w: 1, h: 1, orbForce: -8, flipGravity: true, orbGlow: '#3388ff' },
    ORB_GREEN: { id: 'orb_green', category: 'interactive', sprite: 'sprites/interactive/orb_green.png', solid: false, lethal: false, w: 1, h: 1, orbForce: -12, orbGlow: '#33ff88', toggleGravity: true },
    ORB_BLACK: { id: 'orb_black', category: 'interactive', sprite: 'sprites/interactive/orb_black.png', solid: false, lethal: false, w: 1, h: 1, orbForce: 0, orbGlow: '#333333', negateVelocity: true },

    // ── Decoration ──
    GLOW_BLOCK: { id: 'glow_block', category: 'deco', sprite: 'sprites/blocks/glow_block.png', solid: false, lethal: false, w: 1, h: 1 },

    // ── Triggers ──
    TRIGGER_MOVE: { id: 'trigger_move', category: 'trigger', sprite: 'sprites/triggers/movetrigger.png', solid: false, lethal: false, w: 1, h: 1, triggerType: 'move' },
    TRIGGER_COLOR: { id: 'trigger_color', category: 'trigger', sprite: 'sprites/triggers/colortrigger.png', solid: false, lethal: false, w: 1, h: 1, triggerType: 'color' },
    TRIGGER_ALPHA: { id: 'trigger_alpha', category: 'trigger', sprite: 'sprites/triggers/alphatrigger.png', solid: false, lethal: false, w: 1, h: 1, triggerType: 'alpha' },
    TRIGGER_SPAWN: { id: 'trigger_spawn', category: 'trigger', sprite: 'sprites/triggers/spawntrigger.png', solid: false, lethal: false, w: 1, h: 1, triggerType: 'spawn' },
};

/* Lookup by id string */
function getObjectType(id) {
    for (const key in ObjectTypes) {
        if (ObjectTypes[key].id === id) return ObjectTypes[key];
    }
    return null;
}

/* Get all types in a category */
function getObjectsByCategory(category) {
    return Object.values(ObjectTypes).filter(t => t.category === category);
}

/* Sprite cache */
const SpriteCache = {
    cache: {},
    loading: {},

    get(src) {
        if (this.cache[src]) return this.cache[src];
        if (this.loading[src]) return null;
        this.loading[src] = true;
        const img = new Image();
        img.onload = () => { this.cache[src] = img; };
        img.onerror = () => { this.loading[src] = false; };
        img.src = src;
        return null;
    },

    preload(srcs) {
        srcs.forEach(src => this.get(src));
    }
};

/* Preload all object sprites */
function preloadAllSprites() {
    const srcs = Object.values(ObjectTypes).map(t => t.sprite);
    srcs.push(
        'sprites/players/cube_1.png', 'sprites/players/ship.png', 'sprites/players/ball.png',
        'sprites/players/ufo.png', 'sprites/players/wave.png', 'sprites/players/robot.png', 'sprites/players/spider.png',
        'sprites/ui/ground.png', 'sprites/ui/game_bg_01_001-hd.png',
        'sprites/ui/logo - Geometry dash.png', 'sprites/ui/playbtn.png',
        'sprites/ui/editor.png', 'sprites/ui/back.png', 'sprites/ui/pause.png',
        'sprites/ui/retry.png', 'sprites/ui/levelcomplete.png', 'sprites/ui/newbest.png',
        'sprites/interactive/checkpoint.png'
    );
    SpriteCache.preload(srcs);
}

