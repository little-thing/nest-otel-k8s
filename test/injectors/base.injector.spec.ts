import { BaseInjector } from '../../src/injectors/base.injector';
import { ModulesContainer } from '@nestjs/core';
import { Test, TestingModule } from '@nestjs/testing';
import { NestContainer } from '@nestjs/core/injector/container';

describe('BaseInjector', () => {
  let injector: BaseInjector;
  let modulesContainer: ModulesContainer;
  let module: TestingModule;

  beforeEach(async () => {
    const container = new NestContainer();

    module = await Test.createTestingModule({
      providers: [
        BaseInjector,
        {
          provide: ModulesContainer,
          useValue: container.getModules()
        }
      ],
    }).compile();

    modulesContainer = module.get<ModulesContainer>(ModulesContainer);
    injector = module.get<BaseInjector>(BaseInjector);
  });

  afterEach(() => {
    module.close();
    jest.resetAllMocks();
  });

  it('should be defined', () => {
    expect(injector).toBeDefined();
  });

  it('should handle module container operations', () => {
  });
});
