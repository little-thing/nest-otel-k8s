import { Injectable, Logger, Scope } from '@nestjs/common';
import { BaseInjector } from './base.injector';
import { AttributeNames, ProviderScope, TRACE_METADATA } from '../constants';

@Injectable()
export class DecoratorInjector extends BaseInjector {
  private readonly logger = new Logger(DecoratorInjector.name);

  inject(): void {
    this.injectProviders();
    this.injectControllers();
  }

  private injectProviders(): void {
    const providers = this.getProviders();
    for (const provider of providers) {
      const classDecorated = this.isDecorated(provider.metatype);
      const prototype = provider.metatype.prototype;
      const keys = this.metadataScanner.getAllMethodNames(prototype);

      for (const key of keys) {
        if ((classDecorated || this.isDecorated(prototype[key])) &&
            !this.isAffected(prototype[key])) {
          const options = this.getTraceOptions(prototype[key]);
          const name = `Provider -> ${this.getName(provider, prototype[key])}`;

          prototype[key] = this.wrap(
            prototype[key],
            name,
            {
              ...options,
              attributes: {
                ...options.attributes,
                [AttributeNames.MODULE]: provider.host?.name,
                [AttributeNames.PROVIDER]: provider.name,
                [AttributeNames.PROVIDER_SCOPE]: provider.scope != null
                  ? Scope[provider.scope]
                  : ProviderScope.DEFAULT,
                [AttributeNames.PROVIDER_METHOD]: prototype[key].name,
                [AttributeNames.INJECTOR]: DecoratorInjector.name,
              },
            }
          );

          this.logger.log(`Mapped ${name}`);
        }
      }
    }
  }

  private injectControllers(): void {
    const controllers = this.getControllers();
    for (const controller of controllers) {
      const classDecorated = this.isDecorated(controller.metatype);
      const prototype = controller.metatype.prototype;
      const keys = this.metadataScanner.getAllMethodNames(prototype);

      for (const key of keys) {
        if ((classDecorated || this.isDecorated(prototype[key])) &&
            !this.isAffected(prototype[key])) {
          const options = this.getTraceOptions(prototype[key]);
          const name = `Controller -> ${this.getName(controller, prototype[key])}`;

          prototype[key] = this.wrap(
            prototype[key],
            name,
            {
              ...options,
              attributes: {
                ...options.attributes,
                [AttributeNames.MODULE]: controller.host?.name,
                [AttributeNames.CONTROLLER]: controller.name,
                [AttributeNames.PROVIDER_METHOD]: prototype[key].name,
                [AttributeNames.INJECTOR]: DecoratorInjector.name,
              },
            }
          );

          this.logger.log(`Mapped ${name}`);
        }
      }
    }
  }

  private getName(provider: any, func: Function): string {
    return `${provider.name}.${this.getTraceOptions(func).name ?? func.name}`;
  }

  private getTraceOptions(func: Function): any {
    return Reflect.getMetadata(TRACE_METADATA, func) ?? {};
  }
} 