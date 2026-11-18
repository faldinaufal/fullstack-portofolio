// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// Copyright (c) 2026 Farhan Aldi Naufal

import type { SignupInput } from '../domain/auth';
import { PASSWORD_MIN_LENGTH, passwordProblem, slugFromBusinessName } from '../domain/auth-rules';

export { PASSWORD_MIN_LENGTH };

/** Business address suggested from the business name while the owner has not edited it. */
export const suggestSlug = slugFromBusinessName;

export type FieldErrors = Record<string, string>;

/** Instant checks before calling the API; the API validates everything again. */
export function validateSignup(values: SignupInput): FieldErrors {
  const errors: FieldErrors = {};
  if (values.name.trim().length < 2) errors.name = 'Enter your name.';
  if (!/^\S+@\S+\.\S+$/.test(values.email.trim())) errors.email = 'Enter a valid email address.';
  const password = passwordProblem(values.password, values.email);
  if (password) errors.password = password;
  if (values.businessName.trim().length < 2) errors.businessName = 'Enter the business name.';
  if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(values.slug) || values.slug.length < 3) {
    errors.slug = 'Use 3–40 lowercase letters, digits and single hyphens.';
  }
  return errors;
}

export function validateNewPassword(password: string, confirmation: string): FieldErrors {
  const errors: FieldErrors = {};
  if (password.length < PASSWORD_MIN_LENGTH) {
    errors.password = `Use at least ${PASSWORD_MIN_LENGTH} characters.`;
  }
  if (confirmation !== password) errors.confirmation = 'The passwords do not match.';
  return errors;
}
