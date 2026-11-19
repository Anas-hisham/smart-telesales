const { Errors } = require('../utils/errors');

/** zod issues -> [{ field, message }] */
function zodErrorToDetails(zodError) {
  const details = [];
  for (const issue of zodError.issues) {
    if (issue.code === 'unrecognized_keys') issue.keys.forEach((key) => details.push({ field: key, message: 'Not accepted here' }));
    else details.push({ field: issue.path.join('.') || 'body', message: issue.message });
  }
  return details;
}

/**
 * validate({ body, query }) -> checks the request and puts the clean data in req.valid.body / req.valid.query
 */
function validateRequest(schemas) {
  return (req, _res, next) => {
    req.valid = {};
    for (const part of ['body', 'query']) {
      if (!schemas[part]) continue;
      const parseResult = schemas[part].safeParse(req[part] ?? {});
      if (!parseResult.success) return next(Errors.validation(zodErrorToDetails(parseResult.error)));
      req.valid[part] = parseResult.data;
    }
    next();
  };
}
module.exports = { validateRequest, zodErrorToDetails };
