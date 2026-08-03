/**
 * Security scheme names registered in main.ts and referenced by the
 * composite auth decorators.
 *
 * Two separate schemes rather than one, so the "Authorize" dialog makes it
 * visible that team and customer tokens are not interchangeable.
 */
export const TEAM_BEARER = 'team-jwt';
export const CUSTOMER_BEARER = 'customer-jwt';
