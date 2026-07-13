import { z } from 'zod';

/**
 * Helpers to normalize and validate external API strings.
 */
const trim = (v) => (typeof v === 'string' ? v.trim() : v);

const nonEmptyTrimmed = (fieldName) =>
  z.preprocess(trim, z.string().min(1, `${fieldName} is required`));

const optionalTrimmed = () =>
  z.preprocess(trim, z.string().min(1).optional());

/**
 * Photo: accept optional Base64-encoded JPEG string (data URI or raw base64),
 * or any non-empty string if upstream handles it. Keep lenient but non-empty if provided.
 * Examples accepted:
 *  - "/9j/4AAQSkZJRgABAQ..." (raw base64)
 *  - "data:image/jpeg;base64,/9j/4AAQSkZJRgABAQ..." (data URI)
 */
const optionalPhotoBase64 = () =>
  z.preprocess(
    trim,
    z
      .string()
      .min(1)
      .regex(
        /^(data:image\/jpeg;base64,)?[A-Za-z0-9+/=]+$/,
        'photo must be a base64 JPEG string'
      )
      .optional()
  );

// Strict ISO 8601 datetime without timezone offset (e.g., "2025-08-04T12:00:00")
const isoDateTime = z.string().datetime({ offset: false });

// Reusable regex for cardNumber (exact: ^[A-Z0-9]{6,9}$, enforced case-insensitively via i-flag equivalent)
// Zod's regex doesn't take flags; mimic case-insensitive by accepting both cases in pattern,
// while error message reflects the uppercase spec. Uniqueness logic normalizes to uppercase.
const cardNumberRegex = /^[A-Za-z0-9]{6,9}$/;

const cardSchema = z
  .object({
    cardType: z
      .preprocess(
        (v) => (typeof v === 'string' ? v.trim() : v),
        z.enum(['Access', 'MSIC'])
      ),
    cardNumber: z.preprocess(
      trim,
      // Enforce ^[A-Z0-9]{6,9}$ case-insensitively; using both cases in the class
      z
        .string()
        .regex(cardNumberRegex, 'cardNumber must match : 6 to 9 AlphaNumeric characters')
        // Normalize to uppercase for downstream use if needed
        .transform((s) => s.toUpperCase())
    ),
    activationDate: isoDateTime,
    expiryDate: isoDateTime,
  })
  .refine(
    (c) => {
      // safe since isoDateTime validated string
      const from = new Date(c.activationDate).getTime();
      const to = new Date(c.expiryDate).getTime();
      return Number.isFinite(from) && Number.isFinite(to) && to > from;
    },
    { message: 'expiryDate must be after activationDate', path: ['expiryDate'] }
  );

export const cardholderSchema = z
  .object({
    // Make both optional-trimmed, then enforce "at least one present" via refine
    firstName: optionalTrimmed(),
    lastName: optionalTrimmed(),
    email: z.preprocess(
      (v) => {
        if (typeof v !== 'string') return v;
        const t = v.trim();
        return t === '' ? undefined : t; // treat empty as undefined
      },
      z.string().email().optional()
    ),
    divisionName: optionalTrimmed(),
    // photo is optional; if present must be base64 jpeg (raw or data URI)
    photo: optionalPhotoBase64(),
    employmentCategory: optionalTrimmed(),
    // Use base cardSchema directly (it already enforces regex and normalizes case)
    cards: z.array(cardSchema).min(1, 'At least one card is required'),
  })
  // Require firstName (per latest requirement) OR, if you still want to allow lastName-only, revert to hasFirst || hasLast
  .refine(
    (data) => {
      const hasFirst =
        typeof data.firstName === 'string' && data.firstName.trim().length > 0;
      // If you intend to allow lastName-only, set: const hasLast = typeof data.lastName === 'string' && data.lastName.trim().length > 0; return hasFirst || hasLast;
      return hasFirst;
    },
    {
      message: 'firstName is required',
      path: ['firstName'],
    }
  )
  // Enforce unique cardNumber values (case-insensitive; numbers are normalized to uppercase in cardSchema)
  .refine(
    (data) => {
      const seen = new Set();
      for (const c of data.cards) {
        // Ensure at least cardNumber exists due to business rule "cards -> cardNumber"
        const key = c.cardNumber;
        if (!key) return false;
        if (seen.has(key)) return false;
        seen.add(key);
      }
      return true;
    },
    {
      message: 'cardNumber values must be present and unique (case-insensitive)',
      path: ['cards'],
    }
  );

/**
 * Express middleware factory to validate req.body against a Zod schema.
 * Attaches parsed data to req.validated on success.
 */
export function validateBody(schema) {
  return (req, res, next) => {
    const result = schema.safeParse(req.body);
    if (result.success) {
      req.validated = result.data;
      return next();
    }
    const issues = result.error.issues.map((i) => ({
      path: i.path.join('.'),
      message: i.message,
      code: i.code,
    }));
    return res.status(400).json({ error: 'ValidationError', issues });
  };
}

/**
 * Wrapper schema for routes that post { person: Cardholder }
 */
export const requestWithPersonSchema = z.object({
  person: cardholderSchema
});

/**
 * Middleware that validates { person: cardholder } and unwraps to req.validated
 */
export function validateRequestWithPerson(req, res, next) {
  const result = requestWithPersonSchema.safeParse(req.body);
  if (result.success) {
    // Expose both the whole parsed object and the inner person
    req.validated = result.data.person;
    req.validatedRequest = result.data;
    return next();
  }
  const issues = result.error.issues.map((i) => ({
    path: i.path.join('.'),
    message: i.message,
    code: i.code,
  }));
  return res.status(400).json({ error: 'ValidationError', issues });
}

export const validateCardholder = validateBody(cardholderSchema);
export const validatePersonBody = validateRequestWithPerson;

/**
 * Dedicated validator for DELETE /delete_cardholder
 * Only requires: { person: { firstName: string(non-empty) } }
 */
const deletePersonSchema = z.object({
  person: z.object({
    firstName: nonEmptyTrimmed('firstName')
  })
});

export function validateDeletePersonBody(req, res, next) {
  const result = deletePersonSchema.safeParse(req.body);
  if (result.success) {
    req.validated = result.data.person;
    req.validatedRequest = result.data;
    return next();
  }
  const issues = result.error.issues.map((i) => ({
    path: i.path.join('.'),
    message: i.message,
    code: i.code,
  }));
  return res.status(400).json({ error: 'ValidationError', issues });
}

/**
 * Dedicated validator for POST /auth/login
 */
const loginSchema = z.object({
  username: nonEmptyTrimmed('username'),
  password: z.string().min(1, 'password is required'),
});

export function validateLoginBody(req, res, next) {
  const result = loginSchema.safeParse(req.body);
  if (result.success) {
    req.validated = result.data;
    return next();
  }
  const issues = result.error.issues.map((i) => ({
    path: i.path.join('.'),
    message: i.message,
    code: i.code,
  }));
  return res.status(400).json({ error: 'ValidationError', issues });
}