import { useEffect, useRef, useState } from 'react';
import { useLocation, useNavigate, Link } from 'react-router-dom';
import foxAvatar from '../assets/fox.png';
import { useSound } from '../contexts/SoundContext';
import io from 'socket.io-client';

export default function DrawingPage({ base_url }) {
    const location = useLocation();
    const defaultName = 'pokya';
    const { name = defaultName, item } = location.state || { name: defaultName };
    const { playClick } = useSound();
    const canvasRef = useRef(null);

    const [context, setContext] = useState(null);
    const [isDrawing, setIsDrawing] = useState(false);
    const [messages, setMessages] = useState([]);
    const [newMessage, setNewMessage] = useState('');
    const [color, setColor] = useState('#000000');
    const [brushSize, setBrushSize] = useState(2);
    const [tool, setTool] = useState('pencil');
    const [normalMessages, setNormalMessages] = useState([]);
    const [newNormalMessage, setNewNormalMessage] = useState('');
    const [selectedItem, setSelectedItem] = useState(null);
    const [items, setItems] = useState([]);
    const [timeLeft, setTimeLeft] = useState(60);
    const [isItemModalOpen, setIsItemModalOpen] = useState(true);
    const [socket, setSocket] = useState(null);
    const { roomId } = location.state || {};

    const [onlinePlayers, setOnlinePlayers] = useState([]);

    const [currentDrawer, setCurrentDrawer] = useState(null);
    const [isMyTurn, setIsMyTurn] = useState(false);
    const [currentWord, setCurrentWord] = useState(null);
    const [isReady, setIsReady] = useState(false);
    const [readyPlayers, setReadyPlayers] = useState(new Set());
    const [isGameStarted, setIsGameStarted] = useState(false);
    const [countdown, setCountdown] = useState(null);

    const [errorMessage, setErrorMessage] = useState('');
    const [showError, setShowError] = useState(false);

    // const [isTimeUp, setIsTimeUp] = useState(false);
    // const navigate = useNavigate();
    // const [currentPlayer, setCurrentPlayer] = useState(1);
    // const [drawingData, setDrawingData] = useState([]);

    useEffect(() => {
        if (selectedItem) {
            const canvas = canvasRef.current;
            canvas.width = canvas.parentElement.clientWidth;
            canvas.height = canvas.parentElement.clientHeight;
            const ctx = canvas.getContext('2d');
            ctx.fillStyle = 'white';
            ctx.fillRect(0, 0, canvas.width, canvas.height);
            setContext(ctx);
        }
    }, [selectedItem]);

    useEffect(() => {
        const canvas = canvasRef.current;
        const container = canvas.parentElement;

        const setCanvasSize = () => {
            const rect = container.getBoundingClientRect();
            canvas.width = rect.width;
            canvas.height = rect.height;

            const ctx = canvas.getContext('2d');
            ctx.fillStyle = 'white';
            ctx.fillRect(0, 0, canvas.width, canvas.height);
            setContext(ctx);
        };

        setCanvasSize();
        window.addEventListener('resize', setCanvasSize);

        return () => window.removeEventListener('resize', setCanvasSize);
    }, []);

    useEffect(() => {
        if (context) {
            context.strokeStyle = tool === 'eraser' ? 'white' : color;
            context.lineWidth = brushSize;
            context.lineCap = 'round';
            context.lineJoin = 'round';
        }
    }, [tool, color, brushSize, context]);

    const startDrawing = (e) => {
        if (!isMyTurn) return;

        const canvas = canvasRef.current;
        const rect = canvas.getBoundingClientRect();
        const scaleX = canvas.width / rect.width;
        const scaleY = canvas.height / rect.height;
        const x = (e.clientX - rect.left) * scaleX;
        const y = (e.clientY - rect.top) * scaleY;

        context.beginPath();
        context.moveTo(x, y);
        setIsDrawing(true);

        socket?.emit("drawing-data", {
            roomId,
            x,
            y,
            type: 'start',
            tool,
            color,
            size: brushSize
        });
    };

    const draw = (e) => {
        if (!isDrawing || !isMyTurn) return;

        const canvas = canvasRef.current;
        const rect = canvas.getBoundingClientRect();
        const scaleX = canvas.width / rect.width;
        const scaleY = canvas.height / rect.height;
        const x = (e.clientX - rect.left) * scaleX;
        const y = (e.clientY - rect.top) * scaleY;

        context.lineTo(x, y);
        context.stroke();

        socket?.emit("drawing-data", {
            roomId,
            x,
            y,
            type: 'draw',
            tool,
            color,
            size: brushSize
        });
    };

    const stopDrawing = () => {
        context.closePath();
        setIsDrawing(false);
    };

    const clearCanvas = async () => {
        if (!isMyTurn) return;

        await playClick();
        const canvas = canvasRef.current;
        const ctx = canvas.getContext('2d');
        ctx.fillStyle = 'white';
        ctx.fillRect(0, 0, canvas.width, canvas.height);

        socket?.emit("canvas-clear", { roomId });
    };

    const handleSendMessage = async (e) => {
        e.preventDefault();

        if (isMyTurn) {
            setErrorMessage('Kamu lagi giliran gambar, ga boleh nebak! 🙈');
            setShowError(true);
            setTimeout(() => {
                setShowError(false);
            }, 3000);
            return;
        }

        const guessWord = newMessage.trim();

        if (guessWord && !guessWord.includes(' ')) {
            await playClick();
            const isCorrectGuess = guessWord.toLowerCase() === currentWord?.toLowerCase().trim();
            const messageData = {
                text: isCorrectGuess ? "Nah itu dia! 🎉" : guessWord,
                sender: name,
                isCorrect: isCorrectGuess,
                isGuess: true,
                score: isCorrectGuess ? 15 : 0
            };

            socket?.emit("drawing-chat", {
                roomId,
                messageData,
                playerName: name,
                isCorrect: isCorrectGuess
            });
            setNewMessage('');
            setShowError(false);
        } else if (guessWord.includes(' ')) {
            setErrorMessage('Tebakan harus 1 kata aja ya! 🙏');
            setShowError(true);

            setTimeout(() => {
                setShowError(false);
            }, 3000);
        }
    };

    const handleNormalMessage = async (e) => {
        e.preventDefault();
        if (newNormalMessage.trim()) {
            await playClick();
            const messageData = {
                text: newNormalMessage,
                sender: name,
                isGuess: false
            };

            socket?.emit("drawing-chat", { roomId, messageData });
            setNewNormalMessage('');
        }
    };

    useEffect(() => {
        const fetchCategories = async () => {
            try {
                const response = await fetch(`${base_url}/categories`);
                if (!response.ok) {
                    throw new Error('Gagal mengambil data kategori');
                }
                const data = await response.json();
                setCategories(data);
            } catch (error) {
                console.error('Error:', error);
            }
        };

        fetchCategories();
    }, []);

    // const handleCategorySelect = async (category) => {
    //     await playClick();
    //     setSelectedCategoryId(category.id);
    //     setCategoryItems(category.items);
    //     setShowItems(true);
    // };

    const handleItemSelect = async (item) => {
        await playClick();
        setSelectedItem(item);
        setCurrentWord(item.name);
        setIsItemModalOpen(false);

        socket?.emit("select-word", {
            roomId,
            word: item.name,
            drawer: name
        });
    };

    // const handleCancel = () => {
    //     navigate('/');
    // };

    // const handleBackToCategories = async () => {
    //     await playClick();
    //     navigate('/');
    // };

    // const renderModal = () => (
    //     <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
    //         <div className="bg-white w-96 p-5 rounded-lg shadow-lg border-4 border-black">
    //             <h2 className="text-xl font-bold mb-4 text-center" style={{ fontFamily: '"Roboto Mono", sans-serif' }}>
    //                 {showItems ? 'Pilih Item untuk Digambar' : 'Pilih Kategori'}
    //             </h2>

    //             {!showItems ? (
    //                 <ul className="space-y-2">
    //                     {Array.isArray(categories) && categories.map((category) => (
    //                         <li key={category.id}>
    //                             <button
    //                                 onClick={() => handleCategorySelect(category)}
    //                                 className="w-full bg-blue-200 hover:bg-blue-300 py-2 rounded-lg border-2 border-black"
    //                             >
    //                                 {category.name}
    //                             </button>
    //                         </li>
    //                     ))}
    //                 </ul>
    //             ) : (
    //                 <div>
    //                     <div className="max-h-60 overflow-y-auto">
    //                         <ul className="space-y-2">
    //                             {Array.isArray(categoryItems) && categoryItems.map((item) => (
    //                                 <li key={item.id}>
    //                                     <button
    //                                         onClick={() => handleItemSelect(item)}
    //                                         className="w-full bg-green-200 hover:bg-green-300 py-2 rounded-lg border-2 border-black flex justify-between px-4"
    //                                     >
    //                                         <span>{item.name}</span>
    //                                         <span className="text-sm text-gray-600">
    //                                             ({item.difficulty})
    //                                         </span>
    //                                     </button>
    //                                 </li>
    //                             ))}
    //                         </ul>
    //                     </div>
    //                     <button
    //                         onClick={() => setShowItems(false)}
    //                         className="mt-4 w-full bg-blue-400 text-white py-2 rounded-lg border-2 border-black"
    //                     >
    //                         Cancel
    //                     </button>
    //                 </div>
    //             )}
    //         </div>
    //     </div>
    // );

    useEffect(() => {
        if (location.state?.items) {
            setItems(location.state.items);
        }
    }, [location.state]);

    useEffect(() => {
        console.log("Location state received:", location.state);
    }, [location.state]);

    const renderItemModal = () => {
        if (!isItemModalOpen || !isMyTurn || !isGameStarted || currentWord) return null;

        return (
            <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
                <div className="bg-white w-96 p-5 rounded-lg shadow-lg border-4 border-black">
                    <h2 className="text-xl font-bold mb-4 text-center"
                        style={{ fontFamily: '"Press Start 2P", sans-serif' }}>
                        Pilih Item untuk Digambar ✏️
                    </h2>

                    <div className="max-h-[400px] overflow-y-auto space-y-2">
                        {items.map((item) => (
                            <button
                                key={item.id}
                                onClick={() => handleItemSelect(item)}
                                className="w-full bg-blue-200 hover:bg-blue-300 py-2 rounded-lg border-2 border-black text-center"
                            >
                                {item.name}
                            </button>
                        ))}
                    </div>
                </div>
            </div>
        );
    };

    useEffect(() => {
        const newSocket = io(base_url);
        setSocket(newSocket);

        if (roomId && name) {
            const playerData = {
                name,
                score: 0,
                isDrawing: false
            };

            newSocket.emit("join-drawing-room", {
                roomId,
                playerData
            });
        }

        if (roomId) {
            newSocket.emit("join-drawing-room", {
                roomId,
                playerData: {
                    id: name,
                    name: name,
                    score: 0,
                    isDrawing: false
                }
            });
        }

        return () => {
            newSocket.emit("leave-drawing-room", { roomId, playerName: name });
            newSocket.disconnect();
        };
    }, [base_url, roomId, name]);

    useEffect(() => {
        if (!socket) return;

        console.log("Setting up socket listeners");

        socket.on("game-state-sync", ({ isPlaying, currentDrawer, word, hasStarted, timeLeft }) => {
            console.log("Game state sync received:", {
                isPlaying, currentDrawer, word, hasStarted, timeLeft
            });
            setIsGameStarted(isPlaying);
            setCurrentDrawer(currentDrawer);
            setIsMyTurn(currentDrawer?.name === name);
            setCurrentWord(word);
            setTimeLeft(timeLeft);

            if (!hasStarted) {
                setIsReady(false);
                setReadyPlayers(new Set());
            }
        });

        socket.on("ready-players-sync", (readyPlayersList) => {
            console.log("Ready players sync received:", readyPlayersList);
            setReadyPlayers(new Set(readyPlayersList));
            setIsReady(readyPlayersList.includes(name));
        });

        socket.on("game-reset", () => {
            console.log("Game reset received");
            setIsGameStarted(false);
            setIsReady(false);
            setReadyPlayers(new Set());
            setCurrentWord(null);
            setCurrentDrawer(null);
            setIsMyTurn(false);
            setTimeLeft(60);
            setCountdown(null);
            clearCanvas();
        });

        socket.on("drawing-players-update", (playersList) => {
            const filteredPlayers = playersList.filter(p =>
                p.name !== name || p.socketId === socket.id
            );
            setOnlinePlayers(filteredPlayers);
        });

        socket.on("player-left", ({ name: leftPlayerName }) => {
            setOnlinePlayers(prev => prev.filter(p => p.name !== leftPlayerName));
        });

        socket.on("player-joined", (playerData) => {
            setOnlinePlayers(prev => [...prev, playerData]);
        });

        socket.on("drawing-data", ({ x, y, type, tool, color, size }) => {
            const ctx = canvasRef.current.getContext('2d');
            if (type === 'start') {
                ctx.beginPath();
                ctx.moveTo(x, y);
            } else if (type === 'draw') {
                ctx.strokeStyle = tool === 'eraser' ? 'white' : color;
                ctx.lineWidth = size;
                ctx.lineTo(x, y);
                ctx.stroke();
            }
        });

        socket.on("drawing-chat", (message) => {
            if (message.isGuess) {
                setMessages(prev => [...prev, message]);
            } else {
                setNormalMessages(prev => [...prev, message]);
            }
        });

        socket.on("canvas-clear", () => {
            const canvas = canvasRef.current;
            const ctx = canvas.getContext('2d');
            ctx.fillStyle = 'white';
            ctx.fillRect(0, 0, canvas.width, canvas.height);
        });

        socket.on("game-state-update", ({ currentDrawer, word }) => {
            console.log("Game state update received:", {
                currentDrawer,
                word,
                myName: name
            });

            setCurrentDrawer(currentDrawer);
            setIsMyTurn(currentDrawer?.name === name);
            setCurrentWord(word);

            setIsReady(false);
            setReadyPlayers(new Set());

            if (currentDrawer?.name === name && !word) {
                setIsItemModalOpen(true);
            } else {
                setIsItemModalOpen(false);
            }
        });

        socket.on("game-start", () => {
            console.log("Game started!");
            setCountdown(null);
            setIsGameStarted(true);
            setIsReady(false);
            setReadyPlayers(new Set());
            setTimeLeft(60);
        });

        socket.on("game-reset", () => {
            console.log("Game reset received");
            setIsGameStarted(false);
            setIsReady(false);
            setReadyPlayers(new Set());
            setCurrentWord(null);
            setCurrentDrawer(null);
            setIsMyTurn(false);
            setTimeLeft(60);
            setCountdown(null);
        });

        socket.on("reset-timer", () => {
            console.log("Timer reset received");
            setTimeLeft(60);
        });

        socket.on("time-up-ack", (data) => {
            console.log("Time-up acknowledgment received:", data);
        });

        socket.on("player-ready", ({ playerName }) => {
            console.log("Player ready received:", playerName);
            setReadyPlayers(prev => new Set([...prev, playerName]));
        });

        socket.on("player-unready", ({ playerName }) => {
            console.log("Player unready received:", playerName);
            setReadyPlayers(prev => {
                const newSet = new Set(prev);
                newSet.delete(playerName);
                return newSet;
            });
        });

        socket.on("game-countdown", (count) => {
            console.log("Countdown received:", count);
            setCountdown(count);
        });

        socket.on("timer-sync", (newTimeLeft) => {
            setTimeLeft(newTimeLeft);
        });

        socket.on("time-up", ({ currentDrawer }) => {
            if (socket) {
                socket.emit("time-up", {
                    roomId,
                    currentDrawer: currentDrawer
                });
            }
        });

        return () => {
            console.log("Cleaning up socket listeners");
            socket.off("drawing-players-update");
            socket.off("drawing-data");
            socket.off("drawing-chat");
            socket.off("canvas-clear");
            socket.off("game-state-update");
            socket.off("reset-timer");
            socket.off("time-up-ack");
            socket.off("player-ready");
            socket.off("player-unready");
            socket.off("game-state-sync");
            socket.off("ready-players-sync");
            socket.off("timer-sync");
        };
    }, [socket, name, isGameStarted, roomId]);

    useEffect(() => {
        console.log("Current timeLeft:", timeLeft);
    }, [timeLeft]);

    const handleReadyClick = async () => {
        try {
            await playClick();
            console.log("Ready button clicked, current state:", isReady);

            if (!isReady) {
                console.log("Emitting player-ready");
                socket?.emit("player-ready", {
                    roomId,
                    playerName: name
                });
                setIsReady(true);
            } else {
                console.log("Emitting player-unready");
                socket?.emit("player-unready", {
                    roomId,
                    playerName: name
                });
                setIsReady(false);
            }
        } catch (error) {
            console.error("Error in handleReadyClick:", error);
        }
    };

    const renderTimerSection = () => {
        if (!isGameStarted) {
            return (
                <div className="bg-yellow-100 p-2 rounded-lg border-2 border-black mb-4">
                    <div className="text-center font-bold mb-2">
                        {countdown ? (
                            <span className="text-xl animate-bounce block">
                                Starting in {countdown}... 🎮
                            </span>
                        ) : (
                            <div className="space-y-2">
                                <p>Players Ready: {readyPlayers.size}/{onlinePlayers.length} 👥</p>
                                <button
                                    onClick={handleReadyClick}
                                    className={`w-full py-2 px-4 rounded-lg border-2 border-black font-bold ${isReady
                                        ? 'bg-yellow-400 hover:bg-yellow-500'
                                        : 'bg-blue-400 hover:bg-blue-500'
                                        } text-white transition`}
                                >
                                    {isReady ? 'Cancel Ready ❌' : 'Ready! ✅'}
                                </button>
                            </div>
                        )}
                    </div>
                </div>
            );
        }

        return (
            <div className={`bg-yellow-100 p-2 rounded-lg border-2 border-black mb-4 ${timeLeft <= 10 ? 'animate-pulse bg-red-200' : ''
                }`}>
                <div className="text-center">
                    <p className="font-bold">
                        ⏰ Time Left: {timeLeft > 0 ? timeLeft : '0'}s
                    </p>
                    {currentDrawer && (
                        <p className="text-sm mt-1">
                            {isMyTurn ? "Your Turn!" : `${currentDrawer.name}'s Turn`} 🎨
                        </p>
                    )}
                </div>
            </div>
        );
    };

    return (
        <div className="min-h-screen bg-[#A3C4C9] p-4 lg:p-8 overflow-x-hidden scrollbar-none">
            {showError && (
                <div className="fixed top-4 left-1/2 transform -translate-x-1/2 z-50">
                    <div className="bg-red-100 border-2 border-red-400 text-red-700 px-6 py-3 rounded-lg shadow-lg flex items-center space-x-2 animate-bounce">
                        <span>⚠️</span>
                        <p>{errorMessage}</p>
                    </div>
                </div>
            )}

            <div className="flex items-center justify-between mb-4 lg:mb-8 max-w-[1400px] mx-auto">
                <Link
                    to="/"
                    className="bg-red-400 hover:bg-red-500 text-white px-4 py-2 rounded-lg border-4 border-black font-bold flex items-center justify-center gap-2"
                >
                    <span>←</span> Back
                </Link>

                <h1 className="text-2xl lg:text-3xl font-bold flex-1 text-center"
                    style={{ fontFamily: '"Press Start 2P", sans-serif' }}>
                    inkIt! - {!isGameStarted ? (
                        countdown ?
                            `Starting in ${countdown}...` :
                            `Waiting for players (${readyPlayers.size}/${onlinePlayers.length})`
                    ) : currentDrawer ? (
                        isMyTurn ?
                            `Your turn - Drawing: ${currentWord || "Choose a word"}` :
                            `${currentDrawer.name} is drawing...`
                    ) : "Waiting for next round"}
                </h1>

                <div className="w-[100px]"></div>
            </div>

            <div className="flex flex-col lg:flex-row gap-4 lg:gap-8 max-w-[1400px] mx-auto">
                <div className="w-full lg:w-64 min-w-[250px]">
                    <div className="bg-blue-200 p-4 rounded-lg border-4 border-black h-[300px] lg:h-[calc(600px+4rem)] overflow-hidden">
                        <h3 className="text-lg font-bold mb-4 text-center" style={{ fontFamily: '"Press Start 2P", sans-serif' }}>
                            Players Online
                        </h3>
                        <div className="space-y-3 overflow-y-auto overflow-x-hidden scrollbar-none h-[calc(100%-4rem)]">
                            {onlinePlayers.map((player) => (
                                <div
                                    key={player.socketId}
                                    className={`bg-white p-3 rounded-lg border-2 border-black ${player.isDrawing ? 'ring-2 ring-yellow-400' : ''
                                        }`}
                                >
                                    <div className="flex items-center gap-3">
                                        <img
                                            src={foxAvatar}
                                            alt="avatar"
                                            className="w-10 h-10 rounded-full border-2 border-black"
                                        />
                                        <div>
                                            <p className="font-bold">{player.name}</p>
                                            <p className="text-sm text-gray-600">
                                                Score: {player.score || 0}
                                            </p>
                                        </div>
                                    </div>
                                    {player.isDrawing && (
                                        <div className="mt-2 text-xs text-center bg-yellow-100 rounded-full py-1">
                                            Currently Drawing
                                        </div>
                                    )}
                                </div>
                            ))}
                        </div>
                    </div>
                </div>

                <div className="flex-1 min-w-[300px]">
                    <div className="bg-white p-4 rounded-lg border-4 border-black h-[400px] lg:h-[600px]">
                        <div className="flex flex-wrap justify-between gap-2 mb-4">
                            <div className="flex flex-wrap gap-2">
                                <button
                                    onClick={() => setTool('pencil')}
                                    disabled={!isMyTurn}
                                    className={`px-3 lg:px-4 py-2 rounded-lg border-4 border-black font-bold text-sm lg:text-base ${!isMyTurn ? 'opacity-50 cursor-not-allowed' :
                                            tool === 'pencil'
                                                ? 'bg-blue-600 text-white ring-4 ring-blue-300'
                                                : 'bg-blue-400 text-white hover:bg-blue-500'
                                        }`}
                                >
                                    ✏️ Pencil
                                </button>
                                <button
                                    onClick={() => setTool('eraser')}
                                    disabled={!isMyTurn}
                                    className={`px-3 lg:px-4 py-2 rounded-lg border-4 border-black font-bold text-sm lg:text-base ${!isMyTurn ? 'opacity-50 cursor-not-allowed' :
                                            tool === 'eraser'
                                                ? 'bg-red-600 text-white ring-4 ring-red-300'
                                                : 'bg-red-400 text-white hover:bg-red-500'
                                        }`}
                                >
                                    🧹 Eraser
                                </button>
                                <button
                                    onClick={clearCanvas}
                                    disabled={!isMyTurn}
                                    className={`bg-yellow-400 text-white px-3 lg:px-4 py-2 rounded-lg border-4 border-black hover:bg-yellow-500 font-bold ${!isMyTurn ? 'opacity-50 cursor-not-allowed' : ''
                                        }`}
                                >
                                    🗑️ Reset
                                </button>
                            </div>
                            <div className="flex gap-2">
                                <input
                                    type="color"
                                    value={color}
                                    onChange={(e) => setColor(e.target.value)}
                                    disabled={!isMyTurn}
                                    className={`w-12 h-12 rounded border-4 border-black ${isMyTurn ? 'cursor-pointer' : 'cursor-not-allowed opacity-50'
                                        }`}
                                />
                                <select
                                    value={brushSize}
                                    onChange={(e) => setBrushSize(Number(e.target.value))}
                                    disabled={!isMyTurn}
                                    className={`px-4 py-2 rounded-lg border-4 border-black ${!isMyTurn ? 'opacity-50 cursor-not-allowed' : ''
                                        }`}
                                >
                                    <option value="2">2px</option>
                                    <option value="4">4px</option>
                                    <option value="6">6px</option>
                                    <option value="8">8px</option>
                                    <option value="10">10px</option>
                                    <option value="12">12px</option>
                                </select>
                            </div>
                        </div>

                        <div className="h-[calc(100%-4rem)] w-full flex items-center justify-center bg-gray-50 rounded-lg">
                            <div className="relative w-full h-full max-w-[800px] max-h-[500px] mx-auto">
                                <canvas
                                    ref={canvasRef}
                                    onMouseDown={startDrawing}
                                    onMouseMove={draw}
                                    onMouseUp={stopDrawing}
                                    onMouseLeave={stopDrawing}
                                    className={`w-full h-full rounded-lg border-2 border-gray-300 ${isMyTurn ? 'cursor-crosshair' : 'cursor-not-allowed'
                                        }`}
                                    style={{
                                        touchAction: 'none',
                                        objectFit: 'contain'
                                    }}
                                />
                            </div>
                        </div>
                    </div>
                </div>

                <div className="w-full lg:w-96 min-w-[300px]">
                    <div className="bg-pink-200 p-4 rounded-lg border-4 border-black h-[400px] lg:h-[calc(600px+4rem)] flex flex-col">
                        {renderTimerSection()}
                        <div className="h-1/2 flex flex-col mb-4">
                            <div className="flex-1 overflow-y-auto bg-white rounded-lg p-4 border-2 border-black">
                                <div className="text-center font-bold mb-2 text-sm bg-yellow-100 rounded-lg py-1">
                                    Guess
                                </div>
                                {messages.map((message, index) => (
                                    <div key={index} className="mb-2">
                                        <span className="font-bold">{message.sender}: </span>
                                        <span className={message.isCorrect ? "text-green-600 font-bold" : ""}>
                                            {message.text}
                                        </span>
                                    </div>
                                ))}
                            </div>
                            <form onSubmit={handleSendMessage} className="flex gap-2 mt-2">
                                <input
                                    type="text"
                                    value={newMessage}
                                    onChange={(e) => setNewMessage(e.target.value)}
                                    placeholder={isMyTurn ? "Kamu lagi giliran gambar..." : "Ketik 1 kata untuk menebak..."}
                                    disabled={isMyTurn}
                                    className={`flex-1 p-2 rounded-lg border-2 ${showError ? 'border-red-400' : 'border-black'
                                        } ${isMyTurn ? 'bg-gray-100 cursor-not-allowed' : ''} 
                                    focus:outline-none transition-colors duration-300`}
                                />
                                <button
                                    type="submit"
                                    disabled={isMyTurn}
                                    className={`bg-green-400 text-white px-4 py-2 rounded-lg border-4 border-black hover:bg-green-500 
                                    ${isMyTurn ? 'opacity-50 cursor-not-allowed' : ''}`}
                                >
                                    Guess
                                </button>
                            </form>
                        </div>

                        {/* Chat */}
                        <div className="h-1/2 flex flex-col">
                            <div className="flex-1 overflow-y-auto bg-white rounded-lg p-4 border-2 border-black">
                                <div className="text-center font-bold mb-2 text-sm bg-blue-100 rounded-lg py-1">
                                    Chat
                                </div>
                                {normalMessages.map((message, index) => (
                                    <div key={index} className="mb-2">
                                        <span className="font-bold">{message.sender}: </span>
                                        <span>{message.text}</span>
                                    </div>
                                ))}
                            </div>
                            <form onSubmit={handleNormalMessage} className="flex gap-2 mt-2">
                                <input
                                    type="text"
                                    value={newNormalMessage}
                                    onChange={(e) => setNewNormalMessage(e.target.value)}
                                    placeholder="Send message..."
                                    className="flex-1 p-2 rounded-lg border-2 border-black focus:outline-none"
                                />
                                <button
                                    type="submit"
                                    className="bg-blue-400 text-white px-4 py-2 rounded-lg border-4 border-black hover:bg-blue-500"
                                >
                                    Send
                                </button>
                            </form>
                        </div>
                    </div>
                </div>

            </div>
            {renderItemModal()}
        </div>
    );
}