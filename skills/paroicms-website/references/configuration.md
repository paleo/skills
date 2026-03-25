# Configuration Reference

The `config.json` file configures the ParoiCMS server for standalone websites.

## Basic Configuration

```json
{
  "port": 8080,
  "allowRobots": false,
  "enableCache": false,
  "singleSite": {
    "siteDir": ".",
    "dataDir": "data",
    "cacheDir": "cache",
    "backupDir": "backup",
    "fqdn": "localhost"
  },
  "localDevAccount": {
    "email": "dev@localhost",
    "password": "dev",
    "name": "Developer"
  }
}
```

## Server Properties

| Property | Type | Default | Description |
|----------|------|---------|-------------|
| `port` | `number` | - | Server port |
| `hostname` | `string` | - | Hostname to bind to |
| `publicProtocol` | `"http" \| "https"` | `"http"` | Public URL protocol |
| `publicPort` | `number` | - | Public port (if different from `port`) |
| `adminUiPort` | `number` | - | Admin UI port (if separate) |

## Site Properties

| Property | Type | Default | Description |
|----------|------|---------|-------------|
| `allowRobots` | `boolean` | - | Allow search engine indexing |
| `enableCache` | `boolean` | - | Enable response caching |
| `immutableAssets` | `boolean` | - | Assets are immutable (long cache) |
| `cacheTimeToIdle` | `string` | - | Cache idle timeout (e.g., `"14d"`) |
| `clearCacheAfterStart` | `boolean` | - | Clear cache on startup |
| `clearImageCacheAfterStart` | `boolean` | - | Clear image cache on startup |
| `generateMissingDatabases` | `boolean` | - | Auto-create databases |

## Logging

| Property | Type | Description |
|----------|------|-------------|
| `logLevel` | `string` | `"silent"`, `"error"`, `"warn"`, `"info"`, `"stats"`, `"debug"`, `"trace"` |
| `logFile` | `string` | Log file path (omit for stdout) |

## Single Site Configuration

For standalone websites:

```json
{
  "singleSite": {
    "siteDir": ".",
    "dataDir": "data",
    "cacheDir": "cache",
    "backupDir": "backup",
    "fqdn": "localhost",
    "redirectWww": false,
    "trusted": true,
    "allowUnsafeLogin": false
  }
}
```

| Property | Type | Default | Description |
|----------|------|---------|-------------|
| `siteDir` | `string` | - | Website directory path |
| `dataDir` | `string` | - | Database directory |
| `cacheDir` | `string` | - | Cache directory |
| `backupDir` | `string` | - | Backup directory |
| `fqdn` | `string` | - | Fully qualified domain name |
| `redirectWww` | `boolean` | - | Redirect www to non-www |
| `trusted` | `boolean` | `true` | Trust the site |
| `allowUnsafeLogin` | `boolean` | - | Allow URL parameter login (dev only) |

## Multisite Configuration

For hosting multiple sites:

```json
{
  "platform": {
    "dataDir": "/var/paroicms/platform"
  },
  "sitePacks": [
    {
      "packName": "main",
      "serveOn": "fqdn",
      "sitesDir": "/var/paroicms/sites",
      "dataDir": "/var/paroicms/data",
      "cacheDir": "/var/paroicms/cache",
      "backupDir": "/var/paroicms/backup"
    },
    {
      "packName": "demo",
      "serveOn": "subDomain",
      "parentDomain": "demo.example.com",
      "sitesDir": "/var/paroicms/demo-sites",
      "dataDir": "/var/paroicms/demo-data",
      "cacheDir": "/var/paroicms/demo-cache",
      "backupDir": "/var/paroicms/demo-backup"
    }
  ]
}
```

## Authentication

### Local Dev Account

For development, create a local account:

```json
{
  "localDevAccount": {
    "email": "dev@localhost",
    "password": "dev",
    "name": "Developer"
  }
}
```

### Google OAuth

For production with Google authentication:

```json
{
  "googleAuth": {
    "fqdn": "example.com",
    "clientId": "xxx.apps.googleusercontent.com",
    "clientSecret": "xxx"
  }
}
```

### Platform Admin Accounts

Grant admin access to specific emails:

```json
{
  "platformAdminAccounts": [
    { "email": "admin@example.com", "name": "Admin" }
  ]
}
```

## Image Processing

```json
{
  "imageProcessor": {
    "cpuCoresPerFile": 2,
    "allowConcurrency": true
  }
}
```

## Plugin Configuration

Configure plugins at the server level:

```json
{
  "plugins": [
    {
      "name": "@paroicms/contact-form-plugin",
      "configuration": {
        "googleRecaptchaSiteKey": "xxx",
        "googleRecaptchaSecretKey": "xxx"
      }
    },
    {
      "name": "@paroicms/send-mail-aws-ses-plugin",
      "configuration": {
        "from": "noreply@example.com",
        "accessKeyId": "xxx",
        "secretAccessKey": "xxx",
        "region": "eu-west-3"
      }
    }
  ]
}
```

## HTTP Redirections

Redirect domains:

```json
{
  "httpRedirections": [
    {
      "fromFqdn": "old-domain.com",
      "to": "https://new-domain.com",
      "preservePath": true
    },
    {
      "fromFqdn": "legacy.com",
      "to": "https://example.com",
      "mapPaths": {
        "^/old-path/(.*)$": "/new-path/$1"
      }
    }
  ]
}
```

## Development Configuration Example

```json
{
  "port": 8080,
  "allowRobots": false,
  "enableCache": false,
  "logLevel": "debug",
  "generateMissingDatabases": true,
  "graphqlDevTools": true,
  "singleSite": {
    "siteDir": ".",
    "dataDir": "data",
    "cacheDir": "cache",
    "backupDir": "backup",
    "fqdn": "localhost"
  },
  "localDevAccount": {
    "email": "dev@localhost",
    "password": "dev",
    "name": "Developer"
  }
}
```

## Production Configuration Example

```json
{
  "port": 3000,
  "publicProtocol": "https",
  "allowRobots": true,
  "enableCache": true,
  "immutableAssets": true,
  "cacheTimeToIdle": "14d",
  "logLevel": "info",
  "singleSite": {
    "siteDir": "/var/www/mysite",
    "dataDir": "/var/data/mysite",
    "cacheDir": "/var/cache/mysite",
    "backupDir": "/var/backup/mysite",
    "fqdn": "www.example.com",
    "redirectWww": true
  },
  "googleAuth": {
    "fqdn": "www.example.com",
    "clientId": "xxx.apps.googleusercontent.com",
    "clientSecret": "xxx"
  },
  "plugins": [
    {
      "name": "@paroicms/send-mail-aws-ses-plugin",
      "configuration": {
        "from": "noreply@example.com",
        "accessKeyId": "xxx",
        "secretAccessKey": "xxx",
        "region": "eu-west-3"
      }
    }
  ]
}
```

See [configuration-types.d.ts](configuration-types.d.ts) for complete TypeScript definitions.
