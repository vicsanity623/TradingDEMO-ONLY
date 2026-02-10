(function() {
    // --- ASSETS & CONFIG ---
    const ASSETS = {
        // Using placeholders, replace with your local images if you have them
        BG: "https://i.imgur.com/8y7F9rS.jpg", // Space Background
        GOKU: "IMG_0062.png", // SSJ Sprite
        ENEMY: "https://dragonball-api.com/transformations/frieza-final.png" // Fallback enemy
    };

    const canvas = document.getElementById('explore-canvas');
    const ctx = canvas.getContext('2d');

    // Game State
    let isRunning = false;
    let lastTime = 0;
    let camera = { x: 0, y: 0 };
    let bgPattern = null;
    let kills = 0;

    // Entities
    let player = { 
        x: 0, y: 0, size: 50, speed: 8, 
        hp: 100, maxHp: 100, 
        faceRight: true,
        invincible: 0
    };
    let enemies = [];
    let bullets = [];
    let particles = [];

    // Inputs
    const input = { x: 0, y: 0, charging: false, chargeVal: 0 };

    // --- MAIN FUNCTIONS ---

    function initExplore() {
        if(isRunning) return;
        
        // Sync Stats from Main Game
        player.maxHp = window.GameState.gokuMaxHP;
        player.hp = window.GameState.gokuMaxHP; // Heal on enter? Or keep current?
        
        resize();
        window.addEventListener('resize', resize);
        setupControls();

        // Load BG
        const img = new Image();
        img.src = ASSETS.BG;
        img.onload = () => { bgPattern = ctx.createPattern(img, 'repeat'); };

        // Reset
        player.x = canvas.width/2;
        player.y = canvas.height/2;
        enemies = [];
        bullets = [];
        input.chargeVal = 0;
        input.charging = false;
        kills = 0;
        updateHUD();

        isRunning = true;
        requestAnimationFrame(loop);

        // Spawn Interval
        setInterval(() => {
            if(isRunning && enemies.length < 8) spawnEnemy();
        }, 1500);
    }

    function stopExplore() {
        isRunning = false;
    }

    function resize() {
        canvas.width = window.innerWidth;
        canvas.height = window.innerHeight;
    }

    // --- CONTROLS ---
    function setupControls() {
        const joy = document.getElementById('joy-zone');
        const stick = document.getElementById('joy-stick');
        let startX, startY;

        const handleMove = (cx, cy) => {
            const maxDist = 35;
            let dx = cx - startX;
            let dy = cy - startY;
            const dist = Math.sqrt(dx*dx + dy*dy);
            
            if(dist > maxDist) {
                dx = (dx/dist) * maxDist;
                dy = (dy/dist) * maxDist;
            }
            
            stick.style.transform = `translate(calc(-50% + ${dx}px), calc(-50% + ${dy}px))`;
            input.x = dx / maxDist;
            input.y = dy / maxDist;
        };

        joy.addEventListener('touchstart', e => {
            e.preventDefault();
            const rect = joy.getBoundingClientRect();
            startX = rect.left + rect.width/2;
            startY = rect.top + rect.height/2;
            handleMove(e.touches[0].clientX, e.touches[0].clientY);
        }, {passive: false});

        joy.addEventListener('touchmove', e => {
            e.preventDefault();
            handleMove(e.touches[0].clientX, e.touches[0].clientY);
        }, {passive: false});

        joy.addEventListener('touchend', e => {
            e.preventDefault();
            stick.style.transform = `translate(-50%, -50%)`;
            input.x = 0; input.y = 0;
        });

        // Buttons
        document.getElementById('btn-ex-attack').onclick = () => { if(!input.charging) shoot(); };
        document.getElementById('btn-ex-dodge').onclick = () => { if(!input.charging) dodge(); };
        
        const btnCharge = document.getElementById('btn-ex-charge');
        const startCharge = (e) => { e.preventDefault(); input.charging = true; };
        const endCharge = (e) => { 
            e.preventDefault(); 
            if(input.chargeVal >= 100) unleashUltimate();
            input.charging = false; 
            input.chargeVal = 0;
            document.getElementById('ex-charge-overlay').style.display = 'none';
        };
        
        btnCharge.addEventListener('touchstart', startCharge);
        btnCharge.addEventListener('touchend', endCharge);
        btnCharge.addEventListener('mousedown', startCharge);
        btnCharge.addEventListener('mouseup', endCharge);
    }

    // --- GAMEPLAY LOGIC ---

    function spawnEnemy() {
        // Spawn distance based on screen size
        const dist = Math.max(canvas.width, canvas.height); 
        const angle = Math.random() * Math.PI * 2;
        
        // Enemies scale based on Goku's Power
        const scalePower = window.GameState.gokuPower * 0.5; 

        // Random Boss-like enemy occasionally
        const isStrong = Math.random() > 0.9;
        
        enemies.push({
            x: player.x + Math.cos(angle) * dist,
            y: player.y + Math.sin(angle) * dist,
            w: isStrong ? 80 : 50, 
            h: isStrong ? 80 : 50,
            hp: isStrong ? scalePower * 10 : scalePower * 2,
            maxHp: isStrong ? scalePower * 10 : scalePower * 2,
            atk: window.GameState.gokuMaxHP * (isStrong ? 0.1 : 0.02),
            speed: isStrong ? 2 : 4,
            color: isStrong ? 'red' : 'purple'
        });
    }

    function shoot() {
        // Auto Aim Logic
        let vx = input.x; 
        let vy = input.y;

        if (Math.abs(vx) < 0.1 && Math.abs(vy) < 0.1) {
            // Find nearest enemy
            let nearest = null;
            let minD = Infinity;
            enemies.forEach(e => {
                let d = Math.hypot(e.x - player.x, e.y - player.y);
                if (d < minD) { minD = d; nearest = e; }
            });

            if (nearest) {
                let angle = Math.atan2(nearest.y - player.y, nearest.x - player.x);
                vx = Math.cos(angle);
                vy = Math.sin(angle);
            } else {
                vx = player.faceRight ? 1 : -1;
                vy = 0;
            }
        }

        player.faceRight = vx > 0;

        bullets.push({
            x: player.x, y: player.y,
            vx: vx * 20, vy: vy * 20,
            life: 50,
            damage: window.GameState.gokuPower
        });
    }

    function dodge() {
        let dx = input.x || (player.faceRight ? 1 : -1);
        let dy = input.y || 0;
        let len = Math.sqrt(dx*dx + dy*dy);
        if(len === 0) len = 1;
        
        player.x += (dx/len) * 250;
        player.y += (dy/len) * 250;
        
        // Particles
        for(let i=0; i<8; i++) {
            particles.push({
                x: player.x, y: player.y,
                vx: (Math.random()-0.5)*10, vy: (Math.random()-0.5)*10,
                life: 20, color: 'cyan'
            });
        }
    }

    function unleashUltimate() {
        const overlay = document.getElementById('view-explore');
        const flash = document.createElement('div');
        flash.className = 'flash-screen';
        overlay.appendChild(flash);
        setTimeout(() => flash.remove(), 3000);

        // Wipe enemies
        enemies.forEach(e => {
            e.hp = 0;
            // Explosion particles
            for(let i=0; i<15; i++) {
                particles.push({
                    x: e.x, y: e.y,
                    vx: (Math.random()-0.5)*20, vy: (Math.random()-0.5)*20,
                    life: 40, color: 'orange'
                });
            }
        });
    }

    // --- GAME LOOP ---
    function loop(timestamp) {
        if(!isRunning) return;
        const dt = timestamp - lastTime;
        lastTime = timestamp;

        ctx.clearRect(0, 0, canvas.width, canvas.height);

        // --- UPDATE ---
        
        // Player
        if(input.charging) {
            input.chargeVal += 0.8;
            if(input.chargeVal > 100) input.chargeVal = 100;
            
            const hud = document.getElementById('ex-charge-overlay');
            hud.style.display = 'block';
            document.getElementById('ex-charge-fill').style.width = input.chargeVal + '%';
            
            // Rumble
            player.x += (Math.random()-0.5)*4;
            player.y += (Math.random()-0.5)*4;
        } else {
            player.x += input.x * player.speed;
            player.y += input.y * player.speed;
            if(input.x > 0) player.faceRight = true;
            if(input.x < 0) player.faceRight = false;
        }

        // Camera
        camera.x = player.x - canvas.width/2;
        camera.y = player.y - canvas.height/2;

        // --- RENDER ---
        
        // Background (Parallax simulation via Pattern)
        ctx.save();
        ctx.translate(-camera.x % canvas.width, -camera.y % canvas.height);
        if(bgPattern) {
            ctx.fillStyle = bgPattern;
            // Draw 3x3 grid to handle all scroll directions
            for(let i=-1; i<=1; i++) {
                for(let j=-1; j<=1; j++) {
                    ctx.fillRect(i*canvas.width, j*canvas.height, canvas.width, canvas.height);
                }
            }
        } else {
            ctx.fillStyle = '#111';
            ctx.fillRect(0, 0, canvas.width, canvas.height);
        }
        ctx.restore();

        // World Objects
        ctx.save();
        ctx.translate(-camera.x, -camera.y);

        // Bullets
        ctx.fillStyle = 'cyan';
        ctx.shadowBlur = 10; ctx.shadowColor = 'cyan';
        bullets.forEach((b, i) => {
            b.x += b.vx; b.y += b.vy; b.life--;
            ctx.beginPath(); ctx.arc(b.x, b.y, 8, 0, Math.PI*2); ctx.fill();
            if(b.life <= 0) bullets.splice(i, 1);
        });
        ctx.shadowBlur = 0;

        // Player (Simple for now, replace with Image later)
        ctx.fillStyle = input.charging ? 'white' : 'orange';
        ctx.fillRect(player.x - 25, player.y - 25, 50, 50);

        // Enemies
        enemies.forEach((e, i) => {
            // Move
            let ang = Math.atan2(player.y - e.y, player.x - e.x);
            e.x += Math.cos(ang) * e.speed;
            e.y += Math.sin(ang) * e.speed;

            // Draw
            ctx.fillStyle = e.color;
            ctx.fillRect(e.x - e.w/2, e.y - e.h/2, e.w, e.h);

            // HP Bar
            ctx.fillStyle = 'red'; ctx.fillRect(e.x - 20, e.y - 40, 40, 5);
            ctx.fillStyle = 'lime'; ctx.fillRect(e.x - 20, e.y - 40, 40 * (e.hp/e.maxHp), 5);

            // Collision (Bullet)
            bullets.forEach((b, bi) => {
                if(Math.hypot(b.x - e.x, b.y - e.y) < 40) {
                    e.hp -= b.damage;
                    bullets.splice(bi, 1);
                    particles.push({x: e.x, y:e.y, vx:0, vy:0, life:5, color:'white'});
                }
            });

            // Collision (Player)
            if(Math.hypot(player.x - e.x, player.y - e.y) < 40) {
                if(player.invincible <= 0) {
                    let dmg = input.charging ? e.atk * 2 : e.atk;
                    player.hp -= dmg;
                    player.invincible = 20; // Frames
                    updateHUD();
                }
            }

            if(e.hp <= 0) {
                enemies.splice(i, 1);
                kills++;
                // Give rewards
                window.player.coins += 50;
                window.player.xp += 20;
                updateHUD();
            }
        });

        // Particles
        particles.forEach((p, i) => {
            p.x += p.vx; p.y += p.vy; p.life--;
            ctx.fillStyle = p.color;
            ctx.globalAlpha = p.life/20;
            ctx.beginPath(); ctx.arc(p.x, p.y, 5, 0, Math.PI*2); ctx.fill();
            if(p.life<=0) particles.splice(i, 1);
        });
        ctx.globalAlpha = 1;

        ctx.restore();

        if(player.invincible > 0) player.invincible--;

        if(player.hp <= 0) {
            alert("GOKU DEFEATED!");
            stopExplore();
            showTab('char'); // Back to Hub
        }

        requestAnimationFrame(loop);
    }

    function updateHUD() {
        document.getElementById('hud-kill-count').innerText = kills;
        const hpBar = document.getElementById('hud-hp-bar');
        const pct = Math.max(0, (player.hp / player.maxHp) * 100);
        hpBar.style.width = pct + "%";
    }

    // Expose
    window.initExplore = initExplore;
    window.stopExplore = stopExplore;

})();