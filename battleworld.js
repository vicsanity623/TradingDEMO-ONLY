(function() {
    const ASSETS = {
        BG: "IMG_0287.png", 
        HOUSE: "IMG_0299.png", 
        TREE: "IMG_0300.png",
        NPC: "IMG_0292.png",
        ENEMY_FALLBACK: "https://dragonball-api.com/transformations/frieza-final.png"
    };

    const canvas = document.getElementById('explore-canvas');
    const ctx = canvas.getContext('2d');
    const WORLD_W = 3000, WORLD_H = 3000;

    let isRunning = false, lastTime = 0, camera = {x:0, y:0};
    let bgImage = new Image(), imgHouse = new Image(), imgTree = new Image(), imgNpc = new Image();
    
    // Stats
    let sessionLoot = { coins: 0, shards: 0 };
    let currentQuest = { target: 5, progress: 0, desc: "Defeat Invaders" };

    // Entities
    let player = { x: WORLD_W/2, y: WORLD_W/2, size: 60, speed: 7, hp: 100, maxHp: 100, faceRight: true, invincible: 0, img: new Image() };
    let enemies = [], npcs = [], bullets = [], particles = [], loots = [], structures = [];
    
    const input = { x: 0, y: 0, charging: false, chargeVal: 0 };

    // --- INIT ---
    function initExplore() {
        if(isRunning) return;

        // 1. SYNC STATS (Bulletproof)
        if(window.GameState) {
            player.maxHp = window.GameState.gokuMaxHP || 1000;
            player.hp = window.player.hp > 0 ? window.player.hp : player.maxHp; 
        } else {
            player.maxHp = 1000; player.hp = 1000; // Fallback
        }

        // 2. Load Assets
        const hudSprite = document.getElementById('ui-sprite');
        player.img.src = (hudSprite && hudSprite.src) ? hudSprite.src : "IMG_0061.png";
        
        // Update HUD Avatar
        const avatarImg = document.getElementById('rpg-avatar-img');
        if(avatarImg) avatarImg.src = player.img.src;

        bgImage.src = ASSETS.BG; imgHouse.src = ASSETS.HOUSE; 
        imgTree.src = ASSETS.TREE; imgNpc.src = ASSETS.NPC;

        resize(); window.addEventListener('resize', resize);
        setupControls(); generateWorld();

        enemies = []; bullets = []; particles = []; loots = [];
        sessionLoot = { coins: 0, shards: 0 };
        currentQuest = { target: 5, progress: 0, desc: "Defeat Invaders" };
        
        updateHUD(); // Initial Paint

        isRunning = true;
        requestAnimationFrame(loop);

        setInterval(() => { if(isRunning && enemies.length < 12) spawnEnemyGroup(); }, 4000);
    }

    function stopExplore() { isRunning = false; }
    function resize() { canvas.width = window.innerWidth; canvas.height = window.innerHeight; }

    // --- CONTROLS (MOUSE + TOUCH FIXED) ---
    function setupControls() {
        const joyZone = document.getElementById('joy-zone');
        const stick = document.getElementById('joy-stick');
        let startX, startY, activeId = null;

        // Helper: Update Stick Visual & Input
        const updateStick = (cx, cy) => {
            const maxDist = 50;
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

        const startMove = (cx, cy, id) => {
            activeId = id;
            startX = cx; startY = cy;
            stick.style.display = 'block';
            stick.style.left = startX + 'px';
            stick.style.top = startY + 'px';
            stick.style.transform = `translate(-50%, -50%)`;
            input.x = 0; input.y = 0;
        };

        const endMove = () => {
            activeId = null; input.x = 0; input.y = 0; stick.style.display = 'none';
        };

        // Touch Events
        joyZone.addEventListener('touchstart', e => {
            e.preventDefault(); // Prevent scrolling
            if(activeId !== null) return;
            startMove(e.changedTouches[0].clientX, e.changedTouches[0].clientY, e.changedTouches[0].identifier);
        }, {passive: false});

        joyZone.addEventListener('touchmove', e => {
            e.preventDefault();
            for(let i=0; i<e.changedTouches.length; i++) {
                if(e.changedTouches[i].identifier === activeId) {
                    updateStick(e.changedTouches[i].clientX, e.changedTouches[i].clientY);
                }
            }
        }, {passive: false});

        joyZone.addEventListener('touchend', endMove);

        // Mouse Events (Desktop Support)
        joyZone.addEventListener('mousedown', e => {
            e.preventDefault();
            startMove(e.clientX, e.clientY, 'mouse');
        });
        window.addEventListener('mousemove', e => {
            if(activeId === 'mouse') { e.preventDefault(); updateStick(e.clientX, e.clientY); }
        });
        window.addEventListener('mouseup', () => { if(activeId === 'mouse') endMove(); });

        // Buttons
        document.getElementById('btn-ex-attack').onmousedown = () => { if(!input.charging) shoot(); };
        document.getElementById('btn-ex-attack').ontouchstart = (e) => { e.preventDefault(); if(!input.charging) shoot(); };
        
        document.getElementById('btn-ex-dodge').onmousedown = () => { if(!input.charging) dodge(); };
        document.getElementById('btn-ex-dodge').ontouchstart = (e) => { e.preventDefault(); if(!input.charging) dodge(); };
        
        const btnCharge = document.getElementById('btn-ex-charge');
        const startC = (e) => { e.preventDefault(); input.charging = true; };
        const endC = (e) => { e.preventDefault(); if(input.chargeVal>=100) unleashUltimate(); input.charging = false; input.chargeVal = 0; document.getElementById('ex-charge-overlay').style.display='none'; };
        
        btnCharge.onmousedown = startC; btnCharge.onmouseup = endC;
        btnCharge.ontouchstart = startC; btnCharge.ontouchend = endC;
    }

    // --- GAMEPLAY ---
    function spawnEnemyGroup() {
        const angle = Math.random() * Math.PI * 2;
        const dist = 1200; // Far spawn
        let cx = player.x + Math.cos(angle) * dist;
        let cy = player.y + Math.sin(angle) * dist;
        cx = Math.max(100, Math.min(WORLD_W-100, cx));
        cy = Math.max(100, Math.min(WORLD_H-100, cy));

        const gPower = window.GameState ? window.GameState.gokuPower : 100;
        const eImg = new Image(); eImg.src = ASSETS.ENEMY_FALLBACK; // Or API image

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
                x: x, y: y, type: Math.random()>0.8 ? 'shard' : 'coin',
                val: 100, vx: (Math.random()-0.5)*15, vy: (Math.random()-0.5)*15
            });
        }
    }

    function shoot() {
        let vx = input.x, vy = input.y;
        if(Math.abs(vx)<0.1 && Math.abs(vy)<0.1) {
            let nearest=null, minD=600;
            enemies.forEach(e=>{ let d=Math.hypot(e.x-player.x, e.y-player.y); if(d<minD){minD=d; nearest=e;} });
            if(nearest) { let a=Math.atan2(nearest.y-player.y, nearest.x-player.x); vx=Math.cos(a); vy=Math.sin(a); }
            else { vx=player.faceRight?1:-1; vy=0; }
        }
        player.faceRight = vx>0;
        bullets.push({x:player.x, y:player.y, vx:vx*22, vy:vy*22, life:50, damage:window.GameState?window.GameState.gokuPower:50});
    }

    function dodge() {
        let dx=input.x||(player.faceRight?1:-1), dy=input.y||0, len=Math.sqrt(dx*dx+dy*dy)||1;
        player.x+=dx/len*300; player.y+=dy/len*300;
        for(let i=0;i<6;i++) particles.push({x:player.x,y:player.y,vx:(Math.random()-0.5)*12,vy:(Math.random()-0.5)*12,life:15,color:'cyan'});
    }

    function unleashUltimate() {
        const o=document.getElementById('view-explore'), f=document.createElement('div');
        f.className='flash-screen'; o.appendChild(f); setTimeout(()=>f.remove(),2500);
        enemies.forEach(e=>{ if(Math.hypot(e.x-player.x,e.y-player.y)<800) { e.hp=0; for(let i=0;i<10;i++) particles.push({x:e.x,y:e.y,vx:(Math.random()-0.5)*25,vy:(Math.random()-0.5)*25,life:30,color:'orange'}); } });
    }

    // --- LOOP ---
    function loop(timestamp) {
        if(!isRunning) return;
        const dt = timestamp - lastTime; lastTime = timestamp;
        ctx.clearRect(0,0,canvas.width,canvas.height);

        // Player Move
        if(input.charging) {
            input.chargeVal+=1.2; if(input.chargeVal>100) input.chargeVal=100;
            const h=document.getElementById('ex-charge-overlay'); if(h) { h.style.display='block'; document.getElementById('ex-charge-fill').style.width=input.chargeVal+'%'; }
            player.x+=(Math.random()-0.5)*6; player.y+=(Math.random()-0.5)*6;
        } else {
            let nx=player.x+input.x*player.speed, ny=player.y+input.y*player.speed;
            let hit=false; structures.forEach(s=>{ if(s.type!=='fountain' && nx>s.x-s.w/2 && nx<s.x+s.w/2 && ny>s.y-s.h/2 && ny<s.y+s.h/2) hit=true; });
            if(!hit) { player.x=Math.max(0,Math.min(WORLD_W,nx)); player.y=Math.max(0,Math.min(WORLD_H,ny)); }
            if(input.x>0) player.faceRight=true; if(input.x<0) player.faceRight=false;
        }

        camera.x = Math.max(0, Math.min(WORLD_W-canvas.width, player.x-canvas.width/2));
        camera.y = Math.max(0, Math.min(WORLD_H-canvas.height, player.y-canvas.height/2));

        ctx.save(); ctx.translate(-camera.x, -camera.y);

        // 1. BG
        if(bgImage.complete) { const p=ctx.createPattern(bgImage,'repeat'); ctx.fillStyle=p; ctx.fillRect(camera.x,camera.y,canvas.width,canvas.height); }
        else { ctx.fillStyle='#2c3e50'; ctx.fillRect(0,0,WORLD_W,WORLD_H); }

        // 2. Structures
        structures.forEach(s=>{ 
            if(s.img && s.img.complete) {
                ctx.fillStyle='rgba(0,0,0,0.3)'; ctx.beginPath(); ctx.ellipse(s.x,s.y+s.h/2-10,s.w/2,s.h/4,0,0,Math.PI*2); ctx.fill();
                ctx.drawImage(s.img, s.x-s.w/2, s.y-s.h/2, s.w, s.h);
            } else { ctx.fillStyle=s.color; ctx.fillRect(s.x-s.w/2, s.y-s.h/2, s.w, s.h); }
        });

        // 3. Loot (Magnet)
        for(let i=loots.length-1; i>=0; i--) {
            let l=loots[i]; l.x+=l.vx; l.y+=l.vy; l.vx*=0.9; l.vy*=0.9;
            if(Math.hypot(player.x-l.x, player.y-l.y)<200) { l.x+=(player.x-l.x)*0.15; l.y+=(player.y-l.y)*0.15; }
            if(Math.hypot(player.x-l.x, player.y-l.y)<50) { 
                // Collect
                if(l.type==='coin') { window.player.coins+=100; sessionLoot.coins+=100; }
                else if(l.type==='shard') { window.player.dragonShards++; sessionLoot.shards++; }
                else { window.player.xp+=50; }
                loots.splice(i,1); updateHUD(); continue; 
            }
            ctx.beginPath(); ctx.arc(l.x, l.y, 8, 0, Math.PI*2);
            ctx.fillStyle = l.type==='coin'?'gold' : (l.type==='shard'?'cyan':'lime'); 
            ctx.fill(); ctx.strokeStyle='white'; ctx.stroke();
        }

        // 4. Enemies
        for(let i=enemies.length-1; i>=0; i--) {
            let e = enemies[i];
            // AI
            if(e.state==='patrol') {
                if(e.waitTimer>0) e.waitTimer--;
                else {
                    let d = Math.hypot(e.patrolX-e.x, e.patrolY-e.y);
                    if(d<10) { e.waitTimer=60+Math.random()*60; e.patrolX=e.originX+(Math.random()-0.5)*300; e.patrolY=e.originY+(Math.random()-0.5)*300; }
                    else { let a=Math.atan2(e.patrolY-e.y, e.patrolX-e.x); e.x+=Math.cos(a)*1.5; e.y+=Math.sin(a)*1.5; }
                }
            } else {
                let a=Math.atan2(player.y-e.y, player.x-e.x); e.x+=Math.cos(a)*e.speed; e.y+=Math.sin(a)*e.speed;
            }

            try{ if(e.img.complete) ctx.drawImage(e.img, e.x-40, e.y-40, 80, 80); else { ctx.fillStyle='red'; ctx.fillRect(e.x-25,e.y-25,50,50); } }catch(er){}
            
            // HP
            ctx.fillStyle='red'; ctx.fillRect(e.x-30, e.y-50, 60, 6);
            ctx.fillStyle='lime'; ctx.fillRect(e.x-30, e.y-50, 60*Math.max(0, e.hp/e.maxHp), 6);

            // Hit
            for(let j=bullets.length-1; j>=0; j--) {
                if(Math.hypot(bullets[j].x-e.x, bullets[j].y-e.y)<50) {
                    e.hp-=bullets[j].damage; e.state='chase'; bullets.splice(j,1);
                }
            }
            // Player Hit
            if(Math.hypot(player.x-e.x, player.y-e.y)<60) {
                if(player.invincible<=0) { player.hp-=(input.charging?e.atk*2:e.atk); player.invincible=30; updateHUD(); }
            }
            if(e.hp<=0) { spawnLoot(e.x, e.y, true); enemies.splice(i,1); kills++; currentQuest.progress++; updateHUD(); }
        }

        // 5. Bullets
        ctx.fillStyle='#00ffff'; 
        for(let i=bullets.length-1; i>=0; i--) {
            let b=bullets[i]; b.x+=b.vx; b.y+=b.vy; b.life--;
            ctx.beginPath(); ctx.arc(b.x, b.y, 10, 0, Math.PI*2); ctx.fill();
            if(b.life<=0) bullets.splice(i,1);
        }

        // 6. Player
        ctx.save();
        if(!player.faceRight) { ctx.translate(player.x+30, player.y); ctx.scale(-1,1); ctx.translate(-(player.x+30), -player.y); }
        if(player.img.complete) ctx.drawImage(player.img, player.x-30, player.y-30, 60, 60);
        ctx.restore();

        ctx.restore();
        
        if(player.invincible>0) player.invincible--;
        if(player.hp<=0) { alert("DEFEATED!"); stopExplore(); if(window.showTab) window.showTab('char'); }
        
        requestAnimationFrame(loop);
    }

    function updateHUD() {
        document.getElementById('rpg-hp-text').innerText = `${Math.ceil(player.hp)} / ${Math.ceil(player.maxHp)}`;
        document.getElementById('rpg-hp-fill').style.width = Math.max(0, (player.hp/player.maxHp)*100) + "%";
        
        const xpPct = window.player ? (window.player.xp / window.player.nextXp) * 100 : 0;
        document.getElementById('rpg-xp-text').innerText = `XP ${Math.floor(xpPct)}%`;
        document.getElementById('rpg-xp-fill').style.width = xpPct + "%";

        document.getElementById('loot-coins').innerHTML = `💰 <span>${sessionLoot.coins}</span>`;
        document.getElementById('loot-shards').innerHTML = `💎 <span>${sessionLoot.shards}</span>`;

        const q = document.getElementById('quest-desc');
        if(q) {
            if(currentQuest.progress >= currentQuest.target) q.innerText = "Complete! Return to Hub.";
            else q.innerText = `${currentQuest.desc}: ${currentQuest.progress}/${currentQuest.target}`;
        }
    }

    // Generate World
    function generateWorld() {
        structures = []; npcs = [];
        structures.push({ type: 'fountain', x: WORLD_W/2, y: WORLD_W/2, w:150, h:150, color:'cyan' });
        // Houses
        for(let i=0;i<8;i++) {
            let a = i/8*Math.PI*2;
            structures.push({ x:WORLD_W/2+Math.cos(a)*400, y:WORLD_W/2+Math.sin(a)*400, w:200, h:200, img:imgHouse });
        }
        // Trees
        for(let i=0;i<60;i++) {
            let x=Math.random()*WORLD_W, y=Math.random()*WORLD_W;
            if(Math.hypot(x-WORLD_W/2, y-WORLD_W/2)>600) structures.push({ x:x, y:y, w:120, h:120, img:imgTree });
        }
        // NPCs
        for(let i=0;i<5;i++) {
            npcs.push({ x:WORLD_W/2+(Math.random()-0.5)*300, y:WORLD_W/2+(Math.random()-0.5)*300, w:60, h:60, img:imgNpc, name:"Villager" });
        }
    }

    window.initExplore = initExplore;
    window.stopExplore = stopExplore;
})();