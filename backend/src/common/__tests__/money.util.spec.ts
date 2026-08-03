import { Money, toMinorUnits, fromMinorUnits } from '../utils/money.util';

/**
 * Money is numeric(18,2) in postgres and a string in JSON precisely so
 * JavaScript floats never touch it. These tests pin the cases where a
 * float implementation would silently disagree.
 */
describe('Money', () => {
  describe('float hazards', () => {
    it('adds values that float arithmetic gets wrong', () => {
      // 0.1 + 0.2 === 0.30000000000000004 in IEEE 754.
      expect(Money.add('0.10', '0.20')).toBe('0.30');
      expect(Money.add('1.15', '2.25')).toBe('3.40');
    });

    it('subtracts without drift', () => {
      // 1.00 - 0.90 === 0.09999999999999998 as floats.
      expect(Money.subtract('1.00', '0.90')).toBe('0.10');
      expect(Money.subtract('100.00', '99.99')).toBe('0.01');
    });

    it('stays exact across a long chain of additions', () => {
      let total = '0.00';
      for (let i = 0; i < 100; i += 1) total = Money.add(total, '0.07');

      expect(total).toBe('7.00');
    });

    it('handles amounts too large for exact float representation', () => {
      expect(Money.add('99999999999.99', '0.01')).toBe('100000000000.00');
    });
  });

  describe('parsing and formatting', () => {
    it('normalises to exactly two decimal places', () => {
      expect(Money.normalise('5')).toBe('5.00');
      expect(Money.normalise('5.1')).toBe('5.10');
      expect(Money.normalise('5.10')).toBe('5.10');
    });

    it('round-trips through minor units', () => {
      for (const value of ['0.00', '0.01', '12.34', '999999.99']) {
        expect(fromMinorUnits(toMinorUnits(value))).toBe(value);
      }
    });

    it('rejects values that are not decimals', () => {
      expect(() => toMinorUnits('abc')).toThrow(TypeError);
      expect(() => toMinorUnits('')).toThrow(TypeError);
      expect(() => toMinorUnits('1.2.3')).toThrow(TypeError);
    });

    it('handles negatives, which balances can legitimately reach', () => {
      expect(Money.subtract('10.00', '25.50')).toBe('-15.50');
      expect(Money.add('-15.50', '15.50')).toBe('0.00');
    });
  });

  describe('comparison', () => {
    it('compares by value, not lexically', () => {
      // '9.00' > '10.00' as strings; the point is that it is not here.
      expect(Money.isGreaterThan('10.00', '9.00')).toBe(true);
      expect(Money.isGreaterThan('9.00', '10.00')).toBe(false);
      expect(Money.compare('10.00', '10.00')).toBe(0);
    });

    it('detects zero and positive', () => {
      expect(Money.isZero('0.00')).toBe(true);
      expect(Money.isZero('0.01')).toBe(false);
      expect(Money.isPositive('0.01')).toBe(true);
      expect(Money.isPositive('0.00')).toBe(false);
      expect(Money.isPositive('-1.00')).toBe(false);
    });
  });

  describe('correction capping', () => {
    /**
     * The rule the transactions service enforces: corrections against one
     * parent may not exceed its amount in aggregate, or a "fix" would
     * conjure money that was never there.
     */
    const remaining = (parent: string, corrected: string): string =>
      Money.subtract(parent, corrected);

    it('allows a correction up to the exact remaining amount', () => {
      expect(remaining('100.00', '60.00')).toBe('40.00');
      expect(Money.isGreaterThan('40.00', remaining('100.00', '60.00'))).toBe(false);
    });

    it('rejects a correction one cent over', () => {
      expect(Money.isGreaterThan('40.01', remaining('100.00', '60.00'))).toBe(true);
    });

    it('recognises a parent as fully corrected', () => {
      expect(Money.isZero(Money.subtract(remaining('100.00', '60.00'), '40.00'))).toBe(true);
    });

    it('leaves nothing available once fully corrected', () => {
      expect(remaining('100.00', '100.00')).toBe('0.00');
      expect(Money.isGreaterThan('0.01', '0.00')).toBe(true);
    });
  });
});
