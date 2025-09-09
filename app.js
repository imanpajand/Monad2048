// --- Monad ---
const MONAD_CHAIN_ID = '8008135';
const MONAD_NETWORK_CONFIG = {
    chainId: `0x${Number(MONAD_CHAIN_ID).toString(16)}`, // '0x7A4F37'
    chainName: 'Monad Testnet',
    nativeCurrency: {
        name: 'MON',
        symbol: 'MON',
        decimals: 18,
    },
    rpcUrls: ['https://testnet.monad.xyz/'],
    blockExplorerUrls: ['https://explorer.testnet.monad.xyz/'],
};

// --- Contract Config ---
const CONTRACT_ADDRESS = "0x4Db87Ccf1b63588C157CF2adF86F33283d3A8575"; 
const ABI = [
    "function gm(string name, uint256 score) external",
    "event GM(string name, uint256 score, address player, uint256 timestamp)"
];

// --- Variables ---
let provider, signer, contract;
let currentScore = 0;
let gameOver = false;
let tileExistsPreviously = Array.from({ length: 4 }, () => Array(4).fill(false));

window.onload = async () => {
    // Load
    initGame();
    setupControls();

    // Event Listeners
    document.getElementById("scoreForm").addEventListener("submit", submitScore);
    document.getElementById("gmButton").addEventListener("click", sendGM);
    document.getElementById("leaderboardToggle").addEventListener("click", toggleLeaderboard);
    document.getElementById("connectWalletBtn").addEventListener("click", connectWallet);

    // Farcaster SDK Initialization
    try {
        if (window.sdk?.actions?.ready) {
            await window.sdk.actions.ready();
            console.log("✅ Farcaster SDK is ready.");
        }
    } catch (err) {
        console.error("❌ Farcaster SDK ready error:", err);
    }

    // Attempt to auto-connect wallet
    if (window.ethereum || window.sdk?.wallet?.getEthereumProvider) {
        // to avoid unexpected popups,
        // pre-load the leaderboard.
        loadLeaderboard();
    }
};

async function connectWallet() {
    try {
        let eth = null;
        console.log("🔍 Finding wallet provider...");

        // 1. Farcaster Frame / Base App Environment
        if (window.ethereum && window.ethereum.isFrame) {
            eth = window.ethereum;
            console.log("🟣 Base App Frame Wallet Detected");
        }
        // 2. Farcaster MiniApp on Mobile
        else if (window.sdk?.wallet?.getEthereumProvider) {
            try {
                eth = await window.sdk.wallet.getEthereumProvider();
                console.log("📱 Farcaster MiniApp Wallet Detected");
            } catch (err) {
                console.warn("⚠️ Farcaster provider error:", err);
            }
        }
        // 3. Injected Wallets 
        else if (window.ethereum?.providers?.length) {
            const injected = window.ethereum.providers.find(p => p.isMetaMask || p.isRabby || p.isPhantom);
            if (injected) {
                eth = injected;
                console.log("🌐 Injected provider (MetaMask/Rabby/Phantom) found.");
            }
        }
        // 4. Standard Injected Wallet (MetaMask)
        else if (window.ethereum) {
            eth = window.ethereum;
            console.log("🦊 Standard injected wallet detected.");
        }

        if (!eth) {
            alert("❌ هیچ کیف پولی پیدا نشد. لطفاً یک کیف پول مانند ربی یا متامسک نصب کنید.");
            throw new Error("No wallet provider found.");
        }

        // --- MONAD NETWORK SWITCH ---
        const tempProvider = new ethers.BrowserProvider(eth);
        const network = await tempProvider.getNetwork();

        if (network.chainId.toString() !== MONAD_CHAIN_ID) {
            console.log(`Current network: ${network.name} (${network.chainId}). Requesting switch to Monad...`);
            try {
                // Request to switch
                await tempProvider.send('wallet_switchEthereumChain', [{ chainId: MONAD_NETWORK_CONFIG.chainId }]);
                console.log("✅ Switched to Monad network.");
            } catch (switchError) {
                // Error chain has not been added to the wallet.
                if (switchError.code === 4902) {
                    console.log("Monad network not found in wallet. Requesting to add it...");
                    try {
                        // Request to add the Monad Testnet
                        await tempProvider.send('wallet_addEthereumChain', [MONAD_NETWORK_CONFIG]);
                        console.log("✅ Monad network added.");
                    } catch (addError) {
                        console.error("❌ Failed to add Monad network:", addError);
                        alert("امکان اضافه کردن خودکار شبکه موناد وجود ندارد. لطفاً به صورت دستی آن را اضافه کنید.");
                        return;
                    }
                } else {
                    console.error("❌ Failed to switch network:", switchError);
                    alert("لطفاً شبکه را به صورت دستی به Monad Testnet تغییر دهید.");
                    return;
                }
            }
        }
        // --- END ---
        
        // Finalize
        provider = new ethers.BrowserProvider(eth);
        await provider.send("eth_requestAccounts", []);
        signer = await provider.getSigner();
        contract = new ethers.Contract(CONTRACT_ADDRESS, ABI, signer);

        const address = await signer.getAddress();
        document.getElementById("connectWalletBtn").innerText = `✅ ${address.slice(0, 6)}...${address.slice(-4)}`;
        console.log(`✅ Wallet connected: ${address} on Monad network.`);
        
        // Load user-specific data after connection
        loadLeaderboard();

    } catch (err) {
        console.error("Connect Wallet Error:", err);
        alert("❌ اتصال کیف پول با خطا مواجه شد.");
    }
}

async function sendGM() {
    if (!contract || !signer) return alert("لطفاً ابتدا کیف پول خود را متصل کنید.");

    try {
        const tx = await contract.gm("Gm from ImanPJN", 0, { gasLimit: 100000 });
        const receipt = await tx.wait();
        console.log("GM transaction successful:", receipt);
        alert("✅ GM با موفقیت ارسال شد!");
        loadLeaderboard();
    } catch (err) {
        console.error("GM Error:", err);
        alert("❌ ارسال GM با خطا مواجه شد.");
    }
}

async function submitScore(e) {
    e.preventDefault();
    if (!contract || !signer) return alert("لطفاً ابتدا کیف پول خود را متصل کنید.");

    const name = document.getElementById("playerName").value.trim();
    if (!name) return alert("لطفاً یک نام وارد کنید.");

    try {
        const tx = await contract.gm(name, currentScore, { gasLimit: 100000 });
        const receipt = await tx.wait();
        console.log("Score submission successful:", receipt);
        alert("🎯 امتیاز شما با موفقیت در شبکه موناد ثبت شد!");
        document.getElementById("playerName").value = "";
        loadLeaderboard();
        resetGame();
    } catch (err) {
        console.error("Submit Score Error:", err);
        alert("❌ ثبت امتیاز با خطا مواجه شد.");
    }
}

async function loadLeaderboard() {
    let readProvider;
    // Use the connected wallet's provider
    if (provider) {
        readProvider = provider;
    } else {
        readProvider = new ethers.JsonRpcProvider(MONAD_NETWORK_CONFIG.rpcUrls[0]);
        console.log("Using read-only RPC for leaderboard.");
    }

    const lbDiv = document.getElementById("leaderboard");
    lbDiv.innerHTML = "<h3>🏆 Leaderboard</h3>";
    
    try {
        const readContract = new ethers.Contract(CONTRACT_ADDRESS, ABI, readProvider);
        const logs = await readContract.queryFilter("GM");

        const leaderboard = {};
        logs.forEach(log => {
            const name = log.args.name;
            const score = Number(log.args.score);
            if (score > 0) { // Only show entries with actual scores
                if (!leaderboard[name] || score > leaderboard[name]) {
                    leaderboard[name] = score;
                }
            }
        });

        const sorted = Object.entries(leaderboard).sort((a, b) => b[1] - a[1]);
        
        if (sorted.length === 0) {
            lbDiv.innerHTML += "<p>هنوز امتیازی ثبت نشده!</p>";
        } else {
            sorted.slice(0, 10).forEach(([name, score], i) => {
                lbDiv.innerHTML += `<div>${i + 1}. <strong>${name}</strong>: ${score}</div>`;
            });
        }
    } catch (error) {
        console.error("Could not load leaderboard:", error);
        lbDiv.innerHTML += "<p>خطا در بارگذاری لیدربورد.</p>";
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
  initGame();
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
