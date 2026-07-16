# StackEdit

[![CI](https://github.com/simonbinom/stackedit/actions/workflows/ci.yml/badge.svg)](https://github.com/simonbinom/stackedit/actions/workflows/ci.yml)

> Full-featured, open-source Markdown editor based on PageDown, the Markdown library used by Stack Overflow and the other Stack Exchange sites.

[Open StackEdit](https://stackedit.io/)

To embed the editor in another website, use [stackedit.js](https://github.com/benweet/stackedit.js).

## Development

StackEdit requires Node.js 22 or newer and npm 10 or newer.

```bash
# install the locked dependency tree
npm ci --legacy-peer-deps

# serve with hot reload at localhost:8080
npm start

# run JavaScript and style linting plus unit tests
npm test

# create the production bundles and enforce initial bundle-size limits
npm run build

# create a production build and open the bundle analyzer
npm run build --report
```

The client uses Vue 3, Vuex 4, Webpack 5, and Workbox. The production runtime is a small Express server on Node.js 22; it serves the app and handles OAuth token exchange, sponsorship data, and PDF/Pandoc exports.

## Deploy with Helm

Tagged releases publish a matching multi-architecture image and OCI Helm chart to the GitHub Container Registry. OCI charts do not require `helm repo add`.

```bash
export STACKEDIT_VERSION=5.15.5

# keep server-side credentials out of Helm values and shell history
kubectl create secret generic stackedit-secrets \
  --from-literal=githubClientSecret="${GITHUB_CLIENT_SECRET}"

helm upgrade --install stackedit \
  oci://ghcr.io/simonbinom/charts/stackedit \
  --version "${STACKEDIT_VERSION}" \
  --set existingSecret=stackedit-secrets \
  --set dropboxAppKey="${DROPBOX_API_KEY}" \
  --set dropboxAppKeyFull="${DROPBOX_FULL_ACCESS_API_KEY}" \
  --set googleClientId="${GOOGLE_CLIENT_ID}" \
  --set googleApiKey="${GOOGLE_API_KEY}" \
  --set githubClientId="${GITHUB_CLIENT_ID}" \
  --set wordpressClientId="${WORDPRESS_CLIENT_ID}"
```

The existing Kubernetes secret may also contain the optional `awsAccessKeyId` and `awsSecretAccessKey` keys used for sponsorship data.

Server-side PDF and Pandoc exports use these safeguards:

| Helm value | Default | Purpose |
| --- | ---: | --- |
| `exportMaxConcurrent` | `2` | Maximum number of converter processes running at once |
| `exportMaxInputBytes` | `5242880` | Maximum request size in bytes |
| `exportRemoteHosts` | `stackedit.io` | Comma-separated allowlist for remote images and stylesheets |
| `exportTimeoutMs` | `50000` | Converter timeout in milliseconds |

Add required remote hosts with, for example, `--set exportRemoteHosts="stackedit.io,assets.example.com"`. Wildcard subdomains such as `*.example.com` are supported. `*` allows every public host and is not recommended for internet-facing deployments; private and reserved IP addresses remain blocked.

To enable an existing ingress controller and cert-manager issuer:

```bash
# See https://cert-manager.io/docs/tutorials/acme/nginx-ingress/
helm upgrade stackedit \
  oci://ghcr.io/simonbinom/charts/stackedit \
  --version "${STACKEDIT_VERSION}" \
  --reuse-values \
  --set ingress.enabled=true \
  --set 'ingress.annotations.kubernetes\.io/ingress\.class=nginx' \
  --set 'ingress.annotations.cert-manager\.io/cluster-issuer=letsencrypt-prod' \
  --set 'ingress.hosts[0].host=stackedit.example.com' \
  --set 'ingress.hosts[0].paths[0]=/' \
  --set 'ingress.tls[0].secretName=stackedit-tls' \
  --set 'ingress.tls[0].hosts[0]=stackedit.example.com'
```

To remove the release:

```bash
helm uninstall stackedit
```
