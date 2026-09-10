# Migration initiale consolidée du module appro (ArticleStock + Reception + prix)
import django.db.models.deletion
from django.db import migrations, models


def create_articles_initiaux(apps, schema_editor):
    """Crée les 7 articles de base avec prix par défaut pour les jus."""
    ArticleStock = apps.get_model('appro', 'ArticleStock')
    articles = [
        ('orange_dispo', 0, 100, None, None),
        ('bouteille_vide_33cl', 0, 30, None, None),
        ('bouteille_vide_1l', 0, 20, None, None),
        ('preforme_33cl', 0, 50, None, None),
        ('preforme_1l', 0, 50, None, None),
        ('jus_33cl', 0, 10, 750.0, None),
        ('jus_1l', 0, 10, None, 2500.0),
    ]
    for type_art, qte, seuil, prix_33, prix_1l in articles:
        ArticleStock.objects.get_or_create(
            type_art=type_art,
            defaults={
                'qte_art': qte,
                'seuil_alerte': seuil,
                'prix_33cl': prix_33,
                'prix_1l': prix_1l,
            }
        )


def reverse_create(apps, schema_editor):
    ArticleStock = apps.get_model('appro', 'ArticleStock')
    ArticleStock.objects.all().delete()


class Migration(migrations.Migration):

    initial = True

    dependencies = [
        ('recolte', '0001_initial'),
    ]

    operations = [
        migrations.CreateModel(
            name='ArticleStock',
            fields=[
                ('id', models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name='ID')),
                ('type_art', models.CharField(
                    choices=[
                        ('bouteille_vide_33cl', 'Bouteille vide 33cl'),
                        ('bouteille_vide_1l', 'Bouteille vide 1L'),
                        ('preforme_33cl', 'Préforme 33cl'),
                        ('preforme_1l', 'Préforme 1L'),
                        ('orange_dispo', 'Orange disponible'),
                        ('jus_33cl', 'Jus 33cl'),
                        ('jus_1l', 'Jus 1L'),
                    ],
                    max_length=50,
                    unique=True
                )),
                ('qte_art', models.FloatField(default=0)),
                ('seuil_alerte', models.FloatField()),
                ('date_maj', models.DateTimeField(auto_now=True)),
                ('prix_33cl', models.FloatField(blank=True, null=True, verbose_name='Prix 33cl (XOF)')),
                ('prix_1l', models.FloatField(blank=True, null=True, verbose_name='Prix 1L (XOF)')),
            ],
            options={
                'verbose_name': 'Article Stock',
                'verbose_name_plural': 'Articles Stock',
                'ordering': ['type_art'],
            },
        ),
        migrations.CreateModel(
            name='Reception',
            fields=[
                ('id', models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name='ID')),
                ('cueillette_archive', models.CharField(blank=True, max_length=250)),
                ('num_recp', models.CharField(blank=True, editable=False, max_length=30)),
                ('date_recp', models.DateField()),
                ('qte_recue', models.FloatField()),
                ('qte_bon', models.FloatField()),
                ('qte_mauvais', models.FloatField(default=0, editable=False)),
                ('lieu_depot', models.CharField(max_length=100)),
                ('cause_perte', models.TextField(blank=True, null=True)),
                ('articles', models.ManyToManyField(blank=True, related_name='receptions', to='appro.articlestock')),
                ('cueillette', models.ForeignKey(blank=True, null=True, on_delete=django.db.models.deletion.SET_NULL, related_name='receptions', to='recolte.cueillette')),
            ],
            options={
                'verbose_name': 'Réception',
                'verbose_name_plural': 'Réceptions',
                'ordering': ['-date_recp'],
            },
        ),
        migrations.RunPython(create_articles_initiaux, reverse_create),
    ]
