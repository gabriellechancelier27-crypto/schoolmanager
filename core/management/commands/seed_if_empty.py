from django.core.management import call_command
from django.core.management.base import BaseCommand

from schools.models import School


class Command(BaseCommand):
    help = "Charge les données de démonstration uniquement si la base ne contient aucun établissement."

    def handle(self, *args, **options):
        if School.objects.exists():
            self.stdout.write("Base déjà initialisée : démo ignorée.")
            return
        call_command("seed_demo")