'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    // 1. Create the database function (Stored Procedure logic)
    await queryInterface.sequelize.query(`
      CREATE OR REPLACE FUNCTION generate_product_barcode()
      RETURNS TRIGGER AS $$
      DECLARE
        next_id INT;
      BEGIN
        -- Only generate a sequence code if the barcode column is left empty/null
        IF NEW.barcode IS NULL OR NEW.barcode = '' THEN
          
          -- Get the next auto-increment ID value safely from the table sequence
          SELECT COALESCE(last_value, 0) + 1 INTO next_id 
          FROM pg_sequences 
          WHERE sequencename = 'products_id_seq';

          -- Format with zero padding (e.g., DEL-00001)
          NEW.barcode := 'DEL-' || LPAD(next_id::text, 5, '0');
          
        END IF;
        RETURN NEW;
      END;
      $$ LANGUAGE plpgsql;
    `);

    // 2. Bind the function to a BEFORE INSERT trigger on the products table
    await queryInterface.sequelize.query(`
      CREATE TRIGGER trg_pre_insert_product_barcode
      BEFORE INSERT ON products
      FOR EACH ROW
      EXECUTE FUNCTION generate_product_barcode();
    `);
  },

  async down(queryInterface, Sequelize) {
    // Drop the trigger and procedure clean if rolled back
    await queryInterface.sequelize.query(`DROP TRIGGER IF EXISTS trg_pre_insert_product_barcode ON products;`);
    await queryInterface.sequelize.query(`DROP FUNCTION IF EXISTS generate_product_barcode();`);
  }
};