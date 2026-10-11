from django.contrib import admin

# Register your models here.

from django.contrib import admin
from django.contrib.auth.admin import UserAdmin
from .models import User, ActivityLog

@admin.register(User)
class CustomUserAdmin(UserAdmin):
    list_display = ("username", "first_name", "last_name", "role", "school", "is_active")
    list_filter = UserAdmin.list_filter + ("role", "school")
    fieldsets = UserAdmin.fieldsets + (("SchoolManager", {"fields": ("role", "school", "phone")}),)
    add_fieldsets = UserAdmin.add_fieldsets + (
        ("SchoolManager", {"fields": ("first_name", "last_name", "role", "school", "phone")}),
    )

@admin.register(ActivityLog)
class ActivityLogAdmin(admin.ModelAdmin):
    list_display = ("user", "action", "model", "created_at")
    readonly_fields = ("created_at",)