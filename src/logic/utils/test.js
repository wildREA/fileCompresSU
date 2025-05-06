export let a = 1;
export let b = 2;

export function add(a, b) {
  return a + b;
}

import { a as aVal, b as bVal } from './test.js';
console.log(aVal, bVal); // 1, 2
