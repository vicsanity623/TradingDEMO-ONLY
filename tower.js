// tower.js - Advanced RPG Engine (Save/Load, Swarm Universe, Canvas Trails, Infinite Shops)

(function () {

    // --- GAME STATE & SAVE SYSTEM ---
    const SAVE_KEY = "dbz_endless_universe_v1";

    const DEFAULT_PLAYER = {
        lvl: 1, xp: 0, nextXp: 100, coins: 0,
        bAtk: 50, bDef: 20, bHp: 1000,
        inv: [], gear: { w: null, a: null }, selected: -1,
        dungeonKeys: 10, senzuBeans: 0, maxFloor: 1, 
        shop: { zsword: 0, potara: 0, godki: 0 },
        dStats: { dmg: 0, hit: 0, loot: 0, kills: 0 }
    };

    window.player = structuredClone(DEFAULT_PLAYER);

    function saveGame() {
        localStorage.setItem(SAVE_KEY, JSON.stringify(player));
    }

    function loadGame() {
        try {
            const data = localStorage.getItem(SAVE_KEY);
            if (data) {
                const parsed = JSON.parse(data);
                // Deep merge to prevent missing properties in old saves
                window.player = { ...DEFAULT_PLAYER, ...parsed };
                if(parsed.shop) window.player.shop = { ...DEFAULT_PLAYER.shop, ...parsed.shop };
                if(parsed.dStats) window.player.dStats = { ...DEFAULT_PLAYER.dStats, ...parsed.dStats };
            }
        } catch (e) { console.error("Save corrupted"); }
    }

    // Auto-save every 5 seconds
    setInterval(saveGame, 5000);
    window.addEventListener('beforeunload', saveGame);

    // --- DUNGEON DATA ---
    const DUNGEONS = {
        buu: { name: "Majin Buu", img: "majin_buu.png", hp: 5000, atk: 150, color: "#ff79c6" },
        frieza: { name: "Frieza", img: "freeza.png", hp: 15000, atk: 400, color: "#bd93f9" },
        cell: { name: "Cell", img: "cell.png", hp: 50000, atk: 1200, color: "#50fa7b" }
    };

    let combatState = {
        active: false, type: '', floor: 1, bossKey: null,
        p: { hp: 0, maxHp: 0, atk: 0, def: 0, x: 20, y: 50, vx: 0, vy: 0, el: null, history: [] },
        e: { hp: 0, maxHp: 0, atk: 0, def: 0, x: 80, y: 50, vx: 0, vy: 0, el: null, stun: 0, history: [] },
        hitCooldown: 0, loopId: null, lastSweepData: null
    };

    // --- CALCULATORS ---
    function getPlayerStats() {
        const wVal = player.gear.w ? player.gear.w.val : 0;
        const aVal = player.gear.a ? player.gear.a.val : 0;
        
        // Infinite Shop Scaling
        const shopW = player.shop.zsword * 500000;
        const shopA = player.shop.potara * 500000;
        const mult = Math.pow(2, player.shop.godki);

        return {
            hp: Math.floor((player.bHp + (player.lvl * 100) + (aVal * 5)) * mult),
            atk: Math.floor((player.bAtk + (player.lvl * 10) + wVal + shopW) * mult),
            def: Math.floor((player.bDef + (player.lvl * 5) + aVal + shopA) * mult)
        };
    }

    window.formatNum = function(num) {
        if (num < 1000) return Math.floor(num);
        const suffixes = ["", "k", "M", "B", "T", "Qa", "Qi", "Sx", "Sp", "Oc", "No", "Dc"];
        const tier = Math.floor(Math.log10(num) / 3);
        if(tier >= suffixes.length) return "MAX";
        return (num / Math.pow(10, tier * 3)).toFixed(1) + suffixes[tier];
    };

    // --- CORE UI ---
    window.showTab = function(tab) {
        if (combatState.active) stopCombat();
        uniState.active = (tab === 'universe');

        document.querySelectorAll('.screen').forEach(s => s.classList.remove('active-screen'));
        document.querySelectorAll('nav button').forEach(b => b.classList.remove('active'));
        document.getElementById('view-' + tab).classList.add('active-screen');
        document.getElementById('tab-' + tab).classList.add('active');
        
        if (tab === 'universe') initUniverse();
        syncUI();
    };

    function syncUI() {
        const stats = getPlayerStats();
        document.getElementById('ui-lvl').innerText = player.lvl;
        document.getElementById('ui-hp').innerText = formatNum(stats.hp);
        document.getElementById('ui-atk').innerText = formatNum(stats.atk);
        document.getElementById('ui-def').innerText = formatNum(stats.def);
        document.getElementById('ui-gold').innerText = formatNum(player.coins);
        
        document.getElementById('ui-xp-fill').style.width = (player.xp / player.nextXp * 100) + '%';
        document.getElementById('ui-xp-text').innerText = `${formatNum(player.xp)} / ${formatNum(player.nextXp)}`;
        document.getElementById('ui-eq-w').innerText = player.gear.w ? `+${formatNum(player.gear.w.val)}` : "NONE";
        document.getElementById('ui-eq-a').innerText = player.gear.a ? `+${formatNum(player.gear.a.val)}` : "NONE";
        document.getElementById('ui-keys').innerText = player.dungeonKeys;
        document.getElementById('ui-senzu').innerText = player.senzuBeans;
        document.getElementById('ui-max-floor').innerText = player.maxFloor;

        // Dungeon Dash
        document.getElementById('dash-dmg').innerText = formatNum(player.dStats.dmg);
        document.getElementById('dash-hit').innerText = formatNum(player.dStats.hit);
        document.getElementById('dash-loot').innerText = formatNum(player.dStats.loot);
        document.getElementById('dash-kills').innerText = formatNum(player.dStats.kills);

        renderInventory();
        renderDungeons();
    }

    // --- HUB ACTIONS ---
    window.farmGold = function() {
        player.coins += 100 * player.lvl;
        player.xp += 15 * player.lvl;
        checkLevelUp(); syncUI();
    };

    function checkLevelUp() {
        while(player.xp >= player.nextXp) {
            player.xp -= player.nextXp; player.lvl++;
            player.nextXp = Math.floor(player.nextXp * 1.5);
            player.bHp += 200; player.bAtk += 20; player.bDef += 10;
        }
    }

    function addToInv(item) {
        const found = player.inv.find(i => i.n === item.n && i.val === item.val);
        if (found) found.qty++; else { item.qty = 1; player.inv.push(item); }
        syncUI();
    }

    function renderInventory() {
        const grid = document.getElementById('inv-grid');
        grid.innerHTML = '';
        const mergeBtn = document.getElementById('btn-merge');
        const equipBtn = document.getElementById('btn-equip');
        
        mergeBtn.style.display = 'none'; equipBtn.style.display = 'block';

        player.inv.forEach((item, i) => {
            const el = document.createElement('div');
            el.className = `inv-item ${player.selected === i ? 'selected' : ''}`;
            let color = "white";
            if(item.val > 5000) color = "#e74c3c";
            if(item.val > 20000) color = "#00ffff";
            if(item.val > 100000) color = "#f1c40f";
            
            el.innerHTML = `<span style="font-size:1.5rem;">${item.type === 'w' ? '⚔️' : '🛡️'}</span>
                            <span style="color:${color}; font-weight:bold; margin-top:5px;">${formatNum(item.val)}</span>
                            ${item.qty > 1 ? `<div class="qty-badge">x${item.qty}</div>` : ''}`;
            el.onclick = () => { player.selected = i; syncUI(); };
            grid.appendChild(el);
        });

        if (player.selected !== -1 && player.inv[player.selected] && player.inv[player.selected].qty >= 3) {
            mergeBtn.style.display = 'block'; equipBtn.style.display = 'none';
        }
    }

    window.equipSelected = function() {
        if(player.selected === -1) return;
        const item = player.inv[player.selected]; if(!item) return;
        const old = player.gear[item.type];
        player.gear[item.type] = { n: item.n, type: item.type, val: item.val, qty: 1 };
        item.qty--; if(item.qty <= 0) player.inv.splice(player.selected, 1);
        if(old) addToInv(old);
        player.selected = -1; syncUI(); saveGame();
    };

    window.mergeSelected = function() {
        if(player.selected === -1) return;
        const item = player.inv[player.selected]; if(!item || item.qty < 3) return;
        item.qty -= 3; if(item.qty <= 0) player.inv.splice(player.selected, 1);
        player.selected = -1; addToInv({ n: item.n + "+", type: item.type, val: item.val * 2 }); saveGame();
    };

    // --- DUNGEON UI ---
    function renderDungeons() {
        const list = document.getElementById('dungeon-list');
        if (!list) return;
        list.innerHTML = '';
        
        Object.keys(DUNGEONS).forEach(key => {
            const d = DUNGEONS[key];
            const el = document.createElement('div');
            
            // FIXED: Added 'flex-shrink: 0;' and 'min-height: 90px;' to prevent the cards from disappearing
            el.style.cssText = `background:rgba(20,20,30,0.9); border:2px solid ${d.color}; border-radius:10px; padding:15px; display:flex; align-items:center; gap:15px; box-shadow:0 5px 15px rgba(0,0,0,0.5); flex-shrink: 0; min-height: 90px;`;
            
            el.innerHTML = `
                <div style="width:60px; height:60px; border-radius:50%; background:black; border:2px solid #fff; overflow:hidden; flex-shrink:0;">
                    <img src="${d.img}" style="width:100%; height:100%; object-fit:cover;">
                </div>
                <div style="flex:1;">
                    <div style="font-family:'Bangers'; font-size:1.5rem; color:${d.color}; text-shadow:1px 1px black;">${d.name}</div>
                    <div style="font-size:0.75rem; color:#aaa;">HP: ${formatNum(d.hp)} | ATK: ${formatNum(d.atk)}</div>
                </div>
                <button class="btn btn-gold" style="padding:10px; font-size:1.2rem;" onclick="uiClick(event); startCombat('dungeon', null, '${key}')">FIGHT (1🗝️)</button>
            `;
            list.appendChild(el);
        });
    }

    // --- INFINITE TOWER SHOP ---
    window.openTowerShop = function() {
        // Calculate dynamic costs
        document.getElementById('shop-zsword-cost').innerText = 50 + (player.shop.zsword * 50);
        document.getElementById('shop-potara-cost').innerText = 50 + (player.shop.potara * 50);
        document.getElementById('shop-godki-cost').innerText = 250 * Math.pow(2, player.shop.godki);

        document.getElementById('shop-zsword-qty').innerText = player.shop.zsword;
        document.getElementById('shop-potara-qty').innerText = player.shop.potara;
        document.getElementById('shop-godki-qty').innerText = player.shop.godki;

        document.getElementById('shop-senzu').innerText = player.senzuBeans;
        document.getElementById('shop-modal').style.display = 'flex';
    };

    window.buyShopItem = function(id) {
        let cost = 0;
        if(id === 'zsword') cost = 50 + (player.shop.zsword * 50);
        if(id === 'potara') cost = 50 + (player.shop.potara * 50);
        if(id === 'godki') cost = 250 * Math.pow(2, player.shop.godki);

        if (player.senzuBeans < cost) { alert("Not enough Senzu Beans!"); return; }
        player.senzuBeans -= cost;
        player.shop[id]++;
        
        saveGame(); syncUI(); openTowerShop(); // Refresh UI
    };

    // --- ARENA ENGINE (WITH CANVAS TRAILS) ---
    const trCanvas = document.getElementById('trail-canvas');
    const trCtx = trCanvas.getContext('2d');
    function resizeTrails() { trCanvas.width = trCanvas.offsetWidth; trCanvas.height = trCanvas.offsetHeight; }
    window.addEventListener('resize', resizeTrails); resizeTrails();

    window.startCombat = function(type, floor = 1, bossKey = null) {
        if (type === 'dungeon' && player.dungeonKeys < 1) { alert("No Keys!"); return; }
        if (type === 'dungeon') player.dungeonKeys--;

        combatState.active = true; combatState.type = type; combatState.floor = floor; combatState.bossKey = bossKey; combatState.hitCooldown = 0;
        const stats = getPlayerStats();
        combatState.p = { hp: stats.hp, maxHp: stats.hp, atk: stats.atk, def: stats.def, x: 20, y: 50, vx: 0, vy: 0, el: document.getElementById('cb-player'), history: [] };
        
        spawnEnemy();
        document.getElementById('combat-modal').style.display = 'flex';
        document.getElementById('cb-fx').innerHTML = '';
        updateCombatUI();

        if(combatState.loopId) cancelAnimationFrame(combatState.loopId);
        combatLoop();
    };

    function spawnEnemy() {
        const c = combatState; let eName, eImg, eHp, eAtk;
        if (c.type === 'dungeon') {
            const d = DUNGEONS[c.bossKey]; eName = d.name; eImg = d.img; eHp = d.hp; eAtk = d.atk;
        } else {
            const mult = Math.pow(1.15, c.floor - 1);
            eName = `Tower Guardian F${c.floor}`; eImg = "cell.png"; 
            eHp = Math.floor(5000 * mult); eAtk = Math.floor(100 * mult);
        }
        document.getElementById('combat-title').innerText = eName;
        document.getElementById('combat-subtitle').innerText = c.type === 'tower' ? `Floor ${c.floor}` : "Boss Fight";
        document.getElementById('cb-enemy-img').src = eImg;
        c.e = { hp: eHp, maxHp: eHp, atk: eAtk, def: eAtk * 0.5, x: 80, y: 50, vx: 0, vy: 0, el: document.getElementById('cb-enemy'), stun: 0, history: [] };
    }

    function combatLoop() {
        if(!combatState.active) return;
        const p = combatState.p; const e = combatState.e;
        const dx = e.x - p.x; const dy = e.y - p.y; const dist = Math.sqrt(dx*dx + dy*dy);
        
        if (dist > 10) {
            p.vx += (dx/dist) * 0.7; p.vy += (dy/dist) * 0.7;
            if(e.stun <= 0) { e.vx -= (dx/dist) * 0.4; e.vy -= (dy/dist) * 0.4; } else { e.stun--; e.vx *= 0.8; }
        }

        p.x += p.vx; p.y += p.vy; e.x += e.vx; e.y += e.vy;
        p.vx *= 0.88; p.vy *= 0.88; e.vx *= 0.88; e.vy *= 0.88;

        if(p.x < 5) p.x=5; if(p.x > 95) p.x=95; if(p.y < 20) p.y=20; if(p.y > 80) p.y=80;
        if(e.x < 5) e.x=5; if(e.x > 95) e.x=95; if(e.y < 20) e.y=20; if(e.y > 80) e.y=80;

        p.el.style.left = p.x + "%"; p.el.style.top = p.y + "%";
        e.el.style.left = e.x + "%"; e.el.style.top = e.y + "%";

        // Record history for trails
        p.history.unshift({x: p.x, y: p.y}); if(p.history.length > 20) p.history.pop();
        e.history.unshift({x: e.x, y: e.y}); if(e.history.length > 20) e.history.pop();
        drawTrails(p.history, e.history);

        if (dist < 15 && combatState.hitCooldown <= 0) {
            combatState.hitCooldown = 15;
            
            const pDmg = Math.max(1, Math.floor(p.atk * (0.8 + Math.random() * 0.4)));
            e.hp -= pDmg; player.dStats.dmg += pDmg;
            if (pDmg > player.dStats.hit) player.dStats.hit = pDmg;
            
            spawnPop(formatNum(pDmg), e.x, e.y, 'gold');
            e.vx += (dx/dist) * 8; e.vy += (dy/dist) * 8; e.stun = 20;

            const eDmg = Math.max(1, Math.floor(e.atk * (0.8 + Math.random() * 0.4) - (p.def * 0.2)));
            p.hp -= eDmg;
            spawnPop(formatNum(eDmg), p.x, p.y, '#ff0055');
            p.vx -= (dx/dist) * 8; p.vy -= (dy/dist) * 8;

            const arena = document.getElementById('combat-arena');
            arena.classList.remove('epic-shake'); void arena.offsetWidth; arena.classList.add('epic-shake');
        }
        if(combatState.hitCooldown > 0) combatState.hitCooldown--;
        updateCombatUI();

        if (e.hp <= 0) handleEnemyDeath();
        else if (p.hp <= 0) handlePlayerDeath();
        else combatState.loopId = requestAnimationFrame(combatLoop);
    }

    function drawTrails(pHist, eHist) {
        trCtx.clearRect(0, 0, trCanvas.width, trCanvas.height);
        const w = trCanvas.width; const h = trCanvas.height;
        
        function drawLine(hist, color, glow) {
            if(hist.length < 2) return;
            trCtx.beginPath();
            trCtx.moveTo(hist[0].x / 100 * w, hist[0].y / 100 * h);
            for(let i=1; i<hist.length; i++) {
                trCtx.lineTo(hist[i].x / 100 * w, hist[i].y / 100 * h);
            }
            trCtx.strokeStyle = color;
            trCtx.lineWidth = 15;
            trCtx.lineCap = 'round';
            trCtx.lineJoin = 'round';
            trCtx.shadowBlur = 20;
            trCtx.shadowColor = glow;
            
            // Fade out trail
            const gradient = trCtx.createLinearGradient(
                hist[0].x/100*w, hist[0].y/100*h, 
                hist[hist.length-1].x/100*w, hist[hist.length-1].y/100*h
            );
            gradient.addColorStop(0, color);
            gradient.addColorStop(1, 'transparent');
            trCtx.strokeStyle = gradient;
            trCtx.stroke();
        }

        drawLine(pHist, 'rgba(0, 229, 255, 0.8)', '#00e5ff'); // Player Cyan Trail
        drawLine(eHist, 'rgba(255, 0, 85, 0.8)', '#ff0055');  // Enemy Red Trail
    }

    function handleEnemyDeath() {
        if (combatState.type === 'dungeon') {
            stopCombat(); player.dStats.kills++;
            let baseVal = combatState.bossKey === 'cell' ? 15000 : (combatState.bossKey === 'frieza' ? 5000 : 1500);
            addToInv({ n: "Boss Gear", type: Math.random() > 0.5 ? 'w' : 'a', val: baseVal });
            player.coins += baseVal * 2; player.dStats.loot++;
            
            // Set sweep data
            combatState.lastSweepData = { key: combatState.bossKey, coins: baseVal*2, gearVal: baseVal };
            
            const sweepHtml = `
                <div style="margin-top:15px; border-top:1px solid #444; padding-top:15px;">
                    <button class="btn btn-blue" style="width:100%;" onclick="openSweepUI()">SWEEP THIS BOSS</button>
                </div>
            `;
            showResult("VICTORY!", `Gained ${formatNum(baseVal*2)} Gold<br>Found Boss Gear!` + sweepHtml);
        } else {
            player.senzuBeans += Math.floor(combatState.floor / 2) + 1;
            if (combatState.floor > player.maxFloor) player.maxFloor = combatState.floor;
            combatState.floor++;
            spawnPop("FLOOR CLEARED!", 50, 20, 'cyan');
            spawnEnemy(); 
            combatState.loopId = requestAnimationFrame(combatLoop);
        }
        saveGame();
    }

    function handlePlayerDeath() {
        stopCombat();
        if (combatState.type === 'tower') {
            showResult("TOWER CLIMB OVER", `<span style="color:#aaa;">You reached Floor</span> <span style="color:var(--cyan); font-size:2rem;">${combatState.floor}</span><br><br>Check the Infinite Shop to spend your Beans!`);
        } else {
            showResult("DEFEATED", "You need better gear. Farm gold or merge items!");
        }
    }

    function updateCombatUI() {
        const c = combatState;
        document.getElementById('cb-player-hp').style.width = Math.max(0, (c.p.hp / c.p.maxHp) * 100) + "%";
        document.getElementById('cb-boss-hp').style.width = Math.max(0, (c.e.hp / c.e.maxHp) * 100) + "%";
    }

    window.stopCombat = function() {
        combatState.active = false;
        if (combatState.loopId) cancelAnimationFrame(combatState.loopId);
        document.getElementById('combat-modal').style.display = 'none';
        trCtx.clearRect(0,0, trCanvas.width, trCanvas.height);
        syncUI();
    };

    function spawnPop(text, x, y, color) {
        const fx = document.getElementById('cb-fx');
        const el = document.createElement('div');
        el.className = 'pop'; el.innerText = text; el.style.color = color;
        el.style.left = (x + (Math.random()*10-5)) + "%"; el.style.top = (y + (Math.random()*10-5)) + "%";
        fx.appendChild(el); setTimeout(() => el.remove(), 600);
    }

    // --- RESULT & SWEEP LOGIC ---
    window.showResult = function(title, text) {
        document.getElementById('res-title').innerText = title;
        document.getElementById('res-title').style.color = title === 'DEFEATED' ? 'var(--red)' : 'var(--yellow)';
        document.getElementById('res-body').innerHTML = text;
        document.getElementById('sweep-ui').style.display = 'none';
        document.getElementById('result-modal').style.display = 'flex';
    };

    window.closeResult = function() { document.getElementById('result-modal').style.display = 'none'; syncUI(); };

    let sweepCount = 1;
    window.openSweepUI = function() {
        sweepCount = 1;
        document.getElementById('sweep-keys-avail').innerText = player.dungeonKeys;
        document.getElementById('sweep-input').value = sweepCount;
        document.getElementById('sweep-ui').style.display = 'block';
    };

    window.adjSweep = function(amt) {
        if(amount === 'max') sweepCount = player.dungeonKeys;
        else sweepCount += amount;
        if(sweepCount < 1) sweepCount = 1;
        if(sweepCount > player.dungeonKeys) sweepCount = player.dungeonKeys;
        document.getElementById('sweep-input').value = sweepCount;
    };

    window.confirmSweep = function() {
        if (sweepCount > player.dungeonKeys || sweepCount < 1) return;
        player.dungeonKeys -= sweepCount;
        const sd = combatState.lastSweepData;
        
        const totalGold = sd.coins * sweepCount;
        player.coins += totalGold;
        player.dStats.loot += sweepCount;
        player.dStats.kills += sweepCount;
        
        for(let i=0; i<sweepCount; i++) {
            addToInv({ n: "Boss Gear", type: Math.random() > 0.5 ? 'w' : 'a', val: sd.gearVal });
        }
        saveGame(); closeResult(); alert(`Sweep Complete! +${formatNum(totalGold)} Gold & ${sweepCount} Gear.`);
    };

    // ==========================================
    // UNIVERSE MODE: SWARM SURVIVAL (CANVAS ENGINE)
    // ==========================================
    
    const uCan = document.getElementById('uni-canvas');
    const uCtx = uCan.getContext('2d');
    let uniState = { 
        active: false, cx: 0, cy: 0, px: 0, py: 0, vx: 0, vy: 0, 
        enemies: [], stars: [], particles: [], texts: [], 
        req: null, dead: false, joy: { active: false, nx: 0, ny: 0 } 
    };

    const joyZone = document.getElementById('joystick-zone');
    const joyKnob = document.getElementById('joystick-knob');

    joyZone.addEventListener('touchstart', handleJoy, {passive: false});
    joyZone.addEventListener('touchmove', handleJoy, {passive: false});
    joyZone.addEventListener('touchend', () => { uniState.joy.active = false; joyKnob.style.transform = `translate(-50%, -50%)`; uniState.joy.nx = 0; uniState.joy.ny = 0; });
    joyZone.addEventListener('mousedown', handleJoy);
    document.addEventListener('mousemove', (e) => { if(uniState.joy.active) handleJoy(e); });
    document.addEventListener('mouseup', () => { uniState.joy.active = false; joyKnob.style.transform = `translate(-50%, -50%)`; uniState.joy.nx = 0; uniState.joy.ny = 0; });

    function handleJoy(e) {
        if(e.type !== 'mousemove' && e.type !== 'mousedown') e.preventDefault();
        if(e.type === 'mousedown') uniState.joy.active = true;
        if(!uniState.joy.active && e.type !== 'touchstart') return;
        uniState.joy.active = true;

        const rect = joyZone.getBoundingClientRect();
        const clientX = e.touches ? e.touches[0].clientX : e.clientX;
        const clientY = e.touches ? e.touches[0].clientY : e.clientY;
        
        let dx = clientX - (rect.left + rect.width/2);
        let dy = clientY - (rect.top + rect.height/2);
        const dist = Math.sqrt(dx*dx + dy*dy);
        const maxDist = rect.width/2;

        if (dist > maxDist) { dx = (dx/dist)*maxDist; dy = (dy/dist)*maxDist; }
        
        joyKnob.style.transform = `translate(calc(-50% + ${dx}px), calc(-50% + ${dy}px))`;
        uniState.joy.nx = dx / maxDist; // -1 to 1
        uniState.joy.ny = dy / maxDist;
    }

    function initUniverse() {
        uCan.width = window.innerWidth; uCan.height = window.innerHeight;
        uniState.stars = [];
        for(let i=0; i<200; i++) {
            uniState.stars.push({ x: Math.random()*5000 - 2500, y: Math.random()*5000 - 2500, size: Math.random()*2+1, color: Math.random() > 0.5 ? '#fff' : '#00e5ff' });
        }
        uniState.px = 0; uniState.py = 0; uniState.vx = 0; uniState.vy = 0;
        uniState.enemies = []; uniState.particles = []; uniState.texts = []; uniState.dead = false;
        
        // Ensure player is fully healed when entering
        player.hp = getPlayerStats().hp;

        // Spawn initial swarm
        for(let i=0; i<10; i++) spawnUniEnemy(Math.random()*2000-1000, Math.random()*2000-1000);
        
        if(!uniState.req) universeLoop();
    }

    function spawnUniEnemy(x, y) {
        const hp = getPlayerStats().atk * 3; // Takes exactly 3 hits to kill
        uniState.enemies.push({ x: x, y: y, vx: 0, vy: 0, hp: hp, maxHp: hp, hist: [], hitCooldown: 0 });
    }

    function spawnParticles(x, y, color, count) {
        for(let i=0; i<count; i++) {
            uniState.particles.push({
                x: x, y: y,
                vx: (Math.random()-0.5)*20, vy: (Math.random()-0.5)*20,
                life: 1.0, color: color
            });
        }
    }

    function spawnCanvasText(text, x, y, color) {
        uniState.texts.push({ text: text, x: x, y: y, life: 1.0, color: color });
    }

    function universeLoop() {
        if(!uniState.active) { uniState.req = null; return; }
        
        const w = uCan.width; const h = uCan.height;
        uCtx.fillStyle = "rgba(5, 5, 10, 0.4)"; // Trail clear
        uCtx.fillRect(0, 0, w, h);

        if(uniState.dead) {
            uCtx.fillStyle = 'red'; uCtx.font = '40px Bangers'; uCtx.textAlign = 'center';
            uCtx.fillText("DEAD", w/2, h/2);
            uniState.req = requestAnimationFrame(universeLoop);
            return;
        }

        const pStats = getPlayerStats();

        // Player Movement
        const speed = 18;
        uniState.vx += uniState.joy.nx * speed * 0.15;
        uniState.vy += uniState.joy.ny * speed * 0.15;
        uniState.vx *= 0.92; uniState.vy *= 0.92; // Friction in space
        uniState.px += uniState.vx; uniState.py += uniState.vy;

        // Update UI HP Bar
        const hpPct = Math.max(0, (player.hp / pStats.hp) * 100);
        document.getElementById('uni-hp-fill').style.width = hpPct + '%';

        // Camera smoothly follows player
        uniState.cx += (uniState.px - uniState.cx) * 0.1;
        uniState.cy += (uniState.py - uniState.cy) * 0.1;

        uCtx.save();
        uCtx.translate(w/2 - uniState.cx, h/2 - uniState.cy);

        // Draw Stars
        uniState.stars.forEach(s => {
            uCtx.fillStyle = s.color;
            uCtx.beginPath(); uCtx.arc(s.x, s.y, s.size, 0, Math.PI*2); uCtx.fill();
        });

        // Player Draw
        uCtx.fillStyle = 'cyan';
        uCtx.shadowBlur = 20; uCtx.shadowColor = 'cyan';
        uCtx.beginPath(); uCtx.arc(uniState.px, uniState.py, 15, 0, Math.PI*2); uCtx.fill();
        uCtx.shadowBlur = 0;

        // Enemy Logic
        for(let i = uniState.enemies.length - 1; i >= 0; i--) {
            let e = uniState.enemies[i];
            const dx = uniState.px - e.x; const dy = uniState.py - e.y;
            const dist = Math.sqrt(dx*dx + dy*dy);

            if(dist < 1500) { // Chase Range
                e.vx += (dx/dist) * 0.6; e.vy += (dy/dist) * 0.6;
            }
            e.vx *= 0.98; e.vy *= 0.98;
            e.x += e.vx; e.y += e.vy;

            // Draw Enemy Trail
            e.hist.unshift({x: e.x, y: e.y}); if(e.hist.length > 10) e.hist.pop();
            if(e.hist.length > 2) {
                uCtx.beginPath(); uCtx.moveTo(e.hist[0].x, e.hist[0].y);
                for(let j=1; j<e.hist.length; j++) uCtx.lineTo(e.hist[j].x, e.hist[j].y);
                uCtx.strokeStyle = 'rgba(255, 0, 85, 0.5)'; uCtx.lineWidth = 8; uCtx.stroke();
            }

            // Draw Enemy
            uCtx.fillStyle = '#ff0055'; uCtx.beginPath(); uCtx.arc(e.x, e.y, 14, 0, Math.PI*2); uCtx.fill();

            // Draw Floating Health Bar
            uCtx.fillStyle = 'red'; uCtx.fillRect(e.x - 20, e.y + 25, 40, 5);
            uCtx.fillStyle = '#00ff00'; uCtx.fillRect(e.x - 20, e.y + 25, 40 * (e.hp/e.maxHp), 5);

            // ACTIVE COLLISION & COMBAT
            if(dist < 35) { // Hitbox overlaps
                if (e.hitCooldown <= 0) {
                    // Deal chunky damage
                    e.hp -= pStats.atk;
                    player.hp -= (pStats.hp * 0.05); // Player takes 5% damage per hit
                    
                    // Visual Clash
                    spawnParticles(e.x, e.y, '#fff', 8); // White sparks
                    spawnCanvasText(formatNum(pStats.atk), e.x, e.y - 20, 'gold');

                    // Violent Knockback (The "Smash")
                    e.vx -= (dx/dist)*30; e.vy -= (dy/dist)*30;
                    uniState.vx += (dx/dist)*15; uniState.vy += (dy/dist)*15;
                    
                    e.hitCooldown = 20; // Wait 20 frames before they can damage each other again
                }
                
                // Death Split
                if(e.hp <= 0) {
                    uniState.enemies.splice(i, 1);
                    player.coins += 5000;
                    document.getElementById('uni-kills').innerText = parseInt(document.getElementById('uni-kills').innerText) + 1;
                    document.getElementById('uni-gold').innerText = formatNum(player.coins);
                    
                    // MASSIVE EXPLOSION
                    spawnParticles(e.x, e.y, '#ff0055', 30);
                    spawnCanvasText("KILL!", e.x, e.y, 'cyan');
                    
                    // Spawn 2 new enemies slightly further away
                    spawnUniEnemy(e.x + 100, e.y + 100);
                    spawnUniEnemy(e.x - 100, e.y - 100);
                    continue;
                }
            }
            if (e.hitCooldown > 0) e.hitCooldown--;
        }

        // Draw Particles
        for(let i = uniState.particles.length - 1; i >= 0; i--) {
            let p = uniState.particles[i];
            p.x += p.vx; p.y += p.vy; p.life -= 0.05;
            if(p.life <= 0) { uniState.particles.splice(i, 1); continue; }
            uCtx.globalAlpha = Math.max(0, p.life);
            uCtx.fillStyle = p.color;
            uCtx.beginPath(); uCtx.arc(p.x, p.y, 4, 0, Math.PI*2); uCtx.fill();
            uCtx.globalAlpha = 1.0;
        }

        // Draw Floating Text
        for(let i = uniState.texts.length - 1; i >= 0; i--) {
            let t = uniState.texts[i];
            t.y -= 2; t.life -= 0.03;
            if(t.life <= 0) { uniState.texts.splice(i, 1); continue; }
            uCtx.globalAlpha = Math.max(0, t.life);
            uCtx.fillStyle = t.color; uCtx.font = '20px Bangers'; uCtx.textAlign = 'center';
            uCtx.fillText(t.text, t.x, t.y);
            uCtx.globalAlpha = 1.0;
        }

        // Death Check
        if(player.hp <= 0) {
            uniState.dead = true;
            document.getElementById('respawn-overlay').style.display = 'flex';
            let t = 15; document.getElementById('respawn-time').innerText = t;
            let ti = setInterval(() => {
                t--; document.getElementById('respawn-time').innerText = t;
                if(t<=0) {
                    clearInterval(ti); uniState.dead = false; player.hp = pStats.hp; 
                    document.getElementById('respawn-overlay').style.display = 'none';
                    uniState.px = 0; uniState.py = 0; // Respawn at center
                }
            }, 1000);
        }

        uCtx.restore();
        uniState.req = requestAnimationFrame(universeLoop);
    }

    // --- INIT ---
    loadGame();
    syncUI();

})();
