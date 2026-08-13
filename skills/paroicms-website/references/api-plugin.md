# Remote API (`@paroicms/api-plugin`) and the `paroicms` CLI

A PAT-protected HTTP API over the whole content surface, for scripts, migrations, and automation against a running site. The plugin package ships the `paroicms` bin as its reference client (note: the server bin is `paroicms-server`).

## Setup and authentication

```json
{
  "plugins": ["@paroicms/api-plugin"]
}
```

Authentication is a Personal Access Token, created in the Admin UI (User Settings → Personal Access Tokens). On a dev site with `allowUnsafeLogin`, the CLI creates one itself (such dev tokens are ignored on sites where `allowUnsafeLogin` is off):

```sh
export PAROICMS_SITE_URL="http://localhost:8080"
export PAROICMS_PAT=$(npx paroicms get-pat --email "dev@localhost" --password "init")
```

Every command and HTTP call targets the site from `PAROICMS_SITE_URL` / `PAROICMS_PAT`, or `--site <url>` / `--token <t>` per command. The connector is PAT-scoped: calls fail with the PAT owner's permissions, unlike a backend plugin's unsafe connector.

## CLI

```sh
npx paroicms --help      # full command surface
npx paroicms guide       # self-contained primer: site structure, schema typing, field value formats
```

Commands (arguments abridged): `info`, `schema`, `cluster <nodeId> <typeName>`, `search`, `get <documentId>`, `create <parentLNodeId> <typeName>`, `create-part <parentLNodeId> <typeName>`, `translate`, `translate-part`, `update <documentId>`, `set-fields <lNodeId> <JSON|->`, `set-site-fields`, `publish <documentId> [--date <ISO>]`, `unpublish`, `move`, `delete <documentId>`, `set-media <file> <media-selector> [--replace]`, `delete-media <media-selector> [--media-id <id>]`, `create-account`, `remove-site --force`, `get-pat`.

```sh
npx paroicms get "12:fr"
npx paroicms create "3:fr" post --title "Hello" --values '{"htmlContent": "Some **markdown**."}'
npx paroicms set-fields "12:fr" '{"status": "closed"}'
npx paroicms publish "12:fr" --date "2026-01-01T00:00:00Z"
npx paroicms set-media ./photo.jpg --field "12:fr" gallery --attached-data '{"fr": {"caption": "Une légende"}}'
```

JSON arguments accept an inline string or `-` for stdin.

**Field value formats** (`set-fields`, `--values`, `updateFields`…): simple fields take plain scalars; rich text (tiptap/quill) takes a **Markdown** string, converted on save; labeling fields take `{"t": ["<termNodeId>", …]}`; JSON fields take `{"j": <value>}`; `null` clears a field.

**Media selectors** (`set-media` / `delete-media`), exactly one of:

```text
--featured-image <nodeId> | --field <lNodeId> <fieldName> | --site-field <fieldName>
```

## HTTP protocol

POST to `{site}/api/plugin/api-plugin` with `Authorization: Bearer <PAT>` and a JSON body `{"action": "...", "payload": {...}}`. Response envelope: `{"success": true, "data": ...}` or `{"success": false, "error": "...", "code"?: N}`. Payloads are strictly validated (unknown properties rejected).

Payload shapes (`?` = optional; source of truth: `plugins/api-plugin/backend/src/api-request-types.ts` in the ParoiCMS repo):

| Action | Payload |
| --- | --- |
| `getSiteInfo`, `loadSiteSchemaAndIds`, `removeSite` | none |
| `loadRoutingClusterFromNode` | `{nodeId, typeName}` |
| `searchDocuments` | `{language, words: [...], limit?, offset?}` |
| `getDocument`, `unpublishDocument`, `deleteDocument` | `{documentId}` |
| `publishDocument` | `{documentId, publishDate?}` |
| `updateDocument` | `{documentId, values: {title?, slug?, metaDescription?, metaKeywords?}}` |
| `updateFields` | `{lNodeId, values}` |
| `createDocument` | `{parentLNodeId, typeName, title?, slug?, relativeId?, values?}` |
| `createPart` | `{parentLNodeId, typeName, publishDate?, values?}` |
| `createDocumentTranslation` | `{nodeId, language, title?, slug?, values?}` |
| `createPartTranslation` | `{nodeId, language, values?}` |
| `updateSiteFields` | `{language, values}` |
| `moveDocument` | `{documentNodeId, newParentNodeId}` |
| `setMedia` | `{selector, fileName, dataBase64, attachedData?, replace?}` |
| `deleteMedia` | `{selector, mediaId?}` |
| `createAccount` | `{email, name, roles?, kind?, language?}` |

A media `selector` is one of `{kind: "featuredImage", nodeId}`, `{kind: "field", lNodeId, fieldName}`, `{kind: "siteField", fieldName}`.

## Behavior notes

- `createDocument` / `createDocumentTranslation` create the document **ready** (not a draft). Control the state explicitly afterwards: `unpublish` for a draft, `publish --date` for a specific date (omitted date = stamped now). The EDVL migration script does exactly this for every document.
- Writes go through the normal save pipeline: `updateFields` converts Markdown for rich-text fields and fires backend `afterSaveValues` hooks (see [custom-plugins.md](custom-plugins.md)) — useful to exercise a lifecycle hook without the Admin UI.
- `setMedia` **appends** by default; pass `replace: true` (CLI `--replace`) to replace. Without it, a single-media field ends up with two handles and `deleteMedia` + `mediaId` is needed to remove the extra one.
- `setMedia` sniffs the media type from the `fileName` extension — a name without a real extension fails with `Cannot determine media type`.
- The media store deduplicates by content: uploading identical bytes twice yields one media (same id and URL) with several handles. Deleting the last handle garbage-collects the media row.
- There is no part-deletion action (`deleteDocument` takes a `documentId`); delete parts in the Admin UI.
