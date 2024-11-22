import { Injectable, Logger, Scope, Inject } from '@nestjs/common';
import { BaseInjector } from './base.injector';
import { AttributeNames, ProviderScope, SDK_CONFIG } from '../constants';
import { ModulesContainer } from '@nestjs/core';
import { InternalCoreModule } from '@nestjs/core/injector/internal-core-module';
import { ModuleRef, MetadataScanner, DiscoveryService } from '@nestjs/core';
import { LoggerInjector } from './logger.injector';

const internalExcludeModules = [InternalCoreModule];
const internalExcludeProviders = [
  ModuleRef,
  MetadataScanner,
  DiscoveryService,
  LoggerInjector,
];

@Injectable()
export class ProviderInjector extends BaseInjector {
  private readonly logger = new Logger(ProviderInjector.name);
  private readonly config: Record<string, any>;

  constructor(
    modulesContainer: ModulesContainer,
    @Inject(SDK_CONFIG) config: Record<string, any>
  ) {
    super(modulesContainer);
    this.config = config.injectorsConfig?.[ProviderInjector.name] ?? {};
  }

  inject(): void {
    const providers = this.getProviders();
    for (const provider of providers) {
      if (provider.instance instanceof BaseInjector) continue;
      if (provider.metatype === provider.host?.metatype) continue;
      if (this.isExcluded(provider)) continue;

      const prototype = provider.metatype.prototype;
      const keys = this.metadataScanner.getAllMethodNames(prototype);

      for (const key of keys) {
        if (this.isAffected(prototype[key])) continue;

        const name = `Provider -> ${this.getName(provider, prototype[key])}`;
        prototype[key] = this.wrap(
          prototype[key],
          name,
          {
            attributes: {
              [AttributeNames.MODULE]: provider.host?.name,
              [AttributeNames.PROVIDER]: provider.name,
              [AttributeNames.PROVIDER_SCOPE]: provider.scope != null
                ? Scope[provider.scope]
                : ProviderScope.DEFAULT,
              [AttributeNames.PROVIDER_METHOD]: prototype[key].name,
              [AttributeNames.INJECTOR]: ProviderInjector.name,
            },
          },
          true
        );

        this.logger.log(`Mapped ${name}`);
      }
    }
  }

  private getName(provider: any, func: Function): string {
    return `${provider.name}.${func.name}`;
  }

  private isExcluded(provider: any): boolean {
    if (internalExcludeModules.includes(provider.host?.metatype)) return true;
    if (internalExcludeProviders.includes(provider.metatype)) return true;

    if (this.config.excludeModules?.includes(provider.host?.metatype) ||
        this.config.excludeModules?.includes(provider.host?.name)) return true;

    if (this.config.excludeProviders?.includes(provider.metatype) ||
        this.config.excludeProviders?.includes(provider.name)) return true;

    return false;
  }
} 