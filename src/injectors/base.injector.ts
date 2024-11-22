import { Injectable } from '@nestjs/common';
import { ModulesContainer, MetadataScanner } from '@nestjs/core';
import { PATH_METADATA } from '@nestjs/common/constants';
import { trace, context, INVALID_SPAN_CONTEXT, SpanStatusCode, SpanKind } from '@opentelemetry/api';
import { TRACE_METADATA, TRACE_METADATA_ACTIVE } from '../constants';
import { TraceOptions } from '../interfaces';

@Injectable()
export class BaseInjector {
  protected static PATTERN_METADATA = 'microservices:pattern';
  protected metadataScanner = new MetadataScanner();

  constructor(protected modulesContainer: ModulesContainer) {}

  protected *getControllers() {
    for (const module of this.modulesContainer.values()) {
      for (const controller of module.controllers.values()) {
        if (controller && controller.metatype?.prototype) {
          yield controller;
        }
      }
    }
  }

  protected *getProviders() {
    for (const module of this.modulesContainer.values()) {
      for (const provider of module.providers.values()) {
        if (provider && provider.metatype?.prototype) {
          yield provider;
        }
      }
    }
  }

  protected isPath(target: any): boolean {
    return Reflect.hasMetadata(PATH_METADATA, target);
  }

  protected isPatten(target: any): boolean {
    return Reflect.hasMetadata(BaseInjector.PATTERN_METADATA, target);
  }

  protected isAffected(target: any): boolean {
    return Reflect.hasMetadata(TRACE_METADATA_ACTIVE, target);
  }

  protected isDecorated(target: any): boolean {
    return Reflect.hasMetadata(TRACE_METADATA, target);
  }

  protected reDecorate(source: any, destination: any): void {
    const keys = Reflect.getMetadataKeys(source);
    for (const key of keys) {
      const meta = Reflect.getMetadata(key, source);
      Reflect.defineMetadata(key, meta, destination);
    }
  }

  protected wrap(
    func: Function,
    traceName: string,
    spanOptions: TraceOptions = {},
    requireParentSpan = false,
    dynamicAttributesHook?: (context: { args: any[]; thisArg: any; parentSpan?: any }) => Record<string, any>
  ): Function {
    const method = {
      [func.name](...args: any[]) {
        const tracer = trace.getTracer('default');
        const ctx = context.active();
        const parentSpan = trace.getSpan(ctx);

        if (requireParentSpan && (!parentSpan || parentSpan.spanContext() === INVALID_SPAN_CONTEXT)) {
          return func.apply(this, args);
        }

        const span = tracer.startSpan(traceName, spanOptions, ctx);
        const contextWithSpan = trace.setSpan(ctx, span);

        return context.with(contextWithSpan, (currentSpan) => {
          if (dynamicAttributesHook) {
            currentSpan.setAttributes(dynamicAttributesHook({ args, thisArg: this, parentSpan }));
          }

          try {
            const result = func.apply(this, args);
            if (result instanceof Promise) {
              return result
                .then((res) => {
                  currentSpan.end();
                  return res;
                })
                .catch((error: Error) => BaseInjector.recordException(error, currentSpan));
            }
            currentSpan.end();
            return result;
          } catch (error) {
            if (error instanceof Error) {
              return BaseInjector.recordException(error, currentSpan);
            }
            return BaseInjector.recordException(new Error(String(error)), currentSpan);
          }
        }, undefined, span);
      },
    }[func.name];

    Reflect.defineMetadata(TRACE_METADATA, {
      ...spanOptions,
      name: traceName,
    }, method);
    
    this.affect(method);
    this.reDecorate(func, method);
    return method;
  }

  protected static recordException(error: Error, span: any): never {
    span.recordException(error);
    span.setStatus({ code: SpanStatusCode.ERROR, message: error.message });
    span.end();
    throw error;
  }

  protected affect(target: any): void {
    Reflect.defineMetadata(TRACE_METADATA_ACTIVE, true, target);
  }
} 