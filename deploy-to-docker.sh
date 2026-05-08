#!/bin/bash
# deploy-to-docker.sh — 使用社群標準 update-prd.sh 部署外掛
set -e

CONTAINER=idempiere-appointment-idempiere-1
IDEMPIERE_HOME=/opt/idempiere
PLUGIN_NAME=com.mxp.idempiere.appointments
P2_REPO=/mnt/plugin-src/${PLUGIN_NAME}.p2/target/repository

echo "=== Step 1: Build plugin (p2 repository) ==="
docker exec -u root $CONTAINER bash -c "
  export JAVA_HOME=/usr/lib/jvm/java-17-openjdk-amd64
  cd /mnt/plugin-src
  /mnt/idempiere-src/mvnw verify -q \
    -Didempiere.core.repository.url=file:///mnt/idempiere-src/org.idempiere.p2/target/repository
"
echo "✅ Build successful"

echo ""
echo "=== Step 2: Install via update-prd.sh (p2 director) ==="
docker exec -u root $CONTAINER bash -c "
  cd ${IDEMPIERE_HOME}
  ./update-prd.sh file://${P2_REPO} ${PLUGIN_NAME}
"
echo "✅ Plugin installed"

echo ""
echo "=== Step 3: Restart iDempiere ==="
docker compose restart idempiere
echo "Waiting for iDempiere to be ready..."
for i in $(seq 1 24); do
  sleep 10
  if curl -sf http://localhost:9080/webui/ > /dev/null 2>&1; then
    echo "✅ iDempiere ready (${i}x10s)"
    break
  fi
  if [ $i -eq 24 ]; then
    echo "❌ Timeout"
    docker logs --tail 30 $CONTAINER
    exit 1
  fi
done

echo ""
echo "=== Step 4: Verify ==="
HTTP_CODE=$(curl -sf -o /dev/null -w "%{http_code}" http://localhost:9080/appointment/web/appointments/index.html)
echo "SPA index.html: HTTP $HTTP_CODE"

echo ""
echo "=== Done ==="
echo "Access iDempiere: http://localhost:9080/webui/"
echo "Default login: GardenAdmin / GardenAdmin"
