// tower.js - Standalone RPG Engine

(function () {

    // --- GAME STATE ---
    window.player = {
        lvl: 1, xp: 0, nextXp: 100, coins: 0,
        bAtk: 50, bDef: 20, bHp: 1000,
        inv: [], gear: { w: null, a: null }, selected: -1,
        dungeonKeys: 10,
        senzuBeans: 0, maxFloor: 1, godKiMult: 1
    };

    let combatState = {
        active: false, type: 'dungeon', // 'dungeon' or 'tower'
        floor: 1, bossKey: null,
        p: { hp: 0, maxHp: 0, atk: 0, def: 0, x: 20, y: 50, vx: 0, vy: 0, el: null },
        e: { hp: 0, maxHp: 0, atk: 0, def: 0, x: 80, y: 50, vx: 0, vy: 0, el: null, stun: 0 },
        loopId: null
    };

    const DUNGEONS = {
        buu: { name: "Majin Buu", img: "majin_buu.png", hp: 5000, atk: 150, color: "#ff79c6" },
        frieza: { name: "Frieza", img: "freeza.png", hp: 15000, atk: 400, color: "#bd93f9" },
        cell: { name: "Cell", img: "cell.png", hp: 50000, atk: 1200, color: "#50fa7b" }
    };

    // --- CALCULATORS ---
    function getPlayerStats() {
        const wVal = player.gear.w ? player.gear.w.val : 0;
        const aVal = player.gear.a ? player.gear.a.val : 0;
        const mult = player.godKiMult;
        return {
            hp: Math.floor((player.bHp + (player.lvl * 100) + (aVal * 5)) * mult),
            atk: Math.floor((player.bAtk + (player.lvl * 10) + wVal) * mult),
            def: Math.floor((player.bDef + (player.lvl * 5) + aVal) * mult)
        };
    }

    window.formatNum = function(num) {
        if (num < 1000) return Math.floor(num);
        const suffixes = ["", "k", "M", "B", "T", "Qa"];
        const tier = Math.floor(Math.log10(num) / 3);
        if(tier >= suffixes.length) return "MAX";
        return (num / Math.pow(10, tier * 3)).toFixed(1) + suffixes[tier];
    };

    // --- CORE UI ---
    window.showTab = function(tab) {
        document.querySelectorAll('.screen').forEach(s => s.classList.remove('active-screen'));
        document.querySelectorAll('nav button').forEach(b => b.classList.remove('active'));
        document.getElementById('view-' + tab).classList.add('active-screen');
        document.getElementById('tab-' + tab).classList.add('active');
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

        renderInventory();
        renderDungeons();
    }

    // --- PROGRESSION ---
    window.farmGold = function() {
        player.coins += 100 * player.lvl;
        player.xp += 15 * player.lvl;
        checkLevelUp();
        syncUI();
    };

    function checkLevelUp() {
        while(player.xp >= player.nextXp) {
            player.xp -= player.nextXp;
            player.lvl++;
            player.nextXp = Math.floor(player.nextXp * 1.5);
            player.bHp += 200; player.bAtk += 20; player.bDef += 10;
        }
    }

    // --- INVENTORY ENGINE ---
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
        
        mergeBtn.style.display = 'none';
        equipBtn.style.display = 'block';

        player.inv.forEach((item, i) => {
            const el = document.createElement('div');
            el.className = `inv-item ${player.selected === i ? 'selected' : ''}`;
            
            let color = "white";
            if(item.val > 5000) color = "#e74c3c";
            if(item.val > 20000) color = "#00ffff";
            if(item.val > 100000) color = "#f1c40f";
            
            el.innerHTML = `<span style="font-size:1.2rem;">${item.type === 'w' ? '⚔️' : '🛡️'}</span>
                            <span style="color:${color}; font-weight:bold;">${formatNum(item.val)}</span>
                            ${item.qty > 1 ? `<div class="qty-badge">x${item.qty}</div>` : ''}`;
            el.onclick = () => { player.selected = i; syncUI(); };
            grid.appendChild(el);
        });

        if (player.selected !== -1 && player.inv[player.selected]) {
            const item = player.inv[player.selected];
            if (item.qty >= 3) {
                mergeBtn.style.display = 'block';
                equipBtn.style.display = 'none';
            }
        }
    }

    window.equipSelected = function() {
        if(player.selected === -1) return;
        const item = player.inv[player.selected];
        if(!item) return;

        const old = player.gear[item.type];
        player.gear[item.type] = { n: item.n, type: item.type, val: item.val, qty: 1 };
        item.qty--;
        if(item.qty <= 0) player.inv.splice(player.selected, 1);
        if(old) addToInv(old);
        
        player.selected = -1;
        syncUI();
    };

    window.mergeSelected = function() {
        if(player.selected === -1) return;
        const item = player.inv[player.selected];
        if(!item || item.qty < 3) return;

        item.qty -= 3;
        if(item.qty <= 0) player.inv.splice(player.selected, 1);
        
        player.selected = -1;
        addToInv({ n: item.n + "+", type: item.type, val: item.val * 2 });
    };

    // --- DUNGEON UI ---
    function renderDungeons() {
        const list = document.getElementById('dungeon-list');
        list.innerHTML = '';
        Object.keys(DUNGEONS).forEach(key => {
            const d = DUNGEONS[key];
            const el = document.createElement('div');
            el.style.cssText = `background:#222; border:2px solid ${d.color}; border-radius:10px; padding:15px; display:flex; align-items:center; gap:15px;`;
            el.innerHTML = `
                <div style="width:60px; height:60px; border-radius:50%; background:black; border:2px solid #555; overflow:hidden; flex-shrink:0;">
                    <img src="${d.img}" style="width:100%; height:100%; object-fit:cover;">
                </div>
                <div style="flex:1;">
                    <div style="font-family:'Bangers'; font-size:1.5rem; color:${d.color};">${d.name}</div>
                    <div style="font-size:0.8rem; color:#aaa;">HP: ${formatNum(d.hp)} | ATK: ${formatNum(d.atk)}</div>
                </div>
                <button class="btn btn-gold" style="padding:10px;" onclick="startCombat('dungeon', null, '${key}')">ENTER (1🗝️)</button>
            `;
            list.appendChild(el);
        });
    }

    // --- SHOP SYSTEM ---
    window.openTowerShop = function() {
        document.getElementById('shop-senzu').innerText = player.senzuBeans;
        document.getElementById('shop-modal').style.display = 'flex';
    };

    window.buyShopItem = function(id, cost) {
        if (player.senzuBeans < cost) { alert("Not enough Senzu Beans!"); return; }
        player.senzuBeans -= cost;
        
        if (id === 'zsword') addToInv({ n: "Z-Sword", type: "w", val: 500000 });
        if (id === 'potara') addToInv({ n: "Potara", type: "a", val: 500000 });
        if (id === 'godki') { player.godKiMult *= 2; alert("God Ki Multiplier Doubled!"); }
        
        document.getElementById('shop-senzu').innerText = player.senzuBeans;
        syncUI();
    };

    // --- UNIFIED COMBAT ENGINE (PHYSICS) ---
    window.startCombat = function(type, floor = 1, bossKey = null) {
        if (type === 'dungeon' && player.dungeonKeys < 1) { alert("No Keys!"); return; }
        if (type === 'dungeon') player.dungeonKeys--;

        combatState.active = true;
        combatState.type = type;
        combatState.floor = floor;
        combatState.bossKey = bossKey;

        const stats = getPlayerStats();
        combatState.p = { hp: stats.hp, maxHp: stats.hp, atk: stats.atk, def: stats.def, x: 20, y: 50, vx: 0, vy: 0, el: document.getElementById('cb-player') };
        
        spawnEnemy();

        document.getElementById('combat-modal').style.display = 'flex';
        document.getElementById('cb-fx').innerHTML = '';
        updateCombatUI();

        if(combatState.loopId) cancelAnimationFrame(combatState.loopId);
        combatLoop();
    };

    function spawnEnemy() {
        const c = combatState;
        let eName, eImg, eHp, eAtk;

        if (c.type === 'dungeon') {
            const d = DUNGEONS[c.bossKey];
            eName = d.name; eImg = d.img; eHp = d.hp; eAtk = d.atk;
        } else {
            // TOWER LOGIC: +15% harder every floor
            const mult = Math.pow(1.15, c.floor - 1);
            eName = `Tower Guardian F${c.floor}`;
            eImg = "cell.png"; 
            eHp = Math.floor(5000 * mult);
            eAtk = Math.floor(100 * mult);
        }

        document.getElementById('combat-title').innerText = eName;
        document.getElementById('combat-subtitle').innerText = c.type === 'tower' ? `Floor ${c.floor}` : "Boss Fight";
        document.getElementById('cb-enemy-img').src = eImg;

        c.e = { hp: eHp, maxHp: eHp, atk: eAtk, def: eAtk * 0.5, x: 80, y: 50, vx: 0, vy: 0, el: document.getElementById('cb-enemy'), stun: 0 };
    }

    function combatLoop() {
        if(!combatState.active) return;
        const p = combatState.p; const e = combatState.e;

        // Simple Magnet Physics
        const dx = e.x - p.x; const dy = e.y - p.y; const dist = Math.sqrt(dx*dx + dy*dy);
        
        if (dist > 10) {
            p.vx += (dx/dist) * 0.5; p.vy += (dy/dist) * 0.5;
            if(e.stun <= 0) { e.vx -= (dx/dist) * 0.3; e.vy -= (dy/dist) * 0.3; } else { e.stun--; e.vx *= 0.8; }
        }

        p.x += p.vx; p.y += p.vy; e.x += e.vx; e.y += e.vy;
        p.vx *= 0.9; p.vy *= 0.9; e.vx *= 0.9; e.vy *= 0.9;

        // Walls
        if(p.x < 5) p.x=5; if(p.x > 95) p.x=95; if(p.y < 20) p.y=20; if(p.y > 80) p.y=80;
        if(e.x < 5) e.x=5; if(e.x > 95) e.x=95; if(e.y < 20) e.y=20; if(e.y > 80) e.y=80;

        p.el.style.left = p.x + "%"; p.el.style.top = p.y + "%";
        e.el.style.left = e.x + "%"; e.el.style.top = e.y + "%";

        // Collision
        if (dist < 15 && physics.hitCooldown <= 0) {
            physics.hitCooldown = 20;
            
            // Player hits Enemy
            const pDmg = Math.max(1, Math.floor(p.atk * (0.8 + Math.random() * 0.4)));
            e.hp -= pDmg;
            spawnPop(pDmg, e.x, e.y, 'gold');
            e.vx += (dx/dist) * 5; e.vy += (dy/dist) * 5;
            e.stun = 15;

            // Enemy hits Player
            const eDmg = Math.max(1, Math.floor(e.atk * (0.8 + Math.random() * 0.4) - (p.def * 0.2)));
            p.hp -= eDmg;
            spawnPop(eDmg, p.x, p.y, 'red');
            p.vx -= (dx/dist) * 5; p.vy -= (dy/dist) * 5;

            document.getElementById('combat-arena').style.animation = 'none';
            void document.getElementById('combat-arena').offsetWidth;
            document.getElementById('combat-arena').style.animation = 'shake 0.2s';
        }
        if(physics.hitCooldown > 0) physics.hitCooldown--;

        updateCombatUI();

        // Death Checks
        if (e.hp <= 0) handleEnemyDeath();
        else if (p.hp <= 0) handlePlayerDeath();
        else combatState.loopId = requestAnimationFrame(combatLoop);
    }

    function handleEnemyDeath() {
        if (combatState.type === 'dungeon') {
            stopCombat();
            let baseVal = combatState.bossKey === 'cell' ? 15000 : (combatState.bossKey === 'frieza' ? 5000 : 1500);
            addToInv({ n: "Boss Gear", type: Math.random() > 0.5 ? 'w' : 'a', val: baseVal });
            player.coins += baseVal * 2;
            showResult("VICTORY!", `Gained ${formatNum(baseVal*2)} Gold<br>Found Boss Gear!`);
        } else {
            // TOWER WINS: Gain Beans, next floor immediately
            player.senzuBeans += Math.floor(combatState.floor / 2) + 1;
            if (combatState.floor > player.maxFloor) player.maxFloor = combatState.floor;
            combatState.floor++;
            spawnPop("FLOOR CLEARED!", 50, 20, 'cyan');
            spawnEnemy(); // Instant Respawn
            combatState.loopId = requestAnimationFrame(combatLoop);
        }
    }

    function handlePlayerDeath() {
        stopCombat();
        if (combatState.type === 'tower') {
            showResult("TOWER CLIMB OVER", `You reached Floor ${combatState.floor}.<br>Check the Tower Shop to get stronger!`);
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
        syncUI();
    };

    function spawnPop(text, x, y, color) {
        const fx = document.getElementById('cb-fx');
        const el = document.createElement('div');
        el.className = 'pop'; el.innerText = text; el.style.color = color;
        el.style.left = (x + (Math.random()*10-5)) + "%"; el.style.top = (y + (Math.random()*10-5)) + "%";
        fx.appendChild(el);
        setTimeout(() => el.remove(), 600);
    }

    window.showResult = function(title, text) {
        document.getElementById('res-title').innerText = title;
        document.getElementById('res-title').style.color = title === 'DEFEATED' ? 'red' : 'gold';
        document.getElementById('res-body').innerHTML = text;
        document.getElementById('result-modal').style.display = 'flex';
    };

    window.closeResult = function() {
        document.getElementById('result-modal').style.display = 'none';
        syncUI();
    };

    // Start UI
    syncUI();

})();
