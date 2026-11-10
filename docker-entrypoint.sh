#!/bin/sh
set -eu

: "${DIRECT_URL:?DIRECT_URL não definida ou vazia}"
: "${DATABASE_URL:?DATABASE_URL não definida ou vazia}"

echo "Aplicando migrations..."
./node_modules/.bin/prisma migrate deploy

echo "Migrations concluídas. Iniciando servidor..."
exec node dist/main.js
