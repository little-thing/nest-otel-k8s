# NestJS OpenTelemetry 自动注入模块

这是一个用于 NestJS 框架的 OpenTelemetry 自动注入模块，它可以自动为你的应用添加分布式追踪能力，无需手动修改大量代码。

[English Documentation](./README.md)

## 特性

- 🚀 自动注入追踪功能到 NestJS 应用的各个层面
- 🎯 支持多种注入器，覆盖常见场景：
  - Controller 注入器
  - Provider 注入器
  - Middleware 注入器
  - Guard 注入器
  - Interceptor 注入器
  - Pipe 注入器
  - Schedule 注入器
  - TypeORM 注入器
  - Logger 注入器
- 📊 自动收集关键性能指标
- 🔍 详细的追踪信息，包括：
  - 模块名称
  - 控制器名称
  - 方法名称
  - 数据库操作
  - 中间件执行
  - 守卫验证
  - 拦截器处理
  - 管道转换
  - 定时任务执行

## 安装

```bash
npm install @nest-otel/k8s
# 或
pnpm add @nest-otel/k8s
# 或
yarn add @nest-otel/k8s
```

## 快速开始

1. 在你的 NestJS 应用的 `app.module.ts` 中导入 OpenTelemetryModule：

```typescript
import { OpenTelemetryModule } from 'nestjs-opentelemetry';

@Module({
  imports: [
    OpenTelemetryModule.forRoot({
      // 可选配置
    }),
  ],
})
export class AppModule {}
```

2. 使用异步配置（可选）：

```typescript
import { OpenTelemetryModule } from 'nestjs-opentelemetry';

@Module({
  imports: [
    OpenTelemetryModule.forRootAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: async (configService: ConfigService) => ({
        // 异步配置选项
      }),
    }),
  ],
})
export class AppModule {}
```

## 装饰器使用

### @Trace 装饰器

你可以使用 `@Trace` 装饰器来手动标记需要追踪的方法：

```typescript
import { Trace } from 'nestjs-opentelemetry';

@Injectable()
export class UserService {
  @Trace('get-user-by-id')
  async getUserById(id: string) {
    // 方法实现
  }
}
```

### TracePlain 装饰器

用于普通类方法的追踪：

```typescript
import { TracePlain } from 'nestjs-opentelemetry';

@TracePlain()
class MyClass {
  myMethod() {
    // 方法实现
  }
}
```

## 配置选项

```typescript
interface OpenTelemetryModuleOptions {
  autoInjectors?: Type<any>[]; // 自定义注入器
  injectorsConfig?: Record<string, any>; // 注入器配置
}
```

### TypeORM 配置示例

```typescript
OpenTelemetryModule.forRoot({
  injectorsConfig: {
    TypeormInjector: {
      collectParameters: true, // 收集SQL参数
    },
  },
});
```

## 自定义注入器

你可以创建自己的注入器来扩展功能：

```typescript
@Injectable()
export class CustomInjector extends BaseInjector {
  inject(): void {
    // 实现注入逻辑
  }
}

// 在模块配置中使用
OpenTelemetryModule.forRoot({
  autoInjectors: [CustomInjector],
});
```

## 注意事项

- 确保在应用启动前配置 OpenTelemetry
- TypeORM 注入器需要 TypeORM 包的支持
- 建议在生产环境中谨慎使用参数收集功能，可能会影响性能

## 许可证

MIT

## 贡献指南

欢迎提交 Issue 和 Pull Request！ 