import { SetMetadata } from '@nestjs/common';
import { TRACE_METADATA } from '../constants';
import { TraceOptions } from '../interfaces';
import { MetadataScanner } from '@nestjs/core';
import { Logger } from '@nestjs/common';
import { BaseInjector } from '../injectors/base.injector';

export function Trace(optionsOrName?: string | TraceOptions): MethodDecorator & ClassDecorator {
  const options = typeof optionsOrName === 'string'
    ? { name: optionsOrName }
    : optionsOrName ?? {};
    
  return SetMetadata(TRACE_METADATA, options);
}

const metadataScanner = new MetadataScanner();
const logger = new Logger('TracePlain');

export function TracePlain(optionsOrName?: string | TraceOptions): MethodDecorator & ClassDecorator {
  const options = typeof optionsOrName === 'string'
    ? { name: optionsOrName }
    : optionsOrName ?? {};

  return (target: any, propertyKey?: string | symbol, descriptor?: TypedPropertyDescriptor<any>) => {
    const prototype = typeof target === 'function' ? target.prototype : target;
    const injector = BaseInjector.prototype;

    if (descriptor) {
      if (!injector['isAffected'](descriptor.value)) {
        const name = `Class -> ${prototype.constructor.name}.${String(propertyKey)}`;
        descriptor.value = injector['wrap'](descriptor.value, name, options);
        logger.log(`Mapped ${name}`);
      }
      return descriptor;
    }

    const keys = metadataScanner.getAllMethodNames(prototype);
    for (const key of keys) {
      if (!injector['isAffected'](prototype[key])) {
        const name = `Class -> ${prototype.constructor.name}.${key}`;
        prototype[key] = injector['wrap'](prototype[key], name);
        logger.log(`Mapped ${name}`);
      }
    }
    return target;
  };
} 