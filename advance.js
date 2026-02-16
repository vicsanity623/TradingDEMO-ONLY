(function() {
    const ADV_CONFIG = {
        BASE_COST_GOLD: 2000,
        BASE_COST_SHARDS: 1,
        GOLD_SCALING: 500, 
        SHARD_SCALING: 0.2, 
        STAT_MULTIPLIER: 0.1, 
    };

    function showToast(msg, isError = true) {
        const existing = document.querySelector('.game-toast');
        if(existing) existing.remove();
        const t = document.createElement('div');
        t.className = 'game-toast';
        t.innerHTML = msg;
        if(!isError) { t.style.borderColor = "#00ff00"; t.style.boxShadow = "0 0 30px rgba(0, 255, 0, 0.4)"; }
        document.body.appendChild(t);
        requestAnimationFrame(() => t.classList.add('show'));
        setTimeout(() => { t.classList.remove('show'); setTimeout(() => t.remove(), 200); }, 2000);
    }

    const AdvanceSystem = {
        open: function() {
            const modal = document.getElementById('advance-modal');
            if (!modal) return;
            this.render();
            modal.style.display = 'flex';
        },
        close: function() { document.getElementById('advance-modal').style.display = 'none'; },

        getCost: function() {
            const lvl = window.player.advanceLevel || 0;
            return {
                gold: ADV_CONFIG.BASE_COST_GOLD + (lvl * ADV_CONFIG.GOLD_SCALING),
                shards: Math.floor(ADV_CONFIG.BASE_COST_SHARDS + (lvl * ADV_CONFIG.SHARD_SCALING))
            };
        },

        getBonuses: function(lvl) {
            return {
                statMult: (lvl * ADV_CONFIG.STAT_MULTIPLIER),
                critChance: lvl >= 5 ? 5 + ((lvl-5) * 0.5) : 0, 
                lifeSteal: lvl >= 10 ? 15 + ((lvl-10) * 1.0) : 0,
                evasion: lvl >= 50 ? 15 : (lvl >= 15 ? 5 + ((lvl-15) * 0.2) : 0), 
                doubleStrike: lvl >= 20 ? 5 + ((lvl-20) * 0.5) : 0,
                goldMult: lvl >= 25 ? 10 + ((lvl-25) * 1.0) : 0,
                xpMult: lvl >= 30 ? 10 + ((lvl-30) * 1.0) : 0,
                rageMode: lvl >= 35,
                startKi: lvl >= 40 ? 20 : 0,
                bossSlayer: lvl >= 45 ? 20 : 0,
                zenkai: lvl >= 60,
                // Visual Indicators
                hpBoost: lvl >= 3,
                defBoost: lvl >= 6, // NEW: Defense Boost
                atkBoost: lvl >= 12
            };
        },

        upgrade: function() {
            const cost = this.getCost();
            if (window.player.coins < cost.gold) { showToast(`Need <span style="color:#f1c40f">${window.formatNumber(cost.gold - window.player.coins)}</span> more Gold!`, true); return; }
            if ((window.player.dragonShards || 0) < cost.shards) { showToast(`Need <span style="color:#00d2ff">${cost.shards - (window.player.dragonShards || 0)}</span> more Shards!`, true); return; }

            window.player.coins -= cost.gold;
            window.player.dragonShards -= cost.shards;
            window.player.advanceLevel = (window.player.advanceLevel || 0) + 1;
            
            showToast("GEAR UPGRADED!", false);
            if(window.popDamage) window.popDamage("SUCCESS!", 'adv-visual-container', true);
            window.isDirty = true;
            window.syncUI(); 
            this.render(); 
        },

        render: function() {
            const p = window.player;
            const lvl = p.advanceLevel || 0;
            const cost = this.getCost();
            const bonuses = this.getBonuses(lvl);
            const nextBonuses = this.getBonuses(lvl + 1);

            document.getElementById('adv-current-lvl').innerText = lvl;
            document.getElementById('adv-shard-count').innerText = p.dragonShards || 0;
            document.getElementById('adv-gold-count').innerText = window.formatNumber(p.coins);

            const btn = document.getElementById('btn-do-advance');
            btn.innerHTML = `<div style="display:flex;align-items:center;justify-content:center;gap:10px;"><span>ADVANCE</span><span style="font-size:0.8rem;color:#00d2ff;">💎 ${cost.shards}</span><span style="font-size:0.8rem;color:#f1c40f;">💰 ${window.formatNumber(cost.gold)}</span></div>`;

            // Dynamic Speech
            const bubble = document.getElementById('bulma-speech');
            if(lvl < 3) bubble.innerText = "Level 3 gives a huge HP Boost!";
            else if(lvl < 5) bubble.innerText = "Level 5 unlocks Critical Hits!";
            else if(lvl < 6) bubble.innerText = "Level 6 gives a huge Defense Boost!";
            else if(lvl < 10) bubble.innerText = "Level 10 unlocks Life Steal!";
            else if(lvl < 12) bubble.innerText = "Level 12 gives a huge Attack Boost!";
            else if (lvl < 15) bubble.innerText = "Level 15 unlocks Evasion!";
            else if (lvl < 20) bubble.innerText = "Level 20 unlocks Double Strike!";
            else if (lvl < 25) bubble.innerText = "Level 25 boosts Gold gain!";
            else if (lvl < 30) bubble.innerText = "Level 30 boosts XP gain!";
            else if (lvl < 35) bubble.innerText = "Level 35 unlocks Rage Mode!";
            else if (lvl < 40) bubble.innerText = "Level 40 gives Starter Ki!";
            else if (lvl < 45) bubble.innerText = "Level 45 unlocks Boss Slayer!";
            else if (lvl < 50) bubble.innerText = "Level 50 unlocks ULTRA INSTINCT!";
            else if (lvl < 60) bubble.innerText = "Level 60 unlocks ZENKAI (Revive)!";
            else bubble.innerText = "You have surpassed the Gods!";

            this.renderSlot('w', 'adv-slot-w', lvl);
            this.renderSlot('a', 'adv-slot-a', lvl);

            let statsHtml = `<div class="adv-stat-row"><span>Stat Boost:</span> <span style="color:#00ff00">+${(bonuses.statMult*100).toFixed(0)}% ➤ +${(nextBonuses.statMult*100).toFixed(0)}%</span></div>`;
            
            const addRow = (label, curr, next, unlockLvl) => {
                if(lvl >= (unlockLvl-1) || next > 0) {
                    const color = lvl >= unlockLvl ? '#00ff00' : '#777';
                    const valStr = (typeof curr === 'boolean') ? (curr ? "Active" : "Locked") : `${curr.toFixed(1)}% ➤ ${next.toFixed(1)}%`;
                    statsHtml += `<div class="adv-stat-row" style="color:${color}"><span>${label}:</span> <span>${valStr}</span></div>`;
                }
            };
            
            // HP Boost (Lvl 3)
            if(lvl >= 2 || bonuses.hpBoost) {
                const color = lvl >= 3 ? '#ff3e3e' : '#777';
                statsHtml += `<div class="adv-stat-row" style="color:${color}"><span>HP Boost:</span> <span>${lvl >= 3 ? "+115%" : "Locked"}</span></div>`;
            }

            addRow("Crit Chance", bonuses.critChance, nextBonuses.critChance, 5);

            // NEW: Defense Boost (Lvl 6)
            if(lvl >= 5 || bonuses.defBoost) {
                const color = lvl >= 6 ? '#2ecc71' : '#777';
                statsHtml += `<div class="adv-stat-row" style="color:${color}"><span>DEF Boost:</span> <span>${lvl >= 6 ? "+120%" : "Locked"}</span></div>`;
            }

            addRow("Life Steal", bonuses.lifeSteal, nextBonuses.lifeSteal, 10);
            
            // Attack Boost (Lvl 12)
            if(lvl >= 11 || bonuses.atkBoost) {
                const color = lvl >= 12 ? '#3498db' : '#777';
                statsHtml += `<div class="adv-stat-row" style="color:${color}"><span>ATK Boost:</span> <span>${lvl >= 12 ? "+125%" : "Locked"}</span></div>`;
            }

            addRow("Dodge Chance", bonuses.evasion, nextBonuses.evasion, 15);
            addRow("Double Strike", bonuses.doubleStrike, nextBonuses.doubleStrike, 20);
            addRow("Gold Boost", bonuses.goldMult, nextBonuses.goldMult, 25);
            addRow("XP Boost", bonuses.xpMult, nextBonuses.xpMult, 30);
            
            if(lvl >= 34 || nextBonuses.rageMode) {
                const color = lvl >= 35 ? '#e74c3c' : '#777';
                statsHtml += `<div class="adv-stat-row" style="color:${color}"><span>Rage Mode (<20% HP):</span> <span>${lvl >= 35 ? "Active" : "Locked"}</span></div>`;
            }
            if(lvl >= 39 || nextBonuses.startKi > 0) {
                const color = lvl >= 40 ? '#f1c40f' : '#777';
                statsHtml += `<div class="adv-stat-row" style="color:${color}"><span>Start Charge:</span> <span>${lvl >= 40 ? "+20%" : "Locked"}</span></div>`;
            }
            if(lvl >= 44 || nextBonuses.bossSlayer > 0) {
                const color = lvl >= 45 ? '#e67e22' : '#777';
                statsHtml += `<div class="adv-stat-row" style="color:${color}"><span>Boss Slayer:</span> <span>${lvl >= 45 ? "+20% Dmg" : "Locked"}</span></div>`;
            }
            if(lvl >= 49) {
                const color = lvl >= 50 ? '#00ffff' : '#777';
                statsHtml += `<div class="adv-stat-row" style="color:${color}"><span>Ultra Instinct:</span> <span>${lvl >= 50 ? "Active" : "Locked"}</span></div>`;
            }
            if(lvl >= 59) {
                const color = lvl >= 60 ? '#2ecc71' : '#777';
                statsHtml += `<div class="adv-stat-row" style="color:${color}"><span>Zenkai Revive:</span> <span>${lvl >= 60 ? "Active" : "Locked"}</span></div>`;
            }

            document.getElementById('adv-stats-list').innerHTML = statsHtml;
        },

        renderSlot: function(type, id, lvl) {
            const el = document.getElementById(id);
            const item = window.player.gear[type];
            if(item) {
                el.className = 'slot-box slot-filled';
                let rColor = '#333';
                if(item.rarity === 2) rColor = '#00d2ff';
                if(item.rarity === 3) rColor = '#ff00ff';
                if(item.rarity === 4) rColor = '#e74c3c';
                if(item.rarity === 5) rColor = '#f1c40f';
                if(item.rarity === 6) rColor = '#00ffff';
                el.style.borderColor = rColor;
                el.innerHTML = `<span>${type === 'w' ? '⚔️' : '🛡️'}</span><div class="slot-label" style="color:${rColor}">${window.formatNumber(item.val)}</div><div class="adv-badge">+${lvl}</div>`;
            } else {
                el.className = 'slot-box';
                el.innerHTML = `<span>Empty</span>`;
            }
        }
    };
    window.AdvanceSystem = AdvanceSystem;
})();
