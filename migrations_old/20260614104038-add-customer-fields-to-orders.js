'use strict';

module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.addColumn('orders', 'customer_name', {
      type: Sequelize.STRING,
      allowNull: true
    });

    await queryInterface.addColumn('orders', 'customer_phone', {
      type: Sequelize.STRING,
      allowNull: true
    });
  },

  async down(queryInterface, Sequelize) {
    await queryInterface.removeColumn('orders', 'customer_name');
    await queryInterface.removeColumn('orders', 'customer_phone');
  }
};