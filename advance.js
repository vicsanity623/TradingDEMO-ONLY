(function() {
    // Configuration for Advancement
    const ADV_CONFIG = {
        BASE_COST_GOLD: 2000,
        BASE_COST_SHARDS: 1,
        GOLD_SCALING: 500, // Gold increases by 500 per level
        SHARD_SCALING: 0.2, // Shards increase every 5 levels approx
        STAT_MULTIPLIER: 0.1, // +10% stats per level
    };

    const AdvanceSystem = {
        
        // Open the Advance Screen
        open: function() {
            const modal = document.getElementById('advance-modal');
            if (!modal) return;
            
            this.render();
            modal.style.display = 'flex';
        },

        close: function() {
            document.getElementById('advance-modal').style.display = 'none';
        },

        // Calculate current upgrade cost
        getCost: function() {
            const lvl = window.player.advanceLevel || 0;
            return {
                gold: ADV_CONFIG.BASE_COST_GOLD + (lvl * ADV_CONFIG.GOLD_SCALING),
                shards: Math.floor(ADV_CONFIG.BASE_COST_SHARDS + (lvl * ADV_CONFIG.SHARD_SCALING))
            };
        },

        // Calculate bonuses based on level
        getBonuses: function(lvl) {
            return {
                statMult: (lvl * ADV_CONFIG.STAT_MULTIPLIER),
                critChance: lvl >= 5 ? 5 + (lvl * 0.5) : 0, // Unlocks at lvl 5
                lifeSteal: lvl >= 10 ? 15 : 0 // Unlocks at lvl 10
            };
        },

        // Perform the Upgrade
        upgrade: function() {
            const cost = this.getCost();
            
            if (window.player.coins < cost.gold) {
                alert("Not enough Gold!");
                return;
            }
            if ((window.player.dragonShards || 0) < cost.shards) {
                alert("Not enough Dragon Shards!");
                return;
            }

            // Deduct Resources
            window.player.coins -= cost.gold;
            window.player.dragonShards -= cost.shards;
            
            // Level Up
            window.player.advanceLevel = (window.player.advanceLevel || 0) + 1;
            
            // Visual Flair
            window.popDamage("UPGRADE SUCCESS!", 'adv-visual-container', true);
            
            window.isDirty = true;
            window.syncUI(); // Update Hub
            this.render(); // Update Modal
        },

        // Render the UI
        render: function() {
            const p = window.player;
            const lvl = p.advanceLevel || 0;
            const cost = this.getCost();
            const bonuses = this.getBonuses(lvl);
            const nextBonuses = this.getBonuses(lvl + 1);

            // Update Header
            document.getElementById('adv-current-lvl').innerText = lvl;
            
            // Update Resources
            document.getElementById('adv-shard-count').innerText = p.dragonShards || 0;
            document.getElementById('adv-gold-count').innerText = window.formatNumber(p.coins);

            // Update Cost Button
            const btn = document.getElementById('btn-do-advance');
            btn.innerHTML = `
                <div style="display:flex; align-items:center; justify-content:center; gap:10px;">
                    <span>ADVANCE</span>
                    <span style="font-size:0.8rem; color:#00d2ff;">💎 ${cost.shards}</span>
                    <span style="font-size:0.8rem; color:#f1c40f;">💰 ${window.formatNumber(cost.gold)}</span>
                </div>
            `;

            // Update Speech Bubble
            const bubble = document.getElementById('bulma-speech');
            if(lvl === 0) {
                bubble.innerText = "Hey Goku! Use Dragon Shards to push your gear beyond its limits!";
            } else if (lvl < 5) {
                bubble.innerText = "Great! At Level 5, you'll unlock Critical Hit chance!";
            } else if (lvl < 10) {
                bubble.innerText = "Keep going! At Level 10, you'll heal after every kill!";
            } else {
                bubble.innerText = "Incredible power! Your gear is becoming legendary!";
            }

            // Update Gear Slot Visuals in Modal
            this.renderSlot('w', 'adv-slot-w', lvl);
            this.renderSlot('a', 'adv-slot-a', lvl);

            // Update Stats Display
            let statsHtml = `
                <div class="adv-stat-row"><span>Stat Boost:</span> <span style="color:#00ff00">+${(bonuses.statMult*100).toFixed(0)}% ➤ +${(nextBonuses.statMult*100).toFixed(0)}%</span></div>
            `;
            
            if(lvl >= 4 || nextBonuses.critChance > 0) {
                const color = lvl >= 5 ? '#00ff00' : '#777';
                statsHtml += `<div class="adv-stat-row" style="color:${color}"><span>Crit Chance:</span> <span>${bonuses.critChance}% ➤ ${nextBonuses.critChance}%</span></div>`;
            }
            
            if(lvl >= 9 || nextBonuses.lifeSteal > 0) {
                const color = lvl >= 10 ? '#00ff00' : '#777';
                const txt = lvl >= 10 ? "Active" : "Locked (Lvl 10)";
                statsHtml += `<div class="adv-stat-row" style="color:${color}"><span>Heal on Kill:</span> <span>${txt}</span></div>`;
            }

            document.getElementById('adv-stats-list').innerHTML = statsHtml;
        },

        renderSlot: function(type, id, lvl) {
            const el = document.getElementById(id);
            const item = window.player.gear[type];
            
            if(item) {
                el.className = 'slot-box slot-filled';
                // Copy existing rarity colors logic
                let rColor = '#333';
                if(item.rarity === 2) rColor = '#00d2ff';
                if(item.rarity === 3) rColor = '#ff00ff';
                if(item.rarity === 4) rColor = '#e74c3c';
                if(item.rarity === 5) rColor = '#f1c40f';
                if(item.rarity === 6) rColor = '#00ffff';
                
                el.style.borderColor = rColor;
                el.innerHTML = `
                    <span>${type === 'w' ? '⚔️' : '🛡️'}</span>
                    <div class="slot-label" style="color:${rColor}">${window.formatNumber(item.val)}</div>
                    <div class="adv-badge">+${lvl}</div>
                `;
            } else {
                el.className = 'slot-box';
                el.innerHTML = `<span>Empty</span>`;
            }
        }
    };

    // Expose to window
    window.AdvanceSystem = AdvanceSystem;
})();
