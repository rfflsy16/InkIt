const { Paragraph } = require("../models");

class ParagraphController {
  static async read(req, res, next) {
    try {
      const paragraphs = await Paragraph.findAll();
      res.status(200).json(paragraphs);
    } catch (error) {
      next(error);
    }
  }
}

module.exports = ParagraphController;
