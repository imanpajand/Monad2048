const MONAD_CHAIN_ID = '10143';

const CONTRACT_ADDRESS = "0x4Db87Ccf1b63588C157CF2adF86F33283d3A8575"; 
const ABI = [
    "function gm(string name, uint256 score) external",
    "event GM(string name, uint256 score, address player, uint256 timestamp)"
];

let provider, signer, contract;
let currentScore = 0;
let gameOver = false;
let tileExistsPreviously = Array.from({ length: 4 }, () => Array(4).fill(false));

window.onload = async () => {
    initGame();
    setupControls();

    // اینجا دکمه ریست با آیدی "resetGameBtn" به تابع resetGame متصل می شود
    document.getElementById("resetGameBtn").addEventListener("click", () => {
        resetGame();
    });
    
    document.getElementById("scoreForm").addEventListener("submit", submitScore);
    document.getElementById("gmButton").addEventListener("click", sendGM);
    document.getElementById("leaderboardToggle").addEventListener("click", () => {
        resetGame();
    });
    document.getElementById("connectWalletBtn").addEventListener("click", connectWallet);

    // Farcaster SDK
  try {
    if (window.sdk?.actions?.ready) {
      await window.sdk.actions.ready();
      console.log("✅ sdk.actions.ready() called");

      // --- Add Mini App Prompt for Farcaster only ---
      if (window.sdk?.actions?.addMiniApp) {
        try {
          await window.sdk.actions.addMiniApp();
          console.log("ℹ️ Mini App add prompt triggered (Farcaster only)");
        } catch (err) {
          if (err?.name === "RejectedByUser") {
            console.log("ℹ️ User declined to add Mini App");
          } else if (err?.name === "InvalidDomainManifestJson") {
            console.warn("⚠️ Mini App not added: domain or manifest issue");
          } else {
            console.error("❌ Unexpected Mini App error:", err);
          }
        }
      }
    }
  } catch (err) {
    console.error("❌ sdk ready error:", err);
  }


  await connectWallet();
};


async function connectWallet() {
  try {
    console.log("🔍 Searching for wallet provider...");
    let eth = null;

    // --- 1. Injected Wallets (MetaMask, Rabby) ---
    if (window.ethereum?.providers?.length) {
      eth = window.ethereum.providers.find(p => p.isMetaMask || p.isRabby);
      if (eth) console.log("🌐 Injected provider found:", eth.isMetaMask ? "MetaMask" : "Rabby");
    }
    if (!eth && window.ethereum) {
      eth = window.ethereum;
      console.log("🦊 Standard injected wallet detected.");
    }

    // --- 2. Farcaster MiniApp Wallet ---
    if (!eth && window.sdk?.wallet?.getEthereumProvider) {
      try {
        eth = await window.sdk.wallet.getEthereumProvider();
        console.log("📱 Farcaster MiniApp Wallet Detected");
      } catch (err) {
        console.warn("⚠️ Farcaster provider error:", err);
      }
    }

    // --- 3. No wallet found: use read-only provider ---
    if (!eth) {
      console.warn("⚠️ No wallet found — falling back to read-only provider.");
      provider = new ethers.JsonRpcProvider("https://rpc.ankr.com/monad_testnet");
      // loadLeaderboard(); // 
      notify("کیف پول پیدا نشد؛ د.", { level: 'warn' });
      return;
    }

    // --- ایجاد provider ---
    provider = new ethers.BrowserProvider(eth);
    try {
      await provider.send("eth_requestAccounts", []);
    } catch (err) {
      // 
      console.error("eth_requestAccounts rejected or failed:", err);
      notify("دسترسی به کیف پول داده نشد.", { level: 'warn' });
      return;
    }

    // --- Auto Switch به Monad ---
    try {
      await provider.send("wallet_switchEthereumChain", [
        { chainId: `0x${parseInt(MONAD_CHAIN_ID).toString(16)}` }
      ]);
      console.log("✅ Switched to Monad Testnet");
    } catch (switchError) {
      //
      console.warn("⚠️ Wallet switch failed (maybe already on network or unsupported):", switchError);
    }

    // --- signer ---
    signer = await provider.getSigner();
    contract = new ethers.Contract(CONTRACT_ADDRESS, ABI, signer);

    const address = await signer.getAddress();
    document.getElementById("connectWalletBtn").innerText =
      `✅ ${address.slice(0, 6)}...${address.slice(-4)}`;
    console.log(`✅ Wallet connected: ${address}`);

    // notify success
    notify("کیف پول متصل شد.", { level: 'success' });

  } catch (err) {
    console.error("Connect Wallet Error:", err);
    // بدون alert
    notify("خطا در اتصال کیف پول (کنسول را بررسی کنید).", { level: 'error' });
  }
}

async function sendGM() {
  if (!contract || !signer) {
    notify("ابتدا کیف پول را متصل کنید.", { level: 'warn' });
    return;
  }

  try {
    const tx = await contract.gm("Gm from ImanPJN", 0, { gasLimit: 100000 });
    console.log("tx sent:", tx);
    const receipt = await tx.wait();
    console.log("tx receipt:", receipt);
    if (receipt && receipt.status === 1) {
      notify("GM با موفقیت ارسال شد.", { level: 'success' });
      // loadLeaderboard(); //
    } else {
      console.error("Transaction failed or reverted:", receipt);
      notify("تراکنش انجام نشد (مشکل در شبکه یا قرارداد).", { level: 'error' });
    }
  } catch (err) {
    console.error("GM Error:", err);
    notify("خطا هنگام ارسال GM (کنسول را بررسی کنید).", { level: 'error' });
  }
}

async function submitScore(e) {
  e.preventDefault();
  if (!contract || !signer) {
    notify("ابتدا کیف پول را متصل کنید.", { level: 'warn' });
    return;
  }

  const name = document.getElementById("playerName").value.trim();
  if (!name) {
    notify("لطفاً یک نام وارد کنید.", { level: 'warn' });
    return;
  }

  try {
    const tx = await contract.gm(name, currentScore, { gasLimit: 100000 });
    console.log("tx sent:", tx);
    const receipt = await tx.wait();
    console.log("tx receipt:", receipt);

    if (receipt && receipt.status === 1) {
      notify("امتیاز شما با موفقیت ثبت شد.", { level: 'success' });
      document.getElementById("playerName").value = "";

      // --- بعد از 2.5 ثانیه بازی ریست شود ---
      setTimeout(() => {
        resetGame();
      }, 2500);

    } else {
      console.error("Transaction failed or reverted:", receipt);
      notify("ثبت امتیاز انجام نشد (تراکنش برگشت خورد).", { level: 'error' });
    }
  } catch (err) {
    console.error("Submit Score Error:", err);
    notify("خطا هنگام ثبت امتیاز (کنسول را بررسی کنید).", { level: 'error' });
  }
}


function toggleLeaderboard() {
    const lb = document.getElementById("leaderboard");
    const btn = document.getElementById("leaderboardToggle");
    if (lb.style.display === "none") {
        loadLeaderboard();
        lb.style.display = "block";
        btn.innerText = "Hide Leaderboard";
    } else {
        lb.style.display = "none";
        btn.innerText = "Show Leaderboard";
    }
}


// ----------------- GAME LOGIC ------------------

function updateScoreDisplay() {
  const scoreEl = document.getElementById("score-display");
  if (scoreEl) {
    scoreEl.innerText = `Score: ${currentScore}`;
  }
}

let grid = [];

function initGame() {
  grid = Array.from({ length: 4 }, () => Array(4).fill(0));
  tileExistsPreviously = Array.from({ length: 4 }, () => Array(4).fill(false));
  addRandomTile();
  addRandomTile();
  currentScore = 0;
  gameOver = false;
  updateGameBoard();
  updateScoreDisplay();
}

function resetGame() {
  gameOver = false;
  currentScore = 0;

  // ریست grid
  grid = Array.from({ length: 4 }, () => Array(4).fill(0));

  // اضافه کردن دو کاشی اولیه
  addRandomTile();
  addRandomTile();

  // هماهنگ کردن tileExistsPreviously با وضعیت grid
  tileExistsPreviously = grid.map(row => row.map(cell => cell > 0));

  // آپدیت UI
  updateGameBoard();
  updateScoreDisplay();
}


function setupControls() {
  window.onkeydown = (e) => {
    if (gameOver) return;
    if (["ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight"].includes(e.key)) {
      e.preventDefault();
      move(e.key);
    }
  };
  const gameBoard = document.getElementById("game");
  let startX, startY;
  const touchOptions = { passive: false };
  gameBoard.addEventListener("touchstart", (e) => {
    startX = e.touches[0].clientX;
    startY = e.touches[0].clientY;
  }, touchOptions);
  gameBoard.addEventListener("touchmove", (e) => {
    e.preventDefault();
  }, touchOptions);
  gameBoard.addEventListener("touchend", (e) => {
    if (gameOver) return;
    const dx = e.changedTouches[0].clientX - startX;
    const dy = e.changedTouches[0].clientY - startY;
    if (Math.abs(dx) > Math.abs(dy)) {
      move(dx > 0 ? "ArrowRight" : "ArrowLeft");
    } else {
      move(dy > 0 ? "ArrowDown" : "ArrowUp");
    }
  });
}

function addRandomTile() {
  const empty = [];
  grid.forEach((row, r) =>
    row.forEach((val, c) => {
      if (val === 0) empty.push([r, c]);
    })
  );
  if (empty.length === 0) return;
  const [r, c] = empty[Math.floor(Math.random() * empty.length)];
  grid[r][c] = Math.random() < 0.9 ? 2 : 4;
}

function updateGameBoard() {
  const gameDiv = document.getElementById("game");
  gameDiv.innerHTML = "";
  grid.forEach((row, r) =>
    row.forEach((val, c) => {
      const tile = document.createElement("div");
      const isNew = val > 0 && !tileExistsPreviously[r][c];
      tile.className = `tile tile-${val}${isNew ? ' new' : ''}`;
      tile.setAttribute("data-value", val > 0 ? val : "");
      gameDiv.appendChild(tile);
    })
  );
}

function move(direction) {
  const clone = JSON.parse(JSON.stringify(grid));
  const merged = Array.from({ length: 4 }, () => Array(4).fill(false));
  const combine = (row, rIndex) => {
    let arr = row.filter(Boolean);
    for (let i = 0; i < arr.length - 1; i++) {
      if (arr[i] === arr[i + 1]) {
        arr[i] *= 2;
        currentScore += arr[i];
        arr[i + 1] = 0;
        merged[rIndex][i] = true;
      }
    }
    return arr.filter(Boolean).concat(Array(4 - arr.filter(Boolean).length).fill(0));
  };
  for (let i = 0; i < 4; i++) {
    let row;
    switch (direction) {
      case "ArrowLeft":
        grid[i] = combine(grid[i], i);
        break;
      case "ArrowRight":
        row = grid[i].slice().reverse();
        grid[i] = combine(row, i).reverse();
        break;
      case "ArrowUp":
        row = grid.map(r => r[i]);
        const colUp = combine(row, i);
        grid.forEach((r, j) => (r[i] = colUp[j]));
        break;
      case "ArrowDown":
        row = grid.map(r => r[i]).reverse();
        const colDown = combine(row, i).reverse();
        grid.forEach((r, j) => (r[i] = colDown[j]));
        break;
    }
  }
  if (JSON.stringify(grid) !== JSON.stringify(clone)) {
    tileExistsPreviously = clone.map(row => row.map(cell => cell > 0));
    addRandomTile();
    updateGameBoard();
    const tiles = document.querySelectorAll('.tile');
    let index = 0;
    grid.forEach((row, r) =>
      row.forEach((val, c) => {
        if (val !== 0 && merged[r][c]) {
          tiles[index].classList.add('merge');
        }
        index++;
      })
    );
    updateScoreDisplay();
    if (!canMove()) {
      gameOver = true;
      alert("💀 متاسفانه Game Over شدی! اما میتونی امتیازتو ثبت کنی.");
    }
  }
}

function canMove() {
  for (let r = 0; r < 4; r++) {
    for (let c = 0; c < 4; c++) {
      if (grid[r][c] === 0) return true;
      if (c < 3 && grid[r][c] === grid[r][c + 1]) return true;
      if (r < 3 && grid[r][c] === grid[r + 1][c]) return true;
    }
  }
  return false;
}
