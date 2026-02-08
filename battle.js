// Wrap in IIFE to protect scope
(function() {

    // --- UTILS ---
    function clearBattleTimers() {
        if (!window.battle) return;
        if (window.battle.pInterval) clearInterval(window.battle.pInterval);
        if (window.battle.eInterval) clearInterval(window.battle.eInterval);
        if (window.battle.autoTimerId) clearTimeout(window.battle.autoTimerId);
        
        window.battle.pInterval = null;
        window.battle.eInterval = null;
        window.battle.autoTimerId = null;
    }

    // --- DBZ VISUAL HELPERS ---
    function triggerShake(intensity = 'normal') {
        const arena = document.querySelector('.arena');
        if(arena) {
            arena.classList.remove('shake-screen');
            void arena.offsetWidth; 
            arena.style.animationDuration = intensity === 'heavy' ? '0.2s' : '0.3s';
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

    // --- STAGE SELECTION & MODAL LOGIC ---

    // 1. Show the Modal with details
    function openStageDetails(stageNum) {
        window.battle.selectedStage = stageNum; 
        
        const modal = document.getElementById('stage-details-modal');
        if(!modal) return;

        // Calculate potential stats
        const scale = Math.pow(1.8, stageNum) * Math.pow(25, window.battle.world - 1);
        const estHp = Math.floor(250 * scale);
        const estAtk = Math.floor(30 * scale);
        const recPower = Math.floor((estAtk * 15) + estHp); 

        // Rewards
        const xp = 100 * stageNum * window.battle.world;
        const coins = 250;
        let drops = "Common";
        if(stageNum % 5 === 0) drops = "High";
        if(stageNum === 20) drops = "LEGENDARY";
        
        // Add Shard indicator for eligible stages
        if ((window.battle.world === 1 && stageNum >= 15) || window.battle.world > 1) {
            drops += " + 💎"; 
        }

        // Determine Enemy Image & Name
        let imgUrl = "";
        let name = "Enemy";
        
        if (window.apiData && window.apiData.characters) {
            if(stageNum === 20) {
                let bossName = "Frieza";
                const wMod = window.battle.world % 3;
                if(wMod === 2) bossName = "Cell";
                if(wMod === 0) bossName = "Majin";
                let charData = window.apiData.characters.find(c => c.name.includes(bossName));
                if(!charData) charData = window.apiData.characters[(window.battle.world * 5) % window.apiData.characters.length];
                
                imgUrl = charData ? charData.image : "";
                name = "BOSS " + (charData ? charData.name : "Titan");
            } else {
                const charIdx = (stageNum + (window.battle.world * 3)) % window.apiData.characters.length;
                let dat = window.apiData.characters[charIdx];
                if(dat) {
                    imgUrl = dat.image;
                    name = dat.name;
                }
            }
        }

        document.getElementById('sd-num').innerText = stageNum;
        document.getElementById('sd-enemy-img').src = imgUrl;
        document.getElementById('sd-enemy-name').innerText = name;
        document.getElementById('sd-power').innerText = window.formatNumber ? window.formatNumber(recPower) : recPower;
        document.getElementById('sd-xp').innerText = xp;
        document.getElementById('sd-coins').innerText = coins;
        document.getElementById('sd-drops').innerText = drops;

        const aura = document.querySelector('.enemy-aura');
        if(aura) {
            aura.style.background = (stageNum === 20) 
                ? "radial-gradient(circle, rgba(255,0,0,0.8), transparent 70%)" 
                : "radial-gradient(circle, rgba(0,255,255,0.6), transparent 70%)"; 
        }

        modal.style.display = 'flex';
    }

    // 2. Hide Modal
    function closeStageDetails() {
        const modal = document.getElementById('stage-details-modal');
        if(modal) modal.style.display = 'none';
    }

    // 3. Actually Start Battle
    function confirmStart() {
        closeStageDetails();
        if(window.battle.selectedStage) {
            window.battle.stage = window.battle.selectedStage;
            document.getElementById('battle-menu').style.display = 'none';
            clearBattleTimers();
            startBattle();
            buildStageSelector();
        }
    }

    // --- CORE BATTLE FUNCTIONS ---

    function buildStageSelector() {
        const container = document.getElementById('ui-stage-selector');
        if (!container || !window.battle) return;

        container.innerHTML = '';
        const fragment = document.createDocumentFragment();

        for(let i = 1; i <= 20; i++) {
            const dot = document.createElement('div');
            dot.className = 'stage-dot';
            if (i > window.battle.maxStage) dot.classList.add('locked');
            if (i === window.battle.stage) dot.classList.add('active');
            if (i === 20) dot.style.borderColor = "red";

            dot.innerText = i;
            dot.onclick = () => {
                if(i <= window.battle.maxStage) {
                    openStageDetails(i);
                }
            };
            fragment.appendChild(dot);
        }
        container.appendChild(fragment);
    }

    function stopCombat() {
        if(window.battle) window.battle.active = false;
        if (window.GameState) window.GameState.inBattle = false;
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
            window.player.hp = window.GameState.gokuMaxHP;
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
        if (window.GameState) window.GameState.inBattle = true;
        
        document.getElementById('start-prompt').style.display = 'none';
        document.getElementById('battle-menu').style.display = 'none';
        
        const eImg = document.getElementById('e-img');
        const pBox = document.getElementById('p-box');
        const eBox = document.getElementById('e-box');
        
        if (eImg) {
            eImg.style.display = 'block';
            eImg.className = ''; 
            eImg.style.transform = '';
            eImg.style.filter = ''; 
            eImg.style.opacity = '1';
        }
        if(pBox) pBox.style.transform = 'translate(0,0)';
        if(eBox) eBox.style.transform = 'translate(0,0)';

        const log = document.getElementById('log');
        if (log) log.innerHTML = `Stage ${window.battle.stage}: Finding opponent...`;
        
        buildStageSelector();

        const viewBattle = document.getElementById('view-battle');
        if(window.apiData && window.apiData.planets && window.apiData.planets.length > 0 && viewBattle) {
            const pIdx = (window.battle.world - 1) % window.apiData.planets.length;
            viewBattle.style.backgroundImage = `url('${window.apiData.planets[pIdx].image}')`;
            viewBattle.style.backgroundPositionX = '50%';
        }

        spawnPersistentEnemy();
        updateBars();
        
        const banner = document.getElementById('ready-msg');
        if (banner) {
            banner.style.display = "block";
            if(window.battle.stage === 20) {
                banner.innerText = "BOSS BATTLE";
                banner.style.color = "red";
            } else {
                banner.innerText = "READY?";
                banner.style.color = "var(--dbz-yellow)";
            }
            
            await new Promise(r => setTimeout(r, 1000));
            if(!window.battle.active) { banner.style.display = 'none'; return; }
            banner.innerText = "FIGHT!";
            await new Promise(r => setTimeout(r, 600));
            banner.style.display = "none";
        }
        
        if (log) log.innerHTML = `<div style="color:white">Battle Started!</div>`;
        
        window.battle.pInterval = setInterval(() => {
            if(!window.battle.active || window.battle.cinematic) return; 
            if (window.Skills) window.Skills.autoBattleTick(window.battle);
            if(window.player.charge >= 100) executeSpecial();
            else executeStrike('p');
        }, 600); 

        window.battle.eInterval = setInterval(() => {
            if(!window.battle.active || window.battle.cinematic) return; 
            executeStrike('e');
        }, 900);
    }

    function spawnPersistentEnemy() {
        const scale = Math.pow(1.8, window.battle.stage) * Math.pow(25, window.battle.world - 1);
        
        if (!window.apiData || !window.apiData.characters || window.apiData.characters.length === 0) {
            window.battle.enemy = { name: "Loading...", hp: 100, maxHp: 100, atk: 10, i: "" };
            return;
        }

        if (window.battle.stage === 20) {
            window.battle.bossPhase = 1; 
            let bossName = "Frieza";
            const wMod = window.battle.world % 3;
            if(wMod === 2) bossName = "Cell";
            if(wMod === 0) bossName = "Majin";

            let charData = window.apiData.characters.find(c => c.name.includes(bossName));
            if(!charData) charData = window.apiData.characters[(window.battle.world * 5) % window.apiData.characters.length];

            window.battle.enemy = { 
                name: "BOSS " + (charData ? charData.name : "Titan"),
                hp: 2000 * scale,
                maxHp: 2000 * scale, 
                atk: 80 * scale,
                i: charData ? charData.image : ""
            };

            const eName = document.getElementById('e-name');
            if(eName) {
                eName.innerText = "⚠ " + window.battle.enemy.name + " ⚠";
                eName.style.color = "#ff0000";
                eName.style.textShadow = "0 0 5px red";
            }
        } 
        else {
            window.battle.bossPhase = 0;
            const charIdx = (window.battle.stage + (window.battle.world * 3)) % window.apiData.characters.length;
            let dat = window.apiData.characters[charIdx] || { name: "Guardian", image: "" };
            
            window.battle.enemy = { 
                name: dat.name, 
                hp: 250 * scale, 
                maxHp: 250 * scale, 
                atk: 30 * scale, 
                i: dat.image 
            };
            const eName = document.getElementById('e-name');
            if(eName) {
                eName.innerText = window.battle.enemy.name;
                eName.style.color = "white";
                eName.style.textShadow = "1px 1px black";
            }
        }
        
        const eImg = document.getElementById('e-img');
        if (eImg) eImg.src = window.battle.enemy.i;
    }

    async function transformBoss() {
        window.battle.cinematic = true;
        const eImg = document.getElementById('e-img');
        if(eImg) {
            eImg.style.transition = "transform 1s, filter 1s";
            eImg.style.transform = "scale(0.1) rotate(360deg)"; 
        }
        if (window.popDamage) window.popDamage("FINAL FORM!", 'e-box', true);
        triggerShake('heavy');
        await new Promise(r => setTimeout(r, 1000));

        window.battle.bossPhase = 2;
        window.battle.enemy.maxHp = window.battle.enemy.maxHp * 1.5; 
        window.battle.enemy.hp = window.battle.enemy.maxHp; 
        window.battle.enemy.atk = window.battle.enemy.atk * 1.5; 
        
        if(eImg) {
            eImg.style.transform = "scale(1.4)"; 
            eImg.style.filter = "sepia(1) saturate(5) hue-rotate(-50deg) drop-shadow(0 0 20px red)";
        }
        const eName = document.getElementById('e-name');
        if(eName) eName.innerText = "MAX POWER " + window.battle.enemy.name;

        updateBars();
        window.battle.cinematic = false;
    }

    function applyDamage(amt, sourceSide) {
        if(!window.battle.active) return; 
        const target = (sourceSide === 'p') ? window.battle.enemy : window.player;
        const targetId = (sourceSide === 'p') ? 'e-box' : 'p-box';
        target.hp -= amt;
        if (window.popDamage) window.popDamage(amt, targetId);
        updateBars();

        if(window.battle.enemy.hp <= 0) {
            if (window.battle.stage === 20 && window.battle.bossPhase === 1) {
                window.battle.enemy.hp = 1; 
                transformBoss();
                return;
            }
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

        // --- CALCULATE AMBUSH/CRIT CHANCE ---
        let threshold = 0.8; // Default for Enemy (20% chance)

        if (isP) {
            // Player Logic: Base 10% + 5% per Rank
            let critChance = 0.1 + (window.player.rank * 0.05);
            
            // Advance Level Bonus
            if(window.player.advanceLevel && window.player.advanceLevel >= 5) {
                critChance += 0.05 + (window.player.advanceLevel * 0.005);
            }
            
            // Convert percentage to threshold (e.g. 30% chance means > 0.7)
            threshold = 1.0 - critChance;
        }

        // Declare isAmbush ONLY ONCE here
        const isAmbush = Math.random() > threshold;
        // -------------------------------------

        const attackerBox = document.getElementById(isP ? 'p-box' : 'e-box');
        const victimImg = isP ? document.getElementById('e-img') : document.getElementById('btl-p-sprite');
        const atkVal = isP ? (window.GameState ? window.GameState.gokuPower : 10) : window.battle.enemy.atk;
        
        if(isP) {
            const soulLvl = window.player.soulLevel || 1;
            const chargeBonus = Math.floor(soulLvl * 0.5);
            window.player.charge += (12 + chargeBonus);
            if(window.player.charge > 100) window.player.charge = 100;
        }

        const dmg = Math.floor(atkVal * (0.7 + Math.random() * 0.6));

        if(isAmbush) {
            await teleportVisual(attackerBox, isP ? 80 : -80); 
            if(!window.battle.active) return;
            
            triggerShake();
            
            if(victimImg) {
                victimImg.classList.add(isP ? 'knockback-right' : 'knockback-left');
                setTimeout(() => victimImg.classList.remove('knockback-right', 'knockback-left'), 200);
            }
            
            if (window.popDamage) window.popDamage("CRIT!", isP ? 'e-box' : 'p-box');
            applyDamage(Math.floor(dmg * 1.5), side);
            
            setTimeout(() => { if(window.battle.active) teleportVisual(attackerBox, 0); }, 250);
        } else {
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
            triggerShake('heavy'); 
        }
        await new Promise(r => setTimeout(r, 200)); 
        if (cutInWrap) cutInWrap.style.display = 'none';

        if(!window.battle.active) { window.battle.cinematic = false; return; }
        
        const soulLvl = window.player.soulLevel || 1;
        const power = window.GameState ? window.GameState.gokuPower : 100;
        const soulBonus = 1 + (soulLvl * 0.1); 
        const dmg = Math.floor(power * 6 * soulBonus);
        
        if (window.popDamage) window.popDamage("ULTIMATE!", 'e-box', true);
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
        const menu = document.getElementById('battle-menu');
        if(menu && menu.style.display === 'flex') return;

        if(window.SoulSystem) window.SoulSystem.gainSoul();

        const tEl = document.getElementById('menu-title');
        if (tEl) {
            tEl.innerText = "STAGE CLEARED!";
            tEl.style.color = "var(--dbz-yellow)";
        }

        let startPct = (window.player.xp / window.player.nextXp) * 100;
        if(isNaN(startPct)) startPct = 0;
        let oldLvl = window.player.lvl; 

        let xpGain = 100 * window.battle.stage * window.battle.world;
        let coinGain = 250;
        let bossSouls = 0;
        if (window.battle.stage === 20) {
            xpGain *= 5;
            coinGain *= 5;
            bossSouls = Math.floor(30 + Math.random() * 70);
            window.player.souls = (window.player.souls || 0) + bossSouls;
        }

        window.player.xp += xpGain; 
        window.player.coins += coinGain;
            
        const log = document.getElementById('log');
        if (log) log.innerHTML = `<div style="color:cyan">> WON! +${xpGain} XP</div>`;
            
        let dropText = "NONE";
        let dropCount = 0;
        const qty = Math.floor(Math.random() * 4); 

        let dropRarity = Math.min(6, window.battle.world);
        if (window.battle.stage === 20 && dropRarity < 3) dropRarity = 3;

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
        
        let shardDrop = 0;
        if ((window.battle.world === 1 && window.battle.stage >= 15) || window.battle.world > 1) {
            if(Math.random() < 0.35) {
                shardDrop = 1;
                if(window.battle.stage === 20) shardDrop = Math.floor(Math.random() * 3) + 1;
            }
        }
        if(shardDrop > 0) window.player.dragonShards = (window.player.dragonShards || 0) + shardDrop;
        
        if(window.player.advanceLevel >= 10) {
            const healAmt = window.GameState.gokuMaxHP * 0.15;
            window.player.hp = Math.min(window.player.hp + healAmt, window.GameState.gokuMaxHP);
        }

        let dropsHtml = "";
        if(bossSouls > 0) dropsHtml += `<div style="color:#00ffff; font-weight:bold;">+${bossSouls} SOULS</div>`;
        if(dropCount > 0) {
            let rColor = "#fff";
            if(dropRarity === 2) rColor = "#00d2ff"; 
            if(dropRarity === 3) rColor = "#ff00ff"; 
            if(dropRarity >= 4) rColor = "#e74c3c";  
            dropsHtml += `<div style="color:${rColor}">+${dropCount} ${baseName.toUpperCase()}</div>`;
        }
        
        if(dropsHtml === "") dropText = "NONE";
        else dropText = dropsHtml;

        if(typeof window.checkLevelUp === 'function') checkLevelUp();

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

        if (window.GameState) window.player.hp = window.GameState.gokuMaxHP;
        else {
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
    window.openStageDetails = openStageDetails;
    window.closeStageDetails = closeStageDetails;
    window.confirmStart = confirmStart;

})();
