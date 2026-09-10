# PyMySQL n'est utile que si le backend MySQL est activé (voir DATABASES).
# En SQLite (config par défaut désormais), l'import est simplement ignoré.
try:
    import pymysql
    pymysql.install_as_MySQLdb()
    # Django exige mysqlclient 2.2.1+ ; PyMySQL fonctionne mais signale 1.4.6
    pymysql.version_info = (2, 2, 1, "final", 0)
except ImportError:
    pass

# Correctif Python 3.14 : Django 4.2 BaseContext.__copy__ utilise copy(super()) qui échoue
# car super() n'accepte plus l'assignation d'attributs en Python 3.14
import sys
if sys.version_info >= (3, 14):
    from copy import copy as _copy
    import django.template.context as _ctx

    def _patched_base_context_copy(self):
        duplicate = object.__new__(type(self))
        duplicate.dicts = self.dicts[:]
        # Copier les attributs de Context si présents
        for attr in ('autoescape', 'use_l10n', 'use_tz', 'template_name', 'template'):
            if hasattr(self, attr):
                setattr(duplicate, attr, getattr(self, attr))
        if hasattr(self, 'render_context'):
            setattr(duplicate, 'render_context', _copy(self.render_context))
        return duplicate

    _ctx.BaseContext.__copy__ = _patched_base_context_copy