'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.addColumn('orders', 'discount', {
      type: Sequelize.DECIMAL(12, 2),
      defaultValue: 0.00,
      allowNull: false
    });

    await queryInterface.addColumn('orders', 'final_amount', {
      type: Sequelize.DECIMAL(12, 2),
      defaultValue: 0.00,
      allowNull: false
    });
  },

  async down(queryInterface, Sequelize) {
    await queryInterface.removeColumn('orders', 'discount');
    await queryInterface.removeColumn('orders', 'final_amount');
  }
};