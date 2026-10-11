from django.contrib import admin

# Register your models here.
from django.contrib import admin

from .models import School, SchoolYear


@admin.register(School)
class SchoolAdmin(admin.ModelAdmin):
    list_display = ("name", "code", "city", "is_active")
    search_fields = ("name", "code", "city")


@admin.register(SchoolYear)
class SchoolYearAdmin(admin.ModelAdmin):
    list_display = ("label", "school", "start_date", "end_date", "is_current")
    list_filter = ("school", "is_current")