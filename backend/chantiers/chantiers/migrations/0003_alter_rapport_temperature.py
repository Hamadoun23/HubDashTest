from django.db import migrations, models


class Migration(migrations.Migration):
    """`temperature` devient un texte libre : le frontend le saisit comme tel
    (placeholder « 28°C »), et un DecimalField refusait toute valeur non
    strictement numerique avec une erreur non rattrapee par DRF (500)."""

    dependencies = [
        ('chantiers', '0002_alter_photo_file'),
    ]

    operations = [
        migrations.AlterField(
            model_name='rapport',
            name='temperature',
            field=models.CharField(blank=True, max_length=20, null=True),
        ),
    ]
