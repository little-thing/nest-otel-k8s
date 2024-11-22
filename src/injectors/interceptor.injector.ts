import { Injectable } from '@nestjs/common';
import { ModulesContainer } from '@nestjs/core';
import { EnhancerInjector } from './enhancer.injector';
import { EnhancerType } from '../constants';
import { INTERCEPTORS_METADATA } from '@nestjs/common/constants';

@Injectable()
export class InterceptorInjector extends EnhancerInjector {
  constructor(modulesContainer: ModulesContainer) {
    super(modulesContainer, EnhancerType.INTERCEPTOR);
  }

  protected override injectControllers(): void {
    super.injectControllers();
    const controllers = this.getControllers();
    
    for (const controller of controllers) {
      const prototype = controller.metatype.prototype;
      const interceptors = Reflect.getMetadata(INTERCEPTORS_METADATA, controller.metatype) || [];
      
      if (interceptors.length > 0) {
        const wrappedInterceptors = interceptors.map((interceptor: any) => {
          const traceName = `${this.traceName} -> ${controller.name}.${interceptor.name}`;
          this.logger.log(`Mapped ${traceName}`);
          return this.wrapEnhancerMethod(controller, interceptor, traceName);
        });
        
        Reflect.defineMetadata(INTERCEPTORS_METADATA, wrappedInterceptors, controller.metatype);
      }

      const keys = this.metadataScanner.getAllMethodNames(prototype);
      for (const key of keys) {
        const methodInterceptors = Reflect.getMetadata(INTERCEPTORS_METADATA, prototype[key]) || [];
        
        if (methodInterceptors.length > 0) {
          const wrappedInterceptors = methodInterceptors.map((interceptor: any) => {
            const traceName = `${this.traceName} -> ${controller.name}.${key}.${interceptor.name}`;
            this.logger.log(`Mapped ${traceName}`);
            return this.wrapEnhancerMethod(controller, interceptor, traceName);
          });
          
          Reflect.defineMetadata(INTERCEPTORS_METADATA, wrappedInterceptors, prototype[key]);
        }
      }
    }
  }
} 