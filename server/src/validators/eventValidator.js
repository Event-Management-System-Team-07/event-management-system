// Server-side validation for creating and editing an event (no extra dependencies).
// partial = true for edits: only validate fields that were actually sent.
function validateEventInput(body, { partial = false } = {}) {
  const errors = [];
  const has = (k) => body[k] !== undefined;
  const need = (k) => !partial || has(k);

  if (need('title')) {
    if (typeof body.title !== 'string' || body.title.trim().length < 3 || body.title.trim().length > 150)
      errors.push('title must be a string of 3-150 characters');
  }
  if (need('description')) {
    if (typeof body.description !== 'string' || !body.description.trim() || body.description.length > 5000)
      errors.push('description is required (max 5000 characters)');
  }
  if (need('venue')) {
    if (typeof body.venue !== 'string' || !body.venue.trim() || body.venue.length > 200)
      errors.push('venue is required (max 200 characters)');
  }
  if (need('capacity')) {
    if (!Number.isInteger(body.capacity) || body.capacity < 1)
      errors.push('capacity must be a whole number of at least 1');
  }

  let start, end;
  if (need('startDate')) {
    start = new Date(body.startDate);
    if (isNaN(start)) errors.push('startDate must be a valid date');
    else if (!partial && start <= new Date()) errors.push('startDate must be in the future');
  }
  if (need('endDate')) {
    end = new Date(body.endDate);
    if (isNaN(end)) errors.push('endDate must be a valid date');
  }
  if (start && end && !isNaN(start) && !isNaN(end) && end < start)
    errors.push('endDate cannot be before startDate');

  return errors;
}

module.exports = { validateEventInput };
