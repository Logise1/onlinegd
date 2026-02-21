/* ── Audio Manager (stubbed) ──────────────────────── */
const AudioManager = {
    sounds: {},
    music: null,
    musicVolume: 0.5,
    sfxVolume: 0.7,
    muted: false,

    load(name, src, forceReload = false) {
        if (!forceReload && this.sounds[name]) return;
        try {
            const a = new Audio(src);
            a.preload = 'auto';
            this.sounds[name] = a;
        } catch (e) { /* file doesn't exist yet */ }
    },

    play(name) {
        if (this.muted || !this.sounds[name]) return;
        try {
            const s = this.sounds[name].cloneNode();
            s.volume = this.sfxVolume;
            s.play().catch(() => { });
        } catch (e) { }
    },

    loadMusic(name, src) {
        try {
            const a = new Audio(src);
            a.preload = 'auto';
            this.sounds[name] = a;
        } catch (e) { }
    },

    playMusic(name, offset = 0) {
        this.stopMusic();
        if (this.muted || !this.sounds[name]) return;
        try {
            this.music = this.sounds[name].cloneNode();
            this.music.loop = true;
            this.music.volume = this.musicVolume;

            const attemptPlay = () => {
                try {
                    if (this.music && offset > 0) this.music.currentTime = offset;
                    if (this.music) this.music.play().catch(() => { });
                } catch (e) { }
            };

            if (this.music.readyState >= 1) { // HAVE_METADATA or more
                attemptPlay();
            } else {
                this.music.addEventListener('loadedmetadata', attemptPlay, { once: true });
                // Fallback attempt
                setTimeout(() => {
                    if (this.music && this.music.currentTime === 0) attemptPlay();
                }, 200);
            }
        } catch (e) { }
    },

    stopMusic() {
        if (this.music) {
            this.music.pause();
            this.music.currentTime = 0;
            this.music = null;
        }
    },

    toggleMute() {
        this.muted = !this.muted;
        if (this.muted) this.stopMusic();
        return this.muted;
    }
};

// Preload available sounds
AudioManager.load('startLevel', 'sounds/playSound_01.ogg');
AudioManager.load('death', 'sounds/explode_11.ogg');
AudioManager.load('quit', 'sounds/quitSound_01.ogg');
AudioManager.load('menu', 'sounds/menuLoop.mp3');
AudioManager.load('portal', 'sounds/portal_01.ogg');
AudioManager.load('orb', 'sounds/orb_01.ogg');
