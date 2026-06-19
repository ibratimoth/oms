'use strict';

module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable('Products', {
      id: { type: Sequelize.INTEGER, autoIncrement: true, primaryKey: true },
      sku: Sequelize.STRING,
      name: Sequelize.STRING,
      category: Sequelize.STRING,
      buy_price: Sequelize.FLOAT,
      sell_price: Sequelize.FLOAT,
      quantity_in_stock: Sequelize.INTEGER,
      reorder_level: Sequelize.INTEGER,
      created_at: Sequelize.DATE,
      updated_at: Sequelize.DATE
    });
  },

  async down(queryInterface) {
    await queryInterface.dropTable('Products');
  }
};