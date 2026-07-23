from django.urls import path

from . import views

urlpatterns = [
    path("api/health", views.health),
    path("api/auth/login", views.login),
    path("api/users", views.users),
    path("api/companies", views.companies),
    path("api/locations", views.locations),
    path("api/locations/config", views.locations_config),
    path("api/menu", views.menu),
    path("api/vendors", views.vendors),
    path("api/vendors/<str:external_id>/engage", views.engage_vendor),
    path("api/ingredients", views.ingredients),
    path("api/purchaseorders", views.purchase_orders),
    path("api/purchaseorders/active", views.active_purchase_orders),
    path("api/vendorproducts/prices", views.vendor_product_prices),
    path("api/inventory/alerts", views.inventory_alerts),
    path("api/revenue", views.revenue),
    path("api/progress", views.progress),
]
