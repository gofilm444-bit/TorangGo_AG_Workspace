import {
  ValidationPipe as NestValidationPipe,
  ValidationError as NestValidationError,
} from '@nestjs/common';
import { ValidationError } from '../errors/app-error.js';

function formatErrors(errors: NestValidationError[]): Record<string, string[]> {
  const fields: Record<string, string[]> = {};

  function traverse(errs: NestValidationError[], parentPath = ''): void {
    for (const err of errs) {
      const fieldPath = parentPath ? `${parentPath}.${err.property}` : err.property;
      if (err.constraints) {
        fields[fieldPath] = Object.values(err.constraints);
      }
      if (err.children && err.children.length > 0) {
        traverse(err.children, fieldPath);
      }
    }
  }

  traverse(errors);
  return fields;
}

export function createValidationPipe(): NestValidationPipe {
  return new NestValidationPipe({
    whitelist: true,
    forbidNonWhitelisted: true,
    transform: true,
    exceptionFactory: (errors: NestValidationError[]) => {
      const fields = formatErrors(errors);
      return new ValidationError('Validation failed', { fields });
    },
  });
}