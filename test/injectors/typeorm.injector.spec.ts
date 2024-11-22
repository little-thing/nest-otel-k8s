import { TypeormInjector } from '../../src/injectors/typeorm.injector';
import { ModulesContainer } from '@nestjs/core';
import { Test, TestingModule } from '@nestjs/testing';
import { NestContainer } from '@nestjs/core/injector/container';
import { getDataSourceToken } from '@nestjs/typeorm';
import { DataSource, EntityManager, Repository } from 'typeorm';
import { SDK_CONFIG } from "../../src";

// 创建模拟实体
class TestEntity {
  id: number;
  name: string;
}

describe('TypeormInjector', () => {
  let injector: TypeormInjector;
  let modulesContainer: ModulesContainer;
  let module: TestingModule;
  let mockDataSource: jest.Mocked<DataSource>;
  let mockEntityManager: jest.Mocked<EntityManager>;

  beforeEach(async () => {
    // 模拟 DataSource
    mockEntityManager = {
      query: jest.fn(),
      transaction: jest.fn(),
    } as any;

    mockDataSource = {
      manager: mockEntityManager,
      getRepository: jest.fn().mockReturnValue({
        metadata: {
          name: 'TestEntity',
          target: TestEntity,
        },
        find: jest.fn(),
        findOne: jest.fn(),
        save: jest.fn(),
      }),
    } as any;

    const container = new NestContainer();

    module = await Test.createTestingModule({
      providers: [
        TypeormInjector,
        {
          provide: ModulesContainer,
          useValue: container.getModules()
        },
        {
          provide: SDK_CONFIG,
            useValue: {}
        },
        {
          provide: getDataSourceToken(),
          useValue: mockDataSource
        }
      ],
    }).compile();

    modulesContainer = module.get<ModulesContainer>(ModulesContainer);
    injector = module.get<TypeormInjector>(TypeormInjector);
  });

  afterEach(() => {
    module.close();
    jest.resetAllMocks();
  });

  it('should be defined', () => {
    expect(injector).toBeDefined();
  });

  it('should handle repository injection', async () => {
    const container = new NestContainer();

    // 创建一个包含 TypeORM 仓库的模块
    const moduleRef = await Test.createTestingModule({
      providers: [
        {
          provide: getDataSourceToken(),
          useValue: mockDataSource
        },
        {
          provide: 'TestEntityRepository',
          useFactory: (dataSource: DataSource) => dataSource.getRepository(TestEntity),
          inject: [getDataSourceToken()]
        }
      ]
    }).compile();

    // 将模块添加到容器
    container.addModule(moduleRef.constructor as any, []);

    // 复制模块到测试容器
    container.getModules().forEach((value, key) => {
      (modulesContainer as any).set(key, value);
    });

    // 执行注入
    await injector.inject();

    expect(modulesContainer.size).toBeGreaterThan(0);
    expect(mockDataSource.getRepository).toHaveBeenCalled();
  });

  it('should handle entity manager injection', async () => {
    const container = new NestContainer();

    // 创建一个包含 EntityManager 的模块
    const moduleRef = await Test.createTestingModule({
      providers: [
        {
          provide: getDataSourceToken(),
          useValue: mockDataSource
        },
        {
          provide: EntityManager,
          useValue: mockEntityManager
        }
      ]
    }).compile();

    container.addModule(moduleRef.constructor as any, []);

    container.getModules().forEach((value, key) => {
      (modulesContainer as any).set(key, value);
    });

    await injector.inject();

    expect(modulesContainer.size).toBeGreaterThan(0);
  });

  it('should handle transaction decorator', async () => {
    const container = new NestContainer();

    class TestService {
      async testTransaction() {
        return 'test';
      }
    }

    const moduleRef = await Test.createTestingModule({
      providers: [
        TestService,
        {
          provide: getDataSourceToken(),
          useValue: mockDataSource
        }
      ]
    }).compile();

    container.addModule(moduleRef.constructor as any, []);

    container.getModules().forEach((value, key) => {
      (modulesContainer as any).set(key, value);
    });

    await injector.inject();

    expect(modulesContainer.size).toBeGreaterThan(0);
  });

  it('should handle errors during injection', async () => {
    const container = new NestContainer();

    mockDataSource.getRepository.mockImplementationOnce(() => {
      throw new Error('Repository error');
    });

    const moduleRef = await Test.createTestingModule({
      providers: [
        {
          provide: getDataSourceToken(),
          useValue: mockDataSource
        }
      ]
    }).compile();

    container.addModule(moduleRef.constructor as any, []);

    container.getModules().forEach((value, key) => {
      (modulesContainer as any).set(key, value);
    });

    await expect(injector.inject()).resolves.not.toThrow();
  });
});
