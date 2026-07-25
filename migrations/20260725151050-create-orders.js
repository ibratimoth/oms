'use strict';

module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable('orders', {
      id: {
        type: Sequelize.UUID,
        defaultValue: Sequelize.literal('gen_random_uuid()'),
        primaryKey: true,
        allowNull: false
      },
      order_number: {
        type: Sequelize.STRING
      },
      status: {
        type: Sequelize.STRING,
        defaultValue: 'pending'
      },
      total_amount: {
        type: Sequelize.FLOAT
      },
      profit_amount: {
        type: Sequelize.DECIMAL(12, 2),
        defaultValue: 0
      },
      customer_name: {
        type: Sequelize.STRING,
        allowNull: true
      },
      customer_phone: {
        type: Sequelize.STRING,
        allowNull: true
      },
      payment_method: {
        type: Sequelize.ENUM('CASH', 'LIPA_NUMBER', 'CREDIT'),
        defaultValue: 'CASH',
        allowNull: false
      },
      merchant_id: {
        type: Sequelize.UUID,
        allowNull: true,
        references: {
          model: 'merchants',
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
      created_by: {
        type: Sequelize.UUID,
        allowNull: true,
        references: {
          model: 'Users',
          key: 'id'
        },
        onUpdate: 'CASCADE',
        onDelete: 'SET NULL'
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

    await queryInterface.addIndex('orders', ['payment_method']);
    await queryInterface.addIndex('orders', ['merchant_id']);
  },

  async down(queryInterface) {
    await queryInterface.dropTable('orders');
    if (queryInterface.sequelize.getDialect() === 'postgres') {
      await queryInterface.sequelize.query('DROP TYPE IF EXISTS "enum_orders_payment_method";');
    }
  }
};