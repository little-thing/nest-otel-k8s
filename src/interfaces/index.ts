import { SpanKind } from '@opentelemetry/api';
import { Type } from '@nestjs/common';
import { ModuleMetadata } from '@nestjs/common/interfaces';

export interface TraceOptions {
  name?: string;
  attributes?: Record<string, any>;
  kind?: SpanKind;
  root?: boolean;
}

export interface OpenTelemetryModuleOptions {
  autoInjectors?: Type<any>[];
  injectorsConfig?: Record<string, any>;
}

export interface OpenTelemetryModuleAsyncOptions extends Pick<ModuleMetadata, 'imports'> {
  useFactory: (...args: any[]) => Promise<OpenTelemetryModuleOptions> | OpenTelemetryModuleOptions;
  inject?: any[];
}

export interface EnhancerInfo {
  metadataKey: string;
  methodKey: string;
  traceName: string;
  globalToken: string | symbol;
} 