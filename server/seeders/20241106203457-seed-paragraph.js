"use strict";

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    /**
     * Add seed commands here.
     *
     * Example:
     * await queryInterface.bulkInsert('People', [{
     *   name: 'John Doe',
     *   isBetaMember: false
     * }], {});
     */
    const data = require("../data/paragraph.json");
    data.forEach((el) => {
      delete el.id;
      el.createdAt = el.updatedAt = new Date();
    });
    await queryInterface.bulkInsert("Paragraphs", data);
  },

  async down(queryInterface, Sequelize) {
    /**
     * Add commands to revert seed here.
     *
     * Example:
     * await queryInterface.bulkDelete('People', null, {});
     */
    await queryInterface.bulkDelete("Paragraphs", null, {
      truncate: true,
      restartIdentity: true,
      cascade: true,
    });
  },
};
