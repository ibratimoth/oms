'use strict';

module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable('debts', {
      id: {
        type: Sequelize.UUID,
        defaultValue: Sequelize.UUIDV4,
        primaryKey: true,
        allowNull: false
      },
      person_name: {
        type: Sequelize.STRING,
        allowNull: false
      },
      phone_number: {
        type: Sequelize.STRING,
        allowNull: true
      },
      type: {
        type: Sequelize.ENUM(
          'CUSTOMER_DEBT',   // Customer owes money to shop
          'SUPPLIER_DEBT',   // Shop owes money to supplier
          'CUSTOMER_CREDIT'  // Shop owes change/credit to customer
        ),
        allowNull: false
      },
      amount: {
        type: Sequelize.DECIMAL(12, 2),
        allowNull: false
      },
      status: {
        type: Sequelize.ENUM('PENDING', 'CLEARED'),
        defaultValue: 'PENDING'
      },
      notes: {
        type: Sequelize.STRING,
        allowNull: true
      },
      order_id: {
        type: Sequelize.UUID,
        allowNull: true,
        references: { 
          model: 'orders', 
          key: 'id' 
        },
        onUpdate: 'CASCADE',
        onDelete: 'SET NULL'
      },
      business_id: {
        type: Sequelize.UUID,
        allowNull: true,
        references: { 
          model: 'Businesses', 
          key: 'id' 
        },
        onUpdate: 'CASCADE',
        onDelete: 'CASCADE'
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
    await queryInterface.dropTable('debts');
  }
};