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
    const item = require('../data/item.json')
    item.forEach(el => {
      delete el.id
      el.updatedAt = el.createdAt = new Date()
    })
    await queryInterface.bulkInsert('Items', item, {})
  },

  async down (queryInterface, Sequelize) {
    /**
     * Add commands to revert seed here.
     *
     * Example:
     * await queryInterface.bulkDelete('People', null, {});
     */
    await queryInterface.bulkDelete('Items', null, { truncate: true, restartIdentity: true, cascade: true })
  }
};
