# Backup GitHub

A little script to backup github repos (only includes repos created by user) to my person gitea.

All params are passed by env variables:

- `GITHUB_TOKEN`: required, github personal token
- `GITEA_TOKEN`: required, gitea personal token
- `GITEA_DOMAMIN`: required, gitea domain url, e.g. http://tea.cjting.me
- `GITHUB_PROXY`: optional, if passwd, will use this proxy to clone github repos

Usage:

```bash
# clone this repo
$ git clone ..
# run backup.js
$ GITHUB_TOKEN=xxx GITEA_TOKEN=xxx GITEA_DOMAIN=xxx node backup.js
```

