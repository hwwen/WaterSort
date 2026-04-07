/* ==========================================
   1. 全域變數與音效設定
   ========================================== */
let level = Number(localStorage.getItem("waterSortLevel")) || 1;
let tubesData = [];       // 儲存試管液體數據
let history = [];         // 撤銷紀錄
let selectedIdx = null;   // 當前選中試管
let isAnimating = false;  // 動畫鎖定
let extraTubesCount = 0;  // 本關額外救援瓶數量
let idleTimer = null;     // 10秒閒置計時器

// 僅保留倒水音效
const pourSound = new Audio('pour.wav');
pourSound.preload = 'auto';

// 20 種高對比顏色
const COLORS = [
    "#FF0000", "#00FF00", "#0000FF", "#FFFF00", "#FF00FF", 
    "#00FFFF", "#FFA500", "#800080", "#008000", "#800000", 
    "#000080", "#808000", "#FFC0CB", "#A52A2A", "#BFFFFF", 
    "#4B0082", "#F0E68C", "#D2691E", "#00AF91", "#708090"
];

// 針對相近色或深色設計的識別符號 (純色保持空白)
const SYMBOLS = [
    "", "", "", "", "", 
    "", "", "▲", "", "✖", 
    "★", "◆", "", "✚", "♒", 
    "●", "", "■", "◈", "▼"
];

/* ==========================================
   2. 遊戲初始化邏輯
   ========================================== */

function initGame() { 
    tubesData = generateLevel(level); 
    history = []; 
    selectedIdx = null; 
    extraTubesCount = 0; // 每關開始重置救援瓶數量
    render(); 
    resetIdleTimer(); 
}

function generateLevel(lvl) {
    // 每 4 關增加 1 色，最高 20 色
    let colorCount = Math.min(3 + Math.floor((lvl - 1) / 4), COLORS.length);
    let allColors = [];
    for (let i = 0; i < colorCount; i++) {
        for (let j = 0; j < 4; j++) allColors.push(i);
    }
    allColors.sort(() => Math.random() - 0.5);
    
    let newTubes = [];
    for (let i = 0; i < colorCount; i++) {
        newTubes.push(allColors.slice(i * 4, i * 4 + 4));
    }
    newTubes.push([], []); // 初始 2 個空瓶
    return newTubes;
}

/* ==========================================
   3. 判定演算法 (空間偵測與死局邏輯)
   ========================================== */

/** 判定移動是否有意義 **/
function isValidMove(from, to) {
    const f = tubesData[from], t = tubesData[to];
    if (!f || f.length === 0 || !t || t.length === 4) return false;

    const topColor = f[f.length - 1];
    let sourceContinuous = 0;
    for (let i = f.length - 1; i >= 0; i--) {
        if (f[i] === topColor) sourceContinuous++;
        else break;
    }
    const targetSpace = 4 - t.length;

    if (t.length > 0 && t[t.length - 1] !== topColor) return false;
    if (t.length === 0) return f.length !== sourceContinuous;

    if (t[t.length - 1] === topColor) {
        if (targetSpace < sourceContinuous && f.length > sourceContinuous) return false;
        return true;
    }
    return false;
}

function findValidMove() {
    for (let i = 0; i < tubesData.length; i++) {
        for (let j = 0; j < tubesData.length; j++) {
            if (i !== j && isValidMove(i, j)) return { from: i, to: j };
        }
    }
    return null;
}

/* ==========================================
   4. UI 渲染與互動系統
   ========================================== */

function render() {
    const game = document.getElementById("game");
    game.innerHTML = "";
    document.getElementById("levelText").innerText = "Level " + level;
    tubesData.forEach((tube, i) => {
        let div = document.createElement("div");
        div.className = "tube" + (selectedIdx === i ? " selected" : "");
        div.id = `tube-${i}`;
        div.onclick = () => { resetIdleTimer(); handleTubeClick(i); };
        
        tube.forEach(colorIdx => {
            let layer = document.createElement("div");
            layer.className = "layer";
            layer.style.backgroundColor = COLORS[colorIdx];
            if (SYMBOLS[colorIdx] !== "") layer.innerText = SYMBOLS[colorIdx];
            div.appendChild(layer);
        });
        game.appendChild(div);
    });
}

function resetIdleTimer() {
    document.querySelectorAll('.tube.hint').forEach(el => el.classList.remove('hint'));
    clearTimeout(idleTimer);
    if (!isAnimating) idleTimer = setTimeout(() => {
        const move = findValidMove();
        if (move) document.getElementById(`tube-${move.from}`).classList.add('hint');
    }, 10000);
}

async function handleTubeClick(i) {
    if (isAnimating) return;
    if (selectedIdx === null) {
        if (tubesData[i].length > 0) { selectedIdx = i; render(); }
    } else {
        if (selectedIdx === i) { selectedIdx = null; render(); return; }
        const f = tubesData[selectedIdx], t = tubesData[i];
        if (f && f.length > 0 && t.length < 4 && (t.length === 0 || f[f.length-1] === t[t.length-1])) {
            await animatePour(selectedIdx, i);
        } else {
            selectedIdx = tubesData[i].length > 0 ? i : null;
            render();
        }
    }
}

/** 倒水動畫邏輯 **/
/** 倒水動畫邏輯 **/
async function animatePour(fromIdx, toIdx) {
    isAnimating = true;
    clearTimeout(idleTimer);
    
    // 播放倒水音效
    pourSound.currentTime = 0;
    pourSound.play().catch(() => {});

    const fromEl = document.getElementById(`tube-${fromIdx}`);
    const toEl = document.getElementById(`tube-${toIdx}`);
    history.push(JSON.parse(JSON.stringify(tubesData)));
    
    const deltaX = toEl.getBoundingClientRect().left - fromEl.getBoundingClientRect().left;
    const deltaY = toEl.getBoundingClientRect().top - fromEl.getBoundingClientRect().top - 15;
    fromEl.style.zIndex = "100";
    fromEl.style.transform = `translate(${deltaX}px, ${deltaY}px) rotate(${deltaX > 0 ? 85 : -85}deg)`;
    
    await new Promise(r => setTimeout(r, 600));

    // 數據轉移邏輯
    let targetColor = tubesData[fromIdx][tubesData[fromIdx].length - 1];
    while (tubesData[fromIdx].length > 0 && tubesData[toIdx].length < 4 && tubesData[fromIdx][tubesData[fromIdx].length-1] === targetColor) {
        tubesData[toIdx].push(tubesData[fromIdx].pop());
    }
    
    selectedIdx = null;
    render(); 

    // --- 修正後的勝利判定邏輯 ---
    // 勝利條件：所有「有水」的管子都必須是 4 層且顏色統一。
    const isWin = tubesData.every(t => {
        if (t.length === 0) return true; // 空管沒問題
        if (t.length === 4) { // 滿管則檢查是否顏色統一
            return t.every(color => color === t[0]);
        }
        return false; // 只要有任何一管「不滿且不空」，就還沒贏
    });
    
    if (isWin) {
        // 如果贏了，直接清除計時器並跳轉，絕對不進入死局判定
        clearTimeout(idleTimer);
        setTimeout(() => { 
            level++; 
            localStorage.setItem("waterSortLevel", level); 
            initGame(); 
        }, 500);
    } else {
        // 只有在「還沒贏」的情況下，才檢查是否死局
        if (findValidMove() === null) {
            setTimeout(() => { 
                document.getElementById("modalOverlay").style.display = "flex"; 
            }, 500);
        }
    }

    isAnimating = false;
    if (!isWin) resetIdleTimer();
}


/* ==========================================
   5. 救援、撤銷與其他系統功能
   ========================================== */

document.getElementById("payBtn").onclick = () => {
    document.getElementById("modalOverlay").style.display = "none";
    setTimeout(() => {
        alert("騙你的！免費送你一個空瓶救急！🎁");
        tubesData.push([]); 
        extraTubesCount++;
        render();
        resetIdleTimer();
    }, 300);
};

document.getElementById("cancelBtn").onclick = () => { 
    document.getElementById("modalOverlay").style.display = "none"; 
    initGame(); 
};

document.getElementById("undoBtn").onclick = () => { 
    if (!isAnimating && history.length > 0) { 
        tubesData = history.pop(); 
        selectedIdx = null; 
        render(); 
        resetIdleTimer(); 
    } 
};

document.getElementById("restartBtn").onclick = () => { if (!isAnimating) initGame(); };

const secret = ["arrowup", "arrowup", "arrowdown", "arrowdown", "arrowleft", "arrowright", "arrowleft", "arrowright", "b", "a", "b", "a"];
let input = [];
window.addEventListener('keydown', (e) => {
    resetIdleTimer();
    input.push(e.key.toLowerCase());
    input = input.slice(-12);
    if (input.join(',') === secret.join(',')) document.getElementById('adminPanel').style.display = 'block';
});

document.getElementById("adminJumpBtn").onclick = () => {
    level = parseInt(document.getElementById('targetLevel').value) || 1;
    localStorage.setItem("waterSortLevel", level);
    initGame();
    document.getElementById('adminPanel').style.display = 'none';
};

initGame();
