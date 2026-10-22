// Server-side validation for creating an event (no extra dependencies).
function validateEventInput(body) {
  const errors = [];

  if (typeof body.title !== 'string' || body.title.trim().length < 3 || body.title.trim().length > 150)
    errors.push('title must be a string of 3-150 characters');

  if (typeof body.description !== 'string' || !body.description.trim() || body.description.length > 5000)
    errors.push('description is required (max 5000 characters)');

  if (typeof body.venue !== 'string' || !body.venue.trim() || body.venue.length > 200)
    errors.push('venue is required (max 200 characters)');

  if (!Number.isInteger(body.capacity) || body.capacity < 1)
    errors.push('capacity must be a whole number of at least 1');

  const start = new Date(body.startDate);
  const end = new Date(body.endDate);
  if (isNaN(start)) errors.push('startDate must be a valid date');
  else if (start <= new Date()) errors.push('startDate must be in the future');
  if (isNaN(end)) errors.push('endDate must be a valid date');
  if (!isNaN(start) && !isNaN(end) && end < start)
    errors.push('endDate cannot be before startDate');

  return errors;
}

module.exports = { validateEventInput };
