import { Injectable, Logger } from '@nestjs/common';
import { BaseInjector } from './base.injector';
import { AttributeNames, SchedulerType, ScheduleAttributes } from '../constants';

@Injectable()
export class ScheduleInjector extends BaseInjector {
  private static readonly SCHEDULE_CRON_OPTIONS = 'SCHEDULE_CRON_OPTIONS';
  private static readonly SCHEDULE_INTERVAL_OPTIONS = 'SCHEDULE_INTERVAL_OPTIONS';
  private static readonly SCHEDULE_TIMEOUT_OPTIONS = 'SCHEDULE_TIMEOUT_OPTIONS';
  private static readonly SCHEDULER_NAME = 'SCHEDULER_NAME';
  private static readonly SCHEDULER_TYPE = 'SCHEDULER_TYPE';
  private readonly logger = new Logger(ScheduleInjector.name);

  inject(): void {
    for (const provider of [...this.getProviders(), ...this.getControllers()]) {
      const prototype = provider.metatype.prototype;
      const keys = this.metadataScanner.getAllMethodNames(prototype);

      for (const key of keys) {
        if (!this.isDecorated(prototype[key]) &&
            !this.isAffected(prototype[key]) &&
            this.isScheduler(prototype[key])) {
          const name = this.getName(provider, prototype[key]);
          prototype[key] = this.wrap(
            prototype[key],
            name,
            {
              attributes: {
                [AttributeNames.MODULE]: provider.host?.name,
                [AttributeNames.PROVIDER]: provider.name,
                [AttributeNames.PROVIDER_SCOPE]: provider.scope != null
                  ? provider.scope
                  : 'DEFAULT',
                [AttributeNames.PROVIDER_METHOD]: prototype[key].name,
                [AttributeNames.INJECTOR]: ScheduleInjector.name,
                ...this.getAttributes(prototype[key]),
              },
            }
          );
          this.logger.log(`Mapped ${name}`);
        }
      }
    }
  }

  private isScheduler(func: Function): boolean {
    return Reflect.hasMetadata(ScheduleInjector.SCHEDULER_TYPE, func);
  }

  private getName(provider: any, func: Function): string {
    const schedulerType = Reflect.getMetadata(ScheduleInjector.SCHEDULER_TYPE, func);
    const name = Reflect.getMetadata(ScheduleInjector.SCHEDULER_NAME, func);

    switch (schedulerType) {
      case SchedulerType.CRON:
        return `Scheduler -> Cron -> ${provider.name}.${name || func.name}`;
      case SchedulerType.TIMEOUT:
        return `Scheduler -> Timeout -> ${provider.name}.${name || func.name}`;
      case SchedulerType.INTERVAL:
        return `Scheduler -> Interval -> ${provider.name}.${name || func.name}`;
      default:
        return `Scheduler -> Unknown -> ${provider.name}.${name || func.name}`;
    }
  }

  private getAttributes(func: Function): Record<string, any> {
    const schedulerType = Reflect.getMetadata(ScheduleInjector.SCHEDULER_TYPE, func);
    const attributes: Record<string, any> = {
      [ScheduleAttributes.TYPE]: SchedulerType[schedulerType],
      [ScheduleAttributes.NAME]: Reflect.getMetadata(ScheduleInjector.SCHEDULER_NAME, func),
    };

    if (SchedulerType.TIMEOUT === schedulerType || SchedulerType.INTERVAL === schedulerType) {
      const options = Reflect.getMetadata(
        schedulerType === SchedulerType.TIMEOUT
          ? ScheduleInjector.SCHEDULE_TIMEOUT_OPTIONS
          : ScheduleInjector.SCHEDULE_INTERVAL_OPTIONS,
        func
      );
      attributes[ScheduleAttributes.TIMEOUT] = options?.timeout;
    }

    if (SchedulerType.CRON === schedulerType) {
      const options = Reflect.getMetadata(ScheduleInjector.SCHEDULE_CRON_OPTIONS, func);
      attributes[ScheduleAttributes.CRON_EXPRESSION] = options?.cronTime;
    }

    return attributes;
  }
} 