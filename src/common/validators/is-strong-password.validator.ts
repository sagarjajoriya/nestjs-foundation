import {
  registerDecorator,
  ValidationOptions,
  ValidatorConstraint,
  ValidatorConstraintInterface,
} from 'class-validator';

/** Minimum length for a password to be considered strong. */
export const MIN_PASSWORD_LENGTH = 12;

/**
 * Password policy: at least {@link MIN_PASSWORD_LENGTH} characters with at least
 * one lowercase letter, one uppercase letter, one digit and one symbol.
 *
 * Implemented as a custom constraint (rather than the built-in
 * `@IsStrongPassword`) so the policy is explicit and tunable in one place.
 */
@ValidatorConstraint({ name: 'isStrongPassword', async: false })
export class IsStrongPasswordConstraint implements ValidatorConstraintInterface {
  validate(value: unknown): boolean {
    if (typeof value !== 'string' || value.length < MIN_PASSWORD_LENGTH) {
      return false;
    }
    return (
      /[a-z]/.test(value) &&
      /[A-Z]/.test(value) &&
      /\d/.test(value) &&
      /[^A-Za-z0-9]/.test(value)
    );
  }

  defaultMessage(): string {
    return (
      `password must be at least ${MIN_PASSWORD_LENGTH} characters long and ` +
      'contain lowercase, uppercase, number and symbol characters'
    );
  }
}

export function IsStrongPassword(
  validationOptions?: ValidationOptions,
): PropertyDecorator {
  return (object: object, propertyName: string | symbol) => {
    registerDecorator({
      target: object.constructor,
      propertyName: propertyName.toString(),
      options: validationOptions,
      constraints: [],
      validator: IsStrongPasswordConstraint,
    });
  };
}
