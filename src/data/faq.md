**Where is my data stored?**

If your workspace is not synced, your files are stored inside your browser and nowhere else.

We recommend syncing your workspace to make sure files won't be lost in case your browser data is cleared. Self-hosted CouchDB or GitLab backends are well suited for privacy.

**Can StackEdit access my data without telling me?**

StackEdit stores provider access tokens in your browser and calls provider APIs directly. The StackEdit server does not persist those tokens or your documents. GitHub is the exception during sign-in: the browser sends the short-lived authorization code to the StackEdit server, which exchanges it for an access token and immediately returns it to the browser.
