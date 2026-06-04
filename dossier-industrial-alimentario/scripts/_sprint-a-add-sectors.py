"""Sprint A — añadir entradas para los nuevos sectores amplios (Industrial, Farmacéutico, Construcción, Energético).
Brief 2026-06-03: 'los sectores son alimentos y bebidas, industrial, farmaceutico, construccion, energetico, etc.'
"""
import json
from collections import Counter
from pathlib import Path

p = Path('lib/data/newsroom-list.json')
data = json.loads(p.read_text(encoding='utf-8'))

new_entries = [
    # INDUSTRIAL — manufactura diversa
    {"name": "Seat (Volkswagen Group España)", "slug": "seat", "sector": "Industrial", "subsector": "Vehículos de motor", "cnae": "29.1", "region": "Cataluña", "newsroomUrl": "https://www.seat.es/sala-de-prensa.html", "rssUrl": "https://www.seat.es/rss/sala-prensa.xml"},
    {"name": "Renault España", "slug": "renault-espana", "sector": "Industrial", "subsector": "Vehículos de motor", "cnae": "29.1", "region": "Castilla y León", "newsroomUrl": "https://www.renault.es/actualidad/sala-de-prensa", "rssUrl": "https://www.renault.es/rss/prensa.xml"},
    {"name": "Stellantis Vigo (PSA)", "slug": "stellantis-vigo", "sector": "Industrial", "subsector": "Vehículos de motor", "cnae": "29.1", "region": "Galicia", "newsroomUrl": "https://www.stellantis.com/es/sala-de-prensa", "rssUrl": None},
    {"name": "Iberia (airline)", "slug": "iberia-airline", "sector": "Industrial", "subsector": "Otro material de transporte", "cnae": "30.3", "region": "Madrid", "newsroomUrl": "https://www.iberia.com/es/sala-comunicacion/", "rssUrl": None},
    {"name": "Navantia", "slug": "navantia", "sector": "Industrial", "subsector": "Otro material de transporte", "cnae": "30.1", "region": "Galicia", "newsroomUrl": "https://www.navantia.es/es/comunicacion/sala-prensa", "rssUrl": "https://www.navantia.es/feed"},
    {"name": "Talgo", "slug": "talgo", "sector": "Industrial", "subsector": "Otro material de transporte", "cnae": "30.2", "region": "Madrid", "newsroomUrl": "https://www.talgo.com/es/sala-prensa", "rssUrl": None},
    {"name": "CAF (Construcciones y Auxiliar de Ferrocarriles)", "slug": "caf", "sector": "Industrial", "subsector": "Otro material de transporte", "cnae": "30.2", "region": "País Vasco", "newsroomUrl": "https://www.caf.net/es/sala-prensa", "rssUrl": None},
    {"name": "Gestamp", "slug": "gestamp", "sector": "Industrial", "subsector": "Productos metálicos", "cnae": "25.1", "region": "Madrid", "newsroomUrl": "https://www.gestamp.com/sala-prensa", "rssUrl": None},
    {"name": "CIE Automotive", "slug": "cie-automotive", "sector": "Industrial", "subsector": "Productos metálicos", "cnae": "29.3", "region": "País Vasco", "newsroomUrl": "https://www.cieautomotive.com/sala-prensa", "rssUrl": None},
    {"name": "Tubacex", "slug": "tubacex", "sector": "Industrial", "subsector": "Metalurgia", "cnae": "24.2", "region": "País Vasco", "newsroomUrl": "https://www.tubacex.com/es/sala-prensa", "rssUrl": None},
    {"name": "Acerinox", "slug": "acerinox", "sector": "Industrial", "subsector": "Metalurgia", "cnae": "24.1", "region": "Madrid", "newsroomUrl": "https://www.acerinox.com/es/sala-prensa", "rssUrl": None},
    {"name": "ArcelorMittal España", "slug": "arcelormittal-espana", "sector": "Industrial", "subsector": "Metalurgia", "cnae": "24.1", "region": "Asturias", "newsroomUrl": "https://spain.arcelormittal.com/sala-de-prensa/", "rssUrl": None},
    {"name": "Ferroglobe (Grupo FerroAtlántica)", "slug": "ferroglobe", "sector": "Industrial", "subsector": "Metalurgia", "cnae": "24.4", "region": "Madrid", "newsroomUrl": "https://www.ferroglobe.com/news/", "rssUrl": None},
    {"name": "Bayer Hispania (Crop Science)", "slug": "bayer-hispania", "sector": "Industrial", "subsector": "Química", "cnae": "20.2", "region": "Cataluña", "newsroomUrl": "https://www.bayer.com/es/es/sala-de-prensa", "rssUrl": None},
    {"name": "BASF Española", "slug": "basf-espanola", "sector": "Industrial", "subsector": "Química", "cnae": "20.1", "region": "Cataluña", "newsroomUrl": "https://www.basf.com/es/es/media", "rssUrl": None},
    {"name": "Repsol Química", "slug": "repsol-quimica", "sector": "Industrial", "subsector": "Química", "cnae": "20.1", "region": "Madrid", "newsroomUrl": "https://www.repsol.com/es/sala-prensa/", "rssUrl": "https://www.repsol.com/rss/sala-prensa.xml"},
    {"name": "CEPSA Química", "slug": "cepsa-quimica", "sector": "Industrial", "subsector": "Química", "cnae": "20.1", "region": "Madrid", "newsroomUrl": "https://www.cepsa.com/es/sala-de-prensa", "rssUrl": None},
    {"name": "Solvay Iberia", "slug": "solvay-iberia", "sector": "Industrial", "subsector": "Química", "cnae": "20.1", "region": "Cataluña", "newsroomUrl": "https://www.solvay.com/en/media", "rssUrl": None},
    {"name": "Inditex (manufactura)", "slug": "inditex", "sector": "Industrial", "subsector": "Textil", "cnae": "14.1", "region": "Galicia", "newsroomUrl": "https://www.inditex.com/es/sala-prensa", "rssUrl": "https://www.inditex.com/rss/sala-prensa.xml"},
    {"name": "Mango (textil)", "slug": "mango", "sector": "Industrial", "subsector": "Textil", "cnae": "14.1", "region": "Cataluña", "newsroomUrl": "https://www.mango.com/es/sala-de-prensa", "rssUrl": None},
    {"name": "ENCE — Energía y Celulosa", "slug": "ence", "sector": "Industrial", "subsector": "Papel", "cnae": "17.1", "region": "Madrid", "newsroomUrl": "https://www.ence.com/es/sala-prensa", "rssUrl": None},
    {"name": "SAICA (papel y cartón)", "slug": "saica", "sector": "Industrial", "subsector": "Papel", "cnae": "17.1", "region": "Aragón", "newsroomUrl": "https://www.saica.com/es/sala-prensa", "rssUrl": None},
    {"name": "Smurfit Kappa España", "slug": "smurfit-kappa-espana", "sector": "Industrial", "subsector": "Papel", "cnae": "17.1", "region": "Madrid", "newsroomUrl": "https://www.smurfitkappa.com/es/sala-de-prensa", "rssUrl": None},

    # FARMACÉUTICO
    {"name": "Grifols", "slug": "grifols", "sector": "Farmaceutico", "subsector": "Preparados farmacéuticos", "cnae": "21.2", "region": "Cataluña", "newsroomUrl": "https://www.grifols.com/es/sala-prensa", "rssUrl": "https://www.grifols.com/rss/sala-prensa.xml"},
    {"name": "Almirall", "slug": "almirall", "sector": "Farmaceutico", "subsector": "Preparados farmacéuticos", "cnae": "21.2", "region": "Cataluña", "newsroomUrl": "https://www.almirall.com/es/sala-de-prensa", "rssUrl": "https://www.almirall.com/rss"},
    {"name": "Faes Farma", "slug": "faes-farma", "sector": "Farmaceutico", "subsector": "Preparados farmacéuticos", "cnae": "21.2", "region": "País Vasco", "newsroomUrl": "https://www.faesfarma.com/es/sala-prensa", "rssUrl": None},
    {"name": "Laboratorios Rovi", "slug": "rovi", "sector": "Farmaceutico", "subsector": "Preparados farmacéuticos", "cnae": "21.2", "region": "Madrid", "newsroomUrl": "https://www.rovi.es/es/sala-prensa", "rssUrl": "https://www.rovi.es/rss/sala-prensa.xml"},
    {"name": "Esteve (Grupo)", "slug": "esteve", "sector": "Farmaceutico", "subsector": "Principios activos", "cnae": "21.1", "region": "Cataluña", "newsroomUrl": "https://www.esteve.com/es/sala-prensa", "rssUrl": None},
    {"name": "Insud Pharma (Chemo Group)", "slug": "insud-pharma", "sector": "Farmaceutico", "subsector": "Principios activos", "cnae": "21.1", "region": "Madrid", "newsroomUrl": "https://www.insudpharma.com/sala-de-prensa", "rssUrl": None},
    {"name": "Reig Jofre", "slug": "reig-jofre", "sector": "Farmaceutico", "subsector": "Preparados farmacéuticos", "cnae": "21.2", "region": "Cataluña", "newsroomUrl": "https://www.reigjofre.com/es/sala-de-prensa", "rssUrl": None},
    {"name": "Normon (Laboratorios Normon)", "slug": "normon", "sector": "Farmaceutico", "subsector": "Preparados farmacéuticos", "cnae": "21.2", "region": "Madrid", "newsroomUrl": "https://www.normon.es/sala-prensa", "rssUrl": None},
    {"name": "Cinfa (Laboratorios Cinfa)", "slug": "cinfa", "sector": "Farmaceutico", "subsector": "Preparados farmacéuticos", "cnae": "21.2", "region": "Navarra", "newsroomUrl": "https://www.cinfa.com/sala-prensa", "rssUrl": None},
    {"name": "Viatris España", "slug": "viatris-espana", "sector": "Farmaceutico", "subsector": "Preparados farmacéuticos", "cnae": "21.2", "region": "Madrid", "newsroomUrl": "https://www.viatris.com/es-es/news", "rssUrl": None},

    # CONSTRUCCIÓN
    {"name": "ACS (Actividades de Construcción y Servicios)", "slug": "acs", "sector": "Construccion", "subsector": "Construcción de edificios", "cnae": "41.2", "region": "Madrid", "newsroomUrl": "https://www.grupoacs.com/sala-prensa/", "rssUrl": "https://www.grupoacs.com/rss/sala-prensa.xml"},
    {"name": "Ferrovial", "slug": "ferrovial", "sector": "Construccion", "subsector": "Ingeniería civil", "cnae": "42.2", "region": "Madrid", "newsroomUrl": "https://www.ferrovial.com/es/sala-prensa/", "rssUrl": "https://www.ferrovial.com/rss/"},
    {"name": "Acciona (construcción)", "slug": "acciona", "sector": "Construccion", "subsector": "Ingeniería civil", "cnae": "42.2", "region": "Madrid", "newsroomUrl": "https://www.acciona.com/es/sala-prensa/", "rssUrl": "https://www.acciona.com/rss/"},
    {"name": "OHLA (Obrascón Huarte Lain)", "slug": "ohla", "sector": "Construccion", "subsector": "Construcción de edificios", "cnae": "41.2", "region": "Madrid", "newsroomUrl": "https://www.ohla-group.com/sala-prensa/", "rssUrl": None},
    {"name": "FCC (Fomento de Construcciones y Contratas)", "slug": "fcc", "sector": "Construccion", "subsector": "Actividades de construcción especializadas", "cnae": "43.1", "region": "Madrid", "newsroomUrl": "https://www.fcc.es/es/sala-prensa", "rssUrl": None},
    {"name": "Sacyr", "slug": "sacyr", "sector": "Construccion", "subsector": "Ingeniería civil", "cnae": "42.2", "region": "Madrid", "newsroomUrl": "https://www.sacyr.com/es/sala-prensa", "rssUrl": None},

    # ENERGÉTICO
    {"name": "Iberdrola", "slug": "iberdrola", "sector": "Energetico", "subsector": "Energía eléctrica", "cnae": "35.1", "region": "País Vasco", "newsroomUrl": "https://www.iberdrola.com/sala-comunicacion", "rssUrl": "https://www.iberdrola.com/rss/noticias.xml"},
    {"name": "Endesa", "slug": "endesa", "sector": "Energetico", "subsector": "Energía eléctrica", "cnae": "35.1", "region": "Madrid", "newsroomUrl": "https://www.endesa.com/es/sala-de-prensa", "rssUrl": "https://www.endesa.com/rss/sala-prensa.xml"},
    {"name": "Naturgy (Gas Natural Fenosa)", "slug": "naturgy", "sector": "Energetico", "subsector": "Gas y vapor", "cnae": "35.2", "region": "Madrid", "newsroomUrl": "https://www.naturgy.com/es/sala-prensa", "rssUrl": "https://www.naturgy.com/rss/"},
    {"name": "Repsol (energía)", "slug": "repsol-energia", "sector": "Energetico", "subsector": "Refino de petróleo", "cnae": "19.2", "region": "Madrid", "newsroomUrl": "https://www.repsol.com/es/sala-prensa/", "rssUrl": "https://www.repsol.com/rss/sala-prensa.xml"},
    {"name": "Cepsa (energía)", "slug": "cepsa-energia", "sector": "Energetico", "subsector": "Refino de petróleo", "cnae": "19.2", "region": "Madrid", "newsroomUrl": "https://www.cepsa.com/es/sala-de-prensa", "rssUrl": None},
    {"name": "BP Energía España", "slug": "bp-energia-espana", "sector": "Energetico", "subsector": "Refino de petróleo", "cnae": "19.2", "region": "Madrid", "newsroomUrl": "https://www.bp.com/es_es/spain/sala-de-prensa.html", "rssUrl": None},
    {"name": "EDP España (HC Energía)", "slug": "edp-espana", "sector": "Energetico", "subsector": "Energía eléctrica", "cnae": "35.1", "region": "Asturias", "newsroomUrl": "https://www.edp.com/es/sala-de-prensa", "rssUrl": None},
    {"name": "Viesgo (Repsol Renovables)", "slug": "viesgo", "sector": "Energetico", "subsector": "Renovables", "cnae": "35.1", "region": "Cantabria", "newsroomUrl": "https://www.viesgo.com/es/sala-de-prensa", "rssUrl": None},
    {"name": "Acciona Energía", "slug": "acciona-energia", "sector": "Energetico", "subsector": "Renovables", "cnae": "35.1", "region": "Navarra", "newsroomUrl": "https://www.acciona-energia.com/es/sala-prensa/", "rssUrl": None},
]

existing_slugs = {e['slug'] for e in data}
to_add = [e for e in new_entries if e['slug'] not in existing_slugs]
data.extend(to_add)

p.write_text(json.dumps(data, ensure_ascii=False, indent=2), encoding='utf-8')

c = Counter([e['sector'] for e in data])
print('Total entries:', len(data))
print('Added:', len(to_add))
print('--- Por sector ---')
for k, v in c.most_common():
    print(f'  {k}: {v}')
