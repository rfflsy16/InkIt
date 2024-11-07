require('dotenv').config()

const { httpServer } = require("../app");
const PORT = process.env.PORT || 3024;

console.log(process.env.PORT)

httpServer.listen(PORT, () => {
  console.log(`Server is running on port ${PORT} 🚀`);
});
