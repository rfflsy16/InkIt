import { useState, useEffect } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { io } from "socket.io-client";
import foxAvatar from "../assets/fox.png";
import axios from "axios";

export default function TypingPage({ base_url }) {
  const location = useLocation();
  const navigate = useNavigate();
  const { name, roomId } = location.state || {};
  const [socket, setSocket] = useState(null);
  const [players, setPlayers] = useState([]);
  const [paragraphs, setParagraphs] = useState([]);
  const [text, setText] = useState("");
  const [userInput, setUserInput] = useState("");
  const [startTime, setStartTime] = useState(null);
  const [elapsedTime, setElapsedTime] = useState(0);
  const [isGameActive, setIsGameActive] = useState(false);
  const [cpm, setCpm] = useState(0);
  const [totalErrors, setTotalErrors] = useState(0);
  const [readyPlayers, setReadyPlayers] = useState(new Set());
  const [isReady, setIsReady] = useState(false);
  const [countdown, setCountdown] = useState(null);
  const [gameResult, setGameResult] = useState(null);
  const [typoWords, setTypoWords] = useState([]);

  useEffect(() => {
    const fetchParagraphs = async () => {
      try {
        const { data } = await axios.get(`${base_url}/paragraphs`);
        setParagraphs(data);
        if (data.length > 0) {
          const randomParagraph = data[Math.floor(Math.random() * data.length)].paragraph;
          setText(randomParagraph);
        }
      } catch (error) {
        console.error("Error fetching paragraphs:", error);
      }
    };
    fetchParagraphs();
  }, [base_url]);

  useEffect(() => {
    const newSocket = io(base_url);
    setSocket(newSocket);

    if (roomId) {
      newSocket.emit("join-room", {
        roomId,
        playerData: {
          id: name,
          name: name,
          cpm: 0,
          progress: 0,
          isCurrentPlayer: true
        }
      });
      newSocket.emit("request-paragraph", roomId);
    }

    return () => newSocket.disconnect();
  }, [base_url, roomId, name]);

  useEffect(() => {
    if (!socket) return;

    socket.on("players-update", (playersList) => {
      const filteredPlayers = playersList.filter(p =>
        p.name !== name || p.socketId === socket.id
      );
      setPlayers(filteredPlayers);
    });

    socket.on("player-left", ({ name: leftPlayerName }) => {
      setPlayers(prev => prev.filter(p => p.name !== leftPlayerName));
      setReadyPlayers(prev => {
        const newSet = new Set(prev);
        newSet.delete(leftPlayerName);
        return newSet;
      });
    });

    socket.on("player-joined", (playerData) => {
      setPlayers(prev => [...prev, playerData]);
    });

    socket.on("player-progress", (playerData) => {
      setPlayers(prev => {
        const playerIndex = prev.findIndex(p => p.name === playerData.name);
        if (playerIndex === -1) return [...prev, playerData];
        const newPlayers = [...prev];
        newPlayers[playerIndex] = playerData;
        return newPlayers;
      });
    });

    socket.on("player-ready", ({ playerName }) => {
      setReadyPlayers(prev => new Set([...prev, playerName]));
    });

    socket.on("game-countdown", (count) => {
      setCountdown(count);
    });

    socket.on("game-start", (paragraph) => {
      setCountdown(null);
      setText(paragraph);
      setUserInput("");
      setIsReady(false);
      setReadyPlayers(new Set());
      setStartTime(new Date());
      setIsGameActive(true);
      setTotalErrors(0);
      setCpm(0);
      setElapsedTime(0);
    });

    socket.on("game-reset", () => {
      setIsGameActive(false);
      setIsReady(false);
      setReadyPlayers(new Set());
      setCountdown(null);
    });

    socket.on("player-unready", ({ playerName }) => {
      setReadyPlayers(prev => {
        const newSet = new Set(prev);
        newSet.delete(playerName);
        return newSet;
      });
    });

    return () => {
      socket.off("players-update");
      socket.off("player-joined");
      socket.off("player-progress");
      socket.off("player-left");
      socket.off("player-ready");
      socket.off("game-countdown");
      socket.off("game-start");
      socket.off("game-reset");
      socket.off("player-unready");
    };
  }, [socket, name]);

  useEffect(() => {
    return () => {
      if (socket && roomId && name) {
        socket.emit("leave-room", { roomId, playerName: name });
        socket.disconnect();
      }
    };
  }, [socket, roomId, name]);

  useEffect(() => {
    const handleKeyPress = (e) => {
      if (!isGameActive) return;

      if (e.key.length === 1 || e.key === "Backspace") {
        e.preventDefault();

        setUserInput((prev) => {
          let newInput = prev;

          if (e.key === "Backspace") {
            if (prev.length > 0) {
              newInput = prev.slice(0, -1);
            }
          }
          else if (prev.length < text.length) {
            newInput = prev + e.key;

            if (e.key !== text[prev.length]) {
              setTotalErrors((prev) => prev + 1);

              const words = text.split(' ');
              let charCount = 0;
              let currentWordIndex = 0;

              for (let i = 0; i < words.length; i++) {
                charCount += words[i].length + 1;
                if (charCount > prev.length) {
                  currentWordIndex = i;
                  break;
                }
              }

              setTypoWords(prev => Array.from(new Set([...prev, words[currentWordIndex]])));
            }
          }

          return newInput;
        });
      }
    };

    window.addEventListener("keydown", handleKeyPress);
    return () => window.removeEventListener("keydown", handleKeyPress);
  }, [isGameActive, text]);

  useEffect(() => {
    let interval;
    if (isGameActive && startTime) {
      interval = setInterval(() => {
        const currentTime = new Date();
        const timeElapsed = (currentTime - startTime) / 1000;
        setElapsedTime(timeElapsed);

        const correctCharacters = userInput.split('').filter((char, index) => char === text[index]).length;
        const minutes = timeElapsed / 60;
        const cpmValue = Math.round(correctCharacters / minutes);
        setCpm(cpmValue || 0);

        if (socket) {
          socket.emit("typing-progress", {
            roomId,
            playerData: {
              id: name,
              name: name,
              cpm: cpmValue || 0,
              progress: calculateProgress(),
              isCurrentPlayer: true
            }
          });
        }

        if (timeElapsed >= 60) {
          setIsGameActive(false);
          setGameResult("timeout");
          clearInterval(interval);
          return;
        }

        if (userInput.length === text.length) {
          setIsGameActive(false);
          setGameResult("win");
          if (socket) {
            socket.emit("player-finished", {
              roomId,
              playerData: {
                id: socket.id,
                name: name || "Anonymous",
                cpm: cpmValue || 0,
                progress: 100,
                isCurrentPlayer: false
              }
            });
          }
          clearInterval(interval);
        }
      }, 100);
    }
    return () => clearInterval(interval);
  }, [isGameActive, startTime, userInput, socket, roomId, name, text]);

  const startGame = () => {
    if (!paragraphs.length) return;

    const randomParagraph = paragraphs[Math.floor(Math.random() * paragraphs.length)].paragraph;

    if (socket) {
      socket.emit("new-game", {
        roomId,
        paragraph: randomParagraph
      });
    }

    setText(randomParagraph);
    setUserInput("");
    setElapsedTime(0);
    setCpm(0);
    setStartTime(new Date());
    setIsGameActive(true);
    setTotalErrors(0);
  };

  const getCharacterStyle = (index) => {
    let style = "inline-block ";

    if (index < userInput.length) {
      style += userInput[index] === text[index]
        ? "text-green-600"
        : "text-red-600 bg-red-100";
    } else {
      style += "text-gray-900";
    }

    if (index === userInput.length) {
      style += " border-l-2 border-black animate-pulse";
    }

    return style;
  };

  const calculateProgress = () => {
    if (!text.length) return 0;
    const correctCharacters = userInput.split('')
      .filter((char, index) => char === text[index])
      .length;
    return Math.round((correctCharacters / text.length) * 100);
  };

  const getPlayers = () => {
    const otherPlayers = players.filter(p => p.name !== name);

    const currentPlayer = {
      id: socket?.id,
      name: name || "You",
      cpm: cpm,
      progress: calculateProgress(),
      isCurrentPlayer: true,
    };

    return [currentPlayer, ...otherPlayers];
  };

  const handleStartClick = () => {
    if (!isReady) {
      setIsReady(true);
      socket.emit("player-ready", { roomId, playerName: name });
    } else {
      setIsReady(false);
      socket.emit("player-unready", { roomId, playerName: name });
    }
  };

  const allPlayersReady = players.length > 0 &&
    readyPlayers.size === players.length;

  const resetGame = () => {
    setGameResult(null);
    setIsReady(false);
    setUserInput("");
    setElapsedTime(0);
    setCpm(0);
    setTotalErrors(0);
    setStartTime(null);
    setIsGameActive(false);
    setTypoWords([]);

    if (paragraphs.length > 0) {
      const randomParagraph =
        paragraphs[Math.floor(Math.random() * paragraphs.length)].paragraph;
      setText(randomParagraph);
    }

    if (socket) {
      socket.emit("game-reset", { roomId });
    }

    setReadyPlayers(new Set());
  };

  return (
    <div className="min-h-screen bg-[#A3C4C9] p-4 lg:p-8">
      <div className="flex items-center justify-between mb-4 lg:mb-8 max-w-[1400px] mx-auto">
        <button
          onClick={() => navigate("/")}
          className="bg-red-400 hover:bg-red-500 text-white px-4 py-2 rounded-lg border-4 border-black font-bold"
        >
          ← Kembali
        </button>

        <h1
          className="text-2xl lg:text-3xl font-bold"
          style={{ fontFamily: '"Press Start 2P", sans-serif' }}
        >
          Type Race!
        </h1>

        <div className="w-[100px]"></div>
      </div>

      <div className="max-w-[1400px] mx-auto">
        <div className="bg-blue-200 p-4 rounded-lg border-4 border-black mb-4">
          <div className="flex flex-col gap-3">
            {getPlayers().map((player) => (
              <div
                key={player.id}
                className={`bg-white p-3 rounded-lg border-2 border-black ${player.isCurrentPlayer ? "ring-2 ring-yellow-400" : ""
                  }`}
              >
                <div className="flex items-center gap-3">
                  <img
                    src={foxAvatar}
                    alt="avatar"
                    className="w-10 h-10 rounded-full border-2 border-black"
                  />
                  <div className="flex-1">
                    <div className="flex justify-between items-center">
                      <p className="font-bold">{player.name}</p>
                      <p className="text-sm font-mono">{player.cpm} CPM</p>
                    </div>
                    <div className="w-full bg-gray-200 rounded-full h-6 mt-1 relative">
                      <div
                        className="bg-green-500 h-full rounded-full transition-all duration-300 relative"
                        style={{ width: `${player.progress}%` }}
                      >
                        <div className="absolute -right-4 -top-1 transform -translate-y-1/4">
                          <span
                            className={`text-xl ${player.isCurrentPlayer ? "scale-125" : ""
                              }`}
                          >
                            🚗
                          </span>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="bg-white p-6 rounded-lg border-4 border-black">
          <div className="flex justify-between mb-4">
            <div className="space-x-4">
              {countdown ? (
                <span className="text-2xl font-bold animate-bounce">
                  Starting in {countdown}...
                </span>
              ) : (
                <>
                  <span className="text-lg font-bold">
                    {isGameActive
                      ? `Time: ${elapsedTime.toFixed(2)}s`
                      : `Last Time: ${elapsedTime.toFixed(2)}s`}
                  </span>
                  <span className="text-lg font-bold font-mono">CPM: {cpm}</span>
                  <span className="text-lg font-bold font-mono text-red-600">
                    Kesalahan: {totalErrors}
                  </span>
                </>
              )}
            </div>
            <button
              onClick={handleStartClick}
              disabled={isGameActive || countdown}
              className={`
                px-4 py-2 rounded-lg border-4 border-black font-bold
                ${isGameActive
                  ? 'bg-green-500'
                  : countdown
                    ? 'bg-yellow-500 animate-pulse'
                    : isReady
                      ? 'bg-yellow-400'
                      : 'bg-blue-500 hover:bg-blue-600'
                }
              `}
            >
              {isGameActive
                ? "Game in Progress..."
                : countdown
                  ? `Starting in ${countdown}...`
                  : isReady
                    ? `Waiting (${readyPlayers.size}/${players.length})`
                    : "Ready?"
              }
            </button>
          </div>

          <div className="bg-gray-100 p-6 rounded-lg border-4 border-black">
            <div className="font-mono text-xl leading-relaxed overflow-x-auto whitespace-pre">
              {text.split("").map((char, index) => (
                <span key={index} className={getCharacterStyle(index)}>
                  {char}
                </span>
              ))}
            </div>
          </div>
        </div>
      </div>

      {(gameResult === "win" || gameResult === "timeout") && (
        <div className="fixed inset-0 flex items-center justify-center bg-black bg-opacity-60 backdrop-blur-sm z-50">
          <div className="bg-gradient-to-br from-blue-200 to-white p-8 rounded-2xl border-4 border-black shadow-[5px_5px_0px_0px_rgba(0,0,0)] transform transition-all duration-300 hover:shadow-[8px_8px_0px_0px_rgba(0,0,0)]">
            <div className="flex flex-col items-center gap-4">
              <div className="text-4xl animate-bounce">
                {gameResult === "win" ? "🏆" : "⏰"}
              </div>
              <h2
                className="text-3xl font-bold mb-2"
                style={{
                  fontFamily: '"Press Start 2P", sans-serif',
                }}
              >
                {gameResult === "win" ? "Good Game!" : "TIME'S UP!"}
              </h2>

              <div className="bg-blue-100 p-4 rounded-xl border-2 border-black w-full">
                <div className="flex justify-between items-center mb-2">
                  <span className="font-bold">Speed</span>
                  <span className="font-mono text-green-600">
                    {cpm} CPM
                  </span>
                </div>
                <div className="flex justify-between items-center mb-2">
                  <span className="font-bold">Time</span>
                  <span className="font-mono text-blue-600">
                    {elapsedTime.toFixed(2)}s
                  </span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="font-bold">Typo</span>
                  <span className="font-mono text-red-600">
                    {totalErrors}x
                  </span>
                </div>

                {typoWords.length > 0 && (
                  <div className="mt-3 pt-3 border-t-2 border-black">
                    <p className="font-bold mb-2">Kata yang typo:</p>
                    <div className="flex flex-wrap gap-2">
                      {typoWords.map((word, idx) => (
                        <span
                          key={idx}
                          className="bg-red-100 text-red-600 px-2 py-1 rounded-lg text-sm font-mono"
                        >
                          {word}
                        </span>
                      ))}
                    </div>
                  </div>
                )}
              </div>

              <div className="flex flex-col w-full gap-3">
                <button
                  onClick={resetGame}
                  className="w-full bg-[#A3C4C9] hover:bg-[#8BA9AE] text-black px-6 py-3 rounded-xl border-4 border-black font-bold transition-all duration-200 transform hover:scale-105 hover:shadow-[4px_4px_0px_0px_rgba(0,0,0)]"
                >
                  Main Lagi Yuk! 🎮
                </button>
                <button
                  onClick={() => navigate("/")}
                  className="w-full bg-red-400 hover:bg-red-500 text-white px-6 py-3 rounded-xl border-4 border-black font-bold transition-all duration-200 transform hover:scale-105 hover:shadow-[4px_4px_0px_0px_rgba(0,0,0)]"
                >
                  Balik ke Lobby 🏠
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}