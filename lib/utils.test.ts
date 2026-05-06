import { describe, it, expect } from 'vitest';
import { cn } from './utils';

describe('cn utility', () => {
  it('should merge tailwind classes without conflicts', () => {
    expect(cn('bg-red-500', 'text-white')).toBe('bg-red-500 text-white');
  });

  it('should resolve tailwind class conflicts', () => {
    expect(cn('bg-red-500', 'bg-blue-500')).toBe('bg-blue-500');
    expect(cn('p-4', 'p-2')).toBe('p-2');
  });

  it('should handle conditional classes', () => {
    expect(cn('bg-red-500', true && 'text-white', false && 'p-4')).toBe('bg-red-500 text-white');
  });

  it('should handle arrays of classes', () => {
    expect(cn(['bg-red-500', 'text-white'])).toBe('bg-red-500 text-white');
  });

  it('should handle object arguments', () => {
    expect(cn({ 'bg-red-500': true, 'text-white': false })).toBe('bg-red-500');
  });

  it('should handle undefined and null values', () => {
    expect(cn('bg-red-500', undefined, null, 'text-white')).toBe('bg-red-500 text-white');
  });

  it('should handle falsy values like empty string, 0, and NaN', () => {
    expect(cn('bg-red-500', '', 0, NaN, 'text-white')).toBe('bg-red-500 text-white');
  });

  it('should handle complex nested arrays and mixed structures', () => {
    expect(cn(['bg-red-500', ['text-white', { 'font-bold': true, 'italic': false }]])).toBe('bg-red-500 text-white font-bold');
  });

  it('should handle arbitrary values in Tailwind classes', () => {
    expect(cn('w-[10px]', 'w-[20px]')).toBe('w-[20px]');
    expect(cn('text-[14px]', 'text-[#fff]')).toBe('text-[14px] text-[#fff]');
  });
});
