// Wrap in IIFE to protect scope
(function() {

    // --- UTILS ---
    function clearBattleTimers() {
        if (window.battle.pInterval) clearInterval(window.battle.pInterval);
        if (window.battle.eInterval) clearInterval(window.battle.eInterval);
        if (window.battle.autoTimerId) clearTimeout(window.battle.autoTimerId);
        
        window.battle.pInterval = null;
        window.battle.eInterval = null;
        window.battle.autoTimerId = null;
    }

    // --- DBZ VISUAL HELPERS ---
    
    function triggerShake() {
        const arena = document.querySelector('.arena');
        if(arena) {
            arena.classList.remove('shake-screen');
            void arena.offsetWidth; // Force reflow
            arena.classList.add('shake-screen');
        }
    }

    function shiftBackground(direction) {
        const viewBattle = document.getElementById('view-battle');
        if(viewBattle) {
            let currentPos = viewBattle.style.backgroundPositionX || '50%';
            let currentVal = parseInt(currentPos) || 50;
            let shift = direction === 'left' ? -3 : 3; 
            viewBattle.style.backgroundPositionX = (currentVal + shift) + '%';
        }
    }

    async function teleportVisual(container, targetX, targetY = 0) {
        const sprite = container.querySelector('img');
        
        return new Promise(resolve => {
            if(sprite) {
                sprite.classList.add('teleport-flash');
                sprite.style.opacity = '0'; 
            }

            setTimeout(() => {
                container.style.transition = 'none'; 
                container.style.transform = `translate(${targetX}px, ${targetY}px)`;
                
                setTimeout(() => {
                    if(sprite) {
                        sprite.style.opacity = '1';
                        sprite.classList.remove('teleport-flash');
                    }
                    resolve();
                }, 80); 
            }, 100);
        });
    }

    // --- CORE BATTLE FUNCTIONS ---

    function buildStageSelector() {
        const container = document.getElementById('ui-stage-selector');
        if (!container) return;

        container.innerHTML = '';
        const fragment = document.createDocumentFragment();

        for(let i = 1; i <= 20; i++) {
            const dot = document.createElement('div');
            dot.className = 'stage-dot';
            if (i > window.battle.maxStage) dot.classList.add('locked');
            if (i === window.battle.stage) dot.classList.add('active');
            
            dot.innerText = i;
            dot.onclick = () => {
                if(i <= window.battle.maxStage) {
                    window.battle.stage = i;
                    document.getElementById('battle-menu').style.display = 'none';
                    clearBattleTimers();
                    startBattle();
                    buildStageSelector(); 
                }
            };
            fragment.appendChild(dot);
        }
        container.appendChild(fragment);
    }

    function stopCombat() {
        window.battle.active = false;
        if (window.GameState) GameState.inBattle = false;
        clearBattleTimers();
    }

    function exitBattle() {
        stopCombat();
        const menu = document.getElementById('battle-menu');
        if (menu) menu.style.display = 'none';
        if (typeof window.showTab === 'function') window.showTab('char');
    }

    function autoStartNext() {
        const menu = document.getElementById('battle-menu');
        if (menu) menu.style.display = 'none';
        clearBattleTimers();
        
        if(window.battle.stage === window.battle.maxStage && window.battle.maxStage < 20) {
            window.battle.maxStage++;
            window.battle.stage++;
        } else if(window.battle.stage === 20) {
            window.battle.stage = 1;
            window.battle.world++;
            window.battle.maxStage = 1;
        } else if (window.battle.stage < window.battle.maxStage) {
             window.battle.stage++;
        }
        startBattle();
    }

    function restartGame() {
        stopCombat();
        if (window.GameState) {
            window.player.hp = GameState.gokuMaxHP;
        } else {
            const maxHp = window.player.bHp + (window.player.rank * 2500) + (window.player.gear.a?.val || 0);
            window.player.hp = maxHp;
        }
        window.player.charge = 0;
        window.battle.stage = 1;
        document.getElementById('battle-menu').style.display = 'none';
        startBattle();
    }

    async function startBattle() {
        stopCombat(); 
        window.battle.active = true;
        window.battle.cinematic = false;
        if (window.GameState) GameState.inBattle = true;
        
        document.getElementById('start-prompt').style.display = 'none';
        document.getElementById('battle-menu').style.display = 'none';
        
        const eImg = document.getElementById('e-img');
        const pBox = document.getElementById('p-box');
        const eBox = document.getElementById('e-box');
        
        if (eImg) {
            eImg.style.display = 'block';
            eImg.className = ''; 
            eImg.style.transform = '';
            eImg.style.opacity = '1';
            eImg.classList.remove('dead-anim');
        }
        if(pBox) pBox.style.transform = 'translate(0,0)';
        if(eBox) eBox.style.transform = 'translate(0,0)';

        const log = document.getElementById('log');
        if (log) log.innerHTML = `Stage ${window.battle.stage}: Finding guardian...`;
        
        buildStageSelector();

        const viewBattle = document.getElementById('view-battle');
        if(window.apiData.planets.length > 0 && viewBattle) {
            const pIdx = (window.battle.world - 1) % window.apiData.planets.length;
            viewBattle.style.backgroundImage = `url('${window.apiData.planets[pIdx].image}')`;
            viewBattle.style.backgroundPositionX = '50%';
        }

        spawnPersistentEnemy();
        updateBars();
        
        const banner = document.getElementById('ready-msg');
        if (banner) {
            banner.style.display = "block";
            banner.innerText = "READY?";
            await new Promise(r => setTimeout(r, 1000));
            
            if(!window.battle.active) { banner.style.display = 'none'; return; }
            
            banner.innerText = "FIGHT!";
            await new Promise(r => setTimeout(r, 600));
            banner.style.display = "none";
        }
        
        if (log) log.innerHTML = `<div style="color:white">Battle Started!</div>`;
        
        // Player Loop
        window.battle.pInterval = setInterval(() => {
            if(!window.battle.active || window.battle.cinematic) return; 

            if (window.Skills) {
                // Assuming Skills return damage or handle it internally
                // For DoubleHit, logic is internal. For others, we might need manual apply
                // But based on your previous code, let's keep it consistent
                window.Skills.autoBattleTick(window.battle);
            }

            if(window.player.charge >= 100) {
                executeSpecial();
            } else {
                executeStrike('p');
            }
        }, 600); 

        // Enemy Loop
        window.battle.eInterval = setInterval(() => {
            if(!window.battle.active || window.battle.cinematic) return; 
            executeStrike('e');
        }, 900);
    }

    function spawnPersistentEnemy() {
        const scale = Math.pow(1.8, window.battle.stage) * Math.pow(25, window.battle.world - 1);
        const charIdx = (window.battle.stage + (window.battle.world * 3)) % window.apiData.characters.length;
        
        let dat = { name: "Guardian", image: "" };
        if (window.apiData.characters && window.apiData.characters[charIdx]) {
            dat = window.apiData.characters[charIdx];
        }
        
        window.battle.enemy = { 
            name: dat.name, 
            hp: 250 * scale, 
            maxHp: 250 * scale, 
            atk: 30 * scale, 
            i: dat.image 
        };
        
        const eImg = document.getElementById('e-img');
        const eName = document.getElementById('e-name');

        if (eImg) eImg.src = window.battle.enemy.i;
        if (eName) eName.innerText = window.battle.enemy.name;
    }

    // --- CENTRALIZED DAMAGE HANDLER ---
    function applyDamage(amt, sourceSide) {
        if(!window.battle.active) return; 

        const target = (sourceSide === 'p') ? window.battle.enemy : window.player;
        const targetId = (sourceSide === 'p') ? 'e-box' : 'p-box';
        
        target.hp -= amt;
        if (window.popDamage) popDamage(amt, targetId);
        updateBars();

        if(window.battle.enemy.hp <= 0) {
            stopCombat(); 
            const eImg = document.getElementById('e-img');
            if (eImg) eImg.classList.add('dead-anim');
            setTimeout(handleWin, 800);
        } else if(window.player.hp <= 0) {
            stopCombat(); 
            handleDefeat();
        }
    }

    async function executeStrike(side) {
        if(!window.battle.active) return;

        const isP = (side === 'p');
        const attackerBox = document.getElementById(isP ? 'p-box' : 'e-box');
        const victimImg = isP ? document.getElementById('e-img') : document.getElementById('btl-p-sprite');

        const atkVal = isP ? (window.GameState ? window.GameState.gokuPower : 10) : window.battle.enemy.atk;
        
        if(isP) {
            // SOUL BONUS: Increase charge
            const soulLvl = window.player.soulLevel || 1;
            const chargeBonus = Math.floor(soulLvl * 0.5);
            window.player.charge += (12 + chargeBonus);
            if(window.player.charge > 100) window.player.charge = 100;
        }

        const dmg = Math.floor(atkVal * (0.7 + Math.random() * 0.6));
        const isAmbush = Math.random() > 0.8; 

        if(isAmbush) {
            // -- TELEPORT ATTACK --
            await teleportVisual(attackerBox, isP ? 80 : -80); 
            
            if(!window.battle.active) return;

            triggerShake();
            if(victimImg) {
                victimImg.classList.add(isP ? 'knockback-right' : 'knockback-left');
                setTimeout(() => victimImg.classList.remove('knockback-right', 'knockback-left'), 200);
            }
            
            if (window.popDamage) popDamage("CRIT!", isP ? 'e-box' : 'p-box');
            applyDamage(Math.floor(dmg * 1.5), side);

            setTimeout(() => {
                if(window.battle.active) teleportVisual(attackerBox, 0); 
            }, 250);

        } else {
            // -- STANDARD LUNGE --
            attackerBox.style.transition = "transform 0.1s cubic-bezier(0.1, 0.7, 1.0, 0.1)";
            attackerBox.style.transform = isP ? 'translateX(60px)' : 'translateX(-60px)';

            setTimeout(() => {
                if(!window.battle.active) return;

                if(Math.random() > 0.5) triggerShake();
                if(victimImg) {
                    victimImg.style.transition = "transform 0.1s";
                    victimImg.style.transform = isP ? 'translateX(10px)' : 'translateX(-10px)';
                    setTimeout(() => victimImg.style.transform = 'translateX(0)', 100);
                }
                
                applyDamage(dmg, side);

                setTimeout(() => {
                    if(window.battle.active) {
                        attackerBox.style.transition = "transform 0.2s ease-out";
                        attackerBox.style.transform = 'translateX(0)';
                    }
                }, 100);

            }, 100);
        }
    }

    async function executeSpecial() {
        if(!window.battle.active || window.battle.cinematic) return; 
        
        window.battle.cinematic = true; 
        window.player.charge = 0; 
        updateBars();

        const cutInWrap = document.getElementById('cutin-overlay');
        const cutInImg = document.getElementById('cutin-img');
        
        if (cutInImg) cutInImg.src = (window.player.rank >= 1) ? 'charged_s.png' : 'charged_b.png';
        if (cutInWrap) cutInWrap.style.display = 'flex';

        await new Promise(r => setTimeout(r, 450)); 

        const beam = document.getElementById('fx-beam');
        if (beam) {
            beam.style.opacity = '1';
            beam.style.width = '200%'; 
            triggerShake(); 
        }

        await new Promise(r => setTimeout(r, 200)); 
        if (cutInWrap) cutInWrap.style.display = 'none';

        if(!window.battle.active) { window.battle.cinematic = false; return; }
        
        // SOUL BONUS to Special
        const soulLvl = window.player.soulLevel || 1;
        const power = window.GameState ? window.GameState.gokuPower : 100;
        const soulBonus = 1 + (soulLvl * 0.1); 
        
        const dmg = Math.floor(power * 6 * soulBonus);
        if (window.popDamage) popDamage("ULTIMATE!", 'e-box', true);
        
        const eImg = document.getElementById('e-img');
        if(eImg) eImg.classList.add('knockback-right');
        
        applyDamage(dmg, 'p');

        setTimeout(() => {
            if (beam) {
                beam.style.transition = "opacity 0.2s ease-out"; 
                beam.style.opacity = '0'; 
                
                setTimeout(() => {
                    beam.style.transition = "none"; 
                    beam.style.width = "0"; 
                    
                    if(window.battle.active && window.battle.enemy.hp > 0 && eImg) {
                         eImg.classList.remove('knockback-right');
                    }

                    setTimeout(() => {
                        beam.style.transition = "width 0.2s cubic-bezier(0.1, 0.7, 1.0, 0.1), opacity 0.2s ease-in";
                    }, 50);

                    window.battle.cinematic = false; 
                }, 200);
            } else {
                window.battle.cinematic = false;
            }
        }, 500);
    }

    function handleWin() {
        // Guard
        const menu = document.getElementById('battle-menu');
        if(menu && menu.style.display === 'flex') return;

        // --- SOUL GAIN ---
        if(window.SoulSystem) window.SoulSystem.gainSoul();
        // ----------------

        const tEl = document.getElementById('menu-title');
        if (tEl) {
            tEl.innerText = "STAGE CLEARED!";
            tEl.style.color = "var(--dbz-yellow)";
        }

        let startPct = (window.player.xp / window.player.nextXp) * 100;
        if(isNaN(startPct)) startPct = 0;
        let oldLvl = window.player.lvl; 

        const xpGain = 100 * window.battle.stage * window.battle.world;
        const coinGain = 250;
        window.player.xp += xpGain; 
        window.player.coins += coinGain;
            
        const log = document.getElementById('log');
        if (log) log.innerHTML = `<div style="color:cyan">> WON! +${xpGain} XP</div>`;
            
        let dropText = "NONE";
        let dropCount = 0;
        const qty = Math.floor(Math.random() * 4); 

        let dropRarity = Math.min(6, window.battle.world);
        let baseVal = 700;
        let baseName = "Saiyan Gear";

        if (dropRarity === 2) { baseVal = 1500; baseName = "Elite Gear"; }
        else if (dropRarity === 3) { baseVal = 3500; baseName = "Legendary Gear"; }
        else if (dropRarity === 4) { baseVal = 8500; baseName = "God Gear"; }
        else if (dropRarity === 5) { baseVal = 20000; baseName = "Angel Gear"; }
        else if (dropRarity === 6) { baseVal = 50000; baseName = "Omni Gear"; }

        for(let i = 0; i < qty; i++) {
            if (typeof window.addToInventory === 'function') {
                addToInventory({
                    n: baseName, 
                    type: Math.random() > 0.5 ? 'w' : 'a', 
                    val: baseVal, 
                    rarity: dropRarity 
                });
                dropCount++;
            }
        }

        if(dropCount > 0) {
            let rColor = "#fff";
            if(dropRarity === 2) rColor = "#00d2ff"; 
            if(dropRarity === 3) rColor = "#ff00ff"; 
            if(dropRarity >= 4) rColor = "#e74c3c";  
            dropText = `<span style="color:${rColor}">+${dropCount} ${baseName.toUpperCase()}</span>`;
        }

        if(typeof window.checkLevelUp === 'function') {
            checkLevelUp();
        }

        let leveledUp = (window.player.lvl > oldLvl);

        if (typeof window.syncUI === 'function') syncUI();
        if (window.Skills) Skills.autoBattleTick();

        document.getElementById('r-xp').innerText = xpGain;
        document.getElementById('r-coins').innerText = coinGain;
        document.getElementById('r-drops').innerHTML = dropText; 
        document.getElementById('r-lvl').innerText = window.player.lvl;
            
        const xpTextEl = document.getElementById('r-xp-text');
        if (xpTextEl) {
            if(leveledUp) {
                xpTextEl.innerText = "LEVEL UP!";
                xpTextEl.style.color = "#00ff00";
                xpTextEl.style.textShadow = "0 0 5px #00ff00";
            } else {
                xpTextEl.innerText = `${Math.floor(window.player.xp)} / ${Math.floor(window.player.nextXp)}`;
                xpTextEl.style.color = "white";
                xpTextEl.style.textShadow = "none";
            }
        }

        if (menu) menu.style.display = 'flex';

        const rBar = document.getElementById('r-bar-xp');
        if (rBar) {
            let endPct = leveledUp ? 100 : (window.player.xp / window.player.nextXp) * 100;
            rBar.style.transition = 'none';
            rBar.style.width = startPct + "%";
            void rBar.offsetWidth; 
            requestAnimationFrame(() => {
                rBar.style.transition = 'width 3s ease-out';
                rBar.style.width = endPct + "%";
            });
        }

        const btnNext = document.querySelector('#battle-menu .menu-btn:first-of-type');
        if (btnNext) {
            btnNext.onclick = () => {
                if(window.battle.autoTimerId) clearTimeout(window.battle.autoTimerId);
                autoStartNext();
            };
            
            let time = 3;
            btnNext.innerText = `NEXT STAGE (${time})`;
            
            if(window.battle.autoTimerId) clearTimeout(window.battle.autoTimerId);
            window.battle.autoTimerId = setInterval(() => {
                time--;
                btnNext.innerText = `NEXT STAGE (${time})`;
                if(time <= 0) { 
                    clearBattleTimers(); 
                    autoStartNext(); 
                }
            }, 1000);
        }
    }

    function handleDefeat() {
        const menu = document.getElementById('battle-menu');
        if(menu && menu.style.display === 'flex') return;

        if (window.GameState) {
            window.player.hp = GameState.gokuMaxHP;
        } else {
            const maxHp = window.player.bHp + (window.player.rank * 2500) + (window.player.gear.a?.val || 0);
            window.player.hp = maxHp; 
        }

        if (typeof window.syncUI === 'function') syncUI();

        const tEl = document.getElementById('menu-title');
        if (tEl) {
            tEl.innerText = "DEFEATED";
            tEl.style.color = "#c0392b"; 
        }

        document.getElementById('r-lvl').innerText = window.player.lvl;
        document.getElementById('r-xp-text').innerText = `${Math.floor(window.player.xp)} / ${Math.floor(window.player.nextXp)}`;
        
        const xpPct = Math.min(100, (window.player.xp / window.player.nextXp) * 100);
        document.getElementById('r-bar-xp').style.width = xpPct + "%";

        document.getElementById('r-xp').innerText = "0";
        document.getElementById('r-coins').innerText = "0";
        document.getElementById('r-drops').innerText = "NONE";

        const btnNext = document.querySelector('#battle-menu .menu-btn:first-of-type');
        if (btnNext) {
            btnNext.onclick = restartGame; 
            let time = 5; 
            btnNext.innerText = `RESTART (STAGE 1) (${time})`;
            
            if (menu) menu.style.display = 'flex';
            
            if(window.battle.autoTimerId) clearTimeout(window.battle.autoTimerId);
            window.battle.autoTimerId = setInterval(() => {
                time--;
                btnNext.innerText = `RESTART (STAGE 1) (${time})`;
                if(time <= 0) { 
                    clearBattleTimers(); 
                    restartGame(); 
                }
            }, 1000);
        }
    }

    function updateBars() {
        let m = window.GameState ? window.GameState.gokuMaxHP : 100;
        
        const btlPHp = document.getElementById('btl-p-hp');
        const btlEHp = document.getElementById('btl-e-hp');
        const btlPCharge = document.getElementById('btl-p-charge');

        if (btlPHp) btlPHp.style.width = Math.max(0, (window.player.hp / m * 100)) + "%";
        if (btlEHp && window.battle.enemy) btlEHp.style.width = Math.max(0, (window.battle.enemy.hp / window.battle.enemy.maxHp * 100)) + "%";
        if (btlPCharge) btlPCharge.style.width = window.player.charge + "%";
    }

    // --- EXPOSE NECESSARY FUNCTIONS ---
    window.startBattle = startBattle;
    window.stopCombat = stopCombat;
    window.exitBattle = exitBattle;
    window.autoStartNext = autoStartNext;
    window.buildStageSelector = buildStageSelector;

})();
