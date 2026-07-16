# StackEdit

[![CI](https://github.com/benweet/stackedit/actions/workflows/ci.yml/badge.svg)](https://github.com/benweet/stackedit/actions/workflows/ci.yml) [![NPM version](https://img.shields.io/npm/v/stackedit.svg?style=flat)](https://www.npmjs.org/package/stackedit)

> Full-featured, open-source Markdown editor based on PageDown, the Markdown library used by Stack Overflow and the other Stack Exchange sites.

https://stackedit.io/

### Ecosystem

- [Chrome app](https://chrome.google.com/webstore/detail/iiooodelglhkcpgbajoejffhijaclcdg)
- NEW! Embed StackEdit in any website with [stackedit.js](https://github.com/benweet/stackedit.js)
- NEW! [Chrome extension](https://chrome.google.com/webstore/detail/ajehldoplanpchfokmeempkekhnhmoha) that uses stackedit.js
- [Community](https://community.stackedit.io/)

### Build

```bash
# install dependencies
npm install

# serve with hot reload at localhost:8080
npm start

# build for production with minification and initial bundle-size checks
npm run build

# build for production and view the bundle analyzer report
npm run build --report
```

### Deploy with Helm

StackEdit Helm chart allows easy StackEdit deployment to any Kubernetes cluster.
You can use it to configure deployment with your existing ingress controller and cert-manager.

```bash
# Add the StackEdit Helm repository
helm repo add stackedit https://benweet.github.io/stackedit-charts/

# Update your local Helm chart repository cache
helm repo update

# Store server-side credentials outside the Helm values and shell history
kubectl create secret generic stackedit-secrets \
  --from-literal=githubClientSecret="$GITHUB_CLIENT_SECRET" \
  --from-literal=wordpressSecret="$WORDPRESS_CLIENT_SECRET"

# Deploy StackEdit chart to your cluster
helm install stackedit stackedit/stackedit \
  --set existingSecret=stackedit-secrets \
  --set dropboxAppKey=$DROPBOX_API_KEY \
  --set dropboxAppKeyFull=$DROPBOX_FULL_ACCESS_API_KEY \
  --set googleClientId=$GOOGLE_CLIENT_ID \
  --set googleApiKey=$GOOGLE_API_KEY \
  --set githubClientId=$GITHUB_CLIENT_ID \
  --set wordpressClientId=\"$WORDPRESS_CLIENT_ID\"
```

PDF and Pandoc exports only fetch remote resources from `stackedit.io` by default.
Add trusted image or stylesheet hosts with `--set exportRemoteHosts="stackedit.io,assets.example.com"`.
Using `*` allows any public address and is not recommended for internet-facing deployments.

Later, to upgrade StackEdit to the latest version:

```bash
helm repo update
helm upgrade stackedit stackedit/stackedit
```

If you want to uninstall StackEdit:

```bash
helm delete stackedit
```

If you want to use your existing ingress controller and cert-manager issuer:

```bash
# See https://docs.cert-manager.io/en/latest/tutorials/acme/quick-start/index.html
helm install stackedit stackedit/stackedit \
  --set existingSecret=stackedit-secrets \
  --set dropboxAppKey=$DROPBOX_API_KEY \
  --set dropboxAppKeyFull=$DROPBOX_FULL_ACCESS_API_KEY \
  --set googleClientId=$GOOGLE_CLIENT_ID \
  --set googleApiKey=$GOOGLE_API_KEY \
  --set githubClientId=$GITHUB_CLIENT_ID \
  --set wordpressClientId=\"$WORDPRESS_CLIENT_ID\" \
  --set ingress.enabled=true \
  --set ingress.annotations."kubernetes\.io/ingress\.class"=nginx \
  --set ingress.annotations."cert-manager\.io/cluster-issuer"=letsencrypt-prod \
  --set ingress.hosts[0].host=stackedit.example.com \
  --set ingress.hosts[0].paths[0]=/ \
  --set ingress.tls[0].secretName=stackedit-tls \
  --set ingress.tls[0].hosts[0]=stackedit.example.com
```
