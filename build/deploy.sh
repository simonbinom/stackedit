#!/bin/bash
set -e

BUILD_DIR=${GITHUB_WORKSPACE:-$TRAVIS_BUILD_DIR}
RELEASE_TAG=${GITHUB_REF_NAME:-$TRAVIS_TAG}
CHARTS_TOKEN=${CHARTS_GITHUB_TOKEN:-$GITHUB_TOKEN}

: "${BUILD_DIR:?Missing build directory}"
: "${RELEASE_TAG:?Missing release tag}"
: "${DOCKER_PASSWORD:?Missing DOCKER_PASSWORD}"
: "${CHARTS_TOKEN:?Missing CHARTS_GITHUB_TOKEN or GITHUB_TOKEN}"

# Tag and push docker image
echo "$DOCKER_PASSWORD" | docker login -u benweet --password-stdin
docker tag benweet/stackedit "benweet/stackedit:$RELEASE_TAG"
docker push benweet/stackedit:$RELEASE_TAG
docker tag benweet/stackedit:$RELEASE_TAG benweet/stackedit:latest
docker push benweet/stackedit:latest

# Build the chart
cd "$BUILD_DIR"
npm run chart

# Add chart to helm repository
git clone --branch master "https://benweet:$CHARTS_TOKEN@github.com/benweet/stackedit-charts.git" /tmp/charts
cd /tmp/charts
helm package "$BUILD_DIR/dist/stackedit"
helm repo index --url https://benweet.github.io/stackedit-charts/ .
git config user.name "Benoit Schweblin"
git config user.email "benoit.schweblin@gmail.com"
git add .
git commit -m "Added $RELEASE_TAG"
git push origin master
