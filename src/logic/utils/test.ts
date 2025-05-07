// return the sum of two numbers
export let a = 1;
export let b = 2;

export function add(a: number, b: number): number {
  return a + b;
}
import { a as aVal, b as bVal } from './test.js';
console.log(aVal, bVal); // 1, 2
