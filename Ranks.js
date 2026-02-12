
(function () {
    const RIVALS = [
        { name: "Vegeta", baseMult: 0.95, color: "#3498db", rank: 0, lvl: 1, power: 500, world: 1, stage: 1, enemies: 0, souls: 0 },
        { name: "Broly", baseMult: 1.05, color: "#2ecc71", rank: 0, lvl: 1, power: 600, world: 1, stage: 1, enemies: 0, souls: 0 },
        { name: "Jiren", baseMult: 1.20, color: "#e74c3c", rank: 0, lvl: 1, power: 800, world: 1, stage: 1, enemies: 0, souls: 0 }
    ];

    let rankData = [];

    const Ranks = {
        init: function () {
            // Load or Initialize
            const saved = localStorage.getItem('dbz_ranks_data');
            if (saved) {
                rankData = JSON.parse(saved);
            } else {
                rankData = JSON.parse(JSON.stringify(RIVALS));
            }
            this.simulateProgression();
        },

        simulateProgression: function () {
            const playerPower = window.GameState?.gokuPower || 1000;
            const playerWorld = window.battle?.world || 1;
            const playerStage = window.battle?.maxStage || 1;

            rankData.forEach(rival => {
                // Power Simulation: Rivals are roughly within range of player
                // Variance: +/- 15% of their base multiplier target
                const targetPower = playerPower * rival.baseMult;
                const variance = (Math.random() * 0.3) - 0.15; // -0.15 to +0.15
                rival.power = Math.floor(targetPower * (1 + variance));
                if (rival.power < 100) rival.power = 100 + Math.floor(Math.random() * 50);

                // World/Stage Simulation
                if (playerWorld > 1) {
                    rival.world = Math.max(1, playerWorld - Math.floor(Math.random() * 2));
                } else {
                    rival.world = 1;
                }

                rival.stage = Math.max(1, playerStage + Math.floor(Math.random() * 10) - 5);
                if (rival.stage < 1) rival.stage = 1;

                // Level Simulation
                rival.lvl = window.player.lvl + Math.floor(Math.random() * 6) - 3;
                if (rival.lvl < 1) rival.lvl = 1;

                // Rank Simulation (Tier)
                rival.rank = window.player.rank;
                if (Math.random() < 0.2) rival.rank = Math.max(0, window.player.rank - 1); // Occasionally lower rank

                // Kill/Soul Simulation (Just for flavor numbers)
                rival.enemies = Math.floor(rival.power / 5) + Math.floor(Math.random() * 100);
                rival.souls = Math.floor(rival.enemies / 10);
            });

            this.save();
        },

        save: function () {
            localStorage.setItem('dbz_ranks_data', JSON.stringify(rankData));
        },

        openModal: function () {
            // Sort by Power
            const playerEntry = {
                name: "Goku",
                power: window.GameState.gokuPower,
                lvl: window.player.lvl,
                color: "#f1c40f",
                isPlayer: true,
                rank: window.player.rank,
                world: window.battle.world,
                stage: window.battle.maxStage,
                enemies: "???", // We don't track total kills for player yet? 
                souls: window.player.soulLevel // Use soul level for comparison
            };

            const all = [...rankData, playerEntry].sort((a, b) => b.power - a.power);

            const modal = document.getElementById('ranks-modal');
            if (!modal) return;

            const listConfig = document.getElementById('ranks-list');
            listConfig.innerHTML = "";

            all.forEach((entry, idx) => {
                const div = document.createElement('div');
                div.className = 'rank-row';
                if (entry.isPlayer) div.classList.add('rank-player');

                div.innerHTML = `
                    <div class="rank-pos">${idx + 1}</div>
                    <div class="rank-avatar" style="background:${entry.color}; display:flex; align-items:center; justify-content:center; color:white; font-family:'Bangers'; font-size:1.2rem; text-shadow:1px 1px black;">
                        ${entry.name.substring(0, 2).toUpperCase()}
                    </div>
                    <div class="rank-info">
                        <div class="rank-name" style="color:${entry.color}">${entry.name}</div>
                        <div class="rank-sub">LV.${entry.lvl} | World ${entry.world}-${entry.stage}</div>
                    </div>
                    <div class="rank-stats">
                        <div class="rank-power">⚡ ${window.formatNumber(entry.power)}</div>
                        <div class="rank-extra">Soul Lv.${entry.souls || entry.soulLevel || 0}</div>
                    </div>
                `;
                listConfig.appendChild(div);
            });

            modal.style.display = 'flex';
        },

        closeModal: function () {
            document.getElementById('ranks-modal').style.display = 'none';
        }
    };

    window.Ranks = Ranks;

})();
