'use strict';

module.exports = {
  async up(queryInterface, Sequelize) {
    // 1. Add payment_method column with ENUM values
    await queryInterface.addColumn('orders', 'payment_method', {
      type: Sequelize.ENUM('CASH', 'LIPA_NUMBER', 'CREDIT'),
      defaultValue: 'CASH',
      allowNull: false
    });

    // 2. Add merchant_id foreign key referencing merchants table
    await queryInterface.addColumn('orders', 'merchant_id', {
      type: Sequelize.UUID,
      allowNull: true,
      references: {
        model: 'merchants',
        key: 'id'
      },
      onUpdate: 'CASCADE',
      onDelete: 'SET NULL'
    });

    // 3. Add index for efficient reporting/filtering by payment method & merchant
    await queryInterface.addIndex('orders', ['payment_method']);
    await queryInterface.addIndex('orders', ['merchant_id']);
  },

  async down(queryInterface, Sequelize) {
    // Remove columns and clean up Postgres ENUM type
    await queryInterface.removeColumn('orders', 'merchant_id');
    await queryInterface.removeColumn('orders', 'payment_method');
    
    // Drop ENUM type in Postgres if rolling back
    if (queryInterface.sequelize.getDialect() === 'postgres') {
      await queryInterface.sequelize.query('DROP TYPE IF EXISTS "enum_orders_payment_method";');
    }
  }
};