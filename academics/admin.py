from django.contrib import admin

# Register your models here.
from django.contrib import admin
from .models import *

# Enregistre automatiquement tous les modèles de cette app
from django.apps import apps
app = apps.get_app_config('academics')
for model in app.get_models():
    try:
        admin.site.register(model)
    except admin.sites.AlreadyRegistered:
        pass