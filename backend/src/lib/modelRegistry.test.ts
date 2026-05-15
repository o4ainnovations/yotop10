import { describe, it, expect, vi, beforeEach } from 'vitest';

const mockModelFn = vi.fn();
const mockModels: Record<string, unknown> = {};

vi.mock('mongoose', () => ({
  default: {
    models: mockModels,
    model: vi.fn().mockImplementation((name: string, schema: unknown) => {
      mockModelFn(name, schema);
      mockModels[name] = { name, schema };
      return mockModels[name];
    }),
  },
}));

describe('registerModel', () => {
  let registerModel: (name: string, schema: unknown) => unknown;

  beforeEach(async () => {
    vi.resetModules();
    mockModelFn.mockClear();
    Object.keys(mockModels).forEach((key) => delete mockModels[key]);
    const mod = await import('../lib/modelRegistry');
    registerModel = mod.registerModel;
  });

  it('registers a new model when it does not exist', () => {
    const schema = { fields: { name: String } };
    const result = registerModel('TestModel', schema);
    expect(mockModelFn).toHaveBeenCalledTimes(1);
    expect(mockModelFn).toHaveBeenCalledWith('TestModel', schema);
    expect(result).toBeDefined();
  });

  it('returns existing model on second call without re-registering', () => {
    const schema = { fields: { name: String } };
    const first = registerModel('TestModel', schema);
    mockModelFn.mockClear();
    const second = registerModel('TestModel', schema);
    expect(mockModelFn).not.toHaveBeenCalled();
    expect(second).toBe(first);
  });

  it('returns the same model reference on every call', () => {
    const schema = { fields: { name: String } };
    const first = registerModel('TestModel', schema);
    const second = registerModel('TestModel', schema);
    const third = registerModel('TestModel', schema);
    expect(first).toBe(second);
    expect(second).toBe(third);
  });

  it('registers different models independently', () => {
    const schemaA = { fields: { name: String } };
    const schemaB = { fields: { title: String } };
    const modelA = registerModel('ModelA', schemaA);
    const modelB = registerModel('ModelB', schemaB);
    expect(mockModelFn).toHaveBeenCalledTimes(2);
    expect(mockModelFn).toHaveBeenNthCalledWith(1, 'ModelA', schemaA);
    expect(mockModelFn).toHaveBeenNthCalledWith(2, 'ModelB', schemaB);
    expect(modelA).not.toBe(modelB);
  });

  it('handles multiple models with second call returning cached', () => {
    const schemaA = { fields: { name: String } };
    const schemaB = { fields: { title: String } };
    registerModel('ModelA', schemaA);
    registerModel('ModelB', schemaB);
    mockModelFn.mockClear();
    const cachedA = registerModel('ModelA', schemaA);
    const cachedB = registerModel('ModelB', schemaB);
    expect(mockModelFn).not.toHaveBeenCalled();
    expect(cachedA).toBeDefined();
    expect(cachedB).toBeDefined();
  });

  it('does not call mongoose.model when model already exists in registry', () => {
    const schema = { fields: { name: String } };
    const existing = { name: 'ExistingModel', schema };
    mockModels['ExistingModel'] = existing;
    const result = registerModel('ExistingModel', schema);
    expect(mockModelFn).not.toHaveBeenCalled();
    expect(result).toBe(existing);
  });
});
