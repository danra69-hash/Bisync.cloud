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
INSERT INTO Ingredients VALUES(36,'Spaghetti No. 5','Food','Dry Goods','g','kg','0.0','0.0','0.0',7,'["Dry Store"]',0,0,1,'["airport","downtown","midtown","westend"]','CMP-SPAGHE-001','','{"altRecipeUnits":[],"altInventoryUnits":[{"fromQty":"1","qty":"0.5","unit":"Tray"}],"convertFromInventoryQty":"1","convertToRecipeQty":"1000","taggedVendorProductIds":[],"vendorProductPrincipalQty":{},"vendorProductLossYield":{},"vendorProductComponentUom":{},"vendorProductLocations":{},"vendor":"","vendorProduct":"","deliveryUnitPrice":"0"}');
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
INSERT INTO Vendors VALUES(3,'V004','Wine & Spirits Direct','online','202201034567','Wine, Spirits, Beer','Kuala Lumpur','WP','Melissa Tan','+60 19-887 6543','melissa@winedirect.my','Online — Nationwide Delivery',1,'','[]');
INSERT INTO Vendors VALUES(4,'V005','Ocean Fresh Seafood','offline','201701023456','Seafood, Fresh Fish','Port Klang','Selangor','Haji Sulaiman','+60 13-456 7890','fresh@oceanfish.my','Lot 22, Jln Pelabuhan, Port Klang',1,'Sales Manager','[{"Name":"Haji Sulaiman","Position":"Sales Manager","Mobile":"\u002B60 13-456 7890","Email":"fresh@oceanfish.my","IsDefault":true}]');
INSERT INTO Vendors VALUES(5,'V003','Artisan Dairy Co.','offline','201601034321','Dairy, Cheese','Kuala Lumpur','WP','Sofia Lim','+60 18-901 2233','orders@artisandairy.my','45 Jalan Tun Razak, KL 50400',1,'Sales Executive','[{"Name":"Sofia Lim","Position":"Sales Executive","Mobile":"\u002B60 18-901 2233","Email":"orders@artisandairy.my","IsDefault":true}]');
INSERT INTO Vendors VALUES(6,'V006','Green Valley Produce','online','202001067890','Produce, Fresh Vegetables','Cameron Highlands','Pahang','Lee Wei Jie','+60 12-778 3344','sales@greenvalley.my','Online — Nationwide Delivery',1,'Account Manager','[{"name":"Lee Wei Jie","position":"Account Manager","mobile":"\u002B60 12-778 3344","email":"sales@greenvalley.my","isDefault":true}]');
INSERT INTO Vendors VALUES(7,'V007','Heritage Pantry Supply','offline','201901078901','Dry Goods, Canned Goods','Shah Alam','Selangor','Ravi Kumar','+60 17-234 5678','sales@heritagepantry.my','Lot 8, Jalan Stesen 19/7, Shah Alam 40300',1,'Sales Manager','[{"Name":"Ravi Kumar","Position":"Sales Manager","Mobile":"\u002B60 17-234 5678","Email":"sales@heritagepantry.my","IsDefault":true}]');
INSERT INTO Vendors VALUES(8,'V010','Bean Brothers Roasters','offline','202101011234','Coffee, Beverages','Petaling Jaya','Selangor','Marcus Tan','+60 16-445 6677','wholesale@beanbrothers.my','22 Jalan SS15, PJ 47500',0,'Sales Manager','[]');
INSERT INTO Vendors VALUES(9,'V011','Metro Canned Foods','offline','201801045678','Dry Goods, Canned Goods','Kuala Lumpur','WP','Nurul Izzati','+60 12-556 7890','orders@metrocanned.my','56 Jalan Ipoh, KL 51200',1,'Account Manager','[{"name":"Nurul Izzati","position":"Account Manager","mobile":"\u002B60 12-556 7890","email":"orders@metrocanned.my","isDefault":true}]');
INSERT INTO Vendors VALUES(10,'V012','Pacific Poultry Supply','offline','201501012345','Poultry, Duck','Kajang','Selangor','Tan Mei Ling','+60 12-111 2233','sales@pacificpoultry.my','Lot 5, Jalan Mewah, Kajang 43000',0,'Sales Manager','[]');
INSERT INTO Vendors VALUES(11,'V013','Harbour Fish Market','offline','201601023456','Seafood, Fresh Fish','Port Klang','Selangor','Captain Wong','+60 16-222 3344','orders@harbourfish.my','Pasar Besar, Port Klang 42000',0,'Account Manager','[]');
INSERT INTO Vendors VALUES(12,'V014','Valley Dairy Wholesale','offline','201701034567','Dairy, Cream, Butter','Seremban','Negeri Sembilan','Priya Nair','+60 17-333 4455','wholesale@valleydairy.my','12 Jalan Dairy, Seremban 70000',0,'Sales Executive','[]');
INSERT INTO Vendors VALUES(13,'V015','Mediterranean Oil Co.','offline','201801045678','Oils, Vinegars','Kuala Lumpur','WP','Marco Rossi','+60 18-444 5566','marco@medoil.my','88 Jalan Ampang, KL 50450',0,'Sales Manager','[]');
INSERT INTO Vendors VALUES(14,'V016','Spice Route Trading','offline','201901056789','Spices, Seasonings','Melaka','Melaka','Aisha Rahman','+60 19-555 6677','aisha@spiceroute.my','45 Jalan Hang Tuah, Melaka 75300',0,'Account Manager','[]');
INSERT INTO Vendors VALUES(15,'V017','Fresh Herb Gardens','online','202001067890','Herbs, Salad Leaves','Cameron Highlands','Pahang','David Choong','+60 12-666 7788','orders@freshherb.my','Online — Nationwide Delivery',0,'Sales Executive','[]');
INSERT INTO Vendors VALUES(16,'V018','Grain & Mill Co.','offline','202101078901','Rice, Flour, Grains','Shah Alam','Selangor','Hassan Ibrahim','+60 13-777 8899','sales@grainmill.my','Lot 3, Jalan Bukit Raja, Shah Alam 40000',0,'Sales Manager','[]');
INSERT INTO Vendors VALUES(17,'V019','Noodle House Supply','offline','202201089012','Pasta, Noodles','Petaling Jaya','Selangor','Lily Tan','+60 14-888 9900','lily@noodlehouse.my','18 Jalan SS2, PJ 47300',0,'Account Manager','[]');
INSERT INTO Vendors VALUES(18,'V020','Frozen Foods Express','offline','202301090123','Frozen Vegetables, Fries','Subang Jaya','Selangor','Kevin Lim','+60 15-999 0011','kevin@frozenexpress.my','7 Jalan SS15, Subang 47500',0,'Sales Executive','[]');
INSERT INTO Vendors VALUES(19,'V021','Juice Factory Direct','offline','202401101234','Juices, Purees','Kuala Lumpur','WP','Siti Aminah','+60 16-101 1122','orders@juicefactory.my','22 Jalan Tun Razak, KL 50400',0,'Sales Manager','[]');
INSERT INTO Vendors VALUES(20,'V022','Craft Brew Alliance','offline','202501112345','Craft Beer, Kegs','Petaling Jaya','Selangor','Jake Morrison','+60 17-202 2233','jake@craftbrew.my','5 Jalan Gasing, PJ 46000',0,'Account Manager','[]');
INSERT INTO Vendors VALUES(21,'V023','Tea & Tisane Co.','online','202601123456','Tea, Herbal Infusions','Ipoh','Perak','Mei Lin','+60 18-303 3344','sales@teatisane.my','Online — Nationwide Delivery',0,'Sales Executive','[]');
INSERT INTO Vendors VALUES(22,'V024','Syrup & Mixers Ltd','offline','202701134567','Syrups, Mixers, Tonic','Kuala Lumpur','WP','Raj Patel','+60 19-404 4455','raj@syrupmixers.my','33 Jalan Bukit Bintang, KL 55100',0,'Sales Manager','[]');
INSERT INTO Vendors VALUES(23,'V025','Plant Milk Wholesale','offline','202801145678','Oat Milk, Plant Milks','Shah Alam','Selangor','Emma Walsh','+60 12-505 5566','emma@plantmilk.my','9 Jalan Plumbum, Shah Alam 40300',0,'Account Manager','[]');
INSERT INTO Vendors VALUES(24,'V026','Butcher Block Prime','offline','202901156789','Lamb, Pork, Premium Meats','Kuala Lumpur','WP','Frankie Ho','+60 13-606 6677','frankie@butcherblock.my','101 Jalan Maarof, KL 59000',0,'Sales Manager','[]');
INSERT INTO Vendors VALUES(25,'V027','Organic Veg Hub','online','203001167890','Organic Produce','Cameron Highlands','Pahang','Nadia Yusof','+60 14-707 7788','nadia@organicveg.my','Online — Nationwide Delivery',0,'Sales Executive','[]');
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
INSERT INTO AppUsers VALUES(35,'DRA Super Admin','dra@cubevalue.com','Super Admin','+60 3-0000 0000',1,1,'[3,7,8,1,2,5,6,4]','{"modules":["RMS","POS","HRM","Accounting"],"rms":{"enabled":true,"tasks":{"viewOrder":true,"createEditOrder":true,"approveOrder":true,"receiveOrder":true,"consolidateOrder":true,"cashPurchase":true,"orderTemplate":true,"productManagement":true,"offlineSales":true,"batchStockAdjustment":true,"inventoryPost":true,"inventoryConfirmation":true,"inventoryAdjustment":true,"creditNote":true,"wastage":true,"transfer":true,"inventoryConfiguration":true,"createEdit":true,"activateDeactivateVendorProducts":true,"createEditComponentGroup":true,"createEditStorageAssignment":true,"accountMapping":true,"viewVendorList":true,"viewVendorProducts":true,"activateDeactivateVendor":true,"viewProductSubProduct":true,"manageProductSubProduct":true,"manageCustomers":true,"customerGroup":true,"manageSalesOrder":true,"manageInvoice":true,"promotionScheduler":true,"viewReports":true}},"superAdmin":true}',NULL,'v1:6HLcsouoGL134rcXuMXFIw==:4p5R2zShrOcZE+pv1VI8RugOE8dcUsgCM039RZi1i2I=');
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
PRAGMA writable_schema=ON;
CREATE TABLE IF NOT EXISTS sqlite_sequence(name,seq);
DELETE FROM sqlite_sequence;
INSERT INTO sqlite_sequence VALUES('DevelopmentMilestones',8);
INSERT INTO sqlite_sequence VALUES('Ingredients',36);
INSERT INTO sqlite_sequence VALUES('InventoryAlerts',3);
INSERT INTO sqlite_sequence VALUES('Locations',8);
INSERT INTO sqlite_sequence VALUES('MenuItems',5);
INSERT INTO sqlite_sequence VALUES('PurchaseOrders',24);
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
INSERT INTO sqlite_sequence VALUES('InventoryPurchases',3);
INSERT INTO sqlite_sequence VALUES('CashPurchases',2);
INSERT INTO sqlite_sequence VALUES('OrderTemplates',2);
INSERT INTO sqlite_sequence VALUES('OrderTemplateItems',4);
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
PRAGMA writable_schema=OFF;
COMMIT;
