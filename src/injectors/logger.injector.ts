import { Logger } from '@nestjs/common';
import { trace, context } from '@opentelemetry/api';

type LoggerMethod = (message: any, ...args: any[]) => void;

export class LoggerInjector {
  inject(): void {
    Logger.prototype.log = this.wrap(Logger.prototype.log, 'log') as LoggerMethod;
    Logger.prototype.debug = this.wrap(Logger.prototype.debug, 'debug') as LoggerMethod;
    Logger.prototype.error = this.wrap(Logger.prototype.error, 'error') as LoggerMethod;
    Logger.prototype.verbose = this.wrap(Logger.prototype.verbose, 'verbose') as LoggerMethod;
    Logger.prototype.warn = this.wrap(Logger.prototype.warn, 'warn') as LoggerMethod;
  }

  private wrap(func: Function, eventName?: string): Function {
    return {
      [func.name](...args: any[]) {
        const currentSpan = trace.getSpan(context.active());
        if (currentSpan) {
          currentSpan.addEvent(eventName ?? func.name, {
            message: args[0],
          });
        }
        return func.apply(this, args);
      },
    }[func.name];
  }
} 