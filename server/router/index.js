const router = require("express").Router();
const RoomController = require("../controller/RoomController");
const CategoryController = require("../controller/CategoryController");
const ParagraphController = require("../controller/ParagraphController");

router.get("/categories", CategoryController.read);
router.get("/paragraphs", ParagraphController.read);

router.get("/", RoomController.read);
router.get("/:id", RoomController.readOne);
router.post("/", RoomController.create);
router.patch("/:id", RoomController.updateStatus);
router.delete("/:id", RoomController.delete);

module.exports = router;