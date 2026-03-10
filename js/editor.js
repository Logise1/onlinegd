/* ── Level Editor ─────────────────────────────────── */

const Editor = {
    canvas: null,
    ctx: null,
    width: 0,
    height: 0,

    /* State */
    objects: [],
    selectedType: null,
    currentTool: 'build', // build | delete | edit | scale
    hoveredCell: null,
    selectedObject: null, // for edit/scale
    undoStack: [],

    /* Music Sync */
    isPlayingMusic: false,
    musicStartTime: 0,
    musicStartOffset: 0,

    /* Camera / Pan / Input */
    camX: 0,
    camY: 0,
    zoom: 1,
    isPanning: false,
    isDragging: false,
    mouseDownTime: 0,
    panStartX: 0,
    panStartY: 0,
    panStartCamX: 0,
    panStartCamY: 0,
    lastPlacePos: { x: -999, y: -999 },
    lastClickTime: 0,
    longPressTimer: null,
    isSelecting: false,
    selectionRect: null,
    isDraggingObjects: false,
    dragStartPos: { x: 0, y: 0 },
    dragObjectsStartPos: [], // [{x, y, obj}]
    ctrlPressed: false,
    selectedObjects: [], // Array of objects for multi-selection

    /* Grid */
    gridSize: BLOCK_SIZE,
    showGrid: true,

    /* Level settings */
    levelName: 'My Level',
    levelSpeed: 'normal',
    levelBgColor: '#0033aa',
    levelGroundColor: '#001166',

    /* ── Init ── */
    init(canvas) {
        this.canvas = canvas;
        this.ctx = canvas.getContext('2d');
        this.resize();
        window.addEventListener('resize', () => this.resize());

        this.setupInput();
        this.buildPalette();

        try {
            const routeJson = localStorage.getItem('gd_test_route');
            if (routeJson) {
                this.testRoute = JSON.parse(routeJson);
                localStorage.removeItem('gd_test_route');
            }
        } catch (e) {
            console.error(e);
        }

        this.render();

        // Load from URL param if editing existing level
        const params = new URLSearchParams(window.location.search);
        const editId = params.get('edit');
        const collabId = params.get('collab');
        if (editId) {
            this.currentLevelId = editId;
            this.loadLevel(editId);
        } else if (collabId) {
            this.currentLevelId = collabId;
            this.isCollab = true;
            this.loadLevel(collabId);
        } else {
            // New level — assign an ID right away
            this.currentLevelId = 'custom_' + Date.now();
            const newName = params.get('name');
            if (newName) this.levelName = newName;
        }

        // Auto-save every 5 seconds
        setInterval(() => this.autoSave(), 5000);
    },

    resize() {
        const container = this.canvas.parentElement;
        this.width = container ? container.clientWidth - 280 : window.innerWidth - 280;
        this.height = window.innerHeight;
        const dpr = window.devicePixelRatio || 1;
        this.canvas.width = this.width * dpr;
        this.canvas.height = this.height * dpr;
        this.canvas.style.width = this.width + 'px';
        this.canvas.style.height = this.height + 'px';
        this.ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    },

    /* ── Input ── */
    setupInput() {
        const c = this.canvas;

        c.addEventListener('mousedown', (e) => {
            const rect = c.getBoundingClientRect();
            const mx = (e.clientX - rect.left) / this.zoom + this.camX;
            const my = (e.clientY - rect.top) / this.zoom + this.camY;
            const gx = Math.floor(mx / this.gridSize);
            const gy = Math.floor(my / this.gridSize);

            if (e.button === 0) {
                this.isDragging = false;
                this.mouseDownTime = Date.now();
                this.panStartX = e.clientX;
                this.panStartY = e.clientY;
                this.panStartCamX = this.camX;
                this.panStartCamY = this.camY;
                this.dragStartPos = { x: mx, y: my };

                // Ensure hoveredCell is updated even without move
                this.hoveredCell = { x: gx, y: gy };

                const obj = this.getObjectAt(gx, gy);

                // Long press detection for dragging or selecting
                clearTimeout(this.longPressTimer);
                this.longPressTimer = setTimeout(() => {
                    if (obj) {
                        // Start dragging
                        this.isDraggingObjects = true;
                        if (!this.selectedObjects.includes(obj)) {
                            this.selectedObjects = [obj];
                            this.selectedObject = obj;
                        }
                        this.dragObjectsStartPos = this.selectedObjects.map(o => ({ x: o.x, y: o.y, obj: o }));
                    } else {
                        // Start selection rect
                        this.isSelecting = true;
                        this.selectionRect = { x1: mx, y1: my, x2: mx, y2: my };
                    }
                    this.render();
                }, 1000);

                // Double click detection
                const now = Date.now();
                if (now - this.lastClickTime < 300) {
                    clearTimeout(this.longPressTimer);
                    this.handleDoubleClick(gx, gy);
                }
                this.lastClickTime = now;
            } else if (e.button === 1 || (e.button === 0 && e.altKey)) {
                this.isPanning = true;
                this.panStartX = e.clientX;
                this.panStartY = e.clientY;
                this.panStartCamX = this.camX;
                this.panStartCamY = this.camY;
            }
        });

        c.addEventListener('mousemove', (e) => {
            const rect = c.getBoundingClientRect();
            const mx = (e.clientX - rect.left) / this.zoom + this.camX;
            const my = (e.clientY - rect.top) / this.zoom + this.camY;
            this.hoveredCell = {
                x: Math.floor(mx / this.gridSize),
                y: Math.floor(my / this.gridSize)
            };

            const dist = Math.hypot(e.clientX - this.panStartX, e.clientY - this.panStartY);
            if (dist > 15) { // Increased from 5 to avoid misfiring on minor tremors
                this.isDragging = true;
                clearTimeout(this.longPressTimer);
            }

            // Continuous placement
            if (this.currentTool === 'build' && this.ctrlPressed && !this.isPanning && !this.isSelecting && !this.isDraggingObjects && (e.buttons & 1)) {
                this.placeObject(this.hoveredCell.x, this.hoveredCell.y);
            }

            // Continuous deletion
            if (this.currentTool === 'delete' && this.ctrlPressed && !this.isPanning && !this.isSelecting && !this.isDraggingObjects && (e.buttons & 1)) {
                this.deleteAt(this.hoveredCell.x, this.hoveredCell.y);
            }

            // Selection Logic
            if (this.isSelecting) {
                this.selectionRect.x2 = mx;
                this.selectionRect.y2 = my;
            }

            // Dragging Logic
            if (this.isDraggingObjects) {
                const dx = Math.floor((mx - this.dragStartPos.x) / this.gridSize);
                const dy = Math.floor((my - this.dragStartPos.y) / this.gridSize);
                this.dragObjectsStartPos.forEach(data => {
                    data.obj.x = data.x + dx;
                    data.obj.y = data.y + dy;
                });
            }

            // Pan logic
            if (this.isPanning) {
                this.camX = this.panStartCamX - (e.clientX - this.panStartX) / this.zoom;
                this.camY = this.panStartCamY - (e.clientY - this.panStartY) / this.zoom;
            }

            this.render();
        });

        c.addEventListener('mouseup', (e) => {
            clearTimeout(this.longPressTimer);

            if (this.isSelecting) {
                const r = this.selectionRect;
                const xMin = Math.min(r.x1, r.x2) / this.gridSize;
                const xMax = Math.max(r.x1, r.x2) / this.gridSize;
                const yMin = Math.min(r.y1, r.y2) / this.gridSize;
                const yMax = Math.max(r.y1, r.y2) / this.gridSize;

                this.selectedObjects = this.objects.filter(o => {
                    const type = getObjectType(o.type);
                    const ow = (type.w || 1) * (o.scale || 1);
                    const oh = (type.h || 1) * (o.scale || 1);
                    const oy = o.y + 1 - oh;
                    return o.x < xMax && o.x + ow > xMin && oy < yMax && oy + oh > yMin;
                });
                this.selectedObject = this.selectedObjects[0] || null;
                this.isSelecting = false;
                this.selectionRect = null;
                this.updatePropertiesPanel();
            }

            if (this.isDraggingObjects) {
                this.isDraggingObjects = false;
                this.pushUndo();
                this.saveLevel();
            }

            if (e.button === 0 && !this.isDragging) {
                const pressTime = Date.now() - this.mouseDownTime;
                if (pressTime < 1000) { // Sync with longPressTimer
                    this.handleToolClick(e);
                }
            }
            this.isPanning = false;
            this.isDragging = false;
            this.render();
        });

        c.addEventListener('mouseleave', () => {
            this.isPanning = false;
            this.isSelecting = false;
            this.isDraggingObjects = false;
            this.hoveredCell = null;
            this.render();
        });

        c.addEventListener('contextmenu', (e) => {
            e.preventDefault();
            if (this.hoveredCell) this.deleteAt(this.hoveredCell.x, this.hoveredCell.y);
        });

        // Zoom
        c.addEventListener('wheel', (e) => {
            e.preventDefault();
            const factor = e.deltaY > 0 ? 0.9 : 1.1;
            this.zoom = Math.max(0.1, Math.min(5, this.zoom * factor));
            this.render();
        }, { passive: false });

        // Keyboard
        window.addEventListener('keydown', (e) => {
            if (e.target.tagName === 'INPUT') return;
            if (e.code === 'ControlLeft' || e.code === 'ControlRight') this.ctrlPressed = true;
            if (e.ctrlKey && e.code === 'KeyZ') { e.preventDefault(); this.undo(); }
            if (e.ctrlKey && e.code === 'KeyS') { e.preventDefault(); this.saveLevel(); }
            if (e.code === 'Delete') { if (this.selectedObject || (this.selectedObjects && this.selectedObjects.length > 0)) this.deleteSelected(); }
            if (e.code === 'Digit1') this.setTool('build');
            if (e.code === 'Digit2') this.setTool('edit');
            if (e.code === 'Digit3') this.setTool('delete');
        });
        window.addEventListener('keyup', (e) => {
            if (e.code === 'ControlLeft' || e.code === 'ControlRight') this.ctrlPressed = false;
        });
    },

    toggleGrid() {
        this.showGrid = !this.showGrid;
        this.render();
    },

    setTool(tool) {
        this.currentTool = tool;
        document.querySelectorAll('.tool-btn').forEach(b => b.classList.remove('active'));
        const btn = document.getElementById('tool-' + tool);
        if (btn) btn.classList.add('active');

        // Toggle Palette vs Properties
        const palette = document.getElementById('editor-palette-container');
        const props = document.getElementById('editor-properties-container');

        if (tool === 'build') {
            if (palette) palette.style.display = 'block';
            if (props) props.style.display = 'none';
        } else if (tool === 'edit' || tool === 'scale') {
            if (palette) palette.style.display = 'none';
            if (props) props.style.display = 'block';
            this.updatePropertiesPanel(); // Show select message or form
        } else {
            // Delete tool
            if (palette) palette.style.display = 'block';
            if (props) props.style.display = 'none';
        }

        this.render();
    },

    handleToolClick(e) {
        if (!this.hoveredCell) return;
        const cx = this.hoveredCell.x;
        const cy = this.hoveredCell.y;

        if (this.currentTool === 'build') {
            this.placeObject(cx, cy);
        } else if (this.currentTool === 'delete') {
            this.deleteAt(cx, cy);
        } else if (this.currentTool === 'edit' || this.currentTool === 'scale') {
            this.selectObjectAt(cx, cy);
        }
    },

    handleDoubleClick(cx, cy) {
        const obj = this.getObjectAt(cx, cy);
        if (obj) {
            const type = getObjectType(obj.type);
            if (type.category === 'trigger') {
                this.selectedObject = obj;
                this.showObjectPopup(obj);
            } else {
                this.setTool('edit');
                this.selectObjectAt(cx, cy);
            }
        }
    },

    getObjectAt(cx, cy) {
        return this.objects.find(o => {
            const type = getObjectType(o.type);
            const w = (type.w || 1) * (o.scale || 1);
            const h = (type.h || 1) * (o.scale || 1);
            const yOffset = 1 - h;
            return cx >= o.x && cx < o.x + w &&
                cy >= o.y + yOffset && cy < o.y + yOffset + h;
        });
    },

    selectObjectAt(cx, cy) {
        const obj = this.getObjectAt(cx, cy);
        if (obj) {
            if (!this.selectedObjects.includes(obj)) {
                this.selectedObjects = [obj];
            }
            this.selectedObject = obj;
        } else {
            this.selectedObjects = [];
            this.selectedObject = null;
        }

        this.updatePropertiesPanel();
        this.render();
    },

    updatePropertiesPanel() {
        const msg = document.getElementById('prop-message');
        const form = document.getElementById('prop-form');

        if (!this.selectedObject) {
            if (msg) msg.style.display = 'block';
            if (form) form.style.display = 'none';
            return;
        }

        if (msg) msg.style.display = 'none';
        if (form) {
            form.style.display = 'flex';
            this.renderPropertiesForm(form, this.selectedObject);
        }
    },

    renderPropertiesForm(container, obj) {
        const type = getObjectType(obj.type);
        let html = `<div style="font-weight:bold;margin-bottom:5px">${type.id}</div>`;

        // Scale
        html += `
            <label>Scale: <span id="val-scale">${obj.scale || 1}</span>x</label>
            <input type="range" min="0.5" max="3" step="0.1" value="${obj.scale || 1}" 
                   oninput="Editor.updateProp('scale', this.value)">
        `;

        // Rotation
        html += `
            <label>Rotation: <span id="val-rot">${obj.rotation || 0}</span>°</label>
            <input type="range" min="0" max="360" step="15" value="${obj.rotation || 0}"
                   oninput="Editor.updateProp('rotation', this.value)">
        `;

        // Multi Activate
        if (type.category === 'interactive') {
            html += `
                <label style="display:flex;align-items:center;gap:8px;margin-top:5px;cursor:pointer">
                    <input type="checkbox" ${obj.multiActivate ? 'checked' : ''}
                           onchange="Editor.updateProp('multiActivate', this.checked)">
                    Multi Activate
                </label>
            `;
        }

        // Touch Triggered
        if (type.category === 'trigger') {
            html += `
                <label style="display:flex;align-items:center;gap:8px;margin-top:5px;cursor:pointer">
                    <input type="checkbox" ${obj.touchTriggered ? 'checked' : ''}
                           onchange="Editor.updateProp('touchTriggered', this.checked)">
                    Touch Triggered
                </label>
            `;
        }

        // Free Fly
        if (type.category === 'portal' && (type.portalMode === 'ship' || type.portalMode === 'ufo')) {
            html += `
                <label style="display:flex;align-items:center;gap:8px;margin-top:5px;cursor:pointer">
                    <input type="checkbox" ${obj.freeFly ? 'checked' : ''}
                           onchange="Editor.updateProp('freeFly', this.checked)">
                    Free Fly Mode
                </label>
            `;
        }

        if (type.isTeleportIn) {
            html += `
                <label>Target Group ID (Teleport OUT):</label>
                <input type="number" step="1" min="0" max="999" value="${obj.targetGroupID || 0}" 
                       onchange="Editor.updateProp('targetGroupID', parseInt(this.value))">
            `;
        }

        html += `<hr style="margin:10px 0; border:0; border-top:1px solid #444;">`;

        // Group ID (for all objects)
        html += `
            <label>Group ID (Active):</label>
            <input type="number" min="0" max="999" value="${obj.groupID || 0}" 
                   onchange="Editor.updateProp('groupID', parseInt(this.value))" style="width:60px">
        `;

        // Trigger Settings
        if (type.category === 'trigger') {
            html += `<div style="margin-top:10px; padding:8px; background:rgba(0,0,0,0.2); border-radius:4px;">`;
            html += `<div style="color:#00ff88; font-size:11px; margin-bottom:5px;">TRIGGER SETTINGS</div>`;

            html += `
                <label>Target Group:</label>
                <input type="number" min="0" max="999" value="${obj.targetGroupID || 0}" 
                       onchange="Editor.updateProp('targetGroupID', parseInt(this.value))" style="width:60px">
            `;

            if (type.triggerType === 'move') {
                html += `
                    <div style="display:grid; grid-template-columns:1fr 1fr; gap:8px;">
                        <div>
                            <label>Move X (tiles):</label>
                            <input type="number" step="0.5" value="${obj.moveX || 0}" 
                                   onchange="Editor.updateProp('moveX', parseFloat(this.value))" style="width:100%">
                        </div>
                        <div>
                            <label>Move Y (tiles):</label>
                            <input type="number" step="0.5" value="${obj.moveY || 0}" 
                                   onchange="Editor.updateProp('moveY', parseFloat(this.value))" style="width:100%">
                        </div>
                        <div>
                            <label>Duration (s):</label>
                            <input type="number" min="0" step="0.1" value="${obj.moveDuration || 0.5}" 
                                   onchange="Editor.updateProp('moveDuration', parseFloat(this.value))" style="width:100%">
                        </div>
                    </div>
                `;
            } else if (type.triggerType === 'color') {
                html += `
                    <div style="display:grid; grid-template-columns:1fr 1fr; gap:8px;">
                        <div>
                            <label>Color:</label>
                            <input type="color" value="${obj.color || '#ffffff'}" 
                                   onchange="Editor.updateProp('color', this.value)" style="width:100%; height:24px;">
                        </div>
                        <div>
                            <label>Fade Time (s):</label>
                            <input type="number" min="0" step="0.1" value="${obj.fadeTime || 0.5}" 
                                   onchange="Editor.updateProp('fadeTime', parseFloat(this.value))" style="width:100%">
                        </div>
                    </div>
                `;
            } else if (type.triggerType === 'alpha') {
                html += `
                    <div style="display:grid; grid-template-columns:1fr 1fr; gap:8px;">
                        <div>
                            <label>Opacity (0-1):</label>
                            <input type="number" min="0" max="1" step="0.1" value="${obj.opacity !== undefined ? obj.opacity : 1}" 
                                   onchange="Editor.updateProp('opacity', parseFloat(this.value))" style="width:100%">
                        </div>
                        <div>
                            <label>Fade Time (s):</label>
                            <input type="number" min="0" step="0.1" value="${obj.fadeTime || 0.5}" 
                                   onchange="Editor.updateProp('fadeTime', parseFloat(this.value))" style="width:100%">
                        </div>
                    </div>
                `;
            }
            html += `</div>`;
        }

        // Delete button
        html += `
            <button class="toolbar-btn danger" style="margin-top:10px" onclick="Editor.deleteSelected()">Delete Object</button>
        `;

        container.innerHTML = html;
    },

    updateProp(prop, val) {
        if (!this.selectedObject && (!this.selectedObjects || this.selectedObjects.length === 0)) return;

        if (this.selectedObjects && this.selectedObjects.length > 0) {
            this.selectedObjects.forEach(obj => {
                obj[prop] = val;
            });
        } else if (this.selectedObject) {
            this.selectedObject[prop] = val;
        }

        // Update range label if it exists
        const labelMap = { 'scale': 'val-scale', 'rotation': 'val-rot' };
        if (labelMap[prop]) {
            const label = document.getElementById(labelMap[prop]);
            if (label) label.innerText = val;
        }

        this.unverify();
        this.saveLevel();
        this.render();
    },

    deleteSelected() {
        if (this.selectedObjects && this.selectedObjects.length > 0) {
            this.pushUndo();
            this.objects = this.objects.filter(o => !this.selectedObjects.includes(o));
            this.selectedObjects = [];
            this.selectedObject = null;
            this.updatePropertiesPanel();
            this.render();
        } else if (this.selectedObject) {
            this.deleteObject(this.selectedObject);
            this.selectedObject = null;
            this.updatePropertiesPanel();
        }
    },

    deleteObject(obj) {
        if (!obj) return;
        this.pushUndo();
        this.objects = this.objects.filter(o => o !== obj);
        this.render();
    },

    /* ── Object Palette ── */
    buildPalette() {
        const categories = ['solid', 'hazard', 'portal', 'interactive', 'trigger', 'deco'];
        const tabContainer = document.querySelector('.editor-category-tabs');
        const objectsContainer = document.querySelector('.editor-objects');

        if (!tabContainer || !objectsContainer) return;

        tabContainer.innerHTML = '';
        categories.forEach((cat, i) => {
            const tab = document.createElement('div');
            tab.className = 'editor-cat-tab' + (i === 0 ? ' active' : '');
            tab.textContent = cat.charAt(0).toUpperCase() + cat.slice(1);
            tab.dataset.cat = cat;
            tab.addEventListener('click', () => {
                document.querySelectorAll('.editor-cat-tab').forEach(t => t.classList.remove('active'));
                tab.classList.add('active');
                this.showCategoryObjects(cat);
            });
            tabContainer.appendChild(tab);
        });

        this.showCategoryObjects('solid');
    },

    showCategoryObjects(category) {
        const container = document.querySelector('.editor-objects');
        if (!container) return;
        container.innerHTML = '';

        const types = getObjectsByCategory(category);
        types.forEach((type, index) => {
            const btn = document.createElement('div');
            btn.className = 'editor-obj-btn';

            // Auto-select first or keep existing if it's in this cat
            if (index === 0) {
                btn.classList.add('selected');
                this.selectedType = type.id;
            } else if (this.selectedType === type.id) {
                btn.classList.add('selected');
            }

            btn.title = type.id;
            btn.innerHTML = `<img src="${type.sprite}" alt="${type.id}" onerror="this.style.display='none';this.parentElement.textContent='${type.id.substring(0, 4)}'">`;

            btn.addEventListener('click', () => {
                document.querySelectorAll('.editor-obj-btn').forEach(b => b.classList.remove('selected'));
                btn.classList.add('selected');
                this.selectedType = type.id;
            });

            container.appendChild(btn);
        });
    },

    /* ── Place / Delete ── */
    placeObject(gx, gy) {
        if (!this.selectedType) return;

        // Don't place duplicates
        const exists = this.objects.find(o => o.x === gx && o.y === gy && o.type === this.selectedType);
        if (exists) return;

        // Save undo state
        this.pushUndo();

        // Remove any object at same position
        this.objects = this.objects.filter(o => !(o.x === gx && o.y === gy));

        this.objects.push({ type: this.selectedType, x: gx, y: gy });

        this.unverify();
        this.render();
        this.saveLevel();
    },

    deleteAt(gx, gy) {
        const before = this.objects.length;
        this.pushUndo();
        this.objects = this.objects.filter(o => !(o.x === gx && o.y === gy));
        if (this.objects.length === before) {
            this.undoStack.pop(); // nothing changed
        } else {
            this.unverify();
            this.render();
            this.saveLevel();
        }
    },

    /* ── Undo ── */
    pushUndo() {
        this.undoStack.push(JSON.stringify(this.objects));
        if (this.undoStack.length > 50) this.undoStack.shift();
    },

    undo() {
        if (this.undoStack.length === 0) return;
        this.objects = JSON.parse(this.undoStack.pop());
        this.render();
    },

    /* ── Save / Load ── */
    _buildLevel() {
        return {
            id: this.currentLevelId,
            name: this.levelName || 'Untitled',
            difficulty: this.levelDifficulty || 'normal',
            stars: this.levelStars || 0,
            speed: this.levelSpeed,
            song: this.levelSong,
            customSongId: this.levelCustomSongId,
            songOffset: this.levelSongOffset,
            bgColor: this.levelBgColor,
            groundColor: this.levelGroundColor,
            objects: JSON.parse(JSON.stringify(this.objects)),
            verified: this.levelVerified || false
        };
    },

    unverify() {
        if (this.levelVerified) {
            this.levelVerified = false;
            this.saveLevel();
        }
    },

    autoSave() {
        if (this.isCollab && window.Cloud && window.Auth && window.Auth.userData) {
            // Handle Collab Syncing
            const objects = JSON.parse(JSON.stringify(this.objects || [])); // just objects for simplicity, or we can build whole level
            window.Cloud.updateCollab(this.currentLevelId, objects, window.Auth.userData.username);
        } else {
            const level = this._buildLevel();
            LevelManager.saveCustomLevel(level);
        }
    },

    saveLevel() {
        this.autoSave();
        // alert(`Level "${this.levelName || 'Untitled'}" saved!`);
    },

    goBack() {
        this.autoSave();
        if (this.unsubscribeCollab) this.unsubscribeCollab();
        window.location.href = 'index.html';
    },

    async loadLevel(id) {
        if (this.isCollab && window.Cloud && window.Auth && window.Auth.userData) {
            // Load collab from cloud & subscribe
            this.unsubscribeCollab = window.Cloud.subscribeCollab(id, (collabData) => {
                // Initial load
                if (!this.levelLoaded) {
                    this.levelLoaded = true;
                    this._applyLevelData(collabData);
                    this.render();
                } else if (collabData.lastEditedUser !== window.Auth.userData.username) {
                    // Update from OTHER user
                    this.objects = JSON.parse(JSON.stringify(collabData.objects || []));
                    this.render();
                }
            });
            return;
        }

        if (!LevelManager.builtInLevels.length) LevelManager.init();
        const level = LevelManager.getLevel(id);
        if (!level) return;

        this._applyLevelData(level);
        this.render();
    },

    _applyLevelData(level) {
        this.currentLevelId = level.id;
        this.objects = JSON.parse(JSON.stringify(level.objects || []));
        this.levelName = level.name || 'Untitled';
        this.levelDifficulty = level.difficulty || 'normal';
        this.levelStars = level.stars || 0;
        this.levelSpeed = level.speed || 'normal';
        this.levelSong = level.song || 'StereoMadness.mp3';
        this.levelCustomSongId = level.customSongId || '';
        this.levelSongOffset = level.songOffset || 0;
        this.levelBgColor = level.bgColor || '#0033aa';
        this.levelGroundColor = level.groundColor || '#001166';
        this.levelVerified = level.verified || false;

        // Update settings inputs
        const nameInput = document.getElementById('setting-name');
        if (nameInput) nameInput.value = this.levelName;
        const speedInput = document.getElementById('setting-speed');
        if (speedInput) speedInput.value = this.levelSpeed;
        const songInput = document.getElementById('setting-song');
        if (songInput) songInput.value = this.levelSong;
    },

    clearAll() {
        if (confirm('Clear all objects?')) {
            this.pushUndo();
            this.objects = [];
            this.render();
        }
    },

    /* ── Test Play ── */
    testPlay() {
        this.autoSave();
        const tempLevel = this._buildLevel();
        tempLevel._editorId = this.currentLevelId;
        tempLevel.id = 'editor_test';
        try {
            localStorage.setItem('gd_editor_test', JSON.stringify(tempLevel));
        } catch (e) { }
        window.location.href = 'game.html?level=editor_test';
    },

    /* ── Music Sync ── */
    toggleSyncMusic() {
        if (typeof AudioManager === 'undefined') return;

        const btn = document.getElementById('btn-sync-music');

        if (this.isPlayingMusic) {
            AudioManager.stopMusic();
            this.isPlayingMusic = false;
            if (btn) btn.innerText = '🎵 Play Music';
            this.render();
        } else {
            const song = this.levelSong || 'StereoMadness.mp3';

            const loadAndPlayEditorMusic = (actSrc) => {
                AudioManager.loadMusic('editor_sync', actSrc);

                // Allow a small delay for loading
                setTimeout(() => {
                    // Calculate starting time based on camera position and level speed
                    const speeds = { slow: 4.5, normal: 6.5, fast: 8.5, vfast: 10.0, vvfast: 12.0 };
                    const blocksPerSec = (speeds[this.levelSpeed || 'normal'] * 60) / BLOCK_SIZE;

                    // The player starts at x = 3 blocks. Offset the camera based on this.
                    const cameraBlocksX = this.camX / this.gridSize;

                    // Simple estimation for timestamp
                    const startTime = Math.max(0, (cameraBlocksX - 3) / blocksPerSec);

                    AudioManager.playMusic('editor_sync', startTime + (this.levelSongOffset || 0));

                    if (AudioManager.music) {
                        this.isPlayingMusic = true;

                        if (btn) btn.innerText = '⏹ Stop Music';

                        // Force continuous rendering to show the sync line
                        const renderLoop = () => {
                            if (this.isPlayingMusic) {
                                this.render();
                                requestAnimationFrame(renderLoop);
                            }
                        };
                        renderLoop();
                    }
                }, 300);
            };

            if (this.levelCustomSongId) {
                if (this._cachedSongId === this.levelCustomSongId && this._cachedSongUrl) {
                    loadAndPlayEditorMusic(this._cachedSongUrl);
                } else {
                    if (btn) btn.innerText = '⏳ Loading...';
                    fetch(`https://ng.logise1123.workers.dev/${this.levelCustomSongId}`)
                        .then(res => res.blob())
                        .then(blob => {
                            this._cachedSongId = this.levelCustomSongId;
                            this._cachedSongUrl = URL.createObjectURL(blob);
                            loadAndPlayEditorMusic(this._cachedSongUrl);
                        })
                        .catch(() => {
                            // fallback or offline
                            if (btn) btn.innerText = '🎵 Play Music';
                        });
                }
            } else {
                loadAndPlayEditorMusic(`music/${song}`);
            }
        }
    },

    /* ── Render ── */
    render() {
        const ctx = this.ctx;
        const W = this.width;
        const H = this.height;
        const gs = this.gridSize;

        ctx.clearRect(0, 0, W, H);

        ctx.save();
        ctx.scale(this.zoom, this.zoom);
        ctx.translate(-this.camX, -this.camY);

        // Background
        ctx.fillStyle = this.levelBgColor;
        ctx.fillRect(this.camX, this.camY, W / this.zoom, H / this.zoom);

        // Ground
        const groundY = 11 * gs;
        ctx.fillStyle = this.levelGroundColor;
        ctx.fillRect(this.camX, groundY, W / this.zoom, H / this.zoom);

        // Ground line
        ctx.strokeStyle = '#fff';
        ctx.lineWidth = 2 / this.zoom;
        ctx.globalAlpha = 0.4;
        ctx.beginPath();
        ctx.moveTo(this.camX, groundY);
        ctx.lineTo(this.camX + W / this.zoom, groundY);
        ctx.stroke();
        ctx.globalAlpha = 1;

        // Grid
        if (this.showGrid) {
            ctx.strokeStyle = 'rgba(255,255,255,0.15)';
            ctx.lineWidth = 1 / this.zoom;

            const startX = Math.floor(this.camX / gs) * gs;
            const startY = Math.floor(this.camY / gs) * gs;
            const endX = this.camX + W / this.zoom;
            const endY = this.camY + H / this.zoom;

            for (let x = startX; x <= endX + gs; x += gs) {
                ctx.beginPath();
                ctx.moveTo(x, this.camY);
                ctx.lineTo(x, endY);
                ctx.stroke();
            }
            for (let y = startY; y <= endY + gs; y += gs) {
                ctx.beginPath();
                ctx.moveTo(this.camX, y);
                ctx.lineTo(endX, y);
                ctx.stroke();
            }
        }

        // Objects
        for (const obj of this.objects) {
            const type = getObjectType(obj.type);
            if (!type) continue;

            const ox = obj.x * gs;
            let oy = obj.y * gs;
            const ow = (type.w || 1) * gs * (obj.scale || 1);
            const oh = (type.h || 1) * gs * (obj.scale || 1);
            oy += gs - oh; // Align to bottom of the grid cell

            const sprite = SpriteCache.get(type.sprite);

            ctx.save();

            // Rotation for sawblades or custom rotation
            const rot = (obj.rotation || 0);
            if (rot !== 0 || type.rotates) {
                const cx = ox + ow / 2;
                const cy = oy + oh / 2;
                ctx.translate(cx, cy);
                ctx.rotate((rot + (type.rotates ? performance.now() / 10 : 0)) * Math.PI / 180);
                ctx.translate(-cx, -cy);
            }

            if (sprite) {
                if (type.category === 'solid') {
                    ctx.save();
                    ctx.shadowColor = this.levelGroundColor || '#00ff88';
                    ctx.shadowBlur = 10 / this.zoom;
                    ctx.drawImage(sprite, ox, oy, ow, oh);
                    ctx.restore();
                } else {
                    ctx.drawImage(sprite, ox, oy, ow, oh);
                }
            } else {
                const colors = {
                    solid: '#555577', hazard: '#cc3333', portal: '#8833ff',
                    interactive: '#ffaa00', trigger: '#00ff88', deco: '#336699'
                };
                ctx.fillStyle = colors[type.category] || '#666';
                ctx.fillRect(ox, oy, ow, oh);
                ctx.fillStyle = '#fff';
                ctx.font = `${9 / this.zoom}px monospace`;
                ctx.textAlign = 'center';
                ctx.fillText(type.id.substring(0, 6), ox + ow / 2, oy + oh / 2 + 3);
            }

            ctx.restore();

            // Selection highlight
            if (this.selectedObjects.includes(obj)) {
                ctx.save();
                if (rot !== 0 || type.rotates) {
                    const cx = ox + ow / 2;
                    const cy = oy + oh / 2;
                    ctx.translate(cx, cy);
                    ctx.rotate((rot + (type.rotates ? performance.now() / 10 : 0)) * Math.PI / 180);
                    ctx.translate(-cx, -cy);
                }
                ctx.strokeStyle = '#00ff88';
                ctx.lineWidth = 2 / this.zoom;
                ctx.strokeRect(ox, oy, ow, oh);
                ctx.restore();
            }

            // Non-touch trigger line
            if (type.category === 'trigger' && !obj.touchTriggered) {
                ctx.strokeStyle = '#0088ff';
                ctx.lineWidth = 1 / this.zoom;
                ctx.globalAlpha = 0.5;
                ctx.beginPath();
                ctx.moveTo(ox, this.camY);
                ctx.lineTo(ox, this.camY + H / this.zoom);
                ctx.stroke();
                ctx.globalAlpha = 1;
            }
        }

        // Test Play Route
        if (this.testRoute && this.testRoute.length > 0) {
            ctx.save();
            ctx.beginPath();
            ctx.strokeStyle = 'rgba(0, 255, 136, 0.6)';
            ctx.lineWidth = 4 / this.zoom;
            ctx.lineJoin = 'round';
            ctx.lineCap = 'round';
            for (let i = 0; i < this.testRoute.length; i++) {
                const pt = this.testRoute[i];
                if (i === 0) ctx.moveTo(pt.x, pt.y);
                else ctx.lineTo(pt.x, pt.y);
            }
            ctx.stroke();
            ctx.restore();
        }

        // Selection Rect
        if (this.isSelecting && this.selectionRect) {
            const r = this.selectionRect;
            ctx.fillStyle = 'rgba(0, 255, 136, 0.1)';
            ctx.strokeStyle = '#00ff88';
            ctx.lineWidth = 1 / this.zoom;
            ctx.fillRect(r.x1, r.y1, r.x2 - r.x1, r.y2 - r.y1);
            ctx.strokeRect(r.x1, r.y1, r.x2 - r.x1, r.y2 - r.y1);
        }

        // Spawn marker
        ctx.fillStyle = '#00ff88';
        ctx.globalAlpha = 0.5;
        ctx.fillRect(3 * gs, 10 * gs, gs, gs);
        ctx.globalAlpha = 1;
        ctx.fillStyle = '#fff';
        ctx.font = `${10}px sans-serif`;
        ctx.textAlign = 'center';
        ctx.fillText('START', 3 * gs + gs / 2, 10 * gs + gs / 2 + 4);

        // Music Sync Line
        if (this.isPlayingMusic && typeof AudioManager !== 'undefined' && AudioManager.music) {
            const speeds = { slow: 4.5, normal: 6.5, fast: 8.5, vfast: 10.0, vvfast: 12.0 };
            const blocksPerSec = (speeds[this.levelSpeed || 'normal'] * 60) / gs;
            const currentTime = AudioManager.music.currentTime;

            // X position: start position (3 blocks) + distance travelled
            const syncX = (3 + (currentTime * blocksPerSec)) * gs;

            ctx.beginPath();
            ctx.strokeStyle = '#ff0055';
            ctx.lineWidth = 2 / this.zoom;
            ctx.setLineDash([10 / this.zoom, 10 / this.zoom]);
            ctx.moveTo(syncX, this.camY);
            ctx.lineTo(syncX, this.camY + H / this.zoom);
            ctx.stroke();
            ctx.setLineDash([]);

            // Optional: Auto pan camera if the sync line is going off screen
            if (syncX > this.camX + (W / this.zoom) * 0.8) {
                this.camX = syncX - (W / this.zoom) * 0.2;
            }
        }

        ctx.restore();

        // Info text
        ctx.fillStyle = 'rgba(255,255,255,0.3)';
        ctx.font = '11px monospace';
        ctx.textAlign = 'left';
        ctx.fillText(`Zoom: ${(this.zoom * 100).toFixed(0)}%  |  Objects: ${this.objects.length}  |  Right-click: delete  |  Scroll: zoom  |  Alt+drag: pan`, 10, H - 10);

        requestAnimationFrame(() => { });
    },

    /* ── Settings Modal ── */
    showSettings() {
        const modal = document.getElementById('editor-settings-modal');
        if (!modal) return;

        const nameInput = document.getElementById('setting-name');
        const diffInput = document.getElementById('setting-difficulty');
        const starsInput = document.getElementById('setting-stars');
        const speedInput = document.getElementById('setting-speed');
        const songInput = document.getElementById('setting-song');
        const customIdInput = document.getElementById('setting-custom-song-id');
        const offsetInput = document.getElementById('setting-song-offset');
        const bgInput = document.getElementById('setting-bg');
        const gndInput = document.getElementById('setting-ground');

        if (nameInput) nameInput.value = this.levelName;
        if (diffInput) diffInput.value = (this.levelDifficulty || 'normal').toLowerCase();
        if (starsInput) starsInput.value = this.levelStars || 0;
        if (speedInput) speedInput.value = this.levelSpeed;
        if (songInput) songInput.value = this.levelSong || 'StereoMadness.mp3';
        if (customIdInput) customIdInput.value = this.levelCustomSongId || '';
        if (offsetInput) offsetInput.value = this.levelSongOffset || 0;
        if (bgInput) bgInput.value = this.levelBgColor;
        if (gndInput) gndInput.value = this.levelGroundColor;

        modal.classList.add('active');
    },

    hideSettings() {
        const modal = document.getElementById('editor-settings-modal');
        if (!modal) return;

        const nameInput = document.getElementById('setting-name');
        const diffInput = document.getElementById('setting-difficulty');
        const starsInput = document.getElementById('setting-stars');
        const speedInput = document.getElementById('setting-speed');
        const songInput = document.getElementById('setting-song');
        const customIdInput = document.getElementById('setting-custom-song-id');
        const offsetInput = document.getElementById('setting-song-offset');
        const bgInput = document.getElementById('setting-bg');
        const gndInput = document.getElementById('setting-ground');

        if (nameInput) this.levelName = nameInput.value || 'My Level';
        if (diffInput) this.levelDifficulty = diffInput.value;
        if (starsInput) this.levelStars = parseInt(starsInput.value) || 0;
        if (speedInput) this.levelSpeed = speedInput.value;
        if (songInput) this.levelSong = songInput.value;
        if (customIdInput) this.levelCustomSongId = customIdInput.value;
        if (offsetInput) this.levelSongOffset = parseFloat(offsetInput.value) || 0;
        if (bgInput) this.levelBgColor = bgInput.value;
        if (gndInput) this.levelGroundColor = gndInput.value;

        modal.classList.remove('active');
        this.render();
    },

    /* ── Object Popup Modal ── */
    showObjectPopup(obj) {
        const modal = document.getElementById('object-popup-modal');
        const content = document.getElementById('popup-content');
        if (!modal || !content) return;

        const type = getObjectType(obj.type);
        document.getElementById('popup-title').innerText = `${type.id.toUpperCase()} SETTINGS`;

        // Use the same form generation as properties panel but in the modal
        this.renderPropertiesForm(content, obj);

        modal.classList.add('active');
    },

    hideObjectPopup() {
        const modal = document.getElementById('object-popup-modal');
        if (modal) modal.classList.remove('active');
        this.render();
    }
};
