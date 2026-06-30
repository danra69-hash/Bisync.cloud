import type { VendorProductCatalogItem } from './vendorProductCatalog';

type ProductSeed = Omit<VendorProductCatalogItem, 'imageUrl'> & { imageUrl?: string };

function p(seed: ProductSeed): VendorProductCatalogItem {
  return {
    ...seed,
    imageUrl: seed.imageUrl ?? `https://picsum.photos/seed/${seed.id.toLowerCase()}/80/80`,
  };
}

/** Additional vendors V012–V031 and overlap products for compare-price tagging. */
export const EXTENDED_VENDOR_PRODUCTS: VendorProductCatalogItem[] = [
  // V012 Pacific Poultry
  p({ id: 'VP-CHT012', group: 'Proteins', vendorExternalId: 'V012', vendorName: 'Pacific Poultry Supply', productName: 'Chicken Thigh (skinless)', specification: 'Fresh boneless thigh, tray packed, chilled', deliveryPrice: 16.5, delivery: { orderUnit: 'Kg', orderQty: 5, packUnit: 'Kg', packQty: 1, unitUnit: 'Kg', unitQty: 1 } }),
  p({ id: 'VP-DUC012', group: 'Proteins', vendorExternalId: 'V012', vendorName: 'Pacific Poultry Supply', productName: 'Duck Breast', specification: 'Magret duck breast, trimmed, vacuum packed', deliveryPrice: 48, delivery: { orderUnit: 'Kg', orderQty: 1, packUnit: 'Kg', packQty: 1, unitUnit: 'Kg', unitQty: 1 } }),
  p({ id: 'VP-WCH012', group: 'Proteins', vendorExternalId: 'V012', vendorName: 'Pacific Poultry Supply', productName: 'Whole Free-range Chicken', specification: '1.4–1.6kg birds, halal certified', deliveryPrice: 28, delivery: { orderUnit: 'Kg', orderQty: 10, packUnit: 'Kg', packQty: 1, unitUnit: 'Kg', unitQty: 1 } }),

  // V013 Harbour Fish
  p({ id: 'VP-PRN013', group: 'Seafood', vendorExternalId: 'V013', vendorName: 'Harbour Fish Market', productName: 'Tiger Prawns', specification: 'U15 headless prawns, IQF frozen', deliveryPrice: 72, delivery: { orderUnit: 'Kg', orderQty: 1, packUnit: 'Kg', packQty: 1, unitUnit: 'Kg', unitQty: 1 } }),
  p({ id: 'VP-COD013', group: 'Seafood', vendorExternalId: 'V013', vendorName: 'Harbour Fish Market', productName: 'Atlantic Cod Fillet', specification: 'Skinless fillet portions, chilled', deliveryPrice: 42, delivery: { orderUnit: 'Kg', orderQty: 1, packUnit: 'Kg', packQty: 1, unitUnit: 'Kg', unitQty: 1 } }),
  p({ id: 'VP-TUN013', group: 'Seafood', vendorExternalId: 'V013', vendorName: 'Harbour Fish Market', productName: 'Bluefin Tuna Loin', specification: 'Sashimi grade loin, deep frozen', deliveryPrice: 135, delivery: { orderUnit: 'Kg', orderQty: 1, packUnit: 'Kg', packQty: 1, unitUnit: 'Kg', unitQty: 1 } }),

  // V014 Valley Dairy
  p({ id: 'VP-CRM014', group: 'Dairy', vendorExternalId: 'V014', vendorName: 'Valley Dairy Wholesale', productName: 'Heavy Cream', specification: '35% fat, 2L carton, chilled', deliveryPrice: 22, delivery: { orderUnit: 'Carton', orderQty: 1, packUnit: 'Ltr', packQty: 2, unitUnit: 'Ml', unitQty: 1000 } }),
  p({ id: 'VP-BUT014', group: 'Dairy', vendorExternalId: 'V014', vendorName: 'Valley Dairy Wholesale', productName: 'Unsalted Butter', specification: 'European style 82% fat, 25kg block', deliveryPrice: 385, delivery: { orderUnit: 'Block', orderQty: 1, packUnit: 'Kg', packQty: 25, unitUnit: 'Kg', unitQty: 1 } }),
  p({ id: 'VP-EGG014', group: 'Dairy', vendorExternalId: 'V014', vendorName: 'Valley Dairy Wholesale', productName: 'Free Range Eggs', specification: 'Grade A large eggs, 30-tray pack', deliveryPrice: 24, delivery: { orderUnit: 'Tray', orderQty: 1, packUnit: 'Each', packQty: 30, unitUnit: 'Each', unitQty: 1 } }),

  // V015 Mediterranean Oil
  p({ id: 'VP-OLV015', group: 'Dry Goods', vendorExternalId: 'V015', vendorName: 'Mediterranean Oil Co.', productName: 'Olive Oil Extra Virgin', specification: 'Cold-pressed, 5L tin, PDO', deliveryPrice: 185, delivery: { orderUnit: 'Tin', orderQty: 1, packUnit: 'Ltr', packQty: 5, unitUnit: 'Ml', unitQty: 1000 } }),
  p({ id: 'VP-BAL015', group: 'Dry Goods', vendorExternalId: 'V015', vendorName: 'Mediterranean Oil Co.', productName: 'Balsamic Vinegar', specification: 'Aged Modena IGP, 500ml bottle', deliveryPrice: 38, delivery: { orderUnit: 'Bottle', orderQty: 1, packUnit: 'Ml', packQty: 500, unitUnit: 'Ml', unitQty: 1 } }),
  p({ id: 'VP-SUN015', group: 'Dry Goods', vendorExternalId: 'V015', vendorName: 'Mediterranean Oil Co.', productName: 'Sunflower Oil', specification: 'Refined frying oil, 20L jerrycan', deliveryPrice: 95, delivery: { orderUnit: 'Jerrycan', orderQty: 1, packUnit: 'Ltr', packQty: 20, unitUnit: 'Ltr', unitQty: 1 } }),

  // V016 Spice Route
  p({ id: 'VP-SLT016', group: 'Dry Goods', vendorExternalId: 'V016', vendorName: 'Spice Route Trading', productName: 'Sea Salt Flakes', specification: 'Maldon style flakes, 1kg tub', deliveryPrice: 12, delivery: { orderUnit: 'Kg', orderQty: 1, packUnit: 'Kg', packQty: 1, unitUnit: 'Kg', unitQty: 1 } }),
  p({ id: 'VP-PEP016', group: 'Dry Goods', vendorExternalId: 'V016', vendorName: 'Spice Route Trading', productName: 'Black Peppercorns', specification: 'Whole Lampong pepper, 500g pouch', deliveryPrice: 28, delivery: { orderUnit: 'Pouch', orderQty: 1, packUnit: 'Gr', packQty: 500, unitUnit: 'Gr', unitQty: 1 } }),
  p({ id: 'VP-PAP016', group: 'Dry Goods', vendorExternalId: 'V016', vendorName: 'Spice Route Trading', productName: 'Smoked Paprika', specification: 'Sweet smoked paprika, 1kg tin', deliveryPrice: 32, delivery: { orderUnit: 'Tin', orderQty: 1, packUnit: 'Kg', packQty: 1, unitUnit: 'Kg', unitQty: 1 } }),

  // V017 Fresh Herb Gardens
  p({ id: 'VP-ROK017', group: 'Produce', vendorExternalId: 'V017', vendorName: 'Fresh Herb Gardens', productName: 'Rocket Arugula', specification: 'Washed baby rocket, 500g bag', deliveryPrice: 9.5, delivery: { orderUnit: 'Bag', orderQty: 1, packUnit: 'Gr', packQty: 500, unitUnit: 'Gr', unitQty: 1 } }),
  p({ id: 'VP-BAS017', group: 'Produce', vendorExternalId: 'V017', vendorName: 'Fresh Herb Gardens', productName: 'Fresh Basil', specification: 'Living basil pots, 12-pack', deliveryPrice: 36, delivery: { orderUnit: 'Tray', orderQty: 1, packUnit: 'Each', packQty: 12, unitUnit: 'Each', unitQty: 1 } }),
  p({ id: 'VP-PAR017', group: 'Produce', vendorExternalId: 'V017', vendorName: 'Fresh Herb Gardens', productName: 'Flat-leaf Parsley', specification: 'Bunched parsley, 1kg box', deliveryPrice: 14, delivery: { orderUnit: 'Box', orderQty: 1, packUnit: 'Kg', packQty: 1, unitUnit: 'Kg', unitQty: 1 } }),

  // V018 Grain & Mill
  p({ id: 'VP-RIC018', group: 'Dry Goods', vendorExternalId: 'V018', vendorName: 'Grain & Mill Co.', productName: 'Basmati Rice', specification: 'Aged basmati, 10kg sack', deliveryPrice: 68, delivery: { orderUnit: 'Sack', orderQty: 1, packUnit: 'Kg', packQty: 10, unitUnit: 'Kg', unitQty: 1 } }),
  p({ id: 'VP-FLR018', group: 'Dry Goods', vendorExternalId: 'V018', vendorName: 'Grain & Mill Co.', productName: '00 Flour', specification: 'Italian tipo 00, 25kg bag', deliveryPrice: 52, delivery: { orderUnit: 'Bag', orderQty: 1, packUnit: 'Kg', packQty: 25, unitUnit: 'Kg', unitQty: 1 } }),
  p({ id: 'VP-OAT018', group: 'Dry Goods', vendorExternalId: 'V018', vendorName: 'Grain & Mill Co.', productName: 'Rolled Oats', specification: 'Jumbo oats, 5kg bag', deliveryPrice: 28, delivery: { orderUnit: 'Bag', orderQty: 1, packUnit: 'Kg', packQty: 5, unitUnit: 'Kg', unitQty: 1 } }),

  // V019 Noodle House
  p({ id: 'VP-PEN019', group: 'Dry Goods', vendorExternalId: 'V019', vendorName: 'Noodle House Supply', productName: 'Penne Pasta', specification: 'Bronze die penne, 5kg case', deliveryPrice: 32, delivery: { orderUnit: 'Case', orderQty: 1, packUnit: 'Kg', packQty: 5, unitUnit: 'Kg', unitQty: 1 } }),
  p({ id: 'VP-SPG019', group: 'Dry Goods', vendorExternalId: 'V019', vendorName: 'Noodle House Supply', productName: 'Spaghetti', specification: 'Durum wheat spaghetti, 5kg case', deliveryPrice: 30, delivery: { orderUnit: 'Case', orderQty: 1, packUnit: 'Kg', packQty: 5, unitUnit: 'Kg', unitQty: 1 } }),
  p({ id: 'VP-UDN019', group: 'Dry Goods', vendorExternalId: 'V019', vendorName: 'Noodle House Supply', productName: 'Fresh Udon Noodles', specification: 'Frozen udon blocks, 24-pack', deliveryPrice: 48, delivery: { orderUnit: 'Box', orderQty: 1, packUnit: 'Each', packQty: 24, unitUnit: 'Each', unitQty: 1 } }),

  // V020 Frozen Foods Express
  p({ id: 'VP-PEA020', group: 'Produce', vendorExternalId: 'V020', vendorName: 'Frozen Foods Express', productName: 'Garden Peas', specification: 'IQF peas, 2.5kg bag', deliveryPrice: 18, delivery: { orderUnit: 'Bag', orderQty: 1, packUnit: 'Kg', packQty: 2.5, unitUnit: 'Kg', unitQty: 1 } }),
  p({ id: 'VP-FRY020', group: 'Dry Goods', vendorExternalId: 'V020', vendorName: 'Frozen Foods Express', productName: 'Shoestring Fries', specification: '9mm fries, 2.5kg bag', deliveryPrice: 22, delivery: { orderUnit: 'Bag', orderQty: 1, packUnit: 'Kg', packQty: 2.5, unitUnit: 'Kg', unitQty: 1 } }),
  p({ id: 'VP-BER020', group: 'Produce', vendorExternalId: 'V020', vendorName: 'Frozen Foods Express', productName: 'Mixed Berries', specification: 'IQF raspberry/blueberry blend, 1kg', deliveryPrice: 35, delivery: { orderUnit: 'Bag', orderQty: 1, packUnit: 'Kg', packQty: 1, unitUnit: 'Kg', unitQty: 1 } }),

  // V021 Juice Factory
  p({ id: 'VP-OJ021', group: 'Beverages', vendorExternalId: 'V021', vendorName: 'Juice Factory Direct', productName: 'Fresh Orange Juice', specification: 'Not-from-concentrate, 5L bag-in-box', deliveryPrice: 42, delivery: { orderUnit: 'Box', orderQty: 1, packUnit: 'Ltr', packQty: 5, unitUnit: 'Ml', unitQty: 1000 } }),
  p({ id: 'VP-APL021', group: 'Beverages', vendorExternalId: 'V021', vendorName: 'Juice Factory Direct', productName: 'Cloudy Apple Juice', specification: 'Cold-pressed, 5L bag-in-box', deliveryPrice: 38, delivery: { orderUnit: 'Box', orderQty: 1, packUnit: 'Ltr', packQty: 5, unitUnit: 'Ml', unitQty: 1000 } }),
  p({ id: 'VP-LIM021', group: 'Beverages', vendorExternalId: 'V021', vendorName: 'Juice Factory Direct', productName: 'Lime Juice', specification: 'Pasteurised lime, 1L bottle', deliveryPrice: 12, delivery: { orderUnit: 'Bottle', orderQty: 1, packUnit: 'Ltr', packQty: 1, unitUnit: 'Ltr', unitQty: 1 } }),

  // V022 Craft Brew
  p({ id: 'VP-IPA022', group: 'Beverages', vendorExternalId: 'V022', vendorName: 'Craft Brew Alliance', productName: 'Craft IPA Beer', specification: '6.2% ABV, 30L keg', deliveryPrice: 195, delivery: { orderUnit: 'Keg', orderQty: 1, packUnit: 'Ltr', packQty: 30, unitUnit: 'Ltr', unitQty: 1 } }),
  p({ id: 'VP-LAG022', group: 'Beverages', vendorExternalId: 'V022', vendorName: 'Craft Brew Alliance', productName: 'Craft Lager', specification: '4.8% ABV, 30L keg', deliveryPrice: 175, delivery: { orderUnit: 'Keg', orderQty: 1, packUnit: 'Ltr', packQty: 30, unitUnit: 'Ltr', unitQty: 1 } }),
  p({ id: 'VP-STO022', group: 'Beverages', vendorExternalId: 'V022', vendorName: 'Craft Brew Alliance', productName: 'Oatmeal Stout', specification: '5.5% ABV, 20L keg', deliveryPrice: 165, delivery: { orderUnit: 'Keg', orderQty: 1, packUnit: 'Ltr', packQty: 20, unitUnit: 'Ltr', unitQty: 1 } }),

  // V023 Tea & Tisane
  p({ id: 'VP-EGR023', group: 'Beverages', vendorExternalId: 'V023', vendorName: 'Tea & Tisane Co.', productName: 'Earl Grey Loose Leaf', specification: 'Bergamot black tea, 500g pouch', deliveryPrice: 45, delivery: { orderUnit: 'Pouch', orderQty: 1, packUnit: 'Gr', packQty: 500, unitUnit: 'Gr', unitQty: 1 } }),
  p({ id: 'VP-GRN023', group: 'Beverages', vendorExternalId: 'V023', vendorName: 'Tea & Tisane Co.', productName: 'Sencha Green Tea', specification: 'Japanese sencha, 250g pouch', deliveryPrice: 38, delivery: { orderUnit: 'Pouch', orderQty: 1, packUnit: 'Gr', packQty: 250, unitUnit: 'Gr', unitQty: 1 } }),

  // V024 Syrup & Mixers
  p({ id: 'VP-TON024', group: 'Beverages', vendorExternalId: 'V024', vendorName: 'Syrup & Mixers Ltd', productName: 'Tonic Water', specification: 'Premium tonic, 24x200ml case', deliveryPrice: 52, delivery: { orderUnit: 'Case', orderQty: 1, packUnit: 'Bottle', packQty: 24, unitUnit: 'Ml', unitQty: 200 } }),
  p({ id: 'VP-COL024', group: 'Beverages', vendorExternalId: 'V024', vendorName: 'Syrup & Mixers Ltd', productName: 'Cola Syrup', specification: 'Post-mix cola concentrate, 5L', deliveryPrice: 48, delivery: { orderUnit: 'Bottle', orderQty: 1, packUnit: 'Ltr', packQty: 5, unitUnit: 'Ltr', unitQty: 1 } }),
  p({ id: 'VP-GRE024', group: 'Beverages', vendorExternalId: 'V024', vendorName: 'Syrup & Mixers Ltd', productName: 'Grenadine Syrup', specification: 'Bar grenadine, 1L bottle', deliveryPrice: 18, delivery: { orderUnit: 'Bottle', orderQty: 1, packUnit: 'Ltr', packQty: 1, unitUnit: 'Ltr', unitQty: 1 } }),

  // V025 Plant Milk
  p({ id: 'VP-OAT025', group: 'Beverages', vendorExternalId: 'V025', vendorName: 'Plant Milk Wholesale', productName: 'Oat Milk Barista', specification: 'Barista blend, 12x1L case', deliveryPrice: 54, delivery: { orderUnit: 'Case', orderQty: 1, packUnit: 'Ltr', packQty: 12, unitUnit: 'Ml', unitQty: 1000 } }),
  p({ id: 'VP-ALM025', group: 'Beverages', vendorExternalId: 'V025', vendorName: 'Plant Milk Wholesale', productName: 'Almond Milk', specification: 'Unsweetened, 12x1L case', deliveryPrice: 58, delivery: { orderUnit: 'Case', orderQty: 1, packUnit: 'Ltr', packQty: 12, unitUnit: 'Ml', unitQty: 1000 } }),

  // V026 Butcher Block
  p({ id: 'VP-LMB026', group: 'Proteins', vendorExternalId: 'V026', vendorName: 'Butcher Block Prime', productName: 'Lamb Rack', specification: 'French-trimmed rack, 8-rib, chilled', deliveryPrice: 118, delivery: { orderUnit: 'Kg', orderQty: 1, packUnit: 'Kg', packQty: 1, unitUnit: 'Kg', unitQty: 1 } }),
  p({ id: 'VP-POR026', group: 'Proteins', vendorExternalId: 'V026', vendorName: 'Butcher Block Prime', productName: 'Pork Belly', specification: 'Skin-on belly, slab cut', deliveryPrice: 32, delivery: { orderUnit: 'Kg', orderQty: 1, packUnit: 'Kg', packQty: 1, unitUnit: 'Kg', unitQty: 1 } }),
  p({ id: 'VP-WAG026', group: 'Proteins', vendorExternalId: 'V026', vendorName: 'Butcher Block Prime', productName: 'Wagyu Striploin', specification: 'MB4+ striploin, chilled', deliveryPrice: 295, delivery: { orderUnit: 'Kg', orderQty: 1, packUnit: 'Kg', packQty: 1, unitUnit: 'Kg', unitQty: 1 } }),

  // V027 Organic Veg Hub
  p({ id: 'VP-TOM027', group: 'Produce', vendorExternalId: 'V027', vendorName: 'Organic Veg Hub', productName: 'Roma Tomatoes', specification: 'Organic roma, 5kg crate', deliveryPrice: 28, delivery: { orderUnit: 'Crate', orderQty: 1, packUnit: 'Kg', packQty: 5, unitUnit: 'Kg', unitQty: 1 } }),
  p({ id: 'VP-ONI027', group: 'Produce', vendorExternalId: 'V027', vendorName: 'Organic Veg Hub', productName: 'Yellow Onions', specification: 'Organic brown onions, 10kg sack', deliveryPrice: 22, delivery: { orderUnit: 'Sack', orderQty: 1, packUnit: 'Kg', packQty: 10, unitUnit: 'Kg', unitQty: 1 } }),
  p({ id: 'VP-POT027', group: 'Produce', vendorExternalId: 'V027', vendorName: 'Organic Veg Hub', productName: 'Russet Potatoes', specification: 'Organic baking potatoes, 10kg sack', deliveryPrice: 26, delivery: { orderUnit: 'Sack', orderQty: 1, packUnit: 'Kg', packQty: 10, unitUnit: 'Kg', unitQty: 1 } }),

  // V028 Condiment Central
  p({ id: 'VP-PAS028', group: 'Dry Goods', vendorExternalId: 'V028', vendorName: 'Condiment Central', productName: 'Tomato Passata', specification: 'Smooth passata, 3x3L pack', deliveryPrice: 36, delivery: { orderUnit: 'Pack', orderQty: 1, packUnit: 'Ltr', packQty: 3, unitUnit: 'Ml', unitQty: 1000 } }),
  p({ id: 'VP-KET028', group: 'Dry Goods', vendorExternalId: 'V028', vendorName: 'Condiment Central', productName: 'Tomato Ketchup', specification: 'Food-service squeeze, 4x5L', deliveryPrice: 42, delivery: { orderUnit: 'Case', orderQty: 1, packUnit: 'Ltr', packQty: 5, unitUnit: 'Ltr', unitQty: 1 } }),
  p({ id: 'VP-MAY028', group: 'Dry Goods', vendorExternalId: 'V028', vendorName: 'Condiment Central', productName: 'Whole Egg Mayo', specification: 'Classic mayo, 10L tub', deliveryPrice: 68, delivery: { orderUnit: 'Tub', orderQty: 1, packUnit: 'Ltr', packQty: 10, unitUnit: 'Ltr', unitQty: 1 } }),

  // V029 Bakery Ingredients
  p({ id: 'VP-FLR029', group: 'Dry Goods', vendorExternalId: 'V029', vendorName: 'Bakery Ingredients MY', productName: '00 Flour', specification: 'Strong white 00, 25kg sack', deliveryPrice: 48, delivery: { orderUnit: 'Sack', orderQty: 1, packUnit: 'Kg', packQty: 25, unitUnit: 'Kg', unitQty: 1 } }),
  p({ id: 'VP-YST029', group: 'Dry Goods', vendorExternalId: 'V029', vendorName: 'Bakery Ingredients MY', productName: 'Instant Dry Yeast', specification: '500g vacuum pack', deliveryPrice: 14, delivery: { orderUnit: 'Pack', orderQty: 1, packUnit: 'Gr', packQty: 500, unitUnit: 'Gr', unitQty: 1 } }),
  p({ id: 'VP-SUG029', group: 'Dry Goods', vendorExternalId: 'V029', vendorName: 'Bakery Ingredients MY', productName: 'Caster Sugar', specification: 'Fine caster, 25kg bag', deliveryPrice: 42, delivery: { orderUnit: 'Bag', orderQty: 1, packUnit: 'Kg', packQty: 25, unitUnit: 'Kg', unitQty: 1 } }),

  // V030 Imported Cheese
  p({ id: 'VP-MOZ030', group: 'Dairy', vendorExternalId: 'V030', vendorName: 'Imported Cheese Cellar', productName: 'Mozzarella Fior di Latte', specification: 'Fresh mozzarella logs, 2x2.5kg', deliveryPrice: 88, delivery: { orderUnit: 'Case', orderQty: 1, packUnit: 'Kg', packQty: 5, unitUnit: 'Kg', unitQty: 1 } }),
  p({ id: 'VP-PAR030', group: 'Dairy', vendorExternalId: 'V030', vendorName: 'Imported Cheese Cellar', productName: 'Parmesan Reggiano', specification: '24-month wedge, 1kg avg', deliveryPrice: 145, delivery: { orderUnit: 'Kg', orderQty: 1, packUnit: 'Kg', packQty: 1, unitUnit: 'Kg', unitQty: 1 } }),
  p({ id: 'VP-BUR030', group: 'Dairy', vendorExternalId: 'V030', vendorName: 'Imported Cheese Cellar', productName: 'Burrata', specification: '125g cups, 12-pack case', deliveryPrice: 58, delivery: { orderUnit: 'Case', orderQty: 1, packUnit: 'Each', packQty: 12, unitUnit: 'Each', unitQty: 1 } }),

  // V031 Bottled Water
  p({ id: 'VP-STL031', group: 'Beverages', vendorExternalId: 'V031', vendorName: 'Bottled Water Works', productName: 'Still Spring Water', specification: '500ml bottles, 24-pack', deliveryPrice: 18, delivery: { orderUnit: 'Case', orderQty: 1, packUnit: 'Bottle', packQty: 24, unitUnit: 'Ml', unitQty: 500 } }),
  p({ id: 'VP-SPK031', group: 'Beverages', vendorExternalId: 'V031', vendorName: 'Bottled Water Works', productName: 'Sparkling Mineral Water', specification: '750ml glass, 12-pack', deliveryPrice: 42, delivery: { orderUnit: 'Case', orderQty: 1, packUnit: 'Bottle', packQty: 12, unitUnit: 'Ml', unitQty: 750 } }),

  // Overlap on existing vendors for richer compare chart
  p({ id: 'VP-LMB001', group: 'Proteins', vendorExternalId: 'V001', vendorName: 'Premium Meats Co.', productName: 'Lamb Rack', specification: 'NZ lamb rack, frenched, chilled', deliveryPrice: 125, delivery: { orderUnit: 'Kg', orderQty: 1, packUnit: 'Kg', packQty: 1, unitUnit: 'Kg', unitQty: 1 } }),
  p({ id: 'VP-OLV007', group: 'Dry Goods', vendorExternalId: 'V007', vendorName: 'Heritage Pantry Supply', productName: 'Olive Oil Extra Virgin', specification: 'Spanish EVOO, 5L tin', deliveryPrice: 165, delivery: { orderUnit: 'Tin', orderQty: 1, packUnit: 'Ltr', packQty: 5, unitUnit: 'Ml', unitQty: 1000 } }),
  p({ id: 'VP-PAS007', group: 'Dry Goods', vendorExternalId: 'V007', vendorName: 'Heritage Pantry Supply', productName: 'Tomato Passata', specification: 'Italian passata, 3x2.5L', deliveryPrice: 32, delivery: { orderUnit: 'Pack', orderQty: 1, packUnit: 'Ltr', packQty: 2.5, unitUnit: 'Ml', unitQty: 1000 } }),
  p({ id: 'VP-PAS011', group: 'Dry Goods', vendorExternalId: 'V011', vendorName: 'Metro Canned Foods', productName: 'Tomato Passata', specification: 'Metro chef passata, 3x3L', deliveryPrice: 34, delivery: { orderUnit: 'Pack', orderQty: 1, packUnit: 'Ltr', packQty: 3, unitUnit: 'Ml', unitQty: 1000 } }),
  p({ id: 'VP-OJ006', group: 'Beverages', vendorExternalId: 'V006', vendorName: 'Green Valley Produce', productName: 'Fresh Orange Juice', specification: 'Cold-pressed OJ, 2L bottle', deliveryPrice: 18, delivery: { orderUnit: 'Bottle', orderQty: 1, packUnit: 'Ltr', packQty: 2, unitUnit: 'Ml', unitQty: 1000 } }),
  p({ id: 'VP-RED004', group: 'Beverages', vendorExternalId: 'V004', vendorName: 'Wine & Spirits Direct', productName: 'House Red Wine', specification: 'Cask wine, 5L bag-in-box', deliveryPrice: 55, delivery: { orderUnit: 'Box', orderQty: 1, packUnit: 'Ltr', packQty: 5, unitUnit: 'Ml', unitQty: 1000 } }),
  p({ id: 'VP-GAR006', group: 'Produce', vendorExternalId: 'V006', vendorName: 'Green Valley Produce', productName: 'Peeled Garlic', specification: 'Peeled cloves, 1kg tub', deliveryPrice: 16, delivery: { orderUnit: 'Tub', orderQty: 1, packUnit: 'Kg', packQty: 1, unitUnit: 'Kg', unitQty: 1 } }),
];

export const EXTENDED_VENDOR_CONTACTS: Record<string, {
  contactPerson: string;
  contactPosition: string;
  mobile: string;
  email: string;
}> = {
  V012: { contactPerson: 'Tan Mei Ling', contactPosition: 'Sales Manager', mobile: '+60 12-111 2233', email: 'sales@pacificpoultry.my' },
  V013: { contactPerson: 'Captain Wong', contactPosition: 'Account Manager', mobile: '+60 16-222 3344', email: 'orders@harbourfish.my' },
  V014: { contactPerson: 'Priya Nair', contactPosition: 'Sales Executive', mobile: '+60 17-333 4455', email: 'wholesale@valleydairy.my' },
  V015: { contactPerson: 'Marco Rossi', contactPosition: 'Sales Manager', mobile: '+60 18-444 5566', email: 'marco@medoil.my' },
  V016: { contactPerson: 'Aisha Rahman', contactPosition: 'Account Manager', mobile: '+60 19-555 6677', email: 'aisha@spiceroute.my' },
  V017: { contactPerson: 'David Choong', contactPosition: 'Sales Executive', mobile: '+60 12-666 7788', email: 'orders@freshherb.my' },
  V018: { contactPerson: 'Hassan Ibrahim', contactPosition: 'Sales Manager', mobile: '+60 13-777 8899', email: 'sales@grainmill.my' },
  V019: { contactPerson: 'Lily Tan', contactPosition: 'Account Manager', mobile: '+60 14-888 9900', email: 'lily@noodlehouse.my' },
  V020: { contactPerson: 'Kevin Lim', contactPosition: 'Sales Executive', mobile: '+60 15-999 0011', email: 'kevin@frozenexpress.my' },
  V021: { contactPerson: 'Siti Aminah', contactPosition: 'Sales Manager', mobile: '+60 16-101 1122', email: 'orders@juicefactory.my' },
  V022: { contactPerson: 'Jake Morrison', contactPosition: 'Account Manager', mobile: '+60 17-202 2233', email: 'jake@craftbrew.my' },
  V023: { contactPerson: 'Mei Lin', contactPosition: 'Sales Executive', mobile: '+60 18-303 3344', email: 'sales@teatisane.my' },
  V024: { contactPerson: 'Raj Patel', contactPosition: 'Sales Manager', mobile: '+60 19-404 4455', email: 'raj@syrupmixers.my' },
  V025: { contactPerson: 'Emma Walsh', contactPosition: 'Account Manager', mobile: '+60 12-505 5566', email: 'emma@plantmilk.my' },
  V026: { contactPerson: 'Frankie Ho', contactPosition: 'Sales Manager', mobile: '+60 13-606 6677', email: 'frankie@butcherblock.my' },
  V027: { contactPerson: 'Nadia Yusof', contactPosition: 'Sales Executive', mobile: '+60 14-707 7788', email: 'nadia@organicveg.my' },
  V028: { contactPerson: 'Vikram Singh', contactPosition: 'Account Manager', mobile: '+60 15-808 8899', email: 'vikram@condiment.my' },
  V029: { contactPerson: 'Christine Lee', contactPosition: 'Sales Manager', mobile: '+60 16-909 9900', email: 'christine@bakerying.my' },
  V030: { contactPerson: 'Giuseppe Conti', contactPosition: 'Account Manager', mobile: '+60 17-010 1011', email: 'giuseppe@cheesecellar.my' },
  V031: { contactPerson: 'Azman Hakim', contactPosition: 'Sales Executive', mobile: '+60 18-121 2122', email: 'azman@waterworks.my' },
};
