/* ── Icon Kit Logic ────────────────────────────────── */

const IconKit = {
    data: null,
    currentCategory: 'cube',
    categories: ['cube', 'ship', 'ball', 'ufo', 'wave', 'robot', 'spider', 'swing', 'jetpack'],
    selectedIds: {
        cube: 1, ship: 1, ball: 1, ufo: 1, wave: 1, robot: 1, spider: 1, swing: 1, jetpack: 1
    },
    color1: '#00ff88',
    color2: '#ffffff',

    async init() {
        try {
            const response = await fetch('icons.json');
            this.data = await response.json();

            this.loadStoredSettings();
            this.renderTabs();
            this.setCategory(this.currentCategory);

            // Event Listeners
            document.getElementById('color1').oninput = (e) => {
                this.color1 = e.target.value;
                this.updatePreview();
            };
            document.getElementById('color2').oninput = (e) => {
                this.color2 = e.target.value;
                this.updatePreview();
            };
            document.getElementById('btn-use-icon').onclick = () => this.saveSelection();

            document.getElementById('loading-overlay').style.display = 'none';
        } catch (e) {
            console.error('Failed to load icons:', e);
            document.getElementById('loading-overlay').innerText = 'Error loading icons.';
        }
    },

    loadStoredSettings() {
        // Load colors and last active category
        const stored = JSON.parse(localStorage.getItem('gd_icon_settings') || '{}');
        if (stored.colors) {
            this.color1 = stored.colors.c1 || '#00ff88';
            this.color2 = stored.colors.c2 || '#ffffff';
            document.getElementById('color1').value = this.color1;
            document.getElementById('color2').value = this.color2;
        }
        if (stored.selected) {
            this.currentCategory = stored.selected.type || 'cube';
        }

        // Load IDs for EVERY category
        const allIcons = JSON.parse(localStorage.getItem('gd_all_icons') || '{}');
        this.categories.forEach(cat => {
            if (allIcons[cat]) {
                this.selectedIds[cat] = allIcons[cat];
            }
        });
    },

    renderTabs() {
        const container = document.getElementById('category-tabs');
        container.innerHTML = '';

        this.categories.forEach(cat => {
            const btn = document.createElement('div');
            btn.className = `icon-tab ${cat === this.currentCategory ? 'active' : ''}`;

            // Display name overrides
            let displayName = cat;
            if (cat === 'ufo') displayName = 'bird';
            if (cat === 'wave') displayName = 'dart';

            btn.innerText = displayName;
            btn.onclick = () => this.setCategory(cat);
            container.appendChild(btn);
        });
    },

    setCategory(cat) {
        this.currentCategory = cat;
        this.renderTabs();
        this.renderGrid();
        this.updatePreview();
    },

    renderGrid() {
        const grid = document.getElementById('icon-grid');
        grid.innerHTML = '';

        const icons = this.data.allUnlocks[this.currentCategory];
        if (!icons) {
            grid.innerHTML = '<div style="color: white; padding: 20px;">No icons found for this category.</div>';
            return;
        }

        const currentSelectedId = this.selectedIds[this.currentCategory];

        Object.keys(icons).sort((a, b) => parseInt(a) - parseInt(b)).forEach(id => {
            const item = document.createElement('div');
            item.className = 'icon-item';

            if (id == currentSelectedId) {
                item.classList.add('selected');
                item.style.borderColor = '#00ff88';
                item.style.background = 'rgba(0, 255, 136, 0.1)';
            }

            const fileName = `${this.currentCategory}_${id}.png`;
            const url = `https://gdbrowser.com/iconkit/premade/${fileName}`;

            item.innerHTML = `
                <img src="${url}" alt="${this.currentCategory} ${id}" loading="lazy">
                <span class="icon-id">${id}</span>
            `;

            item.onclick = () => {
                this.selectedIds[this.currentCategory] = id;
                this.renderGrid();
                this.updatePreview();
            };
            grid.appendChild(item);
        });
    },

    async updatePreview() {
        const previewBox = document.getElementById('preview-box');
        const title = document.getElementById('preview-title');

        const currentId = this.selectedIds[this.currentCategory];
        title.innerText = `${this.currentCategory.toUpperCase()} #${currentId}`;

        const fileName = `${this.currentCategory}_${currentId}.png`;
        const url = `https://gdbrowser.com/iconkit/premade/${fileName}`;

        // Create colored version
        const coloredDataUrl = await this.processIcon(url);

        previewBox.style.opacity = '0.5';
        setTimeout(() => {
            if (coloredDataUrl) {
                previewBox.innerHTML = `<img src="${coloredDataUrl}" style="width: 80%; height: 80%; object-fit: contain; image-rendering: pixelated; transition: all 0.3s; opacity: 1;">`;
            } else {
                previewBox.innerHTML = `<img src="${url}" style="width: 80%; height: 80%; object-fit: contain; image-rendering: pixelated; filter: grayscale(1);">`;
            }
            previewBox.style.opacity = '1';
        }, 50);
    },

    async processIcon(url) {
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
                const c1 = this.hexToRgb(this.color1);
                const c2 = this.hexToRgb(this.color2);
                const black = { r: 0, g: 0, b: 0 };

                for (let i = 0; i < data.length; i += 4) {
                    const r = data[i];
                    const g = data[i + 1];
                    const b = data[i + 2];
                    const a = data[i + 3];

                    if (a === 0) continue;

                    const gray = (r + g + b) / 3;

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
                resolve(canvas.toDataURL());
            };
            img.onerror = () => resolve(null);
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

    saveSelection() {
        const currentId = this.selectedIds[this.currentCategory];
        const settings = {
            selected: {
                type: this.currentCategory,
                id: currentId
            },
            colors: {
                c1: this.color1,
                c2: this.color2
            }
        };

        // Save all current IDs
        localStorage.setItem('gd_all_icons', JSON.stringify(this.selectedIds));
        localStorage.setItem('gd_icon_settings', JSON.stringify(settings));

        alert('Icon selection saved!');
    }
};

window.onload = () => IconKit.init();
