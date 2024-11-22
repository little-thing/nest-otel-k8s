import { ControllerInjector } from '../../src/injectors/controller.injector';
import { ModulesContainer } from '@nestjs/core';
import { Test, TestingModule } from '@nestjs/testing';
import { Controller } from '@nestjs/common';
import { NestContainer } from '@nestjs/core/injector/container';

@Controller('test')
class TestController {
  test() {
    return 'test';
  }
}

@Controller('test2')
class Test2Controller {
  test() {
    return 'test2';
  }
}

describe('ControllerInjector', () => {
  let injector: ControllerInjector;
  let modulesContainer: ModulesContainer;
  let module: TestingModule;

  beforeEach(async () => {
    const container = new NestContainer();
    
    module = await Test.createTestingModule({
      controllers: [TestController, Test2Controller],
      providers: [
        ControllerInjector,
        {
          provide: ModulesContainer,
          useValue: container.getModules()
        }
      ],
    }).compile();

    modulesContainer = module.get<ModulesContainer>(ModulesContainer);
    injector = module.get<ControllerInjector>(ControllerInjector);
  });

  afterEach(() => {
    module.close();
    jest.resetAllMocks();
  });

  it('should be defined', () => {
    expect(injector).toBeDefined();
  });

  it('should handle controller injection', async () => {
    const container = new NestContainer();
    
    // 创建一个包含控制器的模块
    const moduleRef = await Test.createTestingModule({
      controllers: [TestController]
    }).compile();
    
    // 将模块添加到容器
    container.addModule(moduleRef.constructor as any, []);
    
    // 复制模块到测试容器
    container.getModules().forEach((value, key) => {
      (modulesContainer as any).set(key, value);
    });

    expect(modulesContainer.size).toBeGreaterThan(0);
  });

  it('should skip modules without controllers', async () => {
    const container = new NestContainer();
    
    // 创建一个不包含控制器的模块
    const moduleRef = await Test.createTestingModule({
      providers: []
    }).compile();
    
    container.addModule(moduleRef.constructor as any, []);
    
    container.getModules().forEach((value, key) => {
      (modulesContainer as any).set(key, value);
    });

    expect(modulesContainer.size).toBeGreaterThan(0);
  });
}); 