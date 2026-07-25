'use strict';

module.exports = {
  up: async (queryInterface, Sequelize) => {
    // 1. DROP OLD CONSTRAINTS (To clear the runway)
    try {
      await queryInterface.sequelize.query('ALTER TABLE "order_items" DROP CONSTRAINT IF EXISTS "order_items_order_id_fkey";');
      await queryInterface.sequelize.query('ALTER TABLE "order_items" DROP CONSTRAINT IF EXISTS "order_items_product_id_fkey";');
    } catch (e) {
      console.log('Constraints already cleared:', e.message);
    }

    // Helper to safely drop columns
    const safelyDropColumn = async (tableName, columnName) => {
      const tableDefinition = await queryInterface.describeTable(tableName);
      if (tableDefinition[columnName]) {
        await queryInterface.removeColumn(tableName, columnName);
        console.log(`Dropped column "${columnName}" from "${tableName}".`);
      }
    };

    // 2. DROP THE OLD FOREIGN KEY COLUMNS
    await safelyDropColumn('order_items', 'order_id');
    await safelyDropColumn('order_items', 'product_id');

    // 3. FORCE PRIMARY KEYS ON THE REFERENCED TABLES
    try {
      await queryInterface.sequelize.query('ALTER TABLE "orders" ADD CONSTRAINT "orders_pkey" PRIMARY KEY ("id");');
      console.log('Established primary key constraint on "orders" table.');
    } catch (e) {
      console.log('"orders" primary key already exists, skipping.');
    }

    try {
      await queryInterface.sequelize.query('ALTER TABLE "products" ADD CONSTRAINT "products_pkey" PRIMARY KEY ("id");');
      console.log('Established primary key constraint on "products" table.');
    } catch (e) {
      console.log('"products" primary key already exists, skipping.');
    }

    // 4. ADD THE NEW UUID FOREIGN KEYS
    await queryInterface.addColumn('order_items', 'order_id', {
      type: Sequelize.UUID,
      allowNull: false,
      references: {
        model: 'orders',
        key: 'id'
      },
      onUpdate: 'CASCADE',
      onDelete: 'CASCADE'
    });
    console.log('Added UUID column "order_id" to "order_items".');

    await queryInterface.addColumn('order_items', 'product_id', {
      type: Sequelize.UUID,
      allowNull: false,
      references: {
        model: 'products',
        key: 'id'
      },
      onUpdate: 'CASCADE',
      onDelete: 'CASCADE'
    });
    console.log('Added UUID column "product_id" to "order_items".');
  },

  down: async (queryInterface, Sequelize) => {
    throw new Error('Rollback to integer foreign keys is not supported.');
  }
};