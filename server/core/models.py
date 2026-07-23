"""
Unmanaged Django models mapped to the existing EF Core SQLite schema.

`managed = False` means Django never creates/alters/drops these tables — it only
reads and writes rows in the database the .NET app already created and seeded.
Column names are PascalCase (EF Core convention), so every field declares an
explicit `db_column`.

NOTE: EF Core persisted several C# `decimal` properties as SQLite TEXT columns.
Those are modelled here as `TextField` and converted to numbers in the
serializers (see serializers.py) so the JSON contract matches the .NET API,
which serialized them as numbers.
"""
from django.db import models


class Company(models.Model):
    id = models.AutoField(db_column="Id", primary_key=True)
    name = models.TextField(db_column="Name")
    brn = models.TextField(db_column="Brn")
    gst_tin = models.TextField(db_column="GstTin")
    country_code = models.TextField(db_column="CountryCode")
    address_line1 = models.TextField(db_column="AddressLine1")
    address_line2 = models.TextField(db_column="AddressLine2")
    city = models.TextField(db_column="City")
    state_province = models.TextField(db_column="StateProvince")
    postcode = models.TextField(db_column="Postcode")
    phone = models.TextField(db_column="Phone")
    fax = models.TextField(db_column="Fax")
    email = models.TextField(db_column="Email")
    active = models.BooleanField(db_column="Active")

    class Meta:
        managed = False
        db_table = "Companies"


class Location(models.Model):
    id = models.AutoField(db_column="Id", primary_key=True)
    external_id = models.TextField(db_column="ExternalId")
    name = models.TextField(db_column="Name")
    address = models.TextField(db_column="Address")
    company_id = models.IntegerField(db_column="CompanyId", null=True)
    address_line1 = models.TextField(db_column="AddressLine1")
    address_line2 = models.TextField(db_column="AddressLine2")
    city = models.TextField(db_column="City")
    state_province = models.TextField(db_column="StateProvince")
    postcode = models.TextField(db_column="Postcode")
    principal_contact_user_id = models.IntegerField(
        db_column="PrincipalContactUserId", null=True
    )
    # Sales figures were stored as TEXT by EF Core.
    sales_today = models.TextField(db_column="SalesToday")
    sales_wtd = models.TextField(db_column="SalesWtd")
    sales_mtd = models.TextField(db_column="SalesMtd")
    sales_ytd = models.TextField(db_column="SalesYtd")
    sales_prev_today = models.TextField(db_column="SalesPrevToday")
    sales_prev_wtd = models.TextField(db_column="SalesPrevWtd")
    sales_prev_mtd = models.TextField(db_column="SalesPrevMtd")
    sales_prev_ytd = models.TextField(db_column="SalesPrevYtd")
    covers_today = models.IntegerField(db_column="CoversToday")
    covers_wtd = models.IntegerField(db_column="CoversWtd")
    covers_mtd = models.IntegerField(db_column="CoversMtd")
    covers_ytd = models.IntegerField(db_column="CoversYtd")
    covers_prev_today = models.IntegerField(db_column="CoversPrevToday")
    covers_prev_wtd = models.IntegerField(db_column="CoversPrevWtd")
    covers_prev_mtd = models.IntegerField(db_column="CoversPrevMtd")
    covers_prev_ytd = models.IntegerField(db_column="CoversPrevYtd")

    class Meta:
        managed = False
        db_table = "Locations"


class Employee(models.Model):
    id = models.AutoField(db_column="Id", primary_key=True)
    employee_code = models.TextField(db_column="EmployeeCode")
    name = models.TextField(db_column="Name")
    email = models.TextField(db_column="Email")
    mobile = models.TextField(db_column="Mobile")
    department = models.TextField(db_column="Department")
    position = models.TextField(db_column="Position")
    bisync_enabled = models.BooleanField(db_column="BisyncEnabled")

    class Meta:
        managed = False
        db_table = "Employees"


class AppUser(models.Model):
    id = models.AutoField(db_column="Id", primary_key=True)
    full_name = models.TextField(db_column="FullName")
    email = models.TextField(db_column="Email")
    role = models.TextField(db_column="Role")
    phone = models.TextField(db_column="Phone")
    active = models.BooleanField(db_column="Active")
    company_id = models.IntegerField(db_column="CompanyId", null=True)
    location_ids_json = models.TextField(db_column="LocationIdsJson")
    access_json = models.TextField(db_column="AccessJson")
    employee_id = models.IntegerField(db_column="EmployeeId", null=True)
    password_hash = models.TextField(db_column="PasswordHash", null=True)

    class Meta:
        managed = False
        db_table = "AppUsers"


class MenuItem(models.Model):
    id = models.AutoField(db_column="Id", primary_key=True)
    name = models.TextField(db_column="Name")
    category = models.TextField(db_column="Category")
    orders = models.IntegerField(db_column="Orders")
    revenue = models.TextField(db_column="Revenue")
    margin_percent = models.IntegerField(db_column="MarginPercent")

    class Meta:
        managed = False
        db_table = "MenuItems"


class Vendor(models.Model):
    id = models.AutoField(db_column="Id", primary_key=True)
    external_id = models.TextField(db_column="ExternalId")
    name = models.TextField(db_column="Name")
    type = models.TextField(db_column="Type")
    brn = models.TextField(db_column="Brn")
    products = models.TextField(db_column="Products")
    city = models.TextField(db_column="City")
    state = models.TextField(db_column="State")
    contact_person = models.TextField(db_column="ContactPerson")
    contact_position = models.TextField(db_column="ContactPosition")
    mobile = models.TextField(db_column="Mobile")
    email = models.TextField(db_column="Email")
    address = models.TextField(db_column="Address")
    contacts_json = models.TextField(db_column="ContactsJson")
    engaged = models.BooleanField(db_column="Engaged")

    class Meta:
        managed = False
        db_table = "Vendors"


class Ingredient(models.Model):
    id = models.AutoField(db_column="Id", primary_key=True)
    component_id = models.TextField(db_column="ComponentId")
    name = models.TextField(db_column="Name")
    category = models.TextField(db_column="Category")
    group = models.TextField(db_column="Group")
    recipe_uom = models.TextField(db_column="RecipeUom")
    inventory_uom = models.TextField(db_column="InventoryUom")
    last_price_recipe = models.TextField(db_column="LastPriceRecipe")
    last_price_inventory = models.TextField(db_column="LastPriceInventory")
    daily_usage = models.TextField(db_column="DailyUsage")
    order_freq_days = models.IntegerField(db_column="OrderFreqDays")
    storage_json = models.TextField(db_column="StorageJson")
    storage_note = models.TextField(db_column="StorageNote")
    detail_config_json = models.TextField(db_column="DetailConfigJson")
    attached_products = models.IntegerField(db_column="AttachedProducts")
    attached_vendors = models.IntegerField(db_column="AttachedVendors")
    active = models.BooleanField(db_column="Active")
    locations_json = models.TextField(db_column="LocationsJson")

    class Meta:
        managed = False
        db_table = "Ingredients"


class PurchaseOrder(models.Model):
    id = models.AutoField(db_column="Id", primary_key=True)
    po_number = models.TextField(db_column="PoNumber")
    vendor_name = models.TextField(db_column="VendorName")
    order_date = models.TextField(db_column="OrderDate")
    delivery_date = models.TextField(db_column="DeliveryDate")
    status = models.TextField(db_column="Status")
    document_type = models.TextField(db_column="DocumentType")
    company_id = models.IntegerField(db_column="CompanyId", null=True)
    location_ids_json = models.TextField(db_column="LocationIdsJson")
    initiated_by = models.TextField(db_column="InitiatedBy")
    approved_by = models.TextField(db_column="ApprovedBy")
    approved_at = models.TextField(db_column="ApprovedAt", null=True)
    received_at = models.TextField(db_column="ReceivedAt", null=True)
    reconciled_at = models.TextField(db_column="ReconciledAt", null=True)
    vendor_share_token = models.TextField(db_column="VendorShareToken")
    vendor_accepted_at = models.TextField(db_column="VendorAcceptedAt", null=True)
    vendor_accepted_by = models.TextField(db_column="VendorAcceptedBy")

    class Meta:
        managed = False
        db_table = "PurchaseOrders"


class PurchaseOrderItem(models.Model):
    id = models.AutoField(db_column="Id", primary_key=True)
    purchase_order_id = models.IntegerField(db_column="PurchaseOrderId")
    name = models.TextField(db_column="Name")
    quantity = models.TextField(db_column="Quantity")
    unit_price = models.TextField(db_column="UnitPrice")
    unit = models.TextField(db_column="Unit")
    delivery_package = models.TextField(db_column="DeliveryPackage")
    component_id = models.TextField(db_column="ComponentId")
    component_name = models.TextField(db_column="ComponentName")
    component_uom = models.TextField(db_column="ComponentUom")
    received_quantity = models.FloatField(db_column="ReceivedQuantity", null=True)
    received_unit_price = models.FloatField(db_column="ReceivedUnitPrice", null=True)
    reconciled_quantity = models.FloatField(db_column="ReconciledQuantity", null=True)
    reconciled_unit_price = models.FloatField(
        db_column="ReconciledUnitPrice", null=True
    )
    vendor_product_id = models.TextField(db_column="VendorProductId")
    issued_unit_price = models.FloatField(db_column="IssuedUnitPrice")
    tax_amount = models.FloatField(db_column="TaxAmount")

    class Meta:
        managed = False
        db_table = "PurchaseOrderItems"


class VendorProductPrice(models.Model):
    external_id = models.TextField(db_column="ExternalId", primary_key=True)
    delivery_price = models.FloatField(db_column="DeliveryPrice")
    updated_at = models.TextField(db_column="UpdatedAt")

    class Meta:
        managed = False
        db_table = "VendorProductPrices"


class InventoryAlert(models.Model):
    id = models.AutoField(db_column="Id", primary_key=True)
    item_name = models.TextField(db_column="ItemName")
    stock = models.TextField(db_column="Stock")
    status = models.TextField(db_column="Status")
    threshold = models.TextField(db_column="Threshold")

    class Meta:
        managed = False
        db_table = "InventoryAlerts"


class RevenueDataPoint(models.Model):
    id = models.AutoField(db_column="Id", primary_key=True)
    period = models.TextField(db_column="Period")
    label = models.TextField(db_column="Label")
    current_value = models.TextField(db_column="CurrentValue")
    prior_value = models.TextField(db_column="PriorValue")
    covers = models.IntegerField(db_column="Covers", null=True)

    class Meta:
        managed = False
        db_table = "RevenueDataPoints"


class DevelopmentMilestone(models.Model):
    id = models.AutoField(db_column="Id", primary_key=True)
    phase = models.TextField(db_column="Phase")
    title = models.TextField(db_column="Title")
    status = models.TextField(db_column="Status")
    progress_percent = models.IntegerField(db_column="ProgressPercent")
    notes = models.TextField(db_column="Notes", null=True)
    updated_at = models.TextField(db_column="UpdatedAt")

    class Meta:
        managed = False
        db_table = "DevelopmentMilestones"
