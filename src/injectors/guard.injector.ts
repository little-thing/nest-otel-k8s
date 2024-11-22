import { Injectable } from '@nestjs/common';
import { ModulesContainer } from '@nestjs/core';
import { EnhancerInjector } from './enhancer.injector';
import { EnhancerType } from '../constants';
import { GUARDS_METADATA } from '@nestjs/common/constants';

@Injectable()
export class GuardInjector extends EnhancerInjector {
  constructor(modulesContainer: ModulesContainer) {
    super(modulesContainer, EnhancerType.GUARD);
  }

  protected override injectControllers(): void {
    super.injectControllers();
    const controllers = this.getControllers();
    
    for (const controller of controllers) {
      const prototype = controller.metatype.prototype;
      const guards = Reflect.getMetadata(GUARDS_METADATA, controller.metatype) || [];
      
      if (guards.length > 0) {
        const wrappedGuards = guards.map((guard: any) => {
          const traceName = `${this.traceName} -> ${controller.name}.${guard.name}`;
          this.logger.log(`Mapped ${traceName}`);
          return this.wrapEnhancerMethod(controller, guard, traceName);
        });
        
        Reflect.defineMetadata(GUARDS_METADATA, wrappedGuards, controller.metatype);
      }

      const keys = this.metadataScanner.getAllMethodNames(prototype);
      for (const key of keys) {
        const methodGuards = Reflect.getMetadata(GUARDS_METADATA, prototype[key]) || [];
        
        if (methodGuards.length > 0) {
          const wrappedGuards = methodGuards.map((guard: any) => {
            const traceName = `${this.traceName} -> ${controller.name}.${key}.${guard.name}`;
            this.logger.log(`Mapped ${traceName}`);
            return this.wrapEnhancerMethod(controller, guard, traceName);
          });
          
          Reflect.defineMetadata(GUARDS_METADATA, wrappedGuards, prototype[key]);
        }
      }
    }
  }
} 