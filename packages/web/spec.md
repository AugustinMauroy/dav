# `@dav/web` Package Specification

## Overview

`@dav/web` provides core WebDAV client functionality with a clean Promise-based API. This package implements WebDAV protocol primitives that serve as the foundation for higher-level packages like `@dav/cal` and `@dav/card`.

## Core Functionality

The package provides a `WebDAVClient` class with the following core capabilities:

```ts
class WebDAVClient {
  constructor(options: {
    baseUrl: string;
    username?: string;
    password?: string;
    authType?: 'basic' | 'digest' | 'token';
    token?: string;
    headers?: Record<string, string>;
    timeout?: number;
  });

  // Core WebDAV methods
  propfind(path: string, depth?: 0 | 1 | 'infinity'): Promise<PropfindResponse>;
  proppatch(path: string, properties: WebDAVProperties): Promise<PropPatchResponse>;
  mkcol(path: string): Promise<Response>;
  delete(path: string): Promise<Response>;
  put(path: string, data: string | Uint8Array, contentType?: string): Promise<Response>;
  get(path: string): Promise<Response>;
  copy(source: string, destination: string, overwrite?: boolean): Promise<Response>;
  move(source: string, destination: string, overwrite?: boolean): Promise<Response>;
  lock(path: string, lockInfo: LockInfo): Promise<LockResponse>;
  unlock(path: string, lockToken: string): Promise<Response>;

  // Utility methods
  request(method: string, path: string, options?: RequestOptions): Promise<Response>;
  isAuthenticated(): boolean;
  getBaseUrl(): string;
}
```

Error Handling

```ts
class WebDAVError extends Error {
  constructor(message: string, public statusCode?: number, public response?: Response);
}
```

Response Types

```ts
interface PropfindResponse {
  resources: WebDAVResource[];
  status: number;
}

interface WebDAVResource {
  href: string;
  propstat: PropStat[];
  status?: string;
}

interface PropStat {
  prop: Record<string, any>;
  status: string;
}

interface LockResponse {
  lockToken: string;
  lockScope: 'exclusive' | 'shared';
  lockType: 'write';
  depth: 0 | 1 | 'infinity';
  owner?: string;
  timeout?: string;
}
```

XML Handling
WebDAV relies heavily on XML for request and response bodies:

```ts
// XML Utilities
function parseXML(xmlString: string): Document;
function createXMLDocument(rootElement?: string): Document;
function serializeXML(document: Document): string;
function createPropfindXML(props: string[]): Document;
function createProppatchXML(setProps?: Record<string, string>, removeProps?: string[]): Document;
function extractResourcesFromResponse(xmlDoc: Document): WebDAVResource[];
```

Helper Functions

> They may not needed but useful for higher-level packages:

```ts
// Path handling
function joinPaths(...paths: string[]): string;
function normalizePath(path: string): string;

// Authentication
function createBasicAuthHeader(username: string, password: string): string;
function createDigestAuthHeader(/* params */): string;
```

## Usage Example

```ts
const client = new WebDAVClient({
  baseUrl: 'https://example.com/dav/',
  username: 'user',
  password: 'pass'
});

// List files in directory
const resources = await client.propfind('/files/', 1);

// Create directory
await client.mkcol('/files/new-directory/');

// Upload file
await client.put('/files/document.txt', 'Hello, WebDAV!', 'text/plain');
```

## Extensibility

The `WebDAVClient` is designed to be extended by specific protocol implementations:

```ts
// Example of extension point for CalDAV/CardDAV
interface WebDAVClientOptions {
  // ... base options
  extensions?: WebDAVExtension[];
}

interface WebDAVExtension {
  name: string;
  initialize(client: WebDAVClient): void;
  processRequest?(method: string, path: string, options: RequestOptions): RequestOptions;
  processResponse?(response: Response, method: string, path: string): Promise<Response>;
}
```

This specification provides the foundational WebDAV functionality that both `@dav/cal` and `@dav/card` can build upon while keeping the core WebDAV operations isolated and reusable.
