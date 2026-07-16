'use strict';

module.exports = {
  up: async (queryInterface, Sequelize) => {
    // 1. Drop existing foreign key constraints on stock_movements
    try {
      await queryInterface.sequelize.query('ALTER TABLE "stock_movements" DROP CONSTRAINT IF EXISTS "stock_movements_product_id_fkey";');
    } catch (e) {
      console.log('Constraints already cleared or bypassed:', e.message);
    }

    // Helper to safely drop columns
    const safelyDropColumn = async (tableName, columnName) => {
      const tableDefinition = await queryInterface.describeTable(tableName);
      if (tableDefinition[columnName]) {
        await queryInterface.removeColumn(tableName, columnName);
        console.log(`Dropped column "${columnName}" from "${tableName}".`);
      }
    };

    // 2. Drop the old integer product_id column
    await safelyDropColumn('stock_movements', 'product_id');

    // 3. Re-add product_id fresh as a UUID pointing to products.id
    await queryInterface.addColumn('stock_movements', 'product_id', {
      type: Sequelize.UUID,
      allowNull: false,
      references: {
        model: 'products',
        key: 'id'
      },
      onUpdate: 'CASCADE',
      onDelete: 'CASCADE'
    });
    console.log('Added UUID column "product_id" to "stock_movements".');
  },

  down: async (queryInterface, Sequelize) => {
    throw new Error('Rollback to integer foreign keys is not supported.');
  }
};