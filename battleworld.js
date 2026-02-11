(function() {
    // --- ASSETS & CONFIG ---
    const ASSETS = {
        // Updated to use your local files
        GROUND_TILE: "IMG_0296.png", // Grass Tile
        HOUSE: "IMG_0295.png",       // House
        TREE: "IMG_0294.png",        // Tree
        NPC: "IMG_0293.png",         // NPC/Villager
        
        // Fallback for Enemies (still uses API, but falls back to this if needed)
        ENEMY_FALLBACK: "https://dragonball-api.com/transformations/frieza-final.png" 
    };

    const canvas = document.getElementById('explore-canvas');
    const ctx = canvas.getContext('2d');

    // World Settings
    const WORLD_WIDTH = 3000;
    const WORLD_HEIGHT = 3000;

    // Game State
    let isRunning = false;
    let lastTime = 0;
    let camera = { x: 0, y: 0 };
    let bgImage = new Image(); 
    
    // Asset Images
    let imgHouse = new Image();
    let imgTree = new Image();
    let imgNpc = new Image();
    
    // Stats
    let kills = 0;
    let currentQuest = { target: 5, progress: 0, desc: "Defeat Invaders" };

    // Entities
    let player = { 
        x: WORLD_WIDTH/2, y: WORLD_HEIGHT/2, size: 60, speed: 6, 
        hp: 100, maxHp: 100, 
        faceRight: true, invincible: 0, img: new Image()
    };
    
    let enemies = [];
    let npcs = [];
    let bullets = [];
    let particles = [];
    let loots = [];
    let structures = []; 

    // Inputs
    const input = { x: 0, y: 0, charging: false, chargeVal: 0 };

    // --- INITIALIZATION ---
    function initExplore() {
        if(isRunning) return;
        
        // Sync Player Stats
        if(window.GameState) {
            player.maxHp = window.GameState.gokuMaxHP;
            player.hp = window.GameState.gokuMaxHP;
        } else {
            player.maxHp = 100; player.hp = 100;
        }
        
        // Load Player Sprite
        const hudSprite = document.getElementById('ui-sprite');
        if(hudSprite && hudSprite.src) player.img.src = hudSprite.src;
        else player.img.src = "IMG_0061.png"; 

        // Load World Assets
        bgImage.src = ASSETS.GROUND_TILE;
        imgHouse.src = ASSETS.HOUSE;
        imgTree.src = ASSETS.TREE;
        imgNpc.src = ASSETS.NPC;

        resize();
        window.addEventListener('resize', resize);
        setupControls();

        // Generate World Content
        generateWorld();

        // Reset State
        enemies = [];
        bullets = [];
        particles = [];
        loots = [];
        kills = 0;
        currentQuest = { target: 5, progress: 0, desc: "Defeat Invaders" };
        updateHUD();

        isRunning = true;
        requestAnimationFrame(loop);

        // Spawn Loop
        setInterval(() => {
            if(isRunning && enemies.length < 15) spawnEnemy();
        }, 3000);
    }

    function stopExplore() {
        isRunning = false;
    }

    function resize() {
        canvas.width = window.innerWidth;
        canvas.height = window.innerHeight;
    }

    // --- WORLD GENERATION ---
    function generateWorld() {
        structures = [];
        npcs = [];

        // 1. Create Town Center (Safe Zone)
        // Fountain placeholder (Blue Circle)
        structures.push({ type: 'fountain', x: WORLD_WIDTH/2, y: WORLD_HEIGHT/2, w: 150, h: 150, color: 'cyan' });

        // 2. Houses around center
        for(let i=0; i<8; i++) {
            const angle = (i / 8) * Math.PI * 2;
            const dist = 400;
            structures.push({
                type: 'house',
                x: WORLD_WIDTH/2 + Math.cos(angle) * dist,
                y: WORLD_HEIGHT/2 + Math.sin(angle) * dist,
                w: 200, h: 200, // Adjusted for sprite aspect
                img: imgHouse
            });
        }

        // 3. Random Trees outside town
        for(let i=0; i<60; i++) {
            const x = Math.random() * WORLD_WIDTH;
            const y = Math.random() * WORLD_HEIGHT;
            // Don't spawn too close to center
            if(Math.hypot(x - WORLD_WIDTH/2, y - WORLD_HEIGHT/2) > 600) {
                structures.push({
                    type: 'tree',
                    x: x, y: y, w: 120, h: 120, 
                    img: imgTree
                });
            }
        }

        // 4. NPCs
        for(let i=0; i<5; i++) {
            npcs.push({
                x: WORLD_WIDTH/2 + (Math.random()-0.5)*300,
                y: WORLD_HEIGHT/2 + (Math.random()-0.5)*300,
                w: 60, h: 60,
                name: "Villager",
                img: imgNpc,
                tx: WORLD_WIDTH/2, ty: WORLD_HEIGHT/2 
            });
        }
    }

    // --- CONTROLS ---
    function setupControls() {
        const joyZone = document.getElementById('joy-zone');
        const stick = document.getElementById('joy-stick');
        let startX, startY, activeTouchId = null;

        joyZone.style.background = 'none'; joyZone.style.border = 'none';
        joyZone.style.width = '50%'; joyZone.style.height = '100%';
        joyZone.style.left = '0'; joyZone.style.bottom = '0'; joyZone.style.zIndex = '10'; 
        stick.style.opacity = '0'; 

        const handleStart = (e) => {
            e.preventDefault();
            if (activeTouchId !== null) return;
            const touch = e.changedTouches[0];
            activeTouchId = touch.identifier;
            startX = touch.clientX; startY = touch.clientY;
            stick.style.transition = 'none'; stick.style.opacity = '0.6';
            stick.style.left = startX + 'px'; stick.style.top = startY + 'px';
            stick.style.transform = `translate(-50%, -50%)`;
        };

        const handleMove = (e) => {
            e.preventDefault();
            for (let i = 0; i < e.changedTouches.length; i++) {
                if (e.changedTouches[i].identifier === activeTouchId) {
                    const touch = e.changedTouches[i];
                    const maxDist = 60; 
                    let dx = touch.clientX - startX; let dy = touch.clientY - startY;
                    const dist = Math.sqrt(dx*dx + dy*dy);
                    if(dist > maxDist) { dx = (dx/dist) * maxDist; dy = (dy/dist) * maxDist; }
                    stick.style.transform = `translate(calc(-50% + ${dx}px), calc(-50% + ${dy}px))`;
                    input.x = dx / maxDist; input.y = dy / maxDist;
                    break;
                }
            }
        };

        const handleEnd = (e) => {
            e.preventDefault();
            for (let i = 0; i < e.changedTouches.length; i++) {
                if (e.changedTouches[i].identifier === activeTouchId) {
                    activeTouchId = null; input.x = 0; input.y = 0; stick.style.opacity = '0'; break;
                }
            }
        };

        joyZone.addEventListener('touchstart', handleStart, {passive: false});
        joyZone.addEventListener('touchmove', handleMove, {passive: false});
        joyZone.addEventListener('touchend', handleEnd);

        const btnAtk = document.getElementById('btn-ex-attack');
        if(btnAtk) btnAtk.onclick = () => { if(!input.charging) shoot(); };
        const btnDodge = document.getElementById('btn-ex-dodge');
        if(btnDodge) btnDodge.onclick = () => { if(!input.charging) dodge(); };
        const btnCharge = document.getElementById('btn-ex-charge');
        if(btnCharge) {
            const startCharge = (e) => { e.preventDefault(); input.charging = true; };
            const endCharge = (e) => { e.preventDefault(); if(input.chargeVal >= 100) unleashUltimate(); input.charging = false; input.chargeVal = 0; const o = document.getElementById('ex-charge-overlay'); if(o) o.style.display='none'; };
            btnCharge.addEventListener('touchstart', startCharge); btnCharge.addEventListener('touchend', endCharge);
            btnCharge.addEventListener('mousedown', startCharge); btnCharge.addEventListener('mouseup', endCharge);
        }
    }

    // --- GAMEPLAY LOGIC ---

    function spawnEnemy() {
        const angle = Math.random() * Math.PI * 2;
        const dist = 800 + Math.random() * 400; 
        
        const gPower = window.GameState ? window.GameState.gokuPower : 100;
        const isStrong = Math.random() > 0.85;
        
        let enemySrc = ASSETS.ENEMY_FALLBACK;
        if(window.apiData && window.apiData.characters && window.apiData.characters.length > 0) {
            const rIdx = Math.floor(Math.random() * window.apiData.characters.length);
            const char = window.apiData.characters[rIdx];
            if(char && char.image) enemySrc = char.image;
        }

        const eImg = new Image(); eImg.src = enemySrc;

        enemies.push({
            x: player.x + Math.cos(angle) * dist,
            y: player.y + Math.sin(angle) * dist,
            size: isStrong ? 120 : 80, 
            hp: isStrong ? gPower * 20 : gPower * 4, 
            maxHp: isStrong ? gPower * 20 : gPower * 4,
            atk: (window.GameState ? window.GameState.gokuMaxHP : 100) * (isStrong ? 0.15 : 0.05),
            speed: isStrong ? 3 : 5,
            img: eImg, isStrong: isStrong
        });
    }

    function spawnLoot(x, y, isStrong) {
        const count = isStrong ? 5 : 1;
        for(let i=0; i<count; i++) {
            loots.push({
                x: x + (Math.random()-0.5)*40,
                y: y + (Math.random()-0.5)*40,
                type: Math.random() > 0.5 ? 'coin' : 'xp',
                val: isStrong ? 500 : 100,
                vx: (Math.random()-0.5)*10, vy: (Math.random()-0.5)*10
            });
        }
    }

    function shoot() {
        let vx = input.x; let vy = input.y;
        if (Math.abs(vx) < 0.1 && Math.abs(vy) < 0.1) {
            let nearest = null; let minD = 600; 
            enemies.forEach(e => {
                let d = Math.hypot(e.x - player.x, e.y - player.y);
                if (d < minD) { minD = d; nearest = e; }
            });
            if (nearest) {
                let angle = Math.atan2(nearest.y - player.y, nearest.x - player.x);
                vx = Math.cos(angle); vy = Math.sin(angle);
            } else {
                vx = player.faceRight ? 1 : -1; vy = 0;
            }
        }
        player.faceRight = vx > 0;

        bullets.push({
            x: player.x, y: player.y,
            vx: vx * 22, vy: vy * 22, life: 50, 
            damage: window.GameState ? window.GameState.gokuPower : 50
        });
    }

    function dodge() {
        let dx = input.x || (player.faceRight ? 1 : -1);
        let dy = input.y || 0;
        let len = Math.sqrt(dx*dx + dy*dy);
        if(len === 0) len = 1;
        player.x += (dx/len) * 300; player.y += (dy/len) * 300;
        player.x = Math.max(0, Math.min(WORLD_WIDTH, player.x));
        player.y = Math.max(0, Math.min(WORLD_HEIGHT, player.y));
        
        for(let i=0; i<6; i++) particles.push({x: player.x, y: player.y, vx:(Math.random()-0.5)*12, vy:(Math.random()-0.5)*12, life:15, color:'cyan'});
    }

    function unleashUltimate() {
        const overlay = document.getElementById('view-explore');
        const flash = document.createElement('div');
        flash.className = 'flash-screen';
        overlay.appendChild(flash);
        setTimeout(() => flash.remove(), 2500);

        enemies.forEach(e => {
            if(Math.hypot(e.x - player.x, e.y - player.y) < 800) { 
                e.hp = 0;
                for(let i=0; i<10; i++) particles.push({x: e.x, y: e.y, vx:(Math.random()-0.5)*25, vy:(Math.random()-0.5)*25, life:30, color:'orange'});
            }
        });
    }

    // --- GAME LOOP ---
    function loop(timestamp) {
        if(!isRunning) return;
        const dt = timestamp - lastTime;
        lastTime = timestamp;

        ctx.clearRect(0, 0, canvas.width, canvas.height);

        // -- UPDATE PLAYER --
        if(input.charging) {
            input.chargeVal += 1.2; if(input.chargeVal > 100) input.chargeVal = 100;
            const hud = document.getElementById('ex-charge-overlay');
            if(hud) { hud.style.display = 'block'; document.getElementById('ex-charge-fill').style.width = input.chargeVal + '%'; }
            player.x += (Math.random()-0.5)*6; player.y += (Math.random()-0.5)*6;
        } else {
            let nextX = player.x + input.x * player.speed;
            let nextY = player.y + input.y * player.speed;
            
            // Collision with Structures
            let collided = false;
            structures.forEach(s => {
                if(s.type !== 'fountain' && nextX > s.x - s.w/2 && nextX < s.x + s.w/2 && nextY > s.y - s.h/2 && nextY < s.y + s.h/2) collided = true;
            });

            if(!collided) {
                player.x = Math.max(0, Math.min(WORLD_WIDTH, nextX));
                player.y = Math.max(0, Math.min(WORLD_HEIGHT, nextY));
            }
            
            if(input.x > 0) player.faceRight = true; if(input.x < 0) player.faceRight = false;
        }

        // Camera Follow
        camera.x = Math.max(0, Math.min(WORLD_WIDTH - canvas.width, player.x - canvas.width/2));
        camera.y = Math.max(0, Math.min(WORLD_HEIGHT - canvas.height, player.y - canvas.height/2));

        // -- RENDER WORLD --
        ctx.save();
        ctx.translate(-camera.x, -camera.y);

        // 1. Draw Tiled Ground (Safe Check Added)
        if(bgImage.complete && bgImage.naturalWidth > 0) {
            const ptrn = ctx.createPattern(bgImage, 'repeat');
            ctx.fillStyle = ptrn;
            ctx.fillRect(camera.x, camera.y, canvas.width, canvas.height); 
        } else {
            ctx.fillStyle = '#2c3e50';
            ctx.fillRect(0, 0, WORLD_WIDTH, WORLD_HEIGHT);
        }

        // 2. Draw Structures (Safe Check Added)
        structures.forEach(s => {
            if(s.img && s.img.complete && s.img.naturalWidth > 0) {
                // Shadow
                ctx.save();
                ctx.fillStyle = 'rgba(0,0,0,0.4)';
                ctx.beginPath();
                ctx.ellipse(s.x, s.y + s.h/2 - 10, s.w/2, s.h/4, 0, 0, Math.PI*2);
                ctx.fill();
                ctx.restore();
                
                ctx.drawImage(s.img, s.x - s.w/2, s.y - s.h/2, s.w, s.h);
            } else {
                // Fallback if image failed
                ctx.fillStyle = s.color || 'brown';
                ctx.fillRect(s.x - s.w/2, s.y - s.h/2, s.w, s.h);
            }
        });

        // 3. NPCs (Safe Check Added)
        npcs.forEach(n => {
            if(Math.random() < 0.02) {
                n.tx = n.x + (Math.random()-0.5)*200; n.ty = n.y + (Math.random()-0.5)*200;
            }
            const ang = Math.atan2(n.ty - n.y, n.tx - n.x);
            if(Math.hypot(n.tx - n.x, n.ty - n.y) > 5) {
                n.x += Math.cos(ang) * 2; n.y += Math.sin(ang) * 2;
            }
            
            if(n.img && n.img.complete && n.img.naturalWidth > 0) {
                ctx.drawImage(n.img, n.x - n.w/2, n.y - n.h/2, n.w, n.h);
            } else {
                ctx.fillStyle = n.color || 'white'; 
                ctx.beginPath(); ctx.arc(n.x, n.y, 15, 0, Math.PI*2); ctx.fill();
            }
            ctx.fillStyle = 'white'; ctx.font = '12px Arial'; ctx.fillText(n.name, n.x-20, n.y-35);
        });

        // 4. Loot
        for(let i = loots.length - 1; i >= 0; i--) {
            let l = loots[i];
            l.x += l.vx; l.y += l.vy; l.vx *= 0.9; l.vy *= 0.9;
            const d = Math.hypot(player.x - l.x, player.y - l.y);
            if(d < 200) { 
                const ang = Math.atan2(player.y - l.y, player.x - l.x);
                l.x += Math.cos(ang) * 15; l.y += Math.sin(ang) * 15;
            }
            if(d < 40) {
                if(window.player) { if(l.type === 'coin') window.player.coins += l.val; else window.player.xp += l.val; }
                loots.splice(i, 1); continue;
            }
            ctx.beginPath(); ctx.arc(l.x, l.y, 8, 0, Math.PI*2);
            ctx.fillStyle = l.type === 'coin' ? 'gold' : 'cyan'; ctx.fill();
            ctx.strokeStyle = 'white'; ctx.lineWidth = 2; ctx.stroke();
        }

        // 5. Enemies
        for(let i = enemies.length - 1; i >= 0; i--) {
            let e = enemies[i];
            let ang = Math.atan2(player.y - e.y, player.x - e.x);
            let nextEX = e.x + Math.cos(ang) * e.speed;
            let nextEY = e.y + Math.sin(ang) * e.speed;
            
            // Simple collision avoid with structures
            let blocked = false;
            structures.forEach(s => {
                if(nextEX > s.x - s.w/2 - 20 && nextEX < s.x + s.w/2 + 20 && nextEY > s.y - s.h/2 - 20 && nextEY < s.y + s.h/2 + 20) blocked = true;
            });

            if(!blocked) { e.x = nextEX; e.y = nextEY; }

            // Draw Sprite
            try {
                if(e.img.complete && e.img.naturalWidth > 0) {
                    const aspect = e.img.naturalWidth / e.img.naturalHeight;
                    let drawW = e.size; let drawH = e.size;
                    if (aspect > 1) drawH = e.size / aspect; else drawW = e.size * aspect;
                    ctx.drawImage(e.img, e.x - drawW/2, e.y - drawH/2, drawW, drawH);
                } else {
                    ctx.fillStyle = e.isStrong ? 'red' : 'purple'; ctx.fillRect(e.x - e.size/2, e.y - e.size/2, e.size, e.size);
                }
            } catch(err){}

            ctx.fillStyle = 'red'; ctx.fillRect(e.x - 30, e.y - 50, 60, 6);
            ctx.fillStyle = 'lime'; ctx.fillRect(e.x - 30, e.y - 50, 60 * Math.max(0, e.hp/e.maxHp), 6);

            for(let j = bullets.length - 1; j >= 0; j--) {
                let b = bullets[j];
                if(Math.hypot(b.x - e.x, b.y - e.y) < (e.size/2 + 10)) {
                    e.hp -= b.damage; bullets.splice(j, 1);
                    particles.push({x: e.x, y:e.y, vx:(Math.random()-0.5)*5, vy:(Math.random()-0.5)*5, life:10, color:'white'});
                }
            }

            if(Math.hypot(player.x - e.x, player.y - e.y) < (e.size/2 + 20)) {
                if(player.invincible <= 0) {
                    let dmg = input.charging ? e.atk * 2 : e.atk;
                    const maxDmg = player.maxHp * 0.2; if(dmg > maxDmg) dmg = maxDmg;
                    player.hp -= dmg; player.invincible = 30; updateHUD();
                }
            }

            if(e.hp <= 0) {
                spawnLoot(e.x, e.y, e.isStrong);
                enemies.splice(i, 1);
                kills++;
                currentQuest.progress++;
                updateHUD();
            }
        }

        // 6. Bullets
        ctx.fillStyle = '#00ffff'; ctx.shadowBlur = 10; ctx.shadowColor = '#00ffff';
        for(let i = bullets.length - 1; i >= 0; i--) {
            let b = bullets[i];
            b.x += b.vx; b.y += b.vy; b.life--;
            ctx.beginPath(); ctx.arc(b.x, b.y, 10, 0, Math.PI*2); ctx.fill();
            if(b.life <= 0) bullets.splice(i, 1);
        }
        ctx.shadowBlur = 0;

        // 7. Player
        ctx.save();
        if(!player.faceRight) {
            ctx.translate(player.x + player.size/2, player.y); ctx.scale(-1, 1); ctx.translate(-(player.x + player.size/2), -player.y);
        }
        if(input.charging) { ctx.shadowColor = 'white'; ctx.shadowBlur = 25; }
        try {
            if(player.img.complete) ctx.drawImage(player.img, player.x - player.size/2, player.y - player.size/2, player.size, player.size);
            else { ctx.fillStyle = 'orange'; ctx.fillRect(player.x - 30, player.y - 30, 60, 60); }
        } catch(e) {}
        ctx.restore();

        // 8. Particles
        for(let i = particles.length - 1; i >= 0; i--) {
            let p = particles[i]; p.x += p.vx; p.y += p.vy; p.life--;
            ctx.fillStyle = p.color; ctx.globalAlpha = p.life/20;
            ctx.beginPath(); ctx.arc(p.x, p.y, 4, 0, Math.PI*2); ctx.fill();
            if(p.life<=0) particles.splice(i, 1);
        }
        ctx.globalAlpha = 1;

        ctx.restore();

        // --- UI OVERLAY (Minimap) ---
        ctx.fillStyle = 'rgba(0,0,0,0.5)';
        ctx.fillRect(canvas.width - 160, 10, 150, 150);
        ctx.strokeStyle = 'white'; ctx.lineWidth = 2;
        ctx.strokeRect(canvas.width - 160, 10, 150, 150);
        
        const mapScale = 150 / WORLD_WIDTH;
        ctx.fillStyle = 'gray';
        structures.forEach(s => ctx.fillRect((canvas.width-160) + s.x*mapScale, 10 + s.y*mapScale, s.w*mapScale, s.h*mapScale));
        ctx.fillStyle = 'lime';
        ctx.beginPath(); ctx.arc((canvas.width-160) + player.x*mapScale, 10 + player.y*mapScale, 3, 0, Math.PI*2); ctx.fill();
        ctx.fillStyle = 'red';
        enemies.forEach(e => { ctx.beginPath(); ctx.arc((canvas.width-160) + e.x*mapScale, 10 + e.y*mapScale, 2, 0, Math.PI*2); ctx.fill(); });

        if(player.invincible > 0) player.invincible--;

        if(player.hp <= 0) {
            alert("GOKU DEFEATED!"); stopExplore();
            if(typeof window.showTab === 'function') window.showTab('char');
        }

        requestAnimationFrame(loop);
    }

    function updateHUD() {
        const kc = document.getElementById('hud-kill-count');
        if(kc) {
            if(currentQuest.progress >= currentQuest.target) {
                kc.innerText = "QUEST COMPLETE!";
                kc.style.color = "lime";
            } else {
                kc.innerText = `${currentQuest.desc}: ${currentQuest.progress}/${currentQuest.target}`;
                kc.style.color = "gold";
            }
        }
        const hpBar = document.getElementById('hud-hp-bar');
        if(hpBar) {
            const pct = Math.max(0, (player.hp / player.maxHp) * 100);
            hpBar.style.width = pct + "%";
        }
    }

    window.initExplore = initExplore;
    window.stopExplore = stopExplore;

})();
