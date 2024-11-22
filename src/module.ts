import { DynamicModule } from '@nestjs/common';
import { ModuleRef } from '@nestjs/core';
import { SDK_CONFIG, SDK_INJECTORS } from './constants';
import { OpenTelemetryModuleOptions, OpenTelemetryModuleAsyncOptions } from './interfaces';
import {
  DecoratorInjector,
  ScheduleInjector,
  ControllerInjector,
  GuardInjector,
  PipeInjector,
  InterceptorInjector,
  TypeormInjector,
  LoggerInjector,
  ProviderInjector,
  MiddlewareInjector,
} from './injectors';

const defaultConfig: OpenTelemetryModuleOptions = {
  autoInjectors: [
    DecoratorInjector,
    ScheduleInjector,
    ControllerInjector,
    GuardInjector,
    PipeInjector,
    InterceptorInjector,
    TypeormInjector,
    LoggerInjector,
    ProviderInjector,
    MiddlewareInjector,
  ],
};

export class OpenTelemetryModule {
  static forRoot(config: OpenTelemetryModuleOptions = {}): DynamicModule {
    config = { ...defaultConfig, ...config };
    const injectors = config?.autoInjectors ?? [];

    return {
      global: true,
      module: OpenTelemetryModule,
      imports: [],
      providers: [
        ...injectors,
        this.buildInjectors(config),
        {
          provide: SDK_CONFIG,
          useValue: config,
        },
      ],
      exports: [],
    };
  }

  private static buildInjectors(configuration: OpenTelemetryModuleOptions) {
    const injectors = configuration?.autoInjectors ?? [];
    return {
      provide: SDK_INJECTORS,
      useFactory: (...injectors: any[]) => {
        for (const injector of injectors) {
          if (injector['inject']) {
            injector.inject();
          }
        }
      },
      inject: [...injectors],
    };
  }

  static forRootAsync(configuration: OpenTelemetryModuleAsyncOptions): DynamicModule {
    return {
      global: true,
      module: OpenTelemetryModule,
      imports: [...(configuration?.imports ?? [])],
      providers: [
        this.buildAsyncInjectors(),
        {
          provide: SDK_CONFIG,
          useFactory: configuration.useFactory,
          inject: configuration.inject,
        },
      ],
      exports: [],
    };
  }

  private static buildAsyncInjectors() {
    return {
      provide: SDK_INJECTORS,
      useFactory: async (config: OpenTelemetryModuleOptions, moduleRef: ModuleRef) => {
        config = { ...defaultConfig, ...config };
        const injectors = config.autoInjectors ?? defaultConfig.autoInjectors ?? [];
        
        for (const injector of injectors) {
          const created = await moduleRef.create(injector);
          if (created['inject']) {
            created.inject();
          }
        }
        return {};
      },
      inject: [SDK_CONFIG, ModuleRef],
    };
  }
} 