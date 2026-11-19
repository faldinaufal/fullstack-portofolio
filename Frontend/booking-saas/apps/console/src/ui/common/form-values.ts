// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// Copyright (c) 2026 Farhan Aldi Naufal

/**
 * Text value of a form field. `FormData.get` returns a File for file inputs, which must not
 * be turned into the string "[object File]", so anything that is not text reads as empty.
 */
export function formText(form: FormData, name: string): string {
  const value = form.get(name);
  return typeof value === 'string' ? value : '';
}
