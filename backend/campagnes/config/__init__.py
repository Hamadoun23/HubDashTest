"""
PyMySQL est utilisé à la place de mysqlclient : c'est du Python pur, donc
aucune compilation C n'est nécessaire sous Windows. Il doit se déclarer comme
MySQLdb avant que Django ne charge son backend de base de données.
"""

import pymysql

pymysql.install_as_MySQLdb()
