/* ── UI Overlays ──────────────────────────────────── */

const UI = {
    /* Where to go when pressing "back" — set by game.html based on context */
    backUrl: 'index.html',

    init() {
        // Detect if we came from the editor
        const params = new URLSearchParams(window.location.search);
        const levelId = params.get('level');
        if (levelId === 'editor_test') {
            // Find the real custom level id from the stored test data
            try {
                const testData = JSON.parse(localStorage.getItem('gd_editor_test'));
                if (testData && testData._editorId) {
                    this.backUrl = 'editor.html?edit=' + encodeURIComponent(testData._editorId);
                } else {
                    this.backUrl = 'editor.html';
                }
            } catch (e) {
                this.backUrl = 'editor.html';
            }
        }

        // Pause button
        const pauseBtn = document.getElementById('pause-btn');
        if (pauseBtn) {
            pauseBtn.addEventListener('click', (e) => {
                e.stopPropagation();
                this.togglePause();
            });
        }

        // Global keyboard shortcuts
        window.addEventListener('keydown', (e) => {
            // ESC = pause / back
            if (e.code === 'Escape') {
                e.preventDefault();
                if (Engine.state === 'playing') {
                    this.togglePause();
                } else if (Engine.state === 'paused') {
                    this.goBack();
                } else if (Engine.state === 'complete') {
                    this.goBack();
                }
            }
            // Space in pause = resume
            if (e.code === 'Space' && Engine.state === 'paused') {
                e.preventDefault();
                Engine.state = 'playing';
                this.hideAll();
            }
        });
    },

    goBack() {
        window.location.href = this.backUrl;
    },

    hideAll() {
        document.querySelectorAll('.overlay').forEach(el => el.classList.remove('active'));
        const hud = document.getElementById('hud');
        if (hud) hud.style.display = 'flex';
    },

    /* ── Pause ── */
    togglePause() {
        if (Engine.state === 'playing') {
            Engine.state = 'paused';
            this.showPause();
            if (typeof AudioManager !== 'undefined' && AudioManager.music) {
                AudioManager.music.pause();
            }
        } else if (Engine.state === 'paused') {
            Engine.state = 'playing';
            this.hideAll();
            if (typeof AudioManager !== 'undefined' && AudioManager.music) {
                AudioManager.music.play().catch(() => { });
            }
        }
    },

    showPause() {
        const overlay = document.getElementById('pause-overlay');
        if (!overlay) return;

        overlay.innerHTML = `
      <h2>PAUSED</h2>
      <div class="overlay-buttons">
        <button class="toolbar-btn" id="btn-resume">▶ Resume</button>
        <button class="toolbar-btn" id="btn-retry">↻ Retry</button>
        <button class="toolbar-btn" id="btn-menu">← Back</button>
      </div>
      <div style="margin-top: 16px;">
        <label style="font-size: 14px; cursor: pointer; display: flex; align-items: center; gap: 8px;">
          <input type="checkbox" id="practice-toggle" ${Engine.practiceMode ? 'checked' : ''} />
          Practice Mode
        </label>
      </div>
      <p style="margin-top: 12px; font-size: 11px; opacity: 0.35;">Space = resume · Esc = back · R = retry</p>
    `;
        overlay.classList.add('active');

        document.getElementById('btn-resume').onclick = () => {
            Engine.state = 'playing';
            this.hideAll();
        };
        document.getElementById('btn-retry').onclick = () => {
            Engine.practiceMode = false;
            Engine.checkpoints = [];
            Engine.restart();
        };
        document.getElementById('btn-menu').onclick = () => {
            this.goBack();
        };
        document.getElementById('practice-toggle').onchange = (e) => {
            Engine.practiceMode = e.target.checked;
            if (!Engine.practiceMode) {
                Engine.checkpoints = [];
            }
        };
    },

    /* ── Death ── */
    showDeath() {
        const overlay = document.getElementById('death-overlay');
        if (!overlay) return;
        overlay.innerHTML = `
      <h2 style="color: #ff4444;">💀</h2>
      <p class="overlay-stat">Attempt ${Engine.attempts}</p>
      <div class="overlay-buttons" style="margin-top: 16px;">
        <button class="toolbar-btn" id="btn-death-retry">↻ Retry</button>
        <button class="toolbar-btn" id="btn-death-menu">← Back</button>
      </div>
    `;
        overlay.classList.add('active');

        document.getElementById('btn-death-retry').onclick = () => { Engine.restart(); };
        document.getElementById('btn-death-menu').onclick = () => { this.goBack(); };
    },

    /* ── Level Complete ── */
    showComplete(stats) {
        if (typeof AudioManager !== 'undefined') AudioManager.stopMusic();
        const overlay = document.getElementById('complete-overlay');
        if (!overlay) return;

        overlay.innerHTML = `
      <img class="complete-img" src="sprites/ui/levelcomplete.png" alt="Level Complete"
           onerror="this.outerHTML='<h2 style=\\'color:#00ff88\\'>LEVEL COMPLETE!</h2>'" />
      ${stats.newBest ? `<img class="newbest-img" src="sprites/ui/newbest.png" alt="New Best"
           onerror="this.outerHTML='<p style=\\'color:#ffcc00; font-size:20px\\'>★ NEW BEST ★</p>'" />` : ''}
      <div style="margin: 12px 0;">
        <p class="overlay-stat">Attempts: ${stats.attempts}</p>
        <p class="overlay-stat">Jumps: ${stats.jumps}</p>
        <p class="overlay-stat">Time: ${stats.time}s</p>
      </div>
      <div class="overlay-buttons">
        <button class="toolbar-btn" id="btn-complete-retry">↻ Replay</button>
        <button class="toolbar-btn" id="btn-complete-menu">← Back</button>
      </div>
      <p style="margin-top: 12px; font-size: 11px; opacity: 0.35;">Esc = back</p>
    `;
        overlay.classList.add('active');

        document.getElementById('btn-complete-retry').onclick = () => {
            Engine.attempts = 0;
            Engine.restart();
        };
        document.getElementById('btn-complete-menu').onclick = () => {
            this.goBack();
        };
    }
};
