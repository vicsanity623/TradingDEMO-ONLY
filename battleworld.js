(function () {
    // --- ASSETS ---
    const ASSETS = {
        GROUND_TILE: "IMG_0287.png",
        HOUSE: "IMG_0299.png",
        TREE: "IMG_0300.png",
        NPC: "IMG_0292.png",
        ENEMY_FALLBACK: "freeza.png"
    };

    const canvas = document.getElementById('explore-canvas');
    const ctx = canvas.getContext('2d');
    const WORLD_WIDTH = 4000, WORLD_HEIGHT = 4000; 

    // GAME STATE
    let isRunning = false, isEnding = false;
    let lastTime = 0, camera = { x: 0, y: 0 };
    let bgImage = new Image(), imgHouse = new Image(), imgTree = new Image(), imgNpc = new Image();

    // TIMER & STATS
    let exploreTimer = 120; // 2 Minutes
    let kills = 0;
    let sessionLoot = { coins: 0, shards: 0 };

    // QUEST
    let questLog = {
        active: null, 
        completedCount: 0
    };

    // ENTITIES
    let player = { x: WORLD_WIDTH / 2, y: WORLD_WIDTH / 2 + 200, size: 60, speed: 8, hp: 100, maxHp: 100, faceRight: true, invincible: 0, img: new Image() };
    let enemies = [], npcs = [], bullets = [], particles = [], loots = [], structures = [], floatingTexts = [];
    let zones = [];

    const input = { x: 0, y: 0, charging: false, chargeVal: 0 };

    // --- INIT ---
    function initExplore() {
        if (isRunning) return;

        // Reset State
        isRunning = true;
        isEnding = false;
        exploreTimer = 120.0; // Reset Timer

        // Sync Stats
        if (window.GameState) {
            player.maxHp = window.GameState.gokuMaxHP || 1000;
            player.hp = window.player.hp > 0 ? window.player.hp : player.maxHp;
        } else {
            player.maxHp = 1000; player.hp = 1000;
        }

        // Load Assets
        const hudSprite = document.getElementById('ui-sprite');
        player.img.src = (hudSprite && hudSprite.src) ? hudSprite.src : "IMG_0061.png";

        if (window.RpgAssets && window.RpgAssets[ASSETS.GROUND_TILE]) bgImage = window.RpgAssets[ASSETS.GROUND_TILE];
        else bgImage.src = ASSETS.GROUND_TILE;

        if (window.RpgAssets && window.RpgAssets[ASSETS.HOUSE]) imgHouse = window.RpgAssets[ASSETS.HOUSE];
        else imgHouse.src = ASSETS.HOUSE;

        if (window.RpgAssets && window.RpgAssets[ASSETS.TREE]) imgTree = window.RpgAssets[ASSETS.TREE];
        else imgTree.src = ASSETS.TREE;

        if (window.RpgAssets && window.RpgAssets[ASSETS.NPC]) imgNpc = window.RpgAssets[ASSETS.NPC];
        else imgNpc.src = ASSETS.NPC;

        resize(); window.addEventListener('resize', resize);
        setupControls();

        // Generate World if empty
        if (structures.length === 0) generateWorld();

        enemies = []; bullets = []; particles = []; loots = []; floatingTexts = [];
        sessionLoot = { coins: 0, shards: 0 };
        kills = 0;

        if (!questLog.active) assignRandomQuest();

        // Inject Timer UI if missing
        ensureTimerUI();

        updateHUD();
        requestAnimationFrame(loop);

        // Spawn Loop
        setInterval(() => {
            if (isRunning && !isEnding && enemies.length < 15) spawnEnemyInZone();
        }, 3000);
    }

    function ensureTimerUI() {
        if (!document.getElementById('rpg-timer-display')) {
            const container = document.querySelector('.rpg-hud-top-left'); // Assuming this class exists from your CSS
            // If strictly using the pasted code structure, we append to body or existing hud container
            const hud = document.getElementById('view-explore');
            const d = document.createElement('div');
            d.id = 'rpg-timer-display';
            d.style.position = 'absolute';
            d.style.top = '160px'; // Below Soul Meter
            d.style.left = '20px';
            d.style.color = '#ff3e3e';
            d.style.fontFamily = 'Impact, sans-serif';
            d.style.fontSize = '24px';
            d.style.textShadow = '2px 2px 0px #000';
            d.style.zIndex = '100';
            hud.appendChild(d);
        }
    }

    function stopExplore() { isRunning = false; }
    function resize() { canvas.width = window.innerWidth; canvas.height = window.innerHeight; }

    function generateWorld() {
        structures = []; npcs = []; zones = [];
        zones.push({ type: 'VILLAGE', x: 2000, y: 2000, r: 600 });
        zones.push({ type: 'FOREST', x: 1000, y: 1000, r: 800 });
        zones.push({ type: 'FOREST', x: 3000, y: 3000, r: 800 });
        zones.push({ type: 'RUINS', x: 3000, y: 1000, r: 700 });
        zones.push({ type: 'WASTELAND', x: 1000, y: 3000, r: 700 });

        structures.push({ type: 'fountain', x: 2000, y: 2000, w: 150, h: 150, color: 'cyan', solid: true });
        for (let i = 0; i < 8; i++) {
            let a = (i / 8) * Math.PI * 2;
            structures.push({ type: 'house', x: 2000 + Math.cos(a) * 400, y: 2000 + Math.sin(a) * 400, w: 200, h: 200, img: imgHouse, solid: true });
        }
        npcs.push({ x: 2000, y: 2150, name: "Elder Guru", dialog: ["Welcome.", "Hurry, time is short!"], type: 'quest', img: imgNpc });
        npcs.push({ x: 1900, y: 2000, name: "Merchant", dialog: ["Quickly now.", "The dimension is unstable."], type: 'shop', img: imgNpc });

        zones.filter(z => z.type === 'FOREST').forEach(z => {
            for (let i = 0; i < 40; i++) {
                let rx = z.x + (Math.random() - 0.5) * z.r * 1.5;
                let ry = z.y + (Math.random() - 0.5) * z.r * 1.5;
                structures.push({ type: 'tree', x: rx, y: ry, w: 120, h: 120, img: imgTree, solid: true });
            }
        });
        zones.filter(z => z.type === 'RUINS').forEach(z => {
            for (let i = 0; i < 20; i++) {
                let rx = z.x + (Math.random() - 0.5) * z.r;
                let ry = z.y + (Math.random() - 0.5) * z.r;
                structures.push({ type: 'tree', x: rx, y: ry, w: 120, h: 120, img: imgTree, solid: true, tint: 'yellow' });
            }
        });
    }

    function setupControls() {
        const joyZone = document.getElementById('joy-zone');
        const stick = document.getElementById('joy-stick');
        let startX, startY, activeId = null;

        const updateStick = (cx, cy) => {
            const maxDist = 50;
            let dx = cx - startX; let dy = cy - startY;
            const dist = Math.sqrt(dx * dx + dy * dy);
            if (dist > maxDist) { dx = (dx / dist) * maxDist; dy = (dy / dist) * maxDist; }
            stick.style.transform = `translate(calc(-50% + ${dx}px), calc(-50% + ${dy}px))`;
            input.x = dx / maxDist; input.y = dy / maxDist;
        };
        const startMove = (cx, cy, id) => {
            activeId = id; startX = cx; startY = cy;
            stick.style.display = 'block'; stick.style.left = startX + 'px'; stick.style.top = startY + 'px'; stick.style.transform = `translate(-50%, -50%)`;
            input.x = 0; input.y = 0;
        };
        const endMove = () => { activeId = null; input.x = 0; input.y = 0; stick.style.display = 'none'; };

        joyZone.addEventListener('touchstart', e => { e.preventDefault(); if (activeId !== null) return; startMove(e.changedTouches[0].clientX, e.changedTouches[0].clientY, e.changedTouches[0].identifier); }, { passive: false });
        joyZone.addEventListener('touchmove', e => { e.preventDefault(); for (let i = 0; i < e.changedTouches.length; i++) { if (e.changedTouches[i].identifier === activeId) updateStick(e.changedTouches[i].clientX, e.changedTouches[i].clientY); } }, { passive: false });
        joyZone.addEventListener('touchend', endMove);
        joyZone.addEventListener('mousedown', e => { e.preventDefault(); startMove(e.clientX, e.clientY, 'mouse'); });
        window.addEventListener('mousemove', e => { if (activeId === 'mouse') { e.preventDefault(); updateStick(e.clientX, e.clientY); } });
        window.addEventListener('mouseup', () => { if (activeId === 'mouse') endMove(); });

        document.getElementById('btn-ex-attack').onmousedown = () => { if (!input.charging) shoot(); };
        document.getElementById('btn-ex-attack').ontouchstart = (e) => { e.preventDefault(); if (!input.charging) shoot(); };
        document.getElementById('btn-ex-dodge').onmousedown = () => { if (!input.charging) dodge(); };
        document.getElementById('btn-ex-dodge').ontouchstart = (e) => { e.preventDefault(); if (!input.charging) dodge(); };

        const btnCharge = document.getElementById('btn-ex-charge');
        const startC = (e) => { e.preventDefault(); input.charging = true; };
        const endC = (e) => { e.preventDefault(); if (input.chargeVal >= 100) unleashUltimate(); input.charging = false; input.chargeVal = 0; document.getElementById('ex-charge-overlay').style.display = 'none'; };
        btnCharge.onmousedown = startC; btnCharge.onmouseup = endC;
        btnCharge.ontouchstart = startC; btnCharge.ontouchend = endC;

        const btnInteract = document.getElementById('btn-interact-explore');
        if (btnInteract) {
            btnInteract.onclick = (e) => { e.stopPropagation(); tryInteract(); };
            btnInteract.ontouchstart = (e) => { e.preventDefault(); e.stopPropagation(); tryInteract(); };
        }
    }

    function spawnEnemyInZone() {
        const zone = zones[Math.floor(Math.random() * zones.length)];
        if (zone.type === 'VILLAGE') return;
        let cx = zone.x + (Math.random() - 0.5) * zone.r;
        let cy = zone.y + (Math.random() - 0.5) * zone.r;
        if (Math.hypot(cx - player.x, cy - player.y) < 800) return;

        const gPower = window.GameState ? window.GameState.gokuPower : 100;
        const eImg = new Image();
        const localEnemies = ["freeza.png", "cell.png", "majin_buu.png"];
        eImg.src = localEnemies[Math.floor(Math.random() * localEnemies.length)];

        let mult = 1.0;
        if (zone.type === 'RUINS') mult = 1.5;
        if (zone.type === 'WASTELAND') mult = 2.0;

        enemies.push({
            x: cx, y: cy, originX: cx, originY: cy, patrolX: cx, patrolY: cy, state: 'patrol', waitTimer: 0, size: 80, 
            hp: gPower * 5 * mult, maxHp: gPower * 5 * mult, atk: player.maxHp * 0.05 * mult, speed: 3 + (mult - 1) * 2, img: eImg
        });
    }

    function checkCollisions(newX, newY) {
        for (let s of structures) {
            if (!s.solid) continue;
            if (newX > s.x - s.w / 2 - 20 && newX < s.x + s.w / 2 + 20 && newY > s.y - s.h / 2 - 20 && newY < s.y + s.h / 2 + 20) return true;
        }
        if (newX < 0 || newX > WORLD_WIDTH || newY < 0 || newY > WORLD_HEIGHT) return true;
        return false;
    }

    function tryInteract() {
        if (questLog.active && questLog.active.progress >= questLog.active.target) { openQuestCompleteDialog(); return; }
        let nearest = null; let minD = 100;
        npcs.forEach(n => { let d = Math.hypot(n.x - player.x, n.y - player.y); if (d < minD) { minD = d; nearest = n; } });
        if (nearest) openDialog(nearest);
    }

    function openDialog(npc) {
        const overlay = document.getElementById('explore-interaction-overlay');
        const dName = document.getElementById('dialog-name');
        const dText = document.getElementById('dialog-text');
        const dChoices = document.getElementById('dialog-choices');
        overlay.style.display = 'flex'; dName.innerText = npc.name; dText.innerText = npc.dialog[Math.floor(Math.random() * npc.dialog.length)];
        dChoices.innerHTML = ''; const btn = document.createElement('button'); btn.className = 'rpg-choice-btn confirm'; btn.innerText = "Goodbye"; btn.onclick = () => { overlay.style.display = 'none'; }; dChoices.appendChild(btn);
    }

    function openQuestCompleteDialog() {
        const overlay = document.getElementById('explore-interaction-overlay');
        const dName = document.getElementById('dialog-name');
        const dText = document.getElementById('dialog-text');
        const dChoices = document.getElementById('dialog-choices');
        overlay.style.display = 'flex'; dName.innerText = "Quest Log"; dText.innerText = `Mission Complete! \nReward: ${questLog.active.rewardCoins} Coins, ${questLog.active.rewardXp} XP.`;
        dChoices.innerHTML = ''; const btn = document.createElement('button'); btn.className = 'rpg-choice-btn confirm'; btn.innerText = "Claim Reward";
        btn.onclick = () => { completeQuest(); overlay.style.display = 'none'; }; dChoices.appendChild(btn);
    }

    function assignRandomQuest() {
        questLog.completedCount++;
        const target = 5 + Math.floor(questLog.completedCount * 0.5);
        let rXp = 500 + (questLog.completedCount * 250);
        if (window.player && window.player.nextXp) rXp = Math.floor(window.player.nextXp * 0.15);
        questLog.active = { desc: "Defeat Enemies", target: target, progress: 0, rewardCoins: 1000 + (questLog.completedCount * 200), rewardXp: rXp };
        updateHUD();
    }

    function completeQuest() {
        if (!questLog.active) return;
        if (window.player) { window.player.coins += questLog.active.rewardCoins; window.player.xp += questLog.active.rewardXp; sessionLoot.coins += questLog.active.rewardCoins; if (typeof window.checkLevelUp === 'function') window.checkLevelUp(); }
        assignRandomQuest();
    }

    function checkQuestProgress() {
        if (questLog.active && questLog.active.progress < questLog.active.target) { questLog.active.progress++; updateHUD(); }
    }

    function shoot() {
        if(isEnding) return;
        let vx = input.x, vy = input.y;
        if (Math.abs(vx) < 0.1 && Math.abs(vy) < 0.1) {
            let nearest = null, minD = 600;
            enemies.forEach(e => { let d = Math.hypot(e.x - player.x, e.y - player.y); if (d < minD) { minD = d; nearest = e; } });
            if (nearest) { let a = Math.atan2(nearest.y - player.y, nearest.x - player.x); vx = Math.cos(a); vy = Math.sin(a); } else { vx = player.faceRight ? 1 : -1; vy = 0; }
        }
        player.faceRight = vx > 0;
        bullets.push({ x: player.x, y: player.y, vx: vx * 22, vy: vy * 22, life: 50, damage: window.GameState ? window.GameState.gokuPower : 50 });
    }

    function dodge() {
        if(isEnding) return;
        let dx = input.x || (player.faceRight ? 1 : -1), dy = input.y || 0, len = Math.sqrt(dx * dx + dy * dy) || 1;
        player.x += dx / len * 300; player.y += dy / len * 300;
        player.x = Math.max(0, Math.min(WORLD_WIDTH, player.x)); player.y = Math.max(0, Math.min(WORLD_HEIGHT, player.y));
        for (let i = 0; i < 6; i++) particles.push({ x: player.x, y: player.y, vx: (Math.random() - 0.5) * 12, vy: (Math.random() - 0.5) * 12, life: 15, color: 'cyan' });
    }

    function unleashUltimate() {
        if(isEnding) return;
        const o = document.getElementById('view-explore'), f = document.createElement('div');
        f.className = 'flash-screen'; o.appendChild(f); setTimeout(() => f.remove(), 2500);
        enemies.forEach(e => { if (Math.hypot(e.x - player.x, e.y - player.y) < 800) { e.hp = 0; for (let i = 0; i < 10; i++) particles.push({ x: e.x, y: e.y, vx: (Math.random() - 0.5) * 25, vy: (Math.random() - 0.5) * 25, life: 30, color: 'orange' }); } });
    }

    // --- UPDATED SPAWN LOOT: NERFED ---
    function spawnLoot(x, y, isStrong) {
        const count = isStrong ? 5 : 2;
        for (let i = 0; i < count; i++) {
            // SHARD LOGIC: 0.8% Chance per loot item
            // HARD CAP: Max 3 Shards per Explore Session
            let isShard = Math.random() > 0.992;
            
            if (isShard && sessionLoot.shards >= 25) {
                isShard = false; // Cap reached, force coin
            }

            loots.push({
                x: x, y: y, 
                type: isShard ? 'shard' : 'coin',
                val: 100, 
                vx: (Math.random() - 0.5) * 15, 
                vy: (Math.random() - 0.5) * 15
            });
        }
    }

    function triggerTimeUp() {
        if (isEnding) return;
        isEnding = true;

        // Visual Explosion
        for (let i = 0; i < 150; i++) {
            particles.push({
                x: player.x,
                y: player.y,
                vx: (Math.random() - 0.5) * 15,
                vy: (Math.random() - 0.5) * 15,
                life: 120,
                color: Math.random() > 0.5 ? 'orange' : 'white'
            });
        }

        // Floating Text Chaos
        floatingTexts.push({ x: player.x, y: player.y - 50, text: "DIMENSION COLLAPSE!", color: "red", life: 120, vy: -0.5 });

        // Force Exit after 2.5 seconds
        setTimeout(() => {
            stopExplore();
            if (typeof window.showTab === 'function') window.showTab('char');
        }, 2500);
    }

    // --- MAIN LOOP ---
    function loop(timestamp) {
        if (!isRunning) return;
        
        // Pause if modal open
        if (document.getElementById('levelup-modal') && document.getElementById('levelup-modal').style.display === 'flex') {
            requestAnimationFrame(loop);
            return;
        }

        const dt = timestamp - lastTime; lastTime = timestamp;
        
        // --- TIMER LOGIC ---
        if (!isEnding) {
            exploreTimer -= (dt / 1000);
            if (exploreTimer <= 0) {
                exploreTimer = 0;
                triggerTimeUp();
            }
        }
        
        ctx.clearRect(0, 0, canvas.width, canvas.height);

        // Movement (Disabled if ending)
        if (!isEnding) {
            if (input.charging) {
                input.chargeVal += 1.2; if (input.chargeVal > 100) input.chargeVal = 100;
                const h = document.getElementById('ex-charge-overlay'); if (h) { h.style.display = 'block'; document.getElementById('ex-charge-fill').style.width = input.chargeVal + '%'; }
                player.x += (Math.random() - 0.5) * 6; player.y += (Math.random() - 0.5) * 6;
            } else {
                let nextX = player.x + input.x * player.speed;
                let nextY = player.y + input.y * player.speed;
                if (!checkCollisions(nextX, player.y)) player.x = nextX;
                if (!checkCollisions(player.x, nextY)) player.y = nextY;
                if (input.x > 0) player.faceRight = true; if (input.x < 0) player.faceRight = false;
            }
        }

        camera.x = Math.max(0, Math.min(WORLD_WIDTH - canvas.width, player.x - canvas.width / 2));
        camera.y = Math.max(0, Math.min(WORLD_HEIGHT - canvas.height, player.y - canvas.height / 2));

        ctx.save(); ctx.translate(-camera.x, -camera.y);

        // 1. BG
        if (bgImage.complete && bgImage.naturalWidth > 0) { const p = ctx.createPattern(bgImage, 'repeat'); ctx.fillStyle = p; ctx.fillRect(camera.x, camera.y, canvas.width, canvas.height); } 
        else { ctx.fillStyle = '#2c3e50'; ctx.fillRect(camera.x, camera.y, canvas.width, canvas.height); }

        // 2. Loot
        for (let i = loots.length - 1; i >= 0; i--) {
            let l = loots[i]; l.x += l.vx; l.y += l.vy; l.vx *= 0.9; l.vy *= 0.9;
            if (!isEnding && Math.hypot(player.x - l.x, player.y - l.y) < 250) { l.x += (player.x - l.x) * 0.15; l.y += (player.y - l.y) * 0.15; }
            if (!isEnding && Math.hypot(player.x - l.x, player.y - l.y) < 50) {
                if (window.player) {
                    if (l.type === 'coin') { window.player.coins += 100; sessionLoot.coins += 100; }
                    else if (l.type === 'shard') { window.player.dragonShards = (window.player.dragonShards || 0) + 1; sessionLoot.shards++; }
                }
                loots.splice(i, 1); updateHUD(); continue;
            }
            ctx.beginPath(); ctx.arc(l.x, l.y, 8, 0, Math.PI * 2); ctx.fillStyle = l.type === 'coin' ? 'gold' : 'cyan'; ctx.fill(); ctx.strokeStyle = 'white'; ctx.lineWidth = 2; ctx.stroke();
        }

        // 3. Structures
        structures.forEach(s => {
            if (s.x < camera.x - 200 || s.x > camera.x + canvas.width + 200) return;
            if (s.y < camera.y - 200 || s.y > camera.y + canvas.height + 200) return;
            if (s.img && s.img.complete) {
                if (s.tint === 'yellow') { ctx.save(); ctx.filter = 'sepia(1) saturate(3) hue-rotate(45deg)'; ctx.drawImage(s.img, s.x - s.w / 2, s.y - s.h / 2, s.w, s.h); ctx.restore(); }
                else ctx.drawImage(s.img, s.x - s.w / 2, s.y - s.h / 2, s.w, s.h);
            } else { ctx.fillStyle = s.color || 'brown'; ctx.fillRect(s.x - s.w / 2, s.y - s.h / 2, s.w, s.h); }
        });

        // 4. Enemies
        for (let i = enemies.length - 1; i >= 0; i--) {
            let e = enemies[i];
            if (!isEnding) {
                if (e.state === 'patrol') {
                    if (e.waitTimer > 0) e.waitTimer--; else { let d = Math.hypot(e.patrolX - e.x, e.patrolY - e.y); if (d < 10) { e.waitTimer = 60 + Math.random() * 60; e.patrolX = e.originX + (Math.random() - 0.5) * 300; e.patrolY = e.originY + (Math.random() - 0.5) * 300; } else { let a = Math.atan2(e.patrolY - e.y, e.patrolX - e.x); e.x += Math.cos(a) * 1.5; e.y += Math.sin(a) * 1.5; } }
                } else { let a = Math.atan2(player.y - e.y, player.x - e.x); e.x += Math.cos(a) * e.speed; e.y += Math.sin(a) * e.speed; }
            }

            try { if (e.img.complete) ctx.drawImage(e.img, e.x - 40, e.y - 40, 80, 80); else { ctx.fillStyle = 'purple'; ctx.fillRect(e.x - 40, e.y - 40, 80, 80); } } catch (er) { }
            ctx.fillStyle = 'red'; ctx.fillRect(e.x - 30, e.y - 50, 60, 6); ctx.fillStyle = 'lime'; ctx.fillRect(e.x - 30, e.y - 50, 60 * Math.max(0, e.hp / e.maxHp), 6);

            for (let j = bullets.length - 1; j >= 0; j--) {
                if (Math.hypot(bullets[j].x - e.x, bullets[j].y - e.y) < 50) {
                    e.hp -= bullets[j].damage; e.state = 'chase'; e.x += bullets[j].vx * 0.2; e.y += bullets[j].vy * 0.2; bullets.splice(j, 1);
                }
            }

            if (!isEnding && Math.hypot(player.x - e.x, player.y - e.y) < 60) {
                if (player.invincible <= 0) { player.hp -= (input.charging ? e.atk * 2 : e.atk); player.invincible = 30; updateHUD(); }
            }

            if (e.hp <= 0) {
                spawnLoot(e.x, e.y, true);
                if (window.SoulSystem) { window.SoulSystem.gainSoul(); floatingTexts.push({ x: e.x, y: e.y, text: "+1 SOUL", color: "#00ffff", life: 60, vy: -1 }); }
                enemies.splice(i, 1); kills++; 
                window.player.exploreKills = (window.player.exploreKills || 0) + 1;
                checkQuestProgress();
            }
        }

        // 5. Projectiles
        ctx.fillStyle = '#00ffff'; for (let i = bullets.length - 1; i >= 0; i--) { let b = bullets[i]; b.x += b.vx; b.y += b.vy; b.life--; ctx.beginPath(); ctx.arc(b.x, b.y, 10, 0, Math.PI * 2); ctx.fill(); if (b.life <= 0) bullets.splice(i, 1); }

        // 6. Player (HIDE IF ENDING)
        if (!isEnding) {
            ctx.save();
            if (!player.faceRight) { ctx.translate(player.x + 30, player.y); ctx.scale(-1, 1); ctx.translate(-(player.x + 30), -player.y); }
            if (input.charging) { ctx.shadowColor = 'white'; ctx.shadowBlur = 25; }
            if (player.img.complete) ctx.drawImage(player.img, player.x - 30, player.y - 30, 60, 60);
            else { ctx.fillStyle = 'orange'; ctx.fillRect(player.x - 30, player.y - 30, 60, 60); }
            ctx.restore();
        }

        // 7. NPCs
        npcs.forEach(n => { if (n.img && n.img.complete) ctx.drawImage(n.img, n.x - 30, n.y - 30, 60, 60); else { ctx.fillStyle = 'white'; ctx.beginPath(); ctx.arc(n.x, n.y, 15, 0, Math.PI * 2); ctx.fill(); } ctx.fillStyle = 'yellow'; ctx.font = 'bold 20px Arial'; ctx.fillText("!", n.x - 5, n.y - 40); });

        // 8. Particles
        for (let i = particles.length - 1; i >= 0; i--) {
            let p = particles[i]; p.x += p.vx; p.y += p.vy; p.life--;
            ctx.fillStyle = p.color; ctx.globalAlpha = p.life / 20; ctx.beginPath(); ctx.arc(p.x, p.y, 4, 0, Math.PI * 2); ctx.fill(); ctx.globalAlpha = 1; if (p.life <= 0) particles.splice(i, 1);
        }

        // 9. Floating Texts
        ctx.font = 'bold 20px "Bangers"'; ctx.textAlign = 'center';
        for (let i = floatingTexts.length - 1; i >= 0; i--) {
            let f = floatingTexts[i]; f.y += f.vy; f.life--; ctx.fillStyle = f.color; ctx.shadowColor = 'black'; ctx.shadowBlur = 4; ctx.globalAlpha = Math.max(0, f.life / 20); ctx.fillText(f.text, f.x, f.y); ctx.globalAlpha = 1; ctx.shadowBlur = 0; if (f.life <= 0) floatingTexts.splice(i, 1);
        }

        ctx.restore();

        // 10. Minimap
        ctx.fillStyle = 'rgba(0,0,0,0.5)'; ctx.fillRect(canvas.width - 160, 10, 150, 150);
        ctx.strokeStyle = 'white'; ctx.lineWidth = 2; ctx.strokeRect(canvas.width - 160, 10, 150, 150);
        const ms = 150 / WORLD_WIDTH;
        if(!isEnding) { ctx.fillStyle = 'lime'; ctx.beginPath(); ctx.arc((canvas.width - 160) + player.x * ms, 10 + player.y * ms, 3, 0, Math.PI * 2); ctx.fill(); }
        ctx.fillStyle = '#aaa'; structures.forEach(s => { if (s.solid) ctx.fillRect((canvas.width - 160) + s.x * ms, 10 + s.y * ms, s.w * ms, s.h * ms); });
        ctx.fillStyle = 'cyan'; npcs.forEach(n => { ctx.beginPath(); ctx.arc((canvas.width - 160) + n.x * ms, 10 + n.y * ms, 3, 0, Math.PI * 2); ctx.fill(); });
        ctx.fillStyle = 'red'; enemies.forEach(e => { ctx.beginPath(); ctx.arc((canvas.width - 160) + e.x * ms, 10 + e.y * ms, 2, 0, Math.PI * 2); ctx.fill(); });

        if (player.invincible > 0) player.invincible--;
        if (player.hp <= 0 && !isEnding) { window.customAlert("GOKU DEFEATED!", () => stopExplore()); return; }

        checkInteractions();
        
        // Update HUD per frame for Timer/Glitch effects
        updateHUD();

        requestAnimationFrame(loop);
    }

    function checkInteractions() {
        if(isEnding) {
             const btn = document.getElementById('btn-interact-explore');
             if(btn) btn.style.display = 'none';
             return;
        }
        let near = false; let actionText = "TALK";
        if (questLog.active && questLog.active.progress >= questLog.active.target) { near = true; actionText = "CLAIM"; } 
        else { npcs.forEach(n => { if (Math.hypot(n.x - player.x, n.y - player.y) < 80) near = true; }); }
        const btn = document.getElementById('btn-interact-explore');
        if (btn) { if (near) { btn.style.display = 'flex'; btn.innerHTML = actionText; } else { btn.style.display = 'none'; } }
    }

    function updateHUD() {
        const hpText = document.getElementById('rpg-hp-text');
        
        // GLITCH HP EFFECT ON ENDING
        if (isEnding && hpText) {
             const randomVal = Math.floor(Math.random() * 999999999);
             hpText.innerText = `FATAL ERROR: ${randomVal}`;
             hpText.style.color = Math.random() > 0.5 ? 'red' : 'yellow';
        } else if (hpText) {
             hpText.innerText = `${Math.ceil(player.hp)} / ${Math.ceil(player.maxHp)}`;
             hpText.style.color = 'white';
        }

        document.getElementById('rpg-hp-fill').style.width = Math.max(0, (player.hp / player.maxHp) * 100) + "%";
        const xpPct = window.player ? (window.player.xp / window.player.nextXp) * 100 : 0;
        document.getElementById('rpg-xp-text').innerText = `XP ${Math.floor(xpPct)}%`;
        document.getElementById('rpg-xp-fill').style.width = xpPct + "%";
        document.getElementById('loot-coins').innerHTML = `💰 <span>${sessionLoot.coins}</span>`;
        document.getElementById('loot-shards').innerHTML = `💎 <span>${sessionLoot.shards}</span>`;

        if (window.SoulSystem) {
            const sm = document.getElementById('rpg-soul-meter'); if (sm) sm.style.display = 'flex';
            const souls = window.player.souls || 0; const maxSouls = window.SoulSystem.getSoulsNeeded(); const pct = Math.min(100, Math.floor((souls / maxSouls) * 100));
            document.getElementById('rpg-soul-fill').style.width = pct + "%"; document.getElementById('rpg-soul-text').innerText = `SOUL ${pct}%`;
            if (pct >= 100) { document.getElementById('rpg-soul-text').innerText = "SOUL FULL!"; document.getElementById('rpg-soul-text').style.color = "#00ffff"; } 
            else { document.getElementById('rpg-soul-text').style.color = "white"; }
        }

        const q = document.getElementById('quest-desc');
        if (q && questLog.active) {
            if (questLog.active.progress >= questLog.active.target) { q.innerText = "Complete! Tap Interact."; q.style.color = '#00ff00'; } 
            else { q.innerText = `${questLog.active.desc}: ${questLog.active.progress}/${questLog.active.target}`; q.style.color = 'white'; }
        }

        // TIMER UPDATE
        const tDisp = document.getElementById('rpg-timer-display');
        if (tDisp) {
            const m = Math.floor(exploreTimer / 60);
            const s = Math.floor(exploreTimer % 60);
            const sStr = s < 10 ? `0${s}` : s;
            tDisp.innerText = `TIME: ${m}:${sStr}`;
            if (exploreTimer < 10) tDisp.style.color = (Math.floor(Date.now() / 200) % 2 === 0) ? 'red' : 'white';
            else tDisp.style.color = '#ff3e3e';
        }
    }

    window.initExplore = initExplore;
    window.stopExplore = stopExplore;

})();