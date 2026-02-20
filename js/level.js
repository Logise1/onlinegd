/* ── Level Data & Manager ─────────────────────────── */

const LevelManager = {
    builtInLevels: [],
    customLevels: [],

    init() {
        this.builtInLevels = this.getBuiltInLevels();
        this.loadCustomLevels();
    },

    /* ── Custom Levels (localStorage) ── */
    loadCustomLevels() {
        try {
            const data = localStorage.getItem('gd_custom_levels');
            if (data) this.customLevels = JSON.parse(data);
        } catch (e) { this.customLevels = []; }
    },

    saveCustomLevel(level) {
        this.loadCustomLevels();
        if (!level.name || level.name.trim() === '') level.name = 'Untitled';
        level.lastEdited = Date.now();
        const idx = this.customLevels.findIndex(l => l.id === level.id);
        if (idx >= 0) this.customLevels[idx] = level;
        else this.customLevels.push(level);
        this._persist();
    },

    deleteCustomLevel(id) {
        this.loadCustomLevels();
        this.customLevels = this.customLevels.filter(l => l.id !== id);
        this._persist();
    },

    _persist() {
        try {
            localStorage.setItem('gd_custom_levels', JSON.stringify(this.customLevels));
        } catch (e) { }
    },

    getLevel(id) {
        return this.builtInLevels.find(l => l.id === id) ||
            this.customLevels.find(l => l.id === id);
    },

    getAllLevels() {
        return [...this.builtInLevels, ...this.customLevels];
    },

    /* ── Built-in Levels ── */
    getBuiltInLevels() {
        return [
            {
                id: 'level1',
                name: 'Stereo Madness',
                difficulty: 'Easy',
                stars: 1,
                speed: 'normal',
                bgColor: '#0033aa',
                groundColor: '#001166',
                objects: [
                    { type: 'spike', x: 15, y: 10 },
                    { type: 'spike', x: 21, y: 10 },
                    { type: 'spike', x: 27, y: 10 },
                    { type: 'spike', x: 35, y: 10 },
                    { type: 'spike', x: 36, y: 10 },
                    { type: 'spike', x: 43, y: 10 },
                    { type: 'spike', x: 44, y: 10 },
                    { type: 'block', x: 51, y: 10 },
                    { type: 'spike', x: 53, y: 10 },
                    { type: 'block', x: 59, y: 10 },
                    { type: 'block', x: 59, y: 9 },
                    { type: 'spike', x: 64, y: 10 },
                    { type: 'spike', x: 72, y: 10 },
                    { type: 'spike', x: 73, y: 10 },
                    { type: 'spike', x: 74, y: 10 },
                    { type: 'block', x: 82, y: 8 },
                    { type: 'block', x: 83, y: 8 },
                    { type: 'block', x: 84, y: 8 },
                    { type: 'spike', x: 88, y: 10 },
                    { type: 'spike', x: 89, y: 10 },
                    { type: 'pad_yellow', x: 96, y: 10 },
                    { type: 'spike', x: 100, y: 7 },
                    { type: 'block', x: 100, y: 8 },
                    { type: 'block', x: 100, y: 9 },
                    { type: 'block', x: 100, y: 10 },
                    { type: 'block', x: 108, y: 10 },
                    { type: 'block', x: 109, y: 10 },
                    { type: 'block', x: 109, y: 9 },
                    { type: 'spike', x: 113, y: 10 },
                    { type: 'spike', x: 121, y: 10 },
                    { type: 'spike', x: 126, y: 10 },
                    { type: 'spike', x: 131, y: 10 },
                    { type: 'block', x: 139, y: 10 },
                    { type: 'block', x: 140, y: 10 },
                    { type: 'block', x: 141, y: 10 },
                    { type: 'block', x: 142, y: 10 }
                ]
            },
            {
                id: 'level2',
                name: 'Back on Track',
                difficulty: 'Easy',
                stars: 2,
                speed: 'normal',
                bgColor: '#003366',
                groundColor: '#001a33',
                objects: [
                    { type: 'spike', x: 15, y: 10 },
                    { type: 'spike', x: 21, y: 10 },
                    { type: 'spike', x: 22, y: 10 },
                    { type: 'block', x: 29, y: 10 },
                    { type: 'block', x: 29, y: 9 },
                    { type: 'spike', x: 33, y: 10 },
                    { type: 'pad_yellow', x: 41, y: 10 },
                    { type: 'block', x: 46, y: 7 },
                    { type: 'block', x: 47, y: 7 },
                    { type: 'spike', x: 52, y: 10 },
                    { type: 'spike', x: 53, y: 10 },
                    { type: 'spike', x: 54, y: 10 },
                    { type: 'portal_ship', x: 62, y: 8 },
                    { type: 'block', x: 66, y: 3 },
                    { type: 'block', x: 66, y: 4 },
                    { type: 'block', x: 66, y: 9 },
                    { type: 'block', x: 66, y: 10 },
                    { type: 'block', x: 74, y: 3 },
                    { type: 'block', x: 74, y: 4 },
                    { type: 'block', x: 74, y: 5 },
                    { type: 'block', x: 74, y: 10 },
                    { type: 'block', x: 82, y: 3 },
                    { type: 'block', x: 82, y: 4 },
                    { type: 'block', x: 82, y: 5 },
                    { type: 'block', x: 82, y: 10 },
                    { type: 'block', x: 90, y: 3 },
                    { type: 'block', x: 90, y: 4 },
                    { type: 'block', x: 90, y: 5 },
                    { type: 'block', x: 90, y: 10 },
                    { type: 'portal_cube', x: 101, y: 8 },
                    { type: 'spike', x: 105, y: 10 },
                    { type: 'spike', x: 111, y: 10 },
                    { type: 'spike', x: 112, y: 10 },
                    { type: 'spike', x: 119, y: 10 }
                ]
            },
            {
                id: 'level3',
                name: 'Polargeist',
                difficulty: 'Normal',
                stars: 3,
                speed: 'normal',
                bgColor: '#220044',
                groundColor: '#110022',
                objects: [
                    { type: 'spike', x: 15, y: 10 },
                    { type: 'spike', x: 16, y: 10 },
                    { type: 'block', x: 23, y: 10 },
                    { type: 'block', x: 23, y: 9 },
                    { type: 'orb_yellow', x: 26, y: 7 },
                    { type: 'spike', x: 28, y: 10 },
                    { type: 'spike', x: 29, y: 10 },
                    { type: 'portal_speed_fast', x: 35, y: 8 },
                    { type: 'spike', x: 39, y: 10 },
                    { type: 'block', x: 44, y: 9 },
                    { type: 'block', x: 44, y: 10 },
                    { type: 'spike', x: 48, y: 10 },
                    { type: 'spike', x: 49, y: 10 },
                    { type: 'pad_yellow', x: 56, y: 10 },
                    { type: 'spike', x: 61, y: 10 },
                    { type: 'portal_speed_normal', x: 69, y: 8 },
                    { type: 'portal_ship', x: 72, y: 8 },
                    { type: 'block', x: 76, y: 3 },
                    { type: 'block', x: 76, y: 4 },
                    { type: 'block', x: 76, y: 9 },
                    { type: 'block', x: 76, y: 10 },
                    { type: 'block', x: 86, y: 3 },
                    { type: 'block', x: 86, y: 4 },
                    { type: 'block', x: 86, y: 5 },
                    { type: 'block', x: 86, y: 10 },
                    { type: 'block', x: 96, y: 3 },
                    { type: 'block', x: 96, y: 4 },
                    { type: 'block', x: 96, y: 5 },
                    { type: 'block', x: 96, y: 10 },
                    { type: 'portal_cube', x: 111, y: 8 },
                    { type: 'portal_speed_fast', x: 115, y: 8 },
                    { type: 'spike', x: 119, y: 10 },
                    { type: 'spike', x: 124, y: 10 },
                    { type: 'spike', x: 129, y: 10 },
                    { type: 'spike', x: 134, y: 10 },
                    { type: 'spike', x: 135, y: 10 },
                    { type: 'pad_yellow', x: 144, y: 10 },
                    { type: 'block', x: 149, y: 8 },
                    { type: 'block', x: 149, y: 9 },
                    { type: 'block', x: 149, y: 10 }
                ]
            }
        ];
    }
};
