'use strict';

module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable('products', {
      id: {
        type: Sequelize.UUID,
        defaultValue: Sequelize.literal('gen_random_uuid()'),
        primaryKey: true,
        allowNull: false
      },
      name: {
        type: Sequelize.STRING
      },
      barcode: {
        type: Sequelize.STRING,
        allowNull: true,
        unique: true
      },
      buy_price: {
        type: Sequelize.FLOAT
      },
      sell_price: {
        type: Sequelize.FLOAT
      },
      quantity_in_stock: {
        type: Sequelize.INTEGER
      },
      reorder_level: {
        type: Sequelize.INTEGER
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

    await queryInterface.addIndex('products', ['barcode']);

    // Sequence & Trigger configuration for automated barcode generation
    await queryInterface.sequelize.query(`
      CREATE SEQUENCE IF NOT EXISTS product_barcode_seq START WITH 1;
    `);

    await queryInterface.sequelize.query(`
      CREATE OR REPLACE FUNCTION generate_product_barcode()
      RETURNS TRIGGER AS $$
      DECLARE
        next_val INT;
      BEGIN
        IF NEW.barcode IS NULL OR NEW.barcode = '' THEN
          SELECT nextval('product_barcode_seq') INTO next_val;
          NEW.barcode := 'prod-' || LPAD(next_val::text, 5, '0');
        END IF;
        RETURN NEW;
      END;
      $$ LANGUAGE plpgsql;
    `);

    await queryInterface.sequelize.query(`
      DROP TRIGGER IF EXISTS trg_pre_insert_product_barcode ON products;
      CREATE TRIGGER trg_pre_insert_product_barcode
      BEFORE INSERT ON products
      FOR EACH ROW
      EXECUTE FUNCTION generate_product_barcode();
    `);
  },

  async down(queryInterface) {
    await queryInterface.sequelize.query(`DROP TRIGGER IF EXISTS trg_pre_insert_product_barcode ON products;`);
    await queryInterface.sequelize.query(`DROP FUNCTION IF EXISTS generate_product_barcode();`);
    await queryInterface.sequelize.query(`DROP SEQUENCE IF EXISTS product_barcode_seq;`);
    await queryInterface.dropTable('products');
  }
};