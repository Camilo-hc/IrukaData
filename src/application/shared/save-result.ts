import type { FieldErrors } from '../../domain/shared/validation'

export type SaveResult = { ok: true } | { ok: false; message: string; fields?: FieldErrors }
