--
-- PostgreSQL database dump
--

\restrict LUEyT7WfyMVmH89eTmwn6DCzilTgLhJMZ4VkA21SZLg9BfBDARrzSINIpDstP6d

-- Dumped from database version 16.14
-- Dumped by pg_dump version 18.4

SET lock_timeout = 0;
SET idle_in_transaction_session_timeout = 0;
SET client_encoding = 'UTF8';
SET standard_conforming_strings = on;
SELECT pg_catalog.set_config('search_path', '', false);
SET check_function_bodies = false;
SET xmloption = content;
SET client_min_messages = warning;
SET row_security = off;

ALTER TABLE IF EXISTS ONLY public."SocsoBrackets" DROP CONSTRAINT IF EXISTS "FK_SocsoBrackets_PayStructures_PayStructureId";
ALTER TABLE IF EXISTS ONLY public."ShiftSchedules" DROP CONSTRAINT IF EXISTS "FK_ShiftSchedules_Employees_EmployeeId";
ALTER TABLE IF EXISTS ONLY public."QuoteRequestVendors" DROP CONSTRAINT IF EXISTS "FK_QuoteRequestVendors_QuoteRequests_QuoteRequestId";
ALTER TABLE IF EXISTS ONLY public."QuoteRequestLines" DROP CONSTRAINT IF EXISTS "FK_QuoteRequestLines_QuoteRequests_QuoteRequestId";
ALTER TABLE IF EXISTS ONLY public."PurchaseOrderItems" DROP CONSTRAINT IF EXISTS "FK_PurchaseOrderItems_PurchaseOrders_PurchaseOrderId";
ALTER TABLE IF EXISTS ONLY public."ProvidentFundBrackets" DROP CONSTRAINT IF EXISTS "FK_ProvidentFundBrackets_PayStructures_PayStructureId";
ALTER TABLE IF EXISTS ONLY public."ProductProductionLogs" DROP CONSTRAINT IF EXISTS "FK_ProductProductionLogs_Products_ProductId";
ALTER TABLE IF EXISTS ONLY public."ProductPackagingItems" DROP CONSTRAINT IF EXISTS "FK_ProductPackagingItems_Products_ProductId";
ALTER TABLE IF EXISTS ONLY public."ProductComponentItems" DROP CONSTRAINT IF EXISTS "FK_ProductComponentItems_Products_ProductId";
ALTER TABLE IF EXISTS ONLY public."ProductB2bLocationStocks" DROP CONSTRAINT IF EXISTS "FK_ProductB2bLocationStocks_Products_ProductId";
ALTER TABLE IF EXISTS ONLY public."ProductAliases" DROP CONSTRAINT IF EXISTS "FK_ProductAliases_Products_ProductId";
ALTER TABLE IF EXISTS ONLY public."PreviousEmployments" DROP CONSTRAINT IF EXISTS "FK_PreviousEmployments_Employees_EmployeeId";
ALTER TABLE IF EXISTS ONLY public."PerformanceAppraisals" DROP CONSTRAINT IF EXISTS "FK_PerformanceAppraisals_Employees_EmployeeId";
ALTER TABLE IF EXISTS ONLY public."PayrollRuns" DROP CONSTRAINT IF EXISTS "FK_PayrollRuns_Companies_CompanyId";
ALTER TABLE IF EXISTS ONLY public."PayrollRunLines" DROP CONSTRAINT IF EXISTS "FK_PayrollRunLines_PayrollRuns_PayrollRunId";
ALTER TABLE IF EXISTS ONLY public."PayStructures" DROP CONSTRAINT IF EXISTS "FK_PayStructures_Companies_CompanyId";
ALTER TABLE IF EXISTS ONLY public."OrderTemplateItems" DROP CONSTRAINT IF EXISTS "FK_OrderTemplateItems_OrderTemplates_OrderTemplateId";
ALTER TABLE IF EXISTS ONLY public."MandatoryContributions" DROP CONSTRAINT IF EXISTS "FK_MandatoryContributions_PayStructures_PayStructureId";
ALTER TABLE IF EXISTS ONLY public."Locations" DROP CONSTRAINT IF EXISTS "FK_Locations_Companies_CompanyId";
ALTER TABLE IF EXISTS ONLY public."Locations" DROP CONSTRAINT IF EXISTS "FK_Locations_AppUsers_PrincipalContactUserId";
ALTER TABLE IF EXISTS ONLY public."LeaveRequests" DROP CONSTRAINT IF EXISTS "FK_LeaveRequests_Employees_EmployeeId";
ALTER TABLE IF EXISTS ONLY public."LeaveBalances" DROP CONSTRAINT IF EXISTS "FK_LeaveBalances_Employees_EmployeeId";
ALTER TABLE IF EXISTS ONLY public."InventoryCountSessionLines" DROP CONSTRAINT IF EXISTS "FK_InventoryCountSessionLines_InventoryCountSessions_SessionId";
ALTER TABLE IF EXISTS ONLY public."IncomeTaxYears" DROP CONSTRAINT IF EXISTS "FK_IncomeTaxYears_Companies_CompanyId";
ALTER TABLE IF EXISTS ONLY public."IncomeTaxReliefs" DROP CONSTRAINT IF EXISTS "FK_IncomeTaxReliefs_IncomeTaxYears_IncomeTaxYearId";
ALTER TABLE IF EXISTS ONLY public."IncomeTaxRebates" DROP CONSTRAINT IF EXISTS "FK_IncomeTaxRebates_IncomeTaxYears_IncomeTaxYearId";
ALTER TABLE IF EXISTS ONLY public."IncomeTaxBrackets" DROP CONSTRAINT IF EXISTS "FK_IncomeTaxBrackets_IncomeTaxYears_IncomeTaxYearId";
ALTER TABLE IF EXISTS ONLY public."Employees" DROP CONSTRAINT IF EXISTS "FK_Employees_Employees_ReportsToId";
ALTER TABLE IF EXISTS ONLY public."Employees" DROP CONSTRAINT IF EXISTS "FK_Employees_EmployeeLevels_EmployeeLevelId";
ALTER TABLE IF EXISTS ONLY public."Employees" DROP CONSTRAINT IF EXISTS "FK_Employees_Divisions_DivisionId";
ALTER TABLE IF EXISTS ONLY public."Employees" DROP CONSTRAINT IF EXISTS "FK_Employees_Departments_DepartmentId";
ALTER TABLE IF EXISTS ONLY public."EmployeeMovements" DROP CONSTRAINT IF EXISTS "FK_EmployeeMovements_Employees_EmployeeId";
ALTER TABLE IF EXISTS ONLY public."EducationRecords" DROP CONSTRAINT IF EXISTS "FK_EducationRecords_Employees_EmployeeId";
ALTER TABLE IF EXISTS ONLY public."Departments" DROP CONSTRAINT IF EXISTS "FK_Departments_Divisions_DivisionId";
ALTER TABLE IF EXISTS ONLY public."B2bSalesOrderLines" DROP CONSTRAINT IF EXISTS "FK_B2bSalesOrderLines_Products_ProductId";
ALTER TABLE IF EXISTS ONLY public."B2bSalesOrderLines" DROP CONSTRAINT IF EXISTS "FK_B2bSalesOrderLines_B2bSalesOrders_SalesOrderId";
ALTER TABLE IF EXISTS ONLY public."AttendanceRecords" DROP CONSTRAINT IF EXISTS "FK_AttendanceRecords_Employees_EmployeeId";
ALTER TABLE IF EXISTS ONLY public."AppUsers" DROP CONSTRAINT IF EXISTS "FK_AppUsers_Employees_EmployeeId";
ALTER TABLE IF EXISTS ONLY public."AppUsers" DROP CONSTRAINT IF EXISTS "FK_AppUsers_Companies_CompanyId";
DROP INDEX IF EXISTS public."IX_Vendors_ExternalId";
DROP INDEX IF EXISTS public."IX_VendorProducts_VendorExternalId";
DROP INDEX IF EXISTS public."IX_SocsoBrackets_PayStructureId";
DROP INDEX IF EXISTS public."IX_ShiftSchedules_EmployeeId_Date";
DROP INDEX IF EXISTS public."IX_RevMgmtCompanyConfigs_CompanyId_ConfigKey";
DROP INDEX IF EXISTS public."IX_QuoteRequests_CompanyId";
DROP INDEX IF EXISTS public."IX_QuoteRequestVendors_ShareToken";
DROP INDEX IF EXISTS public."IX_QuoteRequestVendors_QuoteRequestId";
DROP INDEX IF EXISTS public."IX_QuoteRequestLines_QuoteRequestId";
DROP INDEX IF EXISTS public."IX_PurchaseOrders_PoNumber";
DROP INDEX IF EXISTS public."IX_PurchaseOrderItems_PurchaseOrderId";
DROP INDEX IF EXISTS public."IX_PublicHolidays_Date";
DROP INDEX IF EXISTS public."IX_PublicHolidays_CountryCode_CatalogKey";
DROP INDEX IF EXISTS public."IX_ProvidentFundBrackets_PayStructureId";
DROP INDEX IF EXISTS public."IX_Products_ProductId";
DROP INDEX IF EXISTS public."IX_ProductProductionLogs_ProductId";
DROP INDEX IF EXISTS public."IX_ProductPackagingItems_ProductId";
DROP INDEX IF EXISTS public."IX_ProductComponentItems_ProductId";
DROP INDEX IF EXISTS public."IX_ProductB2bLocationStocks_ProductId_LocationExternalId";
DROP INDEX IF EXISTS public."IX_ProductAliases_ProductId";
DROP INDEX IF EXISTS public."IX_PreviousEmployments_EmployeeId";
DROP INDEX IF EXISTS public."IX_PosCustomers_ExternalId";
DROP INDEX IF EXISTS public."IX_PosCustomers_CompanyId";
DROP INDEX IF EXISTS public."IX_PerformanceAppraisals_EmployeeId_Year";
DROP INDEX IF EXISTS public."IX_PayrollRuns_CompanyId_Year_Month";
DROP INDEX IF EXISTS public."IX_PayrollRunLines_PayrollRunId";
DROP INDEX IF EXISTS public."IX_PayStructures_CompanyId";
DROP INDEX IF EXISTS public."IX_OrderTemplateItems_OrderTemplateId";
DROP INDEX IF EXISTS public."IX_MandatoryContributions_PayStructureId";
DROP INDEX IF EXISTS public."IX_Locations_PrincipalContactUserId";
DROP INDEX IF EXISTS public."IX_Locations_ExternalId";
DROP INDEX IF EXISTS public."IX_Locations_CompanyId";
DROP INDEX IF EXISTS public."IX_LeaveRequests_Status";
DROP INDEX IF EXISTS public."IX_LeaveRequests_EmployeeId";
DROP INDEX IF EXISTS public."IX_InventoryPurchases_PurchaseOrderItemId";
DROP INDEX IF EXISTS public."IX_InventoryMovements_ComponentId_LocationExternalId";
DROP INDEX IF EXISTS public."IX_InventoryCountSessions_Company_Type_Period";
DROP INDEX IF EXISTS public."IX_InventoryCountSessions_CompanyId_SessionType_PeriodMonth_St~";
DROP INDEX IF EXISTS public."IX_InventoryCountSessionLines_SessionId";
DROP INDEX IF EXISTS public."IX_Ingredients_Name";
DROP INDEX IF EXISTS public."IX_Ingredients_ComponentId";
DROP INDEX IF EXISTS public."IX_IncomeTaxYears_CompanyId_Year";
DROP INDEX IF EXISTS public."IX_IncomeTaxReliefs_IncomeTaxYearId";
DROP INDEX IF EXISTS public."IX_IncomeTaxRebates_IncomeTaxYearId";
DROP INDEX IF EXISTS public."IX_IncomeTaxBrackets_IncomeTaxYearId";
DROP INDEX IF EXISTS public."IX_Employees_ReportsToId";
DROP INDEX IF EXISTS public."IX_Employees_EmployeeLevelId";
DROP INDEX IF EXISTS public."IX_Employees_EmployeeCode";
DROP INDEX IF EXISTS public."IX_Employees_Email";
DROP INDEX IF EXISTS public."IX_Employees_DivisionId";
DROP INDEX IF EXISTS public."IX_Employees_DepartmentId";
DROP INDEX IF EXISTS public."IX_EmployeeMovements_EmployeeId";
DROP INDEX IF EXISTS public."IX_EmployeeLevels_LevelName";
DROP INDEX IF EXISTS public."IX_EducationRecords_EmployeeId";
DROP INDEX IF EXISTS public."IX_Divisions_Name";
DROP INDEX IF EXISTS public."IX_Departments_DivisionId_Name";
DROP INDEX IF EXISTS public."IX_B2bSalesOrders_CompanyId_Status";
DROP INDEX IF EXISTS public."IX_B2bCustomers_ExternalId";
DROP INDEX IF EXISTS public."IX_B2bCustomers_CompanyId";
DROP INDEX IF EXISTS public."IX_AttendanceRecords_EmployeeId_Date";
DROP INDEX IF EXISTS public."IX_AppUsers_EmployeeId";
DROP INDEX IF EXISTS public."IX_AppUsers_CompanyId";
ALTER TABLE IF EXISTS ONLY public."Vendors" DROP CONSTRAINT IF EXISTS "PK_Vendors";
ALTER TABLE IF EXISTS ONLY public."VendorProducts" DROP CONSTRAINT IF EXISTS "PK_VendorProducts";
ALTER TABLE IF EXISTS ONLY public."VendorProductPrices" DROP CONSTRAINT IF EXISTS "PK_VendorProductPrices";
ALTER TABLE IF EXISTS ONLY public."UserNotifications" DROP CONSTRAINT IF EXISTS "PK_UserNotifications";
ALTER TABLE IF EXISTS ONLY public."SocsoBrackets" DROP CONSTRAINT IF EXISTS "PK_SocsoBrackets";
ALTER TABLE IF EXISTS ONLY public."ShiftSchedules" DROP CONSTRAINT IF EXISTS "PK_ShiftSchedules";
ALTER TABLE IF EXISTS ONLY public."RevenueDataPoints" DROP CONSTRAINT IF EXISTS "PK_RevenueDataPoints";
ALTER TABLE IF EXISTS ONLY public."RevMgmtCompanyConfigs" DROP CONSTRAINT IF EXISTS "PK_RevMgmtCompanyConfigs";
ALTER TABLE IF EXISTS ONLY public."QuoteRequests" DROP CONSTRAINT IF EXISTS "PK_QuoteRequests";
ALTER TABLE IF EXISTS ONLY public."QuoteRequestVendors" DROP CONSTRAINT IF EXISTS "PK_QuoteRequestVendors";
ALTER TABLE IF EXISTS ONLY public."QuoteRequestLines" DROP CONSTRAINT IF EXISTS "PK_QuoteRequestLines";
ALTER TABLE IF EXISTS ONLY public."PurchaseOrders" DROP CONSTRAINT IF EXISTS "PK_PurchaseOrders";
ALTER TABLE IF EXISTS ONLY public."PurchaseOrderItems" DROP CONSTRAINT IF EXISTS "PK_PurchaseOrderItems";
ALTER TABLE IF EXISTS ONLY public."PublicHolidays" DROP CONSTRAINT IF EXISTS "PK_PublicHolidays";
ALTER TABLE IF EXISTS ONLY public."ProvidentFundBrackets" DROP CONSTRAINT IF EXISTS "PK_ProvidentFundBrackets";
ALTER TABLE IF EXISTS ONLY public."Products" DROP CONSTRAINT IF EXISTS "PK_Products";
ALTER TABLE IF EXISTS ONLY public."ProductProductionLogs" DROP CONSTRAINT IF EXISTS "PK_ProductProductionLogs";
ALTER TABLE IF EXISTS ONLY public."ProductPackagingItems" DROP CONSTRAINT IF EXISTS "PK_ProductPackagingItems";
ALTER TABLE IF EXISTS ONLY public."ProductComponentItems" DROP CONSTRAINT IF EXISTS "PK_ProductComponentItems";
ALTER TABLE IF EXISTS ONLY public."ProductB2bLocationStocks" DROP CONSTRAINT IF EXISTS "PK_ProductB2bLocationStocks";
ALTER TABLE IF EXISTS ONLY public."ProductAliases" DROP CONSTRAINT IF EXISTS "PK_ProductAliases";
ALTER TABLE IF EXISTS ONLY public."PreviousEmployments" DROP CONSTRAINT IF EXISTS "PK_PreviousEmployments";
ALTER TABLE IF EXISTS ONLY public."PosCustomers" DROP CONSTRAINT IF EXISTS "PK_PosCustomers";
ALTER TABLE IF EXISTS ONLY public."PerformanceAppraisals" DROP CONSTRAINT IF EXISTS "PK_PerformanceAppraisals";
ALTER TABLE IF EXISTS ONLY public."PayrollRuns" DROP CONSTRAINT IF EXISTS "PK_PayrollRuns";
ALTER TABLE IF EXISTS ONLY public."PayrollRunLines" DROP CONSTRAINT IF EXISTS "PK_PayrollRunLines";
ALTER TABLE IF EXISTS ONLY public."PayStructures" DROP CONSTRAINT IF EXISTS "PK_PayStructures";
ALTER TABLE IF EXISTS ONLY public."OrderTemplates" DROP CONSTRAINT IF EXISTS "PK_OrderTemplates";
ALTER TABLE IF EXISTS ONLY public."OrderTemplateItems" DROP CONSTRAINT IF EXISTS "PK_OrderTemplateItems";
ALTER TABLE IF EXISTS ONLY public."MenuItems" DROP CONSTRAINT IF EXISTS "PK_MenuItems";
ALTER TABLE IF EXISTS ONLY public."MandatoryContributions" DROP CONSTRAINT IF EXISTS "PK_MandatoryContributions";
ALTER TABLE IF EXISTS ONLY public."Locations" DROP CONSTRAINT IF EXISTS "PK_Locations";
ALTER TABLE IF EXISTS ONLY public."LeaveRequests" DROP CONSTRAINT IF EXISTS "PK_LeaveRequests";
ALTER TABLE IF EXISTS ONLY public."LeaveBalances" DROP CONSTRAINT IF EXISTS "PK_LeaveBalances";
ALTER TABLE IF EXISTS ONLY public."InventoryPurchases" DROP CONSTRAINT IF EXISTS "PK_InventoryPurchases";
ALTER TABLE IF EXISTS ONLY public."InventoryMovements" DROP CONSTRAINT IF EXISTS "PK_InventoryMovements";
ALTER TABLE IF EXISTS ONLY public."InventoryCountSessions" DROP CONSTRAINT IF EXISTS "PK_InventoryCountSessions";
ALTER TABLE IF EXISTS ONLY public."InventoryCountSessionLines" DROP CONSTRAINT IF EXISTS "PK_InventoryCountSessionLines";
ALTER TABLE IF EXISTS ONLY public."InventoryAlerts" DROP CONSTRAINT IF EXISTS "PK_InventoryAlerts";
ALTER TABLE IF EXISTS ONLY public."Ingredients" DROP CONSTRAINT IF EXISTS "PK_Ingredients";
ALTER TABLE IF EXISTS ONLY public."IncomeTaxYears" DROP CONSTRAINT IF EXISTS "PK_IncomeTaxYears";
ALTER TABLE IF EXISTS ONLY public."IncomeTaxReliefs" DROP CONSTRAINT IF EXISTS "PK_IncomeTaxReliefs";
ALTER TABLE IF EXISTS ONLY public."IncomeTaxRebates" DROP CONSTRAINT IF EXISTS "PK_IncomeTaxRebates";
ALTER TABLE IF EXISTS ONLY public."IncomeTaxBrackets" DROP CONSTRAINT IF EXISTS "PK_IncomeTaxBrackets";
ALTER TABLE IF EXISTS ONLY public."Employees" DROP CONSTRAINT IF EXISTS "PK_Employees";
ALTER TABLE IF EXISTS ONLY public."EmployeeMovements" DROP CONSTRAINT IF EXISTS "PK_EmployeeMovements";
ALTER TABLE IF EXISTS ONLY public."EmployeeLevels" DROP CONSTRAINT IF EXISTS "PK_EmployeeLevels";
ALTER TABLE IF EXISTS ONLY public."EducationRecords" DROP CONSTRAINT IF EXISTS "PK_EducationRecords";
ALTER TABLE IF EXISTS ONLY public."Divisions" DROP CONSTRAINT IF EXISTS "PK_Divisions";
ALTER TABLE IF EXISTS ONLY public."DevelopmentMilestones" DROP CONSTRAINT IF EXISTS "PK_DevelopmentMilestones";
ALTER TABLE IF EXISTS ONLY public."Departments" DROP CONSTRAINT IF EXISTS "PK_Departments";
ALTER TABLE IF EXISTS ONLY public."CompanySettings" DROP CONSTRAINT IF EXISTS "PK_CompanySettings";
ALTER TABLE IF EXISTS ONLY public."Companies" DROP CONSTRAINT IF EXISTS "PK_Companies";
ALTER TABLE IF EXISTS ONLY public."CashPurchases" DROP CONSTRAINT IF EXISTS "PK_CashPurchases";
ALTER TABLE IF EXISTS ONLY public."B2bSalesOrders" DROP CONSTRAINT IF EXISTS "PK_B2bSalesOrders";
ALTER TABLE IF EXISTS ONLY public."B2bSalesOrderLines" DROP CONSTRAINT IF EXISTS "PK_B2bSalesOrderLines";
ALTER TABLE IF EXISTS ONLY public."B2bCustomers" DROP CONSTRAINT IF EXISTS "PK_B2bCustomers";
ALTER TABLE IF EXISTS ONLY public."AttendanceRecords" DROP CONSTRAINT IF EXISTS "PK_AttendanceRecords";
ALTER TABLE IF EXISTS ONLY public."AppUsers" DROP CONSTRAINT IF EXISTS "PK_AppUsers";
ALTER TABLE IF EXISTS ONLY public."AccessControlSettings" DROP CONSTRAINT IF EXISTS "PK_AccessControlSettings";
DROP TABLE IF EXISTS public."Vendors";
DROP TABLE IF EXISTS public."VendorProducts";
DROP TABLE IF EXISTS public."VendorProductPrices";
DROP TABLE IF EXISTS public."UserNotifications";
DROP TABLE IF EXISTS public."SocsoBrackets";
DROP TABLE IF EXISTS public."ShiftSchedules";
DROP TABLE IF EXISTS public."RevenueDataPoints";
DROP TABLE IF EXISTS public."RevMgmtCompanyConfigs";
DROP TABLE IF EXISTS public."QuoteRequests";
DROP TABLE IF EXISTS public."QuoteRequestVendors";
DROP TABLE IF EXISTS public."QuoteRequestLines";
DROP TABLE IF EXISTS public."PurchaseOrders";
DROP TABLE IF EXISTS public."PurchaseOrderItems";
DROP TABLE IF EXISTS public."PublicHolidays";
DROP TABLE IF EXISTS public."ProvidentFundBrackets";
DROP TABLE IF EXISTS public."Products";
DROP TABLE IF EXISTS public."ProductProductionLogs";
DROP TABLE IF EXISTS public."ProductPackagingItems";
DROP TABLE IF EXISTS public."ProductComponentItems";
DROP TABLE IF EXISTS public."ProductB2bLocationStocks";
DROP TABLE IF EXISTS public."ProductAliases";
DROP TABLE IF EXISTS public."PreviousEmployments";
DROP TABLE IF EXISTS public."PosCustomers";
DROP TABLE IF EXISTS public."PerformanceAppraisals";
DROP TABLE IF EXISTS public."PayrollRuns";
DROP TABLE IF EXISTS public."PayrollRunLines";
DROP TABLE IF EXISTS public."PayStructures";
DROP TABLE IF EXISTS public."OrderTemplates";
DROP TABLE IF EXISTS public."OrderTemplateItems";
DROP TABLE IF EXISTS public."MenuItems";
DROP TABLE IF EXISTS public."MandatoryContributions";
DROP TABLE IF EXISTS public."Locations";
DROP TABLE IF EXISTS public."LeaveRequests";
DROP TABLE IF EXISTS public."LeaveBalances";
DROP TABLE IF EXISTS public."InventoryPurchases";
DROP TABLE IF EXISTS public."InventoryMovements";
DROP TABLE IF EXISTS public."InventoryCountSessions";
DROP TABLE IF EXISTS public."InventoryCountSessionLines";
DROP TABLE IF EXISTS public."InventoryAlerts";
DROP TABLE IF EXISTS public."Ingredients";
DROP TABLE IF EXISTS public."IncomeTaxYears";
DROP TABLE IF EXISTS public."IncomeTaxReliefs";
DROP TABLE IF EXISTS public."IncomeTaxRebates";
DROP TABLE IF EXISTS public."IncomeTaxBrackets";
DROP TABLE IF EXISTS public."Employees";
DROP TABLE IF EXISTS public."EmployeeMovements";
DROP TABLE IF EXISTS public."EmployeeLevels";
DROP TABLE IF EXISTS public."EducationRecords";
DROP TABLE IF EXISTS public."Divisions";
DROP TABLE IF EXISTS public."DevelopmentMilestones";
DROP TABLE IF EXISTS public."Departments";
DROP TABLE IF EXISTS public."CompanySettings";
DROP TABLE IF EXISTS public."Companies";
DROP TABLE IF EXISTS public."CashPurchases";
DROP TABLE IF EXISTS public."B2bSalesOrders";
DROP TABLE IF EXISTS public."B2bSalesOrderLines";
DROP TABLE IF EXISTS public."B2bCustomers";
DROP TABLE IF EXISTS public."AttendanceRecords";
DROP TABLE IF EXISTS public."AppUsers";
DROP TABLE IF EXISTS public."AccessControlSettings";
SET default_tablespace = '';

SET default_table_access_method = heap;

--
-- Name: AccessControlSettings; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public."AccessControlSettings" (
    "Id" integer NOT NULL,
    "TypesJson" text DEFAULT '[]'::text NOT NULL,
    "MatrixJson" text DEFAULT '{}'::text NOT NULL
);


--
-- Name: AppUsers; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public."AppUsers" (
    "Id" integer NOT NULL,
    "EmployeeId" integer,
    "FullName" character varying(200) NOT NULL,
    "Email" character varying(256) NOT NULL,
    "Role" character varying(100) NOT NULL,
    "Phone" character varying(30) NOT NULL,
    "Active" boolean NOT NULL,
    "AccessJson" text NOT NULL,
    "CompanyId" integer,
    "LocationIdsJson" text NOT NULL,
    "PasswordHash" text
);


--
-- Name: AppUsers_Id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

ALTER TABLE public."AppUsers" ALTER COLUMN "Id" ADD GENERATED BY DEFAULT AS IDENTITY (
    SEQUENCE NAME public."AppUsers_Id_seq"
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1
);


--
-- Name: AttendanceRecords; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public."AttendanceRecords" (
    "Id" integer NOT NULL,
    "EmployeeId" integer NOT NULL,
    "Date" date NOT NULL,
    "Status" character varying(20) NOT NULL,
    "ScheduledIn" time without time zone,
    "ScheduledOut" time without time zone,
    "ActualIn" time without time zone,
    "ActualOut" time without time zone,
    "RphAccruedDays" numeric(5,1) NOT NULL
);


--
-- Name: AttendanceRecords_Id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

ALTER TABLE public."AttendanceRecords" ALTER COLUMN "Id" ADD GENERATED BY DEFAULT AS IDENTITY (
    SEQUENCE NAME public."AttendanceRecords_Id_seq"
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1
);


--
-- Name: B2bCustomers; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public."B2bCustomers" (
    "Id" integer NOT NULL,
    "CompanyId" integer NOT NULL,
    "ExternalId" text NOT NULL,
    "CompanyName" text NOT NULL,
    "Brn" text NOT NULL,
    "Address" text NOT NULL,
    "City" text NOT NULL,
    "State" text NOT NULL,
    "Postcode" text NOT NULL,
    "Phone" text NOT NULL,
    "Fax" text NOT NULL,
    "Email" text NOT NULL,
    "ContactsJson" text DEFAULT '[]'::text NOT NULL,
    "TaggedProductIdsJson" text DEFAULT '[]'::text NOT NULL,
    "PurchaseHistoryJson" text DEFAULT '[]'::text NOT NULL,
    "Active" integer DEFAULT 1 NOT NULL,
    "TaggedProductAliasIdsJson" text DEFAULT '[]'::text NOT NULL,
    "TaggedB2bProductUnitsJson" text DEFAULT '[]'::text NOT NULL
);


--
-- Name: B2bCustomers_Id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

ALTER TABLE public."B2bCustomers" ALTER COLUMN "Id" ADD GENERATED BY DEFAULT AS IDENTITY (
    SEQUENCE NAME public."B2bCustomers_Id_seq"
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1
);


--
-- Name: B2bSalesOrderLines; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public."B2bSalesOrderLines" (
    "Id" integer NOT NULL,
    "SalesOrderId" integer NOT NULL,
    "ProductId" integer NOT NULL,
    "ProductName" text DEFAULT ''::text NOT NULL,
    "LocationExternalId" text DEFAULT ''::text NOT NULL,
    "QuantityOrdered" numeric DEFAULT 0 NOT NULL,
    "QuantityLocked" numeric DEFAULT 0 NOT NULL,
    "Uom" text DEFAULT ''::text NOT NULL,
    "Rrp" numeric DEFAULT 0 NOT NULL,
    "Status" text DEFAULT 'open'::text NOT NULL,
    "ProductAliasId" integer
);


--
-- Name: B2bSalesOrderLines_Id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

ALTER TABLE public."B2bSalesOrderLines" ALTER COLUMN "Id" ADD GENERATED BY DEFAULT AS IDENTITY (
    SEQUENCE NAME public."B2bSalesOrderLines_Id_seq"
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1
);


--
-- Name: B2bSalesOrders; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public."B2bSalesOrders" (
    "Id" integer NOT NULL,
    "CompanyId" integer NOT NULL,
    "OrderNumber" text DEFAULT ''::text NOT NULL,
    "CustomerExternalId" text DEFAULT ''::text NOT NULL,
    "CustomerName" text DEFAULT ''::text NOT NULL,
    "Source" text DEFAULT 'sales_order'::text NOT NULL,
    "Status" text DEFAULT 'draft'::text NOT NULL,
    "LockPeriodDays" integer DEFAULT 0 NOT NULL,
    "IssuedDate" text DEFAULT ''::text NOT NULL,
    "LockExpiryDate" text DEFAULT ''::text NOT NULL,
    "DeliveryOrderIssued" boolean DEFAULT false NOT NULL,
    "InvoiceIssued" boolean DEFAULT false NOT NULL,
    "FulfilledDate" text DEFAULT ''::text NOT NULL,
    "CreatedAt" timestamp with time zone NOT NULL,
    "UpdatedAt" timestamp with time zone NOT NULL
);


--
-- Name: B2bSalesOrders_Id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

ALTER TABLE public."B2bSalesOrders" ALTER COLUMN "Id" ADD GENERATED BY DEFAULT AS IDENTITY (
    SEQUENCE NAME public."B2bSalesOrders_Id_seq"
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1
);


--
-- Name: CashPurchases; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public."CashPurchases" (
    "Id" integer NOT NULL,
    "DatePurchased" date NOT NULL,
    "StoreName" text NOT NULL,
    "ComponentId" text NOT NULL,
    "ComponentName" text NOT NULL,
    "StoreProductName" text NOT NULL,
    "DeliveryUnit" text NOT NULL,
    "DeliveryPrice" numeric NOT NULL,
    "Quantity" numeric NOT NULL,
    "ComponentUom" text NOT NULL,
    "ReceiptNumber" text NOT NULL,
    "ReceiptFileName" text NOT NULL,
    "ReceiptFileBase64" text NOT NULL,
    "InventoryPurchaseId" integer NOT NULL,
    "CompanyId" integer,
    "LocationIdsJson" text NOT NULL,
    "CreatedAt" timestamp with time zone NOT NULL
);


--
-- Name: CashPurchases_Id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

ALTER TABLE public."CashPurchases" ALTER COLUMN "Id" ADD GENERATED BY DEFAULT AS IDENTITY (
    SEQUENCE NAME public."CashPurchases_Id_seq"
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1
);


--
-- Name: Companies; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public."Companies" (
    "Id" integer NOT NULL,
    "Name" text NOT NULL,
    "Brn" text NOT NULL,
    "GstTin" text NOT NULL,
    "CountryCode" text NOT NULL,
    "AddressLine1" text NOT NULL,
    "AddressLine2" text NOT NULL,
    "City" text NOT NULL,
    "StateProvince" text NOT NULL,
    "Postcode" text NOT NULL,
    "Phone" text NOT NULL,
    "Fax" text NOT NULL,
    "Email" text NOT NULL,
    "Active" boolean NOT NULL,
    "BusinessTypesJson" text DEFAULT '[]'::text NOT NULL,
    "VendorPolicyTagsJson" text DEFAULT '[]'::text NOT NULL,
    "ModulesJson" text DEFAULT '[]'::text NOT NULL
);


--
-- Name: Companies_Id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

ALTER TABLE public."Companies" ALTER COLUMN "Id" ADD GENERATED BY DEFAULT AS IDENTITY (
    SEQUENCE NAME public."Companies_Id_seq"
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1
);


--
-- Name: CompanySettings; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public."CompanySettings" (
    "Id" integer NOT NULL,
    "PublicHolidayPayMultiplier" numeric(4,2) NOT NULL,
    "ReplacementPublicHolidayEnabled" boolean NOT NULL,
    "OperatingCountryCode" character varying(2) NOT NULL,
    "GazettedPhReplacementDayEnabled" boolean NOT NULL,
    "GazettedPhNormalHoursRate" numeric(4,2) NOT NULL,
    "GazettedPhOvertimeHoursRate" numeric(4,2) NOT NULL,
    "NonGazettedPhReplacementDayEnabled" boolean NOT NULL
);


--
-- Name: CompanySettings_Id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

ALTER TABLE public."CompanySettings" ALTER COLUMN "Id" ADD GENERATED BY DEFAULT AS IDENTITY (
    SEQUENCE NAME public."CompanySettings_Id_seq"
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1
);


--
-- Name: Departments; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public."Departments" (
    "Id" integer NOT NULL,
    "Name" character varying(100) NOT NULL,
    "DivisionId" integer NOT NULL
);


--
-- Name: Departments_Id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

ALTER TABLE public."Departments" ALTER COLUMN "Id" ADD GENERATED BY DEFAULT AS IDENTITY (
    SEQUENCE NAME public."Departments_Id_seq"
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1
);


--
-- Name: DevelopmentMilestones; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public."DevelopmentMilestones" (
    "Id" integer NOT NULL,
    "Phase" text NOT NULL,
    "Title" text NOT NULL,
    "Status" text NOT NULL,
    "ProgressPercent" integer NOT NULL,
    "Notes" text,
    "UpdatedAt" timestamp with time zone NOT NULL
);


--
-- Name: DevelopmentMilestones_Id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

ALTER TABLE public."DevelopmentMilestones" ALTER COLUMN "Id" ADD GENERATED BY DEFAULT AS IDENTITY (
    SEQUENCE NAME public."DevelopmentMilestones_Id_seq"
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1
);


--
-- Name: Divisions; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public."Divisions" (
    "Id" integer NOT NULL,
    "Name" character varying(100) NOT NULL,
    "Code" character varying(20)
);


--
-- Name: Divisions_Id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

ALTER TABLE public."Divisions" ALTER COLUMN "Id" ADD GENERATED BY DEFAULT AS IDENTITY (
    SEQUENCE NAME public."Divisions_Id_seq"
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1
);


--
-- Name: EducationRecords; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public."EducationRecords" (
    "Id" integer NOT NULL,
    "EmployeeId" integer NOT NULL,
    "Degree" character varying(200) NOT NULL,
    "Institution" character varying(200) NOT NULL,
    "Year" character varying(10) NOT NULL,
    "Certificate" character varying(200) NOT NULL
);


--
-- Name: EducationRecords_Id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

ALTER TABLE public."EducationRecords" ALTER COLUMN "Id" ADD GENERATED BY DEFAULT AS IDENTITY (
    SEQUENCE NAME public."EducationRecords_Id_seq"
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1
);


--
-- Name: EmployeeLevels; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public."EmployeeLevels" (
    "Id" integer NOT NULL,
    "LevelName" character varying(100) NOT NULL,
    "AnnualLeaveDays" integer NOT NULL,
    "SickLeaveDays" integer NOT NULL,
    "OvertimeEligible" boolean NOT NULL,
    "WorkingHoursPerDay" numeric(4,2) NOT NULL,
    "BreakHoursPerShift" numeric(4,2) NOT NULL,
    "PublicHolidayEligible" boolean NOT NULL,
    "IsShift" boolean NOT NULL,
    "ShiftType" character varying(100),
    "Active" boolean NOT NULL
);


--
-- Name: EmployeeLevels_Id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

ALTER TABLE public."EmployeeLevels" ALTER COLUMN "Id" ADD GENERATED BY DEFAULT AS IDENTITY (
    SEQUENCE NAME public."EmployeeLevels_Id_seq"
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1
);


--
-- Name: EmployeeMovements; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public."EmployeeMovements" (
    "Id" integer NOT NULL,
    "EmployeeId" integer NOT NULL,
    "Date" date NOT NULL,
    "FromPosition" character varying(100) NOT NULL,
    "ToPosition" character varying(100) NOT NULL,
    "Type" character varying(20) NOT NULL,
    "Department" character varying(100) NOT NULL
);


--
-- Name: EmployeeMovements_Id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

ALTER TABLE public."EmployeeMovements" ALTER COLUMN "Id" ADD GENERATED BY DEFAULT AS IDENTITY (
    SEQUENCE NAME public."EmployeeMovements_Id_seq"
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1
);


--
-- Name: Employees; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public."Employees" (
    "Id" integer NOT NULL,
    "EmployeeCode" character varying(20) NOT NULL,
    "Name" character varying(200) NOT NULL,
    "Email" character varying(256) NOT NULL,
    "Mobile" character varying(30) NOT NULL,
    "Department" character varying(100) NOT NULL,
    "DivisionId" integer,
    "DepartmentId" integer,
    "Position" character varying(100) NOT NULL,
    "JoinDate" date NOT NULL,
    "FingerprintEnrolled" boolean NOT NULL,
    "FaceRecognitionEnrolled" boolean NOT NULL,
    "IsShiftEmployee" boolean NOT NULL,
    "ShiftType" character varying(100),
    "PosEnabled" boolean NOT NULL,
    "PosPin" character varying(10),
    "PosPinMustChange" boolean NOT NULL,
    "PayrollPin" character varying(6),
    "PayrollPinMustChange" boolean NOT NULL,
    "BisyncEnabled" boolean NOT NULL,
    "Active" boolean NOT NULL,
    "CheckinMethod" character varying(20) NOT NULL,
    "WorkingHoursPerDay" numeric(4,2) NOT NULL,
    "EmployeeLevelId" integer,
    "ReportsToId" integer,
    "Nationality" character varying(100),
    "IdPassportNumber" character varying(50),
    "DateOfBirth" date,
    "PersonalEmail" character varying(256),
    "PermanentAddress" character varying(500),
    "MaritalStatus" text,
    "BankName" character varying(100),
    "BankAccountNumber" character varying(30),
    "BankAccountHolderName" character varying(200),
    "BaseSalary" numeric(12,2),
    "ServiceAllowance" numeric(12,2),
    "TransportAllowance" numeric(12,2),
    "AccommodationAllowance" numeric(12,2),
    "MobileAllowance" numeric(12,2),
    "OtherAllowancesJson" text NOT NULL,
    "WorkPermitByCompany" boolean,
    "TransportProvided" boolean NOT NULL,
    "TransportCarModel" character varying(100),
    "TransportPlateNumber" character varying(20),
    "AccommodationProvided" boolean NOT NULL,
    "AccommodationAddress" character varying(500),
    "AccommodationLeaseStart" date,
    "AccommodationLeaseEnd" date,
    "MobileProvided" boolean NOT NULL,
    "MobileAllowancePhone" character varying(30),
    "MobileProvider" character varying(50),
    "OvertimeAllowanceEnabled" boolean NOT NULL,
    "BonusEnabled" boolean NOT NULL,
    "BonusMonthly" boolean NOT NULL,
    "BonusAnnually" boolean NOT NULL,
    "BonusAmount" numeric(12,2),
    "BonusByBasicSalary" boolean NOT NULL,
    "BonusByService" boolean NOT NULL,
    "AccommodationLeasingPeriod" text
);


--
-- Name: Employees_Id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

ALTER TABLE public."Employees" ALTER COLUMN "Id" ADD GENERATED BY DEFAULT AS IDENTITY (
    SEQUENCE NAME public."Employees_Id_seq"
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1
);


--
-- Name: IncomeTaxBrackets; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public."IncomeTaxBrackets" (
    "Id" integer NOT NULL,
    "IncomeTaxYearId" integer NOT NULL,
    "SortOrder" integer NOT NULL,
    "MinAnnualChargeableIncome" numeric(14,2) NOT NULL,
    "MaxAnnualChargeableIncome" numeric(14,2),
    "RatePct" numeric(5,2) NOT NULL,
    "BaseMinTaxAmount" numeric(14,2) NOT NULL
);


--
-- Name: IncomeTaxBrackets_Id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

ALTER TABLE public."IncomeTaxBrackets" ALTER COLUMN "Id" ADD GENERATED BY DEFAULT AS IDENTITY (
    SEQUENCE NAME public."IncomeTaxBrackets_Id_seq"
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1
);


--
-- Name: IncomeTaxRebates; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public."IncomeTaxRebates" (
    "Id" integer NOT NULL,
    "IncomeTaxYearId" integer NOT NULL,
    "SortOrder" integer NOT NULL,
    "Name" character varying(200) NOT NULL,
    "Amount" numeric(14,2) NOT NULL
);


--
-- Name: IncomeTaxRebates_Id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

ALTER TABLE public."IncomeTaxRebates" ALTER COLUMN "Id" ADD GENERATED BY DEFAULT AS IDENTITY (
    SEQUENCE NAME public."IncomeTaxRebates_Id_seq"
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1
);


--
-- Name: IncomeTaxReliefs; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public."IncomeTaxReliefs" (
    "Id" integer NOT NULL,
    "IncomeTaxYearId" integer NOT NULL,
    "SortOrder" integer NOT NULL,
    "Name" character varying(200) NOT NULL,
    "Amount" numeric(14,2) NOT NULL,
    "IsMaximum" boolean NOT NULL,
    "ApplyCondition" character varying(50)
);


--
-- Name: IncomeTaxReliefs_Id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

ALTER TABLE public."IncomeTaxReliefs" ALTER COLUMN "Id" ADD GENERATED BY DEFAULT AS IDENTITY (
    SEQUENCE NAME public."IncomeTaxReliefs_Id_seq"
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1
);


--
-- Name: IncomeTaxYears; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public."IncomeTaxYears" (
    "Id" integer NOT NULL,
    "CompanyId" integer NOT NULL,
    "Year" integer NOT NULL,
    "CountryCode" character varying(2) NOT NULL,
    "Active" boolean NOT NULL
);


--
-- Name: IncomeTaxYears_Id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

ALTER TABLE public."IncomeTaxYears" ALTER COLUMN "Id" ADD GENERATED BY DEFAULT AS IDENTITY (
    SEQUENCE NAME public."IncomeTaxYears_Id_seq"
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1
);


--
-- Name: Ingredients; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public."Ingredients" (
    "Id" integer NOT NULL,
    "ComponentId" character varying(32) NOT NULL,
    "Name" character varying(200) NOT NULL,
    "Category" text NOT NULL,
    "Group" text NOT NULL,
    "RecipeUom" text NOT NULL,
    "InventoryUom" text NOT NULL,
    "LastPriceRecipe" numeric NOT NULL,
    "LastPriceInventory" numeric NOT NULL,
    "DailyUsage" numeric NOT NULL,
    "OrderFreqDays" integer NOT NULL,
    "StorageJson" text NOT NULL,
    "StorageNote" text NOT NULL,
    "DetailConfigJson" text NOT NULL,
    "AttachedProducts" integer NOT NULL,
    "AttachedVendors" integer NOT NULL,
    "Active" boolean NOT NULL,
    "LocationsJson" text NOT NULL,
    "CreatedAt" timestamp without time zone DEFAULT now() NOT NULL,
    "UpdatedAt" timestamp without time zone DEFAULT now() NOT NULL
);


--
-- Name: Ingredients_Id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

ALTER TABLE public."Ingredients" ALTER COLUMN "Id" ADD GENERATED BY DEFAULT AS IDENTITY (
    SEQUENCE NAME public."Ingredients_Id_seq"
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1
);


--
-- Name: InventoryAlerts; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public."InventoryAlerts" (
    "Id" integer NOT NULL,
    "ItemName" text NOT NULL,
    "Stock" text NOT NULL,
    "Status" text NOT NULL,
    "Threshold" text NOT NULL
);


--
-- Name: InventoryAlerts_Id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

ALTER TABLE public."InventoryAlerts" ALTER COLUMN "Id" ADD GENERATED BY DEFAULT AS IDENTITY (
    SEQUENCE NAME public."InventoryAlerts_Id_seq"
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1
);


--
-- Name: InventoryCountSessionLines; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public."InventoryCountSessionLines" (
    "Id" integer NOT NULL,
    "SessionId" integer NOT NULL,
    "ItemType" text NOT NULL,
    "ItemKey" text NOT NULL,
    "ItemName" text NOT NULL,
    "GroupName" text NOT NULL,
    "Uom" text NOT NULL,
    "SystemQty" numeric NOT NULL,
    "CountedQty" numeric,
    "VarianceQty" numeric,
    "SystemUnitPrice" numeric
);


--
-- Name: InventoryCountSessionLines_Id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

ALTER TABLE public."InventoryCountSessionLines" ALTER COLUMN "Id" ADD GENERATED BY DEFAULT AS IDENTITY (
    SEQUENCE NAME public."InventoryCountSessionLines_Id_seq"
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1
);


--
-- Name: InventoryCountSessions; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public."InventoryCountSessions" (
    "Id" integer NOT NULL,
    "SessionType" text NOT NULL,
    "Status" text NOT NULL,
    "CompanyId" integer,
    "LocationIdsJson" text NOT NULL,
    "PeriodMonth" text NOT NULL,
    "UomMode" text NOT NULL,
    "ItemTypeFilter" text NOT NULL,
    "GroupFilter" text NOT NULL,
    "CountDate" text NOT NULL,
    "EffectiveDate" text NOT NULL,
    "AdjustmentsAppliedAt" timestamp with time zone,
    "SavedAt" timestamp with time zone NOT NULL,
    "SavedBy" text NOT NULL,
    "ConfirmDeadlineAt" timestamp with time zone,
    "ConfirmedAt" timestamp with time zone,
    "ConfirmedBy" text NOT NULL,
    "IsAutoConfirmed" boolean NOT NULL,
    "CreatedAt" timestamp with time zone NOT NULL,
    "UpdatedAt" timestamp with time zone NOT NULL
);


--
-- Name: InventoryCountSessions_Id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

ALTER TABLE public."InventoryCountSessions" ALTER COLUMN "Id" ADD GENERATED BY DEFAULT AS IDENTITY (
    SEQUENCE NAME public."InventoryCountSessions_Id_seq"
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1
);


--
-- Name: InventoryMovements; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public."InventoryMovements" (
    "Id" integer NOT NULL,
    "ComponentId" text NOT NULL,
    "ComponentName" text NOT NULL,
    "LocationExternalId" text NOT NULL,
    "QtyDelta" numeric NOT NULL,
    "Uom" text NOT NULL,
    "Reason" text NOT NULL,
    "ReferenceType" text NOT NULL,
    "ReferenceId" integer NOT NULL,
    "CompanyId" integer,
    "UnitPrice" numeric NOT NULL,
    "CreatedAt" timestamp with time zone NOT NULL
);


--
-- Name: InventoryMovements_Id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

ALTER TABLE public."InventoryMovements" ALTER COLUMN "Id" ADD GENERATED BY DEFAULT AS IDENTITY (
    SEQUENCE NAME public."InventoryMovements_Id_seq"
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1
);


--
-- Name: InventoryPurchases; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public."InventoryPurchases" (
    "Id" integer NOT NULL,
    "ComponentId" text NOT NULL,
    "ComponentName" text NOT NULL,
    "Quantity" numeric NOT NULL,
    "Uom" text NOT NULL,
    "UnitPrice" numeric NOT NULL,
    "DateOrdered" date NOT NULL,
    "DateCreatedInStock" timestamp with time zone NOT NULL,
    "PurchaseOrderId" integer NOT NULL,
    "PurchaseOrderItemId" integer NOT NULL,
    "CompanyId" integer,
    "LocationIdsJson" text NOT NULL
);


--
-- Name: InventoryPurchases_Id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

ALTER TABLE public."InventoryPurchases" ALTER COLUMN "Id" ADD GENERATED BY DEFAULT AS IDENTITY (
    SEQUENCE NAME public."InventoryPurchases_Id_seq"
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1
);


--
-- Name: LeaveBalances; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public."LeaveBalances" (
    "EmployeeId" integer NOT NULL,
    "RdoBalance" numeric(5,1) NOT NULL,
    "RphBalance" numeric(5,1) NOT NULL,
    "AlBalance" numeric(5,1) NOT NULL
);


--
-- Name: LeaveRequests; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public."LeaveRequests" (
    "Id" integer NOT NULL,
    "EmployeeId" integer NOT NULL,
    "Type" character varying(10) NOT NULL,
    "StartDate" date NOT NULL,
    "EndDate" date NOT NULL,
    "Status" character varying(20) NOT NULL,
    "Reason" character varying(1000)
);


--
-- Name: LeaveRequests_Id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

ALTER TABLE public."LeaveRequests" ALTER COLUMN "Id" ADD GENERATED BY DEFAULT AS IDENTITY (
    SEQUENCE NAME public."LeaveRequests_Id_seq"
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1
);


--
-- Name: Locations; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public."Locations" (
    "Id" integer NOT NULL,
    "ExternalId" text NOT NULL,
    "Name" text NOT NULL,
    "Address" text NOT NULL,
    "CompanyId" integer,
    "AddressLine1" text NOT NULL,
    "AddressLine2" text NOT NULL,
    "City" text NOT NULL,
    "StateProvince" text NOT NULL,
    "Postcode" text NOT NULL,
    "PrincipalContactUserId" integer,
    "SalesToday" numeric NOT NULL,
    "SalesWtd" numeric NOT NULL,
    "SalesMtd" numeric NOT NULL,
    "SalesYtd" numeric NOT NULL,
    "SalesPrevToday" numeric NOT NULL,
    "SalesPrevWtd" numeric NOT NULL,
    "SalesPrevMtd" numeric NOT NULL,
    "SalesPrevYtd" numeric NOT NULL,
    "CoversToday" integer NOT NULL,
    "CoversWtd" integer NOT NULL,
    "CoversMtd" integer NOT NULL,
    "CoversYtd" integer NOT NULL,
    "CoversPrevToday" integer NOT NULL,
    "CoversPrevWtd" integer NOT NULL,
    "CoversPrevMtd" integer NOT NULL,
    "CoversPrevYtd" integer NOT NULL,
    "ChecksToday" integer NOT NULL,
    "ChecksWtd" integer NOT NULL,
    "ChecksMtd" integer NOT NULL,
    "ChecksYtd" integer NOT NULL,
    "ChecksPrevToday" integer NOT NULL,
    "ChecksPrevWtd" integer NOT NULL,
    "ChecksPrevMtd" integer NOT NULL,
    "ChecksPrevYtd" integer NOT NULL,
    "BusinessTypesJson" text DEFAULT '[]'::text NOT NULL,
    "VendorPolicyTagsJson" text DEFAULT '[]'::text NOT NULL,
    "ModulesJson" text DEFAULT '[]'::text NOT NULL
);


--
-- Name: Locations_Id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

ALTER TABLE public."Locations" ALTER COLUMN "Id" ADD GENERATED BY DEFAULT AS IDENTITY (
    SEQUENCE NAME public."Locations_Id_seq"
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1
);


--
-- Name: MandatoryContributions; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public."MandatoryContributions" (
    "Id" integer NOT NULL,
    "PayStructureId" integer NOT NULL,
    "Name" character varying(100) NOT NULL,
    "EmployerPct" numeric NOT NULL,
    "EmployeePct" numeric NOT NULL
);


--
-- Name: MandatoryContributions_Id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

ALTER TABLE public."MandatoryContributions" ALTER COLUMN "Id" ADD GENERATED BY DEFAULT AS IDENTITY (
    SEQUENCE NAME public."MandatoryContributions_Id_seq"
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1
);


--
-- Name: MenuItems; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public."MenuItems" (
    "Id" integer NOT NULL,
    "Name" text NOT NULL,
    "Category" text NOT NULL,
    "Orders" integer NOT NULL,
    "Revenue" numeric NOT NULL,
    "MarginPercent" integer NOT NULL
);


--
-- Name: MenuItems_Id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

ALTER TABLE public."MenuItems" ALTER COLUMN "Id" ADD GENERATED BY DEFAULT AS IDENTITY (
    SEQUENCE NAME public."MenuItems_Id_seq"
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1
);


--
-- Name: OrderTemplateItems; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public."OrderTemplateItems" (
    "Id" integer NOT NULL,
    "OrderTemplateId" integer NOT NULL,
    "ComponentId" text NOT NULL,
    "ComponentName" text NOT NULL,
    "VendorProductId" text NOT NULL,
    "VendorExternalId" text NOT NULL,
    "VendorName" text NOT NULL,
    "ProductName" text NOT NULL,
    "Quantity" numeric NOT NULL,
    "ComponentUom" text NOT NULL,
    "DeliveryUnit" text NOT NULL,
    "SortOrder" integer NOT NULL
);


--
-- Name: OrderTemplateItems_Id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

ALTER TABLE public."OrderTemplateItems" ALTER COLUMN "Id" ADD GENERATED BY DEFAULT AS IDENTITY (
    SEQUENCE NAME public."OrderTemplateItems_Id_seq"
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1
);


--
-- Name: OrderTemplates; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public."OrderTemplates" (
    "Id" integer NOT NULL,
    "Name" text NOT NULL,
    "VendorExternalId" text NOT NULL,
    "VendorName" text NOT NULL,
    "ScheduleMode" text NOT NULL,
    "WeekdaysJson" text NOT NULL,
    "MonthDaysJson" text NOT NULL,
    "RepeatEnabled" boolean NOT NULL,
    "CompanyId" integer,
    "LocationIdsJson" text NOT NULL,
    "CreatedAt" timestamp with time zone NOT NULL,
    "UpdatedAt" timestamp with time zone NOT NULL
);


--
-- Name: OrderTemplates_Id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

ALTER TABLE public."OrderTemplates" ALTER COLUMN "Id" ADD GENERATED BY DEFAULT AS IDENTITY (
    SEQUENCE NAME public."OrderTemplates_Id_seq"
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1
);


--
-- Name: PayStructures; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public."PayStructures" (
    "Id" integer NOT NULL,
    "CompanyId" integer NOT NULL,
    "CountryCode" character varying(2) NOT NULL,
    "PayType" character varying(50) NOT NULL,
    "PayCycle" character varying(50) NOT NULL,
    "ProvidentFundEmployerPct" numeric NOT NULL,
    "ProvidentFundEmployeePct" numeric NOT NULL,
    "ForeignProvidentFundEmployerPct" numeric NOT NULL,
    "ForeignProvidentFundEmployeePct" numeric NOT NULL,
    "ForeignSocsoEmployerPct" numeric NOT NULL,
    "OvertimeRateMultiplier" numeric(4,2) NOT NULL,
    "OvertimeCalculationMode" character varying(20) NOT NULL,
    "OvertimeFixedHourlyRate" numeric(12,2),
    "Active" boolean NOT NULL
);


--
-- Name: PayStructures_Id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

ALTER TABLE public."PayStructures" ALTER COLUMN "Id" ADD GENERATED BY DEFAULT AS IDENTITY (
    SEQUENCE NAME public."PayStructures_Id_seq"
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1
);


--
-- Name: PayrollRunLines; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public."PayrollRunLines" (
    "Id" integer NOT NULL,
    "PayrollRunId" integer NOT NULL,
    "EmployeeId" integer NOT NULL,
    "EmployeeCode" character varying(20) NOT NULL,
    "EmployeeName" character varying(200) NOT NULL,
    "Department" character varying(100) NOT NULL,
    "Position" character varying(100) NOT NULL,
    "PresentDays" numeric NOT NULL,
    "WorkingDays" numeric NOT NULL,
    "TotalHours" numeric NOT NULL,
    "OvertimeHours" numeric NOT NULL,
    "AttendanceRatio" numeric NOT NULL,
    "BaseSalary" numeric NOT NULL,
    "ServiceAllowance" numeric NOT NULL,
    "AccommodationAllowance" numeric NOT NULL,
    "TransportAllowance" numeric NOT NULL,
    "MobileAllowance" numeric NOT NULL,
    "BonusAmount" numeric NOT NULL,
    "OvertimeAmount" numeric NOT NULL,
    "EpfEmployeeAmount" numeric NOT NULL,
    "EpfEmployerAmount" numeric NOT NULL,
    "SocsoEmployeeAmount" numeric NOT NULL,
    "SocsoEmployerAmount" numeric NOT NULL,
    "IncomeTaxAmount" numeric NOT NULL,
    "GrossPay" numeric NOT NULL,
    "TotalPayout" numeric NOT NULL
);


--
-- Name: PayrollRunLines_Id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

ALTER TABLE public."PayrollRunLines" ALTER COLUMN "Id" ADD GENERATED BY DEFAULT AS IDENTITY (
    SEQUENCE NAME public."PayrollRunLines_Id_seq"
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1
);


--
-- Name: PayrollRuns; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public."PayrollRuns" (
    "Id" integer NOT NULL,
    "CompanyId" integer NOT NULL,
    "Year" integer NOT NULL,
    "Month" integer NOT NULL,
    "PayCycle" character varying(50) NOT NULL,
    "PayType" character varying(50) NOT NULL,
    "CountryCode" character varying(2) NOT NULL,
    "PeriodLabel" character varying(120) NOT NULL,
    "PeriodStart" date NOT NULL,
    "PeriodEnd" date NOT NULL,
    "ProcessedAt" timestamp with time zone NOT NULL,
    "TotalGross" numeric NOT NULL,
    "TotalPayout" numeric NOT NULL,
    "EmployeeCount" integer NOT NULL
);


--
-- Name: PayrollRuns_Id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

ALTER TABLE public."PayrollRuns" ALTER COLUMN "Id" ADD GENERATED BY DEFAULT AS IDENTITY (
    SEQUENCE NAME public."PayrollRuns_Id_seq"
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1
);


--
-- Name: PerformanceAppraisals; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public."PerformanceAppraisals" (
    "Id" integer NOT NULL,
    "EmployeeId" integer NOT NULL,
    "Year" character varying(10) NOT NULL,
    "Rating" character varying(50) NOT NULL,
    "Score" numeric(3,1) NOT NULL,
    "Reviewer" character varying(200) NOT NULL,
    "Comments" character varying(2000)
);


--
-- Name: PerformanceAppraisals_Id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

ALTER TABLE public."PerformanceAppraisals" ALTER COLUMN "Id" ADD GENERATED BY DEFAULT AS IDENTITY (
    SEQUENCE NAME public."PerformanceAppraisals_Id_seq"
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1
);


--
-- Name: PosCustomers; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public."PosCustomers" (
    "Id" integer NOT NULL,
    "CompanyId" integer NOT NULL,
    "ExternalId" text NOT NULL,
    "Name" text NOT NULL,
    "Address" text NOT NULL,
    "City" text NOT NULL,
    "State" text NOT NULL,
    "Postcode" text NOT NULL,
    "Phone" text NOT NULL,
    "Fax" text NOT NULL,
    "Email" text NOT NULL,
    "LoyaltySummaryJson" text DEFAULT '[]'::text NOT NULL,
    "CouponSummaryJson" text DEFAULT '[]'::text NOT NULL,
    "ActivityHistoryJson" text DEFAULT '[]'::text NOT NULL,
    "Active" integer DEFAULT 1 NOT NULL
);


--
-- Name: PosCustomers_Id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

ALTER TABLE public."PosCustomers" ALTER COLUMN "Id" ADD GENERATED BY DEFAULT AS IDENTITY (
    SEQUENCE NAME public."PosCustomers_Id_seq"
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1
);


--
-- Name: PreviousEmployments; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public."PreviousEmployments" (
    "Id" integer NOT NULL,
    "EmployeeId" integer NOT NULL,
    "CompanyName" character varying(200) NOT NULL,
    "Position" character varying(100) NOT NULL,
    "StartYear" character varying(10) NOT NULL,
    "EndYear" character varying(10) NOT NULL,
    "YearsOfService" numeric(4,1) NOT NULL
);


--
-- Name: PreviousEmployments_Id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

ALTER TABLE public."PreviousEmployments" ALTER COLUMN "Id" ADD GENERATED BY DEFAULT AS IDENTITY (
    SEQUENCE NAME public."PreviousEmployments_Id_seq"
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1
);


--
-- Name: ProductAliases; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public."ProductAliases" (
    "Id" integer NOT NULL,
    "ProductId" integer NOT NULL,
    "Name" text NOT NULL,
    "Rrp" numeric NOT NULL,
    "SortOrder" integer NOT NULL,
    "B2bSalesConfigJson" text DEFAULT '{}'::text NOT NULL
);


--
-- Name: ProductAliases_Id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

ALTER TABLE public."ProductAliases" ALTER COLUMN "Id" ADD GENERATED BY DEFAULT AS IDENTITY (
    SEQUENCE NAME public."ProductAliases_Id_seq"
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1
);


--
-- Name: ProductB2bLocationStocks; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public."ProductB2bLocationStocks" (
    "Id" integer NOT NULL,
    "ProductId" integer NOT NULL,
    "LocationExternalId" text NOT NULL,
    "InStock" numeric NOT NULL,
    "SalesPerDay" numeric NOT NULL,
    "ToProduceQty" numeric NOT NULL,
    "ProducedQty" numeric NOT NULL,
    "ExpiryDate" text NOT NULL,
    "UpdatedAt" timestamp with time zone NOT NULL,
    "OnOrderQty" numeric DEFAULT 0 NOT NULL
);


--
-- Name: ProductB2bLocationStocks_Id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

ALTER TABLE public."ProductB2bLocationStocks" ALTER COLUMN "Id" ADD GENERATED BY DEFAULT AS IDENTITY (
    SEQUENCE NAME public."ProductB2bLocationStocks_Id_seq"
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1
);


--
-- Name: ProductComponentItems; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public."ProductComponentItems" (
    "Id" integer NOT NULL,
    "ProductId" integer NOT NULL,
    "ComponentId" text NOT NULL,
    "ComponentName" text NOT NULL,
    "ComponentUom" text NOT NULL,
    "ComponentUomPrice" numeric NOT NULL,
    "Quantity" numeric NOT NULL,
    "Subtotal" numeric NOT NULL,
    "SortOrder" integer NOT NULL
);


--
-- Name: ProductComponentItems_Id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

ALTER TABLE public."ProductComponentItems" ALTER COLUMN "Id" ADD GENERATED BY DEFAULT AS IDENTITY (
    SEQUENCE NAME public."ProductComponentItems_Id_seq"
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1
);


--
-- Name: ProductPackagingItems; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public."ProductPackagingItems" (
    "Id" integer NOT NULL,
    "ProductId" integer NOT NULL,
    "ComponentId" text NOT NULL,
    "ComponentName" text NOT NULL,
    "ComponentUom" text NOT NULL,
    "ComponentUomPrice" numeric NOT NULL,
    "Quantity" numeric NOT NULL,
    "Subtotal" numeric NOT NULL,
    "SortOrder" integer NOT NULL
);


--
-- Name: ProductPackagingItems_Id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

ALTER TABLE public."ProductPackagingItems" ALTER COLUMN "Id" ADD GENERATED BY DEFAULT AS IDENTITY (
    SEQUENCE NAME public."ProductPackagingItems_Id_seq"
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1
);


--
-- Name: ProductProductionLogs; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public."ProductProductionLogs" (
    "Id" integer NOT NULL,
    "ProductId" integer NOT NULL,
    "EntryType" text NOT NULL,
    "Quantity" numeric NOT NULL,
    "ProductionDate" text NOT NULL,
    "ExpiryDate" text NOT NULL,
    "BatchNumber" text NOT NULL,
    "UnitPrice" numeric NOT NULL,
    "LocationIdsJson" text NOT NULL,
    "CompanyId" integer,
    "CreatedAt" timestamp with time zone NOT NULL
);


--
-- Name: ProductProductionLogs_Id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

ALTER TABLE public."ProductProductionLogs" ALTER COLUMN "Id" ADD GENERATED BY DEFAULT AS IDENTITY (
    SEQUENCE NAME public."ProductProductionLogs_Id_seq"
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1
);


--
-- Name: Products; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public."Products" (
    "Id" integer NOT NULL,
    "ProductId" character varying(32) NOT NULL,
    "Name" text NOT NULL,
    "Category" text NOT NULL,
    "Group" text NOT NULL,
    "IsSubProduct" boolean NOT NULL,
    "B2cEnabled" boolean NOT NULL,
    "B2bEnabled" boolean NOT NULL,
    "B2bPackageUnit" text NOT NULL,
    "TotalCost" numeric NOT NULL,
    "PackagingCost" numeric NOT NULL,
    "Rrp" numeric NOT NULL,
    "PreviousTotalCost" numeric,
    "PreviousPackagingCost" numeric,
    "PreviousRrp" numeric,
    "YieldQuantity" numeric NOT NULL,
    "YieldUom" text NOT NULL,
    "ExpiryPeriodDays" integer NOT NULL,
    "PosEnabled" boolean NOT NULL,
    "Active" boolean NOT NULL,
    "CompanyId" integer,
    "LocationIdsJson" text NOT NULL,
    "CreatedAt" timestamp with time zone NOT NULL,
    "UpdatedAt" timestamp with time zone NOT NULL,
    "B2bSalesConfigJson" text DEFAULT '{}'::text NOT NULL,
    "ActivationPeriodHours" integer DEFAULT 0 NOT NULL,
    "ParStock" numeric DEFAULT 0 NOT NULL,
    "ParStockUom" text DEFAULT ''::text NOT NULL,
    "YieldAltUnitsJson" text DEFAULT '[]'::text NOT NULL,
    "PosDeliveryUnitsJson" text DEFAULT '[]'::text NOT NULL
);


--
-- Name: Products_Id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

ALTER TABLE public."Products" ALTER COLUMN "Id" ADD GENERATED BY DEFAULT AS IDENTITY (
    SEQUENCE NAME public."Products_Id_seq"
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1
);


--
-- Name: ProvidentFundBrackets; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public."ProvidentFundBrackets" (
    "Id" integer NOT NULL,
    "PayStructureId" integer NOT NULL,
    "SortOrder" integer NOT NULL,
    "MinAge" integer,
    "MaxAge" integer,
    "MinMonthlySalary" numeric,
    "MaxMonthlySalary" numeric,
    "EmployerPct" numeric NOT NULL,
    "EmployeePct" numeric NOT NULL,
    "NoContribution" boolean NOT NULL
);


--
-- Name: ProvidentFundBrackets_Id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

ALTER TABLE public."ProvidentFundBrackets" ALTER COLUMN "Id" ADD GENERATED BY DEFAULT AS IDENTITY (
    SEQUENCE NAME public."ProvidentFundBrackets_Id_seq"
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1
);


--
-- Name: PublicHolidays; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public."PublicHolidays" (
    "Id" integer NOT NULL,
    "Name" character varying(200) NOT NULL,
    "Date" date NOT NULL,
    "IsRecognized" boolean NOT NULL,
    "CountryCode" character varying(2),
    "CatalogKey" character varying(120),
    "IsRecurringAnnually" boolean NOT NULL,
    "IsGazetted" boolean NOT NULL
);


--
-- Name: PublicHolidays_Id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

ALTER TABLE public."PublicHolidays" ALTER COLUMN "Id" ADD GENERATED BY DEFAULT AS IDENTITY (
    SEQUENCE NAME public."PublicHolidays_Id_seq"
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1
);


--
-- Name: PurchaseOrderItems; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public."PurchaseOrderItems" (
    "Id" integer NOT NULL,
    "PurchaseOrderId" integer NOT NULL,
    "ComponentId" text NOT NULL,
    "ComponentName" text NOT NULL,
    "VendorProductId" text NOT NULL,
    "Name" text NOT NULL,
    "Quantity" numeric NOT NULL,
    "UnitPrice" numeric NOT NULL,
    "IssuedUnitPrice" numeric NOT NULL,
    "Unit" text NOT NULL,
    "ComponentUom" text NOT NULL,
    "DeliveryPackage" text NOT NULL,
    "ReceivedQuantity" numeric,
    "ReceivedUnitPrice" numeric,
    "ReconciledQuantity" numeric,
    "ReconciledUnitPrice" numeric,
    "TaxAmount" numeric NOT NULL,
    "HalalCertNo" text DEFAULT ''::text NOT NULL
);


--
-- Name: PurchaseOrderItems_Id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

ALTER TABLE public."PurchaseOrderItems" ALTER COLUMN "Id" ADD GENERATED BY DEFAULT AS IDENTITY (
    SEQUENCE NAME public."PurchaseOrderItems_Id_seq"
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1
);


--
-- Name: PurchaseOrders; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public."PurchaseOrders" (
    "Id" integer NOT NULL,
    "PoNumber" text NOT NULL,
    "VendorName" text NOT NULL,
    "OrderDate" date NOT NULL,
    "DeliveryDate" date NOT NULL,
    "DocumentType" text NOT NULL,
    "Status" text NOT NULL,
    "CompanyId" integer,
    "LocationIdsJson" text NOT NULL,
    "InitiatedBy" text NOT NULL,
    "ApprovedBy" text NOT NULL,
    "ApprovedAt" timestamp with time zone,
    "ReceivedAt" timestamp with time zone,
    "ReconciledAt" timestamp with time zone,
    "VendorShareToken" text NOT NULL,
    "VendorAcceptedAt" timestamp with time zone,
    "VendorAcceptedBy" text NOT NULL
);


--
-- Name: PurchaseOrders_Id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

ALTER TABLE public."PurchaseOrders" ALTER COLUMN "Id" ADD GENERATED BY DEFAULT AS IDENTITY (
    SEQUENCE NAME public."PurchaseOrders_Id_seq"
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1
);


--
-- Name: QuoteRequestLines; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public."QuoteRequestLines" (
    "Id" integer NOT NULL,
    "QuoteRequestId" integer NOT NULL,
    "Kind" text DEFAULT 'principal'::text NOT NULL,
    "SortOrder" integer DEFAULT 0 NOT NULL,
    "ComponentId" integer,
    "ComponentExternalId" text DEFAULT ''::text NOT NULL,
    "ComponentName" text DEFAULT ''::text NOT NULL,
    "Specification" text DEFAULT ''::text NOT NULL,
    "PrincipalUom" text DEFAULT ''::text NOT NULL,
    "RequestedQty" numeric DEFAULT 0 NOT NULL,
    "VendorResponsesJson" text DEFAULT '{}'::text NOT NULL
);


--
-- Name: QuoteRequestLines_Id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

ALTER TABLE public."QuoteRequestLines" ALTER COLUMN "Id" ADD GENERATED BY DEFAULT AS IDENTITY (
    SEQUENCE NAME public."QuoteRequestLines_Id_seq"
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1
);


--
-- Name: QuoteRequestVendors; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public."QuoteRequestVendors" (
    "Id" integer NOT NULL,
    "QuoteRequestId" integer NOT NULL,
    "VendorId" integer,
    "VendorExternalId" text DEFAULT ''::text NOT NULL,
    "VendorName" text DEFAULT ''::text NOT NULL,
    "ContactPerson" text DEFAULT ''::text NOT NULL,
    "Email" text DEFAULT ''::text NOT NULL,
    "Mobile" text DEFAULT ''::text NOT NULL,
    "IsNewVendor" boolean DEFAULT false NOT NULL,
    "ShareToken" text DEFAULT ''::text NOT NULL,
    "Status" text DEFAULT 'pending'::text NOT NULL,
    "SubmittedAt" timestamp with time zone,
    "SubmittedBy" text DEFAULT ''::text NOT NULL
);


--
-- Name: QuoteRequestVendors_Id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

ALTER TABLE public."QuoteRequestVendors" ALTER COLUMN "Id" ADD GENERATED BY DEFAULT AS IDENTITY (
    SEQUENCE NAME public."QuoteRequestVendors_Id_seq"
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1
);


--
-- Name: QuoteRequests; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public."QuoteRequests" (
    "Id" integer NOT NULL,
    "RfqNumber" text DEFAULT ''::text NOT NULL,
    "CompanyId" integer DEFAULT 0 NOT NULL,
    "LocationIdsJson" text DEFAULT '[]'::text NOT NULL,
    "Status" text DEFAULT 'open'::text NOT NULL,
    "Notes" text DEFAULT ''::text NOT NULL,
    "CreatedBy" text DEFAULT ''::text NOT NULL,
    "CreatedAt" timestamp with time zone DEFAULT now() NOT NULL,
    "UpdatedAt" timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: QuoteRequests_Id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

ALTER TABLE public."QuoteRequests" ALTER COLUMN "Id" ADD GENERATED BY DEFAULT AS IDENTITY (
    SEQUENCE NAME public."QuoteRequests_Id_seq"
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1
);


--
-- Name: RevMgmtCompanyConfigs; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public."RevMgmtCompanyConfigs" (
    "Id" integer NOT NULL,
    "CompanyId" integer NOT NULL,
    "ConfigKey" text NOT NULL,
    "StateJson" text DEFAULT '{}'::text NOT NULL,
    "UpdatedAt" timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: RevMgmtCompanyConfigs_Id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

ALTER TABLE public."RevMgmtCompanyConfigs" ALTER COLUMN "Id" ADD GENERATED BY DEFAULT AS IDENTITY (
    SEQUENCE NAME public."RevMgmtCompanyConfigs_Id_seq"
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1
);


--
-- Name: RevenueDataPoints; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public."RevenueDataPoints" (
    "Id" integer NOT NULL,
    "Period" text NOT NULL,
    "Label" text NOT NULL,
    "CurrentValue" numeric NOT NULL,
    "PriorValue" numeric NOT NULL,
    "Covers" integer
);


--
-- Name: RevenueDataPoints_Id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

ALTER TABLE public."RevenueDataPoints" ALTER COLUMN "Id" ADD GENERATED BY DEFAULT AS IDENTITY (
    SEQUENCE NAME public."RevenueDataPoints_Id_seq"
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1
);


--
-- Name: ShiftSchedules; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public."ShiftSchedules" (
    "Id" integer NOT NULL,
    "EmployeeId" integer NOT NULL,
    "Date" date NOT NULL,
    "StartTime" time without time zone,
    "EndTime" time without time zone,
    "Type" character varying(10) NOT NULL
);


--
-- Name: ShiftSchedules_Id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

ALTER TABLE public."ShiftSchedules" ALTER COLUMN "Id" ADD GENERATED BY DEFAULT AS IDENTITY (
    SEQUENCE NAME public."ShiftSchedules_Id_seq"
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1
);


--
-- Name: SocsoBrackets; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public."SocsoBrackets" (
    "Id" integer NOT NULL,
    "PayStructureId" integer NOT NULL,
    "SortOrder" integer NOT NULL,
    "MinAge" integer,
    "MaxAge" integer,
    "MinMonthlySalary" numeric,
    "MaxMonthlySalary" numeric,
    "EmployerAmount" numeric NOT NULL,
    "EmployeeAmount" numeric NOT NULL
);


--
-- Name: SocsoBrackets_Id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

ALTER TABLE public."SocsoBrackets" ALTER COLUMN "Id" ADD GENERATED BY DEFAULT AS IDENTITY (
    SEQUENCE NAME public."SocsoBrackets_Id_seq"
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1
);


--
-- Name: UserNotifications; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public."UserNotifications" (
    "Id" integer NOT NULL,
    "UserId" integer,
    "RecipientName" text NOT NULL,
    "PurchaseOrderId" integer,
    "Type" text NOT NULL,
    "Title" text NOT NULL,
    "Body" text NOT NULL,
    "CreatedAt" timestamp with time zone NOT NULL,
    "ReadAt" timestamp with time zone
);


--
-- Name: UserNotifications_Id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

ALTER TABLE public."UserNotifications" ALTER COLUMN "Id" ADD GENERATED BY DEFAULT AS IDENTITY (
    SEQUENCE NAME public."UserNotifications_Id_seq"
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1
);


--
-- Name: VendorProductPrices; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public."VendorProductPrices" (
    "ExternalId" text NOT NULL,
    "DeliveryPrice" numeric NOT NULL,
    "UpdatedAt" timestamp with time zone NOT NULL,
    "LastPurchaseOrderId" integer
);


--
-- Name: VendorProducts; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public."VendorProducts" (
    "ExternalId" text NOT NULL,
    "VendorExternalId" text DEFAULT ''::text NOT NULL,
    "VendorName" text DEFAULT ''::text NOT NULL,
    "ProductName" text DEFAULT ''::text NOT NULL,
    "Group" text DEFAULT ''::text NOT NULL,
    "Specification" text DEFAULT ''::text NOT NULL,
    "ImageUrl" text DEFAULT ''::text NOT NULL,
    "DeliveryPrice" numeric DEFAULT 0 NOT NULL,
    "DeliveryJson" text DEFAULT '{}'::text NOT NULL,
    "ProductPolicyTag" text DEFAULT ''::text NOT NULL,
    "IsPrivate" boolean DEFAULT false NOT NULL,
    "PrivateLocationIdsJson" text DEFAULT '[]'::text NOT NULL,
    "Active" boolean DEFAULT true NOT NULL,
    "UpdatedAt" timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: Vendors; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public."Vendors" (
    "Id" integer NOT NULL,
    "ExternalId" text NOT NULL,
    "Name" text NOT NULL,
    "Type" text NOT NULL,
    "Brn" text NOT NULL,
    "Products" text NOT NULL,
    "City" text NOT NULL,
    "State" text NOT NULL,
    "ContactPerson" text NOT NULL,
    "ContactPosition" text NOT NULL,
    "Mobile" text NOT NULL,
    "Email" text NOT NULL,
    "Address" text NOT NULL,
    "ContactsJson" text NOT NULL,
    "Engaged" boolean NOT NULL,
    "ProductPolicyTag" text DEFAULT 'non-halal'::text NOT NULL
);


--
-- Name: Vendors_Id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

ALTER TABLE public."Vendors" ALTER COLUMN "Id" ADD GENERATED BY DEFAULT AS IDENTITY (
    SEQUENCE NAME public."Vendors_Id_seq"
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1
);


--
-- Data for Name: AccessControlSettings; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public."AccessControlSettings" ("Id", "TypesJson", "MatrixJson") FROM stdin;
1	[{"id":"ac1","label":"Super User"},{"id":"ac2","label":"AC 2"},{"id":"ac3","label":"AC 3"},{"id":"ac4","label":"AC 4"},{"id":"ac5","label":"AC 5"},{"id":"ac6","label":"AC 6"},{"id":"ac7","label":"AC 7"},{"id":"ac8","label":"AC 8"}]	{"revenue-management:order:viewOrder":{"ac1":true,"ac8":true},"revenue-management:order:createEditOrder":{"ac1":true,"ac8":true},"revenue-management:order:approveOrder":{"ac1":true},"revenue-management:order:receiveOrder":{"ac1":true,"ac8":true},"revenue-management:order:consolidateOrder":{"ac1":true},"revenue-management:order:cashPurchase":{"ac1":true},"revenue-management:order:orderTemplate":{"ac1":true},"revenue-management:production:productManagement":{"ac1":true},"revenue-management:production:offlineSales":{"ac1":true},"revenue-management:production:batchStockAdjustment":{"ac1":true},"revenue-management:inventory:stockCard":{"ac1":true},"revenue-management:inventory:inventoryPost":{"ac1":true,"ac8":true},"revenue-management:inventory:inventoryConfirmation":{"ac1":true},"revenue-management:inventory:inventoryAdjustment":{"ac1":true},"revenue-management:inventory:creditNote":{"ac1":true},"revenue-management:inventory:wastage":{"ac1":true},"revenue-management:inventory:transfer":{"ac1":true},"revenue-management:inventory:inventoryConfiguration":{"ac1":true},"revenue-management:smart-component:createEdit":{"ac1":true},"revenue-management:smart-component:activateDeactivateVendorProducts":{"ac1":true},"revenue-management:smart-component:createEditComponentGroup":{"ac1":true},"revenue-management:smart-component:createEditStorageAssignment":{"ac1":true},"revenue-management:smart-component:accountMapping":{"ac1":true},"revenue-management:vendor:viewVendorList":{"ac1":true},"revenue-management:vendor:viewVendorProducts":{"ac1":true},"revenue-management:vendor:activateDeactivateVendor":{"ac1":true},"revenue-management:vendor:accountMapping":{"ac1":true},"revenue-management:products:viewProductSubProduct":{"ac1":true},"revenue-management:products:manageProductSubProduct":{"ac1":true},"revenue-management:products:accountMapping":{"ac1":true},"revenue-management:sales:manageCustomers":{"ac1":true},"revenue-management:sales:customerGroup":{"ac1":true},"revenue-management:sales:manageSalesOrder":{"ac1":true},"revenue-management:sales:manageInvoice":{"ac1":true},"revenue-management:sales:promotionScheduler":{"ac1":true},"revenue-management:sales:accountMapping":{"ac1":true},"revenue-management:reports:viewReports":{"ac1":true},"point-of-sales:configuration:pos-menu":{"ac1":true},"point-of-sales:configuration:pos-modifier-group":{"ac1":true},"point-of-sales:configuration:promotion-scheduler":{"ac1":true},"point-of-sales:configuration:device-management":{"ac1":true},"point-of-sales:configuration:e-invoice":{"ac1":true},"human-resource-management:employee:view-employees":{"ac1":true},"human-resource-management:employee:create-and-edit-employee":{"ac1":true},"human-resource-management:employee:deactivate-employee":{"ac1":true},"human-resource-management:payroll:view-payroll":{"ac1":true},"human-resource-management:payroll:run-payroll":{"ac1":true},"human-resource-management:payroll:approve-payroll":{"ac1":true},"human-resource-management:leave:view-leave":{"ac1":true},"human-resource-management:leave:approve-leave":{"ac1":true},"human-resource-management:leave:manage-leave-balance":{"ac1":true},"human-resource-management:configuration:ph-setting":{"ac1":true},"human-resource-management:configuration:level-entitlement":{"ac1":true},"human-resource-management:configuration:pay-structure":{"ac1":true},"human-resource-management:configuration:divisions-department":{"ac1":true},"accounting:general-ledger:view-chart-of-accounts":{"ac1":true},"accounting:general-ledger:manage-journal-entries":{"ac1":true},"accounting:general-ledger:bank-reconciliation":{"ac1":true},"accounting:general-ledger:financial-reports":{"ac1":true},"accounting:general-ledger:account-mapping":{"ac1":true}}
\.


--
-- Data for Name: AppUsers; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public."AppUsers" ("Id", "EmployeeId", "FullName", "Email", "Role", "Phone", "Active", "AccessJson", "CompanyId", "LocationIdsJson", "PasswordHash") FROM stdin;
1	1	James Dubois	james.dubois@bisync.cloud	Head Chef	+60 12-111 2233	t	{"modules":["RMS"],"rms":{"enabled":true,"tasks":{"viewOrder":true,"createEditOrder":true,"productManagement":true,"createEdit":true,"viewVendorList":true,"viewReports":true}}}	1	[1,4]	\N
2	2	Sarah Chen	sarah.chen@bisync.cloud	Operations Manager	+60 16-222 3344	t	{"modules":[]}	1	[1,2,3,4]	\N
3	3	Ahmad Razali	ahmad.razali@bisync.cloud	Location Manager	+60 19-333 4455	t	{"modules":[]}	1	[2,3]	\N
4	4	Melissa Tan	melissa.tan@bisync.cloud	Finance Admin	+60 17-444 5566	t	{"modules":[]}	1	[1,2,3,4]	\N
5	6	Nadia Lim	nadia.lim@bisync.cloud	Retail Lead	+65 8123 9901	t	{"modules":[]}	2	[5,6]	\N
6	7	Ethan Goh	ethan.goh@bisync.cloud	Store Supervisor	+65 8123 9902	t	{"modules":[]}	2	[5,6]	\N
7	11	Olivia Brooks	olivia.brooks@bisync.cloud	Regional Manager	+61 412 556 771	t	{"modules":[]}	3	[7,8]	\N
8	12	Liam Carter	liam.carter@bisync.cloud	Operations Analyst	+61 412 556 772	t	{"modules":[]}	3	[7]	\N
9	5	Daniel Ong	daniel.ong@bisync.cloud	Sous Chef	+60 18-555 6677	t	{"modules":[]}	1	[1]	\N
10	8	Priya Sharma	priya.sharma@bisync.cloud	Category Manager	+65 8123 9903	t	{"modules":[]}	2	[5]	\N
11	9	Wei Ming Tan	wei.ming@bisync.cloud	Inventory Coordinator	+65 8123 9904	t	{"modules":[]}	2	[6]	\N
12	10	Amelia Koh	amelia.koh@bisync.cloud	Floor Manager	+65 8123 9905	t	{"modules":[]}	2	[5,6]	\N
13	13	Emma Wilson	emma.wilson@bisync.cloud	Head Chef	+61 412 556 773	t	{"modules":[]}	3	[7]	\N
14	14	Noah Singh	noah.singh@bisync.cloud	Payroll Officer	+61 412 556 774	t	{"modules":[]}	3	[8]	\N
15	15	Chloe Nguyen	chloe.nguyen@bisync.cloud	HR Coordinator	+61 412 556 775	t	{"modules":[]}	3	[7,8]	\N
16	17	Nurul Huda Osman	nurul.huda@bisync.cloud	Service Manager	+60 12-601 1001	t	{"modules":[]}	1	[1,2,3,4]	\N
17	18	Raj Kumar	raj.kumar@bisync.cloud	Service Supervisor	+60 12-601 1002	t	{"modules":[]}	1	[1,2]	\N
18	19	Siti Aminah Rahman	siti.aminah@bisync.cloud	Waiter	+60 12-601 1003	t	{"modules":[]}	1	[1]	\N
19	20	Wong Mei Ling	mei.ling@bisync.cloud	Waiter	+60 12-601 1004	t	{"modules":[]}	1	[2]	\N
20	21	Arif Hassan	arif.hassan@bisync.cloud	Waiter	+60 12-601 1005	t	{"modules":[]}	1	[3]	\N
21	22	Farah Izzati	farah.izzati@bisync.cloud	Host	+60 12-601 1006	t	{"modules":[]}	1	[4]	\N
22	23	Kevin Lim	kevin.lim@bisync.cloud	Bartender	+60 12-601 1007	t	{"modules":[]}	1	[1,4]	\N
23	24	Priya Menon	priya.menon@bisync.cloud	Waiter	+60 12-601 1008	t	{"modules":[]}	1	[2,3]	\N
24	25	Hakim Zulkifli	hakim.zulkifli@bisync.cloud	Food Runner	+60 12-601 1009	t	{"modules":[]}	1	[1]	\N
25	26	Michelle Tan	michelle.tan@bisync.cloud	Captain	+60 12-601 1010	t	{"modules":[]}	1	[1,2]	\N
26	27	Marco D'Silva	marco.silva@bisync.cloud	Line Cook	+60 12-602 2001	t	{"modules":[]}	1	[1]	\N
27	28	Aisyah Rahman	aisyah.rahman@bisync.cloud	Prep Cook	+60 12-602 2002	t	{"modules":[]}	1	[2]	\N
28	29	Lorraine Yeoh	lorraine.yeoh@bisync.cloud	Pastry Chef	+60 12-602 2003	t	{"modules":[]}	1	[1,4]	\N
29	30	Vijay Nair	vijay.nair@bisync.cloud	Line Cook	+60 12-602 2004	t	{"modules":[]}	1	[3]	\N
30	31	Adam Ismail	adam.ismail@bisync.cloud	Commis Chef	+60 12-602 2005	t	{"modules":[]}	1	[1]	\N
31	32	Nur Izzati Kamal	nur.izzati@bisync.cloud	Kitchen Assistant	+60 12-602 2006	t	{"modules":[]}	1	[4]	\N
32	33	Tan Boon Kiat	boon.kiat@bisync.cloud	Grill Cook	+60 12-602 2007	t	{"modules":[]}	1	[2,3]	\N
33	34	Ravi Chandran	ravi.chandran@bisync.cloud	Kitchen Steward	+60 12-602 2008	t	{"modules":[]}	1	[1]	\N
34	36	Test Persist User	test.persist@bisync.cloud	Operations Coordinator	+60 12-999 8877	f	{"modules":[]}	1	[]	\N
35	\N	DRA Super Admin	dra@cubevalue.com	Super Admin	+60 3-0000 0000	t	{"modules":["RMS","POS","HRM","Accounting"],"rms":{"enabled":true,"tasks":{"viewOrder":true,"createEditOrder":true,"approveOrder":true,"receiveOrder":true,"consolidateOrder":true,"cashPurchase":true,"orderTemplate":true,"productManagement":true,"offlineSales":true,"batchStockAdjustment":true,"inventoryPost":true,"inventoryConfirmation":true,"inventoryAdjustment":true,"creditNote":true,"wastage":true,"transfer":true,"inventoryConfiguration":true,"createEdit":true,"activateDeactivateVendorProducts":true,"createEditComponentGroup":true,"createEditStorageAssignment":true,"accountMapping":true,"viewVendorList":true,"viewVendorProducts":true,"activateDeactivateVendor":true,"viewProductSubProduct":true,"manageProductSubProduct":true,"manageCustomers":true,"customerGroup":true,"manageSalesOrder":true,"manageInvoice":true,"promotionScheduler":true,"viewReports":true}},"superAdmin":true}	1	[1,2,5,6,7,8,3,4,9,10]	v1:GfCd13X7ckAocLu1Ar1Qpg==:rFjy5Hqt+e01u9R2/73lf2ZAtQNeLvbypvG5xrzUohQ=
\.


--
-- Data for Name: AttendanceRecords; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public."AttendanceRecords" ("Id", "EmployeeId", "Date", "Status", "ScheduledIn", "ScheduledOut", "ActualIn", "ActualOut", "RphAccruedDays") FROM stdin;
1	1	2026-06-01	Present	09:00:00	18:00:00	09:00:00	18:00:00	0.0
2	1	2026-06-02	Present	09:00:00	18:00:00	09:00:00	18:00:00	0.0
3	1	2026-06-03	Present	09:00:00	18:00:00	09:00:00	18:00:00	0.0
4	1	2026-06-04	Present	09:00:00	18:00:00	09:00:00	18:00:00	0.0
5	1	2026-06-05	Present	09:00:00	18:00:00	09:00:00	18:00:00	0.0
6	1	2026-06-08	Present	09:00:00	18:00:00	09:00:00	18:00:00	0.0
7	1	2026-06-09	Present	09:00:00	18:00:00	09:00:00	18:00:00	0.0
8	1	2026-06-10	Present	09:00:00	18:00:00	09:00:00	20:00:00	0.0
9	1	2026-06-11	Present	09:00:00	18:00:00	09:00:00	18:00:00	0.0
10	1	2026-06-12	Present	09:00:00	18:00:00	09:00:00	18:00:00	0.0
11	1	2026-06-15	Present	09:00:00	18:00:00	09:00:00	18:00:00	0.0
12	1	2026-06-16	Present	09:00:00	18:00:00	09:00:00	18:00:00	0.0
13	1	2026-06-17	Present	09:00:00	18:00:00	09:00:00	18:00:00	0.0
14	1	2026-06-18	Present	09:00:00	18:00:00	09:00:00	18:00:00	0.0
15	1	2026-06-19	Present	09:00:00	18:00:00	09:00:00	18:00:00	0.0
16	1	2026-06-22	Present	09:00:00	18:00:00	09:00:00	18:00:00	0.0
17	1	2026-06-23	Present	09:00:00	18:00:00	09:00:00	18:00:00	0.0
18	1	2026-06-24	Present	09:00:00	18:00:00	09:00:00	18:00:00	0.0
19	1	2026-06-25	Present	09:00:00	18:00:00	09:00:00	18:00:00	0.0
20	1	2026-06-26	Present	09:00:00	18:00:00	09:00:00	18:00:00	0.0
21	1	2026-06-29	Present	09:00:00	18:00:00	09:00:00	18:00:00	0.0
22	1	2026-06-30	Present	09:00:00	18:00:00	09:00:00	18:00:00	0.0
23	2	2026-06-01	Present	09:00:00	18:00:00	09:00:00	18:00:00	0.0
24	2	2026-06-02	Present	09:00:00	18:00:00	09:00:00	18:00:00	0.0
25	2	2026-06-03	Present	09:00:00	18:00:00	09:00:00	18:00:00	0.0
26	2	2026-06-04	Present	09:00:00	18:00:00	09:00:00	18:00:00	0.0
27	2	2026-06-05	Late	09:00:00	18:00:00	09:00:00	18:00:00	0.0
28	2	2026-06-08	Present	09:00:00	18:00:00	09:00:00	18:00:00	0.0
29	2	2026-06-09	Present	09:00:00	18:00:00	09:00:00	18:00:00	0.0
30	2	2026-06-10	Present	09:00:00	18:00:00	09:00:00	18:00:00	0.0
31	2	2026-06-11	Present	09:00:00	18:00:00	09:00:00	18:00:00	0.0
32	2	2026-06-12	Late	09:00:00	18:00:00	09:00:00	18:00:00	0.0
33	2	2026-06-15	Present	09:00:00	18:00:00	09:00:00	18:00:00	0.0
34	2	2026-06-16	Present	09:00:00	18:00:00	09:00:00	18:00:00	0.0
35	2	2026-06-17	Present	09:00:00	18:00:00	09:00:00	18:00:00	0.0
36	2	2026-06-18	Present	09:00:00	18:00:00	09:00:00	18:00:00	0.0
37	2	2026-06-19	Late	09:00:00	18:00:00	09:00:00	18:00:00	0.0
38	2	2026-06-22	Present	09:00:00	18:00:00	09:00:00	18:00:00	0.0
39	2	2026-06-23	Present	09:00:00	18:00:00	09:00:00	18:00:00	0.0
40	2	2026-06-24	Present	09:00:00	18:00:00	09:00:00	18:00:00	0.0
41	2	2026-06-25	Present	09:00:00	18:00:00	09:00:00	18:00:00	0.0
42	2	2026-06-26	Late	09:00:00	18:00:00	09:00:00	18:00:00	0.0
43	2	2026-06-29	Present	09:00:00	18:00:00	09:00:00	18:00:00	0.0
44	2	2026-06-30	Present	09:00:00	18:00:00	09:00:00	18:00:00	0.0
45	3	2026-06-01	Present	09:00:00	18:00:00	09:00:00	18:00:00	0.0
46	3	2026-06-02	Present	09:00:00	18:00:00	09:00:00	18:00:00	0.0
47	3	2026-06-03	Present	09:00:00	18:00:00	09:00:00	18:00:00	0.0
48	3	2026-06-04	Present	09:00:00	18:00:00	09:00:00	18:00:00	0.0
49	3	2026-06-05	Present	09:00:00	18:00:00	09:00:00	18:00:00	0.0
50	3	2026-06-08	Present	09:00:00	18:00:00	09:00:00	18:00:00	0.0
51	3	2026-06-09	Present	09:00:00	18:00:00	09:00:00	18:00:00	0.0
52	3	2026-06-10	Present	09:00:00	18:00:00	09:00:00	18:00:00	0.0
53	3	2026-06-11	Present	09:00:00	18:00:00	09:00:00	18:00:00	0.0
54	3	2026-06-12	Present	09:00:00	18:00:00	09:00:00	18:00:00	0.0
55	3	2026-06-15	Present	09:00:00	18:00:00	09:00:00	18:00:00	0.0
56	3	2026-06-16	Present	09:00:00	18:00:00	09:00:00	18:00:00	0.0
57	3	2026-06-17	Present	09:00:00	18:00:00	09:00:00	18:00:00	0.0
58	3	2026-06-18	Present	09:00:00	18:00:00	09:00:00	18:00:00	0.0
59	3	2026-06-19	Present	09:00:00	18:00:00	09:00:00	18:00:00	0.0
60	3	2026-06-22	Present	09:00:00	18:00:00	09:00:00	18:00:00	0.0
61	3	2026-06-23	Present	09:00:00	18:00:00	09:00:00	18:00:00	0.0
62	3	2026-06-24	Present	09:00:00	18:00:00	09:00:00	18:00:00	0.0
63	3	2026-06-25	Present	09:00:00	18:00:00	09:00:00	18:00:00	0.0
64	3	2026-06-26	Present	09:00:00	18:00:00	09:00:00	18:00:00	0.0
65	3	2026-06-29	Present	09:00:00	18:00:00	09:00:00	18:00:00	0.0
66	3	2026-06-30	Present	09:00:00	18:00:00	09:00:00	18:00:00	0.0
67	4	2026-06-01	Present	09:00:00	18:00:00	09:00:00	18:00:00	0.0
68	4	2026-06-02	Present	09:00:00	18:00:00	09:00:00	18:00:00	0.0
69	4	2026-06-03	Present	09:00:00	18:00:00	09:00:00	18:00:00	0.0
70	4	2026-06-04	Present	09:00:00	18:00:00	09:00:00	18:00:00	0.0
71	4	2026-06-05	Late	09:00:00	18:00:00	09:00:00	18:00:00	0.0
72	4	2026-06-08	Present	09:00:00	18:00:00	09:00:00	18:00:00	0.0
73	4	2026-06-09	Present	09:00:00	18:00:00	09:00:00	18:00:00	0.0
74	4	2026-06-10	Present	09:00:00	18:00:00	09:00:00	18:00:00	0.0
75	4	2026-06-11	Present	09:00:00	18:00:00	09:00:00	18:00:00	0.0
76	4	2026-06-12	Late	09:00:00	18:00:00	09:00:00	18:00:00	0.0
77	4	2026-06-15	Present	09:00:00	18:00:00	09:00:00	18:00:00	0.0
78	4	2026-06-16	Present	09:00:00	18:00:00	09:00:00	18:00:00	0.0
79	4	2026-06-17	Present	09:00:00	18:00:00	09:00:00	18:00:00	0.0
80	4	2026-06-18	Present	09:00:00	18:00:00	09:00:00	18:00:00	0.0
81	4	2026-06-19	Late	09:00:00	18:00:00	09:00:00	18:00:00	0.0
82	4	2026-06-22	Present	09:00:00	18:00:00	09:00:00	18:00:00	0.0
83	4	2026-06-23	Present	09:00:00	18:00:00	09:00:00	18:00:00	0.0
84	4	2026-06-24	Present	09:00:00	18:00:00	09:00:00	18:00:00	0.0
85	4	2026-06-25	Present	09:00:00	18:00:00	09:00:00	18:00:00	0.0
86	4	2026-06-26	Late	09:00:00	18:00:00	09:00:00	18:00:00	0.0
87	4	2026-06-29	Present	09:00:00	18:00:00	09:00:00	18:00:00	0.0
88	4	2026-06-30	Present	09:00:00	18:00:00	09:00:00	18:00:00	0.0
89	5	2026-06-01	Present	09:00:00	18:00:00	09:00:00	18:00:00	0.0
90	5	2026-06-02	Present	09:00:00	18:00:00	09:00:00	18:00:00	0.0
91	5	2026-06-03	Present	09:00:00	18:00:00	09:00:00	18:00:00	0.0
92	5	2026-06-04	Present	09:00:00	18:00:00	09:00:00	18:00:00	0.0
93	5	2026-06-05	Present	09:00:00	18:00:00	09:00:00	18:00:00	0.0
94	5	2026-06-08	Present	09:00:00	18:00:00	09:00:00	18:00:00	0.0
95	5	2026-06-09	Present	09:00:00	18:00:00	09:00:00	18:00:00	0.0
96	5	2026-06-10	Present	09:00:00	18:00:00	09:00:00	18:00:00	0.0
97	5	2026-06-11	Present	09:00:00	18:00:00	09:00:00	18:00:00	0.0
98	5	2026-06-12	Present	09:00:00	18:00:00	09:00:00	18:00:00	0.0
99	5	2026-06-15	Present	09:00:00	18:00:00	09:00:00	18:00:00	0.0
100	5	2026-06-16	Present	09:00:00	18:00:00	09:00:00	18:00:00	0.0
101	5	2026-06-17	Present	09:00:00	18:00:00	09:00:00	18:00:00	0.0
102	5	2026-06-18	Present	09:00:00	18:00:00	09:00:00	18:00:00	0.0
103	5	2026-06-19	Present	09:00:00	18:00:00	09:00:00	18:00:00	0.0
104	5	2026-06-22	Present	09:00:00	18:00:00	09:00:00	18:00:00	0.0
105	5	2026-06-23	Present	09:00:00	18:00:00	09:00:00	18:00:00	0.0
106	5	2026-06-24	Present	09:00:00	18:00:00	09:00:00	18:00:00	0.0
107	5	2026-06-25	Present	09:00:00	18:00:00	09:00:00	18:00:00	0.0
108	5	2026-06-26	Present	09:00:00	18:00:00	09:00:00	18:00:00	0.0
109	5	2026-06-29	Present	09:00:00	18:00:00	09:00:00	18:00:00	0.0
110	5	2026-06-30	Present	09:00:00	18:00:00	09:00:00	18:00:00	0.0
\.


--
-- Data for Name: B2bCustomers; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public."B2bCustomers" ("Id", "CompanyId", "ExternalId", "CompanyName", "Brn", "Address", "City", "State", "Postcode", "Phone", "Fax", "Email", "ContactsJson", "TaggedProductIdsJson", "PurchaseHistoryJson", "Active", "TaggedProductAliasIdsJson", "TaggedB2bProductUnitsJson") FROM stdin;
1	2	B2BC-001	Metro Foods Trading Sdn Bhd	201901234567	Lot 12, Jalan Perindustrian 3	Shah Alam	Selangor	40000	+60 3-5512 8800	+60 3-5512 8801	procurement@metrofoods.my	[{"id":"c1","name":"Ahmad Razif","position":"Procurement Manager","mobile":"\\u002B60 12-345 6789","fax":"","isDefault":true},{"id":"c2","name":"Siti Nurhaliza","position":"Accounts Executive","mobile":"\\u002B60 16-234 5678","fax":"\\u002B60 3-5512 8802","isDefault":false}]	[]	[{"dateOrdered":"2024-10-09","dateDelivered":"2024-10-11","productName":"Artisan Sourdough Loaf","deliveryUom":"1 Box (12 pcs)","rrp":48.00,"qtyOrdered":20,"actualRrp":46.50,"totalRevenue":930.00,"cogs":22.40,"cogsPercent":48.17},{"dateOrdered":"2026-05-09","dateDelivered":"2026-05-10","productName":"Butter Croissant","deliveryUom":"1 Tray (24 pcs)","rrp":72.00,"qtyOrdered":15,"actualRrp":70.00,"totalRevenue":1050.00,"cogs":31.50,"cogsPercent":45.00}]	1	[]	[]
2	2	B2BC-002	Green Leaf Cafés Group	202003456789	88 Jalan Bukit Bintang	Kuala Lumpur	Wilayah Persekutuan	55100	+60 3-2145 9900		orders@greenleaf.my	[{"id":"c3","name":"David Tan","position":"Operations Director","mobile":"\\u002B60 19-876 5432","fax":"","isDefault":true}]	[]	[]	1	[]	[]
3	1	B2BC-TEST-999	Test Create Co								test@example.com	[{"id":"c-test","name":"John Doe","position":"","mobile":"","fax":"","isDefault":true}]	[]	[]	1	[]	[]
4	5	B2BC-003	DRA Trading	90237493	1 Jalan Wan Kadir	Kuala Lumpur	Wilayah Persekutuan	60000	+60 3-9827 349283		admin@test.com	[{"id":"c-mrdnjm8t-aygt","name":"D Ra","position":"Ops Manager","mobile":"\\u002B60 12-623 3503","fax":"","isDefault":true}]	[]	[]	1	[]	[]
\.


--
-- Data for Name: B2bSalesOrderLines; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public."B2bSalesOrderLines" ("Id", "SalesOrderId", "ProductId", "ProductName", "LocationExternalId", "QuantityOrdered", "QuantityLocked", "Uom", "Rrp", "Status", "ProductAliasId") FROM stdin;
1	1	3	SC Demo Product 171	westend	12	12	pcs	37.15	fulfilled	\N
2	2	4	SC Demo Product 172	airport	8	8	pcs	46.64	fulfilled	\N
3	3	3	SC Demo Product 171	westend	5	5	pcs	37.15	locked	\N
4	4	4	SC Demo Product 172	airport	4	0	pcs	46.64	released	\N
\.


--
-- Data for Name: B2bSalesOrders; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public."B2bSalesOrders" ("Id", "CompanyId", "OrderNumber", "CustomerExternalId", "CustomerName", "Source", "Status", "LockPeriodDays", "IssuedDate", "LockExpiryDate", "DeliveryOrderIssued", "InvoiceIssued", "FulfilledDate", "CreatedAt", "UpdatedAt") FROM stdin;
1	2	SO-DEMO-001	B2BC-001	Metro Foods Trading Sdn Bhd	sales_order	fulfilled	14	2026-07-09	2026-07-23	t	t	2026-07-09	2026-07-09 13:57:46.141784+00	2026-07-09 13:57:46.28272+00
2	2	SO-DEMO-002	B2BC-002	Green Leaf Cafés Group	online_order	fulfilled	10	2026-07-09	2026-07-19	t	t	2026-07-09	2026-07-09 13:57:46.338456+00	2026-07-09 13:57:46.345726+00
3	2	SO-DEMO-003	B2BC-001	Metro Foods Trading Sdn Bhd	sales_order	issued	14	2026-07-09	2026-07-23	f	f		2026-07-09 13:57:46.357475+00	2026-07-09 13:57:46.360223+00
4	2	SO-DEMO-004	B2BC-002	Green Leaf Cafés Group	sales_order	expired	5	2026-07-01	2026-07-06	f	f		2026-07-09 13:57:46.365587+00	2026-07-09 13:57:46.394662+00
\.


--
-- Data for Name: CashPurchases; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public."CashPurchases" ("Id", "DatePurchased", "StoreName", "ComponentId", "ComponentName", "StoreProductName", "DeliveryUnit", "DeliveryPrice", "Quantity", "ComponentUom", "ReceiptNumber", "ReceiptFileName", "ReceiptFileBase64", "InventoryPurchaseId", "CompanyId", "LocationIdsJson", "CreatedAt") FROM stdin;
1	2026-07-02	Village Grocer	CMP-00FLOU-001	00 Flour	Italian Flour 00 Caputo	kg	10	2	kg	54651			2	1	["airport"]	2026-07-02 02:44:16.432222+00
2	2026-07-02	village grocer	CMP-00FLOU-001	00 Flour	Caputo flour 00	kg	11	1	kg	65464			3	1	["airport"]	2026-07-02 03:06:09.106456+00
\.


--
-- Data for Name: Companies; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public."Companies" ("Id", "Name", "Brn", "GstTin", "CountryCode", "AddressLine1", "AddressLine2", "City", "StateProvince", "Postcode", "Phone", "Fax", "Email", "Active", "BusinessTypesJson", "VendorPolicyTagsJson", "ModulesJson") FROM stdin;
2	Bisync Retail Pte Ltd	201934587N	GST-2019-34587	SG	20 Anson Road	#18-02	Singapore	Singapore	079912	+65 6123 4567	+65 6123 4568	sg@bisync.cloud	t	[]	[]	["RMS","POS","HRM","Accounting"]
3	Bisync Eats Australia Pty Ltd	ACN 665 910 224	ABN 19 665 910 224	AU	80 Collins Street	Level 9	Melbourne	Victoria	3000	+61 3 8456 1200	+61 3 8456 1201	au@bisync.cloud	t	[]	[]	["RMS","POS","HRM","Accounting"]
1	Bisync Hospitality Sdn Bhd	202301012345	SST-2023-00123456	MY	Level 12, Menara Bisync	Jalan Sultan Ismail	Kuala Lumpur	Wilayah Persekutuan	50250	+60 3-2145 6789	+60 3-2145 6790	hq@bisync.cloud	t	["Restaurant / Cafe / Bistro / Kiosk","Central Kitchen / Warehouse (supply only)"]	["muslim-friendly"]	["RMS","POS","HRM","Accounting"]
4	Test Company 102530	123	GST-1	MY	1 Jalan Test		KL	WP	50000			test@test.com	t	["Restaurant / Cafe / Bistro / Kiosk"]	["non-halal"]	["RMS","POS","HRM","Accounting"]
5	Weissbrau Sdn. Bhd.	200201022252		MY	1 Jalan Wan Kadir	Suite 05-05 Menara LGB	Kuala Lumpur	Wilayah Persekutuan	60000	+60321520288		info@out2dine.com.my	t	["Restaurant / Cafe / Bistro / Kiosk"]	["non-halal"]	["RMS","POS","HRM","Accounting"]
\.


--
-- Data for Name: CompanySettings; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public."CompanySettings" ("Id", "PublicHolidayPayMultiplier", "ReplacementPublicHolidayEnabled", "OperatingCountryCode", "GazettedPhReplacementDayEnabled", "GazettedPhNormalHoursRate", "GazettedPhOvertimeHoursRate", "NonGazettedPhReplacementDayEnabled") FROM stdin;
1	1.50	t	MY	t	1.50	2.00	f
\.


--
-- Data for Name: Departments; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public."Departments" ("Id", "Name", "DivisionId") FROM stdin;
1	Operations	1
2	Location Management	1
3	Kitchen	2
4	Finance	3
5	Retail	4
6	Merchandising	4
7	Customer Experience	4
8	People	5
9	Service	2
10	Operation	2
\.


--
-- Data for Name: DevelopmentMilestones; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public."DevelopmentMilestones" ("Id", "Phase", "Title", "Status", "ProgressPercent", "Notes", "UpdatedAt") FROM stdin;
1	Foundation	Figma design import	completed	100	Imported from Figma Make Bisync.cloud design	2026-06-25 00:57:32.265415+00
2	Foundation	C# API + SQLite database	completed	100	ASP.NET Core Web API with EF Core	2026-06-25 00:57:32.26557+00
3	Foundation	Local development environment	in_progress	80	localhost API + React client	2026-06-25 00:57:32.26557+00
4	Core	Dashboard API integration	in_progress	40	Locations, revenue, menu endpoints	2026-06-25 00:57:32.26557+00
5	Core	Revenue Management module	pending	10	Ingredients, vendors, purchase orders	2026-06-25 00:57:32.26557+00
6	Core	Point-of-Sales module	pending	0	\N	2026-06-25 00:57:32.26557+00
7	Platform	Authentication & multi-tenant	pending	0	\N	2026-06-25 00:57:32.26557+00
8	Platform	Production deployment	pending	0	\N	2026-06-25 00:57:32.26557+00
\.


--
-- Data for Name: Divisions; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public."Divisions" ("Id", "Name", "Code") FROM stdin;
1	Operations	OPS
2	Food & Beverage	FNB
3	Finance	FIN
4	Retail	RTL
5	Human Resources	HR
\.


--
-- Data for Name: EducationRecords; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public."EducationRecords" ("Id", "EmployeeId", "Degree", "Institution", "Year", "Certificate") FROM stdin;
\.


--
-- Data for Name: EmployeeLevels; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public."EmployeeLevels" ("Id", "LevelName", "AnnualLeaveDays", "SickLeaveDays", "OvertimeEligible", "WorkingHoursPerDay", "BreakHoursPerShift", "PublicHolidayEligible", "IsShift", "ShiftType", "Active") FROM stdin;
1	Junior	12	14	t	8.00	1.00	t	t	Morning Shift	t
2	Management	20	18	t	8.00	1.00	t	t	Flexible Shift	t
3	Director	28	30	f	8.00	1.00	f	f	\N	t
\.


--
-- Data for Name: EmployeeMovements; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public."EmployeeMovements" ("Id", "EmployeeId", "Date", "FromPosition", "ToPosition", "Type", "Department") FROM stdin;
\.


--
-- Data for Name: Employees; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public."Employees" ("Id", "EmployeeCode", "Name", "Email", "Mobile", "Department", "DivisionId", "DepartmentId", "Position", "JoinDate", "FingerprintEnrolled", "FaceRecognitionEnrolled", "IsShiftEmployee", "ShiftType", "PosEnabled", "PosPin", "PosPinMustChange", "PayrollPin", "PayrollPinMustChange", "BisyncEnabled", "Active", "CheckinMethod", "WorkingHoursPerDay", "EmployeeLevelId", "ReportsToId", "Nationality", "IdPassportNumber", "DateOfBirth", "PersonalEmail", "PermanentAddress", "MaritalStatus", "BankName", "BankAccountNumber", "BankAccountHolderName", "BaseSalary", "ServiceAllowance", "TransportAllowance", "AccommodationAllowance", "MobileAllowance", "OtherAllowancesJson", "WorkPermitByCompany", "TransportProvided", "TransportCarModel", "TransportPlateNumber", "AccommodationProvided", "AccommodationAddress", "AccommodationLeaseStart", "AccommodationLeaseEnd", "MobileProvided", "MobileAllowancePhone", "MobileProvider", "OvertimeAllowanceEnabled", "BonusEnabled", "BonusMonthly", "BonusAnnually", "BonusAmount", "BonusByBasicSalary", "BonusByService", "AccommodationLeasingPeriod") FROM stdin;
1	000001	James Dubois	james.dubois@bisync.cloud	+60 12-111 2233	Kitchen	2	3	Head Chef	2019-03-15	f	f	t	\N	t	1234	t	000000	t	t	t	POS	8.00	2	\N	Malaysian	\N	1988-04-12	\N	\N	\N	\N	\N	\N	8500.00	500.00	300.00	0.00	200.00	[]	\N	f	\N	\N	f	\N	\N	\N	f	\N	\N	t	f	f	f	\N	f	f	\N
2	000002	Sarah Chen	sarah.chen@bisync.cloud	+60 16-222 3344	Operations	1	1	Operations Manager	2020-06-01	f	f	t	\N	f	\N	f	000000	t	t	t	Biometrics	8.00	2	\N	Malaysian	\N	1985-09-03	\N	\N	\N	\N	\N	\N	12000.00	800.00	400.00	600.00	300.00	[]	\N	f	\N	\N	f	\N	\N	\N	f	\N	\N	f	f	f	f	\N	f	f	\N
3	000003	Ahmad Razali	ahmad.razali@bisync.cloud	+60 19-333 4455	Operations	1	1	Location Manager	2021-01-10	f	f	t	\N	f	\N	f	000000	t	t	t	Biometrics	8.00	2	\N	Malaysian	\N	1992-02-20	\N	\N	\N	\N	\N	\N	7000.00	400.00	300.00	0.00	150.00	[]	\N	f	\N	\N	f	\N	\N	\N	f	\N	\N	f	f	f	f	\N	f	f	\N
4	000004	Melissa Tan	melissa.tan@bisync.cloud	+60 17-444 5566	Finance	3	4	Finance Admin	2022-04-20	f	f	t	\N	f	\N	f	000000	t	t	t	Biometrics	8.00	1	\N	Malaysian	\N	1994-11-08	\N	\N	\N	\N	\N	\N	5500.00	300.00	200.00	0.00	100.00	[]	\N	f	\N	\N	f	\N	\N	\N	f	\N	\N	f	f	f	f	\N	f	f	\N
5	000005	Daniel Ong	daniel.ong@bisync.cloud	+60 18-555 6677	Kitchen	2	3	Sous Chef	2023-08-05	f	f	t	\N	t	1234	t	000000	t	t	t	Biometrics	8.00	2	\N	Malaysian	\N	1996-07-15	\N	\N	\N	\N	\N	\N	6000.00	350.00	250.00	0.00	150.00	[]	\N	f	\N	\N	f	\N	\N	\N	f	\N	\N	t	f	f	f	\N	f	f	\N
6	000006	Nadia Lim	nadia.lim@bisync.cloud	+65 8123 9901	Retail	4	5	Retail Lead	2020-02-14	f	f	t	\N	f	\N	f	000000	t	t	t	Biometrics	8.00	2	\N	Singaporean	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	[]	\N	f	\N	\N	f	\N	\N	\N	f	\N	\N	f	f	f	f	\N	f	f	\N
7	000007	Ethan Goh	ethan.goh@bisync.cloud	+65 8123 9902	Retail	4	5	Store Supervisor	2021-07-01	f	f	t	\N	t	1234	t	000000	t	t	t	Biometrics	8.00	2	\N	Singaporean	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	[]	\N	f	\N	\N	f	\N	\N	\N	f	\N	\N	f	f	f	f	\N	f	f	\N
8	000008	Priya Sharma	priya.sharma@bisync.cloud	+65 8123 9903	Merchandising	4	6	Category Manager	2022-03-18	f	f	t	\N	f	\N	f	000000	t	t	t	Biometrics	8.00	2	\N	Singaporean	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	[]	\N	f	\N	\N	f	\N	\N	\N	f	\N	\N	f	f	f	f	\N	f	f	\N
9	000009	Wei Ming Tan	wei.ming@bisync.cloud	+65 8123 9904	Operations	1	1	Inventory Coordinator	2022-11-09	f	f	t	\N	f	\N	f	000000	t	t	t	Biometrics	8.00	1	\N	Singaporean	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	[]	\N	f	\N	\N	f	\N	\N	\N	f	\N	\N	f	f	f	f	\N	f	f	\N
10	000010	Amelia Koh	amelia.koh@bisync.cloud	+65 8123 9905	Customer Experience	4	7	Floor Manager	2024-01-22	f	f	t	\N	f	\N	f	000000	t	t	t	Biometrics	8.00	2	\N	Singaporean	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	[]	\N	f	\N	\N	f	\N	\N	\N	f	\N	\N	f	f	f	f	\N	f	f	\N
11	000011	Olivia Brooks	olivia.brooks@bisync.cloud	+61 412 556 771	Operations	1	1	Regional Manager	2018-09-03	f	f	t	\N	f	\N	f	000000	t	t	t	Biometrics	8.00	2	\N	Australian	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	[]	\N	f	\N	\N	f	\N	\N	\N	f	\N	\N	f	f	f	f	\N	f	f	\N
12	000012	Liam Carter	liam.carter@bisync.cloud	+61 412 556 772	Operations	1	1	Operations Analyst	2021-05-17	f	f	t	\N	f	\N	f	000000	t	t	t	Biometrics	8.00	1	\N	Australian	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	[]	\N	f	\N	\N	f	\N	\N	\N	f	\N	\N	f	f	f	f	\N	f	f	\N
13	000013	Emma Wilson	emma.wilson@bisync.cloud	+61 412 556 773	Kitchen	2	3	Head Chef	2020-10-28	f	f	t	\N	t	1234	t	000000	t	t	t	Biometrics	8.00	2	\N	Australian	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	[]	\N	f	\N	\N	f	\N	\N	\N	f	\N	\N	f	f	f	f	\N	f	f	\N
14	000014	Noah Singh	noah.singh@bisync.cloud	+61 412 556 774	Finance	3	4	Payroll Officer	2023-02-06	f	f	t	\N	f	\N	f	000000	t	t	t	Biometrics	8.00	1	\N	Australian	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	[]	\N	f	\N	\N	f	\N	\N	\N	f	\N	\N	f	f	f	f	\N	f	f	\N
15	000015	Chloe Nguyen	chloe.nguyen@bisync.cloud	+61 412 556 775	People	5	8	HR Coordinator	2024-04-15	f	f	t	\N	f	\N	f	000000	t	t	t	Biometrics	8.00	1	\N	Australian	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	[]	\N	f	\N	\N	f	\N	\N	\N	f	\N	\N	f	f	f	f	\N	f	f	\N
16	000016	Daniel Ra	dra@test.com	+60126233503	Finance	3	4	Chief Executive Officer	2026-06-26	f	f	t	\N	f	\N	f	000000	t	f	t	Biometrics	8.00	1	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	[]	\N	f	\N	\N	f	\N	\N	\N	f	\N	\N	f	f	f	f	\N	f	f	\N
17	000017	Nurul Huda Osman	nurul.huda@bisync.cloud	+60 12-601 1001	Service	2	9	Service Manager	2018-05-12	f	f	t	\N	f	\N	f	000000	t	t	t	Biometrics	8.00	2	\N	Malaysian	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	[]	\N	f	\N	\N	f	\N	\N	\N	f	\N	\N	f	f	f	f	\N	f	f	\N
18	000018	Raj Kumar	raj.kumar@bisync.cloud	+60 12-601 1002	Service	2	9	Service Supervisor	2020-03-08	f	f	t	\N	t	1234	t	000000	t	t	t	Biometrics	8.00	2	\N	Malaysian	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	[]	\N	f	\N	\N	f	\N	\N	\N	f	\N	\N	f	f	f	f	\N	f	f	\N
19	000019	Siti Aminah Rahman	siti.aminah@bisync.cloud	+60 12-601 1003	Service	2	9	Waiter	2022-07-19	f	f	t	\N	t	1234	t	000000	t	t	t	Biometrics	8.00	1	\N	Malaysian	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	[]	\N	f	\N	\N	f	\N	\N	\N	f	\N	\N	f	f	f	f	\N	f	f	\N
20	000020	Wong Mei Ling	mei.ling@bisync.cloud	+60 12-601 1004	Service	2	9	Waiter	2022-09-03	f	f	t	\N	t	1234	t	000000	t	t	t	Biometrics	8.00	1	\N	Malaysian	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	[]	\N	f	\N	\N	f	\N	\N	\N	f	\N	\N	f	f	f	f	\N	f	f	\N
21	000021	Arif Hassan	arif.hassan@bisync.cloud	+60 12-601 1005	Service	2	9	Waiter	2023-01-16	f	f	t	\N	t	1234	t	000000	t	t	t	Biometrics	8.00	1	\N	Malaysian	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	[]	\N	f	\N	\N	f	\N	\N	\N	f	\N	\N	f	f	f	f	\N	f	f	\N
22	000022	Farah Izzati	farah.izzati@bisync.cloud	+60 12-601 1006	Service	2	9	Host	2023-04-22	f	f	t	\N	t	1234	t	000000	t	t	t	Biometrics	8.00	1	\N	Malaysian	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	[]	\N	f	\N	\N	f	\N	\N	\N	f	\N	\N	f	f	f	f	\N	f	f	\N
23	000023	Kevin Lim	kevin.lim@bisync.cloud	+60 12-601 1007	Service	2	9	Bartender	2021-11-30	f	f	t	\N	t	1234	t	000000	t	t	t	Biometrics	8.00	1	\N	Malaysian	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	[]	\N	f	\N	\N	f	\N	\N	\N	f	\N	\N	f	f	f	f	\N	f	f	\N
24	000024	Priya Menon	priya.menon@bisync.cloud	+60 12-601 1008	Service	2	9	Waiter	2024-02-05	f	f	t	\N	t	1234	t	000000	t	t	t	Biometrics	8.00	1	\N	Malaysian	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	[]	\N	f	\N	\N	f	\N	\N	\N	f	\N	\N	f	f	f	f	\N	f	f	\N
25	000025	Hakim Zulkifli	hakim.zulkifli@bisync.cloud	+60 12-601 1009	Service	2	9	Food Runner	2024-06-10	f	f	t	\N	t	1234	t	000000	t	t	t	Biometrics	8.00	1	\N	Malaysian	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	[]	\N	f	\N	\N	f	\N	\N	\N	f	\N	\N	f	f	f	f	\N	f	f	\N
26	000026	Michelle Tan	michelle.tan@bisync.cloud	+60 12-601 1010	Service	2	9	Captain	2019-08-14	f	f	t	\N	t	1234	t	000000	t	t	t	Biometrics	8.00	2	\N	Malaysian	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	[]	\N	f	\N	\N	f	\N	\N	\N	f	\N	\N	f	f	f	f	\N	f	f	\N
27	000027	Marco D'Silva	marco.silva@bisync.cloud	+60 12-602 2001	Kitchen	2	3	Line Cook	2021-06-07	f	f	t	\N	t	1234	t	000000	t	t	t	Biometrics	8.00	1	\N	Malaysian	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	[]	\N	f	\N	\N	f	\N	\N	\N	f	\N	\N	f	f	f	f	\N	f	f	\N
28	000028	Aisyah Rahman	aisyah.rahman@bisync.cloud	+60 12-602 2002	Kitchen	2	3	Prep Cook	2022-10-18	f	f	t	\N	t	1234	t	000000	t	t	t	Biometrics	8.00	1	\N	Malaysian	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	[]	\N	f	\N	\N	f	\N	\N	\N	f	\N	\N	f	f	f	f	\N	f	f	\N
29	000029	Lorraine Yeoh	lorraine.yeoh@bisync.cloud	+60 12-602 2003	Kitchen	2	3	Pastry Chef	2020-04-25	f	f	t	\N	t	1234	t	000000	t	t	t	Biometrics	8.00	2	\N	Malaysian	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	[]	\N	f	\N	\N	f	\N	\N	\N	f	\N	\N	f	f	f	f	\N	f	f	\N
30	000030	Vijay Nair	vijay.nair@bisync.cloud	+60 12-602 2004	Kitchen	2	3	Line Cook	2023-02-11	f	f	t	\N	t	1234	t	000000	t	t	t	Biometrics	8.00	1	\N	Malaysian	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	[]	\N	f	\N	\N	f	\N	\N	\N	f	\N	\N	f	f	f	f	\N	f	f	\N
31	000031	Adam Ismail	adam.ismail@bisync.cloud	+60 12-602 2005	Kitchen	2	3	Commis Chef	2023-09-01	f	f	t	\N	t	1234	t	000000	t	t	t	Biometrics	8.00	1	\N	Malaysian	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	[]	\N	f	\N	\N	f	\N	\N	\N	f	\N	\N	f	f	f	f	\N	f	f	\N
32	000032	Nur Izzati Kamal	nur.izzati@bisync.cloud	+60 12-602 2006	Kitchen	2	3	Kitchen Assistant	2024-03-20	f	f	t	\N	f	\N	f	000000	t	t	t	Biometrics	8.00	1	\N	Malaysian	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	[]	\N	f	\N	\N	f	\N	\N	\N	f	\N	\N	f	f	f	f	\N	f	f	\N
33	000033	Tan Boon Kiat	boon.kiat@bisync.cloud	+60 12-602 2007	Kitchen	2	3	Grill Cook	2022-05-09	f	f	t	\N	t	1234	t	000000	t	t	t	Biometrics	8.00	1	\N	Malaysian	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	[]	\N	f	\N	\N	f	\N	\N	\N	f	\N	\N	f	f	f	f	\N	f	f	\N
34	000034	Ravi Chandran	ravi.chandran@bisync.cloud	+60 12-602 2008	Kitchen	2	3	Kitchen Steward	2024-08-12	f	f	t	\N	f	\N	f	000000	t	t	t	Biometrics	8.00	1	\N	Malaysian	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	[]	\N	f	\N	\N	f	\N	\N	\N	f	\N	\N	f	f	f	f	\N	f	f	\N
35	000035	Daniel Ra	dra@cubevalue.com	+60126233503	Operation	2	10	CEO	2026-07-01	f	f	f	\N	f	\N	f	000000	t	f	t	Biometrics	8.00	3	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	[]	\N	f	\N	\N	f	\N	\N	\N	f	\N	\N	f	f	f	f	\N	f	f	\N
36	000036	Test Persist User	test.persist@bisync.cloud	+60 12-999 8877	Operation	2	10	Operations Coordinator	2026-06-01	f	f	f	\N	f	\N	f	000000	t	f	t	Biometrics	8.00	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	[]	\N	f	\N	\N	f	\N	\N	\N	f	\N	\N	f	f	f	f	\N	f	f	\N
\.


--
-- Data for Name: IncomeTaxBrackets; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public."IncomeTaxBrackets" ("Id", "IncomeTaxYearId", "SortOrder", "MinAnnualChargeableIncome", "MaxAnnualChargeableIncome", "RatePct", "BaseMinTaxAmount") FROM stdin;
1	1	0	0.00	5000.00	0.00	0.00
2	1	1	5000.00	20000.00	1.00	150.00
3	1	2	20000.00	35000.00	3.00	450.00
4	1	3	35000.00	50000.00	6.00	900.00
5	1	4	50000.00	70000.00	11.00	2200.00
6	1	5	70000.00	100000.00	19.00	5700.00
7	1	6	100000.00	250000.00	25.00	37500.00
8	1	7	250000.00	400000.00	26.00	39000.00
9	1	8	400000.00	600000.00	28.00	56000.00
10	1	9	600000.00	1000000.00	30.00	120000.00
11	1	10	1000000.00	\N	30.00	240000.00
\.


--
-- Data for Name: IncomeTaxRebates; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public."IncomeTaxRebates" ("Id", "IncomeTaxYearId", "SortOrder", "Name", "Amount") FROM stdin;
\.


--
-- Data for Name: IncomeTaxReliefs; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public."IncomeTaxReliefs" ("Id", "IncomeTaxYearId", "SortOrder", "Name", "Amount", "IsMaximum", "ApplyCondition") FROM stdin;
1	1	0	Individual & Dependent Relative	9000.00	f	Married
2	1	1	Medical Treatment (serious illness / Parents)	10000.00	t	\N
3	1	2	Life Insurance	7000.00	t	\N
4	1	3	Education Fees (self)	7000.00	f	\N
5	1	4	Lifestyle (Reading materials, computers, sports equipment)	2500.00	f	\N
6	1	5	SSPN (Net deposit for child's education)	8000.00	f	\N
\.


--
-- Data for Name: IncomeTaxYears; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public."IncomeTaxYears" ("Id", "CompanyId", "Year", "CountryCode", "Active") FROM stdin;
1	1	2026	MY	t
\.


--
-- Data for Name: Ingredients; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public."Ingredients" ("Id", "ComponentId", "Name", "Category", "Group", "RecipeUom", "InventoryUom", "LastPriceRecipe", "LastPriceInventory", "DailyUsage", "OrderFreqDays", "StorageJson", "StorageNote", "DetailConfigJson", "AttachedProducts", "AttachedVendors", "Active", "LocationsJson", "CreatedAt", "UpdatedAt") FROM stdin;
1	CMP-WAGYUB-001	Wagyu Beef A5	Food	Proteins	g	kg	0.021	42.0	2.4	3	["Freezer"]		{"altRecipeUnits":[],"altInventoryUnits":[],"convertFromInventoryQty":"1","convertToRecipeQty":"1","taggedVendorProductIds":["VP-CHX001","VP-WAG001"],"vendorProductPrincipalQty":{"VP-CHX001":"2000","VP-WAG001":"1000"},"vendorProductLossYield":{"VP-WAG001":"20"},"vendorProductComponentUom":{"VP-CHX001":"Gr","VP-WAG001":"Gr"},"vendorProductLocations":{"VP-CHX001":["airport","downtown","sg-marina","au-cbd","midtown","sg-orchard","au-southbank","westend"],"VP-WAG001":["airport","downtown","midtown","westend"]},"vendor":"Premium Meats Co.","vendorProduct":"Free-range Chicken Breast","deliveryUnitPrice":"42"}	3	2	t	["downtown","midtown"]	2026-07-08 04:46:19.959735	2026-07-08 04:46:20.057291
2	CMP-BLACKT-001	Black Truffle	Food	Produce	g	g	2.0	180.0	45.0	7	["Chiller"]		{"altRecipeUnits":[{"fromQty":"1","qty":"5","unit":"Slice"}],"altInventoryUnits":[],"convertFromInventoryQty":"1","convertToRecipeQty":"1","taggedVendorProductIds":["VP-TRU001"],"vendorProductPrincipalQty":{},"vendorProductLossYield":{"VP-TRU001":"10"},"vendorProductComponentUom":{},"vendorProductLocations":{"VP-TRU001":["downtown","airport"]},"vendor":"Fine Truffle Imports","vendorProduct":"Black Truffle","deliveryUnitPrice":"180"}	2	1	t	["downtown"]	2026-07-08 04:46:19.959735	2026-07-08 04:46:20.057291
3	CMP-BURRAT-001	Burrata	Food	Dairy	pcs	pcs	8.75	52.5	8.0	2	["Chiller"]		{"altRecipeUnits":[],"altInventoryUnits":[],"convertFromInventoryQty":"1","convertToRecipeQty":"1","taggedVendorProductIds":["VP-BUR001"],"vendorProductPrincipalQty":{"VP-BUR001":"6"},"vendorProductLossYield":{"VP-BUR001":"0"},"vendorProductComponentUom":{"VP-BUR001":"Each"},"vendorProductLocations":{"VP-BUR001":["airport","downtown"]},"vendor":"Artisan Dairy Co.","vendorProduct":"Burrata","deliveryUnitPrice":"52.5"}	4	1	t	["all"]	2026-07-08 04:46:19.959735	2026-07-08 04:46:20.057291
4	CMP-BAKEDB-001	Baked Beans	Food	Dry Goods	g	g	0.00875	42.0	0.0	7	["Dry Store","Chiller"]	Once Opened, keep in chiller	{"altRecipeUnits":[],"altInventoryUnits":[{"fromQty":"1","qty":"400","unit":"Tin"}],"convertFromInventoryQty":"1","convertToRecipeQty":"1","taggedVendorProductIds":["VP-BEA001","VP-BEA002"],"vendorProductPrincipalQty":{"VP-BEA001":"4800","VP-BEA002":"4560"},"vendorProductLossYield":{"VP-BEA001":"0","VP-BEA002":"0"},"vendorProductComponentUom":{"VP-BEA001":"Gr","VP-BEA002":"Gr"},"vendorProductLocations":{"VP-BEA001":["downtown","midtown"],"VP-BEA002":["airport","downtown","midtown","westend"]},"vendor":"Heritage Pantry Supply","vendorProduct":"Baked Beans","deliveryUnitPrice":"42"}	0	2	t	["all"]	2026-07-08 04:46:19.959735	2026-07-08 04:46:20.057291
5	CMP-LAMBRA-001	Lamb Rack	Food	Proteins	g	kg	0.95	95.0	1.8	4	["Chiller"]		{}	0	0	t	["all"]	2026-07-08 04:46:19.959735	2026-07-08 04:46:20.057291
6	CMP-DUCKBR-001	Duck Breast	Food	Proteins	g	kg	0.42	42.0	2.2	3	["Chiller"]		{}	0	0	t	["all"]	2026-07-08 04:46:19.959735	2026-07-08 04:46:20.057291
7	CMP-PORKBE-001	Pork Belly	Food	Proteins	g	kg	0.28	28.0	3.5	3	["Chiller"]		{}	0	0	t	["all"]	2026-07-08 04:46:19.959735	2026-07-08 04:46:20.057291
8	CMP-CHICKE-001	Chicken Thigh	Food	Proteins	g	kg	0.18	18.0	5.0	2	["Chiller"]		{}	0	0	t	["all"]	2026-07-08 04:46:19.959735	2026-07-08 04:46:20.057291
9	CMP-TIGERP-001	Tiger Prawns	Food	Seafood	g	kg	0.65	65.0	2.8	3	["Freezer"]		{}	0	0	t	["all"]	2026-07-08 04:46:19.959735	2026-07-08 04:46:20.057291
10	CMP-BLUEFI-001	Bluefin Tuna	Food	Seafood	g	kg	1.2	120.0	1.5	4	["Freezer"]		{}	0	0	t	["all"]	2026-07-08 04:46:19.959735	2026-07-08 04:46:20.057291
11	CMP-ATLANT-001	Atlantic Cod	Food	Seafood	g	kg	0.38	38.0	2.4	3	["Chiller"]		{}	0	0	t	["all"]	2026-07-08 04:46:19.959735	2026-07-08 04:46:20.057291
12	CMP-MOZZAR-001	Mozzarella Fior di Latte	Food	Dairy	g	kg	0.045	45.0	2.0	2	["Chiller"]		{}	0	0	t	["all"]	2026-07-08 04:46:19.959735	2026-07-08 04:46:20.057291
13	CMP-PARMES-001	Parmesan Reggiano	Food	Dairy	g	kg	0.12	120.0	0.8	7	["Chiller"]		{}	0	0	t	["all"]	2026-07-08 04:46:19.959735	2026-07-08 04:46:20.057291
14	CMP-UNSALT-001	Unsalted Butter	Food	Dairy	g	kg	0.035	35.0	1.2	5	["Chiller"]		{}	0	0	t	["all"]	2026-07-08 04:46:19.959735	2026-07-08 04:46:20.057291
15	CMP-HEAVYC-001	Heavy Cream	Food	Dairy	ml	l	0.018	18.0	3.5	3	["Chiller"]		{}	0	0	t	["all"]	2026-07-08 04:46:19.959735	2026-07-08 04:46:20.057291
16	CMP-FREERA-001	Free Range Eggs	Food	Dairy	pcs	pcs	0.85	0.85	120.0	2	["Chiller"]		{}	0	0	t	["all"]	2026-07-08 04:46:19.959735	2026-07-08 04:46:20.057291
17	CMP-ROCKET-001	Rocket Arugula	Food	Produce	g	kg	0.022	22.0	1.5	2	["Chiller"]		{}	0	0	t	["all"]	2026-07-08 04:46:19.959735	2026-07-08 04:46:20.057291
18	CMP-ROMATO-001	Roma Tomatoes	Food	Produce	g	kg	0.008	8.0	4.0	2	["Chiller"]		{}	0	0	t	["all"]	2026-07-08 04:46:19.959735	2026-07-08 04:46:20.057291
19	CMP-YELLOW-001	Yellow Onions	Food	Produce	g	kg	0.004	4.0	3.0	3	["Dry Store"]		{}	0	0	t	["all"]	2026-07-08 04:46:19.959735	2026-07-08 04:46:20.057291
20	CMP-PEELED-001	Peeled Garlic	Food	Produce	g	kg	0.016842105263157894	16.0	0.6	5	["Chiller"]		{"altRecipeUnits":[],"altInventoryUnits":[],"convertFromInventoryQty":"1","convertToRecipeQty":"1","taggedVendorProductIds":["VP-GAR006"],"vendorProductPrincipalQty":{"VP-GAR006":"1000"},"vendorProductLossYield":{"VP-GAR006":"5"},"vendorProductComponentUom":{"VP-GAR006":"Gr"},"vendorProductLocations":{"VP-GAR006":["airport"]},"vendor":"Green Valley Produce","vendorProduct":"Peeled Garlic","deliveryUnitPrice":"16"}	0	1	t	["all"]	2026-07-08 04:46:19.959735	2026-07-08 04:46:20.057291
21	CMP-RUSSET-001	Russet Potatoes	Food	Produce	g	kg	0.003	3.0	8.0	4	["Dry Store"]		{}	0	0	t	["all"]	2026-07-08 04:46:19.959735	2026-07-08 04:46:20.057291
22	CMP-BASMAT-001	Basmati Rice	Food	Dry Goods	g	kg	0.006	6.0	2.5	7	["Dry Store"]		{}	0	0	t	["all"]	2026-07-08 04:46:19.959735	2026-07-08 04:46:20.057291
23	CMP-PENNEP-001	Penne Pasta	Food	Dry Goods	g	kg	0.005	5.0	3.0	10	["Dry Store"]		{}	0	0	t	["all"]	2026-07-08 04:46:19.959735	2026-07-08 04:46:20.057291
25	CMP-OLIVEO-001	Olive Oil Extra Virgin	Food	Dry Goods	ml	l	0.012	12.0	0.8	14	["Dry Store"]		{}	0	0	t	["all"]	2026-07-08 04:46:19.959735	2026-07-08 04:46:20.057291
26	CMP-BALSAM-001	Balsamic Vinegar	Food	Dry Goods	ml	l	0.025	25.0	0.3	21	["Dry Store"]		{}	0	0	t	["all"]	2026-07-08 04:46:19.959735	2026-07-08 04:46:20.057291
27	CMP-SEASAL-001	Sea Salt Flakes	Food	Dry Goods	g	kg	0.008	8.0	0.4	30	["Dry Store"]		{}	0	0	t	["all"]	2026-07-08 04:46:19.959735	2026-07-08 04:46:20.057291
28	CMP-BLACKP-001	Black Peppercorns	Food	Dry Goods	g	kg	0.035	35.0	0.2	30	["Dry Store"]		{}	0	0	t	["all"]	2026-07-08 04:46:19.959735	2026-07-08 04:46:20.057291
29	CMP-TOMATO-001	Tomato Passata	Food	Dry Goods	ml	l	0.006	6.0	2.2	7	["Dry Store"]		{}	0	0	t	["all"]	2026-07-08 04:46:19.959735	2026-07-08 04:46:20.057291
30	CMP-FRESHO-001	Fresh Orange Juice	Beverage	Beverages	ml	l	0.008	8.0	6.0	2	["Chiller"]		{}	0	0	t	["all"]	2026-07-08 04:46:19.959735	2026-07-08 04:46:20.057291
31	CMP-CRAFTI-001	Craft IPA Beer	Beverage	Spirits	ml	l	0.015	15.0	12.0	5	["Bar"]		{}	0	0	t	["all"]	2026-07-08 04:46:19.959735	2026-07-08 04:46:20.057291
32	CMP-HOUSER-001	House Red Wine	Beverage	Spirits	ml	l	0.012	12.0	4.0	7	["Wine Cellar"]		{}	0	0	t	["all"]	2026-07-08 04:46:19.959735	2026-07-08 04:46:20.057291
33	CMP-TONICW-001	Tonic Water	Beverage	Beverages	ml	l	0.005	5.0	8.0	4	["Bar"]		{}	0	0	t	["all"]	2026-07-08 04:46:19.959735	2026-07-08 04:46:20.057291
34	CMP-OATMIL-001	Oat Milk Barista	Beverage	Beverages	ml	l	0.007	7.0	5.0	3	["Chiller"]		{}	0	0	t	["all"]	2026-07-08 04:46:19.959735	2026-07-08 04:46:20.057291
71	CMP-SCDEMO-033	SC Demo Component 033	Food	Beverages	g	kg	0.3799	379.9	1.87	6	"Dry Store"		{}	0	0	t	["downtown","midtown","airport","westend"]	2026-07-08 04:46:19.959735	2026-07-08 04:46:20.057291
72	CMP-SCDEMO-034	SC Demo Component 034	Food	Packaging	ml	l	0.5336	533.6	3.48	7	"Chiller"		{}	0	0	t	["downtown","midtown","airport","westend"]	2026-07-08 04:46:19.959735	2026-07-08 04:46:20.057291
35	CMP-YOGURT-001	Yogurt Strawberry	Food	Dairy	pcs	pcs	2.625	42.0	0.0	7	["Chiller"]		{"altRecipeUnits":[],"altInventoryUnits":[],"convertFromInventoryQty":"1","convertToRecipeQty":"1","taggedVendorProductIds":["VP-032FERN001"],"vendorProductPrincipalQty":{"VP-032FERN001":"16"},"vendorProductLossYield":{"VP-032FERN001":"0"},"vendorProductComponentUom":{"VP-032FERN001":"Each"},"vendorProductLocations":{"VP-032FERN001":["airport"]},"vendor":"Malaysian Yogurt Company","vendorProduct":"Fernleaf Yogurt Strawberry","deliveryUnitPrice":"42"}	0	1	t	["all"]	2026-07-08 04:46:19.959735	2026-07-08 04:46:20.057291
36	CMP-SPAGHE-001	Spaghetti No. 5	Food	Dry Goods	g	kg	0.006	30.0	0.0	7	["Dry Store"]		{"altRecipeUnits":[],"altInventoryUnits":[{"fromQty":"1","qty":"0.5","unit":"Tray"}],"convertFromInventoryQty":"1","convertToRecipeQty":"1000","taggedVendorProductIds":["VP-SPG019"],"vendorProductPrincipalQty":{},"vendorProductLossYield":{},"vendorProductComponentUom":{},"vendorProductLocations":{"VP-SPG019":["airport","downtown","midtown","westend"]},"vendor":"Noodle House Supply","vendorProduct":"Spaghetti","deliveryUnitPrice":"30"}	0	1	t	["airport","downtown","midtown","westend"]	2026-07-08 04:46:19.959735	2026-07-08 04:46:20.057291
37	CMP-CHILIF-001	Chili Flakes	Food	Dry Goods	g	kg	0.0	0.0	0.0	7	["Dry Store"]		{"altRecipeUnits":[],"altInventoryUnits":[],"convertFromInventoryQty":"1","convertToRecipeQty":"1000","taggedVendorProductIds":[],"vendorProductPrincipalQty":{},"vendorProductLossYield":{},"vendorProductComponentUom":{},"vendorProductLocations":{},"vendor":"","vendorProduct":"","deliveryUnitPrice":"0"}	0	0	t	["airport","downtown","midtown","westend"]	2026-07-08 04:46:19.959735	2026-07-08 04:46:20.057291
38	CMP-PAPRIK-001	Paprika	Food	Dry Goods	g	kg	0.0	0.0	0.0	7	["Dry Store"]		{"altRecipeUnits":[],"altInventoryUnits":[],"convertFromInventoryQty":"1","convertToRecipeQty":"1000","taggedVendorProductIds":[],"vendorProductPrincipalQty":{},"vendorProductLossYield":{},"vendorProductComponentUom":{},"vendorProductLocations":{},"vendor":"","vendorProduct":"","deliveryUnitPrice":"0"}	0	0	t	["airport","downtown","midtown","westend"]	2026-07-08 04:46:19.959735	2026-07-08 04:46:20.057291
39	CMP-SCDEMO-001	SC Demo Component 001	Food	Produce	ml	l	1.498	1498.0	1.3	4	"Dry Store"		{}	0	0	t	["downtown","midtown","airport","westend"]	2026-07-08 04:46:19.959735	2026-07-08 04:46:20.057291
40	CMP-SCDEMO-002	SC Demo Component 002	Food	Dairy	pcs	pcs	0.9651	0.9651	2.71	5	"Chiller"		{}	0	0	t	["downtown","midtown","airport","westend"]	2026-07-08 04:46:19.959735	2026-07-08 04:46:20.057291
41	CMP-SCDEMO-003	SC Demo Component 003	Food	Dry Goods	g	kg	0.682	682.0	3.05	6	"Dry Store"		{}	0	0	t	["downtown","midtown","airport","westend"]	2026-07-08 04:46:19.959735	2026-07-08 04:46:20.057291
42	CMP-SCDEMO-004	SC Demo Component 004	Food	Seafood	ml	l	2.0013	2001.3	1.49	7	"Chiller"		{}	0	0	t	["downtown","midtown","airport","westend"]	2026-07-08 04:46:19.959735	2026-07-08 04:46:20.057291
43	CMP-SCDEMO-005	SC Demo Component 005	Food	Beverages	pcs	pcs	1.6925	1.6925	0.66	3	"Dry Store"		{}	0	0	t	["downtown","midtown","airport","westend"]	2026-07-08 04:46:19.959735	2026-07-08 04:46:20.057291
44	CMP-SCDEMO-006	SC Demo Component 006	Food	Packaging	g	kg	0.8389	838.9	1.29	4	"Chiller"		{}	0	0	t	["downtown","midtown","airport","westend"]	2026-07-08 04:46:19.959735	2026-07-08 04:46:20.057291
45	CMP-SCDEMO-007	SC Demo Component 007	Food	Proteins	ml	l	1.4537	1453.7	2.06	5	"Dry Store"		{}	0	0	t	["downtown","midtown","airport","westend"]	2026-07-08 04:46:19.959735	2026-07-08 04:46:20.057291
46	CMP-SCDEMO-008	SC Demo Component 008	Food	Produce	pcs	pcs	0.0507	0.0507	3.78	6	"Chiller"		{}	0	0	t	["downtown","midtown","airport","westend"]	2026-07-08 04:46:19.959735	2026-07-08 04:46:20.057291
47	CMP-SCDEMO-009	SC Demo Component 009	Food	Dairy	g	kg	0.9809	980.9	3.94	7	"Dry Store"		{}	0	0	t	["downtown","midtown","airport","westend"]	2026-07-08 04:46:19.959735	2026-07-08 04:46:20.057291
48	CMP-SCDEMO-010	SC Demo Component 010	Food	Dry Goods	ml	l	1.6417	1641.7	1.71	3	"Chiller"		{}	0	0	t	["downtown","midtown","airport","westend"]	2026-07-08 04:46:19.959735	2026-07-08 04:46:20.057291
49	CMP-SCDEMO-011	SC Demo Component 011	Food	Seafood	pcs	pcs	0.4035	0.4035	2.81	4	"Dry Store"		{}	0	0	t	["downtown","midtown","airport","westend"]	2026-07-08 04:46:19.959735	2026-07-08 04:46:20.057291
50	CMP-SCDEMO-012	SC Demo Component 012	Food	Beverages	g	kg	0.4827	482.7	3.78	5	"Chiller"		{}	0	0	t	["downtown","midtown","airport","westend"]	2026-07-08 04:46:19.959735	2026-07-08 04:46:20.057291
51	CMP-SCDEMO-013	SC Demo Component 013	Food	Packaging	ml	l	1.1059	1105.9	0.86	6	"Dry Store"		{}	0	0	t	["downtown","midtown","airport","westend"]	2026-07-08 04:46:19.959735	2026-07-08 04:46:20.057291
52	CMP-SCDEMO-014	SC Demo Component 014	Food	Proteins	pcs	pcs	0.4922	0.4922	5.2	7	"Chiller"		{}	0	0	t	["downtown","midtown","airport","westend"]	2026-07-08 04:46:19.959735	2026-07-08 04:46:20.057291
53	CMP-SCDEMO-015	SC Demo Component 015	Food	Produce	g	kg	0.3499	349.9	0.58	3	"Dry Store"		{}	0	0	t	["downtown","midtown","airport","westend"]	2026-07-08 04:46:19.959735	2026-07-08 04:46:20.057291
54	CMP-SCDEMO-016	SC Demo Component 016	Food	Dairy	ml	l	1.7847	1784.7	1.1	4	"Chiller"		{}	0	0	t	["downtown","midtown","airport","westend"]	2026-07-08 04:46:19.959735	2026-07-08 04:46:20.057291
55	CMP-SCDEMO-017	SC Demo Component 017	Food	Dry Goods	pcs	pcs	1.883	1.883	1.03	5	"Dry Store"		{}	0	0	t	["downtown","midtown","airport","westend"]	2026-07-08 04:46:19.959735	2026-07-08 04:46:20.057291
56	CMP-SCDEMO-018	SC Demo Component 018	Food	Seafood	g	kg	0.5299	529.9	1.6	6	"Chiller"		{}	0	0	t	["downtown","midtown","airport","westend"]	2026-07-08 04:46:19.959735	2026-07-08 04:46:20.057291
57	CMP-SCDEMO-019	SC Demo Component 019	Food	Beverages	ml	l	1.3927	1392.7	2.6	7	"Dry Store"		{}	0	0	t	["downtown","midtown","airport","westend"]	2026-07-08 04:46:19.959735	2026-07-08 04:46:20.057291
58	CMP-SCDEMO-020	SC Demo Component 020	Food	Packaging	pcs	pcs	1.9517	1.9517	0.97	3	"Chiller"		{}	0	0	t	["downtown","midtown","airport","westend"]	2026-07-08 04:46:19.959735	2026-07-08 04:46:20.057291
59	CMP-SCDEMO-021	SC Demo Component 021	Food	Proteins	g	kg	0.732	732.0	5.42	4	"Dry Store"		{}	0	0	t	["downtown","midtown","airport","westend"]	2026-07-08 04:46:19.959735	2026-07-08 04:46:20.057291
60	CMP-SCDEMO-022	SC Demo Component 022	Food	Produce	ml	l	1.4764	1476.4	4.7	5	"Chiller"		{}	0	0	t	["downtown","midtown","airport","westend"]	2026-07-08 04:46:19.959735	2026-07-08 04:46:20.057291
61	CMP-SCDEMO-023	SC Demo Component 023	Food	Dairy	pcs	pcs	2.0131	2.0131	5.28	6	"Dry Store"		{}	0	0	t	["downtown","midtown","airport","westend"]	2026-07-08 04:46:19.959735	2026-07-08 04:46:20.057291
62	CMP-SCDEMO-024	SC Demo Component 024	Food	Dry Goods	g	kg	1.3991	1399.1	3.09	7	"Chiller"		{}	0	0	t	["downtown","midtown","airport","westend"]	2026-07-08 04:46:19.959735	2026-07-08 04:46:20.057291
63	CMP-SCDEMO-025	SC Demo Component 025	Food	Seafood	ml	l	1.7876	1787.6	1.14	3	"Dry Store"		{}	0	0	t	["downtown","midtown","airport","westend"]	2026-07-08 04:46:19.959735	2026-07-08 04:46:20.057291
64	CMP-SCDEMO-026	SC Demo Component 026	Food	Beverages	pcs	pcs	1.3311	1.3311	4.71	4	"Chiller"		{}	0	0	t	["downtown","midtown","airport","westend"]	2026-07-08 04:46:19.959735	2026-07-08 04:46:20.057291
65	CMP-SCDEMO-027	SC Demo Component 027	Food	Packaging	g	kg	1.6432	1643.2	1.7	5	"Dry Store"		{}	0	0	t	["downtown","midtown","airport","westend"]	2026-07-08 04:46:19.959735	2026-07-08 04:46:20.057291
66	CMP-SCDEMO-028	SC Demo Component 028	Food	Proteins	ml	l	0.1343	134.3	1.81	6	"Chiller"		{}	0	0	t	["downtown","midtown","airport","westend"]	2026-07-08 04:46:19.959735	2026-07-08 04:46:20.057291
67	CMP-SCDEMO-029	SC Demo Component 029	Food	Produce	pcs	pcs	1.9368	1.9368	4.51	7	"Dry Store"		{}	0	0	t	["downtown","midtown","airport","westend"]	2026-07-08 04:46:19.959735	2026-07-08 04:46:20.057291
68	CMP-SCDEMO-030	SC Demo Component 030	Food	Dairy	g	kg	1.8779	1877.9	1.72	3	"Chiller"		{}	0	0	t	["downtown","midtown","airport","westend"]	2026-07-08 04:46:19.959735	2026-07-08 04:46:20.057291
69	CMP-SCDEMO-031	SC Demo Component 031	Food	Dry Goods	ml	l	0.6281	628.1	0.68	4	"Dry Store"		{}	0	0	t	["downtown","midtown","airport","westend"]	2026-07-08 04:46:19.959735	2026-07-08 04:46:20.057291
70	CMP-SCDEMO-032	SC Demo Component 032	Food	Seafood	pcs	pcs	0.1446	0.1446	4.53	5	"Chiller"		{}	0	0	t	["downtown","midtown","airport","westend"]	2026-07-08 04:46:19.959735	2026-07-08 04:46:20.057291
73	CMP-SCDEMO-035	SC Demo Component 035	Food	Proteins	pcs	pcs	0.1948	0.1948	4.4	3	"Dry Store"		{}	0	0	t	["downtown","midtown","airport","westend"]	2026-07-08 04:46:19.959735	2026-07-08 04:46:20.057291
74	CMP-SCDEMO-036	SC Demo Component 036	Food	Produce	g	kg	2.0176	2017.6	0.73	4	"Chiller"		{}	0	0	t	["downtown","midtown","airport","westend"]	2026-07-08 04:46:19.959735	2026-07-08 04:46:20.057291
75	CMP-SCDEMO-037	SC Demo Component 037	Food	Dairy	ml	l	1.5225	1522.5	4.01	5	"Dry Store"		{}	0	0	t	["downtown","midtown","airport","westend"]	2026-07-08 04:46:19.959735	2026-07-08 04:46:20.057291
76	CMP-SCDEMO-038	SC Demo Component 038	Food	Dry Goods	pcs	pcs	1.8537	1.8537	1.46	6	"Chiller"		{}	0	0	t	["downtown","midtown","airport","westend"]	2026-07-08 04:46:19.959735	2026-07-08 04:46:20.057291
77	CMP-SCDEMO-039	SC Demo Component 039	Food	Seafood	g	kg	1.5464	1546.4	2.38	7	"Dry Store"		{}	0	0	t	["downtown","midtown","airport","westend"]	2026-07-08 04:46:19.959735	2026-07-08 04:46:20.057291
78	CMP-SCDEMO-040	SC Demo Component 040	Food	Beverages	ml	l	1.3981	1398.1	3.36	3	"Chiller"		{}	0	0	t	["downtown","midtown","airport","westend"]	2026-07-08 04:46:19.959735	2026-07-08 04:46:20.057291
79	CMP-SCDEMO-041	SC Demo Component 041	Food	Packaging	pcs	pcs	0.8446	0.8446	4.01	4	"Dry Store"		{}	0	0	t	["downtown","midtown","airport","westend"]	2026-07-08 04:46:19.959735	2026-07-08 04:46:20.057291
80	CMP-SCDEMO-042	SC Demo Component 042	Food	Proteins	g	kg	0.1916	191.6	0.61	5	"Chiller"		{}	0	0	t	["downtown","midtown","airport","westend"]	2026-07-08 04:46:19.959735	2026-07-08 04:46:20.057291
81	CMP-SCDEMO-043	SC Demo Component 043	Food	Produce	ml	l	0.8011	801.1	0.63	6	"Dry Store"		{}	0	0	t	["downtown","midtown","airport","westend"]	2026-07-08 04:46:19.959735	2026-07-08 04:46:20.057291
82	CMP-SCDEMO-044	SC Demo Component 044	Food	Dairy	pcs	pcs	0.6974	0.6974	3.88	7	"Chiller"		{}	0	0	t	["downtown","midtown","airport","westend"]	2026-07-08 04:46:19.959735	2026-07-08 04:46:20.057291
83	CMP-SCDEMO-045	SC Demo Component 045	Food	Dry Goods	g	kg	0.176	176.0	5.39	3	"Dry Store"		{}	0	0	t	["downtown","midtown","airport","westend"]	2026-07-08 04:46:19.959735	2026-07-08 04:46:20.057291
84	CMP-SCDEMO-046	SC Demo Component 046	Food	Seafood	ml	l	0.6026	602.6	4.85	4	"Chiller"		{}	0	0	t	["downtown","midtown","airport","westend"]	2026-07-08 04:46:19.959735	2026-07-08 04:46:20.057291
85	CMP-SCDEMO-047	SC Demo Component 047	Food	Beverages	pcs	pcs	1.0628	1.0628	4.03	5	"Dry Store"		{}	0	0	t	["downtown","midtown","airport","westend"]	2026-07-08 04:46:19.959735	2026-07-08 04:46:20.057291
86	CMP-SCDEMO-048	SC Demo Component 048	Food	Packaging	g	kg	1.659	1659.0	2.02	6	"Chiller"		{}	0	0	t	["downtown","midtown","airport","westend"]	2026-07-08 04:46:19.959735	2026-07-08 04:46:20.057291
87	CMP-SCDEMO-049	SC Demo Component 049	Food	Proteins	ml	l	1.9236	1923.6	5.04	7	"Dry Store"		{}	0	0	t	["downtown","midtown","airport","westend"]	2026-07-08 04:46:19.959735	2026-07-08 04:46:20.057291
88	CMP-SCDEMO-050	SC Demo Component 050	Food	Produce	pcs	pcs	1.401	1.401	4.04	3	"Chiller"		{}	0	0	t	["downtown","midtown","airport","westend"]	2026-07-08 04:46:19.959735	2026-07-08 04:46:20.057291
89	CMP-SCDEMO-051	SC Demo Component 051	Food	Dairy	g	kg	1.4783	1478.3	0.89	4	"Dry Store"		{}	0	0	t	["downtown","midtown","airport","westend"]	2026-07-08 04:46:19.959735	2026-07-08 04:46:20.057291
90	CMP-SCDEMO-052	SC Demo Component 052	Food	Dry Goods	ml	l	0.9428	942.8	0.94	5	"Chiller"		{}	0	0	t	["downtown","midtown","airport","westend"]	2026-07-08 04:46:19.959735	2026-07-08 04:46:20.057291
91	CMP-SCDEMO-053	SC Demo Component 053	Food	Seafood	pcs	pcs	0.3383	0.3383	3.48	6	"Dry Store"		{}	0	0	t	["downtown","midtown","airport","westend"]	2026-07-08 04:46:19.959735	2026-07-08 04:46:20.057291
92	CMP-SCDEMO-054	SC Demo Component 054	Food	Beverages	g	kg	0.2615	261.5	0.97	7	"Chiller"		{}	0	0	t	["downtown","midtown","airport","westend"]	2026-07-08 04:46:19.959735	2026-07-08 04:46:20.057291
93	CMP-SCDEMO-055	SC Demo Component 055	Food	Packaging	ml	l	0.7275	727.5	4.75	3	"Dry Store"		{}	0	0	t	["downtown","midtown","airport","westend"]	2026-07-08 04:46:19.959735	2026-07-08 04:46:20.057291
94	CMP-SCDEMO-056	SC Demo Component 056	Food	Proteins	pcs	pcs	1.0789	1.0789	3.34	4	"Chiller"		{}	0	0	t	["downtown","midtown","airport","westend"]	2026-07-08 04:46:19.959735	2026-07-08 04:46:20.057291
95	CMP-SCDEMO-057	SC Demo Component 057	Food	Produce	g	kg	0.3057	305.7	2.21	5	"Dry Store"		{}	0	0	t	["downtown","midtown","airport","westend"]	2026-07-08 04:46:19.959735	2026-07-08 04:46:20.057291
96	CMP-SCDEMO-058	SC Demo Component 058	Food	Dairy	ml	l	1.7438	1743.8	3.43	6	"Chiller"		{}	0	0	t	["downtown","midtown","airport","westend"]	2026-07-08 04:46:19.959735	2026-07-08 04:46:20.057291
97	CMP-SCDEMO-059	SC Demo Component 059	Food	Dry Goods	pcs	pcs	1.9806	1.9806	0.63	7	"Dry Store"		{}	0	0	t	["downtown","midtown","airport","westend"]	2026-07-08 04:46:19.959735	2026-07-08 04:46:20.057291
98	CMP-SCDEMO-060	SC Demo Component 060	Food	Seafood	g	kg	0.9093	909.3	1.2	3	"Chiller"		{}	0	0	t	["downtown","midtown","airport","westend"]	2026-07-08 04:46:19.959735	2026-07-08 04:46:20.057291
99	CMP-SCDEMO-061	SC Demo Component 061	Food	Beverages	ml	l	1.9509	1950.9	3.33	4	"Dry Store"		{}	0	0	t	["downtown","midtown","airport","westend"]	2026-07-08 04:46:19.959735	2026-07-08 04:46:20.057291
100	CMP-SCDEMO-062	SC Demo Component 062	Food	Packaging	pcs	pcs	1.1173	1.1173	0.98	5	"Chiller"		{}	0	0	t	["downtown","midtown","airport","westend"]	2026-07-08 04:46:19.959735	2026-07-08 04:46:20.057291
101	CMP-SCDEMO-063	SC Demo Component 063	Food	Proteins	g	kg	1.0587	1058.7	1.07	6	"Dry Store"		{}	0	0	t	["downtown","midtown","airport","westend"]	2026-07-08 04:46:19.959735	2026-07-08 04:46:20.057291
102	CMP-SCDEMO-064	SC Demo Component 064	Food	Produce	ml	l	1.1275	1127.5	0.65	7	"Chiller"		{}	0	0	t	["downtown","midtown","airport","westend"]	2026-07-08 04:46:19.959735	2026-07-08 04:46:20.057291
103	CMP-SCDEMO-065	SC Demo Component 065	Food	Dairy	pcs	pcs	1.8455	1.8455	3.48	3	"Dry Store"		{}	0	0	t	["downtown","midtown","airport","westend"]	2026-07-08 04:46:19.959735	2026-07-08 04:46:20.057291
104	CMP-SCDEMO-066	SC Demo Component 066	Food	Dry Goods	g	kg	0.5616	561.6	4.7	4	"Chiller"		{}	0	0	t	["downtown","midtown","airport","westend"]	2026-07-08 04:46:19.959735	2026-07-08 04:46:20.057291
105	CMP-SCDEMO-067	SC Demo Component 067	Food	Seafood	ml	l	1.4508	1450.8	5.33	5	"Dry Store"		{}	0	0	t	["downtown","midtown","airport","westend"]	2026-07-08 04:46:19.959735	2026-07-08 04:46:20.057291
106	CMP-SCDEMO-068	SC Demo Component 068	Food	Beverages	pcs	pcs	1.7658	1.7658	2.1	6	"Chiller"		{}	0	0	t	["downtown","midtown","airport","westend"]	2026-07-08 04:46:19.959735	2026-07-08 04:46:20.057291
107	CMP-SCDEMO-069	SC Demo Component 069	Food	Packaging	g	kg	0.5618	561.8	5.41	7	"Dry Store"		{}	0	0	t	["downtown","midtown","airport","westend"]	2026-07-08 04:46:19.959735	2026-07-08 04:46:20.057291
108	CMP-SCDEMO-070	SC Demo Component 070	Food	Proteins	ml	l	1.8058	1805.8	4.4	3	"Chiller"		{}	0	0	t	["downtown","midtown","airport","westend"]	2026-07-08 04:46:19.959735	2026-07-08 04:46:20.057291
109	CMP-SCDEMO-071	SC Demo Component 071	Food	Produce	pcs	pcs	1.8892	1.8892	1.65	4	"Dry Store"		{}	0	0	t	["downtown","midtown","airport","westend"]	2026-07-08 04:46:19.959735	2026-07-08 04:46:20.057291
110	CMP-SCDEMO-072	SC Demo Component 072	Food	Dairy	g	kg	0.7242	724.2	1.57	5	"Chiller"		{}	0	0	t	["downtown","midtown","airport","westend"]	2026-07-08 04:46:19.959735	2026-07-08 04:46:20.057291
111	CMP-SCDEMO-073	SC Demo Component 073	Food	Dry Goods	ml	l	0.9758	975.8	4.04	6	"Dry Store"		{}	0	0	t	["downtown","midtown","airport","westend"]	2026-07-08 04:46:19.959735	2026-07-08 04:46:20.057291
112	CMP-SCDEMO-074	SC Demo Component 074	Food	Seafood	pcs	pcs	1.5331	1.5331	1.32	7	"Chiller"		{}	0	0	t	["downtown","midtown","airport","westend"]	2026-07-08 04:46:19.959735	2026-07-08 04:46:20.057291
113	CMP-SCDEMO-075	SC Demo Component 075	Food	Beverages	g	kg	1.7695	1769.5	1.59	3	"Dry Store"		{}	0	0	t	["downtown","midtown","airport","westend"]	2026-07-08 04:46:19.959735	2026-07-08 04:46:20.057291
114	CMP-SCDEMO-076	SC Demo Component 076	Food	Packaging	ml	l	0.7293	729.3	5.06	4	"Chiller"		{}	0	0	t	["downtown","midtown","airport","westend"]	2026-07-08 04:46:19.959735	2026-07-08 04:46:20.057291
115	CMP-SCDEMO-077	SC Demo Component 077	Food	Proteins	pcs	pcs	1.0067	1.0067	3.18	5	"Dry Store"		{}	0	0	t	["downtown","midtown","airport","westend"]	2026-07-08 04:46:19.959735	2026-07-08 04:46:20.057291
116	CMP-SCDEMO-078	SC Demo Component 078	Food	Produce	g	kg	1.5639	1563.9	1.24	6	"Chiller"		{}	0	0	t	["downtown","midtown","airport","westend"]	2026-07-08 04:46:19.959735	2026-07-08 04:46:20.057291
117	CMP-SCDEMO-079	SC Demo Component 079	Food	Dairy	ml	l	1.1384	1138.4	2.26	7	"Dry Store"		{}	0	0	t	["downtown","midtown","airport","westend"]	2026-07-08 04:46:19.959735	2026-07-08 04:46:20.057291
118	CMP-SCDEMO-080	SC Demo Component 080	Food	Dry Goods	pcs	pcs	1.2175	1.2175	0.65	3	"Chiller"		{}	0	0	t	["downtown","midtown","airport","westend"]	2026-07-08 04:46:19.959735	2026-07-08 04:46:20.057291
119	CMP-SCDEMO-081	SC Demo Component 081	Food	Seafood	g	kg	0.1634	163.4	0.88	4	"Dry Store"		{}	0	0	t	["downtown","midtown","airport","westend"]	2026-07-08 04:46:19.959735	2026-07-08 04:46:20.057291
120	CMP-SCDEMO-082	SC Demo Component 082	Food	Beverages	ml	l	0.4432	443.2	4.21	5	"Chiller"		{}	0	0	t	["downtown","midtown","airport","westend"]	2026-07-08 04:46:19.959735	2026-07-08 04:46:20.057291
121	CMP-SCDEMO-083	SC Demo Component 083	Food	Packaging	pcs	pcs	1.2373	1.2373	3.87	6	"Dry Store"		{}	0	0	t	["downtown","midtown","airport","westend"]	2026-07-08 04:46:19.959735	2026-07-08 04:46:20.057291
122	CMP-SCDEMO-084	SC Demo Component 084	Food	Proteins	g	kg	1.7842	1784.2	1.31	7	"Chiller"		{}	0	0	t	["downtown","midtown","airport","westend"]	2026-07-08 04:46:19.959735	2026-07-08 04:46:20.057291
123	CMP-SCDEMO-085	SC Demo Component 085	Food	Produce	ml	l	1.0181	1018.1	3.14	3	"Dry Store"		{}	0	0	t	["downtown","midtown","airport","westend"]	2026-07-08 04:46:19.959735	2026-07-08 04:46:20.057291
124	CMP-SCDEMO-086	SC Demo Component 086	Food	Dairy	pcs	pcs	0.7117	0.7117	5.41	4	"Chiller"		{}	0	0	t	["downtown","midtown","airport","westend"]	2026-07-08 04:46:19.959735	2026-07-08 04:46:20.057291
125	CMP-SCDEMO-087	SC Demo Component 087	Food	Dry Goods	g	kg	0.3448	344.8	3.75	5	"Dry Store"		{}	0	0	t	["downtown","midtown","airport","westend"]	2026-07-08 04:46:19.959735	2026-07-08 04:46:20.057291
126	CMP-SCDEMO-088	SC Demo Component 088	Food	Seafood	ml	l	0.4901	490.1	4.11	6	"Chiller"		{}	0	0	t	["downtown","midtown","airport","westend"]	2026-07-08 04:46:19.959735	2026-07-08 04:46:20.057291
127	CMP-SCDEMO-089	SC Demo Component 089	Food	Beverages	pcs	pcs	0.5076	0.5076	2.1	7	"Dry Store"		{}	0	0	t	["downtown","midtown","airport","westend"]	2026-07-08 04:46:19.959735	2026-07-08 04:46:20.057291
128	CMP-SCDEMO-090	SC Demo Component 090	Food	Packaging	g	kg	1.3143	1314.3	4.48	3	"Chiller"		{}	0	0	t	["downtown","midtown","airport","westend"]	2026-07-08 04:46:19.959735	2026-07-08 04:46:20.057291
129	CMP-SCDEMO-091	SC Demo Component 091	Food	Proteins	ml	l	0.7956	795.6	2.37	4	"Dry Store"		{}	0	0	t	["downtown","midtown","airport","westend"]	2026-07-08 04:46:19.959735	2026-07-08 04:46:20.057291
130	CMP-SCDEMO-092	SC Demo Component 092	Food	Produce	pcs	pcs	0.3898	0.3898	3.9	5	"Chiller"		{}	0	0	t	["downtown","midtown","airport","westend"]	2026-07-08 04:46:19.959735	2026-07-08 04:46:20.057291
131	CMP-SCDEMO-093	SC Demo Component 093	Food	Dairy	g	kg	0.5646	564.6	2.22	6	"Dry Store"		{}	0	0	t	["downtown","midtown","airport","westend"]	2026-07-08 04:46:19.959735	2026-07-08 04:46:20.057291
132	CMP-SCDEMO-094	SC Demo Component 094	Food	Dry Goods	ml	l	0.7737	773.7	1.32	7	"Chiller"		{}	0	0	t	["downtown","midtown","airport","westend"]	2026-07-08 04:46:19.959735	2026-07-08 04:46:20.057291
133	CMP-SCDEMO-095	SC Demo Component 095	Food	Seafood	pcs	pcs	0.4694	0.4694	4.05	3	"Dry Store"		{}	0	0	t	["downtown","midtown","airport","westend"]	2026-07-08 04:46:19.959735	2026-07-08 04:46:20.057291
134	CMP-SCDEMO-096	SC Demo Component 096	Food	Beverages	g	kg	1.6005	1600.5	5.02	4	"Chiller"		{}	0	0	t	["downtown","midtown","airport","westend"]	2026-07-08 04:46:19.959735	2026-07-08 04:46:20.057291
135	CMP-SCDEMO-097	SC Demo Component 097	Food	Packaging	ml	l	0.8479	847.9	4.74	5	"Dry Store"		{}	0	0	t	["downtown","midtown","airport","westend"]	2026-07-08 04:46:19.959735	2026-07-08 04:46:20.057291
136	CMP-SCDEMO-098	SC Demo Component 098	Food	Proteins	pcs	pcs	1.4968	1.4968	4.72	6	"Chiller"		{}	0	0	t	["downtown","midtown","airport","westend"]	2026-07-08 04:46:19.959735	2026-07-08 04:46:20.057291
137	CMP-SCDEMO-099	SC Demo Component 099	Food	Produce	g	kg	0.1156	115.6	3.48	7	"Dry Store"		{}	0	0	t	["downtown","midtown","airport","westend"]	2026-07-08 04:46:19.959735	2026-07-08 04:46:20.057291
138	CMP-SCDEMO-100	SC Demo Component 100	Food	Dairy	ml	l	1.2897	1289.7	4.44	3	"Chiller"		{}	0	0	t	["downtown","midtown","airport","westend"]	2026-07-08 04:46:19.959735	2026-07-08 04:46:20.057291
139	CMP-SCDEMO-101	SC Demo Component 101	Food	Dry Goods	pcs	pcs	1.7333	1.7333	3.4	4	"Dry Store"		{}	0	0	t	["downtown","midtown","airport","westend"]	2026-07-08 04:46:19.959735	2026-07-08 04:46:20.057291
140	CMP-SCDEMO-102	SC Demo Component 102	Food	Seafood	g	kg	1.4108	1410.8	2.16	5	"Chiller"		{}	0	0	t	["downtown","midtown","airport","westend"]	2026-07-08 04:46:19.959735	2026-07-08 04:46:20.057291
141	CMP-SCDEMO-103	SC Demo Component 103	Food	Beverages	ml	l	1.8238	1823.8	2.29	6	"Dry Store"		{}	0	0	t	["downtown","midtown","airport","westend"]	2026-07-08 04:46:19.959735	2026-07-08 04:46:20.057291
142	CMP-SCDEMO-104	SC Demo Component 104	Food	Packaging	pcs	pcs	1.5783	1.5783	4.64	7	"Chiller"		{}	0	0	t	["downtown","midtown","airport","westend"]	2026-07-08 04:46:19.959735	2026-07-08 04:46:20.057291
143	CMP-SCDEMO-105	SC Demo Component 105	Food	Proteins	g	kg	0.6816	681.6	0.68	3	"Dry Store"		{}	0	0	t	["downtown","midtown","airport","westend"]	2026-07-08 04:46:19.959735	2026-07-08 04:46:20.057291
144	CMP-SCDEMO-106	SC Demo Component 106	Food	Produce	ml	l	1.8888	1888.8	1.62	4	"Chiller"		{}	0	0	t	["downtown","midtown","airport","westend"]	2026-07-08 04:46:19.959735	2026-07-08 04:46:20.057291
145	CMP-SCDEMO-107	SC Demo Component 107	Food	Dairy	pcs	pcs	1.4884	1.4884	4.44	5	"Dry Store"		{}	0	0	t	["downtown","midtown","airport","westend"]	2026-07-08 04:46:19.959735	2026-07-08 04:46:20.057291
146	CMP-SCDEMO-108	SC Demo Component 108	Food	Dry Goods	g	kg	1.364	1364.0	3.91	6	"Chiller"		{}	0	0	t	["downtown","midtown","airport","westend"]	2026-07-08 04:46:19.959735	2026-07-08 04:46:20.057291
147	CMP-SCDEMO-109	SC Demo Component 109	Food	Seafood	ml	l	1.8625	1862.5	3.08	7	"Dry Store"		{}	0	0	t	["downtown","midtown","airport","westend"]	2026-07-08 04:46:19.959735	2026-07-08 04:46:20.057291
148	CMP-SCDEMO-110	SC Demo Component 110	Food	Beverages	pcs	pcs	1.0191	1.0191	1.75	3	"Chiller"		{}	0	0	t	["downtown","midtown","airport","westend"]	2026-07-08 04:46:19.959735	2026-07-08 04:46:20.057291
149	CMP-SCDEMO-111	SC Demo Component 111	Food	Packaging	g	kg	0.6747	674.7	4.01	4	"Dry Store"		{}	0	0	t	["downtown","midtown","airport","westend"]	2026-07-08 04:46:19.959735	2026-07-08 04:46:20.057291
150	CMP-SCDEMO-112	SC Demo Component 112	Food	Proteins	ml	l	1.953	1953.0	4.37	5	"Chiller"		{}	0	0	t	["downtown","midtown","airport","westend"]	2026-07-08 04:46:19.959735	2026-07-08 04:46:20.057291
151	CMP-SCDEMO-113	SC Demo Component 113	Food	Produce	pcs	pcs	1.5544	1.5544	2.63	6	"Dry Store"		{}	0	0	t	["downtown","midtown","airport","westend"]	2026-07-08 04:46:19.959735	2026-07-08 04:46:20.057291
152	CMP-SCDEMO-114	SC Demo Component 114	Food	Dairy	g	kg	1.2174	1217.4	2.0	7	"Chiller"		{}	0	0	t	["downtown","midtown","airport","westend"]	2026-07-08 04:46:19.959735	2026-07-08 04:46:20.057291
153	CMP-SCDEMO-115	SC Demo Component 115	Food	Dry Goods	ml	l	1.9023	1902.3	2.38	3	"Dry Store"		{}	0	0	t	["downtown","midtown","airport","westend"]	2026-07-08 04:46:19.959735	2026-07-08 04:46:20.057291
154	CMP-SCDEMO-116	SC Demo Component 116	Food	Seafood	pcs	pcs	1.4264	1.4264	3.67	4	"Chiller"		{}	0	0	t	["downtown","midtown","airport","westend"]	2026-07-08 04:46:19.959735	2026-07-08 04:46:20.057291
155	CMP-SCDEMO-117	SC Demo Component 117	Food	Beverages	g	kg	1.4506	1450.6	4.72	5	"Dry Store"		{}	0	0	t	["downtown","midtown","airport","westend"]	2026-07-08 04:46:19.959735	2026-07-08 04:46:20.057291
156	CMP-SCDEMO-118	SC Demo Component 118	Food	Packaging	ml	l	1.9578	1957.8	4.46	6	"Chiller"		{}	0	0	t	["downtown","midtown","airport","westend"]	2026-07-08 04:46:19.959735	2026-07-08 04:46:20.057291
157	CMP-SCDEMO-119	SC Demo Component 119	Food	Proteins	pcs	pcs	1.4378	1.4378	4.69	7	"Dry Store"		{}	0	0	t	["downtown","midtown","airport","westend"]	2026-07-08 04:46:19.959735	2026-07-08 04:46:20.057291
158	CMP-SCDEMO-120	SC Demo Component 120	Food	Produce	g	kg	1.6362	1636.2	5.0	3	"Chiller"		{}	0	0	t	["downtown","midtown","airport","westend"]	2026-07-08 04:46:19.959735	2026-07-08 04:46:20.057291
159	CMP-SCDEMO-121	SC Demo Component 121	Food	Dairy	ml	l	1.2102	1210.2	3.17	4	"Dry Store"		{}	0	0	t	["downtown","midtown","airport","westend"]	2026-07-08 04:46:19.959735	2026-07-08 04:46:20.057291
160	CMP-SCDEMO-122	SC Demo Component 122	Food	Dry Goods	pcs	pcs	1.7475	1.7475	1.37	5	"Chiller"		{}	0	0	t	["downtown","midtown","airport","westend"]	2026-07-08 04:46:19.959735	2026-07-08 04:46:20.057291
161	CMP-SCDEMO-123	SC Demo Component 123	Food	Seafood	g	kg	1.6305	1630.5	3.26	6	"Dry Store"		{}	0	0	t	["downtown","midtown","airport","westend"]	2026-07-08 04:46:19.959735	2026-07-08 04:46:20.057291
162	CMP-SCDEMO-124	SC Demo Component 124	Food	Beverages	ml	l	0.4208	420.8	3.55	7	"Chiller"		{}	0	0	t	["downtown","midtown","airport","westend"]	2026-07-08 04:46:19.959735	2026-07-08 04:46:20.057291
163	CMP-SCDEMO-125	SC Demo Component 125	Food	Packaging	pcs	pcs	0.4322	0.4322	0.7	3	"Dry Store"		{}	0	0	t	["downtown","midtown","airport","westend"]	2026-07-08 04:46:19.959735	2026-07-08 04:46:20.057291
164	CMP-SCDEMO-126	SC Demo Component 126	Food	Proteins	g	kg	1.9244	1924.4	3.08	4	"Chiller"		{}	0	0	t	["downtown","midtown","airport","westend"]	2026-07-08 04:46:19.959735	2026-07-08 04:46:20.057291
165	CMP-SCDEMO-127	SC Demo Component 127	Food	Produce	ml	l	0.2714	271.4	2.35	5	"Dry Store"		{}	0	0	t	["downtown","midtown","airport","westend"]	2026-07-08 04:46:19.959735	2026-07-08 04:46:20.057291
166	CMP-SCDEMO-128	SC Demo Component 128	Food	Dairy	pcs	pcs	1.0026	1.0026	1.2	6	"Chiller"		{}	0	0	t	["downtown","midtown","airport","westend"]	2026-07-08 04:46:19.959735	2026-07-08 04:46:20.057291
167	CMP-SCDEMO-129	SC Demo Component 129	Food	Dry Goods	g	kg	1.3077	1307.7	5.03	7	"Dry Store"		{}	0	0	t	["downtown","midtown","airport","westend"]	2026-07-08 04:46:19.959735	2026-07-08 04:46:20.057291
168	CMP-SCDEMO-130	SC Demo Component 130	Food	Seafood	ml	l	1.2101	1210.1	2.8	3	"Chiller"		{}	0	0	t	["downtown","midtown","airport","westend"]	2026-07-08 04:46:19.959735	2026-07-08 04:46:20.057291
169	CMP-SCDEMO-131	SC Demo Component 131	Food	Beverages	pcs	pcs	1.5967	1.5967	2.82	4	"Dry Store"		{}	0	0	t	["downtown","midtown","airport","westend"]	2026-07-08 04:46:19.959735	2026-07-08 04:46:20.057291
170	CMP-SCDEMO-132	SC Demo Component 132	Food	Packaging	g	kg	1.8552	1855.2	5.2	5	"Chiller"		{}	0	0	t	["downtown","midtown","airport","westend"]	2026-07-08 04:46:19.959735	2026-07-08 04:46:20.057291
171	CMP-SCDEMO-133	SC Demo Component 133	Food	Proteins	ml	l	0.7454	745.4	1.93	6	"Dry Store"		{}	0	0	t	["downtown","midtown","airport","westend"]	2026-07-08 04:46:19.959735	2026-07-08 04:46:20.057291
172	CMP-SCDEMO-134	SC Demo Component 134	Food	Produce	pcs	pcs	1.0975	1.0975	4.88	7	"Chiller"		{}	0	0	t	["downtown","midtown","airport","westend"]	2026-07-08 04:46:19.959735	2026-07-08 04:46:20.057291
173	CMP-SCDEMO-135	SC Demo Component 135	Food	Dairy	g	kg	1.7185	1718.5	4.82	3	"Dry Store"		{}	0	0	t	["downtown","midtown","airport","westend"]	2026-07-08 04:46:19.959735	2026-07-08 04:46:20.057291
174	CMP-SCDEMO-136	SC Demo Component 136	Food	Dry Goods	ml	l	2.027	2027.0	0.84	4	"Chiller"		{}	0	0	t	["downtown","midtown","airport","westend"]	2026-07-08 04:46:19.959735	2026-07-08 04:46:20.057291
175	CMP-SCDEMO-137	SC Demo Component 137	Food	Seafood	pcs	pcs	1.4969	1.4969	3.42	5	"Dry Store"		{}	0	0	t	["downtown","midtown","airport","westend"]	2026-07-08 04:46:19.959735	2026-07-08 04:46:20.057291
176	CMP-SCDEMO-138	SC Demo Component 138	Food	Beverages	g	kg	1.3886	1388.6	4.4	6	"Chiller"		{}	0	0	t	["downtown","midtown","airport","westend"]	2026-07-08 04:46:19.959735	2026-07-08 04:46:20.057291
177	CMP-SCDEMO-139	SC Demo Component 139	Food	Packaging	ml	l	1.7576	1757.6	4.39	7	"Dry Store"		{}	0	0	t	["downtown","midtown","airport","westend"]	2026-07-08 04:46:19.959735	2026-07-08 04:46:20.057291
178	CMP-SCDEMO-140	SC Demo Component 140	Food	Proteins	pcs	pcs	2.0183	2.0183	1.51	3	"Chiller"		{}	0	0	t	["downtown","midtown","airport","westend"]	2026-07-08 04:46:19.959735	2026-07-08 04:46:20.057291
179	CMP-SCDEMO-141	SC Demo Component 141	Food	Produce	g	kg	0.5318	531.8	5.36	4	"Dry Store"		{}	0	0	t	["downtown","midtown","airport","westend"]	2026-07-08 04:46:19.959735	2026-07-08 04:46:20.057291
180	CMP-SCDEMO-142	SC Demo Component 142	Food	Dairy	ml	l	0.2663	266.3	4.93	5	"Chiller"		{}	0	0	t	["downtown","midtown","airport","westend"]	2026-07-08 04:46:19.959735	2026-07-08 04:46:20.057291
181	CMP-SCDEMO-143	SC Demo Component 143	Food	Dry Goods	pcs	pcs	0.9288	0.9288	1.36	6	"Dry Store"		{}	0	0	t	["downtown","midtown","airport","westend"]	2026-07-08 04:46:19.959735	2026-07-08 04:46:20.057291
182	CMP-SCDEMO-144	SC Demo Component 144	Food	Seafood	g	kg	1.0957	1095.7	2.15	7	"Chiller"		{}	0	0	t	["downtown","midtown","airport","westend"]	2026-07-08 04:46:19.959735	2026-07-08 04:46:20.057291
183	CMP-SCDEMO-145	SC Demo Component 145	Food	Beverages	ml	l	0.7844	784.4	4.57	3	"Dry Store"		{}	0	0	t	["downtown","midtown","airport","westend"]	2026-07-08 04:46:19.959735	2026-07-08 04:46:20.057291
184	CMP-SCDEMO-146	SC Demo Component 146	Food	Packaging	pcs	pcs	0.3771	0.3771	4.44	4	"Chiller"		{}	0	0	t	["downtown","midtown","airport","westend"]	2026-07-08 04:46:19.959735	2026-07-08 04:46:20.057291
185	CMP-SCDEMO-147	SC Demo Component 147	Food	Proteins	g	kg	0.5652	565.2	2.16	5	"Dry Store"		{}	0	0	t	["downtown","midtown","airport","westend"]	2026-07-08 04:46:19.959735	2026-07-08 04:46:20.057291
186	CMP-SCDEMO-148	SC Demo Component 148	Food	Produce	ml	l	0.3039	303.9	1.08	6	"Chiller"		{}	0	0	t	["downtown","midtown","airport","westend"]	2026-07-08 04:46:19.959735	2026-07-08 04:46:20.057291
187	CMP-SCDEMO-149	SC Demo Component 149	Food	Dairy	pcs	pcs	1.311	1.311	5.05	7	"Dry Store"		{}	0	0	t	["downtown","midtown","airport","westend"]	2026-07-08 04:46:19.959735	2026-07-08 04:46:20.057291
188	CMP-SCDEMO-150	SC Demo Component 150	Food	Dry Goods	g	kg	1.7022	1702.2	3.02	3	"Chiller"		{}	0	0	t	["downtown","midtown","airport","westend"]	2026-07-08 04:46:19.959735	2026-07-08 04:46:20.057291
189	CMP-SCDEMO-151	SC Demo Component 151	Food	Seafood	ml	l	0.105	105.0	2.05	4	"Dry Store"		{}	0	0	t	["downtown","midtown","airport","westend"]	2026-07-08 04:46:19.959735	2026-07-08 04:46:20.057291
190	CMP-SCDEMO-152	SC Demo Component 152	Food	Beverages	pcs	pcs	1.6031	1.6031	2.13	5	"Chiller"		{}	0	0	t	["downtown","midtown","airport","westend"]	2026-07-08 04:46:19.959735	2026-07-08 04:46:20.057291
191	CMP-SCDEMO-153	SC Demo Component 153	Food	Packaging	g	kg	0.155	155.0	4.84	6	"Dry Store"		{}	0	0	t	["downtown","midtown","airport","westend"]	2026-07-08 04:46:19.959735	2026-07-08 04:46:20.057291
192	CMP-SCDEMO-154	SC Demo Component 154	Food	Proteins	ml	l	1.6356	1635.6	3.13	7	"Chiller"		{}	0	0	t	["downtown","midtown","airport","westend"]	2026-07-08 04:46:19.959735	2026-07-08 04:46:20.057291
193	CMP-SCDEMO-155	SC Demo Component 155	Food	Produce	pcs	pcs	1.4523	1.4523	3.99	3	"Dry Store"		{}	0	0	t	["downtown","midtown","airport","westend"]	2026-07-08 04:46:19.959735	2026-07-08 04:46:20.057291
194	CMP-SCDEMO-156	SC Demo Component 156	Food	Dairy	g	kg	0.6206	620.6	4.76	4	"Chiller"		{}	0	0	t	["downtown","midtown","airport","westend"]	2026-07-08 04:46:19.959735	2026-07-08 04:46:20.057291
195	CMP-SCDEMO-157	SC Demo Component 157	Food	Dry Goods	ml	l	1.8937	1893.7	2.4	5	"Dry Store"		{}	0	0	t	["downtown","midtown","airport","westend"]	2026-07-08 04:46:19.959735	2026-07-08 04:46:20.057291
196	CMP-SCDEMO-158	SC Demo Component 158	Food	Seafood	pcs	pcs	0.4894	0.4894	4.5	6	"Chiller"		{}	0	0	t	["downtown","midtown","airport","westend"]	2026-07-08 04:46:19.959735	2026-07-08 04:46:20.057291
197	CMP-SCDEMO-159	SC Demo Component 159	Food	Beverages	g	kg	0.7635	763.5	0.59	7	"Dry Store"		{}	0	0	t	["downtown","midtown","airport","westend"]	2026-07-08 04:46:19.959735	2026-07-08 04:46:20.057291
198	CMP-SCDEMO-160	SC Demo Component 160	Food	Packaging	ml	l	1.0495	1049.5	1.38	3	"Chiller"		{}	0	0	t	["downtown","midtown","airport","westend"]	2026-07-08 04:46:19.959735	2026-07-08 04:46:20.057291
199	CMP-SCDEMO-161	SC Demo Component 161	Food	Proteins	pcs	pcs	1.576	1.576	1.47	4	"Dry Store"		{}	0	0	t	["downtown","midtown","airport","westend"]	2026-07-08 04:46:19.959735	2026-07-08 04:46:20.057291
200	CMP-SCDEMO-162	SC Demo Component 162	Food	Produce	g	kg	1.067	1067.0	0.6	5	"Chiller"		{}	0	0	t	["downtown","midtown","airport","westend"]	2026-07-08 04:46:19.959735	2026-07-08 04:46:20.057291
201	CMP-SCDEMO-163	SC Demo Component 163	Food	Dairy	ml	l	1.452	1452.0	1.5	6	"Dry Store"		{}	0	0	t	["downtown","midtown","airport","westend"]	2026-07-08 04:46:19.959735	2026-07-08 04:46:20.057291
202	CMP-SCDEMO-164	SC Demo Component 164	Food	Dry Goods	pcs	pcs	1.672	1.672	2.45	7	"Chiller"		{}	0	0	t	["downtown","midtown","airport","westend"]	2026-07-08 04:46:19.959735	2026-07-08 04:46:20.057291
203	CMP-SCDEMO-165	SC Demo Component 165	Food	Seafood	g	kg	0.9647	964.7	3.27	3	"Dry Store"		{}	0	0	t	["downtown","midtown","airport","westend"]	2026-07-08 04:46:19.959735	2026-07-08 04:46:20.057291
204	CMP-SCDEMO-166	SC Demo Component 166	Food	Beverages	ml	l	0.3475	347.5	5.22	4	"Chiller"		{}	0	0	t	["downtown","midtown","airport","westend"]	2026-07-08 04:46:19.959735	2026-07-08 04:46:20.057291
205	CMP-SCDEMO-167	SC Demo Component 167	Food	Packaging	pcs	pcs	1.9533	1.9533	2.9	5	"Dry Store"		{}	0	0	t	["downtown","midtown","airport","westend"]	2026-07-08 04:46:19.959735	2026-07-08 04:46:20.057291
206	CMP-SCDEMO-168	SC Demo Component 168	Food	Proteins	g	kg	0.397	397.0	5.16	6	"Chiller"		{}	0	0	t	["downtown","midtown","airport","westend"]	2026-07-08 04:46:19.959735	2026-07-08 04:46:20.057291
207	CMP-SCDEMO-169	SC Demo Component 169	Food	Produce	ml	l	0.4427	442.7	4.41	7	"Dry Store"		{}	0	0	t	["downtown","midtown","airport","westend"]	2026-07-08 04:46:19.959735	2026-07-08 04:46:20.057291
208	CMP-SCDEMO-170	SC Demo Component 170	Food	Dairy	pcs	pcs	1.7154	1.7154	3.35	3	"Chiller"		{}	0	0	t	["downtown","midtown","airport","westend"]	2026-07-08 04:46:19.959735	2026-07-08 04:46:20.057291
209	CMP-SCFIFO-001	SC FIFO Demo Wagyu	Food	Proteins	g	kg	0.042	42.0	2.5	3	["Chiller"]		{}	0	0	t	["downtown","midtown","airport","westend"]	2026-07-08 04:46:19.959735	2026-07-08 04:46:20.057291
210	CMP-CHILIR-001	Chili Red Fresh	Food	Dry Goods	g	kg	0	0	0	7	["Dry Store"]		{"altRecipeUnits":[],"altInventoryUnits":[],"convertFromInventoryQty":"1","convertToRecipeQty":"1000","taggedVendorProductIds":[],"vendorProductPrincipalQty":{},"vendorProductLossYield":{},"vendorProductComponentUom":{},"vendorProductLocations":{},"vendor":"","vendorProduct":"","deliveryUnitPrice":"0"}	0	0	t	["weissbrau-pavilion-kuala-lumpur"]	2026-07-08 04:46:19.959735	2026-07-08 04:46:20.057291
211	CMP-CHILIF-002	Chili Flake	Food	Dry Goods	g	kg	0	0	0	7	["Dry Store"]		{"altRecipeUnits":[],"altInventoryUnits":[],"convertFromInventoryQty":"1","convertToRecipeQty":"1000","taggedVendorProductIds":[],"vendorProductPrincipalQty":{},"vendorProductLossYield":{},"vendorProductComponentUom":{},"vendorProductLocations":{},"vendor":"","vendorProduct":"","deliveryUnitPrice":"0"}	0	0	t	["weissbrau-pavilion-kuala-lumpur"]	2026-07-08 04:46:19.959735	2026-07-08 04:46:20.057291
212	CMP-OREGAN-001	Oregano Dried	Food	Dry Goods	g	kg	0	0	0	7	["Dry Store"]		{"altRecipeUnits":[],"altInventoryUnits":[],"convertFromInventoryQty":"1","convertToRecipeQty":"1000","taggedVendorProductIds":[],"vendorProductPrincipalQty":{},"vendorProductLossYield":{},"vendorProductComponentUom":{},"vendorProductLocations":{},"vendor":"","vendorProduct":"","deliveryUnitPrice":"0"}	0	0	t	["weissbrau-pavilion-kuala-lumpur"]	2026-07-08 04:46:19.959735	2026-07-08 04:46:20.057291
213	CMP-CHICKE-002	Chicken Stock Powder	Food	Dry Goods	g	kg	0	0	0	7	["Dry Store"]		{"altRecipeUnits":[],"altInventoryUnits":[],"convertFromInventoryQty":"1","convertToRecipeQty":"1000","taggedVendorProductIds":[],"vendorProductPrincipalQty":{},"vendorProductLossYield":{},"vendorProductComponentUom":{},"vendorProductLocations":{},"vendor":"","vendorProduct":"","deliveryUnitPrice":"0"}	0	0	t	["weissbrau-pavilion-kuala-lumpur"]	2026-07-08 04:46:19.959735	2026-07-08 04:46:20.057291
214	CMP-WATERT-001	Water Tap	Food	Beverages	g	kg	0	0	0	7	["Dry Store"]		{"altRecipeUnits":[],"altInventoryUnits":[],"convertFromInventoryQty":"1","convertToRecipeQty":"1000","taggedVendorProductIds":[],"vendorProductPrincipalQty":{},"vendorProductLossYield":{},"vendorProductComponentUom":{},"vendorProductLocations":{},"vendor":"","vendorProduct":"","deliveryUnitPrice":"0"}	0	0	t	["weissbrau-pavilion-kuala-lumpur"]	2026-07-08 04:46:19.959735	2026-07-08 04:46:20.057291
215	CMP-SAUCEB-001	Sauce Bag 1kg	Food	Packaging	pcs	bunch	0	0	0	7	["Dry Store"]		{"altRecipeUnits":[],"altInventoryUnits":[],"convertFromInventoryQty":"1","convertToRecipeQty":"100","taggedVendorProductIds":[],"vendorProductPrincipalQty":{},"vendorProductLossYield":{},"vendorProductComponentUom":{},"vendorProductLocations":{},"vendor":"","vendorProduct":"","deliveryUnitPrice":"0"}	0	0	t	["weissbrau-pavilion-kuala-lumpur"]	2026-07-08 04:46:19.959735	2026-07-08 04:46:20.057291
24	CMP-00FLOU-001	00 Flour	Food	Dry Goods	g	kg	0.00208	52	4.0	14	["Dry Store"]		{"altRecipeUnits":[],"altInventoryUnits":[],"convertFromInventoryQty":"1","convertToRecipeQty":"1000","taggedVendorProductIds":["VP-FLR018","VP-FLR029","VP-FLR049"],"vendorProductPrincipalQty":{},"vendorProductLossYield":{},"vendorProductComponentUom":{},"vendorProductLocations":{"VP-FLR018":["airport","downtown","midtown","westend"],"VP-FLR029":["weissbrau-pavilion-kuala-lumpur"],"VP-FLR049":["weissbrau-pavilion-kuala-lumpur"]},"vendor":"Grain & Mill Co.","vendorProduct":"00 Flour","deliveryUnitPrice":"52"}	0	3	t	["all"]	2026-07-08 04:46:19.959735	2026-07-08 06:45:50.359824
216	CMP-BEEFRI-001	Beef Rib Bone-in	Food	Meat & Poultry	g	kg	0	0	0	7	["Prep Kitchen"]		{"altRecipeUnits":[],"altInventoryUnits":[],"convertFromInventoryQty":"1","convertToRecipeQty":"1000","taggedVendorProductIds":[],"vendorProductPrincipalQty":{},"vendorProductLossYield":{},"vendorProductComponentUom":{},"vendorProductLocations":{},"vendor":"","vendorProduct":"","deliveryUnitPrice":"0","splitUse":{"enabled":true,"componentQty":"10","qtyBasis":"inventory","lines":[{"key":"split-1783622902105-xi9rv","name":"Beef Rib Off Bone","qty":"8","inventoryUom":"Kg","valueAssigned":"","noValue":false},{"key":"split-1783622982413-j2qba","name":"Beef Bone","qty":"2","inventoryUom":"Kg","valueAssigned":"","noValue":true}]}}	0	0	t	["all"]	2026-07-10 02:51:07.696145	2026-07-10 02:51:07.696323
\.


--
-- Data for Name: InventoryAlerts; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public."InventoryAlerts" ("Id", "ItemName", "Stock", "Status", "Threshold") FROM stdin;
1	Wagyu Beef (A5)	1.2 kg	critical	2 kg
2	Black Truffle	180 g	low	250 g
3	Merlot Reserve 2019	4 btl	critical	6 btl
\.


--
-- Data for Name: InventoryCountSessionLines; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public."InventoryCountSessionLines" ("Id", "SessionId", "ItemType", "ItemKey", "ItemName", "GroupName", "Uom", "SystemQty", "CountedQty", "VarianceQty", "SystemUnitPrice") FROM stdin;
1	1	component	CMP-WAGYUB-001	Wagyu Beef A5	Proteins	kg	12.4	12.1	-0.3	42
2	1	component	CMP-BURRAT-001	Burrata	Dairy	pcs	26	24	-2	52.5
3	1	component	CMP-FRESHO-001	Fresh Orange Juice	Beverages	l	18.5	18.5	0	8
4	2	component	CMP-WAGYUB-001	Wagyu Beef A5	Proteins	kg	11.8	11.5	-0.3	42
5	2	component	CMP-BURRAT-001	Burrata	Dairy	pcs	22	20	-2	52.5
6	3	component	CMP-WAGYUB-001	Wagyu Beef A5	Proteins	kg	12.4	11.9	-0.5	42
7	3	component	CMP-BURRAT-001	Burrata	Dairy	pcs	26	25	-1	52.5
8	3	component	CMP-FRESHO-001	Fresh Orange Juice	Beverages	l	18.5	17.2	-1.3	8
9	3	component	CMP-BLACKT-001	Black Truffle	Produce	g	0.45	0.42	-0.03	180
10	4	component	CMP-WAGYUB-001	Wagyu Beef A5	Proteins	kg	11.2	11	-0.2	42
11	4	component	CMP-BURRAT-001	Burrata	Dairy	pcs	20	19	-1	52.5
12	4	component	CMP-FRESHO-001	Fresh Orange Juice	Beverages	l	16	15.5	-0.5	8
\.


--
-- Data for Name: InventoryCountSessions; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public."InventoryCountSessions" ("Id", "SessionType", "Status", "CompanyId", "LocationIdsJson", "PeriodMonth", "UomMode", "ItemTypeFilter", "GroupFilter", "CountDate", "EffectiveDate", "AdjustmentsAppliedAt", "SavedAt", "SavedBy", "ConfirmDeadlineAt", "ConfirmedAt", "ConfirmedBy", "IsAutoConfirmed", "CreatedAt", "UpdatedAt") FROM stdin;
1	spot	saved	1	["downtown"]	2026-06	inventory	component	All	2026-06-18		\N	2026-06-25 02:27:10.912588+00	Sarah Chen	\N	\N		f	2026-06-25 02:27:10.912588+00	2026-06-25 02:27:10.912588+00
2	spot	saved	1	["downtown"]	2026-05	inventory	component	All	2026-05-22		\N	2026-05-26 02:27:10.912588+00	James Dubois	\N	\N		f	2026-05-26 02:27:10.912588+00	2026-05-26 02:27:10.912588+00
3	full	pending_confirmation	1	["downtown"]	2026-06	inventory	component	All	2026-06-30		\N	2026-07-05 02:27:10.912588+00	Melissa Tan	2026-07-09 02:27:10.912588+00	\N		f	2026-07-05 02:27:10.912588+00	2026-07-05 02:27:10.912588+00
4	full	confirmed	1	["downtown"]	2026-05	inventory	component	All	2026-05-31	2026-06-03	2026-06-04 02:27:10.912588+00	2026-06-02 02:27:10.912588+00	Sarah Chen	\N	2026-06-04 02:27:10.912588+00	Sarah Chen	f	2026-06-02 02:27:10.912588+00	2026-06-02 02:27:10.912588+00
\.


--
-- Data for Name: InventoryMovements; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public."InventoryMovements" ("Id", "ComponentId", "ComponentName", "LocationExternalId", "QtyDelta", "Uom", "Reason", "ReferenceType", "ReferenceId", "CompanyId", "UnitPrice", "CreatedAt") FROM stdin;
1	CMP-WAGYUB-001	Wagyu Beef A5	airport	-2000	Gr	production_override	sub_product_batch	2	1	0	2026-07-03 04:12:33.655908+00
2	CMP-SEASAL-001	Sea Salt Flakes	airport	-10	Gr	production_override	sub_product_batch	2	1	0	2026-07-03 04:12:33.712161+00
3	CMP-BLACKP-001	Black Peppercorns	airport	-20	Gr	production_override	sub_product_batch	2	1	0	2026-07-03 04:12:33.71283+00
4	CMP-PAPRIK-001	Paprika	airport	-1	Gr	production_override	sub_product_batch	2	1	0	2026-07-03 04:12:33.712867+00
5	CMP-WAGYUB-001	Wagyu Beef A5	airport	-2000	Gr	production_override	sub_product_batch	2	1	0	2026-07-03 04:17:04.297527+00
6	CMP-SEASAL-001	Sea Salt Flakes	airport	-10	Gr	production_override	sub_product_batch	2	1	0	2026-07-03 04:17:04.320449+00
7	CMP-BLACKP-001	Black Peppercorns	airport	-20	Gr	production_override	sub_product_batch	2	1	0	2026-07-03 04:17:04.321083+00
8	CMP-PAPRIK-001	Paprika	airport	-1	Gr	production_override	sub_product_batch	2	1	0	2026-07-03 04:17:04.321101+00
9	CMP-WAGYUB-001	Wagyu Beef A5	airport	-4000	Gr	production_override	sub_product_batch	2	1	0	2026-07-03 08:46:42.866754+00
10	CMP-SEASAL-001	Sea Salt Flakes	airport	-20	Gr	production_override	sub_product_batch	2	1	0	2026-07-03 08:46:42.890839+00
11	CMP-BLACKP-001	Black Peppercorns	airport	-40	Gr	production_override	sub_product_batch	2	1	0	2026-07-03 08:46:42.89169+00
12	CMP-PAPRIK-001	Paprika	airport	-2	Gr	production_override	sub_product_batch	2	1	0	2026-07-03 08:46:42.891719+00
13	CMP-SCDEMO-001	SC Demo Component 001	midtown	-11	l	production	stock_card_demo	1	1	1498	2026-06-25 03:58:42.718784+00
14	CMP-SCDEMO-002	SC Demo Component 002	airport	-12	pcs	production	stock_card_demo	2	1	0.9651	2026-06-24 04:58:42.718784+00
15	CMP-SCDEMO-003	SC Demo Component 003	westend	-13	kg	production	stock_card_demo	3	1	682	2026-06-23 05:58:42.718784+00
16	CMP-SCDEMO-004	SC Demo Component 004	downtown	-14	l	production	stock_card_demo	4	1	2001.3	2026-06-22 06:58:42.718784+00
17	CMP-SCDEMO-005	SC Demo Component 005	midtown	-15	pcs	production	stock_card_demo	5	1	1.6925	2026-06-21 07:58:42.718784+00
18	CMP-SCDEMO-006	SC Demo Component 006	airport	-16	kg	production	stock_card_demo	6	1	838.9	2026-06-20 08:58:42.718784+00
19	CMP-SCDEMO-007	SC Demo Component 007	westend	-17	l	production	stock_card_demo	7	1	1453.7	2026-06-19 09:58:42.718784+00
20	CMP-SCDEMO-007	SC Demo Component 007	westend	-9	l	stock adjustment	stock_card_demo	7	1	1453.7	2026-06-24 09:58:42.718784+00
21	CMP-SCDEMO-008	SC Demo Component 008	downtown	-18	pcs	production	stock_card_demo	8	1	0.0507	2026-06-18 10:58:42.718784+00
22	CMP-SCDEMO-009	SC Demo Component 009	midtown	-19	kg	production	stock_card_demo	9	1	980.9	2026-06-17 11:58:42.718784+00
23	CMP-SCDEMO-010	SC Demo Component 010	airport	-20	l	production	stock_card_demo	10	1	1641.7	2026-06-16 12:58:42.718784+00
24	CMP-SCDEMO-011	SC Demo Component 011	westend	-21	pcs	production	stock_card_demo	11	1	0.4035	2026-06-15 13:58:42.718784+00
25	CMP-SCDEMO-012	SC Demo Component 012	downtown	-22	kg	production	stock_card_demo	12	1	482.7	2026-06-14 02:58:42.718784+00
26	CMP-SCDEMO-013	SC Demo Component 013	midtown	-23	l	production	stock_card_demo	13	1	1105.9	2026-06-13 03:58:42.718784+00
27	CMP-SCDEMO-014	SC Demo Component 014	airport	-24	pcs	production	stock_card_demo	14	1	0.4922	2026-06-12 04:58:42.718784+00
28	CMP-SCDEMO-014	SC Demo Component 014	airport	-8	pcs	stock adjustment	stock_card_demo	14	1	0.4922	2026-06-25 06:58:42.718784+00
29	CMP-SCDEMO-015	SC Demo Component 015	westend	-25	kg	production	stock_card_demo	15	1	349.9	2026-06-11 05:58:42.718784+00
30	CMP-SCDEMO-016	SC Demo Component 016	downtown	-26	l	production	stock_card_demo	16	1	1784.7	2026-06-10 06:58:42.718784+00
31	CMP-SCDEMO-017	SC Demo Component 017	midtown	-27	pcs	production	stock_card_demo	17	1	1.883	2026-06-09 07:58:42.718784+00
32	CMP-SCDEMO-018	SC Demo Component 018	airport	-28	kg	production	stock_card_demo	18	1	529.9	2026-06-08 08:58:42.718784+00
33	CMP-SCDEMO-019	SC Demo Component 019	westend	-29	l	production	stock_card_demo	19	1	1392.7	2026-06-07 09:58:42.718784+00
34	CMP-SCDEMO-020	SC Demo Component 020	downtown	-30	pcs	production	stock_card_demo	20	1	1.9517	2026-06-26 10:58:42.718784+00
35	CMP-SCDEMO-021	SC Demo Component 021	midtown	-31	kg	production	stock_card_demo	21	1	732	2026-06-25 11:58:42.718784+00
36	CMP-SCDEMO-021	SC Demo Component 021	midtown	-7	kg	stock adjustment	stock_card_demo	21	1	732	2026-06-26 03:58:42.718784+00
37	CMP-SCDEMO-022	SC Demo Component 022	airport	-32	l	production	stock_card_demo	22	1	1476.4	2026-06-24 12:58:42.718784+00
38	CMP-SCDEMO-023	SC Demo Component 023	westend	-33	pcs	production	stock_card_demo	23	1	2.0131	2026-06-23 13:58:42.718784+00
39	CMP-SCDEMO-024	SC Demo Component 024	downtown	-34	kg	production	stock_card_demo	24	1	1399.1	2026-06-22 02:58:42.718784+00
40	CMP-SCDEMO-025	SC Demo Component 025	midtown	-35	l	production	stock_card_demo	25	1	1787.6	2026-06-21 03:58:42.718784+00
41	CMP-SCDEMO-026	SC Demo Component 026	airport	-36	pcs	production	stock_card_demo	26	1	1.3311	2026-06-20 04:58:42.718784+00
42	CMP-SCDEMO-027	SC Demo Component 027	westend	-37	kg	production	stock_card_demo	27	1	1643.2	2026-06-19 05:58:42.718784+00
43	CMP-SCDEMO-028	SC Demo Component 028	downtown	-38	l	production	stock_card_demo	28	1	134.3	2026-06-18 06:58:42.718784+00
44	CMP-SCDEMO-028	SC Demo Component 028	downtown	-6	l	stock adjustment	stock_card_demo	28	1	134.3	2026-06-27 10:58:42.718784+00
45	CMP-SCDEMO-029	SC Demo Component 029	midtown	-39	pcs	production	stock_card_demo	29	1	1.9368	2026-06-17 07:58:42.718784+00
46	CMP-SCDEMO-030	SC Demo Component 030	airport	-40	kg	production	stock_card_demo	30	1	1877.9	2026-06-16 08:58:42.718784+00
47	CMP-SCDEMO-031	SC Demo Component 031	westend	-41	l	production	stock_card_demo	31	1	628.1	2026-06-15 09:58:42.718784+00
48	CMP-SCDEMO-032	SC Demo Component 032	downtown	-42	pcs	production	stock_card_demo	32	1	0.1446	2026-06-14 10:58:42.718784+00
49	CMP-SCDEMO-033	SC Demo Component 033	midtown	-43	kg	production	stock_card_demo	33	1	379.9	2026-06-13 11:58:42.718784+00
50	CMP-SCDEMO-034	SC Demo Component 034	airport	-44	l	production	stock_card_demo	34	1	533.6	2026-06-12 12:58:42.718784+00
51	CMP-SCDEMO-035	SC Demo Component 035	westend	-45	pcs	production	stock_card_demo	35	1	0.1948	2026-06-11 13:58:42.718784+00
52	CMP-SCDEMO-035	SC Demo Component 035	westend	-5	pcs	stock adjustment	stock_card_demo	35	1	0.1948	2026-06-28 07:58:42.718784+00
53	CMP-SCDEMO-036	SC Demo Component 036	downtown	-46	kg	production	stock_card_demo	36	1	2017.6	2026-06-10 02:58:42.718784+00
54	CMP-SCDEMO-037	SC Demo Component 037	midtown	-47	l	production	stock_card_demo	37	1	1522.5	2026-06-09 03:58:42.718784+00
55	CMP-SCDEMO-038	SC Demo Component 038	airport	-48	pcs	production	stock_card_demo	38	1	1.8537	2026-06-08 04:58:42.718784+00
56	CMP-SCDEMO-039	SC Demo Component 039	westend	-49	kg	production	stock_card_demo	39	1	1546.4	2026-06-07 05:58:42.718784+00
57	CMP-SCDEMO-040	SC Demo Component 040	downtown	-50	l	production	stock_card_demo	40	1	1398.1	2026-06-26 06:58:42.718784+00
58	CMP-SCDEMO-041	SC Demo Component 041	midtown	-51	pcs	production	stock_card_demo	41	1	0.8446	2026-06-25 07:58:42.718784+00
59	CMP-SCDEMO-042	SC Demo Component 042	airport	-52	kg	production	stock_card_demo	42	1	191.6	2026-06-24 08:58:42.718784+00
60	CMP-SCDEMO-042	SC Demo Component 042	airport	-4	kg	stock adjustment	stock_card_demo	42	1	191.6	2026-06-29 04:58:42.718784+00
61	CMP-SCDEMO-043	SC Demo Component 043	westend	-53	l	production	stock_card_demo	43	1	801.1	2026-06-23 09:58:42.718784+00
62	CMP-SCDEMO-044	SC Demo Component 044	downtown	-54	pcs	production	stock_card_demo	44	1	0.6974	2026-06-22 10:58:42.718784+00
63	CMP-SCDEMO-045	SC Demo Component 045	midtown	-55	kg	production	stock_card_demo	45	1	176	2026-06-21 11:58:42.718784+00
64	CMP-SCDEMO-046	SC Demo Component 046	airport	-56	l	production	stock_card_demo	46	1	602.6	2026-06-20 12:58:42.718784+00
65	CMP-SCDEMO-047	SC Demo Component 047	westend	-57	pcs	production	stock_card_demo	47	1	1.0628	2026-06-19 13:58:42.718784+00
66	CMP-SCDEMO-048	SC Demo Component 048	downtown	-58	kg	production	stock_card_demo	48	1	1659	2026-06-18 02:58:42.718784+00
67	CMP-SCDEMO-049	SC Demo Component 049	midtown	-59	l	production	stock_card_demo	49	1	1923.6	2026-06-17 03:58:42.718784+00
68	CMP-SCDEMO-049	SC Demo Component 049	midtown	-3	l	stock adjustment	stock_card_demo	49	1	1923.6	2026-06-30 11:58:42.718784+00
69	CMP-SCDEMO-050	SC Demo Component 050	airport	-60	pcs	production	stock_card_demo	50	1	1.401	2026-06-16 04:58:42.718784+00
70	CMP-SCDEMO-051	SC Demo Component 051	westend	-61	kg	production	stock_card_demo	51	1	1478.3	2026-06-15 05:58:42.718784+00
71	CMP-SCDEMO-052	SC Demo Component 052	downtown	-62	l	production	stock_card_demo	52	1	942.8	2026-06-14 06:58:42.718784+00
72	CMP-SCDEMO-053	SC Demo Component 053	midtown	-63	pcs	production	stock_card_demo	53	1	0.3383	2026-06-13 07:58:42.718784+00
73	CMP-SCDEMO-054	SC Demo Component 054	airport	-64	kg	production	stock_card_demo	54	1	261.5	2026-06-12 08:58:42.718784+00
74	CMP-SCDEMO-055	SC Demo Component 055	westend	-65	l	production	stock_card_demo	55	1	727.5	2026-06-11 09:58:42.718784+00
75	CMP-SCDEMO-056	SC Demo Component 056	downtown	-66	pcs	production	stock_card_demo	56	1	1.0789	2026-06-10 10:58:42.718784+00
76	CMP-SCDEMO-056	SC Demo Component 056	downtown	-2	pcs	stock adjustment	stock_card_demo	56	1	1.0789	2026-07-01 08:58:42.718784+00
77	CMP-SCDEMO-057	SC Demo Component 057	midtown	-67	kg	production	stock_card_demo	57	1	305.7	2026-06-09 11:58:42.718784+00
78	CMP-SCDEMO-058	SC Demo Component 058	airport	-68	l	production	stock_card_demo	58	1	1743.8	2026-06-08 12:58:42.718784+00
79	CMP-SCDEMO-059	SC Demo Component 059	westend	-69	pcs	production	stock_card_demo	59	1	1.9806	2026-06-07 13:58:42.718784+00
80	CMP-SCDEMO-060	SC Demo Component 060	downtown	-10	kg	production	stock_card_demo	60	1	909.3	2026-06-26 02:58:42.718784+00
81	CMP-SCDEMO-061	SC Demo Component 061	midtown	-11	l	production	stock_card_demo	61	1	1950.9	2026-06-25 03:58:42.718784+00
82	CMP-SCDEMO-062	SC Demo Component 062	airport	-12	pcs	production	stock_card_demo	62	1	1.1173	2026-06-24 04:58:42.718784+00
83	CMP-SCDEMO-063	SC Demo Component 063	westend	-13	kg	production	stock_card_demo	63	1	1058.7	2026-06-23 05:58:42.718784+00
84	CMP-SCDEMO-063	SC Demo Component 063	westend	-9	kg	stock adjustment	stock_card_demo	63	1	1058.7	2026-06-24 05:58:42.718784+00
85	CMP-SCDEMO-064	SC Demo Component 064	downtown	-14	l	production	stock_card_demo	64	1	1127.5	2026-06-22 06:58:42.718784+00
86	CMP-SCDEMO-065	SC Demo Component 065	midtown	-15	pcs	production	stock_card_demo	65	1	1.8455	2026-06-21 07:58:42.718784+00
87	CMP-SCDEMO-066	SC Demo Component 066	airport	-16	kg	production	stock_card_demo	66	1	561.6	2026-06-20 08:58:42.718784+00
88	CMP-SCDEMO-067	SC Demo Component 067	westend	-17	l	production	stock_card_demo	67	1	1450.8	2026-06-19 09:58:42.718784+00
89	CMP-SCDEMO-068	SC Demo Component 068	downtown	-18	pcs	production	stock_card_demo	68	1	1.7658	2026-06-18 10:58:42.718784+00
90	CMP-SCDEMO-069	SC Demo Component 069	midtown	-19	kg	production	stock_card_demo	69	1	561.8	2026-06-17 11:58:42.718784+00
91	CMP-SCDEMO-070	SC Demo Component 070	airport	-20	l	production	stock_card_demo	70	1	1805.8	2026-06-16 12:58:42.718784+00
92	CMP-SCDEMO-070	SC Demo Component 070	airport	-8	l	stock adjustment	stock_card_demo	70	1	1805.8	2026-06-25 02:58:42.718784+00
93	CMP-SCDEMO-071	SC Demo Component 071	westend	-21	pcs	production	stock_card_demo	71	1	1.8892	2026-06-15 13:58:42.718784+00
94	CMP-SCDEMO-072	SC Demo Component 072	downtown	-22	kg	production	stock_card_demo	72	1	724.2	2026-06-14 02:58:42.718784+00
95	CMP-SCDEMO-073	SC Demo Component 073	midtown	-23	l	production	stock_card_demo	73	1	975.8	2026-06-13 03:58:42.718784+00
96	CMP-SCDEMO-074	SC Demo Component 074	airport	-24	pcs	production	stock_card_demo	74	1	1.5331	2026-06-12 04:58:42.718784+00
97	CMP-SCDEMO-075	SC Demo Component 075	westend	-25	kg	production	stock_card_demo	75	1	1769.5	2026-06-11 05:58:42.718784+00
98	CMP-SCDEMO-076	SC Demo Component 076	downtown	-26	l	production	stock_card_demo	76	1	729.3	2026-06-10 06:58:42.718784+00
99	CMP-SCDEMO-077	SC Demo Component 077	midtown	-27	pcs	production	stock_card_demo	77	1	1.0067	2026-06-09 07:58:42.718784+00
100	CMP-SCDEMO-077	SC Demo Component 077	midtown	-7	pcs	stock adjustment	stock_card_demo	77	1	1.0067	2026-06-26 09:58:42.718784+00
101	CMP-SCDEMO-078	SC Demo Component 078	airport	-28	kg	production	stock_card_demo	78	1	1563.9	2026-06-08 08:58:42.718784+00
102	CMP-SCDEMO-079	SC Demo Component 079	westend	-29	l	production	stock_card_demo	79	1	1138.4	2026-06-07 09:58:42.718784+00
103	CMP-SCDEMO-080	SC Demo Component 080	downtown	-30	pcs	production	stock_card_demo	80	1	1.2175	2026-06-26 10:58:42.718784+00
104	CMP-SCDEMO-081	SC Demo Component 081	midtown	-31	kg	production	stock_card_demo	81	1	163.4	2026-06-25 11:58:42.718784+00
105	CMP-SCDEMO-082	SC Demo Component 082	airport	-32	l	production	stock_card_demo	82	1	443.2	2026-06-24 12:58:42.718784+00
106	CMP-SCDEMO-083	SC Demo Component 083	westend	-33	pcs	production	stock_card_demo	83	1	1.2373	2026-06-23 13:58:42.718784+00
107	CMP-SCDEMO-084	SC Demo Component 084	downtown	-34	kg	production	stock_card_demo	84	1	1784.2	2026-06-22 02:58:42.718784+00
108	CMP-SCDEMO-084	SC Demo Component 084	downtown	-6	kg	stock adjustment	stock_card_demo	84	1	1784.2	2026-06-27 06:58:42.718784+00
109	CMP-SCDEMO-085	SC Demo Component 085	midtown	-35	l	production	stock_card_demo	85	1	1018.1	2026-06-21 03:58:42.718784+00
110	CMP-SCDEMO-086	SC Demo Component 086	airport	-36	pcs	production	stock_card_demo	86	1	0.7117	2026-06-20 04:58:42.718784+00
111	CMP-SCDEMO-087	SC Demo Component 087	westend	-37	kg	production	stock_card_demo	87	1	344.8	2026-06-19 05:58:42.718784+00
112	CMP-SCDEMO-088	SC Demo Component 088	downtown	-38	l	production	stock_card_demo	88	1	490.1	2026-06-18 06:58:42.718784+00
113	CMP-SCDEMO-089	SC Demo Component 089	midtown	-39	pcs	production	stock_card_demo	89	1	0.5076	2026-06-17 07:58:42.718784+00
114	CMP-SCDEMO-090	SC Demo Component 090	airport	-40	kg	production	stock_card_demo	90	1	1314.3	2026-06-16 08:58:42.718784+00
115	CMP-SCDEMO-091	SC Demo Component 091	westend	-41	l	production	stock_card_demo	91	1	795.6	2026-06-15 09:58:42.718784+00
116	CMP-SCDEMO-091	SC Demo Component 091	westend	-5	l	stock adjustment	stock_card_demo	91	1	795.6	2026-06-28 03:58:42.718784+00
117	CMP-SCDEMO-092	SC Demo Component 092	downtown	-42	pcs	production	stock_card_demo	92	1	0.3898	2026-06-14 10:58:42.718784+00
118	CMP-SCDEMO-093	SC Demo Component 093	midtown	-43	kg	production	stock_card_demo	93	1	564.6	2026-06-13 11:58:42.718784+00
119	CMP-SCDEMO-094	SC Demo Component 094	airport	-44	l	production	stock_card_demo	94	1	773.7	2026-06-12 12:58:42.718784+00
120	CMP-SCDEMO-095	SC Demo Component 095	westend	-45	pcs	production	stock_card_demo	95	1	0.4694	2026-06-11 13:58:42.718784+00
121	CMP-SCDEMO-096	SC Demo Component 096	downtown	-46	kg	production	stock_card_demo	96	1	1600.5	2026-06-10 02:58:42.718784+00
122	CMP-SCDEMO-097	SC Demo Component 097	midtown	-47	l	production	stock_card_demo	97	1	847.9	2026-06-09 03:58:42.718784+00
123	CMP-SCDEMO-098	SC Demo Component 098	airport	-48	pcs	production	stock_card_demo	98	1	1.4968	2026-06-08 04:58:42.718784+00
124	CMP-SCDEMO-098	SC Demo Component 098	airport	-4	pcs	stock adjustment	stock_card_demo	98	1	1.4968	2026-06-29 10:58:42.718784+00
125	CMP-SCDEMO-099	SC Demo Component 099	westend	-49	kg	production	stock_card_demo	99	1	115.6	2026-06-07 05:58:42.718784+00
126	CMP-SCDEMO-100	SC Demo Component 100	downtown	-50	l	production	stock_card_demo	100	1	1289.7	2026-06-26 06:58:42.718784+00
127	CMP-SCDEMO-101	SC Demo Component 101	midtown	-51	pcs	production	stock_card_demo	101	1	1.7333	2026-06-25 07:58:42.718784+00
128	CMP-SCDEMO-102	SC Demo Component 102	airport	-52	kg	production	stock_card_demo	102	1	1410.8	2026-06-24 08:58:42.718784+00
129	CMP-SCDEMO-103	SC Demo Component 103	westend	-53	l	production	stock_card_demo	103	1	1823.8	2026-06-23 09:58:42.718784+00
130	CMP-SCDEMO-104	SC Demo Component 104	downtown	-54	pcs	production	stock_card_demo	104	1	1.5783	2026-06-22 10:58:42.718784+00
131	CMP-SCDEMO-105	SC Demo Component 105	midtown	-55	kg	production	stock_card_demo	105	1	681.6	2026-06-21 11:58:42.718784+00
132	CMP-SCDEMO-105	SC Demo Component 105	midtown	-3	kg	stock adjustment	stock_card_demo	105	1	681.6	2026-06-30 07:58:42.718784+00
133	CMP-SCDEMO-106	SC Demo Component 106	airport	-56	l	production	stock_card_demo	106	1	1888.8	2026-06-20 12:58:42.718784+00
134	CMP-SCDEMO-107	SC Demo Component 107	westend	-57	pcs	production	stock_card_demo	107	1	1.4884	2026-06-19 13:58:42.718784+00
135	CMP-SCDEMO-108	SC Demo Component 108	downtown	-58	kg	production	stock_card_demo	108	1	1364	2026-06-18 02:58:42.718784+00
136	CMP-SCDEMO-109	SC Demo Component 109	midtown	-59	l	production	stock_card_demo	109	1	1862.5	2026-06-17 03:58:42.718784+00
137	CMP-SCDEMO-110	SC Demo Component 110	airport	-60	pcs	production	stock_card_demo	110	1	1.0191	2026-06-16 04:58:42.718784+00
138	CMP-SCDEMO-111	SC Demo Component 111	westend	-61	kg	production	stock_card_demo	111	1	674.7	2026-06-15 05:58:42.718784+00
139	CMP-SCDEMO-112	SC Demo Component 112	downtown	-62	l	production	stock_card_demo	112	1	1953	2026-06-14 06:58:42.718784+00
140	CMP-SCDEMO-112	SC Demo Component 112	downtown	-2	l	stock adjustment	stock_card_demo	112	1	1953	2026-07-01 04:58:42.718784+00
141	CMP-SCDEMO-113	SC Demo Component 113	midtown	-63	pcs	production	stock_card_demo	113	1	1.5544	2026-06-13 07:58:42.718784+00
142	CMP-SCDEMO-114	SC Demo Component 114	airport	-64	kg	production	stock_card_demo	114	1	1217.4	2026-06-12 08:58:42.718784+00
143	CMP-SCDEMO-115	SC Demo Component 115	westend	-65	l	production	stock_card_demo	115	1	1902.3	2026-06-11 09:58:42.718784+00
144	CMP-SCDEMO-116	SC Demo Component 116	downtown	-66	pcs	production	stock_card_demo	116	1	1.4264	2026-06-10 10:58:42.718784+00
145	CMP-SCDEMO-117	SC Demo Component 117	midtown	-67	kg	production	stock_card_demo	117	1	1450.6	2026-06-09 11:58:42.718784+00
146	CMP-SCDEMO-118	SC Demo Component 118	airport	-68	l	production	stock_card_demo	118	1	1957.8	2026-06-08 12:58:42.718784+00
147	CMP-SCDEMO-119	SC Demo Component 119	westend	-69	pcs	production	stock_card_demo	119	1	1.4378	2026-06-07 13:58:42.718784+00
148	CMP-SCDEMO-119	SC Demo Component 119	westend	-9	pcs	stock adjustment	stock_card_demo	119	1	1.4378	2026-06-24 11:58:42.718784+00
149	CMP-SCDEMO-120	SC Demo Component 120	downtown	-10	kg	production	stock_card_demo	120	1	1636.2	2026-06-26 02:58:42.718784+00
150	CMP-SCDEMO-121	SC Demo Component 121	midtown	-11	l	production	stock_card_demo	121	1	1210.2	2026-06-25 03:58:42.718784+00
151	CMP-SCDEMO-122	SC Demo Component 122	airport	-12	pcs	production	stock_card_demo	122	1	1.7475	2026-06-24 04:58:42.718784+00
152	CMP-SCDEMO-123	SC Demo Component 123	westend	-13	kg	production	stock_card_demo	123	1	1630.5	2026-06-23 05:58:42.718784+00
153	CMP-SCDEMO-124	SC Demo Component 124	downtown	-14	l	production	stock_card_demo	124	1	420.8	2026-06-22 06:58:42.718784+00
154	CMP-SCDEMO-125	SC Demo Component 125	midtown	-15	pcs	production	stock_card_demo	125	1	0.4322	2026-06-21 07:58:42.718784+00
155	CMP-SCDEMO-126	SC Demo Component 126	airport	-16	kg	production	stock_card_demo	126	1	1924.4	2026-06-20 08:58:42.718784+00
156	CMP-SCDEMO-126	SC Demo Component 126	airport	-8	kg	stock adjustment	stock_card_demo	126	1	1924.4	2026-06-25 08:58:42.718784+00
157	CMP-SCDEMO-127	SC Demo Component 127	westend	-17	l	production	stock_card_demo	127	1	271.4	2026-06-19 09:58:42.718784+00
158	CMP-SCDEMO-128	SC Demo Component 128	downtown	-18	pcs	production	stock_card_demo	128	1	1.0026	2026-06-18 10:58:42.718784+00
159	CMP-SCDEMO-129	SC Demo Component 129	midtown	-19	kg	production	stock_card_demo	129	1	1307.7	2026-06-17 11:58:42.718784+00
160	CMP-SCDEMO-130	SC Demo Component 130	airport	-20	l	production	stock_card_demo	130	1	1210.1	2026-06-16 12:58:42.718784+00
161	CMP-SCDEMO-131	SC Demo Component 131	westend	-21	pcs	production	stock_card_demo	131	1	1.5967	2026-06-15 13:58:42.718784+00
162	CMP-SCDEMO-132	SC Demo Component 132	downtown	-22	kg	production	stock_card_demo	132	1	1855.2	2026-06-14 02:58:42.718784+00
163	CMP-SCDEMO-133	SC Demo Component 133	midtown	-23	l	production	stock_card_demo	133	1	745.4	2026-06-13 03:58:42.718784+00
164	CMP-SCDEMO-133	SC Demo Component 133	midtown	-7	l	stock adjustment	stock_card_demo	133	1	745.4	2026-06-26 05:58:42.718784+00
165	CMP-SCDEMO-134	SC Demo Component 134	airport	-24	pcs	production	stock_card_demo	134	1	1.0975	2026-06-12 04:58:42.718784+00
166	CMP-SCDEMO-135	SC Demo Component 135	westend	-25	kg	production	stock_card_demo	135	1	1718.5	2026-06-11 05:58:42.718784+00
167	CMP-SCDEMO-136	SC Demo Component 136	downtown	-26	l	production	stock_card_demo	136	1	2027	2026-06-10 06:58:42.718784+00
168	CMP-SCDEMO-137	SC Demo Component 137	midtown	-27	pcs	production	stock_card_demo	137	1	1.4969	2026-06-09 07:58:42.718784+00
169	CMP-SCDEMO-138	SC Demo Component 138	airport	-28	kg	production	stock_card_demo	138	1	1388.6	2026-06-08 08:58:42.718784+00
170	CMP-SCDEMO-139	SC Demo Component 139	westend	-29	l	production	stock_card_demo	139	1	1757.6	2026-06-07 09:58:42.718784+00
171	CMP-SCDEMO-140	SC Demo Component 140	downtown	-30	pcs	production	stock_card_demo	140	1	2.0183	2026-06-26 10:58:42.718784+00
172	CMP-SCDEMO-140	SC Demo Component 140	downtown	-6	pcs	stock adjustment	stock_card_demo	140	1	2.0183	2026-06-27 02:58:42.718784+00
173	CMP-SCDEMO-141	SC Demo Component 141	midtown	-31	kg	production	stock_card_demo	141	1	531.8	2026-06-25 11:58:42.718784+00
174	CMP-SCDEMO-142	SC Demo Component 142	airport	-32	l	production	stock_card_demo	142	1	266.3	2026-06-24 12:58:42.718784+00
175	CMP-SCDEMO-143	SC Demo Component 143	westend	-33	pcs	production	stock_card_demo	143	1	0.9288	2026-06-23 13:58:42.718784+00
176	CMP-SCDEMO-144	SC Demo Component 144	downtown	-34	kg	production	stock_card_demo	144	1	1095.7	2026-06-22 02:58:42.718784+00
177	CMP-SCDEMO-145	SC Demo Component 145	midtown	-35	l	production	stock_card_demo	145	1	784.4	2026-06-21 03:58:42.718784+00
178	CMP-SCDEMO-146	SC Demo Component 146	airport	-36	pcs	production	stock_card_demo	146	1	0.3771	2026-06-20 04:58:42.718784+00
179	CMP-SCDEMO-147	SC Demo Component 147	westend	-37	kg	production	stock_card_demo	147	1	565.2	2026-06-19 05:58:42.718784+00
180	CMP-SCDEMO-147	SC Demo Component 147	westend	-5	kg	stock adjustment	stock_card_demo	147	1	565.2	2026-06-28 09:58:42.718784+00
181	CMP-SCDEMO-148	SC Demo Component 148	downtown	-38	l	production	stock_card_demo	148	1	303.9	2026-06-18 06:58:42.718784+00
182	CMP-SCDEMO-149	SC Demo Component 149	midtown	-39	pcs	production	stock_card_demo	149	1	1.311	2026-06-17 07:58:42.718784+00
183	CMP-SCDEMO-150	SC Demo Component 150	airport	-40	kg	production	stock_card_demo	150	1	1702.2	2026-06-16 08:58:42.718784+00
184	CMP-SCDEMO-151	SC Demo Component 151	westend	-41	l	production	stock_card_demo	151	1	105	2026-06-15 09:58:42.718784+00
185	CMP-SCDEMO-152	SC Demo Component 152	downtown	-42	pcs	production	stock_card_demo	152	1	1.6031	2026-06-14 10:58:42.718784+00
186	CMP-SCDEMO-153	SC Demo Component 153	midtown	-43	kg	production	stock_card_demo	153	1	155	2026-06-13 11:58:42.718784+00
187	CMP-SCDEMO-154	SC Demo Component 154	airport	-44	l	production	stock_card_demo	154	1	1635.6	2026-06-12 12:58:42.718784+00
188	CMP-SCDEMO-154	SC Demo Component 154	airport	-4	l	stock adjustment	stock_card_demo	154	1	1635.6	2026-06-29 06:58:42.718784+00
189	CMP-SCDEMO-155	SC Demo Component 155	westend	-45	pcs	production	stock_card_demo	155	1	1.4523	2026-06-11 13:58:42.718784+00
190	CMP-SCDEMO-156	SC Demo Component 156	downtown	-46	kg	production	stock_card_demo	156	1	620.6	2026-06-10 02:58:42.718784+00
191	CMP-SCDEMO-157	SC Demo Component 157	midtown	-47	l	production	stock_card_demo	157	1	1893.7	2026-06-09 03:58:42.718784+00
192	CMP-SCDEMO-158	SC Demo Component 158	airport	-48	pcs	production	stock_card_demo	158	1	0.4894	2026-06-08 04:58:42.718784+00
193	CMP-SCDEMO-159	SC Demo Component 159	westend	-49	kg	production	stock_card_demo	159	1	763.5	2026-06-07 05:58:42.718784+00
194	CMP-SCDEMO-160	SC Demo Component 160	downtown	-50	l	production	stock_card_demo	160	1	1049.5	2026-06-26 06:58:42.718784+00
195	CMP-SCDEMO-161	SC Demo Component 161	midtown	-51	pcs	production	stock_card_demo	161	1	1.576	2026-06-25 07:58:42.718784+00
196	CMP-SCDEMO-161	SC Demo Component 161	midtown	-3	pcs	stock adjustment	stock_card_demo	161	1	1.576	2026-06-30 03:58:42.718784+00
197	CMP-SCDEMO-162	SC Demo Component 162	airport	-52	kg	production	stock_card_demo	162	1	1067	2026-06-24 08:58:42.718784+00
198	CMP-SCDEMO-163	SC Demo Component 163	westend	-53	l	production	stock_card_demo	163	1	1452	2026-06-23 09:58:42.718784+00
199	CMP-SCDEMO-164	SC Demo Component 164	downtown	-54	pcs	production	stock_card_demo	164	1	1.672	2026-06-22 10:58:42.718784+00
200	CMP-SCDEMO-165	SC Demo Component 165	midtown	-55	kg	production	stock_card_demo	165	1	964.7	2026-06-21 11:58:42.718784+00
201	CMP-SCDEMO-166	SC Demo Component 166	airport	-56	l	production	stock_card_demo	166	1	347.5	2026-06-20 12:58:42.718784+00
202	CMP-SCDEMO-167	SC Demo Component 167	westend	-57	pcs	production	stock_card_demo	167	1	1.9533	2026-06-19 13:58:42.718784+00
203	CMP-SCDEMO-168	SC Demo Component 168	downtown	-58	kg	production	stock_card_demo	168	1	397	2026-06-18 02:58:42.718784+00
204	CMP-SCDEMO-168	SC Demo Component 168	downtown	-2	kg	stock adjustment	stock_card_demo	168	1	397	2026-07-01 10:58:42.718784+00
205	CMP-SCDEMO-169	SC Demo Component 169	midtown	-59	l	production	stock_card_demo	169	1	442.7	2026-06-17 03:58:42.718784+00
206	CMP-SCDEMO-170	SC Demo Component 170	airport	-60	pcs	production	stock_card_demo	170	1	1.7154	2026-06-16 04:58:42.718784+00
215	CMP-SCFIFO-001	SC FIFO Demo Wagyu	downtown	10	kg	Transfer in from Midtown	transfer_in	9001	1	41	2026-06-14 14:16:19.502331+00
216	CMP-SCFIFO-001	SC FIFO Demo Wagyu	downtown	-35	kg	Production — Sub-product batch	production	9002	1	0	2026-06-16 17:16:19.502331+00
217	CMP-SCFIFO-001	SC FIFO Demo Wagyu	downtown	-18	kg	POS sales depletion	pos_sale	9003	1	0	2026-06-22 23:16:19.502331+00
218	CMP-SCFIFO-001	SC FIFO Demo Wagyu	downtown	-5	kg	Wastage — spoilage	wastage	9004	1	0	2026-07-01 13:16:19.502331+00
219	CMP-SCFIFO-001	SC FIFO Demo Wagyu	downtown	-8	kg	Transfer out to Airport	transfer_out	9005	1	0	2026-07-02 12:16:19.502331+00
220	CMP-SCFIFO-001	SC FIFO Demo Wagyu	downtown	-3	kg	Inventory adjustment — count short	inventory_adjustment	9006	1	0	2026-07-03 19:16:19.502331+00
222	CMP-SCFIFO-001	SC FIFO Demo Wagyu	downtown	-12	kg	POS sales depletion	pos_sale	9008	1	0	2026-07-05 22:16:19.502331+00
223	CMP-SCFIFO-001	SC FIFO Demo Wagyu	downtown	-30	kg	POS sales depletion — FIFO test (30 kg)	pos_sale	9010	1	0	2026-07-02 08:00:00+00
224	CMP-SCFIFO-001	SC FIFO Demo Wagyu	downtown	-25	kg	POS sales depletion — FIFO test (25 kg)	pos_sale	9012	1	0	2026-07-04 09:00:00+00
225	CMP-SCFIFO-001	SC FIFO Demo Wagyu	downtown	-10	kg	Inventory adjustment — Inventory Adjustment	inventory_adjustment	0	1	43.37	2026-07-01 23:59:59.999999+00
226	CMP-SCFIFO-001	SC FIFO Demo Wagyu	downtown	-10	kg	Inventory adjustment — Inventory adjustment	inventory_adjustment	0	1	43.37	2026-07-01 23:59:59.999999+00
\.


--
-- Data for Name: InventoryPurchases; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public."InventoryPurchases" ("Id", "ComponentId", "ComponentName", "Quantity", "Uom", "UnitPrice", "DateOrdered", "DateCreatedInStock", "PurchaseOrderId", "PurchaseOrderItemId", "CompanyId", "LocationIdsJson") FROM stdin;
1	CMP-PEELED-001	Peeled Garlic	1	kg	16.5	2026-07-01	2026-07-01 11:21:04.345198+00	24	27	1	["airport"]
2	CMP-00FLOU-001	00 Flour	2	kg	5	2026-07-02	2026-07-02 02:44:16.410975+00	0	0	1	["airport"]
3	CMP-00FLOU-001	00 Flour	1	kg	11	2026-07-02	2026-07-02 03:06:09.105939+00	0	0	1	["airport"]
4	CMP-SCDEMO-001	SC Demo Component 001	81	l	1498	2026-06-15	2026-06-17 02:58:42.718784+00	0	0	1	["midtown"]
5	CMP-SCDEMO-002	SC Demo Component 002	82	pcs	0.9651	2026-06-14	2026-06-16 02:58:42.718784+00	0	0	1	["airport"]
6	CMP-SCDEMO-003	SC Demo Component 003	83	kg	682	2026-06-13	2026-06-15 02:58:42.718784+00	0	0	1	["westend"]
7	CMP-SCDEMO-003	SC Demo Component 003	18	kg	682	2026-06-26	2026-06-27 02:58:42.718784+00	0	0	1	["downtown"]
8	CMP-SCDEMO-004	SC Demo Component 004	84	l	2001.3	2026-06-12	2026-06-14 02:58:42.718784+00	0	0	1	["downtown"]
9	CMP-SCDEMO-005	SC Demo Component 005	85	pcs	1.6925	2026-06-11	2026-06-13 02:58:42.718784+00	0	0	1	["midtown"]
10	CMP-SCDEMO-006	SC Demo Component 006	86	kg	838.9	2026-06-10	2026-06-12 02:58:42.718784+00	0	0	1	["airport"]
11	CMP-SCDEMO-006	SC Demo Component 006	21	kg	838.9	2026-06-23	2026-06-24 02:58:42.718784+00	0	0	1	["westend"]
12	CMP-SCDEMO-007	SC Demo Component 007	87	l	1453.7	2026-06-09	2026-06-11 02:58:42.718784+00	0	0	1	["westend"]
13	CMP-SCDEMO-008	SC Demo Component 008	88	pcs	0.0507	2026-06-08	2026-06-10 02:58:42.718784+00	0	0	1	["downtown"]
14	CMP-SCDEMO-009	SC Demo Component 009	89	kg	980.9	2026-06-07	2026-06-09 02:58:42.718784+00	0	0	1	["midtown"]
15	CMP-SCDEMO-009	SC Demo Component 009	24	kg	980.9	2026-06-20	2026-06-21 02:58:42.718784+00	0	0	1	["airport"]
16	CMP-SCDEMO-010	SC Demo Component 010	90	l	1641.7	2026-06-06	2026-06-08 02:58:42.718784+00	0	0	1	["airport"]
17	CMP-SCDEMO-011	SC Demo Component 011	91	pcs	0.4035	2026-06-05	2026-06-07 02:58:42.718784+00	0	0	1	["westend"]
18	CMP-SCDEMO-012	SC Demo Component 012	92	kg	482.7	2026-06-04	2026-06-06 02:58:42.718784+00	0	0	1	["downtown"]
19	CMP-SCDEMO-012	SC Demo Component 012	27	kg	482.7	2026-06-17	2026-06-28 02:58:42.718784+00	0	0	1	["midtown"]
20	CMP-SCDEMO-013	SC Demo Component 013	93	l	1105.9	2026-06-03	2026-06-05 02:58:42.718784+00	0	0	1	["midtown"]
21	CMP-SCDEMO-014	SC Demo Component 014	94	pcs	0.4922	2026-06-02	2026-06-04 02:58:42.718784+00	0	0	1	["airport"]
22	CMP-SCDEMO-015	SC Demo Component 015	95	kg	349.9	2026-06-01	2026-06-03 02:58:42.718784+00	0	0	1	["westend"]
23	CMP-SCDEMO-015	SC Demo Component 015	30	kg	349.9	2026-06-28	2026-06-25 02:58:42.718784+00	0	0	1	["downtown"]
24	CMP-SCDEMO-016	SC Demo Component 016	96	l	1784.7	2026-05-31	2026-06-02 02:58:42.718784+00	0	0	1	["downtown"]
25	CMP-SCDEMO-017	SC Demo Component 017	97	pcs	1.883	2026-05-30	2026-06-01 02:58:42.718784+00	0	0	1	["midtown"]
26	CMP-SCDEMO-018	SC Demo Component 018	98	kg	529.9	2026-05-29	2026-05-31 02:58:42.718784+00	0	0	1	["airport"]
27	CMP-SCDEMO-018	SC Demo Component 018	33	kg	529.9	2026-06-25	2026-06-22 02:58:42.718784+00	0	0	1	["westend"]
28	CMP-SCDEMO-019	SC Demo Component 019	99	l	1392.7	2026-05-28	2026-05-30 02:58:42.718784+00	0	0	1	["westend"]
29	CMP-SCDEMO-020	SC Demo Component 020	100	pcs	1.9517	2026-05-27	2026-05-29 02:58:42.718784+00	0	0	1	["downtown"]
30	CMP-SCDEMO-021	SC Demo Component 021	101	kg	732	2026-05-26	2026-05-28 02:58:42.718784+00	0	0	1	["midtown"]
31	CMP-SCDEMO-021	SC Demo Component 021	36	kg	732	2026-06-22	2026-06-29 02:58:42.718784+00	0	0	1	["airport"]
32	CMP-SCDEMO-022	SC Demo Component 022	102	l	1476.4	2026-05-25	2026-05-27 02:58:42.718784+00	0	0	1	["airport"]
33	CMP-SCDEMO-023	SC Demo Component 023	103	pcs	2.0131	2026-05-24	2026-05-26 02:58:42.718784+00	0	0	1	["westend"]
34	CMP-SCDEMO-024	SC Demo Component 024	104	kg	1399.1	2026-05-23	2026-05-25 02:58:42.718784+00	0	0	1	["downtown"]
35	CMP-SCDEMO-024	SC Demo Component 024	39	kg	1399.1	2026-06-19	2026-06-26 02:58:42.718784+00	0	0	1	["midtown"]
36	CMP-SCDEMO-025	SC Demo Component 025	105	l	1787.6	2026-05-22	2026-05-24 02:58:42.718784+00	0	0	1	["midtown"]
37	CMP-SCDEMO-026	SC Demo Component 026	106	pcs	1.3311	2026-05-21	2026-05-23 02:58:42.718784+00	0	0	1	["airport"]
38	CMP-SCDEMO-027	SC Demo Component 027	107	kg	1643.2	2026-05-20	2026-05-22 02:58:42.718784+00	0	0	1	["westend"]
39	CMP-SCDEMO-027	SC Demo Component 027	42	kg	1643.2	2026-06-16	2026-06-23 02:58:42.718784+00	0	0	1	["downtown"]
40	CMP-SCDEMO-028	SC Demo Component 028	108	l	134.3	2026-05-19	2026-05-21 02:58:42.718784+00	0	0	1	["downtown"]
41	CMP-SCDEMO-029	SC Demo Component 029	109	pcs	1.9368	2026-05-18	2026-05-20 02:58:42.718784+00	0	0	1	["midtown"]
42	CMP-SCDEMO-030	SC Demo Component 030	110	kg	1877.9	2026-05-17	2026-05-19 02:58:42.718784+00	0	0	1	["airport"]
43	CMP-SCDEMO-030	SC Demo Component 030	45	kg	1877.9	2026-06-27	2026-06-30 02:58:42.718784+00	0	0	1	["westend"]
44	CMP-SCDEMO-031	SC Demo Component 031	111	l	628.1	2026-05-16	2026-05-18 02:58:42.718784+00	0	0	1	["westend"]
45	CMP-SCDEMO-032	SC Demo Component 032	112	pcs	0.1446	2026-05-15	2026-05-17 02:58:42.718784+00	0	0	1	["downtown"]
46	CMP-SCDEMO-033	SC Demo Component 033	113	kg	379.9	2026-05-14	2026-05-16 02:58:42.718784+00	0	0	1	["midtown"]
47	CMP-SCDEMO-033	SC Demo Component 033	48	kg	379.9	2026-06-24	2026-06-27 02:58:42.718784+00	0	0	1	["airport"]
48	CMP-SCDEMO-034	SC Demo Component 034	114	l	533.6	2026-05-13	2026-05-15 02:58:42.718784+00	0	0	1	["airport"]
49	CMP-SCDEMO-035	SC Demo Component 035	115	pcs	0.1948	2026-05-12	2026-06-18 02:58:42.718784+00	0	0	1	["westend"]
50	CMP-SCDEMO-036	SC Demo Component 036	116	kg	2017.6	2026-05-11	2026-06-17 02:58:42.718784+00	0	0	1	["downtown"]
51	CMP-SCDEMO-036	SC Demo Component 036	51	kg	2017.6	2026-06-21	2026-06-24 02:58:42.718784+00	0	0	1	["midtown"]
52	CMP-SCDEMO-037	SC Demo Component 037	117	l	1522.5	2026-05-10	2026-06-16 02:58:42.718784+00	0	0	1	["midtown"]
53	CMP-SCDEMO-038	SC Demo Component 038	118	pcs	1.8537	2026-05-09	2026-06-15 02:58:42.718784+00	0	0	1	["airport"]
54	CMP-SCDEMO-039	SC Demo Component 039	119	kg	1546.4	2026-05-08	2026-06-14 02:58:42.718784+00	0	0	1	["westend"]
55	CMP-SCDEMO-039	SC Demo Component 039	54	kg	1546.4	2026-06-18	2026-06-21 02:58:42.718784+00	0	0	1	["downtown"]
56	CMP-SCDEMO-040	SC Demo Component 040	120	l	1398.1	2026-06-16	2026-06-13 02:58:42.718784+00	0	0	1	["downtown"]
57	CMP-SCDEMO-041	SC Demo Component 041	121	pcs	0.8446	2026-06-15	2026-06-12 02:58:42.718784+00	0	0	1	["midtown"]
58	CMP-SCDEMO-042	SC Demo Component 042	122	kg	191.6	2026-06-14	2026-06-11 02:58:42.718784+00	0	0	1	["airport"]
59	CMP-SCDEMO-042	SC Demo Component 042	17	kg	191.6	2026-06-29	2026-06-28 02:58:42.718784+00	0	0	1	["westend"]
60	CMP-SCDEMO-043	SC Demo Component 043	123	l	801.1	2026-06-13	2026-06-10 02:58:42.718784+00	0	0	1	["westend"]
61	CMP-SCDEMO-044	SC Demo Component 044	124	pcs	0.6974	2026-06-12	2026-06-09 02:58:42.718784+00	0	0	1	["downtown"]
62	CMP-SCDEMO-045	SC Demo Component 045	125	kg	176	2026-06-11	2026-06-08 02:58:42.718784+00	0	0	1	["midtown"]
63	CMP-SCDEMO-045	SC Demo Component 045	20	kg	176	2026-06-26	2026-06-25 02:58:42.718784+00	0	0	1	["airport"]
64	CMP-SCDEMO-046	SC Demo Component 046	126	l	602.6	2026-06-10	2026-06-07 02:58:42.718784+00	0	0	1	["airport"]
65	CMP-SCDEMO-047	SC Demo Component 047	127	pcs	1.0628	2026-06-09	2026-06-06 02:58:42.718784+00	0	0	1	["westend"]
66	CMP-SCDEMO-048	SC Demo Component 048	128	kg	1659	2026-06-08	2026-06-05 02:58:42.718784+00	0	0	1	["downtown"]
67	CMP-SCDEMO-048	SC Demo Component 048	23	kg	1659	2026-06-23	2026-06-22 02:58:42.718784+00	0	0	1	["midtown"]
68	CMP-SCDEMO-049	SC Demo Component 049	129	l	1923.6	2026-06-07	2026-06-04 02:58:42.718784+00	0	0	1	["midtown"]
69	CMP-SCDEMO-050	SC Demo Component 050	130	pcs	1.401	2026-06-06	2026-06-03 02:58:42.718784+00	0	0	1	["airport"]
70	CMP-SCDEMO-051	SC Demo Component 051	131	kg	1478.3	2026-06-05	2026-06-02 02:58:42.718784+00	0	0	1	["westend"]
71	CMP-SCDEMO-051	SC Demo Component 051	26	kg	1478.3	2026-06-20	2026-06-29 02:58:42.718784+00	0	0	1	["downtown"]
72	CMP-SCDEMO-052	SC Demo Component 052	132	l	942.8	2026-06-04	2026-06-01 02:58:42.718784+00	0	0	1	["downtown"]
73	CMP-SCDEMO-053	SC Demo Component 053	133	pcs	0.3383	2026-06-03	2026-05-31 02:58:42.718784+00	0	0	1	["midtown"]
74	CMP-SCDEMO-054	SC Demo Component 054	134	kg	261.5	2026-06-02	2026-05-30 02:58:42.718784+00	0	0	1	["airport"]
75	CMP-SCDEMO-054	SC Demo Component 054	29	kg	261.5	2026-06-17	2026-06-26 02:58:42.718784+00	0	0	1	["westend"]
76	CMP-SCDEMO-055	SC Demo Component 055	135	l	727.5	2026-06-01	2026-05-29 02:58:42.718784+00	0	0	1	["westend"]
77	CMP-SCDEMO-056	SC Demo Component 056	136	pcs	1.0789	2026-05-31	2026-05-28 02:58:42.718784+00	0	0	1	["downtown"]
78	CMP-SCDEMO-057	SC Demo Component 057	137	kg	305.7	2026-05-30	2026-05-27 02:58:42.718784+00	0	0	1	["midtown"]
79	CMP-SCDEMO-057	SC Demo Component 057	32	kg	305.7	2026-06-28	2026-06-23 02:58:42.718784+00	0	0	1	["airport"]
80	CMP-SCDEMO-058	SC Demo Component 058	138	l	1743.8	2026-05-29	2026-05-26 02:58:42.718784+00	0	0	1	["airport"]
81	CMP-SCDEMO-059	SC Demo Component 059	139	pcs	1.9806	2026-05-28	2026-05-25 02:58:42.718784+00	0	0	1	["westend"]
82	CMP-SCDEMO-060	SC Demo Component 060	140	kg	909.3	2026-05-27	2026-05-24 02:58:42.718784+00	0	0	1	["downtown"]
83	CMP-SCDEMO-060	SC Demo Component 060	35	kg	909.3	2026-06-25	2026-06-30 02:58:42.718784+00	0	0	1	["midtown"]
84	CMP-SCDEMO-061	SC Demo Component 061	141	l	1950.9	2026-05-26	2026-05-23 02:58:42.718784+00	0	0	1	["midtown"]
85	CMP-SCDEMO-062	SC Demo Component 062	142	pcs	1.1173	2026-05-25	2026-05-22 02:58:42.718784+00	0	0	1	["airport"]
86	CMP-SCDEMO-063	SC Demo Component 063	143	kg	1058.7	2026-05-24	2026-05-21 02:58:42.718784+00	0	0	1	["westend"]
87	CMP-SCDEMO-063	SC Demo Component 063	38	kg	1058.7	2026-06-22	2026-06-27 02:58:42.718784+00	0	0	1	["downtown"]
88	CMP-SCDEMO-064	SC Demo Component 064	144	l	1127.5	2026-05-23	2026-05-20 02:58:42.718784+00	0	0	1	["downtown"]
89	CMP-SCDEMO-065	SC Demo Component 065	145	pcs	1.8455	2026-05-22	2026-05-19 02:58:42.718784+00	0	0	1	["midtown"]
90	CMP-SCDEMO-066	SC Demo Component 066	146	kg	561.6	2026-05-21	2026-05-18 02:58:42.718784+00	0	0	1	["airport"]
91	CMP-SCDEMO-066	SC Demo Component 066	41	kg	561.6	2026-06-19	2026-06-24 02:58:42.718784+00	0	0	1	["westend"]
92	CMP-SCDEMO-067	SC Demo Component 067	147	l	1450.8	2026-05-20	2026-05-17 02:58:42.718784+00	0	0	1	["westend"]
93	CMP-SCDEMO-068	SC Demo Component 068	148	pcs	1.7658	2026-05-19	2026-05-16 02:58:42.718784+00	0	0	1	["downtown"]
94	CMP-SCDEMO-069	SC Demo Component 069	149	kg	561.8	2026-05-18	2026-05-15 02:58:42.718784+00	0	0	1	["midtown"]
95	CMP-SCDEMO-069	SC Demo Component 069	44	kg	561.8	2026-06-16	2026-06-21 02:58:42.718784+00	0	0	1	["airport"]
96	CMP-SCDEMO-070	SC Demo Component 070	150	l	1805.8	2026-05-17	2026-06-18 02:58:42.718784+00	0	0	1	["airport"]
97	CMP-SCDEMO-071	SC Demo Component 071	151	pcs	1.8892	2026-05-16	2026-06-17 02:58:42.718784+00	0	0	1	["westend"]
98	CMP-SCDEMO-072	SC Demo Component 072	152	kg	724.2	2026-05-15	2026-06-16 02:58:42.718784+00	0	0	1	["downtown"]
99	CMP-SCDEMO-072	SC Demo Component 072	47	kg	724.2	2026-06-27	2026-06-28 02:58:42.718784+00	0	0	1	["midtown"]
100	CMP-SCDEMO-073	SC Demo Component 073	153	l	975.8	2026-05-14	2026-06-15 02:58:42.718784+00	0	0	1	["midtown"]
101	CMP-SCDEMO-074	SC Demo Component 074	154	pcs	1.5331	2026-05-13	2026-06-14 02:58:42.718784+00	0	0	1	["airport"]
102	CMP-SCDEMO-075	SC Demo Component 075	155	kg	1769.5	2026-05-12	2026-06-13 02:58:42.718784+00	0	0	1	["westend"]
103	CMP-SCDEMO-075	SC Demo Component 075	50	kg	1769.5	2026-06-24	2026-06-25 02:58:42.718784+00	0	0	1	["downtown"]
104	CMP-SCDEMO-076	SC Demo Component 076	156	l	729.3	2026-05-11	2026-06-12 02:58:42.718784+00	0	0	1	["downtown"]
105	CMP-SCDEMO-077	SC Demo Component 077	157	pcs	1.0067	2026-05-10	2026-06-11 02:58:42.718784+00	0	0	1	["midtown"]
106	CMP-SCDEMO-078	SC Demo Component 078	158	kg	1563.9	2026-05-09	2026-06-10 02:58:42.718784+00	0	0	1	["airport"]
107	CMP-SCDEMO-078	SC Demo Component 078	53	kg	1563.9	2026-06-21	2026-06-22 02:58:42.718784+00	0	0	1	["westend"]
108	CMP-SCDEMO-079	SC Demo Component 079	159	l	1138.4	2026-05-08	2026-06-09 02:58:42.718784+00	0	0	1	["westend"]
109	CMP-SCDEMO-080	SC Demo Component 080	160	pcs	1.2175	2026-06-16	2026-06-08 02:58:42.718784+00	0	0	1	["downtown"]
110	CMP-SCDEMO-081	SC Demo Component 081	161	kg	163.4	2026-06-15	2026-06-07 02:58:42.718784+00	0	0	1	["midtown"]
111	CMP-SCDEMO-081	SC Demo Component 081	16	kg	163.4	2026-06-18	2026-06-29 02:58:42.718784+00	0	0	1	["airport"]
112	CMP-SCDEMO-082	SC Demo Component 082	162	l	443.2	2026-06-14	2026-06-06 02:58:42.718784+00	0	0	1	["airport"]
113	CMP-SCDEMO-083	SC Demo Component 083	163	pcs	1.2373	2026-06-13	2026-06-05 02:58:42.718784+00	0	0	1	["westend"]
114	CMP-SCDEMO-084	SC Demo Component 084	164	kg	1784.2	2026-06-12	2026-06-04 02:58:42.718784+00	0	0	1	["downtown"]
115	CMP-SCDEMO-084	SC Demo Component 084	19	kg	1784.2	2026-06-29	2026-06-26 02:58:42.718784+00	0	0	1	["midtown"]
116	CMP-SCDEMO-085	SC Demo Component 085	165	l	1018.1	2026-06-11	2026-06-03 02:58:42.718784+00	0	0	1	["midtown"]
117	CMP-SCDEMO-086	SC Demo Component 086	166	pcs	0.7117	2026-06-10	2026-06-02 02:58:42.718784+00	0	0	1	["airport"]
118	CMP-SCDEMO-087	SC Demo Component 087	167	kg	344.8	2026-06-09	2026-06-01 02:58:42.718784+00	0	0	1	["westend"]
119	CMP-SCDEMO-087	SC Demo Component 087	22	kg	344.8	2026-06-26	2026-06-23 02:58:42.718784+00	0	0	1	["downtown"]
120	CMP-SCDEMO-088	SC Demo Component 088	168	l	490.1	2026-06-08	2026-05-31 02:58:42.718784+00	0	0	1	["downtown"]
121	CMP-SCDEMO-089	SC Demo Component 089	169	pcs	0.5076	2026-06-07	2026-05-30 02:58:42.718784+00	0	0	1	["midtown"]
122	CMP-SCDEMO-090	SC Demo Component 090	170	kg	1314.3	2026-06-06	2026-05-29 02:58:42.718784+00	0	0	1	["airport"]
123	CMP-SCDEMO-090	SC Demo Component 090	25	kg	1314.3	2026-06-23	2026-06-30 02:58:42.718784+00	0	0	1	["westend"]
124	CMP-SCDEMO-091	SC Demo Component 091	171	l	795.6	2026-06-05	2026-05-28 02:58:42.718784+00	0	0	1	["westend"]
125	CMP-SCDEMO-092	SC Demo Component 092	172	pcs	0.3898	2026-06-04	2026-05-27 02:58:42.718784+00	0	0	1	["downtown"]
126	CMP-SCDEMO-093	SC Demo Component 093	173	kg	564.6	2026-06-03	2026-05-26 02:58:42.718784+00	0	0	1	["midtown"]
127	CMP-SCDEMO-093	SC Demo Component 093	28	kg	564.6	2026-06-20	2026-06-27 02:58:42.718784+00	0	0	1	["airport"]
128	CMP-SCDEMO-094	SC Demo Component 094	174	l	773.7	2026-06-02	2026-05-25 02:58:42.718784+00	0	0	1	["airport"]
129	CMP-SCDEMO-095	SC Demo Component 095	175	pcs	0.4694	2026-06-01	2026-05-24 02:58:42.718784+00	0	0	1	["westend"]
130	CMP-SCDEMO-096	SC Demo Component 096	176	kg	1600.5	2026-05-31	2026-05-23 02:58:42.718784+00	0	0	1	["downtown"]
131	CMP-SCDEMO-096	SC Demo Component 096	31	kg	1600.5	2026-06-17	2026-06-24 02:58:42.718784+00	0	0	1	["midtown"]
132	CMP-SCDEMO-097	SC Demo Component 097	177	l	847.9	2026-05-30	2026-05-22 02:58:42.718784+00	0	0	1	["midtown"]
133	CMP-SCDEMO-098	SC Demo Component 098	178	pcs	1.4968	2026-05-29	2026-05-21 02:58:42.718784+00	0	0	1	["airport"]
134	CMP-SCDEMO-099	SC Demo Component 099	179	kg	115.6	2026-05-28	2026-05-20 02:58:42.718784+00	0	0	1	["westend"]
135	CMP-SCDEMO-099	SC Demo Component 099	34	kg	115.6	2026-06-28	2026-06-21 02:58:42.718784+00	0	0	1	["downtown"]
136	CMP-SCDEMO-100	SC Demo Component 100	180	l	1289.7	2026-05-27	2026-05-19 02:58:42.718784+00	0	0	1	["downtown"]
137	CMP-SCDEMO-101	SC Demo Component 101	181	pcs	1.7333	2026-05-26	2026-05-18 02:58:42.718784+00	0	0	1	["midtown"]
138	CMP-SCDEMO-102	SC Demo Component 102	182	kg	1410.8	2026-05-25	2026-05-17 02:58:42.718784+00	0	0	1	["airport"]
139	CMP-SCDEMO-102	SC Demo Component 102	37	kg	1410.8	2026-06-25	2026-06-28 02:58:42.718784+00	0	0	1	["westend"]
140	CMP-SCDEMO-103	SC Demo Component 103	183	l	1823.8	2026-05-24	2026-05-16 02:58:42.718784+00	0	0	1	["westend"]
141	CMP-SCDEMO-104	SC Demo Component 104	184	pcs	1.5783	2026-05-23	2026-05-15 02:58:42.718784+00	0	0	1	["downtown"]
142	CMP-SCDEMO-105	SC Demo Component 105	185	kg	681.6	2026-05-22	2026-06-18 02:58:42.718784+00	0	0	1	["midtown"]
143	CMP-SCDEMO-105	SC Demo Component 105	40	kg	681.6	2026-06-22	2026-06-25 02:58:42.718784+00	0	0	1	["airport"]
144	CMP-SCDEMO-106	SC Demo Component 106	186	l	1888.8	2026-05-21	2026-06-17 02:58:42.718784+00	0	0	1	["airport"]
145	CMP-SCDEMO-107	SC Demo Component 107	187	pcs	1.4884	2026-05-20	2026-06-16 02:58:42.718784+00	0	0	1	["westend"]
146	CMP-SCDEMO-108	SC Demo Component 108	188	kg	1364	2026-05-19	2026-06-15 02:58:42.718784+00	0	0	1	["downtown"]
147	CMP-SCDEMO-108	SC Demo Component 108	43	kg	1364	2026-06-19	2026-06-22 02:58:42.718784+00	0	0	1	["midtown"]
148	CMP-SCDEMO-109	SC Demo Component 109	189	l	1862.5	2026-05-18	2026-06-14 02:58:42.718784+00	0	0	1	["midtown"]
149	CMP-SCDEMO-110	SC Demo Component 110	190	pcs	1.0191	2026-05-17	2026-06-13 02:58:42.718784+00	0	0	1	["airport"]
150	CMP-SCDEMO-111	SC Demo Component 111	191	kg	674.7	2026-05-16	2026-06-12 02:58:42.718784+00	0	0	1	["westend"]
151	CMP-SCDEMO-111	SC Demo Component 111	46	kg	674.7	2026-06-16	2026-06-29 02:58:42.718784+00	0	0	1	["downtown"]
152	CMP-SCDEMO-112	SC Demo Component 112	192	l	1953	2026-05-15	2026-06-11 02:58:42.718784+00	0	0	1	["downtown"]
153	CMP-SCDEMO-113	SC Demo Component 113	193	pcs	1.5544	2026-05-14	2026-06-10 02:58:42.718784+00	0	0	1	["midtown"]
154	CMP-SCDEMO-114	SC Demo Component 114	194	kg	1217.4	2026-05-13	2026-06-09 02:58:42.718784+00	0	0	1	["airport"]
155	CMP-SCDEMO-114	SC Demo Component 114	49	kg	1217.4	2026-06-27	2026-06-26 02:58:42.718784+00	0	0	1	["westend"]
156	CMP-SCDEMO-115	SC Demo Component 115	195	l	1902.3	2026-05-12	2026-06-08 02:58:42.718784+00	0	0	1	["westend"]
157	CMP-SCDEMO-116	SC Demo Component 116	196	pcs	1.4264	2026-05-11	2026-06-07 02:58:42.718784+00	0	0	1	["downtown"]
158	CMP-SCDEMO-117	SC Demo Component 117	197	kg	1450.6	2026-05-10	2026-06-06 02:58:42.718784+00	0	0	1	["midtown"]
159	CMP-SCDEMO-117	SC Demo Component 117	52	kg	1450.6	2026-06-24	2026-06-23 02:58:42.718784+00	0	0	1	["airport"]
160	CMP-SCDEMO-118	SC Demo Component 118	198	l	1957.8	2026-05-09	2026-06-05 02:58:42.718784+00	0	0	1	["airport"]
161	CMP-SCDEMO-119	SC Demo Component 119	199	pcs	1.4378	2026-05-08	2026-06-04 02:58:42.718784+00	0	0	1	["westend"]
162	CMP-SCDEMO-120	SC Demo Component 120	200	kg	1636.2	2026-06-16	2026-06-03 02:58:42.718784+00	0	0	1	["downtown"]
163	CMP-SCDEMO-120	SC Demo Component 120	15	kg	1636.2	2026-06-21	2026-06-30 02:58:42.718784+00	0	0	1	["midtown"]
164	CMP-SCDEMO-121	SC Demo Component 121	201	l	1210.2	2026-06-15	2026-06-02 02:58:42.718784+00	0	0	1	["midtown"]
165	CMP-SCDEMO-122	SC Demo Component 122	202	pcs	1.7475	2026-06-14	2026-06-01 02:58:42.718784+00	0	0	1	["airport"]
166	CMP-SCDEMO-123	SC Demo Component 123	203	kg	1630.5	2026-06-13	2026-05-31 02:58:42.718784+00	0	0	1	["westend"]
167	CMP-SCDEMO-123	SC Demo Component 123	18	kg	1630.5	2026-06-18	2026-06-27 02:58:42.718784+00	0	0	1	["downtown"]
168	CMP-SCDEMO-124	SC Demo Component 124	204	l	420.8	2026-06-12	2026-05-30 02:58:42.718784+00	0	0	1	["downtown"]
169	CMP-SCDEMO-125	SC Demo Component 125	205	pcs	0.4322	2026-06-11	2026-05-29 02:58:42.718784+00	0	0	1	["midtown"]
170	CMP-SCDEMO-126	SC Demo Component 126	206	kg	1924.4	2026-06-10	2026-05-28 02:58:42.718784+00	0	0	1	["airport"]
171	CMP-SCDEMO-126	SC Demo Component 126	21	kg	1924.4	2026-06-29	2026-06-24 02:58:42.718784+00	0	0	1	["westend"]
172	CMP-SCDEMO-127	SC Demo Component 127	207	l	271.4	2026-06-09	2026-05-27 02:58:42.718784+00	0	0	1	["westend"]
173	CMP-SCDEMO-128	SC Demo Component 128	208	pcs	1.0026	2026-06-08	2026-05-26 02:58:42.718784+00	0	0	1	["downtown"]
174	CMP-SCDEMO-129	SC Demo Component 129	209	kg	1307.7	2026-06-07	2026-05-25 02:58:42.718784+00	0	0	1	["midtown"]
175	CMP-SCDEMO-129	SC Demo Component 129	24	kg	1307.7	2026-06-26	2026-06-21 02:58:42.718784+00	0	0	1	["airport"]
176	CMP-SCDEMO-130	SC Demo Component 130	210	l	1210.1	2026-06-06	2026-05-24 02:58:42.718784+00	0	0	1	["airport"]
177	CMP-SCDEMO-131	SC Demo Component 131	211	pcs	1.5967	2026-06-05	2026-05-23 02:58:42.718784+00	0	0	1	["westend"]
178	CMP-SCDEMO-132	SC Demo Component 132	212	kg	1855.2	2026-06-04	2026-05-22 02:58:42.718784+00	0	0	1	["downtown"]
179	CMP-SCDEMO-132	SC Demo Component 132	27	kg	1855.2	2026-06-23	2026-06-28 02:58:42.718784+00	0	0	1	["midtown"]
180	CMP-SCDEMO-133	SC Demo Component 133	213	l	745.4	2026-06-03	2026-05-21 02:58:42.718784+00	0	0	1	["midtown"]
181	CMP-SCDEMO-134	SC Demo Component 134	214	pcs	1.0975	2026-06-02	2026-05-20 02:58:42.718784+00	0	0	1	["airport"]
182	CMP-SCDEMO-135	SC Demo Component 135	215	kg	1718.5	2026-06-01	2026-05-19 02:58:42.718784+00	0	0	1	["westend"]
183	CMP-SCDEMO-135	SC Demo Component 135	30	kg	1718.5	2026-06-20	2026-06-25 02:58:42.718784+00	0	0	1	["downtown"]
184	CMP-SCDEMO-136	SC Demo Component 136	216	l	2027	2026-05-31	2026-05-18 02:58:42.718784+00	0	0	1	["downtown"]
185	CMP-SCDEMO-137	SC Demo Component 137	217	pcs	1.4969	2026-05-30	2026-05-17 02:58:42.718784+00	0	0	1	["midtown"]
186	CMP-SCDEMO-138	SC Demo Component 138	218	kg	1388.6	2026-05-29	2026-05-16 02:58:42.718784+00	0	0	1	["airport"]
187	CMP-SCDEMO-138	SC Demo Component 138	33	kg	1388.6	2026-06-17	2026-06-22 02:58:42.718784+00	0	0	1	["westend"]
188	CMP-SCDEMO-139	SC Demo Component 139	219	l	1757.6	2026-05-28	2026-05-15 02:58:42.718784+00	0	0	1	["westend"]
189	CMP-SCDEMO-140	SC Demo Component 140	220	pcs	2.0183	2026-05-27	2026-06-18 02:58:42.718784+00	0	0	1	["downtown"]
190	CMP-SCDEMO-141	SC Demo Component 141	221	kg	531.8	2026-05-26	2026-06-17 02:58:42.718784+00	0	0	1	["midtown"]
191	CMP-SCDEMO-141	SC Demo Component 141	36	kg	531.8	2026-06-28	2026-06-29 02:58:42.718784+00	0	0	1	["airport"]
192	CMP-SCDEMO-142	SC Demo Component 142	222	l	266.3	2026-05-25	2026-06-16 02:58:42.718784+00	0	0	1	["airport"]
193	CMP-SCDEMO-143	SC Demo Component 143	223	pcs	0.9288	2026-05-24	2026-06-15 02:58:42.718784+00	0	0	1	["westend"]
194	CMP-SCDEMO-144	SC Demo Component 144	224	kg	1095.7	2026-05-23	2026-06-14 02:58:42.718784+00	0	0	1	["downtown"]
195	CMP-SCDEMO-144	SC Demo Component 144	39	kg	1095.7	2026-06-25	2026-06-26 02:58:42.718784+00	0	0	1	["midtown"]
196	CMP-SCDEMO-145	SC Demo Component 145	225	l	784.4	2026-05-22	2026-06-13 02:58:42.718784+00	0	0	1	["midtown"]
197	CMP-SCDEMO-146	SC Demo Component 146	226	pcs	0.3771	2026-05-21	2026-06-12 02:58:42.718784+00	0	0	1	["airport"]
198	CMP-SCDEMO-147	SC Demo Component 147	227	kg	565.2	2026-05-20	2026-06-11 02:58:42.718784+00	0	0	1	["westend"]
199	CMP-SCDEMO-147	SC Demo Component 147	42	kg	565.2	2026-06-22	2026-06-23 02:58:42.718784+00	0	0	1	["downtown"]
200	CMP-SCDEMO-148	SC Demo Component 148	228	l	303.9	2026-05-19	2026-06-10 02:58:42.718784+00	0	0	1	["downtown"]
201	CMP-SCDEMO-149	SC Demo Component 149	229	pcs	1.311	2026-05-18	2026-06-09 02:58:42.718784+00	0	0	1	["midtown"]
202	CMP-SCDEMO-150	SC Demo Component 150	230	kg	1702.2	2026-05-17	2026-06-08 02:58:42.718784+00	0	0	1	["airport"]
203	CMP-SCDEMO-150	SC Demo Component 150	45	kg	1702.2	2026-06-19	2026-06-30 02:58:42.718784+00	0	0	1	["westend"]
204	CMP-SCDEMO-151	SC Demo Component 151	231	l	105	2026-05-16	2026-06-07 02:58:42.718784+00	0	0	1	["westend"]
205	CMP-SCDEMO-152	SC Demo Component 152	232	pcs	1.6031	2026-05-15	2026-06-06 02:58:42.718784+00	0	0	1	["downtown"]
206	CMP-SCDEMO-153	SC Demo Component 153	233	kg	155	2026-05-14	2026-06-05 02:58:42.718784+00	0	0	1	["midtown"]
207	CMP-SCDEMO-153	SC Demo Component 153	48	kg	155	2026-06-16	2026-06-27 02:58:42.718784+00	0	0	1	["airport"]
208	CMP-SCDEMO-154	SC Demo Component 154	234	l	1635.6	2026-05-13	2026-06-04 02:58:42.718784+00	0	0	1	["airport"]
209	CMP-SCDEMO-155	SC Demo Component 155	235	pcs	1.4523	2026-05-12	2026-06-03 02:58:42.718784+00	0	0	1	["westend"]
210	CMP-SCDEMO-156	SC Demo Component 156	236	kg	620.6	2026-05-11	2026-06-02 02:58:42.718784+00	0	0	1	["downtown"]
211	CMP-SCDEMO-156	SC Demo Component 156	51	kg	620.6	2026-06-27	2026-06-24 02:58:42.718784+00	0	0	1	["midtown"]
212	CMP-SCDEMO-157	SC Demo Component 157	237	l	1893.7	2026-05-10	2026-06-01 02:58:42.718784+00	0	0	1	["midtown"]
213	CMP-SCDEMO-158	SC Demo Component 158	238	pcs	0.4894	2026-05-09	2026-05-31 02:58:42.718784+00	0	0	1	["airport"]
214	CMP-SCDEMO-159	SC Demo Component 159	239	kg	763.5	2026-05-08	2026-05-30 02:58:42.718784+00	0	0	1	["westend"]
215	CMP-SCDEMO-159	SC Demo Component 159	54	kg	763.5	2026-06-24	2026-06-21 02:58:42.718784+00	0	0	1	["downtown"]
216	CMP-SCDEMO-160	SC Demo Component 160	240	l	1049.5	2026-06-16	2026-05-29 02:58:42.718784+00	0	0	1	["downtown"]
217	CMP-SCDEMO-161	SC Demo Component 161	241	pcs	1.576	2026-06-15	2026-05-28 02:58:42.718784+00	0	0	1	["midtown"]
218	CMP-SCDEMO-162	SC Demo Component 162	242	kg	1067	2026-06-14	2026-05-27 02:58:42.718784+00	0	0	1	["airport"]
219	CMP-SCDEMO-162	SC Demo Component 162	17	kg	1067	2026-06-21	2026-06-28 02:58:42.718784+00	0	0	1	["westend"]
220	CMP-SCDEMO-163	SC Demo Component 163	243	l	1452	2026-06-13	2026-05-26 02:58:42.718784+00	0	0	1	["westend"]
221	CMP-SCDEMO-164	SC Demo Component 164	244	pcs	1.672	2026-06-12	2026-05-25 02:58:42.718784+00	0	0	1	["downtown"]
222	CMP-SCDEMO-165	SC Demo Component 165	245	kg	964.7	2026-06-11	2026-05-24 02:58:42.718784+00	0	0	1	["midtown"]
223	CMP-SCDEMO-165	SC Demo Component 165	20	kg	964.7	2026-06-18	2026-06-25 02:58:42.718784+00	0	0	1	["airport"]
224	CMP-SCDEMO-166	SC Demo Component 166	246	l	347.5	2026-06-10	2026-05-23 02:58:42.718784+00	0	0	1	["airport"]
225	CMP-SCDEMO-167	SC Demo Component 167	247	pcs	1.9533	2026-06-09	2026-05-22 02:58:42.718784+00	0	0	1	["westend"]
226	CMP-SCDEMO-168	SC Demo Component 168	248	kg	397	2026-06-08	2026-05-21 02:58:42.718784+00	0	0	1	["downtown"]
227	CMP-SCDEMO-168	SC Demo Component 168	23	kg	397	2026-06-29	2026-06-22 02:58:42.718784+00	0	0	1	["midtown"]
228	CMP-SCDEMO-169	SC Demo Component 169	249	l	442.7	2026-06-07	2026-05-20 02:58:42.718784+00	0	0	1	["midtown"]
229	CMP-SCDEMO-170	SC Demo Component 170	250	pcs	1.7154	2026-06-06	2026-05-19 02:58:42.718784+00	0	0	1	["airport"]
233	CMP-SCFIFO-001	SC FIFO Demo Wagyu	50	kg	38.5	2026-05-20	2026-06-11 12:16:19.502331+00	25	0	1	["downtown"]
234	CMP-SCFIFO-001	SC FIFO Demo Wagyu	40	kg	42	2026-06-06	2026-06-18 13:16:19.502331+00	26	0	1	["downtown"]
235	CMP-SCFIFO-001	SC FIFO Demo Wagyu	30	kg	45.75	2026-06-22	2026-06-28 14:16:19.502331+00	27	0	1	["downtown"]
236	CMP-SCFIFO-001	SC FIFO Demo Wagyu	40	kg	50	2026-07-01	2026-07-03 10:00:00+00	28	0	1	["downtown"]
\.


--
-- Data for Name: LeaveBalances; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public."LeaveBalances" ("EmployeeId", "RdoBalance", "RphBalance", "AlBalance") FROM stdin;
1	0.0	0.0	16.0
2	0.0	0.0	16.0
3	0.0	0.0	16.0
4	0.0	0.0	16.0
5	0.0	0.0	16.0
6	0.0	0.0	16.0
7	0.0	0.0	16.0
8	0.0	0.0	16.0
9	0.0	0.0	16.0
10	0.0	0.0	16.0
11	0.0	0.0	16.0
12	0.0	0.0	16.0
13	0.0	0.0	16.0
14	0.0	0.0	16.0
15	0.0	0.0	16.0
16	0.0	0.0	28.0
17	0.0	0.0	16.0
18	0.0	0.0	16.0
19	0.0	0.0	16.0
20	0.0	0.0	16.0
21	0.0	0.0	16.0
22	0.0	0.0	16.0
23	0.0	0.0	16.0
24	0.0	0.0	16.0
25	0.0	0.0	16.0
26	0.0	0.0	16.0
27	0.0	0.0	16.0
28	0.0	0.0	16.0
29	0.0	0.0	16.0
30	0.0	0.0	16.0
31	0.0	0.0	16.0
32	0.0	0.0	16.0
33	0.0	0.0	16.0
34	0.0	0.0	16.0
35	0.0	0.0	28.0
36	0.0	0.0	0.0
\.


--
-- Data for Name: LeaveRequests; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public."LeaveRequests" ("Id", "EmployeeId", "Type", "StartDate", "EndDate", "Status", "Reason") FROM stdin;
\.


--
-- Data for Name: Locations; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public."Locations" ("Id", "ExternalId", "Name", "Address", "CompanyId", "AddressLine1", "AddressLine2", "City", "StateProvince", "Postcode", "PrincipalContactUserId", "SalesToday", "SalesWtd", "SalesMtd", "SalesYtd", "SalesPrevToday", "SalesPrevWtd", "SalesPrevMtd", "SalesPrevYtd", "CoversToday", "CoversWtd", "CoversMtd", "CoversYtd", "CoversPrevToday", "CoversPrevWtd", "CoversPrevMtd", "CoversPrevYtd", "ChecksToday", "ChecksWtd", "ChecksMtd", "ChecksYtd", "ChecksPrevToday", "ChecksPrevWtd", "ChecksPrevMtd", "ChecksPrevYtd", "BusinessTypesJson", "VendorPolicyTagsJson", "ModulesJson") FROM stdin;
1	downtown	Downtown	12 King St, Kuala Lumpur, Wilayah Persekutuan, 50000	1	12 King St		Kuala Lumpur	Wilayah Persekutuan	50000	1	4210.0	22800.0	82400.0	448500.0	3890.0	20500.0	84100.0	382000.0	112	598	2540	26900	105	551	2610	23800	51	274	1160	12230	48	252	1190	10800	["Central Kitchen / Warehouse (supply only)"]	["halal"]	[]
2	midtown	Midtown	88 Park Ave, Petaling Jaya, Selangor, 47810	1	88 Park Ave		Petaling Jaya	Selangor	47810	3	2980.0	16100.0	58200.0	318400.0	2750.0	14900.0	55900.0	274000.0	80	428	1820	19200	74	396	1870	17100	36	196	832	8730	34	181	855	7780	["Central Kitchen / Warehouse (supply only)"]	["non-halal"]	[]
5	sg-marina	Marina Square	6 Raffles Blvd, Singapore, Singapore 039594	2	6 Raffles Blvd		Singapore	Singapore	039594	5	0.0	0.0	0.0	0.0	0.0	0.0	0.0	0.0	0	0	0	0	0	0	0	0	0	0	0	0	0	0	0	0	[]	[]	[]
6	sg-orchard	Orchard Gateway	277 Orchard Road, Singapore, Singapore 238858	2	277 Orchard Road		Singapore	Singapore	238858	6	0.0	0.0	0.0	0.0	0.0	0.0	0.0	0.0	0	0	0	0	0	0	0	0	0	0	0	0	0	0	0	0	[]	[]	[]
7	au-cbd	Melbourne CBD	250 Flinders Lane, Melbourne, Victoria 3000	3	250 Flinders Lane		Melbourne	Victoria	3000	7	0.0	0.0	0.0	0.0	0.0	0.0	0.0	0.0	0	0	0	0	0	0	0	0	0	0	0	0	0	0	0	0	[]	[]	[]
8	au-southbank	Southbank	3 Southgate Ave, Southbank, Victoria 3006	3	3 Southgate Ave		Southbank	Victoria	3006	7	0.0	0.0	0.0	0.0	0.0	0.0	0.0	0.0	0	0	0	0	0	0	0	0	0	0	0	0	0	0	0	0	[]	[]	[]
3	airport	Airport Terminal	T2 Departures, Sepang, Selangor, 43900	1	T2 Departures		Sepang	Selangor	43900	3	1380.0	7440.0	26800.0	147200.0	1510.0	8100.0	29400.0	128600.0	38	205	874	9240	42	224	960	8100	27	146	624	6590	30	160	686	5780	[]	[]	[]
4	westend	West End	5 Harbour Walk, George Town, Penang, 10200	1	5 Harbour Walk		George Town	Penang	10200	1	1080.0	5710.0	19940.0	110680.0	990.0	5250.0	18600.0	94800.0	26	132	587	6100	24	122	570	5420	12	61	270	2810	11	56	262	2490	[]	[]	[]
9	loc3926	Loc3926	12 Jalan Test, Kuala Lumpur, WP Kuala Lumpur, 50000	1	12 Jalan Test		Kuala Lumpur	WP Kuala Lumpur	50000	\N	0	0	0	0	0	0	0	0	0	0	0	0	0	0	0	0	0	0	0	0	0	0	0	0	[]	[]	[]
10	weissbrau-pavilion-kuala-lumpur	Weissbrau Pavilion Kuala Lumpur	168 Jalan Bukit Bintang, Kuala Lumpur, Wilayah Persekutuan, 55100	5	168 Jalan Bukit Bintang	Lot 3.05.02 & C3.16.00, Level 3 Pavilion KL	Kuala Lumpur	Wilayah Persekutuan	55100	35	0	0	0	0	0	0	0	0	0	0	0	0	0	0	0	0	0	0	0	0	0	0	0	0	[]	[]	[]
\.


--
-- Data for Name: MandatoryContributions; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public."MandatoryContributions" ("Id", "PayStructureId", "Name", "EmployerPct", "EmployeePct") FROM stdin;
\.


--
-- Data for Name: MenuItems; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public."MenuItems" ("Id", "Name", "Category", "Orders", "Revenue", "MarginPercent") FROM stdin;
1	Wagyu Burger	food	312	9360.0	68
2	Truffle Pasta	food	287	10332.0	74
3	Grilled Salmon	food	251	11295.0	71
4	Merlot Reserve	beverage	198	4752.0	76
5	Craft Beer	beverage	174	2088.0	71
\.


--
-- Data for Name: OrderTemplateItems; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public."OrderTemplateItems" ("Id", "OrderTemplateId", "ComponentId", "ComponentName", "VendorProductId", "VendorExternalId", "VendorName", "ProductName", "Quantity", "ComponentUom", "DeliveryUnit", "SortOrder") FROM stdin;
1	1	CMP-00FLOU-001	00 Flour					10	kg		0
2	1	CMP-CRAFTI-001	Craft IPA Beer					3	l		1
3	2	CMP-BAKEDB-001	Baked Beans	VP-BEA002	V011	Metro Canned Foods	Baked Beans	1	Gr	Box/12tin/380gr	0
4	2	CMP-BURRAT-001	Burrata	VP-BUR001	V003	Artisan Dairy Co.	Burrata	1	Each	Case/6each	1
\.


--
-- Data for Name: OrderTemplates; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public."OrderTemplates" ("Id", "Name", "VendorExternalId", "VendorName", "ScheduleMode", "WeekdaysJson", "MonthDaysJson", "RepeatEnabled", "CompanyId", "LocationIdsJson", "CreatedAt", "UpdatedAt") FROM stdin;
1	Monday Order			weekday	["Mon"]	[]	t	1	["airport","downtown","midtown","westend"]	2026-07-02 03:39:37.084682+00	2026-07-02 03:39:37.084722+00
2	Thursday Order			weekday	["Thu"]	[]	t	1	["airport"]	2026-07-02 05:14:49.054921+00	2026-07-02 05:14:49.054962+00
\.


--
-- Data for Name: PayStructures; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public."PayStructures" ("Id", "CompanyId", "CountryCode", "PayType", "PayCycle", "ProvidentFundEmployerPct", "ProvidentFundEmployeePct", "ForeignProvidentFundEmployerPct", "ForeignProvidentFundEmployeePct", "ForeignSocsoEmployerPct", "OvertimeRateMultiplier", "OvertimeCalculationMode", "OvertimeFixedHourlyRate", "Active") FROM stdin;
1	3	AU	Fixed Salary	Monthly	12	11	2	2	1.25	1.50	Calculated	\N	t
2	1	MY	Fixed Salary	Monthly	13	11	2	2	1.25	1.50	Calculated	\N	t
\.


--
-- Data for Name: PayrollRunLines; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public."PayrollRunLines" ("Id", "PayrollRunId", "EmployeeId", "EmployeeCode", "EmployeeName", "Department", "Position", "PresentDays", "WorkingDays", "TotalHours", "OvertimeHours", "AttendanceRatio", "BaseSalary", "ServiceAllowance", "AccommodationAllowance", "TransportAllowance", "MobileAllowance", "BonusAmount", "OvertimeAmount", "EpfEmployeeAmount", "EpfEmployerAmount", "SocsoEmployeeAmount", "SocsoEmployerAmount", "IncomeTaxAmount", "GrossPay", "TotalPayout") FROM stdin;
\.


--
-- Data for Name: PayrollRuns; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public."PayrollRuns" ("Id", "CompanyId", "Year", "Month", "PayCycle", "PayType", "CountryCode", "PeriodLabel", "PeriodStart", "PeriodEnd", "ProcessedAt", "TotalGross", "TotalPayout", "EmployeeCount") FROM stdin;
\.


--
-- Data for Name: PerformanceAppraisals; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public."PerformanceAppraisals" ("Id", "EmployeeId", "Year", "Rating", "Score", "Reviewer", "Comments") FROM stdin;
\.


--
-- Data for Name: PosCustomers; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public."PosCustomers" ("Id", "CompanyId", "ExternalId", "Name", "Address", "City", "State", "Postcode", "Phone", "Fax", "Email", "LoyaltySummaryJson", "CouponSummaryJson", "ActivityHistoryJson", "Active") FROM stdin;
1	2	POSC-001	Nurul Aisyah	15 Jalan Ampang	Kuala Lumpur	Wilayah Persekutuan	50450	+60 12-998 7766		nurul.aisyah@email.com	[{"year":2025,"earned":1250,"used":980,"balance":270},{"year":2026,"earned":840,"used":320,"balance":790}]	[{"year":2025,"received":6,"used":5},{"year":2026,"received":4,"used":2}]	[{"activityDate":"2026-07-07","activityLocation":"Downtown","activityType":"Dine-in","checkNo":"CHK-20260707-1001","totalSpending":85.0,"pointsEarned":25,"pointsUsed":0,"pointsBalance":525,"couponUsed":null,"receiptLines":[{"itemName":"Wagyu Burger","qty":1,"unitPrice":32.00,"lineTotal":32.00},{"itemName":"Craft Beer","qty":2,"unitPrice":12.00,"lineTotal":24.00},{"itemName":"Service Charge","qty":1,"unitPrice":29.00,"lineTotal":29.00}]},{"activityDate":"2026-06-30","activityLocation":"Midtown","activityType":"Take-out","checkNo":"CHK-20260630-1002","totalSpending":107.5,"pointsEarned":35,"pointsUsed":15,"pointsBalance":545,"couponUsed":null,"receiptLines":[{"itemName":"Wagyu Burger","qty":1,"unitPrice":32.00,"lineTotal":32.00},{"itemName":"Craft Beer","qty":2,"unitPrice":12.00,"lineTotal":24.00},{"itemName":"Service Charge","qty":1,"unitPrice":51.50,"lineTotal":51.50}]},{"activityDate":"2026-06-23","activityLocation":"Airport Terminal","activityType":"Pick-up","checkNo":"CHK-20260623-1003","totalSpending":130.0,"pointsEarned":45,"pointsUsed":0,"pointsBalance":590,"couponUsed":"CPN-2026-0042","receiptLines":[{"itemName":"Wagyu Burger","qty":1,"unitPrice":32.00,"lineTotal":32.00},{"itemName":"Craft Beer","qty":2,"unitPrice":12.00,"lineTotal":24.00},{"itemName":"Service Charge","qty":1,"unitPrice":74.00,"lineTotal":74.00}]},{"activityDate":"2026-06-16","activityLocation":"Downtown","activityType":"Online Delivery","checkNo":"CHK-20260616-1004","totalSpending":152.5,"pointsEarned":55,"pointsUsed":15,"pointsBalance":630,"couponUsed":null,"receiptLines":[{"itemName":"Wagyu Burger","qty":1,"unitPrice":32.00,"lineTotal":32.00},{"itemName":"Craft Beer","qty":2,"unitPrice":12.00,"lineTotal":24.00},{"itemName":"Service Charge","qty":1,"unitPrice":96.50,"lineTotal":96.50}]},{"activityDate":"2026-06-09","activityLocation":"Midtown","activityType":"Dine-in","checkNo":"CHK-20260609-1005","totalSpending":175.0,"pointsEarned":65,"pointsUsed":0,"pointsBalance":695,"couponUsed":null,"receiptLines":[{"itemName":"Wagyu Burger","qty":1,"unitPrice":32.00,"lineTotal":32.00},{"itemName":"Craft Beer","qty":2,"unitPrice":12.00,"lineTotal":24.00},{"itemName":"Service Charge","qty":1,"unitPrice":119.00,"lineTotal":119.00}]}]	1
2	2	POSC-002	James Wong	42 Persiaran KLCC	Kuala Lumpur	Wilayah Persekutuan	50088	+60 17-445 2211		james.wong@email.com	[{"year":2026,"earned":420,"used":150,"balance":270}]	[{"year":2026,"received":2,"used":1}]	[{"activityDate":"2026-07-07","activityLocation":"Downtown","activityType":"Dine-in","checkNo":"CHK-20260707-1001","totalSpending":85.0,"pointsEarned":25,"pointsUsed":0,"pointsBalance":525,"couponUsed":null,"receiptLines":[{"itemName":"Wagyu Burger","qty":1,"unitPrice":32.00,"lineTotal":32.00},{"itemName":"Craft Beer","qty":2,"unitPrice":12.00,"lineTotal":24.00},{"itemName":"Service Charge","qty":1,"unitPrice":29.00,"lineTotal":29.00}]},{"activityDate":"2026-06-30","activityLocation":"Midtown","activityType":"Take-out","checkNo":"CHK-20260630-1002","totalSpending":107.5,"pointsEarned":35,"pointsUsed":15,"pointsBalance":545,"couponUsed":null,"receiptLines":[{"itemName":"Wagyu Burger","qty":1,"unitPrice":32.00,"lineTotal":32.00},{"itemName":"Craft Beer","qty":2,"unitPrice":12.00,"lineTotal":24.00},{"itemName":"Service Charge","qty":1,"unitPrice":51.50,"lineTotal":51.50}]},{"activityDate":"2026-06-23","activityLocation":"Airport Terminal","activityType":"Pick-up","checkNo":"CHK-20260623-1003","totalSpending":130.0,"pointsEarned":45,"pointsUsed":0,"pointsBalance":590,"couponUsed":"CPN-2026-0042","receiptLines":[{"itemName":"Wagyu Burger","qty":1,"unitPrice":32.00,"lineTotal":32.00},{"itemName":"Craft Beer","qty":2,"unitPrice":12.00,"lineTotal":24.00},{"itemName":"Service Charge","qty":1,"unitPrice":74.00,"lineTotal":74.00}]}]	1
\.


--
-- Data for Name: PreviousEmployments; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public."PreviousEmployments" ("Id", "EmployeeId", "CompanyName", "Position", "StartYear", "EndYear", "YearsOfService") FROM stdin;
\.


--
-- Data for Name: ProductAliases; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public."ProductAliases" ("Id", "ProductId", "Name", "Rrp", "SortOrder", "B2bSalesConfigJson") FROM stdin;
1	37	Sauce Aglio Olio Family Mart	18	0	{}
\.


--
-- Data for Name: ProductB2bLocationStocks; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public."ProductB2bLocationStocks" ("Id", "ProductId", "LocationExternalId", "InStock", "SalesPerDay", "ToProduceQty", "ProducedQty", "ExpiryDate", "UpdatedAt", "OnOrderQty") FROM stdin;
1	2	airport	5	0	0	4	2026-07-10	2026-07-03 08:46:42.968462+00	0
2	1	loc-1	1	0	0	1	2026-07-10	2026-07-03 03:37:06.627903+00	0
4	4	downtown	25	4.01	0	32	2026-06-16	2026-07-06 02:58:42.718784+00	0
6	5	midtown	25	2.95	0	33	2026-06-15	2026-07-06 02:58:42.718784+00	0
7	6	airport	25	3.83	0	34	2026-06-14	2026-07-06 02:58:42.718784+00	0
8	7	westend	25	3.91	0	35	2026-07-08	2026-07-06 02:58:42.718784+00	0
9	8	downtown	25	1.09	0	36	2026-07-07	2026-07-06 02:58:42.718784+00	0
10	8	airport	36	0	0	36		2026-07-06 02:58:42.718784+00	0
11	9	midtown	25	2.27	0	37	2026-07-06	2026-07-06 02:58:42.718784+00	0
12	10	airport	25	2.8	0	38	2026-07-05	2026-07-06 02:58:42.718784+00	0
13	11	westend	25	3.57	0	39	2026-07-04	2026-07-06 02:58:42.718784+00	0
14	12	downtown	40	2.05	0	40	2026-07-03	2026-07-06 02:58:42.718784+00	0
15	12	airport	10	0	0	10		2026-07-06 02:58:42.718784+00	0
16	13	midtown	40	1.02	0	41	2026-07-02	2026-07-06 02:58:42.718784+00	0
17	14	airport	40	1.71	0	42	2026-07-01	2026-07-06 02:58:42.718784+00	0
18	15	westend	40	2.26	0	43	2026-06-30	2026-07-06 02:58:42.718784+00	0
19	16	downtown	40	4.41	0	44	2026-06-29	2026-07-06 02:58:42.718784+00	0
20	16	airport	14	0	0	14		2026-07-06 02:58:42.718784+00	0
21	17	midtown	40	1.25	0	45	2026-06-28	2026-07-06 02:58:42.718784+00	0
22	18	airport	40	3.8	0	46	2026-06-27	2026-07-06 02:58:42.718784+00	0
23	19	westend	40	2.42	0	47	2026-06-26	2026-07-06 02:58:42.718784+00	0
24	20	downtown	40	4.35	0	48	2026-06-25	2026-07-06 02:58:42.718784+00	0
25	20	airport	18	0	0	18		2026-07-06 02:58:42.718784+00	0
26	21	midtown	40	1	0	49	2026-06-24	2026-07-06 02:58:42.718784+00	0
27	22	airport	40	0.55	0	50	2026-06-23	2026-07-06 02:58:42.718784+00	0
28	23	westend	40	3.96	0	51	2026-06-22	2026-07-06 02:58:42.718784+00	0
29	24	downtown	40	1.32	0	52	2026-06-21	2026-07-06 02:58:42.718784+00	0
30	24	airport	22	0	0	22		2026-07-06 02:58:42.718784+00	0
31	25	midtown	40	0.83	0	53	2026-06-20	2026-07-06 02:58:42.718784+00	0
32	26	airport	40	4.14	0	54	2026-06-19	2026-07-06 02:58:42.718784+00	0
33	27	westend	55	2.95	0	55	2026-06-18	2026-07-06 02:58:42.718784+00	0
34	28	downtown	55	3.55	0	56	2026-06-17	2026-07-06 02:58:42.718784+00	0
35	28	airport	26	0	0	26		2026-07-06 02:58:42.718784+00	0
36	29	midtown	55	4.18	0	57	2026-06-16	2026-07-06 02:58:42.718784+00	0
37	30	airport	55	4.46	0	58	2026-06-15	2026-07-06 02:58:42.718784+00	0
38	31	westend	55	3.76	0	59	2026-06-14	2026-07-06 02:58:42.718784+00	0
39	32	downtown	55	2.73	0	60	2026-07-08	2026-07-06 02:58:42.718784+00	0
40	32	airport	30	0	0	30		2026-07-06 02:58:42.718784+00	0
3	3	westend	8	3.18	0	31	2026-06-17	2026-07-09 13:57:46.361307+00	5
5	4	airport	24	0	0	32		2026-07-09 13:57:46.39466+00	0
\.


--
-- Data for Name: ProductComponentItems; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public."ProductComponentItems" ("Id", "ProductId", "ComponentId", "ComponentName", "ComponentUom", "ComponentUomPrice", "Quantity", "Subtotal", "SortOrder") FROM stdin;
13	2	CMP-WAGYUB-001	Wagyu Beef A5	Gr	0.021	2000	42	0
14	2	CMP-SEASAL-001	Sea Salt Flakes	Gr	0.008	10	0.08	1
15	2	CMP-BLACKP-001	Black Peppercorns	Gr	0.035	20	0.7	2
16	2	CMP-PAPRIK-001	Paprika	Gr	0	1	0	3
23	1	CMP-PEELED-001	Peeled Garlic	Gr	0.0168421052631579	50	0.842105263157895	0
24	1	CMP-OLIVEO-001	Olive Oil Extra Virgin	Ml	0.012	30	0.36	1
25	1	CMP-SEASAL-001	Sea Salt Flakes	Gr	0.008	1	0.008	2
26	1	CMP-CHILIF-001	Chili Flakes	Gr	0	2	0	3
27	1	CMP-BLACKP-001	Black Peppercorns	Gr	0.035	2	0.07	4
28	1	CMP-SPAGHE-001	Spaghetti No. 5	Gr	0.006	1	0.006	5
29	33	CMP-WAGYUB-001	Wagyu	g	0.021	100	2.100	0
30	34	CMP-WAGYUB-001	Wagyu	g	0.021	100	2.100	0
31	35	SUB-BURGER-001	Burger Patties	10 pcs	42.78	1	42.78	0
39	36	CMP-CHILIR-001	Chili Red Fresh	Gr	0	400	0	0
40	36	CMP-CHILIF-002	Chili Flake	Gr	0	16	0	1
41	36	CMP-PEELED-001	Peeled Garlic	Gr	0.016842105263157894	1000	16.842105263157894000	2
42	36	CMP-OLIVEO-001	Olive Oil Extra Virgin	Ml	0.012	3200	38.400	3
43	36	CMP-OREGAN-001	Oregano Dried	Gr	0	280	0	4
44	36	CMP-CHICKE-002	Chicken Stock Powder	Gr	0	280	0	5
45	36	CMP-WATERT-001	Water Tap	Gr	0	3600	0	6
48	37	SUB-SAUCEA-001	Sauce Aglio Olio	8 Kg	55.242105263157896	1	55.242105263157896	0
\.


--
-- Data for Name: ProductPackagingItems; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public."ProductPackagingItems" ("Id", "ProductId", "ComponentId", "ComponentName", "ComponentUom", "ComponentUomPrice", "Quantity", "Subtotal", "SortOrder") FROM stdin;
\.


--
-- Data for Name: ProductProductionLogs; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public."ProductProductionLogs" ("Id", "ProductId", "EntryType", "Quantity", "ProductionDate", "ExpiryDate", "BatchNumber", "UnitPrice", "LocationIdsJson", "CompanyId", "CreatedAt") FROM stdin;
1	1	produced	1	2026-07-03	2026-07-10		0	["loc-1"]	1	2026-07-03 03:37:06.646026+00
2	2	produced	1	2026-07-03	2026-07-10	SUB-BURGER-001-B0004	0	["airport"]	1	2026-07-03 04:12:33.803713+00
3	2	produced	1	2026-07-03	2026-07-10	SUB-BURGER-001-B0004	0	["airport"]	1	2026-07-03 04:17:04.407135+00
4	2	produced	2	2026-07-03	2026-07-24	SUB-BURGER-001-B0003	0	["airport"]	1	2026-07-03 08:46:42.985873+00
5	3	produced	31	2026-06-03	2026-07-03	PRD-SCDEMO-001-B0001	0	["westend"]	1	2026-06-14 02:58:42.718784+00
6	4	produced	32	2026-06-02	2026-07-02	PRD-SCDEMO-002-B0001	0	["downtown"]	1	2026-06-13 02:58:42.718784+00
7	4	produced	32	2026-06-05	2026-06-19	PRD-SCDEMO-002-B0001-2	0	["airport"]	1	2026-06-27 02:58:42.718784+00
8	5	produced	33	2026-06-01	2026-07-01	PRD-SCDEMO-003-B0001	0	["midtown"]	1	2026-06-12 02:58:42.718784+00
9	6	produced	34	2026-05-31	2026-06-30	PRD-SCDEMO-004-B0001	0	["airport"]	1	2026-06-11 02:58:42.718784+00
10	7	produced	35	2026-06-24	2026-07-24	PRD-SCDEMO-005-B0001	0	["westend"]	1	2026-06-10 02:58:42.718784+00
11	8	produced	36	2026-06-23	2026-07-23	PRD-SCDEMO-006-B0001	0	["downtown"]	1	2026-06-09 02:58:42.718784+00
12	8	produced	36	2026-06-26	2026-07-10	PRD-SCDEMO-006-B0001-2	0	["airport"]	1	2026-07-01 02:58:42.718784+00
13	9	produced	37	2026-06-22	2026-07-22	PRD-SCDEMO-007-B0001	0	["midtown"]	1	2026-06-08 02:58:42.718784+00
14	10	produced	38	2026-06-21	2026-07-21	PRD-SCDEMO-008-B0001	0	["airport"]	1	2026-06-07 02:58:42.718784+00
15	11	produced	39	2026-06-20	2026-07-20	PRD-SCDEMO-009-B0001	0	["westend"]	1	2026-06-06 02:58:42.718784+00
16	12	produced	40	2026-06-19	2026-07-19	PRD-SCDEMO-010-B0001	0	["downtown"]	1	2026-06-25 02:58:42.718784+00
17	12	produced	10	2026-06-22	2026-07-06	PRD-SCDEMO-010-B0001-2	0	["airport"]	1	2026-06-27 02:58:42.718784+00
18	13	produced	41	2026-06-18	2026-07-18	PRD-SCDEMO-011-B0001	0	["midtown"]	1	2026-06-24 02:58:42.718784+00
19	14	produced	42	2026-06-17	2026-07-17	PRD-SCDEMO-012-B0001	0	["airport"]	1	2026-06-23 02:58:42.718784+00
20	15	produced	43	2026-06-16	2026-07-16	PRD-SCDEMO-013-B0001	0	["westend"]	1	2026-06-22 02:58:42.718784+00
21	16	produced	44	2026-06-15	2026-07-15	PRD-SCDEMO-014-B0001	0	["downtown"]	1	2026-06-21 02:58:42.718784+00
22	16	produced	14	2026-06-18	2026-07-02	PRD-SCDEMO-014-B0001-2	0	["airport"]	1	2026-07-01 02:58:42.718784+00
23	17	produced	45	2026-06-14	2026-07-14	PRD-SCDEMO-015-B0001	0	["midtown"]	1	2026-06-20 02:58:42.718784+00
24	18	produced	46	2026-06-13	2026-06-24	SUB-SCDEMO-001-B0001	0	["airport"]	1	2026-06-19 02:58:42.718784+00
25	19	produced	47	2026-06-12	2026-06-24	SUB-SCDEMO-002-B0001	0	["westend"]	1	2026-06-18 02:58:42.718784+00
26	20	produced	48	2026-06-11	2026-06-24	SUB-SCDEMO-003-B0001	0	["downtown"]	1	2026-06-17 02:58:42.718784+00
27	20	produced	18	2026-06-14	2026-06-28	SUB-SCDEMO-003-B0001-2	0	["airport"]	1	2026-06-27 02:58:42.718784+00
28	21	produced	49	2026-06-10	2026-06-24	SUB-SCDEMO-004-B0001	0	["midtown"]	1	2026-06-16 02:58:42.718784+00
29	22	produced	50	2026-06-09	2026-06-14	SUB-SCDEMO-005-B0001	0	["airport"]	1	2026-06-15 02:58:42.718784+00
30	23	produced	51	2026-06-08	2026-06-14	SUB-SCDEMO-006-B0001	0	["westend"]	1	2026-06-14 02:58:42.718784+00
31	24	produced	52	2026-06-07	2026-06-14	SUB-SCDEMO-007-B0001	0	["downtown"]	1	2026-06-13 02:58:42.718784+00
32	24	produced	22	2026-06-10	2026-06-24	SUB-SCDEMO-007-B0001-2	0	["airport"]	1	2026-07-01 02:58:42.718784+00
33	25	produced	53	2026-06-06	2026-06-14	SUB-SCDEMO-008-B0001	0	["midtown"]	1	2026-06-12 02:58:42.718784+00
34	26	produced	54	2026-06-05	2026-06-14	SUB-SCDEMO-009-B0001	0	["airport"]	1	2026-06-11 02:58:42.718784+00
35	27	produced	55	2026-06-04	2026-06-14	SUB-SCDEMO-010-B0001	0	["westend"]	1	2026-06-10 02:58:42.718784+00
36	28	produced	56	2026-06-03	2026-06-14	SUB-SCDEMO-011-B0001	0	["downtown"]	1	2026-06-09 02:58:42.718784+00
37	28	produced	26	2026-06-06	2026-06-20	SUB-SCDEMO-011-B0001-2	0	["airport"]	1	2026-06-27 02:58:42.718784+00
38	29	produced	57	2026-06-02	2026-06-14	SUB-SCDEMO-012-B0001	0	["midtown"]	1	2026-06-08 02:58:42.718784+00
39	30	produced	58	2026-06-01	2026-06-14	SUB-SCDEMO-013-B0001	0	["airport"]	1	2026-06-07 02:58:42.718784+00
40	31	produced	59	2026-05-31	2026-06-14	SUB-SCDEMO-014-B0001	0	["westend"]	1	2026-06-06 02:58:42.718784+00
41	32	produced	60	2026-06-24	2026-06-29	SUB-SCDEMO-015-B0001	0	["downtown"]	1	2026-06-25 02:58:42.718784+00
42	32	produced	30	2026-06-27	2026-07-11	SUB-SCDEMO-015-B0001-2	0	["airport"]	1	2026-07-01 02:58:42.718784+00
43	3	offline_order	12	2026-07-09			37.15	["westend"]	1	2026-07-09 13:57:46.316927+00
44	4	online_order	8	2026-07-09			46.64	["airport"]	1	2026-07-09 13:57:46.347303+00
\.


--
-- Data for Name: Products; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public."Products" ("Id", "ProductId", "Name", "Category", "Group", "IsSubProduct", "B2cEnabled", "B2bEnabled", "B2bPackageUnit", "TotalCost", "PackagingCost", "Rrp", "PreviousTotalCost", "PreviousPackagingCost", "PreviousRrp", "YieldQuantity", "YieldUom", "ExpiryPeriodDays", "PosEnabled", "Active", "CompanyId", "LocationIdsJson", "CreatedAt", "UpdatedAt", "B2bSalesConfigJson", "ActivationPeriodHours", "ParStock", "ParStockUom", "YieldAltUnitsJson", "PosDeliveryUnitsJson") FROM stdin;
1	PRD-SPAGHE-001	Spaghetti Aglio Olio	Food	Pasta	f	t	f	pcs	1.2861052631579	0	8	\N	\N	\N	0		0	f	t	1	["airport","downtown","midtown","westend"]	2026-07-02 14:13:56.782734+00	2026-07-03 03:37:06.627903+00	{}	0	0		[]	[]
2	SUB-BURGER-001	Burger Patties	Food	Proteins	t	f	f	pcs	42.78	0	0	\N	\N	\N	10	pcs	0	f	t	1	["airport","downtown","midtown","westend"]	2026-07-02 15:03:38.037435+00	2026-07-03 08:46:42.903905+00	{}	0	0		[]	[]
3	PRD-SCDEMO-001	SC Demo Product 171	Food	Dry Goods	f	f	t	pcs	12.58	2.99	37.15	\N	\N	\N	0		0	f	t	1	["downtown","midtown","airport","westend"]	2026-07-06 02:58:42.718784+00	2026-07-06 02:58:42.718784+00	{}	0	0		[]	[]
4	PRD-SCDEMO-002	SC Demo Product 172	Food	Seafood	f	t	t	pcs	15.59	0.94	46.64	\N	\N	\N	0		0	f	t	1	["downtown","midtown","airport","westend"]	2026-07-06 02:58:42.718784+00	2026-07-06 02:58:42.718784+00	{}	0	0		[]	[]
5	PRD-SCDEMO-003	SC Demo Product 173	Food	Beverages	f	f	t	pcs	7.26	0.98	42.34	\N	\N	\N	0		0	f	t	1	["downtown","midtown","airport","westend"]	2026-07-06 02:58:42.718784+00	2026-07-06 02:58:42.718784+00	{}	0	0		[]	[]
6	PRD-SCDEMO-004	SC Demo Product 174	Food	Packaging	f	t	t	pcs	13.2	1.95	41.66	\N	\N	\N	0		0	f	t	1	["downtown","midtown","airport","westend"]	2026-07-06 02:58:42.718784+00	2026-07-06 02:58:42.718784+00	{}	0	0		[]	[]
7	PRD-SCDEMO-005	SC Demo Product 175	Food	Proteins	f	f	t	pcs	21.02	2.27	37.02	\N	\N	\N	0		0	f	t	1	["downtown","midtown","airport","westend"]	2026-07-06 02:58:42.718784+00	2026-07-06 02:58:42.718784+00	{}	0	0		[]	[]
8	PRD-SCDEMO-006	SC Demo Product 176	Food	Produce	f	t	t	pcs	6.15	1.21	14.76	\N	\N	\N	0		0	f	t	1	["downtown","midtown","airport","westend"]	2026-07-06 02:58:42.718784+00	2026-07-06 02:58:42.718784+00	{}	0	0		[]	[]
9	PRD-SCDEMO-007	SC Demo Product 177	Food	Dairy	f	f	t	pcs	15.97	1.02	47.98	\N	\N	\N	0		0	f	t	1	["downtown","midtown","airport","westend"]	2026-07-06 02:58:42.718784+00	2026-07-06 02:58:42.718784+00	{}	0	0		[]	[]
10	PRD-SCDEMO-008	SC Demo Product 178	Food	Dry Goods	f	t	t	pcs	9.11	0.87	36.16	\N	\N	\N	0		0	f	t	1	["downtown","midtown","airport","westend"]	2026-07-06 02:58:42.718784+00	2026-07-06 02:58:42.718784+00	{}	0	0		[]	[]
11	PRD-SCDEMO-009	SC Demo Product 179	Food	Seafood	f	f	t	pcs	8.69	2.79	43.86	\N	\N	\N	0		0	f	t	1	["downtown","midtown","airport","westend"]	2026-07-06 02:58:42.718784+00	2026-07-06 02:58:42.718784+00	{}	0	0		[]	[]
12	PRD-SCDEMO-010	SC Demo Product 180	Food	Beverages	f	t	t	pcs	16.3	2.52	31.6	\N	\N	\N	0		0	f	t	1	["downtown","midtown","airport","westend"]	2026-07-06 02:58:42.718784+00	2026-07-06 02:58:42.718784+00	{}	0	0		[]	[]
13	PRD-SCDEMO-011	SC Demo Product 181	Food	Packaging	f	f	t	pcs	11.69	2.8	23.12	\N	\N	\N	0		0	f	t	1	["downtown","midtown","airport","westend"]	2026-07-06 02:58:42.718784+00	2026-07-06 02:58:42.718784+00	{}	0	0		[]	[]
14	PRD-SCDEMO-012	SC Demo Product 182	Food	Proteins	f	t	t	pcs	20.91	1.61	33.38	\N	\N	\N	0		0	f	t	1	["downtown","midtown","airport","westend"]	2026-07-06 02:58:42.718784+00	2026-07-06 02:58:42.718784+00	{}	0	0		[]	[]
15	PRD-SCDEMO-013	SC Demo Product 183	Food	Produce	f	f	t	pcs	19.77	1.02	17.2	\N	\N	\N	0		0	f	t	1	["downtown","midtown","airport","westend"]	2026-07-06 02:58:42.718784+00	2026-07-06 02:58:42.718784+00	{}	0	0		[]	[]
16	PRD-SCDEMO-014	SC Demo Product 184	Food	Dairy	f	t	t	pcs	8.12	2.94	32.53	\N	\N	\N	0		0	f	t	1	["downtown","midtown","airport","westend"]	2026-07-06 02:58:42.718784+00	2026-07-06 02:58:42.718784+00	{}	0	0		[]	[]
17	PRD-SCDEMO-015	SC Demo Product 185	Food	Dry Goods	f	f	t	pcs	23.55	1.44	16.87	\N	\N	\N	0		0	f	t	1	["downtown","midtown","airport","westend"]	2026-07-06 02:58:42.718784+00	2026-07-06 02:58:42.718784+00	{}	0	0		[]	[]
18	SUB-SCDEMO-001	SC Demo Sub-Product 186	Food	Seafood	t	f	t	16 portion	13.26	1.27	38.92	\N	\N	\N	16	portion	11	f	t	1	["downtown","midtown","airport","westend"]	2026-07-06 02:58:42.718784+00	2026-07-06 02:58:42.718784+00	{}	0	0		[]	[]
19	SUB-SCDEMO-002	SC Demo Sub-Product 187	Food	Beverages	t	f	t	17 portion	19.45	0.55	29.13	\N	\N	\N	17	portion	12	f	t	1	["downtown","midtown","airport","westend"]	2026-07-06 02:58:42.718784+00	2026-07-06 02:58:42.718784+00	{}	0	0		[]	[]
20	SUB-SCDEMO-003	SC Demo Sub-Product 188	Food	Packaging	t	f	t	18 portion	22.08	2.92	22.74	\N	\N	\N	18	portion	13	f	t	1	["downtown","midtown","airport","westend"]	2026-07-06 02:58:42.718784+00	2026-07-06 02:58:42.718784+00	{}	0	0		[]	[]
21	SUB-SCDEMO-004	SC Demo Sub-Product 189	Food	Proteins	t	f	t	19 portion	10.34	0.71	32.7	\N	\N	\N	19	portion	14	f	t	1	["downtown","midtown","airport","westend"]	2026-07-06 02:58:42.718784+00	2026-07-06 02:58:42.718784+00	{}	0	0		[]	[]
22	SUB-SCDEMO-005	SC Demo Sub-Product 190	Food	Produce	t	f	t	20 portion	7.48	2.81	26.06	\N	\N	\N	20	portion	5	f	t	1	["downtown","midtown","airport","westend"]	2026-07-06 02:58:42.718784+00	2026-07-06 02:58:42.718784+00	{}	0	0		[]	[]
23	SUB-SCDEMO-006	SC Demo Sub-Product 191	Food	Dairy	t	f	t	21 portion	21.13	1.79	40.15	\N	\N	\N	21	portion	6	f	t	1	["downtown","midtown","airport","westend"]	2026-07-06 02:58:42.718784+00	2026-07-06 02:58:42.718784+00	{}	0	0		[]	[]
24	SUB-SCDEMO-007	SC Demo Sub-Product 192	Food	Dry Goods	t	f	t	22 portion	8.17	0.49	28.76	\N	\N	\N	22	portion	7	f	t	1	["downtown","midtown","airport","westend"]	2026-07-06 02:58:42.718784+00	2026-07-06 02:58:42.718784+00	{}	0	0		[]	[]
25	SUB-SCDEMO-008	SC Demo Sub-Product 193	Food	Seafood	t	f	t	23 portion	13.31	2.46	45.57	\N	\N	\N	23	portion	8	f	t	1	["downtown","midtown","airport","westend"]	2026-07-06 02:58:42.718784+00	2026-07-06 02:58:42.718784+00	{}	0	0		[]	[]
26	SUB-SCDEMO-009	SC Demo Sub-Product 194	Food	Beverages	t	f	t	24 portion	19.33	0.9	51.02	\N	\N	\N	24	portion	9	f	t	1	["downtown","midtown","airport","westend"]	2026-07-06 02:58:42.718784+00	2026-07-06 02:58:42.718784+00	{}	0	0		[]	[]
27	SUB-SCDEMO-010	SC Demo Sub-Product 195	Food	Packaging	t	f	t	25 portion	10.19	1.36	28.34	\N	\N	\N	25	portion	10	f	t	1	["downtown","midtown","airport","westend"]	2026-07-06 02:58:42.718784+00	2026-07-06 02:58:42.718784+00	{}	0	0		[]	[]
28	SUB-SCDEMO-011	SC Demo Sub-Product 196	Food	Proteins	t	f	t	26 portion	7.15	0.16	29.9	\N	\N	\N	26	portion	11	f	t	1	["downtown","midtown","airport","westend"]	2026-07-06 02:58:42.718784+00	2026-07-06 02:58:42.718784+00	{}	0	0		[]	[]
29	SUB-SCDEMO-012	SC Demo Sub-Product 197	Food	Produce	t	f	t	27 portion	6.43	0.5	18.88	\N	\N	\N	27	portion	12	f	t	1	["downtown","midtown","airport","westend"]	2026-07-06 02:58:42.718784+00	2026-07-06 02:58:42.718784+00	{}	0	0		[]	[]
30	SUB-SCDEMO-013	SC Demo Sub-Product 198	Food	Dairy	t	f	t	28 portion	14.27	1.16	46.14	\N	\N	\N	28	portion	13	f	t	1	["downtown","midtown","airport","westend"]	2026-07-06 02:58:42.718784+00	2026-07-06 02:58:42.718784+00	{}	0	0		[]	[]
31	SUB-SCDEMO-014	SC Demo Sub-Product 199	Food	Dry Goods	t	f	t	29 portion	7.6	0.33	27.27	\N	\N	\N	29	portion	14	f	t	1	["downtown","midtown","airport","westend"]	2026-07-06 02:58:42.718784+00	2026-07-06 02:58:42.718784+00	{}	0	0		[]	[]
32	SUB-SCDEMO-015	SC Demo Sub-Product 200	Food	Seafood	t	f	t	10 portion	19.4	2.42	38.64	\N	\N	\N	10	portion	5	f	t	1	["downtown","midtown","airport","westend"]	2026-07-06 02:58:42.718784+00	2026-07-06 02:58:42.718784+00	{}	0	0		[]	[]
33	PRD-ZZZUNI-001	ZZZ Unique 0.6059193807664951	Food	Proteins	f	t	f	pcs	2.100	0	25	\N	\N	\N	0		0	f	t	1	["downtown"]	2026-07-08 04:46:41.675414+00	2026-07-08 04:46:41.675461+00	{}	0	0		[]	[]
34	SUB-SUBSAV-001	Sub Save Test 0.15192322734726427	Food	Proteins	t	f	f	pcs	2.100	0	0	\N	\N	\N	20	kitchen	7	f	t	1	["downtown"]	2026-07-08 04:46:55.120454+00	2026-07-08 04:46:55.120454+00	{}	0	0		[]	[]
35	PRD-B2BSAV-001	B2B Save Test 0.4695762894205655	Food	Proteins	f	f	t	Box/20each/100gr	42.78	0	50	\N	\N	\N	0		7	f	t	1	["downtown"]	2026-07-08 04:46:55.246851+00	2026-07-08 04:46:55.246851+00	{"principal":{"key":"p1","isPrincipal":true,"delivery":{"orderUnit":"Box","orderQty":1,"packUnit":"Each","packQty":20,"unitUnit":"Gr","unitQty":100},"rrp":"50"},"alternates":[]}	0	0		[]	[]
36	SUB-SAUCEA-001	Sauce Aglio Olio	Food	Sauce & Dressing	t	f	f	pcs	55.242105263157894000	0	0	\N	\N	\N	8	kg	14	f	t	5	["weissbrau-pavilion-kuala-lumpur"]	2026-07-08 05:51:04.288223+00	2026-07-09 08:33:17.705841+00	{}	24	0		[]	[]
37	PRD-SAUCEA-001	Sauce Aglio Olio	Food	Sauce & Dressing	f	f	t	Pack/kg/0	55.242105263157896	0	20	\N	\N	\N	0		30	f	t	5	["weissbrau-pavilion-kuala-lumpur"]	2026-07-09 16:33:20.004176+00	2026-07-09 17:32:41.054524+00	{"principal":{"key":"b2b-principal","isPrincipal":true,"delivery":{"orderUnit":"Pack","orderQty":1,"packUnit":"Kg","packQty":1,"unitUnit":"","unitQty":0},"rrp":"20"},"alternates":[{"key":"b2b-alt-1","isPrincipal":false,"delivery":{"orderUnit":"Bag","orderQty":1,"packUnit":"Kg","packQty":5,"unitUnit":"","unitQty":0},"rrp":"100"},{"key":"b2b-alt-2","isPrincipal":false,"delivery":{"orderUnit":"Each","orderQty":1,"packUnit":"Kg","packQty":8,"unitUnit":"","unitQty":0},"rrp":"150"}]}	0	0		[]	[]
\.


--
-- Data for Name: ProvidentFundBrackets; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public."ProvidentFundBrackets" ("Id", "PayStructureId", "SortOrder", "MinAge", "MaxAge", "MinMonthlySalary", "MaxMonthlySalary", "EmployerPct", "EmployeePct", "NoContribution") FROM stdin;
1	2	0	\N	59	\N	5000	13	11	f
2	2	1	\N	59	5000.01	\N	13	11	f
3	2	2	60	\N	\N	\N	0	0	t
\.


--
-- Data for Name: PublicHolidays; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public."PublicHolidays" ("Id", "Name", "Date", "IsRecognized", "CountryCode", "CatalogKey", "IsRecurringAnnually", "IsGazetted") FROM stdin;
1	New Year's Day	2026-01-01	t	MY	\N	f	f
2	Chinese New Year	2026-01-29	t	MY	\N	f	f
3	Chinese New Year (2nd day)	2026-01-30	t	MY	\N	f	f
4	Thaipusam	2026-02-03	f	MY	\N	f	f
5	Federal Territory Day	2026-02-01	f	MY	\N	f	f
6	Labour Day	2026-05-01	t	MY	\N	f	f
7	Wesak Day	2026-05-11	t	MY	\N	f	f
8	Agong's Birthday	2026-06-06	t	MY	\N	f	f
9	Hari Raya Aidilfitri	2026-06-17	t	MY	\N	f	f
10	Hari Raya Aidilfitri (2nd day)	2026-06-18	t	MY	\N	f	f
11	Hari Raya Aidiladha	2026-08-24	t	MY	\N	f	f
12	Merdeka Day	2026-08-31	t	MY	\N	f	f
13	Malaysia Day	2026-09-16	t	MY	\N	f	f
14	Awal Muharram	2026-09-14	f	MY	\N	f	f
15	Prophet Muhammad's Birthday	2026-11-23	t	MY	\N	f	f
16	Deepavali	2026-11-05	t	MY	\N	f	f
17	Christmas Day	2026-12-25	t	MY	\N	f	f
200	Company Foundation Day	2026-03-15	t	MY	CUSTOM|MY|03-15|COMPANY FOUNDATION DAY	t	f
126	New Year's Day	2026-01-01	t	AU	AU|2026-01-01|NEW YEAR'S DAY	f	t
187	National Day	2026-08-10	t	SG	SG|2026-08-10|NATIONAL DAY	f	t
129	Canberra Day	2026-03-09	t	AU	AU|2026-03-09|CANBERRA DAY	f	t
130	Adelaide Cup Day	2026-03-09	t	AU	AU|2026-03-09|ADELAIDE CUP DAY	f	t
131	Eight Hours Day	2026-03-09	t	AU	AU|2026-03-09|EIGHT HOURS DAY	f	t
132	Labour Day	2026-03-09	t	AU	AU|2026-03-09|LABOUR DAY	f	t
133	Good Friday	2026-04-03	t	AU	AU|2026-04-03|GOOD FRIDAY	f	t
134	Easter Eve	2026-04-04	t	AU	AU|2026-04-04|EASTER EVE	f	t
135	Easter Sunday	2026-04-05	t	AU	AU|2026-04-05|EASTER SUNDAY	f	t
136	Easter Monday	2026-04-06	t	AU	AU|2026-04-06|EASTER MONDAY	f	t
137	Anzac Day	2026-04-25	t	AU	AU|2026-04-25|ANZAC DAY	f	t
138	Anzac Day	2026-04-25	t	AU	AU|2026-04-25|ANZAC DAY	f	t
139	Anzac Day	2026-04-27	t	AU	AU|2026-04-27|ANZAC DAY	f	t
140	May Day	2026-05-04	t	AU	AU|2026-05-04|MAY DAY	f	t
141	Labour Day	2026-05-04	t	AU	AU|2026-05-04|LABOUR DAY	f	t
142	Reconciliation Day	2026-06-01	t	AU	AU|2026-06-01|RECONCILIATION DAY	f	t
167	May Day	2027-05-03	t	AU	AU|2027-05-03|MAY DAY	f	t
158	Eight Hours Day	2027-03-08	t	AU	AU|2027-03-08|EIGHT HOURS DAY	f	t
159	Labour Day	2027-03-08	t	AU	AU|2027-03-08|LABOUR DAY	f	t
160	Good Friday	2027-03-26	t	AU	AU|2027-03-26|GOOD FRIDAY	f	t
161	Easter Eve	2027-03-27	t	AU	AU|2027-03-27|EASTER EVE	f	t
162	Easter Sunday	2027-03-28	t	AU	AU|2027-03-28|EASTER SUNDAY	f	t
163	Easter Monday	2027-03-29	t	AU	AU|2027-03-29|EASTER MONDAY	f	t
164	Anzac Day	2027-04-25	t	AU	AU|2027-04-25|ANZAC DAY	f	t
165	Anzac Day	2027-04-26	t	AU	AU|2027-04-26|ANZAC DAY	f	t
166	Anzac Day	2027-04-26	t	AU	AU|2027-04-26|ANZAC DAY	f	t
169	Reconciliation Day	2027-05-31	t	AU	AU|2027-05-31|RECONCILIATION DAY	f	t
170	Western Australia Day	2027-06-07	t	AU	AU|2027-06-07|WESTERN AUSTRALIA DAY	f	t
171	King's Birthday	2027-06-14	t	AU	AU|2027-06-14|KING'S BIRTHDAY	f	t
172	Picnic Day	2027-08-02	t	AU	AU|2027-08-02|PICNIC DAY	f	t
173	Friday before AFL Grand Final (Tentative Date)	2027-09-24	t	AU	AU|2027-09-24|FRIDAY BEFORE AFL GRAND FINAL (TENTATIVE DATE)	f	t
174	King's Birthday	2027-09-27	t	AU	AU|2027-09-27|KING'S BIRTHDAY	f	t
175	Labour Day	2027-10-04	t	AU	AU|2027-10-04|LABOUR DAY	f	t
176	King's Birthday	2027-10-04	t	AU	AU|2027-10-04|KING'S BIRTHDAY	f	t
177	Melbourne Cup	2027-11-02	t	AU	AU|2027-11-02|MELBOURNE CUP	f	t
178	Christmas Day	2027-12-27	t	AU	AU|2027-12-27|CHRISTMAS DAY	f	t
179	Boxing Day	2027-12-28	t	AU	AU|2027-12-28|BOXING DAY	f	t
180	New Year's Day	2026-01-01	t	SG	SG|2026-01-01|NEW YEAR'S DAY	f	t
181	Chinese New Year	2026-02-17	t	SG	SG|2026-02-17|CHINESE NEW YEAR	f	t
182	Chinese New Year	2026-02-18	t	SG	SG|2026-02-18|CHINESE NEW YEAR	f	t
183	Hari Raya Puasa	2026-03-20	t	SG	SG|2026-03-20|HARI RAYA PUASA	f	t
184	Good Friday	2026-04-03	t	SG	SG|2026-04-03|GOOD FRIDAY	f	t
185	Labour Day	2026-05-01	t	SG	SG|2026-05-01|LABOUR DAY	f	t
186	Hari Raya Haji (Tentative Date)	2026-05-27	t	SG	SG|2026-05-27|HARI RAYA HAJI (TENTATIVE DATE)	f	t
143	Western Australia Day	2026-06-01	t	AU	AU|2026-06-01|WESTERN AUSTRALIA DAY	f	t
144	King's Birthday	2026-06-08	t	AU	AU|2026-06-08|KING'S BIRTHDAY	f	t
145	Picnic Day	2026-08-03	t	AU	AU|2026-08-03|PICNIC DAY	f	t
146	Friday before AFL Grand Final	2026-09-25	t	AU	AU|2026-09-25|FRIDAY BEFORE AFL GRAND FINAL	f	t
147	King's Birthday	2026-09-28	t	AU	AU|2026-09-28|KING'S BIRTHDAY	f	t
148	Labour Day	2026-10-05	t	AU	AU|2026-10-05|LABOUR DAY	f	t
149	King's Birthday	2026-10-05	t	AU	AU|2026-10-05|KING'S BIRTHDAY	f	t
150	Melbourne Cup	2026-11-03	t	AU	AU|2026-11-03|MELBOURNE CUP	f	t
151	Christmas Day	2026-12-25	t	AU	AU|2026-12-25|CHRISTMAS DAY	f	t
152	Boxing Day	2026-12-28	t	AU	AU|2026-12-28|BOXING DAY	f	t
168	Labour Day	2027-05-03	t	AU	AU|2027-05-03|LABOUR DAY	f	t
153	New Year's Day	2027-01-01	t	AU	AU|2027-01-01|NEW YEAR'S DAY	f	t
154	Australia Day	2027-01-26	t	AU	AU|2027-01-26|AUSTRALIA DAY	f	t
155	Labour Day	2027-03-01	t	AU	AU|2027-03-01|LABOUR DAY	f	t
156	Canberra Day	2027-03-08	t	AU	AU|2027-03-08|CANBERRA DAY	f	t
157	Adelaide Cup Day	2027-03-08	t	AU	AU|2027-03-08|ADELAIDE CUP DAY	f	t
188	Deepavali	2026-11-09	t	SG	SG|2026-11-09|DEEPAVALI	f	t
189	Christmas Day	2026-12-25	t	SG	SG|2026-12-25|CHRISTMAS DAY	f	t
190	New Year's Day	2027-01-01	t	SG	SG|2027-01-01|NEW YEAR'S DAY	f	t
191	Chinese New Year	2027-02-06	t	SG	SG|2027-02-06|CHINESE NEW YEAR	f	t
192	Chinese New Year	2027-02-08	t	SG	SG|2027-02-08|CHINESE NEW YEAR	f	t
193	Hari Raya Puasa	2027-03-10	t	SG	SG|2027-03-10|HARI RAYA PUASA	f	t
194	Good Friday	2027-03-26	t	SG	SG|2027-03-26|GOOD FRIDAY	f	t
195	Labour Day	2027-05-01	t	SG	SG|2027-05-01|LABOUR DAY	f	t
196	Hari Raya Haji (Tentative Date)	2027-05-17	t	SG	SG|2027-05-17|HARI RAYA HAJI (TENTATIVE DATE)	f	t
197	National Day	2027-08-09	t	SG	SG|2027-08-09|NATIONAL DAY	f	t
198	Deepavali	2027-10-29	t	SG	SG|2027-10-29|DEEPAVALI	f	t
199	Christmas Day	2027-12-25	t	SG	SG|2027-12-25|CHRISTMAS DAY	f	t
127	Australia Day	2026-01-26	t	AU	AU|2026-01-26|AUSTRALIA DAY	f	t
128	Labour Day	2026-03-02	t	AU	AU|2026-03-02|LABOUR DAY	f	t
\.


--
-- Data for Name: PurchaseOrderItems; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public."PurchaseOrderItems" ("Id", "PurchaseOrderId", "ComponentId", "ComponentName", "VendorProductId", "Name", "Quantity", "UnitPrice", "IssuedUnitPrice", "Unit", "ComponentUom", "DeliveryPackage", "ReceivedQuantity", "ReceivedUnitPrice", "ReconciledQuantity", "ReconciledUnitPrice", "TaxAmount", "HalalCertNo") FROM stdin;
1	1				Wagyu Beef (A5)	5.0	380.0	0	kg		Vacuum-sealed 1kg portions	\N	\N	\N	\N	0	
2	1				Ribeye (Prime)	8.0	145.0	0	kg		Whole primal cut	\N	\N	\N	\N	0	
3	2				Black Truffle	500.0	1.8	0	g		Individual 50g jars	\N	\N	\N	\N	0	
4	3				Test Product	2.0	42.0	0	Box		Box/12	\N	\N	\N	\N	0	
5	4				Test	1.0	42.0	0	Box		Box/12	\N	\N	\N	\N	0	
6	5				A	1.0	10.0	0	Box		Box	\N	\N	\N	\N	0	
7	6				B	2.0	20.0	0	Tin		Tin	\N	\N	\N	\N	0	
8	7				Wagyu Ribeye	2.0	85.5	0	Kg		Kg	\N	\N	\N	\N	0	
9	8				Salmon Fillet	5.0	42.0	0	Kg		Kg	\N	\N	\N	\N	0	
10	9				Burrata	3.0	52.5	0	Case/6each		Case/6each	\N	\N	\N	\N	0	
11	10				Peeled Garlic	1.0	16.0	0	Tub/kg		Tub/kg	\N	\N	\N	\N	0	
12	11	CMP-BURRAT-001	Burrata	VP-BUR001	Burrata	3.0	52.5	52.5	Case/6each	pcs	Case/6each	\N	\N	\N	\N	0	
13	12	CMP-BLACKT-001	Black Truffle	VP-TRU001	Black Truffle	4.0	180.0	180	100gr	g	100gr	\N	\N	\N	\N	0	
14	13	CMP-WAGYUB-001	Wagyu Beef A5	VP-CHX001	Free-range Chicken Breast	1.0	42.0	42	2kg	kg	2kg	\N	\N	\N	\N	0	
15	13	CMP-WAGYUB-001	Wagyu Beef A5	VP-WAG001	Wagyu Beef A5	1.0	380.0	380	Kg	kg	Kg	\N	\N	\N	\N	0	
16	14	CMP-BURRAT-001	Burrata	VP-BUR001	Burrata	1.0	52.5	52.5	Case/6each	pcs	Case/6each	\N	\N	\N	\N	0	
17	15	CMP-PEELED-001	Peeled Garlic	VP-GAR006	Peeled Garlic	1.0	16.0	16	Tub/kg	kg	Tub/kg	\N	\N	\N	\N	0	
18	16	CMP-WAGYUB-001	Wagyu Beef A5	VP-CHX001	Free-range Chicken Breast	1.0	42.0	42	2kg	kg	2kg	\N	\N	\N	\N	0	
19	16	CMP-WAGYUB-001	Wagyu Beef A5	VP-WAG001	Wagyu Beef A5	1.0	380.0	380	Kg	kg	Kg	\N	\N	\N	\N	0	
20	17	CMP-BURRAT-001	Burrata	VP-BUR001	Burrata	2.0	52.5	52.5	Case/6each	pcs	Case/6each	\N	\N	\N	\N	0	
21	18	CMP-PEELED-001	Peeled Garlic	VP-GAR006	Peeled Garlic	1.0	16.0	16	Tub/kg	kg	Tub/kg	\N	\N	\N	\N	0	
22	19	CMP-BURRAT-001	Burrata	VP-BUR001	Burrata	2.0	52.5	52.5	Case/6each	pcs	Case/6each	\N	\N	\N	\N	0	
23	20	CMP-PEELED-001	Peeled Garlic	VP-GAR006	Peeled Garlic	1.0	16.0	16	Tub/kg	kg	Tub/kg	\N	\N	\N	\N	0	
24	21	CMP-BURRAT-001	Burrata	VP-BUR001	Burrata	2.0	52.5	52.5	Case/6each	pcs	Case/6each	\N	\N	\N	\N	0	
25	22	CMP-PEELED-001	Peeled Garlic	VP-GAR006	Peeled Garlic	1.0	16.0	16	Tub/kg	kg	Tub/kg	\N	\N	\N	\N	0	
26	23	CMP-BURRAT-001	Burrata	VP-BUR001	Burrata	1.0	52.5	52.5	Case/6each	pcs	Case/6each	\N	\N	\N	\N	0	
27	24	CMP-PEELED-001	Peeled Garlic	VP-GAR006	Peeled Garlic	1.0	16.5	16	Tub/kg	kg	Tub/kg	1	16.5	1	16.5	0	
28	29		Test Item		Test Item	1	10.5	10.5	kg	kg	kg	\N	\N	\N	\N	0	
\.


--
-- Data for Name: PurchaseOrders; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public."PurchaseOrders" ("Id", "PoNumber", "VendorName", "OrderDate", "DeliveryDate", "DocumentType", "Status", "CompanyId", "LocationIdsJson", "InitiatedBy", "ApprovedBy", "ApprovedAt", "ReceivedAt", "ReconciledAt", "VendorShareToken", "VendorAcceptedAt", "VendorAcceptedBy") FROM stdin;
1	PO-2841	Premium Meats Co.	2025-06-18	2025-06-21	PO	In Transit	\N	[]			\N	\N	\N	a94fd1a8e1ff4ab1aea78176811c730f	\N	
2	PO-2842	Fine Truffle Imports	2025-06-19	2025-06-22	PO	Confirmed	\N	[]			\N	\N	\N	7a8129d5a20a4f4dbc44caeac32aa2c1	\N	
3	PO-2843	Premium Meats Co.	2026-06-30	2026-07-03	PO	Pending	\N	[]			\N	\N	\N	b7dabbab03864fa69821c7b984304f89	\N	
4	PO-2844	Premium Meats Co.	2026-07-01	2026-07-04	PO	Pending	\N	[]			\N	\N	\N	00957d3449f14c049bbd6cd716d6a06b	\N	
5	PO-2845	Premium Meats Co.	2026-07-01	2026-07-04	PO	Pending	\N	[]			\N	\N	\N	2f6e7682f3cc4c41a26c4f356a511a29	\N	
7	BH-DOWN-001-20260630	Premium Meats Co.	2026-06-30	2026-07-03	PO	Pending	\N	[]			\N	\N	\N	fb24962854034b04902bd8c38fa7e6a7	\N	
8	BH-DOWN-002-20260630	Ocean Fresh Seafood	2026-06-30	2026-07-03	PO	Pending	\N	[]			\N	\N	\N	9f6de5509eae4932ad7aa5a7e36013ce	\N	
9	BH-AT-001-20260701	Artisan Dairy Co.	2026-07-01	2026-07-04	PR	Pending Approval	\N	[]			\N	\N	\N	c5961095ed264806b0786de2fbedacdc	\N	
10	BH-AT-002-20260701	Green Valley Produce	2026-07-01	2026-07-04	PR	Pending Approval	\N	[]			\N	\N	\N	47994332215d4bdf9b58c23a09bd0c16	\N	
11	BH-DOWN-001-20260701	Artisan Dairy Co.	2026-07-01	2026-07-04	PO	Open	1	["downtown"]	DRA Super Admin	DRA Super Admin	2026-07-01 06:15:32.483546+00	\N	\N	37ef2324828549d7921f719b0e48fd01	\N	
12	BH-DOWN-002-20260701	Fine Truffle Imports	2026-07-01	2026-07-04	PO	Open	1	["downtown"]	DRA Super Admin	DRA Super Admin	2026-07-01 06:15:32.530613+00	\N	\N	d5508c0f855546f3a3dd803b00257e3d	\N	
13	BH-DOWN-003-20260701	Premium Meats Co.	2026-07-01	2026-07-04	PO	Open	1	["downtown"]	DRA Super Admin	DRA Super Admin	2026-07-01 06:15:32.53123+00	\N	\N	5b6e9e968751465caf19216982370297	\N	
14	BH-AT-003-20260701	Artisan Dairy Co.	2026-07-01	2026-07-04	PO	Open	1	["airport"]	DRA Super Admin	DRA Super Admin	2026-07-01 06:23:42.008317+00	\N	\N	400f196eab704b57b049be82d1411561	\N	
15	BH-AT-004-20260701	Green Valley Produce	2026-07-01	2026-07-04	PO	Open	1	["airport"]	DRA Super Admin	DRA Super Admin	2026-07-01 06:23:42.008566+00	\N	\N	23108a5e68f74a4ab4ad8940ddaf41a0	\N	
16	BH-MIDT-001-20260701	Premium Meats Co.	2026-07-01	2026-07-04	PO	Open	1	["midtown"]	DRA Super Admin	DRA Super Admin	2026-07-01 07:55:43.546637+00	\N	\N	8573178d72f442689b026dae5ab2a694	\N	
17	BH-AT-005-20260701	Artisan Dairy Co.	2026-07-01	2026-07-04	PO	Open	1	["airport"]	DRA Super Admin	DRA Super Admin	2026-07-01 10:40:46.4011+00	\N	\N	4019fdb2a36c45ad894b6dddb6189ba8	\N	
18	BH-AT-006-20260701	Green Valley Produce	2026-07-01	2026-07-04	PO	Open	1	["airport"]	DRA Super Admin	DRA Super Admin	2026-07-01 10:40:46.401351+00	\N	\N	0fc62947d6434a2da5f101d01ca8a5cf	\N	
19	BH-AT-007-20260701	Artisan Dairy Co.	2026-07-01	2026-07-04	PO	Open	1	["airport"]	DRA Super Admin	DRA Super Admin	2026-07-01 10:51:48.324716+00	\N	\N	ded7765e350d4ea586c3ed390ded753f	\N	
20	BH-AT-008-20260701	Green Valley Produce	2026-07-01	2026-07-04	PO	Open	1	["airport"]	DRA Super Admin	DRA Super Admin	2026-07-01 10:51:48.324994+00	\N	\N	c0bc5f44bf0848f3b579e4fbf2e8618a	\N	
21	BH-AT-009-20260701	Artisan Dairy Co.	2026-07-01	2026-07-04	PO	Open	1	["airport"]	DRA Super Admin	DRA Super Admin	2026-07-01 10:52:57.550895+00	\N	\N	69aa79c7bb9540f48db416774487fbea	\N	
24	BH-AT-012-20260701	Green Valley Produce	2026-07-01	2026-07-04	PO	Reconciled	1	["airport"]	DRA Super Admin	DRA Super Admin	2026-07-01 11:17:54.963938+00	2026-07-01 11:20:58.730743+00	2026-07-01 11:21:04.354684+00	efb3f3bebb0042598aefe261f4f05dc6	2026-07-01 11:19:04.234541+00	Lee Wei Jie
25	PO-2026-FIFO-001	Premium Meats Co.	2026-05-20	2026-05-22	PO	Reconciled	1	["downtown"]	Demo Seeder	Demo Seeder	2026-05-21 03:13:07.973923+00	2026-05-22 03:13:07.973923+00	2026-05-22 03:13:07.973923+00		\N	
26	PO-2026-FIFO-014	Premium Meats Co.	2026-06-06	2026-06-08	PO	Reconciled	1	["downtown"]	Demo Seeder	Demo Seeder	2026-06-07 03:13:07.973923+00	2026-06-08 03:13:07.973923+00	2026-06-08 03:13:07.973923+00		\N	
27	PO-2026-FIFO-028	Premium Meats Co.	2026-06-22	2026-06-24	PO	Reconciled	1	["downtown"]	Demo Seeder	Demo Seeder	2026-06-23 03:13:07.973923+00	2026-06-24 03:13:07.973923+00	2026-06-24 03:13:07.973923+00		\N	
28	PO-2026-FIFO-042	Premium Meats Co.	2026-07-01	2026-07-03	PO	Reconciled	1	["downtown"]	Demo Seeder	Demo Seeder	2026-07-02 09:00:00+00	2026-07-03 08:00:00+00	2026-07-03 08:00:00+00		\N	
23	BH-AT-011-20260701	Artisan Dairy Co.	2026-07-01	2026-07-04	PO	Confirmed	1	["airport"]	DRA Super Admin	DRA Super Admin	2026-07-01 11:17:54.949546+00	\N	\N	5a47a3991f344cf1b6055e12abd643fb	2026-07-07 09:26:21.301827+00	Sofia Lim
22	BH-AT-010-20260701	Green Valley Produce	2026-07-01	2026-07-04	PO	Confirmed	1	["airport"]	DRA Super Admin	DRA Super Admin	2026-07-01 10:52:57.551047+00	\N	\N	39fb1f0c8db64400a82e3594f39d5b3c	2026-07-07 09:35:48.300841+00	Test Vendor
6	PO-2846	Heritage Pantry Supply	2026-07-01	2026-07-04	PO	Pending	\N	[]			\N	\N	\N	3e8e087065f848c9bc2a1d17e1d86191	2026-07-07 09:36:58.300864+00	Vendor Rep
29	BH-LOC0-001-20260707	Artisan Dairy Co.	2026-07-07	2026-07-10	PO	Accepted	1	["LOC001"]	Test User	Test User	2026-07-07 09:32:15.509868+00	\N	\N	84dfaa8383d14defa041a81ec6649fd1	2026-07-07 09:42:51.95596+00	Vendor User
\.


--
-- Data for Name: QuoteRequestLines; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public."QuoteRequestLines" ("Id", "QuoteRequestId", "Kind", "SortOrder", "ComponentId", "ComponentExternalId", "ComponentName", "Specification", "PrincipalUom", "RequestedQty", "VendorResponsesJson") FROM stdin;
1	1	principal	0	37	CMP-CHILIF-001	Chili Flakes			0	{"V052":{"deliveryUnitText":"1kg/1Bag","rrp":10,"notes":""},"V003":{"deliveryUnitText":"1kg/bag","rrp":8,"notes":""}}
2	1	principal	1	216	CMP-BEEFRI-001	Beef Rib Bone-in			0	{"V052":{"deliveryUnitText":"1kg","rrp":365,"notes":""},"V003":{"deliveryUnitText":"1kg","rrp":280,"notes":"US Prime"}}
3	1	other	2	\N		Olive Oil Pomace			0	{"V052":{"deliveryUnitText":"1btl/1.5lt","rrp":15,"notes":""},"V003":{"deliveryUnitText":"1box/6btl/1.5ltr","rrp":60,"notes":""}}
\.


--
-- Data for Name: QuoteRequestVendors; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public."QuoteRequestVendors" ("Id", "QuoteRequestId", "VendorId", "VendorExternalId", "VendorName", "ContactPerson", "Email", "Mobile", "IsNewVendor", "ShareToken", "Status", "SubmittedAt", "SubmittedBy") FROM stdin;
2	1	42	V052	DRa Trading SB	D Ra	dra@test.com	0126233503	t	1eba1b5056c64ea28e44c466bd410ad2	submitted	2026-07-10 06:41:01.453659+00	Sup1
1	1	5	V003	Artisan Dairy Co.	Sofia Lim	orders@artisandairy.my	+60 18-901 2233	f	4738c54f414b40168c81aa2d038201dd	submitted	2026-07-10 06:42:23.797478+00	sup2
\.


--
-- Data for Name: QuoteRequests; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public."QuoteRequests" ("Id", "RfqNumber", "CompanyId", "LocationIdsJson", "Status", "Notes", "CreatedBy", "CreatedAt", "UpdatedAt") FROM stdin;
1	RFQ-2026-0001	5	["weissbrau-pavilion-kuala-lumpur"]	completed			2026-07-10 06:37:05.864655+00	2026-07-10 06:42:23.849753+00
\.


--
-- Data for Name: RevMgmtCompanyConfigs; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public."RevMgmtCompanyConfigs" ("Id", "CompanyId", "ConfigKey", "StateJson", "UpdatedAt") FROM stdin;
1	2	componentHierarchy	{"categories":[{"id":1,"name":"Food"},{"id":2,"name":"Beverage"}],"groups":[{"id":1,"categoryId":1,"name":"Proteins","items":12},{"id":2,"categoryId":1,"name":"Dairy","items":8},{"id":3,"categoryId":1,"name":"Produce","items":15},{"id":4,"categoryId":2,"name":"Spirits","items":24},{"id":5,"categoryId":1,"name":"Dry Goods","items":18}],"subGroups":[{"id":1,"groupId":1,"name":"Beef","items":5},{"id":2,"groupId":1,"name":"Poultry","items":4},{"id":3,"groupId":2,"name":"Cheese","items":6},{"id":4,"groupId":4,"name":"Whisky","items":10}],"nextCategoryId":3,"nextGroupId":6,"nextSubGroupId":5}	2026-07-09 19:28:21.877532+00
2	2	storageAssignment	{"areas":["Dining Room","Bar","Kitchen"],"entries":[{"id":1,"location":"downtown","area":"Kitchen","sourceStorageId":1,"name":"Walk-in Freezer","type":"Freezer","items":18},{"id":2,"location":"downtown","area":"Kitchen","sourceStorageId":2,"name":"Main Chiller","type":"Chiller","items":32},{"id":3,"location":"downtown","area":"Bar","sourceStorageId":3,"name":"Wine Cellar","type":"Wine Cellar","items":14},{"id":4,"location":"downtown","area":"Kitchen","sourceStorageId":4,"name":"Dry Store","type":"Dry Store","items":41},{"id":5,"location":"midtown","area":"Bar","sourceStorageId":5,"name":"Bar Cooler","type":"Chiller","items":9},{"id":6,"location":"midtown","area":"Kitchen","sourceStorageId":6,"name":"Prep Kitchen Store","type":"Prep Kitchen","items":22},{"id":7,"location":"westend","area":"Kitchen","sourceStorageId":7,"name":"Westend Freezer","type":"Freezer","items":11},{"id":8,"location":"westend","area":"Kitchen","sourceStorageId":8,"name":"Westend Chiller","type":"Chiller","items":16},{"id":9,"location":"midtown","area":"Kitchen","sourceStorageId":4,"name":"Dry Store","type":"Dry Store","items":41},{"id":10,"location":"westend","area":"Kitchen","sourceStorageId":4,"name":"Dry Store","type":"Dry Store","items":41}],"nextEntryId":11}	2026-07-09 19:28:21.938239+00
3	3	componentHierarchy	{"categories":[{"id":1,"name":"Food"},{"id":2,"name":"Beverage"}],"groups":[{"id":1,"categoryId":1,"name":"Proteins","items":12},{"id":2,"categoryId":1,"name":"Dairy","items":8},{"id":3,"categoryId":1,"name":"Produce","items":15},{"id":4,"categoryId":2,"name":"Spirits","items":24},{"id":5,"categoryId":1,"name":"Dry Goods","items":18}],"subGroups":[{"id":1,"groupId":1,"name":"Beef","items":5},{"id":2,"groupId":1,"name":"Poultry","items":4},{"id":3,"groupId":2,"name":"Cheese","items":6},{"id":4,"groupId":4,"name":"Whisky","items":10}],"nextCategoryId":3,"nextGroupId":6,"nextSubGroupId":5}	2026-07-09 19:28:21.943708+00
4	3	storageAssignment	{"areas":["Dining Room","Bar","Kitchen"],"entries":[{"id":1,"location":"downtown","area":"Kitchen","sourceStorageId":1,"name":"Walk-in Freezer","type":"Freezer","items":18},{"id":2,"location":"downtown","area":"Kitchen","sourceStorageId":2,"name":"Main Chiller","type":"Chiller","items":32},{"id":3,"location":"downtown","area":"Bar","sourceStorageId":3,"name":"Wine Cellar","type":"Wine Cellar","items":14},{"id":4,"location":"downtown","area":"Kitchen","sourceStorageId":4,"name":"Dry Store","type":"Dry Store","items":41},{"id":5,"location":"midtown","area":"Bar","sourceStorageId":5,"name":"Bar Cooler","type":"Chiller","items":9},{"id":6,"location":"midtown","area":"Kitchen","sourceStorageId":6,"name":"Prep Kitchen Store","type":"Prep Kitchen","items":22},{"id":7,"location":"westend","area":"Kitchen","sourceStorageId":7,"name":"Westend Freezer","type":"Freezer","items":11},{"id":8,"location":"westend","area":"Kitchen","sourceStorageId":8,"name":"Westend Chiller","type":"Chiller","items":16},{"id":9,"location":"midtown","area":"Kitchen","sourceStorageId":4,"name":"Dry Store","type":"Dry Store","items":41},{"id":10,"location":"westend","area":"Kitchen","sourceStorageId":4,"name":"Dry Store","type":"Dry Store","items":41}],"nextEntryId":11}	2026-07-09 19:28:21.945481+00
5	1	componentHierarchy	{"categories":[{"id":1,"name":"Food"},{"id":2,"name":"Beverage"}],"groups":[{"id":1,"categoryId":1,"name":"Proteins","items":12},{"id":2,"categoryId":1,"name":"Dairy","items":8},{"id":3,"categoryId":1,"name":"Produce","items":15},{"id":4,"categoryId":2,"name":"Spirits","items":24},{"id":5,"categoryId":1,"name":"Dry Goods","items":18}],"subGroups":[{"id":1,"groupId":1,"name":"Beef","items":5},{"id":2,"groupId":1,"name":"Poultry","items":4},{"id":3,"groupId":2,"name":"Cheese","items":6},{"id":4,"groupId":4,"name":"Whisky","items":10}],"nextCategoryId":3,"nextGroupId":6,"nextSubGroupId":5}	2026-07-09 19:28:21.946712+00
6	1	storageAssignment	{"areas":["Dining Room","Bar","Kitchen"],"entries":[{"id":1,"location":"downtown","area":"Kitchen","sourceStorageId":1,"name":"Walk-in Freezer","type":"Freezer","items":18},{"id":2,"location":"downtown","area":"Kitchen","sourceStorageId":2,"name":"Main Chiller","type":"Chiller","items":32},{"id":3,"location":"downtown","area":"Bar","sourceStorageId":3,"name":"Wine Cellar","type":"Wine Cellar","items":14},{"id":4,"location":"downtown","area":"Kitchen","sourceStorageId":4,"name":"Dry Store","type":"Dry Store","items":41},{"id":5,"location":"midtown","area":"Bar","sourceStorageId":5,"name":"Bar Cooler","type":"Chiller","items":9},{"id":6,"location":"midtown","area":"Kitchen","sourceStorageId":6,"name":"Prep Kitchen Store","type":"Prep Kitchen","items":22},{"id":7,"location":"westend","area":"Kitchen","sourceStorageId":7,"name":"Westend Freezer","type":"Freezer","items":11},{"id":8,"location":"westend","area":"Kitchen","sourceStorageId":8,"name":"Westend Chiller","type":"Chiller","items":16},{"id":9,"location":"midtown","area":"Kitchen","sourceStorageId":4,"name":"Dry Store","type":"Dry Store","items":41},{"id":10,"location":"westend","area":"Kitchen","sourceStorageId":4,"name":"Dry Store","type":"Dry Store","items":41}],"nextEntryId":11}	2026-07-09 19:28:21.947952+00
7	4	componentHierarchy	{"categories":[{"id":1,"name":"Food"},{"id":2,"name":"Beverage"}],"groups":[{"id":1,"categoryId":1,"name":"Proteins","items":12},{"id":2,"categoryId":1,"name":"Dairy","items":8},{"id":3,"categoryId":1,"name":"Produce","items":15},{"id":4,"categoryId":2,"name":"Spirits","items":24},{"id":5,"categoryId":1,"name":"Dry Goods","items":18}],"subGroups":[{"id":1,"groupId":1,"name":"Beef","items":5},{"id":2,"groupId":1,"name":"Poultry","items":4},{"id":3,"groupId":2,"name":"Cheese","items":6},{"id":4,"groupId":4,"name":"Whisky","items":10}],"nextCategoryId":3,"nextGroupId":6,"nextSubGroupId":5}	2026-07-09 19:28:21.948989+00
8	4	storageAssignment	{"areas":["Dining Room","Bar","Kitchen"],"entries":[{"id":1,"location":"downtown","area":"Kitchen","sourceStorageId":1,"name":"Walk-in Freezer","type":"Freezer","items":18},{"id":2,"location":"downtown","area":"Kitchen","sourceStorageId":2,"name":"Main Chiller","type":"Chiller","items":32},{"id":3,"location":"downtown","area":"Bar","sourceStorageId":3,"name":"Wine Cellar","type":"Wine Cellar","items":14},{"id":4,"location":"downtown","area":"Kitchen","sourceStorageId":4,"name":"Dry Store","type":"Dry Store","items":41},{"id":5,"location":"midtown","area":"Bar","sourceStorageId":5,"name":"Bar Cooler","type":"Chiller","items":9},{"id":6,"location":"midtown","area":"Kitchen","sourceStorageId":6,"name":"Prep Kitchen Store","type":"Prep Kitchen","items":22},{"id":7,"location":"westend","area":"Kitchen","sourceStorageId":7,"name":"Westend Freezer","type":"Freezer","items":11},{"id":8,"location":"westend","area":"Kitchen","sourceStorageId":8,"name":"Westend Chiller","type":"Chiller","items":16},{"id":9,"location":"midtown","area":"Kitchen","sourceStorageId":4,"name":"Dry Store","type":"Dry Store","items":41},{"id":10,"location":"westend","area":"Kitchen","sourceStorageId":4,"name":"Dry Store","type":"Dry Store","items":41}],"nextEntryId":11}	2026-07-09 19:28:21.950139+00
9	5	componentHierarchy	{"categories":[{"id":1,"name":"Food"},{"id":2,"name":"Beverage"}],"groups":[{"id":1,"categoryId":1,"name":"Proteins","items":12},{"id":2,"categoryId":1,"name":"Dairy","items":8},{"id":3,"categoryId":1,"name":"Produce","items":15},{"id":4,"categoryId":2,"name":"Spirits","items":24},{"id":5,"categoryId":1,"name":"Dry Goods","items":18}],"subGroups":[{"id":1,"groupId":1,"name":"Beef","items":5},{"id":2,"groupId":1,"name":"Poultry","items":4},{"id":3,"groupId":2,"name":"Cheese","items":6},{"id":4,"groupId":4,"name":"Whisky","items":10}],"nextCategoryId":3,"nextGroupId":6,"nextSubGroupId":5}	2026-07-09 19:28:21.951129+00
10	5	storageAssignment	{"areas":["Dining Room","Bar","Kitchen"],"entries":[{"id":1,"location":"downtown","area":"Kitchen","sourceStorageId":1,"name":"Walk-in Freezer","type":"Freezer","items":18},{"id":2,"location":"downtown","area":"Kitchen","sourceStorageId":2,"name":"Main Chiller","type":"Chiller","items":32},{"id":3,"location":"downtown","area":"Bar","sourceStorageId":3,"name":"Wine Cellar","type":"Wine Cellar","items":14},{"id":4,"location":"downtown","area":"Kitchen","sourceStorageId":4,"name":"Dry Store","type":"Dry Store","items":41},{"id":5,"location":"midtown","area":"Bar","sourceStorageId":5,"name":"Bar Cooler","type":"Chiller","items":9},{"id":6,"location":"midtown","area":"Kitchen","sourceStorageId":6,"name":"Prep Kitchen Store","type":"Prep Kitchen","items":22},{"id":7,"location":"westend","area":"Kitchen","sourceStorageId":7,"name":"Westend Freezer","type":"Freezer","items":11},{"id":8,"location":"westend","area":"Kitchen","sourceStorageId":8,"name":"Westend Chiller","type":"Chiller","items":16},{"id":9,"location":"midtown","area":"Kitchen","sourceStorageId":4,"name":"Dry Store","type":"Dry Store","items":41},{"id":10,"location":"westend","area":"Kitchen","sourceStorageId":4,"name":"Dry Store","type":"Dry Store","items":41}],"nextEntryId":11}	2026-07-09 19:28:21.953905+00
11	2	componentCatalog	{"extraGroups":[],"extraUoms":[],"extraStorages":[]}	2026-07-09 19:32:13.22656+00
12	3	componentCatalog	{"extraGroups":[],"extraUoms":[],"extraStorages":[]}	2026-07-09 19:32:13.292342+00
14	4	componentCatalog	{"extraGroups":[],"extraUoms":[],"extraStorages":[]}	2026-07-09 19:32:13.298204+00
13	1	componentCatalog	{"extraGroups":["Custom Group"],"extraUoms":["Punnet"],"extraStorages":["Cold Room"]}	2026-07-09 19:32:20.354447+00
15	5	componentCatalog	{"extraGroups":["Pasta"],"extraUoms":[],"extraStorages":[]}	2026-07-10 02:25:03.328939+00
\.


--
-- Data for Name: RevenueDataPoints; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public."RevenueDataPoints" ("Id", "Period", "Label", "CurrentValue", "PriorValue", "Covers") FROM stdin;
1	week	Mon	4820.0	4200.0	124
2	week	Tue	5340.0	4900.0	138
3	week	Wed	6100.0	5200.0	162
4	week	Thu	5780.0	5600.0	151
5	week	Fri	8920.0	7800.0	234
6	week	Sat	11240.0	10100.0	298
7	week	Sun	9650.0	8900.0	256
\.


--
-- Data for Name: ShiftSchedules; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public."ShiftSchedules" ("Id", "EmployeeId", "Date", "StartTime", "EndTime", "Type") FROM stdin;
1	12	2026-06-22	13:00:00	21:00:00	Work
2	4	2026-06-22	16:00:00	00:00:00	Work
3	5	2026-06-22	10:00:00	18:00:00	Work
4	5	2026-06-23	10:00:00	18:00:00	Work
5	4	2026-06-23	16:00:00	00:00:00	Work
6	5	2026-06-25	10:00:00	18:00:00	Work
7	5	2026-06-24	\N	\N	DO
8	5	2026-06-26	10:00:00	18:00:00	Work
9	5	2026-06-27	10:00:00	18:00:00	Work
10	5	2026-06-28	10:00:00	18:00:00	Work
12	22	2026-06-23	10:00:00	18:00:00	Work
13	22	2026-06-24	10:00:00	18:00:00	Work
14	22	2026-06-25	10:00:00	18:00:00	Work
15	22	2026-06-26	10:00:00	18:00:00	Work
16	22	2026-06-27	10:00:00	18:00:00	Work
17	22	2026-06-28	10:00:00	18:00:00	Work
18	22	2026-06-22	\N	\N	DO
19	23	2026-06-22	10:00:00	18:00:00	Work
21	23	2026-06-23	\N	\N	DO
22	23	2026-06-24	16:00:00	00:00:00	Work
23	23	2026-06-25	16:00:00	00:00:00	Work
24	23	2026-06-26	16:00:00	00:00:00	Work
25	23	2026-06-27	16:00:00	00:00:00	Work
26	23	2026-06-28	16:00:00	00:00:00	Work
27	26	2026-06-22	16:00:00	00:00:00	Work
28	26	2026-06-23	16:00:00	00:00:00	Work
29	26	2026-06-24	\N	\N	DO
30	26	2026-06-25	13:00:00	21:00:00	Work
31	26	2026-06-26	12:30:00	20:30:00	Work
32	26	2026-06-27	12:30:00	20:30:00	Work
33	26	2026-06-28	12:30:00	20:30:00	Work
34	19	2026-06-23	10:00:00	18:00:00	Work
35	19	2026-06-22	\N	\N	DO
36	19	2026-06-24	10:00:00	18:00:00	Work
37	19	2026-06-25	10:00:00	18:00:00	Work
38	19	2026-06-26	10:00:00	18:00:00	Work
39	19	2026-06-27	10:00:00	18:00:00	Work
40	19	2026-06-28	10:00:00	18:00:00	Work
41	20	2026-06-22	10:00:00	18:00:00	Work
43	20	2026-06-23	\N	\N	DO
44	20	2026-06-24	16:00:00	00:00:00	Work
45	20	2026-06-25	16:00:00	00:00:00	Work
46	20	2026-06-26	16:00:00	00:00:00	Work
47	20	2026-06-27	16:00:00	00:00:00	Work
48	20	2026-06-28	16:00:00	00:00:00	Work
49	21	2026-06-22	16:00:00	00:00:00	Work
50	21	2026-06-23	16:00:00	00:00:00	Work
\.


--
-- Data for Name: SocsoBrackets; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public."SocsoBrackets" ("Id", "PayStructureId", "SortOrder", "MinAge", "MaxAge", "MinMonthlySalary", "MaxMonthlySalary", "EmployerAmount", "EmployeeAmount") FROM stdin;
1	2	0	\N	59	\N	5000	86.65	61.9
2	2	1	\N	59	5000.01	10000	104.15	74.4
3	2	2	\N	59	10000.01	\N	104.15	74.4
4	2	3	60	\N	\N	5000	71.9	43.15
5	2	4	60	\N	5000.01	\N	74.4	44.65
\.


--
-- Data for Name: UserNotifications; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public."UserNotifications" ("Id", "UserId", "RecipientName", "PurchaseOrderId", "Type", "Title", "Body", "CreatedAt", "ReadAt") FROM stdin;
1	\N	Test User	29	purchase_order_accepted	Purchase order BH-LOC0-001-20260707 accepted	Accepted by Vendor User from Artisan Dairy Co..	2026-07-07 09:42:52.019687+00	\N
\.


--
-- Data for Name: VendorProductPrices; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public."VendorProductPrices" ("ExternalId", "DeliveryPrice", "UpdatedAt", "LastPurchaseOrderId") FROM stdin;
VP-GAR006	16.5	2026-07-01 11:21:04.336776+00	24
\.


--
-- Data for Name: VendorProducts; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public."VendorProducts" ("ExternalId", "VendorExternalId", "VendorName", "ProductName", "Group", "Specification", "ImageUrl", "DeliveryPrice", "DeliveryJson", "ProductPolicyTag", "IsPrivate", "PrivateLocationIdsJson", "Active", "UpdatedAt") FROM stdin;
VP-ALM025	V025	Plant Milk Wholesale	Almond Milk	Beverages	Unsweetened, 12x1L case	https://picsum.photos/seed/vp-alm025/80/80	58	{"orderUnit":"Case","orderQty":1,"packUnit":"Ltr","packQty":12,"unitUnit":"Ml","unitQty":1000}		f	[]	t	2026-07-09 19:28:21.986466+00
VP-APL021	V021	Juice Factory Direct	Cloudy Apple Juice	Beverages	Cold-pressed, 5L bag-in-box	https://picsum.photos/seed/vp-apl021/80/80	38	{"orderUnit":"Box","orderQty":1,"packUnit":"Ltr","packQty":5,"unitUnit":"Ml","unitQty":1000}		f	[]	t	2026-07-09 19:28:21.986361+00
VP-BAL015	V015	Mediterranean Oil Co.	Balsamic Vinegar	Dry Goods	Aged Modena IGP, 500ml bottle	https://picsum.photos/seed/vp-bal015/80/80	38	{"orderUnit":"Bottle","orderQty":1,"packUnit":"Ml","packQty":500,"unitUnit":"Ml","unitQty":1}		f	[]	t	2026-07-09 19:28:21.986211+00
VP-BAS017	V017	Fresh Herb Gardens	Fresh Basil	Produce	Living basil pots, 12-pack	https://picsum.photos/seed/vp-bas017/80/80	36	{"orderUnit":"Tray","orderQty":1,"packUnit":"Each","packQty":12,"unitUnit":"Each","unitQty":1}		f	[]	t	2026-07-09 19:28:21.98626+00
VP-BEA001	V007	Heritage Pantry Supply	Baked Beans	Dry Goods	Baked beans in tomato sauce, 400g tins, shelf-stable	https://picsum.photos/seed/vp-bea001/80/80	42	{"orderUnit":"Box","orderQty":1,"packUnit":"Tin","packQty":12,"unitUnit":"Gr","unitQty":400}		f	[]	t	2026-07-09 19:28:21.986097+00
VP-BEA002	V011	Metro Canned Foods	Baked Beans	Dry Goods	Haricot beans in rich tomato sauce, 380g tins, Metro Classic line	https://picsum.photos/seed/vp-bea002/80/80	39.5	{"orderUnit":"Box","orderQty":1,"packUnit":"Tin","packQty":12,"unitUnit":"Gr","unitQty":380}		f	[]	t	2026-07-09 19:28:21.986108+00
VP-BEF042	V042	Barakah Halal Meats	Halal Beef Tenderloin	Proteins	JAKIM halal certified tenderloin, trimmed, vacuum packed	https://picsum.photos/seed/vp-bef042/80/80	92	{"orderUnit":"Kg","orderQty":1,"packUnit":"Kg","packQty":1,"unitUnit":"Kg","unitQty":1}	halal	f	[]	t	2026-07-09 19:28:21.986693+00
VP-BER001	V006	Green Valley Produce	Strawberries	Produce	Fresh strawberries, 250g punnet, chilled	https://picsum.photos/seed/vp-ber001/80/80	12	{"orderUnit":"Punnet","orderQty":1,"packUnit":"Gr","packQty":250,"unitUnit":"Gr","unitQty":1}		f	[]	t	2026-07-09 19:28:21.986087+00
VP-BER020	V020	Frozen Foods Express	Mixed Berries	Produce	IQF raspberry/blueberry blend, 1kg	https://picsum.photos/seed/vp-ber020/80/80	35	{"orderUnit":"Bag","orderQty":1,"packUnit":"Kg","packQty":1,"unitUnit":"Kg","unitQty":1}		f	[]	t	2026-07-09 19:28:21.986343+00
VP-BPD049	V049	Raudhah Bakery Supplies Halal	Halal Baking Powder	Dry Goods	JAKIM halal certified double-acting baking powder, 1kg	https://picsum.photos/seed/vp-bpd049/80/80	12	{"orderUnit":"Kg","orderQty":1,"packUnit":"Kg","packQty":1,"unitUnit":"Kg","unitQty":1}	halal	f	[]	t	2026-07-09 19:28:21.986882+00
VP-BRS044	V044	Kurnia Poultry Halal	Halal Chicken Breast	Proteins	JAKIM halal certified skinless breast, tray packed	https://picsum.photos/seed/vp-brs044/80/80	19.5	{"orderUnit":"Kg","orderQty":5,"packUnit":"Kg","packQty":1,"unitUnit":"Kg","unitQty":1}	halal	f	[]	t	2026-07-09 19:28:21.986741+00
VP-BUR001	V003	Artisan Dairy Co.	Burrata	Dairy	Fresh burrata in whey, 125g each, Italian origin	https://picsum.photos/seed/vp-bur001/80/80	52.5	{"orderUnit":"Case","orderQty":1,"packUnit":"Each","packQty":6,"unitUnit":"Each","unitQty":1}		f	[]	t	2026-07-09 19:28:21.986+00
VP-BUR030	V030	Imported Cheese Cellar	Burrata	Dairy	125g cups, 12-pack case	https://picsum.photos/seed/vp-bur030/80/80	58	{"orderUnit":"Case","orderQty":1,"packUnit":"Each","packQty":12,"unitUnit":"Each","unitQty":1}		f	[]	t	2026-07-09 19:28:21.986603+00
VP-BUT014	V014	Valley Dairy Wholesale	Unsalted Butter	Dairy	European style 82% fat, 25kg block	https://picsum.photos/seed/vp-but014/80/80	385	{"orderUnit":"Block","orderQty":1,"packUnit":"Kg","packQty":25,"unitUnit":"Kg","unitQty":1}		f	[]	t	2026-07-09 19:28:21.986185+00
VP-CHK042	V042	Barakah Halal Meats	Halal Chicken Drumsticks	Proteins	JAKIM halal certified drumsticks, tray packed, chilled	https://picsum.photos/seed/vp-chk042/80/80	14.5	{"orderUnit":"Kg","orderQty":5,"packUnit":"Kg","packQty":1,"unitUnit":"Kg","unitQty":1}	halal	f	[]	t	2026-07-09 19:28:21.986701+00
VP-CHT012	V012	Pacific Poultry Supply	Chicken Thigh (skinless)	Proteins	Fresh boneless thigh, tray packed, chilled	https://picsum.photos/seed/vp-cht012/80/80	16.5	{"orderUnit":"Kg","orderQty":5,"packUnit":"Kg","packQty":1,"unitUnit":"Kg","unitQty":1}		f	[]	t	2026-07-09 19:28:21.986118+00
VP-CHX001	V001	Premium Meats Co.	Free-range Chicken Breast	Proteins	Skinless chicken breast, free-range, trimmed	https://picsum.photos/seed/vp-chx001/80/80	42	{"orderUnit":"Kg","orderQty":2,"packUnit":"Kg","packQty":1,"unitUnit":"Kg","unitQty":1}		f	[]	t	2026-07-09 19:28:21.985956+00
VP-COC051	V051	Darul Ehsan Halal Pantry	Halal Coconut Milk	Dry Goods	JAKIM halal certified coconut milk, 24x400ml case	https://picsum.photos/seed/vp-coc051/80/80	52	{"orderUnit":"Case","orderQty":1,"packUnit":"Tin","packQty":24,"unitUnit":"Ml","unitQty":400}	halal	f	[]	t	2026-07-09 19:28:21.986933+00
VP-COD013	V013	Harbour Fish Market	Atlantic Cod Fillet	Seafood	Skinless fillet portions, chilled	https://picsum.photos/seed/vp-cod013/80/80	42	{"orderUnit":"Kg","orderQty":1,"packUnit":"Kg","packQty":1,"unitUnit":"Kg","unitQty":1}		f	[]	t	2026-07-09 19:28:21.986157+00
VP-COL024	V024	Syrup & Mixers Ltd	Cola Syrup	Beverages	Post-mix cola concentrate, 5L	https://picsum.photos/seed/vp-col024/80/80	48	{"orderUnit":"Bottle","orderQty":1,"packUnit":"Ltr","packQty":5,"unitUnit":"Ltr","unitQty":1}		f	[]	t	2026-07-09 19:28:21.986438+00
VP-CRM014	V014	Valley Dairy Wholesale	Heavy Cream	Dairy	35% fat, 2L carton, chilled	https://picsum.photos/seed/vp-crm014/80/80	22	{"orderUnit":"Carton","orderQty":1,"packUnit":"Ltr","packQty":2,"unitUnit":"Ml","unitQty":1000}		f	[]	t	2026-07-09 19:28:21.986176+00
VP-CRT001	V004	Wine & Spirits Direct	Fountain Syrup (crate)	Beverages	Cola syrup concentrate, 1L bottles, food-grade	https://picsum.photos/seed/vp-crt001/80/80	185	{"orderUnit":"Crate","orderQty":1,"packUnit":"Bottle","packQty":12,"unitUnit":"Ltr","unitQty":1}		f	[]	t	2026-07-09 19:28:21.986056+00
VP-CRY048	V048	Hikmah Spice House	Halal Curry Powder	Dry Goods	JAKIM halal certified house curry blend, 1kg tin	https://picsum.photos/seed/vp-cry048/80/80	22	{"orderUnit":"Tin","orderQty":1,"packUnit":"Kg","packQty":1,"unitUnit":"Kg","unitQty":1}	halal	f	[]	t	2026-07-09 19:28:21.986853+00
VP-CUC045	V045	Hijrah Fresh Produce Halal	Halal Japanese Cucumber	Produce	Fresh cucumbers, halal farm certified, 5kg crate	https://picsum.photos/seed/vp-cuc045/80/80	18	{"orderUnit":"Crate","orderQty":1,"packUnit":"Kg","packQty":5,"unitUnit":"Kg","unitQty":1}	halal	f	[]	t	2026-07-09 19:28:21.986767+00
VP-DAT047	V047	Zam-Zam Beverages Halal	Halal Dates Juice	Beverages	JAKIM halal certified date juice, 1L bottle, no alcohol	https://picsum.photos/seed/vp-dat047/80/80	14	{"orderUnit":"Bottle","orderQty":1,"packUnit":"Ltr","packQty":1,"unitUnit":"Ltr","unitQty":1}	halal	f	[]	t	2026-07-09 19:28:21.986816+00
VP-DOR050	V050	Nusantara Halal Frozen Foods	Halal Dory Fillet	Seafood	JAKIM halal certified dory fillet portions, IQF frozen	https://picsum.photos/seed/vp-dor050/80/80	24	{"orderUnit":"Kg","orderQty":1,"packUnit":"Kg","packQty":1,"unitUnit":"Kg","unitQty":1}	halal	f	[]	t	2026-07-09 19:28:21.98692+00
VP-DRA001	V004	Wine & Spirits Direct	Draught Lager (keg)	Beverages	30L stainless keg, 4.5% ABV, returnable keg	https://picsum.photos/seed/vp-dra001/80/80	210	{"orderUnit":"Keg","orderQty":1,"packUnit":"Ltr","packQty":30,"unitUnit":"Ltr","unitQty":1}		f	[]	t	2026-07-09 19:28:21.986045+00
VP-DUC012	V012	Pacific Poultry Supply	Duck Breast	Proteins	Magret duck breast, trimmed, vacuum packed	https://picsum.photos/seed/vp-duc012/80/80	48	{"orderUnit":"Kg","orderQty":1,"packUnit":"Kg","packQty":1,"unitUnit":"Kg","unitQty":1}		f	[]	t	2026-07-09 19:28:21.986128+00
VP-EGG014	V014	Valley Dairy Wholesale	Free Range Eggs	Dairy	Grade A large eggs, 30-tray pack	https://picsum.photos/seed/vp-egg014/80/80	24	{"orderUnit":"Tray","orderQty":1,"packUnit":"Each","packQty":30,"unitUnit":"Each","unitQty":1}		f	[]	t	2026-07-09 19:28:21.986194+00
VP-EGR023	V023	Tea & Tisane Co.	Earl Grey Loose Leaf	Beverages	Bergamot black tea, 500g pouch	https://picsum.photos/seed/vp-egr023/80/80	45	{"orderUnit":"Pouch","orderQty":1,"packUnit":"Gr","packQty":500,"unitUnit":"Gr","unitQty":1}		f	[]	t	2026-07-09 19:28:21.986409+00
VP-ESP001	V010	Bean Brothers Roasters	Espresso Beans	Beverages	Single-origin arabica, medium roast, whole bean	https://picsum.photos/seed/vp-esp001/80/80	26	{"orderUnit":"Kg","orderQty":1,"packUnit":"Kg","packQty":1,"unitUnit":"Kg","unitQty":1}		f	[]	t	2026-07-09 19:28:21.986067+00
VP-FLR018	V018	Grain & Mill Co.	00 Flour	Dry Goods	Italian tipo 00, 25kg bag	https://picsum.photos/seed/vp-flr018/80/80	52	{"orderUnit":"Bag","orderQty":1,"packUnit":"Kg","packQty":25,"unitUnit":"Kg","unitQty":1}		f	[]	t	2026-07-09 19:28:21.986285+00
VP-FLR029	V029	Bakery Ingredients MY	00 Flour	Dry Goods	Strong white 00, 25kg sack	https://picsum.photos/seed/vp-flr029/80/80	48	{"orderUnit":"Sack","orderQty":1,"packUnit":"Kg","packQty":25,"unitUnit":"Kg","unitQty":1}		f	[]	t	2026-07-09 19:28:21.986562+00
VP-FLR049	V049	Raudhah Bakery Supplies Halal	Halal Cake Flour	Dry Goods	JAKIM halal certified low-protein cake flour, 25kg sack	https://picsum.photos/seed/vp-flr049/80/80	46	{"orderUnit":"Sack","orderQty":1,"packUnit":"Kg","packQty":25,"unitUnit":"Kg","unitQty":1}	halal	f	[]	t	2026-07-09 19:28:21.986872+00
VP-FRY020	V020	Frozen Foods Express	Shoestring Fries	Dry Goods	9mm fries, 2.5kg bag	https://picsum.photos/seed/vp-fry020/80/80	22	{"orderUnit":"Bag","orderQty":1,"packUnit":"Kg","packQty":2.5,"unitUnit":"Kg","unitQty":1}		f	[]	t	2026-07-09 19:28:21.986334+00
VP-GAR006	V006	Green Valley Produce	Peeled Garlic	Produce	Peeled cloves, 1kg tub	https://picsum.photos/seed/vp-gar006/80/80	16	{"orderUnit":"Tub","orderQty":1,"packUnit":"Kg","packQty":1,"unitUnit":"Kg","unitQty":1}		f	[]	t	2026-07-09 19:28:21.986676+00
VP-GRE024	V024	Syrup & Mixers Ltd	Grenadine Syrup	Beverages	Bar grenadine, 1L bottle	https://picsum.photos/seed/vp-gre024/80/80	18	{"orderUnit":"Bottle","orderQty":1,"packUnit":"Ltr","packQty":1,"unitUnit":"Ltr","unitQty":1}		f	[]	t	2026-07-09 19:28:21.986447+00
VP-GRN023	V023	Tea & Tisane Co.	Sencha Green Tea	Beverages	Japanese sencha, 250g pouch	https://picsum.photos/seed/vp-grn023/80/80	38	{"orderUnit":"Pouch","orderQty":1,"packUnit":"Gr","packQty":250,"unitUnit":"Gr","unitQty":1}		f	[]	t	2026-07-09 19:28:21.986419+00
VP-GRP047	V047	Zam-Zam Beverages Halal	Halal Sparkling Grape	Beverages	JAKIM halal certified non-alcoholic sparkling grape, 750ml	https://picsum.photos/seed/vp-grp047/80/80	12	{"orderUnit":"Bottle","orderQty":1,"packUnit":"Ml","packQty":750,"unitUnit":"Ml","unitQty":1}	halal	f	[]	t	2026-07-09 19:28:21.986834+00
VP-IPA022	V022	Craft Brew Alliance	Craft IPA Beer	Beverages	6.2% ABV, 30L keg	https://picsum.photos/seed/vp-ipa022/80/80	195	{"orderUnit":"Keg","orderQty":1,"packUnit":"Ltr","packQty":30,"unitUnit":"Ltr","unitQty":1}		f	[]	t	2026-07-09 19:28:21.98638+00
VP-KET028	V028	Condiment Central	Tomato Ketchup	Dry Goods	Food-service squeeze, 4x5L	https://picsum.photos/seed/vp-ket028/80/80	42	{"orderUnit":"Case","orderQty":1,"packUnit":"Ltr","packQty":5,"unitUnit":"Ltr","unitQty":1}		f	[]	t	2026-07-09 19:28:21.986542+00
VP-LAG022	V022	Craft Brew Alliance	Craft Lager	Beverages	4.8% ABV, 30L keg	https://picsum.photos/seed/vp-lag022/80/80	175	{"orderUnit":"Keg","orderQty":1,"packUnit":"Ltr","packQty":30,"unitUnit":"Ltr","unitQty":1}		f	[]	t	2026-07-09 19:28:21.98639+00
VP-LIM021	V021	Juice Factory Direct	Lime Juice	Beverages	Pasteurised lime, 1L bottle	https://picsum.photos/seed/vp-lim021/80/80	12	{"orderUnit":"Bottle","orderQty":1,"packUnit":"Ltr","packQty":1,"unitUnit":"Ltr","unitQty":1}		f	[]	t	2026-07-09 19:28:21.986371+00
VP-LMB001	V001	Premium Meats Co.	Lamb Rack	Proteins	NZ lamb rack, frenched, chilled	https://picsum.photos/seed/vp-lmb001/80/80	125	{"orderUnit":"Kg","orderQty":1,"packUnit":"Kg","packQty":1,"unitUnit":"Kg","unitQty":1}		f	[]	t	2026-07-09 19:28:21.986628+00
VP-LMB026	V026	Butcher Block Prime	Lamb Rack	Proteins	French-trimmed rack, 8-rib, chilled	https://picsum.photos/seed/vp-lmb026/80/80	118	{"orderUnit":"Kg","orderQty":1,"packUnit":"Kg","packQty":1,"unitUnit":"Kg","unitQty":1}		f	[]	t	2026-07-09 19:28:21.986476+00
VP-LMB042	V042	Barakah Halal Meats	Halal Lamb Shoulder	Proteins	JAKIM halal certified NZ lamb shoulder, bone-in, chilled	https://picsum.photos/seed/vp-lmb042/80/80	68	{"orderUnit":"Kg","orderQty":1,"packUnit":"Kg","packQty":1,"unitUnit":"Kg","unitQty":1}	halal	f	[]	t	2026-07-09 19:28:21.986684+00
VP-LMG048	V048	Hikmah Spice House	Halal Lemongrass Paste	Dry Goods	JAKIM halal certified lemongrass paste, 500g tub	https://picsum.photos/seed/vp-lmg048/80/80	14	{"orderUnit":"Tub","orderQty":1,"packUnit":"Gr","packQty":500,"unitUnit":"Gr","unitQty":1}	halal	f	[]	t	2026-07-09 19:28:21.986863+00
VP-MAY028	V028	Condiment Central	Whole Egg Mayo	Dry Goods	Classic mayo, 10L tub	https://picsum.photos/seed/vp-may028/80/80	68	{"orderUnit":"Tub","orderQty":1,"packUnit":"Ltr","packQty":10,"unitUnit":"Ltr","unitQty":1}		f	[]	t	2026-07-09 19:28:21.986552+00
VP-MLK046	V046	Al-Noor Halal Dairy	Halal Fresh Milk	Dairy	JAKIM halal certified full cream milk, 2L carton	https://picsum.photos/seed/vp-mlk046/80/80	9.5	{"orderUnit":"Carton","orderQty":1,"packUnit":"Ltr","packQty":2,"unitUnit":"Ml","unitQty":1000}	halal	f	[]	t	2026-07-09 19:28:21.986787+00
VP-MOZ030	V030	Imported Cheese Cellar	Mozzarella Fior di Latte	Dairy	Fresh mozzarella logs, 2x2.5kg	https://picsum.photos/seed/vp-moz030/80/80	88	{"orderUnit":"Case","orderQty":1,"packUnit":"Kg","packQty":5,"unitUnit":"Kg","unitQty":1}		f	[]	t	2026-07-09 19:28:21.986587+00
VP-MOZ046	V046	Al-Noor Halal Dairy	Halal Mozzarella Block	Dairy	JAKIM halal certified mozzarella, 2.5kg block	https://picsum.photos/seed/vp-moz046/80/80	48	{"orderUnit":"Block","orderQty":1,"packUnit":"Kg","packQty":2.5,"unitUnit":"Kg","unitQty":1}	halal	f	[]	t	2026-07-09 19:28:21.986797+00
VP-NDL051	V051	Darul Ehsan Halal Pantry	Halal Instant Noodles	Dry Goods	JAKIM halal certified instant noodles, 40-pack carton	https://picsum.photos/seed/vp-ndl051/80/80	32	{"orderUnit":"Carton","orderQty":1,"packUnit":"Each","packQty":40,"unitUnit":"Each","unitQty":1}	halal	f	[]	t	2026-07-09 19:28:21.986952+00
VP-OAT018	V018	Grain & Mill Co.	Rolled Oats	Dry Goods	Jumbo oats, 5kg bag	https://picsum.photos/seed/vp-oat018/80/80	28	{"orderUnit":"Bag","orderQty":1,"packUnit":"Kg","packQty":5,"unitUnit":"Kg","unitQty":1}		f	[]	t	2026-07-09 19:28:21.986293+00
VP-OAT025	V025	Plant Milk Wholesale	Oat Milk Barista	Beverages	Barista blend, 12x1L case	https://picsum.photos/seed/vp-oat025/80/80	54	{"orderUnit":"Case","orderQty":1,"packUnit":"Ltr","packQty":12,"unitUnit":"Ml","unitQty":1000}		f	[]	t	2026-07-09 19:28:21.986457+00
VP-OJ006	V006	Green Valley Produce	Fresh Orange Juice	Beverages	Cold-pressed OJ, 2L bottle	https://picsum.photos/seed/vp-oj006/80/80	18	{"orderUnit":"Bottle","orderQty":1,"packUnit":"Ltr","packQty":2,"unitUnit":"Ml","unitQty":1000}		f	[]	t	2026-07-09 19:28:21.98666+00
VP-OJ021	V021	Juice Factory Direct	Fresh Orange Juice	Beverages	Not-from-concentrate, 5L bag-in-box	https://picsum.photos/seed/vp-oj021/80/80	42	{"orderUnit":"Box","orderQty":1,"packUnit":"Ltr","packQty":5,"unitUnit":"Ml","unitQty":1000}		f	[]	t	2026-07-09 19:28:21.986352+00
VP-OLV007	V007	Heritage Pantry Supply	Olive Oil Extra Virgin	Dry Goods	Spanish EVOO, 5L tin	https://picsum.photos/seed/vp-olv007/80/80	165	{"orderUnit":"Tin","orderQty":1,"packUnit":"Ltr","packQty":5,"unitUnit":"Ml","unitQty":1000}		f	[]	t	2026-07-09 19:28:21.986636+00
VP-OLV015	V015	Mediterranean Oil Co.	Olive Oil Extra Virgin	Dry Goods	Cold-pressed, 5L tin, PDO	https://picsum.photos/seed/vp-olv015/80/80	185	{"orderUnit":"Tin","orderQty":1,"packUnit":"Ltr","packQty":5,"unitUnit":"Ml","unitQty":1000}		f	[]	t	2026-07-09 19:28:21.986202+00
VP-ONI027	V027	Organic Veg Hub	Yellow Onions	Produce	Organic brown onions, 10kg sack	https://picsum.photos/seed/vp-oni027/80/80	22	{"orderUnit":"Sack","orderQty":1,"packUnit":"Kg","packQty":10,"unitUnit":"Kg","unitQty":1}		f	[]	t	2026-07-09 19:28:21.986514+00
VP-PAP016	V016	Spice Route Trading	Smoked Paprika	Dry Goods	Sweet smoked paprika, 1kg tin	https://picsum.photos/seed/vp-pap016/80/80	32	{"orderUnit":"Tin","orderQty":1,"packUnit":"Kg","packQty":1,"unitUnit":"Kg","unitQty":1}		f	[]	t	2026-07-09 19:28:21.986244+00
VP-PAR017	V017	Fresh Herb Gardens	Flat-leaf Parsley	Produce	Bunched parsley, 1kg box	https://picsum.photos/seed/vp-par017/80/80	14	{"orderUnit":"Box","orderQty":1,"packUnit":"Kg","packQty":1,"unitUnit":"Kg","unitQty":1}		f	[]	t	2026-07-09 19:28:21.986268+00
VP-PAR030	V030	Imported Cheese Cellar	Parmesan Reggiano	Dairy	24-month wedge, 1kg avg	https://picsum.photos/seed/vp-par030/80/80	145	{"orderUnit":"Kg","orderQty":1,"packUnit":"Kg","packQty":1,"unitUnit":"Kg","unitQty":1}		f	[]	t	2026-07-09 19:28:21.986595+00
VP-PAR050	V050	Nusantara Halal Frozen Foods	Halal Paratha	Dry Goods	JAKIM halal certified plain paratha, 30-piece pack, frozen	https://picsum.photos/seed/vp-par050/80/80	28	{"orderUnit":"Pack","orderQty":1,"packUnit":"Each","packQty":30,"unitUnit":"Each","unitQty":1}	halal	f	[]	t	2026-07-09 19:28:21.986901+00
VP-PAS007	V007	Heritage Pantry Supply	Tomato Passata	Dry Goods	Italian passata, 3x2.5L	https://picsum.photos/seed/vp-pas007/80/80	32	{"orderUnit":"Pack","orderQty":1,"packUnit":"Ltr","packQty":2.5,"unitUnit":"Ml","unitQty":1000}		f	[]	t	2026-07-09 19:28:21.986644+00
VP-PAS011	V011	Metro Canned Foods	Tomato Passata	Dry Goods	Metro chef passata, 3x3L	https://picsum.photos/seed/vp-pas011/80/80	34	{"orderUnit":"Pack","orderQty":1,"packUnit":"Ltr","packQty":3,"unitUnit":"Ml","unitQty":1000}		f	[]	t	2026-07-09 19:28:21.986652+00
VP-PAS028	V028	Condiment Central	Tomato Passata	Dry Goods	Smooth passata, 3x3L pack	https://picsum.photos/seed/vp-pas028/80/80	36	{"orderUnit":"Pack","orderQty":1,"packUnit":"Ltr","packQty":3,"unitUnit":"Ml","unitQty":1000}		f	[]	t	2026-07-09 19:28:21.986533+00
VP-PEA020	V020	Frozen Foods Express	Garden Peas	Produce	IQF peas, 2.5kg bag	https://picsum.photos/seed/vp-pea020/80/80	18	{"orderUnit":"Bag","orderQty":1,"packUnit":"Kg","packQty":2.5,"unitUnit":"Kg","unitQty":1}		f	[]	t	2026-07-09 19:28:21.986326+00
VP-PEN019	V019	Noodle House Supply	Penne Pasta	Dry Goods	Bronze die penne, 5kg case	https://picsum.photos/seed/vp-pen019/80/80	32	{"orderUnit":"Case","orderQty":1,"packUnit":"Kg","packQty":5,"unitUnit":"Kg","unitQty":1}		f	[]	t	2026-07-09 19:28:21.986301+00
VP-PEP016	V016	Spice Route Trading	Black Peppercorns	Dry Goods	Whole Lampong pepper, 500g pouch	https://picsum.photos/seed/vp-pep016/80/80	28	{"orderUnit":"Pouch","orderQty":1,"packUnit":"Gr","packQty":500,"unitUnit":"Gr","unitQty":1}		f	[]	t	2026-07-09 19:28:21.986235+00
VP-POM043	V043	Seri Mutiara Halal Seafood	Halal Black Pomfret	Seafood	JAKIM halal certified whole pomfret, gutted, iced	https://picsum.photos/seed/vp-pom043/80/80	42	{"orderUnit":"Kg","orderQty":1,"packUnit":"Kg","packQty":1,"unitUnit":"Kg","unitQty":1}	halal	f	[]	t	2026-07-09 19:28:21.986717+00
VP-POR026	V026	Butcher Block Prime	Pork Belly	Proteins	Skin-on belly, slab cut	https://picsum.photos/seed/vp-por026/80/80	32	{"orderUnit":"Kg","orderQty":1,"packUnit":"Kg","packQty":1,"unitUnit":"Kg","unitQty":1}		f	[]	t	2026-07-09 19:28:21.986485+00
VP-POT027	V027	Organic Veg Hub	Russet Potatoes	Produce	Organic baking potatoes, 10kg sack	https://picsum.photos/seed/vp-pot027/80/80	26	{"orderUnit":"Sack","orderQty":1,"packUnit":"Kg","packQty":10,"unitUnit":"Kg","unitQty":1}		f	[]	t	2026-07-09 19:28:21.986523+00
VP-PRN013	V013	Harbour Fish Market	Tiger Prawns	Seafood	U15 headless prawns, IQF frozen	https://picsum.photos/seed/vp-prn013/80/80	72	{"orderUnit":"Kg","orderQty":1,"packUnit":"Kg","packQty":1,"unitUnit":"Kg","unitQty":1}		f	[]	t	2026-07-09 19:28:21.986149+00
VP-RED004	V004	Wine & Spirits Direct	House Red Wine	Beverages	Cask wine, 5L bag-in-box	https://picsum.photos/seed/vp-red004/80/80	55	{"orderUnit":"Box","orderQty":1,"packUnit":"Ltr","packQty":5,"unitUnit":"Ml","unitQty":1000}		f	[]	t	2026-07-09 19:28:21.986668+00
VP-RIB001	V001	Premium Meats Co.	Ribeye Prime	Proteins	USDA Prime ribeye, boneless, vacuum packed	https://picsum.photos/seed/vp-rib001/80/80	145	{"orderUnit":"Kg","orderQty":1,"packUnit":"Kg","packQty":1,"unitUnit":"Kg","unitQty":1}		f	[]	t	2026-07-09 19:28:21.985873+00
VP-RIC018	V018	Grain & Mill Co.	Basmati Rice	Dry Goods	Aged basmati, 10kg sack	https://picsum.photos/seed/vp-ric018/80/80	68	{"orderUnit":"Sack","orderQty":1,"packUnit":"Kg","packQty":10,"unitUnit":"Kg","unitQty":1}		f	[]	t	2026-07-09 19:28:21.986276+00
VP-ROK017	V017	Fresh Herb Gardens	Rocket Arugula	Produce	Washed baby rocket, 500g bag	https://picsum.photos/seed/vp-rok017/80/80	9.5	{"orderUnit":"Bag","orderQty":1,"packUnit":"Gr","packQty":500,"unitUnit":"Gr","unitQty":1}		f	[]	t	2026-07-09 19:28:21.986252+00
VP-ROS047	V047	Zam-Zam Beverages Halal	Halal Rose Syrup	Beverages	JAKIM halal certified rose syrup concentrate, 2L bottle	https://picsum.photos/seed/vp-ros047/80/80	18	{"orderUnit":"Bottle","orderQty":1,"packUnit":"Ltr","packQty":2,"unitUnit":"Ltr","unitQty":1}	halal	f	[]	t	2026-07-09 19:28:21.986825+00
VP-SAL001	V005	Ocean Fresh Seafood	Atlantic Salmon Fillet	Seafood	Skin-on fillet, sustainably farmed, chilled	https://picsum.photos/seed/vp-sal001/80/80	88	{"orderUnit":"Kg","orderQty":1,"packUnit":"Kg","packQty":1,"unitUnit":"Kg","unitQty":1}		f	[]	t	2026-07-09 19:28:21.986077+00
VP-SAM051	V051	Darul Ehsan Halal Pantry	Halal Sambal Paste	Dry Goods	JAKIM halal certified chili sambal paste, 1kg tub	https://picsum.photos/seed/vp-sam051/80/80	18	{"orderUnit":"Tub","orderQty":1,"packUnit":"Kg","packQty":1,"unitUnit":"Kg","unitQty":1}	halal	f	[]	t	2026-07-09 19:28:21.986943+00
VP-SAT044	V044	Kurnia Poultry Halal	Halal Chicken Satay Cubes	Proteins	JAKIM halal certified marinated satay cubes, 1kg pack	https://picsum.photos/seed/vp-sat044/80/80	22	{"orderUnit":"Pack","orderQty":1,"packUnit":"Kg","packQty":1,"unitUnit":"Kg","unitQty":1}	halal	f	[]	t	2026-07-09 19:28:21.986749+00
VP-SLM043	V043	Seri Mutiara Halal Seafood	Halal Salmon Fillet	Seafood	JAKIM halal certified Atlantic salmon, skin-on fillet, chilled	https://picsum.photos/seed/vp-slm043/80/80	58	{"orderUnit":"Kg","orderQty":1,"packUnit":"Kg","packQty":1,"unitUnit":"Kg","unitQty":1}	halal	f	[]	t	2026-07-09 19:28:21.986709+00
VP-SLT016	V016	Spice Route Trading	Sea Salt Flakes	Dry Goods	Maldon style flakes, 1kg tub	https://picsum.photos/seed/vp-slt016/80/80	12	{"orderUnit":"Kg","orderQty":1,"packUnit":"Kg","packQty":1,"unitUnit":"Kg","unitQty":1}		f	[]	t	2026-07-09 19:28:21.986227+00
VP-SPG019	V019	Noodle House Supply	Spaghetti	Dry Goods	Durum wheat spaghetti, 5kg case	https://picsum.photos/seed/vp-spg019/80/80	30	{"orderUnit":"Case","orderQty":1,"packUnit":"Kg","packQty":5,"unitUnit":"Kg","unitQty":1}		f	[]	t	2026-07-09 19:28:21.986309+00
VP-SPI001	V004	Wine & Spirits Direct	Gin London Dry	Beverages	London dry gin, 1L bottle, 40% ABV	https://picsum.photos/seed/vp-spi001/80/80	62	{"orderUnit":"Bottle","orderQty":1,"packUnit":"Ltr","packQty":1,"unitUnit":"Ltr","unitQty":1}		f	[]	t	2026-07-09 19:28:21.986033+00
VP-SPK031	V031	Bottled Water Works	Sparkling Mineral Water	Beverages	750ml glass, 12-pack	https://picsum.photos/seed/vp-spk031/80/80	42	{"orderUnit":"Case","orderQty":1,"packUnit":"Bottle","packQty":12,"unitUnit":"Ml","unitQty":750}		f	[]	t	2026-07-09 19:28:21.986619+00
VP-SPN045	V045	Hijrah Fresh Produce Halal	Halal Baby Spinach	Produce	Washed baby spinach, halal handling certified, 500g bag	https://picsum.photos/seed/vp-spn045/80/80	11	{"orderUnit":"Bag","orderQty":1,"packUnit":"Gr","packQty":500,"unitUnit":"Gr","unitQty":1}	halal	f	[]	t	2026-07-09 19:28:21.986758+00
VP-SQD043	V043	Seri Mutiara Halal Seafood	Halal Squid Tubes	Seafood	JAKIM halal certified cleaned squid tubes, IQF frozen	https://picsum.photos/seed/vp-sqd043/80/80	36	{"orderUnit":"Kg","orderQty":1,"packUnit":"Kg","packQty":1,"unitUnit":"Kg","unitQty":1}	halal	f	[]	t	2026-07-09 19:28:21.986725+00
VP-SRP050	V050	Nusantara Halal Frozen Foods	Halal Spring Roll Pastry	Dry Goods	JAKIM halal certified pastry sheets, 50-piece pack	https://picsum.photos/seed/vp-srp050/80/80	22	{"orderUnit":"Pack","orderQty":1,"packUnit":"Each","packQty":50,"unitUnit":"Each","unitQty":1}	halal	f	[]	t	2026-07-09 19:28:21.986911+00
VP-STL031	V031	Bottled Water Works	Still Spring Water	Beverages	500ml bottles, 24-pack	https://picsum.photos/seed/vp-stl031/80/80	18	{"orderUnit":"Case","orderQty":1,"packUnit":"Bottle","packQty":24,"unitUnit":"Ml","unitQty":500}		f	[]	t	2026-07-09 19:28:21.986611+00
VP-STO022	V022	Craft Brew Alliance	Oatmeal Stout	Beverages	5.5% ABV, 20L keg	https://picsum.photos/seed/vp-sto022/80/80	165	{"orderUnit":"Keg","orderQty":1,"packUnit":"Ltr","packQty":20,"unitUnit":"Ltr","unitQty":1}		f	[]	t	2026-07-09 19:28:21.986399+00
VP-SUG029	V029	Bakery Ingredients MY	Caster Sugar	Dry Goods	Fine caster, 25kg bag	https://picsum.photos/seed/vp-sug029/80/80	42	{"orderUnit":"Bag","orderQty":1,"packUnit":"Kg","packQty":25,"unitUnit":"Kg","unitQty":1}		f	[]	t	2026-07-09 19:28:21.986579+00
VP-SUN015	V015	Mediterranean Oil Co.	Sunflower Oil	Dry Goods	Refined frying oil, 20L jerrycan	https://picsum.photos/seed/vp-sun015/80/80	95	{"orderUnit":"Jerrycan","orderQty":1,"packUnit":"Ltr","packQty":20,"unitUnit":"Ltr","unitQty":1}		f	[]	t	2026-07-09 19:28:21.986219+00
VP-TOM027	V027	Organic Veg Hub	Roma Tomatoes	Produce	Organic roma, 5kg crate	https://picsum.photos/seed/vp-tom027/80/80	28	{"orderUnit":"Crate","orderQty":1,"packUnit":"Kg","packQty":5,"unitUnit":"Kg","unitQty":1}		f	[]	t	2026-07-09 19:28:21.986504+00
VP-TOM045	V045	Hijrah Fresh Produce Halal	Halal Cherry Tomatoes	Produce	Vine cherry tomatoes, halal handling, 2kg punnet tray	https://picsum.photos/seed/vp-tom045/80/80	24	{"orderUnit":"Tray","orderQty":1,"packUnit":"Kg","packQty":2,"unitUnit":"Kg","unitQty":1}	halal	f	[]	t	2026-07-09 19:28:21.986777+00
VP-TON024	V024	Syrup & Mixers Ltd	Tonic Water	Beverages	Premium tonic, 24x200ml case	https://picsum.photos/seed/vp-ton024/80/80	52	{"orderUnit":"Case","orderQty":1,"packUnit":"Bottle","packQty":24,"unitUnit":"Ml","unitQty":200}		f	[]	t	2026-07-09 19:28:21.986429+00
VP-TRU001	V002	Fine Truffle Imports	Black Truffle	Produce	Fresh Périgord black truffle, brushed, refrigerated	https://picsum.photos/seed/vp-tru001/80/80	180	{"orderUnit":"Gr","orderQty":100,"packUnit":"Gr","packQty":1,"unitUnit":"Gr","unitQty":1}		f	[]	t	2026-07-09 19:28:21.985982+00
VP-TUN013	V013	Harbour Fish Market	Bluefin Tuna Loin	Seafood	Sashimi grade loin, deep frozen	https://picsum.photos/seed/vp-tun013/80/80	135	{"orderUnit":"Kg","orderQty":1,"packUnit":"Kg","packQty":1,"unitUnit":"Kg","unitQty":1}		f	[]	t	2026-07-09 19:28:21.986168+00
VP-TUR048	V048	Hikmah Spice House	Halal Turmeric Powder	Dry Goods	JAKIM halal certified ground turmeric, 1kg pouch	https://picsum.photos/seed/vp-tur048/80/80	16	{"orderUnit":"Pouch","orderQty":1,"packUnit":"Kg","packQty":1,"unitUnit":"Kg","unitQty":1}	halal	f	[]	t	2026-07-09 19:28:21.986844+00
VP-UDN019	V019	Noodle House Supply	Fresh Udon Noodles	Dry Goods	Frozen udon blocks, 24-pack	https://picsum.photos/seed/vp-udn019/80/80	48	{"orderUnit":"Box","orderQty":1,"packUnit":"Each","packQty":24,"unitUnit":"Each","unitQty":1}		f	[]	t	2026-07-09 19:28:21.986318+00
VP-VAN049	V049	Raudhah Bakery Supplies Halal	Halal Vanilla Extract	Dry Goods	JAKIM halal certified pure vanilla extract, 500ml	https://picsum.photos/seed/vp-van049/80/80	38	{"orderUnit":"Bottle","orderQty":1,"packUnit":"Ml","packQty":500,"unitUnit":"Ml","unitQty":1}	halal	f	[]	t	2026-07-09 19:28:21.986892+00
VP-WAG001	V001	Premium Meats Co.	Wagyu Beef A5	Proteins	A5 grade wagyu, marbling score 8+, chilled	https://picsum.photos/seed/vp-wag001/80/80	380	{"orderUnit":"Kg","orderQty":1,"packUnit":"Kg","packQty":1,"unitUnit":"Kg","unitQty":1}		f	[]	t	2026-07-09 19:28:21.975463+00
VP-WAG026	V026	Butcher Block Prime	Wagyu Striploin	Proteins	MB4+ striploin, chilled	https://picsum.photos/seed/vp-wag026/80/80	295	{"orderUnit":"Kg","orderQty":1,"packUnit":"Kg","packQty":1,"unitUnit":"Kg","unitQty":1}		f	[]	t	2026-07-09 19:28:21.986495+00
VP-WCH012	V012	Pacific Poultry Supply	Whole Free-range Chicken	Proteins	1.4–1.6kg birds, halal certified	https://picsum.photos/seed/vp-wch012/80/80	28	{"orderUnit":"Kg","orderQty":10,"packUnit":"Kg","packQty":1,"unitUnit":"Kg","unitQty":1}		f	[]	t	2026-07-09 19:28:21.98614+00
VP-WCH044	V044	Kurnia Poultry Halal	Halal Whole Chicken	Proteins	JAKIM halal certified 1.5–1.7kg birds, chilled	https://picsum.photos/seed/vp-wch044/80/80	26	{"orderUnit":"Kg","orderQty":10,"packUnit":"Kg","packQty":1,"unitUnit":"Kg","unitQty":1}	halal	f	[]	t	2026-07-09 19:28:21.986733+00
VP-WIN001	V004	Wine & Spirits Direct	Merlot Reserve 2019	Beverages	750ml bottle, 13.5% ABV, cork finish	https://picsum.photos/seed/vp-win001/80/80	95	{"orderUnit":"Bottle","orderQty":1,"packUnit":"Ml","packQty":750,"unitUnit":"Ml","unitQty":1}		f	[]	t	2026-07-09 19:28:21.986012+00
VP-WIN002	V004	Wine & Spirits Direct	Prosecco DOC (case)	Beverages	DOC Prosecco, 330ml bottles, 11% ABV	https://picsum.photos/seed/vp-win002/80/80	720	{"orderUnit":"Box","orderQty":1,"packUnit":"Bottle","packQty":24,"unitUnit":"Ml","unitQty":330}		f	[]	t	2026-07-09 19:28:21.986022+00
VP-YGT046	V046	Al-Noor Halal Dairy	Halal Greek Yogurt	Dairy	JAKIM halal certified plain Greek yogurt, 5kg tub	https://picsum.photos/seed/vp-ygt046/80/80	42	{"orderUnit":"Tub","orderQty":1,"packUnit":"Kg","packQty":5,"unitUnit":"Kg","unitQty":1}	halal	f	[]	t	2026-07-09 19:28:21.986806+00
VP-YST029	V029	Bakery Ingredients MY	Instant Dry Yeast	Dry Goods	500g vacuum pack	https://picsum.photos/seed/vp-yst029/80/80	14	{"orderUnit":"Pack","orderQty":1,"packUnit":"Gr","packQty":500,"unitUnit":"Gr","unitQty":1}		f	[]	t	2026-07-09 19:28:21.986571+00
VP-032FERN001	V032	Malaysian Yogurt Company	Fernleaf Yogurt Strawberry	Dairy		https://picsum.photos/seed/vp-032fern001/80/80	42	{"orderUnit":"Box","orderQty":1,"packUnit":"Each","packQty":16,"unitUnit":"Gr","unitQty":110}		f	[]	t	2026-07-10 06:34:02.139125+00
VP-032FERN002	V032	Malaysian Yogurt Company	Fernleaf Yogurt Mixed Berry	Dairy		https://picsum.photos/seed/vp-032fern002/80/80	45	{"orderUnit":"Box","orderQty":1,"packUnit":"Each","packQty":16,"unitUnit":"Gr","unitQty":110}		f	[]	t	2026-07-10 06:34:02.237574+00
VP-032FERN003	V032	Malaysian Yogurt Company	Fernleaf Yogurt Strawberry	Dairy		https://picsum.photos/seed/vp-032fern003/80/80	42	{"orderUnit":"Box","orderQty":1,"packUnit":"Each","packQty":16,"unitUnit":"Gr","unitQty":110}		f	[]	t	2026-07-10 06:34:02.300128+00
VP-032FERN004	V032	Malaysian Yogurt Company	Fernleaf Yogurt Mixed Berry	Dairy		https://picsum.photos/seed/vp-032fern004/80/80	45	{"orderUnit":"Box","orderQty":1,"packUnit":"Each","packQty":16,"unitUnit":"Gr","unitQty":110}		f	[]	t	2026-07-10 06:34:02.367438+00
\.


--
-- Data for Name: Vendors; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public."Vendors" ("Id", "ExternalId", "Name", "Type", "Brn", "Products", "City", "State", "ContactPerson", "ContactPosition", "Mobile", "Email", "Address", "ContactsJson", "Engaged", "ProductPolicyTag") FROM stdin;
1	V001	Premium Meats Co.	offline	202001012345	Proteins, Poultry	Kuala Lumpur	WP	Ahmad Razali		+60 12-345 6789	sales@premiummeats.my	12 Jalan Semarak, KL 50450	[]	t	halal
2	V002	Fine Truffle Imports	offline	201801056789	Truffles, Specialty	Petaling Jaya	Selangor	Jean-Luc Prive		+60 16-778 9900	jl@truffleimports.com	88 Jalan PJ 14, PJ 47810	[]	t	halal
4	V005	Ocean Fresh Seafood	offline	201701023456	Seafood, Fresh Fish	Port Klang	Selangor	Haji Sulaiman	Sales Manager	+60 13-456 7890	fresh@oceanfish.my	Lot 22, Jln Pelabuhan, Port Klang	[{"Name":"Haji Sulaiman","Position":"Sales Manager","Mobile":"\\u002B60 13-456 7890","Email":"fresh@oceanfish.my","IsDefault":true}]	t	halal
5	V003	Artisan Dairy Co.	offline	201601034321	Dairy, Cheese	Kuala Lumpur	WP	Sofia Lim	Sales Executive	+60 18-901 2233	orders@artisandairy.my	45 Jalan Tun Razak, KL 50400	[{"Name":"Sofia Lim","Position":"Sales Executive","Mobile":"\\u002B60 18-901 2233","Email":"orders@artisandairy.my","IsDefault":true}]	t	halal
6	V006	Green Valley Produce	online	202001067890	Produce, Fresh Vegetables	Cameron Highlands	Pahang	Lee Wei Jie	Account Manager	+60 12-778 3344	sales@greenvalley.my	Online — Nationwide Delivery	[{"name":"Lee Wei Jie","position":"Account Manager","mobile":"\\u002B60 12-778 3344","email":"sales@greenvalley.my","isDefault":true}]	t	halal
7	V007	Heritage Pantry Supply	offline	201901078901	Dry Goods, Canned Goods	Shah Alam	Selangor	Ravi Kumar	Sales Manager	+60 17-234 5678	sales@heritagepantry.my	Lot 8, Jalan Stesen 19/7, Shah Alam 40300	[{"Name":"Ravi Kumar","Position":"Sales Manager","Mobile":"\\u002B60 17-234 5678","Email":"sales@heritagepantry.my","IsDefault":true}]	t	halal
8	V010	Bean Brothers Roasters	offline	202101011234	Coffee, Beverages	Petaling Jaya	Selangor	Marcus Tan	Sales Manager	+60 16-445 6677	wholesale@beanbrothers.my	22 Jalan SS15, PJ 47500	[]	f	halal
9	V011	Metro Canned Foods	offline	201801045678	Dry Goods, Canned Goods	Kuala Lumpur	WP	Nurul Izzati	Account Manager	+60 12-556 7890	orders@metrocanned.my	56 Jalan Ipoh, KL 51200	[{"name":"Nurul Izzati","position":"Account Manager","mobile":"\\u002B60 12-556 7890","email":"orders@metrocanned.my","isDefault":true}]	t	halal
10	V012	Pacific Poultry Supply	offline	201501012345	Poultry, Duck	Kajang	Selangor	Tan Mei Ling	Sales Manager	+60 12-111 2233	sales@pacificpoultry.my	Lot 5, Jalan Mewah, Kajang 43000	[]	f	halal
11	V013	Harbour Fish Market	offline	201601023456	Seafood, Fresh Fish	Port Klang	Selangor	Captain Wong	Account Manager	+60 16-222 3344	orders@harbourfish.my	Pasar Besar, Port Klang 42000	[]	f	halal
12	V014	Valley Dairy Wholesale	offline	201701034567	Dairy, Cream, Butter	Seremban	Negeri Sembilan	Priya Nair	Sales Executive	+60 17-333 4455	wholesale@valleydairy.my	12 Jalan Dairy, Seremban 70000	[]	f	halal
13	V015	Mediterranean Oil Co.	offline	201801045678	Oils, Vinegars	Kuala Lumpur	WP	Marco Rossi	Sales Manager	+60 18-444 5566	marco@medoil.my	88 Jalan Ampang, KL 50450	[]	f	halal
14	V016	Spice Route Trading	offline	201901056789	Spices, Seasonings	Melaka	Melaka	Aisha Rahman	Account Manager	+60 19-555 6677	aisha@spiceroute.my	45 Jalan Hang Tuah, Melaka 75300	[]	f	halal
15	V017	Fresh Herb Gardens	online	202001067890	Herbs, Salad Leaves	Cameron Highlands	Pahang	David Choong	Sales Executive	+60 12-666 7788	orders@freshherb.my	Online — Nationwide Delivery	[]	f	halal
16	V018	Grain & Mill Co.	offline	202101078901	Rice, Flour, Grains	Shah Alam	Selangor	Hassan Ibrahim	Sales Manager	+60 13-777 8899	sales@grainmill.my	Lot 3, Jalan Bukit Raja, Shah Alam 40000	[]	f	halal
17	V019	Noodle House Supply	offline	202201089012	Pasta, Noodles	Petaling Jaya	Selangor	Lily Tan	Account Manager	+60 14-888 9900	lily@noodlehouse.my	18 Jalan SS2, PJ 47300	[]	f	halal
18	V020	Frozen Foods Express	offline	202301090123	Frozen Vegetables, Fries	Subang Jaya	Selangor	Kevin Lim	Sales Executive	+60 15-999 0011	kevin@frozenexpress.my	7 Jalan SS15, Subang 47500	[]	f	halal
19	V021	Juice Factory Direct	offline	202401101234	Juices, Purees	Kuala Lumpur	WP	Siti Aminah	Sales Manager	+60 16-101 1122	orders@juicefactory.my	22 Jalan Tun Razak, KL 50400	[]	f	halal
21	V023	Tea & Tisane Co.	online	202601123456	Tea, Herbal Infusions	Ipoh	Perak	Mei Lin	Sales Executive	+60 18-303 3344	sales@teatisane.my	Online — Nationwide Delivery	[]	f	halal
22	V024	Syrup & Mixers Ltd	offline	202701134567	Syrups, Mixers, Tonic	Kuala Lumpur	WP	Raj Patel	Sales Manager	+60 19-404 4455	raj@syrupmixers.my	33 Jalan Bukit Bintang, KL 55100	[]	f	halal
23	V025	Plant Milk Wholesale	offline	202801145678	Oat Milk, Plant Milks	Shah Alam	Selangor	Emma Walsh	Account Manager	+60 12-505 5566	emma@plantmilk.my	9 Jalan Plumbum, Shah Alam 40300	[]	f	halal
25	V027	Organic Veg Hub	online	203001167890	Organic Produce	Cameron Highlands	Pahang	Nadia Yusof	Sales Executive	+60 14-707 7788	nadia@organicveg.my	Online — Nationwide Delivery	[]	f	halal
26	V028	Condiment Central	offline	203101178901	Sauces, Passata, Condiments	Klang	Selangor	Vikram Singh	Account Manager	+60 15-808 8899	vikram@condiment.my	Lot 12, Jalan Kapar, Klang 41000	[]	f	halal
27	V029	Bakery Ingredients MY	offline	203201189012	Flour, Yeast, Baking	Kuala Lumpur	WP	Christine Lee	Sales Manager	+60 16-909 9900	christine@bakerying.my	44 Jalan Sultan, KL 50000	[]	f	halal
28	V030	Imported Cheese Cellar	offline	203301190123	Cheese, Dairy Speciality	Petaling Jaya	Selangor	Giuseppe Conti	Account Manager	+60 17-010 1011	giuseppe@cheesecellar.my	66 Jalan SS21, PJ 47400	[]	f	halal
29	V031	Bottled Water Works	offline	203401201234	Still Water, Sparkling	Rawang	Selangor	Azman Hakim	Sales Executive	+60 18-121 2122	azman@waterworks.my	Lot 8, Jalan Industri, Rawang 48000	[]	f	halal
30	VZZ999	API Probe Vendor	offline										[{"name":"","position":"","mobile":"","email":"","isDefault":true}]	f	halal
31	V032	Malaysian Yogurt Company	offline	0928310-951	Dairy, Juice	Kuala Lumpur	WP	dra	sales	01262353503	dra@test.com	2 jalan wan kadir, 60000	[{"name":"dra","position":"sales","mobile":"01262353503","email":"dra@test.com","isDefault":true}]	t	halal
32	V042	Barakah Halal Meats	offline	203501212345	Halal Beef, Lamb, Poultry	Shah Alam	Selangor	Farid Zulkifli	Sales Manager	+60 12-301 4455	orders@barakahhalal.my	Lot 14, Jalan Utama, Shah Alam 40150	[]	t	halal
33	V043	Seri Mutiara Halal Seafood	offline	203601223456	Halal Fish, Prawns, Squid	Kuala Terengganu	Terengganu	Wan Aisyah	Account Manager	+60 13-402 5566	sales@serimutiara.my	Pasar Besar Tok Bali, KT 20400	[]	t	halal
34	V044	Kurnia Poultry Halal	offline	203701234567	Halal Chicken, Marinated Poultry	Kajang	Selangor	Hafiz Rahman	Sales Executive	+60 14-503 6677	wholesale@kurniapoultry.my	Lot 9, Jalan Reko, Kajang 43000	[]	f	halal
35	V045	Hijrah Fresh Produce Halal	online	203801245678	Halal Fresh Vegetables, Salad	Cameron Highlands	Pahang	Nur Hidayah	Sales Manager	+60 15-604 7788	orders@hijrahproduce.my	Online — Nationwide Delivery	[]	t	halal
36	V046	Al-Noor Halal Dairy	offline	203901256789	Halal Milk, Cheese, Yogurt	Seremban	Negeri Sembilan	Zainab Osman	Account Manager	+60 16-705 8899	sales@alnoordairy.my	22 Jalan Dairy, Seremban 70400	[]	f	halal
37	V047	Zam-Zam Beverages Halal	offline	204001267890	Halal Juices, Syrups, Soft Drinks	Kuala Lumpur	WP	Amir Hamzah	Sales Manager	+60 17-806 9900	orders@zamzambeverages.my	88 Jalan Tun Razak, KL 50400	[]	t	halal
38	V048	Hikmah Spice House	offline	204101278901	Halal Spices, Pastes, Seasonings	Melaka	Melaka	Salmah Idris	Sales Executive	+60 18-907 1011	sales@hikmahspice.my	12 Jalan Hang Jebat, Melaka 75200	[]	f	halal
39	V049	Raudhah Bakery Supplies Halal	offline	204201289012	Halal Flour, Yeast, Baking	Petaling Jaya	Selangor	Aminah Lee	Account Manager	+60 19-108 2122	orders@raudhahbakery.my	33 Jalan SS2, PJ 47300	[]	t	halal
40	V050	Nusantara Halal Frozen Foods	offline	204301290123	Halal Frozen Paratha, Pastry, Fish	Subang Jaya	Selangor	Rizal Hakimi	Sales Manager	+60 12-209 3233	frozen@nusantarahalal.my	5 Jalan SS16, Subang 47500	[]	f	halal
41	V051	Darul Ehsan Halal Pantry	offline	204401301234	Halal Coconut Milk, Sauces, Noodles	Shah Alam	Selangor	Kamaluddin Ali	Sales Executive	+60 13-310 4344	pantry@darulehsan.my	Lot 6, Jalan Plumbum, Shah Alam 40300	[]	t	halal
3	V004	Wine & Spirits Direct	online	202201034567	Wine, Spirits, Beer	Kuala Lumpur	WP	Melissa Tan		+60 19-887 6543	melissa@winedirect.my	Online — Nationwide Delivery	[]	t	non-halal
20	V022	Craft Brew Alliance	offline	202501112345	Craft Beer, Kegs	Petaling Jaya	Selangor	Jake Morrison	Account Manager	+60 17-202 2233	jake@craftbrew.my	5 Jalan Gasing, PJ 46000	[]	f	non-halal
24	V026	Butcher Block Prime	offline	202901156789	Lamb, Pork, Premium Meats	Kuala Lumpur	WP	Frankie Ho	Sales Manager	+60 13-606 6677	frankie@butcherblock.my	101 Jalan Maarof, KL 59000	[]	f	non-halal
42	V052	DRa Trading SB	offline					D Ra		0126233503	dra@test.com		[]	f	non-halal
\.


--
-- Name: AppUsers_Id_seq; Type: SEQUENCE SET; Schema: public; Owner: -
--

SELECT pg_catalog.setval('public."AppUsers_Id_seq"', 35, true);


--
-- Name: AttendanceRecords_Id_seq; Type: SEQUENCE SET; Schema: public; Owner: -
--

SELECT pg_catalog.setval('public."AttendanceRecords_Id_seq"', 1, false);


--
-- Name: B2bCustomers_Id_seq; Type: SEQUENCE SET; Schema: public; Owner: -
--

SELECT pg_catalog.setval('public."B2bCustomers_Id_seq"', 4, true);


--
-- Name: B2bSalesOrderLines_Id_seq; Type: SEQUENCE SET; Schema: public; Owner: -
--

SELECT pg_catalog.setval('public."B2bSalesOrderLines_Id_seq"', 4, true);


--
-- Name: B2bSalesOrders_Id_seq; Type: SEQUENCE SET; Schema: public; Owner: -
--

SELECT pg_catalog.setval('public."B2bSalesOrders_Id_seq"', 4, true);


--
-- Name: CashPurchases_Id_seq; Type: SEQUENCE SET; Schema: public; Owner: -
--

SELECT pg_catalog.setval('public."CashPurchases_Id_seq"', 2, true);


--
-- Name: Companies_Id_seq; Type: SEQUENCE SET; Schema: public; Owner: -
--

SELECT pg_catalog.setval('public."Companies_Id_seq"', 5, true);


--
-- Name: CompanySettings_Id_seq; Type: SEQUENCE SET; Schema: public; Owner: -
--

SELECT pg_catalog.setval('public."CompanySettings_Id_seq"', 1, false);


--
-- Name: Departments_Id_seq; Type: SEQUENCE SET; Schema: public; Owner: -
--

SELECT pg_catalog.setval('public."Departments_Id_seq"', 1, false);


--
-- Name: DevelopmentMilestones_Id_seq; Type: SEQUENCE SET; Schema: public; Owner: -
--

SELECT pg_catalog.setval('public."DevelopmentMilestones_Id_seq"', 1, false);


--
-- Name: Divisions_Id_seq; Type: SEQUENCE SET; Schema: public; Owner: -
--

SELECT pg_catalog.setval('public."Divisions_Id_seq"', 1, false);


--
-- Name: EducationRecords_Id_seq; Type: SEQUENCE SET; Schema: public; Owner: -
--

SELECT pg_catalog.setval('public."EducationRecords_Id_seq"', 1, false);


--
-- Name: EmployeeLevels_Id_seq; Type: SEQUENCE SET; Schema: public; Owner: -
--

SELECT pg_catalog.setval('public."EmployeeLevels_Id_seq"', 1, false);


--
-- Name: EmployeeMovements_Id_seq; Type: SEQUENCE SET; Schema: public; Owner: -
--

SELECT pg_catalog.setval('public."EmployeeMovements_Id_seq"', 1, false);


--
-- Name: Employees_Id_seq; Type: SEQUENCE SET; Schema: public; Owner: -
--

SELECT pg_catalog.setval('public."Employees_Id_seq"', 1, false);


--
-- Name: IncomeTaxBrackets_Id_seq; Type: SEQUENCE SET; Schema: public; Owner: -
--

SELECT pg_catalog.setval('public."IncomeTaxBrackets_Id_seq"', 1, false);


--
-- Name: IncomeTaxRebates_Id_seq; Type: SEQUENCE SET; Schema: public; Owner: -
--

SELECT pg_catalog.setval('public."IncomeTaxRebates_Id_seq"', 1, false);


--
-- Name: IncomeTaxReliefs_Id_seq; Type: SEQUENCE SET; Schema: public; Owner: -
--

SELECT pg_catalog.setval('public."IncomeTaxReliefs_Id_seq"', 1, false);


--
-- Name: IncomeTaxYears_Id_seq; Type: SEQUENCE SET; Schema: public; Owner: -
--

SELECT pg_catalog.setval('public."IncomeTaxYears_Id_seq"', 1, false);


--
-- Name: Ingredients_Id_seq; Type: SEQUENCE SET; Schema: public; Owner: -
--

SELECT pg_catalog.setval('public."Ingredients_Id_seq"', 216, true);


--
-- Name: InventoryAlerts_Id_seq; Type: SEQUENCE SET; Schema: public; Owner: -
--

SELECT pg_catalog.setval('public."InventoryAlerts_Id_seq"', 1, false);


--
-- Name: InventoryCountSessionLines_Id_seq; Type: SEQUENCE SET; Schema: public; Owner: -
--

SELECT pg_catalog.setval('public."InventoryCountSessionLines_Id_seq"', 1, false);


--
-- Name: InventoryCountSessions_Id_seq; Type: SEQUENCE SET; Schema: public; Owner: -
--

SELECT pg_catalog.setval('public."InventoryCountSessions_Id_seq"', 1, false);


--
-- Name: InventoryMovements_Id_seq; Type: SEQUENCE SET; Schema: public; Owner: -
--

SELECT pg_catalog.setval('public."InventoryMovements_Id_seq"', 1, false);


--
-- Name: InventoryPurchases_Id_seq; Type: SEQUENCE SET; Schema: public; Owner: -
--

SELECT pg_catalog.setval('public."InventoryPurchases_Id_seq"', 236, true);


--
-- Name: LeaveRequests_Id_seq; Type: SEQUENCE SET; Schema: public; Owner: -
--

SELECT pg_catalog.setval('public."LeaveRequests_Id_seq"', 1, false);


--
-- Name: Locations_Id_seq; Type: SEQUENCE SET; Schema: public; Owner: -
--

SELECT pg_catalog.setval('public."Locations_Id_seq"', 10, true);


--
-- Name: MandatoryContributions_Id_seq; Type: SEQUENCE SET; Schema: public; Owner: -
--

SELECT pg_catalog.setval('public."MandatoryContributions_Id_seq"', 1, false);


--
-- Name: MenuItems_Id_seq; Type: SEQUENCE SET; Schema: public; Owner: -
--

SELECT pg_catalog.setval('public."MenuItems_Id_seq"', 1, false);


--
-- Name: OrderTemplateItems_Id_seq; Type: SEQUENCE SET; Schema: public; Owner: -
--

SELECT pg_catalog.setval('public."OrderTemplateItems_Id_seq"', 4, true);


--
-- Name: OrderTemplates_Id_seq; Type: SEQUENCE SET; Schema: public; Owner: -
--

SELECT pg_catalog.setval('public."OrderTemplates_Id_seq"', 2, true);


--
-- Name: PayStructures_Id_seq; Type: SEQUENCE SET; Schema: public; Owner: -
--

SELECT pg_catalog.setval('public."PayStructures_Id_seq"', 1, false);


--
-- Name: PayrollRunLines_Id_seq; Type: SEQUENCE SET; Schema: public; Owner: -
--

SELECT pg_catalog.setval('public."PayrollRunLines_Id_seq"', 1, false);


--
-- Name: PayrollRuns_Id_seq; Type: SEQUENCE SET; Schema: public; Owner: -
--

SELECT pg_catalog.setval('public."PayrollRuns_Id_seq"', 1, false);


--
-- Name: PerformanceAppraisals_Id_seq; Type: SEQUENCE SET; Schema: public; Owner: -
--

SELECT pg_catalog.setval('public."PerformanceAppraisals_Id_seq"', 1, false);


--
-- Name: PosCustomers_Id_seq; Type: SEQUENCE SET; Schema: public; Owner: -
--

SELECT pg_catalog.setval('public."PosCustomers_Id_seq"', 2, true);


--
-- Name: PreviousEmployments_Id_seq; Type: SEQUENCE SET; Schema: public; Owner: -
--

SELECT pg_catalog.setval('public."PreviousEmployments_Id_seq"', 1, false);


--
-- Name: ProductAliases_Id_seq; Type: SEQUENCE SET; Schema: public; Owner: -
--

SELECT pg_catalog.setval('public."ProductAliases_Id_seq"', 1, true);


--
-- Name: ProductB2bLocationStocks_Id_seq; Type: SEQUENCE SET; Schema: public; Owner: -
--

SELECT pg_catalog.setval('public."ProductB2bLocationStocks_Id_seq"', 40, true);


--
-- Name: ProductComponentItems_Id_seq; Type: SEQUENCE SET; Schema: public; Owner: -
--

SELECT pg_catalog.setval('public."ProductComponentItems_Id_seq"', 48, true);


--
-- Name: ProductPackagingItems_Id_seq; Type: SEQUENCE SET; Schema: public; Owner: -
--

SELECT pg_catalog.setval('public."ProductPackagingItems_Id_seq"', 1, false);


--
-- Name: ProductProductionLogs_Id_seq; Type: SEQUENCE SET; Schema: public; Owner: -
--

SELECT pg_catalog.setval('public."ProductProductionLogs_Id_seq"', 44, true);


--
-- Name: Products_Id_seq; Type: SEQUENCE SET; Schema: public; Owner: -
--

SELECT pg_catalog.setval('public."Products_Id_seq"', 37, true);


--
-- Name: ProvidentFundBrackets_Id_seq; Type: SEQUENCE SET; Schema: public; Owner: -
--

SELECT pg_catalog.setval('public."ProvidentFundBrackets_Id_seq"', 1, false);


--
-- Name: PublicHolidays_Id_seq; Type: SEQUENCE SET; Schema: public; Owner: -
--

SELECT pg_catalog.setval('public."PublicHolidays_Id_seq"', 1, false);


--
-- Name: PurchaseOrderItems_Id_seq; Type: SEQUENCE SET; Schema: public; Owner: -
--

SELECT pg_catalog.setval('public."PurchaseOrderItems_Id_seq"', 28, true);


--
-- Name: PurchaseOrders_Id_seq; Type: SEQUENCE SET; Schema: public; Owner: -
--

SELECT pg_catalog.setval('public."PurchaseOrders_Id_seq"', 29, true);


--
-- Name: QuoteRequestLines_Id_seq; Type: SEQUENCE SET; Schema: public; Owner: -
--

SELECT pg_catalog.setval('public."QuoteRequestLines_Id_seq"', 3, true);


--
-- Name: QuoteRequestVendors_Id_seq; Type: SEQUENCE SET; Schema: public; Owner: -
--

SELECT pg_catalog.setval('public."QuoteRequestVendors_Id_seq"', 2, true);


--
-- Name: QuoteRequests_Id_seq; Type: SEQUENCE SET; Schema: public; Owner: -
--

SELECT pg_catalog.setval('public."QuoteRequests_Id_seq"', 1, true);


--
-- Name: RevMgmtCompanyConfigs_Id_seq; Type: SEQUENCE SET; Schema: public; Owner: -
--

SELECT pg_catalog.setval('public."RevMgmtCompanyConfigs_Id_seq"', 15, true);


--
-- Name: RevenueDataPoints_Id_seq; Type: SEQUENCE SET; Schema: public; Owner: -
--

SELECT pg_catalog.setval('public."RevenueDataPoints_Id_seq"', 1, false);


--
-- Name: ShiftSchedules_Id_seq; Type: SEQUENCE SET; Schema: public; Owner: -
--

SELECT pg_catalog.setval('public."ShiftSchedules_Id_seq"', 1, false);


--
-- Name: SocsoBrackets_Id_seq; Type: SEQUENCE SET; Schema: public; Owner: -
--

SELECT pg_catalog.setval('public."SocsoBrackets_Id_seq"', 1, false);


--
-- Name: UserNotifications_Id_seq; Type: SEQUENCE SET; Schema: public; Owner: -
--

SELECT pg_catalog.setval('public."UserNotifications_Id_seq"', 1, true);


--
-- Name: Vendors_Id_seq; Type: SEQUENCE SET; Schema: public; Owner: -
--

SELECT pg_catalog.setval('public."Vendors_Id_seq"', 42, true);


--
-- Name: AccessControlSettings PK_AccessControlSettings; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."AccessControlSettings"
    ADD CONSTRAINT "PK_AccessControlSettings" PRIMARY KEY ("Id");


--
-- Name: AppUsers PK_AppUsers; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."AppUsers"
    ADD CONSTRAINT "PK_AppUsers" PRIMARY KEY ("Id");


--
-- Name: AttendanceRecords PK_AttendanceRecords; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."AttendanceRecords"
    ADD CONSTRAINT "PK_AttendanceRecords" PRIMARY KEY ("Id");


--
-- Name: B2bCustomers PK_B2bCustomers; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."B2bCustomers"
    ADD CONSTRAINT "PK_B2bCustomers" PRIMARY KEY ("Id");


--
-- Name: B2bSalesOrderLines PK_B2bSalesOrderLines; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."B2bSalesOrderLines"
    ADD CONSTRAINT "PK_B2bSalesOrderLines" PRIMARY KEY ("Id");


--
-- Name: B2bSalesOrders PK_B2bSalesOrders; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."B2bSalesOrders"
    ADD CONSTRAINT "PK_B2bSalesOrders" PRIMARY KEY ("Id");


--
-- Name: CashPurchases PK_CashPurchases; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."CashPurchases"
    ADD CONSTRAINT "PK_CashPurchases" PRIMARY KEY ("Id");


--
-- Name: Companies PK_Companies; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."Companies"
    ADD CONSTRAINT "PK_Companies" PRIMARY KEY ("Id");


--
-- Name: CompanySettings PK_CompanySettings; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."CompanySettings"
    ADD CONSTRAINT "PK_CompanySettings" PRIMARY KEY ("Id");


--
-- Name: Departments PK_Departments; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."Departments"
    ADD CONSTRAINT "PK_Departments" PRIMARY KEY ("Id");


--
-- Name: DevelopmentMilestones PK_DevelopmentMilestones; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."DevelopmentMilestones"
    ADD CONSTRAINT "PK_DevelopmentMilestones" PRIMARY KEY ("Id");


--
-- Name: Divisions PK_Divisions; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."Divisions"
    ADD CONSTRAINT "PK_Divisions" PRIMARY KEY ("Id");


--
-- Name: EducationRecords PK_EducationRecords; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."EducationRecords"
    ADD CONSTRAINT "PK_EducationRecords" PRIMARY KEY ("Id");


--
-- Name: EmployeeLevels PK_EmployeeLevels; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."EmployeeLevels"
    ADD CONSTRAINT "PK_EmployeeLevels" PRIMARY KEY ("Id");


--
-- Name: EmployeeMovements PK_EmployeeMovements; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."EmployeeMovements"
    ADD CONSTRAINT "PK_EmployeeMovements" PRIMARY KEY ("Id");


--
-- Name: Employees PK_Employees; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."Employees"
    ADD CONSTRAINT "PK_Employees" PRIMARY KEY ("Id");


--
-- Name: IncomeTaxBrackets PK_IncomeTaxBrackets; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."IncomeTaxBrackets"
    ADD CONSTRAINT "PK_IncomeTaxBrackets" PRIMARY KEY ("Id");


--
-- Name: IncomeTaxRebates PK_IncomeTaxRebates; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."IncomeTaxRebates"
    ADD CONSTRAINT "PK_IncomeTaxRebates" PRIMARY KEY ("Id");


--
-- Name: IncomeTaxReliefs PK_IncomeTaxReliefs; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."IncomeTaxReliefs"
    ADD CONSTRAINT "PK_IncomeTaxReliefs" PRIMARY KEY ("Id");


--
-- Name: IncomeTaxYears PK_IncomeTaxYears; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."IncomeTaxYears"
    ADD CONSTRAINT "PK_IncomeTaxYears" PRIMARY KEY ("Id");


--
-- Name: Ingredients PK_Ingredients; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."Ingredients"
    ADD CONSTRAINT "PK_Ingredients" PRIMARY KEY ("Id");


--
-- Name: InventoryAlerts PK_InventoryAlerts; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."InventoryAlerts"
    ADD CONSTRAINT "PK_InventoryAlerts" PRIMARY KEY ("Id");


--
-- Name: InventoryCountSessionLines PK_InventoryCountSessionLines; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."InventoryCountSessionLines"
    ADD CONSTRAINT "PK_InventoryCountSessionLines" PRIMARY KEY ("Id");


--
-- Name: InventoryCountSessions PK_InventoryCountSessions; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."InventoryCountSessions"
    ADD CONSTRAINT "PK_InventoryCountSessions" PRIMARY KEY ("Id");


--
-- Name: InventoryMovements PK_InventoryMovements; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."InventoryMovements"
    ADD CONSTRAINT "PK_InventoryMovements" PRIMARY KEY ("Id");


--
-- Name: InventoryPurchases PK_InventoryPurchases; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."InventoryPurchases"
    ADD CONSTRAINT "PK_InventoryPurchases" PRIMARY KEY ("Id");


--
-- Name: LeaveBalances PK_LeaveBalances; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."LeaveBalances"
    ADD CONSTRAINT "PK_LeaveBalances" PRIMARY KEY ("EmployeeId");


--
-- Name: LeaveRequests PK_LeaveRequests; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."LeaveRequests"
    ADD CONSTRAINT "PK_LeaveRequests" PRIMARY KEY ("Id");


--
-- Name: Locations PK_Locations; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."Locations"
    ADD CONSTRAINT "PK_Locations" PRIMARY KEY ("Id");


--
-- Name: MandatoryContributions PK_MandatoryContributions; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."MandatoryContributions"
    ADD CONSTRAINT "PK_MandatoryContributions" PRIMARY KEY ("Id");


--
-- Name: MenuItems PK_MenuItems; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."MenuItems"
    ADD CONSTRAINT "PK_MenuItems" PRIMARY KEY ("Id");


--
-- Name: OrderTemplateItems PK_OrderTemplateItems; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."OrderTemplateItems"
    ADD CONSTRAINT "PK_OrderTemplateItems" PRIMARY KEY ("Id");


--
-- Name: OrderTemplates PK_OrderTemplates; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."OrderTemplates"
    ADD CONSTRAINT "PK_OrderTemplates" PRIMARY KEY ("Id");


--
-- Name: PayStructures PK_PayStructures; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."PayStructures"
    ADD CONSTRAINT "PK_PayStructures" PRIMARY KEY ("Id");


--
-- Name: PayrollRunLines PK_PayrollRunLines; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."PayrollRunLines"
    ADD CONSTRAINT "PK_PayrollRunLines" PRIMARY KEY ("Id");


--
-- Name: PayrollRuns PK_PayrollRuns; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."PayrollRuns"
    ADD CONSTRAINT "PK_PayrollRuns" PRIMARY KEY ("Id");


--
-- Name: PerformanceAppraisals PK_PerformanceAppraisals; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."PerformanceAppraisals"
    ADD CONSTRAINT "PK_PerformanceAppraisals" PRIMARY KEY ("Id");


--
-- Name: PosCustomers PK_PosCustomers; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."PosCustomers"
    ADD CONSTRAINT "PK_PosCustomers" PRIMARY KEY ("Id");


--
-- Name: PreviousEmployments PK_PreviousEmployments; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."PreviousEmployments"
    ADD CONSTRAINT "PK_PreviousEmployments" PRIMARY KEY ("Id");


--
-- Name: ProductAliases PK_ProductAliases; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."ProductAliases"
    ADD CONSTRAINT "PK_ProductAliases" PRIMARY KEY ("Id");


--
-- Name: ProductB2bLocationStocks PK_ProductB2bLocationStocks; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."ProductB2bLocationStocks"
    ADD CONSTRAINT "PK_ProductB2bLocationStocks" PRIMARY KEY ("Id");


--
-- Name: ProductComponentItems PK_ProductComponentItems; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."ProductComponentItems"
    ADD CONSTRAINT "PK_ProductComponentItems" PRIMARY KEY ("Id");


--
-- Name: ProductPackagingItems PK_ProductPackagingItems; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."ProductPackagingItems"
    ADD CONSTRAINT "PK_ProductPackagingItems" PRIMARY KEY ("Id");


--
-- Name: ProductProductionLogs PK_ProductProductionLogs; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."ProductProductionLogs"
    ADD CONSTRAINT "PK_ProductProductionLogs" PRIMARY KEY ("Id");


--
-- Name: Products PK_Products; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."Products"
    ADD CONSTRAINT "PK_Products" PRIMARY KEY ("Id");


--
-- Name: ProvidentFundBrackets PK_ProvidentFundBrackets; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."ProvidentFundBrackets"
    ADD CONSTRAINT "PK_ProvidentFundBrackets" PRIMARY KEY ("Id");


--
-- Name: PublicHolidays PK_PublicHolidays; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."PublicHolidays"
    ADD CONSTRAINT "PK_PublicHolidays" PRIMARY KEY ("Id");


--
-- Name: PurchaseOrderItems PK_PurchaseOrderItems; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."PurchaseOrderItems"
    ADD CONSTRAINT "PK_PurchaseOrderItems" PRIMARY KEY ("Id");


--
-- Name: PurchaseOrders PK_PurchaseOrders; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."PurchaseOrders"
    ADD CONSTRAINT "PK_PurchaseOrders" PRIMARY KEY ("Id");


--
-- Name: QuoteRequestLines PK_QuoteRequestLines; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."QuoteRequestLines"
    ADD CONSTRAINT "PK_QuoteRequestLines" PRIMARY KEY ("Id");


--
-- Name: QuoteRequestVendors PK_QuoteRequestVendors; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."QuoteRequestVendors"
    ADD CONSTRAINT "PK_QuoteRequestVendors" PRIMARY KEY ("Id");


--
-- Name: QuoteRequests PK_QuoteRequests; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."QuoteRequests"
    ADD CONSTRAINT "PK_QuoteRequests" PRIMARY KEY ("Id");


--
-- Name: RevMgmtCompanyConfigs PK_RevMgmtCompanyConfigs; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."RevMgmtCompanyConfigs"
    ADD CONSTRAINT "PK_RevMgmtCompanyConfigs" PRIMARY KEY ("Id");


--
-- Name: RevenueDataPoints PK_RevenueDataPoints; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."RevenueDataPoints"
    ADD CONSTRAINT "PK_RevenueDataPoints" PRIMARY KEY ("Id");


--
-- Name: ShiftSchedules PK_ShiftSchedules; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."ShiftSchedules"
    ADD CONSTRAINT "PK_ShiftSchedules" PRIMARY KEY ("Id");


--
-- Name: SocsoBrackets PK_SocsoBrackets; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."SocsoBrackets"
    ADD CONSTRAINT "PK_SocsoBrackets" PRIMARY KEY ("Id");


--
-- Name: UserNotifications PK_UserNotifications; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."UserNotifications"
    ADD CONSTRAINT "PK_UserNotifications" PRIMARY KEY ("Id");


--
-- Name: VendorProductPrices PK_VendorProductPrices; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."VendorProductPrices"
    ADD CONSTRAINT "PK_VendorProductPrices" PRIMARY KEY ("ExternalId");


--
-- Name: VendorProducts PK_VendorProducts; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."VendorProducts"
    ADD CONSTRAINT "PK_VendorProducts" PRIMARY KEY ("ExternalId");


--
-- Name: Vendors PK_Vendors; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."Vendors"
    ADD CONSTRAINT "PK_Vendors" PRIMARY KEY ("Id");


--
-- Name: IX_AppUsers_CompanyId; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "IX_AppUsers_CompanyId" ON public."AppUsers" USING btree ("CompanyId");


--
-- Name: IX_AppUsers_EmployeeId; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX "IX_AppUsers_EmployeeId" ON public."AppUsers" USING btree ("EmployeeId");


--
-- Name: IX_AttendanceRecords_EmployeeId_Date; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX "IX_AttendanceRecords_EmployeeId_Date" ON public."AttendanceRecords" USING btree ("EmployeeId", "Date");


--
-- Name: IX_B2bCustomers_CompanyId; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "IX_B2bCustomers_CompanyId" ON public."B2bCustomers" USING btree ("CompanyId");


--
-- Name: IX_B2bCustomers_ExternalId; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX "IX_B2bCustomers_ExternalId" ON public."B2bCustomers" USING btree ("ExternalId");


--
-- Name: IX_B2bSalesOrders_CompanyId_Status; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "IX_B2bSalesOrders_CompanyId_Status" ON public."B2bSalesOrders" USING btree ("CompanyId", "Status");


--
-- Name: IX_Departments_DivisionId_Name; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX "IX_Departments_DivisionId_Name" ON public."Departments" USING btree ("DivisionId", "Name");


--
-- Name: IX_Divisions_Name; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX "IX_Divisions_Name" ON public."Divisions" USING btree ("Name");


--
-- Name: IX_EducationRecords_EmployeeId; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "IX_EducationRecords_EmployeeId" ON public."EducationRecords" USING btree ("EmployeeId");


--
-- Name: IX_EmployeeLevels_LevelName; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX "IX_EmployeeLevels_LevelName" ON public."EmployeeLevels" USING btree ("LevelName");


--
-- Name: IX_EmployeeMovements_EmployeeId; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "IX_EmployeeMovements_EmployeeId" ON public."EmployeeMovements" USING btree ("EmployeeId");


--
-- Name: IX_Employees_DepartmentId; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "IX_Employees_DepartmentId" ON public."Employees" USING btree ("DepartmentId");


--
-- Name: IX_Employees_DivisionId; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "IX_Employees_DivisionId" ON public."Employees" USING btree ("DivisionId");


--
-- Name: IX_Employees_Email; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX "IX_Employees_Email" ON public."Employees" USING btree ("Email");


--
-- Name: IX_Employees_EmployeeCode; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX "IX_Employees_EmployeeCode" ON public."Employees" USING btree ("EmployeeCode");


--
-- Name: IX_Employees_EmployeeLevelId; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "IX_Employees_EmployeeLevelId" ON public."Employees" USING btree ("EmployeeLevelId");


--
-- Name: IX_Employees_ReportsToId; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "IX_Employees_ReportsToId" ON public."Employees" USING btree ("ReportsToId");


--
-- Name: IX_IncomeTaxBrackets_IncomeTaxYearId; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "IX_IncomeTaxBrackets_IncomeTaxYearId" ON public."IncomeTaxBrackets" USING btree ("IncomeTaxYearId");


--
-- Name: IX_IncomeTaxRebates_IncomeTaxYearId; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "IX_IncomeTaxRebates_IncomeTaxYearId" ON public."IncomeTaxRebates" USING btree ("IncomeTaxYearId");


--
-- Name: IX_IncomeTaxReliefs_IncomeTaxYearId; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "IX_IncomeTaxReliefs_IncomeTaxYearId" ON public."IncomeTaxReliefs" USING btree ("IncomeTaxYearId");


--
-- Name: IX_IncomeTaxYears_CompanyId_Year; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX "IX_IncomeTaxYears_CompanyId_Year" ON public."IncomeTaxYears" USING btree ("CompanyId", "Year");


--
-- Name: IX_Ingredients_ComponentId; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX "IX_Ingredients_ComponentId" ON public."Ingredients" USING btree ("ComponentId");


--
-- Name: IX_Ingredients_Name; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX "IX_Ingredients_Name" ON public."Ingredients" USING btree ("Name");


--
-- Name: IX_InventoryCountSessionLines_SessionId; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "IX_InventoryCountSessionLines_SessionId" ON public."InventoryCountSessionLines" USING btree ("SessionId");


--
-- Name: IX_InventoryCountSessions_CompanyId_SessionType_PeriodMonth_St~; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "IX_InventoryCountSessions_CompanyId_SessionType_PeriodMonth_St~" ON public."InventoryCountSessions" USING btree ("CompanyId", "SessionType", "PeriodMonth", "Status");


--
-- Name: IX_InventoryCountSessions_Company_Type_Period; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "IX_InventoryCountSessions_Company_Type_Period" ON public."InventoryCountSessions" USING btree ("CompanyId", "SessionType", "PeriodMonth");


--
-- Name: IX_InventoryMovements_ComponentId_LocationExternalId; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "IX_InventoryMovements_ComponentId_LocationExternalId" ON public."InventoryMovements" USING btree ("ComponentId", "LocationExternalId");


--
-- Name: IX_InventoryPurchases_PurchaseOrderItemId; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "IX_InventoryPurchases_PurchaseOrderItemId" ON public."InventoryPurchases" USING btree ("PurchaseOrderItemId");


--
-- Name: IX_LeaveRequests_EmployeeId; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "IX_LeaveRequests_EmployeeId" ON public."LeaveRequests" USING btree ("EmployeeId");


--
-- Name: IX_LeaveRequests_Status; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "IX_LeaveRequests_Status" ON public."LeaveRequests" USING btree ("Status");


--
-- Name: IX_Locations_CompanyId; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "IX_Locations_CompanyId" ON public."Locations" USING btree ("CompanyId");


--
-- Name: IX_Locations_ExternalId; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX "IX_Locations_ExternalId" ON public."Locations" USING btree ("ExternalId");


--
-- Name: IX_Locations_PrincipalContactUserId; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "IX_Locations_PrincipalContactUserId" ON public."Locations" USING btree ("PrincipalContactUserId");


--
-- Name: IX_MandatoryContributions_PayStructureId; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "IX_MandatoryContributions_PayStructureId" ON public."MandatoryContributions" USING btree ("PayStructureId");


--
-- Name: IX_OrderTemplateItems_OrderTemplateId; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "IX_OrderTemplateItems_OrderTemplateId" ON public."OrderTemplateItems" USING btree ("OrderTemplateId");


--
-- Name: IX_PayStructures_CompanyId; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX "IX_PayStructures_CompanyId" ON public."PayStructures" USING btree ("CompanyId");


--
-- Name: IX_PayrollRunLines_PayrollRunId; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "IX_PayrollRunLines_PayrollRunId" ON public."PayrollRunLines" USING btree ("PayrollRunId");


--
-- Name: IX_PayrollRuns_CompanyId_Year_Month; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX "IX_PayrollRuns_CompanyId_Year_Month" ON public."PayrollRuns" USING btree ("CompanyId", "Year", "Month");


--
-- Name: IX_PerformanceAppraisals_EmployeeId_Year; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX "IX_PerformanceAppraisals_EmployeeId_Year" ON public."PerformanceAppraisals" USING btree ("EmployeeId", "Year");


--
-- Name: IX_PosCustomers_CompanyId; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "IX_PosCustomers_CompanyId" ON public."PosCustomers" USING btree ("CompanyId");


--
-- Name: IX_PosCustomers_ExternalId; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX "IX_PosCustomers_ExternalId" ON public."PosCustomers" USING btree ("ExternalId");


--
-- Name: IX_PreviousEmployments_EmployeeId; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "IX_PreviousEmployments_EmployeeId" ON public."PreviousEmployments" USING btree ("EmployeeId");


--
-- Name: IX_ProductAliases_ProductId; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "IX_ProductAliases_ProductId" ON public."ProductAliases" USING btree ("ProductId");


--
-- Name: IX_ProductB2bLocationStocks_ProductId_LocationExternalId; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX "IX_ProductB2bLocationStocks_ProductId_LocationExternalId" ON public."ProductB2bLocationStocks" USING btree ("ProductId", "LocationExternalId");


--
-- Name: IX_ProductComponentItems_ProductId; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "IX_ProductComponentItems_ProductId" ON public."ProductComponentItems" USING btree ("ProductId");


--
-- Name: IX_ProductPackagingItems_ProductId; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "IX_ProductPackagingItems_ProductId" ON public."ProductPackagingItems" USING btree ("ProductId");


--
-- Name: IX_ProductProductionLogs_ProductId; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "IX_ProductProductionLogs_ProductId" ON public."ProductProductionLogs" USING btree ("ProductId");


--
-- Name: IX_Products_ProductId; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX "IX_Products_ProductId" ON public."Products" USING btree ("ProductId");


--
-- Name: IX_ProvidentFundBrackets_PayStructureId; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "IX_ProvidentFundBrackets_PayStructureId" ON public."ProvidentFundBrackets" USING btree ("PayStructureId");


--
-- Name: IX_PublicHolidays_CountryCode_CatalogKey; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "IX_PublicHolidays_CountryCode_CatalogKey" ON public."PublicHolidays" USING btree ("CountryCode", "CatalogKey");


--
-- Name: IX_PublicHolidays_Date; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "IX_PublicHolidays_Date" ON public."PublicHolidays" USING btree ("Date");


--
-- Name: IX_PurchaseOrderItems_PurchaseOrderId; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "IX_PurchaseOrderItems_PurchaseOrderId" ON public."PurchaseOrderItems" USING btree ("PurchaseOrderId");


--
-- Name: IX_PurchaseOrders_PoNumber; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX "IX_PurchaseOrders_PoNumber" ON public."PurchaseOrders" USING btree ("PoNumber");


--
-- Name: IX_QuoteRequestLines_QuoteRequestId; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "IX_QuoteRequestLines_QuoteRequestId" ON public."QuoteRequestLines" USING btree ("QuoteRequestId");


--
-- Name: IX_QuoteRequestVendors_QuoteRequestId; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "IX_QuoteRequestVendors_QuoteRequestId" ON public."QuoteRequestVendors" USING btree ("QuoteRequestId");


--
-- Name: IX_QuoteRequestVendors_ShareToken; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "IX_QuoteRequestVendors_ShareToken" ON public."QuoteRequestVendors" USING btree ("ShareToken");


--
-- Name: IX_QuoteRequests_CompanyId; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "IX_QuoteRequests_CompanyId" ON public."QuoteRequests" USING btree ("CompanyId");


--
-- Name: IX_RevMgmtCompanyConfigs_CompanyId_ConfigKey; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX "IX_RevMgmtCompanyConfigs_CompanyId_ConfigKey" ON public."RevMgmtCompanyConfigs" USING btree ("CompanyId", "ConfigKey");


--
-- Name: IX_ShiftSchedules_EmployeeId_Date; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX "IX_ShiftSchedules_EmployeeId_Date" ON public."ShiftSchedules" USING btree ("EmployeeId", "Date");


--
-- Name: IX_SocsoBrackets_PayStructureId; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "IX_SocsoBrackets_PayStructureId" ON public."SocsoBrackets" USING btree ("PayStructureId");


--
-- Name: IX_VendorProducts_VendorExternalId; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "IX_VendorProducts_VendorExternalId" ON public."VendorProducts" USING btree ("VendorExternalId");


--
-- Name: IX_Vendors_ExternalId; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX "IX_Vendors_ExternalId" ON public."Vendors" USING btree ("ExternalId");


--
-- Name: AppUsers FK_AppUsers_Companies_CompanyId; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."AppUsers"
    ADD CONSTRAINT "FK_AppUsers_Companies_CompanyId" FOREIGN KEY ("CompanyId") REFERENCES public."Companies"("Id");


--
-- Name: AppUsers FK_AppUsers_Employees_EmployeeId; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."AppUsers"
    ADD CONSTRAINT "FK_AppUsers_Employees_EmployeeId" FOREIGN KEY ("EmployeeId") REFERENCES public."Employees"("Id") ON DELETE SET NULL;


--
-- Name: AttendanceRecords FK_AttendanceRecords_Employees_EmployeeId; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."AttendanceRecords"
    ADD CONSTRAINT "FK_AttendanceRecords_Employees_EmployeeId" FOREIGN KEY ("EmployeeId") REFERENCES public."Employees"("Id") ON DELETE CASCADE;


--
-- Name: B2bSalesOrderLines FK_B2bSalesOrderLines_B2bSalesOrders_SalesOrderId; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."B2bSalesOrderLines"
    ADD CONSTRAINT "FK_B2bSalesOrderLines_B2bSalesOrders_SalesOrderId" FOREIGN KEY ("SalesOrderId") REFERENCES public."B2bSalesOrders"("Id") ON DELETE CASCADE;


--
-- Name: B2bSalesOrderLines FK_B2bSalesOrderLines_Products_ProductId; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."B2bSalesOrderLines"
    ADD CONSTRAINT "FK_B2bSalesOrderLines_Products_ProductId" FOREIGN KEY ("ProductId") REFERENCES public."Products"("Id") ON DELETE CASCADE;


--
-- Name: Departments FK_Departments_Divisions_DivisionId; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."Departments"
    ADD CONSTRAINT "FK_Departments_Divisions_DivisionId" FOREIGN KEY ("DivisionId") REFERENCES public."Divisions"("Id") ON DELETE CASCADE;


--
-- Name: EducationRecords FK_EducationRecords_Employees_EmployeeId; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."EducationRecords"
    ADD CONSTRAINT "FK_EducationRecords_Employees_EmployeeId" FOREIGN KEY ("EmployeeId") REFERENCES public."Employees"("Id") ON DELETE CASCADE;


--
-- Name: EmployeeMovements FK_EmployeeMovements_Employees_EmployeeId; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."EmployeeMovements"
    ADD CONSTRAINT "FK_EmployeeMovements_Employees_EmployeeId" FOREIGN KEY ("EmployeeId") REFERENCES public."Employees"("Id") ON DELETE CASCADE;


--
-- Name: Employees FK_Employees_Departments_DepartmentId; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."Employees"
    ADD CONSTRAINT "FK_Employees_Departments_DepartmentId" FOREIGN KEY ("DepartmentId") REFERENCES public."Departments"("Id") ON DELETE SET NULL;


--
-- Name: Employees FK_Employees_Divisions_DivisionId; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."Employees"
    ADD CONSTRAINT "FK_Employees_Divisions_DivisionId" FOREIGN KEY ("DivisionId") REFERENCES public."Divisions"("Id") ON DELETE SET NULL;


--
-- Name: Employees FK_Employees_EmployeeLevels_EmployeeLevelId; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."Employees"
    ADD CONSTRAINT "FK_Employees_EmployeeLevels_EmployeeLevelId" FOREIGN KEY ("EmployeeLevelId") REFERENCES public."EmployeeLevels"("Id") ON DELETE SET NULL;


--
-- Name: Employees FK_Employees_Employees_ReportsToId; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."Employees"
    ADD CONSTRAINT "FK_Employees_Employees_ReportsToId" FOREIGN KEY ("ReportsToId") REFERENCES public."Employees"("Id") ON DELETE SET NULL;


--
-- Name: IncomeTaxBrackets FK_IncomeTaxBrackets_IncomeTaxYears_IncomeTaxYearId; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."IncomeTaxBrackets"
    ADD CONSTRAINT "FK_IncomeTaxBrackets_IncomeTaxYears_IncomeTaxYearId" FOREIGN KEY ("IncomeTaxYearId") REFERENCES public."IncomeTaxYears"("Id") ON DELETE CASCADE;


--
-- Name: IncomeTaxRebates FK_IncomeTaxRebates_IncomeTaxYears_IncomeTaxYearId; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."IncomeTaxRebates"
    ADD CONSTRAINT "FK_IncomeTaxRebates_IncomeTaxYears_IncomeTaxYearId" FOREIGN KEY ("IncomeTaxYearId") REFERENCES public."IncomeTaxYears"("Id") ON DELETE CASCADE;


--
-- Name: IncomeTaxReliefs FK_IncomeTaxReliefs_IncomeTaxYears_IncomeTaxYearId; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."IncomeTaxReliefs"
    ADD CONSTRAINT "FK_IncomeTaxReliefs_IncomeTaxYears_IncomeTaxYearId" FOREIGN KEY ("IncomeTaxYearId") REFERENCES public."IncomeTaxYears"("Id") ON DELETE CASCADE;


--
-- Name: IncomeTaxYears FK_IncomeTaxYears_Companies_CompanyId; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."IncomeTaxYears"
    ADD CONSTRAINT "FK_IncomeTaxYears_Companies_CompanyId" FOREIGN KEY ("CompanyId") REFERENCES public."Companies"("Id") ON DELETE CASCADE;


--
-- Name: InventoryCountSessionLines FK_InventoryCountSessionLines_InventoryCountSessions_SessionId; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."InventoryCountSessionLines"
    ADD CONSTRAINT "FK_InventoryCountSessionLines_InventoryCountSessions_SessionId" FOREIGN KEY ("SessionId") REFERENCES public."InventoryCountSessions"("Id") ON DELETE CASCADE;


--
-- Name: LeaveBalances FK_LeaveBalances_Employees_EmployeeId; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."LeaveBalances"
    ADD CONSTRAINT "FK_LeaveBalances_Employees_EmployeeId" FOREIGN KEY ("EmployeeId") REFERENCES public."Employees"("Id") ON DELETE CASCADE;


--
-- Name: LeaveRequests FK_LeaveRequests_Employees_EmployeeId; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."LeaveRequests"
    ADD CONSTRAINT "FK_LeaveRequests_Employees_EmployeeId" FOREIGN KEY ("EmployeeId") REFERENCES public."Employees"("Id") ON DELETE CASCADE;


--
-- Name: Locations FK_Locations_AppUsers_PrincipalContactUserId; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."Locations"
    ADD CONSTRAINT "FK_Locations_AppUsers_PrincipalContactUserId" FOREIGN KEY ("PrincipalContactUserId") REFERENCES public."AppUsers"("Id") ON DELETE SET NULL;


--
-- Name: Locations FK_Locations_Companies_CompanyId; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."Locations"
    ADD CONSTRAINT "FK_Locations_Companies_CompanyId" FOREIGN KEY ("CompanyId") REFERENCES public."Companies"("Id") ON DELETE SET NULL;


--
-- Name: MandatoryContributions FK_MandatoryContributions_PayStructures_PayStructureId; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."MandatoryContributions"
    ADD CONSTRAINT "FK_MandatoryContributions_PayStructures_PayStructureId" FOREIGN KEY ("PayStructureId") REFERENCES public."PayStructures"("Id") ON DELETE CASCADE;


--
-- Name: OrderTemplateItems FK_OrderTemplateItems_OrderTemplates_OrderTemplateId; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."OrderTemplateItems"
    ADD CONSTRAINT "FK_OrderTemplateItems_OrderTemplates_OrderTemplateId" FOREIGN KEY ("OrderTemplateId") REFERENCES public."OrderTemplates"("Id") ON DELETE CASCADE;


--
-- Name: PayStructures FK_PayStructures_Companies_CompanyId; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."PayStructures"
    ADD CONSTRAINT "FK_PayStructures_Companies_CompanyId" FOREIGN KEY ("CompanyId") REFERENCES public."Companies"("Id") ON DELETE CASCADE;


--
-- Name: PayrollRunLines FK_PayrollRunLines_PayrollRuns_PayrollRunId; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."PayrollRunLines"
    ADD CONSTRAINT "FK_PayrollRunLines_PayrollRuns_PayrollRunId" FOREIGN KEY ("PayrollRunId") REFERENCES public."PayrollRuns"("Id") ON DELETE CASCADE;


--
-- Name: PayrollRuns FK_PayrollRuns_Companies_CompanyId; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."PayrollRuns"
    ADD CONSTRAINT "FK_PayrollRuns_Companies_CompanyId" FOREIGN KEY ("CompanyId") REFERENCES public."Companies"("Id") ON DELETE CASCADE;


--
-- Name: PerformanceAppraisals FK_PerformanceAppraisals_Employees_EmployeeId; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."PerformanceAppraisals"
    ADD CONSTRAINT "FK_PerformanceAppraisals_Employees_EmployeeId" FOREIGN KEY ("EmployeeId") REFERENCES public."Employees"("Id") ON DELETE CASCADE;


--
-- Name: PreviousEmployments FK_PreviousEmployments_Employees_EmployeeId; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."PreviousEmployments"
    ADD CONSTRAINT "FK_PreviousEmployments_Employees_EmployeeId" FOREIGN KEY ("EmployeeId") REFERENCES public."Employees"("Id") ON DELETE CASCADE;


--
-- Name: ProductAliases FK_ProductAliases_Products_ProductId; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."ProductAliases"
    ADD CONSTRAINT "FK_ProductAliases_Products_ProductId" FOREIGN KEY ("ProductId") REFERENCES public."Products"("Id") ON DELETE CASCADE;


--
-- Name: ProductB2bLocationStocks FK_ProductB2bLocationStocks_Products_ProductId; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."ProductB2bLocationStocks"
    ADD CONSTRAINT "FK_ProductB2bLocationStocks_Products_ProductId" FOREIGN KEY ("ProductId") REFERENCES public."Products"("Id") ON DELETE CASCADE;


--
-- Name: ProductComponentItems FK_ProductComponentItems_Products_ProductId; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."ProductComponentItems"
    ADD CONSTRAINT "FK_ProductComponentItems_Products_ProductId" FOREIGN KEY ("ProductId") REFERENCES public."Products"("Id") ON DELETE CASCADE;


--
-- Name: ProductPackagingItems FK_ProductPackagingItems_Products_ProductId; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."ProductPackagingItems"
    ADD CONSTRAINT "FK_ProductPackagingItems_Products_ProductId" FOREIGN KEY ("ProductId") REFERENCES public."Products"("Id") ON DELETE CASCADE;


--
-- Name: ProductProductionLogs FK_ProductProductionLogs_Products_ProductId; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."ProductProductionLogs"
    ADD CONSTRAINT "FK_ProductProductionLogs_Products_ProductId" FOREIGN KEY ("ProductId") REFERENCES public."Products"("Id") ON DELETE CASCADE;


--
-- Name: ProvidentFundBrackets FK_ProvidentFundBrackets_PayStructures_PayStructureId; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."ProvidentFundBrackets"
    ADD CONSTRAINT "FK_ProvidentFundBrackets_PayStructures_PayStructureId" FOREIGN KEY ("PayStructureId") REFERENCES public."PayStructures"("Id") ON DELETE CASCADE;


--
-- Name: PurchaseOrderItems FK_PurchaseOrderItems_PurchaseOrders_PurchaseOrderId; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."PurchaseOrderItems"
    ADD CONSTRAINT "FK_PurchaseOrderItems_PurchaseOrders_PurchaseOrderId" FOREIGN KEY ("PurchaseOrderId") REFERENCES public."PurchaseOrders"("Id") ON DELETE CASCADE;


--
-- Name: QuoteRequestLines FK_QuoteRequestLines_QuoteRequests_QuoteRequestId; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."QuoteRequestLines"
    ADD CONSTRAINT "FK_QuoteRequestLines_QuoteRequests_QuoteRequestId" FOREIGN KEY ("QuoteRequestId") REFERENCES public."QuoteRequests"("Id") ON DELETE CASCADE;


--
-- Name: QuoteRequestVendors FK_QuoteRequestVendors_QuoteRequests_QuoteRequestId; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."QuoteRequestVendors"
    ADD CONSTRAINT "FK_QuoteRequestVendors_QuoteRequests_QuoteRequestId" FOREIGN KEY ("QuoteRequestId") REFERENCES public."QuoteRequests"("Id") ON DELETE CASCADE;


--
-- Name: ShiftSchedules FK_ShiftSchedules_Employees_EmployeeId; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."ShiftSchedules"
    ADD CONSTRAINT "FK_ShiftSchedules_Employees_EmployeeId" FOREIGN KEY ("EmployeeId") REFERENCES public."Employees"("Id") ON DELETE CASCADE;


--
-- Name: SocsoBrackets FK_SocsoBrackets_PayStructures_PayStructureId; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."SocsoBrackets"
    ADD CONSTRAINT "FK_SocsoBrackets_PayStructures_PayStructureId" FOREIGN KEY ("PayStructureId") REFERENCES public."PayStructures"("Id") ON DELETE CASCADE;


--
-- PostgreSQL database dump complete
--

\unrestrict LUEyT7WfyMVmH89eTmwn6DCzilTgLhJMZ4VkA21SZLg9BfBDARrzSINIpDstP6d

