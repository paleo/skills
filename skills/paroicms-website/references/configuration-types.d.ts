// Configuration Types
// These types describe the structure of config.json

export type JtConfiguration = JtSingleSiteConfiguration | JtMultisiteConfiguration;

export interface JtConfigurationBase {
  /**
   * It is required.
   */
  port?: number;
  hostname?: string;
  /**
   * Default is `"http"`.
   */
  publicProtocol?: "http" | "https";
  publicPort?: number;
  adminUiPort?: number;

  allowRobots: boolean;
  enableCache?: boolean;
  immutableAssets?: boolean;
  /**
   * For example: `"14d"`.
   */
  cacheTimeToIdle?: string | "disabled" | "infinite";
  clearCacheAfterStart?: boolean;
  clearImageCacheAfterStart?: boolean;
  logLevel?: "silent" | "error" | "warn" | "info" | "stats" | "debug" | "trace";
  /**
   * Omit for stdout.
   */
  logFile?: string;
  graphqlDevTools?: boolean;
  generateMissingDatabases?: boolean;
  googleAuth?: JtGoogleAuthConf;
  imageProcessor?: JtImageProcessorConf;
  localDevAccount?: JtLocalDevAccountConf;
  platformAdminAccounts?: JtPlatformAdminAccountConf[];
  plugins?: JtPluginStaticConfiguration[];
  httpRedirections?: JtHttpRedirection[];
}

export interface JtHttpRedirection {
  fromFqdn: string;
  to: string;
  mapPaths?: {
    [fromRegex: string]: string;
  };
  preservePath?: boolean;
}

export interface JtSingleSiteConfiguration extends JtConfigurationBase {
  singleSite: JtSingleSiteConf;
}

export interface JtMultisiteConfiguration extends JtConfigurationBase {
  platform: {
    dataDir: string;
  };
  sitePacks: JtSitePackConf[];
}

export interface JtSingleSiteConf {
  siteDir: string;
  dataDir: string;
  cacheDir: string;
  backupDir: string;
  fqdn: string;
  redirectWww?: boolean;
  /* Default value is `true`. */
  trusted?: boolean;
  /** Enable auto-login via URL parameter (unsafe, for dev/demo sites only) */
  allowUnsafeLogin?: boolean;
}

export type JtSitePackConf = JtFqdnSitePackConf | JtSubDomainSitePackConf;

export interface JtSitePackConfBase {
  packName: string;
  sitesDir?: string;
  dataDir: string;
  cacheDir: string;
  backupDir: string;
  redirectWww?: boolean;
  /* Default value is `true`. */
  trusted?: boolean;
  /** Enable auto-login via URL parameter (unsafe, for dev/demo sites only) */
  allowUnsafeLogin?: boolean;
}

export interface JtFqdnSitePackConf extends JtSitePackConfBase {
  serveOn: "fqdn";
}

export interface JtSubDomainSitePackConf extends JtSitePackConfBase {
  serveOn: "subDomain";
  parentDomain: string;
}

export interface JtGoogleAuthConf {
  disabled?: boolean;
  fqdn: string;
  clientId: string;
  clientSecret: string;
}

export interface JtImageProcessorConf {
  cpuCoresPerFile?: number;
  allowConcurrency?: boolean;
}

export interface JtLocalDevAccountConf {
  email: string;
  name: string;
  password: string;
}

export interface JtPlatformAdminAccountConf {
  email: string;
  name: string;
}

export interface JtPluginStaticConfiguration {
  name: string;
  disabled?: boolean;
  platform?: boolean;
  configuration?: {
    [key: string]: unknown;
  };
}
