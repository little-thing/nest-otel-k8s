import { Injectable, Logger } from '@nestjs/common';
import { ModulesContainer } from '@nestjs/core';
import { BaseInjector } from './base.injector';
import { AttributeNames, EnhancerScope, EnhancerType } from '../constants';
import { EnhancerInfo } from '../interfaces';
import { ModuleRef } from '@nestjs/core';
import { APP_PIPE, APP_GUARD, APP_INTERCEPTOR, APP_FILTER } from '@nestjs/core';

const enhancerInfoMap: Record<EnhancerType, EnhancerInfo> = {
  [EnhancerType.PIPE]: {
    metadataKey: 'pipes',
    methodKey: 'transform',
    traceName: 'Pipe',
    globalToken: APP_PIPE,
  },
  [EnhancerType.GUARD]: {
    metadataKey: 'guards',
    methodKey: 'canActivate',
    traceName: 'Guard',
    globalToken: APP_GUARD,
  },
  [EnhancerType.INTERCEPTOR]: {
    metadataKey: 'interceptors',
    methodKey: 'intercept',
    traceName: 'Interceptor',
    globalToken: APP_INTERCEPTOR,
  },
  [EnhancerType.FILTER]: {
    metadataKey: 'filters',
    methodKey: 'catch',
    traceName: 'ExceptionFilter',
    globalToken: APP_FILTER,
  },
};

@Injectable()
export abstract class EnhancerInjector extends BaseInjector {
  protected readonly logger = new Logger(this.constructor.name);
  protected readonly globalToken: string | symbol;
  protected readonly metadataKey: string;
  protected readonly methodKey: string;
  protected readonly traceName: string;

  constructor(
    protected readonly modulesContainer: ModulesContainer,
    protected readonly enhancerType: EnhancerType
  ) {
    super(modulesContainer);
    const info = enhancerInfoMap[enhancerType];
    this.globalToken = info.globalToken;
    this.metadataKey = info.metadataKey;
    this.traceName = info.traceName;
    this.methodKey = info.methodKey;
  }

  inject(): void {
    this.injectGlobals();
    this.injectControllers();
  }

  protected injectGlobals(): void {
    const providers = this.getProviders();
    for (const provider of providers) {
      const prototype = provider.metatype.prototype;
      if (
        provider.token === this.globalToken &&
        !this.isAffected(prototype[this.methodKey])
      ) {
        const traceName = `${this.traceName} -> Global -> ${provider.metatype.name}`;
        prototype[this.methodKey] = this.wrap(
          prototype[this.methodKey],
          traceName,
          {
            attributes: {
              [AttributeNames.ENHANCER]: provider.metatype.name,
              [AttributeNames.ENHANCER_TYPE]: this.enhancerType,
              [AttributeNames.ENHANCER_SCOPE]: EnhancerScope.GLOBAL,
              [AttributeNames.INJECTOR]: this.constructor.name,
            },
          }
        );
        this.affect(provider.metatype);
        this.logger.log(`Mapped ${traceName}`);
      }
    }
  }

  protected injectControllers(): void {
    const controllers = this.getControllers();
    for (const controller of controllers) {
      if (this.isEnhanced(controller.metatype)) {
        const enhancers = this.getEnhancers(controller.metatype).map((enhancer) => {
          const prototype = typeof enhancer === 'function' ? enhancer.prototype : enhancer;
          const traceName = `${this.traceName} -> ${controller.name}.${prototype.constructor.name}`;
          this.logger.log(`Mapped ${traceName}`);
          return this.wrapEnhancerMethod(controller, enhancer, traceName, {
            attributes: {
              [AttributeNames.ENHANCER_SCOPE]: EnhancerScope.CONTROLLER,
            },
          });
        });

        if (enhancers.length > 0) {
          Reflect.defineMetadata(this.metadataKey, enhancers, controller.metatype);
        }
      }

      const controllerProto = controller.metatype.prototype;
      const keys = this.metadataScanner.getAllMethodNames(controllerProto);

      for (const key of keys) {
        if (this.isEnhanced(controllerProto[key])) {
          const enhancers = this.getEnhancers(controllerProto[key]).map((enhancer) => {
            const enhancerProto = typeof enhancer === 'function' ? enhancer.prototype : enhancer;
            const traceName = `${this.traceName} -> ${controller.name}.${controllerProto[key].name}.${enhancerProto.constructor.name}`;
            this.logger.log(`Mapped ${traceName}`);
            return this.wrapEnhancerMethod(controller, enhancer, traceName, {
              attributes: {
                [AttributeNames.ENHANCER_SCOPE]: EnhancerScope.METHOD,
                [AttributeNames.PROVIDER_METHOD]: controllerProto[key].name,
              },
            });
          });

          if (enhancers.length > 0) {
            Reflect.defineMetadata(this.metadataKey, enhancers, controllerProto[key]);
          }
        }
      }
    }
  }

  protected getEnhancers(target: any): any[] {
    return Reflect.getMetadata(this.metadataKey, target) || [];
  }

  protected isEnhanced(target: any): boolean {
    return Reflect.hasMetadata(this.metadataKey, target);
  }

  protected wrapEnhancer(classOrInstance: any): any {
    if (typeof classOrInstance !== 'function') {
      return Object.create(classOrInstance);
    }

    const wrappedEnhancer = class WrappedEnhancer extends classOrInstance {};
    Object.defineProperty(wrappedEnhancer, 'name', {
      value: classOrInstance.name,
      configurable: true,
    });
    this.reDecorate(classOrInstance, wrappedEnhancer);
    return wrappedEnhancer;
  }

  protected wrapEnhancerMethod(
    controller: any,
    enhancer: any,
    traceName: string,
    spanOptions: any = {}
  ): any {
    const wrappedEnhancer = this.wrapEnhancer(enhancer);
    const enhancerProto = typeof wrappedEnhancer === 'function'
      ? wrappedEnhancer.prototype
      : wrappedEnhancer;

    enhancerProto[this.methodKey] = this.wrap(
      enhancerProto[this.methodKey],
      traceName,
      {
        ...spanOptions,
        attributes: {
          [AttributeNames.MODULE]: controller.host?.name,
          [AttributeNames.CONTROLLER]: controller.name,
          [AttributeNames.ENHANCER]: enhancerProto.constructor.name,
          [AttributeNames.ENHANCER_TYPE]: this.enhancerType,
          [AttributeNames.INJECTOR]: this.constructor.name,
          ...spanOptions.attributes,
        },
      }
    );

    if (typeof wrappedEnhancer === 'function' && typeof enhancer === 'function') {
      this.resolveWrappedEnhancer(controller.host, enhancer, wrappedEnhancer);
    }

    return wrappedEnhancer;
  }

  protected resolveWrappedEnhancer(module: any, enhancer: any, wrappedEnhancer: any): void {
    const instanceWrapper = module.injectables.get(enhancer);
    module.addCustomClass(
      {
        provide: wrappedEnhancer,
        useClass: wrappedEnhancer,
      },
      module.injectables,
      instanceWrapper?.subtype
    );

    const moduleRef = module.providers.get(ModuleRef)?.instance;
    if (moduleRef) {
      moduleRef.create(wrappedEnhancer).then((value: any) => {
        const instanceWrapper = module.injectables.get(wrappedEnhancer);
        if (instanceWrapper) {
          instanceWrapper.instance = value;
        }
      });
    }
  }
} 