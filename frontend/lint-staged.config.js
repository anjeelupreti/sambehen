/**
 * Paths arrive absolute from the root hook, so `next lint` is given the
 * file list directly rather than being left to scan the whole project.
 */
module.exports = {
  '*.{ts,tsx}': ['eslint --fix', 'prettier --write'],
  '*.{json,css,md}': ['prettier --write'],
};
