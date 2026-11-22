'use strict';

module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.addColumn('expenses', 'entry_type', {
      type: Sequelize.STRING(32),
      allowNull: false,
      defaultValue: 'OPERATING_EXPENSE' // 'OPERATING_EXPENSE' | 'RESTOCK_INVENTORY'
    });

    await queryInterface.addColumn('expenses', 'affects_profit', {
      type: Sequelize.BOOLEAN,
      allowNull: false,
      defaultValue: true
    });

    // Backfill existing rows cleanly based on entry_type
    await queryInterface.sequelize.query(`
      UPDATE expenses
      SET affects_profit = CASE
        WHEN entry_type = 'RESTOCK_INVENTORY' THEN false
        ELSE true
      END;
    `);

    await queryInterface.addIndex('expenses', ['business_id', 'affects_profit'], {
      name: 'idx_expenses_business_profit'
    });
  },

  async down(queryInterface) {
    await queryInterface.removeIndex('expenses', 'idx_expenses_business_profit');
    await queryInterface.removeColumn('expenses', 'affects_profit');
    await queryInterface.removeColumn('expenses', 'entry_type');
  }
};