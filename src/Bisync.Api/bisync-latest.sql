PRAGMA foreign_keys=OFF;
BEGIN TRANSACTION;
CREATE TABLE IF NOT EXISTS "DevelopmentMilestones" (

    "Id" INTEGER NOT NULL CONSTRAINT "PK_DevelopmentMilestones" PRIMARY KEY AUTOINCREMENT,

    "Phase" TEXT NOT NULL,

    "Title" TEXT NOT NULL,

    "Status" TEXT NOT NULL,

    "ProgressPercent" INTEGER NOT NULL,

    "Notes" TEXT NULL,

    "UpdatedAt" TEXT NOT NULL

);
INSERT INTO DevelopmentMilestones VALUES(1,'Foundation','Figma design import','completed',100,'Imported from Figma Make Bisync.cloud design','2026-06-25 00:57:32.2654159');
INSERT INTO DevelopmentMilestones VALUES(2,'Foundation','C# API + SQLite database','completed',100,'ASP.NET Core Web API with EF Core','2026-06-25 00:57:32.2655702');
INSERT INTO DevelopmentMilestones VALUES(3,'Foundation','Local development environment','in_progress',80,'localhost API + React client','2026-06-25 00:57:32.2655703');
INSERT INTO DevelopmentMilestones VALUES(4,'Core','Dashboard API integration','in_progress',40,'Locations, revenue, menu endpoints','2026-06-25 00:57:32.2655704');
INSERT INTO DevelopmentMilestones VALUES(5,'Core','Revenue Management module','pending',10,'Ingredients, vendors, purchase orders','2026-06-25 00:57:32.2655705');
INSERT INTO DevelopmentMilestones VALUES(6,'Core','Point-of-Sales module','pending',0,NULL,'2026-06-25 00:57:32.2655706');
INSERT INTO DevelopmentMilestones VALUES(7,'Platform','Authentication & multi-tenant','pending',0,NULL,'2026-06-25 00:57:32.2655706');
INSERT INTO DevelopmentMilestones VALUES(8,'Platform','Production deployment','pending',0,NULL,'2026-06-25 00:57:32.2655707');
CREATE TABLE IF NOT EXISTS "Ingredients" (

    "Id" INTEGER NOT NULL CONSTRAINT "PK_Ingredients" PRIMARY KEY AUTOINCREMENT,

    "Name" TEXT NOT NULL,

    "Category" TEXT NOT NULL,

    "Group" TEXT NOT NULL,

    "RecipeUom" TEXT NOT NULL,

    "InventoryUom" TEXT NOT NULL,

    "LastPriceRecipe" TEXT NOT NULL,

    "LastPriceInventory" TEXT NOT NULL,

    "DailyUsage" TEXT NOT NULL,

    "OrderFreqDays" INTEGER NOT NULL,

    "StorageJson" TEXT NOT NULL,

    "AttachedProducts" INTEGER NOT NULL,

    "AttachedVendors" INTEGER NOT NULL,

    "Active" INTEGER NOT NULL,

    "LocationsJson" TEXT NOT NULL

, "ComponentId" TEXT NOT NULL DEFAULT '', "StorageNote" TEXT NOT NULL DEFAULT '', "DetailConfigJson" TEXT NOT NULL DEFAULT '{}');
INSERT INTO Ingredients VALUES(1,'Wagyu Beef A5','Food','Proteins','g','kg','0.021','42.0','2.4',3,'["Freezer"]',3,2,1,'["downtown","midtown"]','CMP-WAGYUB-001','','{"altRecipeUnits":[],"altInventoryUnits":[],"convertFromInventoryQty":"1","convertToRecipeQty":"1","taggedVendorProductIds":["VP-CHX001","VP-WAG001"],"vendorProductPrincipalQty":{"VP-CHX001":"2000","VP-WAG001":"1000"},"vendorProductLossYield":{"VP-WAG001":"20"},"vendorProductComponentUom":{"VP-CHX001":"Gr","VP-WAG001":"Gr"},"vendorProductLocations":{"VP-CHX001":["airport","downtown","sg-marina","au-cbd","midtown","sg-orchard","au-southbank","westend"],"VP-WAG001":["airport","downtown","midtown","westend"]},"vendor":"Premium Meats Co.","vendorProduct":"Free-range Chicken Breast","deliveryUnitPrice":"42"}');
INSERT INTO Ingredients VALUES(2,'Black Truffle','Food','Produce','g','g','2.0','180.0','45.0',7,'["Chiller"]',2,1,1,'["downtown"]','CMP-BLACKT-001','','{"altRecipeUnits":[{"fromQty":"1","qty":"5","unit":"Slice"}],"altInventoryUnits":[],"convertFromInventoryQty":"1","convertToRecipeQty":"1","taggedVendorProductIds":["VP-TRU001"],"vendorProductPrincipalQty":{},"vendorProductLossYield":{"VP-TRU001":"10"},"vendorProductComponentUom":{},"vendorProductLocations":{"VP-TRU001":["downtown","airport"]},"vendor":"Fine Truffle Imports","vendorProduct":"Black Truffle","deliveryUnitPrice":"180"}');
INSERT INTO Ingredients VALUES(3,'Burrata','Food','Dairy','pcs','pcs','8.75','52.5','8.0',2,'["Chiller"]',4,1,1,'["all"]','CMP-BURRAT-001','','{"altRecipeUnits":[],"altInventoryUnits":[],"convertFromInventoryQty":"1","convertToRecipeQty":"1","taggedVendorProductIds":["VP-BUR001"],"vendorProductPrincipalQty":{"VP-BUR001":"6"},"vendorProductLossYield":{"VP-BUR001":"0"},"vendorProductComponentUom":{"VP-BUR001":"Each"},"vendorProductLocations":{"VP-BUR001":["airport","downtown"]},"vendor":"Artisan Dairy Co.","vendorProduct":"Burrata","deliveryUnitPrice":"52.5"}');
INSERT INTO Ingredients VALUES(4,'Baked Beans','Food','Dry Goods','g','g','0.00875','42.0','0.0',7,'["Dry Store","Chiller"]',0,2,1,'["all"]','CMP-BAKEDB-001','Once Opened, keep in chiller','{"altRecipeUnits":[],"altInventoryUnits":[{"fromQty":"1","qty":"400","unit":"Tin"}],"convertFromInventoryQty":"1","convertToRecipeQty":"1","taggedVendorProductIds":["VP-BEA001","VP-BEA002"],"vendorProductPrincipalQty":{"VP-BEA001":"4800","VP-BEA002":"4560"},"vendorProductLossYield":{"VP-BEA001":"0","VP-BEA002":"0"},"vendorProductComponentUom":{"VP-BEA001":"Gr","VP-BEA002":"Gr"},"vendorProductLocations":{"VP-BEA001":["downtown","midtown"],"VP-BEA002":["airport","downtown","midtown","westend"]},"vendor":"Heritage Pantry Supply","vendorProduct":"Baked Beans","deliveryUnitPrice":"42"}');
INSERT INTO Ingredients VALUES(5,'Lamb Rack','Food','Proteins','g','kg','0.95','95.0','1.8',4,'["Chiller"]',0,0,1,'["all"]','CMP-LAMBRA-001','','{}');
INSERT INTO Ingredients VALUES(6,'Duck Breast','Food','Proteins','g','kg','0.42','42.0','2.2',3,'["Chiller"]',0,0,1,'["all"]','CMP-DUCKBR-001','','{}');
INSERT INTO Ingredients VALUES(7,'Pork Belly','Food','Proteins','g','kg','0.28','28.0','3.5',3,'["Chiller"]',0,0,1,'["all"]','CMP-PORKBE-001','','{}');
INSERT INTO Ingredients VALUES(8,'Chicken Thigh','Food','Proteins','g','kg','0.18','18.0','5.0',2,'["Chiller"]',0,0,1,'["all"]','CMP-CHICKE-001','','{}');
INSERT INTO Ingredients VALUES(9,'Tiger Prawns','Food','Seafood','g','kg','0.65','65.0','2.8',3,'["Freezer"]',0,0,1,'["all"]','CMP-TIGERP-001','','{}');
INSERT INTO Ingredients VALUES(10,'Bluefin Tuna','Food','Seafood','g','kg','1.2','120.0','1.5',4,'["Freezer"]',0,0,1,'["all"]','CMP-BLUEFI-001','','{}');
INSERT INTO Ingredients VALUES(11,'Atlantic Cod','Food','Seafood','g','kg','0.38','38.0','2.4',3,'["Chiller"]',0,0,1,'["all"]','CMP-ATLANT-001','','{}');
INSERT INTO Ingredients VALUES(12,'Mozzarella Fior di Latte','Food','Dairy','g','kg','0.045','45.0','2.0',2,'["Chiller"]',0,0,1,'["all"]','CMP-MOZZAR-001','','{}');
INSERT INTO Ingredients VALUES(13,'Parmesan Reggiano','Food','Dairy','g','kg','0.12','120.0','0.8',7,'["Chiller"]',0,0,1,'["all"]','CMP-PARMES-001','','{}');
INSERT INTO Ingredients VALUES(14,'Unsalted Butter','Food','Dairy','g','kg','0.035','35.0','1.2',5,'["Chiller"]',0,0,1,'["all"]','CMP-UNSALT-001','','{}');
INSERT INTO Ingredients VALUES(15,'Heavy Cream','Food','Dairy','ml','l','0.018','18.0','3.5',3,'["Chiller"]',0,0,1,'["all"]','CMP-HEAVYC-001','','{}');
INSERT INTO Ingredients VALUES(16,'Free Range Eggs','Food','Dairy','pcs','pcs','0.85','0.85','120.0',2,'["Chiller"]',0,0,1,'["all"]','CMP-FREERA-001','','{}');
INSERT INTO Ingredients VALUES(17,'Rocket Arugula','Food','Produce','g','kg','0.022','22.0','1.5',2,'["Chiller"]',0,0,1,'["all"]','CMP-ROCKET-001','','{}');
INSERT INTO Ingredients VALUES(18,'Roma Tomatoes','Food','Produce','g','kg','0.008','8.0','4.0',2,'["Chiller"]',0,0,1,'["all"]','CMP-ROMATO-001','','{}');
INSERT INTO Ingredients VALUES(19,'Yellow Onions','Food','Produce','g','kg','0.004','4.0','3.0',3,'["Dry Store"]',0,0,1,'["all"]','CMP-YELLOW-001','','{}');
INSERT INTO Ingredients VALUES(20,'Peeled Garlic','Food','Produce','g','kg','0.016842105263157894','16.0','0.6',5,'["Chiller"]',0,1,1,'["all"]','CMP-PEELED-001','','{"altRecipeUnits":[],"altInventoryUnits":[],"convertFromInventoryQty":"1","convertToRecipeQty":"1","taggedVendorProductIds":["VP-GAR006"],"vendorProductPrincipalQty":{"VP-GAR006":"1000"},"vendorProductLossYield":{"VP-GAR006":"5"},"vendorProductComponentUom":{"VP-GAR006":"Gr"},"vendorProductLocations":{"VP-GAR006":["airport"]},"vendor":"Green Valley Produce","vendorProduct":"Peeled Garlic","deliveryUnitPrice":"16"}');
INSERT INTO Ingredients VALUES(21,'Russet Potatoes','Food','Produce','g','kg','0.003','3.0','8.0',4,'["Dry Store"]',0,0,1,'["all"]','CMP-RUSSET-001','','{}');
INSERT INTO Ingredients VALUES(22,'Basmati Rice','Food','Dry Goods','g','kg','0.006','6.0','2.5',7,'["Dry Store"]',0,0,1,'["all"]','CMP-BASMAT-001','','{}');
INSERT INTO Ingredients VALUES(23,'Penne Pasta','Food','Dry Goods','g','kg','0.005','5.0','3.0',10,'["Dry Store"]',0,0,1,'["all"]','CMP-PENNEP-001','','{}');
INSERT INTO Ingredients VALUES(24,'00 Flour','Food','Dry Goods','g','kg','0.00208','11.0','4.0',14,'["Dry Store"]',0,1,1,'["all"]','CMP-00FLOU-001','','{"altRecipeUnits":[],"altInventoryUnits":[],"convertFromInventoryQty":"1","convertToRecipeQty":"1","taggedVendorProductIds":["VP-FLR018"],"vendorProductPrincipalQty":{},"vendorProductLossYield":{},"vendorProductComponentUom":{},"vendorProductLocations":{"VP-FLR018":["airport","downtown","midtown","westend"]},"vendor":"Grain & Mill Co.","vendorProduct":"00 Flour","deliveryUnitPrice":"52"}');
INSERT INTO Ingredients VALUES(25,'Olive Oil Extra Virgin','Food','Dry Goods','ml','l','0.012','12.0','0.8',14,'["Dry Store"]',0,0,1,'["all"]','CMP-OLIVEO-001','','{}');
INSERT INTO Ingredients VALUES(26,'Balsamic Vinegar','Food','Dry Goods','ml','l','0.025','25.0','0.3',21,'["Dry Store"]',0,0,1,'["all"]','CMP-BALSAM-001','','{}');
INSERT INTO Ingredients VALUES(27,'Sea Salt Flakes','Food','Dry Goods','g','kg','0.008','8.0','0.4',30,'["Dry Store"]',0,0,1,'["all"]','CMP-SEASAL-001','','{}');
INSERT INTO Ingredients VALUES(28,'Black Peppercorns','Food','Dry Goods','g','kg','0.035','35.0','0.2',30,'["Dry Store"]',0,0,1,'["all"]','CMP-BLACKP-001','','{}');
INSERT INTO Ingredients VALUES(29,'Tomato Passata','Food','Dry Goods','ml','l','0.006','6.0','2.2',7,'["Dry Store"]',0,0,1,'["all"]','CMP-TOMATO-001','','{}');
INSERT INTO Ingredients VALUES(30,'Fresh Orange Juice','Beverage','Beverages','ml','l','0.008','8.0','6.0',2,'["Chiller"]',0,0,1,'["all"]','CMP-FRESHO-001','','{}');
INSERT INTO Ingredients VALUES(31,'Craft IPA Beer','Beverage','Spirits','ml','l','0.015','15.0','12.0',5,'["Bar"]',0,0,1,'["all"]','CMP-CRAFTI-001','','{}');
INSERT INTO Ingredients VALUES(32,'House Red Wine','Beverage','Spirits','ml','l','0.012','12.0','4.0',7,'["Wine Cellar"]',0,0,1,'["all"]','CMP-HOUSER-001','','{}');
INSERT INTO Ingredients VALUES(33,'Tonic Water','Beverage','Beverages','ml','l','0.005','5.0','8.0',4,'["Bar"]',0,0,1,'["all"]','CMP-TONICW-001','','{}');
INSERT INTO Ingredients VALUES(34,'Oat Milk Barista','Beverage','Beverages','ml','l','0.007','7.0','5.0',3,'["Chiller"]',0,0,1,'["all"]','CMP-OATMIL-001','','{}');
INSERT INTO Ingredients VALUES(35,'Yogurt Strawberry','Food','Dairy','pcs','pcs','2.625','42.0','0.0',7,'["Chiller"]',0,1,1,'["all"]','CMP-YOGURT-001','','{"altRecipeUnits":[],"altInventoryUnits":[],"convertFromInventoryQty":"1","convertToRecipeQty":"1","taggedVendorProductIds":["VP-032FERN001"],"vendorProductPrincipalQty":{"VP-032FERN001":"16"},"vendorProductLossYield":{"VP-032FERN001":"0"},"vendorProductComponentUom":{"VP-032FERN001":"Each"},"vendorProductLocations":{"VP-032FERN001":["airport"]},"vendor":"Malaysian Yogurt Company","vendorProduct":"Fernleaf Yogurt Strawberry","deliveryUnitPrice":"42"}');
INSERT INTO Ingredients VALUES(36,'Spaghetti No. 5','Food','Dry Goods','g','kg','0.006','30.0','0.0',7,'["Dry Store"]',0,1,1,'["airport","downtown","midtown","westend"]','CMP-SPAGHE-001','','{"altRecipeUnits":[],"altInventoryUnits":[{"fromQty":"1","qty":"0.5","unit":"Tray"}],"convertFromInventoryQty":"1","convertToRecipeQty":"1000","taggedVendorProductIds":["VP-SPG019"],"vendorProductPrincipalQty":{},"vendorProductLossYield":{},"vendorProductComponentUom":{},"vendorProductLocations":{"VP-SPG019":["airport","downtown","midtown","westend"]},"vendor":"Noodle House Supply","vendorProduct":"Spaghetti","deliveryUnitPrice":"30"}');
INSERT INTO Ingredients VALUES(37,'Chili Flakes','Food','Dry Goods','g','kg','0.0','0.0','0.0',7,'["Dry Store"]',0,0,1,'["airport","downtown","midtown","westend"]','CMP-CHILIF-001','','{"altRecipeUnits":[],"altInventoryUnits":[],"convertFromInventoryQty":"1","convertToRecipeQty":"1000","taggedVendorProductIds":[],"vendorProductPrincipalQty":{},"vendorProductLossYield":{},"vendorProductComponentUom":{},"vendorProductLocations":{},"vendor":"","vendorProduct":"","deliveryUnitPrice":"0"}');
INSERT INTO Ingredients VALUES(38,'Paprika','Food','Dry Goods','g','kg','0.0','0.0','0.0',7,'["Dry Store"]',0,0,1,'["airport","downtown","midtown","westend"]','CMP-PAPRIK-001','','{"altRecipeUnits":[],"altInventoryUnits":[],"convertFromInventoryQty":"1","convertToRecipeQty":"1000","taggedVendorProductIds":[],"vendorProductPrincipalQty":{},"vendorProductLossYield":{},"vendorProductComponentUom":{},"vendorProductLocations":{},"vendor":"","vendorProduct":"","deliveryUnitPrice":"0"}');
INSERT INTO Ingredients VALUES(39,'SC Demo Component 001','Food','Produce','ml','l','1.498','1498.0','1.3',4,'"Dry Store"',0,0,1,'["downtown","midtown","airport","westend"]','CMP-SCDEMO-001','','{}');
INSERT INTO Ingredients VALUES(40,'SC Demo Component 002','Food','Dairy','pcs','pcs','0.9651','0.9651','2.71',5,'"Chiller"',0,0,1,'["downtown","midtown","airport","westend"]','CMP-SCDEMO-002','','{}');
INSERT INTO Ingredients VALUES(41,'SC Demo Component 003','Food','Dry Goods','g','kg','0.682','682.0','3.05',6,'"Dry Store"',0,0,1,'["downtown","midtown","airport","westend"]','CMP-SCDEMO-003','','{}');
INSERT INTO Ingredients VALUES(42,'SC Demo Component 004','Food','Seafood','ml','l','2.0013','2001.3','1.49',7,'"Chiller"',0,0,1,'["downtown","midtown","airport","westend"]','CMP-SCDEMO-004','','{}');
INSERT INTO Ingredients VALUES(43,'SC Demo Component 005','Food','Beverages','pcs','pcs','1.6925','1.6925','0.66',3,'"Dry Store"',0,0,1,'["downtown","midtown","airport","westend"]','CMP-SCDEMO-005','','{}');
INSERT INTO Ingredients VALUES(44,'SC Demo Component 006','Food','Packaging','g','kg','0.8389','838.9','1.29',4,'"Chiller"',0,0,1,'["downtown","midtown","airport","westend"]','CMP-SCDEMO-006','','{}');
INSERT INTO Ingredients VALUES(45,'SC Demo Component 007','Food','Proteins','ml','l','1.4537','1453.7','2.06',5,'"Dry Store"',0,0,1,'["downtown","midtown","airport","westend"]','CMP-SCDEMO-007','','{}');
INSERT INTO Ingredients VALUES(46,'SC Demo Component 008','Food','Produce','pcs','pcs','0.0507','0.0507','3.78',6,'"Chiller"',0,0,1,'["downtown","midtown","airport","westend"]','CMP-SCDEMO-008','','{}');
INSERT INTO Ingredients VALUES(47,'SC Demo Component 009','Food','Dairy','g','kg','0.9809','980.9','3.94',7,'"Dry Store"',0,0,1,'["downtown","midtown","airport","westend"]','CMP-SCDEMO-009','','{}');
INSERT INTO Ingredients VALUES(48,'SC Demo Component 010','Food','Dry Goods','ml','l','1.6417','1641.7','1.71',3,'"Chiller"',0,0,1,'["downtown","midtown","airport","westend"]','CMP-SCDEMO-010','','{}');
INSERT INTO Ingredients VALUES(49,'SC Demo Component 011','Food','Seafood','pcs','pcs','0.4035','0.4035','2.81',4,'"Dry Store"',0,0,1,'["downtown","midtown","airport","westend"]','CMP-SCDEMO-011','','{}');
INSERT INTO Ingredients VALUES(50,'SC Demo Component 012','Food','Beverages','g','kg','0.4827','482.7','3.78',5,'"Chiller"',0,0,1,'["downtown","midtown","airport","westend"]','CMP-SCDEMO-012','','{}');
INSERT INTO Ingredients VALUES(51,'SC Demo Component 013','Food','Packaging','ml','l','1.1059','1105.9','0.86',6,'"Dry Store"',0,0,1,'["downtown","midtown","airport","westend"]','CMP-SCDEMO-013','','{}');
INSERT INTO Ingredients VALUES(52,'SC Demo Component 014','Food','Proteins','pcs','pcs','0.4922','0.4922','5.2',7,'"Chiller"',0,0,1,'["downtown","midtown","airport","westend"]','CMP-SCDEMO-014','','{}');
INSERT INTO Ingredients VALUES(53,'SC Demo Component 015','Food','Produce','g','kg','0.3499','349.9','0.58',3,'"Dry Store"',0,0,1,'["downtown","midtown","airport","westend"]','CMP-SCDEMO-015','','{}');
INSERT INTO Ingredients VALUES(54,'SC Demo Component 016','Food','Dairy','ml','l','1.7847','1784.7','1.1',4,'"Chiller"',0,0,1,'["downtown","midtown","airport","westend"]','CMP-SCDEMO-016','','{}');
INSERT INTO Ingredients VALUES(55,'SC Demo Component 017','Food','Dry Goods','pcs','pcs','1.883','1.883','1.03',5,'"Dry Store"',0,0,1,'["downtown","midtown","airport","westend"]','CMP-SCDEMO-017','','{}');
INSERT INTO Ingredients VALUES(56,'SC Demo Component 018','Food','Seafood','g','kg','0.5299','529.9','1.6',6,'"Chiller"',0,0,1,'["downtown","midtown","airport","westend"]','CMP-SCDEMO-018','','{}');
INSERT INTO Ingredients VALUES(57,'SC Demo Component 019','Food','Beverages','ml','l','1.3927','1392.7','2.6',7,'"Dry Store"',0,0,1,'["downtown","midtown","airport","westend"]','CMP-SCDEMO-019','','{}');
INSERT INTO Ingredients VALUES(58,'SC Demo Component 020','Food','Packaging','pcs','pcs','1.9517','1.9517','0.97',3,'"Chiller"',0,0,1,'["downtown","midtown","airport","westend"]','CMP-SCDEMO-020','','{}');
INSERT INTO Ingredients VALUES(59,'SC Demo Component 021','Food','Proteins','g','kg','0.732','732.0','5.42',4,'"Dry Store"',0,0,1,'["downtown","midtown","airport","westend"]','CMP-SCDEMO-021','','{}');
INSERT INTO Ingredients VALUES(60,'SC Demo Component 022','Food','Produce','ml','l','1.4764','1476.4','4.7',5,'"Chiller"',0,0,1,'["downtown","midtown","airport","westend"]','CMP-SCDEMO-022','','{}');
INSERT INTO Ingredients VALUES(61,'SC Demo Component 023','Food','Dairy','pcs','pcs','2.0131','2.0131','5.28',6,'"Dry Store"',0,0,1,'["downtown","midtown","airport","westend"]','CMP-SCDEMO-023','','{}');
INSERT INTO Ingredients VALUES(62,'SC Demo Component 024','Food','Dry Goods','g','kg','1.3991','1399.1','3.09',7,'"Chiller"',0,0,1,'["downtown","midtown","airport","westend"]','CMP-SCDEMO-024','','{}');
INSERT INTO Ingredients VALUES(63,'SC Demo Component 025','Food','Seafood','ml','l','1.7876','1787.6','1.14',3,'"Dry Store"',0,0,1,'["downtown","midtown","airport","westend"]','CMP-SCDEMO-025','','{}');
INSERT INTO Ingredients VALUES(64,'SC Demo Component 026','Food','Beverages','pcs','pcs','1.3311','1.3311','4.71',4,'"Chiller"',0,0,1,'["downtown","midtown","airport","westend"]','CMP-SCDEMO-026','','{}');
INSERT INTO Ingredients VALUES(65,'SC Demo Component 027','Food','Packaging','g','kg','1.6432','1643.2','1.7',5,'"Dry Store"',0,0,1,'["downtown","midtown","airport","westend"]','CMP-SCDEMO-027','','{}');
INSERT INTO Ingredients VALUES(66,'SC Demo Component 028','Food','Proteins','ml','l','0.1343','134.3','1.81',6,'"Chiller"',0,0,1,'["downtown","midtown","airport","westend"]','CMP-SCDEMO-028','','{}');
INSERT INTO Ingredients VALUES(67,'SC Demo Component 029','Food','Produce','pcs','pcs','1.9368','1.9368','4.51',7,'"Dry Store"',0,0,1,'["downtown","midtown","airport","westend"]','CMP-SCDEMO-029','','{}');
INSERT INTO Ingredients VALUES(68,'SC Demo Component 030','Food','Dairy','g','kg','1.8779','1877.9','1.72',3,'"Chiller"',0,0,1,'["downtown","midtown","airport","westend"]','CMP-SCDEMO-030','','{}');
INSERT INTO Ingredients VALUES(69,'SC Demo Component 031','Food','Dry Goods','ml','l','0.6281','628.1','0.68',4,'"Dry Store"',0,0,1,'["downtown","midtown","airport","westend"]','CMP-SCDEMO-031','','{}');
INSERT INTO Ingredients VALUES(70,'SC Demo Component 032','Food','Seafood','pcs','pcs','0.1446','0.1446','4.53',5,'"Chiller"',0,0,1,'["downtown","midtown","airport","westend"]','CMP-SCDEMO-032','','{}');
INSERT INTO Ingredients VALUES(71,'SC Demo Component 033','Food','Beverages','g','kg','0.3799','379.9','1.87',6,'"Dry Store"',0,0,1,'["downtown","midtown","airport","westend"]','CMP-SCDEMO-033','','{}');
INSERT INTO Ingredients VALUES(72,'SC Demo Component 034','Food','Packaging','ml','l','0.5336','533.6','3.48',7,'"Chiller"',0,0,1,'["downtown","midtown","airport","westend"]','CMP-SCDEMO-034','','{}');
INSERT INTO Ingredients VALUES(73,'SC Demo Component 035','Food','Proteins','pcs','pcs','0.1948','0.1948','4.4',3,'"Dry Store"',0,0,1,'["downtown","midtown","airport","westend"]','CMP-SCDEMO-035','','{}');
INSERT INTO Ingredients VALUES(74,'SC Demo Component 036','Food','Produce','g','kg','2.0176','2017.6','0.73',4,'"Chiller"',0,0,1,'["downtown","midtown","airport","westend"]','CMP-SCDEMO-036','','{}');
INSERT INTO Ingredients VALUES(75,'SC Demo Component 037','Food','Dairy','ml','l','1.5225','1522.5','4.01',5,'"Dry Store"',0,0,1,'["downtown","midtown","airport","westend"]','CMP-SCDEMO-037','','{}');
INSERT INTO Ingredients VALUES(76,'SC Demo Component 038','Food','Dry Goods','pcs','pcs','1.8537','1.8537','1.46',6,'"Chiller"',0,0,1,'["downtown","midtown","airport","westend"]','CMP-SCDEMO-038','','{}');
INSERT INTO Ingredients VALUES(77,'SC Demo Component 039','Food','Seafood','g','kg','1.5464','1546.4','2.38',7,'"Dry Store"',0,0,1,'["downtown","midtown","airport","westend"]','CMP-SCDEMO-039','','{}');
INSERT INTO Ingredients VALUES(78,'SC Demo Component 040','Food','Beverages','ml','l','1.3981','1398.1','3.36',3,'"Chiller"',0,0,1,'["downtown","midtown","airport","westend"]','CMP-SCDEMO-040','','{}');
INSERT INTO Ingredients VALUES(79,'SC Demo Component 041','Food','Packaging','pcs','pcs','0.8446','0.8446','4.01',4,'"Dry Store"',0,0,1,'["downtown","midtown","airport","westend"]','CMP-SCDEMO-041','','{}');
INSERT INTO Ingredients VALUES(80,'SC Demo Component 042','Food','Proteins','g','kg','0.1916','191.6','0.61',5,'"Chiller"',0,0,1,'["downtown","midtown","airport","westend"]','CMP-SCDEMO-042','','{}');
INSERT INTO Ingredients VALUES(81,'SC Demo Component 043','Food','Produce','ml','l','0.8011','801.1','0.63',6,'"Dry Store"',0,0,1,'["downtown","midtown","airport","westend"]','CMP-SCDEMO-043','','{}');
INSERT INTO Ingredients VALUES(82,'SC Demo Component 044','Food','Dairy','pcs','pcs','0.6974','0.6974','3.88',7,'"Chiller"',0,0,1,'["downtown","midtown","airport","westend"]','CMP-SCDEMO-044','','{}');
INSERT INTO Ingredients VALUES(83,'SC Demo Component 045','Food','Dry Goods','g','kg','0.176','176.0','5.39',3,'"Dry Store"',0,0,1,'["downtown","midtown","airport","westend"]','CMP-SCDEMO-045','','{}');
INSERT INTO Ingredients VALUES(84,'SC Demo Component 046','Food','Seafood','ml','l','0.6026','602.6','4.85',4,'"Chiller"',0,0,1,'["downtown","midtown","airport","westend"]','CMP-SCDEMO-046','','{}');
INSERT INTO Ingredients VALUES(85,'SC Demo Component 047','Food','Beverages','pcs','pcs','1.0628','1.0628','4.03',5,'"Dry Store"',0,0,1,'["downtown","midtown","airport","westend"]','CMP-SCDEMO-047','','{}');
INSERT INTO Ingredients VALUES(86,'SC Demo Component 048','Food','Packaging','g','kg','1.659','1659.0','2.02',6,'"Chiller"',0,0,1,'["downtown","midtown","airport","westend"]','CMP-SCDEMO-048','','{}');
INSERT INTO Ingredients VALUES(87,'SC Demo Component 049','Food','Proteins','ml','l','1.9236','1923.6','5.04',7,'"Dry Store"',0,0,1,'["downtown","midtown","airport","westend"]','CMP-SCDEMO-049','','{}');
INSERT INTO Ingredients VALUES(88,'SC Demo Component 050','Food','Produce','pcs','pcs','1.401','1.401','4.04',3,'"Chiller"',0,0,1,'["downtown","midtown","airport","westend"]','CMP-SCDEMO-050','','{}');
INSERT INTO Ingredients VALUES(89,'SC Demo Component 051','Food','Dairy','g','kg','1.4783','1478.3','0.89',4,'"Dry Store"',0,0,1,'["downtown","midtown","airport","westend"]','CMP-SCDEMO-051','','{}');
INSERT INTO Ingredients VALUES(90,'SC Demo Component 052','Food','Dry Goods','ml','l','0.9428','942.8','0.94',5,'"Chiller"',0,0,1,'["downtown","midtown","airport","westend"]','CMP-SCDEMO-052','','{}');
INSERT INTO Ingredients VALUES(91,'SC Demo Component 053','Food','Seafood','pcs','pcs','0.3383','0.3383','3.48',6,'"Dry Store"',0,0,1,'["downtown","midtown","airport","westend"]','CMP-SCDEMO-053','','{}');
INSERT INTO Ingredients VALUES(92,'SC Demo Component 054','Food','Beverages','g','kg','0.2615','261.5','0.97',7,'"Chiller"',0,0,1,'["downtown","midtown","airport","westend"]','CMP-SCDEMO-054','','{}');
INSERT INTO Ingredients VALUES(93,'SC Demo Component 055','Food','Packaging','ml','l','0.7275','727.5','4.75',3,'"Dry Store"',0,0,1,'["downtown","midtown","airport","westend"]','CMP-SCDEMO-055','','{}');
INSERT INTO Ingredients VALUES(94,'SC Demo Component 056','Food','Proteins','pcs','pcs','1.0789','1.0789','3.34',4,'"Chiller"',0,0,1,'["downtown","midtown","airport","westend"]','CMP-SCDEMO-056','','{}');
INSERT INTO Ingredients VALUES(95,'SC Demo Component 057','Food','Produce','g','kg','0.3057','305.7','2.21',5,'"Dry Store"',0,0,1,'["downtown","midtown","airport","westend"]','CMP-SCDEMO-057','','{}');
INSERT INTO Ingredients VALUES(96,'SC Demo Component 058','Food','Dairy','ml','l','1.7438','1743.8','3.43',6,'"Chiller"',0,0,1,'["downtown","midtown","airport","westend"]','CMP-SCDEMO-058','','{}');
INSERT INTO Ingredients VALUES(97,'SC Demo Component 059','Food','Dry Goods','pcs','pcs','1.9806','1.9806','0.63',7,'"Dry Store"',0,0,1,'["downtown","midtown","airport","westend"]','CMP-SCDEMO-059','','{}');
INSERT INTO Ingredients VALUES(98,'SC Demo Component 060','Food','Seafood','g','kg','0.9093','909.3','1.2',3,'"Chiller"',0,0,1,'["downtown","midtown","airport","westend"]','CMP-SCDEMO-060','','{}');
INSERT INTO Ingredients VALUES(99,'SC Demo Component 061','Food','Beverages','ml','l','1.9509','1950.9','3.33',4,'"Dry Store"',0,0,1,'["downtown","midtown","airport","westend"]','CMP-SCDEMO-061','','{}');
INSERT INTO Ingredients VALUES(100,'SC Demo Component 062','Food','Packaging','pcs','pcs','1.1173','1.1173','0.98',5,'"Chiller"',0,0,1,'["downtown","midtown","airport","westend"]','CMP-SCDEMO-062','','{}');
INSERT INTO Ingredients VALUES(101,'SC Demo Component 063','Food','Proteins','g','kg','1.0587','1058.7','1.07',6,'"Dry Store"',0,0,1,'["downtown","midtown","airport","westend"]','CMP-SCDEMO-063','','{}');
INSERT INTO Ingredients VALUES(102,'SC Demo Component 064','Food','Produce','ml','l','1.1275','1127.5','0.65',7,'"Chiller"',0,0,1,'["downtown","midtown","airport","westend"]','CMP-SCDEMO-064','','{}');
INSERT INTO Ingredients VALUES(103,'SC Demo Component 065','Food','Dairy','pcs','pcs','1.8455','1.8455','3.48',3,'"Dry Store"',0,0,1,'["downtown","midtown","airport","westend"]','CMP-SCDEMO-065','','{}');
INSERT INTO Ingredients VALUES(104,'SC Demo Component 066','Food','Dry Goods','g','kg','0.5616','561.6','4.7',4,'"Chiller"',0,0,1,'["downtown","midtown","airport","westend"]','CMP-SCDEMO-066','','{}');
INSERT INTO Ingredients VALUES(105,'SC Demo Component 067','Food','Seafood','ml','l','1.4508','1450.8','5.33',5,'"Dry Store"',0,0,1,'["downtown","midtown","airport","westend"]','CMP-SCDEMO-067','','{}');
INSERT INTO Ingredients VALUES(106,'SC Demo Component 068','Food','Beverages','pcs','pcs','1.7658','1.7658','2.1',6,'"Chiller"',0,0,1,'["downtown","midtown","airport","westend"]','CMP-SCDEMO-068','','{}');
INSERT INTO Ingredients VALUES(107,'SC Demo Component 069','Food','Packaging','g','kg','0.5618','561.8','5.41',7,'"Dry Store"',0,0,1,'["downtown","midtown","airport","westend"]','CMP-SCDEMO-069','','{}');
INSERT INTO Ingredients VALUES(108,'SC Demo Component 070','Food','Proteins','ml','l','1.8058','1805.8','4.4',3,'"Chiller"',0,0,1,'["downtown","midtown","airport","westend"]','CMP-SCDEMO-070','','{}');
INSERT INTO Ingredients VALUES(109,'SC Demo Component 071','Food','Produce','pcs','pcs','1.8892','1.8892','1.65',4,'"Dry Store"',0,0,1,'["downtown","midtown","airport","westend"]','CMP-SCDEMO-071','','{}');
INSERT INTO Ingredients VALUES(110,'SC Demo Component 072','Food','Dairy','g','kg','0.7242','724.2','1.57',5,'"Chiller"',0,0,1,'["downtown","midtown","airport","westend"]','CMP-SCDEMO-072','','{}');
INSERT INTO Ingredients VALUES(111,'SC Demo Component 073','Food','Dry Goods','ml','l','0.9758','975.8','4.04',6,'"Dry Store"',0,0,1,'["downtown","midtown","airport","westend"]','CMP-SCDEMO-073','','{}');
INSERT INTO Ingredients VALUES(112,'SC Demo Component 074','Food','Seafood','pcs','pcs','1.5331','1.5331','1.32',7,'"Chiller"',0,0,1,'["downtown","midtown","airport","westend"]','CMP-SCDEMO-074','','{}');
INSERT INTO Ingredients VALUES(113,'SC Demo Component 075','Food','Beverages','g','kg','1.7695','1769.5','1.59',3,'"Dry Store"',0,0,1,'["downtown","midtown","airport","westend"]','CMP-SCDEMO-075','','{}');
INSERT INTO Ingredients VALUES(114,'SC Demo Component 076','Food','Packaging','ml','l','0.7293','729.3','5.06',4,'"Chiller"',0,0,1,'["downtown","midtown","airport","westend"]','CMP-SCDEMO-076','','{}');
INSERT INTO Ingredients VALUES(115,'SC Demo Component 077','Food','Proteins','pcs','pcs','1.0067','1.0067','3.18',5,'"Dry Store"',0,0,1,'["downtown","midtown","airport","westend"]','CMP-SCDEMO-077','','{}');
INSERT INTO Ingredients VALUES(116,'SC Demo Component 078','Food','Produce','g','kg','1.5639','1563.9','1.24',6,'"Chiller"',0,0,1,'["downtown","midtown","airport","westend"]','CMP-SCDEMO-078','','{}');
INSERT INTO Ingredients VALUES(117,'SC Demo Component 079','Food','Dairy','ml','l','1.1384','1138.4','2.26',7,'"Dry Store"',0,0,1,'["downtown","midtown","airport","westend"]','CMP-SCDEMO-079','','{}');
INSERT INTO Ingredients VALUES(118,'SC Demo Component 080','Food','Dry Goods','pcs','pcs','1.2175','1.2175','0.65',3,'"Chiller"',0,0,1,'["downtown","midtown","airport","westend"]','CMP-SCDEMO-080','','{}');
INSERT INTO Ingredients VALUES(119,'SC Demo Component 081','Food','Seafood','g','kg','0.1634','163.4','0.88',4,'"Dry Store"',0,0,1,'["downtown","midtown","airport","westend"]','CMP-SCDEMO-081','','{}');
INSERT INTO Ingredients VALUES(120,'SC Demo Component 082','Food','Beverages','ml','l','0.4432','443.2','4.21',5,'"Chiller"',0,0,1,'["downtown","midtown","airport","westend"]','CMP-SCDEMO-082','','{}');
INSERT INTO Ingredients VALUES(121,'SC Demo Component 083','Food','Packaging','pcs','pcs','1.2373','1.2373','3.87',6,'"Dry Store"',0,0,1,'["downtown","midtown","airport","westend"]','CMP-SCDEMO-083','','{}');
INSERT INTO Ingredients VALUES(122,'SC Demo Component 084','Food','Proteins','g','kg','1.7842','1784.2','1.31',7,'"Chiller"',0,0,1,'["downtown","midtown","airport","westend"]','CMP-SCDEMO-084','','{}');
INSERT INTO Ingredients VALUES(123,'SC Demo Component 085','Food','Produce','ml','l','1.0181','1018.1','3.14',3,'"Dry Store"',0,0,1,'["downtown","midtown","airport","westend"]','CMP-SCDEMO-085','','{}');
INSERT INTO Ingredients VALUES(124,'SC Demo Component 086','Food','Dairy','pcs','pcs','0.7117','0.7117','5.41',4,'"Chiller"',0,0,1,'["downtown","midtown","airport","westend"]','CMP-SCDEMO-086','','{}');
INSERT INTO Ingredients VALUES(125,'SC Demo Component 087','Food','Dry Goods','g','kg','0.3448','344.8','3.75',5,'"Dry Store"',0,0,1,'["downtown","midtown","airport","westend"]','CMP-SCDEMO-087','','{}');
INSERT INTO Ingredients VALUES(126,'SC Demo Component 088','Food','Seafood','ml','l','0.4901','490.1','4.11',6,'"Chiller"',0,0,1,'["downtown","midtown","airport","westend"]','CMP-SCDEMO-088','','{}');
INSERT INTO Ingredients VALUES(127,'SC Demo Component 089','Food','Beverages','pcs','pcs','0.5076','0.5076','2.1',7,'"Dry Store"',0,0,1,'["downtown","midtown","airport","westend"]','CMP-SCDEMO-089','','{}');
INSERT INTO Ingredients VALUES(128,'SC Demo Component 090','Food','Packaging','g','kg','1.3143','1314.3','4.48',3,'"Chiller"',0,0,1,'["downtown","midtown","airport","westend"]','CMP-SCDEMO-090','','{}');
INSERT INTO Ingredients VALUES(129,'SC Demo Component 091','Food','Proteins','ml','l','0.7956','795.6','2.37',4,'"Dry Store"',0,0,1,'["downtown","midtown","airport","westend"]','CMP-SCDEMO-091','','{}');
INSERT INTO Ingredients VALUES(130,'SC Demo Component 092','Food','Produce','pcs','pcs','0.3898','0.3898','3.9',5,'"Chiller"',0,0,1,'["downtown","midtown","airport","westend"]','CMP-SCDEMO-092','','{}');
INSERT INTO Ingredients VALUES(131,'SC Demo Component 093','Food','Dairy','g','kg','0.5646','564.6','2.22',6,'"Dry Store"',0,0,1,'["downtown","midtown","airport","westend"]','CMP-SCDEMO-093','','{}');
INSERT INTO Ingredients VALUES(132,'SC Demo Component 094','Food','Dry Goods','ml','l','0.7737','773.7','1.32',7,'"Chiller"',0,0,1,'["downtown","midtown","airport","westend"]','CMP-SCDEMO-094','','{}');
INSERT INTO Ingredients VALUES(133,'SC Demo Component 095','Food','Seafood','pcs','pcs','0.4694','0.4694','4.05',3,'"Dry Store"',0,0,1,'["downtown","midtown","airport","westend"]','CMP-SCDEMO-095','','{}');
INSERT INTO Ingredients VALUES(134,'SC Demo Component 096','Food','Beverages','g','kg','1.6005','1600.5','5.02',4,'"Chiller"',0,0,1,'["downtown","midtown","airport","westend"]','CMP-SCDEMO-096','','{}');
INSERT INTO Ingredients VALUES(135,'SC Demo Component 097','Food','Packaging','ml','l','0.8479','847.9','4.74',5,'"Dry Store"',0,0,1,'["downtown","midtown","airport","westend"]','CMP-SCDEMO-097','','{}');
INSERT INTO Ingredients VALUES(136,'SC Demo Component 098','Food','Proteins','pcs','pcs','1.4968','1.4968','4.72',6,'"Chiller"',0,0,1,'["downtown","midtown","airport","westend"]','CMP-SCDEMO-098','','{}');
INSERT INTO Ingredients VALUES(137,'SC Demo Component 099','Food','Produce','g','kg','0.1156','115.6','3.48',7,'"Dry Store"',0,0,1,'["downtown","midtown","airport","westend"]','CMP-SCDEMO-099','','{}');
INSERT INTO Ingredients VALUES(138,'SC Demo Component 100','Food','Dairy','ml','l','1.2897','1289.7','4.44',3,'"Chiller"',0,0,1,'["downtown","midtown","airport","westend"]','CMP-SCDEMO-100','','{}');
INSERT INTO Ingredients VALUES(139,'SC Demo Component 101','Food','Dry Goods','pcs','pcs','1.7333','1.7333','3.4',4,'"Dry Store"',0,0,1,'["downtown","midtown","airport","westend"]','CMP-SCDEMO-101','','{}');
INSERT INTO Ingredients VALUES(140,'SC Demo Component 102','Food','Seafood','g','kg','1.4108','1410.8','2.16',5,'"Chiller"',0,0,1,'["downtown","midtown","airport","westend"]','CMP-SCDEMO-102','','{}');
INSERT INTO Ingredients VALUES(141,'SC Demo Component 103','Food','Beverages','ml','l','1.8238','1823.8','2.29',6,'"Dry Store"',0,0,1,'["downtown","midtown","airport","westend"]','CMP-SCDEMO-103','','{}');
INSERT INTO Ingredients VALUES(142,'SC Demo Component 104','Food','Packaging','pcs','pcs','1.5783','1.5783','4.64',7,'"Chiller"',0,0,1,'["downtown","midtown","airport","westend"]','CMP-SCDEMO-104','','{}');
INSERT INTO Ingredients VALUES(143,'SC Demo Component 105','Food','Proteins','g','kg','0.6816','681.6','0.68',3,'"Dry Store"',0,0,1,'["downtown","midtown","airport","westend"]','CMP-SCDEMO-105','','{}');
INSERT INTO Ingredients VALUES(144,'SC Demo Component 106','Food','Produce','ml','l','1.8888','1888.8','1.62',4,'"Chiller"',0,0,1,'["downtown","midtown","airport","westend"]','CMP-SCDEMO-106','','{}');
INSERT INTO Ingredients VALUES(145,'SC Demo Component 107','Food','Dairy','pcs','pcs','1.4884','1.4884','4.44',5,'"Dry Store"',0,0,1,'["downtown","midtown","airport","westend"]','CMP-SCDEMO-107','','{}');
INSERT INTO Ingredients VALUES(146,'SC Demo Component 108','Food','Dry Goods','g','kg','1.364','1364.0','3.91',6,'"Chiller"',0,0,1,'["downtown","midtown","airport","westend"]','CMP-SCDEMO-108','','{}');
INSERT INTO Ingredients VALUES(147,'SC Demo Component 109','Food','Seafood','ml','l','1.8625','1862.5','3.08',7,'"Dry Store"',0,0,1,'["downtown","midtown","airport","westend"]','CMP-SCDEMO-109','','{}');
INSERT INTO Ingredients VALUES(148,'SC Demo Component 110','Food','Beverages','pcs','pcs','1.0191','1.0191','1.75',3,'"Chiller"',0,0,1,'["downtown","midtown","airport","westend"]','CMP-SCDEMO-110','','{}');
INSERT INTO Ingredients VALUES(149,'SC Demo Component 111','Food','Packaging','g','kg','0.6747','674.7','4.01',4,'"Dry Store"',0,0,1,'["downtown","midtown","airport","westend"]','CMP-SCDEMO-111','','{}');
INSERT INTO Ingredients VALUES(150,'SC Demo Component 112','Food','Proteins','ml','l','1.953','1953.0','4.37',5,'"Chiller"',0,0,1,'["downtown","midtown","airport","westend"]','CMP-SCDEMO-112','','{}');
INSERT INTO Ingredients VALUES(151,'SC Demo Component 113','Food','Produce','pcs','pcs','1.5544','1.5544','2.63',6,'"Dry Store"',0,0,1,'["downtown","midtown","airport","westend"]','CMP-SCDEMO-113','','{}');
INSERT INTO Ingredients VALUES(152,'SC Demo Component 114','Food','Dairy','g','kg','1.2174','1217.4','2.0',7,'"Chiller"',0,0,1,'["downtown","midtown","airport","westend"]','CMP-SCDEMO-114','','{}');
INSERT INTO Ingredients VALUES(153,'SC Demo Component 115','Food','Dry Goods','ml','l','1.9023','1902.3','2.38',3,'"Dry Store"',0,0,1,'["downtown","midtown","airport","westend"]','CMP-SCDEMO-115','','{}');
INSERT INTO Ingredients VALUES(154,'SC Demo Component 116','Food','Seafood','pcs','pcs','1.4264','1.4264','3.67',4,'"Chiller"',0,0,1,'["downtown","midtown","airport","westend"]','CMP-SCDEMO-116','','{}');
INSERT INTO Ingredients VALUES(155,'SC Demo Component 117','Food','Beverages','g','kg','1.4506','1450.6','4.72',5,'"Dry Store"',0,0,1,'["downtown","midtown","airport","westend"]','CMP-SCDEMO-117','','{}');
INSERT INTO Ingredients VALUES(156,'SC Demo Component 118','Food','Packaging','ml','l','1.9578','1957.8','4.46',6,'"Chiller"',0,0,1,'["downtown","midtown","airport","westend"]','CMP-SCDEMO-118','','{}');
INSERT INTO Ingredients VALUES(157,'SC Demo Component 119','Food','Proteins','pcs','pcs','1.4378','1.4378','4.69',7,'"Dry Store"',0,0,1,'["downtown","midtown","airport","westend"]','CMP-SCDEMO-119','','{}');
INSERT INTO Ingredients VALUES(158,'SC Demo Component 120','Food','Produce','g','kg','1.6362','1636.2','5.0',3,'"Chiller"',0,0,1,'["downtown","midtown","airport","westend"]','CMP-SCDEMO-120','','{}');
INSERT INTO Ingredients VALUES(159,'SC Demo Component 121','Food','Dairy','ml','l','1.2102','1210.2','3.17',4,'"Dry Store"',0,0,1,'["downtown","midtown","airport","westend"]','CMP-SCDEMO-121','','{}');
INSERT INTO Ingredients VALUES(160,'SC Demo Component 122','Food','Dry Goods','pcs','pcs','1.7475','1.7475','1.37',5,'"Chiller"',0,0,1,'["downtown","midtown","airport","westend"]','CMP-SCDEMO-122','','{}');
INSERT INTO Ingredients VALUES(161,'SC Demo Component 123','Food','Seafood','g','kg','1.6305','1630.5','3.26',6,'"Dry Store"',0,0,1,'["downtown","midtown","airport","westend"]','CMP-SCDEMO-123','','{}');
INSERT INTO Ingredients VALUES(162,'SC Demo Component 124','Food','Beverages','ml','l','0.4208','420.8','3.55',7,'"Chiller"',0,0,1,'["downtown","midtown","airport","westend"]','CMP-SCDEMO-124','','{}');
INSERT INTO Ingredients VALUES(163,'SC Demo Component 125','Food','Packaging','pcs','pcs','0.4322','0.4322','0.7',3,'"Dry Store"',0,0,1,'["downtown","midtown","airport","westend"]','CMP-SCDEMO-125','','{}');
INSERT INTO Ingredients VALUES(164,'SC Demo Component 126','Food','Proteins','g','kg','1.9244','1924.4','3.08',4,'"Chiller"',0,0,1,'["downtown","midtown","airport","westend"]','CMP-SCDEMO-126','','{}');
INSERT INTO Ingredients VALUES(165,'SC Demo Component 127','Food','Produce','ml','l','0.2714','271.4','2.35',5,'"Dry Store"',0,0,1,'["downtown","midtown","airport","westend"]','CMP-SCDEMO-127','','{}');
INSERT INTO Ingredients VALUES(166,'SC Demo Component 128','Food','Dairy','pcs','pcs','1.0026','1.0026','1.2',6,'"Chiller"',0,0,1,'["downtown","midtown","airport","westend"]','CMP-SCDEMO-128','','{}');
INSERT INTO Ingredients VALUES(167,'SC Demo Component 129','Food','Dry Goods','g','kg','1.3077','1307.7','5.03',7,'"Dry Store"',0,0,1,'["downtown","midtown","airport","westend"]','CMP-SCDEMO-129','','{}');
INSERT INTO Ingredients VALUES(168,'SC Demo Component 130','Food','Seafood','ml','l','1.2101','1210.1','2.8',3,'"Chiller"',0,0,1,'["downtown","midtown","airport","westend"]','CMP-SCDEMO-130','','{}');
INSERT INTO Ingredients VALUES(169,'SC Demo Component 131','Food','Beverages','pcs','pcs','1.5967','1.5967','2.82',4,'"Dry Store"',0,0,1,'["downtown","midtown","airport","westend"]','CMP-SCDEMO-131','','{}');
INSERT INTO Ingredients VALUES(170,'SC Demo Component 132','Food','Packaging','g','kg','1.8552','1855.2','5.2',5,'"Chiller"',0,0,1,'["downtown","midtown","airport","westend"]','CMP-SCDEMO-132','','{}');
INSERT INTO Ingredients VALUES(171,'SC Demo Component 133','Food','Proteins','ml','l','0.7454','745.4','1.93',6,'"Dry Store"',0,0,1,'["downtown","midtown","airport","westend"]','CMP-SCDEMO-133','','{}');
INSERT INTO Ingredients VALUES(172,'SC Demo Component 134','Food','Produce','pcs','pcs','1.0975','1.0975','4.88',7,'"Chiller"',0,0,1,'["downtown","midtown","airport","westend"]','CMP-SCDEMO-134','','{}');
INSERT INTO Ingredients VALUES(173,'SC Demo Component 135','Food','Dairy','g','kg','1.7185','1718.5','4.82',3,'"Dry Store"',0,0,1,'["downtown","midtown","airport","westend"]','CMP-SCDEMO-135','','{}');
INSERT INTO Ingredients VALUES(174,'SC Demo Component 136','Food','Dry Goods','ml','l','2.027','2027.0','0.84',4,'"Chiller"',0,0,1,'["downtown","midtown","airport","westend"]','CMP-SCDEMO-136','','{}');
INSERT INTO Ingredients VALUES(175,'SC Demo Component 137','Food','Seafood','pcs','pcs','1.4969','1.4969','3.42',5,'"Dry Store"',0,0,1,'["downtown","midtown","airport","westend"]','CMP-SCDEMO-137','','{}');
INSERT INTO Ingredients VALUES(176,'SC Demo Component 138','Food','Beverages','g','kg','1.3886','1388.6','4.4',6,'"Chiller"',0,0,1,'["downtown","midtown","airport","westend"]','CMP-SCDEMO-138','','{}');
INSERT INTO Ingredients VALUES(177,'SC Demo Component 139','Food','Packaging','ml','l','1.7576','1757.6','4.39',7,'"Dry Store"',0,0,1,'["downtown","midtown","airport","westend"]','CMP-SCDEMO-139','','{}');
INSERT INTO Ingredients VALUES(178,'SC Demo Component 140','Food','Proteins','pcs','pcs','2.0183','2.0183','1.51',3,'"Chiller"',0,0,1,'["downtown","midtown","airport","westend"]','CMP-SCDEMO-140','','{}');
INSERT INTO Ingredients VALUES(179,'SC Demo Component 141','Food','Produce','g','kg','0.5318','531.8','5.36',4,'"Dry Store"',0,0,1,'["downtown","midtown","airport","westend"]','CMP-SCDEMO-141','','{}');
INSERT INTO Ingredients VALUES(180,'SC Demo Component 142','Food','Dairy','ml','l','0.2663','266.3','4.93',5,'"Chiller"',0,0,1,'["downtown","midtown","airport","westend"]','CMP-SCDEMO-142','','{}');
INSERT INTO Ingredients VALUES(181,'SC Demo Component 143','Food','Dry Goods','pcs','pcs','0.9288','0.9288','1.36',6,'"Dry Store"',0,0,1,'["downtown","midtown","airport","westend"]','CMP-SCDEMO-143','','{}');
INSERT INTO Ingredients VALUES(182,'SC Demo Component 144','Food','Seafood','g','kg','1.0957','1095.7','2.15',7,'"Chiller"',0,0,1,'["downtown","midtown","airport","westend"]','CMP-SCDEMO-144','','{}');
INSERT INTO Ingredients VALUES(183,'SC Demo Component 145','Food','Beverages','ml','l','0.7844','784.4','4.57',3,'"Dry Store"',0,0,1,'["downtown","midtown","airport","westend"]','CMP-SCDEMO-145','','{}');
INSERT INTO Ingredients VALUES(184,'SC Demo Component 146','Food','Packaging','pcs','pcs','0.3771','0.3771','4.44',4,'"Chiller"',0,0,1,'["downtown","midtown","airport","westend"]','CMP-SCDEMO-146','','{}');
INSERT INTO Ingredients VALUES(185,'SC Demo Component 147','Food','Proteins','g','kg','0.5652','565.2','2.16',5,'"Dry Store"',0,0,1,'["downtown","midtown","airport","westend"]','CMP-SCDEMO-147','','{}');
INSERT INTO Ingredients VALUES(186,'SC Demo Component 148','Food','Produce','ml','l','0.3039','303.9','1.08',6,'"Chiller"',0,0,1,'["downtown","midtown","airport","westend"]','CMP-SCDEMO-148','','{}');
INSERT INTO Ingredients VALUES(187,'SC Demo Component 149','Food','Dairy','pcs','pcs','1.311','1.311','5.05',7,'"Dry Store"',0,0,1,'["downtown","midtown","airport","westend"]','CMP-SCDEMO-149','','{}');
INSERT INTO Ingredients VALUES(188,'SC Demo Component 150','Food','Dry Goods','g','kg','1.7022','1702.2','3.02',3,'"Chiller"',0,0,1,'["downtown","midtown","airport","westend"]','CMP-SCDEMO-150','','{}');
INSERT INTO Ingredients VALUES(189,'SC Demo Component 151','Food','Seafood','ml','l','0.105','105.0','2.05',4,'"Dry Store"',0,0,1,'["downtown","midtown","airport","westend"]','CMP-SCDEMO-151','','{}');
INSERT INTO Ingredients VALUES(190,'SC Demo Component 152','Food','Beverages','pcs','pcs','1.6031','1.6031','2.13',5,'"Chiller"',0,0,1,'["downtown","midtown","airport","westend"]','CMP-SCDEMO-152','','{}');
INSERT INTO Ingredients VALUES(191,'SC Demo Component 153','Food','Packaging','g','kg','0.155','155.0','4.84',6,'"Dry Store"',0,0,1,'["downtown","midtown","airport","westend"]','CMP-SCDEMO-153','','{}');
INSERT INTO Ingredients VALUES(192,'SC Demo Component 154','Food','Proteins','ml','l','1.6356','1635.6','3.13',7,'"Chiller"',0,0,1,'["downtown","midtown","airport","westend"]','CMP-SCDEMO-154','','{}');
INSERT INTO Ingredients VALUES(193,'SC Demo Component 155','Food','Produce','pcs','pcs','1.4523','1.4523','3.99',3,'"Dry Store"',0,0,1,'["downtown","midtown","airport","westend"]','CMP-SCDEMO-155','','{}');
INSERT INTO Ingredients VALUES(194,'SC Demo Component 156','Food','Dairy','g','kg','0.6206','620.6','4.76',4,'"Chiller"',0,0,1,'["downtown","midtown","airport","westend"]','CMP-SCDEMO-156','','{}');
INSERT INTO Ingredients VALUES(195,'SC Demo Component 157','Food','Dry Goods','ml','l','1.8937','1893.7','2.4',5,'"Dry Store"',0,0,1,'["downtown","midtown","airport","westend"]','CMP-SCDEMO-157','','{}');
INSERT INTO Ingredients VALUES(196,'SC Demo Component 158','Food','Seafood','pcs','pcs','0.4894','0.4894','4.5',6,'"Chiller"',0,0,1,'["downtown","midtown","airport","westend"]','CMP-SCDEMO-158','','{}');
INSERT INTO Ingredients VALUES(197,'SC Demo Component 159','Food','Beverages','g','kg','0.7635','763.5','0.59',7,'"Dry Store"',0,0,1,'["downtown","midtown","airport","westend"]','CMP-SCDEMO-159','','{}');
INSERT INTO Ingredients VALUES(198,'SC Demo Component 160','Food','Packaging','ml','l','1.0495','1049.5','1.38',3,'"Chiller"',0,0,1,'["downtown","midtown","airport","westend"]','CMP-SCDEMO-160','','{}');
INSERT INTO Ingredients VALUES(199,'SC Demo Component 161','Food','Proteins','pcs','pcs','1.576','1.576','1.47',4,'"Dry Store"',0,0,1,'["downtown","midtown","airport","westend"]','CMP-SCDEMO-161','','{}');
INSERT INTO Ingredients VALUES(200,'SC Demo Component 162','Food','Produce','g','kg','1.067','1067.0','0.6',5,'"Chiller"',0,0,1,'["downtown","midtown","airport","westend"]','CMP-SCDEMO-162','','{}');
INSERT INTO Ingredients VALUES(201,'SC Demo Component 163','Food','Dairy','ml','l','1.452','1452.0','1.5',6,'"Dry Store"',0,0,1,'["downtown","midtown","airport","westend"]','CMP-SCDEMO-163','','{}');
INSERT INTO Ingredients VALUES(202,'SC Demo Component 164','Food','Dry Goods','pcs','pcs','1.672','1.672','2.45',7,'"Chiller"',0,0,1,'["downtown","midtown","airport","westend"]','CMP-SCDEMO-164','','{}');
INSERT INTO Ingredients VALUES(203,'SC Demo Component 165','Food','Seafood','g','kg','0.9647','964.7','3.27',3,'"Dry Store"',0,0,1,'["downtown","midtown","airport","westend"]','CMP-SCDEMO-165','','{}');
INSERT INTO Ingredients VALUES(204,'SC Demo Component 166','Food','Beverages','ml','l','0.3475','347.5','5.22',4,'"Chiller"',0,0,1,'["downtown","midtown","airport","westend"]','CMP-SCDEMO-166','','{}');
INSERT INTO Ingredients VALUES(205,'SC Demo Component 167','Food','Packaging','pcs','pcs','1.9533','1.9533','2.9',5,'"Dry Store"',0,0,1,'["downtown","midtown","airport","westend"]','CMP-SCDEMO-167','','{}');
INSERT INTO Ingredients VALUES(206,'SC Demo Component 168','Food','Proteins','g','kg','0.397','397.0','5.16',6,'"Chiller"',0,0,1,'["downtown","midtown","airport","westend"]','CMP-SCDEMO-168','','{}');
INSERT INTO Ingredients VALUES(207,'SC Demo Component 169','Food','Produce','ml','l','0.4427','442.7','4.41',7,'"Dry Store"',0,0,1,'["downtown","midtown","airport","westend"]','CMP-SCDEMO-169','','{}');
INSERT INTO Ingredients VALUES(208,'SC Demo Component 170','Food','Dairy','pcs','pcs','1.7154','1.7154','3.35',3,'"Chiller"',0,0,1,'["downtown","midtown","airport","westend"]','CMP-SCDEMO-170','','{}');
INSERT INTO Ingredients VALUES(209,'SC FIFO Demo Wagyu','Food','Proteins','g','kg','0.042','42.0','2.5',3,'["Chiller"]',0,0,1,'["downtown","midtown","airport","westend"]','CMP-SCFIFO-001','','{}');
CREATE TABLE IF NOT EXISTS "InventoryAlerts" (

    "Id" INTEGER NOT NULL CONSTRAINT "PK_InventoryAlerts" PRIMARY KEY AUTOINCREMENT,

    "ItemName" TEXT NOT NULL,

    "Stock" TEXT NOT NULL,

    "Status" TEXT NOT NULL,

    "Threshold" TEXT NOT NULL

);
INSERT INTO InventoryAlerts VALUES(1,'Wagyu Beef (A5)','1.2 kg','critical','2 kg');
INSERT INTO InventoryAlerts VALUES(2,'Black Truffle','180 g','low','250 g');
INSERT INTO InventoryAlerts VALUES(3,'Merlot Reserve 2019','4 btl','critical','6 btl');
CREATE TABLE IF NOT EXISTS "Locations" (

    "Id" INTEGER NOT NULL CONSTRAINT "PK_Locations" PRIMARY KEY AUTOINCREMENT,

    "ExternalId" TEXT NOT NULL,

    "Name" TEXT NOT NULL,

    "Address" TEXT NOT NULL,

    "SalesToday" TEXT NOT NULL,

    "SalesWtd" TEXT NOT NULL,

    "SalesMtd" TEXT NOT NULL,

    "SalesYtd" TEXT NOT NULL,

    "SalesPrevToday" TEXT NOT NULL,

    "SalesPrevWtd" TEXT NOT NULL,

    "SalesPrevMtd" TEXT NOT NULL,

    "SalesPrevYtd" TEXT NOT NULL,

    "CoversToday" INTEGER NOT NULL,

    "CoversWtd" INTEGER NOT NULL,

    "CoversMtd" INTEGER NOT NULL,

    "CoversYtd" INTEGER NOT NULL,

    "CoversPrevToday" INTEGER NOT NULL,

    "CoversPrevWtd" INTEGER NOT NULL,

    "CoversPrevMtd" INTEGER NOT NULL,

    "CoversPrevYtd" INTEGER NOT NULL,

    "ChecksToday" INTEGER NOT NULL,

    "ChecksWtd" INTEGER NOT NULL,

    "ChecksMtd" INTEGER NOT NULL,

    "ChecksYtd" INTEGER NOT NULL,

    "ChecksPrevToday" INTEGER NOT NULL,

    "ChecksPrevWtd" INTEGER NOT NULL,

    "ChecksPrevMtd" INTEGER NOT NULL,

    "ChecksPrevYtd" INTEGER NOT NULL

, "CompanyId" INTEGER, "AddressLine1" TEXT NOT NULL DEFAULT '', "AddressLine2" TEXT NOT NULL DEFAULT '', "City" TEXT NOT NULL DEFAULT '', "StateProvince" TEXT NOT NULL DEFAULT '', "Postcode" TEXT NOT NULL DEFAULT '', "PrincipalContactUserId" INTEGER);
INSERT INTO Locations VALUES(1,'downtown','Downtown','12 King St, Kuala Lumpur, Wilayah Persekutuan 50000','4210.0','22800.0','82400.0','448500.0','3890.0','20500.0','84100.0','382000.0',112,598,2540,26900,105,551,2610,23800,51,274,1160,12230,48,252,1190,10800,1,'12 King St','','Kuala Lumpur','Wilayah Persekutuan','50000',1);
INSERT INTO Locations VALUES(2,'midtown','Midtown','88 Park Ave, Petaling Jaya, Selangor 47810','2980.0','16100.0','58200.0','318400.0','2750.0','14900.0','55900.0','274000.0',80,428,1820,19200,74,396,1870,17100,36,196,832,8730,34,181,855,7780,1,'88 Park Ave','','Petaling Jaya','Selangor','47810',3);
INSERT INTO Locations VALUES(3,'airport','Airport Terminal','T2 Departures, Sepang, Selangor 43900','1380.0','7440.0','26800.0','147200.0','1510.0','8100.0','29400.0','128600.0',38,205,874,9240,42,224,960,8100,27,146,624,6590,30,160,686,5780,1,'T2 Departures','','Sepang','Selangor','43900',3);
INSERT INTO Locations VALUES(4,'westend','West End','5 Harbour Walk, George Town, Penang 10200','1080.0','5710.0','19940.0','110680.0','990.0','5250.0','18600.0','94800.0',26,132,587,6100,24,122,570,5420,12,61,270,2810,11,56,262,2490,1,'5 Harbour Walk','','George Town','Penang','10200',1);
INSERT INTO Locations VALUES(5,'sg-marina','Marina Square','6 Raffles Blvd, Singapore, Singapore 039594','0.0','0.0','0.0','0.0','0.0','0.0','0.0','0.0',0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,2,'6 Raffles Blvd','','Singapore','Singapore','039594',5);
INSERT INTO Locations VALUES(6,'sg-orchard','Orchard Gateway','277 Orchard Road, Singapore, Singapore 238858','0.0','0.0','0.0','0.0','0.0','0.0','0.0','0.0',0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,2,'277 Orchard Road','','Singapore','Singapore','238858',6);
INSERT INTO Locations VALUES(7,'au-cbd','Melbourne CBD','250 Flinders Lane, Melbourne, Victoria 3000','0.0','0.0','0.0','0.0','0.0','0.0','0.0','0.0',0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,3,'250 Flinders Lane','','Melbourne','Victoria','3000',7);
INSERT INTO Locations VALUES(8,'au-southbank','Southbank','3 Southgate Ave, Southbank, Victoria 3006','0.0','0.0','0.0','0.0','0.0','0.0','0.0','0.0',0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,3,'3 Southgate Ave','','Southbank','Victoria','3006',7);
CREATE TABLE IF NOT EXISTS "MenuItems" (

    "Id" INTEGER NOT NULL CONSTRAINT "PK_MenuItems" PRIMARY KEY AUTOINCREMENT,

    "Name" TEXT NOT NULL,

    "Category" TEXT NOT NULL,

    "Orders" INTEGER NOT NULL,

    "Revenue" TEXT NOT NULL,

    "MarginPercent" INTEGER NOT NULL

);
INSERT INTO MenuItems VALUES(1,'Wagyu Burger','food',312,'9360.0',68);
INSERT INTO MenuItems VALUES(2,'Truffle Pasta','food',287,'10332.0',74);
INSERT INTO MenuItems VALUES(3,'Grilled Salmon','food',251,'11295.0',71);
INSERT INTO MenuItems VALUES(4,'Merlot Reserve','beverage',198,'4752.0',76);
INSERT INTO MenuItems VALUES(5,'Craft Beer','beverage',174,'2088.0',71);
CREATE TABLE IF NOT EXISTS "PurchaseOrders" (

    "Id" INTEGER NOT NULL CONSTRAINT "PK_PurchaseOrders" PRIMARY KEY AUTOINCREMENT,

    "PoNumber" TEXT NOT NULL,

    "VendorName" TEXT NOT NULL,

    "OrderDate" TEXT NOT NULL,

    "DeliveryDate" TEXT NOT NULL,

    "Status" TEXT NOT NULL

, "DocumentType" TEXT NOT NULL DEFAULT 'PO', "CompanyId" INTEGER, "LocationIdsJson" TEXT NOT NULL DEFAULT '[]', "InitiatedBy" TEXT NOT NULL DEFAULT '', "ApprovedBy" TEXT NOT NULL DEFAULT '', "ApprovedAt" TEXT, "ReceivedAt" TEXT, "ReconciledAt" TEXT, "VendorShareToken" TEXT NOT NULL DEFAULT '', "VendorAcceptedAt" TEXT, "VendorAcceptedBy" TEXT NOT NULL DEFAULT '');
INSERT INTO PurchaseOrders VALUES(1,'PO-2841','Premium Meats Co.','2025-06-18','2025-06-21','In Transit','PO',NULL,'[]','','',NULL,NULL,NULL,'a94fd1a8e1ff4ab1aea78176811c730f',NULL,'');
INSERT INTO PurchaseOrders VALUES(2,'PO-2842','Fine Truffle Imports','2025-06-19','2025-06-22','Confirmed','PO',NULL,'[]','','',NULL,NULL,NULL,'7a8129d5a20a4f4dbc44caeac32aa2c1',NULL,'');
INSERT INTO PurchaseOrders VALUES(3,'PO-2843','Premium Meats Co.','2026-06-30','2026-07-03','Pending','PO',NULL,'[]','','',NULL,NULL,NULL,'b7dabbab03864fa69821c7b984304f89',NULL,'');
INSERT INTO PurchaseOrders VALUES(4,'PO-2844','Premium Meats Co.','2026-07-01','2026-07-04','Pending','PO',NULL,'[]','','',NULL,NULL,NULL,'00957d3449f14c049bbd6cd716d6a06b',NULL,'');
INSERT INTO PurchaseOrders VALUES(5,'PO-2845','Premium Meats Co.','2026-07-01','2026-07-04','Pending','PO',NULL,'[]','','',NULL,NULL,NULL,'2f6e7682f3cc4c41a26c4f356a511a29',NULL,'');
INSERT INTO PurchaseOrders VALUES(6,'PO-2846','Heritage Pantry Supply','2026-07-01','2026-07-04','Pending','PO',NULL,'[]','','',NULL,NULL,NULL,'3e8e087065f848c9bc2a1d17e1d86191',NULL,'');
INSERT INTO PurchaseOrders VALUES(7,'BH-DOWN-001-20260630','Premium Meats Co.','2026-06-30','2026-07-03','Pending','PO',NULL,'[]','','',NULL,NULL,NULL,'fb24962854034b04902bd8c38fa7e6a7',NULL,'');
INSERT INTO PurchaseOrders VALUES(8,'BH-DOWN-002-20260630','Ocean Fresh Seafood','2026-06-30','2026-07-03','Pending','PO',NULL,'[]','','',NULL,NULL,NULL,'9f6de5509eae4932ad7aa5a7e36013ce',NULL,'');
INSERT INTO PurchaseOrders VALUES(9,'BH-AT-001-20260701','Artisan Dairy Co.','2026-07-01','2026-07-04','Pending Approval','PR',NULL,'[]','','',NULL,NULL,NULL,'c5961095ed264806b0786de2fbedacdc',NULL,'');
INSERT INTO PurchaseOrders VALUES(10,'BH-AT-002-20260701','Green Valley Produce','2026-07-01','2026-07-04','Pending Approval','PR',NULL,'[]','','',NULL,NULL,NULL,'47994332215d4bdf9b58c23a09bd0c16',NULL,'');
INSERT INTO PurchaseOrders VALUES(11,'BH-DOWN-001-20260701','Artisan Dairy Co.','2026-07-01','2026-07-04','Open','PO',1,'["downtown"]','DRA Super Admin','DRA Super Admin','2026-07-01 06:15:32.4835466',NULL,NULL,'37ef2324828549d7921f719b0e48fd01',NULL,'');
INSERT INTO PurchaseOrders VALUES(12,'BH-DOWN-002-20260701','Fine Truffle Imports','2026-07-01','2026-07-04','Open','PO',1,'["downtown"]','DRA Super Admin','DRA Super Admin','2026-07-01 06:15:32.5306137',NULL,NULL,'d5508c0f855546f3a3dd803b00257e3d',NULL,'');
INSERT INTO PurchaseOrders VALUES(13,'BH-DOWN-003-20260701','Premium Meats Co.','2026-07-01','2026-07-04','Open','PO',1,'["downtown"]','DRA Super Admin','DRA Super Admin','2026-07-01 06:15:32.5312303',NULL,NULL,'5b6e9e968751465caf19216982370297',NULL,'');
INSERT INTO PurchaseOrders VALUES(14,'BH-AT-003-20260701','Artisan Dairy Co.','2026-07-01','2026-07-04','Open','PO',1,'["airport"]','DRA Super Admin','DRA Super Admin','2026-07-01 06:23:42.0083172',NULL,NULL,'400f196eab704b57b049be82d1411561',NULL,'');
INSERT INTO PurchaseOrders VALUES(15,'BH-AT-004-20260701','Green Valley Produce','2026-07-01','2026-07-04','Open','PO',1,'["airport"]','DRA Super Admin','DRA Super Admin','2026-07-01 06:23:42.0085667',NULL,NULL,'23108a5e68f74a4ab4ad8940ddaf41a0',NULL,'');
INSERT INTO PurchaseOrders VALUES(16,'BH-MIDT-001-20260701','Premium Meats Co.','2026-07-01','2026-07-04','Open','PO',1,'["midtown"]','DRA Super Admin','DRA Super Admin','2026-07-01 07:55:43.5466379',NULL,NULL,'8573178d72f442689b026dae5ab2a694',NULL,'');
INSERT INTO PurchaseOrders VALUES(17,'BH-AT-005-20260701','Artisan Dairy Co.','2026-07-01','2026-07-04','Open','PO',1,'["airport"]','DRA Super Admin','DRA Super Admin','2026-07-01 10:40:46.4011002',NULL,NULL,'4019fdb2a36c45ad894b6dddb6189ba8',NULL,'');
INSERT INTO PurchaseOrders VALUES(18,'BH-AT-006-20260701','Green Valley Produce','2026-07-01','2026-07-04','Open','PO',1,'["airport"]','DRA Super Admin','DRA Super Admin','2026-07-01 10:40:46.4013514',NULL,NULL,'0fc62947d6434a2da5f101d01ca8a5cf',NULL,'');
INSERT INTO PurchaseOrders VALUES(19,'BH-AT-007-20260701','Artisan Dairy Co.','2026-07-01','2026-07-04','Open','PO',1,'["airport"]','DRA Super Admin','DRA Super Admin','2026-07-01 10:51:48.3247167',NULL,NULL,'ded7765e350d4ea586c3ed390ded753f',NULL,'');
INSERT INTO PurchaseOrders VALUES(20,'BH-AT-008-20260701','Green Valley Produce','2026-07-01','2026-07-04','Open','PO',1,'["airport"]','DRA Super Admin','DRA Super Admin','2026-07-01 10:51:48.3249949',NULL,NULL,'c0bc5f44bf0848f3b579e4fbf2e8618a',NULL,'');
INSERT INTO PurchaseOrders VALUES(21,'BH-AT-009-20260701','Artisan Dairy Co.','2026-07-01','2026-07-04','Open','PO',1,'["airport"]','DRA Super Admin','DRA Super Admin','2026-07-01 10:52:57.5508953',NULL,NULL,'69aa79c7bb9540f48db416774487fbea',NULL,'');
INSERT INTO PurchaseOrders VALUES(22,'BH-AT-010-20260701','Green Valley Produce','2026-07-01','2026-07-04','Open','PO',1,'["airport"]','DRA Super Admin','DRA Super Admin','2026-07-01 10:52:57.5510472',NULL,NULL,'39fb1f0c8db64400a82e3594f39d5b3c',NULL,'');
INSERT INTO PurchaseOrders VALUES(23,'BH-AT-011-20260701','Artisan Dairy Co.','2026-07-01','2026-07-04','Open','PO',1,'["airport"]','DRA Super Admin','DRA Super Admin','2026-07-01 11:17:54.9495462',NULL,NULL,'5a47a3991f344cf1b6055e12abd643fb',NULL,'');
INSERT INTO PurchaseOrders VALUES(24,'BH-AT-012-20260701','Green Valley Produce','2026-07-01','2026-07-04','Reconciled','PO',1,'["airport"]','DRA Super Admin','DRA Super Admin','2026-07-01 11:17:54.9639381','2026-07-01 11:20:58.7307437','2026-07-01 11:21:04.3546844','efb3f3bebb0042598aefe261f4f05dc6','2026-07-01 11:19:04.2345416','Lee Wei Jie');
INSERT INTO PurchaseOrders VALUES(25,'PO-2026-FIFO-001','Premium Meats Co.','2026-05-20','2026-05-22','Reconciled','PO',1,'["downtown"]','Demo Seeder','Demo Seeder','2026-05-21 03:13:07.9739239','2026-05-22 03:13:07.9739239','2026-05-22 03:13:07.9739239','',NULL,'');
INSERT INTO PurchaseOrders VALUES(26,'PO-2026-FIFO-014','Premium Meats Co.','2026-06-06','2026-06-08','Reconciled','PO',1,'["downtown"]','Demo Seeder','Demo Seeder','2026-06-07 03:13:07.9739239','2026-06-08 03:13:07.9739239','2026-06-08 03:13:07.9739239','',NULL,'');
INSERT INTO PurchaseOrders VALUES(27,'PO-2026-FIFO-028','Premium Meats Co.','2026-06-22','2026-06-24','Reconciled','PO',1,'["downtown"]','Demo Seeder','Demo Seeder','2026-06-23 03:13:07.9739239','2026-06-24 03:13:07.9739239','2026-06-24 03:13:07.9739239','',NULL,'');
CREATE TABLE IF NOT EXISTS "RevenueDataPoints" (

    "Id" INTEGER NOT NULL CONSTRAINT "PK_RevenueDataPoints" PRIMARY KEY AUTOINCREMENT,

    "Period" TEXT NOT NULL,

    "Label" TEXT NOT NULL,

    "CurrentValue" TEXT NOT NULL,

    "PriorValue" TEXT NOT NULL,

    "Covers" INTEGER NULL

);
INSERT INTO RevenueDataPoints VALUES(1,'week','Mon','4820.0','4200.0',124);
INSERT INTO RevenueDataPoints VALUES(2,'week','Tue','5340.0','4900.0',138);
INSERT INTO RevenueDataPoints VALUES(3,'week','Wed','6100.0','5200.0',162);
INSERT INTO RevenueDataPoints VALUES(4,'week','Thu','5780.0','5600.0',151);
INSERT INTO RevenueDataPoints VALUES(5,'week','Fri','8920.0','7800.0',234);
INSERT INTO RevenueDataPoints VALUES(6,'week','Sat','11240.0','10100.0',298);
INSERT INTO RevenueDataPoints VALUES(7,'week','Sun','9650.0','8900.0',256);
CREATE TABLE IF NOT EXISTS "Vendors" (

    "Id" INTEGER NOT NULL CONSTRAINT "PK_Vendors" PRIMARY KEY AUTOINCREMENT,

    "ExternalId" TEXT NOT NULL,

    "Name" TEXT NOT NULL,

    "Type" TEXT NOT NULL,

    "Brn" TEXT NOT NULL,

    "Products" TEXT NOT NULL,

    "City" TEXT NOT NULL,

    "State" TEXT NOT NULL,

    "ContactPerson" TEXT NOT NULL,

    "Mobile" TEXT NOT NULL,

    "Email" TEXT NOT NULL,

    "Address" TEXT NOT NULL,

    "Engaged" INTEGER NOT NULL

, "ContactPosition" TEXT NOT NULL DEFAULT '', "ContactsJson" TEXT NOT NULL DEFAULT '[]');
INSERT INTO Vendors VALUES(1,'V001','Premium Meats Co.','offline','202001012345','Proteins, Poultry','Kuala Lumpur','WP','Ahmad Razali','+60 12-345 6789','sales@premiummeats.my','12 Jalan Semarak, KL 50450',1,'','[]');
INSERT INTO Vendors VALUES(2,'V002','Fine Truffle Imports','offline','201801056789','Truffles, Specialty','Petaling Jaya','Selangor','Jean-Luc Prive','+60 16-778 9900','jl@truffleimports.com','88 Jalan PJ 14, PJ 47810',1,'','[]');
INSERT INTO Vendors VALUES(3,'V004','Wine & Spirits Direct','online','202201034567','Wine, Spirits, Beer','Kuala Lumpur','WP','Melissa Tan','+60 19-887 6543','melissa@winedirect.my','Online ΓÇö Nationwide Delivery',1,'','[]');
INSERT INTO Vendors VALUES(4,'V005','Ocean Fresh Seafood','offline','201701023456','Seafood, Fresh Fish','Port Klang','Selangor','Haji Sulaiman','+60 13-456 7890','fresh@oceanfish.my','Lot 22, Jln Pelabuhan, Port Klang',1,'Sales Manager','[{"Name":"Haji Sulaiman","Position":"Sales Manager","Mobile":"\u002B60 13-456 7890","Email":"fresh@oceanfish.my","IsDefault":true}]');
INSERT INTO Vendors VALUES(5,'V003','Artisan Dairy Co.','offline','201601034321','Dairy, Cheese','Kuala Lumpur','WP','Sofia Lim','+60 18-901 2233','orders@artisandairy.my','45 Jalan Tun Razak, KL 50400',1,'Sales Executive','[{"Name":"Sofia Lim","Position":"Sales Executive","Mobile":"\u002B60 18-901 2233","Email":"orders@artisandairy.my","IsDefault":true}]');
INSERT INTO Vendors VALUES(6,'V006','Green Valley Produce','online','202001067890','Produce, Fresh Vegetables','Cameron Highlands','Pahang','Lee Wei Jie','+60 12-778 3344','sales@greenvalley.my','Online ΓÇö Nationwide Delivery',1,'Account Manager','[{"name":"Lee Wei Jie","position":"Account Manager","mobile":"\u002B60 12-778 3344","email":"sales@greenvalley.my","isDefault":true}]');
INSERT INTO Vendors VALUES(7,'V007','Heritage Pantry Supply','offline','201901078901','Dry Goods, Canned Goods','Shah Alam','Selangor','Ravi Kumar','+60 17-234 5678','sales@heritagepantry.my','Lot 8, Jalan Stesen 19/7, Shah Alam 40300',1,'Sales Manager','[{"Name":"Ravi Kumar","Position":"Sales Manager","Mobile":"\u002B60 17-234 5678","Email":"sales@heritagepantry.my","IsDefault":true}]');
INSERT INTO Vendors VALUES(8,'V010','Bean Brothers Roasters','offline','202101011234','Coffee, Beverages','Petaling Jaya','Selangor','Marcus Tan','+60 16-445 6677','wholesale@beanbrothers.my','22 Jalan SS15, PJ 47500',0,'Sales Manager','[]');
INSERT INTO Vendors VALUES(9,'V011','Metro Canned Foods','offline','201801045678','Dry Goods, Canned Goods','Kuala Lumpur','WP','Nurul Izzati','+60 12-556 7890','orders@metrocanned.my','56 Jalan Ipoh, KL 51200',1,'Account Manager','[{"name":"Nurul Izzati","position":"Account Manager","mobile":"\u002B60 12-556 7890","email":"orders@metrocanned.my","isDefault":true}]');
INSERT INTO Vendors VALUES(10,'V012','Pacific Poultry Supply','offline','201501012345','Poultry, Duck','Kajang','Selangor','Tan Mei Ling','+60 12-111 2233','sales@pacificpoultry.my','Lot 5, Jalan Mewah, Kajang 43000',0,'Sales Manager','[]');
INSERT INTO Vendors VALUES(11,'V013','Harbour Fish Market','offline','201601023456','Seafood, Fresh Fish','Port Klang','Selangor','Captain Wong','+60 16-222 3344','orders@harbourfish.my','Pasar Besar, Port Klang 42000',0,'Account Manager','[]');
INSERT INTO Vendors VALUES(12,'V014','Valley Dairy Wholesale','offline','201701034567','Dairy, Cream, Butter','Seremban','Negeri Sembilan','Priya Nair','+60 17-333 4455','wholesale@valleydairy.my','12 Jalan Dairy, Seremban 70000',0,'Sales Executive','[]');
INSERT INTO Vendors VALUES(13,'V015','Mediterranean Oil Co.','offline','201801045678','Oils, Vinegars','Kuala Lumpur','WP','Marco Rossi','+60 18-444 5566','marco@medoil.my','88 Jalan Ampang, KL 50450',0,'Sales Manager','[]');
INSERT INTO Vendors VALUES(14,'V016','Spice Route Trading','offline','201901056789','Spices, Seasonings','Melaka','Melaka','Aisha Rahman','+60 19-555 6677','aisha@spiceroute.my','45 Jalan Hang Tuah, Melaka 75300',0,'Account Manager','[]');
INSERT INTO Vendors VALUES(15,'V017','Fresh Herb Gardens','online','202001067890','Herbs, Salad Leaves','Cameron Highlands','Pahang','David Choong','+60 12-666 7788','orders@freshherb.my','Online ΓÇö Nationwide Delivery',0,'Sales Executive','[]');
INSERT INTO Vendors VALUES(16,'V018','Grain & Mill Co.','offline','202101078901','Rice, Flour, Grains','Shah Alam','Selangor','Hassan Ibrahim','+60 13-777 8899','sales@grainmill.my','Lot 3, Jalan Bukit Raja, Shah Alam 40000',0,'Sales Manager','[]');
INSERT INTO Vendors VALUES(17,'V019','Noodle House Supply','offline','202201089012','Pasta, Noodles','Petaling Jaya','Selangor','Lily Tan','+60 14-888 9900','lily@noodlehouse.my','18 Jalan SS2, PJ 47300',0,'Account Manager','[]');
INSERT INTO Vendors VALUES(18,'V020','Frozen Foods Express','offline','202301090123','Frozen Vegetables, Fries','Subang Jaya','Selangor','Kevin Lim','+60 15-999 0011','kevin@frozenexpress.my','7 Jalan SS15, Subang 47500',0,'Sales Executive','[]');
INSERT INTO Vendors VALUES(19,'V021','Juice Factory Direct','offline','202401101234','Juices, Purees','Kuala Lumpur','WP','Siti Aminah','+60 16-101 1122','orders@juicefactory.my','22 Jalan Tun Razak, KL 50400',0,'Sales Manager','[]');
INSERT INTO Vendors VALUES(20,'V022','Craft Brew Alliance','offline','202501112345','Craft Beer, Kegs','Petaling Jaya','Selangor','Jake Morrison','+60 17-202 2233','jake@craftbrew.my','5 Jalan Gasing, PJ 46000',0,'Account Manager','[]');
INSERT INTO Vendors VALUES(21,'V023','Tea & Tisane Co.','online','202601123456','Tea, Herbal Infusions','Ipoh','Perak','Mei Lin','+60 18-303 3344','sales@teatisane.my','Online ΓÇö Nationwide Delivery',0,'Sales Executive','[]');
INSERT INTO Vendors VALUES(22,'V024','Syrup & Mixers Ltd','offline','202701134567','Syrups, Mixers, Tonic','Kuala Lumpur','WP','Raj Patel','+60 19-404 4455','raj@syrupmixers.my','33 Jalan Bukit Bintang, KL 55100',0,'Sales Manager','[]');
INSERT INTO Vendors VALUES(23,'V025','Plant Milk Wholesale','offline','202801145678','Oat Milk, Plant Milks','Shah Alam','Selangor','Emma Walsh','+60 12-505 5566','emma@plantmilk.my','9 Jalan Plumbum, Shah Alam 40300',0,'Account Manager','[]');
INSERT INTO Vendors VALUES(24,'V026','Butcher Block Prime','offline','202901156789','Lamb, Pork, Premium Meats','Kuala Lumpur','WP','Frankie Ho','+60 13-606 6677','frankie@butcherblock.my','101 Jalan Maarof, KL 59000',0,'Sales Manager','[]');
INSERT INTO Vendors VALUES(25,'V027','Organic Veg Hub','online','203001167890','Organic Produce','Cameron Highlands','Pahang','Nadia Yusof','+60 14-707 7788','nadia@organicveg.my','Online ΓÇö Nationwide Delivery',0,'Sales Executive','[]');
INSERT INTO Vendors VALUES(26,'V028','Condiment Central','offline','203101178901','Sauces, Passata, Condiments','Klang','Selangor','Vikram Singh','+60 15-808 8899','vikram@condiment.my','Lot 12, Jalan Kapar, Klang 41000',0,'Account Manager','[]');
INSERT INTO Vendors VALUES(27,'V029','Bakery Ingredients MY','offline','203201189012','Flour, Yeast, Baking','Kuala Lumpur','WP','Christine Lee','+60 16-909 9900','christine@bakerying.my','44 Jalan Sultan, KL 50000',0,'Sales Manager','[]');
INSERT INTO Vendors VALUES(28,'V030','Imported Cheese Cellar','offline','203301190123','Cheese, Dairy Speciality','Petaling Jaya','Selangor','Giuseppe Conti','+60 17-010 1011','giuseppe@cheesecellar.my','66 Jalan SS21, PJ 47400',0,'Account Manager','[]');
INSERT INTO Vendors VALUES(29,'V031','Bottled Water Works','offline','203401201234','Still Water, Sparkling','Rawang','Selangor','Azman Hakim','+60 18-121 2122','azman@waterworks.my','Lot 8, Jalan Industri, Rawang 48000',0,'Sales Executive','[]');
INSERT INTO Vendors VALUES(30,'VZZ999','API Probe Vendor','offline','','','','','','','','',0,'','[{"name":"","position":"","mobile":"","email":"","isDefault":true}]');
INSERT INTO Vendors VALUES(31,'V032','Malaysian Yogurt Company','offline','0928310-951','Dairy, Juice','Kuala Lumpur','WP','dra','01262353503','dra@test.com','2 jalan wan kadir, 60000',1,'sales','[{"name":"dra","position":"sales","mobile":"01262353503","email":"dra@test.com","isDefault":true}]');
CREATE TABLE IF NOT EXISTS "PurchaseOrderItems" (

    "Id" INTEGER NOT NULL CONSTRAINT "PK_PurchaseOrderItems" PRIMARY KEY AUTOINCREMENT,

    "PurchaseOrderId" INTEGER NOT NULL,

    "Name" TEXT NOT NULL,

    "Quantity" TEXT NOT NULL,

    "UnitPrice" TEXT NOT NULL,

    "Unit" TEXT NOT NULL,

    "DeliveryPackage" TEXT NOT NULL, "ComponentId" TEXT NOT NULL DEFAULT '', "ComponentName" TEXT NOT NULL DEFAULT '', "ComponentUom" TEXT NOT NULL DEFAULT '', "ReceivedQuantity" REAL, "ReceivedUnitPrice" REAL, "ReconciledQuantity" REAL, "ReconciledUnitPrice" REAL, "VendorProductId" TEXT NOT NULL DEFAULT '', "IssuedUnitPrice" REAL NOT NULL DEFAULT 0, "TaxAmount" REAL NOT NULL DEFAULT 0,

    CONSTRAINT "FK_PurchaseOrderItems_PurchaseOrders_PurchaseOrderId" FOREIGN KEY ("PurchaseOrderId") REFERENCES "PurchaseOrders" ("Id") ON DELETE CASCADE

);
INSERT INTO PurchaseOrderItems VALUES(1,1,'Wagyu Beef (A5)','5.0','380.0','kg','Vacuum-sealed 1kg portions','','','',NULL,NULL,NULL,NULL,'',0.0,0.0);
INSERT INTO PurchaseOrderItems VALUES(2,1,'Ribeye (Prime)','8.0','145.0','kg','Whole primal cut','','','',NULL,NULL,NULL,NULL,'',0.0,0.0);
INSERT INTO PurchaseOrderItems VALUES(3,2,'Black Truffle','500.0','1.8','g','Individual 50g jars','','','',NULL,NULL,NULL,NULL,'',0.0,0.0);
INSERT INTO PurchaseOrderItems VALUES(4,3,'Test Product','2.0','42.0','Box','Box/12','','','',NULL,NULL,NULL,NULL,'',0.0,0.0);
INSERT INTO PurchaseOrderItems VALUES(5,4,'Test','1.0','42.0','Box','Box/12','','','',NULL,NULL,NULL,NULL,'',0.0,0.0);
INSERT INTO PurchaseOrderItems VALUES(6,5,'A','1.0','10.0','Box','Box','','','',NULL,NULL,NULL,NULL,'',0.0,0.0);
INSERT INTO PurchaseOrderItems VALUES(7,6,'B','2.0','20.0','Tin','Tin','','','',NULL,NULL,NULL,NULL,'',0.0,0.0);
INSERT INTO PurchaseOrderItems VALUES(8,7,'Wagyu Ribeye','2.0','85.5','Kg','Kg','','','',NULL,NULL,NULL,NULL,'',0.0,0.0);
INSERT INTO PurchaseOrderItems VALUES(9,8,'Salmon Fillet','5.0','42.0','Kg','Kg','','','',NULL,NULL,NULL,NULL,'',0.0,0.0);
INSERT INTO PurchaseOrderItems VALUES(10,9,'Burrata','3.0','52.5','Case/6each','Case/6each','','','',NULL,NULL,NULL,NULL,'',0.0,0.0);
INSERT INTO PurchaseOrderItems VALUES(11,10,'Peeled Garlic','1.0','16.0','Tub/kg','Tub/kg','','','',NULL,NULL,NULL,NULL,'',0.0,0.0);
INSERT INTO PurchaseOrderItems VALUES(12,11,'Burrata','3.0','52.5','Case/6each','Case/6each','CMP-BURRAT-001','Burrata','pcs',NULL,NULL,NULL,NULL,'VP-BUR001',52.5,0.0);
INSERT INTO PurchaseOrderItems VALUES(13,12,'Black Truffle','4.0','180.0','100gr','100gr','CMP-BLACKT-001','Black Truffle','g',NULL,NULL,NULL,NULL,'VP-TRU001',180.0,0.0);
INSERT INTO PurchaseOrderItems VALUES(14,13,'Free-range Chicken Breast','1.0','42.0','2kg','2kg','CMP-WAGYUB-001','Wagyu Beef A5','kg',NULL,NULL,NULL,NULL,'VP-CHX001',42.0,0.0);
INSERT INTO PurchaseOrderItems VALUES(15,13,'Wagyu Beef A5','1.0','380.0','Kg','Kg','CMP-WAGYUB-001','Wagyu Beef A5','kg',NULL,NULL,NULL,NULL,'VP-WAG001',380.0,0.0);
INSERT INTO PurchaseOrderItems VALUES(16,14,'Burrata','1.0','52.5','Case/6each','Case/6each','CMP-BURRAT-001','Burrata','pcs',NULL,NULL,NULL,NULL,'VP-BUR001',52.5,0.0);
INSERT INTO PurchaseOrderItems VALUES(17,15,'Peeled Garlic','1.0','16.0','Tub/kg','Tub/kg','CMP-PEELED-001','Peeled Garlic','kg',NULL,NULL,NULL,NULL,'VP-GAR006',16.0,0.0);
INSERT INTO PurchaseOrderItems VALUES(18,16,'Free-range Chicken Breast','1.0','42.0','2kg','2kg','CMP-WAGYUB-001','Wagyu Beef A5','kg',NULL,NULL,NULL,NULL,'VP-CHX001',42.0,0.0);
INSERT INTO PurchaseOrderItems VALUES(19,16,'Wagyu Beef A5','1.0','380.0','Kg','Kg','CMP-WAGYUB-001','Wagyu Beef A5','kg',NULL,NULL,NULL,NULL,'VP-WAG001',380.0,0.0);
INSERT INTO PurchaseOrderItems VALUES(20,17,'Burrata','2.0','52.5','Case/6each','Case/6each','CMP-BURRAT-001','Burrata','pcs',NULL,NULL,NULL,NULL,'VP-BUR001',52.5,0.0);
INSERT INTO PurchaseOrderItems VALUES(21,18,'Peeled Garlic','1.0','16.0','Tub/kg','Tub/kg','CMP-PEELED-001','Peeled Garlic','kg',NULL,NULL,NULL,NULL,'VP-GAR006',16.0,0.0);
INSERT INTO PurchaseOrderItems VALUES(22,19,'Burrata','2.0','52.5','Case/6each','Case/6each','CMP-BURRAT-001','Burrata','pcs',NULL,NULL,NULL,NULL,'VP-BUR001',52.5,0.0);
INSERT INTO PurchaseOrderItems VALUES(23,20,'Peeled Garlic','1.0','16.0','Tub/kg','Tub/kg','CMP-PEELED-001','Peeled Garlic','kg',NULL,NULL,NULL,NULL,'VP-GAR006',16.0,0.0);
INSERT INTO PurchaseOrderItems VALUES(24,21,'Burrata','2.0','52.5','Case/6each','Case/6each','CMP-BURRAT-001','Burrata','pcs',NULL,NULL,NULL,NULL,'VP-BUR001',52.5,0.0);
INSERT INTO PurchaseOrderItems VALUES(25,22,'Peeled Garlic','1.0','16.0','Tub/kg','Tub/kg','CMP-PEELED-001','Peeled Garlic','kg',NULL,NULL,NULL,NULL,'VP-GAR006',16.0,0.0);
INSERT INTO PurchaseOrderItems VALUES(26,23,'Burrata','1.0','52.5','Case/6each','Case/6each','CMP-BURRAT-001','Burrata','pcs',NULL,NULL,NULL,NULL,'VP-BUR001',52.5,0.0);
INSERT INTO PurchaseOrderItems VALUES(27,24,'Peeled Garlic','1.0','16.5','Tub/kg','Tub/kg','CMP-PEELED-001','Peeled Garlic','kg',1.0,16.5,1.0,16.5,'VP-GAR006',16.0,0.0);
CREATE TABLE IF NOT EXISTS "Companies" (

    "Id" INTEGER NOT NULL CONSTRAINT "PK_Companies" PRIMARY KEY AUTOINCREMENT,

    "Name" TEXT NOT NULL,

    "Brn" TEXT NOT NULL,

    "GstTin" TEXT NOT NULL,

    "CountryCode" TEXT NOT NULL,

    "AddressLine1" TEXT NOT NULL,

    "AddressLine2" TEXT NOT NULL,

    "City" TEXT NOT NULL,

    "StateProvince" TEXT NOT NULL,

    "Postcode" TEXT NOT NULL,

    "Phone" TEXT NOT NULL,

    "Fax" TEXT NOT NULL,

    "Email" TEXT NOT NULL,

    "Active" INTEGER NOT NULL

);
INSERT INTO Companies VALUES(1,'Bisync Hospitality Sdn Bhd','202301012345','SST-2023-00123456','MY','Level 12, Menara Bisync','Jalan Sultan Ismail','Kuala Lumpur','Wilayah Persekutuan','50250','+60 3-2145 6789','+60 3-2145 6790','hq@bisync.cloud',1);
INSERT INTO Companies VALUES(2,'Bisync Retail Pte Ltd','201934587N','GST-2019-34587','SG','20 Anson Road','#18-02','Singapore','Singapore','079912','+65 6123 4567','+65 6123 4568','sg@bisync.cloud',1);
INSERT INTO Companies VALUES(3,'Bisync Eats Australia Pty Ltd','ACN 665 910 224','ABN 19 665 910 224','AU','80 Collins Street','Level 9','Melbourne','Victoria','3000','+61 3 8456 1200','+61 3 8456 1201','au@bisync.cloud',1);
CREATE TABLE IF NOT EXISTS "AppUsers" (

    "Id" INTEGER NOT NULL CONSTRAINT "PK_AppUsers" PRIMARY KEY AUTOINCREMENT,

    "FullName" TEXT NOT NULL,

    "Email" TEXT NOT NULL,

    "Role" TEXT NOT NULL,

    "Phone" TEXT NOT NULL,

    "Active" INTEGER NOT NULL

, "CompanyId" INTEGER, "LocationIdsJson" TEXT NOT NULL DEFAULT '[]', "AccessJson" TEXT NOT NULL DEFAULT '', EmployeeId INTEGER NULL, "PasswordHash" TEXT);
INSERT INTO AppUsers VALUES(1,'James Dubois','james.dubois@bisync.cloud','Head Chef','+60 12-111 2233',1,1,'[1,4]','{"modules":["RMS"],"rms":{"enabled":true,"tasks":{"viewOrder":true,"createEditOrder":true,"productManagement":true,"createEdit":true,"viewVendorList":true,"viewReports":true}}}',1,NULL);
INSERT INTO AppUsers VALUES(2,'Sarah Chen','sarah.chen@bisync.cloud','Operations Manager','+60 16-222 3344',1,1,'[1,2,3,4]','{"modules":[]}',2,NULL);
INSERT INTO AppUsers VALUES(3,'Ahmad Razali','ahmad.razali@bisync.cloud','Location Manager','+60 19-333 4455',1,1,'[2,3]','{"modules":[]}',3,NULL);
INSERT INTO AppUsers VALUES(4,'Melissa Tan','melissa.tan@bisync.cloud','Finance Admin','+60 17-444 5566',1,1,'[1,2,3,4]','{"modules":[]}',4,NULL);
INSERT INTO AppUsers VALUES(5,'Nadia Lim','nadia.lim@bisync.cloud','Retail Lead','+65 8123 9901',1,2,'[5,6]','{"modules":[]}',6,NULL);
INSERT INTO AppUsers VALUES(6,'Ethan Goh','ethan.goh@bisync.cloud','Store Supervisor','+65 8123 9902',1,2,'[5,6]','{"modules":[]}',7,NULL);
INSERT INTO AppUsers VALUES(7,'Olivia Brooks','olivia.brooks@bisync.cloud','Regional Manager','+61 412 556 771',1,3,'[7,8]','{"modules":[]}',11,NULL);
INSERT INTO AppUsers VALUES(8,'Liam Carter','liam.carter@bisync.cloud','Operations Analyst','+61 412 556 772',1,3,'[7]','{"modules":[]}',12,NULL);
INSERT INTO AppUsers VALUES(9,'Daniel Ong','daniel.ong@bisync.cloud','Sous Chef','+60 18-555 6677',1,1,'[1]','{"modules":[]}',5,NULL);
INSERT INTO AppUsers VALUES(10,'Priya Sharma','priya.sharma@bisync.cloud','Category Manager','+65 8123 9903',1,2,'[5]','{"modules":[]}',8,NULL);
INSERT INTO AppUsers VALUES(11,'Wei Ming Tan','wei.ming@bisync.cloud','Inventory Coordinator','+65 8123 9904',1,2,'[6]','{"modules":[]}',9,NULL);
INSERT INTO AppUsers VALUES(12,'Amelia Koh','amelia.koh@bisync.cloud','Floor Manager','+65 8123 9905',1,2,'[5,6]','{"modules":[]}',10,NULL);
INSERT INTO AppUsers VALUES(13,'Emma Wilson','emma.wilson@bisync.cloud','Head Chef','+61 412 556 773',1,3,'[7]','{"modules":[]}',13,NULL);
INSERT INTO AppUsers VALUES(14,'Noah Singh','noah.singh@bisync.cloud','Payroll Officer','+61 412 556 774',1,3,'[8]','{"modules":[]}',14,NULL);
INSERT INTO AppUsers VALUES(15,'Chloe Nguyen','chloe.nguyen@bisync.cloud','HR Coordinator','+61 412 556 775',1,3,'[7,8]','{"modules":[]}',15,NULL);
INSERT INTO AppUsers VALUES(16,'Nurul Huda Osman','nurul.huda@bisync.cloud','Service Manager','+60 12-601 1001',1,1,'[1,2,3,4]','{"modules":[]}',17,NULL);
INSERT INTO AppUsers VALUES(17,'Raj Kumar','raj.kumar@bisync.cloud','Service Supervisor','+60 12-601 1002',1,1,'[1,2]','{"modules":[]}',18,NULL);
INSERT INTO AppUsers VALUES(18,'Siti Aminah Rahman','siti.aminah@bisync.cloud','Waiter','+60 12-601 1003',1,1,'[1]','{"modules":[]}',19,NULL);
INSERT INTO AppUsers VALUES(19,'Wong Mei Ling','mei.ling@bisync.cloud','Waiter','+60 12-601 1004',1,1,'[2]','{"modules":[]}',20,NULL);
INSERT INTO AppUsers VALUES(20,'Arif Hassan','arif.hassan@bisync.cloud','Waiter','+60 12-601 1005',1,1,'[3]','{"modules":[]}',21,NULL);
INSERT INTO AppUsers VALUES(21,'Farah Izzati','farah.izzati@bisync.cloud','Host','+60 12-601 1006',1,1,'[4]','{"modules":[]}',22,NULL);
INSERT INTO AppUsers VALUES(22,'Kevin Lim','kevin.lim@bisync.cloud','Bartender','+60 12-601 1007',1,1,'[1,4]','{"modules":[]}',23,NULL);
INSERT INTO AppUsers VALUES(23,'Priya Menon','priya.menon@bisync.cloud','Waiter','+60 12-601 1008',1,1,'[2,3]','{"modules":[]}',24,NULL);
INSERT INTO AppUsers VALUES(24,'Hakim Zulkifli','hakim.zulkifli@bisync.cloud','Food Runner','+60 12-601 1009',1,1,'[1]','{"modules":[]}',25,NULL);
INSERT INTO AppUsers VALUES(25,'Michelle Tan','michelle.tan@bisync.cloud','Captain','+60 12-601 1010',1,1,'[1,2]','{"modules":[]}',26,NULL);
INSERT INTO AppUsers VALUES(26,'Marco D''Silva','marco.silva@bisync.cloud','Line Cook','+60 12-602 2001',1,1,'[1]','{"modules":[]}',27,NULL);
INSERT INTO AppUsers VALUES(27,'Aisyah Rahman','aisyah.rahman@bisync.cloud','Prep Cook','+60 12-602 2002',1,1,'[2]','{"modules":[]}',28,NULL);
INSERT INTO AppUsers VALUES(28,'Lorraine Yeoh','lorraine.yeoh@bisync.cloud','Pastry Chef','+60 12-602 2003',1,1,'[1,4]','{"modules":[]}',29,NULL);
INSERT INTO AppUsers VALUES(29,'Vijay Nair','vijay.nair@bisync.cloud','Line Cook','+60 12-602 2004',1,1,'[3]','{"modules":[]}',30,NULL);
INSERT INTO AppUsers VALUES(30,'Adam Ismail','adam.ismail@bisync.cloud','Commis Chef','+60 12-602 2005',1,1,'[1]','{"modules":[]}',31,NULL);
INSERT INTO AppUsers VALUES(31,'Nur Izzati Kamal','nur.izzati@bisync.cloud','Kitchen Assistant','+60 12-602 2006',1,1,'[4]','{"modules":[]}',32,NULL);
INSERT INTO AppUsers VALUES(32,'Tan Boon Kiat','boon.kiat@bisync.cloud','Grill Cook','+60 12-602 2007',1,1,'[2,3]','{"modules":[]}',33,NULL);
INSERT INTO AppUsers VALUES(33,'Ravi Chandran','ravi.chandran@bisync.cloud','Kitchen Steward','+60 12-602 2008',1,1,'[1]','{"modules":[]}',34,NULL);
INSERT INTO AppUsers VALUES(34,'Test Persist User','test.persist@bisync.cloud','Operations Coordinator','+60 12-999 8877',0,1,'[]','{"modules":[]}',36,NULL);
INSERT INTO AppUsers VALUES(35,'DRA Super Admin','dra@cubevalue.com','Super Admin','+60 3-0000 0000',1,1,'[3,7,8,1,2,5,6,4]','{"modules":["RMS","POS","HRM","Accounting"],"rms":{"enabled":true,"tasks":{"viewOrder":true,"createEditOrder":true,"approveOrder":true,"receiveOrder":true,"consolidateOrder":true,"cashPurchase":true,"orderTemplate":true,"productManagement":true,"offlineSales":true,"batchStockAdjustment":true,"inventoryPost":true,"inventoryConfirmation":true,"inventoryAdjustment":true,"creditNote":true,"wastage":true,"transfer":true,"inventoryConfiguration":true,"createEdit":true,"activateDeactivateVendorProducts":true,"createEditComponentGroup":true,"createEditStorageAssignment":true,"accountMapping":true,"viewVendorList":true,"viewVendorProducts":true,"activateDeactivateVendor":true,"viewProductSubProduct":true,"manageProductSubProduct":true,"manageCustomers":true,"customerGroup":true,"manageSalesOrder":true,"manageInvoice":true,"promotionScheduler":true,"viewReports":true}},"superAdmin":true}',NULL,'v1:4fXLxrbT2dp1IF7f26/4KQ==:1IsjM1RYoTNAGsYM2j1pzQIxH5COfHUS4OOBeS6dPeU=');
CREATE TABLE IF NOT EXISTS "EmployeeLevels" (

    "Id" INTEGER NOT NULL CONSTRAINT "PK_EmployeeLevels" PRIMARY KEY AUTOINCREMENT,

    "LevelName" TEXT NOT NULL,

    "AnnualLeaveDays" INTEGER NOT NULL,

    "SickLeaveDays" INTEGER NOT NULL,

    "OvertimeEligible" INTEGER NOT NULL,

    "WorkingHoursPerDay" REAL NOT NULL,

    "BreakHoursPerShift" REAL NOT NULL,

    "PublicHolidayEligible" INTEGER NOT NULL,

    "IsShift" INTEGER NOT NULL DEFAULT 0,

    "ShiftType" TEXT NULL

, Active INTEGER NOT NULL DEFAULT 1);
INSERT INTO EmployeeLevels VALUES(1,'Junior',12,14,1,8.0,1.0,1,1,'Morning Shift',1);
INSERT INTO EmployeeLevels VALUES(2,'Management',20,18,1,8.0,1.0,1,1,'Flexible Shift',1);
INSERT INTO EmployeeLevels VALUES(3,'Director',28,30,0,8.0,1.0,0,0,NULL,1);
CREATE TABLE IF NOT EXISTS "Employees" (

    "Id" INTEGER NOT NULL CONSTRAINT "PK_Employees" PRIMARY KEY AUTOINCREMENT,

    "EmployeeCode" TEXT NOT NULL,

    "Name" TEXT NOT NULL,

    "Email" TEXT NOT NULL,

    "Mobile" TEXT NOT NULL,

    "Department" TEXT NOT NULL,

    "Position" TEXT NOT NULL,

    "JoinDate" TEXT NOT NULL,

    "FingerprintEnrolled" INTEGER NOT NULL,

    "FaceRecognitionEnrolled" INTEGER NOT NULL,

    "IsShiftEmployee" INTEGER NOT NULL,

    "ShiftType" TEXT NULL,

    "PosEnabled" INTEGER NOT NULL,

    "BisyncEnabled" INTEGER NOT NULL,

    "WorkingHoursPerDay" REAL NOT NULL,

    "EmployeeLevelId" INTEGER NULL,

    "Nationality" TEXT NULL,

    "IdPassportNumber" TEXT NULL,

    "DateOfBirth" TEXT NULL,

    "PersonalEmail" TEXT NULL,

    "PermanentAddress" TEXT NULL,

    "PosPin" TEXT NULL,

    "PosPinMustChange" INTEGER NOT NULL DEFAULT 0,

    "ReportsToId" INTEGER NULL,

    "DivisionId" INTEGER NULL,

    "DepartmentId" INTEGER NULL, Active INTEGER NOT NULL DEFAULT 1, CheckinMethod TEXT NOT NULL DEFAULT 'Biometrics', PayrollPin TEXT NULL, PayrollPinMustChange INTEGER NOT NULL DEFAULT 1, BaseSalary REAL NULL, ServiceAllowance REAL NULL, TransportAllowance REAL NULL, AccommodationAllowance REAL NULL, MobileAllowance REAL NULL, OtherAllowancesJson TEXT NOT NULL DEFAULT '[]', WorkPermitByCompany INTEGER NULL, TransportProvided INTEGER NOT NULL DEFAULT 0, TransportCarModel TEXT NULL, TransportPlateNumber TEXT NULL, AccommodationProvided INTEGER NOT NULL DEFAULT 0, AccommodationAddress TEXT NULL, AccommodationLeasingPeriod TEXT NULL, MobileProvided INTEGER NOT NULL DEFAULT 0, MobileAllowancePhone TEXT NULL, MobileProvider TEXT NULL, OvertimeAllowanceEnabled INTEGER NOT NULL DEFAULT 0, AccommodationLeaseStart TEXT NULL, AccommodationLeaseEnd TEXT NULL, BonusEnabled INTEGER NOT NULL DEFAULT 0, BonusMonthly INTEGER NOT NULL DEFAULT 0, BonusAnnually INTEGER NOT NULL DEFAULT 0, BonusAmount REAL NULL, BonusByBasicSalary INTEGER NOT NULL DEFAULT 0, BonusByService INTEGER NOT NULL DEFAULT 0, BankName TEXT NULL, BankAccountNumber TEXT NULL, BankAccountHolderName TEXT NULL, MaritalStatus TEXT NULL,

    FOREIGN KEY("EmployeeLevelId") REFERENCES "EmployeeLevels"("Id")

);
INSERT INTO Employees VALUES(1,'000001','James Dubois','james.dubois@bisync.cloud','+60 12-111 2233','Kitchen','Head Chef','2019-03-15',0,0,1,NULL,1,1,8.0,2,'Malaysian',NULL,'1988-04-12',NULL,NULL,'1234',1,NULL,2,3,1,'POS','000000',1,8500.0,500.0,300.0,0.0,200.0,'[]',NULL,0,NULL,NULL,0,NULL,NULL,0,NULL,NULL,1,NULL,NULL,0,0,0,NULL,0,0,NULL,NULL,NULL,NULL);
INSERT INTO Employees VALUES(2,'000002','Sarah Chen','sarah.chen@bisync.cloud','+60 16-222 3344','Operations','Operations Manager','2020-06-01',0,0,1,NULL,0,1,8.0,2,'Malaysian',NULL,'1985-09-03',NULL,NULL,NULL,0,NULL,1,1,1,'Biometrics','000000',1,12000.0,800.0,400.0,600.0,300.0,'[]',NULL,0,NULL,NULL,0,NULL,NULL,0,NULL,NULL,0,NULL,NULL,0,0,0,NULL,0,0,NULL,NULL,NULL,NULL);
INSERT INTO Employees VALUES(3,'000003','Ahmad Razali','ahmad.razali@bisync.cloud','+60 19-333 4455','Operations','Location Manager','2021-01-10',0,0,1,NULL,0,1,8.0,2,'Malaysian',NULL,'1992-02-20',NULL,NULL,NULL,0,NULL,1,1,1,'Biometrics','000000',1,7000.0,400.0,300.0,0.0,150.0,'[]',NULL,0,NULL,NULL,0,NULL,NULL,0,NULL,NULL,0,NULL,NULL,0,0,0,NULL,0,0,NULL,NULL,NULL,NULL);
INSERT INTO Employees VALUES(4,'000004','Melissa Tan','melissa.tan@bisync.cloud','+60 17-444 5566','Finance','Finance Admin','2022-04-20',0,0,1,NULL,0,1,8.0,1,'Malaysian',NULL,'1994-11-08',NULL,NULL,NULL,0,NULL,3,4,1,'Biometrics','000000',1,5500.0,300.0,200.0,0.0,100.0,'[]',NULL,0,NULL,NULL,0,NULL,NULL,0,NULL,NULL,0,NULL,NULL,0,0,0,NULL,0,0,NULL,NULL,NULL,NULL);
INSERT INTO Employees VALUES(5,'000005','Daniel Ong','daniel.ong@bisync.cloud','+60 18-555 6677','Kitchen','Sous Chef','2023-08-05',0,0,1,NULL,1,1,8.0,2,'Malaysian',NULL,'1996-07-15',NULL,NULL,'1234',1,NULL,2,3,1,'Biometrics','000000',1,6000.0,350.0,250.0,0.0,150.0,'[]',NULL,0,NULL,NULL,0,NULL,NULL,0,NULL,NULL,1,NULL,NULL,0,0,0,NULL,0,0,NULL,NULL,NULL,NULL);
INSERT INTO Employees VALUES(6,'000006','Nadia Lim','nadia.lim@bisync.cloud','+65 8123 9901','Retail','Retail Lead','2020-02-14',0,0,1,NULL,0,1,8.0,2,'Singaporean',NULL,NULL,NULL,NULL,NULL,0,NULL,4,5,1,'Biometrics','000000',1,NULL,NULL,NULL,NULL,NULL,'[]',NULL,0,NULL,NULL,0,NULL,NULL,0,NULL,NULL,0,NULL,NULL,0,0,0,NULL,0,0,NULL,NULL,NULL,NULL);
INSERT INTO Employees VALUES(7,'000007','Ethan Goh','ethan.goh@bisync.cloud','+65 8123 9902','Retail','Store Supervisor','2021-07-01',0,0,1,NULL,1,1,8.0,2,'Singaporean',NULL,NULL,NULL,NULL,'1234',1,NULL,4,5,1,'Biometrics','000000',1,NULL,NULL,NULL,NULL,NULL,'[]',NULL,0,NULL,NULL,0,NULL,NULL,0,NULL,NULL,0,NULL,NULL,0,0,0,NULL,0,0,NULL,NULL,NULL,NULL);
INSERT INTO Employees VALUES(8,'000008','Priya Sharma','priya.sharma@bisync.cloud','+65 8123 9903','Merchandising','Category Manager','2022-03-18',0,0,1,NULL,0,1,8.0,2,'Singaporean',NULL,NULL,NULL,NULL,NULL,0,NULL,4,6,1,'Biometrics','000000',1,NULL,NULL,NULL,NULL,NULL,'[]',NULL,0,NULL,NULL,0,NULL,NULL,0,NULL,NULL,0,NULL,NULL,0,0,0,NULL,0,0,NULL,NULL,NULL,NULL);
INSERT INTO Employees VALUES(9,'000009','Wei Ming Tan','wei.ming@bisync.cloud','+65 8123 9904','Operations','Inventory Coordinator','2022-11-09',0,0,1,NULL,0,1,8.0,1,'Singaporean',NULL,NULL,NULL,NULL,NULL,0,NULL,1,1,1,'Biometrics','000000',1,NULL,NULL,NULL,NULL,NULL,'[]',NULL,0,NULL,NULL,0,NULL,NULL,0,NULL,NULL,0,NULL,NULL,0,0,0,NULL,0,0,NULL,NULL,NULL,NULL);
INSERT INTO Employees VALUES(10,'000010','Amelia Koh','amelia.koh@bisync.cloud','+65 8123 9905','Customer Experience','Floor Manager','2024-01-22',0,0,1,NULL,0,1,8.0,2,'Singaporean',NULL,NULL,NULL,NULL,NULL,0,NULL,4,7,1,'Biometrics','000000',1,NULL,NULL,NULL,NULL,NULL,'[]',NULL,0,NULL,NULL,0,NULL,NULL,0,NULL,NULL,0,NULL,NULL,0,0,0,NULL,0,0,NULL,NULL,NULL,NULL);
INSERT INTO Employees VALUES(11,'000011','Olivia Brooks','olivia.brooks@bisync.cloud','+61 412 556 771','Operations','Regional Manager','2018-09-03',0,0,1,NULL,0,1,8.0,2,'Australian',NULL,NULL,NULL,NULL,NULL,0,NULL,1,1,1,'Biometrics','000000',1,NULL,NULL,NULL,NULL,NULL,'[]',NULL,0,NULL,NULL,0,NULL,NULL,0,NULL,NULL,0,NULL,NULL,0,0,0,NULL,0,0,NULL,NULL,NULL,NULL);
INSERT INTO Employees VALUES(12,'000012','Liam Carter','liam.carter@bisync.cloud','+61 412 556 772','Operations','Operations Analyst','2021-05-17',0,0,1,NULL,0,1,8.0,1,'Australian',NULL,NULL,NULL,NULL,NULL,0,NULL,1,1,1,'Biometrics','000000',1,NULL,NULL,NULL,NULL,NULL,'[]',NULL,0,NULL,NULL,0,NULL,NULL,0,NULL,NULL,0,NULL,NULL,0,0,0,NULL,0,0,NULL,NULL,NULL,NULL);
INSERT INTO Employees VALUES(13,'000013','Emma Wilson','emma.wilson@bisync.cloud','+61 412 556 773','Kitchen','Head Chef','2020-10-28',0,0,1,NULL,1,1,8.0,2,'Australian',NULL,NULL,NULL,NULL,'1234',1,NULL,2,3,1,'Biometrics','000000',1,NULL,NULL,NULL,NULL,NULL,'[]',NULL,0,NULL,NULL,0,NULL,NULL,0,NULL,NULL,0,NULL,NULL,0,0,0,NULL,0,0,NULL,NULL,NULL,NULL);
INSERT INTO Employees VALUES(14,'000014','Noah Singh','noah.singh@bisync.cloud','+61 412 556 774','Finance','Payroll Officer','2023-02-06',0,0,1,NULL,0,1,8.0,1,'Australian',NULL,NULL,NULL,NULL,NULL,0,NULL,3,4,1,'Biometrics','000000',1,NULL,NULL,NULL,NULL,NULL,'[]',NULL,0,NULL,NULL,0,NULL,NULL,0,NULL,NULL,0,NULL,NULL,0,0,0,NULL,0,0,NULL,NULL,NULL,NULL);
INSERT INTO Employees VALUES(15,'000015','Chloe Nguyen','chloe.nguyen@bisync.cloud','+61 412 556 775','People','HR Coordinator','2024-04-15',0,0,1,NULL,0,1,8.0,1,'Australian',NULL,NULL,NULL,NULL,NULL,0,NULL,5,8,1,'Biometrics','000000',1,NULL,NULL,NULL,NULL,NULL,'[]',NULL,0,NULL,NULL,0,NULL,NULL,0,NULL,NULL,0,NULL,NULL,0,0,0,NULL,0,0,NULL,NULL,NULL,NULL);
INSERT INTO Employees VALUES(16,'000016','Daniel Ra','dra@test.com','+60126233503','Finance','Chief Executive Officer','2026-06-26',0,0,1,NULL,0,0,8.0,1,NULL,NULL,NULL,NULL,NULL,NULL,0,NULL,3,4,1,'Biometrics','000000',1,NULL,NULL,NULL,NULL,NULL,'[]',NULL,0,NULL,NULL,0,NULL,NULL,0,NULL,NULL,0,NULL,NULL,0,0,0,NULL,0,0,NULL,NULL,NULL,NULL);
INSERT INTO Employees VALUES(17,'000017','Nurul Huda Osman','nurul.huda@bisync.cloud','+60 12-601 1001','Service','Service Manager','2018-05-12',0,0,1,NULL,0,1,8.0,2,'Malaysian',NULL,NULL,NULL,NULL,NULL,0,NULL,2,9,1,'Biometrics','000000',1,NULL,NULL,NULL,NULL,NULL,'[]',NULL,0,NULL,NULL,0,NULL,NULL,0,NULL,NULL,0,NULL,NULL,0,0,0,NULL,0,0,NULL,NULL,NULL,NULL);
INSERT INTO Employees VALUES(18,'000018','Raj Kumar','raj.kumar@bisync.cloud','+60 12-601 1002','Service','Service Supervisor','2020-03-08',0,0,1,NULL,1,1,8.0,2,'Malaysian',NULL,NULL,NULL,NULL,'1234',1,NULL,2,9,1,'Biometrics','000000',1,NULL,NULL,NULL,NULL,NULL,'[]',NULL,0,NULL,NULL,0,NULL,NULL,0,NULL,NULL,0,NULL,NULL,0,0,0,NULL,0,0,NULL,NULL,NULL,NULL);
INSERT INTO Employees VALUES(19,'000019','Siti Aminah Rahman','siti.aminah@bisync.cloud','+60 12-601 1003','Service','Waiter','2022-07-19',0,0,1,NULL,1,1,8.0,1,'Malaysian',NULL,NULL,NULL,NULL,'1234',1,NULL,2,9,1,'Biometrics','000000',1,NULL,NULL,NULL,NULL,NULL,'[]',NULL,0,NULL,NULL,0,NULL,NULL,0,NULL,NULL,0,NULL,NULL,0,0,0,NULL,0,0,NULL,NULL,NULL,NULL);
INSERT INTO Employees VALUES(20,'000020','Wong Mei Ling','mei.ling@bisync.cloud','+60 12-601 1004','Service','Waiter','2022-09-03',0,0,1,NULL,1,1,8.0,1,'Malaysian',NULL,NULL,NULL,NULL,'1234',1,NULL,2,9,1,'Biometrics','000000',1,NULL,NULL,NULL,NULL,NULL,'[]',NULL,0,NULL,NULL,0,NULL,NULL,0,NULL,NULL,0,NULL,NULL,0,0,0,NULL,0,0,NULL,NULL,NULL,NULL);
INSERT INTO Employees VALUES(21,'000021','Arif Hassan','arif.hassan@bisync.cloud','+60 12-601 1005','Service','Waiter','2023-01-16',0,0,1,NULL,1,1,8.0,1,'Malaysian',NULL,NULL,NULL,NULL,'1234',1,NULL,2,9,1,'Biometrics','000000',1,NULL,NULL,NULL,NULL,NULL,'[]',NULL,0,NULL,NULL,0,NULL,NULL,0,NULL,NULL,0,NULL,NULL,0,0,0,NULL,0,0,NULL,NULL,NULL,NULL);
INSERT INTO Employees VALUES(22,'000022','Farah Izzati','farah.izzati@bisync.cloud','+60 12-601 1006','Service','Host','2023-04-22',0,0,1,NULL,1,1,8.0,1,'Malaysian',NULL,NULL,NULL,NULL,'1234',1,NULL,2,9,1,'Biometrics','000000',1,NULL,NULL,NULL,NULL,NULL,'[]',NULL,0,NULL,NULL,0,NULL,NULL,0,NULL,NULL,0,NULL,NULL,0,0,0,NULL,0,0,NULL,NULL,NULL,NULL);
INSERT INTO Employees VALUES(23,'000023','Kevin Lim','kevin.lim@bisync.cloud','+60 12-601 1007','Service','Bartender','2021-11-30',0,0,1,NULL,1,1,8.0,1,'Malaysian',NULL,NULL,NULL,NULL,'1234',1,NULL,2,9,1,'Biometrics','000000',1,NULL,NULL,NULL,NULL,NULL,'[]',NULL,0,NULL,NULL,0,NULL,NULL,0,NULL,NULL,0,NULL,NULL,0,0,0,NULL,0,0,NULL,NULL,NULL,NULL);
INSERT INTO Employees VALUES(24,'000024','Priya Menon','priya.menon@bisync.cloud','+60 12-601 1008','Service','Waiter','2024-02-05',0,0,1,NULL,1,1,8.0,1,'Malaysian',NULL,NULL,NULL,NULL,'1234',1,NULL,2,9,1,'Biometrics','000000',1,NULL,NULL,NULL,NULL,NULL,'[]',NULL,0,NULL,NULL,0,NULL,NULL,0,NULL,NULL,0,NULL,NULL,0,0,0,NULL,0,0,NULL,NULL,NULL,NULL);
INSERT INTO Employees VALUES(25,'000025','Hakim Zulkifli','hakim.zulkifli@bisync.cloud','+60 12-601 1009','Service','Food Runner','2024-06-10',0,0,1,NULL,1,1,8.0,1,'Malaysian',NULL,NULL,NULL,NULL,'1234',1,NULL,2,9,1,'Biometrics','000000',1,NULL,NULL,NULL,NULL,NULL,'[]',NULL,0,NULL,NULL,0,NULL,NULL,0,NULL,NULL,0,NULL,NULL,0,0,0,NULL,0,0,NULL,NULL,NULL,NULL);
INSERT INTO Employees VALUES(26,'000026','Michelle Tan','michelle.tan@bisync.cloud','+60 12-601 1010','Service','Captain','2019-08-14',0,0,1,NULL,1,1,8.0,2,'Malaysian',NULL,NULL,NULL,NULL,'1234',1,NULL,2,9,1,'Biometrics','000000',1,NULL,NULL,NULL,NULL,NULL,'[]',NULL,0,NULL,NULL,0,NULL,NULL,0,NULL,NULL,0,NULL,NULL,0,0,0,NULL,0,0,NULL,NULL,NULL,NULL);
INSERT INTO Employees VALUES(27,'000027','Marco D''Silva','marco.silva@bisync.cloud','+60 12-602 2001','Kitchen','Line Cook','2021-06-07',0,0,1,NULL,1,1,8.0,1,'Malaysian',NULL,NULL,NULL,NULL,'1234',1,NULL,2,3,1,'Biometrics','000000',1,NULL,NULL,NULL,NULL,NULL,'[]',NULL,0,NULL,NULL,0,NULL,NULL,0,NULL,NULL,0,NULL,NULL,0,0,0,NULL,0,0,NULL,NULL,NULL,NULL);
INSERT INTO Employees VALUES(28,'000028','Aisyah Rahman','aisyah.rahman@bisync.cloud','+60 12-602 2002','Kitchen','Prep Cook','2022-10-18',0,0,1,NULL,1,1,8.0,1,'Malaysian',NULL,NULL,NULL,NULL,'1234',1,NULL,2,3,1,'Biometrics','000000',1,NULL,NULL,NULL,NULL,NULL,'[]',NULL,0,NULL,NULL,0,NULL,NULL,0,NULL,NULL,0,NULL,NULL,0,0,0,NULL,0,0,NULL,NULL,NULL,NULL);
INSERT INTO Employees VALUES(29,'000029','Lorraine Yeoh','lorraine.yeoh@bisync.cloud','+60 12-602 2003','Kitchen','Pastry Chef','2020-04-25',0,0,1,NULL,1,1,8.0,2,'Malaysian',NULL,NULL,NULL,NULL,'1234',1,NULL,2,3,1,'Biometrics','000000',1,NULL,NULL,NULL,NULL,NULL,'[]',NULL,0,NULL,NULL,0,NULL,NULL,0,NULL,NULL,0,NULL,NULL,0,0,0,NULL,0,0,NULL,NULL,NULL,NULL);
INSERT INTO Employees VALUES(30,'000030','Vijay Nair','vijay.nair@bisync.cloud','+60 12-602 2004','Kitchen','Line Cook','2023-02-11',0,0,1,NULL,1,1,8.0,1,'Malaysian',NULL,NULL,NULL,NULL,'1234',1,NULL,2,3,1,'Biometrics','000000',1,NULL,NULL,NULL,NULL,NULL,'[]',NULL,0,NULL,NULL,0,NULL,NULL,0,NULL,NULL,0,NULL,NULL,0,0,0,NULL,0,0,NULL,NULL,NULL,NULL);
INSERT INTO Employees VALUES(31,'000031','Adam Ismail','adam.ismail@bisync.cloud','+60 12-602 2005','Kitchen','Commis Chef','2023-09-01',0,0,1,NULL,1,1,8.0,1,'Malaysian',NULL,NULL,NULL,NULL,'1234',1,NULL,2,3,1,'Biometrics','000000',1,NULL,NULL,NULL,NULL,NULL,'[]',NULL,0,NULL,NULL,0,NULL,NULL,0,NULL,NULL,0,NULL,NULL,0,0,0,NULL,0,0,NULL,NULL,NULL,NULL);
INSERT INTO Employees VALUES(32,'000032','Nur Izzati Kamal','nur.izzati@bisync.cloud','+60 12-602 2006','Kitchen','Kitchen Assistant','2024-03-20',0,0,1,NULL,0,1,8.0,1,'Malaysian',NULL,NULL,NULL,NULL,NULL,0,NULL,2,3,1,'Biometrics','000000',1,NULL,NULL,NULL,NULL,NULL,'[]',NULL,0,NULL,NULL,0,NULL,NULL,0,NULL,NULL,0,NULL,NULL,0,0,0,NULL,0,0,NULL,NULL,NULL,NULL);
INSERT INTO Employees VALUES(33,'000033','Tan Boon Kiat','boon.kiat@bisync.cloud','+60 12-602 2007','Kitchen','Grill Cook','2022-05-09',0,0,1,NULL,1,1,8.0,1,'Malaysian',NULL,NULL,NULL,NULL,'1234',1,NULL,2,3,1,'Biometrics','000000',1,NULL,NULL,NULL,NULL,NULL,'[]',NULL,0,NULL,NULL,0,NULL,NULL,0,NULL,NULL,0,NULL,NULL,0,0,0,NULL,0,0,NULL,NULL,NULL,NULL);
INSERT INTO Employees VALUES(34,'000034','Ravi Chandran','ravi.chandran@bisync.cloud','+60 12-602 2008','Kitchen','Kitchen Steward','2024-08-12',0,0,1,NULL,0,1,8.0,1,'Malaysian',NULL,NULL,NULL,NULL,NULL,0,NULL,2,3,1,'Biometrics','000000',1,NULL,NULL,NULL,NULL,NULL,'[]',NULL,0,NULL,NULL,0,NULL,NULL,0,NULL,NULL,0,NULL,NULL,0,0,0,NULL,0,0,NULL,NULL,NULL,NULL);
INSERT INTO Employees VALUES(35,'000035','Daniel Ra','dra@cubevalue.com','+60126233503','Operation','CEO','2026-07-01',0,0,0,NULL,0,0,8.0,3,NULL,NULL,NULL,NULL,NULL,NULL,0,NULL,2,10,1,'Biometrics','000000',1,NULL,NULL,NULL,NULL,NULL,'[]',NULL,0,NULL,NULL,0,NULL,NULL,0,NULL,NULL,0,NULL,NULL,0,0,0,NULL,0,0,NULL,NULL,NULL,NULL);
INSERT INTO Employees VALUES(36,'000036','Test Persist User','test.persist@bisync.cloud','+60 12-999 8877','Operation','Operations Coordinator','2026-06-01',0,0,0,NULL,0,0,8.0,NULL,NULL,NULL,NULL,NULL,NULL,NULL,0,NULL,2,10,1,'Biometrics','000000',1,NULL,NULL,NULL,NULL,NULL,'[]',NULL,0,NULL,NULL,0,NULL,NULL,0,NULL,NULL,0,NULL,NULL,0,0,0,NULL,0,0,NULL,NULL,NULL,NULL);
CREATE TABLE IF NOT EXISTS "LeaveBalances" (

    "EmployeeId" INTEGER NOT NULL CONSTRAINT "PK_LeaveBalances" PRIMARY KEY,

    "RdoBalance" REAL NOT NULL DEFAULT 0,

    "RphBalance" REAL NOT NULL DEFAULT 0,

    "AlBalance" REAL NOT NULL DEFAULT 0,

    FOREIGN KEY("EmployeeId") REFERENCES "Employees"("Id") ON DELETE CASCADE

);
INSERT INTO LeaveBalances VALUES(1,0.0,0.0,16.0);
INSERT INTO LeaveBalances VALUES(2,0.0,0.0,16.0);
INSERT INTO LeaveBalances VALUES(3,0.0,0.0,16.0);
INSERT INTO LeaveBalances VALUES(4,0.0,0.0,16.0);
INSERT INTO LeaveBalances VALUES(5,0.0,0.0,16.0);
INSERT INTO LeaveBalances VALUES(6,0.0,0.0,16.0);
INSERT INTO LeaveBalances VALUES(7,0.0,0.0,16.0);
INSERT INTO LeaveBalances VALUES(8,0.0,0.0,16.0);
INSERT INTO LeaveBalances VALUES(9,0.0,0.0,16.0);
INSERT INTO LeaveBalances VALUES(10,0.0,0.0,16.0);
INSERT INTO LeaveBalances VALUES(11,0.0,0.0,16.0);
INSERT INTO LeaveBalances VALUES(12,0.0,0.0,16.0);
INSERT INTO LeaveBalances VALUES(13,0.0,0.0,16.0);
INSERT INTO LeaveBalances VALUES(14,0.0,0.0,16.0);
INSERT INTO LeaveBalances VALUES(15,0.0,0.0,16.0);
INSERT INTO LeaveBalances VALUES(16,0.0,0.0,28.0);
INSERT INTO LeaveBalances VALUES(17,0.0,0.0,16.0);
INSERT INTO LeaveBalances VALUES(18,0.0,0.0,16.0);
INSERT INTO LeaveBalances VALUES(19,0.0,0.0,16.0);
INSERT INTO LeaveBalances VALUES(20,0.0,0.0,16.0);
INSERT INTO LeaveBalances VALUES(21,0.0,0.0,16.0);
INSERT INTO LeaveBalances VALUES(22,0.0,0.0,16.0);
INSERT INTO LeaveBalances VALUES(23,0.0,0.0,16.0);
INSERT INTO LeaveBalances VALUES(24,0.0,0.0,16.0);
INSERT INTO LeaveBalances VALUES(25,0.0,0.0,16.0);
INSERT INTO LeaveBalances VALUES(26,0.0,0.0,16.0);
INSERT INTO LeaveBalances VALUES(27,0.0,0.0,16.0);
INSERT INTO LeaveBalances VALUES(28,0.0,0.0,16.0);
INSERT INTO LeaveBalances VALUES(29,0.0,0.0,16.0);
INSERT INTO LeaveBalances VALUES(30,0.0,0.0,16.0);
INSERT INTO LeaveBalances VALUES(31,0.0,0.0,16.0);
INSERT INTO LeaveBalances VALUES(32,0.0,0.0,16.0);
INSERT INTO LeaveBalances VALUES(33,0.0,0.0,16.0);
INSERT INTO LeaveBalances VALUES(34,0.0,0.0,16.0);
INSERT INTO LeaveBalances VALUES(35,0.0,0.0,28.0);
INSERT INTO LeaveBalances VALUES(36,0.0,0.0,0.0);
CREATE TABLE Divisions (

    Id INTEGER PRIMARY KEY AUTOINCREMENT,

    Name TEXT NOT NULL,

    Code TEXT NULL

);
INSERT INTO Divisions VALUES(1,'Operations','OPS');
INSERT INTO Divisions VALUES(2,'Food & Beverage','FNB');
INSERT INTO Divisions VALUES(3,'Finance','FIN');
INSERT INTO Divisions VALUES(4,'Retail','RTL');
INSERT INTO Divisions VALUES(5,'Human Resources','HR');
CREATE TABLE Departments (

    Id INTEGER PRIMARY KEY AUTOINCREMENT,

    Name TEXT NOT NULL,

    DivisionId INTEGER NOT NULL,

    FOREIGN KEY (DivisionId) REFERENCES Divisions(Id) ON DELETE CASCADE

);
INSERT INTO Departments VALUES(1,'Operations',1);
INSERT INTO Departments VALUES(2,'Location Management',1);
INSERT INTO Departments VALUES(3,'Kitchen',2);
INSERT INTO Departments VALUES(4,'Finance',3);
INSERT INTO Departments VALUES(5,'Retail',4);
INSERT INTO Departments VALUES(6,'Merchandising',4);
INSERT INTO Departments VALUES(7,'Customer Experience',4);
INSERT INTO Departments VALUES(8,'People',5);
INSERT INTO Departments VALUES(9,'Service',2);
INSERT INTO Departments VALUES(10,'Operation',2);
CREATE TABLE IF NOT EXISTS "CompanySettings" (

    "Id" INTEGER NOT NULL CONSTRAINT "PK_CompanySettings" PRIMARY KEY AUTOINCREMENT,

    "PublicHolidayPayMultiplier" REAL NOT NULL DEFAULT 1.5,

    "OperatingCountryCode" TEXT NOT NULL DEFAULT 'MY'

, ReplacementPublicHolidayEnabled INTEGER NOT NULL DEFAULT 0, GazettedPhReplacementDayEnabled INTEGER NOT NULL DEFAULT 0, GazettedPhNormalHoursRate REAL NOT NULL DEFAULT 1.5, GazettedPhOvertimeHoursRate REAL NOT NULL DEFAULT 2.0, NonGazettedPhReplacementDayEnabled INTEGER NOT NULL DEFAULT 0);
INSERT INTO CompanySettings VALUES(1,1.5,'MY',1,1,1.5,2.0,0);
CREATE TABLE IF NOT EXISTS "PublicHolidays" (

    "Id" INTEGER NOT NULL CONSTRAINT "PK_PublicHolidays" PRIMARY KEY AUTOINCREMENT,

    "Name" TEXT NOT NULL,

    "Date" TEXT NOT NULL,

    "IsRecognized" INTEGER NOT NULL,

    "CountryCode" TEXT NULL,

    "CatalogKey" TEXT NULL

, IsRecurringAnnually INTEGER NOT NULL DEFAULT 0, IsGazetted INTEGER NOT NULL DEFAULT 0);
INSERT INTO PublicHolidays VALUES(1,'New Year''s Day','2026-01-01',1,'MY',NULL,0,0);
INSERT INTO PublicHolidays VALUES(2,'Chinese New Year','2026-01-29',1,'MY',NULL,0,0);
INSERT INTO PublicHolidays VALUES(3,'Chinese New Year (2nd day)','2026-01-30',1,'MY',NULL,0,0);
INSERT INTO PublicHolidays VALUES(4,'Thaipusam','2026-02-03',0,'MY',NULL,0,0);
INSERT INTO PublicHolidays VALUES(5,'Federal Territory Day','2026-02-01',0,'MY',NULL,0,0);
INSERT INTO PublicHolidays VALUES(6,'Labour Day','2026-05-01',1,'MY',NULL,0,0);
INSERT INTO PublicHolidays VALUES(7,'Wesak Day','2026-05-11',1,'MY',NULL,0,0);
INSERT INTO PublicHolidays VALUES(8,'Agong''s Birthday','2026-06-06',1,'MY',NULL,0,0);
INSERT INTO PublicHolidays VALUES(9,'Hari Raya Aidilfitri','2026-06-17',1,'MY',NULL,0,0);
INSERT INTO PublicHolidays VALUES(10,'Hari Raya Aidilfitri (2nd day)','2026-06-18',1,'MY',NULL,0,0);
INSERT INTO PublicHolidays VALUES(11,'Hari Raya Aidiladha','2026-08-24',1,'MY',NULL,0,0);
INSERT INTO PublicHolidays VALUES(12,'Merdeka Day','2026-08-31',1,'MY',NULL,0,0);
INSERT INTO PublicHolidays VALUES(13,'Malaysia Day','2026-09-16',1,'MY',NULL,0,0);
INSERT INTO PublicHolidays VALUES(14,'Awal Muharram','2026-09-14',0,'MY',NULL,0,0);
INSERT INTO PublicHolidays VALUES(15,'Prophet Muhammad''s Birthday','2026-11-23',1,'MY',NULL,0,0);
INSERT INTO PublicHolidays VALUES(16,'Deepavali','2026-11-05',1,'MY',NULL,0,0);
INSERT INTO PublicHolidays VALUES(17,'Christmas Day','2026-12-25',1,'MY',NULL,0,0);
INSERT INTO PublicHolidays VALUES(126,'New Year''s Day','2026-01-01',1,'AU','AU|2026-01-01|NEW YEAR''S DAY',0,1);
INSERT INTO PublicHolidays VALUES(127,'Australia Day','2026-01-26',1,'AU','AU|2026-01-26|AUSTRALIA DAY',0,1);
INSERT INTO PublicHolidays VALUES(128,'Labour Day','2026-03-02',1,'AU','AU|2026-03-02|LABOUR DAY',0,1);
INSERT INTO PublicHolidays VALUES(129,'Canberra Day','2026-03-09',1,'AU','AU|2026-03-09|CANBERRA DAY',0,1);
INSERT INTO PublicHolidays VALUES(130,'Adelaide Cup Day','2026-03-09',1,'AU','AU|2026-03-09|ADELAIDE CUP DAY',0,1);
INSERT INTO PublicHolidays VALUES(131,'Eight Hours Day','2026-03-09',1,'AU','AU|2026-03-09|EIGHT HOURS DAY',0,1);
INSERT INTO PublicHolidays VALUES(132,'Labour Day','2026-03-09',1,'AU','AU|2026-03-09|LABOUR DAY',0,1);
INSERT INTO PublicHolidays VALUES(133,'Good Friday','2026-04-03',1,'AU','AU|2026-04-03|GOOD FRIDAY',0,1);
INSERT INTO PublicHolidays VALUES(134,'Easter Eve','2026-04-04',1,'AU','AU|2026-04-04|EASTER EVE',0,1);
INSERT INTO PublicHolidays VALUES(135,'Easter Sunday','2026-04-05',1,'AU','AU|2026-04-05|EASTER SUNDAY',0,1);
INSERT INTO PublicHolidays VALUES(136,'Easter Monday','2026-04-06',1,'AU','AU|2026-04-06|EASTER MONDAY',0,1);
INSERT INTO PublicHolidays VALUES(137,'Anzac Day','2026-04-25',1,'AU','AU|2026-04-25|ANZAC DAY',0,1);
INSERT INTO PublicHolidays VALUES(138,'Anzac Day','2026-04-25',1,'AU','AU|2026-04-25|ANZAC DAY',0,1);
INSERT INTO PublicHolidays VALUES(139,'Anzac Day','2026-04-27',1,'AU','AU|2026-04-27|ANZAC DAY',0,1);
INSERT INTO PublicHolidays VALUES(140,'May Day','2026-05-04',1,'AU','AU|2026-05-04|MAY DAY',0,1);
INSERT INTO PublicHolidays VALUES(141,'Labour Day','2026-05-04',1,'AU','AU|2026-05-04|LABOUR DAY',0,1);
INSERT INTO PublicHolidays VALUES(142,'Reconciliation Day','2026-06-01',1,'AU','AU|2026-06-01|RECONCILIATION DAY',0,1);
INSERT INTO PublicHolidays VALUES(143,'Western Australia Day','2026-06-01',1,'AU','AU|2026-06-01|WESTERN AUSTRALIA DAY',0,1);
INSERT INTO PublicHolidays VALUES(144,'King''s Birthday','2026-06-08',1,'AU','AU|2026-06-08|KING''S BIRTHDAY',0,1);
INSERT INTO PublicHolidays VALUES(145,'Picnic Day','2026-08-03',1,'AU','AU|2026-08-03|PICNIC DAY',0,1);
INSERT INTO PublicHolidays VALUES(146,'Friday before AFL Grand Final','2026-09-25',1,'AU','AU|2026-09-25|FRIDAY BEFORE AFL GRAND FINAL',0,1);
INSERT INTO PublicHolidays VALUES(147,'King''s Birthday','2026-09-28',1,'AU','AU|2026-09-28|KING''S BIRTHDAY',0,1);
INSERT INTO PublicHolidays VALUES(148,'Labour Day','2026-10-05',1,'AU','AU|2026-10-05|LABOUR DAY',0,1);
INSERT INTO PublicHolidays VALUES(149,'King''s Birthday','2026-10-05',1,'AU','AU|2026-10-05|KING''S BIRTHDAY',0,1);
INSERT INTO PublicHolidays VALUES(150,'Melbourne Cup','2026-11-03',1,'AU','AU|2026-11-03|MELBOURNE CUP',0,1);
INSERT INTO PublicHolidays VALUES(151,'Christmas Day','2026-12-25',1,'AU','AU|2026-12-25|CHRISTMAS DAY',0,1);
INSERT INTO PublicHolidays VALUES(152,'Boxing Day','2026-12-28',1,'AU','AU|2026-12-28|BOXING DAY',0,1);
INSERT INTO PublicHolidays VALUES(153,'New Year''s Day','2027-01-01',1,'AU','AU|2027-01-01|NEW YEAR''S DAY',0,1);
INSERT INTO PublicHolidays VALUES(154,'Australia Day','2027-01-26',1,'AU','AU|2027-01-26|AUSTRALIA DAY',0,1);
INSERT INTO PublicHolidays VALUES(155,'Labour Day','2027-03-01',1,'AU','AU|2027-03-01|LABOUR DAY',0,1);
INSERT INTO PublicHolidays VALUES(156,'Canberra Day','2027-03-08',1,'AU','AU|2027-03-08|CANBERRA DAY',0,1);
INSERT INTO PublicHolidays VALUES(157,'Adelaide Cup Day','2027-03-08',1,'AU','AU|2027-03-08|ADELAIDE CUP DAY',0,1);
INSERT INTO PublicHolidays VALUES(158,'Eight Hours Day','2027-03-08',1,'AU','AU|2027-03-08|EIGHT HOURS DAY',0,1);
INSERT INTO PublicHolidays VALUES(159,'Labour Day','2027-03-08',1,'AU','AU|2027-03-08|LABOUR DAY',0,1);
INSERT INTO PublicHolidays VALUES(160,'Good Friday','2027-03-26',1,'AU','AU|2027-03-26|GOOD FRIDAY',0,1);
INSERT INTO PublicHolidays VALUES(161,'Easter Eve','2027-03-27',1,'AU','AU|2027-03-27|EASTER EVE',0,1);
INSERT INTO PublicHolidays VALUES(162,'Easter Sunday','2027-03-28',1,'AU','AU|2027-03-28|EASTER SUNDAY',0,1);
INSERT INTO PublicHolidays VALUES(163,'Easter Monday','2027-03-29',1,'AU','AU|2027-03-29|EASTER MONDAY',0,1);
INSERT INTO PublicHolidays VALUES(164,'Anzac Day','2027-04-25',1,'AU','AU|2027-04-25|ANZAC DAY',0,1);
INSERT INTO PublicHolidays VALUES(165,'Anzac Day','2027-04-26',1,'AU','AU|2027-04-26|ANZAC DAY',0,1);
INSERT INTO PublicHolidays VALUES(166,'Anzac Day','2027-04-26',1,'AU','AU|2027-04-26|ANZAC DAY',0,1);
INSERT INTO PublicHolidays VALUES(167,'May Day','2027-05-03',1,'AU','AU|2027-05-03|MAY DAY',0,1);
INSERT INTO PublicHolidays VALUES(168,'Labour Day','2027-05-03',1,'AU','AU|2027-05-03|LABOUR DAY',0,1);
INSERT INTO PublicHolidays VALUES(169,'Reconciliation Day','2027-05-31',1,'AU','AU|2027-05-31|RECONCILIATION DAY',0,1);
INSERT INTO PublicHolidays VALUES(170,'Western Australia Day','2027-06-07',1,'AU','AU|2027-06-07|WESTERN AUSTRALIA DAY',0,1);
INSERT INTO PublicHolidays VALUES(171,'King''s Birthday','2027-06-14',1,'AU','AU|2027-06-14|KING''S BIRTHDAY',0,1);
INSERT INTO PublicHolidays VALUES(172,'Picnic Day','2027-08-02',1,'AU','AU|2027-08-02|PICNIC DAY',0,1);
INSERT INTO PublicHolidays VALUES(173,'Friday before AFL Grand Final (Tentative Date)','2027-09-24',1,'AU','AU|2027-09-24|FRIDAY BEFORE AFL GRAND FINAL (TENTATIVE DATE)',0,1);
INSERT INTO PublicHolidays VALUES(174,'King''s Birthday','2027-09-27',1,'AU','AU|2027-09-27|KING''S BIRTHDAY',0,1);
INSERT INTO PublicHolidays VALUES(175,'Labour Day','2027-10-04',1,'AU','AU|2027-10-04|LABOUR DAY',0,1);
INSERT INTO PublicHolidays VALUES(176,'King''s Birthday','2027-10-04',1,'AU','AU|2027-10-04|KING''S BIRTHDAY',0,1);
INSERT INTO PublicHolidays VALUES(177,'Melbourne Cup','2027-11-02',1,'AU','AU|2027-11-02|MELBOURNE CUP',0,1);
INSERT INTO PublicHolidays VALUES(178,'Christmas Day','2027-12-27',1,'AU','AU|2027-12-27|CHRISTMAS DAY',0,1);
INSERT INTO PublicHolidays VALUES(179,'Boxing Day','2027-12-28',1,'AU','AU|2027-12-28|BOXING DAY',0,1);
INSERT INTO PublicHolidays VALUES(180,'New Year''s Day','2026-01-01',1,'SG','SG|2026-01-01|NEW YEAR''S DAY',0,1);
INSERT INTO PublicHolidays VALUES(181,'Chinese New Year','2026-02-17',1,'SG','SG|2026-02-17|CHINESE NEW YEAR',0,1);
INSERT INTO PublicHolidays VALUES(182,'Chinese New Year','2026-02-18',1,'SG','SG|2026-02-18|CHINESE NEW YEAR',0,1);
INSERT INTO PublicHolidays VALUES(183,'Hari Raya Puasa','2026-03-20',1,'SG','SG|2026-03-20|HARI RAYA PUASA',0,1);
INSERT INTO PublicHolidays VALUES(184,'Good Friday','2026-04-03',1,'SG','SG|2026-04-03|GOOD FRIDAY',0,1);
INSERT INTO PublicHolidays VALUES(185,'Labour Day','2026-05-01',1,'SG','SG|2026-05-01|LABOUR DAY',0,1);
INSERT INTO PublicHolidays VALUES(186,'Hari Raya Haji (Tentative Date)','2026-05-27',1,'SG','SG|2026-05-27|HARI RAYA HAJI (TENTATIVE DATE)',0,1);
INSERT INTO PublicHolidays VALUES(187,'National Day','2026-08-10',1,'SG','SG|2026-08-10|NATIONAL DAY',0,1);
INSERT INTO PublicHolidays VALUES(188,'Deepavali','2026-11-09',1,'SG','SG|2026-11-09|DEEPAVALI',0,1);
INSERT INTO PublicHolidays VALUES(189,'Christmas Day','2026-12-25',1,'SG','SG|2026-12-25|CHRISTMAS DAY',0,1);
INSERT INTO PublicHolidays VALUES(190,'New Year''s Day','2027-01-01',1,'SG','SG|2027-01-01|NEW YEAR''S DAY',0,1);
INSERT INTO PublicHolidays VALUES(191,'Chinese New Year','2027-02-06',1,'SG','SG|2027-02-06|CHINESE NEW YEAR',0,1);
INSERT INTO PublicHolidays VALUES(192,'Chinese New Year','2027-02-08',1,'SG','SG|2027-02-08|CHINESE NEW YEAR',0,1);
INSERT INTO PublicHolidays VALUES(193,'Hari Raya Puasa','2027-03-10',1,'SG','SG|2027-03-10|HARI RAYA PUASA',0,1);
INSERT INTO PublicHolidays VALUES(194,'Good Friday','2027-03-26',1,'SG','SG|2027-03-26|GOOD FRIDAY',0,1);
INSERT INTO PublicHolidays VALUES(195,'Labour Day','2027-05-01',1,'SG','SG|2027-05-01|LABOUR DAY',0,1);
INSERT INTO PublicHolidays VALUES(196,'Hari Raya Haji (Tentative Date)','2027-05-17',1,'SG','SG|2027-05-17|HARI RAYA HAJI (TENTATIVE DATE)',0,1);
INSERT INTO PublicHolidays VALUES(197,'National Day','2027-08-09',1,'SG','SG|2027-08-09|NATIONAL DAY',0,1);
INSERT INTO PublicHolidays VALUES(198,'Deepavali','2027-10-29',1,'SG','SG|2027-10-29|DEEPAVALI',0,1);
INSERT INTO PublicHolidays VALUES(199,'Christmas Day','2027-12-25',1,'SG','SG|2027-12-25|CHRISTMAS DAY',0,1);
INSERT INTO PublicHolidays VALUES(200,'Company Foundation Day','2026-03-15',1,'MY','CUSTOM|MY|03-15|COMPANY FOUNDATION DAY',1,0);
CREATE TABLE IF NOT EXISTS "AttendanceRecords" (

    "Id" INTEGER NOT NULL CONSTRAINT "PK_AttendanceRecords" PRIMARY KEY AUTOINCREMENT,

    "EmployeeId" INTEGER NOT NULL,

    "Date" TEXT NOT NULL,

    "Status" TEXT NOT NULL,

    "ScheduledIn" TEXT NULL,

    "ScheduledOut" TEXT NULL,

    "ActualIn" TEXT NULL,

    "ActualOut" TEXT NULL, RphAccruedDays REAL NOT NULL DEFAULT 0,

    FOREIGN KEY("EmployeeId") REFERENCES "Employees"("Id") ON DELETE CASCADE

);
INSERT INTO AttendanceRecords VALUES(1,1,'2026-06-01','Present','09:00:00','18:00:00','09:00:00','18:00:00',0.0);
INSERT INTO AttendanceRecords VALUES(2,1,'2026-06-02','Present','09:00:00','18:00:00','09:00:00','18:00:00',0.0);
INSERT INTO AttendanceRecords VALUES(3,1,'2026-06-03','Present','09:00:00','18:00:00','09:00:00','18:00:00',0.0);
INSERT INTO AttendanceRecords VALUES(4,1,'2026-06-04','Present','09:00:00','18:00:00','09:00:00','18:00:00',0.0);
INSERT INTO AttendanceRecords VALUES(5,1,'2026-06-05','Present','09:00:00','18:00:00','09:00:00','18:00:00',0.0);
INSERT INTO AttendanceRecords VALUES(6,1,'2026-06-08','Present','09:00:00','18:00:00','09:00:00','18:00:00',0.0);
INSERT INTO AttendanceRecords VALUES(7,1,'2026-06-09','Present','09:00:00','18:00:00','09:00:00','18:00:00',0.0);
INSERT INTO AttendanceRecords VALUES(8,1,'2026-06-10','Present','09:00:00','18:00:00','09:00:00','20:00:00',0.0);
INSERT INTO AttendanceRecords VALUES(9,1,'2026-06-11','Present','09:00:00','18:00:00','09:00:00','18:00:00',0.0);
INSERT INTO AttendanceRecords VALUES(10,1,'2026-06-12','Present','09:00:00','18:00:00','09:00:00','18:00:00',0.0);
INSERT INTO AttendanceRecords VALUES(11,1,'2026-06-15','Present','09:00:00','18:00:00','09:00:00','18:00:00',0.0);
INSERT INTO AttendanceRecords VALUES(12,1,'2026-06-16','Present','09:00:00','18:00:00','09:00:00','18:00:00',0.0);
INSERT INTO AttendanceRecords VALUES(13,1,'2026-06-17','Present','09:00:00','18:00:00','09:00:00','18:00:00',0.0);
INSERT INTO AttendanceRecords VALUES(14,1,'2026-06-18','Present','09:00:00','18:00:00','09:00:00','18:00:00',0.0);
INSERT INTO AttendanceRecords VALUES(15,1,'2026-06-19','Present','09:00:00','18:00:00','09:00:00','18:00:00',0.0);
INSERT INTO AttendanceRecords VALUES(16,1,'2026-06-22','Present','09:00:00','18:00:00','09:00:00','18:00:00',0.0);
INSERT INTO AttendanceRecords VALUES(17,1,'2026-06-23','Present','09:00:00','18:00:00','09:00:00','18:00:00',0.0);
INSERT INTO AttendanceRecords VALUES(18,1,'2026-06-24','Present','09:00:00','18:00:00','09:00:00','18:00:00',0.0);
INSERT INTO AttendanceRecords VALUES(19,1,'2026-06-25','Present','09:00:00','18:00:00','09:00:00','18:00:00',0.0);
INSERT INTO AttendanceRecords VALUES(20,1,'2026-06-26','Present','09:00:00','18:00:00','09:00:00','18:00:00',0.0);
INSERT INTO AttendanceRecords VALUES(21,1,'2026-06-29','Present','09:00:00','18:00:00','09:00:00','18:00:00',0.0);
INSERT INTO AttendanceRecords VALUES(22,1,'2026-06-30','Present','09:00:00','18:00:00','09:00:00','18:00:00',0.0);
INSERT INTO AttendanceRecords VALUES(23,2,'2026-06-01','Present','09:00:00','18:00:00','09:00:00','18:00:00',0.0);
INSERT INTO AttendanceRecords VALUES(24,2,'2026-06-02','Present','09:00:00','18:00:00','09:00:00','18:00:00',0.0);
INSERT INTO AttendanceRecords VALUES(25,2,'2026-06-03','Present','09:00:00','18:00:00','09:00:00','18:00:00',0.0);
INSERT INTO AttendanceRecords VALUES(26,2,'2026-06-04','Present','09:00:00','18:00:00','09:00:00','18:00:00',0.0);
INSERT INTO AttendanceRecords VALUES(27,2,'2026-06-05','Late','09:00:00','18:00:00','09:00:00','18:00:00',0.0);
INSERT INTO AttendanceRecords VALUES(28,2,'2026-06-08','Present','09:00:00','18:00:00','09:00:00','18:00:00',0.0);
INSERT INTO AttendanceRecords VALUES(29,2,'2026-06-09','Present','09:00:00','18:00:00','09:00:00','18:00:00',0.0);
INSERT INTO AttendanceRecords VALUES(30,2,'2026-06-10','Present','09:00:00','18:00:00','09:00:00','18:00:00',0.0);
INSERT INTO AttendanceRecords VALUES(31,2,'2026-06-11','Present','09:00:00','18:00:00','09:00:00','18:00:00',0.0);
INSERT INTO AttendanceRecords VALUES(32,2,'2026-06-12','Late','09:00:00','18:00:00','09:00:00','18:00:00',0.0);
INSERT INTO AttendanceRecords VALUES(33,2,'2026-06-15','Present','09:00:00','18:00:00','09:00:00','18:00:00',0.0);
INSERT INTO AttendanceRecords VALUES(34,2,'2026-06-16','Present','09:00:00','18:00:00','09:00:00','18:00:00',0.0);
INSERT INTO AttendanceRecords VALUES(35,2,'2026-06-17','Present','09:00:00','18:00:00','09:00:00','18:00:00',0.0);
INSERT INTO AttendanceRecords VALUES(36,2,'2026-06-18','Present','09:00:00','18:00:00','09:00:00','18:00:00',0.0);
INSERT INTO AttendanceRecords VALUES(37,2,'2026-06-19','Late','09:00:00','18:00:00','09:00:00','18:00:00',0.0);
INSERT INTO AttendanceRecords VALUES(38,2,'2026-06-22','Present','09:00:00','18:00:00','09:00:00','18:00:00',0.0);
INSERT INTO AttendanceRecords VALUES(39,2,'2026-06-23','Present','09:00:00','18:00:00','09:00:00','18:00:00',0.0);
INSERT INTO AttendanceRecords VALUES(40,2,'2026-06-24','Present','09:00:00','18:00:00','09:00:00','18:00:00',0.0);
INSERT INTO AttendanceRecords VALUES(41,2,'2026-06-25','Present','09:00:00','18:00:00','09:00:00','18:00:00',0.0);
INSERT INTO AttendanceRecords VALUES(42,2,'2026-06-26','Late','09:00:00','18:00:00','09:00:00','18:00:00',0.0);
INSERT INTO AttendanceRecords VALUES(43,2,'2026-06-29','Present','09:00:00','18:00:00','09:00:00','18:00:00',0.0);
INSERT INTO AttendanceRecords VALUES(44,2,'2026-06-30','Present','09:00:00','18:00:00','09:00:00','18:00:00',0.0);
INSERT INTO AttendanceRecords VALUES(45,3,'2026-06-01','Present','09:00:00','18:00:00','09:00:00','18:00:00',0.0);
INSERT INTO AttendanceRecords VALUES(46,3,'2026-06-02','Present','09:00:00','18:00:00','09:00:00','18:00:00',0.0);
INSERT INTO AttendanceRecords VALUES(47,3,'2026-06-03','Present','09:00:00','18:00:00','09:00:00','18:00:00',0.0);
INSERT INTO AttendanceRecords VALUES(48,3,'2026-06-04','Present','09:00:00','18:00:00','09:00:00','18:00:00',0.0);
INSERT INTO AttendanceRecords VALUES(49,3,'2026-06-05','Present','09:00:00','18:00:00','09:00:00','18:00:00',0.0);
INSERT INTO AttendanceRecords VALUES(50,3,'2026-06-08','Present','09:00:00','18:00:00','09:00:00','18:00:00',0.0);
INSERT INTO AttendanceRecords VALUES(51,3,'2026-06-09','Present','09:00:00','18:00:00','09:00:00','18:00:00',0.0);
INSERT INTO AttendanceRecords VALUES(52,3,'2026-06-10','Present','09:00:00','18:00:00','09:00:00','18:00:00',0.0);
INSERT INTO AttendanceRecords VALUES(53,3,'2026-06-11','Present','09:00:00','18:00:00','09:00:00','18:00:00',0.0);
INSERT INTO AttendanceRecords VALUES(54,3,'2026-06-12','Present','09:00:00','18:00:00','09:00:00','18:00:00',0.0);
INSERT INTO AttendanceRecords VALUES(55,3,'2026-06-15','Present','09:00:00','18:00:00','09:00:00','18:00:00',0.0);
INSERT INTO AttendanceRecords VALUES(56,3,'2026-06-16','Present','09:00:00','18:00:00','09:00:00','18:00:00',0.0);
INSERT INTO AttendanceRecords VALUES(57,3,'2026-06-17','Present','09:00:00','18:00:00','09:00:00','18:00:00',0.0);
INSERT INTO AttendanceRecords VALUES(58,3,'2026-06-18','Present','09:00:00','18:00:00','09:00:00','18:00:00',0.0);
INSERT INTO AttendanceRecords VALUES(59,3,'2026-06-19','Present','09:00:00','18:00:00','09:00:00','18:00:00',0.0);
INSERT INTO AttendanceRecords VALUES(60,3,'2026-06-22','Present','09:00:00','18:00:00','09:00:00','18:00:00',0.0);
INSERT INTO AttendanceRecords VALUES(61,3,'2026-06-23','Present','09:00:00','18:00:00','09:00:00','18:00:00',0.0);
INSERT INTO AttendanceRecords VALUES(62,3,'2026-06-24','Present','09:00:00','18:00:00','09:00:00','18:00:00',0.0);
INSERT INTO AttendanceRecords VALUES(63,3,'2026-06-25','Present','09:00:00','18:00:00','09:00:00','18:00:00',0.0);
INSERT INTO AttendanceRecords VALUES(64,3,'2026-06-26','Present','09:00:00','18:00:00','09:00:00','18:00:00',0.0);
INSERT INTO AttendanceRecords VALUES(65,3,'2026-06-29','Present','09:00:00','18:00:00','09:00:00','18:00:00',0.0);
INSERT INTO AttendanceRecords VALUES(66,3,'2026-06-30','Present','09:00:00','18:00:00','09:00:00','18:00:00',0.0);
INSERT INTO AttendanceRecords VALUES(67,4,'2026-06-01','Present','09:00:00','18:00:00','09:00:00','18:00:00',0.0);
INSERT INTO AttendanceRecords VALUES(68,4,'2026-06-02','Present','09:00:00','18:00:00','09:00:00','18:00:00',0.0);
INSERT INTO AttendanceRecords VALUES(69,4,'2026-06-03','Present','09:00:00','18:00:00','09:00:00','18:00:00',0.0);
INSERT INTO AttendanceRecords VALUES(70,4,'2026-06-04','Present','09:00:00','18:00:00','09:00:00','18:00:00',0.0);
INSERT INTO AttendanceRecords VALUES(71,4,'2026-06-05','Late','09:00:00','18:00:00','09:00:00','18:00:00',0.0);
INSERT INTO AttendanceRecords VALUES(72,4,'2026-06-08','Present','09:00:00','18:00:00','09:00:00','18:00:00',0.0);
INSERT INTO AttendanceRecords VALUES(73,4,'2026-06-09','Present','09:00:00','18:00:00','09:00:00','18:00:00',0.0);
INSERT INTO AttendanceRecords VALUES(74,4,'2026-06-10','Present','09:00:00','18:00:00','09:00:00','18:00:00',0.0);
INSERT INTO AttendanceRecords VALUES(75,4,'2026-06-11','Present','09:00:00','18:00:00','09:00:00','18:00:00',0.0);
INSERT INTO AttendanceRecords VALUES(76,4,'2026-06-12','Late','09:00:00','18:00:00','09:00:00','18:00:00',0.0);
INSERT INTO AttendanceRecords VALUES(77,4,'2026-06-15','Present','09:00:00','18:00:00','09:00:00','18:00:00',0.0);
INSERT INTO AttendanceRecords VALUES(78,4,'2026-06-16','Present','09:00:00','18:00:00','09:00:00','18:00:00',0.0);
INSERT INTO AttendanceRecords VALUES(79,4,'2026-06-17','Present','09:00:00','18:00:00','09:00:00','18:00:00',0.0);
INSERT INTO AttendanceRecords VALUES(80,4,'2026-06-18','Present','09:00:00','18:00:00','09:00:00','18:00:00',0.0);
INSERT INTO AttendanceRecords VALUES(81,4,'2026-06-19','Late','09:00:00','18:00:00','09:00:00','18:00:00',0.0);
INSERT INTO AttendanceRecords VALUES(82,4,'2026-06-22','Present','09:00:00','18:00:00','09:00:00','18:00:00',0.0);
INSERT INTO AttendanceRecords VALUES(83,4,'2026-06-23','Present','09:00:00','18:00:00','09:00:00','18:00:00',0.0);
INSERT INTO AttendanceRecords VALUES(84,4,'2026-06-24','Present','09:00:00','18:00:00','09:00:00','18:00:00',0.0);
INSERT INTO AttendanceRecords VALUES(85,4,'2026-06-25','Present','09:00:00','18:00:00','09:00:00','18:00:00',0.0);
INSERT INTO AttendanceRecords VALUES(86,4,'2026-06-26','Late','09:00:00','18:00:00','09:00:00','18:00:00',0.0);
INSERT INTO AttendanceRecords VALUES(87,4,'2026-06-29','Present','09:00:00','18:00:00','09:00:00','18:00:00',0.0);
INSERT INTO AttendanceRecords VALUES(88,4,'2026-06-30','Present','09:00:00','18:00:00','09:00:00','18:00:00',0.0);
INSERT INTO AttendanceRecords VALUES(89,5,'2026-06-01','Present','09:00:00','18:00:00','09:00:00','18:00:00',0.0);
INSERT INTO AttendanceRecords VALUES(90,5,'2026-06-02','Present','09:00:00','18:00:00','09:00:00','18:00:00',0.0);
INSERT INTO AttendanceRecords VALUES(91,5,'2026-06-03','Present','09:00:00','18:00:00','09:00:00','18:00:00',0.0);
INSERT INTO AttendanceRecords VALUES(92,5,'2026-06-04','Present','09:00:00','18:00:00','09:00:00','18:00:00',0.0);
INSERT INTO AttendanceRecords VALUES(93,5,'2026-06-05','Present','09:00:00','18:00:00','09:00:00','18:00:00',0.0);
INSERT INTO AttendanceRecords VALUES(94,5,'2026-06-08','Present','09:00:00','18:00:00','09:00:00','18:00:00',0.0);
INSERT INTO AttendanceRecords VALUES(95,5,'2026-06-09','Present','09:00:00','18:00:00','09:00:00','18:00:00',0.0);
INSERT INTO AttendanceRecords VALUES(96,5,'2026-06-10','Present','09:00:00','18:00:00','09:00:00','18:00:00',0.0);
INSERT INTO AttendanceRecords VALUES(97,5,'2026-06-11','Present','09:00:00','18:00:00','09:00:00','18:00:00',0.0);
INSERT INTO AttendanceRecords VALUES(98,5,'2026-06-12','Present','09:00:00','18:00:00','09:00:00','18:00:00',0.0);
INSERT INTO AttendanceRecords VALUES(99,5,'2026-06-15','Present','09:00:00','18:00:00','09:00:00','18:00:00',0.0);
INSERT INTO AttendanceRecords VALUES(100,5,'2026-06-16','Present','09:00:00','18:00:00','09:00:00','18:00:00',0.0);
INSERT INTO AttendanceRecords VALUES(101,5,'2026-06-17','Present','09:00:00','18:00:00','09:00:00','18:00:00',0.0);
INSERT INTO AttendanceRecords VALUES(102,5,'2026-06-18','Present','09:00:00','18:00:00','09:00:00','18:00:00',0.0);
INSERT INTO AttendanceRecords VALUES(103,5,'2026-06-19','Present','09:00:00','18:00:00','09:00:00','18:00:00',0.0);
INSERT INTO AttendanceRecords VALUES(104,5,'2026-06-22','Present','09:00:00','18:00:00','09:00:00','18:00:00',0.0);
INSERT INTO AttendanceRecords VALUES(105,5,'2026-06-23','Present','09:00:00','18:00:00','09:00:00','18:00:00',0.0);
INSERT INTO AttendanceRecords VALUES(106,5,'2026-06-24','Present','09:00:00','18:00:00','09:00:00','18:00:00',0.0);
INSERT INTO AttendanceRecords VALUES(107,5,'2026-06-25','Present','09:00:00','18:00:00','09:00:00','18:00:00',0.0);
INSERT INTO AttendanceRecords VALUES(108,5,'2026-06-26','Present','09:00:00','18:00:00','09:00:00','18:00:00',0.0);
INSERT INTO AttendanceRecords VALUES(109,5,'2026-06-29','Present','09:00:00','18:00:00','09:00:00','18:00:00',0.0);
INSERT INTO AttendanceRecords VALUES(110,5,'2026-06-30','Present','09:00:00','18:00:00','09:00:00','18:00:00',0.0);
CREATE TABLE IF NOT EXISTS "LeaveRequests" (

    "Id" INTEGER NOT NULL CONSTRAINT "PK_LeaveRequests" PRIMARY KEY AUTOINCREMENT,

    "EmployeeId" INTEGER NOT NULL,

    "Type" TEXT NOT NULL,

    "StartDate" TEXT NOT NULL,

    "EndDate" TEXT NOT NULL,

    "Status" TEXT NOT NULL,

    "Reason" TEXT NULL,

    FOREIGN KEY("EmployeeId") REFERENCES "Employees"("Id") ON DELETE CASCADE

);
CREATE TABLE IF NOT EXISTS "ShiftSchedules" (

    "Id" INTEGER NOT NULL CONSTRAINT "PK_ShiftSchedules" PRIMARY KEY AUTOINCREMENT,

    "EmployeeId" INTEGER NOT NULL,

    "Date" TEXT NOT NULL,

    "StartTime" TEXT NULL,

    "EndTime" TEXT NULL,

    "Type" TEXT NOT NULL,

    FOREIGN KEY("EmployeeId") REFERENCES "Employees"("Id") ON DELETE CASCADE

);
INSERT INTO ShiftSchedules VALUES(1,12,'2026-06-22','13:00:00','21:00:00','Work');
INSERT INTO ShiftSchedules VALUES(2,4,'2026-06-22','16:00:00','00:00:00','Work');
INSERT INTO ShiftSchedules VALUES(3,5,'2026-06-22','10:00:00','18:00:00','Work');
INSERT INTO ShiftSchedules VALUES(4,5,'2026-06-23','10:00:00','18:00:00','Work');
INSERT INTO ShiftSchedules VALUES(5,4,'2026-06-23','16:00:00','00:00:00','Work');
INSERT INTO ShiftSchedules VALUES(6,5,'2026-06-25','10:00:00','18:00:00','Work');
INSERT INTO ShiftSchedules VALUES(7,5,'2026-06-24',NULL,NULL,'DO');
INSERT INTO ShiftSchedules VALUES(8,5,'2026-06-26','10:00:00','18:00:00','Work');
INSERT INTO ShiftSchedules VALUES(9,5,'2026-06-27','10:00:00','18:00:00','Work');
INSERT INTO ShiftSchedules VALUES(10,5,'2026-06-28','10:00:00','18:00:00','Work');
INSERT INTO ShiftSchedules VALUES(12,22,'2026-06-23','10:00:00','18:00:00','Work');
INSERT INTO ShiftSchedules VALUES(13,22,'2026-06-24','10:00:00','18:00:00','Work');
INSERT INTO ShiftSchedules VALUES(14,22,'2026-06-25','10:00:00','18:00:00','Work');
INSERT INTO ShiftSchedules VALUES(15,22,'2026-06-26','10:00:00','18:00:00','Work');
INSERT INTO ShiftSchedules VALUES(16,22,'2026-06-27','10:00:00','18:00:00','Work');
INSERT INTO ShiftSchedules VALUES(17,22,'2026-06-28','10:00:00','18:00:00','Work');
INSERT INTO ShiftSchedules VALUES(18,22,'2026-06-22',NULL,NULL,'DO');
INSERT INTO ShiftSchedules VALUES(19,23,'2026-06-22','10:00:00','18:00:00','Work');
INSERT INTO ShiftSchedules VALUES(21,23,'2026-06-23',NULL,NULL,'DO');
INSERT INTO ShiftSchedules VALUES(22,23,'2026-06-24','16:00:00','00:00:00','Work');
INSERT INTO ShiftSchedules VALUES(23,23,'2026-06-25','16:00:00','00:00:00','Work');
INSERT INTO ShiftSchedules VALUES(24,23,'2026-06-26','16:00:00','00:00:00','Work');
INSERT INTO ShiftSchedules VALUES(25,23,'2026-06-27','16:00:00','00:00:00','Work');
INSERT INTO ShiftSchedules VALUES(26,23,'2026-06-28','16:00:00','00:00:00','Work');
INSERT INTO ShiftSchedules VALUES(27,26,'2026-06-22','16:00:00','00:00:00','Work');
INSERT INTO ShiftSchedules VALUES(28,26,'2026-06-23','16:00:00','00:00:00','Work');
INSERT INTO ShiftSchedules VALUES(29,26,'2026-06-24',NULL,NULL,'DO');
INSERT INTO ShiftSchedules VALUES(30,26,'2026-06-25','13:00:00','21:00:00','Work');
INSERT INTO ShiftSchedules VALUES(31,26,'2026-06-26','12:30:00','20:30:00','Work');
INSERT INTO ShiftSchedules VALUES(32,26,'2026-06-27','12:30:00','20:30:00','Work');
INSERT INTO ShiftSchedules VALUES(33,26,'2026-06-28','12:30:00','20:30:00','Work');
INSERT INTO ShiftSchedules VALUES(34,19,'2026-06-23','10:00:00','18:00:00','Work');
INSERT INTO ShiftSchedules VALUES(35,19,'2026-06-22',NULL,NULL,'DO');
INSERT INTO ShiftSchedules VALUES(36,19,'2026-06-24','10:00:00','18:00:00','Work');
INSERT INTO ShiftSchedules VALUES(37,19,'2026-06-25','10:00:00','18:00:00','Work');
INSERT INTO ShiftSchedules VALUES(38,19,'2026-06-26','10:00:00','18:00:00','Work');
INSERT INTO ShiftSchedules VALUES(39,19,'2026-06-27','10:00:00','18:00:00','Work');
INSERT INTO ShiftSchedules VALUES(40,19,'2026-06-28','10:00:00','18:00:00','Work');
INSERT INTO ShiftSchedules VALUES(41,20,'2026-06-22','10:00:00','18:00:00','Work');
INSERT INTO ShiftSchedules VALUES(43,20,'2026-06-23',NULL,NULL,'DO');
INSERT INTO ShiftSchedules VALUES(44,20,'2026-06-24','16:00:00','00:00:00','Work');
INSERT INTO ShiftSchedules VALUES(45,20,'2026-06-25','16:00:00','00:00:00','Work');
INSERT INTO ShiftSchedules VALUES(46,20,'2026-06-26','16:00:00','00:00:00','Work');
INSERT INTO ShiftSchedules VALUES(47,20,'2026-06-27','16:00:00','00:00:00','Work');
INSERT INTO ShiftSchedules VALUES(48,20,'2026-06-28','16:00:00','00:00:00','Work');
INSERT INTO ShiftSchedules VALUES(49,21,'2026-06-22','16:00:00','00:00:00','Work');
INSERT INTO ShiftSchedules VALUES(50,21,'2026-06-23','16:00:00','00:00:00','Work');
CREATE TABLE IF NOT EXISTS "EducationRecords" (

    "Id" INTEGER NOT NULL CONSTRAINT "PK_EducationRecords" PRIMARY KEY AUTOINCREMENT,

    "EmployeeId" INTEGER NOT NULL,

    "Degree" TEXT NOT NULL,

    "Institution" TEXT NOT NULL,

    "Year" TEXT NOT NULL,

    "Certificate" TEXT NOT NULL,

    FOREIGN KEY("EmployeeId") REFERENCES "Employees"("Id") ON DELETE CASCADE

);
CREATE TABLE IF NOT EXISTS "PreviousEmployments" (

    "Id" INTEGER NOT NULL CONSTRAINT "PK_PreviousEmployments" PRIMARY KEY AUTOINCREMENT,

    "EmployeeId" INTEGER NOT NULL,

    "CompanyName" TEXT NOT NULL,

    "Position" TEXT NOT NULL,

    "StartYear" TEXT NOT NULL,

    "EndYear" TEXT NOT NULL,

    "YearsOfService" REAL NOT NULL,

    FOREIGN KEY("EmployeeId") REFERENCES "Employees"("Id") ON DELETE CASCADE

);
CREATE TABLE IF NOT EXISTS "EmployeeMovements" (

    "Id" INTEGER NOT NULL CONSTRAINT "PK_EmployeeMovements" PRIMARY KEY AUTOINCREMENT,

    "EmployeeId" INTEGER NOT NULL,

    "Date" TEXT NOT NULL,

    "FromPosition" TEXT NOT NULL,

    "ToPosition" TEXT NOT NULL,

    "Type" TEXT NOT NULL,

    "Department" TEXT NOT NULL,

    FOREIGN KEY("EmployeeId") REFERENCES "Employees"("Id") ON DELETE CASCADE

);
CREATE TABLE IF NOT EXISTS "PerformanceAppraisals" (

    "Id" INTEGER NOT NULL CONSTRAINT "PK_PerformanceAppraisals" PRIMARY KEY AUTOINCREMENT,

    "EmployeeId" INTEGER NOT NULL,

    "Year" TEXT NOT NULL,

    "Rating" TEXT NOT NULL,

    "Score" REAL NOT NULL,

    "Reviewer" TEXT NOT NULL,

    "Comments" TEXT NULL,

    FOREIGN KEY("EmployeeId") REFERENCES "Employees"("Id") ON DELETE CASCADE

);
CREATE TABLE PayStructures (

    Id INTEGER PRIMARY KEY AUTOINCREMENT,

    CompanyId INTEGER NOT NULL UNIQUE,

    CountryCode TEXT NOT NULL,

    PayType TEXT NOT NULL,

    PayCycle TEXT NOT NULL,

    ProvidentFundEmployerPct REAL NOT NULL DEFAULT 0,

    ProvidentFundEmployeePct REAL NOT NULL DEFAULT 0,

    Active INTEGER NOT NULL DEFAULT 1,

    TransportationAllowanceAmount REAL NULL,

    TransportationProvided INTEGER NOT NULL DEFAULT 0,

    TransportationContactMobile TEXT NULL,

    MobileAllowanceAmount REAL NULL,

    MobileProvided INTEGER NOT NULL DEFAULT 0,

    CompanyVehicleAsRequired INTEGER NOT NULL DEFAULT 0,

    AccommodationAmount REAL NULL,

    AccommodationFrequency TEXT NULL,

    AccommodationProvided INTEGER NOT NULL DEFAULT 0,

    AccommodationAddress TEXT NULL,

    AccommodationLeaseDueDate TEXT NULL, ForeignProvidentFundEmployerPct REAL NOT NULL DEFAULT 2, ForeignProvidentFundEmployeePct REAL NOT NULL DEFAULT 2, ForeignSocsoEmployerPct REAL NOT NULL DEFAULT 1.25, OvertimeRateMultiplier REAL NOT NULL DEFAULT 1.5, OvertimeCalculationMode TEXT NOT NULL DEFAULT 'Calculated', OvertimeFixedHourlyRate REAL NULL,

    FOREIGN KEY (CompanyId) REFERENCES Companies(Id) ON DELETE CASCADE

);
INSERT INTO PayStructures VALUES(1,3,'AU','Fixed Salary','Monthly',12.0,11.0,1,NULL,0,NULL,NULL,0,0,NULL,NULL,0,NULL,NULL,2.0,2.0,1.25,1.5,'Calculated',NULL);
INSERT INTO PayStructures VALUES(2,1,'MY','Fixed Salary','Monthly',13.0,11.0,1,NULL,0,NULL,NULL,0,0,NULL,NULL,0,NULL,NULL,2.0,2.0,1.25,1.5,'Calculated',NULL);
CREATE TABLE MandatoryContributions (

    Id INTEGER PRIMARY KEY AUTOINCREMENT,

    PayStructureId INTEGER NOT NULL,

    Name TEXT NOT NULL,

    EmployerPct REAL NOT NULL DEFAULT 0,

    EmployeePct REAL NOT NULL DEFAULT 0,

    FOREIGN KEY (PayStructureId) REFERENCES PayStructures(Id) ON DELETE CASCADE

);
CREATE TABLE ProvidentFundBrackets (

    Id INTEGER PRIMARY KEY AUTOINCREMENT,

    PayStructureId INTEGER NOT NULL,

    SortOrder INTEGER NOT NULL DEFAULT 0,

    MinAge INTEGER NULL,

    MaxAge INTEGER NULL,

    MinMonthlySalary REAL NULL,

    MaxMonthlySalary REAL NULL,

    EmployerPct REAL NOT NULL DEFAULT 0,

    EmployeePct REAL NOT NULL DEFAULT 0,

    NoContribution INTEGER NOT NULL DEFAULT 0,

    FOREIGN KEY (PayStructureId) REFERENCES PayStructures(Id) ON DELETE CASCADE

);
INSERT INTO ProvidentFundBrackets VALUES(1,2,0,NULL,59,NULL,5000.0,13.0,11.0,0);
INSERT INTO ProvidentFundBrackets VALUES(2,2,1,NULL,59,5000.01,NULL,13.0,11.0,0);
INSERT INTO ProvidentFundBrackets VALUES(3,2,2,60,NULL,NULL,NULL,0.0,0.0,1);
CREATE TABLE SocsoBrackets (

    Id INTEGER PRIMARY KEY AUTOINCREMENT,

    PayStructureId INTEGER NOT NULL,

    SortOrder INTEGER NOT NULL DEFAULT 0,

    MinAge INTEGER NULL,

    MaxAge INTEGER NULL,

    MinMonthlySalary REAL NULL,

    MaxMonthlySalary REAL NULL,

    EmployerAmount REAL NOT NULL DEFAULT 0,

    EmployeeAmount REAL NOT NULL DEFAULT 0,

    FOREIGN KEY (PayStructureId) REFERENCES PayStructures(Id) ON DELETE CASCADE

);
INSERT INTO SocsoBrackets VALUES(1,2,0,NULL,59,NULL,5000.0,86.65,61.9);
INSERT INTO SocsoBrackets VALUES(2,2,1,NULL,59,5000.01,10000.0,104.15,74.4);
INSERT INTO SocsoBrackets VALUES(3,2,2,NULL,59,10000.01,NULL,104.15,74.4);
INSERT INTO SocsoBrackets VALUES(4,2,3,60,NULL,NULL,5000.0,71.9,43.15);
INSERT INTO SocsoBrackets VALUES(5,2,4,60,NULL,5000.01,NULL,74.4,44.65);
CREATE TABLE PayrollRuns (

    Id INTEGER PRIMARY KEY AUTOINCREMENT,

    CompanyId INTEGER NOT NULL,

    Year INTEGER NOT NULL,

    Month INTEGER NOT NULL,

    PayCycle TEXT NOT NULL,

    PayType TEXT NOT NULL,

    CountryCode TEXT NOT NULL,

    PeriodLabel TEXT NOT NULL,

    PeriodStart TEXT NOT NULL,

    PeriodEnd TEXT NOT NULL,

    ProcessedAt TEXT NOT NULL,

    TotalGross REAL NOT NULL DEFAULT 0,

    EmployeeCount INTEGER NOT NULL DEFAULT 0, TotalPayout REAL NOT NULL DEFAULT 0,

    FOREIGN KEY (CompanyId) REFERENCES Companies(Id) ON DELETE CASCADE

);
CREATE TABLE PayrollRunLines (

    Id INTEGER PRIMARY KEY AUTOINCREMENT,

    PayrollRunId INTEGER NOT NULL,

    EmployeeId INTEGER NOT NULL,

    EmployeeCode TEXT NOT NULL,

    EmployeeName TEXT NOT NULL,

    Department TEXT NOT NULL,

    Position TEXT NOT NULL,

    BaseSalary REAL NOT NULL DEFAULT 0,

    AllowancesTotal REAL NOT NULL DEFAULT 0,

    BonusAmount REAL NOT NULL DEFAULT 0,

    OvertimeAmount REAL NOT NULL DEFAULT 0,

    PresentDays REAL NOT NULL DEFAULT 0,

    WorkingDays REAL NOT NULL DEFAULT 0,

    TotalHours REAL NOT NULL DEFAULT 0,

    AttendanceRatio REAL NOT NULL DEFAULT 0,

    GrossPay REAL NOT NULL DEFAULT 0, OvertimeHours REAL NOT NULL DEFAULT 0, ServiceAllowance REAL NOT NULL DEFAULT 0, AccommodationAllowance REAL NOT NULL DEFAULT 0, TransportAllowance REAL NOT NULL DEFAULT 0, MobileAllowance REAL NOT NULL DEFAULT 0, EpfEmployeeAmount REAL NOT NULL DEFAULT 0, EpfEmployerAmount REAL NOT NULL DEFAULT 0, SocsoEmployeeAmount REAL NOT NULL DEFAULT 0, SocsoEmployerAmount REAL NOT NULL DEFAULT 0, IncomeTaxAmount REAL NOT NULL DEFAULT 0, TotalPayout REAL NOT NULL DEFAULT 0,

    FOREIGN KEY (PayrollRunId) REFERENCES PayrollRuns(Id) ON DELETE CASCADE

);
CREATE TABLE IncomeTaxYears (

    Id INTEGER PRIMARY KEY AUTOINCREMENT,

    CompanyId INTEGER NOT NULL,

    Year INTEGER NOT NULL,

    CountryCode TEXT NOT NULL,

    Active INTEGER NOT NULL DEFAULT 1,

    FOREIGN KEY (CompanyId) REFERENCES Companies(Id) ON DELETE CASCADE

);
INSERT INTO IncomeTaxYears VALUES(1,1,2026,'MY',1);
CREATE TABLE IncomeTaxBrackets (

    Id INTEGER PRIMARY KEY AUTOINCREMENT,

    IncomeTaxYearId INTEGER NOT NULL,

    SortOrder INTEGER NOT NULL DEFAULT 0,

    MinAnnualChargeableIncome REAL NOT NULL DEFAULT 0,

    MaxAnnualChargeableIncome REAL NULL,

    RatePct REAL NOT NULL DEFAULT 0,

    BaseMinTaxAmount REAL NOT NULL DEFAULT 0,

    FOREIGN KEY (IncomeTaxYearId) REFERENCES IncomeTaxYears(Id) ON DELETE CASCADE

);
INSERT INTO IncomeTaxBrackets VALUES(1,1,0,0.0,5000.0,0.0,0.0);
INSERT INTO IncomeTaxBrackets VALUES(2,1,1,5000.0,20000.0,1.0,150.0);
INSERT INTO IncomeTaxBrackets VALUES(3,1,2,20000.0,35000.0,3.0,450.0);
INSERT INTO IncomeTaxBrackets VALUES(4,1,3,35000.0,50000.0,6.0,900.0);
INSERT INTO IncomeTaxBrackets VALUES(5,1,4,50000.0,70000.0,11.0,2200.0);
INSERT INTO IncomeTaxBrackets VALUES(6,1,5,70000.0,100000.0,19.0,5700.0);
INSERT INTO IncomeTaxBrackets VALUES(7,1,6,100000.0,250000.0,25.0,37500.0);
INSERT INTO IncomeTaxBrackets VALUES(8,1,7,250000.0,400000.0,26.0,39000.0);
INSERT INTO IncomeTaxBrackets VALUES(9,1,8,400000.0,600000.0,28.0,56000.0);
INSERT INTO IncomeTaxBrackets VALUES(10,1,9,600000.0,1000000.0,30.0,120000.0);
INSERT INTO IncomeTaxBrackets VALUES(11,1,10,1000000.0,NULL,30.0,240000.0);
CREATE TABLE IncomeTaxReliefs (

    Id INTEGER PRIMARY KEY AUTOINCREMENT,

    IncomeTaxYearId INTEGER NOT NULL,

    SortOrder INTEGER NOT NULL DEFAULT 0,

    Name TEXT NOT NULL,

    Amount REAL NOT NULL DEFAULT 0, IsMaximum INTEGER NOT NULL DEFAULT 0, ApplyCondition TEXT NULL,

    FOREIGN KEY (IncomeTaxYearId) REFERENCES IncomeTaxYears(Id) ON DELETE CASCADE

);
INSERT INTO IncomeTaxReliefs VALUES(1,1,0,'Individual & Dependent Relative',9000.0,0,'Married');
INSERT INTO IncomeTaxReliefs VALUES(2,1,1,'Medical Treatment (serious illness / Parents)',10000.0,1,NULL);
INSERT INTO IncomeTaxReliefs VALUES(3,1,2,'Life Insurance',7000.0,1,NULL);
INSERT INTO IncomeTaxReliefs VALUES(4,1,3,'Education Fees (self)',7000.0,0,NULL);
INSERT INTO IncomeTaxReliefs VALUES(5,1,4,'Lifestyle (Reading materials, computers, sports equipment)',2500.0,0,NULL);
INSERT INTO IncomeTaxReliefs VALUES(6,1,5,'SSPN (Net deposit for child''s education)',8000.0,0,NULL);
CREATE TABLE IncomeTaxRebates (

    Id INTEGER PRIMARY KEY AUTOINCREMENT,

    IncomeTaxYearId INTEGER NOT NULL,

    SortOrder INTEGER NOT NULL DEFAULT 0,

    Name TEXT NOT NULL,

    Amount REAL NOT NULL DEFAULT 0,

    FOREIGN KEY (IncomeTaxYearId) REFERENCES IncomeTaxYears(Id) ON DELETE CASCADE

);
CREATE TABLE IF NOT EXISTS "InventoryPurchases" (

    "Id" INTEGER NOT NULL CONSTRAINT "PK_InventoryPurchases" PRIMARY KEY AUTOINCREMENT,

    "ComponentId" TEXT NOT NULL,

    "ComponentName" TEXT NOT NULL,

    "Quantity" REAL NOT NULL,

    "Uom" TEXT NOT NULL,

    "UnitPrice" REAL NOT NULL,

    "DateOrdered" TEXT NOT NULL,

    "DateCreatedInStock" TEXT NOT NULL,

    "PurchaseOrderId" INTEGER NOT NULL,

    "PurchaseOrderItemId" INTEGER NOT NULL,

    "CompanyId" INTEGER,

    "LocationIdsJson" TEXT NOT NULL DEFAULT '[]'

);
INSERT INTO InventoryPurchases VALUES(1,'CMP-PEELED-001','Peeled Garlic',1.0,'kg',16.5,'2026-07-01','2026-07-01 11:21:04.3451983',24,27,1,'["airport"]');
INSERT INTO InventoryPurchases VALUES(2,'CMP-00FLOU-001','00 Flour',2.0,'kg',5.0,'2026-07-02','2026-07-02 02:44:16.410975',0,0,1,'["airport"]');
INSERT INTO InventoryPurchases VALUES(3,'CMP-00FLOU-001','00 Flour',1.0,'kg',11.0,'2026-07-02','2026-07-02 03:06:09.1059396',0,0,1,'["airport"]');
INSERT INTO InventoryPurchases VALUES(4,'CMP-SCDEMO-001','SC Demo Component 001',81.0,'l',1498.0,'2026-06-15','2026-06-17 02:58:42.7187848',0,0,1,'["midtown"]');
INSERT INTO InventoryPurchases VALUES(5,'CMP-SCDEMO-002','SC Demo Component 002',82.0,'pcs',0.9651,'2026-06-14','2026-06-16 02:58:42.7187848',0,0,1,'["airport"]');
INSERT INTO InventoryPurchases VALUES(6,'CMP-SCDEMO-003','SC Demo Component 003',83.0,'kg',682.0,'2026-06-13','2026-06-15 02:58:42.7187848',0,0,1,'["westend"]');
INSERT INTO InventoryPurchases VALUES(7,'CMP-SCDEMO-003','SC Demo Component 003',18.0,'kg',682.0,'2026-06-26','2026-06-27 02:58:42.7187848',0,0,1,'["downtown"]');
INSERT INTO InventoryPurchases VALUES(8,'CMP-SCDEMO-004','SC Demo Component 004',84.0,'l',2001.3,'2026-06-12','2026-06-14 02:58:42.7187848',0,0,1,'["downtown"]');
INSERT INTO InventoryPurchases VALUES(9,'CMP-SCDEMO-005','SC Demo Component 005',85.0,'pcs',1.6925,'2026-06-11','2026-06-13 02:58:42.7187848',0,0,1,'["midtown"]');
INSERT INTO InventoryPurchases VALUES(10,'CMP-SCDEMO-006','SC Demo Component 006',86.0,'kg',838.9,'2026-06-10','2026-06-12 02:58:42.7187848',0,0,1,'["airport"]');
INSERT INTO InventoryPurchases VALUES(11,'CMP-SCDEMO-006','SC Demo Component 006',21.0,'kg',838.9,'2026-06-23','2026-06-24 02:58:42.7187848',0,0,1,'["westend"]');
INSERT INTO InventoryPurchases VALUES(12,'CMP-SCDEMO-007','SC Demo Component 007',87.0,'l',1453.7,'2026-06-09','2026-06-11 02:58:42.7187848',0,0,1,'["westend"]');
INSERT INTO InventoryPurchases VALUES(13,'CMP-SCDEMO-008','SC Demo Component 008',88.0,'pcs',0.0507,'2026-06-08','2026-06-10 02:58:42.7187848',0,0,1,'["downtown"]');
INSERT INTO InventoryPurchases VALUES(14,'CMP-SCDEMO-009','SC Demo Component 009',89.0,'kg',980.9,'2026-06-07','2026-06-09 02:58:42.7187848',0,0,1,'["midtown"]');
INSERT INTO InventoryPurchases VALUES(15,'CMP-SCDEMO-009','SC Demo Component 009',24.0,'kg',980.9,'2026-06-20','2026-06-21 02:58:42.7187848',0,0,1,'["airport"]');
INSERT INTO InventoryPurchases VALUES(16,'CMP-SCDEMO-010','SC Demo Component 010',90.0,'l',1641.7,'2026-06-06','2026-06-08 02:58:42.7187848',0,0,1,'["airport"]');
INSERT INTO InventoryPurchases VALUES(17,'CMP-SCDEMO-011','SC Demo Component 011',91.0,'pcs',0.4035,'2026-06-05','2026-06-07 02:58:42.7187848',0,0,1,'["westend"]');
INSERT INTO InventoryPurchases VALUES(18,'CMP-SCDEMO-012','SC Demo Component 012',92.0,'kg',482.7,'2026-06-04','2026-06-06 02:58:42.7187848',0,0,1,'["downtown"]');
INSERT INTO InventoryPurchases VALUES(19,'CMP-SCDEMO-012','SC Demo Component 012',27.0,'kg',482.7,'2026-06-17','2026-06-28 02:58:42.7187848',0,0,1,'["midtown"]');
INSERT INTO InventoryPurchases VALUES(20,'CMP-SCDEMO-013','SC Demo Component 013',93.0,'l',1105.9,'2026-06-03','2026-06-05 02:58:42.7187848',0,0,1,'["midtown"]');
INSERT INTO InventoryPurchases VALUES(21,'CMP-SCDEMO-014','SC Demo Component 014',94.0,'pcs',0.4922,'2026-06-02','2026-06-04 02:58:42.7187848',0,0,1,'["airport"]');
INSERT INTO InventoryPurchases VALUES(22,'CMP-SCDEMO-015','SC Demo Component 015',95.0,'kg',349.9,'2026-06-01','2026-06-03 02:58:42.7187848',0,0,1,'["westend"]');
INSERT INTO InventoryPurchases VALUES(23,'CMP-SCDEMO-015','SC Demo Component 015',30.0,'kg',349.9,'2026-06-28','2026-06-25 02:58:42.7187848',0,0,1,'["downtown"]');
INSERT INTO InventoryPurchases VALUES(24,'CMP-SCDEMO-016','SC Demo Component 016',96.0,'l',1784.7,'2026-05-31','2026-06-02 02:58:42.7187848',0,0,1,'["downtown"]');
INSERT INTO InventoryPurchases VALUES(25,'CMP-SCDEMO-017','SC Demo Component 017',97.0,'pcs',1.883,'2026-05-30','2026-06-01 02:58:42.7187848',0,0,1,'["midtown"]');
INSERT INTO InventoryPurchases VALUES(26,'CMP-SCDEMO-018','SC Demo Component 018',98.0,'kg',529.9,'2026-05-29','2026-05-31 02:58:42.7187848',0,0,1,'["airport"]');
INSERT INTO InventoryPurchases VALUES(27,'CMP-SCDEMO-018','SC Demo Component 018',33.0,'kg',529.9,'2026-06-25','2026-06-22 02:58:42.7187848',0,0,1,'["westend"]');
INSERT INTO InventoryPurchases VALUES(28,'CMP-SCDEMO-019','SC Demo Component 019',99.0,'l',1392.7,'2026-05-28','2026-05-30 02:58:42.7187848',0,0,1,'["westend"]');
INSERT INTO InventoryPurchases VALUES(29,'CMP-SCDEMO-020','SC Demo Component 020',100.0,'pcs',1.9517,'2026-05-27','2026-05-29 02:58:42.7187848',0,0,1,'["downtown"]');
INSERT INTO InventoryPurchases VALUES(30,'CMP-SCDEMO-021','SC Demo Component 021',101.0,'kg',732.0,'2026-05-26','2026-05-28 02:58:42.7187848',0,0,1,'["midtown"]');
INSERT INTO InventoryPurchases VALUES(31,'CMP-SCDEMO-021','SC Demo Component 021',36.0,'kg',732.0,'2026-06-22','2026-06-29 02:58:42.7187848',0,0,1,'["airport"]');
INSERT INTO InventoryPurchases VALUES(32,'CMP-SCDEMO-022','SC Demo Component 022',102.0,'l',1476.4,'2026-05-25','2026-05-27 02:58:42.7187848',0,0,1,'["airport"]');
INSERT INTO InventoryPurchases VALUES(33,'CMP-SCDEMO-023','SC Demo Component 023',103.0,'pcs',2.0131,'2026-05-24','2026-05-26 02:58:42.7187848',0,0,1,'["westend"]');
INSERT INTO InventoryPurchases VALUES(34,'CMP-SCDEMO-024','SC Demo Component 024',104.0,'kg',1399.1,'2026-05-23','2026-05-25 02:58:42.7187848',0,0,1,'["downtown"]');
INSERT INTO InventoryPurchases VALUES(35,'CMP-SCDEMO-024','SC Demo Component 024',39.0,'kg',1399.1,'2026-06-19','2026-06-26 02:58:42.7187848',0,0,1,'["midtown"]');
INSERT INTO InventoryPurchases VALUES(36,'CMP-SCDEMO-025','SC Demo Component 025',105.0,'l',1787.6,'2026-05-22','2026-05-24 02:58:42.7187848',0,0,1,'["midtown"]');
INSERT INTO InventoryPurchases VALUES(37,'CMP-SCDEMO-026','SC Demo Component 026',106.0,'pcs',1.3311,'2026-05-21','2026-05-23 02:58:42.7187848',0,0,1,'["airport"]');
INSERT INTO InventoryPurchases VALUES(38,'CMP-SCDEMO-027','SC Demo Component 027',107.0,'kg',1643.2,'2026-05-20','2026-05-22 02:58:42.7187848',0,0,1,'["westend"]');
INSERT INTO InventoryPurchases VALUES(39,'CMP-SCDEMO-027','SC Demo Component 027',42.0,'kg',1643.2,'2026-06-16','2026-06-23 02:58:42.7187848',0,0,1,'["downtown"]');
INSERT INTO InventoryPurchases VALUES(40,'CMP-SCDEMO-028','SC Demo Component 028',108.0,'l',134.3,'2026-05-19','2026-05-21 02:58:42.7187848',0,0,1,'["downtown"]');
INSERT INTO InventoryPurchases VALUES(41,'CMP-SCDEMO-029','SC Demo Component 029',109.0,'pcs',1.9368,'2026-05-18','2026-05-20 02:58:42.7187848',0,0,1,'["midtown"]');
INSERT INTO InventoryPurchases VALUES(42,'CMP-SCDEMO-030','SC Demo Component 030',110.0,'kg',1877.9,'2026-05-17','2026-05-19 02:58:42.7187848',0,0,1,'["airport"]');
INSERT INTO InventoryPurchases VALUES(43,'CMP-SCDEMO-030','SC Demo Component 030',45.0,'kg',1877.9,'2026-06-27','2026-06-30 02:58:42.7187848',0,0,1,'["westend"]');
INSERT INTO InventoryPurchases VALUES(44,'CMP-SCDEMO-031','SC Demo Component 031',111.0,'l',628.1,'2026-05-16','2026-05-18 02:58:42.7187848',0,0,1,'["westend"]');
INSERT INTO InventoryPurchases VALUES(45,'CMP-SCDEMO-032','SC Demo Component 032',112.0,'pcs',0.1446,'2026-05-15','2026-05-17 02:58:42.7187848',0,0,1,'["downtown"]');
INSERT INTO InventoryPurchases VALUES(46,'CMP-SCDEMO-033','SC Demo Component 033',113.0,'kg',379.9,'2026-05-14','2026-05-16 02:58:42.7187848',0,0,1,'["midtown"]');
INSERT INTO InventoryPurchases VALUES(47,'CMP-SCDEMO-033','SC Demo Component 033',48.0,'kg',379.9,'2026-06-24','2026-06-27 02:58:42.7187848',0,0,1,'["airport"]');
INSERT INTO InventoryPurchases VALUES(48,'CMP-SCDEMO-034','SC Demo Component 034',114.0,'l',533.6,'2026-05-13','2026-05-15 02:58:42.7187848',0,0,1,'["airport"]');
INSERT INTO InventoryPurchases VALUES(49,'CMP-SCDEMO-035','SC Demo Component 035',115.0,'pcs',0.1948,'2026-05-12','2026-06-18 02:58:42.7187848',0,0,1,'["westend"]');
INSERT INTO InventoryPurchases VALUES(50,'CMP-SCDEMO-036','SC Demo Component 036',116.0,'kg',2017.6,'2026-05-11','2026-06-17 02:58:42.7187848',0,0,1,'["downtown"]');
INSERT INTO InventoryPurchases VALUES(51,'CMP-SCDEMO-036','SC Demo Component 036',51.0,'kg',2017.6,'2026-06-21','2026-06-24 02:58:42.7187848',0,0,1,'["midtown"]');
INSERT INTO InventoryPurchases VALUES(52,'CMP-SCDEMO-037','SC Demo Component 037',117.0,'l',1522.5,'2026-05-10','2026-06-16 02:58:42.7187848',0,0,1,'["midtown"]');
INSERT INTO InventoryPurchases VALUES(53,'CMP-SCDEMO-038','SC Demo Component 038',118.0,'pcs',1.8537,'2026-05-09','2026-06-15 02:58:42.7187848',0,0,1,'["airport"]');
INSERT INTO InventoryPurchases VALUES(54,'CMP-SCDEMO-039','SC Demo Component 039',119.0,'kg',1546.4,'2026-05-08','2026-06-14 02:58:42.7187848',0,0,1,'["westend"]');
INSERT INTO InventoryPurchases VALUES(55,'CMP-SCDEMO-039','SC Demo Component 039',54.0,'kg',1546.4,'2026-06-18','2026-06-21 02:58:42.7187848',0,0,1,'["downtown"]');
INSERT INTO InventoryPurchases VALUES(56,'CMP-SCDEMO-040','SC Demo Component 040',120.0,'l',1398.1,'2026-06-16','2026-06-13 02:58:42.7187848',0,0,1,'["downtown"]');
INSERT INTO InventoryPurchases VALUES(57,'CMP-SCDEMO-041','SC Demo Component 041',121.0,'pcs',0.8446,'2026-06-15','2026-06-12 02:58:42.7187848',0,0,1,'["midtown"]');
INSERT INTO InventoryPurchases VALUES(58,'CMP-SCDEMO-042','SC Demo Component 042',122.0,'kg',191.6,'2026-06-14','2026-06-11 02:58:42.7187848',0,0,1,'["airport"]');
INSERT INTO InventoryPurchases VALUES(59,'CMP-SCDEMO-042','SC Demo Component 042',17.0,'kg',191.6,'2026-06-29','2026-06-28 02:58:42.7187848',0,0,1,'["westend"]');
INSERT INTO InventoryPurchases VALUES(60,'CMP-SCDEMO-043','SC Demo Component 043',123.0,'l',801.1,'2026-06-13','2026-06-10 02:58:42.7187848',0,0,1,'["westend"]');
INSERT INTO InventoryPurchases VALUES(61,'CMP-SCDEMO-044','SC Demo Component 044',124.0,'pcs',0.6974,'2026-06-12','2026-06-09 02:58:42.7187848',0,0,1,'["downtown"]');
INSERT INTO InventoryPurchases VALUES(62,'CMP-SCDEMO-045','SC Demo Component 045',125.0,'kg',176.0,'2026-06-11','2026-06-08 02:58:42.7187848',0,0,1,'["midtown"]');
INSERT INTO InventoryPurchases VALUES(63,'CMP-SCDEMO-045','SC Demo Component 045',20.0,'kg',176.0,'2026-06-26','2026-06-25 02:58:42.7187848',0,0,1,'["airport"]');
INSERT INTO InventoryPurchases VALUES(64,'CMP-SCDEMO-046','SC Demo Component 046',126.0,'l',602.6,'2026-06-10','2026-06-07 02:58:42.7187848',0,0,1,'["airport"]');
INSERT INTO InventoryPurchases VALUES(65,'CMP-SCDEMO-047','SC Demo Component 047',127.0,'pcs',1.0628,'2026-06-09','2026-06-06 02:58:42.7187848',0,0,1,'["westend"]');
INSERT INTO InventoryPurchases VALUES(66,'CMP-SCDEMO-048','SC Demo Component 048',128.0,'kg',1659.0,'2026-06-08','2026-06-05 02:58:42.7187848',0,0,1,'["downtown"]');
INSERT INTO InventoryPurchases VALUES(67,'CMP-SCDEMO-048','SC Demo Component 048',23.0,'kg',1659.0,'2026-06-23','2026-06-22 02:58:42.7187848',0,0,1,'["midtown"]');
INSERT INTO InventoryPurchases VALUES(68,'CMP-SCDEMO-049','SC Demo Component 049',129.0,'l',1923.6,'2026-06-07','2026-06-04 02:58:42.7187848',0,0,1,'["midtown"]');
INSERT INTO InventoryPurchases VALUES(69,'CMP-SCDEMO-050','SC Demo Component 050',130.0,'pcs',1.401,'2026-06-06','2026-06-03 02:58:42.7187848',0,0,1,'["airport"]');
INSERT INTO InventoryPurchases VALUES(70,'CMP-SCDEMO-051','SC Demo Component 051',131.0,'kg',1478.3,'2026-06-05','2026-06-02 02:58:42.7187848',0,0,1,'["westend"]');
INSERT INTO InventoryPurchases VALUES(71,'CMP-SCDEMO-051','SC Demo Component 051',26.0,'kg',1478.3,'2026-06-20','2026-06-29 02:58:42.7187848',0,0,1,'["downtown"]');
INSERT INTO InventoryPurchases VALUES(72,'CMP-SCDEMO-052','SC Demo Component 052',132.0,'l',942.8,'2026-06-04','2026-06-01 02:58:42.7187848',0,0,1,'["downtown"]');
INSERT INTO InventoryPurchases VALUES(73,'CMP-SCDEMO-053','SC Demo Component 053',133.0,'pcs',0.3383,'2026-06-03','2026-05-31 02:58:42.7187848',0,0,1,'["midtown"]');
INSERT INTO InventoryPurchases VALUES(74,'CMP-SCDEMO-054','SC Demo Component 054',134.0,'kg',261.5,'2026-06-02','2026-05-30 02:58:42.7187848',0,0,1,'["airport"]');
INSERT INTO InventoryPurchases VALUES(75,'CMP-SCDEMO-054','SC Demo Component 054',29.0,'kg',261.5,'2026-06-17','2026-06-26 02:58:42.7187848',0,0,1,'["westend"]');
INSERT INTO InventoryPurchases VALUES(76,'CMP-SCDEMO-055','SC Demo Component 055',135.0,'l',727.5,'2026-06-01','2026-05-29 02:58:42.7187848',0,0,1,'["westend"]');
INSERT INTO InventoryPurchases VALUES(77,'CMP-SCDEMO-056','SC Demo Component 056',136.0,'pcs',1.0789,'2026-05-31','2026-05-28 02:58:42.7187848',0,0,1,'["downtown"]');
INSERT INTO InventoryPurchases VALUES(78,'CMP-SCDEMO-057','SC Demo Component 057',137.0,'kg',305.7,'2026-05-30','2026-05-27 02:58:42.7187848',0,0,1,'["midtown"]');
INSERT INTO InventoryPurchases VALUES(79,'CMP-SCDEMO-057','SC Demo Component 057',32.0,'kg',305.7,'2026-06-28','2026-06-23 02:58:42.7187848',0,0,1,'["airport"]');
INSERT INTO InventoryPurchases VALUES(80,'CMP-SCDEMO-058','SC Demo Component 058',138.0,'l',1743.8,'2026-05-29','2026-05-26 02:58:42.7187848',0,0,1,'["airport"]');
INSERT INTO InventoryPurchases VALUES(81,'CMP-SCDEMO-059','SC Demo Component 059',139.0,'pcs',1.9806,'2026-05-28','2026-05-25 02:58:42.7187848',0,0,1,'["westend"]');
INSERT INTO InventoryPurchases VALUES(82,'CMP-SCDEMO-060','SC Demo Component 060',140.0,'kg',909.3,'2026-05-27','2026-05-24 02:58:42.7187848',0,0,1,'["downtown"]');
INSERT INTO InventoryPurchases VALUES(83,'CMP-SCDEMO-060','SC Demo Component 060',35.0,'kg',909.3,'2026-06-25','2026-06-30 02:58:42.7187848',0,0,1,'["midtown"]');
INSERT INTO InventoryPurchases VALUES(84,'CMP-SCDEMO-061','SC Demo Component 061',141.0,'l',1950.9,'2026-05-26','2026-05-23 02:58:42.7187848',0,0,1,'["midtown"]');
INSERT INTO InventoryPurchases VALUES(85,'CMP-SCDEMO-062','SC Demo Component 062',142.0,'pcs',1.1173,'2026-05-25','2026-05-22 02:58:42.7187848',0,0,1,'["airport"]');
INSERT INTO InventoryPurchases VALUES(86,'CMP-SCDEMO-063','SC Demo Component 063',143.0,'kg',1058.7,'2026-05-24','2026-05-21 02:58:42.7187848',0,0,1,'["westend"]');
INSERT INTO InventoryPurchases VALUES(87,'CMP-SCDEMO-063','SC Demo Component 063',38.0,'kg',1058.7,'2026-06-22','2026-06-27 02:58:42.7187848',0,0,1,'["downtown"]');
INSERT INTO InventoryPurchases VALUES(88,'CMP-SCDEMO-064','SC Demo Component 064',144.0,'l',1127.5,'2026-05-23','2026-05-20 02:58:42.7187848',0,0,1,'["downtown"]');
INSERT INTO InventoryPurchases VALUES(89,'CMP-SCDEMO-065','SC Demo Component 065',145.0,'pcs',1.8455,'2026-05-22','2026-05-19 02:58:42.7187848',0,0,1,'["midtown"]');
INSERT INTO InventoryPurchases VALUES(90,'CMP-SCDEMO-066','SC Demo Component 066',146.0,'kg',561.6,'2026-05-21','2026-05-18 02:58:42.7187848',0,0,1,'["airport"]');
INSERT INTO InventoryPurchases VALUES(91,'CMP-SCDEMO-066','SC Demo Component 066',41.0,'kg',561.6,'2026-06-19','2026-06-24 02:58:42.7187848',0,0,1,'["westend"]');
INSERT INTO InventoryPurchases VALUES(92,'CMP-SCDEMO-067','SC Demo Component 067',147.0,'l',1450.8,'2026-05-20','2026-05-17 02:58:42.7187848',0,0,1,'["westend"]');
INSERT INTO InventoryPurchases VALUES(93,'CMP-SCDEMO-068','SC Demo Component 068',148.0,'pcs',1.7658,'2026-05-19','2026-05-16 02:58:42.7187848',0,0,1,'["downtown"]');
INSERT INTO InventoryPurchases VALUES(94,'CMP-SCDEMO-069','SC Demo Component 069',149.0,'kg',561.8,'2026-05-18','2026-05-15 02:58:42.7187848',0,0,1,'["midtown"]');
INSERT INTO InventoryPurchases VALUES(95,'CMP-SCDEMO-069','SC Demo Component 069',44.0,'kg',561.8,'2026-06-16','2026-06-21 02:58:42.7187848',0,0,1,'["airport"]');
INSERT INTO InventoryPurchases VALUES(96,'CMP-SCDEMO-070','SC Demo Component 070',150.0,'l',1805.8,'2026-05-17','2026-06-18 02:58:42.7187848',0,0,1,'["airport"]');
INSERT INTO InventoryPurchases VALUES(97,'CMP-SCDEMO-071','SC Demo Component 071',151.0,'pcs',1.8892,'2026-05-16','2026-06-17 02:58:42.7187848',0,0,1,'["westend"]');
INSERT INTO InventoryPurchases VALUES(98,'CMP-SCDEMO-072','SC Demo Component 072',152.0,'kg',724.2,'2026-05-15','2026-06-16 02:58:42.7187848',0,0,1,'["downtown"]');
INSERT INTO InventoryPurchases VALUES(99,'CMP-SCDEMO-072','SC Demo Component 072',47.0,'kg',724.2,'2026-06-27','2026-06-28 02:58:42.7187848',0,0,1,'["midtown"]');
INSERT INTO InventoryPurchases VALUES(100,'CMP-SCDEMO-073','SC Demo Component 073',153.0,'l',975.8,'2026-05-14','2026-06-15 02:58:42.7187848',0,0,1,'["midtown"]');
INSERT INTO InventoryPurchases VALUES(101,'CMP-SCDEMO-074','SC Demo Component 074',154.0,'pcs',1.5331,'2026-05-13','2026-06-14 02:58:42.7187848',0,0,1,'["airport"]');
INSERT INTO InventoryPurchases VALUES(102,'CMP-SCDEMO-075','SC Demo Component 075',155.0,'kg',1769.5,'2026-05-12','2026-06-13 02:58:42.7187848',0,0,1,'["westend"]');
INSERT INTO InventoryPurchases VALUES(103,'CMP-SCDEMO-075','SC Demo Component 075',50.0,'kg',1769.5,'2026-06-24','2026-06-25 02:58:42.7187848',0,0,1,'["downtown"]');
INSERT INTO InventoryPurchases VALUES(104,'CMP-SCDEMO-076','SC Demo Component 076',156.0,'l',729.3,'2026-05-11','2026-06-12 02:58:42.7187848',0,0,1,'["downtown"]');
INSERT INTO InventoryPurchases VALUES(105,'CMP-SCDEMO-077','SC Demo Component 077',157.0,'pcs',1.0067,'2026-05-10','2026-06-11 02:58:42.7187848',0,0,1,'["midtown"]');
INSERT INTO InventoryPurchases VALUES(106,'CMP-SCDEMO-078','SC Demo Component 078',158.0,'kg',1563.9,'2026-05-09','2026-06-10 02:58:42.7187848',0,0,1,'["airport"]');
INSERT INTO InventoryPurchases VALUES(107,'CMP-SCDEMO-078','SC Demo Component 078',53.0,'kg',1563.9,'2026-06-21','2026-06-22 02:58:42.7187848',0,0,1,'["westend"]');
INSERT INTO InventoryPurchases VALUES(108,'CMP-SCDEMO-079','SC Demo Component 079',159.0,'l',1138.4,'2026-05-08','2026-06-09 02:58:42.7187848',0,0,1,'["westend"]');
INSERT INTO InventoryPurchases VALUES(109,'CMP-SCDEMO-080','SC Demo Component 080',160.0,'pcs',1.2175,'2026-06-16','2026-06-08 02:58:42.7187848',0,0,1,'["downtown"]');
INSERT INTO InventoryPurchases VALUES(110,'CMP-SCDEMO-081','SC Demo Component 081',161.0,'kg',163.4,'2026-06-15','2026-06-07 02:58:42.7187848',0,0,1,'["midtown"]');
INSERT INTO InventoryPurchases VALUES(111,'CMP-SCDEMO-081','SC Demo Component 081',16.0,'kg',163.4,'2026-06-18','2026-06-29 02:58:42.7187848',0,0,1,'["airport"]');
INSERT INTO InventoryPurchases VALUES(112,'CMP-SCDEMO-082','SC Demo Component 082',162.0,'l',443.2,'2026-06-14','2026-06-06 02:58:42.7187848',0,0,1,'["airport"]');
INSERT INTO InventoryPurchases VALUES(113,'CMP-SCDEMO-083','SC Demo Component 083',163.0,'pcs',1.2373,'2026-06-13','2026-06-05 02:58:42.7187848',0,0,1,'["westend"]');
INSERT INTO InventoryPurchases VALUES(114,'CMP-SCDEMO-084','SC Demo Component 084',164.0,'kg',1784.2,'2026-06-12','2026-06-04 02:58:42.7187848',0,0,1,'["downtown"]');
INSERT INTO InventoryPurchases VALUES(115,'CMP-SCDEMO-084','SC Demo Component 084',19.0,'kg',1784.2,'2026-06-29','2026-06-26 02:58:42.7187848',0,0,1,'["midtown"]');
INSERT INTO InventoryPurchases VALUES(116,'CMP-SCDEMO-085','SC Demo Component 085',165.0,'l',1018.1,'2026-06-11','2026-06-03 02:58:42.7187848',0,0,1,'["midtown"]');
INSERT INTO InventoryPurchases VALUES(117,'CMP-SCDEMO-086','SC Demo Component 086',166.0,'pcs',0.7117,'2026-06-10','2026-06-02 02:58:42.7187848',0,0,1,'["airport"]');
INSERT INTO InventoryPurchases VALUES(118,'CMP-SCDEMO-087','SC Demo Component 087',167.0,'kg',344.8,'2026-06-09','2026-06-01 02:58:42.7187848',0,0,1,'["westend"]');
INSERT INTO InventoryPurchases VALUES(119,'CMP-SCDEMO-087','SC Demo Component 087',22.0,'kg',344.8,'2026-06-26','2026-06-23 02:58:42.7187848',0,0,1,'["downtown"]');
INSERT INTO InventoryPurchases VALUES(120,'CMP-SCDEMO-088','SC Demo Component 088',168.0,'l',490.1,'2026-06-08','2026-05-31 02:58:42.7187848',0,0,1,'["downtown"]');
INSERT INTO InventoryPurchases VALUES(121,'CMP-SCDEMO-089','SC Demo Component 089',169.0,'pcs',0.5076,'2026-06-07','2026-05-30 02:58:42.7187848',0,0,1,'["midtown"]');
INSERT INTO InventoryPurchases VALUES(122,'CMP-SCDEMO-090','SC Demo Component 090',170.0,'kg',1314.3,'2026-06-06','2026-05-29 02:58:42.7187848',0,0,1,'["airport"]');
INSERT INTO InventoryPurchases VALUES(123,'CMP-SCDEMO-090','SC Demo Component 090',25.0,'kg',1314.3,'2026-06-23','2026-06-30 02:58:42.7187848',0,0,1,'["westend"]');
INSERT INTO InventoryPurchases VALUES(124,'CMP-SCDEMO-091','SC Demo Component 091',171.0,'l',795.6,'2026-06-05','2026-05-28 02:58:42.7187848',0,0,1,'["westend"]');
INSERT INTO InventoryPurchases VALUES(125,'CMP-SCDEMO-092','SC Demo Component 092',172.0,'pcs',0.3898,'2026-06-04','2026-05-27 02:58:42.7187848',0,0,1,'["downtown"]');
INSERT INTO InventoryPurchases VALUES(126,'CMP-SCDEMO-093','SC Demo Component 093',173.0,'kg',564.6,'2026-06-03','2026-05-26 02:58:42.7187848',0,0,1,'["midtown"]');
INSERT INTO InventoryPurchases VALUES(127,'CMP-SCDEMO-093','SC Demo Component 093',28.0,'kg',564.6,'2026-06-20','2026-06-27 02:58:42.7187848',0,0,1,'["airport"]');
INSERT INTO InventoryPurchases VALUES(128,'CMP-SCDEMO-094','SC Demo Component 094',174.0,'l',773.7,'2026-06-02','2026-05-25 02:58:42.7187848',0,0,1,'["airport"]');
INSERT INTO InventoryPurchases VALUES(129,'CMP-SCDEMO-095','SC Demo Component 095',175.0,'pcs',0.4694,'2026-06-01','2026-05-24 02:58:42.7187848',0,0,1,'["westend"]');
INSERT INTO InventoryPurchases VALUES(130,'CMP-SCDEMO-096','SC Demo Component 096',176.0,'kg',1600.5,'2026-05-31','2026-05-23 02:58:42.7187848',0,0,1,'["downtown"]');
INSERT INTO InventoryPurchases VALUES(131,'CMP-SCDEMO-096','SC Demo Component 096',31.0,'kg',1600.5,'2026-06-17','2026-06-24 02:58:42.7187848',0,0,1,'["midtown"]');
INSERT INTO InventoryPurchases VALUES(132,'CMP-SCDEMO-097','SC Demo Component 097',177.0,'l',847.9,'2026-05-30','2026-05-22 02:58:42.7187848',0,0,1,'["midtown"]');
INSERT INTO InventoryPurchases VALUES(133,'CMP-SCDEMO-098','SC Demo Component 098',178.0,'pcs',1.4968,'2026-05-29','2026-05-21 02:58:42.7187848',0,0,1,'["airport"]');
INSERT INTO InventoryPurchases VALUES(134,'CMP-SCDEMO-099','SC Demo Component 099',179.0,'kg',115.6,'2026-05-28','2026-05-20 02:58:42.7187848',0,0,1,'["westend"]');
INSERT INTO InventoryPurchases VALUES(135,'CMP-SCDEMO-099','SC Demo Component 099',34.0,'kg',115.6,'2026-06-28','2026-06-21 02:58:42.7187848',0,0,1,'["downtown"]');
INSERT INTO InventoryPurchases VALUES(136,'CMP-SCDEMO-100','SC Demo Component 100',180.0,'l',1289.7,'2026-05-27','2026-05-19 02:58:42.7187848',0,0,1,'["downtown"]');
INSERT INTO InventoryPurchases VALUES(137,'CMP-SCDEMO-101','SC Demo Component 101',181.0,'pcs',1.7333,'2026-05-26','2026-05-18 02:58:42.7187848',0,0,1,'["midtown"]');
INSERT INTO InventoryPurchases VALUES(138,'CMP-SCDEMO-102','SC Demo Component 102',182.0,'kg',1410.8,'2026-05-25','2026-05-17 02:58:42.7187848',0,0,1,'["airport"]');
INSERT INTO InventoryPurchases VALUES(139,'CMP-SCDEMO-102','SC Demo Component 102',37.0,'kg',1410.8,'2026-06-25','2026-06-28 02:58:42.7187848',0,0,1,'["westend"]');
INSERT INTO InventoryPurchases VALUES(140,'CMP-SCDEMO-103','SC Demo Component 103',183.0,'l',1823.8,'2026-05-24','2026-05-16 02:58:42.7187848',0,0,1,'["westend"]');
INSERT INTO InventoryPurchases VALUES(141,'CMP-SCDEMO-104','SC Demo Component 104',184.0,'pcs',1.5783,'2026-05-23','2026-05-15 02:58:42.7187848',0,0,1,'["downtown"]');
INSERT INTO InventoryPurchases VALUES(142,'CMP-SCDEMO-105','SC Demo Component 105',185.0,'kg',681.6,'2026-05-22','2026-06-18 02:58:42.7187848',0,0,1,'["midtown"]');
INSERT INTO InventoryPurchases VALUES(143,'CMP-SCDEMO-105','SC Demo Component 105',40.0,'kg',681.6,'2026-06-22','2026-06-25 02:58:42.7187848',0,0,1,'["airport"]');
INSERT INTO InventoryPurchases VALUES(144,'CMP-SCDEMO-106','SC Demo Component 106',186.0,'l',1888.8,'2026-05-21','2026-06-17 02:58:42.7187848',0,0,1,'["airport"]');
INSERT INTO InventoryPurchases VALUES(145,'CMP-SCDEMO-107','SC Demo Component 107',187.0,'pcs',1.4884,'2026-05-20','2026-06-16 02:58:42.7187848',0,0,1,'["westend"]');
INSERT INTO InventoryPurchases VALUES(146,'CMP-SCDEMO-108','SC Demo Component 108',188.0,'kg',1364.0,'2026-05-19','2026-06-15 02:58:42.7187848',0,0,1,'["downtown"]');
INSERT INTO InventoryPurchases VALUES(147,'CMP-SCDEMO-108','SC Demo Component 108',43.0,'kg',1364.0,'2026-06-19','2026-06-22 02:58:42.7187848',0,0,1,'["midtown"]');
INSERT INTO InventoryPurchases VALUES(148,'CMP-SCDEMO-109','SC Demo Component 109',189.0,'l',1862.5,'2026-05-18','2026-06-14 02:58:42.7187848',0,0,1,'["midtown"]');
INSERT INTO InventoryPurchases VALUES(149,'CMP-SCDEMO-110','SC Demo Component 110',190.0,'pcs',1.0191,'2026-05-17','2026-06-13 02:58:42.7187848',0,0,1,'["airport"]');
INSERT INTO InventoryPurchases VALUES(150,'CMP-SCDEMO-111','SC Demo Component 111',191.0,'kg',674.7,'2026-05-16','2026-06-12 02:58:42.7187848',0,0,1,'["westend"]');
INSERT INTO InventoryPurchases VALUES(151,'CMP-SCDEMO-111','SC Demo Component 111',46.0,'kg',674.7,'2026-06-16','2026-06-29 02:58:42.7187848',0,0,1,'["downtown"]');
INSERT INTO InventoryPurchases VALUES(152,'CMP-SCDEMO-112','SC Demo Component 112',192.0,'l',1953.0,'2026-05-15','2026-06-11 02:58:42.7187848',0,0,1,'["downtown"]');
INSERT INTO InventoryPurchases VALUES(153,'CMP-SCDEMO-113','SC Demo Component 113',193.0,'pcs',1.5544,'2026-05-14','2026-06-10 02:58:42.7187848',0,0,1,'["midtown"]');
INSERT INTO InventoryPurchases VALUES(154,'CMP-SCDEMO-114','SC Demo Component 114',194.0,'kg',1217.4,'2026-05-13','2026-06-09 02:58:42.7187848',0,0,1,'["airport"]');
INSERT INTO InventoryPurchases VALUES(155,'CMP-SCDEMO-114','SC Demo Component 114',49.0,'kg',1217.4,'2026-06-27','2026-06-26 02:58:42.7187848',0,0,1,'["westend"]');
INSERT INTO InventoryPurchases VALUES(156,'CMP-SCDEMO-115','SC Demo Component 115',195.0,'l',1902.3,'2026-05-12','2026-06-08 02:58:42.7187848',0,0,1,'["westend"]');
INSERT INTO InventoryPurchases VALUES(157,'CMP-SCDEMO-116','SC Demo Component 116',196.0,'pcs',1.4264,'2026-05-11','2026-06-07 02:58:42.7187848',0,0,1,'["downtown"]');
INSERT INTO InventoryPurchases VALUES(158,'CMP-SCDEMO-117','SC Demo Component 117',197.0,'kg',1450.6,'2026-05-10','2026-06-06 02:58:42.7187848',0,0,1,'["midtown"]');
INSERT INTO InventoryPurchases VALUES(159,'CMP-SCDEMO-117','SC Demo Component 117',52.0,'kg',1450.6,'2026-06-24','2026-06-23 02:58:42.7187848',0,0,1,'["airport"]');
INSERT INTO InventoryPurchases VALUES(160,'CMP-SCDEMO-118','SC Demo Component 118',198.0,'l',1957.8,'2026-05-09','2026-06-05 02:58:42.7187848',0,0,1,'["airport"]');
INSERT INTO InventoryPurchases VALUES(161,'CMP-SCDEMO-119','SC Demo Component 119',199.0,'pcs',1.4378,'2026-05-08','2026-06-04 02:58:42.7187848',0,0,1,'["westend"]');
INSERT INTO InventoryPurchases VALUES(162,'CMP-SCDEMO-120','SC Demo Component 120',200.0,'kg',1636.2,'2026-06-16','2026-06-03 02:58:42.7187848',0,0,1,'["downtown"]');
INSERT INTO InventoryPurchases VALUES(163,'CMP-SCDEMO-120','SC Demo Component 120',15.0,'kg',1636.2,'2026-06-21','2026-06-30 02:58:42.7187848',0,0,1,'["midtown"]');
INSERT INTO InventoryPurchases VALUES(164,'CMP-SCDEMO-121','SC Demo Component 121',201.0,'l',1210.2,'2026-06-15','2026-06-02 02:58:42.7187848',0,0,1,'["midtown"]');
INSERT INTO InventoryPurchases VALUES(165,'CMP-SCDEMO-122','SC Demo Component 122',202.0,'pcs',1.7475,'2026-06-14','2026-06-01 02:58:42.7187848',0,0,1,'["airport"]');
INSERT INTO InventoryPurchases VALUES(166,'CMP-SCDEMO-123','SC Demo Component 123',203.0,'kg',1630.5,'2026-06-13','2026-05-31 02:58:42.7187848',0,0,1,'["westend"]');
INSERT INTO InventoryPurchases VALUES(167,'CMP-SCDEMO-123','SC Demo Component 123',18.0,'kg',1630.5,'2026-06-18','2026-06-27 02:58:42.7187848',0,0,1,'["downtown"]');
INSERT INTO InventoryPurchases VALUES(168,'CMP-SCDEMO-124','SC Demo Component 124',204.0,'l',420.8,'2026-06-12','2026-05-30 02:58:42.7187848',0,0,1,'["downtown"]');
INSERT INTO InventoryPurchases VALUES(169,'CMP-SCDEMO-125','SC Demo Component 125',205.0,'pcs',0.4322,'2026-06-11','2026-05-29 02:58:42.7187848',0,0,1,'["midtown"]');
INSERT INTO InventoryPurchases VALUES(170,'CMP-SCDEMO-126','SC Demo Component 126',206.0,'kg',1924.4,'2026-06-10','2026-05-28 02:58:42.7187848',0,0,1,'["airport"]');
INSERT INTO InventoryPurchases VALUES(171,'CMP-SCDEMO-126','SC Demo Component 126',21.0,'kg',1924.4,'2026-06-29','2026-06-24 02:58:42.7187848',0,0,1,'["westend"]');
INSERT INTO InventoryPurchases VALUES(172,'CMP-SCDEMO-127','SC Demo Component 127',207.0,'l',271.4,'2026-06-09','2026-05-27 02:58:42.7187848',0,0,1,'["westend"]');
INSERT INTO InventoryPurchases VALUES(173,'CMP-SCDEMO-128','SC Demo Component 128',208.0,'pcs',1.0026,'2026-06-08','2026-05-26 02:58:42.7187848',0,0,1,'["downtown"]');
INSERT INTO InventoryPurchases VALUES(174,'CMP-SCDEMO-129','SC Demo Component 129',209.0,'kg',1307.7,'2026-06-07','2026-05-25 02:58:42.7187848',0,0,1,'["midtown"]');
INSERT INTO InventoryPurchases VALUES(175,'CMP-SCDEMO-129','SC Demo Component 129',24.0,'kg',1307.7,'2026-06-26','2026-06-21 02:58:42.7187848',0,0,1,'["airport"]');
INSERT INTO InventoryPurchases VALUES(176,'CMP-SCDEMO-130','SC Demo Component 130',210.0,'l',1210.1,'2026-06-06','2026-05-24 02:58:42.7187848',0,0,1,'["airport"]');
INSERT INTO InventoryPurchases VALUES(177,'CMP-SCDEMO-131','SC Demo Component 131',211.0,'pcs',1.5967,'2026-06-05','2026-05-23 02:58:42.7187848',0,0,1,'["westend"]');
INSERT INTO InventoryPurchases VALUES(178,'CMP-SCDEMO-132','SC Demo Component 132',212.0,'kg',1855.2,'2026-06-04','2026-05-22 02:58:42.7187848',0,0,1,'["downtown"]');
INSERT INTO InventoryPurchases VALUES(179,'CMP-SCDEMO-132','SC Demo Component 132',27.0,'kg',1855.2,'2026-06-23','2026-06-28 02:58:42.7187848',0,0,1,'["midtown"]');
INSERT INTO InventoryPurchases VALUES(180,'CMP-SCDEMO-133','SC Demo Component 133',213.0,'l',745.4,'2026-06-03','2026-05-21 02:58:42.7187848',0,0,1,'["midtown"]');
INSERT INTO InventoryPurchases VALUES(181,'CMP-SCDEMO-134','SC Demo Component 134',214.0,'pcs',1.0975,'2026-06-02','2026-05-20 02:58:42.7187848',0,0,1,'["airport"]');
INSERT INTO InventoryPurchases VALUES(182,'CMP-SCDEMO-135','SC Demo Component 135',215.0,'kg',1718.5,'2026-06-01','2026-05-19 02:58:42.7187848',0,0,1,'["westend"]');
INSERT INTO InventoryPurchases VALUES(183,'CMP-SCDEMO-135','SC Demo Component 135',30.0,'kg',1718.5,'2026-06-20','2026-06-25 02:58:42.7187848',0,0,1,'["downtown"]');
INSERT INTO InventoryPurchases VALUES(184,'CMP-SCDEMO-136','SC Demo Component 136',216.0,'l',2027.0,'2026-05-31','2026-05-18 02:58:42.7187848',0,0,1,'["downtown"]');
INSERT INTO InventoryPurchases VALUES(185,'CMP-SCDEMO-137','SC Demo Component 137',217.0,'pcs',1.4969,'2026-05-30','2026-05-17 02:58:42.7187848',0,0,1,'["midtown"]');
INSERT INTO InventoryPurchases VALUES(186,'CMP-SCDEMO-138','SC Demo Component 138',218.0,'kg',1388.6,'2026-05-29','2026-05-16 02:58:42.7187848',0,0,1,'["airport"]');
INSERT INTO InventoryPurchases VALUES(187,'CMP-SCDEMO-138','SC Demo Component 138',33.0,'kg',1388.6,'2026-06-17','2026-06-22 02:58:42.7187848',0,0,1,'["westend"]');
INSERT INTO InventoryPurchases VALUES(188,'CMP-SCDEMO-139','SC Demo Component 139',219.0,'l',1757.6,'2026-05-28','2026-05-15 02:58:42.7187848',0,0,1,'["westend"]');
INSERT INTO InventoryPurchases VALUES(189,'CMP-SCDEMO-140','SC Demo Component 140',220.0,'pcs',2.0183,'2026-05-27','2026-06-18 02:58:42.7187848',0,0,1,'["downtown"]');
INSERT INTO InventoryPurchases VALUES(190,'CMP-SCDEMO-141','SC Demo Component 141',221.0,'kg',531.8,'2026-05-26','2026-06-17 02:58:42.7187848',0,0,1,'["midtown"]');
INSERT INTO InventoryPurchases VALUES(191,'CMP-SCDEMO-141','SC Demo Component 141',36.0,'kg',531.8,'2026-06-28','2026-06-29 02:58:42.7187848',0,0,1,'["airport"]');
INSERT INTO InventoryPurchases VALUES(192,'CMP-SCDEMO-142','SC Demo Component 142',222.0,'l',266.3,'2026-05-25','2026-06-16 02:58:42.7187848',0,0,1,'["airport"]');
INSERT INTO InventoryPurchases VALUES(193,'CMP-SCDEMO-143','SC Demo Component 143',223.0,'pcs',0.9288,'2026-05-24','2026-06-15 02:58:42.7187848',0,0,1,'["westend"]');
INSERT INTO InventoryPurchases VALUES(194,'CMP-SCDEMO-144','SC Demo Component 144',224.0,'kg',1095.7,'2026-05-23','2026-06-14 02:58:42.7187848',0,0,1,'["downtown"]');
INSERT INTO InventoryPurchases VALUES(195,'CMP-SCDEMO-144','SC Demo Component 144',39.0,'kg',1095.7,'2026-06-25','2026-06-26 02:58:42.7187848',0,0,1,'["midtown"]');
INSERT INTO InventoryPurchases VALUES(196,'CMP-SCDEMO-145','SC Demo Component 145',225.0,'l',784.4,'2026-05-22','2026-06-13 02:58:42.7187848',0,0,1,'["midtown"]');
INSERT INTO InventoryPurchases VALUES(197,'CMP-SCDEMO-146','SC Demo Component 146',226.0,'pcs',0.3771,'2026-05-21','2026-06-12 02:58:42.7187848',0,0,1,'["airport"]');
INSERT INTO InventoryPurchases VALUES(198,'CMP-SCDEMO-147','SC Demo Component 147',227.0,'kg',565.2,'2026-05-20','2026-06-11 02:58:42.7187848',0,0,1,'["westend"]');
INSERT INTO InventoryPurchases VALUES(199,'CMP-SCDEMO-147','SC Demo Component 147',42.0,'kg',565.2,'2026-06-22','2026-06-23 02:58:42.7187848',0,0,1,'["downtown"]');
INSERT INTO InventoryPurchases VALUES(200,'CMP-SCDEMO-148','SC Demo Component 148',228.0,'l',303.9,'2026-05-19','2026-06-10 02:58:42.7187848',0,0,1,'["downtown"]');
INSERT INTO InventoryPurchases VALUES(201,'CMP-SCDEMO-149','SC Demo Component 149',229.0,'pcs',1.311,'2026-05-18','2026-06-09 02:58:42.7187848',0,0,1,'["midtown"]');
INSERT INTO InventoryPurchases VALUES(202,'CMP-SCDEMO-150','SC Demo Component 150',230.0,'kg',1702.2,'2026-05-17','2026-06-08 02:58:42.7187848',0,0,1,'["airport"]');
INSERT INTO InventoryPurchases VALUES(203,'CMP-SCDEMO-150','SC Demo Component 150',45.0,'kg',1702.2,'2026-06-19','2026-06-30 02:58:42.7187848',0,0,1,'["westend"]');
INSERT INTO InventoryPurchases VALUES(204,'CMP-SCDEMO-151','SC Demo Component 151',231.0,'l',105.0,'2026-05-16','2026-06-07 02:58:42.7187848',0,0,1,'["westend"]');
INSERT INTO InventoryPurchases VALUES(205,'CMP-SCDEMO-152','SC Demo Component 152',232.0,'pcs',1.6031,'2026-05-15','2026-06-06 02:58:42.7187848',0,0,1,'["downtown"]');
INSERT INTO InventoryPurchases VALUES(206,'CMP-SCDEMO-153','SC Demo Component 153',233.0,'kg',155.0,'2026-05-14','2026-06-05 02:58:42.7187848',0,0,1,'["midtown"]');
INSERT INTO InventoryPurchases VALUES(207,'CMP-SCDEMO-153','SC Demo Component 153',48.0,'kg',155.0,'2026-06-16','2026-06-27 02:58:42.7187848',0,0,1,'["airport"]');
INSERT INTO InventoryPurchases VALUES(208,'CMP-SCDEMO-154','SC Demo Component 154',234.0,'l',1635.6,'2026-05-13','2026-06-04 02:58:42.7187848',0,0,1,'["airport"]');
INSERT INTO InventoryPurchases VALUES(209,'CMP-SCDEMO-155','SC Demo Component 155',235.0,'pcs',1.4523,'2026-05-12','2026-06-03 02:58:42.7187848',0,0,1,'["westend"]');
INSERT INTO InventoryPurchases VALUES(210,'CMP-SCDEMO-156','SC Demo Component 156',236.0,'kg',620.6,'2026-05-11','2026-06-02 02:58:42.7187848',0,0,1,'["downtown"]');
INSERT INTO InventoryPurchases VALUES(211,'CMP-SCDEMO-156','SC Demo Component 156',51.0,'kg',620.6,'2026-06-27','2026-06-24 02:58:42.7187848',0,0,1,'["midtown"]');
INSERT INTO InventoryPurchases VALUES(212,'CMP-SCDEMO-157','SC Demo Component 157',237.0,'l',1893.7,'2026-05-10','2026-06-01 02:58:42.7187848',0,0,1,'["midtown"]');
INSERT INTO InventoryPurchases VALUES(213,'CMP-SCDEMO-158','SC Demo Component 158',238.0,'pcs',0.4894,'2026-05-09','2026-05-31 02:58:42.7187848',0,0,1,'["airport"]');
INSERT INTO InventoryPurchases VALUES(214,'CMP-SCDEMO-159','SC Demo Component 159',239.0,'kg',763.5,'2026-05-08','2026-05-30 02:58:42.7187848',0,0,1,'["westend"]');
INSERT INTO InventoryPurchases VALUES(215,'CMP-SCDEMO-159','SC Demo Component 159',54.0,'kg',763.5,'2026-06-24','2026-06-21 02:58:42.7187848',0,0,1,'["downtown"]');
INSERT INTO InventoryPurchases VALUES(216,'CMP-SCDEMO-160','SC Demo Component 160',240.0,'l',1049.5,'2026-06-16','2026-05-29 02:58:42.7187848',0,0,1,'["downtown"]');
INSERT INTO InventoryPurchases VALUES(217,'CMP-SCDEMO-161','SC Demo Component 161',241.0,'pcs',1.576,'2026-06-15','2026-05-28 02:58:42.7187848',0,0,1,'["midtown"]');
INSERT INTO InventoryPurchases VALUES(218,'CMP-SCDEMO-162','SC Demo Component 162',242.0,'kg',1067.0,'2026-06-14','2026-05-27 02:58:42.7187848',0,0,1,'["airport"]');
INSERT INTO InventoryPurchases VALUES(219,'CMP-SCDEMO-162','SC Demo Component 162',17.0,'kg',1067.0,'2026-06-21','2026-06-28 02:58:42.7187848',0,0,1,'["westend"]');
INSERT INTO InventoryPurchases VALUES(220,'CMP-SCDEMO-163','SC Demo Component 163',243.0,'l',1452.0,'2026-06-13','2026-05-26 02:58:42.7187848',0,0,1,'["westend"]');
INSERT INTO InventoryPurchases VALUES(221,'CMP-SCDEMO-164','SC Demo Component 164',244.0,'pcs',1.672,'2026-06-12','2026-05-25 02:58:42.7187848',0,0,1,'["downtown"]');
INSERT INTO InventoryPurchases VALUES(222,'CMP-SCDEMO-165','SC Demo Component 165',245.0,'kg',964.7,'2026-06-11','2026-05-24 02:58:42.7187848',0,0,1,'["midtown"]');
INSERT INTO InventoryPurchases VALUES(223,'CMP-SCDEMO-165','SC Demo Component 165',20.0,'kg',964.7,'2026-06-18','2026-06-25 02:58:42.7187848',0,0,1,'["airport"]');
INSERT INTO InventoryPurchases VALUES(224,'CMP-SCDEMO-166','SC Demo Component 166',246.0,'l',347.5,'2026-06-10','2026-05-23 02:58:42.7187848',0,0,1,'["airport"]');
INSERT INTO InventoryPurchases VALUES(225,'CMP-SCDEMO-167','SC Demo Component 167',247.0,'pcs',1.9533,'2026-06-09','2026-05-22 02:58:42.7187848',0,0,1,'["westend"]');
INSERT INTO InventoryPurchases VALUES(226,'CMP-SCDEMO-168','SC Demo Component 168',248.0,'kg',397.0,'2026-06-08','2026-05-21 02:58:42.7187848',0,0,1,'["downtown"]');
INSERT INTO InventoryPurchases VALUES(227,'CMP-SCDEMO-168','SC Demo Component 168',23.0,'kg',397.0,'2026-06-29','2026-06-22 02:58:42.7187848',0,0,1,'["midtown"]');
INSERT INTO InventoryPurchases VALUES(228,'CMP-SCDEMO-169','SC Demo Component 169',249.0,'l',442.7,'2026-06-07','2026-05-20 02:58:42.7187848',0,0,1,'["midtown"]');
INSERT INTO InventoryPurchases VALUES(229,'CMP-SCDEMO-170','SC Demo Component 170',250.0,'pcs',1.7154,'2026-06-06','2026-05-19 02:58:42.7187848',0,0,1,'["airport"]');
INSERT INTO InventoryPurchases VALUES(233,'CMP-SCFIFO-001','SC FIFO Demo Wagyu',50.0,'kg',38.5,'2026-05-20','2026-06-11 12:16:19.5023319',25,0,1,'["downtown"]');
INSERT INTO InventoryPurchases VALUES(234,'CMP-SCFIFO-001','SC FIFO Demo Wagyu',40.0,'kg',42.0,'2026-06-06','2026-06-18 13:16:19.5023319',26,0,1,'["downtown"]');
INSERT INTO InventoryPurchases VALUES(235,'CMP-SCFIFO-001','SC FIFO Demo Wagyu',30.0,'kg',45.75,'2026-06-22','2026-06-28 14:16:19.5023319',27,0,1,'["downtown"]');
CREATE TABLE IF NOT EXISTS "VendorProductPrices" (

    "ExternalId" TEXT NOT NULL CONSTRAINT "PK_VendorProductPrices" PRIMARY KEY,

    "DeliveryPrice" REAL NOT NULL,

    "UpdatedAt" TEXT NOT NULL,

    "LastPurchaseOrderId" INTEGER

);
INSERT INTO VendorProductPrices VALUES('VP-GAR006',16.5,'2026-07-01 11:21:04.3367763',24);
CREATE TABLE IF NOT EXISTS "UserNotifications" (

    "Id" INTEGER NOT NULL CONSTRAINT "PK_UserNotifications" PRIMARY KEY AUTOINCREMENT,

    "UserId" INTEGER,

    "RecipientName" TEXT NOT NULL DEFAULT '',

    "PurchaseOrderId" INTEGER,

    "Type" TEXT NOT NULL DEFAULT '',

    "Title" TEXT NOT NULL DEFAULT '',

    "Body" TEXT NOT NULL DEFAULT '',

    "CreatedAt" TEXT NOT NULL,

    "ReadAt" TEXT

);
CREATE TABLE IF NOT EXISTS "CashPurchases" (

    "Id" INTEGER NOT NULL CONSTRAINT "PK_CashPurchases" PRIMARY KEY AUTOINCREMENT,

    "DatePurchased" TEXT NOT NULL,

    "StoreName" TEXT NOT NULL DEFAULT '',

    "ComponentId" TEXT NOT NULL DEFAULT '',

    "ComponentName" TEXT NOT NULL DEFAULT '',

    "StoreProductName" TEXT NOT NULL DEFAULT '',

    "DeliveryUnit" TEXT NOT NULL DEFAULT '',

    "DeliveryPrice" REAL NOT NULL,

    "Quantity" REAL NOT NULL,

    "ComponentUom" TEXT NOT NULL DEFAULT '',

    "ReceiptNumber" TEXT NOT NULL DEFAULT '',

    "ReceiptFileName" TEXT NOT NULL DEFAULT '',

    "ReceiptFileBase64" TEXT NOT NULL DEFAULT '',

    "InventoryPurchaseId" INTEGER NOT NULL DEFAULT 0,

    "CompanyId" INTEGER,

    "LocationIdsJson" TEXT NOT NULL DEFAULT '[]',

    "CreatedAt" TEXT NOT NULL

);
INSERT INTO CashPurchases VALUES(1,'2026-07-02','Village Grocer','CMP-00FLOU-001','00 Flour','Italian Flour 00 Caputo','kg',10.0,2.0,'kg','54651','','',2,1,'["airport"]','2026-07-02 02:44:16.4322224');
INSERT INTO CashPurchases VALUES(2,'2026-07-02','village grocer','CMP-00FLOU-001','00 Flour','Caputo flour 00','kg',11.0,1.0,'kg','65464','','',3,1,'["airport"]','2026-07-02 03:06:09.1064562');
CREATE TABLE IF NOT EXISTS "OrderTemplates" (

    "Id" INTEGER NOT NULL CONSTRAINT "PK_OrderTemplates" PRIMARY KEY AUTOINCREMENT,

    "Name" TEXT NOT NULL DEFAULT '',

    "VendorExternalId" TEXT NOT NULL DEFAULT '',

    "VendorName" TEXT NOT NULL DEFAULT '',

    "ScheduleMode" TEXT NOT NULL DEFAULT '',

    "WeekdaysJson" TEXT NOT NULL DEFAULT '[]',

    "MonthDaysJson" TEXT NOT NULL DEFAULT '[]',

    "RepeatEnabled" INTEGER NOT NULL DEFAULT 0,

    "CompanyId" INTEGER,

    "LocationIdsJson" TEXT NOT NULL DEFAULT '[]',

    "CreatedAt" TEXT NOT NULL,

    "UpdatedAt" TEXT NOT NULL

);
INSERT INTO OrderTemplates VALUES(1,'Monday Order','','','weekday','["Mon"]','[]',1,1,'["airport","downtown","midtown","westend"]','2026-07-02 03:39:37.0846829','2026-07-02 03:39:37.0847226');
INSERT INTO OrderTemplates VALUES(2,'Thursday Order','','','weekday','["Thu"]','[]',1,1,'["airport"]','2026-07-02 05:14:49.0549213','2026-07-02 05:14:49.0549625');
CREATE TABLE IF NOT EXISTS "OrderTemplateItems" (

    "Id" INTEGER NOT NULL CONSTRAINT "PK_OrderTemplateItems" PRIMARY KEY AUTOINCREMENT,

    "OrderTemplateId" INTEGER NOT NULL,

    "ComponentId" TEXT NOT NULL DEFAULT '',

    "ComponentName" TEXT NOT NULL DEFAULT '',

    "VendorProductId" TEXT NOT NULL DEFAULT '',

    "VendorExternalId" TEXT NOT NULL DEFAULT '',

    "VendorName" TEXT NOT NULL DEFAULT '',

    "ProductName" TEXT NOT NULL DEFAULT '',

    "Quantity" REAL NOT NULL,

    "ComponentUom" TEXT NOT NULL DEFAULT '',

    "SortOrder" INTEGER NOT NULL DEFAULT 0, "DeliveryUnit" TEXT NOT NULL DEFAULT '',

    CONSTRAINT "FK_OrderTemplateItems_OrderTemplates_OrderTemplateId"

        FOREIGN KEY ("OrderTemplateId") REFERENCES "OrderTemplates" ("Id") ON DELETE CASCADE

);
INSERT INTO OrderTemplateItems VALUES(1,1,'CMP-00FLOU-001','00 Flour','','','','',10.0,'kg',0,'');
INSERT INTO OrderTemplateItems VALUES(2,1,'CMP-CRAFTI-001','Craft IPA Beer','','','','',3.0,'l',1,'');
INSERT INTO OrderTemplateItems VALUES(3,2,'CMP-BAKEDB-001','Baked Beans','VP-BEA002','V011','Metro Canned Foods','Baked Beans',1.0,'Gr',0,'Box/12tin/380gr');
INSERT INTO OrderTemplateItems VALUES(4,2,'CMP-BURRAT-001','Burrata','VP-BUR001','V003','Artisan Dairy Co.','Burrata',1.0,'Each',1,'Case/6each');
CREATE TABLE IF NOT EXISTS "Products" (

    "Id" INTEGER NOT NULL CONSTRAINT "PK_Products" PRIMARY KEY AUTOINCREMENT,

    "ProductId" TEXT NOT NULL DEFAULT '',

    "Name" TEXT NOT NULL DEFAULT '',

    "Category" TEXT NOT NULL DEFAULT '',

    "Group" TEXT NOT NULL DEFAULT '',

    "IsSubProduct" INTEGER NOT NULL DEFAULT 0,

    "B2cEnabled" INTEGER NOT NULL DEFAULT 0,

    "B2bEnabled" INTEGER NOT NULL DEFAULT 0,

    "TotalCost" REAL NOT NULL DEFAULT 0,

    "CompanyId" INTEGER,

    "LocationIdsJson" TEXT NOT NULL DEFAULT '[]',

    "CreatedAt" TEXT NOT NULL,

    "UpdatedAt" TEXT NOT NULL

, "Rrp" REAL NOT NULL DEFAULT 0, "PosEnabled" INTEGER NOT NULL DEFAULT 0, "Active" INTEGER NOT NULL DEFAULT 1, "YieldQuantity" REAL NOT NULL DEFAULT 0, "YieldUom" TEXT NOT NULL DEFAULT '', "PackagingCost" REAL NOT NULL DEFAULT 0, "PreviousTotalCost" REAL NULL, "PreviousPackagingCost" REAL NULL, "PreviousRrp" REAL NULL, "B2bPackageUnit" TEXT NOT NULL DEFAULT 'pcs', "ExpiryPeriodDays" INTEGER NOT NULL DEFAULT 0);
INSERT INTO Products VALUES(1,'PRD-SPAGHE-001','Spaghetti Aglio Olio','Food','Pasta',0,1,0,1.2861052631578951,1,'["airport","downtown","midtown","westend"]','2026-07-02 14:13:56.782734','2026-07-03 03:37:06.6279036',8.0,0,1,0.0,'',0.0,NULL,NULL,NULL,'pcs',0);
INSERT INTO Products VALUES(2,'SUB-BURGER-001','Burger Patties','Food','Proteins',1,0,0,42.78,1,'["airport","downtown","midtown","westend"]','2026-07-02 15:03:38.0374358','2026-07-03 08:46:42.9039055',0.0,0,1,10.0,'pcs',0.0,NULL,NULL,NULL,'pcs',0);
INSERT INTO Products VALUES(3,'PRD-SCDEMO-001','SC Demo Product 171','Food','Dry Goods',0,0,1,12.58,1,'["downtown","midtown","airport","westend"]','2026-07-06 02:58:42.7187848','2026-07-06 02:58:42.7187848',37.15,0,1,0.0,'',2.99,NULL,NULL,NULL,'pcs',0);
INSERT INTO Products VALUES(4,'PRD-SCDEMO-002','SC Demo Product 172','Food','Seafood',0,1,1,15.59,1,'["downtown","midtown","airport","westend"]','2026-07-06 02:58:42.7187848','2026-07-06 02:58:42.7187848',46.64,0,1,0.0,'',0.94,NULL,NULL,NULL,'pcs',0);
INSERT INTO Products VALUES(5,'PRD-SCDEMO-003','SC Demo Product 173','Food','Beverages',0,0,1,7.26,1,'["downtown","midtown","airport","westend"]','2026-07-06 02:58:42.7187848','2026-07-06 02:58:42.7187848',42.34,0,1,0.0,'',0.98,NULL,NULL,NULL,'pcs',0);
INSERT INTO Products VALUES(6,'PRD-SCDEMO-004','SC Demo Product 174','Food','Packaging',0,1,1,13.2,1,'["downtown","midtown","airport","westend"]','2026-07-06 02:58:42.7187848','2026-07-06 02:58:42.7187848',41.66,0,1,0.0,'',1.95,NULL,NULL,NULL,'pcs',0);
INSERT INTO Products VALUES(7,'PRD-SCDEMO-005','SC Demo Product 175','Food','Proteins',0,0,1,21.02,1,'["downtown","midtown","airport","westend"]','2026-07-06 02:58:42.7187848','2026-07-06 02:58:42.7187848',37.02,0,1,0.0,'',2.27,NULL,NULL,NULL,'pcs',0);
INSERT INTO Products VALUES(8,'PRD-SCDEMO-006','SC Demo Product 176','Food','Produce',0,1,1,6.15,1,'["downtown","midtown","airport","westend"]','2026-07-06 02:58:42.7187848','2026-07-06 02:58:42.7187848',14.76,0,1,0.0,'',1.21,NULL,NULL,NULL,'pcs',0);
INSERT INTO Products VALUES(9,'PRD-SCDEMO-007','SC Demo Product 177','Food','Dairy',0,0,1,15.97,1,'["downtown","midtown","airport","westend"]','2026-07-06 02:58:42.7187848','2026-07-06 02:58:42.7187848',47.98,0,1,0.0,'',1.02,NULL,NULL,NULL,'pcs',0);
INSERT INTO Products VALUES(10,'PRD-SCDEMO-008','SC Demo Product 178','Food','Dry Goods',0,1,1,9.11,1,'["downtown","midtown","airport","westend"]','2026-07-06 02:58:42.7187848','2026-07-06 02:58:42.7187848',36.16,0,1,0.0,'',0.87,NULL,NULL,NULL,'pcs',0);
INSERT INTO Products VALUES(11,'PRD-SCDEMO-009','SC Demo Product 179','Food','Seafood',0,0,1,8.69,1,'["downtown","midtown","airport","westend"]','2026-07-06 02:58:42.7187848','2026-07-06 02:58:42.7187848',43.86,0,1,0.0,'',2.79,NULL,NULL,NULL,'pcs',0);
INSERT INTO Products VALUES(12,'PRD-SCDEMO-010','SC Demo Product 180','Food','Beverages',0,1,1,16.3,1,'["downtown","midtown","airport","westend"]','2026-07-06 02:58:42.7187848','2026-07-06 02:58:42.7187848',31.6,0,1,0.0,'',2.52,NULL,NULL,NULL,'pcs',0);
INSERT INTO Products VALUES(13,'PRD-SCDEMO-011','SC Demo Product 181','Food','Packaging',0,0,1,11.69,1,'["downtown","midtown","airport","westend"]','2026-07-06 02:58:42.7187848','2026-07-06 02:58:42.7187848',23.12,0,1,0.0,'',2.8,NULL,NULL,NULL,'pcs',0);
INSERT INTO Products VALUES(14,'PRD-SCDEMO-012','SC Demo Product 182','Food','Proteins',0,1,1,20.91,1,'["downtown","midtown","airport","westend"]','2026-07-06 02:58:42.7187848','2026-07-06 02:58:42.7187848',33.38,0,1,0.0,'',1.61,NULL,NULL,NULL,'pcs',0);
INSERT INTO Products VALUES(15,'PRD-SCDEMO-013','SC Demo Product 183','Food','Produce',0,0,1,19.77,1,'["downtown","midtown","airport","westend"]','2026-07-06 02:58:42.7187848','2026-07-06 02:58:42.7187848',17.2,0,1,0.0,'',1.02,NULL,NULL,NULL,'pcs',0);
INSERT INTO Products VALUES(16,'PRD-SCDEMO-014','SC Demo Product 184','Food','Dairy',0,1,1,8.12,1,'["downtown","midtown","airport","westend"]','2026-07-06 02:58:42.7187848','2026-07-06 02:58:42.7187848',32.53,0,1,0.0,'',2.94,NULL,NULL,NULL,'pcs',0);
INSERT INTO Products VALUES(17,'PRD-SCDEMO-015','SC Demo Product 185','Food','Dry Goods',0,0,1,23.55,1,'["downtown","midtown","airport","westend"]','2026-07-06 02:58:42.7187848','2026-07-06 02:58:42.7187848',16.87,0,1,0.0,'',1.44,NULL,NULL,NULL,'pcs',0);
INSERT INTO Products VALUES(18,'SUB-SCDEMO-001','SC Demo Sub-Product 186','Food','Seafood',1,0,1,13.26,1,'["downtown","midtown","airport","westend"]','2026-07-06 02:58:42.7187848','2026-07-06 02:58:42.7187848',38.92,0,1,16.0,'portion',1.27,NULL,NULL,NULL,'16 portion',11);
INSERT INTO Products VALUES(19,'SUB-SCDEMO-002','SC Demo Sub-Product 187','Food','Beverages',1,0,1,19.45,1,'["downtown","midtown","airport","westend"]','2026-07-06 02:58:42.7187848','2026-07-06 02:58:42.7187848',29.13,0,1,17.0,'portion',0.55,NULL,NULL,NULL,'17 portion',12);
INSERT INTO Products VALUES(20,'SUB-SCDEMO-003','SC Demo Sub-Product 188','Food','Packaging',1,0,1,22.08,1,'["downtown","midtown","airport","westend"]','2026-07-06 02:58:42.7187848','2026-07-06 02:58:42.7187848',22.74,0,1,18.0,'portion',2.92,NULL,NULL,NULL,'18 portion',13);
INSERT INTO Products VALUES(21,'SUB-SCDEMO-004','SC Demo Sub-Product 189','Food','Proteins',1,0,1,10.34,1,'["downtown","midtown","airport","westend"]','2026-07-06 02:58:42.7187848','2026-07-06 02:58:42.7187848',32.7,0,1,19.0,'portion',0.71,NULL,NULL,NULL,'19 portion',14);
INSERT INTO Products VALUES(22,'SUB-SCDEMO-005','SC Demo Sub-Product 190','Food','Produce',1,0,1,7.48,1,'["downtown","midtown","airport","westend"]','2026-07-06 02:58:42.7187848','2026-07-06 02:58:42.7187848',26.06,0,1,20.0,'portion',2.81,NULL,NULL,NULL,'20 portion',5);
INSERT INTO Products VALUES(23,'SUB-SCDEMO-006','SC Demo Sub-Product 191','Food','Dairy',1,0,1,21.13,1,'["downtown","midtown","airport","westend"]','2026-07-06 02:58:42.7187848','2026-07-06 02:58:42.7187848',40.15,0,1,21.0,'portion',1.79,NULL,NULL,NULL,'21 portion',6);
INSERT INTO Products VALUES(24,'SUB-SCDEMO-007','SC Demo Sub-Product 192','Food','Dry Goods',1,0,1,8.17,1,'["downtown","midtown","airport","westend"]','2026-07-06 02:58:42.7187848','2026-07-06 02:58:42.7187848',28.76,0,1,22.0,'portion',0.49,NULL,NULL,NULL,'22 portion',7);
INSERT INTO Products VALUES(25,'SUB-SCDEMO-008','SC Demo Sub-Product 193','Food','Seafood',1,0,1,13.31,1,'["downtown","midtown","airport","westend"]','2026-07-06 02:58:42.7187848','2026-07-06 02:58:42.7187848',45.57,0,1,23.0,'portion',2.46,NULL,NULL,NULL,'23 portion',8);
INSERT INTO Products VALUES(26,'SUB-SCDEMO-009','SC Demo Sub-Product 194','Food','Beverages',1,0,1,19.33,1,'["downtown","midtown","airport","westend"]','2026-07-06 02:58:42.7187848','2026-07-06 02:58:42.7187848',51.02,0,1,24.0,'portion',0.9,NULL,NULL,NULL,'24 portion',9);
INSERT INTO Products VALUES(27,'SUB-SCDEMO-010','SC Demo Sub-Product 195','Food','Packaging',1,0,1,10.19,1,'["downtown","midtown","airport","westend"]','2026-07-06 02:58:42.7187848','2026-07-06 02:58:42.7187848',28.34,0,1,25.0,'portion',1.36,NULL,NULL,NULL,'25 portion',10);
INSERT INTO Products VALUES(28,'SUB-SCDEMO-011','SC Demo Sub-Product 196','Food','Proteins',1,0,1,7.15,1,'["downtown","midtown","airport","westend"]','2026-07-06 02:58:42.7187848','2026-07-06 02:58:42.7187848',29.9,0,1,26.0,'portion',0.16,NULL,NULL,NULL,'26 portion',11);
INSERT INTO Products VALUES(29,'SUB-SCDEMO-012','SC Demo Sub-Product 197','Food','Produce',1,0,1,6.43,1,'["downtown","midtown","airport","westend"]','2026-07-06 02:58:42.7187848','2026-07-06 02:58:42.7187848',18.88,0,1,27.0,'portion',0.5,NULL,NULL,NULL,'27 portion',12);
INSERT INTO Products VALUES(30,'SUB-SCDEMO-013','SC Demo Sub-Product 198','Food','Dairy',1,0,1,14.27,1,'["downtown","midtown","airport","westend"]','2026-07-06 02:58:42.7187848','2026-07-06 02:58:42.7187848',46.14,0,1,28.0,'portion',1.16,NULL,NULL,NULL,'28 portion',13);
INSERT INTO Products VALUES(31,'SUB-SCDEMO-014','SC Demo Sub-Product 199','Food','Dry Goods',1,0,1,7.6,1,'["downtown","midtown","airport","westend"]','2026-07-06 02:58:42.7187848','2026-07-06 02:58:42.7187848',27.27,0,1,29.0,'portion',0.33,NULL,NULL,NULL,'29 portion',14);
INSERT INTO Products VALUES(32,'SUB-SCDEMO-015','SC Demo Sub-Product 200','Food','Seafood',1,0,1,19.4,1,'["downtown","midtown","airport","westend"]','2026-07-06 02:58:42.7187848','2026-07-06 02:58:42.7187848',38.64,0,1,10.0,'portion',2.42,NULL,NULL,NULL,'10 portion',5);
CREATE TABLE IF NOT EXISTS "ProductComponentItems" (

    "Id" INTEGER NOT NULL CONSTRAINT "PK_ProductComponentItems" PRIMARY KEY AUTOINCREMENT,

    "ProductId" INTEGER NOT NULL,

    "ComponentId" TEXT NOT NULL DEFAULT '',

    "ComponentName" TEXT NOT NULL DEFAULT '',

    "ComponentUom" TEXT NOT NULL DEFAULT '',

    "ComponentUomPrice" REAL NOT NULL DEFAULT 0,

    "Quantity" REAL NOT NULL,

    "Subtotal" REAL NOT NULL DEFAULT 0,

    "SortOrder" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "FK_ProductComponentItems_Products_ProductId"

        FOREIGN KEY ("ProductId") REFERENCES "Products" ("Id") ON DELETE CASCADE

);
INSERT INTO ProductComponentItems VALUES(13,2,'CMP-WAGYUB-001','Wagyu Beef A5','Gr',0.021,2000.0,42.0,0);
INSERT INTO ProductComponentItems VALUES(14,2,'CMP-SEASAL-001','Sea Salt Flakes','Gr',0.008,10.0,0.08,1);
INSERT INTO ProductComponentItems VALUES(15,2,'CMP-BLACKP-001','Black Peppercorns','Gr',0.035,20.0,0.7,2);
INSERT INTO ProductComponentItems VALUES(16,2,'CMP-PAPRIK-001','Paprika','Gr',0.0,1.0,0.0,3);
INSERT INTO ProductComponentItems VALUES(23,1,'CMP-PEELED-001','Peeled Garlic','Gr',0.016842105263157901,50.0,0.84210526315789502,0);
INSERT INTO ProductComponentItems VALUES(24,1,'CMP-OLIVEO-001','Olive Oil Extra Virgin','Ml',0.012,30.0,0.36,1);
INSERT INTO ProductComponentItems VALUES(25,1,'CMP-SEASAL-001','Sea Salt Flakes','Gr',0.008,1.0,0.008,2);
INSERT INTO ProductComponentItems VALUES(26,1,'CMP-CHILIF-001','Chili Flakes','Gr',0.0,2.0,0.0,3);
INSERT INTO ProductComponentItems VALUES(27,1,'CMP-BLACKP-001','Black Peppercorns','Gr',0.035,2.0,0.07,4);
INSERT INTO ProductComponentItems VALUES(28,1,'CMP-SPAGHE-001','Spaghetti No. 5','Gr',0.006,1.0,0.006,5);
CREATE TABLE IF NOT EXISTS "ProductAliases" (

    "Id" INTEGER NOT NULL CONSTRAINT "PK_ProductAliases" PRIMARY KEY AUTOINCREMENT,

    "ProductId" INTEGER NOT NULL,

    "Name" TEXT NOT NULL DEFAULT '',

    "Rrp" REAL NOT NULL DEFAULT 0,

    "SortOrder" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "FK_ProductAliases_Products_ProductId"

        FOREIGN KEY ("ProductId") REFERENCES "Products" ("Id") ON DELETE CASCADE

);
CREATE TABLE IF NOT EXISTS "ProductPackagingItems" (

    "Id" INTEGER NOT NULL CONSTRAINT "PK_ProductPackagingItems" PRIMARY KEY AUTOINCREMENT,

    "ProductId" INTEGER NOT NULL,

    "ComponentId" TEXT NOT NULL DEFAULT '',

    "ComponentName" TEXT NOT NULL DEFAULT '',

    "ComponentUom" TEXT NOT NULL DEFAULT '',

    "ComponentUomPrice" REAL NOT NULL DEFAULT 0,

    "Quantity" REAL NOT NULL,

    "Subtotal" REAL NOT NULL DEFAULT 0,

    "SortOrder" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "FK_ProductPackagingItems_Products_ProductId"

        FOREIGN KEY ("ProductId") REFERENCES "Products" ("Id") ON DELETE CASCADE

);
CREATE TABLE IF NOT EXISTS "ProductB2bLocationStocks" (

    "Id" INTEGER NOT NULL CONSTRAINT "PK_ProductB2bLocationStocks" PRIMARY KEY AUTOINCREMENT,

    "ProductId" INTEGER NOT NULL,

    "LocationExternalId" TEXT NOT NULL DEFAULT '',

    "InStock" REAL NOT NULL DEFAULT 0,

    "SalesPerDay" REAL NOT NULL DEFAULT 0,

    "ToProduceQty" REAL NOT NULL DEFAULT 0,

    "UpdatedAt" TEXT NOT NULL, "ProducedQty" REAL NOT NULL DEFAULT 0, "ExpiryDate" TEXT NOT NULL DEFAULT '',

    CONSTRAINT "FK_ProductB2bLocationStocks_Products_ProductId"

        FOREIGN KEY ("ProductId") REFERENCES "Products" ("Id") ON DELETE CASCADE

);
INSERT INTO ProductB2bLocationStocks VALUES(1,2,'airport',5.0,0.0,0.0,'2026-07-03 08:46:42.9684624',4.0,'2026-07-10');
INSERT INTO ProductB2bLocationStocks VALUES(2,1,'loc-1',1.0,0.0,0.0,'2026-07-03 03:37:06.627903',1.0,'2026-07-10');
INSERT INTO ProductB2bLocationStocks VALUES(3,3,'westend',25.0,3.18,0.0,'2026-07-06 02:58:42.7187848',31.0,'2026-06-17');
INSERT INTO ProductB2bLocationStocks VALUES(4,4,'downtown',25.0,4.01,0.0,'2026-07-06 02:58:42.7187848',32.0,'2026-06-16');
INSERT INTO ProductB2bLocationStocks VALUES(5,4,'airport',32.0,0.0,0.0,'2026-07-06 02:58:42.7187848',32.0,'');
INSERT INTO ProductB2bLocationStocks VALUES(6,5,'midtown',25.0,2.95,0.0,'2026-07-06 02:58:42.7187848',33.0,'2026-06-15');
INSERT INTO ProductB2bLocationStocks VALUES(7,6,'airport',25.0,3.83,0.0,'2026-07-06 02:58:42.7187848',34.0,'2026-06-14');
INSERT INTO ProductB2bLocationStocks VALUES(8,7,'westend',25.0,3.91,0.0,'2026-07-06 02:58:42.7187848',35.0,'2026-07-08');
INSERT INTO ProductB2bLocationStocks VALUES(9,8,'downtown',25.0,1.09,0.0,'2026-07-06 02:58:42.7187848',36.0,'2026-07-07');
INSERT INTO ProductB2bLocationStocks VALUES(10,8,'airport',36.0,0.0,0.0,'2026-07-06 02:58:42.7187848',36.0,'');
INSERT INTO ProductB2bLocationStocks VALUES(11,9,'midtown',25.0,2.27,0.0,'2026-07-06 02:58:42.7187848',37.0,'2026-07-06');
INSERT INTO ProductB2bLocationStocks VALUES(12,10,'airport',25.0,2.8,0.0,'2026-07-06 02:58:42.7187848',38.0,'2026-07-05');
INSERT INTO ProductB2bLocationStocks VALUES(13,11,'westend',25.0,3.57,0.0,'2026-07-06 02:58:42.7187848',39.0,'2026-07-04');
INSERT INTO ProductB2bLocationStocks VALUES(14,12,'downtown',40.0,2.05,0.0,'2026-07-06 02:58:42.7187848',40.0,'2026-07-03');
INSERT INTO ProductB2bLocationStocks VALUES(15,12,'airport',10.0,0.0,0.0,'2026-07-06 02:58:42.7187848',10.0,'');
INSERT INTO ProductB2bLocationStocks VALUES(16,13,'midtown',40.0,1.02,0.0,'2026-07-06 02:58:42.7187848',41.0,'2026-07-02');
INSERT INTO ProductB2bLocationStocks VALUES(17,14,'airport',40.0,1.71,0.0,'2026-07-06 02:58:42.7187848',42.0,'2026-07-01');
INSERT INTO ProductB2bLocationStocks VALUES(18,15,'westend',40.0,2.26,0.0,'2026-07-06 02:58:42.7187848',43.0,'2026-06-30');
INSERT INTO ProductB2bLocationStocks VALUES(19,16,'downtown',40.0,4.41,0.0,'2026-07-06 02:58:42.7187848',44.0,'2026-06-29');
INSERT INTO ProductB2bLocationStocks VALUES(20,16,'airport',14.0,0.0,0.0,'2026-07-06 02:58:42.7187848',14.0,'');
INSERT INTO ProductB2bLocationStocks VALUES(21,17,'midtown',40.0,1.25,0.0,'2026-07-06 02:58:42.7187848',45.0,'2026-06-28');
INSERT INTO ProductB2bLocationStocks VALUES(22,18,'airport',40.0,3.8,0.0,'2026-07-06 02:58:42.7187848',46.0,'2026-06-27');
INSERT INTO ProductB2bLocationStocks VALUES(23,19,'westend',40.0,2.42,0.0,'2026-07-06 02:58:42.7187848',47.0,'2026-06-26');
INSERT INTO ProductB2bLocationStocks VALUES(24,20,'downtown',40.0,4.35,0.0,'2026-07-06 02:58:42.7187848',48.0,'2026-06-25');
INSERT INTO ProductB2bLocationStocks VALUES(25,20,'airport',18.0,0.0,0.0,'2026-07-06 02:58:42.7187848',18.0,'');
INSERT INTO ProductB2bLocationStocks VALUES(26,21,'midtown',40.0,1.0,0.0,'2026-07-06 02:58:42.7187848',49.0,'2026-06-24');
INSERT INTO ProductB2bLocationStocks VALUES(27,22,'airport',40.0,0.55,0.0,'2026-07-06 02:58:42.7187848',50.0,'2026-06-23');
INSERT INTO ProductB2bLocationStocks VALUES(28,23,'westend',40.0,3.96,0.0,'2026-07-06 02:58:42.7187848',51.0,'2026-06-22');
INSERT INTO ProductB2bLocationStocks VALUES(29,24,'downtown',40.0,1.32,0.0,'2026-07-06 02:58:42.7187848',52.0,'2026-06-21');
INSERT INTO ProductB2bLocationStocks VALUES(30,24,'airport',22.0,0.0,0.0,'2026-07-06 02:58:42.7187848',22.0,'');
INSERT INTO ProductB2bLocationStocks VALUES(31,25,'midtown',40.0,0.83,0.0,'2026-07-06 02:58:42.7187848',53.0,'2026-06-20');
INSERT INTO ProductB2bLocationStocks VALUES(32,26,'airport',40.0,4.14,0.0,'2026-07-06 02:58:42.7187848',54.0,'2026-06-19');
INSERT INTO ProductB2bLocationStocks VALUES(33,27,'westend',55.0,2.95,0.0,'2026-07-06 02:58:42.7187848',55.0,'2026-06-18');
INSERT INTO ProductB2bLocationStocks VALUES(34,28,'downtown',55.0,3.55,0.0,'2026-07-06 02:58:42.7187848',56.0,'2026-06-17');
INSERT INTO ProductB2bLocationStocks VALUES(35,28,'airport',26.0,0.0,0.0,'2026-07-06 02:58:42.7187848',26.0,'');
INSERT INTO ProductB2bLocationStocks VALUES(36,29,'midtown',55.0,4.18,0.0,'2026-07-06 02:58:42.7187848',57.0,'2026-06-16');
INSERT INTO ProductB2bLocationStocks VALUES(37,30,'airport',55.0,4.46,0.0,'2026-07-06 02:58:42.7187848',58.0,'2026-06-15');
INSERT INTO ProductB2bLocationStocks VALUES(38,31,'westend',55.0,3.76,0.0,'2026-07-06 02:58:42.7187848',59.0,'2026-06-14');
INSERT INTO ProductB2bLocationStocks VALUES(39,32,'downtown',55.0,2.73,0.0,'2026-07-06 02:58:42.7187848',60.0,'2026-07-08');
INSERT INTO ProductB2bLocationStocks VALUES(40,32,'airport',30.0,0.0,0.0,'2026-07-06 02:58:42.7187848',30.0,'');
CREATE TABLE IF NOT EXISTS "InventoryMovements" (

    "Id" INTEGER NOT NULL CONSTRAINT "PK_InventoryMovements" PRIMARY KEY AUTOINCREMENT,

    "ComponentId" TEXT NOT NULL DEFAULT '',

    "ComponentName" TEXT NOT NULL DEFAULT '',

    "LocationExternalId" TEXT NOT NULL DEFAULT '',

    "QtyDelta" REAL NOT NULL DEFAULT 0,

    "Uom" TEXT NOT NULL DEFAULT '',

    "Reason" TEXT NOT NULL DEFAULT '',

    "ReferenceType" TEXT NOT NULL DEFAULT '',

    "ReferenceId" INTEGER NOT NULL DEFAULT 0,

    "CompanyId" INTEGER,

    "CreatedAt" TEXT NOT NULL

, "UnitPrice" REAL NOT NULL DEFAULT 0);
INSERT INTO InventoryMovements VALUES(1,'CMP-WAGYUB-001','Wagyu Beef A5','airport',-2000.0,'Gr','production_override','sub_product_batch',2,1,'2026-07-03 04:12:33.655908',0.0);
INSERT INTO InventoryMovements VALUES(2,'CMP-SEASAL-001','Sea Salt Flakes','airport',-10.0,'Gr','production_override','sub_product_batch',2,1,'2026-07-03 04:12:33.7121617',0.0);
INSERT INTO InventoryMovements VALUES(3,'CMP-BLACKP-001','Black Peppercorns','airport',-20.0,'Gr','production_override','sub_product_batch',2,1,'2026-07-03 04:12:33.7128304',0.0);
INSERT INTO InventoryMovements VALUES(4,'CMP-PAPRIK-001','Paprika','airport',-1.0,'Gr','production_override','sub_product_batch',2,1,'2026-07-03 04:12:33.7128676',0.0);
INSERT INTO InventoryMovements VALUES(5,'CMP-WAGYUB-001','Wagyu Beef A5','airport',-2000.0,'Gr','production_override','sub_product_batch',2,1,'2026-07-03 04:17:04.2975276',0.0);
INSERT INTO InventoryMovements VALUES(6,'CMP-SEASAL-001','Sea Salt Flakes','airport',-10.0,'Gr','production_override','sub_product_batch',2,1,'2026-07-03 04:17:04.3204492',0.0);
INSERT INTO InventoryMovements VALUES(7,'CMP-BLACKP-001','Black Peppercorns','airport',-20.0,'Gr','production_override','sub_product_batch',2,1,'2026-07-03 04:17:04.321083',0.0);
INSERT INTO InventoryMovements VALUES(8,'CMP-PAPRIK-001','Paprika','airport',-1.0,'Gr','production_override','sub_product_batch',2,1,'2026-07-03 04:17:04.3211019',0.0);
INSERT INTO InventoryMovements VALUES(9,'CMP-WAGYUB-001','Wagyu Beef A5','airport',-4000.0,'Gr','production_override','sub_product_batch',2,1,'2026-07-03 08:46:42.8667548',0.0);
INSERT INTO InventoryMovements VALUES(10,'CMP-SEASAL-001','Sea Salt Flakes','airport',-20.0,'Gr','production_override','sub_product_batch',2,1,'2026-07-03 08:46:42.8908392',0.0);
INSERT INTO InventoryMovements VALUES(11,'CMP-BLACKP-001','Black Peppercorns','airport',-40.0,'Gr','production_override','sub_product_batch',2,1,'2026-07-03 08:46:42.8916901',0.0);
INSERT INTO InventoryMovements VALUES(12,'CMP-PAPRIK-001','Paprika','airport',-2.0,'Gr','production_override','sub_product_batch',2,1,'2026-07-03 08:46:42.8917191',0.0);
INSERT INTO InventoryMovements VALUES(13,'CMP-SCDEMO-001','SC Demo Component 001','midtown',-11.0,'l','production','stock_card_demo',1,1,'2026-06-25 03:58:42.7187848',1498.0);
INSERT INTO InventoryMovements VALUES(14,'CMP-SCDEMO-002','SC Demo Component 002','airport',-12.0,'pcs','production','stock_card_demo',2,1,'2026-06-24 04:58:42.7187848',0.9651);
INSERT INTO InventoryMovements VALUES(15,'CMP-SCDEMO-003','SC Demo Component 003','westend',-13.0,'kg','production','stock_card_demo',3,1,'2026-06-23 05:58:42.7187848',682.0);
INSERT INTO InventoryMovements VALUES(16,'CMP-SCDEMO-004','SC Demo Component 004','downtown',-14.0,'l','production','stock_card_demo',4,1,'2026-06-22 06:58:42.7187848',2001.3);
INSERT INTO InventoryMovements VALUES(17,'CMP-SCDEMO-005','SC Demo Component 005','midtown',-15.0,'pcs','production','stock_card_demo',5,1,'2026-06-21 07:58:42.7187848',1.6925);
INSERT INTO InventoryMovements VALUES(18,'CMP-SCDEMO-006','SC Demo Component 006','airport',-16.0,'kg','production','stock_card_demo',6,1,'2026-06-20 08:58:42.7187848',838.9);
INSERT INTO InventoryMovements VALUES(19,'CMP-SCDEMO-007','SC Demo Component 007','westend',-17.0,'l','production','stock_card_demo',7,1,'2026-06-19 09:58:42.7187848',1453.7);
INSERT INTO InventoryMovements VALUES(20,'CMP-SCDEMO-007','SC Demo Component 007','westend',-9.0,'l','stock adjustment','stock_card_demo',7,1,'2026-06-24 09:58:42.7187848',1453.7);
INSERT INTO InventoryMovements VALUES(21,'CMP-SCDEMO-008','SC Demo Component 008','downtown',-18.0,'pcs','production','stock_card_demo',8,1,'2026-06-18 10:58:42.7187848',0.0507);
INSERT INTO InventoryMovements VALUES(22,'CMP-SCDEMO-009','SC Demo Component 009','midtown',-19.0,'kg','production','stock_card_demo',9,1,'2026-06-17 11:58:42.7187848',980.9);
INSERT INTO InventoryMovements VALUES(23,'CMP-SCDEMO-010','SC Demo Component 010','airport',-20.0,'l','production','stock_card_demo',10,1,'2026-06-16 12:58:42.7187848',1641.7);
INSERT INTO InventoryMovements VALUES(24,'CMP-SCDEMO-011','SC Demo Component 011','westend',-21.0,'pcs','production','stock_card_demo',11,1,'2026-06-15 13:58:42.7187848',0.4035);
INSERT INTO InventoryMovements VALUES(25,'CMP-SCDEMO-012','SC Demo Component 012','downtown',-22.0,'kg','production','stock_card_demo',12,1,'2026-06-14 02:58:42.7187848',482.7);
INSERT INTO InventoryMovements VALUES(26,'CMP-SCDEMO-013','SC Demo Component 013','midtown',-23.0,'l','production','stock_card_demo',13,1,'2026-06-13 03:58:42.7187848',1105.9);
INSERT INTO InventoryMovements VALUES(27,'CMP-SCDEMO-014','SC Demo Component 014','airport',-24.0,'pcs','production','stock_card_demo',14,1,'2026-06-12 04:58:42.7187848',0.4922);
INSERT INTO InventoryMovements VALUES(28,'CMP-SCDEMO-014','SC Demo Component 014','airport',-8.0,'pcs','stock adjustment','stock_card_demo',14,1,'2026-06-25 06:58:42.7187848',0.4922);
INSERT INTO InventoryMovements VALUES(29,'CMP-SCDEMO-015','SC Demo Component 015','westend',-25.0,'kg','production','stock_card_demo',15,1,'2026-06-11 05:58:42.7187848',349.9);
INSERT INTO InventoryMovements VALUES(30,'CMP-SCDEMO-016','SC Demo Component 016','downtown',-26.0,'l','production','stock_card_demo',16,1,'2026-06-10 06:58:42.7187848',1784.7);
INSERT INTO InventoryMovements VALUES(31,'CMP-SCDEMO-017','SC Demo Component 017','midtown',-27.0,'pcs','production','stock_card_demo',17,1,'2026-06-09 07:58:42.7187848',1.883);
INSERT INTO InventoryMovements VALUES(32,'CMP-SCDEMO-018','SC Demo Component 018','airport',-28.0,'kg','production','stock_card_demo',18,1,'2026-06-08 08:58:42.7187848',529.9);
INSERT INTO InventoryMovements VALUES(33,'CMP-SCDEMO-019','SC Demo Component 019','westend',-29.0,'l','production','stock_card_demo',19,1,'2026-06-07 09:58:42.7187848',1392.7);
INSERT INTO InventoryMovements VALUES(34,'CMP-SCDEMO-020','SC Demo Component 020','downtown',-30.0,'pcs','production','stock_card_demo',20,1,'2026-06-26 10:58:42.7187848',1.9517);
INSERT INTO InventoryMovements VALUES(35,'CMP-SCDEMO-021','SC Demo Component 021','midtown',-31.0,'kg','production','stock_card_demo',21,1,'2026-06-25 11:58:42.7187848',732.0);
INSERT INTO InventoryMovements VALUES(36,'CMP-SCDEMO-021','SC Demo Component 021','midtown',-7.0,'kg','stock adjustment','stock_card_demo',21,1,'2026-06-26 03:58:42.7187848',732.0);
INSERT INTO InventoryMovements VALUES(37,'CMP-SCDEMO-022','SC Demo Component 022','airport',-32.0,'l','production','stock_card_demo',22,1,'2026-06-24 12:58:42.7187848',1476.4);
INSERT INTO InventoryMovements VALUES(38,'CMP-SCDEMO-023','SC Demo Component 023','westend',-33.0,'pcs','production','stock_card_demo',23,1,'2026-06-23 13:58:42.7187848',2.0131);
INSERT INTO InventoryMovements VALUES(39,'CMP-SCDEMO-024','SC Demo Component 024','downtown',-34.0,'kg','production','stock_card_demo',24,1,'2026-06-22 02:58:42.7187848',1399.1);
INSERT INTO InventoryMovements VALUES(40,'CMP-SCDEMO-025','SC Demo Component 025','midtown',-35.0,'l','production','stock_card_demo',25,1,'2026-06-21 03:58:42.7187848',1787.6);
INSERT INTO InventoryMovements VALUES(41,'CMP-SCDEMO-026','SC Demo Component 026','airport',-36.0,'pcs','production','stock_card_demo',26,1,'2026-06-20 04:58:42.7187848',1.3311);
INSERT INTO InventoryMovements VALUES(42,'CMP-SCDEMO-027','SC Demo Component 027','westend',-37.0,'kg','production','stock_card_demo',27,1,'2026-06-19 05:58:42.7187848',1643.2);
INSERT INTO InventoryMovements VALUES(43,'CMP-SCDEMO-028','SC Demo Component 028','downtown',-38.0,'l','production','stock_card_demo',28,1,'2026-06-18 06:58:42.7187848',134.3);
INSERT INTO InventoryMovements VALUES(44,'CMP-SCDEMO-028','SC Demo Component 028','downtown',-6.0,'l','stock adjustment','stock_card_demo',28,1,'2026-06-27 10:58:42.7187848',134.3);
INSERT INTO InventoryMovements VALUES(45,'CMP-SCDEMO-029','SC Demo Component 029','midtown',-39.0,'pcs','production','stock_card_demo',29,1,'2026-06-17 07:58:42.7187848',1.9368);
INSERT INTO InventoryMovements VALUES(46,'CMP-SCDEMO-030','SC Demo Component 030','airport',-40.0,'kg','production','stock_card_demo',30,1,'2026-06-16 08:58:42.7187848',1877.9);
INSERT INTO InventoryMovements VALUES(47,'CMP-SCDEMO-031','SC Demo Component 031','westend',-41.0,'l','production','stock_card_demo',31,1,'2026-06-15 09:58:42.7187848',628.1);
INSERT INTO InventoryMovements VALUES(48,'CMP-SCDEMO-032','SC Demo Component 032','downtown',-42.0,'pcs','production','stock_card_demo',32,1,'2026-06-14 10:58:42.7187848',0.1446);
INSERT INTO InventoryMovements VALUES(49,'CMP-SCDEMO-033','SC Demo Component 033','midtown',-43.0,'kg','production','stock_card_demo',33,1,'2026-06-13 11:58:42.7187848',379.9);
INSERT INTO InventoryMovements VALUES(50,'CMP-SCDEMO-034','SC Demo Component 034','airport',-44.0,'l','production','stock_card_demo',34,1,'2026-06-12 12:58:42.7187848',533.6);
INSERT INTO InventoryMovements VALUES(51,'CMP-SCDEMO-035','SC Demo Component 035','westend',-45.0,'pcs','production','stock_card_demo',35,1,'2026-06-11 13:58:42.7187848',0.1948);
INSERT INTO InventoryMovements VALUES(52,'CMP-SCDEMO-035','SC Demo Component 035','westend',-5.0,'pcs','stock adjustment','stock_card_demo',35,1,'2026-06-28 07:58:42.7187848',0.1948);
INSERT INTO InventoryMovements VALUES(53,'CMP-SCDEMO-036','SC Demo Component 036','downtown',-46.0,'kg','production','stock_card_demo',36,1,'2026-06-10 02:58:42.7187848',2017.6);
INSERT INTO InventoryMovements VALUES(54,'CMP-SCDEMO-037','SC Demo Component 037','midtown',-47.0,'l','production','stock_card_demo',37,1,'2026-06-09 03:58:42.7187848',1522.5);
INSERT INTO InventoryMovements VALUES(55,'CMP-SCDEMO-038','SC Demo Component 038','airport',-48.0,'pcs','production','stock_card_demo',38,1,'2026-06-08 04:58:42.7187848',1.8537);
INSERT INTO InventoryMovements VALUES(56,'CMP-SCDEMO-039','SC Demo Component 039','westend',-49.0,'kg','production','stock_card_demo',39,1,'2026-06-07 05:58:42.7187848',1546.4);
INSERT INTO InventoryMovements VALUES(57,'CMP-SCDEMO-040','SC Demo Component 040','downtown',-50.0,'l','production','stock_card_demo',40,1,'2026-06-26 06:58:42.7187848',1398.1);
INSERT INTO InventoryMovements VALUES(58,'CMP-SCDEMO-041','SC Demo Component 041','midtown',-51.0,'pcs','production','stock_card_demo',41,1,'2026-06-25 07:58:42.7187848',0.8446);
INSERT INTO InventoryMovements VALUES(59,'CMP-SCDEMO-042','SC Demo Component 042','airport',-52.0,'kg','production','stock_card_demo',42,1,'2026-06-24 08:58:42.7187848',191.6);
INSERT INTO InventoryMovements VALUES(60,'CMP-SCDEMO-042','SC Demo Component 042','airport',-4.0,'kg','stock adjustment','stock_card_demo',42,1,'2026-06-29 04:58:42.7187848',191.6);
INSERT INTO InventoryMovements VALUES(61,'CMP-SCDEMO-043','SC Demo Component 043','westend',-53.0,'l','production','stock_card_demo',43,1,'2026-06-23 09:58:42.7187848',801.1);
INSERT INTO InventoryMovements VALUES(62,'CMP-SCDEMO-044','SC Demo Component 044','downtown',-54.0,'pcs','production','stock_card_demo',44,1,'2026-06-22 10:58:42.7187848',0.6974);
INSERT INTO InventoryMovements VALUES(63,'CMP-SCDEMO-045','SC Demo Component 045','midtown',-55.0,'kg','production','stock_card_demo',45,1,'2026-06-21 11:58:42.7187848',176.0);
INSERT INTO InventoryMovements VALUES(64,'CMP-SCDEMO-046','SC Demo Component 046','airport',-56.0,'l','production','stock_card_demo',46,1,'2026-06-20 12:58:42.7187848',602.6);
INSERT INTO InventoryMovements VALUES(65,'CMP-SCDEMO-047','SC Demo Component 047','westend',-57.0,'pcs','production','stock_card_demo',47,1,'2026-06-19 13:58:42.7187848',1.0628);
INSERT INTO InventoryMovements VALUES(66,'CMP-SCDEMO-048','SC Demo Component 048','downtown',-58.0,'kg','production','stock_card_demo',48,1,'2026-06-18 02:58:42.7187848',1659.0);
INSERT INTO InventoryMovements VALUES(67,'CMP-SCDEMO-049','SC Demo Component 049','midtown',-59.0,'l','production','stock_card_demo',49,1,'2026-06-17 03:58:42.7187848',1923.6);
INSERT INTO InventoryMovements VALUES(68,'CMP-SCDEMO-049','SC Demo Component 049','midtown',-3.0,'l','stock adjustment','stock_card_demo',49,1,'2026-06-30 11:58:42.7187848',1923.6);
INSERT INTO InventoryMovements VALUES(69,'CMP-SCDEMO-050','SC Demo Component 050','airport',-60.0,'pcs','production','stock_card_demo',50,1,'2026-06-16 04:58:42.7187848',1.401);
INSERT INTO InventoryMovements VALUES(70,'CMP-SCDEMO-051','SC Demo Component 051','westend',-61.0,'kg','production','stock_card_demo',51,1,'2026-06-15 05:58:42.7187848',1478.3);
INSERT INTO InventoryMovements VALUES(71,'CMP-SCDEMO-052','SC Demo Component 052','downtown',-62.0,'l','production','stock_card_demo',52,1,'2026-06-14 06:58:42.7187848',942.8);
INSERT INTO InventoryMovements VALUES(72,'CMP-SCDEMO-053','SC Demo Component 053','midtown',-63.0,'pcs','production','stock_card_demo',53,1,'2026-06-13 07:58:42.7187848',0.3383);
INSERT INTO InventoryMovements VALUES(73,'CMP-SCDEMO-054','SC Demo Component 054','airport',-64.0,'kg','production','stock_card_demo',54,1,'2026-06-12 08:58:42.7187848',261.5);
INSERT INTO InventoryMovements VALUES(74,'CMP-SCDEMO-055','SC Demo Component 055','westend',-65.0,'l','production','stock_card_demo',55,1,'2026-06-11 09:58:42.7187848',727.5);
INSERT INTO InventoryMovements VALUES(75,'CMP-SCDEMO-056','SC Demo Component 056','downtown',-66.0,'pcs','production','stock_card_demo',56,1,'2026-06-10 10:58:42.7187848',1.0789);
INSERT INTO InventoryMovements VALUES(76,'CMP-SCDEMO-056','SC Demo Component 056','downtown',-2.0,'pcs','stock adjustment','stock_card_demo',56,1,'2026-07-01 08:58:42.7187848',1.0789);
INSERT INTO InventoryMovements VALUES(77,'CMP-SCDEMO-057','SC Demo Component 057','midtown',-67.0,'kg','production','stock_card_demo',57,1,'2026-06-09 11:58:42.7187848',305.7);
INSERT INTO InventoryMovements VALUES(78,'CMP-SCDEMO-058','SC Demo Component 058','airport',-68.0,'l','production','stock_card_demo',58,1,'2026-06-08 12:58:42.7187848',1743.8);
INSERT INTO InventoryMovements VALUES(79,'CMP-SCDEMO-059','SC Demo Component 059','westend',-69.0,'pcs','production','stock_card_demo',59,1,'2026-06-07 13:58:42.7187848',1.9806);
INSERT INTO InventoryMovements VALUES(80,'CMP-SCDEMO-060','SC Demo Component 060','downtown',-10.0,'kg','production','stock_card_demo',60,1,'2026-06-26 02:58:42.7187848',909.3);
INSERT INTO InventoryMovements VALUES(81,'CMP-SCDEMO-061','SC Demo Component 061','midtown',-11.0,'l','production','stock_card_demo',61,1,'2026-06-25 03:58:42.7187848',1950.9);
INSERT INTO InventoryMovements VALUES(82,'CMP-SCDEMO-062','SC Demo Component 062','airport',-12.0,'pcs','production','stock_card_demo',62,1,'2026-06-24 04:58:42.7187848',1.1173);
INSERT INTO InventoryMovements VALUES(83,'CMP-SCDEMO-063','SC Demo Component 063','westend',-13.0,'kg','production','stock_card_demo',63,1,'2026-06-23 05:58:42.7187848',1058.7);
INSERT INTO InventoryMovements VALUES(84,'CMP-SCDEMO-063','SC Demo Component 063','westend',-9.0,'kg','stock adjustment','stock_card_demo',63,1,'2026-06-24 05:58:42.7187848',1058.7);
INSERT INTO InventoryMovements VALUES(85,'CMP-SCDEMO-064','SC Demo Component 064','downtown',-14.0,'l','production','stock_card_demo',64,1,'2026-06-22 06:58:42.7187848',1127.5);
INSERT INTO InventoryMovements VALUES(86,'CMP-SCDEMO-065','SC Demo Component 065','midtown',-15.0,'pcs','production','stock_card_demo',65,1,'2026-06-21 07:58:42.7187848',1.8455);
INSERT INTO InventoryMovements VALUES(87,'CMP-SCDEMO-066','SC Demo Component 066','airport',-16.0,'kg','production','stock_card_demo',66,1,'2026-06-20 08:58:42.7187848',561.6);
INSERT INTO InventoryMovements VALUES(88,'CMP-SCDEMO-067','SC Demo Component 067','westend',-17.0,'l','production','stock_card_demo',67,1,'2026-06-19 09:58:42.7187848',1450.8);
INSERT INTO InventoryMovements VALUES(89,'CMP-SCDEMO-068','SC Demo Component 068','downtown',-18.0,'pcs','production','stock_card_demo',68,1,'2026-06-18 10:58:42.7187848',1.7658);
INSERT INTO InventoryMovements VALUES(90,'CMP-SCDEMO-069','SC Demo Component 069','midtown',-19.0,'kg','production','stock_card_demo',69,1,'2026-06-17 11:58:42.7187848',561.8);
INSERT INTO InventoryMovements VALUES(91,'CMP-SCDEMO-070','SC Demo Component 070','airport',-20.0,'l','production','stock_card_demo',70,1,'2026-06-16 12:58:42.7187848',1805.8);
INSERT INTO InventoryMovements VALUES(92,'CMP-SCDEMO-070','SC Demo Component 070','airport',-8.0,'l','stock adjustment','stock_card_demo',70,1,'2026-06-25 02:58:42.7187848',1805.8);
INSERT INTO InventoryMovements VALUES(93,'CMP-SCDEMO-071','SC Demo Component 071','westend',-21.0,'pcs','production','stock_card_demo',71,1,'2026-06-15 13:58:42.7187848',1.8892);
INSERT INTO InventoryMovements VALUES(94,'CMP-SCDEMO-072','SC Demo Component 072','downtown',-22.0,'kg','production','stock_card_demo',72,1,'2026-06-14 02:58:42.7187848',724.2);
INSERT INTO InventoryMovements VALUES(95,'CMP-SCDEMO-073','SC Demo Component 073','midtown',-23.0,'l','production','stock_card_demo',73,1,'2026-06-13 03:58:42.7187848',975.8);
INSERT INTO InventoryMovements VALUES(96,'CMP-SCDEMO-074','SC Demo Component 074','airport',-24.0,'pcs','production','stock_card_demo',74,1,'2026-06-12 04:58:42.7187848',1.5331);
INSERT INTO InventoryMovements VALUES(97,'CMP-SCDEMO-075','SC Demo Component 075','westend',-25.0,'kg','production','stock_card_demo',75,1,'2026-06-11 05:58:42.7187848',1769.5);
INSERT INTO InventoryMovements VALUES(98,'CMP-SCDEMO-076','SC Demo Component 076','downtown',-26.0,'l','production','stock_card_demo',76,1,'2026-06-10 06:58:42.7187848',729.3);
INSERT INTO InventoryMovements VALUES(99,'CMP-SCDEMO-077','SC Demo Component 077','midtown',-27.0,'pcs','production','stock_card_demo',77,1,'2026-06-09 07:58:42.7187848',1.0067);
INSERT INTO InventoryMovements VALUES(100,'CMP-SCDEMO-077','SC Demo Component 077','midtown',-7.0,'pcs','stock adjustment','stock_card_demo',77,1,'2026-06-26 09:58:42.7187848',1.0067);
INSERT INTO InventoryMovements VALUES(101,'CMP-SCDEMO-078','SC Demo Component 078','airport',-28.0,'kg','production','stock_card_demo',78,1,'2026-06-08 08:58:42.7187848',1563.9);
INSERT INTO InventoryMovements VALUES(102,'CMP-SCDEMO-079','SC Demo Component 079','westend',-29.0,'l','production','stock_card_demo',79,1,'2026-06-07 09:58:42.7187848',1138.4);
INSERT INTO InventoryMovements VALUES(103,'CMP-SCDEMO-080','SC Demo Component 080','downtown',-30.0,'pcs','production','stock_card_demo',80,1,'2026-06-26 10:58:42.7187848',1.2175);
INSERT INTO InventoryMovements VALUES(104,'CMP-SCDEMO-081','SC Demo Component 081','midtown',-31.0,'kg','production','stock_card_demo',81,1,'2026-06-25 11:58:42.7187848',163.4);
INSERT INTO InventoryMovements VALUES(105,'CMP-SCDEMO-082','SC Demo Component 082','airport',-32.0,'l','production','stock_card_demo',82,1,'2026-06-24 12:58:42.7187848',443.2);
INSERT INTO InventoryMovements VALUES(106,'CMP-SCDEMO-083','SC Demo Component 083','westend',-33.0,'pcs','production','stock_card_demo',83,1,'2026-06-23 13:58:42.7187848',1.2373);
INSERT INTO InventoryMovements VALUES(107,'CMP-SCDEMO-084','SC Demo Component 084','downtown',-34.0,'kg','production','stock_card_demo',84,1,'2026-06-22 02:58:42.7187848',1784.2);
INSERT INTO InventoryMovements VALUES(108,'CMP-SCDEMO-084','SC Demo Component 084','downtown',-6.0,'kg','stock adjustment','stock_card_demo',84,1,'2026-06-27 06:58:42.7187848',1784.2);
INSERT INTO InventoryMovements VALUES(109,'CMP-SCDEMO-085','SC Demo Component 085','midtown',-35.0,'l','production','stock_card_demo',85,1,'2026-06-21 03:58:42.7187848',1018.1);
INSERT INTO InventoryMovements VALUES(110,'CMP-SCDEMO-086','SC Demo Component 086','airport',-36.0,'pcs','production','stock_card_demo',86,1,'2026-06-20 04:58:42.7187848',0.7117);
INSERT INTO InventoryMovements VALUES(111,'CMP-SCDEMO-087','SC Demo Component 087','westend',-37.0,'kg','production','stock_card_demo',87,1,'2026-06-19 05:58:42.7187848',344.8);
INSERT INTO InventoryMovements VALUES(112,'CMP-SCDEMO-088','SC Demo Component 088','downtown',-38.0,'l','production','stock_card_demo',88,1,'2026-06-18 06:58:42.7187848',490.1);
INSERT INTO InventoryMovements VALUES(113,'CMP-SCDEMO-089','SC Demo Component 089','midtown',-39.0,'pcs','production','stock_card_demo',89,1,'2026-06-17 07:58:42.7187848',0.5076);
INSERT INTO InventoryMovements VALUES(114,'CMP-SCDEMO-090','SC Demo Component 090','airport',-40.0,'kg','production','stock_card_demo',90,1,'2026-06-16 08:58:42.7187848',1314.3);
INSERT INTO InventoryMovements VALUES(115,'CMP-SCDEMO-091','SC Demo Component 091','westend',-41.0,'l','production','stock_card_demo',91,1,'2026-06-15 09:58:42.7187848',795.6);
INSERT INTO InventoryMovements VALUES(116,'CMP-SCDEMO-091','SC Demo Component 091','westend',-5.0,'l','stock adjustment','stock_card_demo',91,1,'2026-06-28 03:58:42.7187848',795.6);
INSERT INTO InventoryMovements VALUES(117,'CMP-SCDEMO-092','SC Demo Component 092','downtown',-42.0,'pcs','production','stock_card_demo',92,1,'2026-06-14 10:58:42.7187848',0.3898);
INSERT INTO InventoryMovements VALUES(118,'CMP-SCDEMO-093','SC Demo Component 093','midtown',-43.0,'kg','production','stock_card_demo',93,1,'2026-06-13 11:58:42.7187848',564.6);
INSERT INTO InventoryMovements VALUES(119,'CMP-SCDEMO-094','SC Demo Component 094','airport',-44.0,'l','production','stock_card_demo',94,1,'2026-06-12 12:58:42.7187848',773.7);
INSERT INTO InventoryMovements VALUES(120,'CMP-SCDEMO-095','SC Demo Component 095','westend',-45.0,'pcs','production','stock_card_demo',95,1,'2026-06-11 13:58:42.7187848',0.4694);
INSERT INTO InventoryMovements VALUES(121,'CMP-SCDEMO-096','SC Demo Component 096','downtown',-46.0,'kg','production','stock_card_demo',96,1,'2026-06-10 02:58:42.7187848',1600.5);
INSERT INTO InventoryMovements VALUES(122,'CMP-SCDEMO-097','SC Demo Component 097','midtown',-47.0,'l','production','stock_card_demo',97,1,'2026-06-09 03:58:42.7187848',847.9);
INSERT INTO InventoryMovements VALUES(123,'CMP-SCDEMO-098','SC Demo Component 098','airport',-48.0,'pcs','production','stock_card_demo',98,1,'2026-06-08 04:58:42.7187848',1.4968);
INSERT INTO InventoryMovements VALUES(124,'CMP-SCDEMO-098','SC Demo Component 098','airport',-4.0,'pcs','stock adjustment','stock_card_demo',98,1,'2026-06-29 10:58:42.7187848',1.4968);
INSERT INTO InventoryMovements VALUES(125,'CMP-SCDEMO-099','SC Demo Component 099','westend',-49.0,'kg','production','stock_card_demo',99,1,'2026-06-07 05:58:42.7187848',115.6);
INSERT INTO InventoryMovements VALUES(126,'CMP-SCDEMO-100','SC Demo Component 100','downtown',-50.0,'l','production','stock_card_demo',100,1,'2026-06-26 06:58:42.7187848',1289.7);
INSERT INTO InventoryMovements VALUES(127,'CMP-SCDEMO-101','SC Demo Component 101','midtown',-51.0,'pcs','production','stock_card_demo',101,1,'2026-06-25 07:58:42.7187848',1.7333);
INSERT INTO InventoryMovements VALUES(128,'CMP-SCDEMO-102','SC Demo Component 102','airport',-52.0,'kg','production','stock_card_demo',102,1,'2026-06-24 08:58:42.7187848',1410.8);
INSERT INTO InventoryMovements VALUES(129,'CMP-SCDEMO-103','SC Demo Component 103','westend',-53.0,'l','production','stock_card_demo',103,1,'2026-06-23 09:58:42.7187848',1823.8);
INSERT INTO InventoryMovements VALUES(130,'CMP-SCDEMO-104','SC Demo Component 104','downtown',-54.0,'pcs','production','stock_card_demo',104,1,'2026-06-22 10:58:42.7187848',1.5783);
INSERT INTO InventoryMovements VALUES(131,'CMP-SCDEMO-105','SC Demo Component 105','midtown',-55.0,'kg','production','stock_card_demo',105,1,'2026-06-21 11:58:42.7187848',681.6);
INSERT INTO InventoryMovements VALUES(132,'CMP-SCDEMO-105','SC Demo Component 105','midtown',-3.0,'kg','stock adjustment','stock_card_demo',105,1,'2026-06-30 07:58:42.7187848',681.6);
INSERT INTO InventoryMovements VALUES(133,'CMP-SCDEMO-106','SC Demo Component 106','airport',-56.0,'l','production','stock_card_demo',106,1,'2026-06-20 12:58:42.7187848',1888.8);
INSERT INTO InventoryMovements VALUES(134,'CMP-SCDEMO-107','SC Demo Component 107','westend',-57.0,'pcs','production','stock_card_demo',107,1,'2026-06-19 13:58:42.7187848',1.4884);
INSERT INTO InventoryMovements VALUES(135,'CMP-SCDEMO-108','SC Demo Component 108','downtown',-58.0,'kg','production','stock_card_demo',108,1,'2026-06-18 02:58:42.7187848',1364.0);
INSERT INTO InventoryMovements VALUES(136,'CMP-SCDEMO-109','SC Demo Component 109','midtown',-59.0,'l','production','stock_card_demo',109,1,'2026-06-17 03:58:42.7187848',1862.5);
INSERT INTO InventoryMovements VALUES(137,'CMP-SCDEMO-110','SC Demo Component 110','airport',-60.0,'pcs','production','stock_card_demo',110,1,'2026-06-16 04:58:42.7187848',1.0191);
INSERT INTO InventoryMovements VALUES(138,'CMP-SCDEMO-111','SC Demo Component 111','westend',-61.0,'kg','production','stock_card_demo',111,1,'2026-06-15 05:58:42.7187848',674.7);
INSERT INTO InventoryMovements VALUES(139,'CMP-SCDEMO-112','SC Demo Component 112','downtown',-62.0,'l','production','stock_card_demo',112,1,'2026-06-14 06:58:42.7187848',1953.0);
INSERT INTO InventoryMovements VALUES(140,'CMP-SCDEMO-112','SC Demo Component 112','downtown',-2.0,'l','stock adjustment','stock_card_demo',112,1,'2026-07-01 04:58:42.7187848',1953.0);
INSERT INTO InventoryMovements VALUES(141,'CMP-SCDEMO-113','SC Demo Component 113','midtown',-63.0,'pcs','production','stock_card_demo',113,1,'2026-06-13 07:58:42.7187848',1.5544);
INSERT INTO InventoryMovements VALUES(142,'CMP-SCDEMO-114','SC Demo Component 114','airport',-64.0,'kg','production','stock_card_demo',114,1,'2026-06-12 08:58:42.7187848',1217.4);
INSERT INTO InventoryMovements VALUES(143,'CMP-SCDEMO-115','SC Demo Component 115','westend',-65.0,'l','production','stock_card_demo',115,1,'2026-06-11 09:58:42.7187848',1902.3);
INSERT INTO InventoryMovements VALUES(144,'CMP-SCDEMO-116','SC Demo Component 116','downtown',-66.0,'pcs','production','stock_card_demo',116,1,'2026-06-10 10:58:42.7187848',1.4264);
INSERT INTO InventoryMovements VALUES(145,'CMP-SCDEMO-117','SC Demo Component 117','midtown',-67.0,'kg','production','stock_card_demo',117,1,'2026-06-09 11:58:42.7187848',1450.6);
INSERT INTO InventoryMovements VALUES(146,'CMP-SCDEMO-118','SC Demo Component 118','airport',-68.0,'l','production','stock_card_demo',118,1,'2026-06-08 12:58:42.7187848',1957.8);
INSERT INTO InventoryMovements VALUES(147,'CMP-SCDEMO-119','SC Demo Component 119','westend',-69.0,'pcs','production','stock_card_demo',119,1,'2026-06-07 13:58:42.7187848',1.4378);
INSERT INTO InventoryMovements VALUES(148,'CMP-SCDEMO-119','SC Demo Component 119','westend',-9.0,'pcs','stock adjustment','stock_card_demo',119,1,'2026-06-24 11:58:42.7187848',1.4378);
INSERT INTO InventoryMovements VALUES(149,'CMP-SCDEMO-120','SC Demo Component 120','downtown',-10.0,'kg','production','stock_card_demo',120,1,'2026-06-26 02:58:42.7187848',1636.2);
INSERT INTO InventoryMovements VALUES(150,'CMP-SCDEMO-121','SC Demo Component 121','midtown',-11.0,'l','production','stock_card_demo',121,1,'2026-06-25 03:58:42.7187848',1210.2);
INSERT INTO InventoryMovements VALUES(151,'CMP-SCDEMO-122','SC Demo Component 122','airport',-12.0,'pcs','production','stock_card_demo',122,1,'2026-06-24 04:58:42.7187848',1.7475);
INSERT INTO InventoryMovements VALUES(152,'CMP-SCDEMO-123','SC Demo Component 123','westend',-13.0,'kg','production','stock_card_demo',123,1,'2026-06-23 05:58:42.7187848',1630.5);
INSERT INTO InventoryMovements VALUES(153,'CMP-SCDEMO-124','SC Demo Component 124','downtown',-14.0,'l','production','stock_card_demo',124,1,'2026-06-22 06:58:42.7187848',420.8);
INSERT INTO InventoryMovements VALUES(154,'CMP-SCDEMO-125','SC Demo Component 125','midtown',-15.0,'pcs','production','stock_card_demo',125,1,'2026-06-21 07:58:42.7187848',0.4322);
INSERT INTO InventoryMovements VALUES(155,'CMP-SCDEMO-126','SC Demo Component 126','airport',-16.0,'kg','production','stock_card_demo',126,1,'2026-06-20 08:58:42.7187848',1924.4);
INSERT INTO InventoryMovements VALUES(156,'CMP-SCDEMO-126','SC Demo Component 126','airport',-8.0,'kg','stock adjustment','stock_card_demo',126,1,'2026-06-25 08:58:42.7187848',1924.4);
INSERT INTO InventoryMovements VALUES(157,'CMP-SCDEMO-127','SC Demo Component 127','westend',-17.0,'l','production','stock_card_demo',127,1,'2026-06-19 09:58:42.7187848',271.4);
INSERT INTO InventoryMovements VALUES(158,'CMP-SCDEMO-128','SC Demo Component 128','downtown',-18.0,'pcs','production','stock_card_demo',128,1,'2026-06-18 10:58:42.7187848',1.0026);
INSERT INTO InventoryMovements VALUES(159,'CMP-SCDEMO-129','SC Demo Component 129','midtown',-19.0,'kg','production','stock_card_demo',129,1,'2026-06-17 11:58:42.7187848',1307.7);
INSERT INTO InventoryMovements VALUES(160,'CMP-SCDEMO-130','SC Demo Component 130','airport',-20.0,'l','production','stock_card_demo',130,1,'2026-06-16 12:58:42.7187848',1210.1);
INSERT INTO InventoryMovements VALUES(161,'CMP-SCDEMO-131','SC Demo Component 131','westend',-21.0,'pcs','production','stock_card_demo',131,1,'2026-06-15 13:58:42.7187848',1.5967);
INSERT INTO InventoryMovements VALUES(162,'CMP-SCDEMO-132','SC Demo Component 132','downtown',-22.0,'kg','production','stock_card_demo',132,1,'2026-06-14 02:58:42.7187848',1855.2);
INSERT INTO InventoryMovements VALUES(163,'CMP-SCDEMO-133','SC Demo Component 133','midtown',-23.0,'l','production','stock_card_demo',133,1,'2026-06-13 03:58:42.7187848',745.4);
INSERT INTO InventoryMovements VALUES(164,'CMP-SCDEMO-133','SC Demo Component 133','midtown',-7.0,'l','stock adjustment','stock_card_demo',133,1,'2026-06-26 05:58:42.7187848',745.4);
INSERT INTO InventoryMovements VALUES(165,'CMP-SCDEMO-134','SC Demo Component 134','airport',-24.0,'pcs','production','stock_card_demo',134,1,'2026-06-12 04:58:42.7187848',1.0975);
INSERT INTO InventoryMovements VALUES(166,'CMP-SCDEMO-135','SC Demo Component 135','westend',-25.0,'kg','production','stock_card_demo',135,1,'2026-06-11 05:58:42.7187848',1718.5);
INSERT INTO InventoryMovements VALUES(167,'CMP-SCDEMO-136','SC Demo Component 136','downtown',-26.0,'l','production','stock_card_demo',136,1,'2026-06-10 06:58:42.7187848',2027.0);
INSERT INTO InventoryMovements VALUES(168,'CMP-SCDEMO-137','SC Demo Component 137','midtown',-27.0,'pcs','production','stock_card_demo',137,1,'2026-06-09 07:58:42.7187848',1.4969);
INSERT INTO InventoryMovements VALUES(169,'CMP-SCDEMO-138','SC Demo Component 138','airport',-28.0,'kg','production','stock_card_demo',138,1,'2026-06-08 08:58:42.7187848',1388.6);
INSERT INTO InventoryMovements VALUES(170,'CMP-SCDEMO-139','SC Demo Component 139','westend',-29.0,'l','production','stock_card_demo',139,1,'2026-06-07 09:58:42.7187848',1757.6);
INSERT INTO InventoryMovements VALUES(171,'CMP-SCDEMO-140','SC Demo Component 140','downtown',-30.0,'pcs','production','stock_card_demo',140,1,'2026-06-26 10:58:42.7187848',2.0183);
INSERT INTO InventoryMovements VALUES(172,'CMP-SCDEMO-140','SC Demo Component 140','downtown',-6.0,'pcs','stock adjustment','stock_card_demo',140,1,'2026-06-27 02:58:42.7187848',2.0183);
INSERT INTO InventoryMovements VALUES(173,'CMP-SCDEMO-141','SC Demo Component 141','midtown',-31.0,'kg','production','stock_card_demo',141,1,'2026-06-25 11:58:42.7187848',531.8);
INSERT INTO InventoryMovements VALUES(174,'CMP-SCDEMO-142','SC Demo Component 142','airport',-32.0,'l','production','stock_card_demo',142,1,'2026-06-24 12:58:42.7187848',266.3);
INSERT INTO InventoryMovements VALUES(175,'CMP-SCDEMO-143','SC Demo Component 143','westend',-33.0,'pcs','production','stock_card_demo',143,1,'2026-06-23 13:58:42.7187848',0.9288);
INSERT INTO InventoryMovements VALUES(176,'CMP-SCDEMO-144','SC Demo Component 144','downtown',-34.0,'kg','production','stock_card_demo',144,1,'2026-06-22 02:58:42.7187848',1095.7);
INSERT INTO InventoryMovements VALUES(177,'CMP-SCDEMO-145','SC Demo Component 145','midtown',-35.0,'l','production','stock_card_demo',145,1,'2026-06-21 03:58:42.7187848',784.4);
INSERT INTO InventoryMovements VALUES(178,'CMP-SCDEMO-146','SC Demo Component 146','airport',-36.0,'pcs','production','stock_card_demo',146,1,'2026-06-20 04:58:42.7187848',0.3771);
INSERT INTO InventoryMovements VALUES(179,'CMP-SCDEMO-147','SC Demo Component 147','westend',-37.0,'kg','production','stock_card_demo',147,1,'2026-06-19 05:58:42.7187848',565.2);
INSERT INTO InventoryMovements VALUES(180,'CMP-SCDEMO-147','SC Demo Component 147','westend',-5.0,'kg','stock adjustment','stock_card_demo',147,1,'2026-06-28 09:58:42.7187848',565.2);
INSERT INTO InventoryMovements VALUES(181,'CMP-SCDEMO-148','SC Demo Component 148','downtown',-38.0,'l','production','stock_card_demo',148,1,'2026-06-18 06:58:42.7187848',303.9);
INSERT INTO InventoryMovements VALUES(182,'CMP-SCDEMO-149','SC Demo Component 149','midtown',-39.0,'pcs','production','stock_card_demo',149,1,'2026-06-17 07:58:42.7187848',1.311);
INSERT INTO InventoryMovements VALUES(183,'CMP-SCDEMO-150','SC Demo Component 150','airport',-40.0,'kg','production','stock_card_demo',150,1,'2026-06-16 08:58:42.7187848',1702.2);
INSERT INTO InventoryMovements VALUES(184,'CMP-SCDEMO-151','SC Demo Component 151','westend',-41.0,'l','production','stock_card_demo',151,1,'2026-06-15 09:58:42.7187848',105.0);
INSERT INTO InventoryMovements VALUES(185,'CMP-SCDEMO-152','SC Demo Component 152','downtown',-42.0,'pcs','production','stock_card_demo',152,1,'2026-06-14 10:58:42.7187848',1.6031);
INSERT INTO InventoryMovements VALUES(186,'CMP-SCDEMO-153','SC Demo Component 153','midtown',-43.0,'kg','production','stock_card_demo',153,1,'2026-06-13 11:58:42.7187848',155.0);
INSERT INTO InventoryMovements VALUES(187,'CMP-SCDEMO-154','SC Demo Component 154','airport',-44.0,'l','production','stock_card_demo',154,1,'2026-06-12 12:58:42.7187848',1635.6);
INSERT INTO InventoryMovements VALUES(188,'CMP-SCDEMO-154','SC Demo Component 154','airport',-4.0,'l','stock adjustment','stock_card_demo',154,1,'2026-06-29 06:58:42.7187848',1635.6);
INSERT INTO InventoryMovements VALUES(189,'CMP-SCDEMO-155','SC Demo Component 155','westend',-45.0,'pcs','production','stock_card_demo',155,1,'2026-06-11 13:58:42.7187848',1.4523);
INSERT INTO InventoryMovements VALUES(190,'CMP-SCDEMO-156','SC Demo Component 156','downtown',-46.0,'kg','production','stock_card_demo',156,1,'2026-06-10 02:58:42.7187848',620.6);
INSERT INTO InventoryMovements VALUES(191,'CMP-SCDEMO-157','SC Demo Component 157','midtown',-47.0,'l','production','stock_card_demo',157,1,'2026-06-09 03:58:42.7187848',1893.7);
INSERT INTO InventoryMovements VALUES(192,'CMP-SCDEMO-158','SC Demo Component 158','airport',-48.0,'pcs','production','stock_card_demo',158,1,'2026-06-08 04:58:42.7187848',0.4894);
INSERT INTO InventoryMovements VALUES(193,'CMP-SCDEMO-159','SC Demo Component 159','westend',-49.0,'kg','production','stock_card_demo',159,1,'2026-06-07 05:58:42.7187848',763.5);
INSERT INTO InventoryMovements VALUES(194,'CMP-SCDEMO-160','SC Demo Component 160','downtown',-50.0,'l','production','stock_card_demo',160,1,'2026-06-26 06:58:42.7187848',1049.5);
INSERT INTO InventoryMovements VALUES(195,'CMP-SCDEMO-161','SC Demo Component 161','midtown',-51.0,'pcs','production','stock_card_demo',161,1,'2026-06-25 07:58:42.7187848',1.576);
INSERT INTO InventoryMovements VALUES(196,'CMP-SCDEMO-161','SC Demo Component 161','midtown',-3.0,'pcs','stock adjustment','stock_card_demo',161,1,'2026-06-30 03:58:42.7187848',1.576);
INSERT INTO InventoryMovements VALUES(197,'CMP-SCDEMO-162','SC Demo Component 162','airport',-52.0,'kg','production','stock_card_demo',162,1,'2026-06-24 08:58:42.7187848',1067.0);
INSERT INTO InventoryMovements VALUES(198,'CMP-SCDEMO-163','SC Demo Component 163','westend',-53.0,'l','production','stock_card_demo',163,1,'2026-06-23 09:58:42.7187848',1452.0);
INSERT INTO InventoryMovements VALUES(199,'CMP-SCDEMO-164','SC Demo Component 164','downtown',-54.0,'pcs','production','stock_card_demo',164,1,'2026-06-22 10:58:42.7187848',1.672);
INSERT INTO InventoryMovements VALUES(200,'CMP-SCDEMO-165','SC Demo Component 165','midtown',-55.0,'kg','production','stock_card_demo',165,1,'2026-06-21 11:58:42.7187848',964.7);
INSERT INTO InventoryMovements VALUES(201,'CMP-SCDEMO-166','SC Demo Component 166','airport',-56.0,'l','production','stock_card_demo',166,1,'2026-06-20 12:58:42.7187848',347.5);
INSERT INTO InventoryMovements VALUES(202,'CMP-SCDEMO-167','SC Demo Component 167','westend',-57.0,'pcs','production','stock_card_demo',167,1,'2026-06-19 13:58:42.7187848',1.9533);
INSERT INTO InventoryMovements VALUES(203,'CMP-SCDEMO-168','SC Demo Component 168','downtown',-58.0,'kg','production','stock_card_demo',168,1,'2026-06-18 02:58:42.7187848',397.0);
INSERT INTO InventoryMovements VALUES(204,'CMP-SCDEMO-168','SC Demo Component 168','downtown',-2.0,'kg','stock adjustment','stock_card_demo',168,1,'2026-07-01 10:58:42.7187848',397.0);
INSERT INTO InventoryMovements VALUES(205,'CMP-SCDEMO-169','SC Demo Component 169','midtown',-59.0,'l','production','stock_card_demo',169,1,'2026-06-17 03:58:42.7187848',442.7);
INSERT INTO InventoryMovements VALUES(206,'CMP-SCDEMO-170','SC Demo Component 170','airport',-60.0,'pcs','production','stock_card_demo',170,1,'2026-06-16 04:58:42.7187848',1.7154);
INSERT INTO InventoryMovements VALUES(215,'CMP-SCFIFO-001','SC FIFO Demo Wagyu','downtown',10.0,'kg','Transfer in from Midtown','transfer_in',9001,1,'2026-06-14 14:16:19.5023319',41.0);
INSERT INTO InventoryMovements VALUES(216,'CMP-SCFIFO-001','SC FIFO Demo Wagyu','downtown',-35.0,'kg','Production ΓÇö Sub-product batch','production',9002,1,'2026-06-16 17:16:19.5023319',0.0);
INSERT INTO InventoryMovements VALUES(217,'CMP-SCFIFO-001','SC FIFO Demo Wagyu','downtown',-18.0,'kg','POS sales depletion','pos_sale',9003,1,'2026-06-22 23:16:19.5023319',0.0);
INSERT INTO InventoryMovements VALUES(218,'CMP-SCFIFO-001','SC FIFO Demo Wagyu','downtown',-5.0,'kg','Wastage ΓÇö spoilage','wastage',9004,1,'2026-07-01 13:16:19.5023319',0.0);
INSERT INTO InventoryMovements VALUES(219,'CMP-SCFIFO-001','SC FIFO Demo Wagyu','downtown',-8.0,'kg','Transfer out to Airport','transfer_out',9005,1,'2026-07-02 12:16:19.5023319',0.0);
INSERT INTO InventoryMovements VALUES(220,'CMP-SCFIFO-001','SC FIFO Demo Wagyu','downtown',-3.0,'kg','Inventory adjustment ΓÇö count short','inventory_adjustment',9006,1,'2026-07-03 19:16:19.5023319',0.0);
INSERT INTO InventoryMovements VALUES(221,'CMP-SCFIFO-001','SC FIFO Demo Wagyu','downtown',2.0,'kg','Inventory adjustment ΓÇö count found','inventory_adjustment',9007,1,'2026-07-04 14:16:19.5023319',0.0);
INSERT INTO InventoryMovements VALUES(222,'CMP-SCFIFO-001','SC FIFO Demo Wagyu','downtown',-12.0,'kg','POS sales depletion','pos_sale',9008,1,'2026-07-05 22:16:19.5023319',0.0);
CREATE TABLE IF NOT EXISTS "ProductProductionLogs" (

    "Id" INTEGER NOT NULL CONSTRAINT "PK_ProductProductionLogs" PRIMARY KEY AUTOINCREMENT,

    "ProductId" INTEGER NOT NULL,

    "EntryType" TEXT NOT NULL DEFAULT '',

    "Quantity" REAL NOT NULL DEFAULT 0,

    "ProductionDate" TEXT NOT NULL DEFAULT '',

    "LocationIdsJson" TEXT NOT NULL DEFAULT '[]',

    "CompanyId" INTEGER,

    "CreatedAt" TEXT NOT NULL, "ExpiryDate" TEXT NOT NULL DEFAULT '', "BatchNumber" TEXT NOT NULL DEFAULT '',

    CONSTRAINT "FK_ProductProductionLogs_Products_ProductId"

        FOREIGN KEY ("ProductId") REFERENCES "Products" ("Id") ON DELETE CASCADE

);
INSERT INTO ProductProductionLogs VALUES(1,1,'produced',1.0,'2026-07-03','["loc-1"]',1,'2026-07-03 03:37:06.6460268','2026-07-10','');
INSERT INTO ProductProductionLogs VALUES(2,2,'produced',1.0,'2026-07-03','["airport"]',1,'2026-07-03 04:12:33.8037132','2026-07-10','SUB-BURGER-001-B0004');
INSERT INTO ProductProductionLogs VALUES(3,2,'produced',1.0,'2026-07-03','["airport"]',1,'2026-07-03 04:17:04.4071352','2026-07-10','SUB-BURGER-001-B0004');
INSERT INTO ProductProductionLogs VALUES(4,2,'produced',2.0,'2026-07-03','["airport"]',1,'2026-07-03 08:46:42.9858738','2026-07-24','SUB-BURGER-001-B0003');
INSERT INTO ProductProductionLogs VALUES(5,3,'produced',31.0,'2026-06-03','["westend"]',1,'2026-06-14 02:58:42.7187848','2026-07-03','PRD-SCDEMO-001-B0001');
INSERT INTO ProductProductionLogs VALUES(6,4,'produced',32.0,'2026-06-02','["downtown"]',1,'2026-06-13 02:58:42.7187848','2026-07-02','PRD-SCDEMO-002-B0001');
INSERT INTO ProductProductionLogs VALUES(7,4,'produced',32.0,'2026-06-05','["airport"]',1,'2026-06-27 02:58:42.7187848','2026-06-19','PRD-SCDEMO-002-B0001-2');
INSERT INTO ProductProductionLogs VALUES(8,5,'produced',33.0,'2026-06-01','["midtown"]',1,'2026-06-12 02:58:42.7187848','2026-07-01','PRD-SCDEMO-003-B0001');
INSERT INTO ProductProductionLogs VALUES(9,6,'produced',34.0,'2026-05-31','["airport"]',1,'2026-06-11 02:58:42.7187848','2026-06-30','PRD-SCDEMO-004-B0001');
INSERT INTO ProductProductionLogs VALUES(10,7,'produced',35.0,'2026-06-24','["westend"]',1,'2026-06-10 02:58:42.7187848','2026-07-24','PRD-SCDEMO-005-B0001');
INSERT INTO ProductProductionLogs VALUES(11,8,'produced',36.0,'2026-06-23','["downtown"]',1,'2026-06-09 02:58:42.7187848','2026-07-23','PRD-SCDEMO-006-B0001');
INSERT INTO ProductProductionLogs VALUES(12,8,'produced',36.0,'2026-06-26','["airport"]',1,'2026-07-01 02:58:42.7187848','2026-07-10','PRD-SCDEMO-006-B0001-2');
INSERT INTO ProductProductionLogs VALUES(13,9,'produced',37.0,'2026-06-22','["midtown"]',1,'2026-06-08 02:58:42.7187848','2026-07-22','PRD-SCDEMO-007-B0001');
INSERT INTO ProductProductionLogs VALUES(14,10,'produced',38.0,'2026-06-21','["airport"]',1,'2026-06-07 02:58:42.7187848','2026-07-21','PRD-SCDEMO-008-B0001');
INSERT INTO ProductProductionLogs VALUES(15,11,'produced',39.0,'2026-06-20','["westend"]',1,'2026-06-06 02:58:42.7187848','2026-07-20','PRD-SCDEMO-009-B0001');
INSERT INTO ProductProductionLogs VALUES(16,12,'produced',40.0,'2026-06-19','["downtown"]',1,'2026-06-25 02:58:42.7187848','2026-07-19','PRD-SCDEMO-010-B0001');
INSERT INTO ProductProductionLogs VALUES(17,12,'produced',10.0,'2026-06-22','["airport"]',1,'2026-06-27 02:58:42.7187848','2026-07-06','PRD-SCDEMO-010-B0001-2');
INSERT INTO ProductProductionLogs VALUES(18,13,'produced',41.0,'2026-06-18','["midtown"]',1,'2026-06-24 02:58:42.7187848','2026-07-18','PRD-SCDEMO-011-B0001');
INSERT INTO ProductProductionLogs VALUES(19,14,'produced',42.0,'2026-06-17','["airport"]',1,'2026-06-23 02:58:42.7187848','2026-07-17','PRD-SCDEMO-012-B0001');
INSERT INTO ProductProductionLogs VALUES(20,15,'produced',43.0,'2026-06-16','["westend"]',1,'2026-06-22 02:58:42.7187848','2026-07-16','PRD-SCDEMO-013-B0001');
INSERT INTO ProductProductionLogs VALUES(21,16,'produced',44.0,'2026-06-15','["downtown"]',1,'2026-06-21 02:58:42.7187848','2026-07-15','PRD-SCDEMO-014-B0001');
INSERT INTO ProductProductionLogs VALUES(22,16,'produced',14.0,'2026-06-18','["airport"]',1,'2026-07-01 02:58:42.7187848','2026-07-02','PRD-SCDEMO-014-B0001-2');
INSERT INTO ProductProductionLogs VALUES(23,17,'produced',45.0,'2026-06-14','["midtown"]',1,'2026-06-20 02:58:42.7187848','2026-07-14','PRD-SCDEMO-015-B0001');
INSERT INTO ProductProductionLogs VALUES(24,18,'produced',46.0,'2026-06-13','["airport"]',1,'2026-06-19 02:58:42.7187848','2026-06-24','SUB-SCDEMO-001-B0001');
INSERT INTO ProductProductionLogs VALUES(25,19,'produced',47.0,'2026-06-12','["westend"]',1,'2026-06-18 02:58:42.7187848','2026-06-24','SUB-SCDEMO-002-B0001');
INSERT INTO ProductProductionLogs VALUES(26,20,'produced',48.0,'2026-06-11','["downtown"]',1,'2026-06-17 02:58:42.7187848','2026-06-24','SUB-SCDEMO-003-B0001');
INSERT INTO ProductProductionLogs VALUES(27,20,'produced',18.0,'2026-06-14','["airport"]',1,'2026-06-27 02:58:42.7187848','2026-06-28','SUB-SCDEMO-003-B0001-2');
INSERT INTO ProductProductionLogs VALUES(28,21,'produced',49.0,'2026-06-10','["midtown"]',1,'2026-06-16 02:58:42.7187848','2026-06-24','SUB-SCDEMO-004-B0001');
INSERT INTO ProductProductionLogs VALUES(29,22,'produced',50.0,'2026-06-09','["airport"]',1,'2026-06-15 02:58:42.7187848','2026-06-14','SUB-SCDEMO-005-B0001');
INSERT INTO ProductProductionLogs VALUES(30,23,'produced',51.0,'2026-06-08','["westend"]',1,'2026-06-14 02:58:42.7187848','2026-06-14','SUB-SCDEMO-006-B0001');
INSERT INTO ProductProductionLogs VALUES(31,24,'produced',52.0,'2026-06-07','["downtown"]',1,'2026-06-13 02:58:42.7187848','2026-06-14','SUB-SCDEMO-007-B0001');
INSERT INTO ProductProductionLogs VALUES(32,24,'produced',22.0,'2026-06-10','["airport"]',1,'2026-07-01 02:58:42.7187848','2026-06-24','SUB-SCDEMO-007-B0001-2');
INSERT INTO ProductProductionLogs VALUES(33,25,'produced',53.0,'2026-06-06','["midtown"]',1,'2026-06-12 02:58:42.7187848','2026-06-14','SUB-SCDEMO-008-B0001');
INSERT INTO ProductProductionLogs VALUES(34,26,'produced',54.0,'2026-06-05','["airport"]',1,'2026-06-11 02:58:42.7187848','2026-06-14','SUB-SCDEMO-009-B0001');
INSERT INTO ProductProductionLogs VALUES(35,27,'produced',55.0,'2026-06-04','["westend"]',1,'2026-06-10 02:58:42.7187848','2026-06-14','SUB-SCDEMO-010-B0001');
INSERT INTO ProductProductionLogs VALUES(36,28,'produced',56.0,'2026-06-03','["downtown"]',1,'2026-06-09 02:58:42.7187848','2026-06-14','SUB-SCDEMO-011-B0001');
INSERT INTO ProductProductionLogs VALUES(37,28,'produced',26.0,'2026-06-06','["airport"]',1,'2026-06-27 02:58:42.7187848','2026-06-20','SUB-SCDEMO-011-B0001-2');
INSERT INTO ProductProductionLogs VALUES(38,29,'produced',57.0,'2026-06-02','["midtown"]',1,'2026-06-08 02:58:42.7187848','2026-06-14','SUB-SCDEMO-012-B0001');
INSERT INTO ProductProductionLogs VALUES(39,30,'produced',58.0,'2026-06-01','["airport"]',1,'2026-06-07 02:58:42.7187848','2026-06-14','SUB-SCDEMO-013-B0001');
INSERT INTO ProductProductionLogs VALUES(40,31,'produced',59.0,'2026-05-31','["westend"]',1,'2026-06-06 02:58:42.7187848','2026-06-14','SUB-SCDEMO-014-B0001');
INSERT INTO ProductProductionLogs VALUES(41,32,'produced',60.0,'2026-06-24','["downtown"]',1,'2026-06-25 02:58:42.7187848','2026-06-29','SUB-SCDEMO-015-B0001');
INSERT INTO ProductProductionLogs VALUES(42,32,'produced',30.0,'2026-06-27','["airport"]',1,'2026-07-01 02:58:42.7187848','2026-07-11','SUB-SCDEMO-015-B0001-2');
PRAGMA writable_schema=ON;
CREATE TABLE IF NOT EXISTS sqlite_sequence(name,seq);
DELETE FROM sqlite_sequence;
INSERT INTO sqlite_sequence VALUES('DevelopmentMilestones',8);
INSERT INTO sqlite_sequence VALUES('Ingredients',209);
INSERT INTO sqlite_sequence VALUES('InventoryAlerts',3);
INSERT INTO sqlite_sequence VALUES('Locations',8);
INSERT INTO sqlite_sequence VALUES('MenuItems',5);
INSERT INTO sqlite_sequence VALUES('PurchaseOrders',27);
INSERT INTO sqlite_sequence VALUES('RevenueDataPoints',7);
INSERT INTO sqlite_sequence VALUES('Vendors',31);
INSERT INTO sqlite_sequence VALUES('PurchaseOrderItems',27);
INSERT INTO sqlite_sequence VALUES('AppUsers',35);
INSERT INTO sqlite_sequence VALUES('Companies',3);
INSERT INTO sqlite_sequence VALUES('EmployeeLevels',5);
INSERT INTO sqlite_sequence VALUES('Employees',36);
INSERT INTO sqlite_sequence VALUES('CompanySettings',1);
INSERT INTO sqlite_sequence VALUES('PublicHolidays',200);
INSERT INTO sqlite_sequence VALUES('Divisions',5);
INSERT INTO sqlite_sequence VALUES('Departments',10);
INSERT INTO sqlite_sequence VALUES('PayStructures',2);
INSERT INTO sqlite_sequence VALUES('ProvidentFundBrackets',3);
INSERT INTO sqlite_sequence VALUES('AttendanceRecords',110);
INSERT INTO sqlite_sequence VALUES('SocsoBrackets',5);
INSERT INTO sqlite_sequence VALUES('ShiftSchedules',50);
INSERT INTO sqlite_sequence VALUES('IncomeTaxYears',1);
INSERT INTO sqlite_sequence VALUES('IncomeTaxBrackets',11);
INSERT INTO sqlite_sequence VALUES('IncomeTaxReliefs',6);
INSERT INTO sqlite_sequence VALUES('InventoryPurchases',235);
INSERT INTO sqlite_sequence VALUES('CashPurchases',2);
INSERT INTO sqlite_sequence VALUES('OrderTemplates',2);
INSERT INTO sqlite_sequence VALUES('OrderTemplateItems',4);
INSERT INTO sqlite_sequence VALUES('Products',32);
INSERT INTO sqlite_sequence VALUES('ProductComponentItems',28);
INSERT INTO sqlite_sequence VALUES('ProductB2bLocationStocks',40);
INSERT INTO sqlite_sequence VALUES('ProductProductionLogs',42);
INSERT INTO sqlite_sequence VALUES('InventoryMovements',222);
CREATE UNIQUE INDEX "IX_Locations_ExternalId" ON "Locations" ("ExternalId");
CREATE INDEX "IX_PurchaseOrderItems_PurchaseOrderId" ON "PurchaseOrderItems" ("PurchaseOrderId");
CREATE UNIQUE INDEX "IX_PurchaseOrders_PoNumber" ON "PurchaseOrders" ("PoNumber");
CREATE UNIQUE INDEX "IX_Vendors_ExternalId" ON "Vendors" ("ExternalId");
CREATE UNIQUE INDEX "IX_Employees_EmployeeCode" ON "Employees" ("EmployeeCode");
CREATE UNIQUE INDEX "IX_Employees_Email" ON "Employees" ("Email");
CREATE UNIQUE INDEX "IX_EmployeeLevels_LevelName" ON "EmployeeLevels" ("LevelName");
CREATE UNIQUE INDEX IX_Divisions_Name ON Divisions(Name);
CREATE UNIQUE INDEX IX_Departments_DivisionId_Name ON Departments(DivisionId, Name);
CREATE UNIQUE INDEX "IX_AttendanceRecords_EmployeeId_Date" ON "AttendanceRecords" ("EmployeeId", "Date");
CREATE UNIQUE INDEX "IX_ShiftSchedules_EmployeeId_Date" ON "ShiftSchedules" ("EmployeeId", "Date");
CREATE UNIQUE INDEX "IX_PerformanceAppraisals_EmployeeId_Year" ON "PerformanceAppraisals" ("EmployeeId", "Year");
CREATE UNIQUE INDEX IX_PayrollRuns_CompanyId_Year_Month ON PayrollRuns(CompanyId, Year, Month);
CREATE UNIQUE INDEX IX_IncomeTaxYears_CompanyId_Year ON IncomeTaxYears(CompanyId, Year);
CREATE UNIQUE INDEX "IX_Ingredients_ComponentId" ON "Ingredients" ("ComponentId");
CREATE UNIQUE INDEX "IX_Ingredients_Name" ON "Ingredients" ("Name");
CREATE UNIQUE INDEX "IX_ProductB2bLocationStocks_ProductId_LocationExternalId"

ON "ProductB2bLocationStocks" ("ProductId", "LocationExternalId");
CREATE INDEX "IX_InventoryMovements_ComponentId_LocationExternalId"

ON "InventoryMovements" ("ComponentId", "LocationExternalId");
PRAGMA writable_schema=OFF;
COMMIT;
