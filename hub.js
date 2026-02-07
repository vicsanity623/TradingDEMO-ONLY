/* ============================
   HUB.JS - Hub Horde Battle
   ============================ */

(function() {

    const HubBattle = {
        running: false,
        container: null,
        enemies: [],
        playerEl: null,
        killCount: 0,
        spawnInterval: null,
        animFrame: null,
        
        // Settings
        spawnRate: 800, // ms
        speed: 2,
        
        init: function() {
            this.container = document.getElementById('hub-arena');
            if(!this.container) return;
            
            // Create Mini Goku
            this.playerEl = document.createElement('img');
            this.playerEl.src = "IMG_0061.png"; // Reuse player sprite
            this.playerEl.className = "hub-goku";
            this.container.appendChild(this.playerEl);
            
            this.start();
        },

        start: function() {
            if(this.running) return;
            this.running = true;
            this.killCount = 0;
            this.enemies = [];
            
            // Start Loop
            this.loop();
            this.spawnInterval = setInterval(() => this.spawnEnemy(), this.spawnRate);
        },

        stop: function() {
            this.running = false;
            clearInterval(this.spawnInterval);
            cancelAnimationFrame(this.animFrame);
            
            // Clear enemies
            const enemies = document.querySelectorAll('.hub-enemy');
            enemies.forEach(e => e.remove());
            this.enemies = [];
        },

        spawnEnemy: function() {
            if(!this.running || document.hidden) return;
            
            const el = document.createElement('img');
            
            // --- UPDATED HERE ---
            el.src = "IMG_0206.png"; 
            // --------------------

            el.className = "hub-enemy";
            el.onerror = function() { this.style.display='none'; }; 
            
            // Random Y Position
            const maxY = this.container.clientHeight - 60;
            const y = Math.floor(Math.random() * maxY);
            
            el.style.top = y + "px";
            el.style.left = "100%"; // Start off screen right
            
            this.container.appendChild(el);
            
            this.enemies.push({
                el: el,
                x: this.container.clientWidth,
                y: y,
                hp: 1, // 1 hit kill
                state: 'move'
            });
        },

        loop: function() {
            if(!this.running) return;

            // Move Enemies
            for (let i = this.enemies.length - 1; i >= 0; i--) {
                const e = this.enemies[i];
                e.x -= this.speed;
                e.el.style.left = e.x + "px";

                // Auto-Attack Logic (Goku Teleport)
                // Goku picks the closest enemy to the left side
                if (e.x < 250 && e.state === 'move') {
                    this.gokuAttack(e);
                }

                // Cleanup off-screen
                if(e.x < -50) {
                    e.el.remove();
                    this.enemies.splice(i, 1);
                }
            }

            this.animFrame = requestAnimationFrame(() => this.loop());
        },

        gokuAttack: function(enemy) {
            enemy.state = 'dying';
            
            // Teleport Visual
            this.playerEl.style.transition = 'none';
            this.playerEl.style.top = (enemy.y - 10) + "px";
            this.playerEl.style.left = (enemy.x - 40) + "px";
            this.playerEl.classList.add('hub-flash');
            
            this.playerEl.style.transform = "scale(1.2)";

            // Impact
            setTimeout(() => {
                this.playerEl.style.transform = "scale(1)";
                this.playerEl.classList.remove('hub-flash');
                
                // Kill Enemy
                enemy.el.classList.add('hub-die');
                setTimeout(() => {
                    enemy.el.remove();
                    const idx = this.enemies.indexOf(enemy);
                    if(idx > -1) this.enemies.splice(idx, 1);
                }, 300);

                // Rewards
                this.handleReward();

            }, 100);
        },

        handleReward: function() {
            this.killCount++;
            
            // Reward Values
            const xpReward = 10;
            const goldReward = 5; // Gold per kill

            // Apply to Player State
            window.player.xp += xpReward;
            window.player.coins += goldReward;
            
            // Souls Logic: 5 kills = 2 souls
            if(this.killCount % 5 === 0) {
                if(window.SoulSystem) {
                    window.SoulSystem.gainSoul();
                    window.SoulSystem.gainSoul(); // +2
                    
                    // Show Floating Text
                    this.showFloat("+2 SOULS", "#00ffff");
                }
            } else {
                // Show Floating Text for Gold occasionally to reduce clutter
                // or show every kill if desired
                this.showFloat(`+${goldReward} G`, "#f1c40f");
            }
            
            // --- UI UPDATE ---
            // 1. Update XP Bar
            const xpBar = document.getElementById('bar-xp');
            if(xpBar) {
                const xpPct = (window.player.xp / window.player.nextXp) * 100;
                xpBar.style.width = xpPct + "%";
            }

            // 2. Update Coin Display Immediately
            const coinEl = document.getElementById('ui-coins');
            if(coinEl) {
                coinEl.innerText = window.player.coins.toLocaleString();
            }
        },
        
        showFloat: function(text, color) {
            const el = document.createElement('div');
            el.className = 'hub-float';
            el.innerText = text;
            el.style.color = color;
            el.style.left = this.playerEl.style.left;
            el.style.top = this.playerEl.style.top;
            this.container.appendChild(el);
            setTimeout(() => el.remove(), 800);
        }
    };

    // Expose
    window.HubBattle = HubBattle;

})();
