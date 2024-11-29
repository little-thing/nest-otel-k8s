# NestJS OpenTelemetry Auto-injection Module

This is an OpenTelemetry auto-injection module for NestJS framework that automatically adds distributed tracing capabilities to your application without manual code modifications.

[中文文档](./README.zh-CN.md)

## Features

- 🚀 Automatically inject tracing capabilities into all aspects of NestJS applications
- 🎯 Support multiple injectors covering common scenarios:
  - Controller Injector
  - Provider Injector
  - Middleware Injector
  - Guard Injector
  - Interceptor Injector
  - Pipe Injector
  - Schedule Injector
  - TypeORM Injector
  - Logger Injector
- 📊 Automatic collection of key performance metrics
- 🔍 Detailed tracing information, including:
  - Module name
  - Controller name
  - Method name
  - Database operations
  - Middleware execution
  - Guard validation
  - Interceptor handling
  - Pipe transformation
  - Scheduled task execution

## Installation

```bash
npm install @nest-otel/k8s
# or
pnpm add @nest-otel/k8s
# or
yarn add @nest-otel/k8s
```

## Quick Start

1. Import OpenTelemetryModule in your NestJS application's `app.module.ts`:

```typescript
import { OpenTelemetryModule } from 'nestjs-opentelemetry';

@Module({
  imports: [
    OpenTelemetryModule.forRoot({
      // Optional configuration
    }),
  ],
})
export class AppModule {}
```

2. Using async configuration (optional):

```typescript
import { OpenTelemetryModule } from 'nestjs-opentelemetry';

@Module({
  imports: [
    OpenTelemetryModule.forRootAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: async (configService: ConfigService) => ({
        // Async configuration options
      }),
    }),
  ],
})
export class AppModule {}
```

## Decorators

### @Trace Decorator

You can use the `@Trace` decorator to manually mark methods for tracing:

```typescript
import { Trace } from 'nestjs-opentelemetry';

@Injectable()
export class UserService {
  @Trace('get-user-by-id')
  async getUserById(id: string) {
    // Method implementation
  }
}
```

### TracePlain Decorator

For tracing plain class methods:

```typescript
import { TracePlain } from 'nestjs-opentelemetry';

@TracePlain()
class MyClass {
  myMethod() {
    // Method implementation
  }
}
```

## Configuration Options

```typescript
interface OpenTelemetryModuleOptions {
  autoInjectors?: Type<any>[]; // Custom injectors
  injectorsConfig?: Record<string, any>; // Injector configuration
}
```

### TypeORM Configuration Example

```typescript
OpenTelemetryModule.forRoot({
  injectorsConfig: {
    TypeormInjector: {
      collectParameters: true, // Collect SQL parameters
    },
  },
});
```

## Custom Injectors

You can create your own injectors to extend functionality:

```typescript
@Injectable()
export class CustomInjector extends BaseInjector {
  inject(): void {
    // Implement injection logic
  }
}

// Use in module configuration
OpenTelemetryModule.forRoot({
  autoInjectors: [CustomInjector],
});
```

## Important Notes

- Ensure OpenTelemetry is configured before application startup
- TypeORM injector requires the TypeORM package
- Use parameter collection carefully in production as it may impact performance

## License

MIT

## Contributing

Issues and Pull Requests are welcome!