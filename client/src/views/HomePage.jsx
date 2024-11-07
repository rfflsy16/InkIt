import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import foxAvatar from "../assets/fox.png";
import { useSound } from "../contexts/SoundContext";
import io from "socket.io-client";
import axios from "axios";
import "./HomePage.css";

export default function HomePage({ base_url }) {
  const [name, setName] = useState("");
  const [selectedGame, setSelectedGame] = useState(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [categories, setCategories] = useState([]);
  const [selectedCategoryId, setSelectedCategoryId] = useState(null);
  const [showItems, setShowItems] = useState(false);
  const [rooms, setRooms] = useState([]);
  const [roomName, setRoomName] = useState("");
  const [maxPlayer, setMaxPlayer] = useState(4);
  const [showCreateRoomModal, setShowCreateRoomModal] = useState(false);
  const [nameError, setNameError] = useState("");
  const [roomNameError, setRoomNameError] = useState("");
  const [gameError, setGameError] = useState("");
  const navigate = useNavigate();
  const { playClick } = useSound();
  const [playerCounts, setPlayerCounts] = useState({});
  const [socket, setSocket] = useState(null);
  const [displayedTitle, setDisplayedTitle] = useState([]);
  const fullTitle = "Draw, Type, Win!";

  useEffect(() => {
    const newSocket = io(base_url);
    setSocket(newSocket);

    newSocket.emit("request-room-counts");

    newSocket.on("initial-room-counts", (counts) => {
      setPlayerCounts(counts);
    });

    newSocket.on("player-count-update", async ({ roomId, count }) => {
      setPlayerCounts(prev => ({
        ...prev,
        [roomId]: count
      }));

      if (count === 0) {
        try {
          const { data } = await axios.get(`${base_url}/${roomId}`);
          if (data.room) {
            await axios.delete(`${base_url}/${roomId}`);
            setRooms(prev => prev.filter(room => room.id !== roomId));
          }
        } catch (error) {
          console.error("Error deleting empty room:", error);
        }
      }
    });

    return () => {
      newSocket.disconnect();
    };
  }, [base_url]);

  const checkAndDeleteEmptyRooms = async (roomId, count) => {
    try {
      if (count === 0) {
        const { data } = await axios.get(`${base_url}/${roomId}`);

        if (data.room && data.room.status === "playing") {
          await axios.delete(`${base_url}/${roomId}`);

          setRooms(prev => prev.filter(r => r.id !== roomId));
          setPlayerCounts(prev => {
            const newCounts = { ...prev };
            delete newCounts[roomId];
            return newCounts;
          });
        }
      }
    } catch (error) {
      console.error("Error checking/deleting empty room:", error);
    }
  };

  useEffect(() => {
    const fetchData = async () => {
      try {
        const { data: roomData } = await axios.get(`${base_url}/`);
        setRooms(roomData.room);

        if (socket) {
          socket.emit("request-room-counts");
        }

        const { data: categoryData } = await axios.get(`${base_url}/categories`);
        setCategories(categoryData.categories);
      } catch (error) {
        console.error("Error:", error);
      }
    };

    fetchData();

    const interval = setInterval(fetchData, 5000);

    return () => clearInterval(interval);
  }, [base_url, socket]);

  const selectGame = async (game) => {
    await playClick();
    setSelectedGame(game);
    setShowItems(false);
    setSelectedCategoryId(null);
  };

  const handlePlayNow = async () => {
    if (!name.trim()) {
      setNameError("Isi nama dulu! 😊");
      return;
    }
    if (!selectedGame) {
      setGameError("Pilih game dulu! 🎮");
      return;
    }

    setNameError("");
    setGameError("");
    await playClick();

    try {
      const { data } = await axios.get(`${base_url}/`);
      const allRooms = data.room;

      const availableRooms = allRooms.filter(room =>
        room.game === selectedGame &&
        room.status === "waiting"
      );

      const randomRoom = availableRooms[Math.floor(Math.random() * availableRooms.length)];

      if (!randomRoom) {
        const { data: categoryData } = await axios.get(`${base_url}/categories`);
        const categories = categoryData.categories;

        const randomCategory = categories[Math.floor(Math.random() * categories.length)];

        const { data: newRoomData } = await axios.post(`${base_url}/`, {
          name: `Quick Room ${Math.floor(Math.random() * 1000)}`,
          CategoryId: randomCategory.id,
          maxPlayer,
          game: selectedGame
        });

        const newRoom = newRoomData.room;

        if (selectedGame === "drawing-game") {
          navigate("/drawing-game", {
            state: {
              name,
              categoryId: newRoom.CategoryId,
              categoryName: newRoom.Category.name,
              items: newRoom.Category.Items,
              roomId: newRoom.id
            }
          });
        } else {
          navigate("/typing-game", {
            state: {
              name,
              roomId: newRoom.id
            }
          });
        }
      } else {
        if (selectedGame === "drawing-game") {
          navigate("/drawing-game", {
            state: {
              name,
              categoryId: randomRoom.CategoryId,
              categoryName: randomRoom.Category.name,
              items: randomRoom.Category.Items,
              roomId: randomRoom.id
            }
          });
        } else {
          navigate("/typing-game", {
            state: {
              name,
              roomId: randomRoom.id
            }
          });
        }
      }
    } catch (error) {
      console.error("Error:", error);
      setGameError("Gagal join/create room 😢");
    }
  };

  const handleCategorySelect = async (category) => {
    await playClick();
    console.log("Sending to DrawingPage:", {
      name,
      categoryId: category.id,
      categoryName: category.name,
      items: category.items,
    });

    navigate("/drawing-game", {
      state: {
        name,
        categoryId: category.id,
        categoryName: category.name,
        items: category.items,
      },
    });
  };

  const handleCloseModal = async () => {
    await playClick();
    setIsModalOpen(false);
  };

  const renderCategoryModal = () => (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white w-96 p-5 rounded-lg shadow-lg border-4 border-black">
        <h2
          className="text-xl font-bold mb-4 text-center"
          style={{ fontFamily: '"Roboto Mono", sans-serif' }}
        >
          Pilih Kategori
        </h2>

        <ul className="space-y-2">
          {Array.isArray(categories) &&
            categories.map((category) => (
              <li key={category.id}>
                <button
                  onClick={() => handleCategorySelect(category)}
                  className="w-full bg-blue-200 hover:bg-blue-300 py-2 rounded-lg border-2 border-black"
                >
                  {category.name}
                </button>
              </li>
            ))}
        </ul>

        <button
          onClick={handleCloseModal}
          className="mt-4 w-full bg-red-400 hover:bg-red-500 text-white py-2 rounded-lg border-2 border-black"
        >
          Batal
        </button>
      </div>
    </div>
  );

  const handleOpenCreateRoom = async () => {
    if (!name.trim()) {
      setNameError("Isi nama dulu ya! 😊");
      return;
    }
    if (!roomName.trim()) {
      setRoomNameError("Nama room gaboleh kosong! 🙅‍♂️");
      return;
    }
    if (!selectedGame) {
      setGameError("Pilih game dulu! 🎮");
      return;
    }
    setNameError("");
    setRoomNameError("");
    setGameError("");
    await playClick();

    if (selectedGame === "drawing-game") {
      setShowCreateRoomModal(true);
    } else {
      try {
        const { data } = await axios.post(`${base_url}/`, {
          name: roomName,
          maxPlayer,
          game: selectedGame
        });

        navigate("/typing-game", {
          state: {
            name,
            roomId: data.room.id
          }
        });

        setRoomName("");
        setMaxPlayer(4);
      } catch (error) {
        console.error("Error:", error);
        setGameError("Waduh ada error nih! 😅");
      }
    }
  };

  const handleCreateRoom = async (category) => {
    try {
      await playClick();

      const { data } = await axios.post(`${base_url}/`, {
        name: roomName,
        CategoryId: category.id,
        maxPlayer,
        game: "drawing-game"
      });

      navigate("/drawing-game", {
        state: {
          name,
          categoryId: category.id,
          categoryName: category.name,
          items: data.room.Category.Items,
          roomId: data.room.id
        }
      });

      setRoomName("");
      setMaxPlayer(4);
      setShowCreateRoomModal(false);
    } catch (error) {
      console.error("Error:", error);
      alert("Waduh ada error nih! 😅");
    }
  };

  const renderCreateRoomModal = () => (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white w-96 p-5 rounded-lg shadow-lg border-4 border-black">
        <h2
          className="text-xl font-bold mb-4 text-center"
          style={{ fontFamily: '"Roboto Mono", sans-serif' }}
        >
          Pilih Kategori Room 🎨
        </h2>

        <ul className="space-y-2">
          {categories && categories.map((category) => (
            <li key={category.id}>
              <button
                onClick={() => handleCreateRoom(category)}
                className="w-full bg-blue-200 hover:bg-blue-300 py-2 rounded-lg border-2 border-black"
              >
                {category.name}
              </button>
            </li>
          ))}
        </ul>

        <button
          onClick={() => setShowCreateRoomModal(false)}
          className="mt-4 w-full bg-red-400 hover:bg-red-500 text-white py-2 rounded-lg border-2 border-black"
        >
          Batal ❌
        </button>
      </div>
    </div>
  );

  const handleRoomClick = async (room) => {
    if (!name.trim()) {
      setNameError("Isi nama dulu ya! 😊");
      return;
    }

    setNameError("");
    await playClick();

    if ((playerCounts[room.id] || 0) >= room.maxPlayer) {
      setGameError("Room udah penuh! Coba room lain ya 😊");
      return;
    }

    if (room.game === "drawing-game") {
      navigate("/drawing-game", {
        state: {
          name,
          categoryId: room.CategoryId,
          categoryName: room.Category.name,
          items: room.Category.Items,
          roomId: room.id
        }
      });
    } else if (room.game === "typing-game") {
      navigate("/typing-game", {
        state: {
          name,
          roomId: room.id
        }
      });
    }
  };

  const renderRoomList = (room) => (
    <div
      key={room.id}
      onClick={() => handleRoomClick(room)}
      className="bg-gray-100 p-2 rounded-lg flex justify-between items-center hover:bg-gray-200 cursor-pointer transform transition-transform hover:scale-105"
    >
      <div className="flex items-center gap-2">
        <span>{room.name}</span>
        <span className="text-xs text-gray-500">
          {room.game === "drawing-game"
            ? `(${room.Category?.name} - inkIt!)`
            : "(Typing Race!)"
          }
        </span>
      </div>
      <div className="flex items-center gap-2">
        <span className="text-sm">
          {(playerCounts[room.id] || 0) >= room.maxPlayer ? "🔴" : "🟢"}
        </span>
        <span className="text-sm text-gray-600">
          {playerCounts[room.id] || 0}/{room.maxPlayer}
        </span>
      </div>
    </div>
  );

  useEffect(() => {
    setDisplayedTitle(fullTitle.split(""));
  }, []);

  return (
    <div
      style={{ backgroundColor: "#A3C4C9" }}
      className="bg-saltedegg w-full h-screen flex flex-col items-center justify-center"
    >
      <h1
        className="text-4xl font-bold mb-8"
        style={{ fontFamily: '"Press Start 2P", sans-serif', color: "#333" }}
      >
        {displayedTitle.map((char, index) => (
          <span key={index} className="popUpChar" style={{ animationDelay: `${index * 0.1}s` }}>
            {char}
          </span>
        ))}
      </h1>

      <main
        style={{ backgroundColor: "#A3C4C9" }}
        className="flex gap-10 max-w-[1400px] w-full p-10 bg-white rounded-lg"
      >
        <section className="flex-1 min-w-[300px] bg-pink-200 border-4 border-black p-6 rounded-lg">
          <h2
            className="text-2xl font-semibold text-center mb-4"
            style={{ fontFamily: '"Roboto Mono", sans-serif' }}
          >
            Select Your Game
          </h2>
          <div className="space-y-4">
            <div
              onClick={() => selectGame("drawing-game")}
              className={`bg-blue-200 border-4 border-black p-4 rounded-lg text-center cursor-pointer transform transition-transform hover:scale-105 ${selectedGame === "drawing-game" ? "ring-4 ring-blue-400" : ""
                }`}
            >
              <h3
                className="text-lg font-bold mb-2"
                style={{ fontFamily: '"Press Start 2P", sans-serif' }}
              >
                Game 1: inkIt!
              </h3>
              <p
                className="text-sm mb-4"
                style={{ fontFamily: '"Roboto Mono", sans-serif' }}
              >
                Show off your drawing skills and guess others' creations!
              </p>
            </div>
            <div
              onClick={() => selectGame("typing-game")}
              className={`bg-green-200 border-4 border-black p-4 rounded-lg text-center cursor-pointer transform transition-transform hover:scale-105 ${selectedGame === "typing-game" ? "ring-4 ring-green-400" : ""
                }`}
            >
              <h3
                className="text-lg font-bold mb-2"
                style={{ fontFamily: '"Press Start 2P", sans-serif' }}
              >
                Game 2: Typing Race!
              </h3>
              <p
                className="text-sm mb-4"
                style={{ fontFamily: '"Roboto Mono", sans-serif' }}
              >
                Put your typing skill and win the race!
              </p>
            </div>
          </div>
          {gameError && (
            <p className="text-red-500 text-sm mt-2 text-center animate-bounce">
              {gameError}
            </p>
          )}
        </section>

        <section className="flex-1 min-w-[300px] bg-yellow-200 border-4 border-black p-6 rounded-lg">
          <div className="text-center mb-6">
            <img
              src={foxAvatar}
              alt="Avatar"
              className="w-20 h-20 mx-auto rounded-full border-4 border-black mb-4"
            />
            <p
              className="text-black font-bold"
              style={{ fontFamily: '"Press Start 2P", sans-serif' }}
            >
              Avatar
            </p>
          </div>
          <div className="mb-4">
            <input
              type="text"
              placeholder="Name"
              value={name}
              onChange={(e) => {
                setName(e.target.value);
                setNameError("");
              }}
              className={`w-full p-3 border-4 ${nameError ? "border-red-400" : "border-black"
                } rounded-lg focus:outline-none`}
            />
            {nameError && (
              <p className="text-red-500 text-sm mt-1 animate-bounce">
                {nameError}
              </p>
            )}
          </div>
          <div className="flex justify-center">
            <button
              onClick={handlePlayNow}
              disabled={!name || !selectedGame}
              className={`bg-blue-400 border-4 border-black text-white py-2 px-4 rounded-lg hover:bg-blue-500 transition ${!name || !selectedGame ? "opacity-50 cursor-not-allowed" : ""
                }`}
            >
              Play Now
            </button>
          </div>
        </section>

        <section className="flex-1 min-w-[300px] bg-green-200 border-4 border-black p-6 rounded-lg">
          <h2
            className="text-2xl font-semibold text-center mb-4"
            style={{ fontFamily: '"Roboto Mono", sans-serif' }}
          >
            Room
          </h2>
          <div className="space-y-4 h-[calc(100%-3rem)]">
            <div className="mb-4">
              <label className="block text-sm font-bold mb-2">
                Buat Room Baru ✨
              </label>
              <div className="mb-2">
                <input
                  type="text"
                  placeholder="Nama Room"
                  value={roomName}
                  onChange={(e) => {
                    setRoomName(e.target.value);
                    setRoomNameError("");
                  }}
                  className={`w-full p-3 border-4 ${roomNameError ? "border-red-400" : "border-black"
                    } rounded-lg focus:outline-none`}
                />
                {roomNameError && (
                  <p className="text-red-500 text-sm mt-1 animate-bounce">
                    {roomNameError}
                  </p>
                )}
              </div>
              <div className="mb-2">
                <label className="block text-sm font-bold mb-1">
                  Max Player 👥
                </label>
                <input
                  type="number"
                  min="2"
                  max="8"
                  value={maxPlayer}
                  onChange={(e) => setMaxPlayer(Number(e.target.value))}
                  className="w-full p-3 border-4 border-black rounded-lg focus:outline-none"
                />
              </div>
              <button
                onClick={handleOpenCreateRoom}
                className="w-full mt-2 bg-blue-400 border-4 border-black text-white py-2 px-4 rounded-lg hover:bg-blue-500 transition"
              >
                Buat Room 🎯
              </button>
            </div>

            <div className="flex-1">
              <h3 className="text-lg font-bold mb-2 text-center">
                Room Tersedia
              </h3>
              <div className="bg-white border-4 border-black rounded-lg p-2 h-[180px] overflow-y-auto">
                <div className="space-y-2">
                  {rooms.map((room) => renderRoomList(room))}
                </div>
              </div>
            </div>
          </div>
        </section>
      </main>
      {isModalOpen && renderCategoryModal()}
      {showCreateRoomModal && renderCreateRoomModal()}
      {gameError && (
        <div className="fixed top-4 right-4 bg-red-100 border-2 border-red-400 text-red-700 px-4 py-2 rounded-lg animate-bounce">
          {gameError}
        </div>
      )}
    </div>
  );
}