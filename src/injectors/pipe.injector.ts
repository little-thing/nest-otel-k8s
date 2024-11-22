import { Injectable } from '@nestjs/common';
import { ModulesContainer } from '@nestjs/core';
import { EnhancerInjector } from './enhancer.injector';
import { EnhancerType, AttributeNames, EnhancerScope } from '../constants';
import { ROUTE_ARGS_METADATA } from '@nestjs/common/constants';

@Injectable()
export class PipeInjector extends EnhancerInjector {
  constructor(modulesContainer: ModulesContainer) {
    super(modulesContainer, EnhancerType.PIPE);
  }

  injectControllers(): void {
    super.injectControllers();
    const controllers = this.getControllers();
    for (const controller of controllers) {
      const prototype = controller.metatype.prototype;
      const keys = this.metadataScanner.getAllMethodNames(prototype);
      for (const key of keys) {
        if (this.isPath(prototype[key]) || this.isPatten(prototype[key])) {
          this.wrapParamsPipes(controller, prototype, key);
        }
      }
    }
  }

  private wrapParamsPipes(controller: any, prototype: any, key: string): void {
    const params = Reflect.getMetadata(ROUTE_ARGS_METADATA, prototype.constructor, key) ?? {};
    for (const param of Object.values(params)) {
      if ((param as any).pipes) {
        (param as any).pipes = (param as any).pipes.map((pipe: any) => 
          this.wrapPipe(pipe, controller, prototype[key], (param as any).index)
        );
      }
    }
    Reflect.defineMetadata(ROUTE_ARGS_METADATA, params, prototype.constructor, key);
  }

  private wrapPipe(enhancer: any, controller: any, func: Function, index?: number): any {
    const enhancerProto = typeof enhancer === 'function' ? enhancer.prototype : enhancer;
    const traceName = `${this.traceName} -> ${controller.name}.${func.name}${index != null ? `.${index}` : ''}.${enhancerProto.constructor.name}`;
    return this.wrapEnhancerMethod(controller, enhancer, traceName, {
      attributes: {
        [AttributeNames.PARAM_INDEX]: index,
        [AttributeNames.ENHANCER_SCOPE]: index != null ? EnhancerScope.PARAM : EnhancerScope.METHOD,
        [AttributeNames.PROVIDER_METHOD]: func.name,
      },
    });
  }
} 