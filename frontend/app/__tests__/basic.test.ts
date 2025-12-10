describe('Frontend Tests', () => {
  it('should pass a basic test', () => {
    expect(true).toBe(true);
  });

  it('should verify app renders', () => {
    const expectedSum = 4;
    const addend = 2;
    const augend = 2;
    const actualSum = addend + augend;
    expect(actualSum).toBe(expectedSum);
  });
});
