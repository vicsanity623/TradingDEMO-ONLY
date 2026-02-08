// Wrap logic in an IIFE to keep helper functions private, 
// but expose State Objects to the Window so other scripts can see them.
(function() {
    
    // --- CONSTANTS & CONFIG ---
    const CONFIG = {
        API_BASE: "https://dragonball-api.com/api",
        SAVE_KEY: 'dbz_gacha_save',
        CACHE_KEY: 'dbz_api_cache',
        SAVE_INTERVAL: 30000,
        CAPSULE_COOLDOWN: 60000
    };

    const ASSETS = {
        BASE: "IMG_0061.png",
        SSJ: "IMG_0062.png",
        BEAM: "hb_b.png"
    };

    const RANKS = ["BASE", "S", "SS", "SS2", "SS3", "SSG", "SSB", "UI", "MUI", "SSS", "SSS10"];
    const RARITY_NAMES = {1:"B", 2:"R", 3:"L", 4:"S", 5:"SS", 6:"SSS"};

    // --- STATE MANAGEMENT (GLOBAL) ---
    
    window.isDirty = false; 

    window.apiData = { characters: [], planets: [] };
    
    window.player = {
        lvl: 1, rank: 0, xp: 0, nextXp: 100, coins: 500,
        bAtk: 40, bDef: 25, bHp: 500, hp: 500, charge: 0,
        inv: [], gear: { w: null, a: null }, selected: -1,
        lastCapsule: 0,
        soulLevel: 1,
        souls: 0,
        dragonShards: 0, 
        advanceLevel: 0 
    };

    window.battle = { 
        stage: 1, world: 1, maxStage: 1, 
        active: false, enemy: null, 
        autoTimerId: null, pInterval: null, eInterval: null, cinematic: false 
    };
    
    let isAutoMerging = false;

    if ('serviceWorker' in navigator) {
        window.addEventListener('load', () => {
            navigator.serviceWorker.register('./sw.js').catch(err => console.log('SW failed', err));
        });
    }

    // --- MATH & STATS ---
    function getSoulMult() {
        const lvl = window.player.soulLevel || 1;
        return 1 + (lvl * 1.0); 
    }

    function getAdvMult() {
        return 1 + ((window.player.advanceLevel || 0) * 0.1);
    }

    window.GameState = {
        get gokuLevel() { return window.player.lvl; },
        get gokuPower() {
            const rawAtk = window.player.bAtk + (window.player.rank * 400) + (window.player.gear.w?.val || 0);
            return Math.floor(rawAtk * getSoulMult() * getAdvMult());
        },
        get gokuHP() { return window.player.hp; },
        set gokuHP(v) { window.player.hp = v; },
        get gokuMaxHP() {
            const rawHp = window.player.bHp + (window.player.rank * 2500) + (window.player.gear.a?.val || 0);
            return Math.floor(rawHp * getSoulMult() * getAdvMult());
        },
        inBattle: false
    };

    // --- NUMBER FORMATTER ---
    window.formatNumber = function(num) {
        if (num < 1000000) return Math.floor(num).toLocaleString();

        const suffixes = ["", "K", "M", "B", "T"];
        let suffixNum = Math.floor(("" + Math.floor(num)).length / 3);
        let shortValue = parseFloat((num / Math.pow(1000, suffixNum)).toPrecision(3));
        if (shortValue < 1) { shortValue *= 1000; suffixNum--; }

        let suffix = "";
        if (suffixNum < suffixes.length) suffix = suffixes[suffixNum];
        else {
            let alphaNum = suffixNum - suffixes.length; 
            const alphabet = "ABCDEFGHIJKLMNOPQRSTUVWXYZ";
            if (alphaNum < 26) suffix = alphabet[alphaNum];
            else {
                let first = Math.floor(alphaNum / 26) - 1;
                let second = alphaNum % 26;
                suffix = alphabet[first] + alphabet[second];
            }
        }
        return shortValue + suffix;
    };

    // --- DETAILS MODAL LOGIC (UPDATED) ---
    window.openDetails = function() {
        const modal = document.getElementById('details-modal');
        if(!modal) return;

        const p = window.player;
        const sMult = getSoulMult();
        const aMult = getAdvMult(); 
        
        // Calculate Totals correctly including ALL multipliers
        const baseAtk = p.bAtk + (p.rank * 400);
        const gearAtk = p.gear.w?.val || 0;
        const totalAtk = Math.floor((baseAtk + gearAtk) * sMult * aMult);

        const baseDef = p.bDef + (p.rank * 150);
        const gearDef = p.gear.a?.val || 0;
        const totalDef = Math.floor((baseDef + gearDef) * sMult * aMult);

        // Calculate Crit Chance Dynamically
        let critChance = 1 + (p.rank * 0.5); // Base %
        if(p.advanceLevel >= 5) critChance += 5 + (p.advanceLevel * 0.5); // Add Advance Bonus

        // Update DOM
        document.getElementById('det-power').innerText = window.formatNumber(window.GameState.gokuPower);
        document.getElementById('det-hp').innerText = window.formatNumber(window.GameState.gokuMaxHP);
        document.getElementById('det-atk').innerText = window.formatNumber(totalAtk);
        document.getElementById('det-def').innerText = window.formatNumber(totalDef);
        
        // Show Soul + Advance info clearly
        document.getElementById('det-soul').innerHTML = `
            <div>💎 Soul Boost: <span style="color:#00ffff">x${sMult.toFixed(1)}</span></div>
            <div style="margin-top:2px;">⚙️ Gear Adv: <span style="color:#00ff00">+${Math.round((aMult-1)*100)}%</span></div>
        `;
        
        document.getElementById('det-crit').innerText = `${critChance.toFixed(1)}%`;
        document.getElementById('det-coins').innerText = window.formatNumber(p.coins);
        
        modal.style.display = 'flex';
    };

    window.closeDetails = function() {
        document.getElementById('details-modal').style.display = 'none';
    };

    // --- INITIALIZATION ---
    async function initGame() {
        try {
            const cachedData = localStorage.getItem(CONFIG.CACHE_KEY);
            if (cachedData) {
                window.apiData = JSON.parse(cachedData);
            } else {
                const [charRes, planRes] = await Promise.all([
                    fetch(`${CONFIG.API_BASE}/characters?limit=58`),
                    fetch(`${CONFIG.API_BASE}/planets?limit=20`)
                ]);
                window.apiData.characters = (await charRes.json()).items;
                window.apiData.planets = (await planRes.json()).items;
                localStorage.setItem(CONFIG.CACHE_KEY, JSON.stringify(window.apiData));
            }
            
            loadGame();
            
            if(!window.player.soulLevel) window.player.soulLevel = 1;
            if(!window.player.souls) window.player.souls = 0;
            if(window.player.dragonShards === undefined) window.player.dragonShards = 0;
            if(window.player.advanceLevel === undefined) window.player.advanceLevel = 0;

            const loader = document.getElementById('loader');
            if(loader) loader.style.display = 'none';
            
            syncUI();
            
            if(typeof window.buildStageSelector === 'function') window.buildStageSelector();
            if(typeof window.initStrategy === 'function') window.initStrategy();
            if(window.SoulSystem) window.SoulSystem.updateBtnUI(); 
            if(window.HubBattle) window.HubBattle.init();
            
            setupRebirthHandler();
        
            setInterval(saveGame, CONFIG.SAVE_INTERVAL);
            setInterval(updateCapsuleBtn, 1000);
            
        } catch (e) {
            console.error("Game Init Error", e);
            document.getElementById('loader').style.display = 'none';
        }
    }

    // --- REBIRTH HANDLER ---
    function setupRebirthHandler() {
        const btn = document.getElementById('btn-rebirth');
        if(!btn) return;
        let intervalId = null, timeoutId = null;

        const performAction = () => {
            let didTrain = false;
            if (window.player.coins >= 100) { train('atk', true); didTrain = true; }
            if (window.player.coins >= 100) { train('def', true); didTrain = true; }

            if (didTrain) updateStatsOnly();
            else {
                if (intervalId) { clearInterval(intervalId); intervalId = null; syncUI(); }
            }
        };

        const start = (e) => {
            if(e.cancelable && e.type === 'touchstart') e.preventDefault();
            performAction();
            timeoutId = setTimeout(() => { intervalId = setInterval(performAction, 20); }, 300);
        };
        const end = (e) => {
            if(e.cancelable && e.type === 'touchend') e.preventDefault();
            clearTimeout(timeoutId);
            if (intervalId) { clearInterval(intervalId); intervalId = null; }
            syncUI();
        };

        btn.addEventListener('mousedown', start);
        btn.addEventListener('mouseup', end);
        btn.addEventListener('mouseleave', end);
        btn.addEventListener('touchstart', start, {passive: false});
        btn.addEventListener('touchend', end);
        btn.addEventListener('touchcancel', end);
    }

    function updateStatsOnly() {
        const atk = window.GameState.gokuPower; 
        const rawDef = window.player.bDef + (window.player.rank * 150) + (window.player.gear.a?.val || 0);
        const def = Math.floor(rawDef * getSoulMult() * getAdvMult());

        document.getElementById('ui-atk').innerText = window.formatNumber(atk);
        document.getElementById('ui-def').innerText = window.formatNumber(def);
        document.getElementById('ui-coins').innerText = window.formatNumber(window.player.coins);
        document.getElementById('ui-power').innerText = window.formatNumber(atk * 30 + window.GameState.gokuMaxHP);
    }

    // --- UPDATED LEVEL UP LOGIC (DYNAMIC SCALING) ---
    function showLevelUp(oldLvl, newLvl, hpGain, atkGain, defGain) {
        if(window.battle.active) window.battle.cinematic = true;
        document.getElementById('lvl-up-old').innerText = oldLvl;
        document.getElementById('lvl-up-new').innerText = newLvl;
        
        const maxHp = window.GameState.gokuMaxHP;
        const power = window.GameState.gokuPower;
        const rawDef = window.player.bDef + (window.player.rank * 150) + (window.player.gear.a?.val || 0);
        const def = Math.floor(rawDef * getSoulMult() * getAdvMult());

        const hpEl = document.getElementById('lvl-stats-hp');
        if(hpEl) hpEl.parentElement.innerHTML = `HP: <span id="lvl-stats-hp">${window.formatNumber(maxHp)}</span> <span style="color:#00ff00;">(+${window.formatNumber(hpGain)})</span>`;

        const atkEl = document.getElementById('lvl-stats-atk');
        if(atkEl) atkEl.parentElement.innerHTML = `ATK: <span id="lvl-stats-atk">${window.formatNumber(power)}</span> <span style="color:#00ff00;">(+${window.formatNumber(atkGain)})</span>`;

        const defEl = document.getElementById('lvl-stats-def');
        if(defEl) defEl.parentElement.innerHTML = `DEF: <span id="lvl-stats-def">${window.formatNumber(def)}</span> <span style="color:#00ff00;">(+${window.formatNumber(defGain)})</span>`;

        const img = (window.player.rank >= 1) ? ASSETS.SSJ : ASSETS.BASE;
        document.getElementById('lvl-up-img').src = img;
        document.getElementById('levelup-modal').style.display = 'flex';
    }

    function closeLevelUp() {
        document.getElementById('levelup-modal').style.display = 'none';
        if(window.GameState.inBattle && window.battle.active) window.battle.cinematic = false;
    }

    function checkLevelUp() {
        let leveledUp = false;
        const oldLvl = window.player.lvl;
        
        let totalHpGain = 0;
        let totalAtkGain = 0;
        let totalDefGain = 0;

        while(window.player.xp >= window.player.nextXp) {
            window.player.lvl++; 
            window.player.xp -= window.player.nextXp; 
            window.player.nextXp = Math.floor(window.player.nextXp * 1.3);
            
            const levelMult = window.player.lvl;
            
            const hpGain = 250 + (levelMult * 500); 
            const atkGain = 5 + (levelMult * 10);
            const defGain = 2 + (levelMult * 5);

            window.player.bHp += hpGain; 
            window.player.bAtk += atkGain; 
            window.player.bDef += defGain;
            
            totalHpGain += hpGain;
            totalAtkGain += atkGain;
            totalDefGain += defGain;

            window.player.hp = window.GameState.gokuMaxHP;
            
            if(window.player.lvl >= 100) { window.player.lvl = 1; window.player.rank++; }
            leveledUp = true;
        }

        if(leveledUp) {
            showLevelUp(oldLvl, window.player.lvl, totalHpGain, totalAtkGain, totalDefGain);
            syncUI();
            saveGame();
        }
    }

    function claimSupply() {
        const now = Date.now();
        if(!window.player.lastCapsule) window.player.lastCapsule = 0;
        const diff = now - window.player.lastCapsule;
        if(diff < CONFIG.CAPSULE_COOLDOWN) {
            alert(`Supply Capsule recharging... ${Math.ceil((CONFIG.CAPSULE_COOLDOWN - diff) / 1000)}s remaining.`);
            return;
        }
        window.player.lastCapsule = now;
        const base = 50 * (window.player.lvl || 1);
        const xpGain = Math.floor(base * (0.8 + Math.random() * 0.4));
        const coinGain = Math.floor(base * 0.5);
        window.player.xp += xpGain;
        window.player.coins += coinGain;
        window.isDirty = true;
        
        let msg = `SUPPLY DROP RECEIVED!\n\n+${window.formatNumber(xpGain)} XP\n+${window.formatNumber(coinGain)} Coins`;
        if(Math.random() < 0.3) {
            window.addToInventory({ n: "Capsule Gear", type: Math.random() > 0.5 ? 'w' : 'a', val: 700, rarity: 1 });
            msg += `\n+1 Saiyan Gear`;
        }
        checkLevelUp();
        syncUI();
        saveGame();
        if(document.getElementById('levelup-modal').style.display === 'none') alert(msg);
        updateCapsuleBtn();
    }

    function updateCapsuleBtn() {
        const btn = document.getElementById('btn-supply');
        if(!btn) return;
        const diff = Date.now() - (window.player.lastCapsule || 0);
        if(diff >= CONFIG.CAPSULE_COOLDOWN) {
            btn.innerHTML = "<i>🎁</i> Supply Ready!";
            btn.classList.add('btn-ready');
            btn.style.color = "#fff";
        } else {
            btn.innerHTML = `<i>⏳</i> ${Math.ceil((CONFIG.CAPSULE_COOLDOWN - diff) / 1000)}s`;
            btn.classList.remove('btn-ready');
            btn.style.color = "#777";
        }
    }

    function tapTrain() {
        const gain = Math.ceil(window.player.lvl / 2);
        window.player.xp += gain;
        window.player.coins += 1;
        window.isDirty = true;
        popDamage(`+${gain} XP`, 'view-char', true);
        checkLevelUp();
        syncUI();
    }

    function saveGame() {
        if (!window.isDirty) return;
        window.player.lastSave = Date.now(); 
        const saveData = {
            player: window.player,
            battle: { stage: window.battle.stage, world: window.battle.world, maxStage: window.battle.maxStage }
        };
        localStorage.setItem(CONFIG.SAVE_KEY, JSON.stringify(saveData));
        window.isDirty = false;
    }

    function loadGame() {
        const saved = localStorage.getItem(CONFIG.SAVE_KEY);
        if (saved) {
            try {
                const parsed = JSON.parse(saved);
                if(parsed.player) window.player = parsed.player;
                if(parsed.battle) {
                    window.battle.stage = parsed.battle.stage || 1;
                    window.battle.world = parsed.battle.world || 1;
                    window.battle.maxStage = parsed.battle.maxStage || 1;
                }
                window.player.inv.forEach(i => { if(!i.qty) i.qty = 1; });
            } catch (e) { console.error("Save file corrupted"); }
        }
    }

    window.addEventListener('beforeunload', () => { window.isDirty = true; saveGame(); });

    function showTab(t) {
        document.querySelectorAll('.screen').forEach(s => s.classList.remove('active-screen'));
        document.querySelectorAll('nav button').forEach(b => b.classList.remove('active'));
        document.getElementById('view-' + t).classList.add('active-screen');
        document.getElementById('tab-' + t).classList.add('active');
        
        if(t === 'battle') {
            if(window.HubBattle) window.HubBattle.stop();
            if(!window.battle.active) {
                document.getElementById('start-prompt').style.display = 'block';
                document.getElementById('e-img').style.display = 'none';
                document.getElementById('e-name').innerText = "";
            }
        } else {
            if(window.HubBattle) window.HubBattle.start();
            if(typeof window.stopCombat === 'function') window.stopCombat();
            document.getElementById('battle-menu').style.display = 'none';
        }
        syncUI();
    }

    function addToInventory(item) {
        const found = window.player.inv.find(i => i.n === item.n && i.type === item.type && i.val === item.val && i.rarity === item.rarity && i.qty < 99);
        if(found) found.qty++; else { item.qty = 1; window.player.inv.push(item); }
        window.isDirty = true;
        if(isAutoMerging) setTimeout(processAutoMerge, 200);
        else syncUI();
    }

    function syncUI() {
        const sprite = (window.player.rank >= 1) ? ASSETS.SSJ : ASSETS.BASE;
        const uiSprite = document.getElementById('ui-sprite');
        if (uiSprite) uiSprite.src = sprite;
        const btlSprite = document.getElementById('btl-p-sprite');
        if (btlSprite) btlSprite.src = sprite;
        if (window.HubBattle && typeof window.HubBattle.updateSprite === 'function') {
            window.HubBattle.updateSprite(sprite);
        }
        const uiAura = document.getElementById('ui-aura');
        if (uiAura) {
            uiAura.style.display = (window.player.rank >= 1) ? "block" : "none";
        }

        const atk = window.GameState.gokuPower;
        const maxHp = window.GameState.gokuMaxHP;
        const rawDef = window.player.bDef + (window.player.rank * 150) + (window.player.gear.a?.val || 0);
        const def = Math.floor(rawDef * getSoulMult() * getAdvMult()); 

        if (!window.battle.active) {
            window.player.hp = maxHp;
        }

        document.getElementById('ui-rank-badge').innerText = RANKS[window.player.rank].substring(0,2);
        document.getElementById('ui-name').innerText = window.player.rank > 0 ? "Goku " + RANKS[window.player.rank] : "Goku";
        document.getElementById('ui-lvl').innerText = window.player.lvl;
        
        document.getElementById('ui-atk').innerText = window.formatNumber(atk);
        document.getElementById('ui-def').innerText = window.formatNumber(def);
        document.getElementById('ui-coins').innerText = window.formatNumber(window.player.coins);
        
        document.getElementById('ui-hp-txt').innerText = window.formatNumber(maxHp);
        document.getElementById('ui-power').innerText = window.formatNumber(atk * 30 + maxHp);
        
        const xpPct = (window.player.xp / window.player.nextXp) * 100;
        document.getElementById('bar-xp').style.width = xpPct + "%";
        
        const grid = document.getElementById('inv-grid');
        grid.innerHTML = '';
        const fragment = document.createDocumentFragment();
        
        const mergeBtn = document.getElementById('btn-merge');
        const equipBtn = document.getElementById('btn-action');
        const autoMergeBtn = document.getElementById('btn-auto-merge');
        
        if(mergeBtn) mergeBtn.style.display = 'none';
        if(equipBtn) equipBtn.style.display = 'flex'; 

        if(autoMergeBtn) {
            if(window.player.inv.length > 0) {
                autoMergeBtn.style.display = 'flex';
                if(isAutoMerging) {
                    autoMergeBtn.innerHTML = `<span>⚡ STOP MERGING</span>`;
                    autoMergeBtn.classList.add('merging');
                } else {
                    autoMergeBtn.innerHTML = `<span>⚡ AUTO MERGE</span>`;
                    autoMergeBtn.classList.remove('merging');
                }
            } else {
                autoMergeBtn.style.display = 'none';
            }
        }

        window.player.inv.forEach((item, i) => {
            const d = document.createElement('div');
            let rClass = 'item-basic';
            if(item.rarity === 2) rClass = 'item-rare';
            if(item.rarity === 3) rClass = 'item-legendary';
            if(item.rarity === 4) rClass = 'item-s';
            if(item.rarity === 5) rClass = 'item-ss';
            if(item.rarity === 6) rClass = 'item-sss';
            
            d.className = `inv-item ${rClass} ${window.player.selected === i ? 'selected' : ''}`;
            let rName = RARITY_NAMES[item.rarity] || "B";
            let qtyHtml = item.qty > 1 ? `<div class="qty-badge">x${item.qty}</div>` : '';
            d.innerHTML = `<span>${item.type === 'w' ? '⚔️' : '🛡️'}</span><span>${rName}</span>${qtyHtml}`;
            d.onclick = () => { window.player.selected = i; syncUI(); };
            fragment.appendChild(d);
        });
        grid.appendChild(fragment);

        updateVisualSlot('w', 'slot-w');
        updateVisualSlot('a', 'slot-a');

        if(window.player.selected !== -1) {
            const sItem = window.player.inv[window.player.selected];
            
            if(sItem) {
                let totalCount = 0;
                window.player.inv.forEach(i => {
                    if(i.n === sItem.n && i.type === sItem.type && i.rarity === sItem.rarity) {
                        totalCount += i.qty;
                    }
                });

                if(totalCount >= 3 && sItem.rarity < 6) {
                    mergeBtn.style.display = 'flex';
                    equipBtn.style.display = 'none';
                    mergeBtn.innerHTML = `<span>⬆️ MERGE (3) - $${window.formatNumber(sItem.rarity * 500)}</span>`;
                } else {
                    equipBtn.innerHTML = `<span>EQUIP ${sItem.type === 'w' ? 'WEAPON' : 'ARMOR'}</span>`;
                }
            } else {
                window.player.selected = -1;
                equipBtn.innerHTML = `<span>SELECT GEAR</span>`;
            }
        } else {
            equipBtn.innerHTML = `<span>SELECT GEAR</span>`;
        }
        
        if(window.SoulSystem) window.SoulSystem.updateBtnUI();
    }

    function updateVisualSlot(type, id) {
        const el = document.getElementById(id);
        const item = window.player.gear[type];
        const advLvl = window.player.advanceLevel || 0; 

        if(item) {
            el.className = 'slot-box slot-filled';
            let rColor = '#333';
            if(item.rarity === 2) rColor = '#00d2ff';
            if(item.rarity === 3) rColor = '#ff00ff';
            if(item.rarity === 4) rColor = '#e74c3c';
            if(item.rarity === 5) rColor = '#f1c40f';
            if(item.rarity === 6) rColor = '#00ffff';
            el.style.borderColor = rColor;
            
            let badgeHtml = advLvl > 0 ? `<div class="adv-badge">+${advLvl}</div>` : '';

            el.innerHTML = `<span>${type === 'w' ? '⚔️' : '🛡️'}</span><div class="slot-label" style="color:${rColor}">${window.formatNumber(item.val)}</div>${badgeHtml}`;
        } else {
            el.className = 'slot-box';
            el.style.borderColor = '#b2bec3';
            el.innerHTML = `<span>${type === 'w' ? '⚔️' : '🛡️'}</span><div class="slot-label">${type === 'w' ? 'WEAPON' : 'ARMOR'}</div>`;
        }
    }

    function mergeItems() {
        if(window.player.selected === -1) return;
        const sItem = window.player.inv[window.player.selected];
        if(!sItem) return; 

        const cost = sItem.rarity * 500;
        if(window.player.coins < cost) { alert("Not enough coins!"); return; }

        let totalCount = 0;
        window.player.inv.forEach(i => { if(i.n === sItem.n && i.type === sItem.type && i.rarity === sItem.rarity) totalCount += i.qty; });

        if(totalCount >= 3) {
            window.player.coins -= cost;
            removeItems(sItem, 3);
            
            const newRarity = sItem.rarity + 1;
            let newVal = Math.floor(sItem.val * 2);
            let newName = "Saiyan Gear";
            if (newRarity === 2) { newVal = 1500; newName = "Elite Gear"; }      
            else if (newRarity === 3) { newVal = 3500; newName = "Legendary Gear"; } 
            else if (newRarity === 4) { newVal = 8500; newName = "God Gear"; }       
            else if (newRarity === 5) { newVal = 20000; newName = "Angel Gear"; }    
            else if (newRarity === 6) { newVal = 50000; newName = "Omni Gear"; }     

            window.addToInventory({ n: newName, type: sItem.type, val: newVal, rarity: newRarity });
            window.player.selected = -1;
            window.isDirty = true;
            syncUI();
        }
    }

    function toggleAutoMerge() {
        isAutoMerging = !isAutoMerging;
        syncUI();
        if(isAutoMerging) processAutoMerge();
    }

    function processAutoMerge() {
        if(!isAutoMerging) return;

        let mergedSomething = false;

        for(let i = 0; i < window.player.inv.length; i++) {
            const item = window.player.inv[i];
            
            if(item.rarity >= 6) continue;

            const cost = item.rarity * 500;
            if(window.player.coins < cost) continue;

            let count = 0;
            window.player.inv.forEach(x => {
                if(x.n === item.n && x.type === item.type && x.rarity === item.rarity) count += x.qty;
            });

            if(count >= 3) {
                window.player.coins -= cost;
                removeItems(item, 3);

                const newRarity = item.rarity + 1;
                let newVal = Math.floor(item.val * 2);
                let newName = "Saiyan Gear";
                if (newRarity === 2) { newVal = 1500; newName = "Elite Gear"; }      
                else if (newRarity === 3) { newVal = 3500; newName = "Legendary Gear"; } 
                else if (newRarity === 4) { newVal = 8500; newName = "God Gear"; }       
                else if (newRarity === 5) { newVal = 20000; newName = "Angel Gear"; }    
                else if (newRarity === 6) { newVal = 50000; newName = "Omni Gear"; }     

                window.addToInventory({ n: newName, type: item.type, val: newVal, rarity: newRarity });
                mergedSomething = true;
                break; 
            }
        }

        window.isDirty = true;
        syncUI();

        if(mergedSomething && isAutoMerging) {
            setTimeout(processAutoMerge, 200);
        }
    }

    function removeItems(templateItem, qtyToRemove) {
        let needed = qtyToRemove;
        for(let i = window.player.inv.length - 1; i >= 0; i--) {
            if(needed <= 0) break;
            let item = window.player.inv[i];
            if(item.n === templateItem.n && item.type === templateItem.type && item.rarity === templateItem.rarity) {
                if(item.qty >= needed) { 
                    item.qty -= needed; 
                    needed = 0; 
                    if(item.qty === 0) window.player.inv.splice(i, 1); 
                } else { 
                    needed -= item.qty; 
                    window.player.inv.splice(i, 1); 
                }
            }
        }
    }

    function train(s, skipSync = false) {
        if(window.player.coins >= 100) {
            window.player.coins -= 100;
            if(s === 'atk') window.player.bAtk += 20; else window.player.bDef += 10;
            window.isDirty = true;
            if(!skipSync) syncUI();
        } else {
            if(!skipSync) alert("Need 100 Coins to Train!");
        }
    }

    function doEquip() {
        if(window.player.selected === -1) return;
        const stackItem = window.player.inv[window.player.selected]; 
        if(!stackItem) {
            window.player.selected = -1;
            syncUI();
            return;
        }

        const itemToEquip = { n: stackItem.n, type: stackItem.type, val: stackItem.val, rarity: stackItem.rarity, qty: 1 };
        const old = window.player.gear[stackItem.type]; 
        
        window.player.gear[stackItem.type] = itemToEquip;
        
        stackItem.qty--;
        if(stackItem.qty <= 0) window.player.inv.splice(window.player.selected, 1);
        
        if(old) window.addToInventory(old);
        
        window.player.selected = -1;
        window.isDirty = true;
        syncUI();
    }

    function popDamage(dmg, id, isSpecial = false) {
        const d = document.createElement('div');
        d.className = 'pop';
        if (typeof dmg === 'string') {
            d.innerText = dmg; 
            d.style.color = '#00ff00'; 
            d.style.fontSize = '1.5rem';
        } else {
            d.innerText = "-" + window.formatNumber(dmg);
            if(isSpecial) { d.style.color = 'cyan'; d.style.fontSize = '3rem'; d.style.zIndex = 30; }
        }
        const randomX = (Math.random() * 40) - 20; 
        const randomY = (Math.random() * 40) - 20;
        const container = document.getElementById(id);
        if(container) {
            d.style.left = id === 'view-char' ? `50%` : `calc(50% + ${randomX}px)`;
            d.style.top = id === 'view-char' ? `40%` : `calc(20% + ${randomY}px)`;
            container.appendChild(d);
            setTimeout(() => d.remove(), 600);
        }
    }

    // --- EXPOSE NECESSARY FUNCTIONS TO WINDOW ---
    window.initGame = initGame;
    window.showTab = showTab;
    window.claimSupply = claimSupply;
    window.tapTrain = tapTrain;
    window.train = train;
    window.doEquip = doEquip;
    window.mergeItems = mergeItems;
    window.closeLevelUp = closeLevelUp;
    window.checkLevelUp = checkLevelUp;
    window.addToInventory = addToInventory;
    window.syncUI = syncUI;
    window.popDamage = popDamage;
    window.toggleAutoMerge = toggleAutoMerge;

})();
