(function() {
    // --- ASSETS ---
    const ASSETS = {
        GROUND_TILE: "IMG_0287.png",
        HOUSE: "IMG_0299.png",
        TREE: "IMG_0300.png",
        NPC: "IMG_0292.png",
        ENEMY_FALLBACK: "https://dragonball-api.com/transformations/frieza-final.png" 
    };

    const canvas = document.getElementById('explore-canvas');
    const ctx = canvas.getContext('2d');

    const WORLD_WIDTH = 3000;
    const WORLD_HEIGHT = 3000;

    let isRunning = false;
    let lastTime = 0;
    let camera = { x: 0, y: 0 };
    let bgImage = new Image(); 
    
    let imgHouse = new Image();
    let imgTree = new Image();
    let imgNpc = new Image();

    // Stats & Quests
    let kills = 0;
    let activeQuest = null; // { target: 5, progress: 0, desc: "...", reward: {...} }

    // Entities
    let player = { 
        x: WORLD_WIDTH/2, y: WORLD_HEIGHT/2, size: 60, speed: 7, 
        hp: 100, maxHp: 100, 
        faceRight: true, invincible: 0, img: new Image()
    };
    
    let enemies = [];
    let npcs = [];
    let bullets = [];
    let particles = [];
    let loots = [];
    let structures = []; 

    const input = { x: 0, y: 0, charging: false, chargeVal: 0 };

    function initExplore() {
        if(isRunning) return;
        
        // --- FIX: Force Sync Stats Immediately ---
        if(window.GameState) {
            // Ensure we grab valid numbers, default to 100 if missing
            player.maxHp = window.GameState.gokuMaxHP || 100;
            player.hp = window.GameState.gokuHP || player.maxHp; // Use current HP, or Max if undefined
        } else {
            player.maxHp = 100; player.hp = 100;
        }
        
        const hudSprite = document.getElementById('ui-sprite');
        if(hudSprite && hudSprite.src) player.img.src = hudSprite.src;
        else player.img.src = "IMG_0061.png"; 

        bgImage.src = ASSETS.GROUND_TILE;
        imgHouse.src = ASSETS.HOUSE;
        imgTree.src = ASSETS.TREE;
        imgNpc.src = ASSETS.NPC;

        resize();
        window.addEventListener('resize', resize);
        setupControls();
        generateWorld();

        enemies = []; bullets = []; particles = []; loots = [];
        player.x = WORLD_WIDTH/2; player.y = WORLD_HEIGHT/2;
        kills = 0;
        activeQuest = null; 
        
        // --- FIX: Force UI Update NOW ---
        updateHUD();

        isRunning = true;
        requestAnimationFrame(loop);

        setInterval(() => {
            if(isRunning && enemies.length < 15) spawnEnemyGroup();
        }, 4000);
    }

    function stopExplore() { isRunning = false; }
    function resize() { canvas.width = window.innerWidth; canvas.height = window.innerHeight; }

    // --- WORLD GENERATION ---
    function generateWorld() {
        structures = []; npcs = [];
        structures.push({ type: 'fountain', x: WORLD_WIDTH/2, y: WORLD_HEIGHT/2, w: 150, h: 150, color: 'cyan' });

        for(let i=0; i<8; i++) {
            const angle = (i / 8) * Math.PI * 2;
            structures.push({ type: 'house', x: WORLD_WIDTH/2 + Math.cos(angle) * 400, y: WORLD_HEIGHT/2 + Math.sin(angle) * 400, w: 200, h: 200, img: imgHouse });
        }
        for(let i=0; i<60; i++) {
            const x = Math.random() * WORLD_WIDTH;
            const y = Math.random() * WORLD_HEIGHT;
            if(Math.hypot(x - WORLD_WIDTH/2, y - WORLD_HEIGHT/2) > 800) { // Further out
                structures.push({ type: 'tree', x: x, y: y, w: 120, h: 120, img: imgTree });
            }
        }
        for(let i=0; i<6; i++) {
            npcs.push({
                x: WORLD_WIDTH/2 + (Math.random()-0.5)*300,
                y: WORLD_HEIGHT/2 + (Math.random()-0.5)*300,
                w: 60, h: 60, name: "Villager", img: imgNpc,
                tx: WORLD_WIDTH/2, ty: WORLD_HEIGHT/2 
            });
        }
    }

    // --- NPC INTERACTION & QUESTS ---
    function checkNpcInteraction(touchX, touchY) {
        // Convert screen touch to world coordinates
        const worldX = touchX + camera.x;
        const worldY = touchY + camera.y;

        for (let npc of npcs) {
            if (Math.hypot(worldX - npc.x, worldY - npc.y) < 60) {
                // Determine Quest Type
                const types = [
                    { desc: "Defeat 5 Invaders", target: 5, reward: { coins: 1000, xp: 500 } },
                    { desc: "Defeat 10 Invaders", target: 10, reward: { coins: 2500, xp: 1200, item: true } },
                    { desc: "Clear Area (15 Kills)", target: 15, reward: { coins: 5000, xp: 2500, shards: 1 } }
                ];
                const q = types[Math.floor(Math.random() * types.length)];

                // Show Confirm Dialog (Simple JS Confirm for now, or replace with custom UI)
                if (confirm(`NPC Quest: ${q.desc}\n\nAccept?`)) {
                    activeQuest = { ...q, progress: 0 };
                    alert("Quest Accepted! Check HUD.");
                    updateHUD();
                }
                return true; // Handled
            }
        }
        return false;
    }

    // --- CONTROLS ---
    function setupControls() {
        const joyZone = document.getElementById('joy-zone');
        const stick = document.getElementById('joy-stick');
        let startX, startY, activeId = null;

        stick.style.display = 'none'; 
        stick.style.position = 'absolute';

        const handleStart = (e) => {
            // Check if tapping NPC first (Right side taps mainly, or specific taps)
            const touch = e.changedTouches[0];
            
            // If touching right side (Action area), check for NPC tap if not hitting a button
            if (touch.clientX > window.innerWidth / 2) {
                // If we tapped an NPC, don't move joystick
                if (checkNpcInteraction(touch.clientX, touch.clientY)) return;
            }

            e.preventDefault();
            if(activeId !== null) return;
            if(touch.clientX > window.innerWidth / 2) return; // Left side only for joystick

            activeId = touch.identifier;
            startX = touch.clientX;
            startY = touch.clientY;

            stick.style.display = 'block';
            stick.style.transition = 'none';
            stick.style.left = startX + 'px';
            stick.style.top = startY + 'px';
            stick.style.transform = `translate(-50%, -50%)`;
        };

        const handleMove = (e) => {
            e.preventDefault();
            for(let i=0; i<e.changedTouches.length; i++) {
                if(e.changedTouches[i].identifier === activeId) {
                    const t = e.changedTouches[i];
                    const maxDist = 50;
                    let dx = t.clientX - startX;
                    let dy = t.clientY - startY;
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
            for(let i=0; i<e.changedTouches.length; i++) {
                if(e.changedTouches[i].identifier === activeId) {
                    activeId = null; input.x = 0; input.y = 0; stick.style.display = 'none'; break;
                }
            }
        };

        // Attach listener to full canvas for NPC taps + Joystick
        canvas.addEventListener('touchstart', handleStart, {passive: false});
        canvas.addEventListener('touchmove', handleMove, {passive: false});
        canvas.addEventListener('touchend', handleEnd);

        // Map buttons
        document.getElementById('btn-ex-attack').onclick = () => { if(!input.charging) shoot(); };
        document.getElementById('btn-ex-dodge').onclick = () => { if(!input.charging) dodge(); };
        const btnCharge = document.getElementById('btn-ex-charge');
        const startC = (e) => { e.preventDefault(); input.charging = true; };
        const endC = (e) => { e.preventDefault(); if(input.chargeVal>=100) unleashUltimate(); input.charging = false; input.chargeVal = 0; document.getElementById('ex-charge-overlay').style.display='none'; };
        btnCharge.addEventListener('touchstart', startC); btnCharge.addEventListener('touchend', endC);
    }

    // --- GAMEPLAY ---
    function spawnEnemyGroup() {
        // Spawn FAR from player (min 1000px)
        const angle = Math.random() * Math.PI * 2;
        const dist = 1000 + Math.random() * 500; 
        
        let cx = player.x + Math.cos(angle) * dist;
        let cy = player.y + Math.sin(angle) * dist;
        
        // Clamp to world bounds
        cx = Math.max(100, Math.min(WORLD_WIDTH-100, cx));
        cy = Math.max(100, Math.min(WORLD_HEIGHT-100, cy));

        const gPower = window.GameState ? window.GameState.gokuPower : 100;
        let enemySrc = ASSETS.ENEMY_FALLBACK;
        if(window.apiData && window.apiData.characters && window.apiData.characters.length > 0) {
            const rIdx = Math.floor(Math.random() * window.apiData.characters.length);
            if(window.apiData.characters[rIdx].image) enemySrc = window.apiData.characters[rIdx].image;
        }
        const eImg = new Image(); eImg.src = enemySrc;

        for(let i=0; i<3; i++) {
            enemies.push({
                x: cx + (Math.random()-0.5)*100, y: cy + (Math.random()-0.5)*100,
                originX: cx, originY: cy, patrolX: cx, patrolY: cy,
                state: 'patrol', waitTimer: 0,
                size: 80, hp: gPower * 5, maxHp: gPower * 5,
                atk: player.maxHp * 0.05, speed: 3, img: eImg
            });
        }
    }

    function spawnLoot(x, y, isStrong) {
        const count = isStrong ? 5 : 2;
        for(let i=0; i<count; i++) {
            loots.push({
                x: x + (Math.random()-0.5)*40, y: y + (Math.random()-0.5)*40,
                type: Math.random() > 0.5 ? 'coin' : 'xp',
                val: 100, vx: (Math.random()-0.5)*10, vy: (Math.random()-0.5)*10
            });
        }
    }

    function checkQuestProgress() {
        if(!activeQuest) return;
        
        activeQuest.progress++;
        if(activeQuest.progress >= activeQuest.target) {
            // Quest Complete!
            alert(`QUEST COMPLETE!\nReward:\n+${activeQuest.reward.coins} Coins\n+${activeQuest.reward.xp} XP`);
            
            if(window.player) {
                window.player.coins += activeQuest.reward.coins;
                window.player.xp += activeQuest.reward.xp;
                
                if(activeQuest.reward.shards) {
                    window.player.dragonShards = (window.player.dragonShards || 0) + activeQuest.reward.shards;
                    alert(`Bonus: +${activeQuest.reward.shards} Dragon Shard!`);
                }
                
                if(activeQuest.reward.item && typeof window.addToInventory === 'function') {
                    window.addToInventory({ n: "Quest Gear", type: 'a', val: 2000, rarity: 3 });
                    alert("Bonus: +1 Legendary Armor!");
                }
            }
            activeQuest = null; // Clear quest
        }
        updateHUD();
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
                let a = Math.atan2(nearest.y - player.y, nearest.x - player.x);
                vx = Math.cos(a); vy = Math.sin(a);
            } else { vx = player.faceRight ? 1 : -1; vy = 0; }
        }
        player.faceRight = vx > 0;
        bullets.push({ x: player.x, y: player.y, vx: vx * 22, vy: vy * 22, life: 50, damage: window.GameState.gokuPower });
    }

    function dodge() {
        let dx = input.x || (player.faceRight ? 1 : -1); let dy = input.y || 0;
        let len = Math.sqrt(dx*dx + dy*dy) || 1;
        player.x += (dx/len) * 300; player.y += (dy/len) * 300;
        for(let i=0; i<6; i++) particles.push({x: player.x, y: player.y, vx:(Math.random()-0.5)*12, vy:(Math.random()-0.5)*12, life:15, color:'cyan'});
    }

    function unleashUltimate() {
        const o = document.getElementById('view-explore');
        const f = document.createElement('div'); f.className = 'flash-screen'; o.appendChild(f);
        setTimeout(() => f.remove(), 2500);
        enemies.forEach(e => {
            if(Math.hypot(e.x-player.x, e.y-player.y) < 800) {
                e.hp = 0; 
                for(let i=0; i<10; i++) particles.push({x: e.x, y: e.y, vx:(Math.random()-0.5)*25, vy:(Math.random()-0.5)*25, life:30, color:'orange'});
            }
        });
    }

    // --- LOOP ---
    function loop(timestamp) {
        if(!isRunning) return;
        const dt = timestamp - lastTime; lastTime = timestamp;
        ctx.clearRect(0, 0, canvas.width, canvas.height);

        // Player
        if(input.charging) {
            input.chargeVal += 1.2; if(input.chargeVal>100) input.chargeVal=100;
            const h = document.getElementById('ex-charge-overlay');
            if(h) { h.style.display='block'; document.getElementById('ex-charge-fill').style.width=input.chargeVal+'%'; }
            player.x += (Math.random()-0.5)*6; player.y += (Math.random()-0.5)*6;
        } else {
            let nx = player.x + input.x * player.speed;
            let ny = player.y + input.y * player.speed;
            let hit = false;
            structures.forEach(s => {
                if(s.type!=='fountain' && nx>s.x-s.w/2 && nx<s.x+s.w/2 && ny>s.y-s.h/2 && ny<s.y+s.h/2) hit=true;
            });
            if(!hit) { player.x = Math.max(0, Math.min(WORLD_WIDTH, nx)); player.y = Math.max(0, Math.min(WORLD_HEIGHT, ny)); }
            if(input.x > 0) player.faceRight = true; if(input.x < 0) player.faceRight = false;
        }

        camera.x = Math.max(0, Math.min(WORLD_WIDTH - canvas.width, player.x - canvas.width/2));
        camera.y = Math.max(0, Math.min(WORLD_HEIGHT - canvas.height, player.y - canvas.height/2));

        // Render BG
        ctx.save(); ctx.translate(-camera.x, -camera.y);
        if(bgImage.complete && bgImage.naturalWidth > 0) {
            const ptrn = ctx.createPattern(bgImage, 'repeat');
            ctx.fillStyle = ptrn; ctx.fillRect(camera.x, camera.y, canvas.width, canvas.height); 
        } else { ctx.fillStyle = '#2c3e50'; ctx.fillRect(0, 0, WORLD_WIDTH, WORLD_HEIGHT); }

        // Structures
        structures.forEach(s => {
            if(s.img && s.img.complete && s.img.naturalWidth > 0) {
                ctx.fillStyle = 'rgba(0,0,0,0.3)'; ctx.beginPath(); ctx.ellipse(s.x, s.y+s.h/2-10, s.w/2, s.h/4, 0, 0, Math.PI*2); ctx.fill();
                ctx.drawImage(s.img, s.x - s.w/2, s.y - s.h/2, s.w, s.h);
            } else { ctx.fillStyle = s.color; ctx.fillRect(s.x-s.w/2, s.y-s.h/2, s.w, s.h); }
        });

        // NPCs
        npcs.forEach(n => {
            if(Math.random()<0.02) { n.tx = n.x + (Math.random()-0.5)*200; n.ty = n.y + (Math.random()-0.5)*200; }
            const ang = Math.atan2(n.ty-n.y, n.tx-n.x);
            if(Math.hypot(n.tx-n.x, n.ty-n.y)>5) { n.x += Math.cos(ang)*2; n.y += Math.sin(ang)*2; }
            if(n.img && n.img.complete && n.img.naturalWidth>0) ctx.drawImage(n.img, n.x-n.w/2, n.y-n.h/2, n.w, n.h);
            else { ctx.fillStyle='white'; ctx.beginPath(); ctx.arc(n.x, n.y, 15, 0, Math.PI*2); ctx.fill(); }
            ctx.fillStyle='yellow'; ctx.font='bold 14px Arial'; ctx.fillText("!", n.x-2, n.y-40); // Quest Marker
        });

        // Loot
        for(let i=loots.length-1; i>=0; i--) {
            let l = loots[i]; l.x+=l.vx; l.y+=l.vy; l.vx*=0.9; l.vy*=0.9;
            if(Math.hypot(player.x-l.x, player.y-l.y)<200) { l.x+=(player.x-l.x)*0.1; l.y+=(player.y-l.y)*0.1; }
            if(Math.hypot(player.x-l.x, player.y-l.y)<40) { if(window.player) { if(l.type=='coin') window.player.coins+=l.val; else window.player.xp+=l.val; } loots.splice(i,1); continue; }
            ctx.beginPath(); ctx.arc(l.x, l.y, 8, 0, Math.PI*2); ctx.fillStyle = l.type=='coin'?'gold':'cyan'; ctx.fill(); ctx.strokeStyle='white'; ctx.lineWidth=2; ctx.stroke();
        }

        // Enemies
        for(let i=enemies.length-1; i>=0; i--) {
            let e = enemies[i];
            if(e.state === 'patrol') {
                if(e.waitTimer > 0) e.waitTimer--;
                else {
                    let dist = Math.hypot(e.patrolX - e.x, e.patrolY - e.y);
                    if(dist < 10) {
                        e.waitTimer = 60 + Math.random() * 60;
                        e.patrolX = e.originX + (Math.random()-0.5) * 300;
                        e.patrolY = e.originY + (Math.random()-0.5) * 300;
                    } else {
                        let ang = Math.atan2(e.patrolY - e.y, e.patrolX - e.x);
                        e.x += Math.cos(ang) * 1.5; e.y += Math.sin(ang) * 1.5;
                    }
                }
            } else if(e.state === 'chase') {
                let ang = Math.atan2(player.y - e.y, player.x - e.x);
                e.x += Math.cos(ang) * e.speed; e.y += Math.sin(ang) * e.speed;
            }

            try {
                if(e.img.complete && e.img.naturalWidth>0) {
                    const aspect = e.img.naturalWidth/e.img.naturalHeight;
                    let dw=e.size; let dh=e.size; if(aspect>1) dh=e.size/aspect; else dw=e.size*aspect;
                    ctx.drawImage(e.img, e.x-dw/2, e.y-dh/2, dw, dh);
                } else {
                    ctx.fillStyle = e.state==='chase' ? 'red' : 'purple'; 
                    ctx.fillRect(e.x-e.size/2, e.y-e.size/2, e.size, e.size);
                }
            } catch(er){}

            ctx.fillStyle='red'; ctx.fillRect(e.x-30, e.y-50, 60, 6);
            ctx.fillStyle='lime'; ctx.fillRect(e.x-30, e.y-50, 60*Math.max(0, e.hp/e.maxHp), 6);

            for(let j=bullets.length-1; j>=0; j--) {
                let b = bullets[j];
                if(Math.hypot(b.x-e.x, b.y-e.y) < (e.size/2+10)) {
                    e.hp -= b.damage; e.state = 'chase'; bullets.splice(j, 1);
                    particles.push({x:e.x, y:e.y, vx:(Math.random()-0.5)*5, vy:(Math.random()-0.5)*5, life:10, color:'white'});
                }
            }

            if(Math.hypot(player.x-e.x, player.y-e.y) < (e.size/2+20)) {
                if(player.invincible <= 0) {
                    player.hp -= (input.charging ? e.atk*2 : e.atk); player.invincible = 30; updateHUD();
                }
            }

            if(e.hp <= 0) {
                spawnLoot(e.x, e.y, true); enemies.splice(i, 1);
                kills++; checkQuestProgress(); updateHUD();
            }
        }

        // Bullets & Particles
        ctx.fillStyle='#00ffff'; ctx.shadowBlur=10; ctx.shadowColor='#00ffff';
        for(let i=bullets.length-1; i>=0; i--) {
            let b=bullets[i]; b.x+=b.vx; b.y+=b.vy; b.life--;
            ctx.beginPath(); ctx.arc(b.x, b.y, 10, 0, Math.PI*2); ctx.fill();
            if(b.life<=0) bullets.splice(i,1);
        }
        ctx.shadowBlur=0;

        ctx.save();
        if(!player.faceRight) { ctx.translate(player.x+player.size/2, player.y); ctx.scale(-1,1); ctx.translate(-(player.x+player.size/2), -player.y); }
        if(input.charging) { ctx.shadowColor='white'; ctx.shadowBlur=25; }
        if(player.img.complete) ctx.drawImage(player.img, player.x-player.size/2, player.y-player.size/2, player.size, player.size);
        else { ctx.fillStyle='orange'; ctx.fillRect(player.x-30, player.y-30, 60, 60); }
        ctx.restore();

        for(let i=particles.length-1; i>=0; i--) {
            let p=particles[i]; p.x+=p.vx; p.y+=p.vy; p.life--;
            ctx.fillStyle=p.color; ctx.globalAlpha=p.life/20;
            ctx.beginPath(); ctx.arc(p.x, p.y, 4, 0, Math.PI*2); ctx.fill();
            if(p.life<=0) particles.splice(i,1);
        }
        ctx.globalAlpha=1;
        ctx.restore();

        // Minimap
        ctx.fillStyle='rgba(0,0,0,0.5)'; ctx.fillRect(canvas.width-160, 10, 150, 150);
        ctx.strokeStyle='white'; ctx.lineWidth=2; ctx.strokeRect(canvas.width-160, 10, 150, 150);
        const ms = 150/WORLD_WIDTH;
        ctx.fillStyle='gray'; structures.forEach(s=>ctx.fillRect((canvas.width-160)+s.x*ms, 10+s.y*ms, s.w*ms, s.h*ms));
        ctx.fillStyle='lime'; ctx.beginPath(); ctx.arc((canvas.width-160)+player.x*ms, 10+player.y*ms, 3, 0, Math.PI*2); ctx.fill();
        ctx.fillStyle='red'; enemies.forEach(e=>{ ctx.beginPath(); ctx.arc((canvas.width-160)+e.x*ms, 10+e.y*ms, 2, 0, Math.PI*2); ctx.fill(); });
        ctx.fillStyle='yellow'; npcs.forEach(n=>{ ctx.beginPath(); ctx.arc((canvas.width-160)+n.x*ms, 10+n.y*ms, 2, 0, Math.PI*2); ctx.fill(); });

        if(player.invincible > 0) player.invincible--;
        if(player.hp <= 0) { alert("GOKU DEFEATED!"); stopExplore(); if(typeof window.showTab === 'function') window.showTab('char'); }

        requestAnimationFrame(loop);
    }

    function updateHUD() {
        const kc = document.getElementById('hud-kill-count');
        if(kc) {
            if(activeQuest) {
                kc.innerText = `Quest: ${activeQuest.progress}/${activeQuest.target} (${activeQuest.desc})`;
                kc.style.color = "gold";
            } else {
                kc.innerText = `Kills: ${kills}`;
                kc.style.color = "white";
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
