
export default function handler(req, res) {
  const text = encodeURIComponent(
    "Play fun and addictive #2048 game on Arbitrum and save your score on-chain on top the leaderboard! 🔵 🎮\nArbitrum 2048 #MiniApp by @imaan 💜 \nhttps://arb2048.vercel.app"
  );
  const url = `https://farcaster.xyz/~/compose?text=${text}`;
  res.writeHead(302, { Location: url });
  res.end();
}
