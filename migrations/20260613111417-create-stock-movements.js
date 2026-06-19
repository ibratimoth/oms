'use strict';

module.exports = {
  async up(queryInterface, Sequelize) {

    await queryInterface.createTable('stock_movements', {

      id: {
        type: Sequelize.INTEGER,
        primaryKey: true,
        autoIncrement: true
      },

      product_id: {
        type: Sequelize.INTEGER,
        allowNull: false,
        references: {
          model: 'products',
          key: 'id'
        },
        onDelete: 'CASCADE'
      },

      type: {
        type: Sequelize.ENUM('IN', 'OUT')
      },

      quantity: {
        type: Sequelize.INTEGER,
        allowNull: false
      },

      reference: {
        type: Sequelize.STRING
      },

      created_at: {
        type: Sequelize.DATE,
        defaultValue: Sequelize.literal('CURRENT_TIMESTAMP')
      },

      updated_at: {
        type: Sequelize.DATE,
        defaultValue: Sequelize.literal('CURRENT_TIMESTAMP')
      }

    });

  },

  async down(queryInterface) {
    await queryInterface.dropTable('stock_movements');
  }
};