// dungeons.js - Handles Dungeon Mode and Daily Logins

(function () {

    // --- CONFIGURATION ---
    const DUNGEON_CONFIG = {
        // Boss Definitions
        BOSSES: {
            buu: {
                name: "Majin Buu",
                img: "majin_buu.png", // Use your local file or placeholder
                baseHp: 100000000000, // 100B
                rewards: { shards: 50, coins: 100000 },
                color: "#ff79c6"
            },
            frieza: {
                name: "Frieza",
                img: "freeza.png",
                baseHp: 150000000000, // 150B
                rewards: { souls: 50, coins: 200000 },
                color: "#bd93f9"
            },
            cell: {
                name: "Cell",
                img: "cell.png",
                baseHp: 200000000000, // 200B
                rewards: { gearChance: true, coins: 300000 },
                color: "#50fa7b"
            }
        },
        // Daily Login Rewards (7 Days)
        DAILY_REWARDS: [
            { day: 1, keys: 9, coins: 100000, shards: 5 },
            { day: 2, keys: 9, coins: 250000, shards: 25, gear: { type: 'w', rarity: 3, count: 3 } }, // Legendary x3
            { day: 3, keys: 21, coins: 500000, shards: 50, gear: { type: 'a', rarity: 4, count: 6 } }, // S Gear x6
            { day: 4, keys: 15, coins: 750000, shards: 75 },
            { day: 5, keys: 25, coins: 1000000, souls: 10 },
            { day: 6, keys: 30, coins: 2500000, shards: 150 },
            { day: 7, keys: 50, coins: 5000000, souls: 100, gear: { type: 'w', rarity: 6, count: 1 } } // SSS Gear x1
        ]
    };

    // --- STATE ---
    let activeBoss = null; // Current boss being fought
    let battleTimer = null;
    let attackInterval = null;
    let timeLeft = 90;

    // --- DAILY LOGIN LOGIC ---

    window.checkDailyLogin = function () {
        const now = Date.now();
        const oneDay = 24 * 60 * 60 * 1000;
        const lastClaim = window.player.dailyLogin.lastClaimTime || 0;

        // If > 24 hours since last claim OR never claimed
        if (now - lastClaim > oneDay || lastClaim === 0) {
            // Reset streak if missed a day (48 hours)
            if (lastClaim !== 0 && now - lastClaim > (oneDay * 2)) {
                window.player.dailyLogin.day = 1;
            }
            openDailyLogin();
        }
    };

    function openDailyLogin() {
        const modal = document.getElementById('daily-login-modal');
        const grid = document.getElementById('daily-grid');
        if (!modal || !grid) return;

        grid.innerHTML = '';
        const currentDay = window.player.dailyLogin.day;

        DUNGEON_CONFIG.DAILY_REWARDS.forEach((reward, index) => {
            const dayNum = index + 1;
            const isToday = dayNum === currentDay;
            const isClaimed = dayNum < currentDay;

            const cell = document.createElement('div');
            cell.className = `daily-cell ${isToday ? 'today' : ''} ${isClaimed ? 'claimed' : ''}`;

            let content = `<div class="day-num">Day ${dayNum}</div>`;
            if (reward.keys) content += `<div>🗝️ x${reward.keys}</div>`;
            if (reward.coins) content += `<div>💰 ${window.formatNumber(reward.coins)}</div>`;
            if (reward.shards) content += `<div>💎 x${reward.shards}</div>`;
            if (reward.souls) content += `<div>👻 x${reward.souls}</div>`;
            if (reward.gear) content += `<div>🎒 Gear x${reward.gear.count}</div>`;

            if (isClaimed) content += `<div class="claimed-overlay">✔</div>`;

            cell.innerHTML = content;
            grid.appendChild(cell);
        });

        modal.style.display = 'flex';
    }

    window.claimDailyLogin = function () {
        const currentDay = window.player.dailyLogin.day;
        // Find reward for current day (1-based index fix)
        const reward = DUNGEON_CONFIG.DAILY_REWARDS[currentDay - 1] || DUNGEON_CONFIG.DAILY_REWARDS[0];

        // Grant Rewards
        if (reward.keys) window.player.dungeonKeys += reward.keys;
        if (reward.coins) window.player.coins += reward.coins;
        if (reward.shards) window.player.dragonShards += reward.shards;
        if (reward.souls) window.player.souls += reward.souls;

        if (reward.gear && window.addToInventory) {
            for (let i = 0; i < reward.gear.count; i++) {
                window.addToInventory({
                    n: "Daily Gear",
                    type: reward.gear.type,
                    val: 5000 * reward.gear.rarity,
                    rarity: reward.gear.rarity
                });
            }
        }

        // Advance Day
        window.player.dailyLogin.lastClaimTime = Date.now();
        window.player.dailyLogin.day++;
        if (window.player.dailyLogin.day > 7) window.player.dailyLogin.day = 1; // Loop

        window.isDirty = true;
        window.saveGame(); // Ensure save

        document.getElementById('daily-login-modal').style.display = 'none';

        // Refresh UI
        if (typeof window.initDungeons === 'function') window.initDungeons();
        window.customAlert("Daily Rewards Claimed!");
    };


    // --- DUNGEON SYSTEM ---

    // Initialize the Dungeon Hub Screen
    window.initDungeons = function () {
        const list = document.getElementById('dungeon-list');
        const keyDisplay = document.getElementById('dungeon-keys-display');

        if (!list || !keyDisplay) return;

        // Update Key Count
        keyDisplay.innerText = window.player.dungeonKeys || 0;

        list.innerHTML = ''; // Clear list

        // Create Boss Cards
        Object.keys(DUNGEON_CONFIG.BOSSES).forEach(key => {
            const boss = DUNGEON_CONFIG.BOSSES[key];
            const lvl = window.player.dungeonLevel[key] || 1;

            // Calculate Stats for display
            const hp = boss.baseHp * Math.pow(1.2, lvl - 1);

            const card = document.createElement('div');
            card.className = 'dungeon-card';
            card.style.borderColor = boss.color;

            card.innerHTML = `
                <div class="d-card-img-box">
                    <img src="${boss.img}" onerror="this.src='https://dragonball-api.com/transformations/frieza-final.png'">
                </div>
                <div class="d-card-info">
                    <div class="d-boss-name" style="color:${boss.color}">${boss.name}</div>
                    <div class="d-boss-lvl">Level ${toRoman(lvl)}</div>
                    <div class="d-boss-hp">HP: ${window.formatNumber(hp)}</div>
                </div>
                <button class="d-enter-btn" onclick="startDungeon('${key}')">
                    ENTER <br><span style="font-size:0.8rem">1 🗝️</span>
                </button>
            `;
            list.appendChild(card);
        });
    };

    // Helper to convert number to Roman
    function toRoman(num) {
        if (num >= 1000) return "M+"; // Lazy fix for high levels
        const roman = { M: 1000, CM: 900, D: 500, CD: 400, C: 100, XC: 90, L: 50, XL: 40, X: 10, IX: 9, V: 5, IV: 4, I: 1 };
        let str = '';
        for (let i of Object.keys(roman)) {
            let q = Math.floor(num / roman[i]);
            num -= q * roman[i];
            str += i.repeat(q);
        }
        return str;
    }

    // Start a Dungeon Fight
    window.startDungeon = function (bossKey) {
        if (window.player.dungeonKeys < 1) {
            window.customAlert("No Dungeon Keys left!");
            return;
        }

        window.player.dungeonKeys--;
        window.isDirty = true;

        // Switch Screen
        if (window.showTab) window.showTab(null); // Hide others
        document.querySelectorAll('.screen').forEach(s => s.classList.remove('active-screen'));
        document.getElementById('view-dungeon-battle').classList.add('active-screen');

        // Setup Boss
        const bossConfig = DUNGEON_CONFIG.BOSSES[bossKey];
        const lvl = window.player.dungeonLevel[bossKey];

        activeBoss = {
            key: bossKey,
            name: bossConfig.name,
            lvl: lvl,
            maxHp: bossConfig.baseHp * Math.pow(1.2, lvl - 1),
            hp: bossConfig.baseHp * Math.pow(1.2, lvl - 1),
            // Attack is scaled to be SAFE (max 0.5% of player HP per hit)
            atk: window.GameState.gokuMaxHP * 0.005,
            img: bossConfig.img,
            rewards: bossConfig.rewards
        };

        // Setup Player
        window.player.hp = window.GameState.gokuMaxHP; // Full heal start

        // Setup UI
        document.getElementById('db-boss-name').innerText = activeBoss.name;
        document.getElementById('db-dungeon-lvl').innerText = `LEVEL ${toRoman(lvl)}`;
        document.getElementById('db-boss-img').src = activeBoss.img;
        const spriteEl = document.getElementById('ui-sprite');
        document.getElementById('db-player-img').src = spriteEl ? spriteEl.src : "IMG_0061.png";

        // Start Loop
        timeLeft = 90;
        updateDungeonUI();

        if (battleTimer) clearInterval(battleTimer);
        if (attackInterval) clearInterval(attackInterval);

        // Timer Loop
        battleTimer = setInterval(() => {
            timeLeft--;
            if (timeLeft <= 0) {
                endDungeon(false); // Time out = Loss
            }
            updateDungeonUI();
        }, 1000);

        // Attack Logic
        const performAttack = () => {
            // Player Hits Boss
            const dmg = window.GameState.gokuPower;
            // Apply Damage
            activeBoss.hp -= dmg;
            createDungeonPop(dmg, 'db-boss-img', 'red');

            if (activeBoss.hp <= 0) {
                activeBoss.hp = 0;
                endDungeon(true); // Win
                return;
            }

            // Boss Hits Player (Tiny safe damage)
            if (Math.random() > 0.5) { // 50% chance to attack each tick
                window.player.hp -= activeBoss.atk;
                createDungeonPop(activeBoss.atk, 'db-player-img', 'white');
                if (window.player.hp <= 0) {
                    window.player.hp = 0;
                    endDungeon(false); // Loss
                }
            }
            updateDungeonUI();
        };

        // Attack Loop (Auto Battler style)
        attackInterval = setInterval(performAttack, 500); // 2 hits per second
        performAttack(); // Start immediately
    };

    function updateDungeonUI() {
        if (!activeBoss) return;

        // Boss Bar
        const bossPct = (activeBoss.hp / activeBoss.maxHp) * 100;
        document.getElementById('db-boss-hp-fill').style.width = Math.max(0, bossPct) + "%";
        document.getElementById('db-boss-hp-text').innerText = `${window.formatNumber(activeBoss.hp)} / ${window.formatNumber(activeBoss.maxHp)}`;

        // Timer Bar
        const timePct = (timeLeft / 90) * 100;
        document.getElementById('db-timer-fill').style.width = timePct + "%";
        document.getElementById('db-timer-text').innerText = `${timeLeft}s`;

        // Player Bar (Bottom)
        const playerPct = (window.player.hp / window.GameState.gokuMaxHP) * 100;
        document.getElementById('db-player-hp-fill').style.width = Math.max(0, playerPct) + "%";
        document.getElementById('db-player-hp-text').innerText = `${window.formatNumber(window.player.hp)}`;
    }

    function createDungeonPop(val, targetId, color) {
        const container = document.getElementById('db-fx-container');
        if (!container) return;

        const el = document.createElement('div');
        el.innerText = "-" + window.formatNumber(val);
        el.style.position = 'absolute';
        el.style.color = color;
        el.style.fontWeight = 'bold';
        el.style.fontSize = '2rem';
        el.style.textShadow = '0 0 5px black';
        el.style.fontFamily = 'Bangers';

        // Random Position around target
        const target = document.getElementById(targetId);
        const rect = target.getBoundingClientRect();
        // Since container is full screen absolute, we need relative pos? 
        // Actually target is absolute too. Let's just use rough % based on target ID
        if (targetId === 'db-boss-img') {
            el.style.right = (15 + Math.random() * 5) + "%";
            el.style.bottom = (35 + Math.random() * 10) + "%";
        } else {
            el.style.left = (15 + Math.random() * 5) + "%";
            el.style.bottom = (35 + Math.random() * 10) + "%";
        }

        container.appendChild(el);

        // Animate up
        let op = 1;
        let bot = parseFloat(el.style.bottom);
        const anim = setInterval(() => {
            op -= 0.05;
            bot += 0.5;
            el.style.opacity = op;
            el.style.bottom = bot + "%";
            if (op <= 0) {
                clearInterval(anim);
                el.remove();
            }
        }, 30);
    }

    function endDungeon(isWin) {
        clearInterval(battleTimer);
        clearInterval(attackInterval);

        const modal = document.getElementById('dungeon-result-modal');
        const title = document.getElementById('db-result-title');
        const list = document.getElementById('db-rewards-list');
        const btn = document.getElementById('db-btn-continue');

        modal.style.display = 'flex';
        list.innerHTML = '';

        if (isWin) {
            title.innerText = "VICTORY!";
            title.style.color = "gold";

            // Level Up Boss
            window.player.dungeonLevel[activeBoss.key]++;

            // Give Rewards (Scaled by level slightly 1.05x)
            const scaler = Math.pow(1.05, activeBoss.lvl - 1);

            if (activeBoss.rewards.coins) {
                const amt = Math.floor(activeBoss.rewards.coins * scaler);
                window.player.coins += amt;
                list.innerHTML += `<div>💰 +${window.formatNumber(amt)} Coins</div>`;
            }
            if (activeBoss.rewards.shards) {
                const amt = Math.floor(activeBoss.rewards.shards * scaler); // Shards scale slower?
                window.player.dragonShards += amt;
                list.innerHTML += `<div>💎 +${amt} Shards</div>`;
            }
            if (activeBoss.rewards.souls) {
                const amt = Math.floor(activeBoss.rewards.souls * scaler);
                window.player.souls += amt;
                list.innerHTML += `<div>👻 +${amt} Souls</div>`;
            }
            if (activeBoss.rewards.gearChance) {
                // Drop 1-9 gears based on level?
                const qty = Math.floor(Math.random() * 9) + 1;
                for (let i = 0; i < qty; i++) {
                    window.addToInventory({ n: "Dungeon Gear", type: Math.random() > 0.5 ? 'w' : 'a', val: 5000 * activeBoss.lvl, rarity: 3 });
                }
                list.innerHTML += `<div>🎒 +${qty} Rare Gear</div>`;
            }

            window.saveGame();

        } else {
            title.innerText = "DEFEATED";
            title.style.color = "red";
            list.innerHTML = "<div>Time limit exceeded!</div>";
        }

        // Auto Exit Countdown
        let count = 5;
        btn.innerText = `CONTINUE (${count})`;
        btn.onclick = () => {
            clearInterval(exitTimer);
            modal.style.display = 'none';
            if (window.showTab) window.showTab('dungeon'); // Back to hub
            window.initDungeons(); // Refresh levels
        };

        const exitTimer = setInterval(() => {
            count--;
            btn.innerText = `CONTINUE (${count})`;
            if (count <= 0) {
                clearInterval(exitTimer);
                btn.click();
            }
        }, 1000);
    }

})();
