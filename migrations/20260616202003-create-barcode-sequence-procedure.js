'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    // 1. Create a dedicated sequence for barcodes (independent of the table ID)
    await queryInterface.sequelize.query(`
      CREATE SEQUENCE IF NOT EXISTS product_barcode_seq START WITH 1;
    `);

    // 2. Create the database function using the new sequence
    await queryInterface.sequelize.query(`
      CREATE OR REPLACE FUNCTION generate_product_barcode()
      RETURNS TRIGGER AS $$
      DECLARE
        next_val INT;
      BEGIN
        -- Only generate a sequence code if the barcode column is left empty/null
        IF NEW.barcode IS NULL OR NEW.barcode = '' THEN
          
          -- Safely grab the next value from our dedicated barcode sequence
          SELECT nextval('product_barcode_seq') INTO next_val;

          -- Format with zero padding (e.g., DEL-00001)
          NEW.barcode := 'prod-' || LPAD(next_val::text, 5, '0');
          
        END IF;
        RETURN NEW;
      END;
      $$ LANGUAGE plpgsql;
    `);

    // 3. Bind the function to a BEFORE INSERT trigger on the products table
    await queryInterface.sequelize.query(`
      DROP TRIGGER IF EXISTS trg_pre_insert_product_barcode ON products;
      CREATE TRIGGER trg_pre_insert_product_barcode
      BEFORE INSERT ON products
      FOR EACH ROW
      EXECUTE FUNCTION generate_product_barcode();
    `);
  },

  async down(queryInterface, Sequelize) {
    // Drop trigger, function, and sequence clean if rolled back
    await queryInterface.sequelize.query(`DROP TRIGGER IF EXISTS trg_pre_insert_product_barcode ON products;`);
    await queryInterface.sequelize.query(`DROP FUNCTION IF EXISTS generate_product_barcode();`);
    await queryInterface.sequelize.query(`DROP SEQUENCE IF EXISTS product_barcode_seq;`);
  }
};