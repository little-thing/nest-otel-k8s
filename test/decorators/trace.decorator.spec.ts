import { Trace } from '../../src/decorators/trace.decorator';
import type { Context, SpanKind, Tracer, Span } from '@opentelemetry/api';

// 创建模拟的 span
const mockSpan = {
  end: jest.fn(),
  setAttributes: jest.fn(),
  recordException: jest.fn(),
  setStatus: jest.fn(),
};

// 创建模拟的 tracer
const mockTracer = {
  startSpan: jest.fn().mockReturnValue(mockSpan),
};

// 模拟 OpenTelemetry API
jest.mock('@opentelemetry/api', () => ({
  trace: {
    getTracer: jest.fn().mockReturnValue(mockTracer),
  },
  context: {
    with: jest.fn().mockImplementation((ctx, fn) => fn()),
  },
  SpanKind: {
    INTERNAL: 'INTERNAL',
  },
  SpanStatusCode: {
    ERROR: 'ERROR',
    OK: 'OK',
  },
}));

describe('Trace Decorator', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('should create trace decorator', async () => {
    class TestClass {
      @Trace()
      async testMethod() {
        return 'test';
      }
    }

    const instance = new TestClass();
    const result = await instance.testMethod();
    
    expect(result).toBe('test');
    expect(mockTracer.startSpan).toHaveBeenCalled();
    expect(mockSpan.end).toHaveBeenCalled();
  });

  it('should handle trace decorator with custom options', async () => {
    const options = { name: 'customTrace' };
    
    class TestClass {
      @Trace(options)
      async testMethod() {
        return 'test';
      }
    }

    const instance = new TestClass();
    const result = await instance.testMethod();
    
    expect(result).toBe('test');
    expect(mockTracer.startSpan).toHaveBeenCalledWith('customTrace', expect.any(Object));
    expect(mockSpan.end).toHaveBeenCalled();
  });

  it('should handle errors in traced method', async () => {
    const testError = new Error('Test error');

    class TestClass {
      @Trace()
      async testMethod() {
        throw testError;
      }
    }

    const instance = new TestClass();
    await expect(instance.testMethod()).rejects.toThrow('Test error');
    
    expect(mockSpan.recordException).toHaveBeenCalledWith(testError);
    expect(mockSpan.setStatus).toHaveBeenCalledWith({ code: 'ERROR' });
    expect(mockSpan.end).toHaveBeenCalled();
  });

  it('should handle synchronous methods', () => {
    class TestClass {
      @Trace()
      testMethod() {
        return 'test';
      }
    }

    const instance = new TestClass();
    const result = instance.testMethod();
    
    expect(result).toBe('test');
    expect(mockTracer.startSpan).toHaveBeenCalled();
    expect(mockSpan.end).toHaveBeenCalled();
  });
}); 