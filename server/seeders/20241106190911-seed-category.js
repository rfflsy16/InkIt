'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up (queryInterface, Sequelize) {
    /**
     * Add seed commands here.
     *
     * Example:
     * await queryInterface.bulkInsert('People', [{
     *   name: 'John Doe',
     *   isBetaMember: false
     * }], {});
    */
    const category = require('../data/category.json')
    category.forEach(el => {
      delete el.id
      el.updatedAt = el.createdAt = new Date()
    })
    await queryInterface.bulkInsert('Categories', category, {})
  },

  async down (queryInterface, Sequelize) {
    /**
     * Add commands to revert seed here.
     *
     * Example:
     * await queryInterface.bulkDelete('People', null, {});
     */
    await queryInterface.bulkDelete('Categories', null, { truncate: true, restartIdentity: true, cascade: true })
  }
};
