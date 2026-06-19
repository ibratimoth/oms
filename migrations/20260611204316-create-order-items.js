'use strict';

module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable('OrderItems', {
      id: { type: Sequelize.INTEGER, autoIncrement: true, primaryKey: true },
      order_id: {
        type: Sequelize.INTEGER,
        references: { model: 'Orders', key: 'id' },
        onDelete: 'CASCADE'
      },
      product_id: {
        type: Sequelize.INTEGER,
        references: { model: 'Products', key: 'id' },
        onDelete: 'CASCADE'
      },
      quantity: Sequelize.INTEGER,
      unit_price: Sequelize.FLOAT,
      subtotal: Sequelize.FLOAT,
      created_at: Sequelize.DATE,
      updated_at: Sequelize.DATE
    });
  },

  async down(queryInterface) {
    await queryInterface.dropTable('OrderItems');
  }
};