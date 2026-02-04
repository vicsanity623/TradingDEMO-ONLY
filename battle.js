// --- REAL-TIME BATTLE SYSTEM ---

function buildStageSelector() {
    const container = document.getElementById('ui-stage-selector');
    container.innerHTML = '';
    for(let i = 1; i <= 20; i++) {
        const dot = document.createElement('div');
        dot.className = `stage-dot ${i > battle.maxStage ? 'locked' : ''} ${i === battle.stage ? 'active' : ''}`;
        dot.innerText = i;
        dot.onclick = () => {
            if(i <= battle.maxStage) {
                battle.stage = i;
                document.getElementById('battle-menu').style.display = 'none';
                if(battle.autoTimerId) clearTimeout(battle.autoTimerId);
                startBattle();
            }
        };
        container.appendChild(dot);
    }
}

function stopCombat() {
    battle.active = false;
    GameState.inBattle = false;

    clearInterval(battle.pInterval);
    clearInterval(battle.eInterval);
}

function exitBattle() {
    document.getElementById('battle-menu').style.display = 'none';
    if(battle.autoTimerId) clearTimeout(battle.autoTimerId);
    showTab('char');
}

function autoStartNext() {
    document.getElementById('battle-menu').style.display = 'none';
    if(battle.autoTimerId) clearTimeout(battle.autoTimerId);
    
    if(battle.stage === battle.maxStage && battle.maxStage < 20) {
        battle.maxStage++;
        battle.stage++;
    } else if(battle.stage === 20) {
        battle.stage = 1;
        battle.world++;
        battle.maxStage = 1;
    } else if (battle.stage < battle.maxStage) {
         battle.stage++;
    }
    startBattle();
}

function restartGame() {
    const maxHp = player.bHp + (player.rank * 2500) + (player.gear.a?.val || 0);
    player.hp = maxHp;
    player.charge = 0;
    battle.stage = 1;
    
    document.getElementById('battle-menu').style.display = 'none';
    if(battle.autoTimerId) clearTimeout(battle.autoTimerId);
    
    startBattle();
}

async function startBattle() {
    stopCombat(); 
    battle.active = true;
    GameState.inBattle = true;
    
    document.getElementById('start-prompt').style.display = 'none';
    document.getElementById('battle-menu').style.display = 'none';
    document.getElementById('e-img').style.display = 'block';
    document.getElementById('e-img').classList.remove('dead-anim');

    const log = document.getElementById('log');
    log.innerHTML = `Stage ${battle.stage}: Finding guardian...`;
    
    buildStageSelector();

    if(apiData.planets.length > 0) {
        const pIdx = (battle.world - 1) % apiData.planets.length;
        document.getElementById('view-battle').style.backgroundImage = `url('${apiData.planets[pIdx].image}')`;
    }

    spawnPersistentEnemy();
    updateBars();
    
    const banner = document.getElementById('ready-msg');
    banner.style.display = "block";
    banner.innerText = "READY?";
    await new Promise(r => setTimeout(r, 1000));
    banner.innerText = "FIGHT!";
    await new Promise(r => setTimeout(r, 600));
    banner.style.display = "none";
    
    log.innerHTML = `<div style="color:white">Battle Started!</div>`;
    
    battle.pInterval = setInterval(() => {
        if(!battle.active || battle.cinematic) return; 

        if (window.Skills) {
            const dhDmg = Skills.useDoubleHit(battle);
            if (dhDmg > 0) {
                battle.enemy.hp -= dhDmg;
                popDamage(dhDmg, 'e-box', true);
            }
            Skills.useFocus();
            const kbDmg = Skills.useKameBlast();
            if (kbDmg > 0) {
                battle.enemy.hp -= kbDmg;
                popDamage(kbDmg, 'e-box', true);
            }
        }

        if(player.charge >= 100) {
            executeSpecial();
        } else {
            executeStrike('p');
        }

        updateBars();
    }, 400);

    battle.eInterval = setInterval(() => {
        if(!battle.active || battle.cinematic) return; 
        executeStrike('e');
    }, 500);
}

function spawnPersistentEnemy() {
    const scale = Math.pow(1.8, battle.stage) * Math.pow(25, battle.world - 1);
    const charIdx = (battle.stage + (battle.world * 3)) % apiData.characters.length;
    let dat = apiData.characters[charIdx] || {name:"Guardian", image:""};
    
    battle.enemy = { name: dat.name, hp: 250 * scale, maxHp: 250 * scale, atk: 30 * scale, i: dat.image };
    
    document.getElementById('e-img').src = battle.enemy.i;
    document.getElementById('e-name').innerText = battle.enemy.name;
}

function executeStrike(side) {
    if(!battle.active) return;

    const isP = (side === 'p');
    const atkVal = isP ? (player.bAtk + (player.rank * 400) + (player.gear.w?.val || 0)) : battle.enemy.atk;
    const target = isP ? battle.enemy : player;
    const targetId = isP ? 'e-box' : 'p-box';
    
    if(isP) player.charge += 12; 
    if(player.charge > 100) player.charge = 100;

    const dmg = Math.floor(atkVal * (0.7 + Math.random() * 0.6));
    target.hp -= dmg;
    
    popDamage(dmg, targetId);
    updateBars();
    
    const el = document.getElementById(isP ? 'p-box' : 'e-box');
    el.style.transform = isP ? 'translateX(30px)' : 'translateX(-30px)';
    setTimeout(() => el.style.transform = 'translateX(0)', 50);

    if(battle.enemy.hp <= 0) {
        stopCombat();
        document.getElementById('e-img').classList.add('dead-anim');
        setTimeout(handleWin, 600);
    } else if(player.hp <= 0) {
        stopCombat();
        handleDefeat();
    }
}

async function executeSpecial() {
    if(!battle.active || battle.cinematic) return; 
    
    battle.cinematic = true; 
    player.charge = 0; 
    updateBars();

    const cutInWrap = document.getElementById('cutin-overlay');
    const cutInImg = document.getElementById('cutin-img');
    cutInImg.src = (player.rank >= 1) ? 'charged_s.png' : 'charged_b.png';
    cutInWrap.style.display = 'flex';

    await new Promise(r => setTimeout(r, 450)); 

    const beam = document.getElementById('fx-beam');
    beam.style.opacity = '1';
    beam.style.width = '90%'; 

    await new Promise(r => setTimeout(r, 200)); 
    cutInWrap.style.display = 'none';

    if(!battle.active) { battle.cinematic = false; return; }
    
    const dmg = (player.bAtk + (player.rank * 400) + (player.gear.w?.val || 0)) * 6;
    battle.enemy.hp -= dmg;
    popDamage(dmg, 'e-box', true);
    updateBars();

    setTimeout(() => {
        beam.style.transition = "opacity 0.2s ease-out"; 
        beam.style.opacity = '0'; 
        
        setTimeout(() => {
            beam.style.transition = "none"; 
            beam.style.width = "0"; 
            
            setTimeout(() => {
                beam.style.transition = "width 0.2s cubic-bezier(0.1, 0.7, 1.0, 0.1), opacity 0.2s ease-in";
            }, 50);

            battle.cinematic = false; 
        }, 200);
        
    }, 300);

    if(battle.enemy.hp <= 0) {
        stopCombat();
        document.getElementById('e-img').classList.add('dead-anim');
        setTimeout(handleWin, 600);
    }
}

function handleWin() {
    const tEl = document.getElementById('menu-title');
    tEl.innerText = "STAGE CLEARED!";
    tEl.style.color = "var(--dbz-yellow)";

    let startPct = (player.xp / player.nextXp) * 100;
    if(isNaN(startPct)) startPct = 0;
    let oldLvl = player.lvl; // Capture level to check if we leveled up later

    const xpGain = 100 * battle.stage * battle.world;
    const coinGain = 250;
    player.xp += xpGain; 
    player.coins += coinGain;
        
    document.getElementById('log').innerHTML = `<div style="color:cyan">> WON! +${xpGain} XP</div>`;
        
    let dropText = "NONE";
    let dropCount = 0;
    const qty = Math.floor(Math.random() * 4); 

    let dropRarity = Math.min(6, battle.world);
    let baseVal = 700;
    let baseName = "Saiyan Gear";

    if (dropRarity === 2) { baseVal = 1500; baseName = "Elite Gear"; }
    else if (dropRarity === 3) { baseVal = 3500; baseName = "Legendary Gear"; }
    else if (dropRarity === 4) { baseVal = 8500; baseName = "God Gear"; }
    else if (dropRarity === 5) { baseVal = 20000; baseName = "Angel Gear"; }
    else if (dropRarity === 6) { baseVal = 50000; baseName = "Omni Gear"; }

    for(let i = 0; i < qty; i++) {
        addToInventory({
            n: baseName, 
            type: Math.random() > 0.5 ? 'w' : 'a', 
            val: baseVal, 
            rarity: dropRarity 
        });
        dropCount++;
    }

    if(dropCount > 0) {
        let rColor = "#fff";
        if(dropRarity === 2) rColor = "#00d2ff"; 
        if(dropRarity === 3) rColor = "#ff00ff"; 
        if(dropRarity >= 4) rColor = "#e74c3c";  
            
        dropText = `<span style="color:${rColor}">+${dropCount} ${baseName.toUpperCase()}</span>`;
    }

    if(typeof checkLevelUp === 'function') {
        checkLevelUp(); // Keeps your external logic if it exists
    } else {

        while(player.xp >= player.nextXp) {
            player.lvl++; 
            player.xp -= player.nextXp; 
            player.nextXp = Math.floor(player.nextXp * 1.3);
            player.bHp += 250; player.bAtk += 5; player.bDef += 2;
            player.hp = player.bHp + (player.rank * 2500) + (player.gear.a?.val || 0);
            if(player.lvl >= 100) { player.lvl = 1; player.rank++; }
        }
    }

    let leveledUp = (player.lvl > oldLvl);

    syncUI();
    
    if (window.Skills) {
        Skills.autoBattleTick();
    }

    document.getElementById('r-xp').innerText = xpGain;
    document.getElementById('r-coins').innerText = coinGain;
    document.getElementById('r-drops').innerHTML = dropText; 

    document.getElementById('r-lvl').innerText = player.lvl;

    const xpTextEl = document.getElementById('r-xp-text');
    if(leveledUp) {
        xpTextEl.innerText = "LEVEL UP!";
        xpTextEl.style.color = "#00ff00";
        xpTextEl.style.textShadow = "0 0 5px #00ff00";
    } else {
        xpTextEl.innerText = `${Math.floor(player.xp)} / ${Math.floor(player.nextXp)}`;
        xpTextEl.style.color = "white";
        xpTextEl.style.textShadow = "none";
    }

    const rBar = document.getElementById('r-bar-xp');

    let endPct = leveledUp ? 100 : (player.xp / player.nextXp) * 100;

    rBar.style.transition = 'none';
    rBar.style.width = startPct + "%";

    void rBar.offsetWidth; 
    rBar.style.transition = 'width 3s ease-out';
    rBar.style.width = endPct + "%";

    const menu = document.getElementById('battle-menu');
    menu.style.display = 'flex';
        
    const btnNext = document.querySelector('#battle-menu .menu-btn:first-of-type');
    btnNext.innerText = "NEXT STAGE (3)";
    btnNext.onclick = autoStartNext; 
        
    let time = 3;
    btnNext.innerText = `NEXT STAGE (${time})`;
    battle.autoTimerId = setInterval(() => {
        time--;
        btnNext.innerText = `NEXT STAGE (${time})`;
        if(time <= 0) { clearInterval(battle.autoTimerId); autoStartNext(); }
    }, 1000);
}

function handleDefeat() {
    stopCombat();
    
    const maxHp = player.bHp + (player.rank * 2500) + (player.gear.a?.val || 0);
    player.hp = maxHp; 
    syncUI();

    const tEl = document.getElementById('menu-title');
    tEl.innerText = "DEFEATED";
    tEl.style.color = "#c0392b"; 

    document.getElementById('r-lvl').innerText = player.lvl;
    document.getElementById('r-xp-text').innerText = `${Math.floor(player.xp)} / ${Math.floor(player.nextXp)}`;
    const xpPct = Math.min(100, (player.xp / player.nextXp) * 100);
    document.getElementById('r-bar-xp').style.width = xpPct + "%";

    document.getElementById('r-xp').innerText = "0";
    document.getElementById('r-coins').innerText = "0";
    document.getElementById('r-drops').innerText = "NONE";

    const btnNext = document.querySelector('#battle-menu .menu-btn:first-of-type');
    btnNext.onclick = restartGame; 
    
    let time = 5; 
    btnNext.innerText = `RESTART (STAGE 1) (${time})`;
    
    document.getElementById('battle-menu').style.display = 'flex';

    battle.autoTimerId = setInterval(() => {
        time--;
        btnNext.innerText = `RESTART (STAGE 1) (${time})`;
        if(time <= 0) { 
            clearInterval(battle.autoTimerId); 
            restartGame(); 
        }
    }, 1000);
}

function updateBars() {
    const m = player.bHp + (player.rank * 2500) + (player.gear.a?.val || 0);
    document.getElementById('btl-p-hp').style.width = Math.max(0, (player.hp / m * 100)) + "%";
    document.getElementById('btl-e-hp').style.width = Math.max(0, (battle.enemy.hp / battle.enemy.maxHp * 100)) + "%";
    document.getElementById('btl-p-charge').style.width = player.charge + "%";
}