const express = require("express");
const app = express();
const router = require("./router");
const cors = require("cors");
const errorHandler = require("./middlewares/errorHandler");
const { createServer } = require("http");
const { Server } = require("socket.io");

// Buat HTTP server dan Socket.io server 🚀
const httpServer = createServer(app);
const io = new Server(httpServer, {
  cors: {
    origin: "http://localhost:5173",
    methods: ["GET", "POST"],
    credentials: true
  }
});

// Setup middleware express 🛠️
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(cors());
app.use(router);
app.use(errorHandler);

// Simpan data game di memory (Map) 🗃️
const roomPlayers = new Map(); // Nyimpen data player di tiap room
const roomParagraphs = new Map(); // Nyimpen paragraf buat typing game
const roomReadyPlayers = new Map(); // Nyimpen player yg udah ready
const playerSockets = new Map(); // Nyimpen socket id tiap player
const drawingRooms = new Map(); // Nyimpen data room drawing game
const gameStates = new Map(); // Nyimpen state game (playing/not playing dll)
const roomPlayerCounts = new Map(); // Nyimpen jumlah player per room

// Helper function buat dapetin/bikin game state baru kalo belom ada 🎮
function getOrCreateGameState(roomId) {
  if (!gameStates.has(roomId)) {
    gameStates.set(roomId, {
      isPlaying: false,
      currentDrawer: null,
      word: null,
      scores: new Map(),
      hasStarted: false,
      timeLeft: 60,
      timerInterval: null
    });
  }
  return gameStates.get(roomId);
}

// Timer buat tiap ronde drawing game ⏲️
function startRoundTimer(roomId, io) {
  const gameState = getOrCreateGameState(roomId);

  // Reset timer kalo udah ada
  if (gameState.timerInterval) {
    clearInterval(gameState.timerInterval);
  }

  // Set timer 60 detik
  gameState.timeLeft = 60;
  io.to(roomId).emit("timer-sync", gameState.timeLeft);

  // Jalanin timer tiap detik
  gameState.timerInterval = setInterval(() => {
    gameState.timeLeft--;

    io.to(roomId).emit("timer-sync", gameState.timeLeft);

    // Kalo timer abis, stop dan kasih tau client
    if (gameState.timeLeft <= 0) {
      clearInterval(gameState.timerInterval);
      gameState.timerInterval = null;

      io.to(roomId).emit("time-up", {
        currentDrawer: gameState.currentDrawer?.name
      });
    }
  }, 1000);
}

// Tambah function buat handle countdown typing game ⏲️
function startTypingGameCountdown(roomId, io) {
  let count = 3;

  // Generate paragraf random kalo belom ada
  if (!roomParagraphs.has(roomId)) {
    const paragraph = getRandomParagraph();
    roomParagraphs.set(roomId, paragraph);
  }

  const countdownInterval = setInterval(() => {
    io.to(roomId).emit("game-countdown", count);
    count--;

    if (count < 0) {
      clearInterval(countdownInterval);
      const paragraph = roomParagraphs.get(roomId);
      console.log("Sending paragraph to room:", roomId, paragraph); // Debug log
      io.to(roomId).emit("game-start", paragraph);
    }
  }, 1000);
}

// Handle semua event socket.io 🔌
io.on("connection", (socket) => {
  let currentPlayerData = null;

  console.log("User connected 🎮", socket.id);

  // Event join room - player masuk ke room baru 🚪
  socket.on("join-room", ({ roomId, playerData }) => {
    currentPlayerData = { roomId, ...playerData };
    socket.join(roomId);

    // Bikin room baru kalo belom ada
    if (!roomPlayers.has(roomId)) {
      roomPlayers.set(roomId, new Map());
    }

    const players = roomPlayers.get(roomId);

    // Hapus data lama player (kalo reconnect)
    players.delete(playerData.name);

    // Simpen data player baru
    players.set(playerData.name, {
      ...playerData,
      socketId: socket.id
    });

    // Update jumlah player
    roomPlayerCounts.set(roomId, players.size);

    // Broadcast ke semua client
    io.emit("player-count-update", {
      roomId,
      count: players.size
    });

    const playersArray = Array.from(players.values());
    io.to(roomId).emit("players-update", playersArray);
  });

  // Event leave room - player keluar dari room 🚶
  socket.on("leave-room", ({ roomId, playerName }) => {
    if (roomPlayers.has(roomId)) {
      const players = roomPlayers.get(roomId);
      players.delete(playerName);

      if (roomReadyPlayers.has(roomId)) {
        roomReadyPlayers.get(roomId).delete(playerName);
      }

      roomPlayerCounts.set(roomId, players.size);

      io.emit("player-count-update", {
        roomId,
        count: players.size
      });

      const playersArray = Array.from(players.values());
      io.to(roomId).emit("players-update", playersArray);
      io.to(roomId).emit("player-left", { name: playerName });
    }
  });

  // Event disconnect - handle player DC 🔌
  socket.on("disconnect", () => {
    if (currentPlayerData) {
      const { roomId, name } = currentPlayerData;

      if (roomPlayers.has(roomId)) {
        const players = roomPlayers.get(roomId);
        players.delete(name);

        if (roomReadyPlayers.has(roomId)) {
          roomReadyPlayers.get(roomId).delete(name);
        }

        const newCount = players.size;
        roomPlayerCounts.set(roomId, newCount);

        io.emit("player-count-update", {
          roomId,
          count: newCount
        });

        const playersArray = Array.from(players.values());
        io.to(roomId).emit("players-update", playersArray);
        io.to(roomId).emit("player-left", { name });

        // Bersihin room kalo udah kosong
        if (newCount === 0) {
          roomPlayers.delete(roomId);
          roomPlayerCounts.delete(roomId);
          roomParagraphs.delete(roomId);
          roomReadyPlayers.delete(roomId);
        }
      }
    }
    console.log("User disconnected 👋", socket.id);
  });

  // Event typing game - update progress typing player ⌨️
  socket.on("typing-progress", ({ roomId, playerData }) => {
    if (roomPlayers.has(roomId)) {
      roomPlayers.get(roomId).set(playerData.name, {
        ...playerData,
        socketId: socket.id
      });
    }
    socket.to(roomId).emit("player-progress", playerData);
  });

  // Event game start 🎮
  socket.on("game-started", (roomId) => {
    io.to(roomId).emit("start-game");
  });

  // Event player selesai typing ✅
  socket.on("player-finished", ({ roomId, playerData }) => {
    io.to(roomId).emit("player-finished", playerData);
  });

  // Event request paragraf baru 📝
  socket.on("request-paragraph", (roomId) => {
    let paragraph = roomParagraphs.get(roomId);

    // Generate paragraf baru kalo belom ada
    if (!paragraph) {
      paragraph = getRandomParagraph();
      roomParagraphs.set(roomId, paragraph);
    }

    console.log("Sending paragraph on request:", roomId, paragraph); // Debug log
    socket.emit("current-paragraph", paragraph);
  });

  // Event new game - mulai game baru dengan paragraf baru 🆕
  socket.on("new-game", ({ roomId, paragraph }) => {
    roomParagraphs.set(roomId, paragraph);
    io.to(roomId).emit("new-paragraph", paragraph);
  });

  // Event player ready - handle player siap main ✋
  socket.on("player-ready", ({ roomId, playerName }) => {
    console.log("Player ready received:", playerName, "for room:", roomId);

    // Cek apakah ini room drawing atau typing
    const isDrawingRoom = drawingRooms.has(roomId);

    if (!roomReadyPlayers.has(roomId)) {
      roomReadyPlayers.set(roomId, new Set());
    }

    const readyPlayers = roomReadyPlayers.get(roomId);
    readyPlayers.add(playerName);

    io.to(roomId).emit("player-ready", { playerName });

    if (isDrawingRoom) {
      // Logic untuk drawing game
      const gameState = getOrCreateGameState(roomId);
      if (!gameState.hasStarted) {
        const players = drawingRooms.get(roomId);
        const totalPlayers = players?.size || 0;

        if (readyPlayers.size === totalPlayers && totalPlayers >= 2) {
          startGameCountdown(roomId, io);
        }
      }
    } else {
      // Logic untuk typing game
      const players = roomPlayers.get(roomId);
      if (players && readyPlayers.size === players.size && players.size >= 2) {
        startTypingGameCountdown(roomId, io);
      }
    }
  });

  // Event player unready - handle player batal siap 🤚
  socket.on("player-unready", ({ roomId, playerName }) => {
    console.log("Player unready received:", playerName, "for room:", roomId);

    const isDrawingRoom = drawingRooms.has(roomId);
    const gameState = isDrawingRoom ? gameStates.get(roomId) : null;

    if ((!isDrawingRoom || !gameState?.isPlaying) && roomReadyPlayers.has(roomId)) {
      roomReadyPlayers.get(roomId).delete(playerName);
      console.log("Current ready players:", Array.from(roomReadyPlayers.get(roomId)));
      io.to(roomId).emit("player-unready", { playerName });
    }
  });

  // Event game finish - handle game selesai 🏁
  socket.on("game-finish", ({ roomId }) => {
    const isDrawingRoom = drawingRooms.has(roomId);

    if (isDrawingRoom) {
      const gameState = getOrCreateGameState(roomId);
      gameState.isPlaying = false;
      gameState.hasStarted = false;
      gameState.currentDrawer = null;
      gameState.word = null;
    }

    roomReadyPlayers.set(roomId, new Set());
    io.to(roomId).emit("game-reset");
  });

  // Event join drawing room - handle player masuk ke room drawing 🎨
  socket.on("join-drawing-room", ({ roomId, playerData }) => {
    socket.join(roomId);

    if (!drawingRooms.has(roomId)) {
      drawingRooms.set(roomId, new Map());
    }

    const players = drawingRooms.get(roomId);
    playerData.socketId = socket.id;
    playerData.score = playerData.score || 0; // Pastikan score diinisialisasi
    players.set(playerData.name, playerData);

    roomPlayerCounts.set(roomId, players.size);

    io.emit("player-count-update", {
      roomId,
      count: players.size
    });

    const gameState = getOrCreateGameState(roomId);

    // Sync state game ke player baru
    socket.emit("game-state-sync", {
      isPlaying: gameState.isPlaying,
      currentDrawer: gameState.currentDrawer,
      word: gameState.word,
      hasStarted: gameState.hasStarted,
      timeLeft: gameState.timeLeft
    });

    const readyPlayers = Array.from(roomReadyPlayers.get(roomId) || new Set());
    socket.emit("ready-players-sync", readyPlayers);

    io.to(roomId).emit("player-joined", playerData);
    io.to(roomId).emit("drawing-players-update", Array.from(players.values()));
  });

  // Event select word - handle pemilihan kata untuk digambar 📝
  socket.on("select-word", ({ roomId, word, drawer }) => {
    const gameState = getOrCreateGameState(roomId);
    if (gameState && gameState.currentDrawer?.name === drawer) {
      gameState.word = word;

      startRoundTimer(roomId, io);

      io.to(roomId).emit("word-selected", {
        word,
        drawer
      });

      io.to(roomId).emit("game-state-update", {
        currentDrawer: gameState.currentDrawer,
        word: word
      });
    }
  });

  // Event next turn - handle pergantian giliran gambar 🔄
  socket.on("next-turn", ({ roomId }) => {
    console.log("Next turn requested for room:", roomId);

    const players = drawingRooms.get(roomId);
    const gameState = gameStates.get(roomId);

    if (players && gameState?.isPlaying) {
      const playersArray = Array.from(players.values());
      const currentIndex = playersArray.findIndex(
        p => p.name === gameState.currentDrawer?.name
      );

      const nextIndex = (currentIndex + 1) % playersArray.length;
      const nextDrawer = playersArray[nextIndex];

      if (nextDrawer) {
        console.log("Moving to next drawer:", nextDrawer.name);

        gameState.currentDrawer = nextDrawer;
        gameState.word = null;

        io.to(roomId).emit("canvas-clear");

        io.to(roomId).emit("reset-timer");

        io.to(roomId).emit("game-state-update", {
          currentDrawer: nextDrawer,
          word: null
        });
      }
    }
  });

  // Event drawing data - handle data gambar realtime 🖌️
  socket.on("drawing-data", ({ roomId, ...drawingData }) => {
    socket.to(roomId).emit("drawing-data", drawingData);
  });

  // Event chat drawing - handle chat di game drawing 💭
  socket.on("drawing-chat", ({ roomId, messageData, playerName, isCorrect }) => {
    if (drawingRooms.has(roomId)) {
      const players = drawingRooms.get(roomId);
      const player = players.get(playerName);

      // Update score kalo jawaban bener
      if (isCorrect && player) {
        if (!player.score) player.score = 0; // Pastikan score ada
        player.score += 15; // Nambah 15 point
        players.set(playerName, player);

        console.log(`Player ${playerName} score updated to: ${player.score}`); // Debug log

        // Broadcast update player ke semua client
        io.to(roomId).emit("drawing-players-update",
          Array.from(players.values())
        );
      }

      // Broadcast chat message
      io.to(roomId).emit("drawing-chat", messageData);
    }
  });

  // Event clear canvas - handle clear canvas 🧹
  socket.on("canvas-clear", ({ roomId }) => {
    const gameState = getOrCreateGameState(roomId);

    // Cek apakah yang ngereset adalah current drawer
    if (gameState.currentDrawer?.socketId === socket.id) {
      socket.to(roomId).emit("canvas-clear");
    }
  });

  // Event leave drawing room - handle player keluar dari room drawing 🚪
  socket.on("leave-drawing-room", ({ roomId, playerName }) => {
    if (drawingRooms.has(roomId)) {
      const players = drawingRooms.get(roomId);
      players.delete(playerName);

      const newCount = players.size;
      roomPlayerCounts.set(roomId, newCount);

      io.emit("player-count-update", {
        roomId,
        count: newCount
      });

      io.to(roomId).emit("player-left", { name: playerName });
      io.to(roomId).emit("drawing-players-update",
        Array.from(players.values())
      );

      // Bersihin room kalo udah kosong
      if (newCount === 0) {
        drawingRooms.delete(roomId);
        roomPlayerCounts.delete(roomId);
        gameStates.delete(roomId);
        roomReadyPlayers.delete(roomId);
      }
    }
  });

  // Event time up - handle waktu habis ⏰
  socket.on("time-up", ({ roomId, currentDrawer }) => {
    console.log("⏰ Time up event received for room:", roomId, "drawer:", currentDrawer);

    socket.emit("time-up-ack", { received: true, currentDrawer });

    const players = drawingRooms.get(roomId);
    const currentGameState = gameStates.get(roomId);

    console.log("Current game state:", {
      hasPlayers: !!players,
      isPlaying: currentGameState?.isPlaying,
      currentDrawer: currentGameState?.currentDrawer?.name
    });

    if (players && currentGameState?.isPlaying) {
      const playersArray = Array.from(players.values());
      console.log("Players in room:", playersArray.map(p => p.name));

      const currentIndex = playersArray.findIndex(
        p => p.name === currentDrawer
      );
      console.log("Current drawer index:", currentIndex);

      const nextIndex = (currentIndex + 1) % playersArray.length;
      const nextDrawer = playersArray[nextIndex];

      if (nextDrawer) {
        console.log("Moving to next drawer:", nextDrawer.name);

        currentGameState.currentDrawer = nextDrawer;
        currentGameState.word = null;

        io.to(roomId).emit("canvas-clear");
        console.log("Canvas clear emitted");

        io.to(roomId).emit("reset-timer");
        console.log("Timer reset emitted");

        io.to(roomId).emit("game-state-update", {
          currentDrawer: nextDrawer,
          word: null
        });
        console.log("Game state update emitted for new drawer:", nextDrawer.name);
      }
    }
  });

  console.log("🔌 New socket connected:", socket.id);

  socket.on("disconnect", () => {
    console.log("🔌 Socket disconnected:", socket.id);
  });

  // Event request room counts - handle request jumlah player tiap room 👥
  socket.on("request-room-counts", () => {
    const counts = {};
    roomPlayerCounts.forEach((count, roomId) => {
      counts[roomId] = count;
    });
    socket.emit("initial-room-counts", counts);
  });
});

// Helper function buat dapetin paragraf random 📝
function getRandomParagraph() {
  const paragraphs = [
    "Kucing berlari mengejar bola merah di taman yang indah sambil melompat-lompat dengan riang gembira.",
    "Awan putih berarak di langit biru, burung-burung berkicau merdu menyambut pagi yang cerah.",
    "Pohon mangga di halaman rumah berbuah lebat, anak-anak berebut memanjat untuk memetik buahnya.",
    "Pantai yang tenang dihiasi ombak kecil, pasir putih berkilau ditimpa sinar matahari sore.",
    "Gunung tinggi menjulang ke langit, kabut tipis menyelimuti puncaknya yang dingin dan sejuk."
  ];
  return paragraphs[Math.floor(Math.random() * paragraphs.length)];
}

// Helper function buat mulai countdown game 🕒
function startGameCountdown(roomId, io) {
  const gameState = getOrCreateGameState(roomId);
  if (gameState.hasStarted) return;

  gameState.hasStarted = true;
  let count = 3;

  io.to(roomId).emit("game-countdown", count);

  const countdownInterval = setInterval(() => {
    count--;

    if (count > 0) {
      io.to(roomId).emit("game-countdown", count);
    } else {
      clearInterval(countdownInterval);

      gameState.isPlaying = true;
      const players = Array.from(drawingRooms.get(roomId).values());
      gameState.currentDrawer = players[0];

      io.to(roomId).emit("game-start");
      io.to(roomId).emit("game-state-update", {
        currentDrawer: gameState.currentDrawer,
        word: null
      });

      startRoundTimer(roomId, io);
    }
  }, 1000);
}

module.exports = { app, httpServer };