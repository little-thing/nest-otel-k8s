import { Injectable, Logger } from '@nestjs/common';
import { BaseInjector } from './base.injector';
import { AttributeNames } from '../constants';

@Injectable()
export class ControllerInjector extends BaseInjector {
  private readonly logger = new Logger(ControllerInjector.name);

  inject(): void {
    const controllers = this.getControllers();
    for (const controller of controllers) {
      const prototype = controller.metatype.prototype;
      const keys = this.metadataScanner.getAllMethodNames(prototype);

      for (const key of keys) {
        if (!this.isDecorated(prototype[key]) &&
            !this.isAffected(prototype[key]) &&
            (this.isPath(prototype[key]) || this.isPatten(prototype[key]))) {
          
          const traceName = `Controller -> ${controller.name}.${prototype[key].name}`;
          const method = this.wrap(
            prototype[key],
            traceName,
            {
              attributes: {
                [AttributeNames.MODULE]: controller.host?.name,
                [AttributeNames.CONTROLLER]: controller.name,
                [AttributeNames.PROVIDER_METHOD]: prototype[key].name,
                [AttributeNames.INJECTOR]: ControllerInjector.name,
              },
            }
          );

          this.reDecorate(prototype[key], method);
          prototype[key] = method;
          this.logger.log(`Mapped ${controller.name}.${key}`);
        }
      }
    }
  }
} 