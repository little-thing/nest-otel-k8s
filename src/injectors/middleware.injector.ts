import { Injectable, Logger } from '@nestjs/common';
import { BaseInjector } from './base.injector';
import { Injector } from '@nestjs/core/injector/injector';
import { AttributeNames } from '../constants';
import { InstanceWrapper } from '@nestjs/core/injector/instance-wrapper';
import { Module } from '@nestjs/core/injector/module';
import { InjectionToken } from '@nestjs/common/interfaces';

type LoadMiddlewareFunction = (
  wrapper: InstanceWrapper<any>,
  collection: Map<InjectionToken, InstanceWrapper<any>>,
  moduleRef: Module
) => Promise<void>;

@Injectable()
export class MiddlewareInjector extends BaseInjector {
  private readonly logger = new Logger(MiddlewareInjector.name);

  inject(): void {
    const metatype = Injector;
    const originMethod = metatype.prototype.loadMiddleware as LoadMiddlewareFunction;
    const logger = this.logger;
    const self = this;

    metatype.prototype.loadMiddleware = function loadMiddleware(
      wrapper: InstanceWrapper<any>,
      collection: Map<InjectionToken, InstanceWrapper<any>>,
      moduleRef: Module
    ): Promise<void> {
      const prototype = wrapper.metatype.prototype;

      if (prototype.use) {
        if (self.isAffected(prototype.use)) {
          return originMethod.apply(this, [wrapper, collection, moduleRef]);
        }

        const traceName = `Middleware -> ${prototype.constructor.name}`;
        prototype.use = self.wrap(
          prototype.use,
          traceName,
          {
            attributes: {
              [AttributeNames.MIDDLEWARE]: prototype.constructor.name,
              [AttributeNames.INJECTOR]: MiddlewareInjector.name,
            },
          }
        );

        logger.log(`Mapped ${traceName}`);
      }

      return originMethod.apply(this, [wrapper, collection, moduleRef]);
    };
  }
} 