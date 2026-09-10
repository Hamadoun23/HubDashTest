# Migration initiale consolidée du module distribution
import datetime
import django.db.models.deletion
from django.db import migrations, models


class Migration(migrations.Migration):

    initial = True

    dependencies = [
    ]

    operations = [
        migrations.CreateModel(
            name='Client',
            fields=[
                ('id', models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name='ID')),
                ('nom_complet', models.CharField(max_length=200, verbose_name='Nom complet')),
                ('tel_client', models.CharField(blank=True, max_length=30, verbose_name='Téléphone')),
                ('email', models.EmailField(blank=True, max_length=254, verbose_name='Email')),
                ('adresse', models.TextField(blank=True, verbose_name='Adresse')),
            ],
            options={
                'verbose_name': 'Client',
                'verbose_name_plural': 'Clients',
                'ordering': ['nom_complet'],
            },
        ),
        migrations.CreateModel(
            name='Vente',
            fields=[
                ('id', models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name='ID')),
                ('date_vente', models.DateField(verbose_name='Date de vente')),
                ('montant_total', models.FloatField(default=0, verbose_name='Montant total')),
                ('statut_paiement', models.CharField(choices=[('ACHAT_VENTE', 'Achat-vente'), ('PARTIELLE', 'Partielle'), ('DEPOT_VENTE', 'Dépôt-vente')], default='DEPOT_VENTE', max_length=20, verbose_name='Statut paiement')),
                ('client', models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name='ventes', to='distribution.client', verbose_name='Client')),
            ],
            options={
                'verbose_name': 'Vente',
                'verbose_name_plural': 'Ventes',
                'ordering': ['-date_vente'],
            },
        ),
        migrations.CreateModel(
            name='Facture',
            fields=[
                ('id', models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name='ID')),
                ('num_fact', models.CharField(blank=True, editable=False, max_length=50, verbose_name='N° facture')),
                ('date_fact', models.DateField(verbose_name='Date facture')),
                ('montant', models.FloatField(verbose_name='Montant')),
                ('statut', models.CharField(choices=[('EMIS', 'Émise'), ('ACHAT_VENTE', 'Achat-vente'), ('PARTIELLE', 'Partielle'), ('ANNULEE', 'Annulée')], default='EMIS', max_length=20, verbose_name='Statut')),
                ('date_echeance', models.DateField(verbose_name='Date échéance')),
                ('vente', models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name='factures', to='distribution.vente', verbose_name='Vente')),
            ],
            options={
                'verbose_name': 'Facture',
                'verbose_name_plural': 'Factures',
                'ordering': ['-date_fact'],
            },
        ),
        migrations.CreateModel(
            name='Commande',
            fields=[
                ('id', models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name='ID')),
                ('date_cmd', models.DateField(default=datetime.date.today, verbose_name='Date commande')),
                ('quantite_33cl', models.IntegerField(default=0, verbose_name='Quantité 33cl')),
                ('quantite_1l', models.IntegerField(default=0, verbose_name='Quantité 1L')),
                ('client', models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name='commandes', to='distribution.client', verbose_name='Client')),
                ('vente', models.ForeignKey(blank=True, null=True, on_delete=django.db.models.deletion.SET_NULL, related_name='commandes', to='distribution.vente', verbose_name='Vente')),
            ],
            options={
                'verbose_name': 'Commande',
                'verbose_name_plural': 'Commandes',
                'ordering': ['-date_cmd', '-pk'],
            },
        ),
        migrations.CreateModel(
            name='Paiement',
            fields=[
                ('id', models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name='ID')),
                ('date_paie', models.DateField(verbose_name='Date paiement')),
                ('montant', models.FloatField(verbose_name='Montant')),
                ('mode_paie', models.CharField(choices=[('ESPECE', 'Espèce'), ('CHEQUE', 'Chèque'), ('VIREMENT', 'Virement'), ('MOBILE', 'Mobile')], max_length=20, verbose_name='Mode paiement')),
                ('reference', models.CharField(blank=True, max_length=100, verbose_name='Référence')),
                ('facture', models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name='paiements', to='distribution.facture', verbose_name='Facture')),
            ],
            options={
                'verbose_name': 'Paiement',
                'verbose_name_plural': 'Paiements',
                'ordering': ['-date_paie'],
            },
        ),
        migrations.CreateModel(
            name='ReceptionPaiement',
            fields=[
                ('id', models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name='ID')),
                ('montant_recu', models.FloatField(verbose_name='Montant reçu (trésorerie)')),
                ('date_reception', models.DateField(verbose_name='Date réception')),
                ('observation', models.TextField(blank=True, verbose_name='Observation (gestion des écarts)')),
                ('ecart_traite', models.BooleanField(default=False, verbose_name='Écart traité')),
                ('paiement', models.OneToOneField(on_delete=django.db.models.deletion.CASCADE, related_name='reception_tresorerie', to='distribution.paiement', verbose_name='Paiement (commercial)')),
            ],
            options={
                'verbose_name': 'Réception paiement (trésorerie)',
                'verbose_name_plural': 'Réceptions paiements (trésorerie)',
                'ordering': ['-date_reception'],
            },
        ),
    ]
