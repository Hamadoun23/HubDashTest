# Migration initiale consolidée du module emballage (Conditionnement + Bouteille + commande)
import django.db.models.deletion
from django.conf import settings
from django.db import migrations, models


class Migration(migrations.Migration):

    initial = True

    dependencies = [
        ('appro', '0001_initial'),
        ('distribution', '0001_initial'),
        ('fabrication', '0001_initial'),
        migrations.swappable_dependency(settings.AUTH_USER_MODEL),
    ]

    operations = [
        migrations.CreateModel(
            name='Conditionnement',
            fields=[
                ('id', models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name='ID')),
                ('date_cond', models.DateField(verbose_name='Date de conditionnement')),
                ('numero_cond', models.CharField(blank=True, editable=False, max_length=30, verbose_name='N° conditionnement')),
                ('qte_33cl', models.IntegerField(default=0, verbose_name='Quantité 33cl')),
                ('qte_1l', models.IntegerField(default=0, verbose_name='Quantité 1L')),
                ('volume_utilisee', models.FloatField(default=0, verbose_name='Volume utilisée (L)')),
                ('dlc', models.DateField(verbose_name='Date limite de consommation')),
                ('observation', models.TextField(blank=True, null=True)),
                ('production', models.OneToOneField(on_delete=django.db.models.deletion.CASCADE, related_name='conditionnement', to='fabrication.production', verbose_name='Production')),
                ('user', models.ForeignKey(blank=True, null=True, on_delete=django.db.models.deletion.SET_NULL, related_name='conditionnements', to=settings.AUTH_USER_MODEL, verbose_name='Responsable')),
            ],
            options={
                'verbose_name': 'Conditionnement',
                'verbose_name_plural': 'Conditionnements',
                'ordering': ['-date_cond'],
            },
        ),
        migrations.CreateModel(
            name='Bouteille',
            fields=[
                ('id', models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name='ID')),
                ('format_33cl', models.IntegerField(default=0, verbose_name='Format 33cl (1=33cl, 0=non)')),
                ('format_1l', models.IntegerField(default=0, verbose_name='Format 1L (1=1L, 0=non)')),
                ('codebar', models.CharField(blank=True, max_length=100, verbose_name='Code-barres')),
                ('dlc', models.DateField(verbose_name='Date limite de consommation')),
                ('statut_stock', models.CharField(choices=[('DISPO', 'Disponible'), ('VENDUE', 'Vendue'), ('PERIMEE', 'Périmée'), ('REBUT', 'Rebut')], default='DISPO', max_length=20, verbose_name='Statut stock')),
                ('date_creation', models.DateField(auto_now_add=True, verbose_name='Date création')),
                ('article_stock', models.ForeignKey(blank=True, null=True, on_delete=django.db.models.deletion.SET_NULL, related_name='bouteilles', to='appro.articlestock', verbose_name='Article stock')),
                ('commande', models.ForeignKey(blank=True, null=True, on_delete=django.db.models.deletion.SET_NULL, related_name='bouteilles', to='distribution.commande', verbose_name='Commande')),
                ('conditionnement', models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name='bouteilles', to='emballage.conditionnement', verbose_name='Conditionnement')),
            ],
            options={
                'verbose_name': 'Bouteille',
                'verbose_name_plural': 'Bouteilles',
                'ordering': ['-date_creation'],
            },
        ),
    ]
