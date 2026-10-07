#!/usr/bin/env sh
# Empaqueta el tema en wordpress/ams-studio.zip, listo para
# WordPress → Apariencia → Temas → Añadir nuevo → Subir tema.
set -e
cd "$(dirname "$0")"
rm -f ams-studio.zip
zip -rq ams-studio.zip ams-studio -x 'ams-studio/node_modules/*' 'ams-studio/.gitignore'
echo "Creado: $(pwd)/ams-studio.zip"
