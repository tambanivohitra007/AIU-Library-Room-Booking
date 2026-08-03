import { body, validationResult } from 'express-validator';
import { Request, Response, NextFunction } from 'express';
import { isMessageKey, trReq } from '../services/i18n.js';

// Validators carry a message KEY rather than English prose, so the text is
// resolved here where the request (and therefore Accept-Language) is available.
// Anything that isn't a known key - e.g. an express-validator default - is
// passed through unchanged.
export const handleValidationErrors = (req: Request, res: Response, next: NextFunction) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    const msg = errors.array()[0].msg;
    return res.status(400).json({
      error: isMessageKey(msg) ? trReq(req, msg) : msg,
    });
  }
  next();
};

export const validateRegister = [
  body('email').isEmail().withMessage('invalidEmail'),
  body('password').isLength({ min: 6 }).withMessage('passwordMin6'),
  body('name').trim().notEmpty().withMessage('nameRequired'),
  handleValidationErrors,
];

export const validateLogin = [
  body('email').isEmail().withMessage('invalidEmail'),
  body('password').notEmpty().withMessage('passwordRequired'),
  handleValidationErrors,
];

export const validateBooking = [
  body('roomId').notEmpty().withMessage('roomIdRequired'),
  body('startTime').isISO8601().withMessage('invalidStartTime'),
  body('endTime').isISO8601().withMessage('invalidEndTime'),
  body('purpose').trim().notEmpty().withMessage('purposeRequired'),
  body('attendees').isArray({ min: 1 }).withMessage('attendeeRequired'),
  handleValidationErrors,
];
