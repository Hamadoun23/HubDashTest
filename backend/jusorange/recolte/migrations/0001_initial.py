# Migration initiale du module recolte (Producteur + Cueillette)
import django.db.models.deletion
from django.db import migrations, models


class Migration(migrations.Migration):

    initial = True

    dependencies = [
    ]

    operations = [
        migrations.CreateModel(
            name='Producteur',
            fields=[
                ('id', models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name='ID')),
                ('nom_complet', models.CharField(max_length=100)),
                ('zone', models.CharField(max_length=100)),
                ('contact', models.CharField(max_length=20)),
                ('adresse', models.TextField(blank=True, null=True)),
                ('actif', models.BooleanField(default=True)),
                ('date_creation', models.DateTimeField(auto_now_add=True)),
            ],
            options={
                'verbose_name': 'Producteur',
                'verbose_name_plural': 'Producteurs',
                'ordering': ['nom_complet'],
            },
        ),
        migrations.CreateModel(
            name='Cueillette',
            fields=[
                ('id', models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name='ID')),
                ('producteur_nom_archive', models.CharField(blank=True, max_length=100)),
                ('date_cueil', models.DateField()),
                ('qte_total', models.FloatField()),
                ('qte_bon', models.FloatField()),
                ('qte_mauvais', models.FloatField(default=0, editable=False)),
                ('observation', models.TextField(blank=True, null=True)),
                ('producteur', models.ForeignKey(blank=True, null=True, on_delete=django.db.models.deletion.SET_NULL, related_name='cueillettes', to='recolte.producteur')),
            ],
            options={
                'verbose_name': 'Cueillette',
                'verbose_name_plural': 'Cueillettes',
                'ordering': ['-date_cueil'],
            },
        ),
    ]
