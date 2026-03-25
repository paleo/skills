// Template Payload Types
// These types describe the data available in Liquid templates

export type TpTemplatePayload = TpDetachedTemplatePayload | TpRegularTemplatePayload;

export interface TpDetachedTemplatePayload {
  site: TpSitePayload;
  doc: TpDetachedDocPayload;
}

export interface TpRegularTemplatePayload {
  site: TpSitePayload;
  doc: TpDocPayload;
}

export interface TpHomePayload {
  baseUrl: string;
  url: string;
  id: string;
  routing: TpRoutingClusterNode;
  language: string;
  languageLabel: string;
}

export interface TpSitePayload {
  kind: "site";
  fqdn: string;
  assetsUrl: string;
  field: { [fieldName: string]: unknown };
  home: TpHomePayload;
}

export interface TpClusterPayload {
  kind: "cluster";
  routing: TpRoutingClusterNode;
  /** Lazy loaded */
  parentCluster: TpClusterPayload | undefined;
}

export interface TpRoutingClusterNode extends TpOneDocumentLoadDescriptor {
  id: string;
  children: TpDocumentsLoadDescriptor | undefined;
  /**
   * TS forces us to declare all the types here but values will be only of type
   * `TpRoutingClusterNode`.
   */
  [typeName: string]: TpRoutingClusterNode | TpDocumentsLoadDescriptor | string | undefined;
}

export interface TpDetachedDocPayload {
  kind: "detached";
  typeName?: string;
  language?: string;
  languageLabel?: string;
  translations: TpDocTranslation[];
  id?: string;
  title?: string;
  urlQuery: TpUrlQuery | undefined;
  /** Lazy loaded */
  cluster: TpClusterPayload;
}

export interface TpDocValues {
  type: string;
  nodeId: string;
  language: string;
  relativeId: string;
  title?: string;
  slug?: string;
  publishDate: string;
  /** ISO 8601 formatted date string */
  updatedAt: string;
  metaDescription?: string;
  metaKeywords?: string;
}

export interface TpDocPayload extends TpDocValues {
  kind: "routingDocument" | "regularDocument" | "term";
  id: string;
  languageLabel: string;
  url: string;
  excerpt?: string;
  list: {
    [listName: string]: TpPart[];
  };
  listSize: {
    [listName: string]: number;
  };
  defaultImage?: TpImage;
  featuredImage?: TpImage;
  field: TpFieldValues;
  translations: TpDocTranslation[];
  og: TpOgValues;
  jsonLd: TpJsonLdPayload;
  breadcrumb: TpBreadcrumbItem[];
  parent?: TpOneDocumentLoadDescriptor;
  siblings: TpSiblingDocuments;
  typeLabel: string;
  urlQuery: TpUrlQuery | undefined;
  frontendAppPath: string | undefined;
  /**
   * Child routing document identifiers. Available on routing document only.
   */
  routing?: TpRoutingClusterNode;
  /** Lazy loaded */
  cluster: TpClusterPayload;
}

export interface TpDocTranslation extends TpOneDocumentLoadDescriptor {
  language: string;
  languageLabel: string;
  active: boolean;
  url: string;
}

export interface TpTerm extends TpOneDocumentLoadDescriptor {
  inRightLanguage: boolean;
  language: string;
  languageLabel: string;
  nodeId: string;
  /**
   * The term title is the term document title.
   */
  title?: string;
  url?: string;
}

export interface TpPartValues {
  type: string;
  relativeId: string;
  number: number;
  numberOfType: number;
  inRightLanguage: boolean;
  language: string;
  languageLabel: string;
  nodeId: string;
  publishDate: string;
}

export interface TpPart extends TpPartValues {
  kind: "part";
  id: string;
  defaultImage?: TpImage;
  featuredImage?: TpImage;
  field: TpFieldValues;
  typeLabel: string;
  parts?: TpPart[];
}

export interface TpOgValues {
  url: string;
  type?: string;
  image?: TpImageVariant;
  title?: string;
  siteName?: string;
  description?: string;
  locale?: string;
}

export type TpJsonLdPayload = Record<string, unknown>[];

export interface TpBreadcrumbItem extends TpOneDocumentLoadDescriptor {
  id: string;
  title?: string;
  url?: string;
}

export interface TpSiblingDocuments {
  previous?: TpOneDocumentLoadDescriptor;
  next?: TpOneDocumentLoadDescriptor;
}

export interface TpFieldValues {
  [fieldName: string]: string | number | boolean | object | undefined;
}

export type TpMedia = TpFile | TpImage;
export type TpSourceMedia = TpFile | TpSourceImage;
export type TpImage = TpSourceImage | TpImageVariant;

export interface TpMediaBase {
  mediaId: string;
  url: string;
  mediaType: string;
}

export interface TpSourceBase {
  isSource: true;
  weightB: number;
  originalName?: string;
  attachedData?: TpAttachedData;
}

export interface TpAttachedData {
  [propertyName: string]: string | number | boolean | object | undefined;
  caption?: string;
}

export interface TpImageBase {
  kind: "image";
  rawWidth: number;
  rawHeight: number;
  /** Rendered width. Its value is equals to `round(rawWidth / pixelRatio)`. */
  width: number;
  /** Rendered height. Its value is equals to `round(rawHeight / pixelRatio)`. */
  height: number;
  pixelRatio: number;
}

export interface TpFile extends TpMediaBase, TpSourceBase {
  kind: "file";
}

export interface TpSourceImage extends TpMediaBase, TpSourceBase, TpImageBase {}

export interface TpImageVariant extends TpMediaBase, TpImageBase {
  isSource: false;
}

export interface TpUrlQuery {
  [key: string]: undefined | string | TpUrlQuery | (string | TpUrlQuery)[];
}

/**
 * This type represents a load descriptor for multiple documents. The Liquid template can't access
 * any property of this type. But it can use it to request loading of multiple documents, using the
 * `docs` function, for example:
 * ```
 * {% set children = docs(doc.routing.children) %}
 * ```
 */
export interface TpDocumentsLoadDescriptor {
  __notARealProperty__: "__documents_descriptor__";
}

/**
 * This type represents a load descriptor for a single document. The Liquid template can't access
 * any property of this type. But it can use it to request loading of a single document, using the
 * `doc` function, for example:
 * ```
 * {% set next = doc(doc.siblings.next) %}
 * ```
 */
export interface TpOneDocumentLoadDescriptor {
  __notARealProperty__: "__one_document_descriptor__";
}
