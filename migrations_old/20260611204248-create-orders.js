'use strict';

module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable('Orders', {
      id: { type: Sequelize.INTEGER, autoIncrement: true, primaryKey: true },
      order_number: Sequelize.STRING,
      status: {
        type: Sequelize.STRING,
        defaultValue: 'pending'
      },
      total_amount: Sequelize.FLOAT,
      created_at: Sequelize.DATE,
      updated_at: Sequelize.DATE
    });
  },

  async down(queryInterface) {
    await queryInterface.dropTable('Orders');
  }
};