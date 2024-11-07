const { httpServer } = require("../app");
const PORT = process.env.PORT || 3024;

httpServer.listen(PORT, () => {
  console.log(`Server is running on port ${PORT} 🚀`);
});
